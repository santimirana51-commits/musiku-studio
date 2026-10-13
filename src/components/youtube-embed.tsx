"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePlayer } from "./player-context";
import { loadYouTubeIframeApi, type YTPlayer } from "@/lib/youtube-iframe";
import { directStreamPlayerSingleton } from "@/lib/direct-stream-player";
import { loadEqSettings } from "@/lib/karaoke/equalizer";
import { getGlobalEqSync, setGlobalEqSync, EQ_SYNC_EVENT, EQ_SYNC_KEY } from "@/lib/youtube-eq";
import { useToast } from "./toast";
import { Sliders, Volume2 } from "lucide-react";

const ERROR_TEXT: Record<number, string> = {
  2: "ID video tidak valid.",
  5: "Player tidak dapat memutar video ini di browser Anda.",
  100: "Video tidak ditemukan atau sudah dihapus/privat.",
  101: "Pemilik video tidak mengizinkan pemutaran tersemat.",
  150: "Pemilik video tidak mengizinkan pemutaran tersemat.",
};

/** Satu-satunya instance player YouTube resmi yang aktif dalam satu waktu.
 *  Dirender besar di /watch dan mini di PlayerBar global — hanya satu yang
 *  mount dalam satu waktu sehingga tidak ada audio ganda.
 *  
 *  Tersinkronisasi penuh dengan Equalizer 10-Band (Web Audio API) via
 *  DirectStreamPlayer dan fallback audio otomatis tanpa audio dobel.
 */
export function YouTubeEmbed() {
  const { current, status, setStatus, setError, next, setResume, takeResume } = usePlayer();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const videoId = current?.videoId;

  const [isEqSync, setIsEqSync] = useState(true);
  const isEqSyncRef = useRef(true);
  isEqSyncRef.current = isEqSync;

  // Baca preferensi sinkronisasi EQ dari localStorage di sisi client
  useEffect(() => {
    const val = getGlobalEqSync();
    setIsEqSync(val);
    isEqSyncRef.current = val;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === EQ_SYNC_KEY && e.newValue !== null) {
        const nextVal = e.newValue !== "false";
        setIsEqSync(nextVal);
        isEqSyncRef.current = nextVal;
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Sinkronisasi event jika tombol Bypass diubah dari komponen lain (seperti YoutubeEq)
  useEffect(() => {
    const handleSyncChange = (e: Event) => {
      const nextVal = (e as CustomEvent<boolean>).detail;
      if (typeof nextVal === "boolean" && nextVal !== isEqSyncRef.current) {
        setIsEqSync(nextVal);
        isEqSyncRef.current = nextVal;
        const p = playerRef.current;
        if (nextVal) {
          try {
            p?.mute?.();
            p?.setVolume?.(0);
            const t = p?.getCurrentTime?.() || 0;
            const eq = loadEqSettings();
            directStreamPlayerSingleton.applyGains(eq.gains, true);
            if (videoId) {
              p?.playVideo?.();
              void directStreamPlayerSingleton.loadAndPlay(videoId, t);
            }
          } catch {}
        } else {
          try {
            directStreamPlayerSingleton.pause();
            p?.unMute?.();
            p?.setVolume?.(100);
          } catch {}
        }
      }
    };
    window.addEventListener(EQ_SYNC_EVENT, handleSyncChange);
    return () => window.removeEventListener(EQ_SYNC_EVENT, handleSyncChange);
  }, [videoId]);

  // Tangani fallback audio jika stream langsung dibatasi
  useEffect(() => {
    return directStreamPlayerSingleton.subscribe({
      onError: () => {
        if (isEqSyncRef.current) {
          setIsEqSync(false);
          isEqSyncRef.current = false;
          setGlobalEqSync(false);
          try {
            playerRef.current?.unMute?.();
            playerRef.current?.setVolume?.(100);
          } catch {}
          toast(
            "Aliran audio langsung dibatasi di cloud hosting. Audio dialihkan otomatis ke pemutar resmi YouTube.",
            "info"
          );
        }
      },
    });
  }, [toast]);

  // Satu instance per video: dibuat dengan videoId final (termasuk posisi
  // lanjutan), dihancurkan saat ganti video/unmount.
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
          autoplay: 1,
          enablejsapi: 1,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
          // PENTING: Inisialisasi mute: 1 jika EQ aktif agar YouTube TIDAK bocor audio sama sekali
          ...(isEqSyncRef.current ? { mute: 1 } : { mute: 0 }),
          ...(resumeSec ? { start: resumeSec } : {}),
        },
        events: {
          onReady: (e) => {
            try {
              if (isEqSyncRef.current) {
                // Pastikan iframe YouTube 100% senyap tanpa audio ganda
                e.target.mute?.();
                e.target.setVolume?.(0);
                const eq = loadEqSettings();
                directStreamPlayerSingleton.applyGains(eq.gains, true);
                void directStreamPlayerSingleton.loadAndPlay(videoId, resumeSec || 0);
              } else {
                directStreamPlayerSingleton.pause();
                e.target.unMute?.();
                e.target.setVolume?.(100);
              }
              e.target.playVideo?.();
            } catch {}
          },
          onStateChange: (e) => {
            if (e.data === 1) {
              // Video Playing
              setStatus("playing");
              if (isEqSyncRef.current) {
                e.target.mute?.();
                e.target.setVolume?.(0);
                const curr = e.target.getCurrentTime?.();
                if (
                  typeof curr === "number" &&
                  Math.abs(curr - directStreamPlayerSingleton.getCurrentTime()) > 0.45
                ) {
                  directStreamPlayerSingleton.seekTo(curr);
                }
                void directStreamPlayerSingleton.play();
              } else {
                directStreamPlayerSingleton.pause();
                e.target.unMute?.();
                e.target.setVolume?.(100);
              }
            } else if (e.data === 2) {
              // Video Paused
              setStatus("paused");
              if (isEqSyncRef.current) {
                directStreamPlayerSingleton.pause();
              }
            } else if (e.data === 0) {
              // Video Ended
              if (isEqSyncRef.current) {
                directStreamPlayerSingleton.stopAndUnload();
              }
              next();
            }
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
        directStreamPlayerSingleton.pause();
      } catch {}
      try {
        const t = p?.getCurrentTime?.();
        if (typeof t === "number" && t > 5) setResume(videoId, t);
      } catch {}
      try {
        p?.destroy?.();
      } catch {}
      playerRef.current = null;
      try {
        host.innerHTML = "";
      } catch {}
    };
  }, [videoId, next, setError, setStatus, setResume, takeResume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sinkronisasi status Play / Pause dari player global (PlayerBar / UI)
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (status === "paused") {
        playerRef.current.pauseVideo?.();
        if (isEqSyncRef.current) directStreamPlayerSingleton.pause();
      } else if (status === "playing") {
        playerRef.current.playVideo?.();
        if (isEqSyncRef.current) void directStreamPlayerSingleton.play();
      }
    } catch {}
  }, [status]);

  // Pemeriksaan drift, watchdog kickstart, dan jaminan zero-leakage audio YouTube iframe
  useEffect(() => {
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const isYTPlaying = p.getPlayerState?.() === 1;
        if (isEqSyncRef.current) {
          // CEGAH BOCOR: Jika iframe tidak sengaja un-mute, bisukan seketika!
          if (p.isMuted && !p.isMuted()) {
            p.mute?.();
            p.setVolume?.(0);
          }
          // WATCHDOG: Jika YouTube jalan tapi direct stream belum play, jalankan otomatis tanpa perlu klik manual
          if (
            isYTPlaying &&
            directStreamPlayerSingleton.getState() !== "playing" &&
            directStreamPlayerSingleton.getState() !== "error" &&
            !directStreamPlayerSingleton.isFailedVideo(videoId) &&
            videoId
          ) {
            const ytTime = p.getCurrentTime?.() || 0;
            void directStreamPlayerSingleton.loadAndPlay(videoId, ytTime);
          }
          const ytTime = p.getCurrentTime?.();
          const directTime = directStreamPlayerSingleton.getCurrentTime();
          if (typeof ytTime === "number" && directTime > 0) {
            const drift = Math.abs(ytTime - directTime);
            if (drift > 0.5) {
              directStreamPlayerSingleton.seekTo(ytTime);
            }
          }
        } else {
          // MODE BYPASS: Pastikan directStreamPlayer benar-benar dijeda agar tidak terjadi suara dobel
          if (directStreamPlayerSingleton.getState() === "playing") {
            directStreamPlayerSingleton.pause();
          }
        }
      } catch {}
    }, 1000);

    return () => clearInterval(interval);
  }, [videoId]);

  const toggleEqSync = () => {
    const nextVal = !isEqSync;
    setIsEqSync(nextVal);
    isEqSyncRef.current = nextVal;
    setGlobalEqSync(nextVal);

    if (nextVal) {
      try {
        const p = playerRef.current;
        p?.mute?.();
        p?.setVolume?.(0);
        const t = p?.getCurrentTime?.() || 0;
        const eq = loadEqSettings();
        directStreamPlayerSingleton.applyGains(eq.gains, true);
        if (videoId) {
          p?.playVideo?.();
          void directStreamPlayerSingleton.loadAndPlay(videoId, t);
        }
        toast("Equalizer 10-Band diaktifkan & disinkronkan ke pemutar YouTube!", "success");
      } catch {}
    } else {
      try {
        directStreamPlayerSingleton.pause();
        playerRef.current?.unMute?.();
        playerRef.current?.setVolume?.(100);
        toast("Bypass EQ: Memutar audio asli YouTube bawaan.", "info");
      } catch {}
    }
  };

  if (!current) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl">
      <div className="aspect-video w-full">
        {/* Host stabil milik React — isinya (slot player) dimanage manual
            di effect agar YT API tidak merusak virtual DOM. */}
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* Bar Sinkronisasi Equalizer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`flex size-2 rounded-full ${
              isEqSync ? "bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" : "bg-zinc-500"
            }`}
          />
          <span className="font-semibold text-[11px] text-zinc-300">
            {isEqSync ? (
              <span className="flex items-center gap-1 text-emerald-300">
                <Sliders className="size-3 text-emerald-400" />
                EQ 10-Band Tersinkron (Web Audio)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-zinc-400">
                <Volume2 className="size-3 text-zinc-400" />
                Audio Asli YouTube (Bypass)
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/equalizer"
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-zinc-400 hover:text-white transition"
            title="Buka Halaman Equalizer untuk atur frekuensi"
          >
            <span>Atur EQ</span>
          </Link>
          <button
            onClick={toggleEqSync}
            className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold transition cursor-pointer ${
              isEqSync
                ? "border border-violet-500/40 bg-violet-600/30 text-violet-200 hover:bg-violet-600/40"
                : "border border-white/10 bg-white/10 text-zinc-300 hover:bg-white/20"
            }`}
            title={isEqSync ? "Bypass: Beralih ke audio asli YouTube" : "Aktifkan Equalizer 10-Band"}
          >
            {isEqSync ? "Bypass EQ" : "Aktifkan EQ"}
          </button>
        </div>
      </div>
    </div>
  );
}
