import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

const BUCKET = "music-files";
const SIGNED_TTL = 300; // 5 menit

function extOf(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "audio";
}

function safeFilename(title: string, ext: string): string {
  const base = (title || "musik").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 120) || "musik";
  return `${base}.${ext}`;
}

// GET /api/library/[id]/download — signed URL unduh untuk offline playback
// yang diizinkan (file milik sendiri). Bucket privat: tanpa URL publik.
// `download` memaksa Content-Disposition: attachment dengan nama aman.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data: row, error } = await supabase
    .from("music_library")
    .select("storage_path,title")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (error || !row) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  const filename = safeFilename(row.title, extOf(row.storage_path));
  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_TTL, { download: filename });
  if (signErr || !data?.signedUrl) {
    return NextResponse.json({ error: "Gagal membuat URL unduh." }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl, filename, expiresIn: SIGNED_TTL });
}
