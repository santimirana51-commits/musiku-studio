"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { KaraokePlayerState } from "@/lib/karaoke/engine";
import { loadYouTubeIframeApi, type YTPlayer } from "@/lib/youtube-iframe";

export interface KaraokePlayerHandle {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  setRate: (rate: number) => void;
  getRate: () => number;
}

const STATE_MAP: Record<number, KaraokePlayerState> = {
  [-1]: "unstarted",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "cued",
};

const ERROR_TEXT: Record<number, string> = {
  2: "ID video tidak valid.",
  5: "Player tidak dapat memutar video ini di browser Anda.",
  100: "Video tidak ditemukan atau sudah dihapus/privat.",
  101: "Pemilik video tidak mengizinkan pemutaran tersemat.",
  150: "Pemilik video tidak mengizinkan pemutaran tersemat.",
};

interface Props {
  videoId: string;
  startSeconds?: number;
  autoplay?: boolean;
  onState?: (s: KaraokePlayerState) => void;
  onError?: (msg: string) => void;
}

/**
 * Player YouTube resmi untuk karaoke — selalu terlihat (kebijakan YouTube:
 * tidak ada audio-only, tidak ada kontrol/branding yang disembunyikan).
 * Node target dibuat manual agar YT API tidak merusak virtual DOM React.
 */
export const KaraokePlayer = forwardRef<KaraokePlayerHandle, Props>(function KaraokePlayer(
  { videoId, startSeconds, autoplay = true, onState, onError },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const cbRef = useRef({ onState, onError });
  cbRef.current = { onState, onError };

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => {
      try { return playerRef.current?.getCurrentTime?.() ?? 0; } catch { return 0; }
    },
    getDuration: () => {
      try { return playerRef.current?.getDuration?.() ?? 0; } catch { return 0; }
    },
    seekTo: (s: number) => {
      try { playerRef.current?.seekTo?.(Math.max(0, s), true); } catch {}
    },
    play: () => {
      try { playerRef.current?.playVideo?.(); } catch {}
    },
    pause: () => {
      try { playerRef.current?.pauseVideo?.(); } catch {}
    },
    setRate: (r: number) => {
      try { playerRef.current?.setPlaybackRate?.(r); } catch {}
    },
    getRate: () => {
      try { return playerRef.current?.getPlaybackRate?.() ?? 1; } catch { return 1; }
    },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !videoId) return;
    let cancelled = false;
    playerRef.current = null;
    const slot = document.createElement("div");
    slot.style.width = "100%";
    slot.style.height = "100%";
    host.appendChild(slot);
    loadYouTubeIframeApi().then(() => {
      if (cancelled || !slot.isConnected || !window.YT) return;
      const player = new window.YT.Player(slot, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          autoplay: autoplay ? 1 : 0,
          ...(startSeconds && startSeconds > 0 ? { start: Math.floor(startSeconds) } : {}),
        },
        events: {
          onReady: (e) => {
            if (autoplay) {
              try { e.target.playVideo?.(); } catch {}
            }
          },
          onStateChange: (e) => {
            cbRef.current.onState?.(STATE_MAP[e.data] ?? "unstarted");
          },
          onError: (e) => {
            cbRef.current.onError?.(ERROR_TEXT[e.data] ?? `Video tidak dapat diputar (kode ${e.data}).`);
          },
        },
      });
      playerRef.current = player;
    });
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      try { host.innerHTML = ""; } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div className="aspect-video w-full">
        <div ref={hostRef} className="h-full w-full" />
      </div>
    </div>
  );
});
