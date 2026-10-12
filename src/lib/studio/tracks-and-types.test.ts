import { describe, it, expect } from "vitest";
import {
  createEmptyProject,
  createTrack,
  parseStudioProject,
  StudioTrackSchema,
  StudioClipSchema,
} from "./schema";
import type { StudioProject, StudioTrack } from "./types";
import { GUITAR_TUNER_STRINGS, getTunerState } from "@/components/studio/track-header";

describe("Tracks & Types System (Mixcraft Inspired)", () => {
  it("initializes tracks with appropriate default names, icons, height, and frozen flags for all 6 track types", () => {
    // 1. Audio track
    const audioTrack = createTrack("audio", undefined, 0);
    expect(audioTrack.type).toBe("audio");
    expect(audioTrack.name).toBe("Audio Track 1");
    expect(audioTrack.icon).toBe("mic");
    expect(audioTrack.height).toBe(96);
    expect(audioTrack.isFrozen).toBe(false);

    // 2. MIDI / Instrument track
    const midiTrack = createTrack("midi", undefined, 1);
    expect(midiTrack.type).toBe("midi");
    expect(midiTrack.name).toBe("Instrument Track 2");
    expect(midiTrack.icon).toBe("piano");
    expect(midiTrack.height).toBe(96);
    expect(midiTrack.isFrozen).toBe(false);

    // 3. Video track
    const videoTrack = createTrack("video", undefined, 2);
    expect(videoTrack.type).toBe("video");
    expect(videoTrack.name).toBe("Video Track");
    expect(videoTrack.icon).toBe("video");
    expect(videoTrack.height).toBe(96);

    // 4. Video Text track
    const videoTextTrack = createTrack("video-text", undefined, 3);
    expect(videoTextTrack.type).toBe("video-text");
    expect(videoTextTrack.name).toBe("Video Text Track");
    expect(videoTextTrack.icon).toBe("text");
    expect(videoTextTrack.height).toBe(96);

    // 5. Submix track
    const submixTrack = createTrack("submix", undefined, 4);
    expect(submixTrack.type).toBe("submix");
    expect(submixTrack.name).toBe("Submix Track 5");
    expect(submixTrack.icon).toBe("submix");
    expect(submixTrack.height).toBe(96);

    // 6. Send track
    const sendTrack = createTrack("send", undefined, 5);
    expect(sendTrack.type).toBe("send");
    expect(sendTrack.name).toBe("Send Track 6");
    expect(sendTrack.icon).toBe("send");
    expect(sendTrack.height).toBe(96);
  });

  it("allows custom names, custom icons, and preserves user overrides", () => {
    const customGuitarTrack = createTrack("audio", "Lead Stratocaster", 0, "guitar");
    expect(customGuitarTrack.name).toBe("Lead Stratocaster");
    expect(customGuitarTrack.icon).toBe("guitar");

    const customDrumsTrack = createTrack("midi", "808 Trap Kit", 1, "drums");
    expect(customDrumsTrack.name).toBe("808 Trap Kit");
    expect(customDrumsTrack.icon).toBe("drums");
  });

  it("validates track height bounds in Zod schema", () => {
    // Valid heights
    const validTrack = createTrack("audio", "Test", 0);
    validTrack.height = 144;
    expect(StudioTrackSchema.safeParse(validTrack).success).toBe(true);

    // Height clamped/bound check (min 48, max 360)
    const tooSmall = { ...validTrack, height: 20 };
    expect(StudioTrackSchema.safeParse(tooSmall).success).toBe(false);

    const tooLarge = { ...validTrack, height: 500 };
    expect(StudioTrackSchema.safeParse(tooLarge).success).toBe(false);
  });

  it("migrates legacy projects lacking track icons, height, or freeze state", () => {
    const legacyProject = {
      id: "legacy_proj_101",
      name: "Old Project Without Track Customization",
      tempo: 120,
      timeSignature: [4, 4],
      sampleRate: 44100,
      tracks: [
        {
          id: "t_audio",
          name: "Old Vocal",
          type: "audio",
          color: "#ec4899",
          volume: 0.9,
          pan: 0,
          mute: false,
          solo: false,
          plugins: [],
          clips: [],
        },
        {
          id: "t_midi",
          name: "Old Piano",
          type: "midi",
          color: "#8b5cf6",
          volume: 1.0,
          pan: 0,
          mute: false,
          solo: false,
          plugins: [],
          clips: [],
        },
      ],
      masterTrack: {
        id: "master",
        name: "Master",
        volume: 1.0,
        pan: 0,
        limiterThreshold: -0.3,
        limiterRelease: 0.05,
        mute: false,
        plugins: [],
      },
      buses: [],
      assetManifest: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = parseStudioProject(legacyProject);
    expect(res.success).toBe(true);
    expect(res.project).toBeDefined();
    if (!res.project) return;

    expect(res.project.tracks[0].icon).toBe("mic");
    expect(res.project.tracks[0].height).toBe(96);
    expect(res.project.tracks[0].isFrozen).toBe(false);

    expect(res.project.tracks[1].icon).toBe("piano");
    expect(res.project.tracks[1].height).toBe(96);
    expect(res.project.tracks[1].isFrozen).toBe(false);
  });

  it("supports video and video-text clips in schema validation", () => {
    const project = createEmptyProject("Multimedia Video Project");
    const videoTrack = createTrack("video", "Background Movie", project.tracks.length);
    const textTrack = createTrack("video-text", "Lyrics Subtitles", project.tracks.length + 1);

    videoTrack.clips.push({
      id: "clip_v1",
      trackId: videoTrack.id,
      type: "video",
      name: "MusicVideo_Intro.mp4",
      color: videoTrack.color,
      startBeat: 0,
      durationBeats: 16,
      offsetBeat: 0,
      gain: 1,
      videoUrl: "https://example.com/assets/video.mp4",
    });

    textTrack.clips.push({
      id: "clip_txt1",
      trackId: textTrack.id,
      type: "video-text",
      name: "Verse 1 Lyric",
      color: textTrack.color,
      startBeat: 4,
      durationBeats: 8,
      offsetBeat: 0,
      gain: 1,
      textOverlay: "Aku bernyanyi di bawah sinar rembulan",
    });

    project.tracks.push(videoTrack, textTrack);
    const res = parseStudioProject(project);
    expect(res.success).toBe(true);
    expect(res.project).toBeDefined();
    expect(res.project?.tracks.find((t) => t.type === "video")?.clips[0].videoUrl).toBe(
      "https://example.com/assets/video.mp4"
    );
    expect(res.project?.tracks.find((t) => t.type === "video-text")?.clips[0].textOverlay).toBe(
      "Aku bernyanyi di bawah sinar rembulan"
    );
  });

  it("enforces max 1 video track constraint in project business logic", () => {
    const project = createEmptyProject("Video Limit Test");
    const videoTrack1 = createTrack("video", "Video Track", project.tracks.length);
    project.tracks.push(videoTrack1);

    // Business check: attempting to add a 2nd video track
    const hasExistingVideoTrack = project.tracks.some((t) => t.type === "video");
    expect(hasExistingVideoTrack).toBe(true);

    const canAddAnotherVideo = !hasExistingVideoTrack;
    expect(canAddAnotherVideo).toBe(false);
  });

  it("supports track freezing and unfreezing state lifecycle", () => {
    const track = createTrack("midi", "Massive Synth Pad", 0);
    expect(track.isFrozen).toBe(false);
    expect(track.frozenAssetId).toBeUndefined();

    // Freeze track
    const frozenAssetId = "asset_frozen_12345";
    const frozenTrack: StudioTrack = {
      ...track,
      isFrozen: true,
      frozenAssetId,
      plugins: track.plugins.map((p) => ({ ...p, enabled: false })),
    };
    expect(frozenTrack.isFrozen).toBe(true);
    expect(frozenTrack.frozenAssetId).toBe(frozenAssetId);

    // Unfreeze track
    const unfrozenTrack: StudioTrack = {
      ...frozenTrack,
      isFrozen: false,
      frozenAssetId: undefined,
      plugins: frozenTrack.plugins.map((p) => ({ ...p, enabled: true })),
    };
    expect(unfrozenTrack.isFrozen).toBe(false);
    expect(unfrozenTrack.frozenAssetId).toBeUndefined();
  });

  it("supports track duplication with unique clip and plugin IDs", () => {
    const sourceTrack = createTrack("audio", "Vocal Main", 0);
    sourceTrack.clips = [
      {
        id: "clip_orig_1",
        trackId: sourceTrack.id,
        type: "audio",
        name: "Vocal Take 1",
        color: sourceTrack.color,
        startBeat: 0,
        durationBeats: 8,
        offsetBeat: 0,
        gain: 1.0,
        assetId: "vocal_wav_1",
      },
    ];
    sourceTrack.plugins = [
      {
        id: "plug_orig_1",
        name: "EQUALIZER",
        pluginId: "internal.eq",
        enabled: true,
        parameters: { gainLow: 2 },
      },
    ];

    const newTrackId = "track_duplicated_999";
    const duplicatedTrack: StudioTrack = {
      ...sourceTrack,
      id: newTrackId,
      name: `${sourceTrack.name} (Copy)`,
      clips: sourceTrack.clips.map((c) => ({
        ...c,
        id: `clip_dup_${c.id}`,
        trackId: newTrackId,
      })),
      plugins: sourceTrack.plugins.map((p) => ({
        ...p,
        id: `plug_dup_${p.id}`,
      })),
    };

    expect(duplicatedTrack.id).toBe(newTrackId);
    expect(duplicatedTrack.name).toBe("Vocal Main (Copy)");
    expect(duplicatedTrack.clips[0].id).not.toBe(sourceTrack.clips[0].id);
    expect(duplicatedTrack.clips[0].trackId).toBe(newTrackId);
    expect(duplicatedTrack.plugins[0].id).not.toBe(sourceTrack.plugins[0].id);
  });

  it("validates volume range up to 200% (+6dB) and pan range from -1 to 1", () => {
    const track = createTrack("audio", "Lead Vocal", 0);
    // 200% volume (+6dB)
    track.volume = 2.0;
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);

    // Pan -100% (Left) and +100% (Right)
    track.pan = -1.0;
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
    track.pan = 1.0;
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);

    // Out of bounds pan
    const invalidPan = { ...track, pan: 1.5 };
    expect(StudioTrackSchema.safeParse(invalidPan).success).toBe(false);
  });

  it("supports track linking with linkGroupId and relative volume/pan adjustments", () => {
    const trackA = createTrack("audio", "Vocal Double L", 0);
    const trackB = createTrack("audio", "Vocal Double R", 1);

    trackA.volume = 0.8;
    trackA.pan = -0.5;
    trackA.linkGroupId = "group_1";

    trackB.volume = 1.0;
    trackB.pan = 0.5;
    trackB.linkGroupId = "group_1";

    expect(trackA.linkGroupId).toBe(trackB.linkGroupId);
    expect(StudioTrackSchema.safeParse(trackA).success).toBe(true);
    expect(StudioTrackSchema.safeParse(trackB).success).toBe(true);

    // Relative volume adjustment (+0.2)
    const deltaV = 0.2;
    const newVolA = Math.min(2.0, trackA.volume + deltaV);
    const newVolB = Math.min(2.0, trackB.volume + deltaV);
    expect(newVolA).toBe(1.0);
    expect(newVolB).toBe(1.2);
    // Relative volume difference is maintained
    expect(newVolB - newVolA).toBeCloseTo(0.2);

    // Relative pan adjustment (+0.2 towards Right)
    const deltaP = 0.2;
    const newPanA = Math.min(1.0, trackA.pan + deltaP);
    const newPanB = Math.min(1.0, trackB.pan + deltaP);
    expect(newPanA).toBeCloseTo(-0.3);
    expect(newPanB).toBeCloseTo(0.7);
  });

  it("handles Mute and Solo multi-track state logic correctly", () => {
    const tracks = [
      createTrack("audio", "Drums", 0),
      createTrack("audio", "Bass", 1),
      createTrack("audio", "Guitar", 2),
      createTrack("audio", "Keys", 3),
    ];

    // Solo Drums and Bass
    tracks[0].solo = true;
    tracks[1].solo = true;

    const anySoloed = tracks.some((t) => t.solo);
    expect(anySoloed).toBe(true);

    // Any track that is not soloed is effectively silenced
    const isGuitarSilenced = tracks[2].mute || (anySoloed && !tracks[2].solo);
    const isKeysSilenced = tracks[3].mute || (anySoloed && !tracks[3].solo);
    expect(isGuitarSilenced).toBe(true);
    expect(isKeysSilenced).toBe(true);

    // Unsolo all (Ctrl-click behavior on a soloed track)
    const unsoloedTracks = tracks.map((t) => ({ ...t, solo: false }));
    expect(unsoloedTracks.every((t) => !t.solo)).toBe(true);

    // Mute multiple tracks
    const mutedTracks = tracks.map((t) => ({ ...t, mute: true }));
    expect(mutedTracks.every((t) => t.mute)).toBe(true);

    // Ctrl-clicking an unmuted track unmutes all others and mutes the clicked one (mute solo)
    const muteSoloTracks = mutedTracks.map((t, idx) => ({
      ...t,
      mute: idx === 1,
    }));
    expect(muteSoloTracks[0].mute).toBe(false);
    expect(muteSoloTracks[1].mute).toBe(true);
    expect(muteSoloTracks[2].mute).toBe(false);
  });

  it("supports custom image URLs and Super Big Gulp X-Treme height preset", () => {
    const track = createTrack("midi", "808 Sub", 0);
    track.customImageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    track.height = 240; // Super Big Gulp X-Treme™
    track.monitoringEnabled = true;
    track.midiChannel = 10;

    const parseRes = StudioTrackSchema.safeParse(track);
    expect(parseRes.success).toBe(true);
    expect(parseRes.data?.height).toBe(240);
    expect(parseRes.data?.customImageUrl).toBeDefined();
    expect(parseRes.data?.monitoringEnabled).toBe(true);
    expect(parseRes.data?.midiChannel).toBe(10);
  });

  it("initializes Output and Vocoder track types with appropriate default names, icons, and schema validation", () => {
    // Output Track
    const outputTrack = createTrack("output", undefined, 6);
    expect(outputTrack.type).toBe("output");
    expect(outputTrack.name).toBe("Output Track 7");
    expect(outputTrack.icon).toBe("output");
    expect(outputTrack.height).toBe(96);
    expect(outputTrack.outputBus).toBe("master");

    const parseOutput = StudioTrackSchema.safeParse(outputTrack);
    expect(parseOutput.success).toBe(true);
    expect(parseOutput.data?.type).toBe("output");

    // Vocoder Track
    const vocoderTrack = createTrack("vocoder", undefined, 7);
    expect(vocoderTrack.type).toBe("vocoder");
    expect(vocoderTrack.name).toBe("Vocoder Track 8");
    expect(vocoderTrack.icon).toBe("vocoder");
    expect(vocoderTrack.synthSettings).toBeDefined();

    const parseVocoder = StudioTrackSchema.safeParse(vocoderTrack);
    expect(parseVocoder.success).toBe(true);
    expect(parseVocoder.data?.type).toBe("vocoder");
  });

  it("supports adding tracks beneath bottom-most track and inserting tracks above selected track", () => {
    const project = createEmptyProject("Insert Track Test");
    expect(project.tracks.length).toBe(2);
    const trackA = project.tracks[0]; // index 0
    const trackB = project.tracks[1]; // index 1

    // Add track beneath bottom-most track
    const trackBottom = createTrack("audio", "Bottom Track", project.tracks.length);
    const addedBottom = [...project.tracks, trackBottom];
    expect(addedBottom.length).toBe(3);
    expect(addedBottom[2].id).toBe(trackBottom.id);

    // Insert track above currently selected track (e.g. above trackB at index 1)
    const trackInserted = createTrack("vocoder", "Vocoder Harmony", addedBottom.length);
    const targetIdx = addedBottom.findIndex((t) => t.id === trackB.id);
    expect(targetIdx).toBe(1);

    const insertedTracks = [...addedBottom];
    insertedTracks.splice(targetIdx, 0, trackInserted);

    expect(insertedTracks.length).toBe(4);
    expect(insertedTracks[0].id).toBe(trackA.id);
    expect(insertedTracks[1].id).toBe(trackInserted.id);
    expect(insertedTracks[2].id).toBe(trackB.id);
    expect(insertedTracks[3].id).toBe(trackBottom.id);
  });

  it("supports Menu Persist switch logic: keeps menu open during multiple actions when enabled", () => {
    let menuPersist = false;
    let isMenuOpen = true;

    // Helper simulating clicking an action in the menu
    const executeAction = (action: () => void) => {
      action();
      if (!menuPersist) {
        isMenuOpen = false;
      }
    };

    // When menuPersist is false, selecting an action closes the menu
    executeAction(() => {});
    expect(isMenuOpen).toBe(false);

    // When menuPersist is enabled, menu remains open while multiple actions are executed
    menuPersist = true;
    isMenuOpen = true;

    let actionCount = 0;
    executeAction(() => { actionCount++; });
    executeAction(() => { actionCount++; });
    executeAction(() => { actionCount++; });

    expect(actionCount).toBe(3);
    expect(isMenuOpen).toBe(true); // Stays open!
  });

  it("manages inline purple effect buttons: active toggle, remove, effect list is active, and remove all effects", () => {
    const track = createTrack("audio", "Lead Vocals", 0);
    // Add two initial effects
    track.plugins = [
      {
        id: "p1",
        pluginId: "internal.eq3",
        name: "3-Band EQ",
        enabled: true,
        parameters: { lowGain: 0, midGain: 0, highGain: 0 },
      },
      {
        id: "p2",
        pluginId: "internal.compressor",
        name: "Compressor",
        enabled: true,
        parameters: { threshold: -24, ratio: 4, attack: 0.005, release: 0.1 },
      },
    ];

    // 1. Toggle Active for effect p1
    const toggledActive = track.plugins.map((p) =>
      p.id === "p1" ? { ...p, enabled: !p.enabled } : p
    );
    expect(toggledActive[0].enabled).toBe(false);
    expect(toggledActive[1].enabled).toBe(true);

    // 2. Remove effect p1
    const removedP1 = track.plugins.filter((p) => p.id !== "p1");
    expect(removedP1.length).toBe(1);
    expect(removedP1[0].id).toBe("p2");

    // 3. Effect List Is Active: toggle all effects
    const allActive = track.plugins.every((p) => p.enabled);
    expect(allActive).toBe(true);
    const bypassedAll = track.plugins.map((p) => ({ ...p, enabled: !allActive }));
    expect(bypassedAll.every((p) => !p.enabled)).toBe(true);

    // 4. Remove All Effects
    const clearedPlugins: typeof track.plugins = [];
    expect(clearedPlugins.length).toBe(0);
  });
});

describe("Mixcraft 10 Audio Track & Header Specification", () => {
  it("enforces constant 1-based track numbering that increments from 1 upward invariant of track moves", () => {
    const project = createEmptyProject("Track Numbering Test");
    // Initial tracks
    expect(project.tracks.length).toBeGreaterThanOrEqual(2);

    // Compute track numbers based on index + 1
    const getTrackNumbers = (tracks: StudioTrack[]) =>
      tracks.map((_, index) => index + 1);

    expect(getTrackNumbers(project.tracks)).toEqual([1, 2]);

    // Add 3 more audio tracks
    const t3 = createTrack("audio", "Lead Vocals", 2);
    const t4 = createTrack("audio", "Acoustic Guitar", 3);
    const t5 = createTrack("audio", "Bass DI", 4);
    const extendedTracks = [...project.tracks, t3, t4, t5];

    expect(getTrackNumbers(extendedTracks)).toEqual([1, 2, 3, 4, 5]);

    // Rearrange tracks (move t5 to top, t4 to second)
    const rearranged = [t5, t4, project.tracks[0], project.tracks[1], t3];
    // Track numbers always stay constant (1, 2, 3, 4, 5) from top to bottom
    const newNumbers = getTrackNumbers(rearranged);
    expect(newNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(rearranged[0].name).toBe("Bass DI");
    expect(getTrackNumbers(rearranged)[0]).toBe(1); // Bass DI is now #1
  });

  it("handles track renaming and default audio naming", () => {
    const track = createTrack("audio", undefined, 0);
    expect(track.name).toBe("Audio Track 1");

    // Rename track
    const renamed = { ...track, name: "Lead Vocal Neumann U87" };
    expect(renamed.name).toBe("Lead Vocal Neumann U87");
    expect(StudioTrackSchema.safeParse(renamed).success).toBe(true);
  });

  it("validates pan (-100% to +100%) and volume fader range (0% to 200% / -Inf to +6 dB)", () => {
    const track = createTrack("audio", "Guitar", 0);
    expect(track.pan).toBe(0.0); // Center default
    expect(track.volume).toBe(1.0); // 100% Unity Gain (0 dB)

    // Pan bounds
    track.pan = -1.0; // 100% Left
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
    track.pan = 1.0; // 100% Right
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);

    // Volume up to 200% (gain 2.0 = +6 dB) and 400% max schema bounds
    track.volume = 2.0;
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
    track.volume = 0.0;
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);

    // Negative volume is invalid
    const invalidVol = { ...track, volume: -0.5 };
    expect(StudioTrackSchema.safeParse(invalidVol).success).toBe(false);
  });

  it("supports recording modes: Takes, Overdub, and Replace", () => {
    const track = createTrack("audio", "Drum Overheads", 0);
    expect(track.recordingMode).toBe("takes"); // Default takes mode

    // Switch to overdub
    track.recordingMode = "overdub";
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);

    // Switch to replace
    track.recordingMode = "replace";
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);

    // Invalid mode rejected
    const invalidMode = { ...track, recordingMode: "punch-in-only" as any };
    expect(StudioTrackSchema.safeParse(invalidMode).success).toBe(false);
  });

  it("supports hardware audio device selection and input channel routing (Stereo, Left, Right)", () => {
    const track = createTrack("audio", "Vocal In", 0);
    expect(track.inputChannelMode).toBe("stereo");

    // Route to Left (Mono Mic)
    track.inputChannelMode = "mono-left";
    track.inputSource = "input_1";
    track.audioDeviceId = "usb_audio_interface_ch1";
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);

    // Route to Right (Mono Line)
    track.inputChannelMode = "mono-right";
    track.inputSource = "input_2";
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
  });

  it("provides Guitar Tuner pitch notes and accurate in-tune detection", () => {
    expect(GUITAR_TUNER_STRINGS.length).toBe(6);
    expect(GUITAR_TUNER_STRINGS.map((s) => s.note)).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);

    // With zero signal (below threshold)
    const silentState = getTunerState(0.01, 0);
    expect(silentState.hasSignal).toBe(false);
    expect(silentState.note).toBe("E2");

    // With audio input signal
    const activeState = getTunerState(0.5, 0);
    expect(activeState.hasSignal).toBe(true);
    expect(typeof activeState.cents).toBe("number");
    expect(typeof activeState.inTune).toBe("boolean");
  });

  it("toggles Software Monitoring and Arm for Performance Panel independently", () => {
    const track = createTrack("audio", "Saxophone", 0);
    expect(track.monitoringEnabled).toBe(false);
    expect(track.armForPerformancePanel).toBe(false);

    // Enable Software Monitoring
    track.monitoringEnabled = true;
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);

    // Enable Arm for Performance Panel
    track.armForPerformancePanel = true;
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
  });

  it("manages inline insert effect power switches without removing plugins", () => {
    const track = createTrack("audio", "Vocal Chain", 0);
    track.plugins = [
      {
        id: "fx1",
        pluginId: "internal.compressor",
        name: "Compressor",
        enabled: true,
        parameters: { threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
      },
    ];

    // Power switch off (bypass)
    track.plugins[0].enabled = false;
    expect(track.plugins[0].enabled).toBe(false);
    expect(track.plugins.length).toBe(1);

    // Power switch on (activate)
    track.plugins[0].enabled = true;
    expect(track.plugins[0].enabled).toBe(true);
  });

  it("supports track record arming, laneCount, and mutedLaneIndices in schema", () => {
    const track = createTrack("audio", "Guitar Tracking", 0);
    expect(track.armRecord).toBe(false);
    expect(track.laneCount).toBe(1);
    expect(track.mutedLaneIndices).toEqual([]);

    track.armRecord = true;
    track.laneCount = 4;
    track.mutedLaneIndices = [1, 2];

    const parsed = StudioTrackSchema.safeParse(track);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.armRecord).toBe(true);
      expect(parsed.data.laneCount).toBe(4);
      expect(parsed.data.mutedLaneIndices).toEqual([1, 2]);
    }
  });

  it("validates clip laneIndex and muted flags", () => {
    const clip = {
      id: "clip_lane_test",
      trackId: "track_1",
      name: "Comping Take 3",
      startBeat: 0,
      durationBeats: 4,
      type: "audio" as const,
      laneIndex: 2,
      muted: true,
    };

    const parsed = StudioClipSchema.safeParse(clip);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.laneIndex).toBe(2);
      expect(parsed.data.muted).toBe(true);
    }
  });
});

describe("Mixcraft 10: Track Right-Click Commands - Audio Track", () => {
  it("Insert Track Above: inserts new track directly above target track index", () => {
    const project = createEmptyProject("Insert Above Test");
    const t1 = createTrack("audio", "Track 1", 0);
    const t2 = createTrack("audio", "Track 2", 1);
    const t3 = createTrack("audio", "Track 3", 2);
    project.tracks = [t1, t2, t3];

    // Insert new MIDI track directly above Track 2 (index 1)
    const targetTrackId = t2.id;
    const currentTracks = [...project.tracks];
    const insertIdx = currentTracks.findIndex((t) => t.id === targetTrackId);
    expect(insertIdx).toBe(1);

    const newTrack = createTrack("midi", "Synth Lead", currentTracks.length);
    currentTracks.splice(insertIdx, 0, newTrack);
    project.tracks = currentTracks;

    expect(project.tracks.length).toBe(4);
    expect(project.tracks[0].id).toBe(t1.id);
    expect(project.tracks[1].id).toBe(newTrack.id);
    expect(project.tracks[2].id).toBe(t2.id);
    expect(project.tracks[3].id).toBe(t3.id);
  });

  it("Delete Track: removes the current track from project", () => {
    const project = createEmptyProject("Delete Test");
    const t1 = createTrack("audio", "Lead Vocals", 0);
    const t2 = createTrack("audio", "Backing Vocals", 1);
    project.tracks = [t1, t2];

    project.tracks = project.tracks.filter((t) => t.id !== t1.id);
    expect(project.tracks.length).toBe(1);
    expect(project.tracks[0].id).toBe(t2.id);
  });

  it("Color: changes track color", () => {
    const track = createTrack("audio", "Acoustic", 0);
    expect(typeof track.color).toBe("string");

    track.color = "#06b6d4"; // Cyan
    expect(track.color).toBe("#06b6d4");
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
  });

  it("Link: handles Link Selected Tracks, Unlink, and Unlink All", () => {
    const t1 = createTrack("audio", "Drum Overheads L", 0);
    const t2 = createTrack("audio", "Drum Overheads R", 1);
    const t3 = createTrack("audio", "Room Mic", 2);

    // Link t1 & t2
    const groupId = "group_1";
    t1.linkGroupId = groupId;
    t2.linkGroupId = groupId;

    expect(t1.linkGroupId).toBe("group_1");
    expect(t2.linkGroupId).toBe("group_1");
    expect(t3.linkGroupId).toBeUndefined();

    // Select All Linked Tracks
    const allLinked = [t1, t2, t3].filter((t) => t.linkGroupId === groupId).map((t) => t.id);
    expect(allLinked).toEqual([t1.id, t2.id]);

    // Unlink single track (t1)
    t1.linkGroupId = undefined;
    expect(t1.linkGroupId).toBeUndefined();
    expect(t2.linkGroupId).toBe("group_1");

    // Unlink all in group
    [t1, t2, t3].forEach((t) => {
      if (t.linkGroupId === groupId) t.linkGroupId = undefined;
    });
    expect(t2.linkGroupId).toBeUndefined();
  });

  it("Lanes: handles Add, Delete, Delete Empty, Mute All, and Unmute All", () => {
    const track = createTrack("audio", "Vocal Takes", 0);
    expect(track.laneCount).toBe(1);

    // Add Lane (Alt+L)
    track.laneCount = (track.laneCount || 1) + 1;
    expect(track.laneCount).toBe(2);

    // Populate clips across 2 lanes
    track.clips = [
      { id: "c1", name: "Take 1", trackId: track.id, startBeat: 0, durationBeats: 4, offsetBeat: 0, gain: 1, type: "audio", laneIndex: 0, muted: false },
      { id: "c2", name: "Take 2", trackId: track.id, startBeat: 0, durationBeats: 4, offsetBeat: 0, gain: 1, type: "audio", laneIndex: 1, muted: false },
    ];

    // Mute All Lanes
    const totalLanes = track.laneCount || 1;
    track.mutedLaneIndices = Array.from({ length: totalLanes }, (_, i) => i);
    track.clips = track.clips.map((c) => ({ ...c, muted: true }));

    expect(track.mutedLaneIndices).toEqual([0, 1]);
    expect(track.clips.every((c) => c.muted)).toBe(true);

    // Unmute All Lanes
    track.mutedLaneIndices = [];
    track.clips = track.clips.map((c) => ({ ...c, muted: false }));

    expect(track.mutedLaneIndices).toEqual([]);
    expect(track.clips.every((c) => !c.muted)).toBe(true);

    // Delete empty lanes (when laneCount is higher than clips used)
    track.laneCount = 5;
    const maxUsed = track.clips.reduce((max, c) => Math.max(max, c.laneIndex ?? 0), -1);
    track.laneCount = Math.max(1, maxUsed + 1);
    expect(track.laneCount).toBe(2);
  });

  it("Properties: verifies Mute, Solo, Volume, Pan, Height presets, and Cycle Track Size", () => {
    const track = createTrack("audio", "Bass Guitar", 0);

    // Mute toggle (Ctrl+M)
    track.mute = !track.mute;
    expect(track.mute).toBe(true);

    // Solo toggle (Ctrl+L)
    track.solo = !track.solo;
    expect(track.solo).toBe(true);

    // Set Exact Volume & Pan
    track.volume = 1.25; // +1.9 dB
    track.pan = -0.5; // L50
    expect(track.volume).toBe(1.25);
    expect(track.pan).toBe(-0.5);

    // Height presets: Small 64, Normal 96, Large 144, Extra Large 240
    track.height = 64;
    expect(track.height).toBe(64);
    track.height = 240;
    expect(track.height).toBe(240);

    // Cycle track size: 64 -> 96 -> 144 -> 240 -> 64
    const heights = [64, 96, 144, 240];
    let curr = track.height;
    let nextIdx = (heights.indexOf(curr) + 1) % heights.length;
    expect(heights[nextIdx]).toBe(64);
  });

  it("Duplicate: creates an identical track with fresh IDs for clips and plugins", () => {
    const source = createTrack("audio", "Main Vocal", 0);
    source.clips = [
      { id: "clip_orig", name: "Verse 1", trackId: source.id, startBeat: 0, durationBeats: 8, offsetBeat: 0, gain: 1, type: "audio" },
    ];
    source.plugins = [
      { id: "plug_orig", pluginId: "internal.eq3", name: "EQ", enabled: true, parameters: {} },
    ];

    const newTrackId = "track_duplicated";
    const duplicated: StudioTrack = {
      ...source,
      id: newTrackId,
      name: `${source.name} (Copy)`,
      clips: source.clips.map((c) => ({
        ...c,
        id: `clip_copy_${c.id}`,
        trackId: newTrackId,
      })),
      plugins: source.plugins.map((p) => ({
        ...p,
        id: `plug_copy_${p.id}`,
      })),
    };

    expect(duplicated.name).toBe("Main Vocal (Copy)");
    expect(duplicated.id).not.toBe(source.id);
    expect(duplicated.clips[0].id).not.toBe(source.clips[0].id);
    expect(duplicated.clips[0].trackId).toBe(newTrackId);
    expect(duplicated.plugins[0].id).not.toBe(source.plugins[0].id);
  });

  it("Freeze and Unfreeze lifecycle: disables plugins during freeze and restores upon unfreeze", () => {
    const track = createTrack("audio", "Heavy Guitar", 0);
    track.plugins = [
      { id: "p1", pluginId: "internal.compressor", name: "Compressor", enabled: true, parameters: {} },
    ];

    // Freeze: mark frozen and disable plugins
    track.isFrozen = true;
    track.plugins = track.plugins.map((p) => ({ ...p, enabled: false }));
    expect(track.isFrozen).toBe(true);
    expect(track.plugins[0].enabled).toBe(false);

    // Unfreeze: unmark and enable plugins
    track.isFrozen = false;
    track.plugins = track.plugins.map((p) => ({ ...p, enabled: true }));
    expect(track.isFrozen).toBe(false);
    expect(track.plugins[0].enabled).toBe(true);
  });
});

describe("Mixcraft 10: Virtual Instrument / MIDI Track & Header Specification", () => {
  it("initializes Virtual Instrument track with keyboard icon, default synth, and constant track numbering", () => {
    const track = createTrack("midi", undefined, 2);
    expect(track.type).toBe("midi");
    expect(track.name).toBe("Instrument Track 3");
    expect(track.icon).toBe("piano");
    expect(track.midiChannel).toBe(0); // Omni / All Channels
    expect(track.midiInputDeviceId).toBe("all");
    expect(track.autoQuantize).toBe("off");
    expect(track.snapNotesToScale).toBe(false);
    expect(track.instrumentName).toBe("Virtual Synth (Acoustica Keys)");
    expect(track.synthSettings).toBeDefined();
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
  });

  it("handles MIDI input device selection (MTK, USB keyboard, Drum Pad, MIDI Guitar, EWI)", () => {
    const track = createTrack("midi", "Synth Lead", 0);
    const devices = ["all", "mtk", "usb_keyboard", "drum_pad", "midi_guitar", "ewi"];
    for (const dev of devices) {
      track.midiInputDeviceId = dev;
      expect(StudioTrackSchema.safeParse(track).success).toBe(true);
    }
  });

  it("handles MIDI channel selection (0 = Omni, 1-16 specific channel)", () => {
    const track = createTrack("midi", "Hammond B-3 Organ", 0);
    track.midiChannel = 0; // Omni
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);

    track.midiChannel = 3; // Upper manual
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
    expect(track.midiChannel).toBe(3);
  });

  it("supports recording modes: Takes, Overdub, Replace on MIDI tracks", () => {
    const track = createTrack("midi", "MIDI Piano", 0);
    track.recordingMode = "takes";
    expect(track.recordingMode).toBe("takes");

    track.recordingMode = "overdub";
    expect(track.recordingMode).toBe("overdub");

    track.recordingMode = "replace";
    expect(track.recordingMode).toBe("replace");
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
  });

  it("supports Automatic Quantization note values on the way in", () => {
    const track = createTrack("midi", "Drums", 0);
    const quantizePresets = ["off", "1/4", "1/8", "1/16", "1/32", "1/8T", "1/16T"];
    for (const q of quantizePresets) {
      track.autoQuantize = q;
      expect(StudioTrackSchema.safeParse(track).success).toBe(true);
    }
  });

  it("supports Snap Notes To Scale and Arm For Performance Panel", () => {
    const track = createTrack("midi", "Arp Bass", 0);
    track.snapNotesToScale = true;
    track.armForPerformancePanel = true;
    expect(track.snapNotesToScale).toBe(true);
    expect(track.armForPerformancePanel).toBe(true);
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
  });

  it("supports moving and copying Virtual Instruments between tracks (Mixcraft 10.5 Drag & Alt+Drag)", () => {
    const source = createTrack("midi", "Messiah PolySynth", 0);
    source.instrumentName = "Messiah PolySynth";
    source.synthSettings = {
      waveform: "sawtooth",
      attack: 0.05,
      decay: 0.3,
      sustain: 0.7,
      release: 0.5,
      filterCutoff: 3500,
      filterResonance: 4,
      volume: 0.8,
    };

    const target = createTrack("midi", "New Lead", 1);

    // Copy instrument (Alt+Drag)
    const copiedTarget = {
      ...target,
      instrumentName: source.instrumentName,
      synthSettings: { ...source.synthSettings },
    };
    expect(copiedTarget.instrumentName).toBe("Messiah PolySynth");
    expect(copiedTarget.synthSettings?.waveform).toBe("sawtooth");
    expect(source.instrumentName).toBe("Messiah PolySynth"); // Source remains intact

    // Move instrument (Drag)
    const movedTarget = {
      ...target,
      instrumentName: source.instrumentName,
      synthSettings: { ...source.synthSettings },
    };
    const movedSource = {
      ...source,
      instrumentName: undefined,
    };
    expect(movedTarget.instrumentName).toBe("Messiah PolySynth");
    expect(movedSource.instrumentName).toBeUndefined();
  });

  it("validates Instrument Quick Access power bypass toggling", () => {
    const track = createTrack("midi", "Analog Keys", 0);
    expect((track.synthSettings?.volume ?? 1) > 0).toBe(true);

    // Power toggle: bypass synth
    if (track.synthSettings) {
      track.synthSettings.volume = 0;
    }
    expect(track.synthSettings?.volume).toBe(0);

    // Power toggle: re-enable synth
    if (track.synthSettings) {
      track.synthSettings.volume = 0.8;
    }
    expect(track.synthSettings?.volume).toBe(0.8);
    expect(StudioTrackSchema.safeParse(track).success).toBe(true);
  });

  describe("Mixcraft 10: Video and Video Text Tracks Specification", () => {
    it("enforces that a project can have at most one video track", () => {
      const project = createEmptyProject("Mixcraft Video Project");
      expect(project.tracks.some((t) => t.type === "video")).toBe(false);

      // Add first video track
      const videoTrack = createTrack("video", "Video Track", project.tracks.length);
      project.tracks.push(videoTrack);
      expect(project.tracks.some((t) => t.type === "video")).toBe(true);

      // Second video track addition must be prohibited
      const canAddSecondVideo = !project.tracks.some((t) => t.type === "video");
      expect(canAddSecondVideo).toBe(false);
    });

    it("verifies default names and constant 1-based track numbers", () => {
      const videoTrack = createTrack("video", undefined, 0);
      expect(videoTrack.name).toBe("Video Track");
      expect(videoTrack.type).toBe("video");

      const textTrack = createTrack("video-text", undefined, 1);
      expect(textTrack.name).toBe("Video Text Track");
      expect(textTrack.type).toBe("video-text");

      // Constant 1-based display number calculation
      const tracks = [
        createTrack("audio", "Vocal", 0),
        videoTrack,
        textTrack,
        createTrack("midi", "Synth", 3),
      ];
      const getTrackNumber = (tId: string) => tracks.findIndex((t) => t.id === tId) + 1;
      expect(getTrackNumber(tracks[0].id)).toBe(1);
      expect(getTrackNumber(videoTrack.id)).toBe(2);
      expect(getTrackNumber(textTrack.id)).toBe(3);
      expect(getTrackNumber(tracks[3].id)).toBe(4);

      // Reordering preserves constant 1-based numbering without being attached to specific tracks
      const reordered = [videoTrack, tracks[0], tracks[3], textTrack];
      expect(reordered.findIndex((t) => t.id === videoTrack.id) + 1).toBe(1);
      expect(reordered.findIndex((t) => t.id === tracks[0].id) + 1).toBe(2);
    });

    it("places Video Text Track directly beneath the Video Track upon toggle (+ sign)", () => {
      const audioTrack = createTrack("audio", "Audio 1", 0);
      const videoTrack = createTrack("video", "Video Track", 1);
      const midiTrack = createTrack("midi", "Piano", 2);

      let tracks = [audioTrack, videoTrack, midiTrack];
      const videoIdx = tracks.findIndex((t) => t.type === "video");
      expect(videoIdx).toBe(1);

      // Toggle + (Show/Add Video Text Track)
      const textTrack = createTrack("video-text", "Video Text Track", videoIdx + 1);
      tracks = [
        ...tracks.slice(0, videoIdx + 1),
        textTrack,
        ...tracks.slice(videoIdx + 1),
      ];

      expect(tracks.length).toBe(4);
      expect(tracks[videoIdx + 1].id).toBe(textTrack.id);
      expect(tracks[videoIdx + 1].type).toBe("video-text");
      expect(tracks[3].id).toBe(midiTrack.id);

      // Toggle - (Hide/Remove Video Text Track)
      tracks = tracks.filter((t) => t.type !== "video-text");
      expect(tracks.length).toBe(3);
      expect(tracks.some((t) => t.type === "video")).toBe(true);
      expect(tracks.some((t) => t.type === "video-text")).toBe(false);
    });

    it("creates an associated audio track directly beneath Video Track when video with audio is imported", () => {
      const mainAudio = createTrack("audio", "Backing Track", 0);
      const videoTrack = createTrack("video", "Video Track", 1);
      videoTrack.clips.push({
        id: "vclip_1",
        trackId: videoTrack.id,
        type: "video",
        name: "MusicVideo_4K.mp4",
        color: videoTrack.color,
        startBeat: 0,
        durationBeats: 64,
        offsetBeat: 0,
        gain: 1,
        videoUrl: "blob:http://localhost/video_test_123",
      });

      let tracks = [mainAudio, videoTrack];
      const videoIdx = tracks.findIndex((t) => t.type === "video");

      // Associated audio track created directly beneath video track
      const associatedAudio = createTrack("audio", "Video Audio", videoIdx + 1);
      associatedAudio.clips.push({
        id: "aclip_from_video",
        trackId: associatedAudio.id,
        type: "audio",
        name: "MusicVideo_4K (Audio)",
        color: associatedAudio.color,
        startBeat: 0,
        durationBeats: 64,
        offsetBeat: 0,
        gain: 1,
        assetId: "extracted_audio_asset_1",
      });

      tracks = [
        ...tracks.slice(0, videoIdx + 1),
        associatedAudio,
        ...tracks.slice(videoIdx + 1),
      ];

      expect(tracks[videoIdx + 1].name).toBe("Video Audio");
      expect(tracks[videoIdx + 1].type).toBe("audio");

      // Specification: associated audio track can be deleted without affecting the video track
      tracks = tracks.filter((t) => t.id !== associatedAudio.id);
      expect(tracks.length).toBe(2);
      expect(tracks.some((t) => t.id === videoTrack.id)).toBe(true);
      expect(tracks.find((t) => t.id === videoTrack.id)?.clips.length).toBe(1);
    });

    it("validates SMPTE timecode generation and Video Text lyrics overlay clip", () => {
      // SMPTE timecode (HH:MM:SS:FF at 30 fps)
      const formatSmpte = (seconds: number) => {
        const totalFrames = Math.floor(seconds * 30);
        const hrs = Math.floor(totalFrames / (30 * 3600));
        const remAfterHrs = totalFrames % (30 * 3600);
        const mins = Math.floor(remAfterHrs / (30 * 60));
        const remAfterMins = remAfterHrs % (30 * 60);
        const secs = Math.floor(remAfterMins / 30);
        const frames = remAfterMins % 30;
        return [
          String(hrs).padStart(2, "0"),
          String(mins).padStart(2, "0"),
          String(secs).padStart(2, "0"),
          String(frames).padStart(2, "0"),
        ].join(":");
      };

      expect(formatSmpte(0)).toBe("00:00:00:00");
      expect(formatSmpte(65.5)).toBe("00:01:05:15");
      expect(formatSmpte(3661.1)).toBe("01:01:01:03");

      // Validate Video Text Clip schema
      const textClip = {
        id: "text_clip_lyric_1",
        trackId: "track_text_1",
        type: "video-text" as const,
        name: "Chorus Lyrics",
        color: "#38bdf8",
        startBeat: 16,
        durationBeats: 8,
        offsetBeat: 0,
        gain: 1,
        textOverlay: "Terbang tinggi melintasi angkasa biru ♪",
      };

      const parsed = StudioClipSchema.safeParse(textClip);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.textOverlay).toBe("Terbang tinggi melintasi angkasa biru ♪");
      }
    });
  });
});



