import { describe, it, expect } from "vitest";
import {
  quantizeMidiNotes,
  humanizeMidiNotes,
  transposeMidiNotes,
  calculateVelocityFromPosition,
  calculateStalkHeightPercent,
  findClosestNoteAtBeat,
} from "./piano-roll";
import type { MidiNote } from "./types";

describe("Piano Roll & MIDI Editing Engine (Mixcraft 10 Chapter 12)", () => {
  const sampleNotes: MidiNote[] = [
    { id: "n1", pitch: 60, startBeat: 0.23, durationBeats: 0.48, velocity: 100 }, // Close to 0.25 (1/16)
    { id: "n2", pitch: 64, startBeat: 1.02, durationBeats: 0.95, velocity: 110 }, // Close to 1.0 (quarter note)
    { id: "n3", pitch: 67, startBeat: 2.11, durationBeats: 0.22, velocity: 85 },
  ];

  describe("Quantize (Mixcraft 10 Hlm. 280-281)", () => {
    it("performs 100% hard quantize to 1/16 grid (snapDiv = 4)", () => {
      const quantized = quantizeMidiNotes(sampleNotes, 4, 1.0, true);

      // 0.23 snapped to 1/16 (0.25)
      expect(quantized[0].startBeat).toBe(0.25);
      expect(quantized[0].durationBeats).toBe(0.5); // 0.48 snapped to 0.5 (2/16)

      // 1.02 snapped to 1.0
      expect(quantized[1].startBeat).toBe(1.0);
      expect(quantized[1].durationBeats).toBe(1.0);

      // 2.11 snapped to 2.0 or 2.25: 2.11 * 4 = 8.44 -> round = 8 -> 8/4 = 2.0
      expect(quantized[2].startBeat).toBe(2.0);
    });

    it("performs 50% soft groove quantize (strength = 0.5)", () => {
      // With strength 0.5, note moves half-way towards the grid snap
      const softQuantized = quantizeMidiNotes(sampleNotes, 4, 0.5, false);

      // n1: 0.23, grid snap = 0.25, delta = 0.02, target = 0.23 + 0.02 * 0.5 = 0.24
      expect(softQuantized[0].startBeat).toBeCloseTo(0.24, 4);
      // duration preserved when quantizeLength is false
      expect(softQuantized[0].durationBeats).toBe(0.48);

      // n2: 1.02, grid snap = 1.0, delta = -0.02, target = 1.02 - 0.01 = 1.01
      expect(softQuantized[1].startBeat).toBeCloseTo(1.01, 4);
    });

    it("prevents negative startBeat and zero duration", () => {
      const oddNotes: MidiNote[] = [
        { id: "n0", pitch: 60, startBeat: 0.01, durationBeats: 0.01, velocity: 90 },
      ];
      const result = quantizeMidiNotes(oddNotes, 4, 1.0, true);
      expect(result[0].startBeat).toBeGreaterThanOrEqual(0);
      expect(result[0].durationBeats).toBeGreaterThanOrEqual(0.05);
    });
  });

  describe("Humanize (Mixcraft 10 Hlm. 282)", () => {
    it("adds subtle micro-timing and velocity variations while staying bounded", () => {
      // Deterministic pseudo-RNG for test predictability
      let callCount = 0;
      const fakeRng = () => {
        callCount++;
        return callCount % 2 === 0 ? 0.8 : 0.2;
      };

      const humanized = humanizeMidiNotes(sampleNotes, 4, 16, fakeRng);
      expect(humanized.length).toBe(sampleNotes.length);

      for (let i = 0; i < sampleNotes.length; i++) {
        expect(humanized[i].startBeat).toBeGreaterThanOrEqual(0);
        expect(humanized[i].velocity).toBeGreaterThanOrEqual(1);
        expect(humanized[i].velocity).toBeLessThanOrEqual(127);
        // Timing jitter must be subtle (less than 1/16 note, i.e. < 0.25 beat)
        expect(Math.abs(humanized[i].startBeat - sampleNotes[i].startBeat)).toBeLessThan(0.05);
      }
    });

    it("clamps velocity firmly within [1, 127]", () => {
      const extremeNotes: MidiNote[] = [
        { id: "low", pitch: 60, startBeat: 1, durationBeats: 1, velocity: 2 },
        { id: "high", pitch: 60, startBeat: 1, durationBeats: 1, velocity: 126 },
      ];
      // RNG returning 0 (maximum negative jitter) and 1 (maximum positive jitter)
      const lowResult = humanizeMidiNotes([extremeNotes[0]], 4, 30, () => 0.0);
      expect(lowResult[0].velocity).toBe(1);

      const highResult = humanizeMidiNotes([extremeNotes[1]], 4, 30, () => 1.0);
      expect(highResult[0].velocity).toBe(127);
    });
  });

  describe("Transpose (Mixcraft 10 Hlm. 283)", () => {
    it("transposes all notes by +2 semitones", () => {
      const transposed = transposeMidiNotes(sampleNotes, 2, 36, 84);
      expect(transposed[0].pitch).toBe(62);
      expect(transposed[1].pitch).toBe(66);
      expect(transposed[2].pitch).toBe(69);
    });

    it("transposes only selected note when selectedNoteId is passed", () => {
      const transposed = transposeMidiNotes(sampleNotes, 12, 36, 84, "n2");
      expect(transposed[0].pitch).toBe(60); // unchanged
      expect(transposed[1].pitch).toBe(76); // 64 + 12 = 76
      expect(transposed[2].pitch).toBe(67); // unchanged
    });

    it("clamps pitches strictly between minPitch and maxPitch", () => {
      const clampedHigh = transposeMidiNotes(sampleNotes, 36, 36, 84);
      expect(clampedHigh[0].pitch).toBe(84); // 60 + 36 = 96 clamped to 84

      const clampedLow = transposeMidiNotes(sampleNotes, -40, 36, 84);
      expect(clampedLow[0].pitch).toBe(36); // clamped to 36
    });
  });

  describe("Velocity Stalks & Calculation (Mixcraft 10 Hlm. 285-290)", () => {
    it("calculates accurate velocity from vertical mouse position", () => {
      const laneHeight = 80;

      // Bottom edge (relY = 0) -> velocity 1
      expect(calculateVelocityFromPosition(0, laneHeight)).toBe(1);

      // Top edge (relY = 80) -> velocity 127
      expect(calculateVelocityFromPosition(80, laneHeight)).toBe(127);

      // Mid-point (relY = 40) -> velocity ~64
      expect(calculateVelocityFromPosition(40, laneHeight)).toBe(64);

      // Below bottom -> clamped to 1
      expect(calculateVelocityFromPosition(-10, laneHeight)).toBe(1);

      // Above top -> clamped to 127
      expect(calculateVelocityFromPosition(120, laneHeight)).toBe(127);
    });

    it("calculates visual stalk height percentage with minimum visibility floor", () => {
      // Velocity 1 -> min floor 8%
      expect(calculateStalkHeightPercent(1)).toBe(8);

      // Velocity 127 -> 100%
      expect(calculateStalkHeightPercent(127)).toBe(100);

      // Velocity 64 -> ~50.4%
      expect(calculateStalkHeightPercent(64)).toBeCloseTo(50.39, 1);
    });

    it("locates closest note at beat within threshold", () => {
      // Cursor clicks at beat 0.3 -> closest is n1 (at 0.23)
      const found = findClosestNoteAtBeat(sampleNotes, 0.3, 0.6);
      expect(found).not.toBeNull();
      expect(found!.id).toBe("n1");

      // Cursor clicks at beat 1.05 -> closest is n2 (at 1.02)
      const found2 = findClosestNoteAtBeat(sampleNotes, 1.05, 0.6);
      expect(found2!.id).toBe("n2");

      // Cursor clicks at beat 4.5 -> no notes within 0.6 threshold
      const foundFar = findClosestNoteAtBeat(sampleNotes, 4.5, 0.6);
      expect(foundFar).toBeNull();
    });
  });
});
