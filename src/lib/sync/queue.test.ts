import { describe, it, expect } from "vitest";
import {
  countSyncOps,
  enqueueSyncOp,
  listReadyOps,
  removeSyncOp,
  updateSyncOp,
  clearSyncQueue,
  type SyncStorage,
} from "@/lib/sync/queue";
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
  key: `k-${Math.random().toString(36).slice(2)}`,
  table: "favorites",
  op: "upsert",
  rowId: "row-1",
  payload: { title: "a" },
  baseUpdatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  attempts: 0,
  nextRetryAt: "2026-01-01T00:00:00.000Z",
  lastError: null,
  ...over,
});

describe("sync queue", () => {
  it("enqueue + listReady FIFO + remove", () => {
    const s = mem();
    enqueueSyncOp(OP({ key: "a", rowId: "row-1", createdAt: "2026-01-01T00:00:02.000Z" }), s);
    enqueueSyncOp(OP({ key: "b", rowId: "row-2", createdAt: "2026-01-01T00:00:01.000Z" }), s);
    expect(countSyncOps(s)).toBe(2);
    const ready = listReadyOps("2026-06-01T00:00:00.000Z", s);
    expect(ready.map((o) => o.key)).toEqual(["b", "a"]);
    removeSyncOp("b", s);
    expect(countSyncOps(s)).toBe(1);
    clearSyncQueue(s);
    expect(countSyncOps(s)).toBe(0);
  });

  it("coalesce upsert sebaris: payload baru, base versi pertama", () => {
    const s = mem();
    enqueueSyncOp(OP({ key: "k1", payload: { title: "lama" }, baseUpdatedAt: "2026-01-01T00:00:00.000Z" }), s);
    enqueueSyncOp(
      OP({ key: "k2", payload: { title: "baru" }, baseUpdatedAt: "2026-02-01T00:00:00.000Z" }),
      s
    );
    const ready = listReadyOps("2026-06-01T00:00:00.000Z", s);
    expect(ready).toHaveLength(1);
    expect(ready[0].payload).toEqual({ title: "baru" });
    expect(ready[0].baseUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("delete tidak digabung dengan upsert (operasi terpisah)", () => {
    const s = mem();
    enqueueSyncOp(OP({ key: "k1", op: "upsert" }), s);
    enqueueSyncOp(OP({ key: "k2", op: "delete" }), s);
    expect(countSyncOps(s)).toBe(2);
  });

  it("nextRetryAt masa depan belum ready; updateSyncOp menjadwalkan ulang", () => {
    const s = mem();
    enqueueSyncOp(OP({ key: "k1", nextRetryAt: "2026-12-31T00:00:00.000Z" }), s);
    expect(listReadyOps("2026-06-01T00:00:00.000Z", s)).toHaveLength(0);
    updateSyncOp("k1", { nextRetryAt: "2026-01-01T00:00:00.000Z", attempts: 1 }, s);
    expect(listReadyOps("2026-06-01T00:00:00.000Z", s)).toHaveLength(1);
  });
});
