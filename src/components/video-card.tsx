"use client";
import { Heart, ListPlus, Play } from "lucide-react";
import type { VideoItem } from "@/lib/youtube";
import { formatDuration } from "@/lib/utils";
import { usePlayer } from "./player-context";

export function VideoCard({
  video,
  onPlay,
  layout = "grid",
  isFavorite,
  onToggleFavorite,
  onAddToPlaylist,
}: {
  video: VideoItem;
  onPlay?: () => void;
  layout?: "grid" | "list";
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onAddToPlaylist?: () => void;
}) {
  const player = usePlayer();
  const play = () => {
    if (onPlay) onPlay();
    else player.playOne(video);
  };
  if (layout === "list") {
    return (
      <article className="flex gap-3 rounded-2xl border border-white/5 bg-card p-2.5 transition hover:border-fuchsia-500/30">
        <button onClick={play} className="group relative w-40 shrink-0 overflow-hidden rounded-xl" aria-label={`Putar ${video.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnail} alt={video.title} className="aspect-video w-full object-cover" loading="lazy" />
          <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/40">
            <Play className="size-7 text-white opacity-0 transition group-hover:opacity-100" aria-hidden />
          </span>
          {video.duration && (
            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 text-[11px] text-white">{formatDuration(video.duration)}</span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-white">{video.title}</h3>
          <p className="mt-0.5 truncate text-xs text-zinc-400">{video.channelTitle}</p>
          <div className="mt-2 flex gap-1">
            <button onClick={play} aria-label="Putar" className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"><Play className="size-4" aria-hidden /></button>
            {onToggleFavorite && (
              <button onClick={onToggleFavorite} aria-label={isFavorite ? "Hapus dari favorit" : "Tambah ke favorit"} aria-pressed={!!isFavorite} className="rounded-lg p-1.5 hover:bg-white/10">
                <Heart className={`size-4 ${isFavorite ? "fill-pink-500 text-pink-500" : "text-zinc-300"}`} aria-hidden />
              </button>
            )}
            {onAddToPlaylist && (
              <button onClick={onAddToPlaylist} aria-label="Tambah ke playlist" className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"><ListPlus className="size-4" aria-hidden /></button>
            )}
          </div>
        </div>
      </article>
    );
  }
  return (
    <article className="overflow-hidden rounded-2xl border border-white/5 bg-card transition hover:border-fuchsia-500/30">
      <button onClick={play} className="group relative block w-full" aria-label={`Putar ${video.title}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={video.thumbnail} alt={video.title} className="aspect-video w-full object-cover" loading="lazy" />
        <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/40">
          <Play className="size-9 text-white opacity-0 transition group-hover:opacity-100" aria-hidden />
        </span>
        {video.duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] text-white">{formatDuration(video.duration)}</span>
        )}
      </button>
      <div className="p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold text-white">{video.title}</h3>
        <p className="mt-1 truncate text-xs text-zinc-400">{video.channelTitle}</p>
        <div className="mt-2 flex gap-1">
          <button onClick={play} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">Putar</button>
          {onToggleFavorite && (
            <button onClick={onToggleFavorite} aria-label={isFavorite ? "Hapus dari favorit" : "Tambah ke favorit"} aria-pressed={!!isFavorite} className="rounded-lg p-1.5 hover:bg-white/10">
              <Heart className={`size-4 ${isFavorite ? "fill-pink-500 text-pink-500" : "text-zinc-300"}`} aria-hidden />
            </button>
          )}
          {onAddToPlaylist && (
            <button onClick={onAddToPlaylist} aria-label="Tambah ke playlist" className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"><ListPlus className="size-4" aria-hidden /></button>
          )}
        </div>
      </div>
    </article>
  );
}

export function VideoSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-card" aria-hidden>
      <div className="aspect-video animate-pulse bg-white/5" />
      <div className="space-y-2 p-3">
        <div className="h-4 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">{hint}</p>}
    </div>
  );
}
