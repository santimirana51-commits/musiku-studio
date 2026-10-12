// Pemutar lokal offscreen: audio + EQ 10-band + Media Session API.
// Audio dari tab lain TIDAK disentuh di sini (lihat TabCapture di popup).

import { EQ_BANDS, clampDb } from "../shared/eq.js";
import { extListTracks, type ExtTrack } from "./store.js";

export interface LocalState {
  tracks: Array<{ id: string; name: string; mime: string; size: number; addedAt: number }>;
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  gains: number[];
}

export class OffscreenPlayer {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private eq: BiquadFilterNode[] = [];
  private master: GainNode | null = null;
  private tracks: ExtTrack[] = [];
  private urls = new Map<string, string>();
  private index = -1;
  private gains: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  private volume = 0.9;
  onChange: () => void = () => {};

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.addEventListener("ended", () => {
        this.next(false);
      });
      this.audio.addEventListener("timeupdate", () => this.onChange());
      this.audio.addEventListener("play", () => {
        this.onChange();
        this.syncMediaSession();
      });
      this.audio.addEventListener("pause", () => this.onChange());
    }
    return this.audio;
  }

  private ensureGraph(): void {
    if (this.ctx || typeof AudioContext === "undefined") return;
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(this.ensureAudio());
      let head: AudioNode = src;
      for (const f of EQ_BANDS) {
        const flt = ctx.createBiquadFilter();
        flt.type = "peaking";
        flt.frequency.value = f;
        flt.Q.value = 1;
        head.connect(flt);
        head = flt;
        this.eq.push(flt);
      }
      const master = ctx.createGain();
      master.gain.value = this.volume;
      head.connect(master);
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    } catch {
      this.ctx = null;
      this.eq = [];
    }
  }

  async refresh(): Promise<void> {
    this.tracks = await extListTracks();
    if (this.index >= this.tracks.length) this.index = this.tracks.length - 1;
  }

  private urlFor(t: ExtTrack): string {
    const hit = this.urls.get(t.id);
    if (hit) return hit;
    const u = URL.createObjectURL(t.blob);
    this.urls.set(t.id, u);
    return u;
  }

  async playIndex(i: number): Promise<void> {
    await this.refresh();
    if (i < 0 || i >= this.tracks.length) throw new Error("Indeks di luar daftar.");
    this.index = i;
    const t = this.tracks[i];
    const el = this.ensureAudio();
    this.ensureGraph();
    el.src = this.urlFor(t);
    el.load();
    this.applyEq(this.gains);
    try {
      await el.play();
      await this.ctx?.resume().catch(() => {});
    } catch {
      throw new Error("Pemutaran diblokir. Buka offscreen lalu coba lagi.");
    }
    this.syncMediaSession();
    this.onChange();
  }

  async toggle(): Promise<void> {
    const el = this.ensureAudio();
    if (this.index < 0) {
      if (this.tracks.length === 0) throw new Error("Koleksi kosong.");
      await this.playIndex(0);
      return;
    }
    if (el.paused) await el.play().catch(() => {
      throw new Error("Pemutaran diblokir.");
    });
    else el.pause();
    this.onChange();
  }

  pause(): void {
    try {
      this.audio?.pause();
    } catch {}
    this.onChange();
  }

  async next(auto = true): Promise<void> {
    if (this.tracks.length === 0) return;
    await this.playIndex((this.index + 1) % this.tracks.length).catch(() => {});
    void auto;
  }

  async prev(): Promise<void> {
    if (this.tracks.length === 0) return;
    try {
      if (this.audio && this.audio.currentTime > 3) {
        this.audio.currentTime = 0;
        return;
      }
    } catch {}
    await this.playIndex((this.index - 1 + this.tracks.length) % this.tracks.length).catch(() => {});
  }

  seek(sec: number): void {
    try {
      if (this.audio) this.audio.currentTime = Math.max(0, sec);
    } catch {}
    this.onChange();
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    try {
      if (this.master && this.ctx) this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      else if (this.audio) this.audio.volume = this.volume;
    } catch {}
    this.onChange();
  }

  applyEq(gains: number[]): void {
    this.gains = gains.map(clampDb);
    for (let i = 0; i < this.eq.length; i++) {
      try {
        this.eq[i].gain.value = this.gains[i] ?? 0;
      } catch {}
    }
    this.onChange();
  }

  async deleteTrack(id: string): Promise<void> {
    const { extDeleteTrack } = await import("./store.js");
    const playingId = this.tracks[this.index]?.id;
    if (playingId === id) {
      this.pause();
      this.index = -1;
    }
    await extDeleteTrack(id);
    const u = this.urls.get(id);
    if (u) {
      try {
        URL.revokeObjectURL(u);
      } catch {}
      this.urls.delete(id);
    }
    await this.refresh();
    this.onChange();
  }

  private syncMediaSession(): void {
    try {
      const t = this.tracks[this.index];
      if (!t || !("mediaSession" in navigator)) return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.name, artist: "MusikKu Lokal", album: "" });
      navigator.mediaSession.setActionHandler("play", () => void this.toggle());
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
      navigator.mediaSession.setActionHandler("previoustrack", () => void this.prev());
      navigator.mediaSession.setActionHandler("nexttrack", () => void this.next());
      navigator.mediaSession.setActionHandler("seekto", (d) => {
        if (typeof d.seekTime === "number") this.seek(d.seekTime);
      });
    } catch {}
  }

  state(): LocalState {
    const t = this.tracks[this.index];
    return {
      tracks: this.tracks.map(({ id, name, mime, size, addedAt }) => ({ id, name, mime, size, addedAt })),
      index: this.index,
      playing: !!this.audio && !this.audio.paused && !!t,
      position: this.audio?.currentTime ?? 0,
      duration: this.audio?.duration ?? NaN,
      volume: this.volume,
      gains: [...this.gains],
    };
  }

  destroy(): void {
    try {
      this.audio?.pause();
    } catch {}
    this.urls.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch {}
    });
    this.urls.clear();
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
  }
}
