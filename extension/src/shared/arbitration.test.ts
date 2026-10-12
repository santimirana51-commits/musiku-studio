import { describe, it, expect } from "vitest";
import { pickAudibleTab, resolveActiveSource, isMusikuUrl } from "./arbitration.js";
import { clampDb, presetGains, EQ_PRESETS } from "./eq.js";
import type { SourceState } from "./media-types.js";

function src(id: string): SourceState {
  return {
    id, kind: "generic-tab", media: { title: "", artist: "", artwork: "", duration: NaN, position: 0, playing: false },
    caps: { play: false, pause: false, next: false, prev: false, seek: false, mute: true, eq: false },
    statusNote: "Kontrol terbatas",
  };
}

describe("arbitrasi multi-tab", () => {
  it("tanpa audible -> null", () => {
    expect(pickAudibleTab([{ tabId: 1, audible: false, active: true, lastSeen: 1 }])).toBeNull();
  });

  it("audible+aktif menang atas audible latar", () => {
    const r = pickAudibleTab([
      { tabId: 1, audible: true, active: false, lastSeen: 200 },
      { tabId: 2, audible: true, active: true, lastSeen: 100 },
    ]);
    expect(r).toBe(2);
  });

  it("tanpa yang aktif: terbaru menang", () => {
    const r = pickAudibleTab([
      { tabId: 1, audible: true, active: false, lastSeen: 50 },
      { tabId: 2, audible: true, active: false, lastSeen: 90 },
    ]);
    expect(r).toBe(2);
  });

  it("pilihan user dipertahankan bila masih ada; fallback local", () => {
    const sources = [src("local"), src("tab:7")];
    expect(resolveActiveSource(sources, "tab:7", 9)).toBe("tab:7");
    expect(resolveActiveSource(sources, "tab:hilang", 9)).toBe("local");
    expect(resolveActiveSource([src("tab:7")], null, 7)).toBe("tab:7");
    expect(resolveActiveSource([], null, null)).toBeNull();
  });
});

describe("isMusikuUrl", () => {
  it("localhost & domain musiku cocok; situs lain tidak", () => {
    expect(isMusikuUrl("http://localhost:3000/watch")).toBe(true);
    expect(isMusikuUrl("https://app.musiku.id/")).toBe(true);
    expect(isMusikuUrl("https://youtube.com/watch")).toBe(false);
    expect(isMusikuUrl(undefined)).toBe(false);
    expect(isMusikuUrl("bukan-url")).toBe(false);
  });
});

describe("eq ekstensi", () => {
  it("6 preset 10 nilai dalam batas", () => {
    expect(EQ_PRESETS.map((p) => p.name)).toEqual(["flat", "bass", "pop", "rock", "jazz", "vocal"]);
    for (const p of EQ_PRESETS) {
      expect(p.gains).toHaveLength(10);
      expect(presetGains(p.name)).toEqual(p.gains);
    }
    expect(presetGains("tak-ada")).toBeNull();
    expect(clampDb(99)).toBe(12);
    expect(clampDb(NaN)).toBe(0);
  });
});
