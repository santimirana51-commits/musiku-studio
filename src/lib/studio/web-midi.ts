/**
 * Web MIDI API Manager
 * Mixcraft 10 User Guide Chapter 27 & Manual Hlm. 488–495 (MC10-AUT-205)
 *
 * Provides real-time hardware MIDI input listening, device enumeration,
 * hot-plug state change detection, and virtual simulation fallbacks.
 */

import { parseRawMidiMessage, type MidiMessageEvent, type MidiDeviceDescriptor } from "./midi-learn";

export type MidiMessageListener = (event: MidiMessageEvent, raw: Uint8Array) => void;
export type MidiDevicesChangeListener = (devices: MidiDeviceDescriptor[]) => void;

class WebMidiManager {
  private midiAccess: any = null;
  private listeners: Set<MidiMessageListener> = new Set();
  private deviceListeners: Set<MidiDevicesChangeListener> = new Set();
  private selectedDeviceId: string = "all";
  private isInitialized: boolean = false;
  private isSupported: boolean = false;

  constructor() {
    if (typeof window !== "undefined" && "navigator" in window && "requestMIDIAccess" in navigator) {
      this.isSupported = true;
    }
  }

  public getIsSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Initializes Web MIDI access and binds hardware port listeners.
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized && this.midiAccess) return true;
    if (!this.isSupported) {
      return false;
    }

    try {
      // @ts-ignore
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.isInitialized = true;

      // Attach listener for hot-plugging / unplugging MIDI controllers
      this.midiAccess.onstatechange = () => {
        this.bindInputListeners();
        this.notifyDeviceChange();
      };

      this.bindInputListeners();
      return true;
    } catch (err) {
      console.warn("Web MIDI Access request failed or denied:", err);
      return false;
    }
  }

  /**
   * Attaches onmidimessage handlers to all connected MIDI input ports.
   */
  private bindInputListeners(): void {
    if (!this.midiAccess) return;

    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      input.onmidimessage = (event: any) => {
        if (this.selectedDeviceId !== "all" && input.id !== this.selectedDeviceId) {
          return;
        }

        const parsed = parseRawMidiMessage(event.data);
        if (parsed) {
          this.notifyListeners(parsed, event.data);
        }
      };
    }
  }

  /**
   * Returns list of currently detected MIDI input devices.
   */
  public getConnectedDevices(): MidiDeviceDescriptor[] {
    if (!this.midiAccess) {
      return [
        {
          id: "virtual_controller",
          name: "Virtual MIDI Controller (Simulasi)",
          manufacturer: "MusikKu Studio",
          state: "connected",
        },
      ];
    }

    const devices: MidiDeviceDescriptor[] = [];
    const inputs = this.midiAccess.inputs.values();

    for (const input of inputs) {
      devices.push({
        id: input.id,
        name: input.name || `MIDI Port ${input.id}`,
        manufacturer: input.manufacturer || "Generic MIDI",
        state: input.state === "connected" ? "connected" : "disconnected",
      });
    }

    if (devices.length === 0) {
      devices.push({
        id: "virtual_controller",
        name: "Virtual MIDI Controller (Simulasi)",
        manufacturer: "MusikKu Studio",
        state: "connected",
      });
    }

    return devices;
  }

  public setSelectedDeviceId(id: string): void {
    this.selectedDeviceId = id;
  }

  public getSelectedDeviceId(): string {
    return this.selectedDeviceId;
  }

  /**
   * Subscribes to incoming MIDI messages.
   */
  public addListener(listener: MidiMessageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribes to device connection changes.
   */
  public onDevicesChange(listener: MidiDevicesChangeListener): () => void {
    this.deviceListeners.add(listener);
    return () => {
      this.deviceListeners.delete(listener);
    };
  }

  private notifyListeners(event: MidiMessageEvent, raw: Uint8Array): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event, raw);
      } catch (err) {
        console.error("Error in MIDI listener:", err);
      }
    });
  }

  private notifyDeviceChange(): void {
    const devices = this.getConnectedDevices();
    this.deviceListeners.forEach((listener) => {
      try {
        listener(devices);
      } catch (err) {
        console.error("Error in MIDI device listener:", err);
      }
    });
  }

  /**
   * Simulates an incoming MIDI message (useful for testing or on-screen virtual knobs/buttons).
   */
  public simulateMessage(event: MidiMessageEvent): void {
    const statusByte =
      event.type === "cc"
        ? 0xb0 | ((event.channel - 1) & 0x0f)
        : event.value > 0
        ? 0x90 | ((event.channel - 1) & 0x0f)
        : 0x80 | ((event.channel - 1) & 0x0f);

    const raw = new Uint8Array([statusByte, event.controlNumber, event.value]);
    this.notifyListeners(event, raw);
  }
}

export const webMidiManager = new WebMidiManager();
