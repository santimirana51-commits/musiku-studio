import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  artist: z.string().trim().max(200).optional(),
  album: z.string().trim().max(200).optional(),
});

// PATCH /api/library/[id] — ubah metadata milik sendiri.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Input tidak valid." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("music_library")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id,title,artist,album,storage_path,mime_type,file_size,duration_seconds,upload_status,upload_error,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: "Gagal memperbarui / tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ item: data });
}

// DELETE /api/library/[id] — hapus objek Storage + baris metadata konsisten.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data: row, error: findErr } = await supabase
    .from("music_library")
    .select("storage_path")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (findErr || !row) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  const { error: rmErr } = await supabase.storage.from("music-files").remove([row.storage_path]);
  if (rmErr) return NextResponse.json({ error: "Gagal menghapus file cloud." }, { status: 500 });
  const { error: delErr } = await supabase
    .from("music_library")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (delErr) return NextResponse.json({ error: "File terhapus, metadata gagal dihapus. Muat ulang." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
