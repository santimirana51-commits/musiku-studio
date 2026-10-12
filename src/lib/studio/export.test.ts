import { describe, it, expect } from "vitest";
import {
  encodeWavBlob,
  validateWavBlob,
  exportProjectStems,
  type StemExportOptions,
} from "./export";
import { createEmptyProject, createTrack } from "./schema";

function createMockAudioBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    const data = new Float32Array(length);
    // Fill with gentle sine wave
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }
    channelData.push(data);
  }

  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (c: number) => channelData[c],
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

describe("WAV Audio Encoder & Validator", () => {
  it("encodes 16-bit stereo AudioBuffer into valid RIFF WAV Blob", async () => {
    const sampleRate = 44100;
    const durationSec = 1.0;
    const buffer = createMockAudioBuffer(2, sampleRate * durationSec, sampleRate);

    const blob = encodeWavBlob(buffer, 16, false);
    expect(blob).toBeDefined();
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + sampleRate * durationSec * 2 * 2);

    const validation = await validateWavBlob(blob);
    expect(validation.valid).toBe(true);
    expect(validation.channels).toBe(2);
    expect(validation.sampleRate).toBe(44100);
    expect(Math.round(validation.duration ?? 0)).toBe(1);
  });

  it("encodes 24-bit stereo AudioBuffer with normalization", async () => {
    const sampleRate = 48000;
    const durationSec = 0.5;
    const buffer = createMockAudioBuffer(2, sampleRate * durationSec, sampleRate);

    const blob = encodeWavBlob(buffer, 24, true);
    expect(blob.size).toBe(44 + sampleRate * durationSec * 2 * 3);

    const validation = await validateWavBlob(blob);
    expect(validation.valid).toBe(true);
    expect(validation.sampleRate).toBe(48000);
  });

  it("rejects truncated or corrupted binary blobs honestly", async () => {
    const corruptBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/wav" });
    const result = await validateWavBlob(corruptBlob);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("terlalu kecil");
  });
});

describe("Mixcraft 10 Mix Down To Stems (MC10-EXP-102 — Hlm. 500–501)", () => {
  it("renders selected multitrack stems aligned from time zero (TEST-EXP-STEMS-01)", async () => {
    const project = createEmptyProject("Demo Song");
    // Track 1 has MIDI notes
    // Add audio clip to Track 2
    const track2 = project.tracks[1];
    track2.clips.push({
      id: "clip_vocal_1",
      trackId: track2.id,
      type: "audio",
      name: "Lead Vocal",
      startBeat: 2,
      durationBeats: 4,
      offsetBeat: 0,
      gain: 1.0,
      assetId: "vocal_asset_1",
    });

    const cachedBuffers = new Map<string, AudioBuffer>();
    cachedBuffers.set(
      "vocal_asset_1",
      createMockAudioBuffer(2, 44100 * 2, 44100)
    );

    const progressReports: number[] = [];
    const options: StemExportOptions = {
      sampleRate: 44100,
      bitDepth: 16,
      muteTrackEffects: false,
    };

    const stems = await exportProjectStems(
      project,
      cachedBuffers,
      options,
      (pct) => progressReports.push(pct)
    );

    // Should render all tracks with clips (Track 1 & Track 2)
    expect(stems.length).toBe(2);
    expect(stems[0].trackName).toBe(project.tracks[0].name);
    expect(stems[1].trackName).toBe(project.tracks[1].name);

    // Verify filename format includes project and track info
    expect(stems[0].fileName).toMatch(/Demo_Song_Track1_.*\.wav/);
    expect(stems[1].fileName).toMatch(/Demo_Song_Track2_.*\.wav/);

    // Verify all stems share identical duration from time zero
    expect(stems[0].durationSeconds).toBe(stems[1].durationSeconds);

    // Verify blob validation
    const val0 = await validateWavBlob(stems[0].blob);
    expect(val0.valid).toBe(true);
    expect(val0.channels).toBe(2);
    expect(val0.sampleRate).toBe(44100);

    const val1 = await validateWavBlob(stems[1].blob);
    expect(val1.valid).toBe(true);
  });

  it("exports only specified track IDs when selectedTrackIds is provided", async () => {
    const project = createEmptyProject("Partial Stem Song");
    const cachedBuffers = new Map<string, AudioBuffer>();

    const options: StemExportOptions = {
      selectedTrackIds: [project.tracks[0].id],
    };

    const stems = await exportProjectStems(project, cachedBuffers, options);
    expect(stems.length).toBe(1);
    expect(stems[0].trackId).toBe(project.tracks[0].id);
  });

  it("honors muteTrackEffects option for dry stems export (Hlm. 501)", async () => {
    const project = createEmptyProject("Dry Stems Song");
    const cachedBuffers = new Map<string, AudioBuffer>();

    const options: StemExportOptions = {
      muteTrackEffects: true,
    };

    const stems = await exportProjectStems(project, cachedBuffers, options);
    expect(stems.length).toBeGreaterThan(0);
    expect(stems[0].blob.size).toBeGreaterThan(44);
  });
});
