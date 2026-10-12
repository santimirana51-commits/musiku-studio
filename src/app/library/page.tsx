"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Cloud,
  CloudUpload,
  Disc3,
  Download,
  FolderDown,
  Grid3X3,
  List,
  ListMusic,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  Youtube,
} from "lucide-react";
import { usePlayer } from "@/components/player-context";
import { LyricsPanel } from "@/components/lyrics-panel";
import { KaraokeEngine, type LyricLine } from "@/lib/karaoke/engine";
import { parseLrc } from "@/lib/karaoke/lrc";
import { EQ_BANDS, EQ_PRESETS, clampDb, matchPreset } from "@/lib/karaoke/equalizer";
import { LocalAudioEngine, type LocalEngineTrack, type LocalRepeat } from "@/lib/local-player/engine";
import {
  addTrack,
  deleteTrack,
  getAllTracks,
  updateTrack,
  storageEstimate,
  type LocalTrackRecord,
} from "@/lib/local-library/db";
import {
  checkMusicFile,
  maxFileBytes,
  splitArtistTitle,
  formatBytes,
  formatDuration,
} from "@/lib/local-library/validators";

type Source = "youtube" | "device" | "local" | "cloud";
type View = "list" | "grid";
type SortKey = "recent" | "title" | "artist" | "size";

interface CloudRow {
  id: string;
  title: string;
  artist: string;
  album: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  duration_seconds: number | null;
  created_at: string;
}

const LOCAL_MAX = () => maxFileBytes(500);

function probeDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const el = new Audio();
      const done = (v: number | null) => {
        try { URL.revokeObjectURL(url); } catch {}
        resolve(v);
      };
      const timer = setTimeout(() => done(null), 10_000);
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        clearTimeout(timer);
        done(Number.isFinite(el.duration) ? el.duration : null);
      };
      el.onerror = () => {
        clearTimeout(timer);
        done(null);
      };
      el.src = url;
    } catch {
      resolve(null);
    }
  });
}

function LibraryInner() {
  const musicPlayer = usePlayer();
  const [source, setSource] = useState<Source>("local");
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  // Lokal
  const [locals, setLocals] = useState<LocalTrackRecord[]>([]);
  const [deviceFiles, setDeviceFiles] = useState<LocalTrackRecord[]>([]);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<{ usage: number | null; quota: number | null; persisted: boolean | null }>({ usage: null, quota: null, persisted: null });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);

  // Cloud
  const [cloud, setCloud] = useState<CloudRow[]>([]);
  const [cloudUsed, setCloudUsed] = useState(0);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);
  const [cloudLogin, setCloudLogin] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Pemutar lokal
  const engineRef = useRef<LocalAudioEngine | null>(null);
  const [curId, setCurId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [repeat, setRepeat] = useState<LocalRepeat>("off");
  const [shuffle, setShuffle] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const urlsRef = useRef(new Map<string, string>());
  const urlExpRef = useRef(new Map<string, number>());

  // EQ lokal
  const [showEq, setShowEq] = useState(false);
  const [gains, setGains] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem("musikku:local-eq");
      const a = raw ? (JSON.parse(raw) as number[]) : null;
      return Array.isArray(a) && a.length === 10 ? a.map(clampDb) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    } catch {
      return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
  });
  const eqPreset = matchPreset(gains) ?? "custom";

  // LRC lokal
  const [showLrc, setShowLrc] = useState(false);
  const [lrcDraft, setLrcDraft] = useState("");
  const [lrcError, setLrcError] = useState<string | null>(null);
  const [lrcLines, setLrcLines] = useState<LyricLine[]>([]);
  const [lrcActive, setLrcActive] = useState(-1);
  const karaokeRef = useRef<KaraokeEngine | null>(null);
  if (!karaokeRef.current) {
    karaokeRef.current = new KaraokeEngine([], { onActiveLine: (_l, i) => setLrcActive(i) });
  }

  const refreshLocal = useCallback(async () => {
    try {
      setLocals(await getAllTracks());
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "Gagal memuat pustaka lokal.");
    }
    setEstimate(await storageEstimate());
  }, []);

  const refreshCloud = useCallback(async () => {
    setCloudMsg(null);
    try {
      const res = await fetch("/api/library");
      if (res.status === 401) {
        setCloudLogin(true);
        return;
      }
      setCloudLogin(false);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Gagal memuat cloud.");
      setCloud(data.items ?? []);
      setCloudUsed(data.usedBytes ?? 0);
    } catch (e) {
      setCloudMsg(e instanceof Error ? e.message : "Gagal memuat cloud.");
    }
  }, []);

  // Engine lifecycle
  useEffect(() => {
    const eng = new LocalAudioEngine((e) => {
      const cur = eng.current;
      setCurId(cur?.id ?? null);
      setPlaying(e.status === "playing");
      setDur(cur?.duration ?? eng.getTime());
      if (e.type === "time") {
        setPos(eng.getTime());
        setDur(cur?.duration ?? eng.getTime());
      }
      if (e.type === "error") setPlayError(e.message ?? "Gagal memutar.");
      else if (e.type !== "time") setPlayError(null);
    });
    eng.setVolume(volume);
    engineRef.current = eng;
    karaokeRef.current?.attach({ getCurrentTime: () => eng.getTime() });
    void refreshLocal();
    const urls = urlsRef.current;
    return () => {
      karaokeRef.current?.detach();
      eng.destroy();
      engineRef.current = null;
      urls.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch {}
      });
      urls.clear();
    };
    // Mount-sekali: refreshLocal stabil, volume awal 0.9.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const objectUrl = useCallback((id: string, blob: Blob): string => {
    const hit = urlsRef.current.get(id);
    if (hit) return hit;
    const u = URL.createObjectURL(blob);
    urlsRef.current.set(id, u);
    return u;
  }, []);

  const cloudUrl = useCallback(async (row: CloudRow): Promise<string> => {
    const exp = urlExpRef.current.get(row.id) ?? 0;
    const hit = urlsRef.current.get(`cloud:${row.id}`);
    if (hit && Date.now() < exp) return hit;
    const res = await fetch(`/api/library/${row.id}/url`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Gagal membuat URL putar.");
    if (hit) {
      try { URL.revokeObjectURL(hit); } catch {}
    }
    urlsRef.current.set(`cloud:${row.id}`, data.url);
    urlExpRef.current.set(row.id, Date.now() + (data.expiresIn - 60) * 1000);
    return data.url as string;
  }, []);

  const toEngineTrack = useCallback(
    async (kind: "device" | "local" | "cloud", rec: LocalTrackRecord | CloudRow): Promise<LocalEngineTrack> => {
      if (kind === "cloud") {
        const r = rec as CloudRow;
        return { id: `cloud:${r.id}`, title: r.title, artist: r.artist, duration: r.duration_seconds, src: await cloudUrl(r) };
      }
      const r = rec as LocalTrackRecord;
      return { id: `${kind}:${r.id}`, title: r.title, artist: r.artist, duration: r.duration, src: objectUrl(`${kind}:${r.id}`, r.blob) };
    },
    [cloudUrl, objectUrl]
  );

  const playTracks = useCallback(
    async (kind: "device" | "local" | "cloud", list: Array<LocalTrackRecord | CloudRow>, start: number) => {
      const eng = engineRef.current;
      if (!eng || list.length === 0) return;
      setPlayError(null);
      try {
        const tracks: LocalEngineTrack[] = [];
        for (const item of list) tracks.push(await toEngineTrack(kind, item));
        // Jeda pemutar YouTube global agar tidak audio ganda.
        musicPlayer.setStatus("paused");
        eng.setQueue(tracks, start);
        eng.applyEq(gains);
        await eng.play();
        // Muat LRC tersimpan (khusus lokal) untuk sinkronisasi.
        const first = list[start] as LocalTrackRecord;
        if (kind === "local" && first && typeof first.lrcText === "string" && first.lrcText) {
          const p = parseLrc(first.lrcText);
          setLrcLines(p.lines);
          karaokeRef.current?.setLines(p.lines);
          setLrcDraft(first.lrcText);
        } else {
          setLrcLines([]);
          karaokeRef.current?.setLines([]);
        }
        karaokeRef.current?.handleVideoChange();
      } catch (e) {
        setPlayError(e instanceof Error ? e.message : "Gagal memutar.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toEngineTrack, gains]
  );

  // ---------- impor ----------
  const importFiles = useCallback(
    async (files: FileList | File[], save: boolean) => {
      setImportMsg(null);
      if (typeof indexedDB === "undefined") {
        setImportMsg("Browser tidak mendukung IndexedDB — impor dibatalkan.");
        return;
      }
      const arr = Array.from(files);
      let ok = 0;
      const problems: string[] = [];
      for (const f of arr) {
        const check = checkMusicFile(f.name, f.type || "application/octet-stream", f.size, LOCAL_MAX());
        if (!check.ok) {
          problems.push(`${f.name}: ${check.message}`);
          continue;
        }
        try {
          const duration = await probeDuration(f);
          const { artist, title } = splitArtistTitle(f.name);
          const rec: LocalTrackRecord = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            title,
            artist,
            album: "",
            fileName: f.name,
            mime: check.mime,
            size: f.size,
            duration,
            blob: f,
            lrcText: "",
            source: save ? "local" : "device",
            importedAt: new Date().toISOString(),
          };
          if (save) await addTrack(rec);
          else setDeviceFiles((d) => [rec, ...d].slice(0, 100));
          ok += 1;
        } catch (e) {
          problems.push(`${f.name}: ${e instanceof Error ? e.message : "gagal"}`);
        }
      }
      if (save) await refreshLocal();
      setEstimate(await storageEstimate());
      setImportMsg(
        `${ok} file ${save ? "tersimpan" : "siap diputar"}` +
          (problems.length ? `. Gagal: ${problems.slice(0, 3).join("; ")}${problems.length > 3 ? "…" : ""}` : ".")
      );
    },
    [refreshLocal]
  );

  const removeLocal = useCallback(
    async (id: string) => {
      const eng = engineRef.current;
      if (eng?.current?.id === `local:${id}` || eng?.current?.id === `device:${id}`) {
        eng.pause();
        eng.setQueue([], 0);
      }
      await deleteTrack(id);
      const u = urlsRef.current.get(`local:${id}`) ?? urlsRef.current.get(`device:${id}`);
      if (u) {
        try { URL.revokeObjectURL(u); } catch {}
        urlsRef.current.delete(`local:${id}`);
        urlsRef.current.delete(`device:${id}`);
      }
      setLocals((l) => l.filter((t) => t.id !== id));
      setDeviceFiles((l) => l.filter((t) => t.id !== id));
      setConfirmDelete(null);
    },
    []
  );

  // ---------- cloud upload (eksplisit, progress, retry) ----------
  const uploadToCloud = useCallback(
    async (file: Blob, name: string, mime: string, onDone: () => void, knownDuration?: number | null) => {
      setCloudMsg(null);
      setUploadName(name);
      setUploadPct(0);
      const putFile = async (): Promise<void> => {
        const q = new URLSearchParams({ filename: name, mime, size: String(file.size) });
        const sres = await fetch(`/api/library/upload-url?${q.toString()}`);
        const sdata = await sres.json().catch(() => ({}));
        if (!sres.ok) throw new Error(sdata?.error ?? "Gagal menyiapkan upload.");
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", sdata.uploadUrl);
          xhr.setRequestHeader("Content-Type", mime);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload gagal (${xhr.status}).`)));
          xhr.onerror = () => reject(new Error("Jaringan gagal saat upload."));
          xhr.send(file);
        });
        const { artist, title } = splitArtistTitle(name);
        const duration = knownDuration ?? (file instanceof File ? await probeDuration(file) : null);
        const mres = await fetch("/api/library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            artist,
            album: "",
            storage_path: sdata.path,
            mime_type: mime,
            file_size: file.size,
            duration_seconds: duration,
          }),
        });
        const mdata = await mres.json().catch(() => ({}));
        if (!mres.ok) throw new Error(mdata?.error ?? "Gagal menyimpan metadata.");
      };
      try {
        await putFile();
        setUploadPct(null);
        setCloudMsg(`"${name}" terunggah ke cloud.`);
        onDone();
        await refreshCloud();
      } catch (e) {
        setUploadPct(null);
        setCloudMsg(`${e instanceof Error ? e.message : "Upload gagal."} Gunakan coba lagi (retry aman: URL baru diterbitkan).`);
      }
    },
    [refreshCloud]
  );

  const downloadCloudForOffline = useCallback(
    async (r: CloudRow) => {
      setDownloadingId(r.id);
      try {
        const res = await fetch(`/api/library/${r.id}/download`);
        if (!res.ok) throw new Error("Gagal memperoleh link download cloud.");
        const { url } = await res.json();
        const blobRes = await fetch(url);
        if (!blobRes.ok) throw new Error("Gagal mengunduh file audio dari cloud.");
        const blob = await blobRes.blob();

        const rec: LocalTrackRecord = {
          id: `cloud-dl-${r.id}`,
          title: r.title,
          artist: r.artist || "Cloud Artist",
          album: "Pustaka Cloud (Offline)",
          fileName: `${r.title}.mp3`,
          mime: r.mime_type || "audio/mpeg",
          size: r.file_size,
          duration: r.duration_seconds,
          blob,
          lrcText: "",
          source: "local",
          importedAt: new Date().toISOString(),
        };

        await addTrack(rec);
        await refreshLocal();
        setCloudMsg(`"${r.title}" berhasil disimpan ke Pustaka Lokal untuk diputar offline.`);
      } catch (err) {
        setCloudMsg(err instanceof Error ? err.message : "Gagal mengunduh untuk offline.");
      } finally {
        setDownloadingId(null);
      }
    },
    [refreshLocal]
  );

  // ---------- ekspor / pemulihan metadata ----------
  const exportJson = useCallback(() => {
    const payload = {
      app: "musikku-library",
      version: 1,
      exportedAt: new Date().toISOString(),
      note: "Hanya metadata — blob audio TIDAK ikut (tetap di perangkat).",
      tracks: locals.map(({ blob: _b, ...m }) => {
        void _b; // blob tidak ikut ekspor — tetap di perangkat
        return m;
      }),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "musikku-library.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [locals]);

  const importJson = useCallback(
    async (f: File) => {
      setImportMsg(null);
      try {
        const j = JSON.parse(await f.text()) as { tracks?: Array<{ title?: string; size?: number }> };
        const backed = j.tracks ?? [];
        const matched = backed.filter((b) => locals.some((l) => l.title === b.title && l.size === b.size)).length;
        setImportMsg(
          `Backup berisi ${backed.length} metadata; ${matched} cocok dengan file di perangkat ini. ` +
            `Blob audio tidak dapat dipulihkan dari JSON — impor ulang file yang hilang.`
        );
      } catch {
        setImportMsg("File backup tidak valid.");
      }
    },
    [locals]
  );

  // ---------- tampilkan ----------
  const localView = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = locals.filter((t) => !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
    arr = arr.slice().sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "artist") return (a.artist || "~").localeCompare(b.artist || "~");
      if (sort === "size") return b.size - a.size;
      return b.importedAt.localeCompare(a.importedAt);
    });
    return arr;
  }, [locals, search, sort]);

  const cloudView = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cloud.filter((t) => !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
  }, [cloud, search]);

  // Dibaca tiap render (render dipicu state curId/pos/status) — cukup segar.
  const currentTrack = engineRef.current?.current ?? null;

  const applyGains = (g: number[]) => {
    const next = g.map(clampDb);
    setGains(next);
    engineRef.current?.applyEq(next);
    try {
      localStorage.setItem("musikku:local-eq", JSON.stringify(next));
    } catch {}
  };

  const youtubeCurrent = musicPlayer.current;
  const showLocalMini = curId !== null;

  return (
    <div className="space-y-6 pb-40">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-700/40 via-fuchsia-700/20 to-pink-600/20 p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500">
            <ListMusic className="size-6 text-white" aria-hidden />
          </span>
          <h1 className="text-2xl font-extrabold text-white md:text-3xl">
            Pustaka <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">Musik</span>
          </h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-zinc-300">
          File perangkat diputar lokal tanpa diunggah. Simpan ke pustaka lokal (IndexedDB) atau
          cloud privat (login + aksi eksplisit). Anda bertanggung jawab atas hak file yang diimpor/diunggah.
        </p>
        {/* Source selector */}
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Sumber musik">
          {(
            [
              { k: "youtube", label: "YouTube", icon: Youtube },
              { k: "device", label: "File Perangkat", icon: FolderDown },
              { k: "local", label: "Pustaka Lokal", icon: Disc3 },
              { k: "cloud", label: "Pustaka Cloud", icon: Cloud },
            ] as const
          ).map((s) => (
            <button
              key={s.k}
              role="tab"
              aria-selected={source === s.k}
              onClick={() => setSource(s.k)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition ${
                source === s.k
                  ? "border-transparent bg-gradient-to-r from-violet-600 to-pink-500 text-white"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:border-fuchsia-500/40 hover:text-white"
              }`}
            >
              <s.icon className="size-4" aria-hidden /> {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* YOUTUBE */}
      {source === "youtube" && (
        <section className="space-y-3 rounded-3xl border border-white/10 bg-card p-6" aria-label="Sumber YouTube">
          <h2 className="text-lg font-bold text-white">Sumber: YouTube</h2>
          <p className="text-sm text-zinc-400">
            Musik YouTube diputar lewat player resmi di halaman khusus — tidak dapat di-EQ/diunduh/diubah aplikasi.
            {youtubeCurrent ? ` Sedang diputar: ${youtubeCurrent.title}.` : " Belum ada yang diputar."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/search" className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white">Cari di YouTube</Link>
            <Link href="/karaoke" className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/15">Mode Karaoke</Link>
            {youtubeCurrent && (
              <Link href={`/watch?v=${youtubeCurrent.videoId}`} className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/15">Buka Pemutar</Link>
            )}
          </div>
        </section>
      )}

      {/* DEVICE */}
      {source === "device" && (
        <section className="space-y-3 rounded-3xl border border-white/10 bg-card p-6" aria-label="File perangkat">
          <h2 className="text-lg font-bold text-white">File Perangkat</h2>
          <p className="text-sm text-zinc-400">Pilih file audio — langsung diputar, <strong>tanpa diunggah</strong> ke mana pun.</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-fuchsia-500/40 px-4 py-6 text-sm font-bold text-fuchsia-200 hover:bg-fuchsia-500/10">
            <Upload className="size-5" aria-hidden /> Pilih file audio (MP3/WAV/OGG/FLAC/M4A/AAC)
            <input type="file" accept="audio/*,.flac,.m4a,.aac,.ogg,.oga,.wav,.mp3" multiple className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) void importFiles(e.target.files, false);
                e.target.value = "";
              }} />
          </label>
          {importMsg && <p className="text-sm text-zinc-300" role="status">{importMsg}</p>}
          {deviceFiles.length > 0 && (
            <div className="space-y-2">
              {deviceFiles.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                  <button onClick={() => void playTracks("device", deviceFiles, i)} aria-label={`Putar ${t.title}`}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-white">
                    <Play className="size-4" aria-hidden />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{t.title}</p>
                    <p className="truncate text-xs text-zinc-400">{t.artist || t.fileName} • {formatBytes(t.size)}{t.duration ? ` • ${formatDuration(t.duration)}` : ""}</p>
                  </div>
                  <button onClick={() => {
                    const f = new File([t.blob], t.fileName, { type: t.mime });
                    void importFiles([f], true);
                  }}
                    aria-label={`Simpan ${t.title} ke pustaka lokal`} title="Simpan ke pustaka lokal"
                    className="rounded-lg p-2 text-zinc-300 hover:bg-white/10 hover:text-white">
                    <Download className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* LOCAL */}
      {source === "local" && (
        <section className="space-y-3" aria-label="Pustaka lokal">
          <div className="rounded-3xl border border-white/10 bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-white">Pustaka Lokal (perangkat ini)</h2>
              <div className="flex gap-2">
                <button onClick={() => setView(view === "list" ? "grid" : "list")} aria-label={view === "list" ? "Tampilan grid" : "Tampilan daftar"}
                  className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/15">
                  {view === "list" ? <Grid3X3 className="size-4" aria-hidden /> : <List className="size-4" aria-hidden />}
                </button>
                <button onClick={exportJson} aria-label="Ekspor metadata JSON" title="Ekspor metadata (tanpa blob audio)"
                  className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/15">
                  <FolderDown className="size-4" aria-hidden />
                </button>
                <label className="cursor-pointer rounded-lg bg-white/10 p-2 text-white hover:bg-white/15" title="Pulihkan dari backup JSON (metadata)">
                  <Upload className="size-4" aria-hidden />
                  <input type="file" accept="application/json" className="sr-only"
                    onChange={(e) => {
                      if (e.target.files?.[0]) void importJson(e.target.files[0]);
                      e.target.value = "";
                    }} />
                </label>
              </div>
            </div>
            <p className="mt-1 text-xs text-zinc-400" role="status">
              {estimate.usage !== null && estimate.quota ? `Terpakai ${formatBytes(estimate.usage)} dari ~${formatBytes(estimate.quota)}` : "Estimasi penyimpanan tak tersedia di browser ini."}
              {estimate.persisted === true ? " • Penyimpanan persisten aktif." : estimate.persisted === false ? " • Persistensi ditolak browser — data bisa hilang saat kekurangan ruang." : ""}
            </p>
            <p className="mt-1 text-[11px] text-amber-300/80">
              Peringatan: menghapus data situs akan menghapus koleksi lokal (tanpa backup otomatis).
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul/artis…"
                aria-label="Cari pustaka lokal" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500" />
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Urutkan"
                className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white">
                <option value="recent">Terbaru</option>
                <option value="title">Judul</option>
                <option value="artist">Artis</option>
                <option value="size">Ukuran</option>
              </select>
              <label className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2 text-center text-sm font-bold text-white">
                + Impor
                <input type="file" accept="audio/*,.flac,.m4a,.aac,.ogg,.oga,.wav,.mp3" multiple className="sr-only"
                  onChange={(e) => {
                    if (e.target.files?.length) void importFiles(e.target.files, true);
                    e.target.value = "";
                  }} />
              </label>
            </div>
            {importMsg && <p className="mt-2 text-sm text-zinc-300" role="status">{importMsg}</p>}
            {localView.length > 0 && (
              <button onClick={() => void playTracks("local", localView, 0)}
                className="mt-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white">
                Putar semua ({localView.length})
              </button>
            )}
          </div>

          {localView.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-400">
              Pustaka lokal kosong. Impor file audio untuk mulai.
            </p>
          ) : (
            <div className={view === "grid" ? "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" : "space-y-2"}>
              {localView.map((t) => {
                const idx = localView.indexOf(t);
                return view === "grid" ? (
                  <article key={t.id} className="overflow-hidden rounded-2xl border border-white/5 bg-card">
                    <button onClick={() => void playTracks("local", localView, idx)} aria-label={`Putar ${t.title}`}
                      className="grid aspect-video w-full place-items-center bg-gradient-to-br from-violet-700/40 to-pink-600/20">
                      <Disc3 className="size-10 text-fuchsia-300" aria-hidden />
                    </button>
                    <div className="p-3">
                      <h3 className="line-clamp-1 text-sm font-semibold text-white">{t.title}</h3>
                      <p className="truncate text-xs text-zinc-400">{t.artist || "Artis tak dikenal"} • {t.duration ? formatDuration(t.duration) : "--:--"}</p>
                      <div className="mt-2 flex gap-1">
                        <button onClick={() => void playTracks("local", localView, idx)} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">Putar</button>
                        <button onClick={() => setConfirmDelete({ id: t.id, title: t.title })} aria-label={`Hapus ${t.title}`}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-500/20 hover:text-red-300"><Trash2 className="size-4" aria-hidden /></button>
                      </div>
                    </div>
                  </article>
                ) : (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                    <button onClick={() => void playTracks("local", localView, idx)} aria-label={`Putar ${t.title}`}
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-white">
                      <Play className="size-4" aria-hidden />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{t.title}</p>
                      <p className="truncate text-xs text-zinc-400">
                        {t.artist || "Artis tak dikenal"} • {formatBytes(t.size)} • {t.duration ? formatDuration(t.duration) : "--:--"}
                        {t.lrcText ? " • LRC ✓" : ""}
                      </p>
                    </div>
                    <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-300 sm:block">LOKAL</span>
                    <button onClick={() => void uploadToCloud(t.blob, t.fileName, t.mime, () => {}, t.duration)} aria-label={`Upload ${t.title} ke cloud`} title="Upload ke cloud (eksplisit)"
                      className="rounded-lg p-2 text-zinc-300 hover:bg-white/10 hover:text-white"><CloudUpload className="size-4" aria-hidden /></button>
                    <button onClick={() => setConfirmDelete({ id: t.id, title: t.title })} aria-label={`Hapus ${t.title}`}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-red-500/20 hover:text-red-300"><Trash2 className="size-4" aria-hidden /></button>
                  </div>
                );
              })}
            </div>
          )}
          {uploadPct !== null && (
            <div className="rounded-2xl border border-white/10 bg-card p-3 text-xs text-zinc-300" role="status">
              Mengunggah {uploadName}: {uploadPct}%
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}
          {cloudMsg && <p className="text-sm text-zinc-300" role="status">{cloudMsg}</p>}
        </section>
      )}

      {/* CLOUD */}
      {source === "cloud" && (
        <section className="space-y-3 rounded-3xl border border-white/10 bg-card p-6" aria-label="Pustaka cloud">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-white">Pustaka Cloud (privat)</h2>
            <button onClick={() => void refreshCloud()} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/15">Muat ulang</button>
          </div>
          {cloudLogin ? (
            <p className="text-sm text-zinc-300">
              Harus login untuk cloud privat. <Link href="/login" className="text-fuchsia-300 underline">Masuk</Link>
            </p>
          ) : (
            <>
              <p className="text-xs text-zinc-400" role="status">
                {cloud.length} lagu • {formatBytes(cloudUsed)} terpakai. File di bucket privat, diputar via URL bertanda 5 menit.
              </p>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-fuchsia-500/40 px-4 py-4 text-sm font-bold text-fuchsia-200 hover:bg-fuchsia-500/10">
                <CloudUpload className="size-5" aria-hidden /> Upload eksplisit ke cloud
                <input type="file" accept="audio/*,.flac,.m4a,.aac,.ogg,.oga,.wav,.mp3" className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadToCloud(f, f.name, f.type || "application/octet-stream", () => {});
                    e.target.value = "";
                  }} />
              </label>
              {uploadPct !== null && (
                <div className="text-xs text-zinc-300" role="status">
                  Mengunggah {uploadName}: {uploadPct}%
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${uploadPct}%` }} />
                  </div>
                </div>
              )}
              {cloudMsg && <p className="text-sm text-zinc-300" role="status">{cloudMsg}</p>}
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul/artis…"
                aria-label="Cari pustaka cloud" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500" />
              {cloudView.length > 0 && (
                <button onClick={async () => {
                  const eng = engineRef.current;
                  if (!eng) return;
                  const tracks: LocalEngineTrack[] = [];
                  for (const r of cloudView) tracks.push(await toEngineTrack("cloud", r));
                  musicPlayer.setStatus("paused");
                  eng.setQueue(tracks, 0);
                  eng.applyEq(gains);
                  await eng.play();
                }} className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white">
                  Putar semua ({cloudView.length})
                </button>
              )}
              <div className="space-y-2">
                {cloudView.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                    <button onClick={() => void playTracks("cloud", cloudView, i)} aria-label={`Putar ${r.title}`}
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-white">
                      <Play className="size-4" aria-hidden />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{r.title}</p>
                      <p className="truncate text-xs text-zinc-400">
                        {r.artist || "Artis tak dikenal"} • {formatBytes(r.file_size)} • {r.duration_seconds ? formatDuration(r.duration_seconds) : "--:--"}
                      </p>
                    </div>
                    <span className="hidden rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-200 sm:block">CLOUD</span>
                    <button
                      onClick={() => void downloadCloudForOffline(r)}
                      disabled={downloadingId === r.id}
                      aria-label={`Unduh ${r.title} untuk diputar offline`}
                      title="Simpan ke pustaka lokal untuk diputar offline"
                      className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                      <Download className={`size-4 ${downloadingId === r.id ? "animate-bounce text-violet-400" : ""}`} aria-hidden />
                    </button>
                    <button onClick={async () => {
                      if (!confirm(`Hapus "${r.title}" dari cloud? File dan metadata dihapus permanen.`)) return;
                      const res = await fetch(`/api/library/${r.id}`, { method: "DELETE" });
                      if (res.ok) void refreshCloud();
                      else setCloudMsg("Gagal menghapus.");
                    }} aria-label={`Hapus ${r.title}`}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-red-500/20 hover:text-red-300"><Trash2 className="size-4" aria-hidden /></button>
                  </div>
                ))}
                {cloudView.length === 0 && <p className="text-sm text-zinc-500">Belum ada musik cloud.</p>}
              </div>
            </>
          )}
        </section>
      )}

      {/* Mini player lokal */}
      {showLocalMini && (
        <div className={`fixed inset-x-0 z-40 ${youtubeCurrent ? "bottom-32 md:bottom-24" : "bottom-16 md:bottom-0 md:left-60"}`} role="region" aria-label="Pemutar lokal">
          <div className="border-t border-white/10 bg-surface/95 backdrop-blur">
            <div className="space-y-1.5 px-3 py-2.5 md:px-6">
              <div className="flex items-center gap-2">
                <Disc3 className="size-8 shrink-0 text-fuchsia-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{currentTrack?.title ?? "—"}</p>
                  <p className="truncate text-xs text-zinc-400">{currentTrack?.artist || "File lokal"} • {formatDuration(pos)} / {formatDuration(dur)}</p>
                  {playError && <p className="truncate text-xs text-red-400">{playError}</p>}
                </div>
                <button onClick={() => engineRef.current?.prev()} aria-label="Sebelumnya" className="rounded-full p-2 text-zinc-300 hover:bg-white/10"><SkipBack className="size-5" aria-hidden /></button>
                <button onClick={() => engineRef.current?.toggle()} aria-label={playing ? "Jeda" : "Putar"}
                  className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-white">
                  {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
                </button>
                <button onClick={() => engineRef.current?.next()} aria-label="Berikutnya" className="rounded-full p-2 text-zinc-300 hover:bg-white/10"><SkipForward className="size-5" aria-hidden /></button>
                <button onClick={() => { const v = !shuffle; setShuffle(v); engineRef.current?.setShuffle(v); }} aria-label="Acak" aria-pressed={shuffle}
                  className={`rounded-full p-2 ${shuffle ? "text-fuchsia-300" : "text-zinc-300"} hover:bg-white/10`}><Shuffle className="size-5" aria-hidden /></button>
                <button onClick={() => {
                  const order: LocalRepeat[] = ["off", "all", "one"];
                  const n = order[(order.indexOf(repeat) + 1) % 3];
                  setRepeat(n);
                  engineRef.current?.setRepeat(n);
                }} aria-label={`Ulangi: ${repeat}`} className={`rounded-full p-2 ${repeat !== "off" ? "text-fuchsia-300" : "text-zinc-300"} hover:bg-white/10`}>
                  {repeat === "one" ? <Repeat1 className="size-5" aria-hidden /> : <Repeat className="size-5" aria-hidden />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={Math.max(dur, 1)} step={1} value={Math.min(pos, Math.max(dur, 1))}
                  onChange={(e) => engineRef.current?.seekTo(Number(e.target.value))} aria-label="Posisi putar" className="flex-1" />
                <Volume2 className="size-4 shrink-0 text-zinc-400" aria-hidden />
                <input type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={(e) => { const v = Number(e.target.value); setVolume(v); engineRef.current?.setVolume(v); }}
                  aria-label="Volume" className="w-20 sm:w-28" />
                <button onClick={() => setShowEq(!showEq)} aria-expanded={showEq} aria-label="Equalizer lokal"
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${showEq ? "bg-fuchsia-500/30 text-white" : "bg-white/10 text-zinc-300"}`}>EQ</button>
                <button onClick={() => setShowLrc(!showLrc)} aria-expanded={showLrc} aria-label="Lirik LRC"
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${showLrc ? "bg-fuchsia-500/30 text-white" : "bg-white/10 text-zinc-300"}`}>LRC</button>
              </div>
              {showEq && (
                <div className="rounded-xl bg-white/5 p-2.5">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preset EQ lokal">
                    {EQ_PRESETS.map((p) => (
                      <button key={p.name} onClick={() => applyGains([...p.gains])} aria-pressed={eqPreset === p.name}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${eqPreset === p.name ? "bg-gradient-to-r from-violet-600 to-pink-500 text-white" : "bg-white/10 text-zinc-300"}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                    {EQ_BANDS.map((b, i) => (
                      <label key={b.freq} className="flex flex-col items-center gap-0.5">
                        <span className="font-mono text-[10px] font-bold text-fuchsia-200">{gains[i] > 0 ? `+${gains[i]}` : gains[i]}</span>
                        <input type="range" min={-12} max={12} step={0.5} value={gains[i]} aria-label={`EQ ${b.label}`}
                          onChange={(e) => {
                            const g = gains.slice();
                            g[i] = clampDb(Number(e.target.value));
                            applyGains(g);
                          }} className="w-full" />
                        <span className="text-[9px] text-zinc-500">{b.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">EQ memproses file lokal via Web Audio. Tidak berlaku untuk audio YouTube.</p>
                </div>
              )}
              {showLrc && (
                <div className="space-y-2 rounded-xl bg-white/5 p-2.5">
                  <LyricsPanel lines={lrcLines} activeIndex={lrcActive} />
                  <textarea value={lrcDraft} onChange={(e) => setLrcDraft(e.target.value)} rows={3}
                    placeholder="[00:10.00] Baris lirik milikmu…" aria-label="Lirik LRC"
                    className="w-full rounded-lg bg-black/40 p-2 font-mono text-xs text-white" />
                  {lrcError && <p className="text-xs text-red-400">{lrcError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const p = parseLrc(lrcDraft);
                      if (p.lines.length === 0) {
                        setLrcError(`LRC tidak valid: ${p.errors[0]?.reason ?? "kosong"}`);
                        return;
                      }
                      setLrcError(null);
                      setLrcLines(p.lines);
                      karaokeRef.current?.setLines(p.lines);
                      karaokeRef.current?.handleVideoChange();
                    }} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/15">Terapkan</button>
                    <button onClick={async () => {
                      const id = engineRef.current?.current?.id ?? "";
                      if (!id.startsWith("local:")) {
                        setLrcError("Simpan lirik hanya untuk lagu pustaka lokal.");
                        return;
                      }
                      await updateTrack(id.replace("local:", ""), { lrcText: lrcDraft });
                      await refreshLocal();
                      setLrcError(null);
                      setImportMsg("Lirik tersimpan di lagu lokal.");
                    }} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/15">Simpan lirik</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi hapus */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="alertdialog" aria-modal="true" aria-label="Konfirmasi hapus">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-5">
            <h3 className="font-bold text-white">Hapus lagu lokal?</h3>
            <p className="mt-1 text-sm text-zinc-400">“{confirmDelete.title}” dihapus permanen dari perangkat ini.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => void removeLocal(confirmDelete.id)}
                className="flex-1 rounded-xl bg-red-500/80 px-4 py-2 text-sm font-bold text-white hover:bg-red-500">Hapus</button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">Batal</button>
            </div>
          </div>
        </div>
      )}

      <p className="flex items-start gap-2 pb-4 text-[11px] text-zinc-600">
        <Mic2 className="size-4 shrink-0" aria-hidden />
        <span>
          File lokal tidak pernah diunggah otomatis; cloud hanya lewat tombol eksplisit setelah login.
          Jangan mengimpor/mengunggah karya berhak cipta tanpa izin. Kredensial server tidak pernah dikirim ke browser.
        </span>
      </p>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Memuat pustaka…</p>}>
      <LibraryInner />
    </Suspense>
  );
}
