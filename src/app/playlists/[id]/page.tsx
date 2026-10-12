"use client";
import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Play, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { EmptyState } from "@/components/video-card";
import { usePlayer } from "@/components/player-context";
import type { VideoItem } from "@/lib/youtube";

interface Item {
  id: string;
  youtube_video_id: string;
  title_snapshot: string;
  channel_title_snapshot: string;
  thumbnail_url_snapshot: string;
  position: number;
}

export default function PlaylistDetailPage({ params }: { params: { id: string } }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { modal, confirm } = useConfirm();
  const player = usePlayer();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/playlists/${params.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat.");
      setName(data.playlist.name);
      setItems(data.items ?? []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memuat.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const toQueue = (): VideoItem[] =>
    items.map((it) => ({
      videoId: it.youtube_video_id,
      title: it.title_snapshot || "(tanpa judul)",
      channelTitle: it.channel_title_snapshot || "Unknown",
      thumbnail: it.thumbnail_url_snapshot || `https://i.ytimg.com/vi/${it.youtube_video_id}/mqdefault.jpg`,
    }));

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    await fetch(`/api/playlists/${params.id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((x) => x.id) }),
    });
  };

  return (
    <div className="space-y-5">
      {modal}
      <div>
        <h1 className="text-xl font-extrabold text-white">{name || "Playlist"}</h1>
        <p className="mt-1 text-sm text-zinc-400">{items.length} lagu</p>
      </div>
      {items.length > 0 && (
        <button onClick={() => player.playQueue(toQueue(), 0)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white">
          <Play className="size-4" aria-hidden /> Putar seluruh playlist
        </button>
      )}
      {loading ? (
        <p className="text-sm text-zinc-400">Memuat…</p>
      ) : items.length === 0 ? (
        <EmptyState title="Playlist kosong" hint="Tambahkan video dari hasil pencarian lewat tombol “Tambah ke playlist”." />
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((it, idx) => (
            <li key={it.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-card p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.thumbnail_url_snapshot} alt="" className="h-14 w-24 shrink-0 rounded-xl object-cover" loading="lazy" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-semibold text-white">{it.title_snapshot}</p>
                <p className="truncate text-xs text-zinc-400">{it.channel_title_snapshot}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => player.playQueue(toQueue(), idx)} aria-label="Putar dari sini" className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"><Play className="size-4" aria-hidden /></button>
                <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Pindah ke atas" className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 disabled:opacity-30"><ArrowUp className="size-4" aria-hidden /></button>
                <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label="Pindah ke bawah" className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 disabled:opacity-30"><ArrowDown className="size-4" aria-hidden /></button>
                <button
                  onClick={() => confirm("Hapus dari playlist?", "Video ini akan dihapus dari playlist.", async () => {
                    const res = await fetch(`/api/playlists/${params.id}/items/${it.id}`, { method: "DELETE" });
                    if (!res.ok) toast("Gagal menghapus.", "error");
                    else {
                      toast("Item dihapus.", "success");
                      load();
                    }
                  })}
                  aria-label="Hapus dari playlist"
                  className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 hover:text-red-300"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
