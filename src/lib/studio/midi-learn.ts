/**
 * MIDI Learn & Hardware Controller Mapping Module
 * Mixcraft 10 User Guide Chapter 27 & Manual Hlm. 488–495, 661–664 (MC10-AUT-205)
 *
 * Supports hardware MIDI keyboards, rotary knobs, sliders, pads, and control surfaces.
 * Handles CC & Note messages, mapping persistence, scaling, and presets.
 */

export type MidiMessageType = "cc" | "note";
export type MidiCommandCategory = "transport" | "master" | "selected_track" | "track";

export interface MidiMapping {
  id: string;
  command: string; // e.g. "transport_play", "master_volume", "track_volume:track_1"
  label: string;
  category: MidiCommandCategory;
  messageType: MidiMessageType;
  channel: number; // 0 = Any/Omni, 1-16 = specific MIDI channel
  controlNumber: number; // CC# (0-127) or Note# (0-127)
  trackId?: string; // If bound to a specific track
  trackIndex?: number; // 1-based index if track-specific
  parameter?: "volume" | "pan" | "mute" | "solo" | "arm" | "monitoring" | "reverb" | "delay";
}

export interface MidiMessageEvent {
  channel: number; // 1-16
  type: MidiMessageType;
  controlNumber: number; // CC# or Note#
  value: number; // 0-127
  timestamp?: number;
}

export interface MidiDeviceDescriptor {
  id: string;
  name: string;
  manufacturer?: string;
  state: "connected" | "disconnected";
}

export const STORAGE_KEY_MIDI_MAPPINGS = "musikku_studio_midi_mappings";

/**
 * Standard command catalog for manual assignment or dropdown selection
 * (Mixcraft 10 User Guide Hlm. 663–664)
 */
export const AVAILABLE_MIDI_COMMANDS: Array<{
  command: string;
  label: string;
  category: MidiCommandCategory;
  isContinuous: boolean;
}> = [
  // Transport
  { command: "transport_play", label: "Playback Toggle (Play / Stop)", category: "transport", isContinuous: false },
  { command: "transport_record", label: "Record Toggle", category: "transport", isContinuous: false },
  { command: "transport_rewind", label: "Rewind to Start (Bar 1)", category: "transport", isContinuous: false },
  { command: "transport_loop", label: "Loop Mode Toggle", category: "transport", isContinuous: false },
  { command: "transport_metronome", label: "Metronome Toggle", category: "transport", isContinuous: false },

  // Master
  { command: "master_volume", label: "Adjust Master Volume", category: "master", isContinuous: true },
  { command: "master_pan", label: "Adjust Master Pan", category: "master", isContinuous: true },

  // Selected Track
  { command: "selected_track_volume", label: "Selected Track Volume", category: "selected_track", isContinuous: true },
  { command: "selected_track_pan", label: "Selected Track Pan", category: "selected_track", isContinuous: true },
  { command: "selected_track_mute", label: "Selected Track Mute Toggle", category: "selected_track", isContinuous: false },
  { command: "selected_track_solo", label: "Selected Track Solo Toggle", category: "selected_track", isContinuous: false },
  { command: "selected_track_arm", label: "Selected Track Arm Record Toggle", category: "selected_track", isContinuous: false },
  { command: "selected_track_monitoring", label: "Selected Track Monitoring Toggle", category: "selected_track", isContinuous: false },
];

/**
 * Parses raw Uint8Array MIDI data from Web MIDI API into a typed MidiMessageEvent.
 */
export function parseRawMidiMessage(data: Uint8Array): MidiMessageEvent | null {
  if (!data || data.length < 2) return null;

  const status = data[0];
  const command = status & 0xf0;
  const channel = (status & 0x0f) + 1; // 1-16
  const controlNumber = data[1];
  const value = data.length > 2 ? data[2] : 0;

  if (command === 0xb0) {
    // Control Change (CC)
    return {
      channel,
      type: "cc",
      controlNumber,
      value,
    };
  }

  if (command === 0x90) {
    // Note On (value > 0) or Note Off (value === 0)
    return {
      channel,
      type: "note",
      controlNumber,
      value,
    };
  }

  if (command === 0x80) {
    // Note Off
    return {
      channel,
      type: "note",
      controlNumber,
      value: 0,
    };
  }

  return null;
}

/**
 * Maps CC value (0..127) to Linear Volume Gain (0.0 .. 1.5).
 * CC 0 = 0.0 (-inf dB)
 * CC 100 ~ 1.0 (Unity Gain / 0 dB)
 * CC 127 = 1.5 (+3.5 dB)
 */
export function scaleCcToVolume(ccValue: number): number {
  const clamped = Math.max(0, Math.min(127, ccValue));
  if (clamped <= 100) {
    return Number((clamped / 100).toFixed(3));
  }
  // 100..127 maps to 1.0 .. 1.5
  const fraction = (clamped - 100) / 27;
  return Number((1.0 + fraction * 0.5).toFixed(3));
}

/**
 * Converts Volume Gain (0.0 .. 1.5) back to CC (0..127).
 */
export function volumeToCc(vol: number): number {
  const clamped = Math.max(0, Math.min(1.5, vol));
  if (clamped <= 1.0) {
    return Math.round(clamped * 100);
  }
  return Math.round(100 + ((clamped - 1.0) / 0.5) * 27);
}

/**
 * Maps CC value (0..127) to Pan (-1.0 .. +1.0).
 * CC 0 = -1.0 (Full Left)
 * CC 64 = 0.0 (Center)
 * CC 127 = +1.0 (Full Right)
 */
export function scaleCcToPan(ccValue: number): number {
  const clamped = Math.max(0, Math.min(127, ccValue));
  if (clamped === 64) return 0;
  if (clamped < 64) {
    return Number(((clamped - 64) / 64).toFixed(3));
  }
  return Number(((clamped - 64) / 63).toFixed(3));
}

/**
 * Converts Pan (-1.0 .. +1.0) back to CC (0..127).
 */
export function panToCc(pan: number): number {
  const clamped = Math.max(-1.0, Math.min(1.0, pan));
  if (clamped === 0) return 64;
  if (clamped < 0) {
    return Math.round(64 + clamped * 64);
  }
  return Math.round(64 + clamped * 63);
}

/**
 * Maps CC value to generic linear range [min, max].
 */
export function scaleCcToRange(ccValue: number, min: number, max: number): number {
  const clamped = Math.max(0, Math.min(127, ccValue));
  const fraction = clamped / 127;
  return Number((min + fraction * (max - min)).toFixed(3));
}

/**
 * Checks whether an incoming message should trigger a toggle action (Play, Mute, Solo, etc.).
 * Triggers on CC value >= 64 (button press down) or Note On velocity > 0.
 */
export function isToggleTrigger(msg: MidiMessageEvent): boolean {
  if (msg.type === "note") {
    return msg.value > 0;
  }
  if (msg.type === "cc") {
    return msg.value >= 64;
  }
  return false;
}

/**
 * Finds matching MIDI mapping for incoming event.
 * Channel 0 in mapping matches any incoming channel (Omni).
 */
export function findMatchingMidiMapping(
  mappings: MidiMapping[],
  msg: MidiMessageEvent
): MidiMapping | undefined {
  return mappings.find(
    (m) =>
      m.messageType === msg.type &&
      m.controlNumber === msg.controlNumber &&
      (m.channel === 0 || m.channel === msg.channel)
  );
}

/**
 * Adds or updates a mapping in the array.
 * If a mapping with the same messageType and controlNumber exists, it is replaced.
 */
export function createOrUpdateMapping(
  mappings: MidiMapping[],
  newMapping: MidiMapping
): MidiMapping[] {
  const existingIdx = mappings.findIndex(
    (m) =>
      m.id === newMapping.id ||
      (m.messageType === newMapping.messageType &&
        m.controlNumber === newMapping.controlNumber &&
        (m.channel === newMapping.channel || m.channel === 0 || newMapping.channel === 0))
  );

  if (existingIdx >= 0) {
    const updated = [...mappings];
    updated[existingIdx] = newMapping;
    return updated;
  }

  return [...mappings, newMapping];
}

/**
 * Deletes a mapping by its ID.
 */
export function deleteMapping(mappings: MidiMapping[], mappingId: string): MidiMapping[] {
  return mappings.filter((m) => m.id !== mappingId);
}

/**
 * Factory for creating a generic surface preset (Mixcraft 10 defaults).
 */
export const DEFAULT_MIDI_MAPPINGS: MidiMapping[] = [
  {
    id: "def_master_vol",
    command: "master_volume",
    label: "Adjust Master Volume",
    category: "master",
    messageType: "cc",
    channel: 0,
    controlNumber: 7, // Standard MIDI CC 7 = Volume
  },
  {
    id: "def_master_pan",
    command: "master_pan",
    label: "Adjust Master Pan",
    category: "master",
    messageType: "cc",
    channel: 0,
    controlNumber: 10, // Standard MIDI CC 10 = Pan
  },
  {
    id: "def_rewind",
    command: "transport_rewind",
    label: "Rewind to Start",
    category: "transport",
    messageType: "cc",
    channel: 0,
    controlNumber: 114, // MMC Rewind
  },
  {
    id: "def_play",
    command: "transport_play",
    label: "Playback Toggle",
    category: "transport",
    messageType: "cc",
    channel: 0,
    controlNumber: 115, // MMC Play
  },
  {
    id: "def_record",
    command: "transport_record",
    label: "Record Toggle",
    category: "transport",
    messageType: "cc",
    channel: 0,
    controlNumber: 117, // MMC Record
  },
  {
    id: "def_loop",
    command: "transport_loop",
    label: "Loop Mode Toggle",
    category: "transport",
    messageType: "cc",
    channel: 0,
    controlNumber: 113,
  },
];

/**
 * Akai MPK Mini Preset
 */
export const AKAI_MPK_PRESET: MidiMapping[] = [
  { id: "mpk_mvol", command: "master_volume", label: "Adjust Master Volume", category: "master", messageType: "cc", channel: 0, controlNumber: 7 },
  { id: "mpk_play", command: "transport_play", label: "Playback Toggle", category: "transport", messageType: "cc", channel: 0, controlNumber: 115 },
  { id: "mpk_rec", command: "transport_record", label: "Record Toggle", category: "transport", messageType: "cc", channel: 0, controlNumber: 117 },
  { id: "mpk_k1", command: "selected_track_volume", label: "Selected Track Volume", category: "selected_track", messageType: "cc", channel: 0, controlNumber: 70 },
  { id: "mpk_k2", command: "selected_track_pan", label: "Selected Track Pan", category: "selected_track", messageType: "cc", channel: 0, controlNumber: 71 },
];

/**
 * Korg nanoKONTROL2 Preset (Tracks 1-8 Faders & Knobs)
 */
export const KORG_NANOKONTROL_PRESET: MidiMapping[] = [
  ...DEFAULT_MIDI_MAPPINGS,
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `nano_vol_trk_${i + 1}`,
    command: `track_volume:trk_${i + 1}`,
    label: `Track ${i + 1} Volume`,
    category: "track" as MidiCommandCategory,
    messageType: "cc" as MidiMessageType,
    channel: 0,
    controlNumber: i, // CC 0-7 Faders
    trackIndex: i + 1,
    parameter: "volume" as const,
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `nano_pan_trk_${i + 1}`,
    command: `track_pan:trk_${i + 1}`,
    label: `Track ${i + 1} Pan`,
    category: "track" as MidiCommandCategory,
    messageType: "cc" as MidiMessageType,
    channel: 0,
    controlNumber: 16 + i, // CC 16-23 Knobs
    trackIndex: i + 1,
    parameter: "pan" as const,
  })),
];

/**
 * Loads mappings from browser localStorage, falling back to default preset.
 */
export function loadMidiMappingsFromStorage(): MidiMapping[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_MIDI_MAPPINGS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_MIDI_MAPPINGS);
    if (!raw) return DEFAULT_MIDI_MAPPINGS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MIDI_MAPPINGS;
  } catch {
    return DEFAULT_MIDI_MAPPINGS;
  }
}

/**
 * Saves mappings to browser localStorage.
 */
export function saveMidiMappingsToStorage(mappings: MidiMapping[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_MIDI_MAPPINGS, JSON.stringify(mappings));
  } catch (err) {
    console.warn("Gagal menyimpan pemetaan MIDI:", err);
  }
}
