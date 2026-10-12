// Penyimpanan persisten perpustakaan lokal via IndexedDB (browser).
//
// - Blob audio + metadata tersimpan di perangkat, pulih setelah dibuka ulang.
// - PERINGATAN: hapus data situs = koleksi hilang (tanpa backup otomatis).
// - QuotaExceededError ditangani eksplisit saat tambah.
// - Dukungan dicek sebelum impor (indexedDB tersedia?).

export interface LocalTrackRecord {
  id: string;
  title: string;
  artist: string;
  album: string;
  fileName: string;
  mime: string;
  size: number;
  duration: number | null; // detik, null bila gagal dibaca
  blob: Blob;
  lrcText: string; // lirik LRC milik pengguna (opsional)
  source: "device" | "local"; // device = sekali putar; local = tersimpan
  importedAt: string; // ISO
}

const DB_NAME = "musikku";
const STORE = "tracks";
const VERSION = 1;

function idb(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("Browser tidak mendukung IndexedDB.");
  }
  return indexedDB;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB error"));
  });
}

export function openLibraryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let db: IDBDatabase;
    try {
      const open = idb().open(DB_NAME, VERSION);
      open.onupgradeneeded = () => {
        db = open.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const st = db.createObjectStore(STORE, { keyPath: "id" });
          st.createIndex("importedAt", "importedAt", { unique: false });
          st.createIndex("title", "title", { unique: false });
        }
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error("Gagal membuka database lokal."));
    } catch (e) {
      reject(e instanceof Error ? e : new Error("IndexedDB tidak tersedia."));
    }
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export function isQuotaError(e: unknown): boolean {
  return (
    (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) ||
    (typeof e === "object" && e !== null && (e as { name?: string }).name === "QuotaExceededError")
  );
}

export async function addTrack(rec: LocalTrackRecord): Promise<void> {
  const db = await openLibraryDb();
  try {
    await req(tx(db, "readwrite").add(rec));
  } catch (e) {
    if (isQuotaError(e)) {
      throw new Error("Penyimpanan lokal penuh (kuota browser). Hapus lagu lama lalu coba lagi.");
    }
    throw e instanceof Error ? e : new Error("Gagal menyimpan lagu.");
  } finally {
    db.close();
  }
}

export async function getAllTracks(): Promise<LocalTrackRecord[]> {
  const db = await openLibraryDb();
  try {
    return await req(tx(db, "readonly").getAll());
  } finally {
    db.close();
  }
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await openLibraryDb();
  try {
    await req(tx(db, "readwrite").delete(id));
  } finally {
    db.close();
  }
}

export async function updateTrack(id: string, patch: Partial<LocalTrackRecord>): Promise<void> {
  const db = await openLibraryDb();
  try {
    const store = tx(db, "readwrite");
    const cur = await req(store.get(id));
    if (!cur) throw new Error("Lagu tidak ditemukan.");
    const { id: _omit, blob: _blob, ...safe } = patch as Record<string, unknown>;
    void _omit;
    void _blob; // blob tidak diubah via patch (impor ulang bila perlu)
    await req(store.put({ ...cur, ...safe }));
  } finally {
    db.close();
  }
}

export interface StorageEstimate {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null; // hasil StorageManager.persist (null = tak didukung)
}

export async function storageEstimate(): Promise<StorageEstimate> {
  let usage: number | null = null;
  let quota: number | null = null;
  let persisted: boolean | null = null;
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      usage = e.usage ?? null;
      quota = e.quota ?? null;
    }
  } catch {}
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      persisted = await navigator.storage.persist();
    }
  } catch {
    persisted = false;
  }
  return { usage, quota, persisted };
}
