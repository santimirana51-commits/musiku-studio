import { describe, it, expect, vi } from "vitest";
import {
  midiPitchToFreq,
  SYNTH_PRESETS,
  scheduleSynthNote,
  scheduleDrumSound,
  type DrumSoundType,
} from "./synth";
import type { MidiNote, SynthSettings } from "./types";

function createMockAudioContext() {
  const mkParam = (v = 0) => ({
    value: v,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });

  const mkNode = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  return {
    sampleRate: 44100,
    currentTime: 0,
    createGain: vi.fn(() => ({
      ...mkNode(),
      gain: mkParam(1.0),
    })),
    createOscillator: vi.fn(() => ({
      ...mkNode(),
      type: "sine",
      frequency: mkParam(440),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    })),
    createBiquadFilter: vi.fn(() => ({
      ...mkNode(),
      type: "lowpass",
      frequency: mkParam(1000),
      Q: mkParam(1.0),
      gain: mkParam(0),
    })),
    createBuffer: vi.fn((_ch: number, len: number) => ({
      getChannelData: () => new Float32Array(len),
    })),
    createBufferSource: vi.fn(() => ({
      ...mkNode(),
      buffer: null,
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    })),
  } as unknown as BaseAudioContext;
}

describe("Studio Virtual Instruments & Synth Engine", () => {
  it("converts MIDI note pitch to frequency correctly", () => {
    // A4 (69) should be exactly 440 Hz
    expect(midiPitchToFreq(69)).toBeCloseTo(440, 2);
    // A3 (57) should be 220 Hz
    expect(midiPitchToFreq(57)).toBeCloseTo(220, 2);
    // A5 (81) should be 880 Hz
    expect(midiPitchToFreq(81)).toBeCloseTo(880, 2);
    // C4 (60) should be ~261.63 Hz
    expect(midiPitchToFreq(60)).toBeCloseTo(261.63, 1);
  });

  it("contains valid synth presets across categories", () => {
    expect(SYNTH_PRESETS.length).toBeGreaterThanOrEqual(5);
    for (const preset of SYNTH_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(["bass", "lead", "pad", "pluck", "keys"]).toContain(preset.category);
      expect(["sine", "sawtooth", "square", "triangle"]).toContain(preset.settings.waveform);
      expect(preset.settings.attack).toBeGreaterThan(0);
      expect(preset.settings.decay).toBeGreaterThan(0);
      expect(preset.settings.sustain).toBeGreaterThanOrEqual(0);
      expect(preset.settings.sustain).toBeLessThanOrEqual(1);
      expect(preset.settings.filterCutoff).toBeGreaterThanOrEqual(20);
    }
  });

  it("schedules a polyphonic synth note with ADSR envelope in AudioContext", () => {
    const audioCtx = createMockAudioContext();
    const destination = audioCtx.createGain();

    const note: MidiNote = {
      id: "note_1",
      pitch: 60,
      startBeat: 0,
      durationBeats: 1,
      velocity: 100,
    };

    const settings: SynthSettings = {
      waveform: "sawtooth",
      attack: 0.01,
      decay: 0.1,
      sustain: 0.5,
      release: 0.2,
      filterCutoff: 2000,
      filterResonance: 2.0,
      volume: 0.8,
    };

    const handle = scheduleSynthNote(audioCtx, destination, note, settings, 0.1, 0.5);
    expect(handle).toBeDefined();
    expect(handle.osc).toBeDefined();
    expect(handle.gain).toBeDefined();
    expect(handle.osc.type).toBe("sawtooth");
  });

  it("schedules all procedural drum sound types without error", () => {
    const audioCtx = createMockAudioContext();
    const destination = audioCtx.createGain();

    const drumSounds: DrumSoundType[] = ["kick", "snare", "clap", "hihat_closed", "hihat_open", "perc"];

    for (const sound of drumSounds) {
      expect(() => {
        scheduleDrumSound(audioCtx, destination, sound, 0.1, 100);
      }).not.toThrow();
    }
  });
});
