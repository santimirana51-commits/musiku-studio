import type { ChannelStripSettings, ChannelStripEqBand } from "./types";

export const DEFAULT_CHANNEL_STRIP_SETTINGS: ChannelStripSettings = {
  preGain: 0,
  compressorEnabled: false,
  compressorThreshold: 0,
  driveEnabled: false,
  driveAmount: 0,
  channelsEnabled: false,
  swapChannels: false,
  phaseInvert: false,
  stereoWidth: 1.0,
  mono: false,
  eqEnabled: true,
  eqMode: "3band",
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  parametricHigh: { freq: 8000, gain: 0, mode: "shelf" },
  parametricMid2: { freq: 2500, gain: 0, q: 1.0, mode: "bell" },
  parametricMid1: { freq: 600, gain: 0, q: 1.0, mode: "bell" },
  parametricLow: { freq: 100, gain: 0, mode: "shelf" },
};

/**
 * Konversi decibel ke gain linear
 */
export function dbToLinearGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Konversi gain linear ke decibel
 */
export function linearGainToDb(gain: number): number {
  if (gain <= 0.00001) return -100;
  return 20 * Math.log10(gain);
}

/**
 * Hitung parameter kompresor satu knob Mixcraft 10 (Hlm. 368)
 * - Threshold knob (0 s.d. 100)
 * - Volume terkompensasi otomatis (auto-makeup)
 * - Attack time memendek seiring bertambahnya squashing
 */
export function calculateCompressorParams(thresholdKnob: number): {
  thresholdDb: number;
  ratio: number;
  attackSeconds: number;
  releaseSeconds: number;
  makeupGainLinear: number;
} {
  const norm = Math.max(0, Math.min(100, thresholdKnob)) / 100;
  // Threshold dari 0 dB ke -36 dB
  const thresholdDb = norm === 0 ? 0 : -36 * norm;
  // Ratio meningkat dari 3:1 ke 8:1
  const ratio = 3 + 5 * norm;
  // Attack memendek dari 30ms ke 5ms
  const attackSeconds = 0.03 - 0.025 * norm;
  const releaseSeconds = 0.15;
  // Auto makeup gain kompensasi (hingga +10 dB)
  const makeupGainDb = 10 * Math.pow(norm, 1.2);
  const makeupGainLinear = dbToLinearGain(makeupGainDb);

  return {
    thresholdDb,
    ratio,
    attackSeconds,
    releaseSeconds,
    makeupGainLinear,
  };
}

/**
 * Buat kurva wave-shaper saturasi hangat khas konsol analog (Mixcraft 10 Hlm. 369)
 */
export function createDriveCurve(drivePercent: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const drive = Math.max(0, Math.min(100, drivePercent));
  if (drive === 0) {
    for (let i = 0; i < samples; i++) {
      curve[i] = (i * 2) / samples - 1;
    }
    return curve;
  }

  // Faktor non-linearitas
  const k = (2 * drive) / (101 - drive);
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Sigmoid soft-saturation curve
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * Memastikan konfigurasi channel strip lengkap dengan default jika parsial
 */
export function sanitizeChannelStripSettings(
  partial?: Partial<ChannelStripSettings> | null
): ChannelStripSettings {
  if (!partial) return { ...DEFAULT_CHANNEL_STRIP_SETTINGS };
  return {
    ...DEFAULT_CHANNEL_STRIP_SETTINGS,
    ...partial,
    parametricHigh: {
      ...DEFAULT_CHANNEL_STRIP_SETTINGS.parametricHigh!,
      ...(partial.parametricHigh || {}),
    },
    parametricMid2: {
      ...DEFAULT_CHANNEL_STRIP_SETTINGS.parametricMid2!,
      ...(partial.parametricMid2 || {}),
    },
    parametricMid1: {
      ...DEFAULT_CHANNEL_STRIP_SETTINGS.parametricMid1!,
      ...(partial.parametricMid1 || {}),
    },
    parametricLow: {
      ...DEFAULT_CHANNEL_STRIP_SETTINGS.parametricLow!,
      ...(partial.parametricLow || {}),
    },
  };
}

export interface ChannelStripNodeHandle {
  inputNode: AudioNode;
  outputNode: AudioNode;
  updateSettings: (settings: Partial<ChannelStripSettings>) => void;
  dispose: () => void;
}

/**
 * Membangun rangkaian AudioNode Strip Kanal Mixcraft 10 (Hlm. 367–376):
 * Input -> PreGain (+/-15dB) -> Drive (Waveshaper) -> Compressor -> EQ -> Channels Utility -> Output
 */
export function createChannelStripNodes(
  ctx: BaseAudioContext,
  initialSettings?: Partial<ChannelStripSettings>
): ChannelStripNodeHandle {
  let current = sanitizeChannelStripSettings(initialSettings);

  const inputNode = ctx.createGain();
  const outputNode = ctx.createGain();

  // 1. PreGain Node
  const preGainNode = ctx.createGain();
  preGainNode.gain.value = dbToLinearGain(current.preGain);

  // 2. Drive / Preamp Saturation
  const driveIn = ctx.createGain();
  const driveOut = ctx.createGain();
  const driveDry = ctx.createGain();
  const driveWet = ctx.createGain();
  const waveShaper = ctx.createWaveShaper();
  waveShaper.oversample = "4x";
  waveShaper.curve = createDriveCurve(current.driveAmount);

  driveIn.connect(driveDry);
  driveDry.connect(driveOut);
  driveIn.connect(waveShaper);
  waveShaper.connect(driveWet);
  driveWet.connect(driveOut);

  const syncDriveNodes = (enabled: boolean, amount: number) => {
    waveShaper.curve = createDriveCurve(amount);
    if (!enabled || amount <= 0) {
      driveDry.gain.value = 1.0;
      driveWet.gain.value = 0.0;
    } else {
      const wetRatio = Math.min(1.0, (amount / 100) * 1.2);
      driveWet.gain.value = wetRatio;
      driveDry.gain.value = Math.max(0, 1.0 - wetRatio * 0.7);
    }
  };
  syncDriveNodes(current.driveEnabled, current.driveAmount);

  // 3. Compressor
  const compIn = ctx.createGain();
  const compOut = ctx.createGain();
  const compDry = ctx.createGain();
  const compWet = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  const compMakeup = ctx.createGain();

  compIn.connect(compDry);
  compDry.connect(compOut);
  compIn.connect(compressor);
  compressor.connect(compMakeup);
  compMakeup.connect(compWet);
  compWet.connect(compOut);

  const syncCompressorNodes = (enabled: boolean, thresholdKnob: number) => {
    if (!enabled || thresholdKnob <= 0) {
      compDry.gain.value = 1.0;
      compWet.gain.value = 0.0;
    } else {
      const params = calculateCompressorParams(thresholdKnob);
      compressor.threshold.value = params.thresholdDb;
      compressor.ratio.value = params.ratio;
      compressor.attack.value = params.attackSeconds;
      compressor.release.value = params.releaseSeconds;
      compMakeup.gain.value = params.makeupGainLinear;

      compDry.gain.value = 0.0;
      compWet.gain.value = 1.0;
    }
  };
  syncCompressorNodes(current.compressorEnabled, current.compressorThreshold);

  // 4. EQ Section (3-Band or 4-Band Parametric)
  const eqIn = ctx.createGain();
  const eqOut = ctx.createGain();
  const eqDry = ctx.createGain();
  const eqWet = ctx.createGain();

  // 3-band filters
  const eq3Low = ctx.createBiquadFilter();
  eq3Low.type = "lowshelf";
  eq3Low.frequency.value = 100;
  eq3Low.gain.value = current.eqLow;

  const eq3Mid = ctx.createBiquadFilter();
  eq3Mid.type = "peaking";
  eq3Mid.frequency.value = 1000;
  eq3Mid.Q.value = 1.0;
  eq3Mid.gain.value = current.eqMid;

  const eq3High = ctx.createBiquadFilter();
  eq3High.type = "highshelf";
  eq3High.frequency.value = 8000;
  eq3High.gain.value = current.eqHigh;

  // 4-band parametric filters
  const paramLow = ctx.createBiquadFilter();
  paramLow.type = current.parametricLow?.mode === "bell" ? "peaking" : "lowshelf";
  paramLow.frequency.value = current.parametricLow?.freq ?? 100;
  paramLow.gain.value = current.parametricLow?.gain ?? 0;

  const paramMid1 = ctx.createBiquadFilter();
  paramMid1.type = "peaking";
  paramMid1.frequency.value = current.parametricMid1?.freq ?? 600;
  paramMid1.Q.value = current.parametricMid1?.q ?? 1.0;
  paramMid1.gain.value = current.parametricMid1?.gain ?? 0;

  const paramMid2 = ctx.createBiquadFilter();
  paramMid2.type = "peaking";
  paramMid2.frequency.value = current.parametricMid2?.freq ?? 2500;
  paramMid2.Q.value = current.parametricMid2?.q ?? 1.0;
  paramMid2.gain.value = current.parametricMid2?.gain ?? 0;

  const paramHigh = ctx.createBiquadFilter();
  paramHigh.type = current.parametricHigh?.mode === "bell" ? "peaking" : "highshelf";
  paramHigh.frequency.value = current.parametricHigh?.freq ?? 8000;
  paramHigh.gain.value = current.parametricHigh?.gain ?? 0;

  // Wire 3-band chain
  const eq3ChainIn = ctx.createGain();
  eq3ChainIn.connect(eq3Low);
  eq3Low.connect(eq3Mid);
  eq3Mid.connect(eq3High);
  const eq3ChainOut = eq3High;

  // Wire 4-band parametric chain
  const paramChainIn = ctx.createGain();
  paramChainIn.connect(paramLow);
  paramLow.connect(paramMid1);
  paramMid1.connect(paramMid2);
  paramMid2.connect(paramHigh);
  const paramChainOut = paramHigh;

  eqIn.connect(eqDry);
  eqDry.connect(eqOut);

  const eqModeSwitch = ctx.createGain();
  eqIn.connect(eqModeSwitch);
  eqModeSwitch.connect(eq3ChainIn);
  eq3ChainOut.connect(eqWet);
  paramChainOut.connect(eqWet);
  eqWet.connect(eqOut);

  const syncEqNodes = (st: ChannelStripSettings) => {
    if (!st.eqEnabled) {
      eqDry.gain.value = 1.0;
      eqWet.gain.value = 0.0;
      return;
    }
    eqDry.gain.value = 0.0;
    eqWet.gain.value = 1.0;

    if (st.eqMode === "parametric") {
      // Disconnect eq3, route through parametric
      try {
        eqModeSwitch.disconnect();
        eqModeSwitch.connect(paramChainIn);
      } catch {}

      const pLow = st.parametricLow!;
      paramLow.type = pLow.mode === "bell" ? "peaking" : "lowshelf";
      paramLow.frequency.value = pLow.freq;
      paramLow.gain.value = pLow.gain;

      const pMid1 = st.parametricMid1!;
      paramMid1.frequency.value = pMid1.freq;
      paramMid1.Q.value = pMid1.q ?? 1.0;
      paramMid1.gain.value = pMid1.gain;

      const pMid2 = st.parametricMid2!;
      paramMid2.frequency.value = pMid2.freq;
      paramMid2.Q.value = pMid2.q ?? 1.0;
      paramMid2.gain.value = pMid2.gain;

      const pHigh = st.parametricHigh!;
      paramHigh.type = pHigh.mode === "bell" ? "peaking" : "highshelf";
      paramHigh.frequency.value = pHigh.freq;
      paramHigh.gain.value = pHigh.gain;
    } else {
      // Route through 3-band
      try {
        eqModeSwitch.disconnect();
        eqModeSwitch.connect(eq3ChainIn);
      } catch {}

      eq3Low.gain.value = st.eqLow;
      eq3Mid.gain.value = st.eqMid;
      eq3High.gain.value = st.eqHigh;
    }
  };
  syncEqNodes(current);

  // 5. Channels Utility (Phase Invert, Mono Summing)
  const channelsIn = ctx.createGain();
  const channelsOut = ctx.createGain();
  const phaseGain = ctx.createGain();
  phaseGain.gain.value = current.phaseInvert ? -1.0 : 1.0;

  channelsIn.connect(phaseGain);
  phaseGain.connect(channelsOut);

  // Cascade the entire 5-stage Channel Strip chain:
  // inputNode -> preGainNode -> driveIn -> driveOut -> compIn -> compOut -> eqIn -> eqOut -> channelsIn -> channelsOut -> outputNode
  inputNode.connect(preGainNode);
  preGainNode.connect(driveIn);
  driveOut.connect(compIn);
  compOut.connect(eqIn);
  eqOut.connect(channelsIn);
  channelsOut.connect(outputNode);

  const updateSettings = (updates: Partial<ChannelStripSettings>) => {
    current = sanitizeChannelStripSettings({ ...current, ...updates });

    // Update PreGain
    preGainNode.gain.setTargetAtTime(
      dbToLinearGain(current.preGain),
      ctx.currentTime,
      0.01
    );

    // Update Drive
    syncDriveNodes(current.driveEnabled, current.driveAmount);

    // Update Compressor
    syncCompressorNodes(current.compressorEnabled, current.compressorThreshold);

    // Update EQ
    syncEqNodes(current);

    // Update Phase Invert
    phaseGain.gain.value = current.phaseInvert ? -1.0 : 1.0;
  };

  const dispose = () => {
    try {
      inputNode.disconnect();
      preGainNode.disconnect();
      driveIn.disconnect();
      driveOut.disconnect();
      compIn.disconnect();
      compOut.disconnect();
      eqIn.disconnect();
      eqOut.disconnect();
      channelsIn.disconnect();
      channelsOut.disconnect();
      outputNode.disconnect();
    } catch {}
  };

  return {
    inputNode,
    outputNode,
    updateSettings,
    dispose,
  };
}
