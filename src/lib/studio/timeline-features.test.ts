import { describe, it, expect } from "vitest";
import type { StudioClip, StudioTrack, AutomationLane } from "./types";
import { createEmptyProject, createTrack, StudioClipSchema } from "./schema";
import { applyClipFades, reverseAudioBuffer } from "./export";

describe("Timeline Clip Splitting (Scissors Tool)", () => {
  it("splits a MIDI clip into two distinct clips and adjusts note timings", () => {
    const originalClip: StudioClip = {
      id: "clip_midi_1",
      trackId: "track_midi_1",
      type: "midi",
      name: "Piano Melody",
      startBeat: 0,
      durationBeats: 4,
      offsetBeat: 0,
      gain: 1.0,
      notes: [
        { id: "n1", pitch: 60, startBeat: 0.5, durationBeats: 1.0, velocity: 90 },
        { id: "n2", pitch: 64, startBeat: 2.5, durationBeats: 1.0, velocity: 85 },
      ],
    };

    const splitBeat = 2.0;
    const firstDuration = splitBeat - originalClip.startBeat; // 2.0
    const secondDuration = originalClip.durationBeats - firstDuration; // 2.0

    // Clip 1 should contain notes before beat 2.0
    const clip1Notes = (originalClip.notes || [])
      .filter((n) => n.startBeat < firstDuration)
      .map((n) => ({
        ...n,
        durationBeats: Math.min(n.durationBeats, firstDuration - n.startBeat),
      }));

    // Clip 2 should contain notes at or after beat 2.0, shifted relative to new start
    const clip2Notes = (originalClip.notes || [])
      .filter((n) => n.startBeat + n.durationBeats > firstDuration)
      .map((n) => {
        const newStart = Math.max(0, n.startBeat - firstDuration);
        const overhang = n.startBeat < firstDuration ? firstDuration - n.startBeat : 0;
        return {
          ...n,
          id: `n_split_${n.id}`,
          startBeat: newStart,
          durationBeats: Math.max(0.25, n.durationBeats - overhang),
        };
      });

    const clip1: StudioClip = {
      ...originalClip,
      durationBeats: firstDuration,
      notes: clip1Notes,
    };

    const clip2: StudioClip = {
      ...originalClip,
      id: "clip_midi_1_part2",
      name: `${originalClip.name} (Split)`,
      startBeat: splitBeat,
      durationBeats: secondDuration,
      offsetBeat: (originalClip.offsetBeat || 0) + firstDuration,
      notes: clip2Notes,
    };

    // Assertions
    expect(clip1.durationBeats).toBe(2.0);
    expect(clip1.notes).toHaveLength(1);
    expect(clip1.notes![0].pitch).toBe(60);
    expect(clip1.notes![0].startBeat).toBe(0.5);

    expect(clip2.startBeat).toBe(2.0);
    expect(clip2.durationBeats).toBe(2.0);
    expect(clip2.notes).toHaveLength(1);
    expect(clip2.notes![0].pitch).toBe(64);
    expect(clip2.notes![0].startBeat).toBe(0.5); // 2.5 - 2.0 = 0.5 relative to clip 2
  });

  it("splits an audio clip and correctly offsets audio playback position", () => {
    const audioClip: StudioClip = {
      id: "clip_audio_vocal",
      trackId: "track_vocal",
      type: "audio",
      name: "Lead Vocal",
      startBeat: 4.0,
      durationBeats: 8.0,
      offsetBeat: 0.0,
      gain: 0.95,
      assetId: "asset_vocal_raw",
    };

    const splitBeat = 7.0; // Inside 4.0 .. 12.0
    const firstDuration = splitBeat - audioClip.startBeat; // 3.0
    const secondDuration = audioClip.durationBeats - firstDuration; // 5.0

    const clip1: StudioClip = {
      ...audioClip,
      durationBeats: firstDuration,
    };

    const clip2: StudioClip = {
      ...audioClip,
      id: "clip_audio_vocal_p2",
      name: `${audioClip.name} (Split)`,
      startBeat: splitBeat,
      durationBeats: secondDuration,
      offsetBeat: (audioClip.offsetBeat || 0) + firstDuration, // 3.0 offset into audio buffer
    };

    expect(clip1.startBeat).toBe(4.0);
    expect(clip1.durationBeats).toBe(3.0);
    expect(clip1.offsetBeat).toBe(0.0);

    expect(clip2.startBeat).toBe(7.0);
    expect(clip2.durationBeats).toBe(5.0);
    expect(clip2.offsetBeat).toBe(3.0);
  });
});

describe("Automation Envelope Calculations", () => {
  it("interpolates volume points linearly across timeline beats", () => {
    const lane: AutomationLane = {
      id: "lane_vol",
      target: "volume",
      name: "Volume",
      enabled: true,
      points: [
        { beat: 0, value: 0.2 },
        { beat: 4, value: 1.0 },
      ],
    };

    // Calculate value at beat 2.0 (midway)
    const p1 = lane.points[0];
    const p2 = lane.points[1];
    const fraction = (2.0 - p1.beat) / (p2.beat - p1.beat);
    const interpolated = p1.value + fraction * (p2.value - p1.value);

    expect(interpolated).toBeCloseTo(0.6, 2);
  });

  it("clamps volume and pan automation boundaries reliably", () => {
    const clampVol = (v: number) => Math.max(0, Math.min(1.5, v));
    const clampPan = (p: number) => Math.max(-1, Math.min(1, p));

    expect(clampVol(-0.5)).toBe(0.0);
    expect(clampVol(2.0)).toBe(1.5);
    expect(clampPan(-1.5)).toBe(-1.0);
    expect(clampPan(1.2)).toBe(1.0);
  });
});

describe("Mixcraft 10 Non-Destructive Clip Edge Trimming (Hlm. 206–208)", () => {
  it("trims clip start edge non-destructively: advances startBeat and increases offsetBeat", () => {
    const initialClip: StudioClip = {
      id: "clip_vocal_raw",
      trackId: "track_vocal",
      type: "audio",
      name: "Lead Vocal",
      startBeat: 4.0,
      durationBeats: 8.0,
      offsetBeat: 0.0,
      gain: 1.0,
      assetId: "vocal_wav",
    };

    // User drags left resize handle to the right by 2.0 beats
    const deltaBeats = 2.0;
    const maxShift = initialClip.durationBeats - 0.25;
    const clampedShift = Math.min(maxShift, deltaBeats);
    const newStart = initialClip.startBeat + clampedShift; // 6.0
    const actualShift = newStart - initialClip.startBeat; // 2.0
    const newDur = initialClip.durationBeats - actualShift; // 6.0
    const newOffset = (initialClip.offsetBeat || 0) + actualShift; // 2.0

    const trimmedClip: StudioClip = {
      ...initialClip,
      startBeat: newStart,
      durationBeats: newDur,
      offsetBeat: newOffset,
    };

    expect(trimmedClip.startBeat).toBe(6.0);
    expect(trimmedClip.durationBeats).toBe(6.0);
    expect(trimmedClip.offsetBeat).toBe(2.0);
    // Total source extent remains identical (6.0 - 2.0 = 4.0 anchor point)
    expect(trimmedClip.startBeat - trimmedClip.offsetBeat).toBe(initialClip.startBeat - initialClip.offsetBeat);
  });

  it("trims clip end edge: adjusts durationBeats without altering startBeat or offsetBeat", () => {
    const initialClip: StudioClip = {
      id: "clip_guitar_raw",
      trackId: "track_guitar",
      type: "audio",
      name: "Guitar Riff",
      startBeat: 8.0,
      durationBeats: 16.0,
      offsetBeat: 2.0,
      gain: 1.0,
    };

    // User drags right resize handle to shrink by 4 beats
    const newDur = Math.max(0.25, initialClip.durationBeats - 4.0);
    const trimmedClip: StudioClip = {
      ...initialClip,
      durationBeats: newDur,
    };

    expect(trimmedClip.startBeat).toBe(8.0);
    expect(trimmedClip.offsetBeat).toBe(2.0);
    expect(trimmedClip.durationBeats).toBe(12.0);
  });
});

describe("Mixcraft 10 Fade Curves, Reverse Buffer & Pitch Shifting (Hlm. 210–222)", () => {
  it("schedules linear fade-in and fade-out ramps on an AudioParam", () => {
    const rampEvents: { type: string; value: number; time: number }[] = [];
    const mockAudioParam = {
      setValueAtTime: (value: number, time: number) => {
        rampEvents.push({ type: "set", value, time });
      },
      linearRampToValueAtTime: (value: number, time: number) => {
        rampEvents.push({ type: "ramp", value, time });
      },
    } as unknown as AudioParam;

    // 8-second clip with 1-second fade in and 2-second fade out, baseGain 0.8
    applyClipFades(mockAudioParam, 0.8, 10.0, 8.0, 1.0, 2.0);

    // Expect:
    // 1. set 0 at 10.0
    // 2. ramp to 0.8 at 11.0 (fade-in)
    // 3. set 0.8 at 16.0 (start of fade out)
    // 4. ramp to 0 at 18.0 (end of fade out)
    expect(rampEvents).toEqual([
      { type: "set", value: 0, time: 10.0 },
      { type: "ramp", value: 0.8, time: 11.0 },
      { type: "set", value: 0.8, time: 16.0 },
      { type: "ramp", value: 0, time: 18.0 },
    ]);
  });

  it("reverses audio buffer channel samples accurately", () => {
    const sampleRate = 44100;
    const length = 5;
    const testData = new Float32Array([0.1, 0.2, 0.5, 0.8, 1.0]);

    const mockCtx = {
      createBuffer: (channels: number, len: number, sRate: number) => {
        const dest = new Float32Array(len);
        return {
          numberOfChannels: channels,
          length: len,
          sampleRate: sRate,
          getChannelData: () => dest,
        } as unknown as AudioBuffer;
      },
    } as unknown as BaseAudioContext;

    const mockOrig = {
      numberOfChannels: 1,
      length,
      sampleRate,
      getChannelData: () => testData,
    } as unknown as AudioBuffer;

    const reversed = reverseAudioBuffer(mockCtx, mockOrig);
    const reversedData = reversed.getChannelData(0);

    expect(reversedData[0]).toBeCloseTo(1.0);
    expect(reversedData[1]).toBeCloseTo(0.8);
    expect(reversedData[2]).toBeCloseTo(0.5);
    expect(reversedData[3]).toBeCloseTo(0.2);
    expect(reversedData[4]).toBeCloseTo(0.1);
  });

  it("validates pitchShiftSemitones and reversed properties in StudioClipSchema", () => {
    const validClip = {
      id: "clip_pitch_test",
      trackId: "track_1",
      type: "audio",
      name: "Sample Transposed",
      startBeat: 0,
      durationBeats: 4,
      pitchShiftSemitones: 3, // Transposed +3 semitones
      reversed: true, // Reversed playback
    };

    const parsed = StudioClipSchema.safeParse(validClip);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pitchShiftSemitones).toBe(3);
      expect(parsed.data.reversed).toBe(true);
    }

    // Invalid pitch shift (> 24 semitones)
    const invalidClip = { ...validClip, pitchShiftSemitones: 30 };
    const invalidParsed = StudioClipSchema.safeParse(invalidClip);
    expect(invalidParsed.success).toBe(false);
  });
});

