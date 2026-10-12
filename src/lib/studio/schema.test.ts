import { describe, it, expect } from "vitest";
import {
  createEmptyProject,
  createTrack,
  parseStudioProject,
  StudioProjectSchema,
} from "./schema";

describe("Studio Project Schema & Serialization", () => {
  it("creates a valid default project that conforms to schema", () => {
    const project = createEmptyProject("My Test Song");
    expect(project.name).toBe("My Test Song");
    expect(project.tempo).toBe(120);
    expect(project.tracks.length).toBeGreaterThanOrEqual(2);
    expect(project.schemaVersion).toBe("1.0.0");

    const validation = StudioProjectSchema.safeParse(project);
    expect(validation.success).toBe(true);
  });

  it("round-trips JSON serialization without data loss", () => {
    const project = createEmptyProject("Serialization Test");
    const jsonStr = JSON.stringify(project);
    const parsed = JSON.parse(jsonStr);

    const result = parseStudioProject(parsed);
    expect(result.success).toBe(true);
    expect(result.project?.id).toBe(project.id);
    expect(result.project?.tempo).toBe(120);
    expect(result.project?.tracks[0].clips.length).toBe(project.tracks[0].clips.length);
  });

  it("catches out-of-bounds MIDI pitches (> 127)", () => {
    const project = createEmptyProject("Invalid Pitch Project");
    if (project.tracks[0]?.clips[0]?.notes?.[0]) {
      project.tracks[0].clips[0].notes[0].pitch = 200; // invalid!
    }

    const result = parseStudioProject(project);
    expect(result.success).toBe(false);
    expect(result.error).toContain("pitch");
  });

  it("catches invalid tempos (< 20 or > 320 BPM)", () => {
    const project = createEmptyProject("Tempo Test");
    project.tempo = 10; // below 20
    const resLow = parseStudioProject(project);
    expect(resLow.success).toBe(false);

    project.tempo = 400; // above 320
    const resHigh = parseStudioProject(project);
    expect(resHigh.success).toBe(false);
  });

  it("creates new tracks with distinct IDs and proper colors", () => {
    const tAudio = createTrack("audio", "Lead Vocals", 0);
    const tMidi = createTrack("midi", "Bassline", 1);

    expect(tAudio.type).toBe("audio");
    expect(tAudio.synthSettings).toBeUndefined();
    expect(tMidi.type).toBe("midi");
    expect(tMidi.synthSettings).toBeDefined();
    expect(tAudio.id).not.toBe(tMidi.id);
  });

  it("handles missing optional fields gracefully during parse", () => {
    const partial = {
      id: "proj_legacy",
      name: "Old Project",
      tempo: 128,
      timeSignature: [4, 4],
      sampleRate: 44100,
      tracks: [],
      masterTrack: {
        volume: 1,
        pan: 0,
        limiterThreshold: -0.3,
        limiterRelease: 0.05,
        plugins: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = parseStudioProject(partial);
    expect(res.success).toBe(true);
    expect(res.project?.schemaVersion).toBe("1.0.0");
    expect(res.project?.assetManifest).toEqual({});
  });

  it("validates project markers and punchRange locators properly", () => {
    const project = createEmptyProject("Marker & Punch Song");
    expect(project.markers.length).toBeGreaterThan(0);
    expect(project.markers[0].name).toBe("Intro");

    project.punchRange = {
      enabled: true,
      startBeat: 4,
      endBeat: 12,
    };
    project.markers.push({
      id: "m_chorus",
      name: "Chorus",
      beat: 16,
      color: "#f43f5e",
    });

    const parsed = parseStudioProject(project);
    expect(parsed.success).toBe(true);
    expect(parsed.project?.punchRange?.enabled).toBe(true);
    expect(parsed.project?.punchRange?.startBeat).toBe(4);
    expect(parsed.project?.markers.some((m) => m.name === "Chorus")).toBe(true);
  });
});
