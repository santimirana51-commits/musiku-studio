import type { VideoItem } from "@/lib/youtube";

const QUEUE_KEY = "musikku:queue";
const HISTORY_KEY = "musikku:history";
const FAV_KEY = "musikku:favorites-anon";
const RECENT_KEY = "musikku:recent-searches";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadQueue(): VideoItem[] {
  if (typeof window === "undefined") return [];
  return safeParse<VideoItem[]>(localStorage.getItem(QUEUE_KEY), []);
}
export function saveQueue(q: VideoItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(0, 100)));
  } catch {}
}

export function loadAnonFavorites(): VideoItem[] {
  if (typeof window === "undefined") return [];
  return safeParse<VideoItem[]>(localStorage.getItem(FAV_KEY), []);
}
export function toggleAnonFavorite(v: VideoItem): VideoItem[] {
  const cur = loadAnonFavorites();
  const exists = cur.some((x) => x.videoId === v.videoId);
  const next = exists
    ? cur.filter((x) => x.videoId !== v.videoId)
    : [v, ...cur].slice(0, 200);
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function loadLocalHistory(): (VideoItem & { playedAt: string })[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(HISTORY_KEY), []);
}
export function pushLocalHistory(v: VideoItem) {
  try {
    const cur = loadLocalHistory().filter((x) => x.videoId !== v.videoId);
    const next = [{ ...v, playedAt: new Date().toISOString() }, ...cur].slice(0, 100);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
}
export function clearLocalHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
}

export function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  return safeParse<string[]>(localStorage.getItem(RECENT_KEY), []);
}
export function pushRecentSearch(q: string) {
  try {
    const cur = loadRecentSearches().filter(
      (x) => x.toLowerCase() !== q.toLowerCase()
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...cur].slice(0, 10)));
  } catch {}
}
