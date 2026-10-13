import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execFileAsync = promisify(execFile);

// Cache URL stream audio selama 2 jam agar tidak menjalankan yt-dlp berulang kali untuk video yang sama
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

function findYtDlpBinary(): string {
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

async function resolveDirectAudioUrl(videoId: string): Promise<string | null> {
  const cached = urlCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const binary = findYtDlpBinary();
  const videoTarget = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const { stdout } = await execFileAsync(
      binary,
      ["-g", "-f", "bestaudio[ext=m4a]/bestaudio", videoTarget],
      { timeout: 15000 }
    );
    const resolvedUrl = stdout.trim().split("\n")[0]?.trim();
    if (resolvedUrl && resolvedUrl.startsWith("http")) {
      urlCache.set(videoId, {
        url: resolvedUrl,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return resolvedUrl;
    }
  } catch (err) {
    console.warn("[Stream API] yt-dlp resolution failed:", err);
  }

  // Fallback ke Piped API instances jika yt-dlp gagal
  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.privacydev.net",
    "https://pipedapi.tokhmi.xyz",
  ];

  for (const instance of pipedInstances) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${instance}/streams/${videoId}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const audioStreams = data.audioStreams as Array<{ url: string; bitrate?: number }> | undefined;
        if (audioStreams && audioStreams.length > 0) {
          // Pilih stream dengan bitrate audio terbaik
          audioStreams.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
          const bestUrl = audioStreams[0].url;
          if (bestUrl) {
            urlCache.set(videoId, {
              url: bestUrl,
              expiresAt: Date.now() + CACHE_TTL_MS,
            });
            return bestUrl;
          }
        }
      }
    } catch {}
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("v");

  // Validasi ID video YouTube (11 karakter alphanumeric, underscore, hyphen)
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: "Parameter videoId ('v') tidak valid." },
      { status: 400 }
    );
  }

  const directUrl = await resolveDirectAudioUrl(videoId);
  if (!directUrl) {
    return NextResponse.json(
      { error: "Gagal mengekstrak aliran audio untuk video ini." },
      { status: 502 }
    );
  }

  // Teruskan header Range jika pemutar audio meminta seeking (HTTP 206 Partial Content)
  const rangeHeader = req.headers.get("range");
  const forwardHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (rangeHeader) {
    forwardHeaders["range"] = rangeHeader;
  }

  try {
    const upstreamRes = await fetch(directUrl, {
      headers: forwardHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      // Jika URL kedaluwarsa, hapus dari cache dan coba sekali lagi
      urlCache.delete(videoId);
      return NextResponse.json(
        { error: "Aliran audio dari sumber tidak tersedia." },
        { status: upstreamRes.status }
      );
    }

    const responseHeaders = new Headers();
    const contentType = upstreamRes.headers.get("content-type") || "audio/mp4";
    responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[Stream API] Streaming error:", err);
    return NextResponse.json(
      { error: "Gagal mengalirkan audio." },
      { status: 500 }
    );
  }
}
