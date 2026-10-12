import { describe, it, expect } from "vitest";
import {
  parseLrc,
  validateLrc,
  findActiveIndex,
  sanitizeLyricText,
  LRC_MAX_CHARS,
  type LyricLine,
} from "@/lib/karaoke/lrc";

const SAMPLE = `[ti:Separuh Aku]
[ar:NOAH]
[offset:+500]
[00:10.00]Baris pertama
[00:15.50]Baris kedua
[00:20.00][00:25.00]Baris ganda
[00:30]Tanpa fraksi
`;

describe("parseLrc", () => {
  it("memparse timestamp, metadata, dan offset file", () => {
    const r = parseLrc(SAMPLE);
    expect(r.metadata.title).toBe("Separuh Aku");
    expect(r.metadata.artist).toBe("NOAH");
    expect(r.metadata.fileOffsetMs).toBe(500);
    // 1 + 1 + 2 + 1 = 5 baris, terurut
    expect(r.lines).toHaveLength(5);
    expect(r.lines[0].timeMs).toBe(10_500);
    expect(r.lines[0].text).toBe("Baris pertama");
    expect(r.lines[1].timeMs).toBe(16_000); // 15.50s + 500ms
    expect(r.errors).toHaveLength(0);
  });

  it("mendukung fraksi 1 dan 3 digit", () => {
    const r = parseLrc("[00:01.5]a\n[00:02.250]b");
    expect(r.lines[0].timeMs).toBe(1500);
    expect(r.lines[1].timeMs).toBe(2250);
  });

  it("lirik kosong dan format tidak valid dilaporkan", () => {
    expect(parseLrc("").lines).toHaveLength(0);
    expect(parseLrc("").errors.length).toBeGreaterThan(0);
    const r = parseLrc("hanya teks tanpa timestamp\n[99:99.99]detik invalid");
    expect(r.lines).toHaveLength(0);
    expect(r.errors).toHaveLength(2);
  });

  it("menolak input melebihi batas ukuran", () => {
    const r = parseLrc("x".repeat(LRC_MAX_CHARS + 1));
    expect(r.lines).toHaveLength(0);
    expect(r.errors[0].reason).toMatch(/melebihi/i);
  });

  it("menyanitasi tag HTML dari teks lirik", () => {
    expect(sanitizeLyricText('<script>alert(1)</script> halo <b>x</b>')).toBe("alert(1) halo x");
  });

  it("validateLrc memberi pesan ramah untuk format salah", () => {
    const v = validateLrc("bukan lirik");
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/mm:ss/i);
  });
});

describe("findActiveIndex", () => {
  const lines: LyricLine[] = [
    { timeMs: 10_000, text: "a" },
    { timeMs: 20_000, text: "b" },
    { timeMs: 30_000, text: "c" },
  ];

  it("memilih baris terakhir yang waktunya tiba", () => {
    expect(findActiveIndex(lines, 0)).toBe(-1);
    expect(findActiveIndex(lines, 10_000)).toBe(0);
    expect(findActiveIndex(lines, 25_000)).toBe(1);
    expect(findActiveIndex(lines, 99_000)).toBe(2);
  });

  it("offset positif menunda, negatif memajukan baris aktif", () => {
    // Tanpa offset pada 21 dtk -> baris 1 (20 dtk). Offset +2 dtk menunda
    // (20+2 > 21) sehingga tetap baris 0.
    expect(findActiveIndex(lines, 21_000)).toBe(1);
    expect(findActiveIndex(lines, 21_000, 2_000)).toBe(0);
    // Offset -2 dtk memajukan: pada 19 dtk baris 1 sudah tampil (20-2 <= 19).
    expect(findActiveIndex(lines, 19_000)).toBe(0);
    expect(findActiveIndex(lines, 19_000, -2_000)).toBe(1);
  });

  it("seek mundur kembali ke baris awal", () => {
    expect(findActiveIndex(lines, 29_000)).toBe(1);
    expect(findActiveIndex(lines, 5_000)).toBe(-1);
  });
});
