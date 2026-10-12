// Adapter Web untuk LocalAudioEngine → kontrak AudioEngine (Fase 2).
//
// Adapter tipis: tidak mengubah logika engine, hanya memetakan API +
// mengekspos capability jujur untuk Web:
// - canBackground=false (tab hidup saja; tutup = berhenti).
// - canEqualize = true hanya bila AudioContext tersedia.
// - canMediaSession = deteksi navigator.mediaSession.

import { LocalAudioEngine } from "@/lib/local-player/engine";
import { detectWebCapabilities } from "@/lib/audio/capabilities";
import {
  clampVolume,
  type AudioEngine,
  type AudioEngineEvent,
  type AudioTrack,
  type EngineCapabilities,
  type PlaybackState,
  type RepeatMode,
} from "@/lib/audio/types";

function toLocalTrack(t: AudioTrack, i: number) {
  return { id: `${t.id}#${i}`, title: t.title, artist: t.artist, duration: t.duration, src: t.src };
}

export function webLocalCapabilities(): EngineCapabilities {
  const w = detectWebCapabilities();
  return {
    canPlay: true,
    canPause: true,
    canStop: true,
    canSeek: true,
    canVolume: true,
    canMute: true,
    canShuffle: true,
    canRepeat: true,
    canQueue: true,
    canBackground: false,
    canEqualize: w.hasAudioContext,
    canMediaSession: w.hasMediaSession,
    canNext: true,
    canPrev: true,
  };
}

export class WebLocalEngine implements AudioEngine {
  readonly capabilities: EngineCapabilities = webLocalCapabilities();
  private inner: LocalAudioEngine;
  private tracks: AudioTrack[] = [];
  private listeners = new Set<(e: AudioEngineEvent) => void>();
  private _state: PlaybackState = "idle";
  private _error: string | null = null;
  private muted = false;
  private volumeBeforeMute = 0.9;

  constructor(createInner?: () => LocalAudioEngine) {
    this.inner = createInner
      ? createInner()
      : new LocalAudioEngine((e) => this.forward(e.type, e.message));
    this.setupMediaSessionHandlers();
  }

  get state(): PlaybackState {
    return this._state;
  }
  get current(): AudioTrack | null {
    const i = this.inner.currentIndex;
    return i >= 0 ? (this.tracks[i] ?? null) : null;
  }
  get currentIndex(): number {
    return this.inner.currentIndex;
  }
  get error(): string | null {
    return this._error;
  }

  load(tracks: AudioTrack[], startIndex = 0): void {
    this.tracks = tracks.slice();
    this._error = null;
    if (tracks.length === 0) {
      this.inner.setQueue([], 0);
      this.setState("idle");
      return;
    }
    this.setState("loading");
    this.inner.setQueue(tracks.map(toLocalTrack), startIndex);
    this.setState("paused");
  }

  async play(): Promise<void> {
    if (this.tracks.length === 0) return;
    await this.inner.play();
    // inner melaporkan error via event; sinkronkan state optimistis aman:
    if (this._state !== "error") this.setState("playing");
  }

  pause(): void {
    this.inner.pause();
    if (this._state !== "error") this.setState("paused");
  }

  stop(): void {
    this.inner.pause();
    this.inner.seekTo(0);
    this.setState("idle");
  }

  seekTo(s: number): void {
    this.inner.seekTo(s);
  }
  next(): void {
    this.inner.next();
  }
  prev(): void {
    this.inner.prev();
  }

  setVolume(v: number): void {
    const c = clampVolume(v);
    if (this.muted && c > 0) this.muted = false;
    this.volumeBeforeMute = c;
    this.inner.setVolume(c);
  }
  getVolume(): number {
    return this.inner.getVolume();
  }
  setMuted(m: boolean): void {
    this.muted = m;
    this.inner.setVolume(m ? 0 : this.volumeBeforeMute);
  }
  isMuted(): boolean {
    return this.muted;
  }

  setShuffle(on: boolean): void {
    this.inner.setShuffle(on);
  }
  setRepeat(m: RepeatMode): void {
    this.inner.setRepeat(m);
  }

  currentTime(): number {
    return this.inner.getTime();
  }
  duration(): number | null {
    return this.current?.duration ?? null;
  }
  buffered(): number | null {
    return null; // HTMLAudioElement buffering tidak diekspos kontrak ini
  }

  applyEq(gains: number[]): void {
    if (!this.capabilities.canEqualize) return; // jangan klaim aktif
    this.inner.applyEq(gains);
  }

  onEvent(cb: (e: AudioEngineEvent) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  destroy(): void {
    this.inner.destroy();
    this.listeners.clear();
    this.clearMediaSessionHandlers();
    this._state = "idle";
  }

  private setState(s: PlaybackState): void {
    this._state = s;
    this.updateMediaSession();
    this.emit({ type: "state", state: s, index: this.currentIndex });
  }

  private forward(kind: string, message?: string): void {
    if (kind === "error") {
      this._state = "error";
      this._error = message ?? "Gagal memutar.";
    } else if (kind === "status" || kind === "track") {
      // status playing/paused dipegang pemanggil play()/pause(); di sini
      // hanya teruskan info track/time agar UI sinkron.
      if (kind === "track") this.updateMediaSession();
    }
    this.emit({
      type: kind === "time" ? "time" : kind === "error" ? "error" : "track",
      state: this._state,
      index: this.currentIndex,
      time: this.inner.getTime(),
      message,
    });
  }

  private updateMediaSession(): void {
    if (typeof window === "undefined" || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const cur = this.current;
    if (!cur) {
      try {
        navigator.mediaSession.metadata = null;
      } catch {}
      return;
    }
    try {
      if (typeof MediaMetadata !== "undefined") {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: cur.title,
          artist: cur.artist || "MusikKu Local",
          album: "Pustaka MusikKu",
          artwork: cur.artwork ? [{ src: cur.artwork, sizes: "512x512", type: "image/png" }] : [],
        });
      }
      navigator.mediaSession.playbackState =
        this._state === "playing" ? "playing" : this._state === "paused" ? "paused" : "none";
    } catch {}
  }

  private setupMediaSessionHandlers(): void {
    if (typeof window === "undefined" || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler("play", () => this.play());
      ms.setActionHandler("pause", () => this.pause());
      ms.setActionHandler("previoustrack", () => this.prev());
      ms.setActionHandler("nexttrack", () => this.next());
      ms.setActionHandler("seekto", (details) => {
        if (details.seekTime != null) this.seekTo(details.seekTime);
      });
      ms.setActionHandler("stop", () => this.stop());
    } catch {}
  }

  private clearMediaSessionHandlers(): void {
    if (typeof window === "undefined" || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const ms = navigator.mediaSession;
    try {
      ms.metadata = null;
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("previoustrack", null);
      ms.setActionHandler("nexttrack", null);
      ms.setActionHandler("seekto", null);
      ms.setActionHandler("stop", null);
    } catch {}
  }

  private emit(e: AudioEngineEvent): void {
    this.listeners.forEach((cb) => {
      try {
        cb(e);
      } catch {}
    });
  }
}
