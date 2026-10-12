import { describe, it, expect } from "vitest";
import {
  checkMusicFile,
  splitArtistTitle,
  formatBytes,
  formatDuration,
  maxFileBytes,
} from "@/lib/local-library/validators";

const MB = 1048576;

describe("checkMusicFile", () => {
  it("menerima MP3/WAV/OGG/FLAC/M4A/AAC", () => {
    for (const [name, mime] of [
      ["lagu.mp3", "audio/mpeg"],
      ["rekaman.wav", "audio/wav"],
      ["musik.ogg", "audio/ogg"],
      ["audio.flac", "audio/flac"],
      ["suara.m4a", "audio/mp4"],
      ["nada.aac", "audio/aac"],
    ]) {
      expect(checkMusicFile(name, mime, 1000, 50 * MB).ok).toBe(true);
    }
  });

  it("menolak format tak didukung", () => {
    const r = checkMusicFile("video.mp4", "video/mp4", 1000, 50 * MB);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/tidak didukung/i);
  });

  it("mentolerir mime generik bila ekstensi valid", () => {
    expect(checkMusicFile("lagu.mp3", "application/octet-stream", 1000, 50 * MB).ok).toBe(true);
  });

  it("menolak melebihi batas ukuran", () => {
    const r = checkMusicFile("besar.mp3", "audio/mpeg", 60 * MB, 50 * MB);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/50 MB/);
  });

  it("menolak ukuran nol/invalid", () => {
    expect(checkMusicFile("x.mp3", "audio/mpeg", 0, 50 * MB).ok).toBe(false);
  });
});

describe("maxFileBytes", () => {
  it("default 50MB, env valid dipakai, tak wajar dibatasi", () => {
    expect(maxFileBytes()).toBe(50 * MB);
    expect(maxFileBytes("20")).toBe(20 * MB);
    expect(maxFileBytes("nol")).toBe(50 * MB);
    expect(maxFileBytes("9999")).toBe(500 * MB);
  });
});

describe("splitArtistTitle", () => {
  it("'Artis - Judul' dipecah; tanpa pemisah jadi judul", () => {
    expect(splitArtistTitle("NOAH - Separuh Aku.mp3")).toEqual({ artist: "NOAH", title: "Separuh Aku" });
    expect(splitArtistTitle("instrumental.mp3")).toEqual({ artist: "", title: "instrumental" });
  });
});

describe("format", () => {
  it("formatBytes & formatDuration", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * MB)).toBe("5.0 MB");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(NaN)).toBe("--:--");
  });
});
