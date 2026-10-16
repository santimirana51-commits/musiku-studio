// src/lib/audio-stream-resolver.ts
// Resolver URL stream audio YouTube dengan yt-dlp lokal & multi-tier public fallback

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

export interface CachedStream {
  url: string;
  expiresAt: number;
}

// In-memory cache stream audio dengan batas ukuran untuk cegah memory leak
export const streamUrlCache = new Map<string, CachedStream>();
export const DEFAULT_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 jam default
const MAX_CACHE_SIZE = 500;

/** Evict entry terlama jika cache melebihi batas */
function evictOldestCacheEntry(): void {
  let oldestKey: string | null = null;
  let oldestExpiry = Infinity;
  Array.from(streamUrlCache.entries()).forEach(([key, val]) => {
    if (val.expiresAt < oldestExpiry) {
      oldestExpiry = val.expiresAt;
      oldestKey = key;
    }
  });
  if (oldestKey) streamUrlCache.delete(oldestKey);
}

/** Set cache dengan batas ukuran otomatis */
export function setCacheEntry(videoId: string, entry: CachedStream): void {
  if (streamUrlCache.size >= MAX_CACHE_SIZE) {
    evictOldestCacheEntry();
  }
  streamUrlCache.set(videoId, entry);
}

/**
 * Bangun CORS headers.
 * Jika APP_URL dikonfigurasi di env, gunakan domain itu sebagai allowed origin.
 * Fallback ke '*' agar dev lokal tetap bisa berjalan.
 */
export function buildCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "*";
  // Jika allowedOrigin bukan wildcard, cocokkan dengan origin request
  const origin =
    allowedOrigin === "*"
      ? "*"
      : requestOrigin && requestOrigin === allowedOrigin
      ? requestOrigin
      : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Origin, Authorization, X-Requested-With",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, Content-Type",
    "Access-Control-Max-Age": "86400",
    ...(origin !== "*" ? { "Vary": "Origin" } : {}),
  };
}

// Header CORS statis untuk backward-compat (dipakai komponen lain)
export const CORS_HEADERS: Record<string, string> = buildCorsHeaders();

export function findYtDlpBinary(): string {
  if (process.env.YT_DLP_PATH) {
    try {
      if (fs.existsSync(process.env.YT_DLP_PATH)) return process.env.YT_DLP_PATH;
    } catch {}
  }
  // Path standar lintas platform (tidak ada path developer hardcoded)
  const commonPaths = [
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "/opt/homebrew/bin/yt-dlp", // macOS Homebrew
    "/snap/bin/yt-dlp",          // Ubuntu Snap
  ];
  for (const p of commonPaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return "yt-dlp"; // fallback: cari di PATH sistem
}

/**
 * Ekstrak timestamp kedaluwarsa dari URL googlevideo jika tersedia parameter 'expire'
 */
export function extractExpiryMs(url: string, defaultTtlMs = DEFAULT_CACHE_TTL_MS): number {
  try {
    const parsed = new URL(url);
    const expireParam = parsed.searchParams.get("expire");
    if (expireParam) {
      const expireSec = parseInt(expireParam, 10);
      if (!isNaN(expireSec) && expireSec > 0) {
        // Beri kelonggaran 5 menit sebelum batas waktu agar tidak putus di tengah playback
        const expiryTime = expireSec * 1000 - 5 * 60 * 1000;
        if (expiryTime > Date.now()) {
          return expiryTime;
        }
      }
    }
  } catch {}
  return Date.now() + defaultTtlMs;
}

export function setupCookiesFile(): string | null {
  if (process.env.DISABLE_COOKIES === "true" || process.env.DISABLE_COOKIES === "1") {
    return null;
  }
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
      console.warn("[Stream API] Gagal menulis YOUTUBE_COOKIES:", err);
    }
  }

  const customPath = process.env.YOUTUBE_COOKIES_PATH || process.env.COOKIES_FILE;
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const localCandidates = [
    path.join(process.cwd(), "cookies.txt"),
    path.join(os.tmpdir(), "cookies.txt"),
  ];
  for (const c of localCandidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).size > 0) {
        return c;
      }
    } catch {}
  }
  return null;
}

/**
 * Ekstraksi stream audio menggunakan yt-dlp lokal dengan multi-client modern dan format selection fleksibel
 */
export async function resolveViaYtDlp(videoId: string): Promise<string | null> {
  const binary = findYtDlpBinary();
  const videoTarget = `https://www.youtube.com/watch?v=${videoId}`;
  const cookiesPath = setupCookiesFile();
  const nodeRuntime = process.execPath || "node";

  // Base arguments: TLS strictly validated (tanpa --no-check-certificates), EJS challenge solver aktif
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

  // Percobaan 1: Menggunakan chain client modern visionos, android, web_embedded dengan dump-single-json
  let initialErrorType = "NONE";
  try {
    const { stdout } = await execFileAsync(
      binary,
      [
        ...baseArgs,
        "--extractor-args",
        "youtube:player_client=visionos,android,web_embedded",
        "--dump-single-json",
        videoTarget,
      ],
      { timeout: 14000, maxBuffer: 15 * 1024 * 1024 }
    );

    const parsed = JSON.parse(stdout);
    const formats: Array<{
      url?: string;
      acodec?: string;
      vcodec?: string;
      ext?: string;
      abr?: number;
      tbr?: number;
    }> = parsed.formats || [];

    const validAudios = formats.filter(
      (f) =>
        f.url &&
        f.url.startsWith("http") &&
        !f.url.includes("manifest/hls") &&
        f.acodec &&
        f.acodec !== "none"
    );

    if (validAudios.length > 0) {
      validAudios.sort((a, b) => {
        const aStandalone = !a.vcodec || a.vcodec === "none" ? 1 : 0;
        const bStandalone = !b.vcodec || b.vcodec === "none" ? 1 : 0;
        if (aStandalone !== bStandalone) return bStandalone - aStandalone;

        const aAac = a.ext === "m4a" || (a.acodec && a.acodec.includes("mp4a")) ? 1 : 0;
        const bAac = b.ext === "m4a" || (b.acodec && b.acodec.includes("mp4a")) ? 1 : 0;
        if (aAac !== bAac) return bAac - aAac;

        return (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0);
      });
      return validAudios[0].url || null;
    }
  } catch (err: unknown) {
    const detail = (err instanceof Error ? err.message : String(err)).trim();
    if (/needs to be reloaded|UNPLAYABLE|tv_downgraded/i.test(detail)) {
      initialErrorType = "PAGE_RELOAD";
    }
    console.warn("[Stream API] yt-dlp primary resolution failed:", detail.split("\n")[0]);
  }

  // Percobaan 2: Fallback terarah tanpa cookies (mengisolasi stale cookie)
  try {
    const cleanBaseArgs = baseArgs.filter((arg, i, arr) => arg !== "--cookies" && arr[i - 1] !== "--cookies");
    const fallbackArgs = [...cleanBaseArgs];
    if (initialErrorType === "PAGE_RELOAD") {
      fallbackArgs.push(
        "--extractor-args",
        "youtube:player_client=android_vr,web_embedded",
        "-f",
        "ba[ext=m4a]/ba[ext=mp4]/ba/b[ext=mp4]/b/best",
        "-g",
        videoTarget
      );
    } else {
      fallbackArgs.push(
        "--extractor-args",
        "youtube:player_client=ios,android,web_embedded",
        "-f",
        "ba[ext=m4a]/ba[ext=mp4]/ba/b[ext=mp4]/b/best",
        "-g",
        videoTarget
      );
    }

    const { stdout } = await execFileAsync(binary, fallbackArgs, {
      timeout: 12000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const resolvedUrl = stdout.trim().split("\n")[0]?.trim();
    if (resolvedUrl && resolvedUrl.startsWith("http")) {
      return resolvedUrl;
    }
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn("[Stream API] yt-dlp fallback resolution failed:", detail.split("\n")[0]);
  }

  return null;
}

/**
 * Fallback multi-provider (Invidious & Piped) dengan timeout cepat
 */
export async function resolveViaPublicInstances(videoId: string): Promise<string | null> {
  const invidiousInstances = [
    "https://invidious.f5.si",
    "https://yewtu.be",
    "https://inv.nadeko.net",
  ];

  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.drgns.space",
  ];

  // Coba Invidious
  for (const instance of invidiousInstances) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const formats: Array<{ type?: string; url?: string; bitrate?: number }> = [
          ...(data.adaptiveFormats || []),
          ...(data.formatStreams || []),
        ];
        const audioFormats = formats.filter(
          (f) => f.type?.startsWith("audio/") && f.url?.startsWith("http")
        );
        if (audioFormats.length > 0) {
          audioFormats.sort((a, b) => {
            const aIsMp4 = a.type?.includes("mp4") ? 1 : 0;
            const bIsMp4 = b.type?.includes("mp4") ? 1 : 0;
            if (aIsMp4 !== bIsMp4) return bIsMp4 - aIsMp4;
            return (b.bitrate || 0) - (a.bitrate || 0);
          });
          const streamUrl = audioFormats[0].url;
          if (streamUrl) return streamUrl;
        }
      }
    } catch {}
  }

  // Coba Piped
  for (const instance of pipedInstances) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${instance}/streams/${videoId}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const audioStreams = data.audioStreams as Array<{ url: string; bitrate?: number; mimeType?: string }> | undefined;
        if (audioStreams && audioStreams.length > 0) {
          audioStreams.sort((a, b) => {
            const aIsMp4 = a.mimeType?.includes("mp4") ? 1 : 0;
            const bIsMp4 = b.mimeType?.includes("mp4") ? 1 : 0;
            if (aIsMp4 !== bIsMp4) return bIsMp4 - aIsMp4;
            return (b.bitrate || 0) - (a.bitrate || 0);
          });
          const bestUrl = audioStreams[0].url;
          if (bestUrl) return bestUrl;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Mengambil URL stream audio langsung, memeriksa cache, dan auto-retry jika dibutuhkan
 */
export async function resolveDirectAudioUrl(
  videoId: string,
  forceFresh = false
): Promise<string | null> {
  if (!forceFresh) {
    const cached = streamUrlCache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }
  }

  // 1. Prioritas Utama: yt-dlp binary lokal
  let resolvedUrl = await resolveViaYtDlp(videoId);

  // 2. Fallback: Multi-provider publik
  if (!resolvedUrl) {
    resolvedUrl = await resolveViaPublicInstances(videoId);
  }

  if (resolvedUrl) {
    const expiresAt = extractExpiryMs(resolvedUrl);
    setCacheEntry(videoId, { url: resolvedUrl, expiresAt });
    return resolvedUrl;
  }

  return null;
}
