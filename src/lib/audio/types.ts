// Kontrak Audio Engine bersama (Fase 2 — multi-platform).
//
// Tujuan: satu interface untuk Web/Android/Windows tanpa menjanjikan
// kemampuan yang tidak didukung engine platform. Setiap engine WAJIB
// mengekspos `capabilities` jujur + fallback jelas.
//
// Cakupan §C misi: load, play/pause/stop/seek/next/prev, volume/mute,
// shuffle/repeat/queue, currentTime/duration/buffering/state, error,
// metadata/artwork, lifecycle/cleanup.
//
// Engine yang ada (tidak diubah): PlayerContext (YouTube) + LocalAudioEngine.
// File ini hanya kontrak + tipe; adapter ada di web-*-engine.ts.

export type AudioSourceKind = "youtube" | "local-file" | "local-indexeddb" | "cloud";

export type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";

export type RepeatMode = "off" | "all" | "one";

export interface AudioTrack {
  /** ID unik sumber (videoId YouTube / record id lokal / row id cloud). */
  id: string;
  kind: AudioSourceKind;
  title: string;
  artist: string;
  /** URL putar: object URL (lokal) / signed URL (cloud). YouTube: kosong. */
  src: string;
  duration: number | null;
  artwork?: string;
}

export interface EngineCapabilities {
  canPlay: boolean;
  canPause: boolean;
  canStop: boolean;
  canSeek: boolean;
  canVolume: boolean;
  canMute: boolean;
  canShuffle: boolean;
  canRepeat: boolean;
  canQueue: boolean;
  /** Background sungguhan (service OS). Web tab = false. YouTube = false. */
  canBackground: boolean;
  /** EQ benar-benar di jalur audio (bukan klaim). */
  canEqualize: boolean;
  canMediaSession: boolean;
  canNext: boolean;
  canPrev: boolean;
}

export interface AudioEngineEvent {
  type: "track" | "state" | "time" | "error" | "queue";
  state: PlaybackState;
  index: number;
  time?: number;
  message?: string;
}

export interface AudioEngine {
  readonly capabilities: EngineCapabilities;
  readonly state: PlaybackState;
  readonly current: AudioTrack | null;
  readonly currentIndex: number;
  readonly error: string | null;

  load(tracks: AudioTrack[], startIndex?: number): void;
  play(): Promise<void> | void;
  pause(): void;
  stop(): void;
  seekTo(seconds: number): void;
  next(): void;
  prev(): void;

  setVolume(v: number): void;
  getVolume(): number;
  setMuted(m: boolean): void;
  isMuted(): boolean;

  setShuffle(on: boolean): void;
  setRepeat(m: RepeatMode): void;

  currentTime(): number;
  duration(): number | null;
  /** 0..1 porsi buffering bila diketahui engine; null bila tak didukung. */
  buffered(): number | null;

  onEvent(cb: (e: AudioEngineEvent) => void): () => void;
  destroy(): void;
}

export function idleCapabilities(): EngineCapabilities {
  return {
    canPlay: false,
    canPause: false,
    canStop: false,
    canSeek: false,
    canVolume: false,
    canMute: false,
    canShuffle: false,
    canRepeat: false,
    canQueue: false,
    canBackground: false,
    canEqualize: false,
    canMediaSession: false,
    canNext: false,
    canPrev: false,
  };
}

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0.9;
  return Math.min(1, Math.max(0, v));
}
