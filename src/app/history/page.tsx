"use client";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { VideoCard, EmptyState } from "@/components/video-card";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { usePlayer } from "@/components/player-context";
import type { VideoItem } from "@/lib/youtube";
import { loadLocalHistory, clearLocalHistory } from "@/lib/storage";

export default function HistoryPage() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [disabled, setDisabled] = useState(false);
  const { toast } = useToast();
  const { modal, confirm } = useConfirm();
  const player = usePlayer();

  const load = async () => {
    const local = loadLocalHistory();
    const res = await fetch("/api/history");
    if (res.status === 401) {
      setItems(local);
      return;
    }
    const data = await res.json();
    if (data.disabled) {
      setDisabled(true);
      setItems([]);
      return;
    }
    if (Array.isArray(data.items) && data.items.length > 0) {
      setItems(
        data.items.map((h: { youtube_video_id: string; title_snapshot: string; channel_title_snapshot: string }) => ({
          videoId: h.youtube_video_id,
          title: h.title_snapshot,
          channelTitle: h.channel_title_snapshot,
          thumbnail: `https://i.ytimg.com/vi/${h.youtube_video_id}/mqdefault.jpg`,
        }))
      );
    } else {
      setItems(local);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAll = () =>
    confirm("Hapus seluruh riwayat?", "Riwayat lokal dan cloud (bila login) akan dihapus.", async () => {
      clearLocalHistory();
      await fetch("/api/history", { method: "DELETE" }).catch(() => {});
      setItems([]);
      toast("Riwayat dihapus.", "success");
    });

  return (
    <div className="space-y-5">
      {modal}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-white md:text-2xl">Riwayat Putar</h1>
          <p className="mt-1 text-sm text-zinc-400">Referensi video yang baru kamu putar beserta waktunya. Matikan kapan saja di Pengaturan.</p>
        </div>
        {items.length > 0 && (
          <button onClick={clearAll} className="flex shrink-0 items-center gap-1 rounded-xl bg-red-600/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-600/30">
            <Trash2 className="size-4" aria-hidden /> Hapus semua
          </button>
        )}
      </div>
      {disabled ? (
        <EmptyState title="Riwayat dinonaktifkan" hint="Aktifkan kembali di Pengaturan → Preferensi riwayat." />
      ) : items.length === 0 ? (
        <EmptyState title="Riwayat kosong" hint="Putar sebuah video dan ia akan tercatat di sini." />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((v) => (
            <VideoCard key={`${v.videoId}`} video={v} />
          ))}
        </div>
      )}
      {items.length > 0 && (
        <button onClick={() => player.playQueue(items, 0)} className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white">
          Putar ulang riwayat
        </button>
      )}
    </div>
  );
}
