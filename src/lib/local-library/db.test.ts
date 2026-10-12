import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  addTrack,
  getAllTracks,
  deleteTrack,
  updateTrack,
  isQuotaError,
  type LocalTrackRecord,
} from "@/lib/local-library/db";

function rec(partial: Partial<LocalTrackRecord> = {}): LocalTrackRecord {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    title: "Judul",
    artist: "Artis",
    album: "",
    fileName: "lagu.mp3",
    mime: "audio/mpeg",
    size: 12,
    duration: 65,
    blob: new Blob(["0123456789ab"], { type: "audio/mpeg" }),
    lrcText: "",
    source: "local",
    importedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("IndexedDB library", () => {
  it("tambah, baca semua, ubah, hapus (persistensi blob)", async () => {
    const r = rec();
    await addTrack(r);
    let all = await getAllTracks();
    expect(all.some((t) => t.id === r.id)).toBe(true);
    const found = all.find((t) => t.id === r.id)!;
    // Catatan: fake-indexeddb tak melestarikan Blob lintas realm (keterbatasan
    // test); di browser asli Blob round-trip via structured clone. Di sini
    // cukup pastikan record + metadata utuh dan blob ada.
    expect(found.blob).toBeTruthy();
    expect(found.title).toBe("Judul");
    expect(found.size).toBe(12);

    await updateTrack(r.id, { title: "Judul Baru", lrcText: "[00:01.00] hai" });
    all = await getAllTracks();
    expect(all.find((t) => t.id === r.id)?.title).toBe("Judul Baru");

    await deleteTrack(r.id);
    all = await getAllTracks();
    expect(all.some((t) => t.id === r.id)).toBe(false);
  });

  it("update id tak dikenal melempar", async () => {
    await expect(updateTrack("tak-ada", { title: "x" })).rejects.toThrow(/tidak ditemukan/i);
  });

  it("isQuotaError mengenali QuotaExceededError", () => {
    expect(isQuotaError(new DOMException("penuh", "QuotaExceededError"))).toBe(true);
    expect(isQuotaError(new Error("lain"))).toBe(false);
    expect(isQuotaError({ name: "QuotaExceededError" })).toBe(true);
  });
});
