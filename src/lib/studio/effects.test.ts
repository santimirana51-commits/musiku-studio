import { describe, it, expect, vi } from "vitest";
import {
  INTERNAL_EFFECTS_CATALOG,
  buildEffectChain,
} from "./effects";
import type { PluginInstance } from "./types";

function createMockAudioContext() {
  const mkParam = (v = 0) => ({
    value: v,
    setValueAtTime: vi.fn(),
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
      frequency: mkParam(1.5),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => ({
      ...mkNode(),
      type: "lowpass",
      frequency: mkParam(1000),
      Q: mkParam(1.0),
      gain: mkParam(0),
    })),
    createDynamicsCompressor: vi.fn(() => ({
      ...mkNode(),
      threshold: mkParam(-18),
      ratio: mkParam(4),
      attack: mkParam(0.01),
      release: mkParam(0.1),
      knee: mkParam(0),
    })),
    createConvolver: vi.fn(() => ({
      ...mkNode(),
      buffer: null,
    })),
    createDelay: vi.fn(() => ({
      ...mkNode(),
      delayTime: mkParam(0.3),
    })),
    createWaveShaper: vi.fn(() => ({
      ...mkNode(),
      curve: null,
      oversample: "none",
    })),
    createStereoPanner: vi.fn(() => ({
      ...mkNode(),
      pan: mkParam(0),
    })),
    createBuffer: vi.fn((_ch: number, len: number) => ({
      getChannelData: () => new Float32Array(len),
    })),
  } as unknown as BaseAudioContext;
}

describe("Studio Internal Effects Suite", () => {
  it("contains all required professional audio effects in the catalog", () => {
    const ids = INTERNAL_EFFECTS_CATALOG.map((e) => e.id);
    expect(ids).toContain("internal.eq3");
    expect(ids).toContain("internal.compressor");
    expect(ids).toContain("internal.limiter");
    expect(ids).toContain("internal.noisegate");
    expect(ids).toContain("internal.reverb");
    expect(ids).toContain("internal.delay");
    expect(ids).toContain("internal.filter");
    expect(ids).toContain("internal.distortion");
    expect(ids).toContain("internal.chorus");
    expect(ids).toContain("internal.utility");

    for (const effect of INTERNAL_EFFECTS_CATALOG) {
      expect(effect.name).toBeTruthy();
      expect(effect.parameters.length).toBeGreaterThan(0);
      for (const param of effect.parameters) {
        expect(param.id).toBeTruthy();
        expect(param.defaultValue).toBeGreaterThanOrEqual(param.min);
        expect(param.defaultValue).toBeLessThanOrEqual(param.max);
      }
    }
  });

  it("builds an empty effect chain connecting input to output", () => {
    const ctx = createMockAudioContext();
    const handle = buildEffectChain(ctx, []);
    expect(handle).toBeDefined();
    expect(handle.inputNode).toBeDefined();
    expect(handle.outputNode).toBeDefined();
  });

  it("builds a complex multi-effect chain and updates parameters and bypass", () => {
    const ctx = createMockAudioContext();
    const plugins: PluginInstance[] = [
      {
        id: "inst_eq",
        pluginId: "internal.eq3",
        name: "3-Band EQ",
        enabled: true,
        parameters: { lowGain: 3, midGain: -2, highGain: 4 },
      },
      {
        id: "inst_comp",
        pluginId: "internal.compressor",
        name: "Compressor",
        enabled: true,
        parameters: { threshold: -16, ratio: 4 },
      },
      {
        id: "inst_dist",
        pluginId: "internal.distortion",
        name: "Overdrive",
        enabled: true,
        parameters: { drive: 40, mix: 0.6 },
      },
      {
        id: "inst_gate",
        pluginId: "internal.noisegate",
        name: "Noise Gate",
        enabled: true,
        parameters: { threshold: -40 },
      },
    ];

    const handle = buildEffectChain(ctx, plugins);
    expect(handle).toBeDefined();

    // Test parameter updating
    expect(() => {
      handle.updateParameter("inst_eq", "lowGain", 6);
      handle.updateParameter("inst_comp", "threshold", -24);
      handle.updateParameter("inst_dist", "drive", 50);
    }).not.toThrow();

    // Test bypass toggling
    expect(() => {
      handle.setBypass("inst_eq", true);
      handle.setBypass("inst_eq", false);
    }).not.toThrow();
  });
});
