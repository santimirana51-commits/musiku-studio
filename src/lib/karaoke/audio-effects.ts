// Rantai efek vokal lokal: mic -> EQ 10-band -> echo -> reverb -> monitor.
//
// HANYA untuk sinyal mikrofon milik pengguna (MediaStream dari getUserMedia).
// TIDAK menyentuh audio YouTube iframe (cross-origin, mustahil secara teknis
// dan dilarang kebijakan). Tidak ada perekaman/upload di sini.

import { EQ_BANDS, clampDb } from "./equalizer";

export interface FxParams {
  gains: number[]; // dB per band
  echo: number; // 0..1 wet mix
  reverb: number; // 0..1 wet mix
  micVolume: number; // 0..1.5 master
  monitor: boolean; // dengar suara sendiri (butuh headphone!)
}

/** Impulse response stereo sintetis untuk reverb (noise decay eksponensial). */
export function makeImpulse(ctx: AudioContext, seconds = 1.8, decay = 3): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp((-decay * i) / len);
    }
  }
  return buf;
}

export class MicEffectsChain {
  private ctx: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private eq: BiquadFilterNode[] = [];
  private echoWet: GainNode | null = null;
  private verbWet: GainNode | null = null;
  private master: GainNode | null = null;
  private monitorGain: GainNode | null = null;
  private running = false;

  constructor(private createCtx: () => AudioContext = () => new AudioContext()) {}

  get isRunning(): boolean {
    return this.running;
  }

  async init(stream: MediaStream, params: FxParams): Promise<void> {
    this.dispose();
    const ctx = this.createCtx();
    this.ctx = ctx;
    const track = <T extends AudioNode>(n: T): T => {
      this.nodes.push(n);
      return n;
    };

    const src = ctx.createMediaStreamSource(stream);
    let head: AudioNode = src;
    // 10 filter peaking seri sesuai preset/gain pengguna.
    for (let i = 0; i < EQ_BANDS.length; i++) {
      const f = ctx.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = EQ_BANDS[i].freq;
      f.Q.value = 1;
      f.gain.value = clampDb(params.gains[i] ?? 0);
      track(f);
      head.connect(f);
      head = f;
      this.eq.push(f);
    }

    // Echo: delay + feedback loop + wet.
    const delay = track(ctx.createDelay(1));
    delay.delayTime.value = 0.27;
    const feedback = track(ctx.createGain());
    feedback.gain.value = 0.35;
    const echoWet = track(ctx.createGain());
    head.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(echoWet);
    this.echoWet = echoWet;

    // Reverb: convolver impulse sintetis + wet.
    const convolver = track(ctx.createConvolver());
    try {
      convolver.buffer = makeImpulse(ctx);
    } catch {}
    const verbWet = track(ctx.createGain());
    head.connect(convolver);
    convolver.connect(verbWet);
    this.verbWet = verbWet;

    // Dry + master + monitor (default putus agar tak feedback).
    const dry = track(ctx.createGain());
    dry.gain.value = 1;
    const master = track(ctx.createGain());
    const monitor = track(ctx.createGain());
    head.connect(dry);
    dry.connect(master);
    echoWet.connect(master);
    verbWet.connect(master);
    master.connect(monitor);
    monitor.connect(ctx.destination);
    this.master = master;
    this.monitorGain = monitor;

    this.applyParams(params);
    try {
      await ctx.resume();
    } catch {}
    this.running = true;
  }

  applyParams(p: FxParams): void {
    for (let i = 0; i < this.eq.length; i++) {
      try {
        this.eq[i].gain.value = clampDb(p.gains[i] ?? 0);
      } catch {}
    }
    try {
      this.echoWet?.gain.setValueAtTime(Math.min(0.9, Math.max(0, p.echo)), this.ctx?.currentTime ?? 0);
      this.verbWet?.gain.setValueAtTime(Math.min(0.9, Math.max(0, p.reverb)), this.ctx?.currentTime ?? 0);
      this.master?.gain.setValueAtTime(Math.min(1.5, Math.max(0, p.micVolume)), this.ctx?.currentTime ?? 0);
      if (this.monitorGain) this.monitorGain.gain.value = p.monitor ? 1 : 0;
    } catch {}
  }

  setBand(i: number, db: number): void {
    try {
      if (this.eq[i]) this.eq[i].gain.value = clampDb(db);
    } catch {}
  }

  /** Putus semua node + tutup context. Idempoten. */
  dispose(): void {
    this.running = false;
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {}
    }
    this.nodes = [];
    this.eq = [];
    this.echoWet = this.verbWet = this.master = this.monitorGain = null;
    try {
      void this.ctx?.close().catch(() => {});
    } catch {}
    this.ctx = null;
  }
}
