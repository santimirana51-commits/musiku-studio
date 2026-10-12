import { describe, it, expect } from "vitest";
import {
  sortMarkers,
  createMarker,
  updateMarker,
  deleteMarker,
  getMarkerLoopRange,
  getPreviousAndNextMarker,
  beatToBarBeat,
} from "./markers";
import type { StudioMarker } from "./types";

describe("Timeline Markers & Marker List (Mixcraft 10 Hlm. 524–528, MC10-ARR-007)", () => {
  const sampleMarkers: StudioMarker[] = [
    { id: "m2", name: "Verse 1", beat: 8, color: "#3b82f6" },
    { id: "m1", name: "Intro", beat: 0, color: "#8b5cf6" },
    { id: "m3", name: "Chorus", beat: 24, color: "#ec4899", tempo: 130 },
  ];

  it("sorts markers in chronological beat order", () => {
    const sorted = sortMarkers(sampleMarkers);
    expect(sorted.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(sorted[0].beat).toBe(0);
    expect(sorted[1].beat).toBe(8);
    expect(sorted[2].beat).toBe(24);
  });

  it("creates a new marker with tempo, key signature, and time signature", () => {
    const created = createMarker(16, "Pre-Chorus", "#f59e0b", 128, [3, 4], "G Major");
    expect(created.id).toContain("marker_");
    expect(created.name).toBe("Pre-Chorus");
    expect(created.beat).toBe(16);
    expect(created.color).toBe("#f59e0b");
    expect(created.tempo).toBe(128);
    expect(created.timeSignature).toEqual([3, 4]);
    expect(created.keySignature).toBe("G Major");
  });

  it("updates marker properties and maintains sorted order", () => {
    const updated = updateMarker(sampleMarkers, "m1", { beat: 12, name: "Intro Extended" });
    const m = updated.find((x) => x.id === "m1");
    expect(m?.name).toBe("Intro Extended");
    expect(m?.beat).toBe(12);

    // Verify ordering: m2 (8), m1 (12), m3 (24)
    expect(updated.map((x) => x.id)).toEqual(["m2", "m1", "m3"]);
  });

  it("deletes a marker by ID", () => {
    const remaining = deleteMarker(sampleMarkers, "m2");
    expect(remaining).toHaveLength(2);
    expect(remaining.some((m) => m.id === "m2")).toBe(false);
  });

  describe("getMarkerLoopRange (Mixcraft 10 Auto-Loop between consecutive markers)", () => {
    it("calculates loop range between a marker and the next marker", () => {
      // Loop for Intro (0) should end at Verse 1 (8)
      const loop1 = getMarkerLoopRange(sampleMarkers, "m1");
      expect(loop1).toEqual({ startBeat: 0, endBeat: 8 });

      // Loop for Verse 1 (8) should end at Chorus (24)
      const loop2 = getMarkerLoopRange(sampleMarkers, "m2");
      expect(loop2).toEqual({ startBeat: 8, endBeat: 24 });
    });

    it("defaults loop end for the last marker to +16 beats or maxProjectBeats", () => {
      const loopLast = getMarkerLoopRange(sampleMarkers, "m3", 64);
      expect(loopLast).toEqual({ startBeat: 24, endBeat: 64 });
    });

    it("returns null for non-existent marker ID", () => {
      expect(getMarkerLoopRange(sampleMarkers, "non_existent")).toBeNull();
    });
  });

  describe("getPreviousAndNextMarker (Mixcraft 10 Marker Navigation)", () => {
    it("navigates forward and backward relative to playhead", () => {
      // At beat 10 (between Verse 1 at 8 and Chorus at 24)
      const nav1 = getPreviousAndNextMarker(sampleMarkers, 10);
      expect(nav1.previous?.id).toBe("m2");
      expect(nav1.next?.id).toBe("m3");

      // At beat 0 (at Intro)
      const nav2 = getPreviousAndNextMarker(sampleMarkers, 0);
      expect(nav2.previous).toBeUndefined();
      expect(nav2.next?.id).toBe("m2");

      // Beyond last marker (beat 30)
      const nav3 = getPreviousAndNextMarker(sampleMarkers, 30);
      expect(nav3.previous?.id).toBe("m3");
      expect(nav3.next).toBeUndefined();
    });
  });

  describe("beatToBarBeat", () => {
    it("formats linear beat into Measure.Beat notation", () => {
      expect(beatToBarBeat(0, 4).display).toBe("1.1");
      expect(beatToBarBeat(4, 4).display).toBe("2.1");
      expect(beatToBarBeat(7, 4).display).toBe("2.4");
      expect(beatToBarBeat(8.5, 4).display).toBe("3.1.50");
    });
  });
});
