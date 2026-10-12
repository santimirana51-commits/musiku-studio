import type { MidiNote } from "./types";

/**
 * Mixcraft 10 User Guide Chapter 12 - Piano Roll & MIDI Editing
 * Pure transformation and calculation utilities.
 */

/**
 * Kuantisasi notasi MIDI berdasarkan grid snap dan kekuatan (strength).
 * - strength = 1.0 (100% Kuantisasi Keras - Mixcraft 10 Hlm. 280)
 * - strength = 0.5 (50% Kuantisasi Lembut / Human Groove Quantize - Mixcraft 10 Hlm. 281)
 */
export function quantizeMidiNotes(
  notes: MidiNote[],
  snapDiv = 4,
  strength = 1.0,
  quantizeLength = true
): MidiNote[] {
  return notes.map((n) => {
    const snappedStart = Math.round(n.startBeat * snapDiv) / snapDiv;
    const targetStart = n.startBeat + (snappedStart - n.startBeat) * strength;
    const snappedDur = quantizeLength
      ? Math.max(1.0 / snapDiv, Math.round(n.durationBeats * snapDiv) / snapDiv)
      : n.durationBeats;
    const targetDur = n.durationBeats + (snappedDur - n.durationBeats) * strength;

    return {
      ...n,
      startBeat: Math.max(0, targetStart),
      durationBeats: Math.max(0.05, targetDur),
    };
  });
}

/**
 * Humanisasi notasi MIDI (Mixcraft 10 Hlm. 282).
 * Memberikan variasi mikro-timing acak dan dinamika velocity alami agar tidak terkesan robotik.
 */
export function humanizeMidiNotes(
  notes: MidiNote[],
  snapDiv = 4,
  maxVelocityJitter = 16,
  rng: () => number = Math.random
): MidiNote[] {
  return notes.map((n) => {
    const timingJitter = (rng() - 0.5) * (0.05 / snapDiv);
    const velocityJitter = Math.round((rng() - 0.5) * maxVelocityJitter);

    return {
      ...n,
      startBeat: Math.max(0, n.startBeat + timingJitter),
      velocity: Math.max(1, Math.min(127, n.velocity + velocityJitter)),
    };
  });
}

/**
 * Transposisi nada semi-nada (Mixcraft 10 Hlm. 283).
 * Mendukung transposisi not terpilih atau semua not, dibatasi minPitch s.d. maxPitch.
 */
export function transposeMidiNotes(
  notes: MidiNote[],
  semitones: number,
  minPitch = 36,
  maxPitch = 84,
  selectedNoteId?: string | null
): MidiNote[] {
  if (selectedNoteId) {
    return notes.map((n) => {
      if (n.id === selectedNoteId) {
        return {
          ...n,
          pitch: Math.max(minPitch, Math.min(maxPitch, n.pitch + semitones)),
        };
      }
      return n;
    });
  }

  return notes.map((n) => ({
    ...n,
    pitch: Math.max(minPitch, Math.min(maxPitch, n.pitch + semitones)),
  }));
}

/**
 * Konversi posisi vertikal stalk atau klik mouse menjadi nilai velocity MIDI (1 - 127).
 * Mixcraft 10 Hlm. 285-290 (Velocity Lane).
 */
export function calculateVelocityFromPosition(
  relYFromBottom: number,
  laneHeight: number
): number {
  if (laneHeight <= 0) return 100;
  const rawVel = Math.round((relYFromBottom / laneHeight) * 127);
  return Math.max(1, Math.min(127, rawVel));
}

/**
 * Hitung persentase tinggi stalk velocity untuk rendering visual (8% s.d. 100%).
 */
export function calculateStalkHeightPercent(velocity: number): number {
  const clamped = Math.max(1, Math.min(127, velocity));
  return Math.max(8, Math.min(100, (clamped / 127) * 100));
}

/**
 * Cari notasi MIDI terdekat dengan beat tertentu untuk interaksi klik pada jalur velocity.
 */
export function findClosestNoteAtBeat(
  notes: MidiNote[],
  beat: number,
  thresholdBeats = 0.6
): MidiNote | null {
  let closestNote: MidiNote | null = null;
  let minDistance = Infinity;

  for (const n of notes) {
    const dist = Math.abs(n.startBeat - beat);
    if (dist < minDistance && dist <= thresholdBeats) {
      minDistance = dist;
      closestNote = n;
    }
  }

  return closestNote;
}
