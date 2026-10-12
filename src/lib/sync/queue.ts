// Antrean offline persisten untuk operasi sync yang aman (Fase 3).
//
// - Default memakai localStorage (`musikku:sync-queue`, maks 200 operasi)
//   agar selamat dari restart. SSR-safe (fallback memori bila tak ada window).
// - `enqueue` menggabungkan (coalesce) upsert berulang pada baris yang sama:
//   edit 5× offline = 1 operasi terakhir (payload + baseUpdatedAt terbaru
//   TIDAK menimpa — base tetap versi pertama agar konflik terdeteksi).
// - Delete TIDAK digabung dengan upsert: keduanya dipertahankan berurutan
//   (hapus lokal vs cloud operasi terpisah — §G).
// - Blob audio tidak pernah masuk payload (hanya metadata).

import type { SyncOperation } from "@/lib/sync/types";

export interface SyncStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const QUEUE_KEY = "musikku:sync-queue";
const MAX_OPS = 200;

function memoryStorage(): SyncStorage {
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

function defaultStorage(): SyncStorage {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {}
  return memoryStorage();
}

function load(store: SyncStorage): SyncOperation[] {
  try {
    const raw = store.getItem(QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SyncOperation[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(store: SyncStorage, ops: SyncOperation[]): void {
  try {
    store.setItem(QUEUE_KEY, JSON.stringify(ops.slice(0, MAX_OPS)));
  } catch {}
}

export function enqueueSyncOp(op: SyncOperation, store: SyncStorage = defaultStorage()): SyncOperation[] {
  const ops = load(store);
  const idx = ops.findIndex(
    (o) => o.table === op.table && o.rowId === op.rowId && o.op === op.op
  );
  if (idx >= 0 && op.op === "upsert") {
    // Coalesce: payload terbaru menang, TETAPI baseUpdatedAt pertama
    // dipertahankan agar konflik dengan versi server tetap terdeteksi.
    const prev = ops[idx];
    ops[idx] = { ...op, baseUpdatedAt: prev.baseUpdatedAt, createdAt: prev.createdAt, attempts: prev.attempts };
  } else {
    ops.push(op);
  }
  const next = ops.slice(0, MAX_OPS);
  save(store, next);
  return next;
}

/** Operasi yang jadwal retry-nya sudah tiba, urut FIFO. */
export function listReadyOps(nowIso: string, store: SyncStorage = defaultStorage()): SyncOperation[] {
  return load(store)
    .filter((o) => o.nextRetryAt <= nowIso)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

export function removeSyncOp(key: string, store: SyncStorage = defaultStorage()): SyncOperation[] {
  const next = load(store).filter((o) => o.key !== key);
  save(store, next);
  return next;
}

export function updateSyncOp(key: string, patch: Partial<SyncOperation>, store: SyncStorage = defaultStorage()): SyncOperation[] {
  const next = load(store).map((o) => (o.key === key ? { ...o, ...patch } : o));
  save(store, next);
  return next;
}

/** Buang seluruh antrean — HANYA untuk ganti/logout akun (lihat docs). */
export function clearSyncQueue(store: SyncStorage = defaultStorage()): void {
  try {
    store.removeItem(QUEUE_KEY);
  } catch {}
}

export function countSyncOps(store: SyncStorage = defaultStorage()): number {
  return load(store).length;
}
