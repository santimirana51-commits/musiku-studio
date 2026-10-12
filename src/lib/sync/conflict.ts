// Aturan konflik sync yang terdokumentasi (Fase 3).
//
// Aturan (last-write-wins per updated_at):
// - Bandingkan `updated_at` kandidat lokal vs `updated_at` baris server.
//   Yang LEBIH BARU menang. Sama persis → server menang (stabil, idempoten).
// - Tabel tanpa updated_at memakai kolom versi yang ada:
//   favorites/playback_history → created_at/played_at (append-only, praktis
//   tanpa konflik tulis); playlist_items → (position, added_at).
// - Konflik delete-vs-update TIDAK diselesaikan otomatis → "manual":
//   kembalikan ke pengguna (pilih "pulihkan" atau "hapus juga di cloud").
//   Engine tidak pernah menghapus data cloud diam-diam.
// - Timestamp tak valid di salah satu sisi → "manual" (jangan menebak).

export type ConflictInput = {
  localUpdatedAt: string | null;
  remoteUpdatedAt: string | null;
  localIsDelete: boolean;
  remoteIsDelete: boolean;
};

export type ConflictDecision =
  | { winner: "local" | "remote" }
  | { winner: "manual"; reason: string };

function timeOf(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function resolveConflict(c: ConflictInput): ConflictDecision {
  if (c.localIsDelete || c.remoteIsDelete) {
    return { winner: "manual", reason: "Konflik hapus-vs-ubah memerlukan pilihan eksplisit pengguna." };
  }
  const l = timeOf(c.localUpdatedAt);
  const r = timeOf(c.remoteUpdatedAt);
  if (l === null || r === null) {
    return { winner: "manual", reason: "Versi waktu tak valid; tidak boleh menebak pemenang." };
  }
  if (l > r) return { winner: "local" };
  return { winner: "remote" }; // sama → remote (stabil)
}
