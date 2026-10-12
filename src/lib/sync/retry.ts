// Retry dengan backoff eksponensial + klasifikasi kesalahan (Fase 3).
//
// - Retry: gagal jaringan (tanpa status), 429, 5xx.
// - Fatal (jangan retry): 400/403/404/422 — operasi di-drop + dicatat.
// - 401: sesi kedaluwarsa/pindah akun — antrean DIJEDA (bukan drop), lanjut
//   setelah login ulang. Logout = antrean milik akun lama dibuang eksplisit
//   oleh pemanggil (lihat docs/storage-and-sync.md), bukan oleh engine.

const BASE_MS = 1000;
const CAP_MS = 5 * 60 * 1000; // 5 menit
const MAX_ATTEMPTS = 10;

export function maxSyncAttempts(): number {
  return MAX_ATTEMPTS;
}

/** Backoff: 1s, 2s, 4s, … dibatasi 5 mnt, + jitter s/d 20% (anti-thundering herd). */
export function computeBackoffMs(attempt: number, rand: () => number = Math.random): number {
  const a = Math.max(0, Math.floor(attempt));
  const exp = Math.min(CAP_MS, BASE_MS * 2 ** a);
  return Math.floor(exp * (1 + rand() * 0.2));
}

export interface SendFailure {
  status: number | null; // null = gagal jaringan / tak sampai server
  message: string;
}

export type FailureClass = "retryable" | "fatal" | "unauthorized";

export function classifyFailure(f: SendFailure): FailureClass {
  if (f.status === null) return "retryable";
  if (f.status === 401) return "unauthorized";
  if (f.status === 429) return "retryable";
  if (f.status >= 500) return "retryable";
  return "fatal";
}
