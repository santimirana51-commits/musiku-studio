import { NextResponse } from "next/server";
import { videoIdSchema } from "@/lib/validation";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const parsed = videoIdSchema.safeParse(params.id);
  if (!parsed.success) {
    return NextResponse.json({ error: "ID video tidak valid." }, { status: 400 });
  }
  if (!rateLimit(`video:${clientKey(_req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY belum dikonfigurasi di server." }, { status: 503 });
  }
  const yt = new URL("https://www.googleapis.com/youtube/v3/videos");
  yt.searchParams.set("part", "snippet,contentDetails,status");
  yt.searchParams.set("id", parsed.data);
  yt.searchParams.set("key", apiKey);

  let res: Response;
  try {
    res = await fetch(yt.toString(), { next: { revalidate: 120 } });
  } catch {
    return NextResponse.json({ error: "Gagal menghubungi YouTube." }, { status: 502 });
  }
  if (res.status === 403) {
    return NextResponse.json({ error: "Kuota YouTube API habis atau akses ditolak." }, { status: 429 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `YouTube error ${res.status}.` }, { status: 502 });
  }
  const json = await res.json();
  const v = json.items?.[0];
  if (!v) {
    return NextResponse.json({ error: "Video tidak ditemukan, privat, atau sudah dihapus." }, { status: 404 });
  }
  if (v.status?.embeddable === false) {
    return NextResponse.json({ error: "Video ini tidak mengizinkan pemutaran tersemat (embedding dinonaktifkan pemilik)." }, { status: 451 });
  }
  if (v.status?.privacyStatus && v.status.privacyStatus !== "public") {
    return NextResponse.json({ error: "Video bersifat privat atau tidak tersedia." }, { status: 404 });
  }
  return NextResponse.json({
    item: {
      videoId: parsed.data,
      title: v.snippet?.title ?? "(tanpa judul)",
      channelTitle: v.snippet?.channelTitle ?? "Unknown",
      channelId: v.snippet?.channelId,
      thumbnail:
        v.snippet?.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${parsed.data}/mqdefault.jpg`,
      publishedAt: v.snippet?.publishedAt,
      duration: v.contentDetails?.duration,
      description: v.snippet?.description?.slice(0, 2000),
    },
  });
}
