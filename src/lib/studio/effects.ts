import type { PluginInstance, PluginParameterDef } from "./types";

export interface EffectPluginMetadata {
  id: string;
  name: string;
  category: "eq" | "dynamics" | "delay" | "reverb" | "filter" | "distortion" | "modulation" | "utility";
  parameters: PluginParameterDef[];
}

export const INTERNAL_EFFECTS_CATALOG: EffectPluginMetadata[] = [
  {
    id: "internal.eq3",
    name: "3-Band Parametric EQ",
    category: "eq",
    parameters: [
      { id: "lowGain", name: "Low (100Hz)", min: -18, max: 18, defaultValue: 0, unit: "dB" },
      { id: "midGain", name: "Mid (1kHz)", min: -18, max: 18, defaultValue: 0, unit: "dB" },
      { id: "highGain", name: "High (8kHz)", min: -18, max: 18, defaultValue: 0, unit: "dB" },
    ],
  },
  {
    id: "internal.compressor",
    name: "Studio Compressor",
    category: "dynamics",
    parameters: [
      { id: "threshold", name: "Threshold", min: -60, max: 0, defaultValue: -18, unit: "dB" },
      { id: "ratio", name: "Ratio", min: 1, max: 20, defaultValue: 4, unit: ":1" },
      { id: "attack", name: "Attack", min: 0.001, max: 0.5, defaultValue: 0.02, unit: "s" },
      { id: "release", name: "Release", min: 0.01, max: 1.0, defaultValue: 0.2, unit: "s" },
    ],
  },
  {
    id: "internal.limiter",
    name: "Brickwall Limiter",
    category: "dynamics",
    parameters: [
      { id: "threshold", name: "Threshold", min: -12, max: 0, defaultValue: -0.3, unit: "dB" },
      { id: "release", name: "Release", min: 0.01, max: 0.3, defaultValue: 0.05, unit: "s" },
    ],
  },
  {
    id: "internal.noisegate",
    name: "Studio Noise Gate",
    category: "dynamics",
    parameters: [
      { id: "threshold", name: "Gate Threshold", min: -80, max: 0, defaultValue: -45, unit: "dB" },
      { id: "reduction", name: "Floor Reduction", min: -80, max: 0, defaultValue: -60, unit: "dB" },
      { id: "attack", name: "Attack Time", min: 0.001, max: 0.1, defaultValue: 0.01, unit: "s" },
      { id: "release", name: "Release Time", min: 0.01, max: 0.5, defaultValue: 0.1, unit: "s" },
    ],
  },
  {
    id: "internal.reverb",
    name: "Studio Reverb",
    category: "reverb",
    parameters: [
      { id: "decay", name: "Decay Time", min: 0.1, max: 5.0, defaultValue: 1.8, unit: "s" },
      { id: "mix", name: "Dry/Wet Mix", min: 0, max: 1, defaultValue: 0.25, unit: "%" },
    ],
  },
  {
    id: "internal.delay",
    name: "Stereo Feedback Delay",
    category: "delay",
    parameters: [
      { id: "time", name: "Delay Time", min: 0.05, max: 1.0, defaultValue: 0.35, unit: "s" },
      { id: "feedback", name: "Feedback", min: 0.0, max: 0.85, defaultValue: 0.4, unit: "%" },
      { id: "mix", name: "Dry/Wet Mix", min: 0, max: 1, defaultValue: 0.3, unit: "%" },
    ],
  },
  {
    id: "internal.filter",
    name: "Resonant Filter",
    category: "filter",
    parameters: [
      { id: "cutoff", name: "Cutoff Freq", min: 20, max: 20000, defaultValue: 1200, unit: "Hz" },
      { id: "resonance", name: "Resonance (Q)", min: 0.1, max: 18, defaultValue: 2.0, unit: "Q" },
      { id: "type", name: "Type (0=LP,1=HP,2=BP)", min: 0, max: 2, defaultValue: 0, step: 1 },
    ],
  },
  {
    id: "internal.distortion",
    name: "Tube Saturation / Overdrive",
    category: "distortion",
    parameters: [
      { id: "drive", name: "Drive Amount", min: 0, max: 100, defaultValue: 30, unit: "%" },
      { id: "mix", name: "Mix", min: 0, max: 1, defaultValue: 0.5, unit: "%" },
    ],
  },
  {
    id: "internal.chorus",
    name: "Stereo Chorus",
    category: "modulation",
    parameters: [
      { id: "rate", name: "LFO Rate", min: 0.1, max: 8.0, defaultValue: 1.5, unit: "Hz" },
      { id: "depth", name: "Depth", min: 0.001, max: 0.02, defaultValue: 0.005, unit: "s" },
      { id: "mix", name: "Mix", min: 0, max: 1, defaultValue: 0.4, unit: "%" },
    ],
  },
  {
    id: "internal.utility",
    name: "Gain & Pan Utility",
    category: "utility",
    parameters: [
      { id: "gain", name: "Gain", min: 0, max: 2.0, defaultValue: 1.0, unit: "x" },
      { id: "pan", name: "Pan", min: -1.0, max: 1.0, defaultValue: 0.0, unit: "" },
    ],
  },
];

/**
 * Generate synthetic stereo impulse response for convolution reverb
 */
function createReverbImpulse(ctx: BaseAudioContext, decaySeconds: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * Math.max(0.1, decaySeconds)));
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const n = Math.exp(-3 * (t / decaySeconds));
    left[i] = (Math.random() * 2 - 1) * n;
    right[i] = (Math.random() * 2 - 1) * n;
  }
  return impulse;
}

/**
 * Generate soft-clipping sigmoid wave-shaper curve for distortion
 */
function createDistortionCurve(drive: number): Float32Array {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const k = typeof drive === "number" ? Math.max(0, drive) : 30;
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; i++) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export interface EffectChainHandle {
  inputNode: AudioNode;
  outputNode: AudioNode;
  updateParameter: (pluginInstanceId: string, paramId: string, value: number) => void;
  setBypass: (pluginInstanceId: string, bypassed: boolean) => void;
}

/**
 * Membangun rangkaian AudioNode efek untuk sebuah track atau master channel
 */
export function buildEffectChain(
  ctx: BaseAudioContext,
  plugins: PluginInstance[]
): EffectChainHandle {
  const inputNode = ctx.createGain();
  const outputNode = ctx.createGain();

  if (!plugins || plugins.length === 0) {
    inputNode.connect(outputNode);
    return {
      inputNode,
      outputNode,
      updateParameter: () => {},
      setBypass: () => {},
    };
  }

  // Registry node per instance
  const nodeRegistry = new Map<
    string,
    {
      plugin: PluginInstance;
      in: AudioNode;
      out: AudioNode;
      params: Record<string, AudioParam | ((val: number) => void)>;
      bypassGain?: GainNode;
      activeGain?: GainNode;
    }
  >();

  let currentHead: AudioNode = inputNode;

  for (const plug of plugins) {
    const instanceIn = ctx.createGain();
    const instanceOut = ctx.createGain();
    const activeGain = ctx.createGain();
    const bypassGain = ctx.createGain();

    activeGain.gain.value = plug.enabled ? 1.0 : 0.0;
    bypassGain.gain.value = plug.enabled ? 0.0 : 1.0;

    // Direct bypass path
    instanceIn.connect(bypassGain);
    bypassGain.connect(instanceOut);

    const paramMap: Record<string, AudioParam | ((val: number) => void)> = {};

    if (plug.pluginId === "internal.eq3") {
      const low = ctx.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 100;
      low.gain.value = plug.parameters.lowGain ?? 0;

      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1000;
      mid.Q.value = 1.0;
      mid.gain.value = plug.parameters.midGain ?? 0;

      const high = ctx.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = 8000;
      high.gain.value = plug.parameters.highGain ?? 0;

      instanceIn.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(activeGain);
      activeGain.connect(instanceOut);

      paramMap.lowGain = low.gain;
      paramMap.midGain = mid.gain;
      paramMap.highGain = high.gain;
    } else if (plug.pluginId === "internal.compressor") {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = plug.parameters.threshold ?? -18;
      comp.ratio.value = plug.parameters.ratio ?? 4;
      comp.attack.value = plug.parameters.attack ?? 0.02;
      comp.release.value = plug.parameters.release ?? 0.2;

      instanceIn.connect(comp);
      comp.connect(activeGain);
      activeGain.connect(instanceOut);

      paramMap.threshold = comp.threshold;
      paramMap.ratio = comp.ratio;
      paramMap.attack = comp.attack;
      paramMap.release = comp.release;
    } else if (plug.pluginId === "internal.limiter") {
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = plug.parameters.threshold ?? -0.3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = plug.parameters.release ?? 0.05;

      instanceIn.connect(limiter);
      limiter.connect(activeGain);
      activeGain.connect(instanceOut);

      paramMap.threshold = limiter.threshold;
      paramMap.release = limiter.release;
    } else if (plug.pluginId === "internal.noisegate") {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = plug.parameters.threshold ?? -45;
      comp.knee.value = 0;
      comp.ratio.value = 12;
      comp.attack.value = plug.parameters.attack ?? 0.01;
      comp.release.value = plug.parameters.release ?? 0.1;

      instanceIn.connect(comp);
      comp.connect(activeGain);
      activeGain.connect(instanceOut);

      paramMap.threshold = comp.threshold;
      paramMap.attack = comp.attack;
      paramMap.release = comp.release;
    } else if (plug.pluginId === "internal.reverb") {
      const convolver = ctx.createConvolver();
      const decay = plug.parameters.decay ?? 1.8;
      convolver.buffer = createReverbImpulse(ctx, decay);

      const wetGain = ctx.createGain();
      const dryGain = ctx.createGain();
      const mix = plug.parameters.mix ?? 0.25;

      wetGain.gain.value = mix;
      dryGain.gain.value = 1 - mix;

      instanceIn.connect(convolver);
      convolver.connect(wetGain);
      instanceIn.connect(dryGain);

      const blend = ctx.createGain();
      wetGain.connect(blend);
      dryGain.connect(blend);
      blend.connect(activeGain);
      activeGain.connect(instanceOut);

      paramMap.mix = (val: number) => {
        wetGain.gain.value = Math.max(0, Math.min(1, val));
        dryGain.gain.value = 1 - wetGain.gain.value;
      };
      paramMap.decay = (val: number) => {
        convolver.buffer = createReverbImpulse(ctx, val);
      };
    } else if (plug.pluginId === "internal.delay") {
      const delay = ctx.createDelay(2.0);
      delay.delayTime.value = plug.parameters.time ?? 0.35;

      const feedback = ctx.createGain();
      feedback.gain.value = plug.parameters.feedback ?? 0.4;

      const wet = ctx.createGain();
      const dry = ctx.createGain();
      const mix = plug.parameters.mix ?? 0.3;

      wet.gain.value = mix;
      dry.gain.value = 1 - mix;

      instanceIn.connect(dry);
      instanceIn.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);

      const blend = ctx.createGain();
      dry.connect(blend);
      wet.connect(blend);
      blend.connect(activeGain);
      activeGain.connect(instanceOut);

      paramMap.time = delay.delayTime;
      paramMap.feedback = feedback.gain;
      paramMap.mix = (val: number) => {
        wet.gain.value = Math.max(0, Math.min(1, val));
        dry.gain.value = 1 - wet.gain.value;
      };
    } else if (plug.pluginId === "internal.filter") {
      const filter = ctx.createBiquadFilter();
      const typeVal = Math.round(plug.parameters.type ?? 0);
      filter.type = typeVal === 1 ? "highpass" : typeVal === 2 ? "bandpass" : "lowpass";
      filter.frequency.value = plug.parameters.cutoff ?? 1200;
      filter.Q.value = plug.parameters.resonance ?? 2.0;

      instanceIn.connect(filter);
      filter.connect(activeGain);
      activeGain.connect(instanceOut);

      paramMap.cutoff = filter.frequency;
      paramMap.resonance = filter.Q;
      paramMap.type = (val: number) => {
        const t = Math.round(val);
        filter.type = t === 1 ? "highpass" : t === 2 ? "bandpass" : "lowpass";
      };
    } else if (plug.pluginId === "internal.distortion") {
      const shaper = ctx.createWaveShaper();
      const drive = plug.parameters.drive ?? 30;
      shaper.curve = createDistortionCurve(drive) as any;
      shaper.oversample = "4x";

      const wet = ctx.createGain();
      const dry = ctx.createGain();
      const mix = plug.parameters.mix ?? 0.5;

      wet.gain.value = mix;
      dry.gain.value = 1 - mix;

      instanceIn.connect(dry);
      instanceIn.connect(shaper);
      shaper.connect(wet);

      const blend = ctx.createGain();
      dry.connect(blend);
      wet.connect(blend);
      blend.connect(activeGain);
      activeGain.connect(instanceOut);

      paramMap.drive = (val: number) => {
        shaper.curve = createDistortionCurve(val) as any;
      };
      paramMap.mix = (val: number) => {
        wet.gain.value = Math.max(0, Math.min(1, val));
        dry.gain.value = 1 - wet.gain.value;
      };
    } else if (plug.pluginId === "internal.chorus") {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = plug.parameters.depth ?? 0.005;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = plug.parameters.rate ?? 1.5;

      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.002;

      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();

      const wet = ctx.createGain();
      const dry = ctx.createGain();
      const mix = plug.parameters.mix ?? 0.4;
      wet.gain.value = mix;
      dry.gain.value = 1 - mix;

      instanceIn.connect(dry);
      instanceIn.connect(delay);
      delay.connect(wet);

      const blend = ctx.createGain();
      dry.connect(blend);
      wet.connect(blend);
      blend.connect(activeGain);
      activeGain.connect(instanceOut);

      paramMap.rate = lfo.frequency;
      paramMap.depth = delay.delayTime;
      paramMap.mix = (val: number) => {
        wet.gain.value = Math.max(0, Math.min(1, val));
        dry.gain.value = 1 - wet.gain.value;
      };
    } else if (plug.pluginId === "internal.utility") {
      const utilGain = ctx.createGain();
      utilGain.gain.value = plug.parameters.gain ?? 1.0;

      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = plug.parameters.pan ?? 0.0;
        instanceIn.connect(utilGain);
        utilGain.connect(panner);
        panner.connect(activeGain);
        paramMap.pan = panner.pan;
      } else {
        instanceIn.connect(utilGain);
        utilGain.connect(activeGain);
      }
      activeGain.connect(instanceOut);

      paramMap.gain = utilGain.gain;
    } else {
      // Fallback pass-through for unsupported or external native VST3 plugins on web
      instanceIn.connect(activeGain);
      activeGain.connect(instanceOut);
    }

    currentHead.connect(instanceIn);
    currentHead = instanceOut;

    nodeRegistry.set(plug.id, {
      plugin: plug,
      in: instanceIn,
      out: instanceOut,
      params: paramMap,
      activeGain,
      bypassGain,
    });
  }

  currentHead.connect(outputNode);

  return {
    inputNode,
    outputNode,
    updateParameter: (instanceId, paramId, value) => {
      const reg = nodeRegistry.get(instanceId);
      if (!reg) return;
      const setter = reg.params[paramId];
      if (typeof setter === "function") {
        setter(value);
      } else if (setter && typeof setter === "object" && "value" in setter) {
        (setter as { value: number }).value = value;
      }
      reg.plugin.parameters[paramId] = value;
    },
    setBypass: (instanceId, bypassed) => {
      const reg = nodeRegistry.get(instanceId);
      if (!reg || !reg.activeGain || !reg.bypassGain) return;
      reg.activeGain.gain.value = bypassed ? 0.0 : 1.0;
      reg.bypassGain.gain.value = bypassed ? 1.0 : 0.0;
      reg.plugin.enabled = !bypassed;
    },
  };
}
