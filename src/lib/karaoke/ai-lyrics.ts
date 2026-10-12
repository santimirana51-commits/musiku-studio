// Modul AI Lyrics (Fase 7).
//
// Prinsip:
// - Panggilan model AI HANYA dilakukan di server; API key tidak pernah
//   dikirimkan ke browser client.
// - Menghasilkan format LRC yang valid dengan timestamp [mm:ss.xx].
// - Validasi ketat dan persetujuan pengguna (userConsent) wajib sebelum pemrosesan.
// - Jangan mengirim audio atau file pengguna ke layanan eksternal tanpa izin.

import { z } from "zod";
import { validateLrc } from "@/lib/karaoke/lrc";

export const aiLyricsRequestSchema = z.object({
  title: z.string().trim().min(1, "Judul lagu wajib diisi").max(200),
  artist: z.string().trim().max(100).optional().default(""),
  language: z.string().trim().min(2).max(10).default("id"),
  userConsent: z.literal(true, {
    errorMap: () => ({ message: "Persetujuan pemrosesan AI wajib dicentang." }),
  }),
});

export type AILyricsRequest = z.infer<typeof aiLyricsRequestSchema>;

export interface AILyricsResult {
  lrc: string;
  lineCount: number;
  provider: string;
}

/**
 * Format timestamp mm:ss.xx untuk LRC
 */
function formatLrcTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}]`;
}

/**
 * Fallback generator terstruktur ketika API AI eksternal tidak dikonfigurasi
 * atau saat offline / testing. Menghasilkan struktur lirik LRC valid.
 */
function generateStructuredLyricsFallback(title: string, artist: string): string {
  const lines = [
    `[ti:${title}]`,
    artist ? `[ar:${artist}]` : null,
    `[by:MusikKu AI Assistant]`,
    `[00:02.00]${title} - ${artist || "MusikKu"}`,
    `[00:08.00](Musik pembuka)`,
    `[00:16.00]Langkah awal mengalun perlahan`,
    `[00:24.00]Irama hati menyatu dalam nada`,
    `[00:32.00]Setiap detik terasa begitu bermakna`,
    `[00:40.00]Mengalir indah bersama melodi`,
    `[00:48.00](Refrain)`,
    `[00:52.00]Biarkan musik membawamu terbang`,
    `[01:00.00]Menyuarakan cerita yang terpendam`,
    `[01:08.00]Dalam harmoni yang abadi`,
    `[01:16.00]Takkan pernah pudar di ingatan`,
    `[01:24.00](Interlude)`,
    `[01:36.00]Dan ketika nada ini berakhir`,
    `[01:44.00]Kenyamanan itu tetap ada di hati`,
    `[01:52.00]MusikKu — musikmu selamanya`,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

/**
 * Memanggil provider AI di server untuk membuat lirik LRC tersinkronisasi.
 */
export async function generateAILyrics(req: AILyricsRequest): Promise<AILyricsResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      const prompt = `Anda adalah asisten musik profesional. Buatlah lirik karaoke lengkap dalam format LRC standar untuk lagu:
Judul: "${req.title}"
Artis: "${req.artist || "Tidak diketahui"}"
Bahasa: ${req.language}

ATURAN WAJIB FORMAT LRC:
1. Setiap baris lirik HARUS diawali tag waktu tepat dalam format [mm:ss.xx], contoh: [00:15.50] Baris lirik
2. Tambahkan tag metadata di awal: [ti:${req.title}] dan [ar:${req.artist || "Unknown"}]
3. Berikan jeda waktu yang realistis antar baris (sekitar 3-6 detik antar baris)
4. JANGAN berikan penjelasan pembuka atau penutup markdown apapun. HANYA kembalikan teks format LRC mentah.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4 },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        // Bersihkan pembungkus markdown ```lrc ... ``` jika ada
        const cleanLrc = rawText.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
        const v = validateLrc(cleanLrc);
        if (v.ok) {
          const lineCount = cleanLrc.split("\n").filter((l: string) => /^\s*\[\d+:\d+(\.\d+)?\]/.test(l)).length;
          return { lrc: cleanLrc, lineCount, provider: "gemini" };
        }
      }
    } catch {
      // Fallback ke generator internal jika panggilan jaringan gagal
    }
  }

  if (openaiKey) {
    try {
      const prompt = `Buatkan lirik karaoke format LRC [mm:ss.xx] untuk lagu "${req.title}" oleh "${req.artist}". Kembalikan hanya teks LRC mentah.`;
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const rawText = json?.choices?.[0]?.message?.content?.trim() ?? "";
        const cleanLrc = rawText.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
        const v = validateLrc(cleanLrc);
        if (v.ok) {
          const lineCount = cleanLrc.split("\n").filter((l: string) => /^\s*\[\d+:\d+(\.\d+)?\]/.test(l)).length;
          return { lrc: cleanLrc, lineCount, provider: "openai" };
        }
      }
    } catch {
      // Fallback ke generator internal jika panggilan jaringan gagal
    }
  }

  // Fallback terstruktur aman (selalu menghasilkan format LRC valid yang siap disunting pengguna)
  const fallbackLrc = generateStructuredLyricsFallback(req.title, req.artist);
  const lineCount = fallbackLrc.split("\n").filter((l) => /^\s*\[\d+:\d+(\.\d+)?\]/.test(l)).length;
  return {
    lrc: fallbackLrc,
    lineCount,
    provider: "structured-template",
  };
}
