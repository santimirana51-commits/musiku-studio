// Hook sync engine sederhana untuk digunakan di UI (Fase 6).
// Mengabstraksi SyncEngine + storage + logika paused/unauthorized.

import { useState, useEffect } from "react";
import { SyncEngine, type SyncStorage } from "@/lib/sync/engine";
import { listReadyOps, countSyncOps } from "@/lib/sync/queue";
import { classifyFailure } from "@/lib/sync/retry";
import { newIdempotencyKey, type SendOutcome, type SyncOperation } from "@/lib/sync/types";

export type SyncStatus = "idle" | "syncing" | "paused" | "error";

export interface SyncEngineHook {
  status: SyncStatus;
  queueCount: number;
  syncedToday: number;
  error: string | null;
  /** Memulai sinkronisasi manual (FIFO dari antrean ready). */
  syncManual: () => Promise<void>;
  /** Jeda sinkronisasi (hapus antrean + lanjut setelah login). */
  pauseSync: () => void;
  /** Reset error status. */
  resetError: () => void;
}

export function useSyncEngine(storage?: SyncStorage): SyncEngineHook {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [queueCount, setQueueCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const engine = new SyncEngine(
    async (op: SyncOperation): Promise<SendOutcome> => {
      // Fetch otentik harus dilakukan di sisi pemanggil (melalui API route yang
      // meneruskan header Idempotency-Key). Di sini kita mock dengan fetch ke
      // endpoint yang sebenarnya, dan tangani respons.
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": newIdempotencyKey(),
        },
        body: JSON.stringify(op),
      });
      const data = (await res.json()) as { kind: "ok" | "retryable" | "fatal" | "unauthorized"; message?: string };
      if (!res.ok) {
        const cls = classifyFailure({ status: res.status ?? null, message: data.message ?? "Unknown error" });
        if (cls === "unauthorized") return { kind: "unauthorized", message: data.message ?? "Sesi habis" };
        if (cls === "fatal") return { kind: "fatal", message: data.message ?? "Gagal sync" };
        return { kind: "retryable", message: data.message ?? "Jaringan error" };
      }
      if (data.kind === "ok") return { kind: "ok" };
      return { kind: data.kind, message: data.message ?? "Error" };
    },
    () => new Date().toISOString()
  );

  // Load queue count dari storage
  useEffect(() => {
    setQueueCount(countSyncOps(storage));
  }, [storage]);

  const syncManual = async () => {
    setStatus("syncing");
    setError(null);
    try {
      await engine.syncAll(storage);
      setStatus("idle");
      // setelah sukses, perbarui hitungan antrean
      setQueueCount(countSyncOps(storage));
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Sync error");
    }
  };

  const pauseSync = () => {
    setStatus("paused");
    // antrean tetap ada, hanya berhenti di sini. Lanjut setelah login ulang.
  };

  const resetError = () => {
    setError(null);
    if (status === "error") setStatus("idle");
  };

  return { status, queueCount, syncedToday: 0, error, syncManual, pauseSync, resetError };
}