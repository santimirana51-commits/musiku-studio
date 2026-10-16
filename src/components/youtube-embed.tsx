"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayer } from "./player-context";
import { loadYouTubeIframeApi, type YTPlayer } from "@/lib/youtube-iframe";
import { directStreamPlayerSingleton } from "@/lib/direct-stream-player";
import { loadEqSettings } from "@/lib/karaoke/equalizer";
import {
  getGlobalEqSync,
  setGlobalEqSync,
  EQ_SYNC_EVENT,
  EQ_SYNC_KEY,
  youtubeEqEngineSingleton,
} from "@/lib/youtube-eq";
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
  const pathname = usePathname();
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

  // Sinkronisasi status audio: iframe YouTube hanya dibisukan jika directStreamPlayer aktif memutar suara
  // dan bukan mode Tab Audio. Di luar itu (Bypass, Tab Audio aktif, direct stream loading/error),
  // iframe YouTube WAJIB bersuara (unMute, volume 100) agar suara terdengar jelas!
  const syncAudioMute = (overridePlayer?: YTPlayer | null) => {
    const p = overridePlayer || playerRef.current;
    if (!p) return;
    const isDirectPlaying = directStreamPlayerSingleton.getState() === "playing";
    const isTabConnected = youtubeEqEngineSingleton.getIsConnected();
    const shouldMuteIframe = isEqSyncRef.current && isDirectPlaying && !isTabConnected;

    try {
      if (shouldMuteIframe) {
        p.mute?.();
        p.setVolume?.(0);
      } else {
        p.unMute?.();
        p.setVolume?.(100);
      }
    } catch {}
  };

  // Dengarkan perubahan status DirectStreamPlayer dan Tab Audio Engine
  useEffect(() => {
    const unsubDirect = directStreamPlayerSingleton.subscribe({
      onState: () => syncAudioMute(),
      onError: () => syncAudioMute(),
    });
    youtubeEqEngineSingleton.onConnectionChange(() => {
      syncAudioMute();
    });
    return () => {
      unsubDirect();
    };
  }, []);

  // Sinkronisasi event jika tombol Bypass diubah dari komponen lain (seperti YoutubeEq)
  useEffect(() => {
    const handleSyncChange = (e: Event) => {
      const nextVal = (e as CustomEvent<boolean>).detail;
      if (typeof nextVal === "boolean") {
        setIsEqSync(nextVal);
        isEqSyncRef.current = nextVal;
        const p = playerRef.current;
        if (nextVal) {
          if (!youtubeEqEngineSingleton.getIsConnected() && videoId) {
            const t = p?.getCurrentTime?.() || 0;
            const eq = loadEqSettings();
            directStreamPlayerSingleton.applyGains(eq.gains, true);
            void directStreamPlayerSingleton.loadAndPlay(videoId, t);
          }
        } else {
          directStreamPlayerSingleton.pause();
        }
        syncAudioMute();
      }
    };
    window.addEventListener(EQ_SYNC_EVENT, handleSyncChange);
    return () => window.removeEventListener(EQ_SYNC_EVENT, handleSyncChange);
  }, [videoId]);

  // Tangani fallback audio jika stream langsung dibatasi
  useEffect(() => {
    return directStreamPlayerSingleton.subscribe({
      onError: () => {
        syncAudioMute();
      },
    });
  }, []);

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
          mute: 0,
          ...(resumeSec ? { start: resumeSec } : {}),
        },
        events: {
          onReady: (e) => {
            try {
              playerRef.current = e.target;
              e.target.playVideo?.();
              syncAudioMute(e.target);
              if (isEqSyncRef.current && !youtubeEqEngineSingleton.getIsConnected()) {
                const eq = loadEqSettings();
                directStreamPlayerSingleton.applyGains(eq.gains, true);
                void directStreamPlayerSingleton.loadAndPlay(videoId, resumeSec || 0);
              }
            } catch {}
          },
          onStateChange: (e) => {
            if (e.data === 1) {
              // Video Playing
              setStatus("playing");
              syncAudioMute(e.target);
              if (isEqSyncRef.current && !youtubeEqEngineSingleton.getIsConnected()) {
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
              }
            } else if (e.data === 2) {
              // Video Paused
              setStatus("paused");
              directStreamPlayerSingleton.pause();
            } else if (e.data === 0) {
              // Video Ended
              directStreamPlayerSingleton.stopAndUnload();
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
        syncAudioMute();

        const isYTPlaying = p.getPlayerState?.() === 1;
        const isDirectPlaying = directStreamPlayerSingleton.getState() === "playing";
        const isTabConnected = youtubeEqEngineSingleton.getIsConnected();

        if (isEqSyncRef.current && !isTabConnected) {
          // WATCHDOG: Jika YouTube jalan tapi direct stream belum play dan tidak error
          if (
            isYTPlaying &&
            !isDirectPlaying &&
            directStreamPlayerSingleton.getState() !== "error" &&
            directStreamPlayerSingleton.getState() !== "loading" &&
            !directStreamPlayerSingleton.isFailedVideo(videoId) &&
            videoId
          ) {
            const ytTime = p.getCurrentTime?.() || 0;
            void directStreamPlayerSingleton.loadAndPlay(videoId, ytTime);
          }

          // Sinkronisasi drift waktu
          const ytTime = p.getCurrentTime?.();
          const directTime = directStreamPlayerSingleton.getCurrentTime();
          if (typeof ytTime === "number" && directTime > 0) {
            const drift = Math.abs(ytTime - directTime);
            if (drift > 0.5) {
              directStreamPlayerSingleton.seekTo(ytTime);
            }
          }
        } else {
          // MODE BYPASS atau TAB AUDIO: Jeda directStreamPlayer
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
        if (!youtubeEqEngineSingleton.getIsConnected() && videoId) {
          const p = playerRef.current;
          const t = p?.getCurrentTime?.() || 0;
          const eq = loadEqSettings();
          directStreamPlayerSingleton.applyGains(eq.gains, true);
          p?.playVideo?.();
          void directStreamPlayerSingleton.loadAndPlay(videoId, t);
        }
        toast("Equalizer 10-Band diaktifkan & disinkronkan ke pemutar YouTube!", "success");
      } catch {}
    } else {
      try {
        directStreamPlayerSingleton.pause();
        toast("Bypass EQ: Memutar audio asli YouTube bawaan.", "info");
      } catch {}
    }
    syncAudioMute();
  };

  if (!current) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl">
      <div className="aspect-video w-full">
        {/* Host stabil milik React — isinya (slot player) dimanage manual
            di effect agar YT API tidak merusak virtual DOM. */}
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* Bar Sinkronisasi Equalizer (hanya di luar /watch agar tidak duplikat dengan panel utama) */}
      {pathname !== "/watch" && (
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
      )}
    </div>
  );
}
