import { describe, it, expect, vi, afterEach } from "vitest";
import { KaraokeEngine } from "@/lib/karaoke/engine";
import type { LyricLine } from "@/lib/karaoke/lrc";

const LINES: LyricLine[] = [
  { timeMs: 10_000, text: "satu" },
  { timeMs: 20_000, text: "dua" },
  { timeMs: 30_000, text: "tiga" },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("KaraokeEngine", () => {
  it("update() memilih baris dan hanya emit saat berubah", () => {
    const seen: Array<[string | null, number]> = [];
    const e = new KaraokeEngine(LINES, {
      onActiveLine: (l, i) => seen.push([l?.text ?? null, i]),
    });
    expect(e.update(5_000)).toBe(-1);
    expect(e.update(12_000)).toBe(0);
    expect(e.update(13_000)).toBe(0); // sama -> tidak emit ulang
    expect(e.update(25_000)).toBe(1);
    expect(seen).toEqual([[null, -1], ["satu", 0], ["dua", 1]]);
  });

  it("seek mundur kembali ke baris sebelumnya", () => {
    const e = new KaraokeEngine(LINES);
    expect(e.update(29_000)).toBe(1);
    expect(e.update(1_000)).toBe(-1);
  });

  it("offset pengguna menggeser tanpa reload", () => {
    const e = new KaraokeEngine(LINES);
    expect(e.update(21_000)).toBe(1);
    e.setOffsetMs(5_000); // tunda 5 dtk -> kembali ke baris 0
    expect(e.getOffsetMs()).toBe(5_000);
    expect(e.update(21_000)).toBe(0);
    e.setOffsetMs(-5_000); // majukan 5 dtk -> baris 1 tampil lebih awal
    expect(e.update(16_000)).toBe(1);
  });

  it("ganti video mereset indeks dan tidak bocor", () => {
    const seen: number[] = [];
    const e = new KaraokeEngine(LINES, { onActiveLine: (_l, i) => seen.push(i) });
    e.update(25_000);
    e.handleVideoChange();
    e.setLines([{ timeMs: 1_000, text: "baru" }]);
    expect(e.update(2_000)).toBe(0);
    expect(seen.at(-1)).toBe(0);
  });

  it("video berakhir mereset ke kondisi awal", () => {
    const seen: number[] = [];
    const e = new KaraokeEngine(LINES, { onActiveLine: (_l, i) => seen.push(i) });
    e.update(35_000);
    e.handlePlayerState("ended");
    expect(seen.at(-1)).toBe(-1);
  });

  it("detach membersihkan loop rAF (tidak ada timer menggantung)", () => {
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 42));
    const e = new KaraokeEngine(LINES);
    let t = 0;
    e.attach({ getCurrentTime: () => (t += 10) });
    expect(e.isAttached).toBe(true);
    e.detach();
    expect(e.isAttached).toBe(false);
    expect(cancel).toHaveBeenCalledWith(42);
  });

  it("provider yang melempar tidak merusak engine", () => {
    const e = new KaraokeEngine(LINES);
    e.attach({
      getCurrentTime: () => {
        throw new Error("player belum siap");
      },
    });
    e.detach(); // selesai tanpa error
  });
});
