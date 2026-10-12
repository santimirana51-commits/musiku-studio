import { z } from "zod";
import type {
  StudioProject,
  StudioTrack,
  StudioClip,
  MidiNote,
  SynthSettings,
  MasterTrack,
  TrackType,
  SubgroupBus,
  ChannelStripSettings,
  ChannelStripEqBand,
  PerformanceSet,
  PerformanceCueQuantize,
} from "./types";
import { DEFAULT_CHANNEL_STRIP_SETTINGS } from "./channel-strip";

export const MidiNoteSchema = z.object({
  id: z.string(),
  pitch: z.number().int().min(0).max(127),
  startBeat: z.number().min(0),
  durationBeats: z.number().positive(),
  velocity: z.number().int().min(1).max(127),
});

export const AutomationPointSchema = z.object({
  beat: z.number().min(0),
  value: z.number(),
  curve: z.number().min(-1).max(1).optional(),
});

export const AutomationLaneSchema = z.object({
  id: z.string(),
  target: z.enum(["volume", "pan", "cutoff", "resonance", "reverb", "delay", "plugin_param"]),
  parameterId: z.string().optional(),
  name: z.string(),
  enabled: z.boolean(),
  points: z.array(AutomationPointSchema),
});

export const PluginInstanceSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  isNativeVst3: z.boolean().optional(),
  vst3Path: z.string().optional(),
  parameters: z.record(z.number()),
});

export const StudioClipSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  type: z.enum(["audio", "midi", "video", "video-text"]),
  name: z.string(),
  color: z.string().optional(),
  startBeat: z.number().min(0),
  durationBeats: z.number().positive(),
  offsetBeat: z.number().min(0).default(0),
  gain: z.number().min(0).default(1),
  fadeInBeats: z.number().min(0).optional(),
  fadeOutBeats: z.number().min(0).optional(),
  pitchShiftSemitones: z.number().int().min(-24).max(24).optional().default(0),
  reversed: z.boolean().optional().default(false),
  laneIndex: z.number().int().min(0).max(32).optional().default(0),
  muted: z.boolean().optional().default(false),
  assetId: z.string().optional(),
  notes: z.array(MidiNoteSchema).optional(),
  videoUrl: z.string().optional(),
  textOverlay: z.string().optional(),
});

export const SynthSettingsSchema = z.object({
  waveform: z.enum(["sine", "square", "sawtooth", "triangle"]),
  attack: z.number().min(0.001).max(5),
  decay: z.number().min(0.01).max(5),
  sustain: z.number().min(0).max(1),
  release: z.number().min(0.01).max(10),
  filterCutoff: z.number().min(20).max(20000),
  filterResonance: z.number().min(0.1).max(30),
  volume: z.number().min(0).max(1),
});

export const ChannelStripEqBandSchema = z.object({
  gain: z.number().min(-15).max(15).default(0),
  freq: z.number().min(20).max(20000),
  q: z.number().min(0.1).max(10).optional().default(1.0),
  mode: z.enum(["bell", "shelf"]).optional().default("shelf"),
});

export const ChannelStripSettingsSchema = z.object({
  preGain: z.number().min(-15).max(15).default(0),
  compressorEnabled: z.boolean().default(false),
  compressorThreshold: z.number().min(0).max(100).default(0),
  driveEnabled: z.boolean().default(false),
  driveAmount: z.number().min(0).max(100).default(0),
  channelsEnabled: z.boolean().optional().default(false),
  swapChannels: z.boolean().optional().default(false),
  phaseInvert: z.boolean().optional().default(false),
  stereoWidth: z.number().min(0).max(1).optional().default(1),
  mono: z.boolean().optional().default(false),
  eqEnabled: z.boolean().default(true),
  eqMode: z.enum(["3band", "parametric"]).default("3band"),
  eqLow: z.number().min(-15).max(15).default(0),
  eqMid: z.number().min(-15).max(15).default(0),
  eqHigh: z.number().min(-15).max(15).default(0),
  parametricHigh: ChannelStripEqBandSchema.optional(),
  parametricMid2: ChannelStripEqBandSchema.optional(),
  parametricMid1: ChannelStripEqBandSchema.optional(),
  parametricLow: ChannelStripEqBandSchema.optional(),
});

export const StudioTrackSchema = z.object({
  id: z.string(),
  type: z.enum(["audio", "midi", "video", "video-text", "submix", "send", "output", "vocoder"]),
  name: z.string(),
  color: z.string(),
  icon: z.string().optional().default("mic"),
  height: z.number().min(48).max(360).optional().default(96),
  mute: z.boolean(),
  solo: z.boolean(),
  armRecord: z.boolean(),
  isFrozen: z.boolean().optional().default(false),
  frozenAssetId: z.string().optional(),
  submixTrackId: z.string().optional(),
  linkGroupId: z.string().optional(),
  monitoringEnabled: z.boolean().optional().default(false),
  midiChannel: z.number().min(0).max(16).optional().default(0),
  midiInputDeviceId: z.string().optional().default("all"),
  autoQuantize: z.string().optional().default("off"),
  snapNotesToScale: z.boolean().optional().default(false),
  instrumentName: z.string().optional(),
  customImageUrl: z.string().optional(),
  recordingMode: z.enum(["takes", "overdub", "replace"]).optional().default("takes"),
  laneCount: z.number().int().min(1).max(32).optional().default(1),
  mutedLaneIndices: z.array(z.number().int()).optional().default([]),
  armForPerformancePanel: z.boolean().optional().default(false),
  isTunerActive: z.boolean().optional().default(false),
  inputChannelMode: z.enum(["stereo", "mono-left", "mono-right"]).optional().default("stereo"),
  audioDeviceId: z.string().optional(),
  volume: z.number().min(0).max(4), // up to +12dB
  pan: z.number().min(-1).max(1),
  sends: z.record(z.string(), z.number()).optional(),
  outputBus: z.string().optional().default("master"),
  inputSource: z.string().optional().default("all"),
  synthSettings: SynthSettingsSchema.optional(),
  channelStrip: ChannelStripSettingsSchema.optional().default(DEFAULT_CHANNEL_STRIP_SETTINGS),
  performanceClips: z.array(StudioClipSchema.nullable()).optional().default([]),
  plugins: z.array(PluginInstanceSchema),
  automationLanes: z.array(AutomationLaneSchema),
  clips: z.array(StudioClipSchema),
});

export const PerformanceSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
});

export const PerformanceCueQuantizeSchema = z.enum(["instant", "1/4", "1/2", "1", "2", "4"]).default("1");

export const SubgroupBusSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().default("#3b82f6"),
  volume: z.number().min(0).max(4).default(1.0),
  pan: z.number().min(-1).max(1).default(0.0),
  mute: z.boolean().default(false),
  solo: z.boolean().default(false),
  plugins: z.array(PluginInstanceSchema).default([]),
});

export const MasterTrackSchema = z.object({
  volume: z.number().min(0).max(4),
  pan: z.number().min(-1).max(1),
  limiterThreshold: z.number().default(-0.3),
  limiterRelease: z.number().default(0.05),
  plugins: z.array(PluginInstanceSchema),
});

export const AudioAssetMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  sampleRate: z.number().int().positive(),
  channels: z.number().int().positive(),
  checksum: z.string().optional(),
  blobRef: z.string().optional(),
});

export const StudioLyricsLineSchema = z.object({
  timeSec: z.number().min(0),
  text: z.string(),
});

export const StudioLyricsDataSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  lrcRaw: z.string().optional(),
  offsetSec: z.number().default(0),
  lines: z.array(StudioLyricsLineSchema).default([]),
});

export const TrackRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  startBeat: z.number().min(0),
  endBeat: z.number().positive(),
  color: z.string().optional(),
  submixId: z.string().optional(),
});

export const StudioProjectSchema = z.object({
  id: z.string(),
  schemaVersion: z.literal("1.0.0"),
  name: z.string().min(1),
  tempo: z.number().min(20).max(320),
  timeSignature: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  sampleRate: z.number().int().positive(),
  loopRange: z.object({
    enabled: z.boolean(),
    startBeat: z.number().min(0),
    endBeat: z.number().positive(),
  }),
  punchRange: z
    .object({
      enabled: z.boolean(),
      startBeat: z.number().min(0),
      endBeat: z.number().positive(),
    })
    .optional(),
  markers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      beat: z.number().min(0),
      color: z.string().optional(),
      tempo: z.number().min(20).max(320).optional(),
      timeSignature: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
      keySignature: z.string().optional(),
    })
  ),
  regions: z.array(TrackRegionSchema).optional().default([]), // Mixcraft 10 Hlm. 199 - Track Regions
  performanceSets: z.array(PerformanceSetSchema).optional().default([]), // Mixcraft 10 Hlm. 411 - Performance Sets
  isPerformanceSolo: z.boolean().optional().default(false), // Mutes timeline clips during performance playback (Hlm. 414)
  isPerformanceArmed: z.boolean().optional().default(false), // Records sets to timeline grid (Hlm. 414)
  performanceCue: PerformanceCueQuantizeSchema.optional().default("1"), // Quantized switch latency (Hlm. 414-415)
  tracks: z.array(StudioTrackSchema),
  buses: z.array(SubgroupBusSchema).optional().default([]),
  masterTrack: MasterTrackSchema,
  assetManifest: z.record(AudioAssetMetaSchema),
  lyrics: StudioLyricsDataSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Default Synth Settings (80s Poly Lead / Warm Pad style)
 */
export const DEFAULT_SYNTH_SETTINGS: SynthSettings = {
  waveform: "sawtooth",
  attack: 0.05,
  decay: 0.2,
  sustain: 0.6,
  release: 0.4,
  filterCutoff: 3200,
  filterResonance: 2.5,
  volume: 0.8,
};

const TRACK_PALETTE = [
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#f43f5e", // Rose
];

export const DEFAULT_SUBGROUP_BUSES: SubgroupBus[] = [
  { id: "bus_drums", name: "Drums Bus", color: "#f59e0b", volume: 1.0, pan: 0, mute: false, solo: false, plugins: [] },
  { id: "bus_vocals", name: "Vocal Bus", color: "#ec4899", volume: 1.0, pan: 0, mute: false, solo: false, plugins: [] },
  { id: "bus_music", name: "Music Bus", color: "#8b5cf6", volume: 1.0, pan: 0, mute: false, solo: false, plugins: [] },
  { id: "bus_fx", name: "FX Submix", color: "#06b6d4", volume: 1.0, pan: 0, mute: false, solo: false, plugins: [] },
];

export function createTrack(
  type: TrackType,
  name?: string,
  index = 0,
  icon?: string
): StudioTrack {
  const color = TRACK_PALETTE[index % TRACK_PALETTE.length];
  const isMidi = type === "midi";

  let defaultName = `Audio Track ${index + 1}`;
  let defaultIcon = "mic";

  switch (type) {
    case "midi":
      defaultName = `Instrument Track ${index + 1}`;
      defaultIcon = "piano";
      break;
    case "video":
      defaultName = `Video Track`;
      defaultIcon = "video";
      break;
    case "video-text":
      defaultName = `Video Text Track`;
      defaultIcon = "text";
      break;
    case "submix":
      defaultName = `Submix Track ${index + 1}`;
      defaultIcon = "submix";
      break;
    case "send":
      defaultName = `Send Track ${index + 1}`;
      defaultIcon = "send";
      break;
    case "output":
      defaultName = `Output Track ${index + 1}`;
      defaultIcon = "output";
      break;
    case "vocoder":
      defaultName = `Vocoder Track ${index + 1}`;
      defaultIcon = "vocoder";
      break;
    case "audio":
    default:
      defaultName = `Audio Track ${index + 1}`;
      defaultIcon = "mic";
      break;
  }

  return {
    id: `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    name: name ?? defaultName,
    color,
    icon: icon ?? defaultIcon,
    height: 96,
    mute: false,
    solo: false,
    armRecord: false,
    isFrozen: false,
    monitoringEnabled: false,
    midiChannel: 0,
    midiInputDeviceId: "all",
    autoQuantize: "off",
    snapNotesToScale: false,
    instrumentName: isMidi ? "Virtual Synth (Acoustica Keys)" : undefined,
    recordingMode: "takes",
    laneCount: 1,
    mutedLaneIndices: [],
    armForPerformancePanel: false,
    isTunerActive: false,
    inputChannelMode: "stereo",
    volume: 1.0,
    pan: 0.0,
    sends: { reverb: 0.15, delay: 0.1 },
    outputBus: "master",
    inputSource: "all",
    synthSettings: isMidi || type === "vocoder" ? { ...DEFAULT_SYNTH_SETTINGS } : undefined,
    channelStrip: { ...DEFAULT_CHANNEL_STRIP_SETTINGS },
    performanceClips: [],
    plugins: [
      {
        id: `plug_eq_${Date.now()}`,
        pluginId: "internal.eq3",
        name: "3-Band EQ",
        enabled: true,
        parameters: { lowGain: 0, midGain: 0, highGain: 0 },
      },
    ],
    automationLanes: [],
    clips: [],
  };
}

export function createEmptyProject(name = "Untitled Project"): StudioProject {
  const now = new Date().toISOString();
  const track1 = createTrack("midi", "Chords (Synth)", 0);
  track1.outputBus = "bus_music";
  const track2 = createTrack("audio", "Vocal / Lead", 1);
  track2.outputBus = "bus_vocals";

  // Add initial demo notes to track1 so user can hit Play and hear immediate sound!
  const demoClip: StudioClip = {
    id: `clip_demo_${Date.now()}`,
    trackId: track1.id,
    type: "midi",
    name: "Progression Demo",
    color: track1.color,
    startBeat: 0,
    durationBeats: 8,
    offsetBeat: 0,
    gain: 1.0,
    notes: [
      // Bar 1: Am (A3, C4, E4)
      { id: "n1", pitch: 57, startBeat: 0, durationBeats: 2, velocity: 90 },
      { id: "n2", pitch: 60, startBeat: 0, durationBeats: 2, velocity: 85 },
      { id: "n3", pitch: 64, startBeat: 0, durationBeats: 2, velocity: 85 },
      // Bar 1.5: F (F3, A3, C4)
      { id: "n4", pitch: 53, startBeat: 2, durationBeats: 2, velocity: 90 },
      { id: "n5", pitch: 57, startBeat: 2, durationBeats: 2, velocity: 85 },
      { id: "n6", pitch: 60, startBeat: 2, durationBeats: 2, velocity: 85 },
      // Bar 2: C (C3, E3, G3)
      { id: "n7", pitch: 48, startBeat: 4, durationBeats: 2, velocity: 90 },
      { id: "n8", pitch: 52, startBeat: 4, durationBeats: 2, velocity: 85 },
      { id: "n9", pitch: 55, startBeat: 4, durationBeats: 2, velocity: 85 },
      // Bar 2.5: G (G3, B3, D4)
      { id: "n10", pitch: 55, startBeat: 6, durationBeats: 2, velocity: 90 },
      { id: "n11", pitch: 59, startBeat: 6, durationBeats: 2, velocity: 85 },
      { id: "n12", pitch: 62, startBeat: 6, durationBeats: 2, velocity: 85 },
    ],
  };
  track1.clips.push(demoClip);
  // Also provide a performance pad in slot 0 for instant jamming!
  track1.performanceClips = [
    { ...demoClip, id: `perf_clip_${Date.now()}` },
  ];

  const masterTrack: MasterTrack = {
    volume: 1.0,
    pan: 0.0,
    limiterThreshold: -0.3,
    limiterRelease: 0.05,
    plugins: [
      {
        id: `plug_master_comp_${Date.now()}`,
        pluginId: "internal.compressor",
        name: "Master Bus Compressor",
        enabled: true,
        parameters: { threshold: -12, ratio: 3, attack: 0.02, release: 0.15 },
      },
    ],
  };

  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    schemaVersion: "1.0.0",
    name,
    tempo: 120,
    timeSignature: [4, 4],
    sampleRate: 44100,
    loopRange: {
      enabled: true,
      startBeat: 0,
      endBeat: 8,
    },
    punchRange: {
      enabled: false,
      startBeat: 4,
      endBeat: 8,
    },
    markers: [
      { id: "m_intro", name: "Intro", beat: 0, color: "#a855f7" },
      { id: "m_verse", name: "Verse 1", beat: 8, color: "#ec4899" },
    ],
    regions: [
      { id: "reg_intro", name: "Intro", startBeat: 0, endBeat: 8, color: "#8b5cf6" },
      { id: "reg_verse1", name: "Verse 1", startBeat: 8, endBeat: 24, color: "#3b82f6" },
      { id: "reg_chorus1", name: "Chorus 1", startBeat: 24, endBeat: 40, color: "#ec4899" },
    ],
    performanceSets: [
      { id: "set_1", name: "Set 1: Intro", color: "#8b5cf6" },
      { id: "set_2", name: "Set 2: Verse", color: "#3b82f6" },
      { id: "set_3", name: "Set 3: Chorus", color: "#ec4899" },
      { id: "set_4", name: "Set 4: Drop", color: "#10b981" },
    ],
    isPerformanceSolo: false,
    isPerformanceArmed: false,
    performanceCue: "1",
    tracks: [track1, track2],
    buses: [...DEFAULT_SUBGROUP_BUSES],
    masterTrack,
    assetManifest: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validasi dan migrasi project JSON dari sumber eksternal / penyimpanan
 */
export function parseStudioProject(raw: unknown): {
  success: boolean;
  project?: StudioProject;
  error?: string;
} {
  try {
    if (!raw || typeof raw !== "object") {
      return { success: false, error: "Data proyek tidak valid atau kosong." };
    }

    const obj = raw as Record<string, unknown>;

    // Handle legacy or missing schemaVersion
    if (!obj.schemaVersion) {
      obj.schemaVersion = "1.0.0";
    }

    // Default missing fields for resilience
    if (!Array.isArray(obj.markers)) obj.markers = [];
    if (!Array.isArray(obj.regions)) obj.regions = [];
    if (!Array.isArray(obj.buses)) obj.buses = [...DEFAULT_SUBGROUP_BUSES];
    if (Array.isArray(obj.tracks)) {
      obj.tracks = (obj.tracks as Record<string, unknown>[]).map((t) => ({
        ...t,
        icon: t.icon ?? (t.type === "midi" ? "piano" : "mic"),
        height: typeof t.height === "number" && t.height >= 48 ? t.height : 96,
        isFrozen: t.isFrozen ?? false,
        armRecord: t.armRecord ?? false,
        automationLanes: Array.isArray(t.automationLanes) ? t.automationLanes : [],
        plugins: Array.isArray(t.plugins) ? t.plugins : [],
        clips: Array.isArray(t.clips) ? t.clips : [],
        outputBus: t.outputBus ?? "master",
        inputSource: t.inputSource ?? "all",
      }));
    }
    if (!obj.assetManifest || typeof obj.assetManifest !== "object") obj.assetManifest = {};
    if (!obj.loopRange) obj.loopRange = { enabled: false, startBeat: 0, endBeat: 16 };

    const parsed = StudioProjectSchema.safeParse(obj);
    if (!parsed.success) {
      const errMsgs = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return {
        success: false,
        error: `Format proyek tidak sesuai skema (${errMsgs})`,
      };
    }

    return { success: true, project: parsed.data as StudioProject };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal memproses file proyek.",
    };
  }
}
