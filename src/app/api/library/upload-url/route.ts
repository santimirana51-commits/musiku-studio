import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { checkMusicFile, maxFileBytes } from "@/lib/local-library/validators";

const BUCKET = "music-files";

function sanitizeName(name: string): string {
  const base = name.split("/").pop() ?? "audio";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "audio";
}

// GET /api/library/upload-url?filename=&mime=&size=
// Validasi server dulu, lalu terbitkan signed UPLOAD URL (user-scoped).
// Client PUT via XHR (mendukung progress + retry aman).
export async function GET(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const url = new URL(req.url);
  const filename = url.searchParams.get("filename") ?? "";
  const mime = url.searchParams.get("mime") ?? "";
  const size = Number(url.searchParams.get("size") ?? 0);
  const check = checkMusicFile(filename, mime, size, maxFileBytes(process.env.MUSIC_MAX_FILE_MB));
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeName(filename)}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Gagal menyiapkan upload. Coba lagi." }, { status: 500 });
  }
  return NextResponse.json({ uploadUrl: data.signedUrl, path });
}
