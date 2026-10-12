import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { historySchema } from "@/lib/validation";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data: prefs } = await supabase.from("user_preferences").select("history_enabled").eq("user_id", user.id).single();
  if (prefs && prefs.history_enabled === false) return NextResponse.json({ items: [], disabled: true });
  const { data, error } = await supabase
    .from("playback_history")
    .select("*")
    .eq("user_id", user.id)
    .order("played_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Gagal memuat riwayat." }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    // pengguna anonim: riwayat hanya lokal, server mengembalikan ok tanpa menyimpan
    return NextResponse.json({ ok: true, anonymous: true });
  }
  const body = await req.json().catch(() => null);
  const parsed = historySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input tidak valid." }, { status: 400 });
  const { data: prefs } = await supabase.from("user_preferences").select("history_enabled").eq("user_id", user.id).single();
  if (prefs && prefs.history_enabled === false) return NextResponse.json({ ok: true, disabled: true });
  const { error } = await supabase.from("playback_history").insert({
    user_id: user.id,
    youtube_video_id: parsed.data.youtube_video_id,
    title_snapshot: parsed.data.title_snapshot,
    channel_title_snapshot: parsed.data.channel_title_snapshot,
    played_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: "Gagal menyimpan riwayat." }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { error } = await supabase.from("playback_history").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Gagal menghapus riwayat." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
