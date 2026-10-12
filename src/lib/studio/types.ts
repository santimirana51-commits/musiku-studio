export type TrackType = "audio" | "midi" | "video" | "video-text" | "submix" | "send" | "output" | "vocoder";
export type ClipType = "audio" | "midi" | "video" | "video-text";
export type WaveformType = "sine" | "square" | "sawtooth" | "triangle";
export type AutomationInterpolation = "linear" | "step" | "curve";

export interface MidiNote {
  id: string;
  pitch: number; // 0-127 (e.g. 60 = C4)
  startBeat: number; // Musikal (e.g. 0.0, 1.25)
  durationBeats: number; // Duration in beats (e.g. 1.0, 0.5)
  velocity: number; // 1-127
}

export interface AutomationPoint {
  beat: number;
  value: number; // Normalized 0.0 to 1.0 or explicit parameter range
  curve?: number; // Optional curvature (-1 to 1)
}

export interface AutomationLane {
  id: string;
  target: "volume" | "pan" | "cutoff" | "resonance" | "reverb" | "delay" | "plugin_param";
  parameterId?: string; // If targeting a plugin parameter
  name: string;
  enabled: boolean;
  points: AutomationPoint[];
}

export interface PluginParameterDef {
  id: string;
  name: string;
  min: number;
  max: number;
  defaultValue: number;
  unit?: string;
  step?: number;
}

export interface PluginInstance {
  id: string;
  pluginId: string; // e.g., "internal.eq3", "internal.compressor", "vst3.fabfilter.pro-q"
  name: string;
  enabled: boolean;
  isNativeVst3?: boolean;
  vst3Path?: string;
  parameters: Record<string, number>;
}

export interface StudioClip {
  id: string;
  trackId: string;
  type: ClipType;
  name: string;
  color?: string;
  startBeat: number; // Timeline position in beats
  durationBeats: number; // Clip length in beats
  offsetBeat: number; // Start offset within the source asset
  gain: number; // Linear gain (default 1.0)
  fadeInBeats?: number;
  fadeOutBeats?: number;
  pitchShiftSemitones?: number; // Transposition in semitones (-24 to +24, Mixcraft 10 Hlm. 222)
  reversed?: boolean; // Reverse playback flag (Mixcraft 10 Hlm. 221)
  // Mixcraft Lanes & Muting
  laneIndex?: number; // 0-indexed sub-lane within the track (default 0)
  muted?: boolean; // Clip-specific mute state (used by Takes mode, lane muting, or clip mute)
  // Audio specific
  assetId?: string; // Reference to AssetManifest key
  // MIDI specific
  notes?: MidiNote[];
  // Video / Text specific
  videoUrl?: string;
  textOverlay?: string;
}

export interface SynthSettings {
  waveform: WaveformType;
  attack: number; // Seconds (0.001 - 2.0)
  decay: number; // Seconds (0.01 - 2.0)
  sustain: number; // Level (0.0 - 1.0)
  release: number; // Seconds (0.01 - 4.0)
  filterCutoff: number; // Hz (20 - 20000)
  filterResonance: number; // Q (0.1 - 20)
  volume: number; // (0.0 - 1.0)
}

export interface ChannelStripEqBand {
  gain: number; // -15 to +15 dB
  freq: number; // Hz
  q?: number; // bandwidth / Q factor (0.5 to 3.0)
  mode?: "bell" | "shelf";
}

export interface ChannelStripSettings {
  preGain: number; // Initial gain +/- 15 dB
  compressorEnabled: boolean;
  compressorThreshold: number; // 0 (off) to 100 (maximum squashing)
  driveEnabled: boolean;
  driveAmount: number; // 0 to 100 (%)
  channelsEnabled?: boolean;
  swapChannels?: boolean;
  phaseInvert?: boolean;
  stereoWidth?: number; // 0.0 (mono) to 1.0 (full stereo)
  mono?: boolean;
  eqEnabled: boolean;
  eqMode?: "3band" | "parametric";
  eqLow: number; // -15 to +15 dB
  eqMid: number; // -15 to +15 dB
  eqHigh: number; // -15 to +15 dB
  parametricHigh?: ChannelStripEqBand;
  parametricMid2?: ChannelStripEqBand;
  parametricMid1?: ChannelStripEqBand;
  parametricLow?: ChannelStripEqBand;
}

export interface StudioTrack {
  id: string;
  type: TrackType;
  name: string;
  color: string;
  icon?: string; // e.g. "mic", "piano", "guitar", "drums", "synth", "bass", "strings", "brass", "video", "text", "submix", "send", or custom image URL
  height?: number; // Vertical height in px (e.g. 64, 96, 144, 192, default 96)
  mute: boolean;
  solo: boolean;
  armRecord: boolean;
  isFrozen?: boolean; // Whether track is frozen to save CPU resources
  frozenAssetId?: string; // Asset manifest key for pre-rendered frozen audio WAV
  submixTrackId?: string; // For tracks nested inside a Submix track
  linkGroupId?: string; // Mixcraft Link Group ID (gangs volume, pan, mute, solo, and sends)
  monitoringEnabled?: boolean; // Live input monitoring toggle
  midiChannel?: number; // 0 = Omni / All Channels, 1-16 = specific MIDI channel
  midiInputDeviceId?: string; // e.g. "all", "mtk", "usb_keyboard", "drum_pad", "midi_guitar", "ewi"
  autoQuantize?: string; // "off" | "1/4" | "1/8" | "1/16" | "1/32" | "1/8T" | "1/16T"
  snapNotesToScale?: boolean; // Snap incoming notes to key signature & scale
  instrumentName?: string; // Virtual instrument display name (Mixcraft 10.5 Instrument Quick Access)
  customImageUrl?: string; // Custom uploaded image URL or Data URL
  recordingMode?: "takes" | "overdub" | "replace"; // Mixcraft recording mode: Takes, Overdub, Replace
  laneCount?: number; // Number of clip lanes available on this track (default 1)
  mutedLaneIndices?: number[]; // List of lane indices currently muted on this track
  armForPerformancePanel?: boolean; // Readies Performance Panel slots for direct recording
  isTunerActive?: boolean; // Built-in Guitar Tuner display toggle
  inputChannelMode?: "stereo" | "mono-left" | "mono-right"; // Hardware input channel select
  audioDeviceId?: string; // Hardware audio device identifier
  volume: number; // Gain linear (1.0 = 0dB, up to 2.0 = 200% / +6dB)
  pan: number; // -1.0 (L) to +1.0 (R)
  sends?: Record<string, number>; // Aux sends (e.g. { reverb: 0.2, delay: 0.15 })
  outputBus?: string; // e.g. "master" or bus ID (defaults to "master")
  inputSource?: string; // e.g. "all", "input_1", "input_2", device ID, or MIDI channel
  synthSettings?: SynthSettings; // For MIDI tracks
  channelStrip?: ChannelStripSettings; // Mixcraft 10 Channel Strip (Preamp, Comp, EQ, Channels)
  performanceClips?: (StudioClip | null)[]; // Mixcraft 10 Performance Panel slot clips
  plugins: PluginInstance[];
  automationLanes: AutomationLane[];
  clips: StudioClip[];
}

export type AudioDriverType = "wavert" | "wave" | "asio";

export interface PerformanceSet {
  id: string;
  name: string; // e.g. "Set 1", "Verse", "Chorus"
  color?: string;
}

export type PerformanceCueQuantize = "instant" | "1/4" | "1/2" | "1" | "2" | "4";

export interface SubgroupBus {
  id: string; // e.g. "bus_drums", "bus_vocals", "bus_1"
  name: string;
  color: string;
  volume: number; // Gain linear (1.0 = 0dB)
  pan: number; // -1.0 (L) to +1.0 (R)
  mute: boolean;
  solo: boolean;
  plugins: PluginInstance[];
}

export interface MasterTrack {
  volume: number; // Gain linear (1.0 = 0dB)
  pan: number; // 0.0
  limiterThreshold: number; // dB, default -0.3
  limiterRelease: number; // seconds, default 0.05
  plugins: PluginInstance[];
}

export interface AudioAssetMeta {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  checksum?: string;
  blobRef?: string; // IndexedDB blob key or storage path
}

export interface LoopRange {
  enabled: boolean;
  startBeat: number;
  endBeat: number;
}

export interface PunchRange {
  enabled: boolean;
  startBeat: number;
  endBeat: number;
}

export interface StudioMarker {
  id: string;
  name: string;
  beat: number;
  color?: string;
  tempo?: number; // Mixcraft 10 Hlm. 479 - Tempo change marker
  timeSignature?: [number, number]; // Mixcraft 10 Hlm. 115 - Time signature change marker
  keySignature?: string; // Mixcraft 10 Hlm. 526 - Key signature change
}

export interface StudioLyricsLine {
  timeSec: number;
  text: string;
}

export interface StudioLyricsData {
  title?: string;
  artist?: string;
  lrcRaw?: string;
  offsetSec?: number;
  lines: StudioLyricsLine[];
}

export interface TrackRegion {
  id: string;
  name: string; // e.g. "Intro", "Verse 1", "Chorus", "Verse 2", "Solo", "Bridge", "Outro"
  startBeat: number;
  endBeat: number;
  color?: string;
  submixId?: string;
}

export interface StudioProject {
  id: string;
  schemaVersion: "1.0.0";
  name: string;
  tempo: number; // BPM (20 - 300)
  timeSignature: [number, number]; // [numerator, denominator], e.g. [4, 4]
  sampleRate: number; // 44100 or 48000
  loopRange: LoopRange;
  punchRange?: PunchRange;
  markers: StudioMarker[];
  regions?: TrackRegion[]; // Mixcraft 10 Hlm. 199 - Track Regions song arranger
  performanceSets?: PerformanceSet[]; // Mixcraft 10 Hlm. 411 - Performance Panel Sets
  isPerformanceSolo?: boolean; // Mutes timeline clips during performance playback (Hlm. 414)
  isPerformanceArmed?: boolean; // Records triggered set clips onto main timeline grid (Hlm. 414)
  performanceCue?: PerformanceCueQuantize; // Quantized switch latency (Hlm. 414-415)
  tracks: StudioTrack[];
  buses?: SubgroupBus[];
  masterTrack: MasterTrack;
  assetManifest: Record<string, AudioAssetMeta>;
  lyrics?: StudioLyricsData;
  createdAt: string;
  updatedAt: string;
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  groupId?: string;
}

export interface TransportState {
  playing: boolean;
  recording: boolean;
  currentBeat: number;
  currentTimeSeconds: number;
  tempo: number;
  timeSignature: [number, number];
  loop: LoopRange;
  punch?: PunchRange;
  metronome: boolean;
}

export interface Vst3PluginDescriptor {
  uid: string;
  name: string;
  vendor: string;
  version: string;
  category: "effect" | "instrument" | "unknown";
  path: string;
  audioInputs: number;
  audioOutputs: number;
  parametersCount: number;
  isAvailableOnPlatform: boolean;
}
