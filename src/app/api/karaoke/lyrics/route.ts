import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { karaokeLyricSchema, lyricQuerySchema } from "@/lib/karaoke/validation";
import { validateLrc } from "@/lib/karaoke/lrc";
import { clientKey, rateLimit } from "@/lib/rate-limit";

// GET /api/karaoke/lyrics?videoId=XXX            -> lirik untuk 1 video
// GET /api/karaoke/lyrics?videoIds=A,B,C          -> ringkas ketersediaan (badge)
// Terbuka untuk anonim (RLS: hanya lirik public); milik sendiri ikut
// terbaca bila login. Tidak pernah mengambil lirik dari YouTube.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = lyricQuerySchema.safeParse({
    videoId: url.searchParams.get("videoId") ?? undefined,
    videoIds: url.searchParams.get("videoIds") ?? undefined,
    language: url.searchParams.get("language") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
  }
  const { videoId, videoIds, language } = parsed.data;
  const ids = videoId ? [videoId] : videoIds ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Sertakan videoId atau videoIds." }, { status: 400 });
  }

  const { supabase } = await requireUser(); // user boleh null; RLS yang membatasi
  let q = supabase
    .from("karaoke_lyrics")
    .select("id,youtube_video_id,title,language,source_type,offset_ms,visibility,created_at,lyrics_lrc")
    .in("youtube_video_id", ids)
    .order("created_at", { ascending: false })
    .limit(100);
  if (language) q = q.eq("language", language);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Gagal memuat lirik." }, { status: 500 });

  // Mode ringkas untuk badge ketersediaan: hemat bandwidth (tanpa teks LRC).
  if (!videoId && videoIds) {
    const availability: Record<string, { count: number; languages: string[] }> = {};
    for (const row of data ?? []) {
      const a = (availability[row.youtube_video_id] ??= { count: 0, languages: [] });
      a.count += 1;
      if (!a.languages.includes(row.language)) a.languages.push(row.language);
    }
    return NextResponse.json({ availability });
  }
  return NextResponse.json({ items: data ?? [] });
}

// POST /api/karaoke/lyrics — simpan lirik milik sendiri (wajib login).
// Hanya menerima LRC valid + konfirmasi hak. Tidak scraping.
export async function POST(req: Request) {
  if (!rateLimit(`karaoke-create:${clientKey(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  }
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = karaokeLyricSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Input tidak valid." },
      { status: 400 }
    );
  }
  const v = validateLrc(parsed.data.lyrics_lrc);
  if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });

  const { data, error } = await supabase
    .from("karaoke_lyrics")
    .upsert(
      {
        user_id: user.id,
        youtube_video_id: parsed.data.youtube_video_id,
        title: parsed.data.title,
        language: parsed.data.language,
        source_type: parsed.data.source_type,
        source_reference: parsed.data.source_reference,
        lyrics_lrc: parsed.data.lyrics_lrc,
        offset_ms: parsed.data.offset_ms,
        visibility: parsed.data.visibility,
        rights_confirmed: true,
      },
      { onConflict: "user_id,youtube_video_id,language" }
    )
    .select("id,youtube_video_id,title,language,source_type,offset_ms,visibility,created_at")
    .single();
  if (error) return NextResponse.json({ error: "Gagal menyimpan lirik." }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
