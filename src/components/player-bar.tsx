"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pause, Play, SkipBack, SkipForward, ChevronUp, ChevronDown, ListVideo } from "lucide-react";
import { usePlayer } from "./player-context";
import { YouTubeEmbed } from "./youtube-embed";

export function PlayerBar() {
  const { current, status, queue, next, prev, setStatus, isExpanded, setExpanded, error } =
    usePlayer();
  const pathname = usePathname();
  if (!current) return null;

  // Mini player global: satu-satunya instance aktif di luar /watch, supaya
  // musik terus jalan saat navigasi sidebar. Di /watch yang tampil instance
  // besar dari halaman watch — tidak pernah dua-duanya.
  const showMini = pathname !== "/watch";
  const playing = status === "playing";
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 md:bottom-0 md:left-60" role="region" aria-label="Pemutar">
      {isExpanded && queue.length > 0 && (
        <div className="mx-3 mb-2 max-h-56 overflow-auto rounded-2xl border border-white/10 bg-surface/95 p-2 backdrop-blur md:mx-6">
          <p className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <ListVideo className="size-4" aria-hidden /> Antrean ({queue.length})
          </p>
          {queue.map((q, i) => (
            <Link
              key={`${q.videoId}-${i}`}
              href={`/watch?v=${q.videoId}`}
              className="block rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              <span className="line-clamp-1">{q.title}</span>
              <span className="text-xs text-zinc-500">{q.channelTitle}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="border-t border-white/10 bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-3 px-3 py-2.5 md:px-6">
          {showMini ? (
            <div className="w-28 shrink-0 md:w-40" aria-label="Video sedang diputar">
              <YouTubeEmbed />
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={current.thumbnail} alt="" className="size-11 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded border border-red-500/30 bg-red-600/20 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                YouTube
              </span>
              <span className="hidden rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-400 sm:inline">
                Foreground · Tanpa EQ
              </span>
            </div>
            <p className="truncate text-sm font-semibold text-white">{current.title}</p>
            <p className="truncate text-xs text-zinc-400">{current.channelTitle}</p>
            {error && <p className="truncate text-xs text-red-400">{error}</p>}
          </div>
          <button onClick={prev} aria-label="Sebelumnya" className="rounded-full p-2 text-zinc-300 hover:bg-white/10">
            <SkipBack className="size-5" aria-hidden />
          </button>
          <button
            onClick={() => setStatus(playing ? "paused" : "playing")}
            aria-label={playing ? "Jeda" : "Putar"}
            className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-white shadow-lg"
          >
            {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
          </button>
          <button onClick={next} aria-label="Berikutnya" className="rounded-full p-2 text-zinc-300 hover:bg-white/10">
            <SkipForward className="size-5" aria-hidden />
          </button>
          <button
            onClick={() => setExpanded(!isExpanded)}
            aria-label={isExpanded ? "Sembunyikan antrean" : "Tampilkan antrean"}
            aria-expanded={isExpanded}
            className="hidden rounded-full p-2 text-zinc-300 hover:bg-white/10 sm:block"
          >
            {isExpanded ? <ChevronDown className="size-5" aria-hidden /> : <ChevronUp className="size-5" aria-hidden />}
          </button>
          <Link href={`/watch?v=${current.videoId}`} className="hidden rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 sm:block">
            Buka
          </Link>
        </div>
      </div>
    </div>
  );
}
