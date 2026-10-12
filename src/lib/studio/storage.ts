import type { StudioProject } from "./types";
import { parseStudioProject } from "./schema";
import type { StepPattern } from "./step-sequencer";

const DB_NAME = "musikku_studio_db";
const DB_VERSION = 2;
const STORE_PROJECTS = "studio_projects";
const STORE_BLOBS = "studio_audio_blobs";
const STORE_PATTERNS = "studio_step_patterns";

export function openStudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak didukung pada environment ini."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_PATTERNS)) {
        db.createObjectStore(STORE_PATTERNS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Gagal membuka database studio"));
  });
}

export async function saveProject(project: StudioProject): Promise<void> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readwrite");
    const store = tx.objectStore(STORE_PROJECTS);
    const updated = {
      ...project,
      updatedAt: new Date().toISOString(),
    };
    const req = store.put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Gagal menyimpan proyek"));
  });
}

export async function loadProject(id: string): Promise<StudioProject | null> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readonly");
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.get(id);
    req.onsuccess = () => {
      if (!req.result) {
        resolve(null);
        return;
      }
      const parsed = parseStudioProject(req.result);
      if (parsed.success && parsed.project) {
        resolve(parsed.project);
      } else {
        reject(new Error(parsed.error ?? "Data proyek korup."));
      }
    };
    req.onerror = () => reject(req.error ?? new Error("Gagal memuat proyek"));
  });
}

export const AUTOSAVE_PROJECT_ID = "__musikku_autosave_backup__";

export interface AutosaveRecord {
  id: string;
  originalProjectId: string;
  project: StudioProject;
  savedAt: string;
}

export async function saveAutosave(project: StudioProject): Promise<void> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readwrite");
    const store = tx.objectStore(STORE_PROJECTS);
    const record: AutosaveRecord = {
      id: AUTOSAVE_PROJECT_ID,
      originalProjectId: project.id,
      project,
      savedAt: new Date().toISOString(),
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Gagal menyimpan autosave"));
  });
}

export async function loadAutosave(): Promise<AutosaveRecord | null> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readonly");
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.get(AUTOSAVE_PROJECT_ID);
    req.onsuccess = () => {
      if (!req.result) {
        resolve(null);
        return;
      }
      const record = req.result as AutosaveRecord;
      if (record && record.project) {
        const parsed = parseStudioProject(record.project);
        if (parsed.success && parsed.project) {
          resolve({
            ...record,
            project: parsed.project,
          });
          return;
        }
      }
      resolve(null);
    };
    req.onerror = () => reject(req.error ?? new Error("Gagal memuat autosave"));
  });
}

export async function clearAutosave(): Promise<void> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readwrite");
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.delete(AUTOSAVE_PROJECT_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Gagal menghapus autosave"));
  });
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  tempo: number;
  trackCount: number;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readonly");
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result || []) as any[];
      const list = all.filter((p) => p.id !== AUTOSAVE_PROJECT_ID && p.tracks) as StudioProject[];
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(
        list.map((p) => ({
          id: p.id,
          name: p.name,
          updatedAt: p.updatedAt,
          tempo: p.tempo,
          trackCount: p.tracks.length,
        }))
      );
    };
    req.onerror = () => reject(req.error ?? new Error("Gagal membaca daftar proyek"));
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readwrite");
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Gagal menghapus proyek"));
  });
}

export async function saveAudioBlob(assetId: string, blob: Blob): Promise<void> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, "readwrite");
    const store = tx.objectStore(STORE_BLOBS);
    const req = store.put({ id: assetId, blob, createdAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Gagal menyimpan blob audio"));
  });
}

export async function getAudioBlob(assetId: string): Promise<Blob | null> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, "readonly");
    const store = tx.objectStore(STORE_BLOBS);
    const req = store.get(assetId);
    req.onsuccess = () => {
      if (!req.result || !req.result.blob) {
        resolve(null);
      } else {
        resolve(req.result.blob as Blob);
      }
    };
    req.onerror = () => reject(req.error ?? new Error("Gagal mengambil blob audio"));
  });
}

export async function deleteAudioBlob(assetId: string): Promise<void> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, "readwrite");
    const store = tx.objectStore(STORE_BLOBS);
    const req = store.delete(assetId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Gagal menghapus blob audio"));
  });
}

/**
 * Memeriksa apakah ada aset audio yang hilang (missing sound files) pada proyek.
 * Berdasarkan spesifikasi Mixcraft 10 Hlm. 52 ("Missing Sound Files Dialog & Relinking").
 * Mengembalikan daftar assetId yang direferensikan oleh klip tetapi tidak ditemukan di IndexedDB.
 */
export async function checkProjectMissingAssets(project: StudioProject): Promise<string[]> {
  const referencedAssetIds = new Set<string>();
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.assetId) {
        referencedAssetIds.add(clip.assetId);
      }
    }
  }

  const missing: string[] = [];
  const assetIdList = Array.from(referencedAssetIds);
  for (const assetId of assetIdList) {
    const blob = await getAudioBlob(assetId);
    if (!blob) {
      missing.push(assetId);
    }
  }
  return missing;
}

/**
 * Me-relink aset audio yang hilang dengan blob pengganti baru.
 * Berdasarkan spesifikasi Mixcraft 10 Hlm. 52 ("Missing Sound Files Relinking").
 */
export async function relinkProjectAsset(
  project: StudioProject,
  oldAssetId: string,
  newAssetId: string,
  newBlob: Blob
): Promise<StudioProject> {
  await saveAudioBlob(newAssetId, newBlob);

  const updatedTracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) =>
      clip.assetId === oldAssetId ? { ...clip, assetId: newAssetId } : clip
    ),
  }));

  const updatedAssetManifest = { ...(project.assetManifest || {}) };
  if (updatedAssetManifest[oldAssetId]) {
    updatedAssetManifest[newAssetId] = {
      ...updatedAssetManifest[oldAssetId],
      id: newAssetId,
      sizeBytes: newBlob.size,
    };
    delete updatedAssetManifest[oldAssetId];
  }

  const updatedProject: StudioProject = {
    ...project,
    tracks: updatedTracks,
    assetManifest: updatedAssetManifest,
    updatedAt: new Date().toISOString(),
  };

  await saveProject(updatedProject);
  return updatedProject;
}

/**
 * Membersihkan aset audio yang tidak lagi dirujuk oleh proyek manapun (garbage collection).
 * Berdasarkan spesifikasi Mixcraft 10 Hlm. 687 ("Delete Unused Recordings During Save Or On Exit").
 * Mengembalikan jumlah blob yang berhasil dibersihkan.
 */
export async function cleanupOrphanAudioBlobs(projects: StudioProject[]): Promise<number> {
  const referencedAssetIds = new Set<string>();
  for (const project of projects) {
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.assetId) referencedAssetIds.add(clip.assetId);
      }
    }
  }

  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, "readwrite");
    const store = tx.objectStore(STORE_BLOBS);
    const req = store.getAllKeys();

    req.onsuccess = () => {
      const allKeys = (req.result || []) as string[];
      let deletedCount = 0;
      for (const key of allKeys) {
        if (!referencedAssetIds.has(key)) {
          store.delete(key);
          deletedCount++;
        }
      }
      resolve(deletedCount);
    };

    req.onerror = () => reject(req.error ?? new Error("Gagal membersihkan blob audio"));
  });
}


export function exportProjectToJSON(project: StudioProject): string {
  return JSON.stringify(project, null, 2);
}

export function importProjectFromJSON(jsonString: string): {
  success: boolean;
  project?: StudioProject;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    return parseStudioProject(parsed);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "JSON tidak valid.",
    };
  }
}

export async function saveStepPattern(pattern: StepPattern): Promise<void> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PATTERNS, "readwrite");
    const store = tx.objectStore(STORE_PATTERNS);
    const updated = {
      ...pattern,
      updatedAt: new Date().toISOString(),
    };
    const req = store.put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Gagal menyimpan pola beat"));
  });
}

export async function loadStepPattern(id: string): Promise<StepPattern | null> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PATTERNS, "readonly");
    const store = tx.objectStore(STORE_PATTERNS);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as StepPattern) || null);
    req.onerror = () => reject(req.error ?? new Error("Gagal memuat pola beat"));
  });
}

export async function listStepPatterns(): Promise<StepPattern[]> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PATTERNS, "readonly");
    const store = tx.objectStore(STORE_PATTERNS);
    const req = store.getAll();
    req.onsuccess = () => {
      const patterns = (req.result || []) as (StepPattern & { updatedAt?: string })[];
      patterns.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      resolve(patterns);
    };
    req.onerror = () => reject(req.error ?? new Error("Gagal mengambil daftar pola beat"));
  });
}

export async function deleteStepPattern(id: string): Promise<void> {
  const db = await openStudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PATTERNS, "readwrite");
    const store = tx.objectStore(STORE_PATTERNS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Gagal menghapus pola beat"));
  });
}
