import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Kueri kosong").max(100, "Kueri terlalu panjang"),
  maxResults: z.coerce.number().int().min(1).max(25).default(12).optional(),
  pageToken: z.string().max(200).optional(),
  type: z.enum(["video"]).default("video").optional(),
});

export const videoIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{11}$/, "ID video tidak valid");

export const playlistSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  description: z.string().trim().max(500).optional().default(""),
  is_public: z.boolean().optional().default(false),
});

export const playlistItemSchema = z.object({
  youtube_video_id: videoIdSchema,
  title_snapshot: z.string().max(300).optional().default(""),
  channel_title_snapshot: z.string().max(200).optional().default(""),
  thumbnail_url_snapshot: z.string().url().max(500).optional().or(z.literal("")),
});

export const favoriteSchema = playlistItemSchema;

export const historySchema = playlistItemSchema;

export const prefsSchema = z.object({
  theme: z.enum(["dark", "light"]).optional(),
  history_enabled: z.boolean().optional(),
});
