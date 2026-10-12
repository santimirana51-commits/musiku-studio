"use client";
import { useEffect, useRef } from "react";
import { usePlayer } from "./player-context";
import { loadYouTubeIframeApi, type YTPlayer } from "@/lib/youtube-iframe";

const ERROR_TEXT: Record<number, string> = {
  2: "ID video tidak valid.",
  5: "Player tidak dapat memutar video ini di browser Anda.",
  100: "Video tidak ditemukan atau sudah dihapus/privat.",
  101: "Pemilik video tidak mengizinkan pemutaran tersemat.",
  150: "Pemilik video tidak mengizinkan pemutaran tersemat.",
};

/** Satu-satunya instance player YouTube resmi yang aktif dalam satu waktu.
 *  Dirender besar di /watch dan mini di PlayerBar global — hanya satu yang
 *  mount dalam satu waktu sehingga tidak ada audio ganda. */
export function YouTubeEmbed() {
  const { current, status, setStatus, setError, next, setResume, takeResume } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const videoId = current?.videoId;

  // Satu instance per video: dibuat dengan videoId final (termasuk posisi
  // lanjutan), dihancurkan saat ganti video/unmount. Posisi disimpan ke
  // context agar instance berikutnya bisa melanjutkan.
  //
  // PENTING: node target dibuat manual via createElement, BUKAN node yang
  // dirender React. YT API mengganti/menghapus node target (div -> iframe);
  // bila node kelolaan React yang dipakai, unmount berikutnya crash dengan
  // "Failed to execute 'removeChild' ... not a child of this node".
  // React hanya memiliki `host` (stabil, tanpa key) dan tidak pernah
  // menyentuh isi dalamnya — semua dimanage manual di effect ini.
  useEffect(() => {
    if (!videoId) return;
    const host = containerRef.current;
    if (!host) return;
    let cancelled = false;
    playerRef.current = null;
    const slot = document.createElement("div");
    slot.style.width = "100%";
    slot.style.height = "100%";
    host.appendChild(slot);
    loadYouTubeIframeApi().then(() => {
      if (cancelled || !slot.isConnected || !window.YT) return;
      const resumeSec = takeResume(videoId);
      const player = new window.YT.Player(slot, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          // Constructor YT.Player default TIDAK autoplay (hanya cue).
          // autoplay:1 + playVideo di onReady mengembalikan perilaku
          // lama yang sebelumnya ditangani loadVideoById.
          autoplay: 1,
          ...(resumeSec ? { start: resumeSec } : {}),
        },
        events: {
          onReady: (e) => {
            try {
              e.target.playVideo?.();
            } catch {}
          },
          onStateChange: (e) => {
            if (e.data === 1) setStatus("playing");
            else if (e.data === 2) setStatus("paused");
            else if (e.data === 0) next();
          },
          onError: (e) => {
            setStatus("error");
            setError(ERROR_TEXT[e.data] ?? `Video tidak dapat diputar (kode ${e.data}).`);
          },
        },
      });
      playerRef.current = player;
    });
    return () => {
      cancelled = true;
      const p = playerRef.current;
      try {
        const t = p?.getCurrentTime?.();
        if (typeof t === "number" && t > 5) setResume(videoId, t);
      } catch {}
      // Hancurkan instance agar timer internal YouTube berhenti dan tidak
      // postMessage ke window yang sudah tidak ada. Lalu bersihkan sisa
      // DOM (iframe) manual — React tidak boleh melakukannya sendiri.
      try {
        p?.destroy?.();
      } catch {}
      playerRef.current = null;
      try {
        host.innerHTML = "";
      } catch {}
    };
  }, [videoId, next, setError, setStatus, setResume, takeResume]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (status === "paused") playerRef.current.pauseVideo?.();
      else if (status === "playing") playerRef.current.playVideo?.();
    } catch {}
  }, [status]);

  if (!current) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div className="aspect-video w-full">
        {/* Host stabil milik React — isinya (slot player) dimanage manual
            di effect agar YT API tidak merusak virtual DOM. */}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
