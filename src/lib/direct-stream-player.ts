// src/lib/direct-stream-player.ts
// Direct HTML5 Audio Player Engine dengan Web Audio 10-Band BiquadFilter Equalizer

import { YOUTUBE_EQ_10_BANDS } from "./youtube-eq";

export type DirectPlayerState = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface DirectPlayerListener {
  onState?: (state: DirectPlayerState) => void;
  onTime?: (currentSec: number, durationSec: number) => void;
  onError?: (errorMsg: string) => void;
}

const DIRECT_PLAYER_STORAGE_KEY = "musikku:direct-player-session";

export class DirectStreamPlayer {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private preampGain: GainNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private analyser: AnalyserNode | null = null;
  private state: DirectPlayerState = "idle";
  private currentVideoId: string | null = null;
  private listeners = new Set<DirectPlayerListener>();
  private currentGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  private isEqEnabled = true;
  private lastSavedTime = 0;
  private failedVideoIds = new Set<string>();

  constructor() {
    if (typeof window !== "undefined") {
      this.initAudio();
      this.restoreSession();

      // Sinkronisasi antar tab browser
      window.addEventListener("storage", (e) => {
        if (e.key === DIRECT_PLAYER_STORAGE_KEY && e.newValue) {
          try {
            const session = JSON.parse(e.newValue);
            // Jika tab lain memutar video yang berbeda, jeda tab ini agar tidak bentrok
            if (session.state === "playing" && session.videoId !== this.currentVideoId) {
              this.pause();
            }
          } catch {}
        }
      });

      // Pulihkan AudioContext saat tab browser kembali aktif
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          if (this.ctx && this.ctx.state === "suspended" && this.state === "playing") {
            void this.ctx.resume();
          }
        }
      });
    }
  }

  private saveSession(): void {
    if (typeof localStorage === "undefined" || !this.currentVideoId) return;
    try {
      localStorage.setItem(
        DIRECT_PLAYER_STORAGE_KEY,
        JSON.stringify({
          videoId: this.currentVideoId,
          currentTime: this.audio?.currentTime ?? 0,
          duration: this.audio?.duration ?? 0,
          state: this.state,
          volume: this.audio?.volume ?? 1,
          savedAt: Date.now(),
        })
      );
    } catch {}
  }

  private clearSession(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(DIRECT_PLAYER_STORAGE_KEY);
    } catch {}
  }

  public restoreSession(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(DIRECT_PLAYER_STORAGE_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      // Pulihkan jika tersimpan kurang dari 6 jam lalu dan ada videoId
      if (session.videoId && Date.now() - session.savedAt < 6 * 60 * 60 * 1000) {
        this.currentVideoId = session.videoId;
        const startSec = session.currentTime || 0;
        const dur = session.duration || 0;
        if (typeof session.volume === "number") {
          this.setVolume(session.volume);
        }
        const streamUrl = `/api/stream?v=${encodeURIComponent(session.videoId)}`;
        if (this.audio) {
          this.audio.src = streamUrl;
          if (startSec > 0) {
            try {
              this.audio.currentTime = startSec;
            } catch {}
          }
        }
        this.setState("paused");
        this.listeners.forEach((l) => l.onTime?.(startSec, dur));
      }
    } catch {}
  }

  private initAudio(): void {
    if (this.audio) return;
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "auto";

    this.audio.addEventListener("playing", () => {
      this.setState("playing");
      this.saveSession();
    });
    this.audio.addEventListener("pause", () => {
      if (this.audio?.ended) this.setState("ended");
      else this.setState("paused");
      this.saveSession();
    });
    this.audio.addEventListener("waiting", () => this.setState("loading"));
    this.audio.addEventListener("ended", () => {
      this.setState("ended");
      this.saveSession();
    });
    this.audio.addEventListener("error", () => {
      const msg = this.audio?.error?.message || "Gagal memutar aliran audio.";
      if (this.currentVideoId) {
        this.failedVideoIds.add(this.currentVideoId);
      }
      this.setState("error");
      this.listeners.forEach((l) => l.onError?.(msg));
    });

    this.audio.addEventListener("timeupdate", () => {
      if (!this.audio) return;
      const t = this.audio.currentTime;
      const d = this.audio.duration || 0;
      this.listeners.forEach((l) => l.onTime?.(t, d));

      // Simpan session setiap detik agar tidak hilang saat refresh browser
      if (Math.abs(t - this.lastSavedTime) > 1) {
        this.lastSavedTime = t;
        this.saveSession();
      }
    });
  }

  public subscribe(listener: DirectPlayerListener): () => void {
    this.listeners.add(listener);
    listener.onState?.(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): DirectPlayerState {
    return this.state;
  }

  public isFailedVideo(videoId?: string | null): boolean {
    if (!videoId) return false;
    return this.failedVideoIds.has(videoId);
  }

  public clearFailedVideo(videoId?: string | null): void {
    if (videoId) this.failedVideoIds.delete(videoId);
    else this.failedVideoIds.clear();
  }

  public getCurrentVideoId(): string | null {
    return this.currentVideoId;
  }

  public getCurrentTime(): number {
    return this.audio?.currentTime ?? 0;
  }

  public getDuration(): number {
    return this.audio?.duration ?? 0;
  }

  private setState(next: DirectPlayerState): void {
    if (this.state === next) return;
    this.state = next;
    this.listeners.forEach((l) => l.onState?.(next));
  }

  private ensureAudioGraph(): void {
    if (this.ctx || !this.audio) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.sourceNode = this.ctx.createMediaElementSource(this.audio);

      // Preamp Gain Node
      this.preampGain = this.ctx.createGain();
      this.preampGain.gain.value = 1;

      // Analyser Node untuk spectrum visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      // 10-Band BiquadFilter Nodes
      this.filters = YOUTUBE_EQ_10_BANDS.map((band, i) => {
        const f = this.ctx!.createBiquadFilter();
        f.type = i === 0 ? "lowshelf" : i === YOUTUBE_EQ_10_BANDS.length - 1 ? "highshelf" : "peaking";
        f.frequency.value = band.freq;
        f.Q.value = 1.4;
        f.gain.value = this.isEqEnabled ? (this.currentGains[i] ?? 0) : 0;
        return f;
      });

      // Chain audio: Source -> Preamp -> Filter 0..9 -> Analyser -> Destination
      let lastNode: AudioNode = this.sourceNode;
      lastNode.connect(this.preampGain);
      lastNode = this.preampGain;

      for (const filter of this.filters) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    } catch (err) {
      console.warn("[DirectStreamPlayer] AudioContext setup fallback:", err);
    }
  }

  public async loadAndPlay(videoId: string, startSec = 0): Promise<void> {
    this.initAudio();
    this.ensureAudioGraph();

    if (this.ctx && this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {}
    }

    if (!this.audio) return;

    if (this.failedVideoIds.has(videoId)) {
      this.setState("error");
      this.listeners.forEach((l) => l.onError?.("Aliran audio langsung tidak tersedia untuk video ini."));
      return;
    }

    const isNewTrack = this.currentVideoId !== videoId;
    this.currentVideoId = videoId;

    // Jalur resume kilat jika track sama (misal user mematikan Bypass EQ dan menghidupkannya lagi)
    if (!isNewTrack && this.audio.src) {
      if (startSec > 0) {
        try {
          this.audio.currentTime = startSec;
        } catch {}
      }
      try {
        await this.audio.play();
        this.setState("playing");
        return;
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };
        if (
          error?.name === "NotSupportedError" ||
          error?.message?.includes("supported sources")
        ) {
          this.failedVideoIds.add(videoId);
          this.setState("error");
          this.listeners.forEach((l) =>
            l.onError?.("Aliran audio langsung tidak didukung atau dibatasi di server.")
          );
          return;
        }
      }
    }

    this.setState("loading");

    const streamUrl = `/api/stream?v=${encodeURIComponent(videoId)}`;
    if (isNewTrack || !this.audio.src) {
      this.audio.src = streamUrl;
      this.audio.load();
    }

    if (startSec > 0) {
      const applyStartTime = () => {
        if (!this.audio) return;
        try {
          this.audio.currentTime = startSec;
        } catch {}
      };
      if (this.audio.readyState >= 1) {
        applyStartTime();
      } else {
        this.audio.addEventListener("loadedmetadata", applyStartTime, { once: true });
      }
    }

    const tryPlay = async () => {
      if (!this.audio) return;
      try {
        await this.audio.play();
        this.setState("playing");
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };
        if (error?.name === "NotAllowedError") {
          this.setState("paused");
        } else if (
          error?.name === "NotSupportedError" ||
          error?.message?.includes("supported sources")
        ) {
          this.failedVideoIds.add(videoId);
          this.setState("error");
          this.listeners.forEach((l) =>
            l.onError?.("Aliran audio langsung tidak didukung atau dibatasi di server.")
          );
        } else {
          if (this.audio.readyState >= 2) {
            try {
              await this.audio.play();
              this.setState("playing");
              return;
            } catch {}
          }
          const onReadyToPlay = async () => {
            if (!this.audio) return;
            this.audio.removeEventListener("canplay", onReadyToPlay);
            this.audio.removeEventListener("seeked", onReadyToPlay);
            try {
              await this.audio.play();
              this.setState("playing");
            } catch {
              this.setState("paused");
            }
          };
          this.audio.addEventListener("canplay", onReadyToPlay, { once: true });
          this.audio.addEventListener("seeked", onReadyToPlay, { once: true });
        }
      }
    };

    await tryPlay();
  }

  public async play(): Promise<void> {
    if (!this.audio) return;
    this.ensureAudioGraph();

    if (this.ctx && this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {}
    }

    try {
      await this.audio.play();
      this.setState("playing");
    } catch {}
  }

  public pause(): void {
    if (!this.audio) return;
    try {
      this.audio.pause();
    } catch {}
    this.setState("paused");
  }

  public toggle(): void {
    if (this.state === "playing") {
      this.pause();
    } else {
      void this.play();
    }
  }

  public seekTo(seconds: number): void {
    if (!this.audio) return;
    try {
      this.audio.currentTime = Math.max(0, seconds);
    } catch {}
  }

  public setVolume(vol: number): void {
    if (!this.audio) return;
    this.audio.volume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.audio?.volume ?? 1;
  }

  public applyGains(gains: number[], enabled = true): void {
    this.currentGains = [...gains];
    this.isEqEnabled = enabled;

    if (!this.ctx || this.filters.length === 0) return;
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }

    for (let i = 0; i < this.filters.length; i++) {
      const target = enabled ? (gains[i] ?? 0) : 0;
      try {
        this.filters[i].gain.setValueAtTime(target, this.ctx.currentTime);
      } catch {
        try {
          this.filters[i].gain.value = target;
        } catch {}
      }
    }
  }

  public setPreamp(preampDb: number): void {
    if (!this.ctx || !this.preampGain) return;
    try {
      const gainVal = Math.pow(10, preampDb / 20);
      this.preampGain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    } catch {}
  }

  public getVisualizerData(): Uint8Array | null {
    if (!this.analyser) return null;
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buffer);
    return buffer;
  }

  public stopAndUnload(): void {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.src = "";
      } catch {}
    }
    this.clearSession();
    this.currentVideoId = null;
    this.setState("idle");
  }
}

export const directStreamPlayerSingleton = new DirectStreamPlayer();
