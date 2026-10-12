// Tipe & loader bersama untuk YouTube IFrame Player API resmi.
//
// Satu deklarasi global `window.YT` untuk seluruh proyek — file komponen
// TIDAK boleh mendeklarasikan ulang (menyebabkan konflik TS2717).

export interface YTPlayer {
  loadVideoById?: (id: string, startSeconds?: number) => void;
  cueVideoById?: (id: string, startSeconds?: number) => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  setPlaybackRate?: (rate: number) => void;
  getPlaybackRate?: () => number;
  destroy?: () => void;
  getPlayerState?: () => number;
}

export interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (e: YTPlayerEvent) => void;
            onStateChange?: (e: YTPlayerEvent) => void;
            onError?: (e: YTPlayerEvent) => void;
          };
        }
      ) => YTPlayer;
      PlayerState?: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Muat https://www.youtube.com/iframe_api sekali; resolve saat siap. */
export function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
    }
  });
}
