// stream-proxy/server.js
// Standalone High-Performance Audio Streaming Microservice untuk MusikKu
// Zero external dependencies (Pure Node.js standard library)

const http = require("http");
const https = require("https");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");
const os = require("os");

const execFileAsync = promisify(execFile);

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const CACHE_TTL_MS = (parseInt(process.env.CACHE_TTL_MINUTES || "120", 10)) * 60 * 1000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// In-memory URL cache: videoId -> { url: string, expiresAt: number, formatId?: string, ext?: string }
const streamCache = new Map();

// In-memory diagnostic log: videoId -> { errorType: string, reason: string, timestamp: number }
const lastFailureDiagnostics = new Map();

// CORS Headers standar untuk Web Audio API & Range Requests
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Origin, Authorization, X-Requested-With",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, Content-Type",
  "Access-Control-Max-Age": "86400",
};

/**
 * Sanitasi string log untuk memastikan cookie, token, dan kredensial tidak pernah dicatat (Requirement 9)
 */
function sanitizeLog(message) {
  if (typeof message !== "string") {
    message = String(message || "");
  }
  return message
    .replace(/(cookies|cookie):\s*([^\n;]+)/gi, "$1: [REDACTED]")
    .replace(/(?:([?&]|\b)(?:sig|lsig|token|po_token|key|auth|session)=)[^\s&;,]+/gi, "$1=[REDACTED]")
    .replace(/(https?:\/\/[^\s"'<>]+\/videoplayback\?)[^\s"'<>]+/gi, "$1[STREAM_PARAMS_REDACTED]");
}

/**
 * Mencari path binary yt-dlp pada sistem
 */
function findYtDlpBinary() {
  if (process.env.YT_DLP_PATH && fs.existsSync(process.env.YT_DLP_PATH)) {
    return process.env.YT_DLP_PATH;
  }
  const candidates = [
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "/root/.local/bin/yt-dlp",
    "/home/miran/.local/bin/yt-dlp",
    "/home/linuxbrew/.linuxbrew/bin/yt-dlp",
    "yt-dlp",
  ];
  for (const c of candidates) {
    if (c === "yt-dlp") return c;
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return "yt-dlp";
}

/**
 * Mendapatkan lokasi runtime Node.js untuk challenge solver yt-dlp EJS
 */
function getNodeRuntime() {
  return process.execPath || "node";
}

/**
 * Ekstraksi timestamp expire dari query param URL googlevideo
 */
function extractExpiryMs(url) {
  try {
    const parsed = new URL(url);
    const expireParam = parsed.searchParams.get("expire");
    if (expireParam) {
      const expireSec = parseInt(expireParam, 10);
      if (!isNaN(expireSec) && expireSec > 0) {
        // Beri toleransi 5 menit sebelum batas waktu kedaluwarsa URL
        const expiryTime = expireSec * 1000 - 5 * 60 * 1000;
        if (expiryTime > Date.now()) return expiryTime;
      }
    }
  } catch {}
  return Date.now() + CACHE_TTL_MS;
}

/**
 * Menyiapkan file cookies jika disediakan via environment variable atau file lokal
 */
function setupCookiesFile() {
  if (process.env.YOUTUBE_COOKIES && process.env.YOUTUBE_COOKIES.trim().length > 0) {
    const raw = process.env.YOUTUBE_COOKIES.trim();
    let content = raw;
    if (!raw.includes("\n") && !raw.startsWith("#") && raw.length > 20) {
      try {
        const decoded = Buffer.from(raw, "base64").toString("utf-8");
        if (decoded.includes("youtube.com") || decoded.includes("# Netscape")) {
          content = decoded;
        }
      } catch {}
    }
    const targetPath = path.join(os.tmpdir(), "youtube_cookies.txt");
    try {
      fs.writeFileSync(targetPath, content, { encoding: "utf-8", mode: 0o600 });
      return targetPath;
    } catch (err) {
      console.warn("[StreamProxy] Gagal menulis YOUTUBE_COOKIES ke disk:", sanitizeLog(err.message));
    }
  }

  const customPath = process.env.YOUTUBE_COOKIES_PATH || process.env.COOKIES_FILE;
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const localCandidates = [
    path.join(__dirname, "cookies.txt"),
    "/app/cookies.txt",
    path.join(os.tmpdir(), "cookies.txt"),
  ];
  for (const candidate of localCandidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).size > 0) {
        return candidate;
      }
    } catch {}
  }

  return null;
}

/**
 * Strategi pemilihan format audio cerdas (Requirement 4).
 * Memverifikasi format yang dikembalikan extractor tanpa mengunci format ID tertentu.
 * Mengutamakan format audio m4a (AAC) dan webm (Opus), dengan fallback ke video+audio jika hanya itu yang tersedia.
 */
function selectBestAudioFormat(formats) {
  if (!Array.isArray(formats) || formats.length === 0) return null;

  // Filter format yang memiliki direct URL HTTP/HTTPS (abaikan manifest m3u8 dan storyboard)
  const validCandidates = formats.filter((f) => {
    if (!f || typeof f.url !== "string") return false;
    if (!f.url.startsWith("http")) return false;
    if (f.url.includes("manifest/hls") || f.protocol === "m3u8_native") return false;
    if (f.ext === "mhtml") return false;
    // Harus memiliki audio stream
    return Boolean(f.acodec && f.acodec !== "none");
  });

  if (validCandidates.length === 0) {
    // Toleransi: jika tidak ada format dengan metadata acodec eksplisit, cari format apa pun yang memiliki URL langsung
    const anyHttp = formats.filter(
      (f) => f && typeof f.url === "string" && f.url.startsWith("http") && !f.url.includes("manifest/hls") && f.ext !== "mhtml"
    );
    if (anyHttp.length > 0) {
      return {
        url: anyHttp[0].url,
        formatId: anyHttp[0].format_id || "unknown",
        ext: anyHttp[0].ext || "mp4",
        acodec: anyHttp[0].acodec || "unknown",
        vcodec: anyHttp[0].vcodec || "none",
        bitrate: anyHttp[0].abr || anyHttp[0].tbr || 0,
      };
    }
    return null;
  }

  // Beri skor pada setiap kandidat
  const scored = validCandidates.map((f) => {
    let score = 0;
    const isStandaloneAudio = !f.vcodec || f.vcodec === "none";

    // Standalone audio mendapat prioritas tertinggi
    if (isStandaloneAudio) {
      score += 1000;
    }

    // AAC (m4a/mp4a) memiliki kompatibilitas 100% untuk HTML5 Audio & Web Audio API
    const isAac = f.ext === "m4a" || (typeof f.acodec === "string" && f.acodec.includes("mp4a"));
    const isOpus = f.ext === "webm" || (typeof f.acodec === "string" && f.acodec.includes("opus"));

    if (isAac) {
      score += 500;
    } else if (isOpus) {
      score += 400;
    } else {
      score += 200;
    }

    // Tambahkan bitrate sebagai penentu kualitas (format 140 / 251 vs 139 / 249)
    const bitrate = Number(f.abr || f.tbr) || 0;
    score += Math.min(bitrate, 320);

    return {
      format: f,
      score,
      bitrate,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].format;

  return {
    url: best.url,
    formatId: best.format_id,
    ext: best.ext,
    acodec: best.acodec,
    vcodec: best.vcodec,
    bitrate: best.abr || best.tbr || 0,
  };
}

/**
 * Mengklasifikasikan error ekstraksi untuk fallback yang tepat (Requirement 5 & 6)
 */
function classifyExtractionError(errText) {
  const text = String(errText || "");
  if (/needs to be reloaded|UNPLAYABLE|tv_downgraded/i.test(text)) {
    return "PAGE_RELOAD";
  }
  if (/Requested format is not available|Only images are available/i.test(text)) {
    return "FORMAT_UNAVAILABLE";
  }
  if (/Sign in to confirm you’re not a bot|bot-check|captcha/i.test(text)) {
    return "BOT_CHECK";
  }
  if (/video is unavailable|private video|removed by the uploader/i.test(text)) {
    return "UNAVAILABLE";
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(text)) {
    return "TIMEOUT";
  }
  return "UNKNOWN";
}

/**
 * Resolusi URL stream langsung via yt-dlp dengan error-aware fallback (Requirement 3, 4, 5, 6)
 */
async function resolveViaYtDlp(videoId) {
  const binary = findYtDlpBinary();
  const target = `https://www.youtube.com/watch?v=${videoId}`;
  const cookiesPath = setupCookiesFile();
  const nodeRuntime = getNodeRuntime();

  // Base arguments: TLS keamanan diaktifkan (tanpa --no-check-certificates), JS runtime dihubungkan
  const baseArgs = [
    "--no-warnings",
    "--geo-bypass",
    "--force-ipv4",
    "--js-runtimes",
    `node:${nodeRuntime}`,
    "--remote-components",
    "ejs:github",
  ];

  if (cookiesPath) {
    baseArgs.push("--cookies", cookiesPath);
  }

  // PERCOBAAN 1: Chain multi-client modern (visionos, android, web_embedded) + dump-single-json
  let initialErrorType = "NONE";
  try {
    const attempt1Args = [
      ...baseArgs,
      "--extractor-args",
      "youtube:player_client=visionos,android,web_embedded",
      "--dump-single-json",
      target,
    ];

    const { stdout } = await execFileAsync(binary, attempt1Args, {
      timeout: 14000,
      maxBuffer: 15 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout);
    const selected = selectBestAudioFormat(parsed.formats);

    if (selected && selected.url) {
      return {
        url: selected.url,
        ext: selected.ext,
        formatId: selected.formatId,
      };
    }
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || "").trim();
    initialErrorType = classifyExtractionError(detail);
    const sanitizedMsg = sanitizeLog(detail.split("\n")[0] || detail);

    lastFailureDiagnostics.set(videoId, {
      errorType: initialErrorType,
      reason: sanitizedMsg,
      timestamp: Date.now(),
    });

    console.warn(
      `[StreamProxy] yt-dlp primary attempt failed for ${videoId} [Type: ${initialErrorType}]:`,
      sanitizedMsg
    );
  }

  // PERCOBAAN 2: Fallback terarah sesuai klasifikasi error (Jangan mengulang konfigurasi yang sama)
  try {
    const attempt2Args = [...baseArgs];

    if (initialErrorType === "PAGE_RELOAD") {
      // Jika terjadi tantangan web reload, gunakan client embedded & android vr murni yang tidak kena challenge reload
      attempt2Args.push(
        "--extractor-args",
        "youtube:player_client=android_vr,web_embedded",
        "--dump-single-json",
        target
      );
      const { stdout } = await execFileAsync(binary, attempt2Args, {
        timeout: 12000,
        maxBuffer: 15 * 1024 * 1024,
      });
      const parsed = JSON.parse(stdout);
      const selected = selectBestAudioFormat(parsed.formats);
      if (selected && selected.url) {
        return {
          url: selected.url,
          ext: selected.ext,
          formatId: selected.formatId,
        };
      }
    } else {
      // Jika format tidak tersedia atau error lainnya, gunakan format selection fleksibel dengan -g
      attempt2Args.push(
        "--extractor-args",
        "youtube:player_client=android,ios,web_embedded",
        "-f",
        "ba[ext=m4a]/ba[ext=mp4]/ba/b[ext=mp4]/b/best",
        "-g",
        target
      );
      const { stdout } = await execFileAsync(binary, attempt2Args, {
        timeout: 12000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const resolvedUrl = stdout.trim().split("\n")[0]?.trim();
      if (resolvedUrl && resolvedUrl.startsWith("http")) {
        return {
          url: resolvedUrl,
          ext: resolvedUrl.includes("mime=audio%2Fwebm") ? "webm" : "m4a",
          formatId: "fallback_g",
        };
      }
    }
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || "").trim();
    const secondErrorType = classifyExtractionError(detail);
    const sanitizedMsg = sanitizeLog(detail.split("\n")[0] || detail);

    lastFailureDiagnostics.set(videoId, {
      errorType: secondErrorType,
      reason: sanitizedMsg,
      timestamp: Date.now(),
    });

    console.warn(
      `[StreamProxy] yt-dlp secondary fallback failed for ${videoId} [Type: ${secondErrorType}]:`,
      sanitizedMsg
    );
  }

  return null;
}

/**
 * Fallback multi-instance pihak ketiga (Invidious & Piped) dengan timeout cepat
 */
async function resolveViaFallback(videoId) {
  const instances = [
    { type: "invidious", url: "https://invidious.f5.si" },
    { type: "invidious", url: "https://yewtu.be" },
    { type: "invidious", url: "https://inv.nadeko.net" },
    { type: "piped", url: "https://pipedapi.kavin.rocks" },
    { type: "piped", url: "https://pipedapi.drgns.space" },
  ];

  for (const inst of instances) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const endpoint =
        inst.type === "invidious"
          ? `${inst.url}/api/v1/videos/${videoId}`
          : `${inst.url}/streams/${videoId}`;

      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const data = await res.json();

      if (inst.type === "invidious") {
        const formats = [...(data.adaptiveFormats || []), ...(data.formatStreams || [])];
        const audios = formats.filter(
          (f) => f.type?.startsWith("audio/") && f.url?.startsWith("http")
        );
        if (audios.length > 0) {
          audios.sort((a, b) => {
            const aM = a.type?.includes("mp4") ? 1 : 0;
            const bM = b.type?.includes("mp4") ? 1 : 0;
            if (aM !== bM) return bM - aM;
            return (b.bitrate || 0) - (a.bitrate || 0);
          });
          return { url: audios[0].url, ext: "m4a", formatId: "invidious" };
        }
      } else {
        const audios = data.audioStreams;
        if (Array.isArray(audios) && audios.length > 0) {
          audios.sort((a, b) => {
            const aM = a.mimeType?.includes("mp4") ? 1 : 0;
            const bM = b.mimeType?.includes("mp4") ? 1 : 0;
            if (aM !== bM) return bM - aM;
            return (b.bitrate || 0) - (a.bitrate || 0);
          });
          return { url: audios[0].url, ext: "m4a", formatId: "piped" };
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Mengambil URL stream audio langsung, memeriksa cache, dan auto-retry jika dibutuhkan
 */
async function getDirectAudioUrl(videoId, forceFresh = false) {
  if (!forceFresh) {
    const cached = streamCache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }
  }

  let resolved = await resolveViaYtDlp(videoId);
  if (!resolved) {
    resolved = await resolveViaFallback(videoId);
  }

  if (resolved && resolved.url) {
    const expiresAt = extractExpiryMs(resolved.url);
    const entry = {
      url: resolved.url,
      expiresAt,
      ext: resolved.ext || "m4a",
      formatId: resolved.formatId || "unknown",
    };
    streamCache.set(videoId, entry);
    return entry;
  }
  return null;
}

/**
 * Handle HTTP request
 */
async function handleRequest(req, res) {
  const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = reqUrl.pathname;

  // Set CORS default headers
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }

  // Preflight OPTIONS
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Healthcheck endpoint (Requirement 2 & 3)
  if (pathname === "/" || pathname === "/health") {
    let ytVersion = "unknown";
    try {
      const { stdout } = await execFileAsync(findYtDlpBinary(), ["--version"], { timeout: 3000 });
      ytVersion = stdout.trim();
    } catch {}

    const payload = JSON.stringify({
      status: "ok",
      service: "musiku-stream-proxy",
      version: "1.1.0",
      ytDlpVersion: ytVersion,
      nodeVersion: process.version,
      nodeRuntime: getNodeRuntime(),
      cachedVideos: streamCache.size,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
    return;
  }

  // Diagnostic endpoint untuk memeriksa status ekstraksi ID video terakhir
  if (pathname === "/api/diagnostics") {
    const videoId = reqUrl.searchParams.get("v");
    if (!videoId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Parameter videoId ('v') wajib diisi." }));
      return;
    }
    const diag = lastFailureDiagnostics.get(videoId);
    const inCache = streamCache.has(videoId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        videoId,
        hasCachedStream: inCache,
        lastFailure: diag || null,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Search Endpoint: /api/search?q=...&maxResults=...
  if (pathname === "/api/search") {
    const q = reqUrl.searchParams.get("q");
    const maxResults = Math.min(Math.max(parseInt(reqUrl.searchParams.get("maxResults") || "12", 10), 1), 30);
    if (!q || q.trim().length === 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Parameter q wajib diisi." }));
      return;
    }

    try {
      const binary = findYtDlpBinary();
      const { stdout } = await execFileAsync(
        binary,
        [
          "--no-warnings",
          "--geo-bypass",
          "--force-ipv4",
          "--flat-playlist",
          "--dump-single-json",
          `ytsearch${maxResults}:${q.trim()}`,
        ],
        { timeout: 12000, maxBuffer: 10 * 1024 * 1024 }
      );
      const parsed = JSON.parse(stdout);
      const entries = parsed.entries || [];
      const items = entries.map((e) => ({
        videoId: e.id,
        title: e.title || "(tanpa judul)",
        channelTitle: e.channel || e.uploader || "Unknown",
        channelId: e.channel_id,
        thumbnail:
          e.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg`,
        publishedAt: e.upload_date,
        description: e.description,
      }));

      const payload = JSON.stringify({ items, totalResults: items.length });
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=180",
      });
      res.end(payload);
      return;
    } catch (err) {
      console.warn(`[StreamProxy] Search failed for ${q}:`, sanitizeLog(err.message));
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Gagal melakukan pencarian via proxy." }));
      return;
    }
  }

  // Audio Stream Endpoint: /api/stream?v=...
  if (pathname === "/api/stream") {
    const videoId = reqUrl.searchParams.get("v");
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      const errPayload = JSON.stringify({ error: "Parameter videoId ('v') tidak valid." });
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(errPayload);
      return;
    }

    const isHead = req.method === "HEAD";
    const range = req.headers["range"];
    const forwardHeaders = {
      "User-Agent":
        req.headers["user-agent"] ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
    };
    if (range) {
      forwardHeaders["range"] = range;
    }

    let streamEntry = await getDirectAudioUrl(videoId);
    if (!streamEntry || !streamEntry.url) {
      const diag = lastFailureDiagnostics.get(videoId);
      const errPayload = JSON.stringify({
        error: "Gagal mengekstrak aliran audio untuk video ini.",
        videoId,
        errorType: diag?.errorType || "UNKNOWN",
        reason: diag?.reason || "Extractor failed to resolve stream URL",
      });
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(errPayload);
      return;
    }

    // Flag untuk mendeteksi apakah client menutup koneksi terlebih dahulu (Requirement 7)
    let isClientClosed = false;

    const fetchStream = (targetUrl, redirectCount = 0) =>
      new Promise((resolve, reject) => {
        if (redirectCount > 5) {
          return reject(new Error("Terlalu banyak redirect upstream"));
        }
        if (isClientClosed) {
          return reject(new Error("Request client sudah dibatalkan"));
        }

        try {
          const client = targetUrl.startsWith("https") ? https : http;
          const upstreamReq = client.request(
            targetUrl,
            {
              method: isHead ? "HEAD" : "GET",
              headers: forwardHeaders,
              timeout: 10000,
            },
            (upstreamRes) => {
              if (
                [301, 302, 303, 307, 308].includes(upstreamRes.statusCode) &&
                upstreamRes.headers.location
              ) {
                const nextUrl = new URL(upstreamRes.headers.location, targetUrl).toString();
                upstreamRes.destroy();
                return resolve(fetchStream(nextUrl, redirectCount + 1));
              }
              resolve({ upstreamReq, upstreamRes });
            }
          );

          upstreamReq.on("timeout", () => {
            upstreamReq.destroy();
            reject(new Error("Upstream timeout"));
          });

          upstreamReq.on("error", (err) => {
            if (isClientClosed) return;
            reject(err);
          });

          upstreamReq.end();

          // Hubungkan pembatalan client dengan request upstream
          req.once("close", () => {
            isClientClosed = true;
            if (!upstreamReq.destroyed) upstreamReq.destroy();
          });
        } catch (err) {
          reject(err);
        }
      });

    let conn = null;
    try {
      conn = await fetchStream(streamEntry.url);
    } catch (err) {
      if (isClientClosed) return;

      // Jangan retry jika error disebabkan oleh pembatalan client
      if (err.message && (err.message.includes("dibatalkan") || err.message.includes("aborted"))) {
        return;
      }

      // Refresh cache jika request pertama gagal/timeout
      streamCache.delete(videoId);
      const freshEntry = await getDirectAudioUrl(videoId, true);
      if (freshEntry && freshEntry.url) {
        streamEntry = freshEntry;
        try {
          conn = await fetchStream(streamEntry.url);
        } catch {}
      }
    }

    // Refresh jika upstream status expired (403, 404, 410)
    if (conn && conn.upstreamRes && [403, 404, 410].includes(conn.upstreamRes.statusCode)) {
      conn.upstreamRes.destroy();
      streamCache.delete(videoId);
      const freshEntry = await getDirectAudioUrl(videoId, true);
      if (freshEntry && freshEntry.url) {
        streamEntry = freshEntry;
        try {
          conn = await fetchStream(streamEntry.url);
        } catch {}
      }
    }

    if (!conn || !conn.upstreamRes) {
      if (isClientClosed) return;
      streamCache.delete(videoId);
      const errPayload = JSON.stringify({ error: "Koneksi ke aliran audio upstream gagal atau timeout." });
      res.writeHead(504, { "Content-Type": "application/json" });
      res.end(errPayload);
      return;
    }

    const { upstreamRes } = conn;

    // Tentukan Content-Type yang tepat untuk Web Audio API
    let contentType = upstreamRes.headers["content-type"];
    if (!contentType || contentType === "application/octet-stream") {
      contentType = streamEntry.ext === "webm" ? "audio/webm" : "audio/mp4";
    }

    // Response header forwarding (Requirement 8)
    const responseHeaders = {
      ...CORS_HEADERS,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    };
    if (upstreamRes.headers["content-length"]) {
      responseHeaders["Content-Length"] = upstreamRes.headers["content-length"];
    }
    if (upstreamRes.headers["content-range"]) {
      responseHeaders["Content-Range"] = upstreamRes.headers["content-range"];
    }

    res.writeHead(upstreamRes.statusCode || 200, responseHeaders);

    if (isHead) {
      res.end();
      upstreamRes.destroy();
      return;
    }

    // Pipe upstream audio chunk langsung ke response client
    upstreamRes.pipe(res);

    // Bersihkan upstream jika client menutup koneksi (misal user pause, seek, atau skip track) (Requirement 7 & 8)
    req.on("close", () => {
      isClientClosed = true;
      if (!upstreamRes.destroyed) {
        upstreamRes.destroy();
      }
    });

    req.on("aborted", () => {
      isClientClosed = true;
      if (!upstreamRes.destroyed) {
        upstreamRes.destroy();
      }
    });

    // Penanganan error stream upstream yang membedakan pembatalan client dari error jaringan sejati (Requirement 7)
    upstreamRes.on("error", (err) => {
      const isClientAborted =
        isClientClosed ||
        req.destroyed ||
        err.message === "aborted" ||
        err.code === "ERR_STREAM_PREMATURE_CLOSE" ||
        err.code === "ECONNRESET";

      // Jika client yang membatalkan (user seek / skip), JANGAN catat error, JANGAN hapus cache, JANGAN picu retry
      if (isClientAborted) {
        return;
      }

      console.warn(`[StreamProxy] Upstream pipe error for ${videoId}:`, sanitizeLog(err.message));
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Gagal menyalurkan audio upstream." }));
      }
    });

    return;
  }

  // Not Found
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route tidak ditemukan." }));
}

// Inisialisasi HTTP Server
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error("[StreamProxy] Unhandled error:", sanitizeLog(err.message || String(err)));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Terjadi kesalahan internal server." }));
    }
  });
});

// Periodic cache cleanup (setiap 30 menit)
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of streamCache.entries()) {
    if (entry.expiresAt <= now) {
      streamCache.delete(id);
    }
  }
  for (const [id, diag] of lastFailureDiagnostics.entries()) {
    if (now - diag.timestamp > 30 * 60 * 1000) {
      lastFailureDiagnostics.delete(id);
    }
  }
}, 30 * 60 * 1000);

// Inisialisasi HTTP Server pada semua port potensial (Railway PORT, 3001, 8080, 3000)
const PORTS_TO_LISTEN = Array.from(
  new Set(
    [
      PORT,
      3001,
      8080,
      3000,
      process.env.RAILWAY_PORT ? parseInt(process.env.RAILWAY_PORT, 10) : null,
    ].filter(Boolean)
  )
);

const activeServers = [];
if (require.main === module) {
  for (const p of PORTS_TO_LISTEN) {
    try {
      const s = http.createServer((req, res) => {
        handleRequest(req, res).catch((err) => {
          console.error("[StreamProxy] Unhandled error:", sanitizeLog(err.message || String(err)));
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Terjadi kesalahan internal server." }));
          }
        });
      });
      s.on("error", (err) => {
        if (err.code !== "EADDRINUSE") {
          console.warn(`[StreamProxy] Notice on port ${p}:`, sanitizeLog(err.message));
        }
      });
      s.listen(p, HOST, () => {
        console.log(`🚀 Server aktif di: http://${HOST}:${p}`);
      });
      activeServers.push(s);
    } catch (err) {
      // Port sudah terikat
    }
  }

  const detectedCookies = setupCookiesFile();
  console.log(`======================================================`);
  console.log(`🎵 MusikKu Stream Proxy Microservice v1.1.0`);
  console.log(`🔍 yt-dlp binary : ${findYtDlpBinary()}`);
  console.log(`⚡ Node runtime  : ${getNodeRuntime()}`);
  console.log(`🍪 Cookies file  : ${detectedCookies ? "loaded (local)" : "none (atur YOUTUBE_COOKIES di Railway jika diperlukan)"}`);
  console.log(`🌐 Allowed origin: ${ALLOWED_ORIGIN}`);
  console.log(`🛡️  TLS Security : STRICT (Certificates verified)`);
  console.log(`======================================================`);

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[StreamProxy] SIGTERM received, shutting down gracefully...");
    activeServers.forEach((s) => s.close());
    setTimeout(() => process.exit(0), 1000);
  });
  process.on("SIGINT", () => {
    console.log("[StreamProxy] SIGINT received, shutting down gracefully...");
    activeServers.forEach((s) => s.close());
    setTimeout(() => process.exit(0), 1000);
  });
}

module.exports = {
  findYtDlpBinary,
  getNodeRuntime,
  selectBestAudioFormat,
  classifyExtractionError,
  sanitizeLog,
  extractExpiryMs,
  handleRequest,
};
