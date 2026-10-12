import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { checkMusicFile, maxFileBytes } from "@/lib/local-library/validators";

const BUCKET = "music-files";
const maxBytes = () => maxFileBytes(process.env.MUSIC_MAX_FILE_MB);

// GET /api/library — daftar musik cloud milik sendiri (wajib login).
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data, error } = await supabase
    .from("music_library")
    .select("id,title,artist,album,storage_path,mime_type,file_size,duration_seconds,upload_status,upload_error,created_at,updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: "Gagal memuat pustaka cloud." }, { status: 500 });
  const used = (data ?? []).reduce((s, r) => s + (Number(r.file_size) || 0), 0);
  return NextResponse.json({ items: data ?? [], usedBytes: used });
}

const metadataSchema = z.object({
  title: z.string().trim().min(1).max(300),
  artist: z.string().trim().max(200).optional().default(""),
  album: z.string().trim().max(200).optional().default(""),
  storage_path: z.string().trim().min(1).max(500),
  mime_type: z.string().trim().max(100),
  file_size: z.number().int().positive(),
  duration_seconds: z.number().min(0).max(86400).nullable().optional(),
});

// POST /api/library — catat metadata SETELAH upload via signed URL berhasil.
// Validasi server penuh (tipe, ukuran, kepemilikan path, keberadaan objek).
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = metadataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input tidak valid." }, { status: 400 });
  }
  const v = parsed.data;
  const check = checkMusicFile(v.title, v.mime_type, v.file_size, maxBytes());
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });
  if (!v.storage_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Path file bukan milik Anda." }, { status: 403 });
  }
  // Pastikan objek benar-benar ada ( signed URL user-scoped; gagal = 404/403 ).
  const { error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(v.storage_path, 60);
  if (signErr) {
    return NextResponse.json({ error: "File belum terunggah. Selesaikan upload dulu." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("music_library")
    .insert({
      user_id: user.id,
      title: v.title,
      artist: v.artist,
      album: v.album,
      storage_path: v.storage_path,
      mime_type: v.mime_type,
      file_size: v.file_size,
      duration_seconds: v.duration_seconds ?? null,
      upload_status: "ready",
      upload_error: "",
    })
    .select("id,title,artist,album,storage_path,mime_type,file_size,duration_seconds,upload_status,upload_error,created_at,updated_at")
    .single();
  if (error) {
    // Idempotensi: path unik global — retry POST yang sama (mis. dari sync
    // queue offline) mengembalikan baris yang sudah ada, bukan duplikat.
    if ((error as { code?: string }).code === "23505") {
      const { data: existing, error: findErr } = await supabase
        .from("music_library")
        .select("id,title,artist,album,storage_path,mime_type,file_size,duration_seconds,upload_status,upload_error,created_at,updated_at")
        .eq("storage_path", v.storage_path)
        .eq("user_id", user.id)
        .single();
      if (!findErr && existing) return NextResponse.json({ item: existing, deduped: true });
    }
    return NextResponse.json({ error: "Gagal menyimpan metadata." }, { status: 500 });
  }
  return NextResponse.json({ item: data }, { status: 201 });
}
