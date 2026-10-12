import type { StudioProject, StudioClip, TransportState, AudioDeviceOption } from "../types";

export type AudioBackendType = "web-audio" | "windows-native" | "android-native";

export interface NativeAudioStats {
  backendType: AudioBackendType;
  driverName: string;
  sampleRate: number;
  bufferSize: number;
  latencyMs: number;
  underruns: number;
  cpuUsagePct: number;
  isRealtimeSafe: boolean;
}

export interface AudioBackendAdapter {
  readonly backendType: AudioBackendType;
  init(): Promise<void>;
  isReady(): boolean;
  getStats(): Promise<NativeAudioStats>;
  loadProject(project: StudioProject): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(beat: number): void;
  seekSeconds(seconds: number): void;
  setTempo(bpm: number): void;
  toggleMetronome(): boolean;
  getAudioInputDevices(): Promise<AudioDeviceOption[]>;
  startRecording(deviceId?: string): Promise<void>;
  stopRecording(): Promise<void>;
  setPluginParameter(trackId: string, pluginId: string, paramId: string, value: number): void;
  setPluginBypass(trackId: string, pluginId: string, bypassed: boolean): void;
  getMeterLevels(): { master: number; input: number; tracks: Record<string, number> };
  onPlayhead(cb: (beat: number, seconds: number) => void): () => void;
  onState(cb: (state: TransportState) => void): () => void;
  onRecordFinalized(cb: (trackId: string, clip: StudioClip, blob: Blob) => void): () => void;
  dispose(): void;
}
