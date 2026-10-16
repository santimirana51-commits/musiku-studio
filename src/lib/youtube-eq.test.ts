import { describe, it, expect, beforeEach } from "vitest";
import {
  YOUTUBE_EQ_10_BANDS,
  YOUTUBE_EQ_5_BANDS,
  YOUTUBE_EQ_PRESETS,
  CHROME_EXTENSION_INFO,
  loadYoutubeEqState,
  saveYoutubeEqState,
  DEFAULT_YOUTUBE_EQ_STATE,
  type YoutubeEqState,
  youtubeEqEngineSingleton,
} from "./youtube-eq";

describe("YouTube EQ Module", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("provides valid frequency band configurations", () => {
    expect(YOUTUBE_EQ_10_BANDS).toHaveLength(10);
    expect(YOUTUBE_EQ_5_BANDS).toHaveLength(5);
    expect(YOUTUBE_EQ_10_BANDS[0].freq).toBe(32);
    expect(YOUTUBE_EQ_10_BANDS[9].freq).toBe(16000);
  });

  it("contains rich presets with valid gains range", () => {
    expect(YOUTUBE_EQ_PRESETS.length).toBeGreaterThanOrEqual(10);
    for (const preset of YOUTUBE_EQ_PRESETS) {
      expect(preset.gains10).toHaveLength(10);
      for (const gain of preset.gains10) {
        expect(gain).toBeGreaterThanOrEqual(-12);
        expect(gain).toBeLessThanOrEqual(12);
      }
    }
  });

  it("contains valid Chrome Extension information", () => {
    expect(CHROME_EXTENSION_INFO.id).toBe("mhnbanaoklmlgpgpkpbaeijloamdmenb");
    expect(CHROME_EXTENSION_INFO.url).toContain("chromewebstore.google.com");
  });

  it("persists and restores state from localStorage", () => {
    const customState: YoutubeEqState = {
      enabled: true,
      bandCount: 10,
      preset: "bass_boost",
      gains10: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
      preamp: 2,
    };
    saveYoutubeEqState(customState);
    const loaded = loadYoutubeEqState();
    expect(loaded.preset).toBe("bass_boost");
    expect(loaded.gains10[0]).toBe(7);
    expect(loaded.preamp).toBe(2);
  });

  it("persists and restores state with outputVolume and feedbackGuard", () => {
    const customState: YoutubeEqState = {
      enabled: true,
      bandCount: 10,
      preset: "bass_boost",
      gains10: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
      preamp: 2,
      outputVolume: 1.2,
      feedbackGuard: true,
    };
    saveYoutubeEqState(customState);
    const loaded = loadYoutubeEqState();
    expect(loaded.preset).toBe("bass_boost");
    expect(loaded.gains10[0]).toBe(7);
    expect(loaded.preamp).toBe(2);
    expect(loaded.outputVolume).toBe(1.2);
    expect(loaded.feedbackGuard).toBe(true);
  });

  it("handles output volume and feedback guard in engine", () => {
    youtubeEqEngineSingleton.setOutputVolume(1.25);
    expect(youtubeEqEngineSingleton.getOutputVolume()).toBe(1.25);

    youtubeEqEngineSingleton.setFeedbackGuard(false);
    expect(youtubeEqEngineSingleton.getFeedbackGuard()).toBe(false);
    youtubeEqEngineSingleton.setFeedbackGuard(true);
    expect(youtubeEqEngineSingleton.getFeedbackGuard()).toBe(true);

    youtubeEqEngineSingleton.setOutputMuted(true);
    expect(youtubeEqEngineSingleton.getIsOutputMuted()).toBe(true);
    youtubeEqEngineSingleton.setOutputMuted(false);
    expect(youtubeEqEngineSingleton.getIsOutputMuted()).toBe(false);

    youtubeEqEngineSingleton.resetGainStaging();
    expect(youtubeEqEngineSingleton.getOutputVolume()).toBe(1.0);
    expect(youtubeEqEngineSingleton.getIsOutputMuted()).toBe(false);

    const diag = youtubeEqEngineSingleton.getDiagnostics();
    expect(diag).toHaveProperty("isConnected");
    expect(diag).toHaveProperty("preEqLevel");
    expect(diag).toHaveProperty("postEqLevel");
    expect(diag).toHaveProperty("isClipping");
    expect(diag).toHaveProperty("feedbackGuardEnabled");
  });

  it("falls back to defaults on corrupted localStorage", () => {
    localStorage.setItem("musikku:youtube-eq", "{ invalid json");
    const loaded = loadYoutubeEqState();
    expect(loaded).toEqual(DEFAULT_YOUTUBE_EQ_STATE);
  });
});
