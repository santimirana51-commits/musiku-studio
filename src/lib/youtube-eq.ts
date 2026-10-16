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
  outputVolume?: number; // 0.0 to 1.5, default 1.0 (100%)
  feedbackGuard?: boolean; // default true (proteksi feedback loop & soft limiter)
}

export const DEFAULT_YOUTUBE_EQ_STATE: YoutubeEqState = {
  enabled: true,
  bandCount: 10,
  preset: "flat",
  gains10: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preamp: 0,
  outputVolume: 1.0,
  feedbackGuard: true,
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
              outputVolume: 1.0,
              feedbackGuard: true,
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
      outputVolume: typeof parsed.outputVolume === "number" ? Math.max(0, Math.min(1.5, parsed.outputVolume)) : 1.0,
      feedbackGuard: parsed.feedbackGuard !== false,
    };
  } catch {
    return DEFAULT_YOUTUBE_EQ_STATE;
  }
}

export function saveYoutubeEqState(state: YoutubeEqState): void {
  try {
    if (typeof localStorage !== "undefined") {
      const mergedState: YoutubeEqState = {
        ...DEFAULT_YOUTUBE_EQ_STATE,
        ...state,
        outputVolume: typeof state.outputVolume === "number" ? state.outputVolume : DEFAULT_YOUTUBE_EQ_STATE.outputVolume,
        feedbackGuard: typeof state.feedbackGuard === "boolean" ? state.feedbackGuard : DEFAULT_YOUTUBE_EQ_STATE.feedbackGuard,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedState));
      localStorage.setItem(EQ_SYNC_KEY, String(mergedState.enabled));
      localStorage.setItem(
        "musikku:eq-settings",
        JSON.stringify({
          preset: mergedState.preset,
          gains: mergedState.gains10,
        })
      );
      localStorage.setItem("musikku:local-eq", JSON.stringify(mergedState.gains10));
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
  signalLevel: number; // 0..100 (dari output analyser)
  preEqLevel: number;  // 0..100% RMS sebelum EQ
  postEqLevel: number; // 0..100% RMS setelah EQ
  preEqDb: number;     // dBFS (-60..0)
  postEqDb: number;    // dBFS (-60..0)
  isClipping: boolean; // Peak clipping detection (peak >= 0.98)
  outputGainValue: number; // 0.0 .. 1.5
  isOutputActive: boolean; // output gain > 0 and connected to destination
  isOutputMuted: boolean;  // explicit mute
  feedbackGuardEnabled: boolean;
  feedbackGuardTriggered: boolean;
  suppressLocalPlaybackSupported: boolean;
  suppressLocalPlaybackActive: boolean;
}

/**
 * Web Audio Engine untuk penangkapan Live Tab Audio YouTube & real-time EQ filtering
 * 
 * Rantai Audio yang benar:
 * Source -> preAnalyser (pengukuran input RMS)
 *        -> dcBlockFilter (20Hz highpass buang DC offset & runaway sub-bass loop)
 *        -> preampGain (-6dB .. +6dB)
 *        -> 10 BiquadFilter (band 0 lowshelf Q=0.707, band 1..8 peaking Q=1.414, band 9 highshelf Q=0.707)
 *        -> postAnalyser (visualizer & output RMS)
 *        -> safetyLimiter (DynamicsCompressor: true brickwall peak limiter mencegah distorsi clipping)
 *        -> outputGain (master output volume, TIDAK PERNAH dibisukan oleh Anti-Feedback)
 *        -> ctx.destination (output speaker)
 */
export class YoutubeEqEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private preAnalyser: AnalyserNode | null = null;
  private dcBlockFilter: BiquadFilterNode | null = null;
  private preampGain: GainNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private postAnalyser: AnalyserNode | null = null;
  private safetyLimiter: DynamicsCompressorNode | null = null;
  private outputGain: GainNode | null = null;
  private isOutputMuted = false;
  private currentOutputVolume = 1.0;
  private currentPreampDb = 0;
  private isConnected = false;
  private feedbackGuardEnabled = true;
  private feedbackGuardTriggered = false;
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
        const target = muted ? 0 : this.currentOutputVolume;
        this.outputGain.gain.setValueAtTime(target, now);
      } catch {
        this.outputGain.gain.value = muted ? 0 : this.currentOutputVolume;
      }
    }
  }

  public setOutputVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1.5, volume));
    this.currentOutputVolume = clamped;
    if (this.outputGain && this.ctx && !this.isOutputMuted) {
      try {
        const now = this.ctx.currentTime;
        this.outputGain.gain.cancelScheduledValues(now);
        this.outputGain.gain.setTargetAtTime(clamped, now, 0.03);
      } catch {
        this.outputGain.gain.value = clamped;
      }
    }
  }

  public getOutputVolume(): number {
    return this.currentOutputVolume;
  }

  public setFeedbackGuard(enabled: boolean): void {
    this.feedbackGuardEnabled = enabled;
  }

  public getFeedbackGuard(): boolean {
    return this.feedbackGuardEnabled;
  }

  public resetGainStaging(): void {
    this.currentPreampDb = 0;
    this.currentOutputVolume = 1.0;
    this.isOutputMuted = false;
    this.feedbackGuardTriggered = false;
    if (this.preampGain && this.ctx) {
      try {
        this.preampGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      } catch {
        this.preampGain.gain.value = 1.0;
      }
    }
    if (this.outputGain && this.ctx) {
      try {
        this.outputGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      } catch {
        this.outputGain.gain.value = 1.0;
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
    if (this.preAnalyser) {
      try {
        this.preAnalyser.disconnect();
      } catch {}
      this.preAnalyser = null;
    }
    if (this.dcBlockFilter) {
      try {
        this.dcBlockFilter.disconnect();
      } catch {}
      this.dcBlockFilter = null;
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
    if (this.postAnalyser) {
      try {
        this.postAnalyser.disconnect();
      } catch {}
      this.postAnalyser = null;
    }
    if (this.safetyLimiter) {
      try {
        this.safetyLimiter.disconnect();
      } catch {}
      this.safetyLimiter = null;
    }
    if (this.outputGain) {
      try {
        this.outputGain.disconnect();
      } catch {}
      this.outputGain = null;
    }
  }

  public async connectTabAudio(
    initialGains: number[],
    preampDb = 0,
    outputVolume = 1.0,
    feedbackGuard = true
  ): Promise<boolean> {
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
        ...(supportsSuppress ? { suppressLocalAudioPlayback: true } : {}),
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

    // Nonaktifkan video track untuk hemat CPU/GPU tanpa memutus stream audio
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
    this.currentPreampDb = preampDb;
    this.currentOutputVolume = outputVolume;
    this.feedbackGuardEnabled = feedbackGuard;
    this.feedbackGuardTriggered = false;

    // 1. Source Node
    this.sourceNode = ctx.createMediaStreamSource(stream);

    // 2. preAnalyser (Untuk mengukur RMS sinyal murni input sebelum EQ)
    this.preAnalyser = ctx.createAnalyser();
    this.preAnalyser.fftSize = 256;
    this.preAnalyser.smoothingTimeConstant = 0.5;
    this.sourceNode.connect(this.preAnalyser);

    // 3. dcBlockFilter (Highpass 20Hz: buang DC offset / sub-bass rumble pencegah runaway loop)
    this.dcBlockFilter = ctx.createBiquadFilter();
    this.dcBlockFilter.type = "highpass";
    this.dcBlockFilter.frequency.value = 20;
    this.dcBlockFilter.Q.value = 0.707;
    this.sourceNode.connect(this.dcBlockFilter);

    // 4. Preamp Node
    this.preampGain = ctx.createGain();
    this.preampGain.gain.value = Math.pow(10, preampDb / 20);
    this.dcBlockFilter.connect(this.preampGain);

    // 5. 10-Band Biquad Filters (shelf pada band 0 & 9 dengan Q=0.707; peaking band 1..8 dengan Q=1.414)
    this.filters = YOUTUBE_EQ_10_BANDS.map((band, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = i === 0 ? "lowshelf" : i === YOUTUBE_EQ_10_BANDS.length - 1 ? "highshelf" : "peaking";
      filter.frequency.value = band.freq;
      filter.Q.value = i === 0 || i === YOUTUBE_EQ_10_BANDS.length - 1 ? 0.707 : 1.414;
      filter.gain.value = initialGains[i] ?? 0;
      return filter;
    });

    let lastNode: AudioNode = this.preampGain;
    for (const filter of this.filters) {
      lastNode.connect(filter);
      lastNode = filter;
    }

    // 6. postAnalyser (Visualizer & post-EQ signal level)
    this.postAnalyser = ctx.createAnalyser();
    this.postAnalyser.fftSize = 256;
    this.postAnalyser.smoothingTimeConstant = 0.8;
    lastNode.connect(this.postAnalyser);

    // 7. safetyLimiter (Soft-knee peak limiter: cegah digital hard clipping ke speaker DAC)
    this.safetyLimiter = ctx.createDynamicsCompressor();
    this.safetyLimiter.threshold.value = -0.5;
    this.safetyLimiter.knee.value = 3.0;
    this.safetyLimiter.ratio.value = 20.0;
    this.safetyLimiter.attack.value = 0.003;
    this.safetyLimiter.release.value = 0.08;
    lastNode.connect(this.safetyLimiter);

    // 8. Output Gain Node (TIDAK PERNAH dibisukan oleh Anti-Feedback)
    this.outputGain = ctx.createGain();
    const effectiveGain = this.isOutputMuted ? 0 : this.currentOutputVolume;
    this.outputGain.gain.value = effectiveGain;
    this.safetyLimiter.connect(this.outputGain);

    // 9. Audio Destination (Speaker fisik)
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
    this.currentPreampDb = preampDb;
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
    if (!this.postAnalyser) return null;
    const buffer = new Uint8Array(this.postAnalyser.frequencyBinCount);
    this.postAnalyser.getByteFrequencyData(buffer);
    return buffer;
  }

  public getPreEqRms(): { level: number; db: number } {
    if (!this.preAnalyser) return { level: 0, db: -60 };
    const buffer = new Float32Array(this.preAnalyser.fftSize);
    try {
      this.preAnalyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sum / buffer.length);
      const db = rms > 0.0001 ? Math.max(-60, Math.round(20 * Math.log10(rms))) : -60;
      const level = Math.min(100, Math.round(rms * 100 * 2.8));
      return { level, db };
    } catch {
      return { level: 0, db: -60 };
    }
  }

  public getPostEqRms(): { level: number; db: number } {
    if (!this.postAnalyser) return { level: 0, db: -60 };
    const buffer = new Float32Array(this.postAnalyser.fftSize);
    try {
      this.postAnalyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sum / buffer.length);
      const db = rms > 0.0001 ? Math.max(-60, Math.round(20 * Math.log10(rms))) : -60;
      const level = Math.min(100, Math.round(rms * 100 * 2.8));
      return { level, db };
    } catch {
      return { level: 0, db: -60 };
    }
  }

  public isClipping(): boolean {
    if (!this.postAnalyser) return false;
    const buffer = new Float32Array(this.postAnalyser.fftSize);
    try {
      this.postAnalyser.getFloatTimeDomainData(buffer);
      for (let i = 0; i < buffer.length; i++) {
        if (Math.abs(buffer[i]) >= 0.98) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public getDiagnostics(): YoutubeEqDiagnostics {
    const audioTrack = this.stream?.getAudioTracks()[0];
    const videoTracks = this.stream?.getVideoTracks() || [];
    const supportedConstraints =
      typeof navigator !== "undefined" && navigator.mediaDevices?.getSupportedConstraints
        ? navigator.mediaDevices.getSupportedConstraints()
        : null;
    const supportsSuppress = Boolean(supportedConstraints && "suppressLocalAudioPlayback" in supportedConstraints);

    let suppressActive = false;
    if (audioTrack && typeof audioTrack.getSettings === "function") {
      try {
        const settings = audioTrack.getSettings();
        if (settings && "suppressLocalAudioPlayback" in settings) {
          suppressActive = Boolean((settings as { suppressLocalAudioPlayback?: boolean }).suppressLocalAudioPlayback);
        } else {
          suppressActive = supportsSuppress;
        }
      } catch {}
    }

    const preRms = this.getPreEqRms();
    const postRms = this.getPostEqRms();
    const clipping = this.isClipping();

    // Feedback loop runaway check
    if (this.feedbackGuardEnabled && clipping && postRms.level > 90 && preRms.level > 85) {
      if (this.currentOutputVolume > 0.8 && this.outputGain && this.ctx) {
        this.currentOutputVolume = 0.8;
        const now = this.ctx.currentTime;
        this.outputGain.gain.cancelScheduledValues(now);
        this.outputGain.gain.setTargetAtTime(0.8, now, 0.05);
        this.feedbackGuardTriggered = true;
      }
    }

    return {
      isConnected: this.isConnected,
      audioContextState: this.ctx ? this.ctx.state : "none",
      sampleRate: this.ctx ? this.ctx.sampleRate : 0,
      hasAudioTrack: Boolean(audioTrack && audioTrack.readyState === "live"),
      audioTrackCount: this.stream ? this.stream.getAudioTracks().length : 0,
      audioTrackLabel: audioTrack?.label || "none",
      audioTrackReadyState: audioTrack?.readyState || "none",
      videoTrackCount: videoTracks.length,
      hasSignal: postRms.level > 2 || preRms.level > 2,
      signalLevel: postRms.level,
      preEqLevel: preRms.level,
      postEqLevel: postRms.level,
      preEqDb: preRms.db,
      postEqDb: postRms.db,
      isClipping: clipping,
      outputGainValue: this.currentOutputVolume,
      isOutputActive: this.isConnected && !this.isOutputMuted && this.currentOutputVolume > 0,
      isOutputMuted: this.isOutputMuted,
      feedbackGuardEnabled: this.feedbackGuardEnabled,
      feedbackGuardTriggered: this.feedbackGuardTriggered,
      suppressLocalPlaybackSupported: supportsSuppress,
      suppressLocalPlaybackActive: suppressActive,
    };
  }

  public disconnect(): void {
    this.cleanUpStreamAndNodes();
    this.isOutputMuted = false;
    this.feedbackGuardTriggered = false;
    if (this.isConnected) {
      this.isConnected = false;
      this.onStateChangeCb?.(false);
    }
  }
}

export const youtubeEqEngineSingleton = new YoutubeEqEngine();
