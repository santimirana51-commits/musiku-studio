import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  aiLyricsRequestSchema,
  generateAILyrics,
} from "@/lib/karaoke/ai-lyrics";
import { validateLrc } from "@/lib/karaoke/lrc";

describe("ai-lyrics", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("menolak request tanpa persetujuan pengguna (userConsent: false)", () => {
    const res = aiLyricsRequestSchema.safeParse({
      title: "Laskar Pelangi",
      artist: "Nidji",
      userConsent: false,
    });
    expect(res.success).toBe(false);
  });

  it("menerima request valid dengan userConsent: true", () => {
    const res = aiLyricsRequestSchema.safeParse({
      title: "Laskar Pelangi",
      artist: "Nidji",
      userConsent: true,
    });
    expect(res.success).toBe(true);
  });

  it("fallback menghasilkan LRC terstruktur yang valid", async () => {
    const res = await generateAILyrics({
      title: "Manusia Kuat",
      artist: "Tulus",
      language: "id",
      userConsent: true,
    });

    expect(res.provider).toBe("structured-template");
    expect(res.lineCount).toBeGreaterThan(5);
    const valid = validateLrc(res.lrc);
    expect(valid.ok).toBe(true);
    expect(res.lrc).toContain("Manusia Kuat");
  });

  it("memanggil Gemini API dan menghasilkan LRC valid jika GEMINI_API_KEY tersedia", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const sampleLrc = `[ti:Separuh Aku]\n[ar:NOAH]\n[00:05.00]Dan terjadi lagi\n[00:10.00]Kisah lama yang terulang kembali`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: sampleLrc }],
                },
              },
            ],
          }),
          { status: 200 }
        )
      )
    );

    const res = await generateAILyrics({
      title: "Separuh Aku",
      artist: "NOAH",
      language: "id",
      userConsent: true,
    });

    expect(res.provider).toBe("gemini");
    expect(res.lineCount).toBe(2);
    expect(res.lrc).toContain("Dan terjadi lagi");
  });
});
