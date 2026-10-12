import { describe, it, expect } from "vitest";
import { SourceRegistry } from "./registry.js";

const TAB = (tabId: number, extra: Partial<Parameters<SourceRegistry["upsertTab"]>[0]> = {}) => ({
  tabId, title: `Tab ${tabId}`, url: "https://example.com/", audible: true, muted: false, active: false, ...extra,
});

describe("SourceRegistry", () => {
  it("upsert tab generik hanya mampu mute (jujur)", () => {
    const r = new SourceRegistry();
    const s = r.upsertTab(TAB(1), { isMusiku: false, hasAccess: false });
    expect(s.caps).toMatchObject({ play: false, seek: false, mute: true, eq: false });
    expect(s.statusNote).toBe("Kontrol terbatas");
  });

  it("tab musiku berizin + ada media: play/pause/seek, tanpa next/prev/EQ", () => {
    const r = new SourceRegistry();
    const s = r.upsertTab(TAB(2), { isMusiku: true, hasAccess: true, hasMedia: true });
    expect(s.caps).toMatchObject({ play: true, pause: true, seek: true, next: false, prev: false, eq: false });
  });

  it("prune menghapus yang tak lagi audible + seleksi ikut bersih", () => {
    const r = new SourceRegistry();
    r.upsertTab(TAB(1), { isMusiku: false, hasAccess: false });
    r.upsertTab(TAB(2), { isMusiku: false, hasAccess: false });
    expect(r.select("tab:1")).toBe(true);
    r.prune(new Set([2]));
    expect(r.list().map((s) => s.id)).toEqual(["tab:2"]);
    expect(r.selected).toBeNull();
    expect(r.select("tab:99")).toBe(false);
  });

  it("local sebagai fallback aktif", () => {
    const r = new SourceRegistry();
    expect(r.active(null)).toBeNull();
    r.setLocal({
      id: "local", kind: "local",
      media: { title: "Lagu", artist: "", artwork: "", duration: 60, position: 0, playing: true },
      caps: { play: true, pause: true, next: true, prev: true, seek: true, mute: false, eq: true },
      statusNote: "EQ tersedia",
    });
    expect(r.active(null)?.id).toBe("local");
    r.setLocal(null);
    expect(r.active(null)).toBeNull();
  });
});
