import { describe, it, expect } from "vitest";
import {
  getNextCueBeat,
  getTrackPerformanceClip,
  copyTimelineClipToPerformanceSlot,
  updatePerformanceClipSlot,
  recordPerformanceClipToTimeline,
  addPerformanceSet,
  deletePerformanceSet,
  duplicatePerformanceSet,
} from "./performance-panel";
import { createEmptyProject, createTrack } from "./schema";
import type { StudioClip } from "./types";

describe("Mixcraft 10 Performance Panel Engine (Hlm. 411–461)", () => {
  describe("Cue Quantization (Mixcraft 10 Hlm. 414–415)", () => {
    it("returns immediate beat for instant cue", () => {
      expect(getNextCueBeat(2.7, "instant")).toBe(2.7);
      expect(getNextCueBeat(0, "instant")).toBe(0);
    });

    it("snaps to next 1/4 beat boundary", () => {
      expect(getNextCueBeat(1.05, "1/4")).toBe(1.25);
      expect(getNextCueBeat(1.25, "1/4")).toBe(1.5);
      expect(getNextCueBeat(1.8, "1/4")).toBe(2.0);
    });

    it("snaps to next 1/2 beat boundary", () => {
      expect(getNextCueBeat(1.1, "1/2")).toBe(1.5);
      expect(getNextCueBeat(1.5, "1/2")).toBe(2.0);
      expect(getNextCueBeat(2.4, "1/2")).toBe(2.5);
    });

    it("snaps to next whole beat boundary", () => {
      expect(getNextCueBeat(0.1, "1")).toBe(1);
      expect(getNextCueBeat(1.0, "1")).toBe(2);
      expect(getNextCueBeat(3.7, "1")).toBe(4);
    });

    it("snaps to next 2-beat boundary", () => {
      expect(getNextCueBeat(0.2, "2")).toBe(2);
      expect(getNextCueBeat(2.0, "2")).toBe(4);
      expect(getNextCueBeat(2.8, "2")).toBe(4);
    });

    it("snaps to next bar downbeat boundary (1 Bar / 4 beats in 4/4)", () => {
      expect(getNextCueBeat(0.1, "4", 4)).toBe(4);
      expect(getNextCueBeat(3.9, "4", 4)).toBe(4);
      expect(getNextCueBeat(4.0, "4", 4)).toBe(8);
      expect(getNextCueBeat(7.5, "4", 4)).toBe(8);
    });
  });

  describe("Slot Retrieval and Timeline Copying (Mixcraft 10 Hlm. 7823)", () => {
    it("retrieves performance clip from slot index or falls back to clips", () => {
      const track = createTrack("midi", "Keys", 0);
      const testClip: StudioClip = {
        id: "clip_1",
        trackId: track.id,
        type: "midi",
        name: "Intro Lead",
        startBeat: 0,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1.0,
      };
      track.performanceClips = [testClip, null];

      expect(getTrackPerformanceClip(track, 0)).toBe(testClip);
      expect(getTrackPerformanceClip(track, 1)).toBeNull();
      // Out of bounds fallback
      expect(getTrackPerformanceClip(track, 5)).toBeNull();
    });

    it("copies timeline clip into performance slot with normalized startBeat 0", () => {
      const track = createTrack("audio", "Vocal Hook", 0);
      const timelineClip: StudioClip = {
        id: "timeline_hook",
        trackId: track.id,
        type: "audio",
        name: "Chorus Vocal",
        startBeat: 16, // In the middle of the song
        durationBeats: 8,
        offsetBeat: 0,
        gain: 1.0,
      };

      const updatedTrack = copyTimelineClipToPerformanceSlot(track, timelineClip, 2);
      expect(updatedTrack.performanceClips).toBeDefined();
      expect(updatedTrack.performanceClips?.[2]).toBeDefined();

      const slotClip = updatedTrack.performanceClips![2]!;
      expect(slotClip.name).toBe("Chorus Vocal");
      expect(slotClip.startBeat).toBe(0); // Loop start normalized
      expect(slotClip.durationBeats).toBe(8);
      expect(slotClip.id).not.toBe(timelineClip.id); // Cloned with new unique ID
    });
  });

  describe("Arm to Timeline Stamping (Mixcraft 10 Hlm. 414)", () => {
    it("records performance clip to main timeline grid at current playhead beat", () => {
      const project = createEmptyProject("Jam Session");
      const track = project.tracks[0];
      const perfClip: StudioClip = {
        id: "perf_chord_jam",
        trackId: track.id,
        type: "midi",
        name: "Jam Rhythm",
        startBeat: 0,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1.0,
      };

      const initialCount = track.clips.length;
      const stampedProject = recordPerformanceClipToTimeline(
        project,
        track.id,
        perfClip,
        12.0 // Playhead is at beat 12
      );

      const targetTrack = stampedProject.tracks.find((t) => t.id === track.id)!;
      expect(targetTrack.clips.length).toBe(initialCount + 1);

      const newClip = targetTrack.clips[targetTrack.clips.length - 1];
      expect(newClip.name).toBe("Jam Rhythm");
      expect(newClip.startBeat).toBe(12.0); // Stamped at current playhead
      expect(newClip.durationBeats).toBe(4);
    });
  });

  describe("Set Management (+ Add, Delete, Duplicate Sets - Hlm. 412–413)", () => {
    it("adds a new set to the project", () => {
      const project = createEmptyProject("Set Test");
      const initialSets = project.performanceSets?.length || 0;

      const updated = addPerformanceSet(project, "Set 5: Climax");
      expect(updated.performanceSets?.length).toBe(initialSets + 1);
      const lastSet = updated.performanceSets![updated.performanceSets!.length - 1];
      expect(lastSet.name).toBe("Set 5: Climax");
    });

    it("deletes a set and shifts track performance clips", () => {
      const project = createEmptyProject("Delete Set Test");
      expect(project.performanceSets?.length).toBe(4);

      const updated = deletePerformanceSet(project, 1); // Delete Set 2 (Verse)
      expect(updated.performanceSets?.length).toBe(3);
      expect(updated.performanceSets?.[0].name).toContain("Set 1");
      expect(updated.performanceSets?.[1].name).toContain("Set 3");
    });

    it("duplicates an existing set and clones slot clips", () => {
      const project = createEmptyProject("Dupe Set Test");
      const updated = duplicatePerformanceSet(project, 0); // Duplicate Set 1

      expect(updated.performanceSets?.length).toBe(5);
      expect(updated.performanceSets?.[1].name).toContain("Set 1: Intro (Copy)");
    });
  });
});
