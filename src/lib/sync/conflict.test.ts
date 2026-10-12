import { describe, it, expect } from "vitest";
import { resolveConflict } from "@/lib/sync/conflict";

describe("resolveConflict (last-write-wins)", () => {
  it("lokal lebih baru → local", () => {
    expect(
      resolveConflict({
        localUpdatedAt: "2026-10-02T00:00:00.000Z",
        remoteUpdatedAt: "2026-10-01T00:00:00.000Z",
        localIsDelete: false,
        remoteIsDelete: false,
      })
    ).toEqual({ winner: "local" });
  });

  it("remote lebih baru atau sama → remote (stabil)", () => {
    const newer = resolveConflict({
      localUpdatedAt: "2026-10-01T00:00:00.000Z",
      remoteUpdatedAt: "2026-10-02T00:00:00.000Z",
      localIsDelete: false,
      remoteIsDelete: false,
    });
    expect(newer).toEqual({ winner: "remote" });
    const equal = resolveConflict({
      localUpdatedAt: "2026-10-01T00:00:00.000Z",
      remoteUpdatedAt: "2026-10-01T00:00:00.000Z",
      localIsDelete: false,
      remoteIsDelete: false,
    });
    expect(equal).toEqual({ winner: "remote" });
  });

  it("hapus-vs-ubah → manual (tidak auto-hapus cloud)", () => {
    const r = resolveConflict({
      localUpdatedAt: "2026-10-05T00:00:00.000Z",
      remoteUpdatedAt: "2026-10-01T00:00:00.000Z",
      localIsDelete: true,
      remoteIsDelete: false,
    });
    expect(r.winner).toBe("manual");
  });

  it("timestamp tak valid → manual (jangan menebak)", () => {
    const r = resolveConflict({
      localUpdatedAt: "bukan-tanggal",
      remoteUpdatedAt: "2026-10-01T00:00:00.000Z",
      localIsDelete: false,
      remoteIsDelete: false,
    });
    expect(r.winner).toBe("manual");
  });
});
