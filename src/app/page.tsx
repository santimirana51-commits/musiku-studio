"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Disc3 } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { VideoCard, VideoSkeleton, EmptyState } from "@/components/video-card";
import { usePlayer } from "@/components/player-context";
import { useToast } from "@/components/toast";
import { MUSIC_CATEGORIES, type VideoItem } from "@/lib/youtube";
import { loadLocalHistory, loadRecentSearches } from "@/lib/storage";

export default function HomePage() {
  const [popular, setPopular] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [history, setHistory] = useState<(VideoItem & { playedAt?: string })[]>([]);
  const player = usePlayer();
  const { toast } = useToast();

  const fetchPopular = useCallback(async (query?: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const q = query ?? "musik pop indonesia terpopuler";
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&maxResults=12`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Gagal memuat data.");
      setPopular(data.items ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPopular();
    setRecent(loadRecentSearches());
    setHistory(loadLocalHistory());
  }, [fetchPopular]);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-700/40 via-fuchsia-700/20 to-pink-600/20 p-6 md:p-10">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500">
            <Disc3 className="size-6 text-white" aria-hidden />
          </span>
          <h1 className="text-2xl font-extrabold text-white md:text-4xl">
            Selamat datang di <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">MusikKu</span>
          </h1>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-zinc-300 md:text-base">
          Temukan lagu favoritmu dari YouTube dan putar langsung dengan player resmi. Buat playlist, simpan favorit, dan lihat riwayat putarmu.
        </p>
        <div className="mt-5 max-w-xl">
          <SearchForm />
        </div>
      </section>

      <section aria-label="Kategori musik">
        <h2 className="mb-3 text-lg font-bold text-white">Jelajahi kategori</h2>
        <div className="flex flex-wrap gap-2">
          {MUSIC_CATEGORIES.map((c) => (
            <button
              key={c.label}
              onClick={() => {
                setActiveCat(c.label);
                fetchPopular(c.query);
              }}
              aria-pressed={activeCat === c.label}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeCat === c.label
                  ? "border-transparent bg-gradient-to-r from-violet-600 to-pink-500 text-white"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:border-fuchsia-500/40 hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Populer">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {activeCat ? `Pilihan ${activeCat}` : "Sedang populer di pencarian"}
          </h2>
          <Link href="/search" className="text-sm text-fuchsia-300 hover:underline">Lihat pencarian</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <VideoSkeleton key={i} />)}
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6 text-sm text-red-200">
            <p className="font-semibold">Tidak dapat memuat konten.</p>
            <p className="mt-1">{loadError}</p>
            <button onClick={() => fetchPopular(activeCat ?? undefined)} className="mt-3 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white">Coba lagi</button>
          </div>
        ) : popular.length === 0 ? (
          <EmptyState title="Belum ada hasil" hint="Coba kategori lain atau gunakan kolom pencarian." />
        ) : (
          <>
            <p className="mb-3 text-xs text-zinc-500">Hasil berdasarkan pencarian YouTube yang sah — bukan ranking resmi.</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {popular.map((v) => (
                <VideoCard key={v.videoId} video={v} onPlay={() => player.playQueue(popular, popular.findIndex((x) => x.videoId === v.videoId))} />
              ))}
            </div>
            <div className="mt-4">
              <button
                onClick={() => player.playQueue(popular, 0)}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white"
              >
                Putar semua
              </button>
            </div>
          </>
        )}
      </section>

      {recent.length > 0 && (
        <section aria-label="Berdasarkan pencarianmu">
          <h2 className="mb-3 text-lg font-bold text-white">Pencarian terakhirmu</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <Link key={r} href={`/search?q=${encodeURIComponent(r)}`} className="rounded-full bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white">
                {r}
              </Link>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section aria-label="Terakhir diputar">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Terakhir diputar</h2>
            <Link href="/history" className="text-sm text-fuchsia-300 hover:underline">Lihat semua</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {history.slice(0, 4).map((v) => (
              <VideoCard key={v.videoId} video={v} onPlay={() => player.playOne(v)} />
            ))}
          </div>
        </section>
      )}

      <section aria-label="Playlist pengguna" className="rounded-3xl border border-white/10 bg-card p-6">
        <h2 className="text-lg font-bold text-white">Playlist kamu</h2>
        <p className="mt-1 text-sm text-zinc-400">Kelola koleksi lagumu sendiri. Masuk untuk menyimpan permanen di cloud.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/playlists" className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white">Buka Playlist</Link>
          <Link href="/favorites" className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/15">Favorit</Link>
          {!player.current && null}
        </div>
      </section>
      <p className="pb-4 text-center text-[11px] text-zinc-600">MusikKu menampilkan konten YouTube. Seluruh video diputar memakai player resmi YouTube.</p>
    </div>
  );
}
