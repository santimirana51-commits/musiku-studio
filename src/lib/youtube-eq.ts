// src/lib/youtube-eq.ts
// Manajemen Pengaturan, Preset, dan Web Audio Engine untuk YouTube EQ
import { applyNativeGains, setNativeEqualizerEnabled } from "./native-equalizer";

export interface YoutubeEqBand {
  freq: number;
  label: string;
}

export const YOUTUBE_EQ_5_BANDS: YoutubeEqBand[] = [
  { freq: 60, label: "60 Hz" },
  { freq: 230, label: "230 Hz" },
  { freq: 910, label: "910 Hz" },
  { freq: 4000, label: "4 kHz" },
  { freq: 14000, label: "14 kHz" },
];

export const YOUTUBE_EQ_10_BANDS: YoutubeEqBand[] = [
  { freq: 32, label: "32 Hz" },
  { freq: 64, label: "64 Hz" },
  { freq: 125, label: "125 Hz" },
  { freq: 250, label: "250 Hz" },
  { freq: 500, label: "500 Hz" },
  { freq: 1000, label: "1 kHz" },
  { freq: 2000, label: "2 kHz" },
  { freq: 4000, label: "4 kHz" },
  { freq: 8000, label: "8 kHz" },
  { freq: 16000, label: "16 kHz" },
];

export interface YoutubeEqPreset {
  id: string;
  label: string;
  gains10: number[]; // 10-band gains in dB (-12 to +12)
}

export const YOUTUBE_EQ_PRESETS: YoutubeEqPreset[] = [
  { id: "flat", label: "Flat", gains10: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: "bass_boost", label: "Bass Boost", gains10: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0] },
  { id: "bass_reducer", label: "Bass Reducer", gains10: [-6, -5, -4, -2, 0, 0, 0, 0, 0, 0] },
  { id: "treble_boost", label: "Treble Boost", gains10: [0, 0, 0, 0, 0, 1, 3, 5, 6, 7] },
  { id: "vocal", label: "Vocal Boost", gains10: [-3, -2, -1, 1, 3, 4, 3, 1, 0, -1] },
  { id: "rock", label: "Rock", gains10: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5] },
  { id: "pop", label: "Pop", gains10: [3, 2, 1, 0, 1, 2, 3, 3, 2, 1] },
  { id: "jazz", label: "Jazz", gains10: [4, 3, 1, 2, -1, -1, 0, 2, 3, 4] },
  { id: "electronic", label: "Electronic", gains10: [6, 5, 2, 0, -2, 2, 1, 3, 5, 6] },
  { id: "classical", label: "Classical", gains10: [5, 4, 3, 2, -1, -1, 0, 2, 3, 4] },
  { id: "hiphop", label: "Hip-Hop", gains10: [7, 6, 3, 1, -1, 0, 2, 1, 4, 5] },
  { id: "acoustic", label: "Acoustic", gains10: [4, 3, 2, 1, 1, 2, 3, 4, 3, 2] },
];

export const CHROME_EXTENSION_INFO = {
  id: "mhnbanaoklmlgpgpkpbaeijloamdmenb",
  name: "YouTube EQ (Equalizer)",
  url: "https://chromewebstore.google.com/detail/mhnbanaoklmlgpgpkpbaeijloamdmenb?utm_source=item-share-cb",
  description:
    "Ekstensi Chrome resmi yang menyematkan equalizer audio multi-band (5, 10, 20, 31 band) langsung ke dalam pemutar YouTube di browser Anda.",
};

const STORAGE_KEY = "musikku:youtube-eq";

export interface YoutubeEqState {
  enabled: boolean;
  bandCount: 5 | 10;
  preset: string;
  gains10: number[];
  preamp: number; // dB, -6 to +6
}

export const DEFAULT_YOUTUBE_EQ_STATE: YoutubeEqState = {
  enabled: true,
  bandCount: 10,
  preset: "flat",
  gains10: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preamp: 0,
};

export function loadYoutubeEqState(): YoutubeEqState {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_YOUTUBE_EQ_STATE;
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const eqRaw = localStorage.getItem("musikku:eq-settings");
      if (eqRaw) {
        try {
          const eqObj = JSON.parse(eqRaw);
          if (Array.isArray(eqObj.gains)) {
            raw = JSON.stringify({
              enabled: true,
              bandCount: 10,
              preset: eqObj.preset || "flat",
              gains10: eqObj.gains,
              preamp: 0,
            });
          }
        } catch {}
      }
    }
    if (!raw) return DEFAULT_YOUTUBE_EQ_STATE;
    const parsed = JSON.parse(raw);
    const globalSync = getGlobalEqSync();
    return {
      enabled: globalSync,
      bandCount: parsed.bandCount === 5 ? 5 : 10,
      preset: typeof parsed.preset === "string" ? parsed.preset : "flat",
      gains10: Array.isArray(parsed.gains10) && parsed.gains10.length === 10
        ? parsed.gains10.map((v: number) => Math.max(-12, Math.min(12, Number(v) || 0)))
        : [...DEFAULT_YOUTUBE_EQ_STATE.gains10],
      preamp: Math.max(-6, Math.min(6, Number(parsed.preamp) || 0)),
    };
  } catch {
    return DEFAULT_YOUTUBE_EQ_STATE;
  }
}

export function saveYoutubeEqState(state: YoutubeEqState): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(EQ_SYNC_KEY, String(state.enabled));
      localStorage.setItem(
        "musikku:eq-settings",
        JSON.stringify({
          preset: state.preset,
          gains: state.gains10,
        })
      );
      localStorage.setItem("musikku:local-eq", JSON.stringify(state.gains10));
    }
  } catch {}
  void applyNativeGains(state.gains10, state.enabled);
}

export const EQ_SYNC_KEY = "musikku:eq-sync-enabled";
export const EQ_SYNC_EVENT = "musikku:eq-sync-change";

export function getGlobalEqSync(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(EQ_SYNC_KEY) !== "false";
}

export function setGlobalEqSync(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(EQ_SYNC_KEY, String(enabled));
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        obj.enabled = enabled;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      } catch {}
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EQ_SYNC_EVENT, { detail: enabled }));
    }
  } catch {}
  void setNativeEqualizerEnabled(enabled);
}

export interface YoutubeEqDiagnostics {
  isConnected: boolean;
  audioContextState: AudioContextState | "closed" | "none";
  sampleRate: number;
  hasAudioTrack: boolean;
  audioTrackCount: number;
  audioTrackLabel: string;
  audioTrackReadyState: MediaStreamTrackState | "none";
  videoTrackCount: number;
  hasSignal: boolean;
  signalLevel: number; // 0..100
  isOutputMuted: boolean;
  suppressLocalPlaybackSupported: boolean;
}

/**
 * Web Audio Engine untuk penangkapan Live Tab Audio YouTube & real-time EQ filtering
 */
export class YoutubeEqEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private preampGain: GainNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private analyser: AnalyserNode | null = null;
  private outputGain: GainNode | null = null;
  private isOutputMuted = false;
  private isConnected = false;
  private onStateChangeCb?: (connected: boolean) => void;

  public onConnectionChange(cb: (connected: boolean) => void) {
    this.onStateChangeCb = cb;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsOutputMuted(): boolean {
    return this.isOutputMuted;
  }

  public setOutputMuted(muted: boolean): void {
    this.isOutputMuted = muted;
    if (this.outputGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.outputGain.gain.cancelScheduledValues(now);
        this.outputGain.gain.setValueAtTime(muted ? 0 : 1, now);
      } catch {
        this.outputGain.gain.value = muted ? 0 : 1;
      }
    }
  }

  /**
   * Gunakan kembali AudioContext yang ada secara aman agar tidak melebihi batas browser (maks 6).
   */
  public getOrCreateContext(): AudioContext {
    if (this.ctx && this.ctx.state !== "closed") {
      return this.ctx;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    this.ctx = ctx;

    // Pasang listener resume otomatis pada setiap interaksi pengguna
    if (typeof window !== "undefined") {
      const resumeOnGesture = () => {
        if (this.ctx && this.ctx.state === "suspended") {
          void this.ctx.resume();
        }
      };
      window.addEventListener("click", resumeOnGesture, { passive: true });
      window.addEventListener("keydown", resumeOnGesture, { passive: true });
      window.addEventListener("touchstart", resumeOnGesture, { passive: true });
    }

    return ctx;
  }

  /**
   * Bersihkan trek media dan node Web Audio tanpa menutup AudioContext utama.
   */
  private cleanUpStreamAndNodes(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.stream = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.preampGain) {
      try {
        this.preampGain.disconnect();
      } catch {}
      this.preampGain = null;
    }
    for (const f of this.filters) {
      try {
        f.disconnect();
      } catch {}
    }
    this.filters = [];
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {}
      this.analyser = null;
    }
    if (this.outputGain) {
      try {
        this.outputGain.disconnect();
      } catch {}
      this.outputGain = null;
    }
  }

  public async connectTabAudio(initialGains: number[], preampDb = 0): Promise<boolean> {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getDisplayMedia ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    ) {
      throw new Error("Penangkapan audio tab hanya didukung pada peramban PC/Desktop (Chrome, Edge, Firefox).");
    }

    const ctx = this.getOrCreateContext();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {}
    }

    // Bersihkan sesi streaming lama jika ada
    this.cleanUpStreamAndNodes();

    let stream: MediaStream;
    const supportedConstraints =
      typeof navigator !== "undefined" && navigator.mediaDevices?.getSupportedConstraints
        ? navigator.mediaDevices.getSupportedConstraints()
        : null;
    const supportsSuppress = Boolean(supportedConstraints && "suppressLocalAudioPlayback" in supportedConstraints);

    const preferredOptions: DisplayMediaStreamOptions & {
      preferCurrentTab?: boolean;
      selfBrowserSurface?: string;
      systemAudio?: string;
      suppressLocalAudioPlayback?: boolean;
    } = {
      video: {
        displaySurface: "browser",
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      systemAudio: "include",
      ...(supportsSuppress ? { suppressLocalAudioPlayback: true } : {}),
    };

    try {
      try {
        stream = await navigator.mediaDevices.getDisplayMedia(preferredOptions);
      } catch (err: unknown) {
        const e = err as { name?: string };
        if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
          throw err;
        }
        // Fallback opsi dasar jika browser menolak constraint lanjutan
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      }
    } catch (err) {
      this.disconnect();
      throw err;
    }

    // PENTING: Jangan panggil vt.stop() karena di beberapa browser hal itu mematikan seluruh sesi capture!
    // Cukup nonaktifkan (enabled = false) untuk hemat CPU/GPU tanpa memutus stream audio.
    stream.getVideoTracks().forEach((vt) => {
      vt.enabled = false;
    });

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      throw new Error(
        "Tidak ada audio yang dibagikan. Pastikan mencentang kotak 'Bagikan audio tab' (Also share tab audio) pada dialog browser."
      );
    }

    // Coba terapkan suppressLocalAudioPlayback pada track jika didukung
    try {
      if (typeof audioTracks[0].applyConstraints === "function") {
        // @ts-expect-error Chromium specific constraint
        await audioTracks[0].applyConstraints({ suppressLocalAudioPlayback: true });
      }
    } catch {}

    // Pasang listener saat user menghentikan sharing via banner browser
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        this.disconnect();
      };
    });

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {}
    }

    this.stream = stream;
    this.sourceNode = ctx.createMediaStreamSource(stream);

    // Preamp Node
    this.preampGain = ctx.createGain();
    this.preampGain.gain.value = Math.pow(10, preampDb / 20);

    // 10-Band Biquad Filters (peaking/shelf EQ)
    this.filters = YOUTUBE_EQ_10_BANDS.map((band, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = i === 0 ? "lowshelf" : i === YOUTUBE_EQ_10_BANDS.length - 1 ? "highshelf" : "peaking";
      filter.frequency.value = band.freq;
      filter.Q.value = 1.4;
      filter.gain.value = initialGains[i] ?? 0;
      return filter;
    });

    // Analyser Node diletakkan setelah filters agar visualizer benar-benar menampilkan efek EQ
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.8;

    // Output Gain Node
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = this.isOutputMuted ? 0 : 1.0;

    // Sambungkan rantai Web Audio secara berurutan:
    // Source -> Preamp -> Filter 0..9 -> Analyser -> OutputGain -> Destination
    let lastNode: AudioNode = this.sourceNode;
    lastNode.connect(this.preampGain);
    lastNode = this.preampGain;

    for (const filter of this.filters) {
      lastNode.connect(filter);
      lastNode = filter;
    }

    lastNode.connect(this.analyser);
    this.analyser.connect(this.outputGain);
    this.outputGain.connect(ctx.destination);

    this.isConnected = true;
    this.onStateChangeCb?.(true);
    return true;
  }

  public updateGains(gains: number[], enabled = true): void {
    void applyNativeGains(gains, enabled);
    if (!this.ctx || this.filters.length === 0) return;
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    for (let i = 0; i < this.filters.length; i++) {
      const targetGain = enabled ? (gains[i] ?? 0) : 0;
      try {
        this.filters[i].gain.cancelScheduledValues(now);
        this.filters[i].gain.setTargetAtTime(targetGain, now, 0.02);
      } catch {
        this.filters[i].gain.value = targetGain;
      }
    }
  }

  public updatePreamp(preampDb: number): void {
    if (!this.ctx || !this.preampGain) return;
    const gainVal = Math.pow(10, preampDb / 20);
    try {
      this.preampGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.preampGain.gain.setTargetAtTime(gainVal, this.ctx.currentTime, 0.05);
    } catch {
      this.preampGain.gain.value = gainVal;
    }
  }

  public getVisualizerData(): Uint8Array | null {
    if (!this.analyser) return null;
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buffer);
    return buffer;
  }

  public getSignalLevel(): number {
    if (!this.analyser) return 0;
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i];
    }
    const avg = sum / buffer.length;
    return Math.min(100, Math.round((avg / 255) * 100 * 2));
  }

  public hasActiveSignal(): boolean {
    if (!this.analyser) return false;
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buffer);
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] > 5) return true;
    }
    return false;
  }

  public getDiagnostics(): YoutubeEqDiagnostics {
    const audioTrack = this.stream?.getAudioTracks()[0];
    const videoTracks = this.stream?.getVideoTracks() || [];
    const supportedConstraints =
      typeof navigator !== "undefined" && navigator.mediaDevices?.getSupportedConstraints
        ? navigator.mediaDevices.getSupportedConstraints()
        : null;
    const supportsSuppress = Boolean(supportedConstraints && "suppressLocalAudioPlayback" in supportedConstraints);

    return {
      isConnected: this.isConnected,
      audioContextState: this.ctx ? this.ctx.state : "none",
      sampleRate: this.ctx ? this.ctx.sampleRate : 0,
      hasAudioTrack: Boolean(audioTrack && audioTrack.readyState === "live"),
      audioTrackCount: this.stream ? this.stream.getAudioTracks().length : 0,
      audioTrackLabel: audioTrack?.label || "none",
      audioTrackReadyState: audioTrack?.readyState || "none",
      videoTrackCount: videoTracks.length,
      hasSignal: this.hasActiveSignal(),
      signalLevel: this.getSignalLevel(),
      isOutputMuted: this.isOutputMuted,
      suppressLocalPlaybackSupported: supportsSuppress,
    };
  }

  public disconnect(): void {
    this.cleanUpStreamAndNodes();
    this.isOutputMuted = false;
    if (this.isConnected) {
      this.isConnected = false;
      this.onStateChangeCb?.(false);
    }
  }
}

export const youtubeEqEngineSingleton = new YoutubeEqEngine();
