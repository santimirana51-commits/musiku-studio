"use client";
import { useEffect, useState } from "react";
import { useToast } from "./toast";
import type { VideoItem } from "@/lib/youtube";

export function AddToPlaylistModal({
  video,
  onClose,
}: {
  video: VideoItem | null;
  onClose: () => void;
}) {
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!video) return;
    (async () => {
      const res = await fetch("/api/playlists");
      if (res.status === 401) {
        toast("Masuk dulu untuk menyimpan ke playlist cloud.", "error");
        onClose();
        return;
      }
      const data = await res.json();
      setPlaylists(data.items ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  if (!video) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Tambah ke playlist">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="text-base font-bold text-white">Tambah ke playlist</h2>
        <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{video.title}</p>
        <div className="mt-4 flex max-h-64 flex-col gap-2 overflow-auto">
          {playlists.length === 0 && <p className="text-sm text-zinc-500">Belum ada playlist. Buat dulu di halaman Playlist.</p>}
          {playlists.map((p) => (
            <button
              key={p.id}
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch(`/api/playlists/${p.id}/items`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      youtube_video_id: video.videoId,
                      title_snapshot: video.title,
                      channel_title_snapshot: video.channelTitle,
                      thumbnail_url_snapshot: video.thumbnail,
                    }),
                  });
                  if (!res.ok) throw new Error((await res.json()).error ?? "Gagal menambah.");
                  toast(`Ditambahkan ke “${p.name}”.`, "success");
                  onClose();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Gagal menambah.", "error");
                } finally {
                  setLoading(false);
                }
              }}
              className="rounded-xl bg-white/5 px-4 py-2.5 text-left text-sm text-white hover:bg-white/10"
            >
              {p.name}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-xl bg-white/10 py-2 text-sm font-semibold text-white">Tutup</button>
      </div>
    </div>
  );
}
