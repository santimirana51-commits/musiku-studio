// Adapter Web untuk sumber YouTube → kontrak AudioEngine (Fase 2).
//
// MESIN STATE SAJA (tanpa menyentuh iframe): pemutaran nyata tetap milik
// YouTubeEmbed + PlayerContext. Adapter ini memodelkan antrean/status agar
// UI bersama (mini player, queue panel, source badge) bisa bicara satu bahasa.
//
// Capability JUJUR untuk YouTube di semua platform saat ini:
// - canSeek/canVolume/canMute/canShuffle/canRepeat/canEqualize = false
//   (konteks/app tidak mengendalikan audio iframe cross-origin).
// - canBackground = false (player resmi harus terlihat; layar mati berhenti).
// - canQueue/canNext/canPrev/canPlay/canPause = true (level antrean).
// - canMediaSession = false (jangan klaim kontrol OS atas audio YouTube).
// - stop() = keluar antrean (idle), bukan menghentikan iframe (itu milik view).

import type {
  AudioEngine,
  AudioEngineEvent,
  AudioTrack,
  EngineCapabilities,
  PlaybackState,
  RepeatMode,
} from "@/lib/audio/types";

export function webYouTubeCapabilities(): EngineCapabilities {
  return {
    canPlay: true,
    canPause: true,
    canStop: true,
    canSeek: false,
    canVolume: false,
    canMute: false,
    canShuffle: false,
    canRepeat: false,
    canQueue: true,
    canBackground: false,
    canEqualize: false,
    canMediaSession: false,
    canNext: true,
    canPrev: true,
  };
}

export class WebYouTubeEngine implements AudioEngine {
  readonly capabilities: EngineCapabilities = webYouTubeCapabilities();
  private tracks: AudioTrack[] = [];
  private index = -1;
  private _state: PlaybackState = "idle";
  private _error: string | null = null;
  private listeners = new Set<(e: AudioEngineEvent) => void>();

  get state(): PlaybackState {
    return this._state;
  }
  get current(): AudioTrack | null {
    return this.index >= 0 ? (this.tracks[this.index] ?? null) : null;
  }
  get currentIndex(): number {
    return this.index;
  }
  get error(): string | null {
    return this._error;
  }

  load(tracks: AudioTrack[], startIndex = 0): void {
    const onlyYouTube = tracks.filter((t) => t.kind === "youtube");
    this.tracks = onlyYouTube;
    this._error = null;
    if (onlyYouTube.length === 0) {
      this.index = -1;
      this.setState("idle");
      return;
    }
    this.index = Math.min(Math.max(startIndex, 0), onlyYouTube.length - 1);
    this.setState("paused");
  }

  play(): void {
    if (!this.current) return;
    this._error = null;
    this.setState("playing");
  }

  pause(): void {
    if (!this.current) return;
    this.setState("paused");
  }

  stop(): void {
    this.index = -1;
    this.tracks = [];
    this._error = null;
    this.setState("idle");
  }

  seekTo(_seconds?: number): void {} // no-op jujur: tak didukung di level antrean
  next(): void {
    if (this.tracks.length === 0) return;
    this.index = (this.index + 1) % this.tracks.length;
    this._error = null;
    this.setState("playing");
  }
  prev(): void {
    if (this.tracks.length === 0) return;
    this.index = (this.index - 1 + this.tracks.length) % this.tracks.length;
    this._error = null;
    this.setState("playing");
  }

  setVolume(_v?: number): void {} // no-op jujur
  getVolume(): number {
    return 1;
  }
  setMuted(_m?: boolean): void {} // no-op jujur
  isMuted(): boolean {
    return false;
  }

  setShuffle(_on?: boolean): void {} // no-op jujur
  setRepeat(_m?: RepeatMode): void {} // no-op jujur (diabaikan di level antrean)
  setPlaybackError(msg: string): void {
    this._error = msg;
    this.setState("error");
  }
  clearError(): void {
    this._error = null;
    if (this._state === "error") this.setState(this.current ? "paused" : "idle");
  }

  currentTime(): number {
    return 0; // posisi nyata milik instance IFrame di view
  }
  duration(): number | null {
    return this.current?.duration ?? null;
  }
  buffered(): number | null {
    return null;
  }

  onEvent(cb: (e: AudioEngineEvent) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  destroy(): void {
    this.listeners.clear();
    this.tracks = [];
    this.index = -1;
    this._state = "idle";
    this._error = null;
  }

  private setState(s: PlaybackState): void {
    this._state = s;
    const e: AudioEngineEvent = { type: "state", state: s, index: this.index };
    if (s === "error" && this._error) e.message = this._error;
    this.listeners.forEach((cb) => {
      try {
        cb(e);
      } catch {}
    });
  }
}

export type { RepeatMode };
