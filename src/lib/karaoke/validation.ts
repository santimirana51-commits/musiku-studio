import { z } from "zod";
import { videoIdSchema } from "@/lib/validation";
import { LRC_MAX_CHARS, validateLrc } from "@/lib/karaoke/lrc";

// Sumber lirik yang sah: hanya yang diunggah/dibuat pengguna sendiri atau
// berlisensi eksplisit. TIDAK ada scraping, TIDAK ada auto-fetch dari YouTube.
export const lyricSourceTypeSchema = z.enum(["user_upload", "user_created", "licensed"]);

export const lyricVisibilitySchema = z.enum(["private", "public"]);

export const karaokeLyricSchema = z.object({
  youtube_video_id: videoIdSchema,
  title: z.string().trim().min(1, "Judul wajib diisi").max(300),
  language: z
    .string()
    .trim()
    .min(2, "Kode bahasa minimal 2 huruf (mis. id/en)")
    .max(10)
    .regex(/^[a-zA-Z-]+$/, "Kode bahasa hanya huruf dan strip")
    .default("id"),
  source_type: lyricSourceTypeSchema,
  source_reference: z.string().trim().max(500).optional().default(""),
  lyrics_lrc: z
    .string()
    .min(1, "Lirik LRC wajib diisi")
    .max(LRC_MAX_CHARS, `Lirik melebihi ${LRC_MAX_CHARS} karakter`)
    .refine((s) => validateLrc(s).ok, {
      message: "Format LRC tidak valid. Gunakan baris [mm:ss.xx] teks lirik.",
    }),
  offset_ms: z.coerce.number().int().min(-30_000).max(30_000).default(0),
  visibility: lyricVisibilitySchema.default("private"),
  // Konfirmasi hak: pengguna menyatakan berhak mengunggah/membagikan lirik ini.
  rights_confirmed: z.literal(true, {
    errorMap: () => ({ message: "Konfirmasi hak penggunaan wajib dicentang." }),
  }),
});

export const lyricQuerySchema = z.object({
  videoId: videoIdSchema.optional(),
  videoIds: z
    .string()
    .max(12 * 25)
    .optional()
    .transform((s) =>
      (s ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 25)
    )
    .refine((arr) => arr.every((v) => videoIdSchema.safeParse(v).success), {
      message: "Daftar videoId tidak valid.",
    }),
  language: z.string().trim().max(10).optional(),
});
