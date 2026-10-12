import React, { useState, useEffect } from "react";
import {
  X,
  FolderOpen,
  Save,
  Plus,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  Music,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  FileAudio,
} from "lucide-react";
import type { StudioProject } from "@/lib/studio/types";
import {
  listProjects,
  loadProject,
  deleteProject,
  saveProject,
  exportProjectToJSON,
  importProjectFromJSON,
  checkProjectMissingAssets,
  relinkProjectAsset,
  cleanupOrphanAudioBlobs,
  type ProjectSummary,
} from "@/lib/studio/storage";
import { useToast } from "@/components/toast";

interface ProjectDialogProps {
  currentProject: StudioProject;
  onClose: () => void;
  onLoadProject: (project: StudioProject) => void;
  onNewProject: () => void;
}

export function ProjectDialog({
  currentProject,
  onClose,
  onLoadProject,
  onNewProject,
}: ProjectDialogProps) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectNameInput, setProjectNameInput] = useState(currentProject.name);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [missingAssetsState, setMissingAssetsState] = useState<{
    project: StudioProject;
    missingIds: string[];
  } | null>(null);

  const refreshList = async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } catch {
      toast("Gagal membaca daftar proyek lokal", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveCurrent = async () => {
    try {
      const updated = {
        ...currentProject,
        name: projectNameInput.trim() || currentProject.name,
      };
      await saveProject(updated);
      toast("Proyek berhasil disimpan ke penyimpanan lokal!", "success");
      refreshList();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal menyimpan", "error");
    }
  };

  const handleSelectProject = async (id: string) => {
    try {
      const p = await loadProject(id);
      if (p) {
        const missing = await checkProjectMissingAssets(p);
        if (missing.length > 0) {
          setMissingAssetsState({ project: p, missingIds: missing });
          toast(`Ditemukan ${missing.length} berkas suara yang hilang!`, "warning");
        } else {
          onLoadProject(p);
          toast(`Proyek "${p.name}" berhasil dibuka`, "success");
          onClose();
        }
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memuat proyek", "error");
    }
  };

  const handleAuditCurrentProject = async () => {
    try {
      const missing = await checkProjectMissingAssets(currentProject);
      if (missing.length > 0) {
        setMissingAssetsState({ project: currentProject, missingIds: missing });
        toast(`Ditemukan ${missing.length} berkas suara hilang pada proyek ini!`, "warning");
      } else {
        toast("Semua berkas audio proyek saat ini lengkap (100% OK)!", "success");
      }
    } catch {
      toast("Gagal mengaudit berkas aset", "error");
    }
  };

  const handleCleanupUnusedRecordings = async () => {
    if (!confirm("Bersihkan rekaman audio yang tidak lagi digunakan oleh proyek manapun?")) return;
    setCleaningOrphans(true);
    try {
      const fullProjects: StudioProject[] = [currentProject];
      for (const pSummary of projects) {
        if (pSummary.id !== currentProject.id) {
          const loaded = await loadProject(pSummary.id);
          if (loaded) fullProjects.push(loaded);
        }
      }
      const cleaned = await cleanupOrphanAudioBlobs(fullProjects);
      toast(
        cleaned > 0
          ? `Berhasil membersihkan ${cleaned} berkas rekaman tak terpakai! (Mixcraft 10 Hlm. 687)`
          : "Penyimpanan sudah bersih. Tidak ada berkas tak terpakai.",
        "success"
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal membersihkan berkas", "error");
    } finally {
      setCleaningOrphans(false);
    }
  };

  const handleRelinkAssetFile = async (
    oldAssetId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!missingAssetsState) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const newAssetId = `relinked_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const updated = await relinkProjectAsset(
        missingAssetsState.project,
        oldAssetId,
        newAssetId,
        file
      );

      // Recheck remaining missing assets
      const remainingMissing = await checkProjectMissingAssets(updated);
      if (remainingMissing.length === 0) {
        toast("Semua berkas audio berhasil di-relink!", "success");
        onLoadProject(updated);
        onClose();
      } else {
        setMissingAssetsState({ project: updated, missingIds: remainingMissing });
        toast(`Berkas "${file.name}" berhasil di-relink! Sisa ${remainingMissing.length} berkas.`, "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal me-relink berkas", "error");
    }
  };

  const handleKeepOfflineAndLoad = () => {
    if (!missingAssetsState) return;
    onLoadProject(missingAssetsState.project);
    toast(`Proyek "${missingAssetsState.project.name}" dibuka dalam mode offline (hening untuk berkas hilang)`, "info");
    onClose();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus proyek "${name}" dari perangkat ini?`)) return;
    try {
      await deleteProject(id);
      toast(`Proyek "${name}" dihapus.`, "success");
      refreshList();
    } catch {
      toast("Gagal menghapus proyek", "error");
    }
  };

  const handleExportJSON = () => {
    const jsonStr = exportProjectToJSON(currentProject);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentProject.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.musikku`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Berkas proyek .musikku berhasil diekspor", "success");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      const parsed = importProjectFromJSON(content);
      if (parsed.success && parsed.project) {
        await saveProject(parsed.project);
        const missing = await checkProjectMissingAssets(parsed.project);
        if (missing.length > 0) {
          setMissingAssetsState({ project: parsed.project, missingIds: missing });
          toast(`Ditemukan ${missing.length} berkas suara yang hilang dari proyek impor!`, "warning");
        } else {
          onLoadProject(parsed.project);
          toast(`Proyek "${parsed.project.name}" berhasil diimpor!`, "success");
          onClose();
        }
      } else {
        toast(parsed.error || "Format berkas proyek tidak valid", "error");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-card p-6 shadow-2xl space-y-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-violet-600/20 text-violet-400">
              <FolderOpen className="size-4" />
            </span>
            <h2 className="text-sm font-bold text-white">Kelola Proyek Studio</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {missingAssetsState ? (
          /* Mixcraft 10 Hlm. 52 - Missing Sound Files Relinking Dialog */
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
                <AlertTriangle className="size-5" />
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-200">
                  Berkas Audio Hilang (Missing Sound Files)
                </h3>
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  Proyek <strong className="text-white">"{missingAssetsState.project.name}"</strong> memerlukan berkas audio yang tidak ditemukan di penyimpanan lokal perangkat ini. Silakan cari dan relink berkas pengganti dari hard drive Anda, atau buka proyek dengan trek yang hilang dibisukan. (Mixcraft 10 Hlm. 52)
                </p>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 rounded-2xl border border-white/10 bg-black/40 p-3">
              <div className="text-[11px] font-bold text-zinc-400 px-1 uppercase tracking-wider">
                Daftar Aset Audio Hilang ({missingAssetsState.missingIds.length})
              </div>
              {missingAssetsState.missingIds.map((assetId) => (
                <div
                  key={assetId}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <FileAudio className="size-4 shrink-0 text-violet-400" />
                    <span className="truncate font-mono text-[11px] text-zinc-300" title={assetId}>
                      {assetId}
                    </span>
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 cursor-pointer rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-violet-500 transition shadow">
                    <RefreshCw className="size-3" />
                    <span>Relink Berkas...</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => handleRelinkAssetFile(assetId, e)}
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setMissingAssetsState(null)}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-white/5 hover:text-white transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleKeepOfflineAndLoad}
                className="rounded-xl bg-amber-600/80 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600 transition shadow"
              >
                Buka Mode Hening (Offline)
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Current Project Save Section */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Proyek Aktif Saat Ini
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={projectNameInput}
                  onChange={(e) => setProjectNameInput(e.target.value)}
                  placeholder="Nama Proyek..."
                  className="flex-1 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  onClick={handleSaveCurrent}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 transition shadow"
                >
                  <Save className="size-3.5" />
                  <span>Simpan</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={onNewProject}
                  className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white transition"
                >
                  <Plus className="size-3.5 text-pink-400" />
                  <span>Buat Proyek Baru</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1 text-xs text-violet-300 hover:text-white transition"
                >
                  <Download className="size-3.5" />
                  <span>Ekspor .musikku JSON</span>
                </button>
              </div>
            </div>

            {/* Saved Projects List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-white">
                  Pustaka Proyek Tersimpan ({projects.length})
                </span>
                <label className="flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-white cursor-pointer transition">
                  <Upload className="size-3" />
                  <span>Impor Berkas</span>
                  <input
                    type="file"
                    accept=".musikku,.json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>

              {loading ? (
                <p className="text-xs text-zinc-400 text-center py-6">Memuat daftar...</p>
              ) : projects.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6 border border-dashed border-white/10 rounded-2xl">
                  Belum ada proyek lain yang disimpan. Klik Simpan di atas untuk menyimpan proyek saat ini.
                </p>
              ) : (
                projects.map((p) => {
                  const isCurrent = p.id === currentProject.id;
                  const dateStr = new Date(p.updatedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                        isCurrent
                          ? "border-violet-500/50 bg-violet-600/10"
                          : "border-white/5 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{p.name}</span>
                          {isCurrent && (
                            <span className="rounded bg-violet-500/20 px-1.5 py-0.2 text-[9px] font-bold text-violet-300">
                              Aktif
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                          <span>{p.trackCount} Tracks</span>
                          <span>•</span>
                          <span>{p.tempo} BPM</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="size-2.5" />
                            {dateStr}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(p.id, p.name);
                          }}
                          className="rounded p-1 text-zinc-500 hover:bg-red-500/20 hover:text-red-400 transition"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Storage Maintenance Tools (Mixcraft 10 Hlm. 52 & 687) */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={handleAuditCurrentProject}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
              >
                <FileAudio className="size-3 text-cyan-400" />
                <span>Audit Berkas Audio</span>
              </button>
              <button
                type="button"
                onClick={handleCleanupUnusedRecordings}
                disabled={cleaningOrphans}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
              >
                <Sparkles className="size-3 text-red-400" />
                <span>{cleaningOrphans ? "Membersihkan..." : "Bersihkan Rekaman Tak Terpakai"}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
