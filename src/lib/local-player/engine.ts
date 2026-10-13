// Mesin pemutar file lokal: HTMLAudioElement + antrean + EQ Web Audio.
//
// - Sumber: object URL (blob IndexedDB / file perangkat) atau URL bertanda
//   cloud. TIDAK PERNAH menyentuh audio YouTube iframe.
// - Graph (bila AudioContext tersedia): element -> MediaElementSource ->
//   10x peaking -> master -> destination. Bila tak tersedia: element langsung.
// - Lifecycle: destroy() melepas listener + menutup context. Object URL
//   dimiliki pemanggil (halaman) — engine tidak revoke agar tak ganda.

import { EQ_BANDS, clampDb } from "@/lib/karaoke/equalizer";

export interface LocalEngineTrack {
  id: string;
  title: string;
  artist: string;
  duration: number | null;
  src: string; // object URL / signed URL
}

export type LocalRepeat = "off" | "all" | "one";
export type LocalStatus = "idle" | "playing" | "paused" | "error";

export interface LocalEngineEvent {
  type: "track" | "status" | "time" | "error";
  index: number;
  status: LocalStatus;
  time?: number;
  message?: string;
}

interface AudioEl {
  src: string;
  currentTime: number;
  duration: number;
  volume: number;
  paused: boolean;
  play: () => Promise<void> | void;
  pause: () => void;
  load: () => void;
  addEventListener: (t: string, fn: () => void) => void;
  removeEventListener: (t: string, fn: () => void) => void;
}

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class LocalAudioEngine {
  private audio: AudioEl;
  private ctx: AudioContext | null = null;
  private eq: BiquadFilterNode[] = [];
  private master: GainNode | null = null;
  private volume = 0.9;
  private queue: LocalEngineTrack[] = [];
  private order: number[] = [];
  private pos = 0; // posisi dalam order
  private repeat: LocalRepeat = "off";
  private shuffleOn = false;
  private status: LocalStatus = "idle";
  private onEvent: (e: LocalEngineEvent) => void;
  private index: number;
  private currentGains: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  constructor(
    onEvent: (e: LocalEngineEvent) => void = () => {},
    factories: {
      createAudio?: () => AudioEl;
      createCtx?: () => AudioContext;
    } = {}
  ) {
    this.onEvent = onEvent;
    this.index = -1;
    if (factories.createAudio) {
      this.audio = factories.createAudio();
    } else if (typeof Audio !== "undefined") {
      this.audio = new Audio() as unknown as AudioEl;
      this.audio.volume = this.volume;
    } else {
      throw new Error("Browser tidak mendukung pemutaran audio.");
    }
    this.createCtx = factories.createCtx ?? (() => new AudioContext());
    this.audio.addEventListener("ended", this.handleEnded);
    this.audio.addEventListener("error", this.handleError);
    this.audio.addEventListener("timeupdate", this.handleTime);

    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem("musikku:local-eq");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === 10) {
            this.currentGains = parsed.map((v) => clampDb(Number(v) || 0));
          }
        }
      }
    } catch {}
  }

  private createCtx: () => AudioContext;

  // ---------- antrean ----------

  get tracks(): LocalEngineTrack[] {
    return this.queue;
  }

  get currentIndex(): number {
    return this.index;
  }

  get current(): LocalEngineTrack | null {
    return this.index >= 0 ? (this.queue[this.index] ?? null) : null;
  }

  get repeatMode(): LocalRepeat {
    return this.repeat;
  }

  get shuffle(): boolean {
    return this.shuffleOn;
  }

  setQueue(tracks: LocalEngineTrack[], startIndex = 0): void {
    this.queue = tracks.slice();
    this.rebuildOrder();
    if (tracks.length === 0) {
      this.index = -1;
      return;
    }
    const i = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    this.pos = this.order.indexOf(i);
    if (this.pos < 0) this.pos = 0;
    this.loadCurrent();
  }

  private rebuildOrder(): void {
    this.order = this.shuffleOn ? shuffled(this.queue.length) : this.queue.map((_, i) => i);
  }

  setShuffle(on: boolean): void {
    const cur = this.index;
    this.shuffleOn = on;
    this.rebuildOrder();
    this.pos = cur >= 0 ? Math.max(0, this.order.indexOf(cur)) : 0;
  }

  setRepeat(m: LocalRepeat): void {
    this.repeat = m;
  }

  private loadCurrent(): void {
    this.index = this.order[this.pos] ?? -1;
    const t = this.current;
    if (!t) return;
    try {
      this.audio.pause();
    } catch {}
    this.audio.src = t.src;
    try {
      this.audio.load();
    } catch {}
    this.emit("track");
  }

  // ---------- transport ----------

  async play(): Promise<void> {
    const t = this.current;
    if (!t) return;
    this.ensureGraph();
    this.setStatus("playing");
    try {
      await this.audio.play();
      try {
        await this.ctx?.resume();
      } catch {}
    } catch {
      this.setStatus("error");
      this.emit("error", "Pemutaran diblokir browser. Ketuk Putar sekali lagi.");
    }
  }

  pause(): void {
    try {
      this.audio.pause();
    } catch {}
    this.setStatus("paused");
  }

  toggle(): void {
    if (this.status === "playing") this.pause();
    else void this.play();
  }

  next(manual = true): void {
    if (this.queue.length === 0) return;
    if (this.pos + 1 < this.order.length) {
      this.pos += 1;
    } else if (this.repeat === "all" || manual) {
      // Manual di lagu terakhir: mulai lagi dari awal.
      // Otomatis (ended) + repeat off: diam (ditangani handleEnded).
      this.pos = 0;
    } else {
      return;
    }
    this.loadCurrent();
    void this.play();
  }

  prev(): void {
    if (this.queue.length === 0) return;
    try {
      if (this.audio.currentTime > 3) {
        this.audio.currentTime = 0;
        return;
      }
    } catch {}
    this.pos = (this.pos - 1 + this.order.length) % this.order.length;
    this.loadCurrent();
    void this.play();
  }

  seekTo(sec: number): void {
    try {
      const d = this.audio.duration;
      const clamped = Number.isFinite(d) && d > 0 ? Math.min(Math.max(sec, 0), d) : Math.max(sec, 0);
      this.audio.currentTime = clamped;
    } catch {}
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    try {
      if (this.master && this.ctx) this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      else this.audio.volume = this.volume;
    } catch {}
  }

  getVolume(): number {
    return this.volume;
  }

  getTime(): number {
    try {
      return this.audio.currentTime || 0;
    } catch {
      return 0;
    }
  }

  // ---------- EQ (Web Audio; no-op aman bila graph tak ada) ----------

  applyEq(gains: number[]): void {
    this.currentGains = [...gains];
    for (let i = 0; i < this.eq.length; i++) {
      try {
        this.eq[i].gain.value = clampDb(gains[i] ?? 0);
      } catch {}
    }
  }

  private ensureGraph(): void {
    if (this.ctx) return;
    // Tanpa AudioContext (atau bila factory melempar): element langsung
    // tanpa EQ — pemutaran tetap berfungsi.
    try {
      const ctx = this.createCtx();
      const src = ctx.createMediaElementSource(this.audio as unknown as HTMLMediaElement);
      let head: AudioNode = src;
      for (let i = 0; i < EQ_BANDS.length; i++) {
        const b = EQ_BANDS[i];
        const f = ctx.createBiquadFilter();
        f.type = "peaking";
        f.frequency.value = b.freq;
        f.Q.value = 1;
        f.gain.value = clampDb(this.currentGains[i] ?? 0);
        head.connect(f);
        head = f;
        this.eq.push(f);
      }
      const master = ctx.createGain();
      master.gain.value = this.volume;
      head.connect(master);
      master.connect(ctx.destination);
      this.audio.volume = 1;
      this.ctx = ctx;
      this.master = master;
    } catch {
      this.ctx = null;
      this.eq = [];
      this.master = null;
    }
  }

  // ---------- events & lifecycle ----------

  private handleEnded = (): void => {
    if (this.repeat === "one" && this.current) {
      try {
        this.audio.currentTime = 0;
      } catch {}
      void this.play();
      return;
    }
    if (this.pos + 1 < this.order.length || this.repeat === "all") {
      this.next(false);
    } else {
      this.setStatus("paused");
    }
  };

  private handleError = (): void => {
    this.setStatus("error");
    this.emit("error", "File tidak dapat diputar (format/rusak).");
  };

  private handleTime = (): void => {
    this.emit("time");
  };

  private setStatus(s: LocalStatus): void {
    this.status = s;
    this.emit("status");
  }

  private emit(type: LocalEngineEvent["type"], message?: string): void {
    try {
      this.onEvent({ type, index: this.index, status: this.status, time: this.getTime(), message });
    } catch {}
  }

  destroy(): void {
    try {
      this.audio.removeEventListener("ended", this.handleEnded);
      this.audio.removeEventListener("error", this.handleError);
      this.audio.removeEventListener("timeupdate", this.handleTime);
      this.audio.pause();
    } catch {}
    for (const f of this.eq) {
      try {
        f.disconnect();
      } catch {}
    }
    this.eq = [];
    try {
      void this.ctx?.close().catch(() => {});
    } catch {}
    this.ctx = null;
    this.master = null;
  }
}
