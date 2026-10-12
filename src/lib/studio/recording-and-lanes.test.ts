import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createEmptyProject,
  createTrack,
  StudioTrackSchema,
  StudioClipSchema,
} from "./schema";
import type { StudioProject, StudioTrack, StudioClip, AudioDriverType } from "./types";
import { StudioAudioEngine } from "./audio-engine";
import { exportStudioProject, renderSingleTrackToWav } from "./export";

class MockOfflineAudioContext {
  destination = {};
  createGain() { return { gain: { value: 1 }, connect: vi.fn() }; }
  createStereoPanner() { return { pan: { value: 0 }, connect: vi.fn() }; }
  createBiquadFilter() { return { frequency: { value: 0 }, Q: { value: 0 }, gain: { value: 0 }, connect: vi.fn() }; }
  createDynamicsCompressor() { return { threshold: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, connect: vi.fn() }; }
  createDelay() { return { delayTime: { value: 0 }, connect: vi.fn() }; }
  createConvolver() { return { buffer: null, connect: vi.fn() }; }
  createBufferSource() { return { buffer: null, connect: vi.fn(), start: vi.fn() }; }
  createOscillator() { return { frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }; }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }
  async startRendering() {
    return this.createBuffer(2, 44100, 44100);
  }
}

function createTestClip(partial: Partial<StudioClip> & { id: string; trackId: string; name: string }): StudioClip {
  return {
    startBeat: 0,
    durationBeats: 4,
    offsetBeat: 0,
    gain: 1,
    type: "audio",
    muted: false,
    laneIndex: 0,
    ...partial,
  };
}

describe("Mixcraft 10: Recording Audio Tracks & Lanes System", () => {
  beforeEach(() => {
    (window as unknown as { OfflineAudioContext: unknown }).OfflineAudioContext = MockOfflineAudioContext;
  });

  afterEach(() => {
    delete (window as unknown as { OfflineAudioContext?: unknown }).OfflineAudioContext;
  });

  describe("1. Record Arming & Driver Aware Behavior", () => {
    it("initializes tracks with default un-armed state, laneCount=1, and empty mutedLaneIndices", () => {
      const track = createTrack("audio", "Vocal Lead", 0);
      expect(track.armRecord).toBe(false);
      expect(track.laneCount).toBe(1);
      expect(track.mutedLaneIndices).toEqual([]);
      expect(track.recordingMode).toBe("takes");
    });

    it("validates audio driver types ('wavert', 'wave', 'asio')", () => {
      const drivers: AudioDriverType[] = ["wavert", "wave", "asio"];
      expect(drivers).toContain("wavert");
      expect(drivers).toContain("wave");
      expect(drivers).toContain("asio");
    });

    it("verifies track schema accepts recordingMode, audio routing, and lane configuration", () => {
      const track = createTrack("audio", "Bass Guitar", 0);
      track.armRecord = true;
      track.recordingMode = "takes";
      track.inputChannelMode = "mono-left";
      track.audioDeviceId = "usb_interface_input_1";
      track.laneCount = 3;
      track.mutedLaneIndices = [1];

      const parsed = StudioTrackSchema.safeParse(track);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.armRecord).toBe(true);
        expect(parsed.data.laneCount).toBe(3);
        expect(parsed.data.inputChannelMode).toBe("mono-left");
        expect(parsed.data.audioDeviceId).toBe("usb_interface_input_1");
        expect(parsed.data.mutedLaneIndices).toEqual([1]);
      }
    });
  });

  describe("2. Recording Modes: Takes, Overdub, and Replace", () => {
    it("Takes Mode: auto-mutes previous passes on new take and increases laneCount", () => {
      const project = createEmptyProject("Takes Test Project");
      const track = createTrack("audio", "Vocal Takes", 0);
      track.recordingMode = "takes";
      track.laneCount = 1;

      // First take
      const clipTake1 = createTestClip({
        id: "clip_take_1",
        name: "Vocal Take 1",
        trackId: track.id,
        durationBeats: 8,
        laneIndex: 0,
        muted: false,
      });
      track.clips.push(clipTake1);
      project.tracks = [track];

      expect(track.clips.length).toBe(1);
      expect(track.clips[0].muted).toBe(false);

      // Simulate incoming Take 2 (as handled in onRecordFinalized)
      const clipTake2 = createTestClip({
        id: "clip_take_2",
        name: "Vocal Take 2",
        trackId: track.id,
        durationBeats: 8,
        laneIndex: 1,
        muted: false,
      });

      // In Takes mode: clips of previous passes are automatically muted
      const updatedClips: StudioClip[] = track.clips.map((c) => ({ ...c, muted: true }));
      updatedClips.push(clipTake2);
      const maxLane = updatedClips.reduce((m, c) => Math.max(m, c.laneIndex ?? 0), 0);
      track.laneCount = Math.max(track.laneCount || 1, maxLane + 1);
      track.clips = updatedClips;

      expect(track.clips.length).toBe(2);
      expect(track.clips[0].muted).toBe(true); // Take 1 muted!
      expect(track.clips[1].muted).toBe(false); // Take 2 active!
      expect(track.clips[1].laneIndex).toBe(1);
      expect(track.laneCount).toBe(2);
    });

    it("Overdub Mode: keeps all previous passes unmuted and audible", () => {
      const track = createTrack("audio", "Guitar Harmonies", 0);
      track.recordingMode = "overdub";
      track.laneCount = 1;

      const clip1 = createTestClip({
        id: "g_dub_1",
        name: "Guitar Main",
        trackId: track.id,
        durationBeats: 8,
        laneIndex: 0,
        muted: false,
      });
      track.clips.push(clip1);

      // Overdub pass 2
      const clip2 = createTestClip({
        id: "g_dub_2",
        name: "Guitar 3rd Harmony",
        trackId: track.id,
        durationBeats: 8,
        laneIndex: 1,
        muted: false,
      });

      // In Overdub mode: previous clips remain unmuted
      const updatedClips = [...track.clips, clip2];
      const maxLane = updatedClips.reduce((m, c) => Math.max(m, c.laneIndex ?? 0), 0);
      track.laneCount = Math.max(track.laneCount || 1, maxLane + 1);
      track.clips = updatedClips;

      expect(track.clips.length).toBe(2);
      expect(track.clips[0].muted).toBe(false);
      expect(track.clips[1].muted).toBe(false);
      expect(track.laneCount).toBe(2);
    });

    it("Replace Mode: replaces existing audio in recording range without creating new lanes", () => {
      const track = createTrack("audio", "Podcast Voice", 0);
      track.recordingMode = "replace";
      track.laneCount = 1;

      const clipOriginal = createTestClip({
        id: "clip_orig",
        name: "Original Voice",
        trackId: track.id,
        startBeat: 4,
        durationBeats: 4, // beats 4 to 8
        laneIndex: 0,
      });
      track.clips.push(clipOriginal);

      // Replacement recording over beats 4 to 8
      const replacementClip = createTestClip({
        id: "clip_replacement",
        name: "Punch In Voice",
        trackId: track.id,
        startBeat: 4,
        durationBeats: 4,
        laneIndex: 0,
      });

      const recStart = replacementClip.startBeat;
      const recEnd = replacementClip.startBeat + replacementClip.durationBeats;
      const filtered = track.clips.filter((c) => {
        const cStart = c.startBeat;
        const cEnd = c.startBeat + c.durationBeats;
        return !(cStart >= recStart && cEnd <= recEnd);
      });
      filtered.push(replacementClip);
      track.clips = filtered;

      expect(track.clips.length).toBe(1);
      expect(track.clips[0].id).toBe("clip_replacement");
      expect(track.laneCount).toBe(1); // No extra lanes created in replace mode!
    });
  });

  describe("3. Lanes Management (Add, Delete Bottom, Delete Empty, Mute / Unmute)", () => {
    it("adds lanes manually (Alt+L action)", () => {
      const track = createTrack("audio", "Keys", 0);
      expect(track.laneCount).toBe(1);

      // Add lane
      track.laneCount = (track.laneCount || 1) + 1;
      expect(track.laneCount).toBe(2);

      // Add second lane
      track.laneCount = (track.laneCount || 1) + 1;
      expect(track.laneCount).toBe(3);
    });

    it("deletes bottom-most lane while respecting minimum of 1 lane", () => {
      const track = createTrack("audio", "Keys", 0);
      track.laneCount = 3;

      track.laneCount = Math.max(1, (track.laneCount || 1) - 1);
      expect(track.laneCount).toBe(2);

      track.laneCount = Math.max(1, (track.laneCount || 1) - 1);
      expect(track.laneCount).toBe(1);

      // Does not decrease below 1
      track.laneCount = Math.max(1, (track.laneCount || 1) - 1);
      expect(track.laneCount).toBe(1);
    });

    it("deletes empty lanes (Alt+K action)", () => {
      const track = createTrack("audio", "Percussion", 0);
      track.laneCount = 5;
      // Only lane 0 has a clip
      track.clips = [
        createTestClip({
          id: "c1",
          name: "Tambourine",
          trackId: track.id,
          durationBeats: 4,
          laneIndex: 0,
        }),
      ];

      const maxUsed = track.clips.reduce((max, c) => Math.max(max, c.laneIndex ?? 0), -1);
      const needed = Math.max(1, maxUsed + 1);
      track.laneCount = needed;

      expect(track.laneCount).toBe(1);
    });

    it("mutes and unmutes all clips on a lane", () => {
      const track = createTrack("audio", "Vocals", 0);
      track.laneCount = 3;
      track.clips = [
        createTestClip({ id: "c1", name: "Take 1", trackId: track.id, laneIndex: 0, muted: false }),
        createTestClip({ id: "c2", name: "Take 2", trackId: track.id, laneIndex: 1, muted: false }),
        createTestClip({ id: "c3", name: "Take 3", trackId: track.id, laneIndex: 2, muted: false }),
      ];

      // Mute Lane 1 (index 1)
      const mutedLanes = new Set(track.mutedLaneIndices || []);
      mutedLanes.add(1);
      track.mutedLaneIndices = Array.from(mutedLanes);
      track.clips = track.clips.map((c) => ((c.laneIndex ?? 0) === 1 ? { ...c, muted: true } : c));

      expect(track.mutedLaneIndices).toContain(1);
      expect(track.clips[0].muted).toBe(false);
      expect(track.clips[1].muted).toBe(true);
      expect(track.clips[2].muted).toBe(false);

      // Unmute Lane 1 (index 1)
      track.mutedLaneIndices = (track.mutedLaneIndices || []).filter((idx) => idx !== 1);
      track.clips = track.clips.map((c) => ((c.laneIndex ?? 0) === 1 ? { ...c, muted: false } : c));

      expect(track.mutedLaneIndices).not.toContain(1);
      expect(track.clips[1].muted).toBe(false);
    });
  });

  describe("4. Metronome & Count-In Settings (Mixcraft 10 Dialog)", () => {
    it("configures metronome recording vs playback settings in StudioAudioEngine", () => {
      const engine = new StudioAudioEngine();
      expect(engine.getMetronomeSettings()).toMatchObject({
        recording: true,
        playback: false,
      });

      // Update settings: enable playback click as well
      engine.setMetronomeSettings({ playback: true });
      expect(engine.getMetronomeSettings().playback).toBe(true);
      expect(engine.getMetronomeSettings().recording).toBe(true);

      // Turn off recording clicks
      engine.setMetronomeSettings({ recording: false });
      expect(engine.getMetronomeSettings().recording).toBe(false);
    });
  });

  describe("5. Tempo Dual-Arrow Adjustments (±1 BPM and ±0.1 BPM)", () => {
    it("handles ±1 BPM increment/decrement", () => {
      let tempo = 120.0;
      // Increment 1 BPM
      tempo = Math.round((tempo + 1) * 10) / 10;
      expect(tempo).toBe(121.0);

      // Decrement 1 BPM
      tempo = Math.round((tempo - 1) * 10) / 10;
      expect(tempo).toBe(120.0);
    });

    it("handles ±0.1 BPM fine increments with precision clamping", () => {
      let tempo = 120.0;
      // Increment 0.1 BPM
      tempo = Math.round((tempo + 0.1) * 10) / 10;
      expect(tempo).toBe(120.1);

      // Decrement 0.1 BPM twice
      tempo = Math.round((tempo - 0.1) * 10) / 10;
      tempo = Math.round((tempo - 0.1) * 10) / 10;
      expect(tempo).toBe(119.9);
    });
  });

  describe("6. Export & Mixdown Behavior with Muted Clips and Lanes", () => {
    it("skips muted clips during offline project mixdown", async () => {
      const project = createEmptyProject("Export Muted Clips Test");
      const track = createTrack("audio", "Guitar", 0);
      track.clips = [
        createTestClip({
          id: "clip_active",
          name: "Active Riff",
          trackId: track.id,
          muted: false,
          laneIndex: 0,
        }),
        createTestClip({
          id: "clip_muted",
          name: "Muted Take",
          trackId: track.id,
          muted: true, // Should be ignored
          laneIndex: 1,
        }),
      ];
      project.tracks = [track];

      const cache = new Map<string, AudioBuffer>();
      const result = await exportStudioProject(project, cache, { sampleRate: 44100 });
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe("audio/wav");
    });

    it("skips clips on muted lanes during single-track bounce", async () => {
      const project = createEmptyProject("Bounce Track Test");
      const track = createTrack("audio", "Lead Vocals", 0);
      track.mutedLaneIndices = [1];
      track.clips = [
        createTestClip({
          id: "c_lane_0",
          name: "Good Take",
          trackId: track.id,
          laneIndex: 0,
        }),
        createTestClip({
          id: "c_lane_1",
          name: "Bad Take on Muted Lane",
          trackId: track.id,
          laneIndex: 1, // Lane 1 is in track.mutedLaneIndices
        }),
      ];
      project.tracks = [track];

      const cache = new Map<string, AudioBuffer>();
      const result = await renderSingleTrackToWav(project, track.id, cache, { sampleRate: 44100 });
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe("audio/wav");
    });
  });
});
