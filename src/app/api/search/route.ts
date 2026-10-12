import { NextResponse } from "next/server";
import { searchQuerySchema } from "@/lib/validation";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import type { VideoItem } from "@/lib/youtube";

// Cache sederhana untuk data publik (60 detik). Tidak dipakai untuk data privat.
const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 60_000;

function mapSearch(json: {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      channelId?: string;
      publishedAt?: string;
      description?: string;
      thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
    };
  }>;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo?: { totalResults?: number };
}): { items: VideoItem[]; nextPageToken?: string; prevPageToken?: string; pageInfo?: { totalResults?: number } } {
  const items: VideoItem[] = (json.items ?? [])
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      videoId: it.id!.videoId!,
      title: it.snippet?.title ?? "(tanpa judul)",
      channelTitle: it.snippet?.channelTitle ?? "Unknown",
      channelId: it.snippet?.channelId,
      thumbnail:
        it.snippet?.thumbnails?.medium?.url ??
        it.snippet?.thumbnails?.high?.url ??
        `https://i.ytimg.com/vi/${it.id!.videoId}/mqdefault.jpg`,
      publishedAt: it.snippet?.publishedAt,
      description: it.snippet?.description,
    }));
  return { items, nextPageToken: json.nextPageToken, prevPageToken: json.prevPageToken, pageInfo: json.pageInfo };
}

export async function GET(req: Request) {
  if (!rateLimit(`search:${clientKey(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 });
  }
  const url = new URL(req.url);
  const parsed = searchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    maxResults: url.searchParams.get("maxResults") ?? "12",
    pageToken: url.searchParams.get("pageToken") ?? undefined,
    type: "video",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Parameter tidak valid." }, { status: 400 });
  }
  const { q, maxResults, pageToken } = parsed.data;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY belum dikonfigurasi di server. Lihat README untuk cara membuatnya." },
      { status: 503 }
    );
  }

  const cacheKey = `${q}|${maxResults}|${pageToken ?? ""}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json(hit.body, { headers: { "X-Cache": "HIT" } });
  }

  const yt = new URL("https://www.googleapis.com/youtube/v3/search");
  yt.searchParams.set("part", "snippet");
  yt.searchParams.set("type", "video");
  yt.searchParams.set("videoEmbeddable", "true");
  yt.searchParams.set("videoCategoryId", "10"); // musik
  yt.searchParams.set("q", q);
  yt.searchParams.set("maxResults", String(maxResults ?? 12));
  if (pageToken) yt.searchParams.set("pageToken", pageToken);
  yt.searchParams.set("key", apiKey);

  let res: Response;
  try {
    res = await fetch(yt.toString(), { next: { revalidate: 60 } });
  } catch {
    return NextResponse.json({ error: "Gagal menghubungi YouTube. Periksa koneksi lalu coba lagi." }, { status: 502 });
  }

  if (res.status === 403) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.errors?.[0]?.reason ?? "";
    } catch {}
    if (detail.includes("quota")) {
      return NextResponse.json(
        { error: "Kuota YouTube API habis. Pantau di Google Cloud Console → APIs & Services → Quotas, lalu coba lagi besok atau naikkan kuota." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Akses YouTube ditolak (403). Periksa API key dan pembatasan domain." }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `YouTube mengembalikan error ${res.status}. Coba lagi nanti.` }, { status: 502 });
  }

  const json = await res.json();
  const body = mapSearch(json);
  cache.set(cacheKey, { at: Date.now(), body });
  return NextResponse.json(body);
}
