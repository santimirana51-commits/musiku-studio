import { describe, it, expect, vi } from "vitest";
import { probeAudioDecodable } from "@/lib/local-library/decode-probe";

describe("probeAudioDecodable", () => {
  it("OK + durasi bila decode berhasil", async () => {
    const close = vi.fn(async () => {});
    const r = await probeAudioDecodable(new Uint8Array([1, 2, 3]).buffer, () => ({
      decodeAudioData: async () => ({ duration: 42.5 }),
      close,
    }));
    expect(r).toEqual({ decodable: true, duration: 42.5, message: "OK" });
    expect(close).toHaveBeenCalled();
  });

  it("menolak bila decode melempar (rusak/codec)", async () => {
    const r = await probeAudioDecodable(new Uint8Array([9]).buffer, () => ({
      decodeAudioData: async () => {
        throw new Error("EncodingError");
      },
    }));
    expect(r.decodable).toBe(false);
    expect(r.message).toMatch(/decode/i);
  });

  it("menolak buffer kosong", async () => {
    const r = await probeAudioDecodable(new ArrayBuffer(0), () => ({
      decodeAudioData: async () => ({ duration: 1 }),
    }));
    expect(r.decodable).toBe(false);
  });

  it("tanpa decoder: izinkan dengan peringatan jujur (bukan klaim OK penuh)", async () => {
    const blob = new Blob(["x"], { type: "audio/mpeg" });
    const r = await probeAudioDecodable(blob, () => null);
    expect(r.decodable).toBe(true);
    expect(r.duration).toBeNull();
    expect(r.message).toMatch(/tak didukung/i);
  });
});
