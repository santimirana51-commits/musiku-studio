import type { AudioBackendAdapter, AudioBackendType, NativeAudioStats } from "./types";
import type { StudioProject, StudioClip, TransportState, AudioDeviceOption } from "../types";
import { StudioAudioEngine } from "../audio-engine";

export class WebAudioBackendAdapter implements AudioBackendAdapter {
  public readonly backendType: AudioBackendType = "web-audio";
  private engine: StudioAudioEngine;
  private project: StudioProject | null = null;

  constructor(engine?: StudioAudioEngine) {
    this.engine = engine || new StudioAudioEngine();
  }

  public async init(): Promise<void> {
    await this.engine.init();
  }

  public isReady(): boolean {
    return Boolean(this.engine.getContext());
  }

  public async getStats(): Promise<NativeAudioStats> {
    const ctx = this.engine.getContext();
    const sampleRate = ctx?.sampleRate || 44100;
    // Web Audio buffer size biasanya 128 sample per quantum render
    const bufferSize = 128;
    const latencyMs = (bufferSize / sampleRate) * 1000 + ((ctx?.baseLatency || 0.005) * 1000);

    return {
      backendType: "web-audio",
      driverName: "Web Audio API / AudioWorklet Engine",
      sampleRate,
      bufferSize,
      latencyMs: Math.round(latencyMs * 10) / 10,
      underruns: 0,
      cpuUsagePct: 2.5,
      isRealtimeSafe: true,
    };
  }

  public async loadProject(project: StudioProject): Promise<void> {
    this.project = project;
    this.engine.setProject(project);
  }

  public async play(): Promise<void> {
    await this.engine.play();
  }

  public pause(): void {
    this.engine.pause();
  }

  public stop(): void {
    this.engine.stop();
  }

  public seek(beat: number): void {
    this.engine.seek(beat);
  }

  public seekSeconds(seconds: number): void {
    this.engine.seekSeconds(seconds);
  }

  public setTempo(bpm: number): void {
    this.engine.setTempo(bpm);
  }

  public toggleMetronome(): boolean {
    return this.engine.toggleMetronome();
  }

  public async getAudioInputDevices(): Promise<AudioDeviceOption[]> {
    return this.engine.getAudioInputDevices();
  }

  public async startRecording(deviceId?: string): Promise<void> {
    await this.engine.startRecording(deviceId);
  }

  public async stopRecording(): Promise<void> {
    await this.engine.stopRecording();
  }

  public setPluginParameter(trackId: string, pluginId: string, paramId: string, value: number): void {
    this.engine.updatePluginParameter(trackId, pluginId, paramId, value);
  }

  public setPluginBypass(trackId: string, pluginId: string, bypassed: boolean): void {
    this.engine.setPluginBypass(trackId, pluginId, bypassed);
  }

  public getMeterLevels(): { master: number; input: number; tracks: Record<string, number> } {
    const master = this.engine.getMasterLevel();
    const input = this.engine.getInputLevel();
    const tracks: Record<string, number> = {};
    if (this.project) {
      for (const t of this.project.tracks) {
        tracks[t.id] = this.engine.getTrackLevel(t.id);
      }
    }
    return { master, input, tracks };
  }

  public onPlayhead(cb: (beat: number, seconds: number) => void): () => void {
    return this.engine.onPlayhead(cb);
  }

  public onState(cb: (state: TransportState) => void): () => void {
    return this.engine.onState(cb);
  }

  public onRecordFinalized(cb: (trackId: string, clip: StudioClip, blob: Blob) => void): () => void {
    return this.engine.onRecordFinalized(cb);
  }

  public getRawEngine(): StudioAudioEngine {
    return this.engine;
  }

  public dispose(): void {
    this.engine.stop();
  }
}
