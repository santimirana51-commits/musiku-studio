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
      this.outputGain.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
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

    // Buat AudioContext sinkron di awal agar izin gestur klik pengguna (User Activation) aktif
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {}
    }

    try {
      let stream: MediaStream;
      const audioConstraints = {
        suppressLocalAudioPlayback: true,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      } as MediaTrackConstraints;

      try {
        // suppressLocalAudioPlayback: true adalah kunci mutlak untuk mencegah gema/echo!
        // Constraint resmi W3C ini memerintahkan browser untuk membisukan audio lokal bawaan tab,
        // sehingga pengguna HANYA mendengar satu aliran audio yang sudah difilter oleh Equalizer 10-Band.
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: audioConstraints,
          preferCurrentTab: true,
          selfBrowserSurface: "include",
          systemAudio: "include",
        } as MediaStreamConstraints & { preferCurrentTab?: boolean; selfBrowserSurface?: string; systemAudio?: string });
      } catch (err: unknown) {
        const e = err as { name?: string };
        if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
          try { void ctx.close(); } catch {}
          throw err;
        }
        try {
          // Fallback untuk browser yang menolak constraint Chromium-spesifik
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: audioConstraints,
          });
        } catch (fallbackErr) {
          try { void ctx.close(); } catch {}
          throw fallbackErr;
        }
      }

      // Hentikan trek video segera agar tidak membebani CPU dan RAM karena kita hanya membutuhkan audio
      stream.getVideoTracks().forEach((vt) => {
        try {
          vt.stop();
        } catch {}
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        try { void ctx.close(); } catch {}
        throw new Error(
          "Tidak ada trek audio yang terdeteksi. Pastikan mencentang pilihan 'Bagikan audio tab' (Also share tab audio) saat memilih tab."
        );
      }

      // Terapkan suppressLocalAudioPlayback langsung ke track jika didukung oleh browser
      try {
        if (typeof audioTracks[0].applyConstraints === "function") {
          // @ts-expect-error Chromium specific constraint
          await audioTracks[0].applyConstraints({ suppressLocalAudioPlayback: true });
        }
      } catch {}

      this.disconnect();
      this.ctx = ctx;
      if (this.ctx.state === "suspended") {
        try {
          await this.ctx.resume();
        } catch {}
      }

      this.stream = stream;
      this.sourceNode = this.ctx.createMediaStreamSource(stream);

      // Preamp Gain Node
      this.preampGain = this.ctx.createGain();
      this.preampGain.gain.value = Math.pow(10, preampDb / 20);

      // Analyser Node for Visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      // Output Gain Node (untuk kontrol anti-gema & volume hasil filter)
      this.outputGain = this.ctx.createGain();
      this.outputGain.gain.value = this.isOutputMuted ? 0 : 1.0;

      // 10-Band Biquad Filters (peaking EQ)
      this.filters = YOUTUBE_EQ_10_BANDS.map((band, i) => {
        const filter = this.ctx!.createBiquadFilter();
        filter.type = i === 0 ? "lowshelf" : i === YOUTUBE_EQ_10_BANDS.length - 1 ? "highshelf" : "peaking";
        filter.frequency.value = band.freq;
        filter.Q.value = 1.4;
        filter.gain.value = initialGains[i] ?? 0;
        return filter;
      });

      // Chain audio: Source -> Preamp -> Filter 0 -> Filter 1 ... -> Filter 9 -> Analyser -> OutputGain -> Destination
      let lastNode: AudioNode = this.sourceNode;
      lastNode.connect(this.preampGain);
      lastNode = this.preampGain;

      for (const filter of this.filters) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(this.analyser);
      this.analyser.connect(this.outputGain);
      this.outputGain.connect(this.ctx.destination);

      audioTracks[0].onended = () => {
        this.disconnect();
      };

      this.isConnected = true;
      this.onStateChangeCb?.(true);
      return true;
    } catch (err) {
      this.disconnect();
      throw err;
    }
  }

  public updateGains(gains: number[], enabled = true): void {
    void applyNativeGains(gains, enabled);
    if (!this.ctx || this.filters.length === 0) return;
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    for (let i = 0; i < this.filters.length; i++) {
      const targetGain = enabled ? (gains[i] ?? 0) : 0;
      this.filters[i].gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
  }

  public updatePreamp(preampDb: number): void {
    if (!this.ctx || !this.preampGain) return;
    const gainVal = Math.pow(10, preampDb / 20);
    this.preampGain.gain.setTargetAtTime(gainVal, this.ctx.currentTime, 0.05);
  }

  public getVisualizerData(): Uint8Array | null {
    if (!this.analyser) return null;
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buffer);
    return buffer;
  }

  public disconnect(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {}
      this.ctx = null;
    }
    this.sourceNode = null;
    this.preampGain = null;
    this.filters = [];
    this.analyser = null;
    this.outputGain = null;
    if (this.isConnected) {
      this.isConnected = false;
      this.onStateChangeCb?.(false);
    }
  }
}

export const youtubeEqEngineSingleton = new YoutubeEqEngine();
