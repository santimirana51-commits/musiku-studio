import { describe, it, expect } from "vitest";
import { searchQuerySchema, videoIdSchema, playlistSchema, favoriteSchema } from "@/lib/validation";

describe("validasi pencarian", () => {
  it("menerima query valid", () => {
    const r = searchQuerySchema.safeParse({ q: "noah separuh aku", maxResults: 12 });
    expect(r.success).toBe(true);
  });
  it("menolak query kosong", () => {
    const r = searchQuerySchema.safeParse({ q: "   ", maxResults: 12 });
    expect(r.success).toBe(false);
  });
  it("menolak query terlalu panjang", () => {
    const r = searchQuerySchema.safeParse({ q: "x".repeat(101), maxResults: 12 });
    expect(r.success).toBe(false);
  });
  it("membatasi maxResults 1..25", () => {
    expect(searchQuerySchema.safeParse({ q: "a", maxResults: 0 }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: "a", maxResults: 26 }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: "a", maxResults: 25 }).success).toBe(true);
  });
});

describe("validasi video & playlist", () => {
  it("videoId harus 11 karakter YouTube", () => {
    expect(videoIdSchema.safeParse("dQw4w9WgXcQ").success).toBe(true);
    expect(videoIdSchema.safeParse("terlalu-pendek").success).toBe(false);
    expect(videoIdSchema.safeParse("").success).toBe(false);
  });
  it("playlist butuh nama", () => {
    expect(playlistSchema.safeParse({ name: "" }).success).toBe(false);
    expect(playlistSchema.safeParse({ name: "Santuy" }).success).toBe(true);
  });
  it("favorit butuh youtube_video_id valid", () => {
    expect(favoriteSchema.safeParse({ youtube_video_id: "dQw4w9WgXcQ" }).success).toBe(true);
    expect(favoriteSchema.safeParse({ youtube_video_id: "salah" }).success).toBe(false);
  });
});
