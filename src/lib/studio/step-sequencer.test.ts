import { describe, it, expect } from "vitest";
import {
  createDefaultPattern,
  STEP_PATTERN_PRESETS,
  convertPatternToMidiNotes,
  convertPatternToStudioClip,
  DRUM_SOUND_PITCH_MAP,
} from "./step-sequencer";

describe("Studio Step Sequencer & Beat Machine", () => {
  it("creates a valid default pattern with 16 steps and all drum lanes", () => {
    const pattern = createDefaultPattern(16, "My First Beat");
    expect(pattern.name).toBe("My First Beat");
    expect(pattern.stepsCount).toBe(16);
    expect(pattern.lanes.length).toBe(6);

    const sounds = pattern.lanes.map((l) => l.sound);
    expect(sounds).toContain("kick");
    expect(sounds).toContain("snare");
    expect(sounds).toContain("clap");
    expect(sounds).toContain("hihat_closed");
    expect(sounds).toContain("hihat_open");
    expect(sounds).toContain("perc");

    for (const lane of pattern.lanes) {
      expect(lane.steps.length).toBe(16);
      expect(lane.pitch).toBe(DRUM_SOUND_PITCH_MAP[lane.sound]);
    }
  });

  it("provides rich preset patterns with active steps", () => {
    expect(STEP_PATTERN_PRESETS.length).toBeGreaterThanOrEqual(3);

    for (const preset of STEP_PATTERN_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.tempo).toBeGreaterThan(60);
      expect(preset.lanes.length).toBe(6);

      const totalActiveSteps = preset.lanes.reduce(
        (sum, lane) => sum + lane.steps.filter((s) => s.active).length,
        0
      );
      expect(totalActiveSteps).toBeGreaterThan(0);
    }
  });

  it("converts a pattern into accurate MIDI notes", () => {
    const pattern = createDefaultPattern(16, "Test Pattern");
    // Activate step 0 and step 4 on kick
    pattern.lanes[0].steps[0] = { active: true, velocity: 120 };
    pattern.lanes[0].steps[4] = { active: true, velocity: 100 };

    const notes = convertPatternToMidiNotes(pattern);
    expect(notes.length).toBe(2);

    expect(notes[0].pitch).toBe(pattern.lanes[0].pitch);
    expect(notes[0].startBeat).toBe(0);
    expect(notes[0].velocity).toBe(120);

    expect(notes[1].pitch).toBe(pattern.lanes[0].pitch);
    expect(notes[1].startBeat).toBe(1.0); // Step 4 * 0.25 beat = beat 1.0
    expect(notes[1].velocity).toBe(100);
  });

  it("applies swing timing offset to odd sixteenth notes", () => {
    const pattern = createDefaultPattern(16, "Swing Pattern");
    pattern.swing = 0.25;
    // Step 0 (even) and Step 1 (odd)
    pattern.lanes[0].steps[0] = { active: true, velocity: 100 };
    pattern.lanes[0].steps[1] = { active: true, velocity: 100 };

    const notes = convertPatternToMidiNotes(pattern);
    expect(notes.length).toBe(2);
    expect(notes[0].startBeat).toBe(0);
    // Odd sixteenth note should have swing offset
    expect(notes[1].startBeat).toBeGreaterThan(0.25);
  });

  it("converts a pattern into a valid StudioClip", () => {
    const pattern = STEP_PATTERN_PRESETS[0];
    const clip = convertPatternToStudioClip(pattern, "track_drum_1", 8.0);

    expect(clip.id).toMatch(/^clip_seq_/);
    expect(clip.trackId).toBe("track_drum_1");
    expect(clip.type).toBe("midi");
    expect(clip.startBeat).toBe(8.0);
    expect(clip.durationBeats).toBe(4.0); // 16 steps = 4 beats
    expect(clip.notes).toBeDefined();
    expect(clip.notes!.length).toBeGreaterThan(0);
  });

  it("generates flam grace note when step.flam is active (Mixcraft 10 Hlm. 318)", () => {
    const pattern = createDefaultPattern(16, "Flam Test Pattern");
    // Step 4 on Snare (lane 1), active with flam: true and velocity 120
    pattern.lanes[1].steps[4] = { active: true, velocity: 120, flam: true };

    const notes = convertPatternToMidiNotes(pattern);
    // Should emit 2 notes: 1 grace note (flam) + 1 main note
    expect(notes.length).toBe(2);

    const [graceNote, mainNote] = notes;
    // Main note is at beat 1.0 (step 4 * 0.25)
    expect(mainNote.startBeat).toBe(1.0);
    expect(mainNote.velocity).toBe(120);

    // Grace note is scheduled right before main hit (startBeat - 0.05)
    expect(graceNote.startBeat).toBeCloseTo(0.95, 2);
    expect(graceNote.velocity).toBe(Math.round(120 * 0.75)); // 90
    expect(graceNote.id).toContain("_flam_");
  });

  it("accurately outputs distinct accent and ghost velocities (Mixcraft 10 Hlm. 319-320)", () => {
    const pattern = createDefaultPattern(16, "Dynamic Pattern");
    // Step 0: Accent 127
    pattern.lanes[0].steps[0] = { active: true, velocity: 127 };
    // Step 2: Ghost 60
    pattern.lanes[0].steps[2] = { active: true, velocity: 60 };

    const notes = convertPatternToMidiNotes(pattern);
    expect(notes.length).toBe(2);

    expect(notes[0].startBeat).toBe(0);
    expect(notes[0].velocity).toBe(127);

    expect(notes[1].startBeat).toBe(0.5); // Step 2 * 0.25
    expect(notes[1].velocity).toBe(60);
  });
});
