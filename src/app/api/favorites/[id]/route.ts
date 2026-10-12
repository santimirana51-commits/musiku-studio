import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { videoIdSchema } from "@/lib/validation";

// :id bisa berupa id row (UUID) ATAU youtube_video_id (11 char).
// Keduanya divalidasi dulu agar aman diinterpolasi ke filter PostgREST.
const uuidSchema = z.string().uuid();
const favoriteIdParamSchema = z.union([uuidSchema, videoIdSchema]);

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const parsed = favoriteIdParamSchema.safeParse(params.id);
  if (!parsed.success) {
    return NextResponse.json({ error: "ID favorit tidak valid." }, { status: 400 });
  }
  // Hindari .or() dengan string mentah: pilih kolom berdasarkan bentuk ID
  // yang sudah tervalidasi (UUID aman, videoId aman untuk filter PostgREST).
  const deleteQuery =
    uuidSchema.safeParse(params.id).success
      ? supabase.from("favorites").delete().eq("user_id", user.id).eq("id", params.id)
      : supabase.from("favorites").delete().eq("user_id", user.id).eq("youtube_video_id", params.id);
  const { error } = await deleteQuery;
  if (error) return NextResponse.json({ error: "Gagal menghapus favorit." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
