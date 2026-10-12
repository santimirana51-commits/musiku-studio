"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { YouTubeEmbed } from "@/components/youtube-embed";
import { VideoCard, EmptyState } from "@/components/video-card";
import { usePlayer } from "@/components/player-context";
import type { VideoItem } from "@/lib/youtube";

function WatchInner() {
  const params = useSearchParams();
  const id = params.get("v") ?? "";
  const [detail, setDetail] = useState<VideoItem | null>(null);
  const [related, setRelated] = useState<VideoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const player = usePlayer();

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/videos/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Video tidak tersedia.");
        if (!alive) return;
        setDetail(data.item);
        // Jangan reset antrean bila video ini sudah sedang diputar
        // (mis. pengguna menekan Putar dari beranda lalu dinavigasikan ke sini).
        if (player.current?.videoId !== id) player.playOne(data.item);
        const r = await fetch(`/api/search?q=${encodeURIComponent(data.item.channelTitle + " lagu")}&maxResults=8`);
        const rj = await r.json();
        if (alive && r.ok) setRelated((rj.items ?? []).filter((x: VideoItem) => x.videoId !== id));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Video tidak tersedia.");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id) return <EmptyState title="Tidak ada video dipilih" hint="Cari lagu lalu tekan Putar untuk menonton di sini." />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <YouTubeEmbed />
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
            <p className="font-semibold">Video tidak dapat diputar.</p>
            <p className="mt-1">{error}</p>
            <p className="mt-1 text-xs text-red-300/80">Beberapa video dibatasi pemiliknya (embedding dinonaktifkan, privat, dibatasi wilayah, atau dihapus).</p>
          </div>
        )}
        {detail && (
          <div>
            <h1 className="text-lg font-bold text-white">{detail.title}</h1>
            <p className="mt-1 text-sm text-zinc-400">{detail.channelTitle}</p>
            {detail.description && <p className="mt-3 line-clamp-2 text-sm text-zinc-500">{detail.description}</p>}
            <p className="mt-3 text-[11px] text-zinc-600">Diputar melalui player resmi YouTube. Kontrol volume & kualitas tersedia di dalam player.</p>
          </div>
        )}
      </div>
      <aside className="space-y-3" aria-label="Antrean dan terkait">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Berikutnya</h2>
        {player.queue.length > 0 ? (
          player.queue.slice(0, 10).map((q) => <VideoCard key={q.videoId} video={q} layout="list" />)
        ) : related.length > 0 ? (
          related.map((r) => <VideoCard key={r.videoId} video={r} layout="list" />)
        ) : (
          <p className="text-sm text-zinc-500">Antrean kosong.</p>
        )}
      </aside>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Memuat pemutar…</p>}>
      <WatchInner />
    </Suspense>
  );
}
