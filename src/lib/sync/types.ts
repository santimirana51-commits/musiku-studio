// Tipe sync engine lintas perangkat (Fase 3).
//
// Prinsip (§G misi):
// - Yang disinkronkan: METADATA saja (playlist, favorit, metadata cloud,
//   preferensi, riwayat bila diaktifkan). Blob audio lokal TIDAK PERNAH
//   diunggah otomatis saat metadata disinkronkan.
// - Hapus lokal vs hapus cloud = operasi terpisah (kecuali pengguna memilih
//   keduanya secara eksplisit).
// - Setiap operasi membawa idempotency key + base version untuk konflik.

export type SyncTable =
  | "playlists"
  | "playlist_items"
  | "favorites"
  | "music_library"
  | "user_preferences"
  | "karaoke_lyrics"
  | "playback_history";

export type SyncOpKind = "upsert" | "delete";

export interface SyncOperation {
  /** Idempotency key client (uuid). Dikirim sebagai header `Idempotency-Key`. */
  key: string;
  table: SyncTable;
  op: SyncOpKind;
  /** ID baris target (uuid). Untuk upsert baru: uuid yang dibuat client. */
  rowId: string;
  /** Payload baris (tanpa user_id — server mengisi dari sesi). */
  payload: Record<string, unknown>;
  /** updated_at (atau created_at/added_at) yang dilihat client saat edit. */
  baseUpdatedAt: string | null;
  createdAt: string; // ISO — urutan FIFO
  attempts: number;
  /** ISO waktu boleh dicoba lagi (backoff). */
  nextRetryAt: string;
  lastError: string | null;
}

export type SendOutcome =
  | { kind: "ok" }
  | { kind: "retryable"; message: string }
  | { kind: "fatal"; message: string }
  | { kind: "unauthorized"; message: string };

export interface SyncSummary {
  synced: number;
  rescheduled: number;
  dropped: number;
  paused: boolean;
}

export function newIdempotencyKey(): string {
  const c = globalThis.crypto as unknown as
    | { randomUUID?: () => string }
    | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
