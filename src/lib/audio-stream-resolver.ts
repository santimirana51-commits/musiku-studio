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

// In-memory cache stream audio
export const streamUrlCache = new Map<string, CachedStream>();
export const DEFAULT_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 jam default

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Origin, Authorization, X-Requested-With",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function findYtDlpBinary(): string {
  if (process.env.YT_DLP_PATH) {
    try {
      if (fs.existsSync(process.env.YT_DLP_PATH)) return process.env.YT_DLP_PATH;
    } catch {}
  }
  const commonPaths = [
    "/home/miran/.local/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "yt-dlp",
  ];
  for (const p of commonPaths) {
    if (p === "yt-dlp") return p;
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return "yt-dlp";
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
 * Ekstraksi stream audio menggunakan yt-dlp lokal dengan optimasi bypass dan format m4a (AAC)
 */
export async function resolveViaYtDlp(videoId: string): Promise<string | null> {
  const binary = findYtDlpBinary();
  const videoTarget = `https://www.youtube.com/watch?v=${videoId}`;
  const cookiesPath = setupCookiesFile();
  const nodeRuntime = process.execPath || "node";

  const baseArgs = [
    "--no-warnings",
    "--geo-bypass",
    "--force-ipv4",
    "--no-check-certificates",
    "--js-runtimes",
    `node:${nodeRuntime}`,
    "--remote-components",
    "ejs:github",
    "-g",
    "-f",
    "bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio/best",
  ];

  if (cookiesPath) {
    baseArgs.push("--cookies", cookiesPath);
  }

  // Percobaan 1: Menggunakan chain extractor modern bawaan yt-dlp
  try {
    const { stdout } = await execFileAsync(binary, [...baseArgs, videoTarget], {
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const resolvedUrl = stdout.trim().split("\n")[0]?.trim();
    if (resolvedUrl && resolvedUrl.startsWith("http")) {
      return resolvedUrl;
    }
  } catch (err) {
    console.warn("[Stream API] yt-dlp default resolution failed:", err);
  }

  // Percobaan 2: Fallback dengan client mweb
  try {
    const { stdout } = await execFileAsync(
      binary,
      [
        ...baseArgs,
        "--extractor-args",
        "youtube:player_client=mweb,android",
        videoTarget,
      ],
      { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
    );

    const resolvedUrl = stdout.trim().split("\n")[0]?.trim();
    if (resolvedUrl && resolvedUrl.startsWith("http")) {
      return resolvedUrl;
    }
  } catch (err) {
    console.warn("[Stream API] yt-dlp fallback resolution failed:", err);
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
    streamUrlCache.set(videoId, { url: resolvedUrl, expiresAt });
    return resolvedUrl;
  }

  return null;
}
