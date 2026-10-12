"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import { VideoCard, EmptyState } from "@/components/video-card";
import { AddToPlaylistModal } from "@/components/add-to-playlist";
import { useToast } from "@/components/toast";
import { usePlayer } from "@/components/player-context";
import type { VideoItem } from "@/lib/youtube";
import { loadAnonFavorites, toggleAnonFavorite } from "@/lib/storage";

export default function FavoritesPage() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [modalVideo, setModalVideo] = useState<VideoItem | null>(null);
  const { toast } = useToast();
  const player = usePlayer();

  const load = async () => {
    const res = await fetch("/api/favorites");
    if (res.status === 401) {
      setLoggedIn(false);
      setItems(loadAnonFavorites());
      return;
    }
    setLoggedIn(true);
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "Gagal memuat favorit.", "error");
      return;
    }
    setItems(
      (data.items ?? []).map((f: { youtube_video_id: string; title_snapshot: string; channel_title_snapshot: string; thumbnail_url_snapshot: string }) => ({
        videoId: f.youtube_video_id,
        title: f.title_snapshot,
        channelTitle: f.channel_title_snapshot,
        thumbnail: f.thumbnail_url_snapshot,
      }))
    );
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (v: VideoItem) => {
    if (!loggedIn) {
      setItems(toggleAnonFavorite(v));
      toast("Dihapus dari favorit (perangkat ini).", "success");
      return;
    }
    const res = await fetch(`/api/favorites/${v.videoId}`, { method: "DELETE" });
    if (!res.ok) toast("Gagal menghapus.", "error");
    else {
      toast("Dihapus dari favorit.", "success");
      load();
    }
  };

  return (
    <div className="space-y-5">
      <AddToPlaylistModal video={modalVideo} onClose={() => setModalVideo(null)} />
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-white md:text-2xl">
          <Heart className="size-6 fill-pink-500 text-pink-500" aria-hidden /> Favorit
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {loggedIn === false
            ? "Kamu belum masuk — favorit disimpan sementara di perangkat ini dan akan pindah ke akun setelah kamu masuk (tambahkan ulang)."
            : "Video favoritmu yang tersimpan di akun."}
        </p>
      </div>
      {loggedIn === false && (
        <Link href="/login" className="inline-block rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white">
          Masuk untuk sinkronisasi cloud
        </Link>
      )}
      {items.length === 0 ? (
        <EmptyState title="Belum ada favorit" hint="Tekan ikon hati pada hasil pencarian atau halaman putar untuk menyimpan." />
      ) : (
        <>
          <button onClick={() => player.playQueue(items, 0)} className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white">
            Putar semua favorit
          </button>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {items.map((v) => (
              <div key={v.videoId} className="relative">
                <VideoCard video={v} isFavorite onToggleFavorite={() => remove(v)} onAddToPlaylist={() => setModalVideo(v)} />
              </div>
            ))}
          </div>
          {loggedIn === true && (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Trash2 className="size-3" aria-hidden /> Tekan ikon hati untuk menghapus dari favorit.
            </p>
          )}
        </>
      )}
    </div>
  );
}
