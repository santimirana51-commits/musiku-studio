import { describe, it, expect } from "vitest";
import {
  interpolateAutomationValue,
  adjustAutomationPoints,
  scaleAutomationPoints,
  invertAutomationPoints,
  getParameterBounds,
  getEffectiveTempoAtBeat,
  calculateBeatsDurationSeconds,
} from "./automation";
import type { AutomationPoint, StudioMarker } from "./types";

describe("Automation & Controller Mapping Engine (Mixcraft 10 Chapter 12)", () => {
  const points: AutomationPoint[] = [
    { beat: 0, value: 0.2 },
    { beat: 4, value: 1.0 },
    { beat: 8, value: 0.4 },
  ];

  describe("Linear Breakpoint Interpolation (Mixcraft 10 Hlm. 471–476)", () => {
    it("interpolates values smoothly between breakpoints", () => {
      // Midway between beat 0 (0.2) and beat 4 (1.0) -> beat 2.0 -> 0.6
      expect(interpolateAutomationValue(points, 2.0)).toBeCloseTo(0.6, 2);

      // Midway between beat 4 (1.0) and beat 8 (0.4) -> beat 6.0 -> 0.7
      expect(interpolateAutomationValue(points, 6.0)).toBeCloseTo(0.7, 2);

      // At exact points
      expect(interpolateAutomationValue(points, 0)).toBe(0.2);
      expect(interpolateAutomationValue(points, 4)).toBe(1.0);
      expect(interpolateAutomationValue(points, 8)).toBe(0.4);
    });

    it("clamps smoothly before first point and after last point", () => {
      expect(interpolateAutomationValue(points, -5)).toBe(0.2);
      expect(interpolateAutomationValue(points, 12)).toBe(0.4);
    });

    it("returns default value when point array is empty", () => {
      expect(interpolateAutomationValue([], 5, 1.0)).toBe(1.0);
    });
  });

  describe("Instant Boost / Reduce Adjuster Tool (Mixcraft 10 Hlm. 477–478)", () => {
    it("boosts all points by delta and clamps to [min, max]", () => {
      const boosted = adjustAutomationPoints(points, 0.2, 0.0, 1.5);
      expect(boosted[0].value).toBe(0.4);
      expect(boosted[1].value).toBe(1.2);
      expect(boosted[2].value).toBe(0.6);

      // Clamping at ceiling
      const maxed = adjustAutomationPoints(points, 1.0, 0.0, 1.5);
      expect(maxed[1].value).toBe(1.5); // 1.0 + 1.0 = 2.0 clamped to 1.5
    });

    it("reduces all points by delta and clamps to floor", () => {
      const reduced = adjustAutomationPoints(points, -0.3, 0.0, 1.5);
      expect(reduced[0].value).toBe(0.0); // 0.2 - 0.3 = -0.1 clamped to 0.0
      expect(reduced[1].value).toBe(0.7);
    });

    it("scales points proportionally around pivot", () => {
      // Pivot 1.0, factor 0.5 (compresses toward 1.0)
      const scaled = scaleAutomationPoints(points, 0.5, 1.0, 0.0, 1.5);
      // p[0]: 1.0 + (0.2 - 1.0) * 0.5 = 1.0 - 0.4 = 0.6
      expect(scaled[0].value).toBe(0.6);
      // p[1]: 1.0 + (1.0 - 1.0) * 0.5 = 1.0
      expect(scaled[1].value).toBe(1.0);
    });

    it("inverts automation curve symmetrically", () => {
      // Range 0.0 to 1.5
      // 0.2 -> 1.5 - 0.2 + 0.0 = 1.3
      // 1.0 -> 1.5 - 1.0 + 0.0 = 0.5
      // 0.4 -> 1.5 - 0.4 + 0.0 = 1.1
      const inverted = invertAutomationPoints(points, 0.0, 1.5);
      expect(inverted[0].value).toBe(1.3);
      expect(inverted[1].value).toBe(0.5);
      expect(inverted[2].value).toBe(1.1);
    });
  });

  describe("Parameter Bounds & Configurations", () => {
    it("returns correct bounds and labels for known DAW parameters", () => {
      const vol = getParameterBounds("volume");
      expect(vol.min).toBe(0.0);
      expect(vol.max).toBe(1.5);
      expect(vol.defaultValue).toBe(1.0);

      const pan = getParameterBounds("pan");
      expect(pan.min).toBe(-1.0);
      expect(pan.max).toBe(1.0);
      expect(pan.defaultValue).toBe(0.0);

      const rev = getParameterBounds("reverb");
      expect(rev.min).toBe(0.0);
      expect(rev.max).toBe(1.0);

      const cutoff = getParameterBounds("cutoff");
      expect(cutoff.min).toBe(20);
      expect(cutoff.max).toBe(20000);
    });
  });

  describe("Tempo Automation & Markers (Mixcraft 10 Hlm. 479–480)", () => {
    const markers: StudioMarker[] = [
      { id: "m1", name: "Intro", beat: 0, tempo: 120 },
      { id: "m2", name: "Verse", beat: 16, tempo: 140 },
      { id: "m3", name: "Chorus", beat: 32, tempo: 160 },
    ];

    it("evaluates effective tempo across timeline accurately", () => {
      expect(getEffectiveTempoAtBeat(120, markers, 0)).toBe(120);
      expect(getEffectiveTempoAtBeat(120, markers, 10)).toBe(120);
      expect(getEffectiveTempoAtBeat(120, markers, 16)).toBe(140);
      expect(getEffectiveTempoAtBeat(120, markers, 25)).toBe(140);
      expect(getEffectiveTempoAtBeat(120, markers, 32)).toBe(160);
      expect(getEffectiveTempoAtBeat(120, markers, 50)).toBe(160);
    });

    it("calculates multi-tempo physical duration in seconds", () => {
      // 0 to 16 beats at 120 BPM = 16 * (60/120) = 16 * 0.5s = 8.0s
      // 16 to 32 beats at 140 BPM = 16 * (60/140) = 16 * 0.42857s = 6.8571s
      // Total 0 to 32 beats = 8.0 + 6.8571 = 14.8571s
      const durationSec = calculateBeatsDurationSeconds(0, 32, 120, markers);
      expect(durationSec).toBeCloseTo(8.0 + 16 * (60 / 140), 2);
    });
  });
});
