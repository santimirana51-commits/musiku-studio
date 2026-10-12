// Validasi file musik lokal & cloud (dipakai client DAN server —
// server tidak pernah mengandalkan validasi client saja).

export const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4", // .m4a
  "audio/aac",
  "audio/aacp",
]);

export const ALLOWED_EXT = new Set(["mp3", "wav", "ogg", "oga", "flac", "m4a", "aac"]);

export function extOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

/** Batas byte dari env (server) atau default 50 MB (batas upload Supabase). */
export function maxFileBytes(envMb?: string | number): number {
  const mb = typeof envMb === "number" ? envMb : Number(envMb ?? 50);
  const sane = Number.isFinite(mb) && mb > 0 ? Math.min(mb, 500) : 50;
  return Math.floor(sane * 1024 * 1024);
}

export interface FileCheck {
  ok: boolean;
  message: string;
  mime: string;
  ext: string;
}

export function checkMusicFile(
  name: string,
  mime: string,
  size: number,
  maxBytes: number
): FileCheck {
  const ext = extOf(name);
  const mimeOk = ALLOWED_MIME.has(mime.toLowerCase());
  const extOk = ALLOWED_EXT.has(ext);
  // Terima bila salah satu cocok (browser kadang kirim application/octet-stream).
  if (!mimeOk && !extOk) {
    return { ok: false, message: `Format tidak didukung (.${ext || "?"}). Gunakan MP3/WAV/OGG/FLAC/M4A/AAC.`, mime, ext };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, message: "Ukuran file tidak valid.", mime, ext };
  }
  if (size > maxBytes) {
    const mb = (maxBytes / 1048576).toFixed(0);
    return { ok: false, message: `File melebihi batas ${mb} MB.`, mime, ext };
  }
  return { ok: true, message: "OK", mime: mimeOk ? mime : `audio/${ext}`, ext };
}

/** "Artis - Judul.mp3" -> { artist, title }; selain itu title = nama file. */
export function splitArtistTitle(filename: string): { artist: string; title: string } {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  const sep = base.indexOf(" - ");
  if (sep > 0) {
    return { artist: base.slice(0, sep).trim().slice(0, 200), title: base.slice(sep + 3).trim().slice(0, 300) || base };
  }
  return { artist: "", title: base.slice(0, 300) || filename };
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

export function formatDuration(sec: number | null | undefined): string {
  if (!Number.isFinite(sec as number) || (sec as number) < 0) return "--:--";
  const s = Math.floor(sec as number);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
