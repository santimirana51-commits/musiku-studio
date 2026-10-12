import { describe, it, expect } from "vitest";
import {
  DEFAULT_CHANNEL_STRIP_SETTINGS,
  dbToLinearGain,
  linearGainToDb,
  calculateCompressorParams,
  createDriveCurve,
  sanitizeChannelStripSettings,
  createChannelStripNodes,
} from "./channel-strip";
import type { ChannelStripSettings } from "./types";

describe("Mixcraft 10 Channel Strip DSP & Modules (Hlm. 367–376)", () => {
  describe("Decibel & Gain Conversions", () => {
    it("converts dB to linear gain accurately", () => {
      expect(dbToLinearGain(0)).toBeCloseTo(1.0, 4);
      expect(dbToLinearGain(6)).toBeCloseTo(1.995, 2);
      expect(dbToLinearGain(-6)).toBeCloseTo(0.501, 2);
      expect(dbToLinearGain(15)).toBeCloseTo(5.623, 2);
      expect(dbToLinearGain(-15)).toBeCloseTo(0.1778, 2);
    });

    it("converts linear gain to dB accurately", () => {
      expect(linearGainToDb(1.0)).toBeCloseTo(0, 2);
      expect(linearGainToDb(2.0)).toBeCloseTo(6.02, 1);
      expect(linearGainToDb(0.5)).toBeCloseTo(-6.02, 1);
      expect(linearGainToDb(0)).toBe(-100);
    });
  });

  describe("Integrated Compressor Model (Mixcraft 10 Hlm. 368)", () => {
    it("computes default compressor parameters at knob 0", () => {
      const p = calculateCompressorParams(0);
      expect(p.thresholdDb).toBe(0);
      expect(p.ratio).toBe(3.0);
      expect(p.attackSeconds).toBeCloseTo(0.03, 3);
      expect(p.releaseSeconds).toBe(0.15);
      expect(p.makeupGainLinear).toBeCloseTo(1.0, 3);
    });

    it("increases squashing and shortens attack as threshold knob turns clockwise", () => {
      const pLow = calculateCompressorParams(25);
      const pMid = calculateCompressorParams(50);
      const pHigh = calculateCompressorParams(100);

      // Threshold descends from 0 towards -36 dB
      expect(pLow.thresholdDb).toBeGreaterThan(pMid.thresholdDb);
      expect(pMid.thresholdDb).toBeGreaterThan(pHigh.thresholdDb);
      expect(pHigh.thresholdDb).toBe(-36);

      // Ratio increases
      expect(pLow.ratio).toBeLessThan(pMid.ratio);
      expect(pMid.ratio).toBeLessThan(pHigh.ratio);
      expect(pHigh.ratio).toBe(8.0);

      // Attack time shortens (from 30ms down to 5ms) for faster transient clamping
      expect(pLow.attackSeconds).toBeGreaterThan(pMid.attackSeconds);
      expect(pMid.attackSeconds).toBeGreaterThan(pHigh.attackSeconds);
      expect(pHigh.attackSeconds).toBeCloseTo(0.005, 3);

      // Auto-makeup gain compensates volume loss
      expect(pHigh.makeupGainLinear).toBeGreaterThan(pMid.makeupGainLinear);
      expect(pMid.makeupGainLinear).toBeGreaterThan(pLow.makeupGainLinear);
    });
  });

  describe("Drive Preamp Saturation Curve (Mixcraft 10 Hlm. 369)", () => {
    it("generates linear curve when drive is 0", () => {
      const curve = createDriveCurve(0);
      expect(curve.length).toBe(44100);
      expect(curve[0]).toBeCloseTo(-1.0, 2);
      expect(curve[Math.floor(curve.length / 2)]).toBeCloseTo(0.0, 2);
      expect(curve[curve.length - 1]).toBeCloseTo(1.0, 2);
    });

    it("generates soft-saturating sigmoid curve when drive is engaged", () => {
      const curve = createDriveCurve(60);
      expect(curve.length).toBe(44100);
      // Extremities stay bounded between -1 and 1 without harsh overflow
      expect(curve[0]).toBeGreaterThanOrEqual(-1.5);
      expect(curve[curve.length - 1]).toBeLessThanOrEqual(1.5);

      // Center remains 0
      expect(curve[Math.floor(curve.length / 2)]).toBeCloseTo(0.0, 2);
    });
  });

  describe("Settings Sanitization & Defaults", () => {
    it("supplies full default channel strip when null or empty", () => {
      const s = sanitizeChannelStripSettings(null);
      expect(s.preGain).toBe(0);
      expect(s.compressorEnabled).toBe(false);
      expect(s.compressorThreshold).toBe(0);
      expect(s.driveEnabled).toBe(false);
      expect(s.driveAmount).toBe(0);
      expect(s.eqEnabled).toBe(true);
      expect(s.eqMode).toBe("3band");
      expect(s.eqLow).toBe(0);
      expect(s.eqMid).toBe(0);
      expect(s.eqHigh).toBe(0);
      expect(s.parametricHigh?.freq).toBe(8000);
      expect(s.parametricMid2?.freq).toBe(2500);
      expect(s.parametricMid1?.freq).toBe(600);
      expect(s.parametricLow?.freq).toBe(100);
    });

    it("preserves custom user parameters while filling gaps", () => {
      const custom: Partial<ChannelStripSettings> = {
        preGain: 3.5,
        compressorEnabled: true,
        compressorThreshold: 45,
        driveEnabled: true,
        driveAmount: 25,
        eqMode: "parametric",
        parametricMid1: { freq: 450, gain: -4.0, q: 1.5, mode: "bell" },
      };
      const s = sanitizeChannelStripSettings(custom);
      expect(s.preGain).toBe(3.5);
      expect(s.compressorEnabled).toBe(true);
      expect(s.compressorThreshold).toBe(45);
      expect(s.driveEnabled).toBe(true);
      expect(s.driveAmount).toBe(25);
      expect(s.eqMode).toBe("parametric");
      expect(s.parametricMid1?.freq).toBe(450);
      expect(s.parametricMid1?.gain).toBe(-4.0);
      expect(s.parametricMid1?.q).toBe(1.5);
      // Untouched parametric bands still retain valid defaults
      expect(s.parametricHigh?.freq).toBe(8000);
      expect(s.parametricLow?.freq).toBe(100);
    });
  });

  describe("Web Audio Node Construction & Lifecycle", () => {
    it("builds and connects Channel Strip nodes with mock AudioContext", () => {
      // Mock BaseAudioContext
      const mockGainNode = () => ({
        gain: {
          value: 1.0,
          setTargetAtTime: () => {},
          setValueAtTime: () => {},
        },
        connect: () => {},
        disconnect: () => {},
      });

      const mockBiquad = () => ({
        type: "lowshelf",
        frequency: { value: 100 },
        Q: { value: 1.0 },
        gain: { value: 0 },
        connect: () => {},
        disconnect: () => {},
      });

      const mockCompressor = () => ({
        threshold: { value: 0 },
        ratio: { value: 4 },
        attack: { value: 0.02 },
        release: { value: 0.15 },
        connect: () => {},
        disconnect: () => {},
      });

      const mockWaveShaper = () => ({
        curve: null as Float32Array | null,
        oversample: "none",
        connect: () => {},
        disconnect: () => {},
      });

      const mockCtx = {
        currentTime: 0,
        sampleRate: 44100,
        createGain: mockGainNode,
        createBiquadFilter: mockBiquad,
        createDynamicsCompressor: mockCompressor,
        createWaveShaper: mockWaveShaper,
      } as unknown as BaseAudioContext;

      const handle = createChannelStripNodes(mockCtx, {
        preGain: -3.0,
        compressorEnabled: true,
        compressorThreshold: 50,
        driveEnabled: true,
        driveAmount: 30,
        eqLow: 2.0,
        eqMid: -1.5,
        eqHigh: 3.0,
      });

      expect(handle).toBeDefined();
      expect(handle.inputNode).toBeDefined();
      expect(handle.outputNode).toBeDefined();

      // Test dynamic parameter update
      expect(() => {
        handle.updateSettings({
          preGain: 6.0,
          driveAmount: 50,
          eqMode: "parametric",
          parametricLow: { freq: 80, gain: 4, mode: "shelf" },
        });
      }).not.toThrow();

      // Test clean disposal
      expect(() => {
        handle.dispose();
      }).not.toThrow();
    });
  });
});
