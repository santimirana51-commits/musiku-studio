import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { favoriteSchema } from "@/lib/validation";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data, error } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Gagal memuat favorit." }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = favoriteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input tidak valid." }, { status: 400 });
  const { data, error } = await supabase
    .from("favorites")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id,youtube_video_id" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Gagal menyimpan favorit." }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
