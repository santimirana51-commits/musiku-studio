// src/app/api/stream/route.ts
// Direct Stream Audio Proxy dengan dukungan HTTP 206 Range, Full CORS, HEAD & OPTIONS preflight

import { NextRequest, NextResponse } from "next/server";
import {
  buildCorsHeaders,
  resolveDirectAudioUrl,
  streamUrlCache,
} from "@/lib/audio-stream-resolver";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleStreamRequest(req: NextRequest, isHead = false): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("v");
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(requestOrigin);

  // Validasi ID video YouTube (11 karakter alphanumeric, underscore, hyphen)
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: "Parameter videoId ('v') tidak valid." },
      { status: 400, headers: corsHeaders }
    );
  }

  // Rate limiting: maks 20 request per IP per menit untuk endpoint stream
  const key = `stream:${clientKey(req)}`;
  if (!rateLimit(key, 20, 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi dalam beberapa saat." },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Retry-After": "60",
        },
      }
    );
  }

  // Jika external stream proxy VPS dikonfigurasi, redirect 307 langsung ke VPS
  // Ini membebaskan Vercel dari timeout 10 detik dan streaming audio yang berat
  const externalProxy =
    process.env.STREAM_PROXY_URL?.trim() ||
    process.env.NEXT_PUBLIC_STREAM_PROXY_URL?.trim();
  if (externalProxy) {
    const cleanBase = externalProxy.replace(/\/+$/, "");
    const targetUrl = `${cleanBase}/api/stream?${searchParams.toString()}`;
    return NextResponse.redirect(targetUrl, {
      status: 307,
      headers: corsHeaders,
    });
  }

  let directUrl = await resolveDirectAudioUrl(videoId);
  if (!directUrl) {
    return NextResponse.json(
      { error: "Gagal mengekstrak aliran audio untuk video ini." },
      { status: 502, headers: corsHeaders }
    );
  }

  // Teruskan header Range dan User-Agent dari browser pemutar
  const rangeHeader = req.headers.get("range");
  const forwardHeaders: Record<string, string> = {
    "User-Agent":
      req.headers.get("user-agent") ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "*/*",
  };
  if (rangeHeader) {
    forwardHeaders["range"] = rangeHeader;
  }

  const fetchWithTimeout = async (url: string): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);
    try {
      return await fetch(url, {
        method: isHead ? "HEAD" : "GET",
        headers: forwardHeaders,
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    let upstreamRes: Response | null = null;
    try {
      upstreamRes = await fetchWithTimeout(directUrl);
    } catch {
      // Jika fetch pertama timeout/gagal, hapus cache dan coba dapatkan URL baru
      streamUrlCache.delete(videoId);
      const freshUrl = await resolveDirectAudioUrl(videoId, true);
      if (freshUrl) {
        directUrl = freshUrl;
        try {
          upstreamRes = await fetchWithTimeout(directUrl);
        } catch {}
      }
    }

    // Jika upstream kedaluwarsa (403, 404, 410), refresh URL secara otomatis sekali lagi
    if (upstreamRes && !upstreamRes.ok && upstreamRes.status !== 206) {
      if (upstreamRes.status === 403 || upstreamRes.status === 404 || upstreamRes.status === 410) {
        streamUrlCache.delete(videoId);
        const freshUrl = await resolveDirectAudioUrl(videoId, true);
        if (freshUrl) {
          directUrl = freshUrl;
          try {
            upstreamRes = await fetchWithTimeout(directUrl);
          } catch {}
        }
      }
    }

    if (!upstreamRes) {
      streamUrlCache.delete(videoId);
      return NextResponse.json(
        { error: "Koneksi ke aliran audio timeout atau tidak dapat dijangkau." },
        { status: 504, headers: corsHeaders }
      );
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return NextResponse.json(
        { error: "Aliran audio dari sumber tidak tersedia." },
        { status: upstreamRes.status, headers: corsHeaders }
      );
    }

    // Bangun response headers dengan dukungan CORS dan Range audio lengkap
    const responseHeaders = new Headers();
    for (const [k, v] of Object.entries(corsHeaders)) {
      responseHeaders.set(k, v);
    }

    const contentType = upstreamRes.headers.get("content-type") || "audio/mp4";
    responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=3600, s-maxage=3600");

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    return new Response(isHead ? null : upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[Stream API] Streaming error:", err);
    streamUrlCache.delete(videoId);
    return NextResponse.json(
      { error: "Gagal mengalirkan audio." },
      { status: 502, headers: corsHeaders }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleStreamRequest(req, false);
}

export async function HEAD(req: NextRequest) {
  return handleStreamRequest(req, true);
}

export async function OPTIONS(req: NextRequest) {
  const requestOrigin = req.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(requestOrigin),
  });
}
