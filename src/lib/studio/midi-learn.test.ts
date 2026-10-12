import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseRawMidiMessage,
  scaleCcToVolume,
  volumeToCc,
  scaleCcToPan,
  panToCc,
  scaleCcToRange,
  isToggleTrigger,
  findMatchingMidiMapping,
  createOrUpdateMapping,
  deleteMapping,
  DEFAULT_MIDI_MAPPINGS,
  AKAI_MPK_PRESET,
  KORG_NANOKONTROL_PRESET,
  loadMidiMappingsFromStorage,
  saveMidiMappingsToStorage,
  STORAGE_KEY_MIDI_MAPPINGS,
  type MidiMapping,
} from "./midi-learn";

describe("MIDI Learn & Hardware Controller Mapping (Mixcraft 10 Hlm. 488–495, 661–664)", () => {
  describe("parseRawMidiMessage", () => {
    it("parses CC messages on various MIDI channels", () => {
      // Channel 1, CC 7 (Volume), Value 100
      const ccCh1 = new Uint8Array([0xb0, 7, 100]);
      expect(parseRawMidiMessage(ccCh1)).toEqual({
        channel: 1,
        type: "cc",
        controlNumber: 7,
        value: 100,
      });

      // Channel 10, CC 10 (Pan), Value 64
      const ccCh10 = new Uint8Array([0xb9, 10, 64]);
      expect(parseRawMidiMessage(ccCh10)).toEqual({
        channel: 10,
        type: "cc",
        controlNumber: 10,
        value: 64,
      });
    });

    it("parses Note On and Note Off messages", () => {
      // Channel 1, Note 60 (Middle C), Velocity 100 -> Note On
      const noteOn = new Uint8Array([0x90, 60, 100]);
      expect(parseRawMidiMessage(noteOn)).toEqual({
        channel: 1,
        type: "note",
        controlNumber: 60,
        value: 100,
      });

      // Channel 1, Note 60, Velocity 0 -> Note Off (value 0)
      const noteOffVelocityZero = new Uint8Array([0x90, 60, 0]);
      expect(parseRawMidiMessage(noteOffVelocityZero)).toEqual({
        channel: 1,
        type: "note",
        controlNumber: 60,
        value: 0,
      });

      // Status 0x80 -> Dedicated Note Off
      const noteOff = new Uint8Array([0x80, 60, 64]);
      expect(parseRawMidiMessage(noteOff)).toEqual({
        channel: 1,
        type: "note",
        controlNumber: 60,
        value: 0,
      });
    });

    it("returns null for malformed or short packets", () => {
      expect(parseRawMidiMessage(new Uint8Array([]))).toBeNull();
      expect(parseRawMidiMessage(new Uint8Array([0xb0]))).toBeNull();
      // Sysex or system real-time message (not CC/Note)
      expect(parseRawMidiMessage(new Uint8Array([0xf8, 0, 0]))).toBeNull();
    });
  });

  describe("Value Scaling & Conversions", () => {
    it("scales CC to volume and back", () => {
      expect(scaleCcToVolume(0)).toBe(0);
      expect(scaleCcToVolume(100)).toBe(1.0); // Unity gain
      expect(scaleCcToVolume(127)).toBe(1.5); // Peak boost
      expect(scaleCcToVolume(50)).toBe(0.5);

      expect(volumeToCc(0)).toBe(0);
      expect(volumeToCc(1.0)).toBe(100);
      expect(volumeToCc(1.5)).toBe(127);
      expect(volumeToCc(0.5)).toBe(50);
    });

    it("scales CC to pan and back", () => {
      expect(scaleCcToPan(0)).toBe(-1.0); // Hard Left
      expect(scaleCcToPan(64)).toBe(0); // Center
      expect(scaleCcToPan(127)).toBe(1.0); // Hard Right

      expect(panToCc(-1.0)).toBe(0);
      expect(panToCc(0)).toBe(64);
      expect(panToCc(1.0)).toBe(127);
    });

    it("scales CC to custom parameter bounds", () => {
      // Filter cutoff: 20Hz to 20000Hz
      expect(scaleCcToRange(0, 20, 20000)).toBe(20);
      expect(scaleCcToRange(127, 20, 20000)).toBe(20000);
      // Halfway
      expect(scaleCcToRange(64, 0, 100)).toBeCloseTo(50.39, 1);
    });

    it("evaluates toggle triggers on buttons and note keys", () => {
      expect(isToggleTrigger({ channel: 1, type: "cc", controlNumber: 115, value: 127 })).toBe(true);
      expect(isToggleTrigger({ channel: 1, type: "cc", controlNumber: 115, value: 64 })).toBe(true);
      expect(isToggleTrigger({ channel: 1, type: "cc", controlNumber: 115, value: 0 })).toBe(false);

      expect(isToggleTrigger({ channel: 1, type: "note", controlNumber: 36, value: 100 })).toBe(true);
      expect(isToggleTrigger({ channel: 1, type: "note", controlNumber: 36, value: 0 })).toBe(false);
    });
  });

  describe("Mapping Lookup & Updates", () => {
    it("finds matching mapping with Omni channel (0) or specific channel", () => {
      const mappings: MidiMapping[] = [
        {
          id: "m1",
          command: "master_volume",
          label: "Master Volume",
          category: "master",
          messageType: "cc",
          channel: 0, // Omni
          controlNumber: 7,
        },
        {
          id: "m2",
          command: "transport_play",
          label: "Play Toggle",
          category: "transport",
          messageType: "cc",
          channel: 2, // Channel 2 only
          controlNumber: 115,
        },
      ];

      // CC 7 on channel 1 matches Omni mapping m1
      const foundOmni = findMatchingMidiMapping(mappings, {
        channel: 1,
        type: "cc",
        controlNumber: 7,
        value: 90,
      });
      expect(foundOmni?.id).toBe("m1");

      // CC 115 on channel 1 does NOT match channel 2 mapping m2
      const notFoundCh1 = findMatchingMidiMapping(mappings, {
        channel: 1,
        type: "cc",
        controlNumber: 115,
        value: 127,
      });
      expect(notFoundCh1).toBeUndefined();

      // CC 115 on channel 2 DOES match m2
      const foundCh2 = findMatchingMidiMapping(mappings, {
        channel: 2,
        type: "cc",
        controlNumber: 115,
        value: 127,
      });
      expect(foundCh2?.id).toBe("m2");
    });

    it("replaces existing assignment when re-learning the same control", () => {
      const initial: MidiMapping[] = [
        {
          id: "m1",
          command: "master_volume",
          label: "Master Volume",
          category: "master",
          messageType: "cc",
          channel: 0,
          controlNumber: 7,
        },
      ];

      const newMapping: MidiMapping = {
        id: "m2",
        command: "selected_track_volume",
        label: "Track Volume",
        category: "selected_track",
        messageType: "cc",
        channel: 0,
        controlNumber: 7, // Reassigned CC 7 to selected track volume
      };

      const updated = createOrUpdateMapping(initial, newMapping);
      expect(updated).toHaveLength(1);
      expect(updated[0].command).toBe("selected_track_volume");
    });

    it("deletes a mapping by ID", () => {
      const initial: MidiMapping[] = [
        { id: "m1", command: "master_volume", label: "Master", category: "master", messageType: "cc", channel: 0, controlNumber: 7 },
        { id: "m2", command: "transport_play", label: "Play", category: "transport", messageType: "cc", channel: 0, controlNumber: 115 },
      ];

      const after = deleteMapping(initial, "m1");
      expect(after).toHaveLength(1);
      expect(after[0].id).toBe("m2");
    });
  });

  describe("Presets & Storage", () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    it("provides valid presets", () => {
      expect(DEFAULT_MIDI_MAPPINGS.length).toBeGreaterThanOrEqual(5);
      expect(AKAI_MPK_PRESET.some((m) => m.command === "master_volume")).toBe(true);
      expect(KORG_NANOKONTROL_PRESET.some((m) => m.command.startsWith("track_volume"))).toBe(true);
    });

    it("saves and loads mappings from localStorage", () => {
      expect(loadMidiMappingsFromStorage()).toEqual(DEFAULT_MIDI_MAPPINGS);

      const custom: MidiMapping[] = [
        {
          id: "custom_1",
          command: "master_volume",
          label: "Custom Master Vol",
          category: "master",
          messageType: "cc",
          channel: 1,
          controlNumber: 21,
        },
      ];

      saveMidiMappingsToStorage(custom);
      expect(loadMidiMappingsFromStorage()).toEqual(custom);
    });
  });
});
