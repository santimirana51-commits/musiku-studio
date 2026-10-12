import { describe, it, expect } from "vitest";
import {
  splitRegionAtBeat,
  moveRegionAndClips,
  deleteRegion,
  findRegionAtBeat,
} from "./track-regions";
import type { StudioProject, TrackRegion, StudioTrack } from "./types";
import { createEmptyProject } from "./schema";

describe("Track Regions Song Section Re-Arranger (Mixcraft 10 Hlm. 199–202, MC10-ADV-104)", () => {
  const initialRegions: TrackRegion[] = [
    { id: "reg_intro", name: "Intro", startBeat: 0, endBeat: 8, color: "#8b5cf6" },
    { id: "reg_verse", name: "Verse 1", startBeat: 8, endBeat: 24, color: "#3b82f6" },
    { id: "reg_chorus", name: "Chorus", startBeat: 24, endBeat: 40, color: "#ec4899" },
  ];

  describe("splitRegionAtBeat", () => {
    it("splits a region at caret / playhead location into two consecutive parts", () => {
      // Split Verse 1 (8..24) at beat 16
      const result = splitRegionAtBeat(initialRegions, 16);
      expect(result).toHaveLength(4);

      const p1 = result.find((r) => r.startBeat === 8);
      const p2 = result.find((r) => r.startBeat === 16);

      expect(p1?.endBeat).toBe(16);
      expect(p1?.name).toBe("Verse 1");

      expect(p2?.endBeat).toBe(24);
      expect(p2?.name).toBe("Verse 1 (Part 2)");
    });

    it("does nothing when splitBeat is outside regions or at exact boundary", () => {
      const result1 = splitRegionAtBeat(initialRegions, 0);
      expect(result1).toHaveLength(3);

      const result2 = splitRegionAtBeat(initialRegions, 8);
      expect(result2).toHaveLength(3);

      const result3 = splitRegionAtBeat(initialRegions, 100);
      expect(result3).toHaveLength(3);
    });
  });

  describe("moveRegionAndClips", () => {
    function createMockProject(): StudioProject {
      const proj = createEmptyProject("Test Regions");
      proj.regions = [...initialRegions];
      // Add a clip on Track 0 at beat 8 (inside Verse 1, duration 8 beats)
      proj.tracks[0].clips = [
        {
          id: "clip_v1",
          trackId: proj.tracks[0].id,
          name: "Verse Vocal",
          type: "audio",
          startBeat: 8,
          durationBeats: 8,
          offsetBeat: 0,
          gain: 1.0,
        },
      ];
      // Add a clip on Track 1 at beat 24 (inside Chorus)
      proj.tracks[1].clips = [
        {
          id: "clip_c1",
          trackId: proj.tracks[1].id,
          name: "Chorus Synth",
          type: "midi",
          startBeat: 24,
          durationBeats: 16,
          offsetBeat: 0,
          gain: 1.0,
          notes: [{ id: "n1", pitch: 60, startBeat: 0, durationBeats: 1, velocity: 100 }],
        },
      ];
      return proj;
    }

    it("moves a region and all clips beneath it when dragged", () => {
      const proj = createMockProject();
      // Shift Verse 1 (beat 8..24) forward by +8 beats (delta = 8)
      const updated = moveRegionAndClips(proj, "reg_verse", 8, false);

      const movedRegion = updated.regions?.find((r) => r.id === "reg_verse");
      expect(movedRegion?.startBeat).toBe(16);
      expect(movedRegion?.endBeat).toBe(32);

      // Clip in Verse 1 should be moved from beat 8 -> 16
      const movedClip = updated.tracks[0].clips.find((c) => c.id === "clip_v1");
      expect(movedClip?.startBeat).toBe(16);

      // Clip in Chorus should remain untouched at beat 24
      const chorusClip = updated.tracks[1].clips.find((c) => c.id === "clip_c1");
      expect(chorusClip?.startBeat).toBe(24);
    });

    it("duplicates region and all clips beneath it when [Alt]+dragged (isCopy = true)", () => {
      const proj = createMockProject();
      // [Alt]+drag Chorus (beat 24..40) by +16 beats to create consecutive second chorus
      const updated = moveRegionAndClips(proj, "reg_chorus", 16, true);

      // Original region remains
      const origRegion = updated.regions?.find((r) => r.id === "reg_chorus");
      expect(origRegion?.startBeat).toBe(24);
      expect(origRegion?.endBeat).toBe(40);

      // Duplicated copy region is added at 40..56
      const copyRegion = updated.regions?.find((r) => r.name.includes("Copy"));
      expect(copyRegion?.startBeat).toBe(40);
      expect(copyRegion?.endBeat).toBe(56);

      // Track 1 should now have 2 clips: original + duplicate
      expect(updated.tracks[1].clips).toHaveLength(2);
      const originalClip = updated.tracks[1].clips.find((c) => c.startBeat === 24);
      const duplicatedClip = updated.tracks[1].clips.find((c) => c.startBeat === 40);

      expect(originalClip).toBeDefined();
      expect(duplicatedClip).toBeDefined();
      expect(duplicatedClip?.notes).toHaveLength(1);
    });
  });

  describe("deleteRegion & Ripple Delete", () => {
    it("deletes a region without ripple, keeping clips intact", () => {
      const proj = createEmptyProject("Delete Test");
      proj.regions = [...initialRegions];
      proj.tracks[0].clips = [
        {
          id: "clip_intro",
          trackId: proj.tracks[0].id,
          name: "Intro Beat",
          type: "audio",
          startBeat: 0,
          durationBeats: 8,
          offsetBeat: 0,
          gain: 1.0,
        },
      ];

      const after = deleteRegion(proj, "reg_intro", false);
      expect(after.regions).toHaveLength(2);
      expect(after.regions?.some((r) => r.id === "reg_intro")).toBe(false);
      // Clip remains
      expect(after.tracks[0].clips).toHaveLength(1);
      expect(after.tracks[0].clips[0].startBeat).toBe(0);
    });

    it("performs ripple delete: removes clips in region and shifts subsequent clips left", () => {
      const proj = createEmptyProject("Ripple Delete Test");
      proj.regions = [...initialRegions]; // Intro (0..8), Verse (8..24), Chorus (24..40)
      proj.tracks[0].clips = [
        {
          id: "c_intro",
          trackId: proj.tracks[0].id,
          name: "Intro",
          type: "audio",
          startBeat: 0,
          durationBeats: 8,
          offsetBeat: 0,
          gain: 1.0,
        },
        {
          id: "c_verse",
          trackId: proj.tracks[0].id,
          name: "Verse",
          type: "audio",
          startBeat: 8,
          durationBeats: 16,
          offsetBeat: 0,
          gain: 1.0,
        },
        {
          id: "c_chorus",
          trackId: proj.tracks[0].id,
          name: "Chorus",
          type: "audio",
          startBeat: 24,
          durationBeats: 16,
          offsetBeat: 0,
          gain: 1.0,
        },
      ];

      // Ripple delete Intro (span = 8 beats)
      const after = deleteRegion(proj, "reg_intro", true);

      // Intro clip should be deleted
      expect(after.tracks[0].clips.find((c) => c.id === "c_intro")).toBeUndefined();

      // Verse clip (originally at beat 8) should ripple left by 8 beats -> beat 0
      const verseClip = after.tracks[0].clips.find((c) => c.id === "c_verse");
      expect(verseClip?.startBeat).toBe(0);

      // Chorus clip (originally at beat 24) should ripple left by 8 beats -> beat 16
      const chorusClip = after.tracks[0].clips.find((c) => c.id === "c_chorus");
      expect(chorusClip?.startBeat).toBe(16);

      // Regions should also be ripple shifted
      const verseRegion = after.regions?.find((r) => r.id === "reg_verse");
      expect(verseRegion?.startBeat).toBe(0);
      expect(verseRegion?.endBeat).toBe(16);
    });
  });

  describe("findRegionAtBeat", () => {
    it("returns corresponding region covering given beat", () => {
      expect(findRegionAtBeat(initialRegions, 4)?.name).toBe("Intro");
      expect(findRegionAtBeat(initialRegions, 8)?.name).toBe("Verse 1");
      expect(findRegionAtBeat(initialRegions, 20)?.name).toBe("Verse 1");
      expect(findRegionAtBeat(initialRegions, 30)?.name).toBe("Chorus");
      expect(findRegionAtBeat(initialRegions, 50)).toBeUndefined();
    });
  });
});
