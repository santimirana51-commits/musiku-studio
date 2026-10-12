import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BiquadFilter,
  separateAudioBufferIntoStems,
  createStemSeparationTracks,
  saveSeparatedStemsToStorage,
  createAudioBuffer,
  DEFAULT_STEM_SEPARATION_OPTIONS,
  type StemSeparationOptions,
} from "./stem-separation";
import { createEmptyProject, createTrack } from "./schema";
import type { StudioClip, StudioProject } from "./types";
import * as storage from "./storage";

function createSyntheticMixdownBuffer(
  sampleRate = 44100,
  durationSec = 0.5
): AudioBuffer {
  const length = Math.floor(sampleRate * durationSec);
  const buf = createAudioBuffer(2, length, sampleRate);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // 1. Bass: 80Hz sine (panned center)
    const bass = Math.sin(2 * Math.PI * 80 * t) * 0.4;
    // 2. Vocals: 1000Hz sine (panned center)
    const vocal = Math.sin(2 * Math.PI * 1000 * t) * 0.3;
    // 3. Drums: Transient burst at t=0.1s and t=0.3s
    const isTransient = (i >= sampleRate * 0.1 && i < sampleRate * 0.105) ||
                        (i >= sampleRate * 0.3 && i < sampleRate * 0.305);
    const drum = isTransient ? (Math.random() * 2 - 1) * 0.6 : 0;
    // 4. Guitars / Other: Stereo panned 500Hz sine
    const otherL = Math.sin(2 * Math.PI * 500 * t) * 0.35;
    const otherR = -Math.sin(2 * Math.PI * 500 * t) * 0.35;

    left[i] = bass + vocal + drum + otherL;
    right[i] = bass + vocal + drum + otherR;
  }

  return buf;
}

describe("Mixcraft 10 Stem Separation DSP Engine (MC10-ADV-105)", () => {
  describe("BiquadFilter DSP", () => {
    it("attenuates high frequencies with Lowpass configuration", () => {
      const filter = new BiquadFilter();
      const sampleRate = 44100;
      filter.setLowpass(200, sampleRate);

      // Low frequency test (60 Hz)
      let lowEnergy = 0;
      for (let i = 0; i < 500; i++) {
        const sample = Math.sin((2 * Math.PI * 60 * i) / sampleRate);
        const out = filter.process(sample);
        if (i > 100) lowEnergy += Math.abs(out);
      }

      filter.reset();
      // High frequency test (5000 Hz)
      let highEnergy = 0;
      for (let i = 0; i < 500; i++) {
        const sample = Math.sin((2 * Math.PI * 5000 * i) / sampleRate);
        const out = filter.process(sample);
        if (i > 100) highEnergy += Math.abs(out);
      }

      expect(highEnergy).toBeLessThan(lowEnergy * 0.1);
    });

    it("attenuates low frequencies with Highpass configuration", () => {
      const filter = new BiquadFilter();
      const sampleRate = 44100;
      filter.setHighpass(1000, sampleRate);

      // Low frequency (80 Hz)
      let lowEnergy = 0;
      for (let i = 0; i < 500; i++) {
        const sample = Math.sin((2 * Math.PI * 80 * i) / sampleRate);
        const out = filter.process(sample);
        if (i > 100) lowEnergy += Math.abs(out);
      }

      filter.reset();
      // High frequency (4000 Hz)
      let highEnergy = 0;
      for (let i = 0; i < 500; i++) {
        const sample = Math.sin((2 * Math.PI * 4000 * i) / sampleRate);
        const out = filter.process(sample);
        if (i > 100) highEnergy += Math.abs(out);
      }

      expect(lowEnergy).toBeLessThan(highEnergy * 0.1);
    });
  });

  describe("separateAudioBufferIntoStems", () => {
    it("separates synthetic stereo mixdown into 4 discrete stems (Vocals, Drums, Bass, Other)", async () => {
      const buffer = createSyntheticMixdownBuffer(44100, 0.2);
      const progressSteps: number[] = [];

      const stems = await separateAudioBufferIntoStems(
        buffer,
        DEFAULT_STEM_SEPARATION_OPTIONS,
        (pct) => progressSteps.push(pct)
      );

      expect(stems.length).toBe(4);
      expect(stems.map((s) => s.type)).toEqual(["vocals", "drums", "bass", "other"]);

      // Verify each stem has valid AudioBuffer and WAV Blob
      for (const stem of stems) {
        expect(stem.buffer.numberOfChannels).toBe(2);
        expect(stem.buffer.length).toBe(buffer.length);
        expect(stem.blob).toBeDefined();
        expect(stem.blob!.type).toBe("audio/wav");
        expect(stem.blob!.size).toBeGreaterThan(44);
        expect(stem.assetId).toContain(`asset_stem_${stem.type}_`);
      }

      // Check progress reporting
      expect(progressSteps.length).toBeGreaterThan(0);
      expect(progressSteps[progressSteps.length - 1]).toBe(100);
    });

    it("supports 5-stem separation including Piano when enabled", async () => {
      const buffer = createSyntheticMixdownBuffer(44100, 0.1);
      const options: StemSeparationOptions = {
        ...DEFAULT_STEM_SEPARATION_OPTIONS,
        models: {
          vocals: true,
          drums: true,
          bass: true,
          piano: true,
          other: true,
        },
      };

      const stems = await separateAudioBufferIntoStems(buffer, options);
      expect(stems.length).toBe(5);
      expect(stems.some((s) => s.type === "piano")).toBe(true);
    });

    it("supports 2-stem Karaoke mode (Vocals + Backing Instrumental)", async () => {
      const buffer = createSyntheticMixdownBuffer(44100, 0.1);
      const options: StemSeparationOptions = {
        ...DEFAULT_STEM_SEPARATION_OPTIONS,
        models: {
          vocals: true,
          drums: false,
          bass: false,
          piano: false,
          other: true,
        },
      };

      const stems = await separateAudioBufferIntoStems(buffer, options);
      expect(stems.length).toBe(2);
      expect(stems[0].type).toBe("vocals");
      expect(stems[1].type).toBe("other");
    });

    it("preserves total signal energy without loss via residual reconstruction", async () => {
      const buffer = createSyntheticMixdownBuffer(44100, 0.1);
      const stems = await separateAudioBufferIntoStems(buffer, {
        ...DEFAULT_STEM_SEPARATION_OPTIONS,
        models: {
          vocals: true,
          drums: true,
          bass: true,
          piano: false,
          other: true, // Residual active
        },
      });

      const inL = buffer.getChannelData(0);
      const inR = buffer.getChannelData(1);

      // Sum all stem buffers together
      const sumL = new Float32Array(buffer.length);
      const sumR = new Float32Array(buffer.length);

      for (const stem of stems) {
        const sL = stem.buffer.getChannelData(0);
        const sR = stem.buffer.getChannelData(1);
        for (let i = 0; i < buffer.length; i++) {
          sumL[i] += sL[i];
          sumR[i] += sR[i];
        }
      }

      // Check reconstruction accuracy: maximum absolute difference should be minimal (< 1e-4)
      let maxDiff = 0;
      for (let i = 0; i < buffer.length; i++) {
        maxDiff = Math.max(maxDiff, Math.abs(inL[i] - sumL[i]), Math.abs(inR[i] - sumR[i]));
      }

      expect(maxDiff).toBeLessThan(1e-4);
    });
  });

  describe("createStemSeparationTracks Project Integration", () => {
    let project: StudioProject;
    let sourceTrack: any;
    let sourceClip: StudioClip;

    beforeEach(() => {
      project = createEmptyProject("Stem Test Project");
      sourceTrack = project.tracks[1]; // Audio Track
      sourceClip = {
        id: "source_clip_1",
        trackId: sourceTrack.id,
        type: "audio",
        name: "Full Song Mix",
        startBeat: 4,
        durationBeats: 16,
        offsetBeat: 0,
        gain: 1.0,
        muted: false,
        assetId: "asset_orig_123",
      };
      sourceTrack.clips.push(sourceClip);
    });

    it("creates Submix track and child tracks when createSubmixTrack is enabled (Hlm. 650)", async () => {
      const buffer = createSyntheticMixdownBuffer(44100, 0.1);
      const stems = await separateAudioBufferIntoStems(buffer, DEFAULT_STEM_SEPARATION_OPTIONS);

      const result = createStemSeparationTracks(
        project,
        sourceTrack.id,
        sourceClip.id,
        stems,
        {
          ...DEFAULT_STEM_SEPARATION_OPTIONS,
          createSubmixTrack: true,
          muteSourceClip: true,
        }
      );

      expect(result.submixTrackId).toBeDefined();
      expect(result.createdTrackIds.length).toBe(5); // 1 submix + 4 stem tracks

      // Original clip is muted
      const updatedSourceTrack = result.project.tracks.find((t) => t.id === sourceTrack.id)!;
      const updatedSourceClip = updatedSourceTrack.clips.find((c) => c.id === sourceClip.id)!;
      expect(updatedSourceClip.muted).toBe(true);

      // Verify submix track
      const submixTrack = result.project.tracks.find((t) => t.id === result.submixTrackId)!;
      expect(submixTrack.type).toBe("submix");
      expect(submixTrack.name).toContain("Submix: Full Song Mix Stems");

      // Verify child tracks
      const stemTracks = result.project.tracks.filter((t) => t.submixTrackId === result.submixTrackId);
      expect(stemTracks.length).toBe(4);
      for (const st of stemTracks) {
        expect(st.clips.length).toBe(1);
        const sc = st.clips[0];
        expect(sc.startBeat).toBe(4);
        expect(sc.durationBeats).toBe(16);
        expect(sc.muted).toBe(false);
      }

      // Check asset manifest
      for (const stem of stems) {
        expect(result.project.assetManifest[stem.assetId]).toBeDefined();
        expect(result.project.assetManifest[stem.assetId].name).toBe(`Full Song Mix - ${stem.name}`);
      }
    });

    it("creates standard audio tracks directly when createSubmixTrack is false", async () => {
      const buffer = createSyntheticMixdownBuffer(44100, 0.1);
      const stems = await separateAudioBufferIntoStems(buffer, {
        ...DEFAULT_STEM_SEPARATION_OPTIONS,
        models: { vocals: true, drums: true, bass: false, piano: false, other: false },
      });

      const result = createStemSeparationTracks(
        project,
        sourceTrack.id,
        sourceClip.id,
        stems,
        {
          ...DEFAULT_STEM_SEPARATION_OPTIONS,
          createSubmixTrack: false,
          muteSourceClip: false,
        }
      );

      expect(result.submixTrackId).toBeUndefined();
      expect(result.createdTrackIds.length).toBe(2);

      // Source clip remains unmuted
      const updatedSourceClip = result.project.tracks
        .find((t) => t.id === sourceTrack.id)!
        .clips.find((c) => c.id === sourceClip.id)!;
      expect(updatedSourceClip.muted).toBe(false);
    });

    it("throws clear error when source track or clip does not exist", () => {
      expect(() => {
        createStemSeparationTracks(project, "non_existent_track", sourceClip.id, []);
      }).toThrowError(/Track sumber non_existent_track tidak ditemukan/);

      expect(() => {
        createStemSeparationTracks(project, sourceTrack.id, "non_existent_clip", []);
      }).toThrowError(/Klip sumber non_existent_clip tidak ditemukan/);
    });
  });

  describe("saveSeparatedStemsToStorage", () => {
    it("persists all generated stem blobs into IndexedDB audio blobs store", async () => {
      const saveSpy = vi.spyOn(storage, "saveAudioBlob").mockResolvedValue(undefined);
      const buffer = createSyntheticMixdownBuffer(44100, 0.1);
      const stems = await separateAudioBufferIntoStems(buffer, DEFAULT_STEM_SEPARATION_OPTIONS);

      await saveSeparatedStemsToStorage(stems);

      expect(saveSpy).toHaveBeenCalledTimes(stems.length);
      for (const stem of stems) {
        expect(saveSpy).toHaveBeenCalledWith(stem.assetId, stem.blob);
      }
      saveSpy.mockRestore();
    });
  });
});
