import { describe, it, expect, vi } from "vitest";
import { checkTabCapture } from "./capture.js";

describe("checkTabCapture", () => {
  it("tanpa API -> unsupported jujur", async () => {
    const r = await checkTabCapture({}, 5);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/tak tersedia/i);
  });

  it("tab invalid ditolak", async () => {
    const r = await checkTabCapture({ tabCapture: { getMediaStreamId: vi.fn(async () => "x") } }, -1);
    expect(r.available).toBe(false);
  });

  it("sukses mengembalikan streamId (eksperimental)", async () => {
    const r = await checkTabCapture({ tabCapture: { getMediaStreamId: vi.fn(async () => "stream-1") } }, 7);
    expect(r).toMatchObject({ available: true, streamId: "stream-1" });
  });

  it("penolakan izin dijelaskan, bukan diklaim sukses", async () => {
    const r = await checkTabCapture({
      tabCapture: { getMediaStreamId: vi.fn(async () => { throw new Error("Permission denied"); }) },
    }, 7);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/ditolak|gestur/i);
  });
});
