// SyncEngine: proses antrean offline → server (Fase 3).
//
// - `sender` diinjeksikan (fetch ke API di produksi, mock di test).
// - Tiap kiriman membawa header `Idempotency-Key: op.key` agar retry aman.
// - 401 → berhenti (paused:true), antrean utuh menunggu login ulang.
// - Batas percobaan (10): retryable yang kehabisan jatah → drop + catat.
// - Logout/pindah akun: pemanggil WAJIB `clearSyncQueue()` + menolak kirim
//   milik akun lama (sender memeriksa sesi sebelum kirim).

import { classifyFailure } from "@/lib/sync/retry";
import { computeBackoffMs, maxSyncAttempts } from "@/lib/sync/retry";
import {
  listReadyOps,
  removeSyncOp,
  updateSyncOp,
  type SyncStorage,
} from "@/lib/sync/queue";
import type { SendOutcome, SyncOperation, SyncSummary } from "@/lib/sync/types";
export type SyncSender = (op: SyncOperation) => Promise<SendOutcome>;

export {
  type SyncStorage,
  type SyncOperation,
  type SendOutcome,
  type SyncSummary,
};

function outcomeToFailure(o: Extract<SendOutcome, { kind: "retryable" | "fatal" | "unauthorized" }>) {
  if (o.kind === "unauthorized") return { status: 401, message: o.message };
  if (o.kind === "fatal") return { status: 400, message: o.message };
  return { status: null, message: o.message };
}

export class SyncEngine {
  private sender: SyncSender;
  private now: () => string;

  constructor(sender: SyncSender, now: () => string = () => new Date().toISOString()) {
    this.sender = sender;
    this.now = now;
  }

  async syncAll(store?: SyncStorage): Promise<SyncSummary> {
    const summary: SyncSummary = { synced: 0, rescheduled: 0, dropped: 0, paused: false };
    const ready = listReadyOps(this.now(), store);
    for (const op of ready) {
      let outcome: SendOutcome;
      try {
        outcome = await this.sender(op);
      } catch (e) {
        outcome = { kind: "retryable", message: e instanceof Error ? e.message : "Jaringan gagal." };
      }
      if (outcome.kind === "ok") {
        removeSyncOp(op.key, store);
        summary.synced += 1;
        continue;
      }
      if (outcome.kind === "unauthorized") {
        summary.paused = true;
        break; // antrean utuh; lanjut setelah login
      }
      const cls = classifyFailure(outcomeToFailure(outcome));
      if (cls === "unauthorized") {
        summary.paused = true;
        break;
      }
      if (cls === "fatal" || op.attempts + 1 >= maxSyncAttempts()) {
        removeSyncOp(op.key, store);
        summary.dropped += 1;
        continue;
      }
      const attempts = op.attempts + 1;
      const nextRetryAt = new Date(Date.parse(this.now()) + computeBackoffMs(attempts)).toISOString();
      updateSyncOp(op.key, { attempts, nextRetryAt, lastError: outcome.message }, store);
      summary.rescheduled += 1;
    }
    return summary;
  }
}
