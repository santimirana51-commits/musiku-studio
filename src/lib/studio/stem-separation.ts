import type { StudioClip, StudioProject, StudioTrack } from "./types";
import { createTrack } from "./schema";
import { encodeWavBlob } from "./export";
import { saveAudioBlob } from "./storage";

export type StemType = "vocals" | "drums" | "bass" | "piano" | "other";

export interface StemSeparationOptions {
  models: {
    vocals: boolean;
    drums: boolean;
    bass: boolean;
    piano: boolean;
    other: boolean;
  };
  createSubmixTrack: boolean;
  muteSourceClip: boolean;
  keepSameFormat?: boolean;
  useOriginalAudio?: boolean;
}

export const DEFAULT_STEM_SEPARATION_OPTIONS: StemSeparationOptions = {
  models: {
    vocals: true,
    drums: true,
    bass: true,
    piano: false,
    other: true,
  },
  createSubmixTrack: true,
  muteSourceClip: true,
  keepSameFormat: true,
  useOriginalAudio: false,
};

export interface SeparatedStem {
  type: StemType;
  name: string;
  color: string;
  icon: string;
  buffer: AudioBuffer;
  blob?: Blob;
  assetId: string;
}

/**
 * Creates an AudioBuffer compatible with both browser Web Audio and Node/Vitest environments.
 */
export function createAudioBuffer(
  channels: number,
  length: number,
  sampleRate: number,
  audioCtx?: BaseAudioContext
): AudioBuffer {
  if (audioCtx && typeof audioCtx.createBuffer === "function") {
    try {
      return audioCtx.createBuffer(channels, length, sampleRate);
    } catch {
      // fallback to custom implementation
    }
  }
  if (typeof AudioContext !== "undefined") {
    try {
      const ctx = new AudioContext();
      return ctx.createBuffer(channels, length, sampleRate);
    } catch {
      // fallback
    }
  }

  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    channelData.push(new Float32Array(length));
  }

  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (c: number) => channelData[c],
    copyFromChannel: (dest: Float32Array, channelNumber: number, startInChannel = 0) => {
      const src = channelData[channelNumber];
      if (src) dest.set(src.subarray(startInChannel, startInChannel + dest.length));
    },
    copyToChannel: (src: Float32Array, channelNumber: number, startInChannel = 0) => {
      const dest = channelData[channelNumber];
      if (dest) dest.set(src, startInChannel);
    },
  } as unknown as AudioBuffer;
}

/**
 * High-performance 2nd-order Direct Form II Transposed Biquad Filter.
 */
export class BiquadFilter {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;

  private z1 = 0;
  private z2 = 0;

  public setLowpass(cutoffHz: number, sampleRate: number, q = 0.7071): void {
    const w0 = (2 * Math.PI * Math.min(cutoffHz, sampleRate * 0.49)) / sampleRate;
    const cosW0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);

    const a0 = 1 + alpha;
    this.b0 = (1 - cosW0) / 2 / a0;
    this.b1 = (1 - cosW0) / a0;
    this.b2 = (1 - cosW0) / 2 / a0;
    this.a1 = (-2 * cosW0) / a0;
    this.a2 = (1 - alpha) / a0;
    this.reset();
  }

  public setHighpass(cutoffHz: number, sampleRate: number, q = 0.7071): void {
    const w0 = (2 * Math.PI * Math.min(cutoffHz, sampleRate * 0.49)) / sampleRate;
    const cosW0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);

    const a0 = 1 + alpha;
    this.b0 = (1 + cosW0) / 2 / a0;
    this.b1 = -(1 + cosW0) / a0;
    this.b2 = (1 + cosW0) / 2 / a0;
    this.a1 = (-2 * cosW0) / a0;
    this.a2 = (1 - alpha) / a0;
    this.reset();
  }

  public setBandpass(centerHz: number, sampleRate: number, q = 1.0): void {
    const w0 = (2 * Math.PI * Math.min(centerHz, sampleRate * 0.49)) / sampleRate;
    const cosW0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);

    const a0 = 1 + alpha;
    this.b0 = alpha / a0;
    this.b1 = 0;
    this.b2 = -alpha / a0;
    this.a1 = (-2 * cosW0) / a0;
    this.a2 = (1 - alpha) / a0;
    this.reset();
  }

  public reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }

  public process(sample: number): number {
    const out = this.b0 * sample + this.z1;
    this.z1 = this.b1 * sample - this.a1 * out + this.z2;
    this.z2 = this.b2 * sample - this.a2 * out;
    return out;
  }
}

export interface StemMetadata {
  type: StemType;
  name: string;
  color: string;
  icon: string;
}

export const STEM_METADATA: Record<StemType, StemMetadata> = {
  vocals: {
    type: "vocals",
    name: "Vocals",
    color: "#ec4899", // Pink
    icon: "mic",
  },
  drums: {
    type: "drums",
    name: "Drums",
    color: "#f59e0b", // Amber / Warm Orange
    icon: "drums",
  },
  bass: {
    type: "bass",
    name: "Bass",
    color: "#3b82f6", // Blue
    icon: "bass",
  },
  piano: {
    type: "piano",
    name: "Piano",
    color: "#10b981", // Emerald
    icon: "piano",
  },
  other: {
    type: "other",
    name: "Other Instruments",
    color: "#8b5cf6", // Violet / Purple
    icon: "synth",
  },
};

/**
 * Separates an input AudioBuffer into discrete musical stems using non-destructive DSP source separation:
 * 1. Center/Side mid-side stereo image decomposition
 * 2. Formant bandpass & center isolation for Vocals
 * 3. Transient flux & low-punch envelope extraction for Drums
 * 4. Sub-bass & low frequency harmonic isolation for Bass (< 220 Hz)
 * 5. Sustained stereo harmonic resonance for Piano
 * 6. Residual energy-conservation extraction for Other instruments
 */
export async function separateAudioBufferIntoStems(
  inputBuffer: AudioBuffer,
  options: StemSeparationOptions = DEFAULT_STEM_SEPARATION_OPTIONS,
  onProgress?: (percent: number, message: string) => void
): Promise<SeparatedStem[]> {
  const numChannels = inputBuffer.numberOfChannels;
  const length = inputBuffer.length;
  const sampleRate = inputBuffer.sampleRate;

  onProgress?.(5, "Memindai profil stereo dan spektrum audio...");

  // Extract source channel data
  const inL = inputBuffer.getChannelData(0);
  const inR = numChannels > 1 ? inputBuffer.getChannelData(1) : inL;

  // Selected models
  const wantVocals = options.models.vocals;
  const wantDrums = options.models.drums;
  const wantBass = options.models.bass;
  const wantPiano = options.models.piano;
  const wantOther = options.models.other;

  // Allocate destination Float32Arrays for each active stem
  const outChannels: Partial<Record<StemType, [Float32Array, Float32Array]>> = {};
  if (wantVocals) outChannels.vocals = [new Float32Array(length), new Float32Array(length)];
  if (wantDrums) outChannels.drums = [new Float32Array(length), new Float32Array(length)];
  if (wantBass) outChannels.bass = [new Float32Array(length), new Float32Array(length)];
  if (wantPiano) outChannels.piano = [new Float32Array(length), new Float32Array(length)];
  if (wantOther) outChannels.other = [new Float32Array(length), new Float32Array(length)];

  // Initialize DSP filters
  // Bass: Lowpass 220Hz
  const bassFilterL = new BiquadFilter();
  const bassFilterR = new BiquadFilter();
  bassFilterL.setLowpass(220, sampleRate, 0.7071);
  bassFilterR.setLowpass(220, sampleRate, 0.7071);

  // Vocals: Bandpass 1200Hz (Q=0.7) and Highpass 200Hz
  const vocalBpL = new BiquadFilter();
  const vocalBpR = new BiquadFilter();
  vocalBpL.setBandpass(1200, sampleRate, 0.7);
  vocalBpR.setBandpass(1200, sampleRate, 0.7);

  const vocalHpL = new BiquadFilter();
  const vocalHpR = new BiquadFilter();
  vocalHpL.setHighpass(200, sampleRate, 0.7071);
  vocalHpR.setHighpass(200, sampleRate, 0.7071);

  // Drums: Highpass 5000Hz (for cymbals/snare sizzle) and Lowpass 110Hz (kick punch)
  const drumCymbalHpL = new BiquadFilter();
  const drumCymbalHpR = new BiquadFilter();
  drumCymbalHpL.setHighpass(5000, sampleRate, 0.7071);
  drumCymbalHpR.setHighpass(5000, sampleRate, 0.7071);

  // Piano: Bandpass 600Hz
  const pianoBpL = new BiquadFilter();
  const pianoBpR = new BiquadFilter();
  pianoBpL.setBandpass(600, sampleRate, 1.2);
  pianoBpR.setBandpass(600, sampleRate, 1.2);

  onProgress?.(20, "Mengekstrak pemisahan vokal dan instrumen...");

  // Envelope followers for transient detection (Drums)
  let envFastL = 0;
  let envSlowL = 0;
  let envFastR = 0;
  let envSlowR = 0;
  const alphaFast = Math.exp(-1 / (0.002 * sampleRate)); // 2ms fast attack
  const alphaSlow = Math.exp(-1 / (0.040 * sampleRate)); // 40ms release

  const progressInterval = Math.max(10000, Math.floor(length / 10));

  for (let i = 0; i < length; i++) {
    if (i % progressInterval === 0) {
      const pct = 20 + Math.floor((i / length) * 55);
      onProgress?.(pct, `Memproses sampel audio (${Math.round((i / length) * 100)}%)...`);
    }

    const sL = inL[i];
    const sR = inR[i];

    // Mid / Side decomposition
    const mid = 0.5 * (sL + sR);
    const side = 0.5 * (sL - sR);
    const absMid = Math.abs(mid);
    const absSide = Math.abs(side);

    // Center panning weighting (Vocals are center; guitars/synths are wider)
    const centerFactor = absMid / (absMid + absSide + 1e-5);
    const vocalCenterWeight = Math.min(1, Math.max(0, (centerFactor - 0.4) * 2.2));

    // Transient follower (Drums)
    envFastL = (1 - alphaFast) * Math.abs(sL) + alphaFast * envFastL;
    envSlowL = (1 - alphaSlow) * Math.abs(sL) + alphaSlow * envSlowL;
    envFastR = (1 - alphaFast) * Math.abs(sR) + alphaFast * envFastR;
    envSlowR = (1 - alphaSlow) * Math.abs(sR) + alphaSlow * envSlowR;

    const transientRatioL = Math.max(0, (envFastL - envSlowL) / (envSlowL + 1e-4));
    const transientRatioR = Math.max(0, (envFastR - envSlowR) / (envSlowR + 1e-4));
    const drumTransientWeightL = Math.min(1, Math.max(0, (transientRatioL - 0.25) * 2.0));
    const drumTransientWeightR = Math.min(1, Math.max(0, (transientRatioR - 0.25) * 2.0));

    // 1. Bass Component (< 220Hz)
    const bL = bassFilterL.process(sL);
    const bR = bassFilterR.process(sR);
    const bassWeight = 0.85;
    const bassL = bL * bassWeight;
    const bassR = bR * bassWeight;

    // 2. Drums Component (Transients + Cymbals)
    const cymL = drumCymbalHpL.process(sL);
    const cymR = drumCymbalHpR.process(sR);
    const drumL = sL * drumTransientWeightL * 0.75 + cymL * 0.4;
    const drumR = sR * drumTransientWeightR * 0.75 + cymR * 0.4;

    // 3. Vocals Component (Center Formant band, ducking drum transients)
    const vHpL = vocalHpL.process(mid);
    const vHpR = vocalHpR.process(mid);
    const vBpL = vocalBpL.process(vHpL);
    const vBpR = vocalBpR.process(vHpR);
    const vocalDuckDrum = 1 - Math.max(drumTransientWeightL, drumTransientWeightR) * 0.6;
    const vocL = vBpL * vocalCenterWeight * vocalDuckDrum * 1.25;
    const vocR = vBpR * vocalCenterWeight * vocalDuckDrum * 1.25;

    // 4. Piano Component (Sustained melodic mid-range)
    const pL = pianoBpL.process(sL) * (1 - vocalCenterWeight * 0.7) * (1 - drumTransientWeightL * 0.8) * 0.65;
    const pR = pianoBpR.process(sR) * (1 - vocalCenterWeight * 0.7) * (1 - drumTransientWeightR * 0.8) * 0.65;

    // Assign to active stems
    let accountedL = 0;
    let accountedR = 0;

    if (wantBass && outChannels.bass) {
      outChannels.bass[0][i] = bassL;
      outChannels.bass[1][i] = bassR;
      accountedL += bassL;
      accountedR += bassR;
    }

    if (wantDrums && outChannels.drums) {
      outChannels.drums[0][i] = drumL;
      outChannels.drums[1][i] = drumR;
      accountedL += drumL;
      accountedR += drumR;
    }

    if (wantVocals && outChannels.vocals) {
      outChannels.vocals[0][i] = vocL;
      outChannels.vocals[1][i] = vocR;
      accountedL += vocL;
      accountedR += vocR;
    }

    if (wantPiano && outChannels.piano) {
      outChannels.piano[0][i] = pL;
      outChannels.piano[1][i] = pR;
      accountedL += pL;
      accountedR += pR;
    }

    // 5. Other Instruments / Residual (Energy Conservation)
    if (wantOther && outChannels.other) {
      const resL = sL - accountedL;
      const resR = sR - accountedR;
      outChannels.other[0][i] = resL;
      outChannels.other[1][i] = resR;
    }
  }

  onProgress?.(80, "Mengkodekan berkas WAV dan menyusun trek instrumen...");

  // Build SeparatedStem objects
  const stems: SeparatedStem[] = [];
  const stemTypes: StemType[] = ["vocals", "drums", "bass", "piano", "other"];

  for (const type of stemTypes) {
    const ch = outChannels[type];
    if (!ch) continue;

    const meta = STEM_METADATA[type];
    const stemBuf = createAudioBuffer(numChannels, length, sampleRate);
    stemBuf.getChannelData(0).set(ch[0]);
    if (numChannels > 1) {
      stemBuf.getChannelData(1).set(ch[1]);
    }

    const wavBlob = encodeWavBlob(stemBuf, 16, false);
    const assetId = `asset_stem_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    stems.push({
      type,
      name: meta.name,
      color: meta.color,
      icon: meta.icon,
      buffer: stemBuf,
      blob: wavBlob,
      assetId,
    });
  }

  onProgress?.(100, "Pemisahan stem selesai!");
  return stems;
}

export interface CreateStemSeparationTracksResult {
  project: StudioProject;
  createdTrackIds: string[];
  submixTrackId?: string;
}

/**
 * Creates stems tracks and clips in the project model according to Mixcraft 10 Hlm. 650:
 * - If `createSubmixTrack` is true, generates a parent Submix track and child tracks routed into it.
 * - If `muteSourceClip` is true, mutes the source clip so only the separated stems sound.
 */
export function createStemSeparationTracks(
  project: StudioProject,
  sourceTrackId: string,
  sourceClipId: string,
  stems: SeparatedStem[],
  options: StemSeparationOptions = DEFAULT_STEM_SEPARATION_OPTIONS
): CreateStemSeparationTracksResult {
  const updated: StudioProject = JSON.parse(JSON.stringify(project));
  const createdTrackIds: string[] = [];

  const sourceTrackIndex = updated.tracks.findIndex((t) => t.id === sourceTrackId);
  if (sourceTrackIndex === -1) {
    throw new Error(`Track sumber ${sourceTrackId} tidak ditemukan.`);
  }

  const sourceTrack = updated.tracks[sourceTrackIndex];
  const sourceClip = sourceTrack.clips.find((c) => c.id === sourceClipId);
  if (!sourceClip) {
    throw new Error(`Klip sumber ${sourceClipId} tidak ditemukan pada track ${sourceTrackId}.`);
  }

  // Mute source clip if requested
  if (options.muteSourceClip) {
    sourceClip.muted = true;
  }

  let submixTrackId: string | undefined;
  const insertIndex = sourceTrackIndex + 1;
  const newTracks: StudioTrack[] = [];

  // Register assets in assetManifest
  if (!updated.assetManifest) {
    updated.assetManifest = {};
  }
  for (const stem of stems) {
    if (stem.blob) {
      updated.assetManifest[stem.assetId] = {
        id: stem.assetId,
        name: `${sourceClip.name} - ${stem.name}`,
        mimeType: "audio/wav",
        sizeBytes: stem.blob.size,
        durationSeconds: stem.buffer.duration,
        sampleRate: stem.buffer.sampleRate,
        channels: stem.buffer.numberOfChannels,
      };
    }
  }

  if (options.createSubmixTrack) {
    // Mixcraft 10 Hlm. 650: Creates a new submix track and child tracks for each stem
    const submixTrack = createTrack(
      "submix",
      `Submix: ${sourceClip.name} Stems`,
      updated.tracks.length + 1,
      "submix"
    );
    submixTrack.color = "#06b6d4"; // Cyan
    submixTrackId = submixTrack.id;
    newTracks.push(submixTrack);
    createdTrackIds.push(submixTrack.id);
  }

  // Create child audio track for each stem
  for (let i = 0; i < stems.length; i++) {
    const stem = stems[i];
    const trackName = `${sourceClip.name} - ${stem.name}`;
    const stemTrack = createTrack(
      "audio",
      trackName,
      updated.tracks.length + i + (options.createSubmixTrack ? 2 : 1),
      stem.icon
    );
    stemTrack.color = stem.color;

    if (options.createSubmixTrack && submixTrackId) {
      stemTrack.submixTrackId = submixTrackId;
    }

    // Place matching AudioClip on the track
    const stemClip: StudioClip = {
      id: `clip_stem_${stem.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      trackId: stemTrack.id,
      type: "audio",
      name: `${sourceClip.name} (${stem.name})`,
      color: stem.color,
      startBeat: sourceClip.startBeat,
      durationBeats: sourceClip.durationBeats,
      offsetBeat: sourceClip.offsetBeat,
      gain: 1.0,
      fadeInBeats: sourceClip.fadeInBeats,
      fadeOutBeats: sourceClip.fadeOutBeats,
      pitchShiftSemitones: sourceClip.pitchShiftSemitones,
      reversed: sourceClip.reversed,
      laneIndex: 0,
      muted: false,
      assetId: stem.assetId,
    };

    stemTrack.clips.push(stemClip);
    newTracks.push(stemTrack);
    createdTrackIds.push(stemTrack.id);
  }

  // Insert newly created tracks into project.tracks immediately below source track
  updated.tracks.splice(insertIndex, 0, ...newTracks);

  return {
    project: updated,
    createdTrackIds,
    submixTrackId,
  };
}

/**
 * Persists all separated stem blobs to IndexedDB storage.
 */
export async function saveSeparatedStemsToStorage(stems: SeparatedStem[]): Promise<void> {
  for (const stem of stems) {
    if (stem.blob) {
      await saveAudioBlob(stem.assetId, stem.blob);
    }
  }
}
