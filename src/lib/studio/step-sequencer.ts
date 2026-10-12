import type { DrumSoundType } from "./synth";
import type { MidiNote, StudioClip } from "./types";

export interface StepCell {
  active: boolean;
  velocity: number; // 1 - 127
  flam?: boolean; // Mixcraft 10 Hlm. 318 - triggers a rapid double grace hit
}

export interface DrumLane {
  id: string;
  name: string;
  sound: DrumSoundType;
  pitch: number; // General MIDI standard: Kick=36, Snare=38, Clap=39, HiHatClosed=42, HiHatOpen=46, Perc=50
  steps: StepCell[];
}

export interface StepPattern {
  id: string;
  name: string;
  stepsCount: 16 | 32;
  tempo: number;
  swing: number; // 0.0 s.d. 0.6 (delay odd sixteenths)
  lanes: DrumLane[];
}

export const DRUM_SOUND_PITCH_MAP: Record<DrumSoundType, number> = {
  kick: 36, // C1
  snare: 38, // D1
  clap: 39, // D#1
  hihat_closed: 42, // F#1
  hihat_open: 46, // A#1
  perc: 50, // D2
};

export function createDefaultPattern(stepsCount: 16 | 32 = 16, name = "New Beat Pattern"): StepPattern {
  const soundDefs: Array<{ name: string; sound: DrumSoundType }> = [
    { name: "Kick 808", sound: "kick" },
    { name: "Snare Studio", sound: "snare" },
    { name: "Hand Clap", sound: "clap" },
    { name: "Closed Hat", sound: "hihat_closed" },
    { name: "Open Hat", sound: "hihat_open" },
    { name: "Perc / Rim", sound: "perc" },
  ];

  const lanes: DrumLane[] = soundDefs.map((def) => ({
    id: `lane_${def.sound}`,
    name: def.name,
    sound: def.sound,
    pitch: DRUM_SOUND_PITCH_MAP[def.sound],
    steps: Array.from({ length: stepsCount }, () => ({
      active: false,
      velocity: 100,
    })),
  }));

  return {
    id: `pat_${Date.now()}`,
    name,
    stepsCount,
    tempo: 120,
    swing: 0,
    lanes,
  };
}

/**
 * Pustaka Preset Beat Siap Pakai
 */
export const STEP_PATTERN_PRESETS: StepPattern[] = [
  {
    id: "preset.boombap",
    name: "Classic Boombap (90 BPM)",
    stepsCount: 16,
    tempo: 90,
    swing: 0.15,
    lanes: [
      {
        id: "lane_kick",
        name: "Kick 808",
        sound: "kick",
        pitch: 36,
        // Step index: 0, 6, 10
        steps: [
          { active: true, velocity: 115 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 105 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 110 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
        ],
      },
      {
        id: "lane_snare",
        name: "Snare Studio",
        sound: "snare",
        pitch: 38,
        // Snare on 4 and 12 (Beats 2 and 4)
        steps: [
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 115 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 115 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
        ],
      },
      {
        id: "lane_clap",
        name: "Hand Clap",
        sound: "clap",
        pitch: 39,
        steps: Array.from({ length: 16 }, () => ({ active: false, velocity: 90 })),
      },
      {
        id: "lane_hihat_closed",
        name: "Closed Hat",
        sound: "hihat_closed",
        pitch: 42,
        // 8th notes (0, 2, 4, 6, 8, 10, 12, 14)
        steps: [
          { active: true, velocity: 100 },
          { active: false, velocity: 80 },
          { active: true, velocity: 90 },
          { active: false, velocity: 80 },
          { active: true, velocity: 105 },
          { active: false, velocity: 80 },
          { active: true, velocity: 90 },
          { active: false, velocity: 80 },
          { active: true, velocity: 100 },
          { active: false, velocity: 80 },
          { active: true, velocity: 90 },
          { active: false, velocity: 80 },
          { active: true, velocity: 105 },
          { active: false, velocity: 80 },
          { active: true, velocity: 90 },
          { active: false, velocity: 80 },
        ],
      },
      {
        id: "lane_hihat_open",
        name: "Open Hat",
        sound: "hihat_open",
        pitch: 46,
        steps: [
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: true, velocity: 95 },
          { active: false, velocity: 80 },
        ],
      },
      {
        id: "lane_perc",
        name: "Perc / Rim",
        sound: "perc",
        pitch: 50,
        steps: Array.from({ length: 16 }, () => ({ active: false, velocity: 80 })),
      },
    ],
  },
  {
    id: "preset.trap_808",
    name: "Trap 808 Banger (140 BPM)",
    stepsCount: 16,
    tempo: 140,
    swing: 0,
    lanes: [
      {
        id: "lane_kick",
        name: "Kick 808",
        sound: "kick",
        pitch: 36,
        // 0, 7, 10
        steps: [
          { active: true, velocity: 125 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 115 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 120 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
        ],
      },
      {
        id: "lane_snare",
        name: "Snare Studio",
        sound: "snare",
        pitch: 38,
        // Snare/Clap on 8 (Beat 3)
        steps: [
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 120 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
        ],
      },
      {
        id: "lane_clap",
        name: "Hand Clap",
        sound: "clap",
        pitch: 39,
        // Layer on 8
        steps: [
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 115 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
        ],
      },
      {
        id: "lane_hihat_closed",
        name: "Closed Hat",
        sound: "hihat_closed",
        pitch: 42,
        // Rapid trap 16ths
        steps: Array.from({ length: 16 }, (_, i) => ({
          active: true,
          velocity: i % 2 === 0 ? 105 : 85,
        })),
      },
      {
        id: "lane_hihat_open",
        name: "Open Hat",
        sound: "hihat_open",
        pitch: 46,
        steps: [
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: true, velocity: 90 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: true, velocity: 90 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
        ],
      },
      {
        id: "lane_perc",
        name: "Perc / Rim",
        sound: "perc",
        pitch: 50,
        steps: Array.from({ length: 16 }, () => ({ active: false, velocity: 80 })),
      },
    ],
  },
  {
    id: "preset.house_4x4",
    name: "House 4-on-the-Floor (124 BPM)",
    stepsCount: 16,
    tempo: 124,
    swing: 0.05,
    lanes: [
      {
        id: "lane_kick",
        name: "Kick 808",
        sound: "kick",
        pitch: 36,
        // Kick on 0, 4, 8, 12
        steps: [
          { active: true, velocity: 120 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 120 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 120 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 120 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
        ],
      },
      {
        id: "lane_snare",
        name: "Snare Studio",
        sound: "snare",
        pitch: 38,
        steps: Array.from({ length: 16 }, () => ({ active: false, velocity: 80 })),
      },
      {
        id: "lane_clap",
        name: "Hand Clap",
        sound: "clap",
        pitch: 39,
        // Clap on 4 and 12
        steps: [
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 115 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: true, velocity: 115 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
          { active: false, velocity: 100 },
        ],
      },
      {
        id: "lane_hihat_closed",
        name: "Closed Hat",
        sound: "hihat_closed",
        pitch: 42,
        steps: Array.from({ length: 16 }, () => ({ active: false, velocity: 80 })),
      },
      {
        id: "lane_hihat_open",
        name: "Open Hat",
        sound: "hihat_open",
        pitch: 46,
        // Offbeats on 2, 6, 10, 14
        steps: [
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: true, velocity: 105 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: true, velocity: 105 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: true, velocity: 105 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: true, velocity: 105 },
          { active: false, velocity: 80 },
        ],
      },
      {
        id: "lane_perc",
        name: "Perc / Rim",
        sound: "perc",
        pitch: 50,
        steps: [
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: true, velocity: 90 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: true, velocity: 90 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
          { active: false, velocity: 80 },
        ],
      },
    ],
  },
];

/**
 * Konversi StepPattern menjadi notasi MIDI (`MidiNote[]`)
 * 16 steps = 4 beats (1 birama 4/4), setiap step = 0.25 beats (1/16 note).
 */
export function convertPatternToMidiNotes(pattern: StepPattern): MidiNote[] {
  const notes: MidiNote[] = [];
  const stepDurationBeats = 0.25;

  for (const lane of pattern.lanes) {
    for (let stepIdx = 0; stepIdx < lane.steps.length; stepIdx++) {
      const step = lane.steps[stepIdx];
      if (step.active) {
        // Swing calculation: delay odd sixteenth notes
        const isOdd = stepIdx % 2 === 1;
        const swingOffset = isOdd ? (pattern.swing || 0) * 0.08 : 0;
        const startBeat = stepIdx * stepDurationBeats + swingOffset;

        if (step.flam) {
          // Mixcraft 10 Hlm. 318 - Flam emits a fast grace note right before the primary strike
          notes.push({
            id: `note_seq_${lane.sound}_${stepIdx}_flam_${Math.random().toString(36).substring(2, 6)}`,
            pitch: lane.pitch,
            startBeat: Math.max(0, startBeat - 0.05),
            durationBeats: 0.1,
            velocity: Math.max(40, Math.round((step.velocity || 100) * 0.75)),
          });
        }

        notes.push({
          id: `note_seq_${lane.sound}_${stepIdx}_${Math.random().toString(36).substring(2, 6)}`,
          pitch: lane.pitch,
          startBeat,
          durationBeats: 0.2,
          velocity: step.velocity || 100,
        });
      }
    }
  }

  return notes;
}

/**
 * Konversi StepPattern menjadi StudioClip baru yang siap diletakkan di timeline
 */
export function convertPatternToStudioClip(
  pattern: StepPattern,
  trackId: string,
  startBeat = 0
): StudioClip {
  const durationBeats = (pattern.stepsCount / 16) * 4;
  const notes = convertPatternToMidiNotes(pattern);

  return {
    id: `clip_seq_${Date.now()}`,
    trackId,
    type: "midi",
    name: `${pattern.name} Clip`,
    color: "#f59e0b", // Amber gold for beat clip
    startBeat,
    durationBeats,
    offsetBeat: 0,
    gain: 1.0,
    notes,
  };
}
