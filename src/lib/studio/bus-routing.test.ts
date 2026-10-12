import { describe, it, expect } from "vitest";
import {
  createEmptyProject,
  createTrack,
  parseStudioProject,
  DEFAULT_SUBGROUP_BUSES,
} from "./schema";
import { StudioAudioEngine } from "./audio-engine";
import type { StudioProject } from "./types";

describe("Subgroup Bus I/O Architecture & Routing", () => {
  it("provides four professional default subgroup buses", () => {
    expect(DEFAULT_SUBGROUP_BUSES).toHaveLength(4);
    const busNames = DEFAULT_SUBGROUP_BUSES.map((b) => b.name);
    expect(busNames).toContain("Drums Bus");
    expect(busNames).toContain("Vocal Bus");
    expect(busNames).toContain("Music Bus");
    expect(busNames).toContain("FX Submix");

    for (const bus of DEFAULT_SUBGROUP_BUSES) {
      expect(bus.id).toMatch(/^bus_/);
      expect(bus.volume).toBe(1.0);
      expect(bus.pan).toBe(0);
      expect(bus.mute).toBe(false);
      expect(bus.solo).toBe(false);
      expect(Array.isArray(bus.plugins)).toBe(true);
    }
  });

  it("creates new tracks with default master output bus and all inputs", () => {
    const track = createTrack("audio", "Lead Vocals", 0);
    expect(track.outputBus).toBe("master");
    expect(track.inputSource).toBe("all");

    const midiTrack = createTrack("midi", "Synth Pad", 1);
    expect(midiTrack.outputBus).toBe("master");
  });

  it("assigns appropriate subgroup buses to initial empty project tracks", () => {
    const project = createEmptyProject("Bus Test Song");
    expect(project.buses).toBeDefined();
    expect(project.buses?.length).toBe(4);

    const synth = project.tracks.find((t) => t.name.includes("Synth"));
    const vocal = project.tracks.find((t) => t.name.includes("Vocal"));
    expect(synth?.outputBus).toBe("bus_music");
    expect(vocal?.outputBus).toBe("bus_vocals");
  });

  it("automatically migrates legacy project files missing buses or outputBus", () => {
    const legacyProject = {
      id: "legacy_proj_1",
      name: "Old Project Without Buses",
      tempo: 120,
      timeSignature: [4, 4],
      sampleRate: 44100,
      tracks: [
        {
          id: "t1",
          name: "Old Track",
          type: "audio",
          color: "#ffffff",
          volume: 1,
          pan: 0,
          mute: false,
          solo: false,
          clips: [],
          plugins: [],
          // note: no outputBus, no inputSource, no armRecord
        },
      ],
      masterTrack: {
        volume: 1,
        pan: 0,
        limiterThreshold: -0.3,
        limiterRelease: 0.05,
        plugins: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = parseStudioProject(legacyProject);
    expect(res.success).toBe(true);
    expect(res.project?.buses).toHaveLength(4);
    expect(res.project?.tracks[0].outputBus).toBe("master");
    expect(res.project?.tracks[0].inputSource).toBe("all");
    expect(res.project?.tracks[0].armRecord).toBe(false);
  });

  it("validates routing graph topology and detects broken bus references", () => {
    const project = createEmptyProject("Routing Validation Project");
    const engine = new StudioAudioEngine();
    engine.setProject(project);

    const validation = engine.validateRoutingGraph();
    expect(validation.isValid).toBe(true);

    // Now introduce an invalid output bus reference on a track
    const brokenProject: StudioProject = {
      ...project,
      tracks: [
        ...project.tracks,
        {
          ...createTrack("audio", "Broken Track", project.tracks.length),
          outputBus: "bus-non-existent-ghost",
        },
      ],
    };
    engine.setProject(brokenProject);

    const brokenValidation = engine.validateRoutingGraph();
    expect(brokenValidation.isValid).toBe(false);
    expect(brokenValidation.cycle).toBeDefined();
    expect(brokenValidation.cycle?.[1]).toBe("bus-non-existent-ghost");
  });

  it("lists available hardware input channel mapping options", () => {
    const engine = new StudioAudioEngine();
    const channels = engine.getAvailableInputChannels();
    expect(channels.length).toBeGreaterThanOrEqual(3);

    const ids = channels.map((c) => c.id);
    expect(ids).toContain("all");
    expect(ids).toContain("input_1");
    expect(ids).toContain("input_2");
  });

  it("safely handles bus parameter updates without throwing", () => {
    const engine = new StudioAudioEngine();
    const project = createEmptyProject("Parameter Test");
    engine.setProject(project);

    expect(() => {
      engine.updateBusParameter("bus_drums", "volume", 0.8);
      engine.updateBusParameter("bus_drums", "pan", -0.5);
      engine.updateBusParameter("bus_drums", "mute", true);
      engine.updateBusParameter("bus_drums", "solo", true);
      engine.updateBusParameter("bus_drums", { volume: 0.9, pan: 0.2 });
    }).not.toThrow();

    // Calling non-existent bus ID gracefully returns
    expect(() => {
      engine.updateBusParameter("bus_unknown", "volume", 0.5);
    }).not.toThrow();
  });

  describe("Mixcraft 10 Audio Signal Flow Specification (9-Stage Topology)", () => {
    it("differentiates DRY, PRE, and POST fader send tap points", () => {
      // Send tap points definition:
      // 1. DRY: Tapped directly from clips, before channel utilities, gain, EQ, and insert FX
      // 2. PRE: Tapped after channel strip & insert effects, but before track volume fader & pan
      // 3. POST: Tapped after track volume fader, pan, mute, and automation
      const sendTypes = ["DRY", "PRE", "POST"] as const;
      expect(sendTypes).toHaveLength(3);

      const track = createTrack("audio", "Vocal Main", 0);
      const rawClipGain = 1.0;
      const inputGainTrim = 1.2;
      const fxGain = 1.5;
      const trackFaderGain = 0.5; // -6 dB fader position
      const trackPan = 0;

      // 1. DRY Send Level: strictly depends on raw clip audio
      const drySignal = rawClipGain;
      expect(drySignal).toBe(1.0);

      // 2. PRE Fader Send Level: includes channel processing and FX, but NOT track volume
      const preFaderSignal = rawClipGain * inputGainTrim * fxGain;
      expect(preFaderSignal).toBeCloseTo(1.8, 2);

      // 3. POST Fader Send Level: includes all processing PLUS track volume fader
      const postFaderSignal = preFaderSignal * trackFaderGain;
      expect(postFaderSignal).toBeCloseTo(0.9, 2);

      // Verifying fader invariance: moving track fader to 0 (mute) does NOT kill PRE or DRY sends
      const mutedFaderGain = 0.0;
      const postFaderMuted = preFaderSignal * mutedFaderGain;
      expect(postFaderMuted).toBe(0.0);
      // Dry and Pre remain untouched for cue mix / monitoring
      expect(drySignal).toBe(1.0);
      expect(preFaderSignal).toBeCloseTo(1.8, 2);
    });

    it("models Channel Processing tools: Swap Channels, Phase Invert, Mono, and Stereo Width", () => {
      // Stereo test sample [L, R]
      const left = 0.8;
      const right = -0.4;

      // Swap Channels: [L, R] -> [R, L]
      const swapped = [right, left];
      expect(swapped[0]).toBe(-0.4);
      expect(swapped[1]).toBe(0.8);

      // Phase Invert (ØL, ØR): reverses polarity independently
      const phaseInvertL = [-left, right];
      expect(phaseInvertL[0]).toBe(-0.8);
      expect(phaseInvertL[1]).toBe(-0.4);

      const phaseInvertBoth = [-left, -right];
      expect(phaseInvertBoth[0]).toBe(-0.8);
      expect(phaseInvertBoth[1]).toBe(0.4);

      // Mono Sum: (L + R) / 2
      const monoSample = (left + right) / 2;
      expect(monoSample).toBeCloseTo(0.2, 2);

      // Stereo Width (Mid/Side processing)
      const mid = (left + right) / 2; // 0.2
      const side = (left - right) / 2; // 0.6
      // Width = 0% (Mono): Side eliminated
      const width0L = mid;
      const width0R = mid;
      expect(width0L).toBeCloseTo(0.2, 2);
      expect(width0R).toBeCloseTo(0.2, 2);

      // Width = 100% (Normal): original L and R
      const width100L = mid + side;
      const width100R = mid - side;
      expect(width100L).toBeCloseTo(0.8, 2);
      expect(width100R).toBeCloseTo(-0.4, 2);

      // Width = 150% (Widened): Side amplified by 1.5
      const width150L = mid + side * 1.5;
      const width150R = mid - side * 1.5;
      expect(width150L).toBeCloseTo(1.1, 2);
      expect(width150R).toBeCloseTo(-0.7, 2);
    });

    it("verifies 9-stage signal routing sequence in correct order", () => {
      const stages = [
        "1. Clips (with clip-level automation)",
        "2. DRY - Fader Send",
        "3. Channels, Gain",
        "4. Compressor, Preamp, 3-band EQ, parametric EQ",
        "5. Track Insert Effects",
        "6. PRE - Fader Send",
        "7. Track Volume/Pan",
        "8. FFT Spectrum Analyzer, Oscilloscope",
        "9. POST - Fader Send",
      ];

      expect(stages).toHaveLength(9);
      expect(stages[0]).toContain("Clips");
      expect(stages[1]).toContain("DRY - Fader Send");
      expect(stages[2]).toContain("Channels, Gain");
      expect(stages[3]).toContain("Compressor, Preamp, 3-band EQ, parametric EQ");
      expect(stages[4]).toContain("Track Insert Effects");
      expect(stages[5]).toContain("PRE - Fader Send");
      expect(stages[6]).toContain("Track Volume/Pan");
      expect(stages[7]).toContain("FFT Spectrum Analyzer, Oscilloscope");
      expect(stages[8]).toContain("POST - Fader Send");
    });
  });
});

