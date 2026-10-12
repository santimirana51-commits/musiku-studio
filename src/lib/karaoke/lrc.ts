// Parser & utilitas LRC untuk KaraokeEngine.
//
// Format yang didukung (subset LRC umum):
//   [mm:ss.xx] teks lirik        (xx = centisecond 2 digit, atau ms 3 digit)
//   [mm:ss] teks                  (tanpa fraksi)
//   [mm:ss.x] teks                (desisecond 1 digit)
//   [00:12.00][00:15.00] teks    (multi timestamp -> beberapa baris)
//   [offset:+500] / [offset:-250] (offset global bawaan file, milidetik)
//   [ti:judul] [ar:artis] [al:album] [by:pembuat] [length:mm:ss] (metadata)
//
// Batasan aman: input maks 100.000 karakter, maks 2.000 baris lirik.
// Baris tanpa timestamp yang valid diabaikan dan dicatat sebagai error
// (agar UI bisa memberi tahu pengguna), bukan ditebak-nebak.
//
// Sinkronisasi yang dihasilkan bersifat PER BARIS, bukan per kata —
// klaim "word-by-word" tidak dibuat kecuali sumber mendukungnya.

export interface LyricLine {
  /** Waktu tampil dalam milidetik (sudah termasuk offset bawaan file). */
  timeMs: number;
  /** Teks lirik yang sudah disanitasi (tanpa tag HTML). */
  text: string;
}

export interface LrcMetadata {
  title?: string;
  artist?: string;
  album?: string;
  by?: string;
  length?: string;
  /** Offset bawaan file dalam ms (dari tag [offset:...]). */
  fileOffsetMs: number;
}

export interface ParseLrcResult {
  lines: LyricLine[];
  metadata: LrcMetadata;
  /** Baris input yang diabaikan (nomor baris 1-based + alasan). */
  errors: Array<{ line: number; reason: string }>;
}

export const LRC_MAX_CHARS = 100_000;
export const LRC_MAX_LINES = 2_000;

/** Timestamp [mm:ss], fraksi opsional 1-3 digit. Menit boleh > 59. */
const TIMESTAMP_RE = /\[(\d{1,3}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;
/** Tag metadata [kunci:nilai] non-timestamp. */
const TAG_RE = /^\[([a-zA-Z]+):([^\]]*)\]$/;
const OFFSET_TAG_RE = /^[+-]?\d+$/;

/** Hapus tag HTML/XML + karakter kontrol (kecuali newline/tab). */
export function sanitizeLyricText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function fracToMs(frac: string | undefined): number {
  if (!frac) return 0;
  if (frac.length === 1) return Number(frac) * 100;
  if (frac.length === 2) return Number(frac) * 10;
  return Number(frac.slice(0, 3));
}

export function parseLrc(input: string): ParseLrcResult {
  const errors: Array<{ line: number; reason: string }> = [];
  const lines: LyricLine[] = [];
  const metadata: LrcMetadata = { fileOffsetMs: 0 };

  if (typeof input !== "string" || input.trim() === "") {
    return { lines, metadata, errors: [{ line: 0, reason: "Lirik kosong." }] };
  }
  if (input.length > LRC_MAX_CHARS) {
    return {
      lines,
      metadata,
      errors: [{ line: 0, reason: `Ukuran lirik melebihi ${LRC_MAX_CHARS} karakter.` }],
    };
  }

  const rawLines = input.split(/\r?\n/);
  rawLines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.trim();
    if (line === "") return;
    if (lines.length >= LRC_MAX_LINES) {
      errors.push({ line: lineNo, reason: `Melebihi batas ${LRC_MAX_LINES} baris.` });
      return;
    }

    // Tag tunggal non-timestamp, mis. [ti:...] / [offset:...]
    const single = line.match(TAG_RE);
    if (single && !/^\[\d/.test(line)) {
      const key = single[1].toLowerCase();
      const value = single[2].trim();
      switch (key) {
        case "ti": metadata.title = value.slice(0, 300); break;
        case "ar": metadata.artist = value.slice(0, 300); break;
        case "al": metadata.album = value.slice(0, 300); break;
        case "by": metadata.by = value.slice(0, 300); break;
        case "length": metadata.length = value.slice(0, 16); break;
        case "offset":
          if (OFFSET_TAG_RE.test(value)) metadata.fileOffsetMs = Number(value);
          else errors.push({ line: lineNo, reason: "Tag offset tidak valid." });
          break;
        default:
          // Tag tak dikenal diabaikan diam-diam (mis. [ve:...]).
          break;
      }
      return;
    }

    // Kumpulkan semua timestamp di awal/baris.
    TIMESTAMP_RE.lastIndex = 0;
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    let lastEnd = 0;
    let valid = true;
    while ((m = TIMESTAMP_RE.exec(line)) !== null) {
      const mm = Number(m[1]);
      const ss = Number(m[2]);
      if (ss > 59 || !Number.isFinite(mm)) { valid = false; break; }
      stamps.push((mm * 60 + ss) * 1000 + fracToMs(m[3]));
      lastEnd = m.index + m[0].length;
    }
    if (!valid || stamps.length === 0) {
      errors.push({ line: lineNo, reason: "Tanpa timestamp [mm:ss.xx] yang valid." });
      return;
    }
    const text = sanitizeLyricText(line.slice(lastEnd));
    if (text === "") {
      errors.push({ line: lineNo, reason: "Timestamp tanpa teks lirik." });
      return;
    }
    for (const t of stamps) {
      if (lines.length >= LRC_MAX_LINES) {
        errors.push({ line: lineNo, reason: `Melebihi batas ${LRC_MAX_LINES} baris.` });
        break;
      }
      lines.push({ timeMs: t + metadata.fileOffsetMs, text: text.slice(0, 500) });
    }
  });

  lines.sort((a, b) => a.timeMs - b.timeMs);
  return { lines, metadata, errors };
}

/** Validasi cepat untuk API/upload: minimal 1 baris valid & tanpa error fatal. */
export function validateLrc(input: string): { ok: boolean; lines: LyricLine[]; message: string } {
  const parsed = parseLrc(input);
  if (parsed.lines.length === 0) {
    const hint = parsed.errors[0]?.reason ?? "Format tidak dikenali.";
    return { ok: false, lines: [], message: `LRC tidak valid: ${hint} Gunakan format [mm:ss.xx] teks.` };
  }
  return { ok: true, lines: parsed.lines, message: "OK" };
}

/**
 * Baris aktif = baris terakhir dengan (timeMs + offsetMs) <= waktu putar.
 * Mengembalikan -1 bila belum ada baris yang waktunya tiba.
 * Binary search — aman untuk ribuan baris per frame.
 */
export function findActiveIndex(
  lines: LyricLine[],
  timeMs: number,
  offsetMs = 0
): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs + offsetMs <= timeMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}
