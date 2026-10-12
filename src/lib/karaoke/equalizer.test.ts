import { describe, it, expect, beforeEach } from "vitest";
import {
  EQ_BANDS,
  EQ_PRESETS,
  EQ_MIN_DB,
  EQ_MAX_DB,
  clampDb,
  getPreset,
  matchPreset,
  loadEqSettings,
  saveEqSettings,
  DEFAULT_EQ_SETTINGS,
} from "@/lib/karaoke/equalizer";

beforeEach(() => {
  try { localStorage.clear(); } catch {}
});

describe("equalizer presets", () => {
  it("10 band dengan frekuensi yang diminta", () => {
    expect(EQ_BANDS.map((b) => b.freq)).toEqual([32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);
  });

  it("6 preset tersedia dan konsisten 10 nilai dalam ±12 dB", () => {
    expect(EQ_PRESETS.map((p) => p.name)).toEqual(["flat", "bass", "vocal", "pop", "rock", "jazz"]);
    for (const p of EQ_PRESETS) {
      expect(p.gains).toHaveLength(10);
      for (const g of p.gains) {
        expect(g).toBeGreaterThanOrEqual(EQ_MIN_DB);
        expect(g).toBeLessThanOrEqual(EQ_MAX_DB);
      }
    }
  });

  it("flat semua nol; bass boost menonjolkan frekuensi rendah", () => {
    expect(getPreset("flat")?.gains.every((g) => g === 0)).toBe(true);
    const bass = getPreset("bass")!.gains;
    expect(bass[0]).toBeGreaterThan(0);
    expect(bass[0]).toBeGreaterThan(bass[9]);
  });

  it("matchPreset mengenali preset, custom bila diubah", () => {
    expect(matchPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe("flat");
    expect(matchPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 1])).toBeNull();
  });

  it("clampDb membatasi ±12 dan non-finite menjadi 0", () => {
    expect(clampDb(99)).toBe(EQ_MAX_DB);
    expect(clampDb(-99)).toBe(EQ_MIN_DB);
    expect(clampDb(NaN)).toBe(0);
    expect(clampDb(3.5)).toBe(3.5);
  });
});

describe("penyimpanan preferensi", () => {
  it("round-trip save/load", () => {
    saveEqSettings({ ...DEFAULT_EQ_SETTINGS, preset: "rock", gains: [...(getPreset("rock")!.gains)], echo: 0.5 });
    const loaded = loadEqSettings();
    expect(loaded.preset).toBe("rock");
    expect(loaded.gains).toEqual(getPreset("rock")!.gains);
    expect(loaded.echo).toBe(0.5);
  });

  it("JSON rusak atau bentuk salah kembali ke default aman", () => {
    localStorage.setItem("musikku:eq-settings", "{bukan json");
    expect(loadEqSettings().preset).toBe("flat");
    localStorage.setItem("musikku:eq-settings", JSON.stringify({ gains: [1, 2] }));
    expect(loadEqSettings().gains).toHaveLength(10);
  });

  it("monitor selalu false saat dimuat (anti feedback)", () => {
    saveEqSettings({ ...DEFAULT_EQ_SETTINGS, monitor: true });
    expect(loadEqSettings().monitor).toBe(false);
  });
});
