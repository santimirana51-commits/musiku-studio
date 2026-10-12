export interface VideoItem {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  thumbnail: string;
  publishedAt?: string;
  duration?: string;
  description?: string;
}

export interface SearchResponse {
  items: VideoItem[];
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo?: { totalResults?: number };
}

export const MUSIC_CATEGORIES = [
  { label: "Pop", query: "pop indonesia terbaru" },
  { label: "Rock", query: "rock indonesia" },
  { label: "Dangdut", query: "dangdut koplo terbaru" },
  { label: "Jazz", query: "jazz indonesia" },
  { label: "Hip-Hop", query: "hip hop indonesia" },
  { label: "K-Pop", query: "kpop hits" },
  { label: "Akustik", query: "akustik indonesia" },
  { label: "Lo-Fi", query: "lofi hip hop" },
] as const;

export const EDITORIAL_QUERIES = [
  "musik pop indonesia terpopuler",
  "dangdut koplo terbaru 2025",
  "lagu akustik santai",
] as const;
