"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { VideoCard, VideoSkeleton, EmptyState } from "@/components/video-card";
import { usePlayer } from "@/components/player-context";
import { useToast } from "@/components/toast";
import { useDebouncedValue } from "@/lib/utils";
import type { VideoItem } from "@/lib/youtube";

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialQ = params.get("q") ?? "";
  const [input, setInput] = useState(initialQ);
  const debounced = useDebouncedValue(input, 600);
  const [items, setItems] = useState<VideoItem[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const player = usePlayer();
  const { toast } = useToast();

  const runSearch = useCallback(async (q: string, token?: string, append = false) => {
    if (!q.trim()) {
      setItems([]);
      setNextToken(undefined);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/search?q=${encodeURIComponent(q.trim())}&maxResults=12${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Pencarian gagal.");
      setItems((prev) => (append ? [...prev, ...(data.items ?? [])] : (data.items ?? [])));
      setNextToken(data.nextPageToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Pencarian gagal.";
      setError(msg);
      if (!append) toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // sinkron dari URL
  useEffect(() => {
    setInput(initialQ);
    if (initialQ) runSearch(initialQ);
    else {
      setItems([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("q")]);

  // debounce saat mengetik → update URL agar bisa dibagikan
  useEffect(() => {
    if (debounced.trim() && debounced !== initialQ) {
      router.replace(`/search?q=${encodeURIComponent(debounced.trim())}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-white md:text-2xl">Pencarian</h1>
        <p className="mt-1 text-sm text-zinc-400">Cari berdasarkan judul, artis, channel, atau kata kunci.</p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-card p-2 pl-4">
          <label htmlFor="q" className="sr-only">Kata kunci</label>
          <input
            id="q"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Contoh: Noah — Separuh Aku"
            maxLength={100}
            className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            onClick={() => router.push(`/search?q=${encodeURIComponent(input.trim())}`)}
            className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Cari
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500" role="status">
          {loading ? "Mencari…" : items.length > 0 ? `${items.length} hasil` : initialQ ? "—" : "Ketik kata kunci untuk mulai."}
        </p>
        <div className="flex gap-1 rounded-xl bg-white/5 p-1" role="group" aria-label="Tampilan">
          <button onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Tampilan grid" className={`rounded-lg p-2 ${view === "grid" ? "bg-white/10 text-white" : "text-zinc-500"}`}><LayoutGrid className="size-4" aria-hidden /></button>
          <button onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="Tampilan daftar" className={`rounded-lg p-2 ${view === "list" ? "bg-white/10 text-white" : "text-zinc-500"}`}><List className="size-4" aria-hidden /></button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <VideoSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6 text-sm text-red-200">
          <p className="font-semibold">Pencarian gagal.</p>
          <p className="mt-1">{error}</p>
          <button onClick={() => runSearch(initialQ)} className="mt-3 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white">Coba lagi</button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={initialQ ? "Tidak ada hasil" : "Mulai pencarian"} hint={initialQ ? "Coba kata kunci lain, misalnya nama artis + judul lagu." : "Hasil pencarian dari YouTube akan tampil di sini."} />
      ) : (
        <>
          <div className={view === "grid" ? "grid grid-cols-2 gap-3 md:grid-cols-3" : "flex flex-col gap-3"}>
            {items.map((v) => (
              <VideoCard key={v.videoId} video={v} layout={view} onPlay={() => player.playQueue(items, items.findIndex((x) => x.videoId === v.videoId))} />
            ))}
          </div>
          {nextToken && (
            <div className="pt-2 text-center">
              <button
                disabled={loading}
                onClick={() => runSearch(initialQ, nextToken, true)}
                className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
              >
                {loading ? "Memuat…" : "Muat lebih banyak"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400">Memuat pencarian…</div>}>
      <SearchInner />
    </Suspense>
  );
}
