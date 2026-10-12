// IndexedDB konteks ekstensi (origin chrome-extension://...): koleksi lokal
// pulih setelah browser dibuka kembali. Model internalsama dengan web.

export interface ExtTrack {
  id: string;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  addedAt: number;
}

const DB = "musiku-ext";
const STORE = "tracks";

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IDB error"));
  });
}

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const o = indexedDB.open(DB, 1);
      o.onupgradeneeded = () => {
        if (!o.result.objectStoreNames.contains(STORE)) {
          o.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      o.onsuccess = () => resolve(o.result);
      o.onerror = () => reject(o.error ?? new Error("Gagal membuka IDB."));
    } catch (e) {
      reject(e instanceof Error ? e : new Error("IndexedDB tak tersedia."));
    }
  });
}

export async function extAddTrack(t: ExtTrack): Promise<void> {
  const db = await openDb();
  try {
    await req(db.transaction(STORE, "readwrite").objectStore(STORE).add(t));
  } finally {
    db.close();
  }
}

export async function extListTracks(): Promise<ExtTrack[]> {
  const db = await openDb();
  try {
    return await req(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
  } finally {
    db.close();
  }
}

export async function extDeleteTrack(id: string): Promise<void> {
  const db = await openDb();
  try {
    await req(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
  } finally {
    db.close();
  }
}
