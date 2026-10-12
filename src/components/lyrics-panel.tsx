"use client";
import { useEffect, useRef } from "react";
import type { LyricLine } from "@/lib/karaoke/lrc";

export type LyricTheme = "violet" | "fuchsia" | "pink";
export type LyricTextSize = "sm" | "md" | "lg" | "xl";

const THEME_ACTIVE: Record<LyricTheme, string> = {
  violet: "bg-violet-600/20 text-violet-100 border-violet-500/50",
  fuchsia: "bg-fuchsia-600/20 text-fuchsia-100 border-fuchsia-500/50",
  pink: "bg-pink-600/20 text-pink-100 border-pink-500/50",
};

const THEME_DOT: Record<LyricTheme, string> = {
  violet: "bg-violet-400",
  fuchsia: "bg-fuchsia-400",
  pink: "bg-pink-400",
};

const SIZE_TEXT: Record<LyricTextSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl",
};

interface Props {
  lines: LyricLine[];
  activeIndex: number;
  theme?: LyricTheme;
  textSize?: LyricTextSize;
  autoScroll?: boolean;
}

/**
 * Panel lirik sinkron per baris (bukan per kata — sesuai kemampuan LRC).
 * Baris aktif disorot + auto-scroll ke tengah. Baris sebelum/sesudah
 * ditampilkan meredup sebagai konteks.
 */
export function LyricsPanel({ lines, activeIndex, theme = "fuchsia", textSize = "lg", autoScroll = true }: Props) {
  const activeRef = useRef<HTMLLIElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!autoScroll || activeIndex < 0) return;
    try {
      activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}
  }, [activeIndex, autoScroll]);

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
        <p className="text-sm font-semibold text-white">Lirik belum tersedia</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">
          Unggah file LRC milikmu atau buat lirik sendiri lewat tombol di bawah.
          MusikKu tidak mengambil lirik otomatis dari YouTube.
        </p>
      </div>
    );
  }

  return (
    <ul ref={listRef} className="max-h-[32rem] space-y-1.5 overflow-y-auto rounded-2xl border border-white/10 bg-card p-3" aria-label="Lirik tersinkron" aria-live="off">
      {lines.map((l, i) => {
        const active = i === activeIndex;
        const near = Math.abs(i - activeIndex) <= 1;
        return (
          <li
            key={`${l.timeMs}-${i}`}
            ref={active ? activeRef : undefined}
            aria-current={active ? "true" : undefined}
            className={`flex items-start gap-2 rounded-xl border px-3 py-2 transition ${
              active
                ? THEME_ACTIVE[theme]
                : near
                  ? "border-transparent text-zinc-200"
                  : "border-transparent text-zinc-500"
            } ${SIZE_TEXT[textSize]} ${active ? "font-bold" : "font-medium"}`}
          >
            <span className={`mt-2 size-1.5 shrink-0 rounded-full ${active ? THEME_DOT[theme] : "bg-zinc-700"}`} aria-hidden />
            <span className="leading-snug">{l.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
