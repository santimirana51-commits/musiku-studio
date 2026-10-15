// stream-proxy/server.js
// Standalone High-Performance Audio Streaming Microservice untuk MusikKu
// Zero external dependencies (Pure Node.js standard library)

const http = require("http");
const https = require("https");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { URL } = require("url");
const fs = require("fs");

const execFileAsync = promisify(execFile);

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const CACHE_TTL_MS = (parseInt(process.env.CACHE_TTL_MINUTES || "120", 10)) * 60 * 1000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// In-memory URL cache: videoId -> { url: string, expiresAt: number }
const streamCache = new Map();

// CORS Headers standar untuk Web Audio API & Range Requests
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Origin, Authorization, X-Requested-With",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, Content-Type",
  "Access-Control-Max-Age": "86400",
};

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
 * Ekstraksi timestamp expire dari query param URL googlevideo
 */
function extractExpiryMs(url) {
  try {
    const parsed = new URL(url);
    const expireParam = parsed.searchParams.get("expire");
    if (expireParam) {
      const expireSec = parseInt(expireParam, 10);
      if (!isNaN(expireSec) && expireSec > 0) {
        const expiryTime = expireSec * 1000 - 5 * 60 * 1000;
        if (expiryTime > Date.now()) return expiryTime;
      }
    }
  } catch {}
  return Date.now() + CACHE_TTL_MS;
}

/**
 * Resolusi URL stream langsung via yt-dlp
 */
async function resolveViaYtDlp(videoId) {
  const binary = findYtDlpBinary();
  const target = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const { stdout } = await execFileAsync(
      binary,
      [
        "--no-warnings",
        "--geo-bypass",
        "--force-ipv4",
        "--no-check-certificates",
        "--extractor-args",
        "youtube:player_client=android,web",
        "-g",
        "-f",
        "bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio/best",
        target,
      ],
      { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
    );
    const resolvedUrl = stdout.trim().split("\n")[0]?.trim();
    if (resolvedUrl && resolvedUrl.startsWith("http")) {
      return resolvedUrl;
    }
  } catch (err) {
    console.warn(`[StreamProxy] yt-dlp failed for ${videoId}:`, err.message);
  }
  return null;
}

/**
 * Fallback multi-instance (Invidious & Piped)
 */
async function resolveViaFallback(videoId) {
  const instances = [
    { type: "invidious", url: "https://inv.tux.pizza" },
    { type: "invidious", url: "https://yewtu.be" },
    { type: "invidious", url: "https://invidious.nerdvpn.de" },
    { type: "piped", url: "https://pipedapi.kavin.rocks" },
    { type: "piped", url: "https://api.piped.privacydev.net" },
    { type: "piped", url: "https://pipedapi.tokhmi.xyz" },
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
          return audios[0].url;
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
          return audios[0].url;
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
      return cached.url;
    }
  }

  let resolved = await resolveViaYtDlp(videoId);
  if (!resolved) {
    resolved = await resolveViaFallback(videoId);
  }

  if (resolved) {
    const expiresAt = extractExpiryMs(resolved);
    streamCache.set(videoId, { url: resolved, expiresAt });
    return resolved;
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

  // Healthcheck endpoint
  if (pathname === "/" || pathname === "/health") {
    let ytVersion = "unknown";
    try {
      const { stdout } = await execFileAsync(findYtDlpBinary(), ["--version"], { timeout: 3000 });
      ytVersion = stdout.trim();
    } catch {}

    const payload = JSON.stringify({
      status: "ok",
      service: "musiku-stream-proxy",
      version: "1.0.0",
      ytDlpVersion: ytVersion,
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
      "User-Agent": req.headers["user-agent"] || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
    };
    if (range) {
      forwardHeaders["range"] = range;
    }

    let directUrl = await getDirectAudioUrl(videoId);
    if (!directUrl) {
      const errPayload = JSON.stringify({ error: "Gagal mengekstrak aliran audio untuk video ini." });
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(errPayload);
      return;
    }

    const fetchStream = (url) =>
      new Promise((resolve, reject) => {
        try {
          const client = url.startsWith("https") ? https : http;
          const upstreamReq = client.request(
            url,
            {
              method: isHead ? "HEAD" : "GET",
              headers: forwardHeaders,
              timeout: 10000,
            },
            (upstreamRes) => resolve(upstreamRes)
          );

          upstreamReq.on("timeout", () => {
            upstreamReq.destroy();
            reject(new Error("Upstream timeout"));
          });
          upstreamReq.on("error", reject);
          upstreamReq.end();
        } catch (err) {
          reject(err);
        }
      });

    let upstreamRes = null;
    try {
      upstreamRes = await fetchStream(directUrl);
    } catch {
      // Refresh cache jika request pertama gagal/timeout
      streamCache.delete(videoId);
      const freshUrl = await getDirectAudioUrl(videoId, true);
      if (freshUrl) {
        directUrl = freshUrl;
        try {
          upstreamRes = await fetchStream(directUrl);
        } catch {}
      }
    }

    // Refresh jika upstream status expired (403, 404, 410)
    if (upstreamRes && [403, 404, 410].includes(upstreamRes.statusCode)) {
      streamCache.delete(videoId);
      const freshUrl = await getDirectAudioUrl(videoId, true);
      if (freshUrl) {
        directUrl = freshUrl;
        try {
          upstreamRes = await fetchStream(directUrl);
        } catch {}
      }
    }

    if (!upstreamRes) {
      streamCache.delete(videoId);
      const errPayload = JSON.stringify({ error: "Koneksi ke aliran audio timeout." });
      res.writeHead(504, { "Content-Type": "application/json" });
      res.end(errPayload);
      return;
    }

    // Response header forwarding
    const responseHeaders = {
      ...CORS_HEADERS,
      "Content-Type": upstreamRes.headers["content-type"] || "audio/mp4",
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

    // Bersihkan upstream jika client menutup koneksi (misal skip/pause)
    req.on("close", () => {
      if (!upstreamRes.destroyed) {
        upstreamRes.destroy();
      }
    });

    upstreamRes.on("error", (err) => {
      console.warn(`[StreamProxy] Upstream pipe error for ${videoId}:`, err.message);
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
    console.error("[StreamProxy] Unhandled error:", err);
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
}, 30 * 60 * 1000);

server.listen(PORT, HOST, () => {
  console.log(`======================================================`);
  console.log(`🎵 MusikKu Stream Proxy Microservice`);
  console.log(`🚀 Server aktif di: http://${HOST}:${PORT}`);
  console.log(`🔍 yt-dlp binary : ${findYtDlpBinary()}`);
  console.log(`🌐 Allowed origin : ${ALLOWED_ORIGIN}`);
  console.log(`======================================================`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[StreamProxy] SIGTERM received, shutting down gracefully...");
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[StreamProxy] SIGINT received, shutting down gracefully...");
  server.close(() => process.exit(0));
});
