"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { VideoItem } from "@/lib/youtube";
import { loadQueue, pushLocalHistory, saveQueue } from "@/lib/storage";

export type PlayerStatus = "idle" | "playing" | "paused" | "error";

interface PlayerState {
  queue: VideoItem[];
  index: number;
  current: VideoItem | null;
  status: PlayerStatus;
  error: string | null;
  isExpanded: boolean;
  playQueue: (items: VideoItem[], startIndex?: number) => void;
  playOne: (item: VideoItem) => void;
  addToQueue: (item: VideoItem) => void;
  next: () => void;
  prev: () => void;
  setStatus: (s: PlayerStatus) => void;
  setError: (msg: string | null) => void;
  setExpanded: (v: boolean) => void;
  clearError: () => void;
  /** Simpan posisi detik untuk lanjutkan setelah instance player berganti. */
  setResume: (videoId: string, seconds: number) => void;
  /** Ambil & hapus posisi tersimpan bila cocok dengan videoId (abaikan bila <5 dtk). */
  takeResume: (videoId: string) => number | null;
}

const Ctx = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<VideoItem[]>([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setExpanded] = useState(false);
  const indexRef = useRef(0);
  indexRef.current = index;

  // Pulihkan antrean dan lagu terakhir saat refresh browser (F5)
  useEffect(() => {
    try {
      const q = loadQueue();
      if (q && q.length > 0) {
        setQueue(q);
        const savedIndex = Number(localStorage.getItem("musikku:player-index") || "0");
        if (Number.isFinite(savedIndex) && savedIndex >= 0 && savedIndex < q.length) {
          setIndex(savedIndex);
        }
      }
    } catch {}
  }, []);

  // Simpan indeks saat lagu berganti
  useEffect(() => {
    try {
      localStorage.setItem("musikku:player-index", String(index));
    } catch {}
  }, [index]);

  // Sinkronisasi antrean & indeks antar tab browser
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "musikku:queue" && e.newValue) {
        try {
          const nextQ = JSON.parse(e.newValue);
          if (Array.isArray(nextQ)) {
            setQueue(nextQ);
          }
        } catch {}
      } else if (e.key === "musikku:player-index" && e.newValue) {
        const i = Number(e.newValue);
        if (Number.isFinite(i)) {
          setIndex(i);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);
  // Posisi terakhir per video — dipakai saat instance player berganti
  // (miniplayer <-> halaman watch) agar lagu lanjut, bukan ngulang.
  const resumeRef = useRef<{ videoId: string; seconds: number } | null>(null);
  const setResume = useCallback((videoId: string, seconds: number) => {
    if (Number.isFinite(seconds) && seconds > 5) {
      resumeRef.current = { videoId, seconds: Math.floor(seconds) };
    }
  }, []);
  const takeResume = useCallback((videoId: string): number | null => {
    const r = resumeRef.current;
    if (r && r.videoId === videoId && r.seconds > 5) {
      resumeRef.current = null;
      return r.seconds;
    }
    return null;
  }, []);
  const clearResume = useCallback(() => {
    resumeRef.current = null;
  }, []);

  // Player resmi YouTube hanya dirender di /watch (kebijakan YouTube melarang
  // audio-only/background). Maka setiap perintah play dari halaman lain harus
  // membawa pengguna ke /watch agar benar-benar terdengar.
  const router = useRouter();
  const pathname = usePathname();
  const goWatch = useCallback(
    (videoId: string) => {
      if (pathname !== "/watch") router.push(`/watch?v=${videoId}`);
    },
    [pathname, router]
  );

  const recordHistory = useCallback((item: VideoItem) => {
    pushLocalHistory(item);
    // simpan ke server bila login; kegagalan diabaikan agar tidak mengganggu pemutaran
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        youtube_video_id: item.videoId,
        title_snapshot: item.title,
        channel_title_snapshot: item.channelTitle,
        thumbnail_url_snapshot: item.thumbnail,
      }),
    }).catch(() => {});
  }, []);

  const playQueue = useCallback(
    (items: VideoItem[], startIndex = 0) => {
      if (items.length === 0) return;
      const i = Math.min(Math.max(startIndex, 0), items.length - 1);
      setQueue(items);
      setIndex(i);
      setError(null);
      setStatus("playing");
      saveQueue(items);
      recordHistory(items[i]);
      clearResume();
      goWatch(items[i].videoId);
    },
    [recordHistory, goWatch, clearResume]
  );

  const playOne = useCallback(
    (item: VideoItem) => {
      setQueue((q) => {
        const exists = q.findIndex((x) => x.videoId === item.videoId);
        if (exists >= 0) {
          setIndex(exists);
          saveQueue(q);
          return q;
        }
        const next = [item, ...q].slice(0, 100);
        setIndex(0);
        saveQueue(next);
        return next;
      });
      setError(null);
      setStatus("playing");
      recordHistory(item);
      clearResume();
      goWatch(item.videoId);
    },
    [recordHistory, goWatch, clearResume]
  );

  const addToQueue = useCallback((item: VideoItem) => {
    setQueue((q) => {
      if (q.some((x) => x.videoId === item.videoId)) return q;
      const next = [...q, item];
      saveQueue(next);
      return next;
    });
  }, []);

  const next = useCallback(() => {
    setQueue((q) => {
      if (q.length === 0) return q;
      const ni = (indexRef.current + 1) % q.length;
      setIndex(ni);
      setError(null);
      setStatus("playing");
      recordHistory(q[ni]);
      return q;
    });
  }, [recordHistory]);

  const prev = useCallback(() => {
    setQueue((q) => {
      if (q.length === 0) return q;
      const pi = (indexRef.current - 1 + q.length) % q.length;
      setIndex(pi);
      setError(null);
      setStatus("playing");
      recordHistory(q[pi]);
      return q;
    });
  }, [recordHistory]);

  const value = useMemo<PlayerState>(
    () => ({
      queue,
      index,
      current: queue[index] ?? null,
      status,
      error,
      isExpanded,
      playQueue,
      playOne,
      addToQueue,
      next,
      prev,
      setStatus,
      setError,
      setExpanded,
      clearError: () => setError(null),
      setResume,
      takeResume,
    }),
    [queue, index, status, error, isExpanded, playQueue, playOne, addToQueue, next, prev, setResume, takeResume]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer harus dipakai di dalam PlayerProvider");
  return v;
}
