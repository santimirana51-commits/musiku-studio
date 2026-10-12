// Probe dekodabilitas audio sebelum impor ke IndexedDB (Fase 2).
//
// Masalah yang dipecahkan: validasi lama (`checkMusicFile`) hanya melihat
// ekstensi/MIME — file korup atau codec tak didukung browser lolos lalu
// gagal saat diputar. Probe ini memakai `AudioContext.decodeAudioData`
// (atau WebKit fallback) untuk memverifikasi byte benar-benar ter-decode.
//
// - Dipakai client saat impor (File perangkat → Pustaka lokal).
// - Server tetap memvalidasi sendiri (tidak percaya client).
// - Gagal decode = tolak impor dengan pesan jujur (bukan diam).

export interface DecodeProbeResult {
  decodable: boolean;
  duration: number | null;
  message: string;
}

interface DecodeCtx {
  decodeAudioData: (buf: ArrayBuffer) => Promise<{ duration?: number }>;
  close?: () => Promise<void> | void;
}

function isBlobLike(v: unknown): v is Blob {
  const b = v as Blob | null;
  return (
    typeof b === "object" &&
    b !== null &&
    (typeof b.arrayBuffer === "function" || typeof (b as Blob).size === "number")
  );
}

async function toArrayBuffer(data: Blob | ArrayBuffer): Promise<ArrayBuffer> {
  if (!isBlobLike(data)) {
    if (data && typeof (data as ArrayBuffer).byteLength === "number") return data as ArrayBuffer;
    throw new Error("Bukan audio biner.");
  }
  if (typeof data.arrayBuffer === "function") return await data.arrayBuffer();
  // Fallback untuk lingkungan tanpa Blob.arrayBuffer (mis. jsdom pada test;
  // browser modern selalu punya arrayBuffer).
  const FR = (globalThis as Record<string, unknown>).FileReader as
    | (new () => {
        onload: (() => void) | null;
        onerror: (() => void) | null;
        result: unknown;
        readAsArrayBuffer: (b: Blob) => void;
      })
    | undefined;
  if (typeof FR !== "function") throw new Error("Blob tak dapat dibaca di lingkungan ini.");
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const fr = new FR();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(new Error("Gagal membaca file."));
    fr.readAsArrayBuffer(data);
  });
}
export async function probeAudioDecodable(
  data: Blob | ArrayBuffer,
  createCtx?: () => DecodeCtx | null
): Promise<DecodeProbeResult> {
  let buf: ArrayBuffer;
  try {
    buf = await toArrayBuffer(data);
  } catch {
    return { decodable: false, duration: null, message: "File tidak dapat dibaca." };
  }
  if (!buf || buf.byteLength === 0) {
    return { decodable: false, duration: null, message: "File kosong atau rusak." };
  }

  const factory =
    createCtx ??
    (() => {
      const AC =
        (globalThis as Record<string, unknown>).AudioContext ??
        (globalThis as Record<string, unknown>).webkitAudioContext;
      if (typeof AC !== "function") return null;
      try {
        return new (AC as new () => DecodeCtx)();
      } catch {
        return null;
      }
    });

  const ctx = factory();
  if (!ctx) {
    // Tanpa decoder browser: tidak bisa membuktikan — izinkan dengan peringatan.
    return { decodable: true, duration: null, message: "Pemeriksaan decode tak didukung browser; format dicek via ekstensi/MIME saja." };
  }
  try {
    // decodeAudioData dapat merusak buffer (detached) — salin dulu.
    const copy = buf.slice(0);
    const decoded = await ctx.decodeAudioData(copy);
    const dur = typeof decoded?.duration === "number" && Number.isFinite(decoded.duration) ? decoded.duration : null;
    return { decodable: true, duration: dur, message: "OK" };
  } catch {
    return { decodable: false, duration: null, message: "File tidak dapat di-decode browser (rusak/codec tak didukung)." };
  } finally {
    try {
      await ctx.close?.();
    } catch {}
  }
}
