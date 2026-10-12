import { describe, it, expect, vi } from "vitest";
import { SyncEngine, type SyncSender } from "@/lib/sync/engine";
import { countSyncOps, enqueueSyncOp, type SyncStorage } from "@/lib/sync/queue";
import type { SyncOperation } from "@/lib/sync/types";

function mem(): SyncStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
  };
}

const OP = (over: Partial<SyncOperation> = {}): SyncOperation => ({
  key: "k1",
  table: "favorites",
  op: "upsert",
  rowId: "row-1",
  payload: {},
  baseUpdatedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  attempts: 0,
  nextRetryAt: "2026-01-01T00:00:00.000Z",
  lastError: null,
  ...over,
});

const NOW = "2026-06-01T00:00:00.000Z";

describe("SyncEngine", () => {
  it("ok → hapus dari antrean", async () => {
    const s = mem();
    enqueueSyncOp(OP(), s);
    const sender: SyncSender = vi.fn(async () => ({ kind: "ok" as const }));
    const eng = new SyncEngine(sender, () => NOW);
    const sum = await eng.syncAll(s);
    expect(sum).toEqual({ synced: 1, rescheduled: 0, dropped: 0, paused: false });
    expect(countSyncOps(s)).toBe(0);
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("retryable → attempts+1 + dijadwalkan ulang (tetap di antrean)", async () => {
    const s = mem();
    enqueueSyncOp(OP(), s);
    const eng = new SyncEngine(vi.fn(async () => ({ kind: "retryable" as const, message: "503" })), () => NOW);
    const sum = await eng.syncAll(s);
    expect(sum.rescheduled).toBe(1);
    expect(countSyncOps(s)).toBe(1);
  });

  it("fatal → drop; unauthorized → jeda dengan antrean utuh", async () => {
    const s = mem();
    enqueueSyncOp(OP({ key: "fatal" }), s);
    const eng = new SyncEngine(vi.fn(async () => ({ kind: "fatal" as const, message: "400" })), () => NOW);
    const sum = await eng.syncAll(s);
    expect(sum.dropped).toBe(1);
    expect(countSyncOps(s)).toBe(0);

    const s2 = mem();
    enqueueSyncOp(OP({ key: "auth" }), s2);
    const eng2 = new SyncEngine(vi.fn(async () => ({ kind: "unauthorized" as const, message: "sesi habis" })), () => NOW);
    const sum2 = await eng2.syncAll(s2);
    expect(sum2.paused).toBe(true);
    expect(countSyncOps(s2)).toBe(1);
  });

  it("gagal jaringan (lempar) → retryable; attempts habis → drop", async () => {
    const s = mem();
    enqueueSyncOp(OP({ attempts: 9 }), s); // 9+1 >= 10 → drop
    const eng = new SyncEngine(
      vi.fn(async () => {
        throw new Error("offline");
      }),
      () => NOW
    );
    const sum = await eng.syncAll(s);
    expect(sum.dropped).toBe(1);
    expect(countSyncOps(s)).toBe(0);
  });
});
