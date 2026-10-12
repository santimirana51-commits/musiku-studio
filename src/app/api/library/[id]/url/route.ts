import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

const BUCKET = "music-files";
const SIGNED_TTL = 300; // 5 menit

// GET /api/library/[id]/url — signed DOWNLOAD URL berumur pendek.
// Bucket privat: tidak ada URL publik yang diekspos.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data: row, error } = await supabase
    .from("music_library")
    .select("storage_path")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (error || !row) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_TTL);
  if (signErr || !data?.signedUrl) {
    return NextResponse.json({ error: "Gagal membuat URL putar." }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl, expiresIn: SIGNED_TTL });
}
