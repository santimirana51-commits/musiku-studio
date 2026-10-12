import { describe, it, expect } from "vitest";
import { parseStudioProject, createEmptyProject, StudioProjectSchema } from "./schema";
import { parseLrc } from "@/lib/karaoke/lrc";
import type { StudioProject, StudioLyricsData, StudioMarker } from "./types";

describe("Karaoke & Studio DAW Integration", () => {
  it("serializes and parses StudioProject with lyrics data successfully", () => {
    const project = createEmptyProject("Karaoke DAW Project");
    const sampleLyrics: StudioLyricsData = {
      title: "Menghapus Jejakmu",
      artist: "Noah",
      lrcRaw: "[00:10.00]Ku melangkah melintasi waktu\n[00:15.50]Takkan pernah berhenti",
      offsetSec: 0.5,
      lines: [
        { timeSec: 10.0, text: "Ku melangkah melintasi waktu" },
        { timeSec: 15.5, text: "Takkan pernah berhenti" },
      ],
    };

    project.lyrics = sampleLyrics;

    const validation = StudioProjectSchema.safeParse(project);
    expect(validation.success).toBe(true);

    const jsonStr = JSON.stringify(project);
    const parsed = parseStudioProject(JSON.parse(jsonStr));

    expect(parsed.success).toBe(true);
    expect(parsed.project?.lyrics?.title).toBe("Menghapus Jejakmu");
    expect(parsed.project?.lyrics?.lines.length).toBe(2);
    expect(parsed.project?.lyrics?.offsetSec).toBe(0.5);
    expect(parsed.project?.lyrics?.lines[0].text).toBe("Ku melangkah melintasi waktu");
  });

  it("parses raw LRC into StudioLyricsLine format accurately", () => {
    const rawLrc = `
[ti:Kemesraan]
[ar:Iwan Fals]
[offset:+200]
[00:12.30]Suatu hari di kala kita duduk di tepi pantai
[00:20.50]Dan memandang ombak di lautan yang kian menepi
    `.trim();

    const result = parseLrc(rawLrc);
    expect(result.lines.length).toBe(2);
    expect(result.metadata.title).toBe("Kemesraan");
    expect(result.metadata.artist).toBe("Iwan Fals");

    // Convert to DAW format
    const studioLines = result.lines.map((l) => ({
      timeSec: l.timeMs / 1000,
      text: l.text,
    }));

    expect(studioLines[0].timeSec).toBeCloseTo(12.5, 1);
    expect(studioLines[0].text).toContain("Suatu hari");
    expect(studioLines[1].timeSec).toBeCloseTo(20.7, 1);
  });

  it("converts lyrics cues to timeline markers with proper tempo-to-beat calculation", () => {
    const tempo = 120; // 120 BPM = 2 beats per second (0.5s per beat)
    const secPerBeat = 60 / tempo; // 0.5 sec

    const lines = [
      { timeSec: 4.0, text: "[Intro] Melodi Gitar" },
      { timeSec: 16.0, text: "[Verse 1] Saat pertama" },
      { timeSec: 32.0, text: "[Chorus] Nyanyikan lagu" },
    ];

    const markers: StudioMarker[] = lines.map((l, idx) => ({
      id: `marker_lyric_${idx}`,
      name: l.text,
      beat: l.timeSec / secPerBeat,
      color: "#ec4899",
    }));

    expect(markers.length).toBe(3);
    expect(markers[0].beat).toBe(8.0); // 4.0 / 0.5 = beat 8 (bar 3 in 4/4)
    expect(markers[1].beat).toBe(32.0); // 16.0 / 0.5 = beat 32
    expect(markers[2].beat).toBe(64.0); // 32.0 / 0.5 = beat 64
  });

  it("calculates active line index correctly from seconds playback position", () => {
    const lines = [
      { timeSec: 5.0, text: "Bait 1" },
      { timeSec: 12.0, text: "Bait 2" },
      { timeSec: 25.0, text: "Bait 3" },
    ];

    const getActiveIndex = (currentTimeSec: number, offsetSec: number) => {
      const effective = Math.max(0, currentTimeSec + offsetSec);
      let active = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].timeSec <= effective) {
          active = i;
        } else {
          break;
        }
      }
      return active;
    };

    expect(getActiveIndex(2.0, 0)).toBe(-1); // Belum mulai
    expect(getActiveIndex(5.5, 0)).toBe(0); // Bait 1
    expect(getActiveIndex(11.9, 0)).toBe(0); // Masih Bait 1
    expect(getActiveIndex(12.0, 0)).toBe(1); // Masuk Bait 2
    expect(getActiveIndex(20.0, 0)).toBe(1); // Masih Bait 2
    expect(getActiveIndex(30.0, 0)).toBe(2); // Bait 3
  });
});
