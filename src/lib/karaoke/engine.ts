// KaraokeEngine — sinkronisasi lirik LRC (per baris) dengan waktu putar.
//
// Sumber waktu dibaca dari provider (YouTube IFrame Player API resmi di
// lapisan komponen), BUKAN dari ekstraksi audio. Engine ini murni logika:
//   update(waktuMs) -> indeks baris aktif (binary search, tanpa reload).
//
// Siklus hidup:
//   attach(provider)  -> mulai loop requestAnimationFrame
//   detach()          -> hentikan loop (wajib dipanggil saat unmount /
//                        ganti video agar tidak ada timer menggantung)
//   handleVideoChange() -> reset indeks & offset tampilan saat video berganti
//   setOffsetMs()     -> geser sinkronisasi tanpa reload
//
// Status player (playing/paused/buffering/ended/error) dilaporkan lewat
// handlePlayerState agar engine berhenti maju saat buffering dan reset
// dengan benar saat video berakhir.

import { findActiveIndex, type LyricLine } from "./lrc";

export type { LyricLine };

export interface KaraokeTimeProvider {
  /** Detik posisi putar saat ini (seperti YT.Player.getCurrentTime). */
  getCurrentTime: () => number;
  /** 1 = maju normal; didukung bila player mengizinkan playbackRate. */
  getPlaybackRate?: () => number;
}

export type KaraokePlayerState =
  | "unstarted"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "error"
  | "cued";

export interface KaraokeEngineCallbacks {
  onActiveLine?: (line: LyricLine | null, index: number) => void;
  onState?: (state: KaraokePlayerState) => void;
}

function raf(): ((cb: () => void) => number) | null {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame;
  return null;
}

function caf(id: number): void {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
}

export class KaraokeEngine {
  private lines: LyricLine[] = [];
  private offsetMs = 0;
  private provider: KaraokeTimeProvider | null = null;
  private rafId = 0;
  private running = false;
  private lastIndex = -2; // -2 = belum pernah emit; -1 = belum ada baris tiba
  private lastState: KaraokePlayerState = "unstarted";
  private cb: KaraokeEngineCallbacks;

  constructor(lines: LyricLine[] = [], cb: KaraokeEngineCallbacks = {}) {
    this.lines = lines;
    this.cb = cb;
  }

  setCallbacks(cb: KaraokeEngineCallbacks): void {
    this.cb = cb;
  }

  setLines(lines: LyricLine[]): void {
    this.lines = lines;
    this.lastIndex = -2;
  }

  /** Geser sinkronisasi (+/- ms) tanpa reload; langsung dievaluasi ulang. */
  setOffsetMs(ms: number): void {
    this.offsetMs = Number.isFinite(ms) ? Math.trunc(ms) : 0;
    this.lastIndex = -2;
    this.poll(true);
  }

  getOffsetMs(): number {
    return this.offsetMs;
  }

  attach(provider: KaraokeTimeProvider): void {
    this.detach();
    this.provider = provider;
    this.running = true;
    this.loop();
  }

  detach(): void {
    this.running = false;
    if (this.rafId) caf(this.rafId);
    this.rafId = 0;
    this.provider = null;
  }

  get isAttached(): boolean {
    return this.running;
  }

  /** Dipanggil saat video berganti: reset indeks agar tidak bocor antar lagu. */
  handleVideoChange(): void {
    this.lastIndex = -2;
    this.cb.onActiveLine?.(null, -1);
  }

  handlePlayerState(state: KaraokePlayerState): void {
    this.lastState = state;
    this.cb.onState?.(state);
    if (state === "ended") {
      // Tahan di baris terakhir, lalu reset ringan untuk pemutaran ulang.
      this.lastIndex = -2;
      this.cb.onActiveLine?.(null, -1);
    }
    if (state === "playing") this.poll(true);
  }

  get lastPlayerState(): KaraokePlayerState {
    return this.lastState;
  }

  /**
   * Evaluasi deterministik untuk satu titik waktu (ms). Dipakai loop
   * internal dan langsung oleh unit test. Mengembalikan indeks aktif.
   */
  update(timeMs: number): number {
    const idx = findActiveIndex(this.lines, timeMs, this.offsetMs);
    if (idx !== this.lastIndex) {
      this.lastIndex = idx;
      this.cb.onActiveLine?.(idx >= 0 ? this.lines[idx] : null, idx);
    }
    return idx;
  }

  private poll(force = false): void {
    if (!this.provider) return;
    let t: number;
    try {
      t = this.provider.getCurrentTime();
    } catch {
      return;
    }
    if (!Number.isFinite(t) || t < 0) return;
    if (force) this.lastIndex = -2;
    this.update(t * 1000);
  }

  private loop = (): void => {
    if (!this.running) return;
    // Jangan maju saat buffering/ended/error — waktu dibekukan player.
    if (this.lastState !== "buffering" && this.lastState !== "ended" && this.lastState !== "error") {
      this.poll();
    }
    const r = raf();
    if (r) this.rafId = r(this.loop);
    else if (typeof setTimeout === "function") {
      // Fallback lingkungan tanpa rAF (tidak dipakai di browser modern).
      this.rafId = setTimeout(this.loop, 250) as unknown as number;
    }
  };
}
