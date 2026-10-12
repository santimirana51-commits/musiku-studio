import type {
  StudioProject,
  StudioTrack,
  StudioClip,
  SubgroupBus,
  MidiNote,
  SynthSettings,
  TransportState,
  AudioDeviceOption,
  PunchRange,
  ChannelStripSettings,
  LiveTabAudioState,
} from "./types";
import { scheduleSynthNote, scheduleDrumSound, type DrumSoundType } from "./synth";
import { buildEffectChain, type EffectChainHandle } from "./effects";
import { createChannelStripNodes, type ChannelStripNodeHandle } from "./channel-strip";
import { saveAudioBlob, getAudioBlob } from "./storage";
import { getEffectiveTempoAtBeat } from "./automation";

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Transport state
  private playing = false;
  private recording = false;
  private currentBeat = 0;
  private tempo = 120;
  private timeSignature: [number, number] = [4, 4];
  private metronomeEnabled = false;
  private metronomeRecording = true;
  private metronomePlayback = false;

  // Clock references
  private audioStartTime = 0;
  private playheadStartBeat = 0;
  private schedulerTimer: number | null = null;
  private nextScheduleBeat = 0;

  // Active nodes & cache
  private activeProject: StudioProject | null = null;
  private cachedBuffers = new Map<string, AudioBuffer>();
  private reversedBufferCache = new WeakMap<AudioBuffer, AudioBuffer>();

  private getReversedBuffer(original: AudioBuffer): AudioBuffer {
    const cached = this.reversedBufferCache.get(original);
    if (cached) return cached;
    if (!this.ctx) return original;
    const reversed = this.ctx.createBuffer(original.numberOfChannels, original.length, original.sampleRate);
    for (let c = 0; c < original.numberOfChannels; c++) {
      const srcData = original.getChannelData(c);
      const destData = reversed.getChannelData(c);
      for (let i = 0, len = original.length; i < len; i++) {
        destData[i] = srcData[len - 1 - i];
      }
    }
    this.reversedBufferCache.set(original, reversed);
    return reversed;
  }
  private trackHandles = new Map<
    string,
    {
      gainNode: GainNode;
      pannerNode: StereoPannerNode | null;
      analyser: AnalyserNode;
      channelStripHandle: ChannelStripNodeHandle;
      effectsHandle: EffectChainHandle;
      reverbSendGain: GainNode;
      delaySendGain: GainNode;
    }
  >();
  private busHandles = new Map<
    string,
    {
      id: string;
      gainNode: GainNode;
      pannerNode: StereoPannerNode | null;
      analyser: AnalyserNode;
      effectsHandle: EffectChainHandle;
    }
  >();
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private masterEffectsHandle: EffectChainHandle | null = null;
  private reverbBusGain: GainNode | null = null;
  private delayBusGain: GainNode | null = null;
  private reverbEffectsHandle: EffectChainHandle | null = null;
  private delayEffectsHandle: EffectChainHandle | null = null;

  // Recording
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartBeat = 0;
  private recordingAnalyser: AnalyserNode | null = null;
  private inputLevel = 0;

  // Event callbacks
  private onPlayheadCallbacks = new Set<(beat: number, sec: number) => void>();
  private onStateCallbacks = new Set<(state: TransportState) => void>();
  private onRecordFinalizedCallbacks = new Set<(trackId: string, clip: StudioClip, blob: Blob) => void>();

  // Live Tab / YouTube Audio Stream
  private liveTabStream: MediaStream | null = null;
  private liveTabSourceNode: MediaStreamAudioSourceNode | null = null;
  private liveTabGainNode: GainNode | null = null;
  private liveTabPannerNode: StereoPannerNode | null = null;
  private liveTabAnalyserNode: AnalyserNode | null = null;
  private liveTabVolume = 1.0;
  private liveTabPan = 0;
  private liveTabMute = false;
  private liveTabSolo = false;
  private liveTabEnabled = false;
  private onLiveTabStateCallbacks = new Set<(state: LiveTabAudioState) => void>();

  constructor() {}

  public async init(): Promise<void> {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    // Setup Master Graph
    this.masterGain = this.ctx.createGain();
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;

    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    this.isInitialized = true;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public setProject(project: StudioProject): void {
    this.activeProject = project;
    this.tempo = project.tempo;
    this.timeSignature = project.timeSignature;
    this.rebuildAudioGraph();
  }

  public rebuildAudioGraph(): void {
    if (!this.ctx || !this.activeProject || !this.masterGain) return;

    // Disconnect old track nodes
    this.trackHandles.forEach((handle) => {
      try {
        handle.channelStripHandle.dispose();
        handle.gainNode.disconnect();
        handle.analyser.disconnect();
        handle.reverbSendGain.disconnect();
        handle.delaySendGain.disconnect();
      } catch {}
    });
    this.trackHandles.clear();

    // Disconnect old bus nodes
    this.busHandles.forEach((handle) => {
      try {
        handle.gainNode.disconnect();
        handle.analyser.disconnect();
        if (handle.pannerNode) handle.pannerNode.disconnect();
      } catch {}
    });
    this.busHandles.clear();

    // Rebuild master effects
    this.masterEffectsHandle = buildEffectChain(this.ctx, this.activeProject.masterTrack.plugins);
    this.masterEffectsHandle.outputNode.connect(this.masterGain);
    this.masterGain.gain.value = this.activeProject.masterTrack.volume;

    // Rebuild Aux Return Buses
    this.reverbEffectsHandle = buildEffectChain(this.ctx, [
      {
        id: "aux_reverb_internal",
        pluginId: "internal.reverb",
        name: "Aux Reverb",
        enabled: true,
        parameters: { decay: 2.2, mix: 1.0 },
      },
    ]);
    this.reverbBusGain = this.ctx.createGain();
    this.reverbBusGain.gain.value = 0.8;
    this.reverbEffectsHandle.outputNode.connect(this.reverbBusGain);
    this.reverbBusGain.connect(this.masterEffectsHandle.inputNode);

    this.delayEffectsHandle = buildEffectChain(this.ctx, [
      {
        id: "aux_delay_internal",
        pluginId: "internal.delay",
        name: "Aux Delay",
        enabled: true,
        parameters: { time: 0.35, feedback: 0.45, mix: 1.0 },
      },
    ]);
    this.delayBusGain = this.ctx.createGain();
    this.delayBusGain.gain.value = 0.8;
    this.delayEffectsHandle.outputNode.connect(this.delayBusGain);
    this.delayBusGain.connect(this.masterEffectsHandle.inputNode);

    // Rebuild Subgroup Buses (Buses 1-4 / Stems)
    for (const bus of this.activeProject.buses || []) {
      const busEffectsHandle = buildEffectChain(this.ctx, bus.plugins);
      const busGain = this.ctx.createGain();
      busGain.gain.value = bus.mute ? 0.0 : bus.volume;

      const busPanner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      const busAnalyser = this.ctx.createAnalyser();
      busAnalyser.fftSize = 256;

      busEffectsHandle.outputNode.connect(busGain);
      if (busPanner) {
        busPanner.pan.value = bus.pan;
        busGain.connect(busPanner);
        busPanner.connect(busAnalyser);
      } else {
        busGain.connect(busAnalyser);
      }

      // Bus routes to Master
      busAnalyser.connect(this.masterEffectsHandle.inputNode);

      this.busHandles.set(bus.id, {
        id: bus.id,
        gainNode: busGain,
        pannerNode: busPanner,
        analyser: busAnalyser,
        effectsHandle: busEffectsHandle,
      });
    }

    // Build track nodes
    for (const track of this.activeProject.tracks) {
      const trackGain = this.ctx.createGain();
      trackGain.gain.value = track.mute ? 0.0 : track.volume;

      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;

      const channelStripHandle = createChannelStripNodes(this.ctx, track.channelStrip);
      const effectsHandle = buildEffectChain(this.ctx, track.plugins);

      // 9-Stage Flow: Channel Strip -> Insert Effects -> Track Gain -> (Panner) -> Analyser -> Output Destination
      channelStripHandle.outputNode.connect(effectsHandle.inputNode);
      effectsHandle.outputNode.connect(trackGain);
      if (panner) {
        panner.pan.value = track.pan;
        trackGain.connect(panner);
        panner.connect(analyser);
      } else {
        trackGain.connect(analyser);
      }

      // Connect to assigned Bus or directly to Master
      const targetBusId = track.outputBus;
      const targetBus = targetBusId && targetBusId !== "master" ? this.busHandles.get(targetBusId) : null;
      if (targetBus) {
        analyser.connect(targetBus.effectsHandle.inputNode);
      } else {
        analyser.connect(this.masterEffectsHandle.inputNode);
      }

      // Aux Sends: From Track Gain to Reverb and Delay return buses
      const reverbSendGain = this.ctx.createGain();
      reverbSendGain.gain.value = track.sends?.reverb ?? 0.15;
      trackGain.connect(reverbSendGain);
      reverbSendGain.connect(this.reverbEffectsHandle.inputNode);

      const delaySendGain = this.ctx.createGain();
      delaySendGain.gain.value = track.sends?.delay ?? 0.1;
      trackGain.connect(delaySendGain);
      delaySendGain.connect(this.delayEffectsHandle.inputNode);

      this.trackHandles.set(track.id, {
        gainNode: trackGain,
        pannerNode: panner,
        analyser,
        channelStripHandle,
        effectsHandle,
        reverbSendGain,
        delaySendGain,
      });
    }

    this.updateTrackMutesAndSolos();
    this.updateBusMutesAndSolos();

    if (this.liveTabAnalyserNode && this.masterEffectsHandle) {
      try {
        this.liveTabAnalyserNode.connect(this.masterEffectsHandle.inputNode);
      } catch {}
    }
  }

  public getBusLevel(busId: string): number {
    const handle = this.busHandles.get(busId);
    if (!handle) return 0;
    const data = new Uint8Array(handle.analyser.frequencyBinCount);
    handle.analyser.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const val = Math.abs(data[i] - 128);
      if (val > max) max = val;
    }
    return max / 128;
  }

  public updateBusParameter(
    busId: string,
    paramOrUpdates: Partial<SubgroupBus> | "volume" | "pan" | "mute" | "solo",
    value?: number | boolean
  ): void {
    const handle = this.busHandles.get(busId);
    if (!handle) return;

    if (typeof paramOrUpdates === "object") {
      const updates = paramOrUpdates;
      if ("volume" in updates && typeof updates.volume === "number") {
        handle.gainNode.gain.setValueAtTime(updates.volume, this.ctx?.currentTime ?? 0);
      }
      if ("pan" in updates && typeof updates.pan === "number" && handle.pannerNode) {
        handle.pannerNode.pan.setValueAtTime(updates.pan, this.ctx?.currentTime ?? 0);
      }
      if ("mute" in updates || "solo" in updates) {
        this.updateBusMutesAndSolos();
      }
      return;
    }

    const param = paramOrUpdates;
    if (param === "volume" && typeof value === "number") {
      handle.gainNode.gain.setValueAtTime(value, this.ctx?.currentTime ?? 0);
    } else if (param === "pan" && typeof value === "number" && handle.pannerNode) {
      handle.pannerNode.pan.setValueAtTime(value, this.ctx?.currentTime ?? 0);
    } else if (param === "mute" || param === "solo") {
      this.updateBusMutesAndSolos();
    }
  }

  private updateBusMutesAndSolos(): void {
    if (!this.activeProject) return;
    const hasSolo = (this.activeProject.buses || []).some((b) => b.solo);
    for (const bus of this.activeProject.buses || []) {
      const handle = this.busHandles.get(bus.id);
      if (!handle) continue;
      const shouldMute = bus.mute || (hasSolo && !bus.solo);
      handle.gainNode.gain.setValueAtTime(shouldMute ? 0.0 : bus.volume, this.ctx?.currentTime ?? 0);
    }
  }

  public validateRoutingGraph(): { isValid: boolean; cycle?: string[] } {
    if (!this.activeProject) return { isValid: true };
    const validBusIds = new Set((this.activeProject.buses || []).map((b) => b.id));
    for (const track of this.activeProject.tracks) {
      if (track.outputBus && track.outputBus !== "master" && !validBusIds.has(track.outputBus)) {
        return { isValid: false, cycle: [track.id, track.outputBus] };
      }
    }
    return { isValid: true };
  }

  public getAvailableInputChannels(): { id: string; name: string }[] {
    return [
      { id: "all", name: "Stereo (Ch 1/2)" },
      { id: "input_1", name: "Mono Ch 1 (Left / Mic)" },
      { id: "input_2", name: "Mono Ch 2 (Right / Line)" },
    ];
  }

  public updateTrackSend(trackId: string, sendKey: "reverb" | "delay", value: number): void {
    const handle = this.trackHandles.get(trackId);
    if (!handle) return;
    const clamped = Math.max(0, Math.min(1.5, value));
    if (sendKey === "reverb") {
      handle.reverbSendGain.gain.setValueAtTime(clamped, this.ctx?.currentTime ?? 0);
    } else if (sendKey === "delay") {
      handle.delaySendGain.gain.setValueAtTime(clamped, this.ctx?.currentTime ?? 0);
    }
  }

  public updateTrackParameter(trackId: string, param: "volume" | "pan" | "mute" | "solo", value: number | boolean): void {
    const handle = this.trackHandles.get(trackId);
    if (!handle) return;

    if (param === "volume" && typeof value === "number") {
      handle.gainNode.gain.setValueAtTime(value, this.ctx?.currentTime ?? 0);
    } else if (param === "pan" && typeof value === "number" && handle.pannerNode) {
      handle.pannerNode.pan.setValueAtTime(value, this.ctx?.currentTime ?? 0);
    } else if (param === "mute" || param === "solo") {
      this.updateTrackMutesAndSolos();
    }
  }

  public updateChannelStrip(trackId: string, settings: Partial<ChannelStripSettings>): void {
    const handle = this.trackHandles.get(trackId);
    if (handle) {
      handle.channelStripHandle.updateSettings(settings);
    }
  }

  private updateTrackMutesAndSolos(): void {
    if (!this.activeProject) return;
    const hasSolo = this.activeProject.tracks.some((t) => t.solo);

    for (const track of this.activeProject.tracks) {
      const handle = this.trackHandles.get(track.id);
      if (!handle) continue;
      const shouldMute = track.mute || (hasSolo && !track.solo);
      handle.gainNode.gain.setValueAtTime(shouldMute ? 0.0 : track.volume, this.ctx?.currentTime ?? 0);
    }
  }

  public updatePluginParameter(trackId: string, pluginId: string, paramId: string, value: number): void {
    const handle = this.trackHandles.get(trackId);
    if (handle) {
      handle.effectsHandle.updateParameter(pluginId, paramId, value);
      return;
    }
    const busHandle = this.busHandles.get(trackId);
    if (busHandle) {
      busHandle.effectsHandle.updateParameter(pluginId, paramId, value);
      return;
    }
    if (trackId === "master" && this.masterEffectsHandle) {
      this.masterEffectsHandle.updateParameter(pluginId, paramId, value);
    }
  }

  public setPluginBypass(trackId: string, pluginId: string, bypassed: boolean): void {
    const handle = this.trackHandles.get(trackId);
    if (handle) {
      handle.effectsHandle.setBypass(pluginId, bypassed);
      return;
    }
    const busHandle = this.busHandles.get(trackId);
    if (busHandle) {
      busHandle.effectsHandle.setBypass(pluginId, bypassed);
      return;
    }
    if (trackId === "master" && this.masterEffectsHandle) {
      this.masterEffectsHandle.setBypass(pluginId, bypassed);
    }
  }

  public async setAudioBuffer(assetId: string, buffer: AudioBuffer): Promise<void> {
    this.cachedBuffers.set(assetId, buffer);
  }

  public async playDrumSound(sound: DrumSoundType, velocity = 100, isFlam = false): Promise<void> {
    await this.init();
    if (!this.ctx || !this.masterGain) return;
    if (isFlam) {
      scheduleDrumSound(this.ctx, this.masterGain, sound, this.ctx.currentTime, Math.max(40, Math.round(velocity * 0.75)));
      scheduleDrumSound(this.ctx, this.masterGain, sound, this.ctx.currentTime + 0.035, velocity);
    } else {
      scheduleDrumSound(this.ctx, this.masterGain, sound, this.ctx.currentTime, velocity);
    }
  }

  public async previewSynthPitch(
    pitch: number,
    settings?: SynthSettings,
    durationSeconds = 0.4
  ): Promise<void> {
    await this.init();
    if (!this.ctx || !this.masterGain) return;
    const defaultSettings: SynthSettings = settings || {
      waveform: "sawtooth",
      attack: 0.01,
      decay: 0.2,
      sustain: 0.5,
      release: 0.2,
      filterCutoff: 3000,
      filterResonance: 2.0,
      volume: 0.8,
    };
    const dummyNote: MidiNote = {
      id: "preview_note",
      pitch,
      startBeat: 0,
      durationBeats: 1,
      velocity: 100,
    };
    scheduleSynthNote(
      this.ctx,
      this.masterGain,
      dummyNote,
      defaultSettings,
      this.ctx.currentTime,
      durationSeconds
    );
  }

  // --- Transport Controls ---

  public async play(): Promise<void> {
    await this.init();
    if (this.playing || !this.ctx) return;

    this.playing = true;
    this.audioStartTime = this.ctx.currentTime;
    this.playheadStartBeat = this.currentBeat;
    this.nextScheduleBeat = this.currentBeat;

    this.startSchedulerLoop();
    this.emitState();
  }

  public pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.stopSchedulerLoop();
    this.emitState();
  }

  public stop(): void {
    this.playing = false;
    this.currentBeat = 0;
    this.nextScheduleBeat = 0;
    this.stopSchedulerLoop();
    if (this.recording) {
      void this.stopRecording();
    }
    this.emitPlayhead(0);
    this.emitState();
  }

  public seek(beat: number): void {
    const clamped = Math.max(0, beat);
    this.currentBeat = clamped;
    this.nextScheduleBeat = clamped;
    if (this.playing && this.ctx) {
      this.audioStartTime = this.ctx.currentTime;
      this.playheadStartBeat = clamped;
    }
    this.emitPlayhead(clamped);
    this.emitState();
  }

  public seekSeconds(seconds: number): void {
    const secPerBeat = 60 / this.tempo;
    const targetBeat = Math.max(0, seconds) / secPerBeat;
    this.seek(targetBeat);
  }

  public seekToBeat(beat: number): void {
    this.seek(beat);
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public isRecording(): boolean {
    return this.recording;
  }

  public getCachedAudioBuffers(): Map<string, AudioBuffer> {
    return this.cachedBuffers;
  }

  public getAudioBuffer(assetId: string): AudioBuffer | undefined {
    return this.cachedBuffers.get(assetId);
  }

  public async loadAssetFromStorage(assetId: string): Promise<AudioBuffer | null> {
    if (this.cachedBuffers.has(assetId)) {
      return this.cachedBuffers.get(assetId)!;
    }
    const blob = await getAudioBlob(assetId);
    if (!blob) return null;
    await this.init();
    if (!this.ctx) return null;
    const arrayBuf = await blob.arrayBuffer();
    const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
    this.cachedBuffers.set(assetId, audioBuf);
    return audioBuf;
  }

  public async importAudioFile(file: File): Promise<{
    assetId: string;
    audioBuffer: AudioBuffer;
    durationSeconds: number;
    sampleRate: number;
    channels: number;
  }> {
    await this.init();
    if (!this.ctx) throw new Error("Audio Context belum diinisialisasi.");
    const arrayBuf = await file.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuf);
    const assetId = `asset_imported_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.cachedBuffers.set(assetId, audioBuffer);
    await saveAudioBlob(assetId, file);
    return {
      assetId,
      audioBuffer,
      durationSeconds: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
    };
  }

  public setTempo(bpm: number): void {
    this.tempo = Math.max(20, Math.min(320, bpm));
    if (this.playing && this.ctx) {
      // Re-anchor clock
      this.audioStartTime = this.ctx.currentTime;
      this.playheadStartBeat = this.currentBeat;
    }
    this.emitState();
  }

  public getTempoAtBeat(beat: number): number {
    return getEffectiveTempoAtBeat(this.tempo, this.activeProject?.markers, beat);
  }

  public toggleMetronome(): boolean {
    this.metronomeEnabled = !this.metronomeEnabled;
    this.emitState();
    return this.metronomeEnabled;
  }

  public setMetronomeSettings(settings: { recording?: boolean; playback?: boolean }): void {
    if (settings.recording !== undefined) this.metronomeRecording = settings.recording;
    if (settings.playback !== undefined) this.metronomePlayback = settings.playback;
    this.emitState();
  }

  public getMetronomeSettings(): { recording: boolean; playback: boolean; enabled: boolean } {
    return {
      recording: this.metronomeRecording,
      playback: this.metronomePlayback,
      enabled: this.metronomeEnabled,
    };
  }

  private startSchedulerLoop(): void {
    if (this.schedulerTimer !== null) return;

    const tick = () => {
      if (!this.playing || !this.ctx) return;

      const secPerBeat = 60 / this.tempo;
      const elapsedAudioSec = this.ctx.currentTime - this.audioStartTime;
      let calculatedBeat = this.playheadStartBeat + elapsedAudioSec / secPerBeat;

      // Handle Loop
      if (this.activeProject?.loopRange.enabled) {
        const loopStart = this.activeProject.loopRange.startBeat;
        const loopEnd = this.activeProject.loopRange.endBeat;
        const loopLength = loopEnd - loopStart;

        if (loopLength > 0 && calculatedBeat >= loopEnd) {
          calculatedBeat = loopStart + ((calculatedBeat - loopStart) % loopLength);
          this.audioStartTime = this.ctx.currentTime;
          this.playheadStartBeat = calculatedBeat;
          this.nextScheduleBeat = calculatedBeat;
        }
      }

      this.currentBeat = calculatedBeat;
      this.emitPlayhead(this.currentBeat);

      // Automated Punch-Out: Otomatis hentikan perekaman jika melewati batas punch-out
      if (this.recording && this.activeProject?.punchRange?.enabled) {
        if (this.currentBeat >= this.activeProject.punchRange.endBeat) {
          void this.stopRecording();
        }
      }

      // Schedule window (150ms lookahead)
      const lookaheadBeats = 0.15 / secPerBeat;
      this.scheduleEvents(this.nextScheduleBeat, this.currentBeat + lookaheadBeats);
      this.nextScheduleBeat = this.currentBeat + lookaheadBeats;

      this.schedulerTimer = window.setTimeout(tick, 25);
    };

    tick();
  }

  private stopSchedulerLoop(): void {
    if (this.schedulerTimer !== null) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private scheduleEvents(fromBeat: number, toBeat: number): void {
    if (!this.ctx || !this.activeProject) return;
    const secPerBeat = 60 / this.tempo;

    // Metronome Click Scheduling (Recording vs Playback support per Mixcraft 10)
    const shouldClick = this.recording
      ? (this.metronomeRecording || this.metronomeEnabled)
      : (this.metronomePlayback || (this.metronomeEnabled && !this.metronomeRecording));

    if (shouldClick) {
      const startInt = Math.floor(fromBeat);
      const endInt = Math.ceil(toBeat);
      for (let b = startInt; b < endInt; b++) {
        if (b >= fromBeat && b < toBeat) {
          const beatTimeSec = this.audioStartTime + (b - this.playheadStartBeat) * secPerBeat;
          if (beatTimeSec >= this.ctx.currentTime) {
            const isBarStart = b % (this.timeSignature[0] || 4) === 0;
            this.scheduleMetronomeClick(beatTimeSec, isBarStart);
          }
        }
      }
    }

    // Schedule Tracks (MIDI & Audio)
    const isPerformanceSolo = !!this.activeProject.isPerformanceSolo;

    for (const track of this.activeProject.tracks) {
      if (track.mute) continue;
      const handle = this.trackHandles.get(track.id);
      if (!handle) continue;

      // If Performance Solo is engaged (Mixcraft 10 Hlm. 414), mute main timeline clips
      if (isPerformanceSolo) continue;

      // If track is frozen, play the pre-rendered audio buffer directly and bypass MIDI synth / plugin load
      if (track.isFrozen && track.frozenAssetId) {
        const frozenBuf = this.cachedBuffers.get(track.frozenAssetId);
        const minBeat = track.clips.reduce((min, c) => Math.min(min, c.startBeat), 0);
        if (frozenBuf && minBeat >= fromBeat && minBeat < toBeat) {
          const clipTimeSec = this.audioStartTime + (minBeat - this.playheadStartBeat) * secPerBeat;
          if (clipTimeSec >= this.ctx.currentTime) {
            const src = this.ctx.createBufferSource();
            src.buffer = frozenBuf;
            src.connect(handle.gainNode);
            src.start(clipTimeSec);
          }
        }
        continue;
      }

      for (const clip of track.clips) {
        if (clip.muted) continue;
        if (track.mutedLaneIndices && clip.laneIndex !== undefined && track.mutedLaneIndices.includes(clip.laneIndex)) continue;

        const clipStart = clip.startBeat;
        const clipEnd = clip.startBeat + clip.durationBeats;

        if (clip.type === "midi" && clip.notes) {
          for (const note of clip.notes) {
            const noteAbsoluteStart = clipStart + note.startBeat;
            if (noteAbsoluteStart >= fromBeat && noteAbsoluteStart < toBeat) {
              const noteTimeSec = this.audioStartTime + (noteAbsoluteStart - this.playheadStartBeat) * secPerBeat;
              if (noteTimeSec >= this.ctx.currentTime) {
                const isDrumTrack = track.name.toLowerCase().includes("drum") || track.name.toLowerCase().includes("beat");
                if (isDrumTrack || [36, 38, 39, 42, 46, 50].includes(note.pitch)) {
                  let soundType: DrumSoundType = "kick";
                  if (note.pitch === 38) soundType = "snare";
                  else if (note.pitch === 39) soundType = "clap";
                  else if (note.pitch === 42) soundType = "hihat_closed";
                  else if (note.pitch === 46) soundType = "hihat_open";
                  else if (note.pitch === 50) soundType = "perc";
                  scheduleDrumSound(this.ctx, handle.channelStripHandle.inputNode, soundType, noteTimeSec, note.velocity);
                } else if (track.synthSettings) {
                  const noteDurSec = note.durationBeats * secPerBeat;
                  scheduleSynthNote(
                    this.ctx,
                    handle.channelStripHandle.inputNode,
                    note,
                    track.synthSettings,
                    noteTimeSec,
                    noteDurSec
                  );
                }
              }
            }
          }
        } else if (clip.type === "audio" && clip.assetId) {
          if (clipStart >= fromBeat && clipStart < toBeat) {
            const audioBuf = this.cachedBuffers.get(clip.assetId);
            if (audioBuf) {
              const clipTimeSec = this.audioStartTime + (clipStart - this.playheadStartBeat) * secPerBeat;
                const src = this.ctx.createBufferSource();
                src.buffer = clip.reversed ? this.getReversedBuffer(audioBuf) : audioBuf;
                if (clip.pitchShiftSemitones) {
                  src.detune.value = clip.pitchShiftSemitones * 100;
                }

                const cGain = this.ctx.createGain();
                const baseGain = clip.gain ?? 1.0;
                const durSec = clip.durationBeats * secPerBeat;
                const fadeInSec = (clip.fadeInBeats || 0) * secPerBeat;
                const fadeOutSec = (clip.fadeOutBeats || 0) * secPerBeat;

                if (fadeInSec > 0 || fadeOutSec > 0) {
                  if (fadeInSec > 0) {
                    cGain.gain.setValueAtTime(0, clipTimeSec);
                    cGain.gain.linearRampToValueAtTime(
                      baseGain,
                      clipTimeSec + Math.min(fadeInSec, durSec)
                    );
                  } else {
                    cGain.gain.setValueAtTime(baseGain, clipTimeSec);
                  }
                  if (fadeOutSec > 0 && durSec > fadeOutSec) {
                    cGain.gain.setValueAtTime(baseGain, clipTimeSec + durSec - fadeOutSec);
                    cGain.gain.linearRampToValueAtTime(0, clipTimeSec + durSec);
                  }
                } else {
                  cGain.gain.setValueAtTime(baseGain, clipTimeSec);
                }

                src.connect(cGain);
                cGain.connect(handle.channelStripHandle.inputNode);

                const offsetSec = (clip.offsetBeat || 0) * secPerBeat;
                src.start(clipTimeSec, offsetSec, durSec);
            }
          }
        }
      }

      // Automation Lane Evaluation (Volume & Pan)
      if (track.automationLanes && track.automationLanes.length > 0) {
        for (const lane of track.automationLanes) {
          if (!lane.enabled || !lane.points?.length) continue;
          for (const pt of lane.points) {
            if (pt.beat >= fromBeat && pt.beat < toBeat) {
              const ptTimeSec = this.audioStartTime + (pt.beat - this.playheadStartBeat) * secPerBeat;
              if (ptTimeSec >= this.ctx.currentTime) {
                if (lane.target === "volume" || lane.parameterId === "volume") {
                  const targetGain = track.mute ? 0 : Math.max(0, pt.value);
                  handle.gainNode.gain.linearRampToValueAtTime(targetGain, ptTimeSec);
                } else if ((lane.target === "pan" || lane.parameterId === "pan") && handle.pannerNode) {
                  const targetPan = Math.max(-1, Math.min(1, pt.value));
                  handle.pannerNode.pan.linearRampToValueAtTime(targetPan, ptTimeSec);
                } else if ((lane.target === "reverb" || lane.parameterId === "reverb") && handle.reverbSendGain) {
                  const targetReverb = Math.max(0, Math.min(1, pt.value));
                  handle.reverbSendGain.gain.linearRampToValueAtTime(targetReverb, ptTimeSec);
                } else if ((lane.target === "delay" || lane.parameterId === "delay") && handle.delaySendGain) {
                  const targetDelay = Math.max(0, Math.min(1, pt.value));
                  handle.delaySendGain.gain.linearRampToValueAtTime(targetDelay, ptTimeSec);
                }
              }
            }
          }
        }
      }
    }
  }

  private scheduleMetronomeClick(time: number, isAccent: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(isAccent ? 1600 : 880, time);

    g.gain.setValueAtTime(0.3, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

    osc.connect(g);
    g.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.05);

    osc.onended = () => {
      try {
        osc.disconnect();
        g.disconnect();
      } catch {}
    };
  }

  // --- Multitrack Recording ---

  public async getAudioInputDevices(): Promise<AudioDeviceOption[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const options: AudioDeviceOption[] = devices
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
          groupId: d.groupId,
        }));
      if (this.liveTabStream) {
        options.unshift({
          deviceId: "live-tab-audio",
          label: "Tab Audio YouTube (Live Virtual Input)",
        });
      }
      return options;
    } catch {
      return [];
    }
  }

  public async startRecording(deviceId?: string): Promise<boolean> {
    await this.init();
    if (!this.ctx || !this.activeProject) return false;

    const armedTracks = this.activeProject.tracks.filter((t) => t.armRecord);
    if (armedTracks.length === 0) {
      throw new Error("Tidak ada track yang di-arm untuk recording. Klik tombol 'R' pada track.");
    }

    try {
      if (deviceId === "live-tab-audio" && this.liveTabStream) {
        this.mediaStream = this.liveTabStream;
      } else {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId && deviceId !== "live-tab-audio" ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }

      // Live Level Metering
      const micSource = this.ctx.createMediaStreamSource(this.mediaStream);
      this.recordingAnalyser = this.ctx.createAnalyser();
      this.recordingAnalyser.fftSize = 256;
      micSource.connect(this.recordingAnalyser);

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(this.mediaStream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(100);
      this.recording = true;
      if (this.activeProject?.punchRange?.enabled && this.currentBeat < this.activeProject.punchRange.startBeat) {
        this.recordingStartBeat = this.activeProject.punchRange.startBeat;
      } else {
        this.recordingStartBeat = this.currentBeat;
      }

      // Start playback transport along with recording
      await this.play();
      this.emitState();
      return true;
    } catch (err) {
      this.recording = false;
      this.emitState();
      throw err;
    }
  }

  public async stopRecording(): Promise<void> {
    if (!this.recording) return;

    this.recording = false;
    this.pause();

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        if (!this.mediaRecorder) return resolve();
        this.mediaRecorder.onstop = () => resolve();
        this.mediaRecorder.stop();
      });
    }

    // Stop streams (jangan matikan stream jika sedang menggunakan live tab audio)
    if (this.mediaStream) {
      if (this.mediaStream !== this.liveTabStream) {
        for (const track of this.mediaStream.getTracks()) {
          track.stop();
        }
      }
      this.mediaStream = null;
    }

    // Finalize recording blob
    if (this.recordedChunks.length > 0 && this.activeProject && this.ctx) {
      const audioBlob = new Blob(this.recordedChunks, { type: "audio/webm" });
      const arrayBuf = await audioBlob.arrayBuffer();

      try {
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuf);
        const assetId = `asset_rec_${Date.now()}`;
        this.cachedBuffers.set(assetId, audioBuffer);
        await saveAudioBlob(assetId, audioBlob);

        const secPerBeat = 60 / this.tempo;
        const durationBeats = audioBuffer.duration / secPerBeat;

        // Attach to all armed tracks with lane assignment per Mixcraft recording mode
        const armed = this.activeProject.tracks.filter((t) => t.armRecord);
        for (const track of armed) {
          const recMode = track.recordingMode || "takes";
          let laneIndex = 0;
          if (recMode === "takes" || recMode === "overdub") {
            const maxLane = track.clips.reduce((max, c) => Math.max(max, c.laneIndex ?? 0), -1);
            laneIndex = track.clips.length > 0 ? maxLane + 1 : 0;
          }

          const newClip: StudioClip = {
            id: `clip_rec_${Date.now()}_${track.id}`,
            trackId: track.id,
            type: "audio",
            name: `Take ${track.clips.length + 1}`,
            color: track.color,
            startBeat: this.recordingStartBeat,
            durationBeats,
            offsetBeat: 0,
            gain: 1.0,
            assetId,
            laneIndex,
            muted: false,
          };
          this.onRecordFinalizedCallbacks.forEach((cb) => cb(track.id, newClip, audioBlob));
        }
      } catch (e) {
        console.error("Gagal mendecode audio rekaman:", e);
      }
    }

    this.recordedChunks = [];
    this.emitState();
  }

  // --- Metering ---

  public getTrackLevel(trackId: string): number {
    const handle = this.trackHandles.get(trackId);
    if (!handle) return 0;
    const data = new Uint8Array(handle.analyser.frequencyBinCount);
    handle.analyser.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const val = Math.abs(data[i] - 128);
      if (val > max) max = val;
    }
    return max / 128;
  }

  public getMasterLevel(): number {
    if (!this.masterAnalyser) return 0;
    const data = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    this.masterAnalyser.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const val = Math.abs(data[i] - 128);
      if (val > max) max = val;
    }
    return max / 128;
  }

  public getInputLevel(): number {
    if (!this.recordingAnalyser) return 0;
    const data = new Uint8Array(this.recordingAnalyser.frequencyBinCount);
    this.recordingAnalyser.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const val = Math.abs(data[i] - 128);
      if (val > max) max = val;
    }
    return max / 128;
  }

  // --- Subscriptions ---

  public onPlayhead(cb: (beat: number, seconds: number) => void): () => void {
    this.onPlayheadCallbacks.add(cb);
    return () => this.onPlayheadCallbacks.delete(cb);
  }

  public onState(cb: (state: TransportState) => void): () => void {
    this.onStateCallbacks.add(cb);
    return () => this.onStateCallbacks.delete(cb);
  }

  public onRecordFinalized(cb: (trackId: string, clip: StudioClip, blob: Blob) => void): () => void {
    this.onRecordFinalizedCallbacks.add(cb);
    return () => this.onRecordFinalizedCallbacks.delete(cb);
  }

  public updatePunchRange(punch: Partial<PunchRange>): void {
    if (!this.activeProject) return;
    this.activeProject.punchRange = {
      ...(this.activeProject.punchRange ?? { enabled: false, startBeat: 4, endBeat: 8 }),
      ...punch,
    };
    this.emitState();
  }

  private emitPlayhead(beat: number): void {
    const sec = (beat * 60) / this.tempo;
    this.onPlayheadCallbacks.forEach((cb) => cb(beat, sec));
  }

  private emitState(): void {
    const sec = (this.currentBeat * 60) / this.tempo;
    const state: TransportState = {
      playing: this.playing,
      recording: this.recording,
      currentBeat: this.currentBeat,
      currentTimeSeconds: sec,
      tempo: this.tempo,
      timeSignature: this.timeSignature,
      loop: this.activeProject?.loopRange ?? { enabled: false, startBeat: 0, endBeat: 8 },
      punch: this.activeProject?.punchRange ?? { enabled: false, startBeat: 4, endBeat: 8 },
      metronome: this.metronomeEnabled,
    };
    this.onStateCallbacks.forEach((cb) => cb(state));
  }

  // --- Live Tab Audio (YouTube Capture) ---

  public async connectLiveTabAudio(): Promise<boolean> {
    await this.init();
    if (!this.ctx || !this.masterGain) return false;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Peramban Anda tidak mendukung penangkapan audio tab (getDisplayMedia).");
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(
          "Tidak ada audio yang terdeteksi dari tab tersebut. Pastikan opsi 'Bagikan audio tab' (Also share tab audio) dicentang saat memilih tab YouTube."
        );
      }

      // Deteksi ketika user mengklik 'Stop sharing' di banner peramban
      audioTracks[0].onended = () => {
        this.disconnectLiveTabAudio();
      };

      this.disconnectLiveTabAudio(false);

      this.liveTabStream = stream;
      this.liveTabSourceNode = this.ctx.createMediaStreamSource(stream);
      this.liveTabGainNode = this.ctx.createGain();
      this.liveTabGainNode.gain.value = this.liveTabMute ? 0.0 : this.liveTabVolume;

      this.liveTabPannerNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (this.liveTabPannerNode) {
        this.liveTabPannerNode.pan.value = this.liveTabPan;
      }

      this.liveTabAnalyserNode = this.ctx.createAnalyser();
      this.liveTabAnalyserNode.fftSize = 256;

      this.liveTabSourceNode.connect(this.liveTabGainNode);
      if (this.liveTabPannerNode) {
        this.liveTabGainNode.connect(this.liveTabPannerNode);
        this.liveTabPannerNode.connect(this.liveTabAnalyserNode);
      } else {
        this.liveTabGainNode.connect(this.liveTabAnalyserNode);
      }

      const target = this.masterEffectsHandle?.inputNode || this.masterGain;
      this.liveTabAnalyserNode.connect(target);

      this.liveTabEnabled = true;
      this.emitLiveTabState();
      return true;
    } catch (err) {
      this.emitLiveTabState();
      throw err;
    }
  }

  public disconnectLiveTabAudio(emit = true): void {
    if (this.liveTabStream) {
      this.liveTabStream.getTracks().forEach((t) => t.stop());
      this.liveTabStream = null;
    }
    if (this.liveTabSourceNode) {
      try {
        this.liveTabSourceNode.disconnect();
      } catch {}
      this.liveTabSourceNode = null;
    }
    if (this.liveTabGainNode) {
      try {
        this.liveTabGainNode.disconnect();
      } catch {}
      this.liveTabGainNode = null;
    }
    if (this.liveTabPannerNode) {
      try {
        this.liveTabPannerNode.disconnect();
      } catch {}
      this.liveTabPannerNode = null;
    }
    if (this.liveTabAnalyserNode) {
      try {
        this.liveTabAnalyserNode.disconnect();
      } catch {}
      this.liveTabAnalyserNode = null;
    }
    this.liveTabEnabled = false;
    if (emit) this.emitLiveTabState();
  }

  public setLiveTabAudioEnabled(enabled: boolean): void {
    if (!this.liveTabStream) return;
    this.liveTabEnabled = enabled;
    if (this.liveTabGainNode && this.ctx) {
      const val = this.liveTabEnabled && !this.liveTabMute ? this.liveTabVolume : 0.0;
      this.liveTabGainNode.gain.setTargetAtTime(val, this.ctx.currentTime, 0.01);
    }
    this.liveTabStream.getAudioTracks().forEach((t) => {
      t.enabled = this.liveTabEnabled;
    });
    this.emitLiveTabState();
  }

  public toggleLiveTabAudio(): boolean {
    if (!this.liveTabStream) return false;
    this.setLiveTabAudioEnabled(!this.liveTabEnabled);
    return this.liveTabEnabled;
  }

  public setLiveTabAudioVolume(vol: number): void {
    this.liveTabVolume = Math.max(0, Math.min(2.0, vol));
    if (this.liveTabGainNode && this.ctx && this.liveTabEnabled && !this.liveTabMute) {
      this.liveTabGainNode.gain.setTargetAtTime(this.liveTabVolume, this.ctx.currentTime, 0.01);
    }
    this.emitLiveTabState();
  }

  public setLiveTabAudioPan(pan: number): void {
    this.liveTabPan = Math.max(-1, Math.min(1, pan));
    if (this.liveTabPannerNode && this.ctx) {
      this.liveTabPannerNode.pan.setTargetAtTime(this.liveTabPan, this.ctx.currentTime, 0.01);
    }
    this.emitLiveTabState();
  }

  public setLiveTabAudioMute(mute: boolean): void {
    this.liveTabMute = mute;
    if (this.liveTabGainNode && this.ctx) {
      const val = this.liveTabEnabled && !this.liveTabMute ? this.liveTabVolume : 0.0;
      this.liveTabGainNode.gain.setTargetAtTime(val, this.ctx.currentTime, 0.01);
    }
    this.emitLiveTabState();
  }

  public setLiveTabAudioSolo(solo: boolean): void {
    this.liveTabSolo = solo;
    this.emitLiveTabState();
  }

  public getLiveTabAudioLevel(): number {
    if (!this.liveTabAnalyserNode || !this.liveTabEnabled || this.liveTabMute) return 0;
    const data = new Uint8Array(this.liveTabAnalyserNode.frequencyBinCount);
    this.liveTabAnalyserNode.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const val = Math.abs(data[i] - 128);
      if (val > max) max = val;
    }
    return max / 128;
  }

  public getLiveTabAudioState(): LiveTabAudioState {
    return {
      isConnected: !!this.liveTabStream,
      isEnabled: this.liveTabEnabled,
      volume: this.liveTabVolume,
      pan: this.liveTabPan,
      isMuted: this.liveTabMute,
      isSolo: this.liveTabSolo,
    };
  }

  public onLiveTabState(cb: (state: LiveTabAudioState) => void): () => void {
    this.onLiveTabStateCallbacks.add(cb);
    return () => this.onLiveTabStateCallbacks.delete(cb);
  }

  private emitLiveTabState(): void {
    const st = this.getLiveTabAudioState();
    this.onLiveTabStateCallbacks.forEach((cb) => cb(st));
  }
}

