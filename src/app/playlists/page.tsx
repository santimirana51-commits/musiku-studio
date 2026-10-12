"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { EmptyState } from "@/components/video-card";
import { usePlayer } from "@/components/player-context";
import type { VideoItem } from "@/lib/youtube";

interface Playlist {
  id: string;
  name: string;
  description: string;
  is_public: boolean;
  playlist_items?: { count: number }[];
}

export default function PlaylistsPage() {
  const [items, setItems] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [unauth, setUnauth] = useState(false);
  const { toast } = useToast();
  const { modal, confirm } = useConfirm();
  const player = usePlayer();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playlists");
      if (res.status === 401) {
        setUnauth(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
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
  }, []);

  if (unauth) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold text-white">Playlist</h1>
        <EmptyState title="Masuk untuk melihat playlist" hint="Playlist cloud tersimpan per akun. Daftar atau masuk terlebih dahulu." />
        <Link href="/login" className="inline-block rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white">Masuk</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {modal}
      <div>
        <h1 className="text-xl font-extrabold text-white md:text-2xl">Playlist</h1>
        <p className="mt-1 text-sm text-zinc-400">Playlist bersifat privat secara default. Hanya pemilik yang bisa melihat & mengubah.</p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const res = await fetch("/api/playlists", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
          });
          const data = await res.json();
          if (!res.ok) {
            toast(data.error ?? "Gagal membuat.", "error");
            return;
          }
          toast("Playlist dibuat.", "success");
          setName("");
          load();
        }}
        className="flex gap-2"
      >
        <label htmlFor="nama-playlist" className="sr-only">Nama playlist baru</label>
        <input
          id="nama-playlist"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama playlist baru…"
          maxLength={80}
          className="w-full rounded-xl border border-white/10 bg-card px-4 py-2.5 text-sm text-white placeholder:text-zinc-500"
        />
        <button className="flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2.5 text-sm font-bold text-white">
          <Plus className="size-4" aria-hidden /> Buat
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-400">Memuat…</p>
      ) : items.length === 0 ? (
        <EmptyState title="Belum ada playlist" hint="Buat playlist pertamamu lewat formulir di atas." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((p) => (
            <article key={p.id} className="rounded-2xl border border-white/5 bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-white">{p.name}</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">{p.is_public ? "Publik" : "Privat"} · {p.playlist_items?.[0]?.count ?? 0} lagu</p>
                  {p.description && <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{p.description}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/playlists/${p.id}`} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15">Buka</Link>
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/playlists/${p.id}`);
                    const data = await res.json();
                    const queue: VideoItem[] = (data.items ?? []).map((it: { youtube_video_id: string; title_snapshot: string; channel_title_snapshot: string; thumbnail_url_snapshot: string }) => ({
                      videoId: it.youtube_video_id,
                      title: it.title_snapshot,
                      channelTitle: it.channel_title_snapshot,
                      thumbnail: it.thumbnail_url_snapshot,
                    }));
                    if (queue.length === 0) {
                      toast("Playlist kosong.", "info");
                      return;
                    }
                    player.playQueue(queue, 0);
                    toast("Memutar playlist.", "success");
                  }}
                  className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                >
                  <Play className="size-3" aria-hidden /> Putar
                </button>
                <button
                  onClick={async () => {
                    const next = prompt("Nama baru:", p.name);
                    if (!next?.trim()) return;
                    const res = await fetch(`/api/playlists/${p.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: next.trim() }),
                    });
                    if (!res.ok) toast("Gagal mengubah nama.", "error");
                    else {
                      toast("Nama diperbarui.", "success");
                      load();
                    }
                  }}
                  aria-label={`Ubah nama ${p.name}`}
                  className="rounded-lg bg-white/5 p-1.5 text-zinc-300 hover:text-white"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  onClick={() => confirm("Hapus playlist?", `“${p.name}” beserta seluruh isinya akan dihapus permanen.`, async () => {
                    const res = await fetch(`/api/playlists/${p.id}`, { method: "DELETE" });
                    if (!res.ok) toast("Gagal menghapus.", "error");
                    else {
                      toast("Playlist dihapus.", "success");
                      load();
                    }
                  })}
                  aria-label={`Hapus ${p.name}`}
                  className="rounded-lg bg-white/5 p-1.5 text-zinc-300 hover:text-red-300"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
