import { describe, it, expect } from "vitest";
import {
  mergeClipsOnTrack,
  removeSpacesBetweenClips,
  applyAutoCrossfades,
  duplicateAndMergeClip,
  mergeSelectedClipsInProject,
  removeSpacesInProject,
} from "./clip-operations";
import { createTrack, createEmptyProject } from "./schema";
import type { StudioClip, StudioTrack } from "./types";

describe("Mixcraft 10 Clip Operations (Hlm. 210–212, 221–222, 703)", () => {
  describe("mergeClipsOnTrack ([CTRL]+W — Hlm. 210–211, 703)", () => {
    it("merges multiple MIDI clips into a single contiguous clip combining notes with relative offsets", () => {
      const midiTrack = createTrack("midi", "Synth Chords", 0);
      const clip1: StudioClip = {
        id: "clip_m1",
        trackId: midiTrack.id,
        type: "midi",
        name: "Verse Chords",
        startBeat: 4,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1.0,
        notes: [
          { id: "n1", pitch: 60, startBeat: 0.5, durationBeats: 1.0, velocity: 90 },
          { id: "n2", pitch: 64, startBeat: 2.0, durationBeats: 1.0, velocity: 85 },
        ],
      };
      const clip2: StudioClip = {
        id: "clip_m2",
        trackId: midiTrack.id,
        type: "midi",
        name: "Chorus Chords",
        startBeat: 10,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1.0,
        notes: [
          { id: "n3", pitch: 67, startBeat: 0.0, durationBeats: 2.0, velocity: 100 },
          { id: "n4", pitch: 71, startBeat: 2.0, durationBeats: 1.5, velocity: 95 },
        ],
      };
      const clip3: StudioClip = {
        id: "clip_m3",
        trackId: midiTrack.id,
        type: "midi",
        name: "Untouched Outro",
        startBeat: 20,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1.0,
      };

      midiTrack.clips = [clip1, clip2, clip3];

      const { updatedTrack, mergedClip } = mergeClipsOnTrack(midiTrack, ["clip_m1", "clip_m2"]);

      expect(mergedClip).toBeDefined();
      expect(mergedClip!.startBeat).toBe(4);
      // Span is from startBeat 4 to end of clip2 (10 + 4 = 14): duration = 14 - 4 = 10 beats
      expect(mergedClip!.durationBeats).toBe(10);
      expect(mergedClip!.name).toBe("Verse Chords (Merged)");

      // Check merged notes:
      // Clip 1 notes: offset = 0
      // Clip 2 notes: offset = 10 - 4 = 6
      expect(mergedClip!.notes).toHaveLength(4);
      expect(mergedClip!.notes![0].pitch).toBe(60);
      expect(mergedClip!.notes![0].startBeat).toBe(0.5); // 0 + 0.5

      expect(mergedClip!.notes![1].pitch).toBe(64);
      expect(mergedClip!.notes![1].startBeat).toBe(2.0); // 0 + 2.0

      expect(mergedClip!.notes![2].pitch).toBe(67);
      expect(mergedClip!.notes![2].startBeat).toBe(6.0); // 6 + 0.0

      expect(mergedClip!.notes![3].pitch).toBe(71);
      expect(mergedClip!.notes![3].startBeat).toBe(8.0); // 6 + 2.0

      // Untouched clip3 remains on the track
      expect(updatedTrack.clips).toHaveLength(2); // mergedClip + clip3
      expect(updatedTrack.clips.some((c) => c.id === "clip_m3")).toBe(true);
    });

    it("merges multiple audio clips into a unified span", () => {
      const audioTrack = createTrack("audio", "Lead Vocals", 1);
      const clip1: StudioClip = {
        id: "clip_a1",
        trackId: audioTrack.id,
        type: "audio",
        name: "Take 1",
        startBeat: 2,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1.0,
        assetId: "asset_v1",
      };
      const clip2: StudioClip = {
        id: "clip_a2",
        trackId: audioTrack.id,
        type: "audio",
        name: "Take 2",
        startBeat: 6,
        durationBeats: 6,
        offsetBeat: 0,
        gain: 1.0,
        assetId: "asset_v2",
      };

      audioTrack.clips = [clip1, clip2];

      const { updatedTrack, mergedClip } = mergeClipsOnTrack(audioTrack, ["clip_a1", "clip_a2"]);

      expect(mergedClip).toBeDefined();
      expect(mergedClip!.startBeat).toBe(2);
      expect(mergedClip!.durationBeats).toBe(10); // from 2 to 12
      expect(updatedTrack.clips).toHaveLength(1);
    });

    it("returns track unmodified when fewer than 2 clips are selected", () => {
      const track = createTrack("audio", "Guitar", 0);
      const clip: StudioClip = {
        id: "clip_solo",
        trackId: track.id,
        type: "audio",
        name: "Solo",
        startBeat: 0,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1.0,
      };
      track.clips = [clip];

      const { updatedTrack, mergedClip } = mergeClipsOnTrack(track, ["clip_solo"]);
      expect(updatedTrack).toBe(track);
      expect(mergedClip?.id).toBe("clip_solo");
    });
  });

  describe("removeSpacesBetweenClips ([CTRL]+J — Hlm. 703)", () => {
    it("packs consecutive clips by eliminating gaps and silence between them", () => {
      const track = createTrack("audio", "Percussion", 0);
      const clip1: StudioClip = {
        id: "c1",
        trackId: track.id,
        type: "audio",
        name: "Hit 1",
        startBeat: 2,
        durationBeats: 2, // ends at 4
        offsetBeat: 0,
        gain: 1.0,
      };
      const clip2: StudioClip = {
        id: "c2",
        trackId: track.id,
        type: "audio",
        name: "Hit 2",
        startBeat: 8, // gap of 4 beats
        durationBeats: 3, // ends at 11
        offsetBeat: 0,
        gain: 1.0,
      };
      const clip3: StudioClip = {
        id: "c3",
        trackId: track.id,
        type: "audio",
        name: "Hit 3",
        startBeat: 16, // gap of 5 beats
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1.0,
      };

      track.clips = [clip1, clip2, clip3];

      const packedTrack = removeSpacesBetweenClips(track);

      expect(packedTrack.clips).toHaveLength(3);
      // Clip 1 stays at 2
      expect(packedTrack.clips[0].startBeat).toBe(2);
      // Clip 2 moves to 2 + 2 = 4
      expect(packedTrack.clips[1].startBeat).toBe(4);
      // Clip 3 moves to 4 + 3 = 7
      expect(packedTrack.clips[2].startBeat).toBe(7);
    });

    it("packs only selected clips when clipIds is provided", () => {
      const track = createTrack("audio", "Drums", 0);
      const clip1: StudioClip = {
        id: "c1",
        trackId: track.id,
        type: "audio",
        name: "Kick",
        startBeat: 0,
        durationBeats: 2,
        offsetBeat: 0,
        gain: 1.0,
      };
      const clip2: StudioClip = {
        id: "c2",
        trackId: track.id,
        type: "audio",
        name: "Snare",
        startBeat: 6,
        durationBeats: 2,
        offsetBeat: 0,
        gain: 1.0,
      };
      const otherClip: StudioClip = {
        id: "c_other",
        trackId: track.id,
        type: "audio",
        name: "Crash",
        startBeat: 12,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1.0,
      };

      track.clips = [clip1, clip2, otherClip];

      const result = removeSpacesBetweenClips(track, ["c1", "c2"]);

      // c1 stays at 0, c2 moves to 2, otherClip stays at 12
      const resC1 = result.clips.find((c) => c.id === "c1")!;
      const resC2 = result.clips.find((c) => c.id === "c2")!;
      const resOther = result.clips.find((c) => c.id === "c_other")!;

      expect(resC1.startBeat).toBe(0);
      expect(resC2.startBeat).toBe(2);
      expect(resOther.startBeat).toBe(12);
    });
  });

  describe("applyAutoCrossfades (Hlm. 221–222)", () => {
    it("detects clip overlap on same lane and sets equal fade-out and fade-in", () => {
      const track = createTrack("audio", "Pads", 0);
      const clipA: StudioClip = {
        id: "pad_a",
        trackId: track.id,
        type: "audio",
        name: "Warm Pad A",
        startBeat: 0,
        durationBeats: 8, // ends at beat 8
        offsetBeat: 0,
        gain: 1.0,
        laneIndex: 0,
      };
      const clipB: StudioClip = {
        id: "pad_b",
        trackId: track.id,
        type: "audio",
        name: "Warm Pad B",
        startBeat: 6, // overlaps from beat 6 to 8 (2 beats overlap!)
        durationBeats: 8,
        offsetBeat: 0,
        gain: 1.0,
        laneIndex: 0,
      };

      track.clips = [clipA, clipB];

      const crossfadedTrack = applyAutoCrossfades(track);

      const resA = crossfadedTrack.clips.find((c) => c.id === "pad_a")!;
      const resB = crossfadedTrack.clips.find((c) => c.id === "pad_b")!;

      expect(resA.fadeOutBeats).toBe(2);
      expect(resB.fadeInBeats).toBe(2);
    });

    it("does not crossfade clips residing on different lanes", () => {
      const track = createTrack("audio", "Vocal Takes", 0);
      const clipA: StudioClip = {
        id: "take_1",
        trackId: track.id,
        type: "audio",
        name: "Take 1",
        startBeat: 0,
        durationBeats: 8,
        offsetBeat: 0,
        gain: 1.0,
        laneIndex: 0,
      };
      const clipB: StudioClip = {
        id: "take_2",
        trackId: track.id,
        type: "audio",
        name: "Take 2",
        startBeat: 4,
        durationBeats: 8,
        offsetBeat: 0,
        gain: 1.0,
        laneIndex: 1, // Different lane
      };

      track.clips = [clipA, clipB];

      const result = applyAutoCrossfades(track);
      expect(result.clips.find((c) => c.id === "take_1")!.fadeOutBeats).toBeUndefined();
      expect(result.clips.find((c) => c.id === "take_2")!.fadeInBeats).toBeUndefined();
    });
  });

  describe("duplicateAndMergeClip (Double Length — Hlm. 5453, 6371)", () => {
    it("duplicates clip and doubles duration duplicating MIDI notes", () => {
      const track = createTrack("midi", "Bassline", 0);
      const clip: StudioClip = {
        id: "bass_riff",
        trackId: track.id,
        type: "midi",
        name: "Synth Bass",
        startBeat: 0,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1.0,
        notes: [
          { id: "bn1", pitch: 36, startBeat: 0, durationBeats: 1, velocity: 100 },
          { id: "bn2", pitch: 38, startBeat: 2, durationBeats: 1, velocity: 100 },
        ],
      };
      track.clips = [clip];

      const { updatedTrack, doubleClip } = duplicateAndMergeClip(track, "bass_riff");

      expect(doubleClip).toBeDefined();
      expect(doubleClip!.durationBeats).toBe(8); // 4 * 2
      expect(doubleClip!.name).toBe("Synth Bass (2x)");
      expect(doubleClip!.notes).toHaveLength(4);

      // Check second loop notes are offset by 4 beats
      expect(doubleClip!.notes![2].pitch).toBe(36);
      expect(doubleClip!.notes![2].startBeat).toBe(4); // 0 + 4
      expect(doubleClip!.notes![3].pitch).toBe(38);
      expect(doubleClip!.notes![3].startBeat).toBe(6); // 2 + 4

      expect(updatedTrack.clips).toHaveLength(1);
    });
  });

  describe("Project Model Helpers", () => {
    it("merges selected clips inside StudioProject immutably", () => {
      const project = createEmptyProject("Merge Project");
      const track = project.tracks[0];
      const clip1: StudioClip = {
        id: "p_c1",
        trackId: track.id,
        type: "midi",
        name: "Part 1",
        startBeat: 0,
        durationBeats: 2,
        offsetBeat: 0,
        gain: 1.0,
      };
      const clip2: StudioClip = {
        id: "p_c2",
        trackId: track.id,
        type: "midi",
        name: "Part 2",
        startBeat: 2,
        durationBeats: 2,
        offsetBeat: 0,
        gain: 1.0,
      };
      track.clips = [clip1, clip2];

      const result = mergeSelectedClipsInProject(project, track.id, ["p_c1", "p_c2"]);

      expect(result.mergedClip).toBeDefined();
      const updatedTrack = result.project.tracks.find((t) => t.id === track.id)!;
      expect(updatedTrack.clips).toHaveLength(1);
      expect(updatedTrack.clips[0].durationBeats).toBe(4);
    });

    it("removes spaces inside StudioProject immutably", () => {
      const project = createEmptyProject("Remove Spaces Project");
      const track = project.tracks[1];
      track.clips = [
        { id: "r1", trackId: track.id, type: "audio", name: "R1", startBeat: 2, durationBeats: 2, offsetBeat: 0, gain: 1.0 },
        { id: "r2", trackId: track.id, type: "audio", name: "R2", startBeat: 8, durationBeats: 2, offsetBeat: 0, gain: 1.0 },
      ];

      const updatedProject = removeSpacesInProject(project, track.id);
      const updatedTrack = updatedProject.tracks.find((t) => t.id === track.id)!;

      expect(updatedTrack.clips[0].startBeat).toBe(2);
      expect(updatedTrack.clips[1].startBeat).toBe(4);
    });
  });
});
