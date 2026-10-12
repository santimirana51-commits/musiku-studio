import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { playlistSchema, playlistItemSchema } from "@/lib/validation";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const { supabase, user, error } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data, error: dbErr } = await supabase
    .from("playlists")
    .select("id,name,description,is_public,created_at,updated_at,playlist_items(count)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (dbErr) return NextResponse.json({ error: "Gagal memuat playlist." }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: Request) {
  if (!rateLimit(`pl-create:${clientKey(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  }
  const { supabase, user, error } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }
  const parsed = playlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Input tidak valid." }, { status: 400 });
  }
  const { data, error: dbErr } = await supabase
    .from("playlists")
    .insert({ user_id: user.id, ...parsed.data })
    .select("id,name,description,is_public,created_at")
    .single();
  if (dbErr) return NextResponse.json({ error: "Gagal membuat playlist." }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
