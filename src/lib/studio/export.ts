import type { StudioProject, StudioTrack } from "./types";
import { scheduleSynthNote, scheduleDrumSound, type DrumSoundType } from "./synth";
import { buildEffectChain } from "./effects";

export interface ExportOptions {
  sampleRate?: number; // default: 44100
  bitDepth?: 16 | 24; // default: 16
  range?: "all" | "loop";
  normalize?: boolean;
}

export function reverseAudioBuffer(ctx: BaseAudioContext, original: AudioBuffer): AudioBuffer {
  const reversed = ctx.createBuffer(original.numberOfChannels, original.length, original.sampleRate);
  for (let c = 0; c < original.numberOfChannels; c++) {
    const srcData = original.getChannelData(c);
    const destData = reversed.getChannelData(c);
    for (let i = 0, len = original.length; i < len; i++) {
      destData[i] = srcData[len - 1 - i];
    }
  }
  return reversed;
}

export function applyClipFades(
  gainParam: AudioParam,
  baseGain: number,
  startTime: number,
  durationSec: number,
  fadeInSec: number,
  fadeOutSec: number
): void {
  if (fadeInSec > 0 || fadeOutSec > 0) {
    if (fadeInSec > 0) {
      gainParam.setValueAtTime(0, startTime);
      gainParam.linearRampToValueAtTime(baseGain, startTime + Math.min(fadeInSec, durationSec));
    } else {
      gainParam.setValueAtTime(baseGain, startTime);
    }
    if (fadeOutSec > 0 && durationSec > fadeOutSec) {
      gainParam.setValueAtTime(baseGain, startTime + durationSec - fadeOutSec);
      gainParam.linearRampToValueAtTime(0, startTime + durationSec);
    }
  } else {
    gainParam.setValueAtTime(baseGain, startTime);
  }
}

/**
 * Encode multi-channel Float32Array audio data into standard RIFF WAV Blob
 */
export function encodeWavBlob(
  audioBuffer: AudioBuffer,
  bitDepth: 16 | 24 = 16,
  normalize = false
): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  // Header 44 bytes
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF Chunk
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // fmt Subchunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data Subchunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Normalization calculation
  let peak = 0;
  if (normalize) {
    for (let c = 0; c < numChannels; c++) {
      const ch = audioBuffer.getChannelData(c);
      for (let i = 0; i < numSamples; i++) {
        const abs = Math.abs(ch[i]);
        if (abs > peak) peak = abs;
      }
    }
  }
  const normFactor = normalize && peak > 0 ? 0.99 / peak : 1.0;

  // Interleave and write PCM samples
  let offset = 44;
  const channelsData = Array.from({ length: numChannels }, (_, c) =>
    audioBuffer.getChannelData(c)
  );

  if (bitDepth === 16) {
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = Math.max(-1, Math.min(1, channelsData[c][i] * normFactor));
        const val = s < 0 ? s * 0x8000 : s * 0x7fff;
        view.setInt16(offset, Math.floor(val), true);
        offset += 2;
      }
    }
  } else {
    // 24-bit
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = Math.max(-1, Math.min(1, channelsData[c][i] * normFactor));
        const val = Math.floor(s < 0 ? s * 0x800000 : s * 0x7fffff);
        view.setUint8(offset, val & 0xff);
        view.setUint8(offset + 1, (val >> 8) & 0xff);
        view.setInt8(offset + 2, (val >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Validasi keabsahan struktur file WAV yang diekspor
 */
export async function validateWavBlob(blob: Blob): Promise<{
  valid: boolean;
  sampleRate?: number;
  channels?: number;
  duration?: number;
  error?: string;
}> {
  try {
    if (blob.size < 44) {
      return { valid: false, error: "Ukuran berkas WAV terlalu kecil (kurang dari 44 bytes header)." };
    }
    const headerBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob.slice(0, 44));
    });
    const view = new DataView(headerBuffer);

    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    if (riff !== "RIFF" || wave !== "WAVE") {
      return { valid: false, error: "Header RIFF/WAVE tidak ditemukan." };
    }

    const channels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitDepth = view.getUint16(34, true);
    const dataSize = view.getUint32(40, true);

    const bytesPerSec = sampleRate * channels * (bitDepth / 8);
    const duration = bytesPerSec > 0 ? dataSize / bytesPerSec : 0;

    return {
      valid: true,
      channels,
      sampleRate,
      duration,
    };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : "Kesalahan membaca berkas WAV.",
    };
  }
}

/**
 * Render proyek ke OfflineAudioContext dan menghasilkan berkas WAV
 */
export async function exportStudioProject(
  project: StudioProject,
  cachedAudioBuffers: Map<string, AudioBuffer>,
  options: ExportOptions = {}
): Promise<{ blob: Blob; durationSeconds: number; validation: { valid: boolean; sampleRate?: number } }> {
  const sampleRate = options.sampleRate ?? project.sampleRate ?? 44100;
  const bitDepth = options.bitDepth ?? 16;
  const secPerBeat = 60 / project.tempo;

  // Hitung total durasi proyek
  let maxBeat = 8;
  if (options.range === "loop" && project.loopRange.enabled) {
    maxBeat = project.loopRange.endBeat;
  } else {
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const clipEnd = clip.startBeat + clip.durationBeats;
        if (clipEnd > maxBeat) maxBeat = clipEnd;
      }
    }
  }

  // Tambahkan tail reverb/delay (1.5 detik)
  const durationSeconds = Math.max(1.0, maxBeat * secPerBeat + 1.5);
  const totalFrames = Math.ceil(sampleRate * durationSeconds);

  // Buat context offline
  const offlineCtx = new (
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
  )(2, totalFrames, sampleRate);

  // Master bus
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = project.masterTrack.volume;

  // Master effects
  const masterEffects = buildEffectChain(offlineCtx, project.masterTrack.plugins);
  masterEffects.outputNode.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  // Aux Reverb Return Bus
  const auxReverbEffects = buildEffectChain(offlineCtx, [
    {
      id: "aux_reverb_export",
      pluginId: "internal.reverb",
      name: "Aux Reverb",
      enabled: true,
      parameters: { decay: 2.2, mix: 1.0 },
    },
  ]);
  const auxReverbGain = offlineCtx.createGain();
  auxReverbGain.gain.value = 0.8;
  auxReverbEffects.outputNode.connect(auxReverbGain);
  auxReverbGain.connect(masterEffects.inputNode);

  // Aux Delay Return Bus
  const auxDelayEffects = buildEffectChain(offlineCtx, [
    {
      id: "aux_delay_export",
      pluginId: "internal.delay",
      name: "Aux Delay",
      enabled: true,
      parameters: { time: 0.35, feedback: 0.45, mix: 1.0 },
    },
  ]);
  const auxDelayGain = offlineCtx.createGain();
  auxDelayGain.gain.value = 0.8;
  auxDelayEffects.outputNode.connect(auxDelayGain);
  auxDelayGain.connect(masterEffects.inputNode);

  // Rebuild Subgroup Buses in OfflineAudioContext
  const busNodes = new Map<
    string,
    { effects: ReturnType<typeof buildEffectChain>; gain: GainNode }
  >();

  const hasBusSolo = (project.buses || []).some((b) => b.solo);

  for (const bus of project.buses || []) {
    if (bus.mute || (hasBusSolo && !bus.solo)) continue;

    const busEffects = buildEffectChain(offlineCtx, bus.plugins);
    const busGain = offlineCtx.createGain();
    busGain.gain.value = bus.volume;

    const busPanner = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;
    busEffects.outputNode.connect(busGain);

    if (busPanner) {
      busPanner.pan.value = bus.pan;
      busGain.connect(busPanner);
      busPanner.connect(masterEffects.inputNode);
    } else {
      busGain.connect(masterEffects.inputNode);
    }

    busNodes.set(bus.id, { effects: busEffects, gain: busGain });
  }

  // Render setiap track yang tidak di-mute
  const hasSolo = project.tracks.some((t) => t.solo);

  for (const track of project.tracks) {
    if (track.mute || (hasSolo && !track.solo)) continue;

    const trackGain = offlineCtx.createGain();
    trackGain.gain.value = track.volume;

    const targetBusId = track.outputBus;
    const targetBus = targetBusId && targetBusId !== "master" ? busNodes.get(targetBusId) : null;
    const destinationNode = targetBus ? targetBus.effects.inputNode : masterEffects.inputNode;

    const panner = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = track.pan;
      trackGain.connect(panner);
      panner.connect(destinationNode);
    } else {
      trackGain.connect(destinationNode);
    }

    // Aux Sends: Connect Track Gain to Reverb and Delay return buses
    const reverbSendVal = track.sends?.reverb ?? 0.15;
    if (reverbSendVal > 0) {
      const reverbSendGain = offlineCtx.createGain();
      reverbSendGain.gain.value = reverbSendVal;
      trackGain.connect(reverbSendGain);
      reverbSendGain.connect(auxReverbEffects.inputNode);
    }

    const delaySendVal = track.sends?.delay ?? 0.1;
    if (delaySendVal > 0) {
      const delaySendGain = offlineCtx.createGain();
      delaySendGain.gain.value = delaySendVal;
      trackGain.connect(delaySendGain);
      delaySendGain.connect(auxDelayEffects.inputNode);
    }

    // Terapkan automation lanes (Volume & Pan) ke trackGain dan panner offline
    if (track.automationLanes && track.automationLanes.length > 0) {
      for (const lane of track.automationLanes) {
        if (!lane.enabled || !lane.points?.length) continue;
        const sortedPoints = [...lane.points].sort((a, b) => a.beat - b.beat);
        for (const pt of sortedPoints) {
          const ptTimeSec = pt.beat * secPerBeat;
          if (lane.target === "volume" || lane.parameterId === "volume") {
            const val = Math.max(0, pt.value);
            trackGain.gain.linearRampToValueAtTime(val, ptTimeSec);
          } else if ((lane.target === "pan" || lane.parameterId === "pan") && panner) {
            const val = Math.max(-1, Math.min(1, pt.value));
            panner.pan.linearRampToValueAtTime(val, ptTimeSec);
          }
        }
      }
    }

    const trackEffects = buildEffectChain(offlineCtx, track.plugins);
    trackEffects.outputNode.connect(trackGain);

    // Render clips
    for (const clip of track.clips) {
      if (clip.muted) continue;
      if (track.mutedLaneIndices && clip.laneIndex !== undefined && track.mutedLaneIndices.includes(clip.laneIndex)) continue;
      const clipStartSec = clip.startBeat * secPerBeat;

      if (clip.type === "midi" && clip.notes) {
        for (const note of clip.notes) {
          const noteStartSec = clipStartSec + note.startBeat * secPerBeat;
          const isDrumTrack = track.name.toLowerCase().includes("drum") || track.name.toLowerCase().includes("beat");
          if (isDrumTrack || [36, 38, 39, 42, 46, 50].includes(note.pitch)) {
            let soundType: DrumSoundType = "kick";
            if (note.pitch === 38) soundType = "snare";
            else if (note.pitch === 39) soundType = "clap";
            else if (note.pitch === 42) soundType = "hihat_closed";
            else if (note.pitch === 46) soundType = "hihat_open";
            else if (note.pitch === 50) soundType = "perc";
            scheduleDrumSound(offlineCtx, trackEffects.inputNode, soundType, noteStartSec, note.velocity);
          } else if (track.synthSettings) {
            const noteDurSec = note.durationBeats * secPerBeat;
            scheduleSynthNote(
              offlineCtx,
              trackEffects.inputNode,
              note,
              track.synthSettings,
              noteStartSec,
              noteDurSec
            );
          }
        }
      } else if (clip.type === "audio" && clip.assetId) {
        const audioBuf = cachedAudioBuffers.get(clip.assetId);
        if (audioBuf) {
          const source = offlineCtx.createBufferSource();
          source.buffer = clip.reversed ? reverseAudioBuffer(offlineCtx, audioBuf) : audioBuf;
          if (clip.pitchShiftSemitones) {
            source.detune.value = clip.pitchShiftSemitones * 100;
          }

          const clipGain = offlineCtx.createGain();
          const baseGain = clip.gain ?? 1.0;
          const durSec = clip.durationBeats * secPerBeat;
          const fadeInSec = (clip.fadeInBeats || 0) * secPerBeat;
          const fadeOutSec = (clip.fadeOutBeats || 0) * secPerBeat;
          applyClipFades(clipGain.gain, baseGain, clipStartSec, durSec, fadeInSec, fadeOutSec);

          source.connect(clipGain);
          clipGain.connect(trackEffects.inputNode);

          const offsetSec = (clip.offsetBeat || 0) * secPerBeat;
          source.start(clipStartSec, offsetSec, durSec);
        }
      }
    }
  }

  // Jalankan offline rendering
  const renderedBuffer = await offlineCtx.startRendering();
  const blob = encodeWavBlob(renderedBuffer, bitDepth, options.normalize);
  const validation = await validateWavBlob(blob);

  return { blob, durationSeconds, validation };
}

/**
 * Render satu track spesifik ke WAV Blob offline (digunakan untuk Mix To New Audio Track & Freeze)
 */
export async function renderSingleTrackToWav(
  project: StudioProject,
  trackId: string,
  cachedAudioBuffers: Map<string, AudioBuffer>,
  options: { sampleRate?: number; bitDepth?: 16 | 24; normalize?: boolean } = {}
): Promise<{
  blob: Blob;
  audioBuffer: AudioBuffer;
  durationSeconds: number;
  startBeat: number;
  durationBeats: number;
}> {
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track || track.clips.length === 0) {
    throw new Error("Track tidak ditemukan atau tidak memiliki klip untuk dirender.");
  }

  const sampleRate = options.sampleRate ?? project.sampleRate ?? 44100;
  const bitDepth = options.bitDepth ?? 16;
  const secPerBeat = 60 / project.tempo;

  let minBeat = Infinity;
  let maxBeat = 0;
  for (const clip of track.clips) {
    if (clip.startBeat < minBeat) minBeat = clip.startBeat;
    const clipEnd = clip.startBeat + clip.durationBeats;
    if (clipEnd > maxBeat) maxBeat = clipEnd;
  }
  if (minBeat === Infinity) minBeat = 0;
  const totalBeats = Math.max(1, maxBeat - minBeat);
  const durationSeconds = Math.max(0.5, totalBeats * secPerBeat + 1.0); // 1.0s tail
  const totalFrames = Math.ceil(sampleRate * durationSeconds);

  const offlineCtx = new (
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
  )(2, totalFrames, sampleRate);

  const trackGain = offlineCtx.createGain();
  trackGain.gain.value = track.volume;

  const trackPanner = offlineCtx.createStereoPanner();
  trackPanner.pan.value = track.pan;

  // Insert effects
  const effectChain = buildEffectChain(offlineCtx, track.plugins);
  effectChain.outputNode.connect(trackGain);
  trackGain.connect(trackPanner);
  trackPanner.connect(offlineCtx.destination);

  // Schedule clips (offset relative to minBeat)
  const isDrumTrack = track.name.toLowerCase().includes("drum") || track.name.toLowerCase().includes("beat");
  for (const clip of track.clips) {
    if (clip.muted) continue;
    if (track.mutedLaneIndices && clip.laneIndex !== undefined && track.mutedLaneIndices.includes(clip.laneIndex)) continue;
    const clipStartSec = (clip.startBeat - minBeat) * secPerBeat;
    const clipDurationSec = clip.durationBeats * secPerBeat;

    if (clip.type === "midi" && clip.notes) {
      for (const note of clip.notes) {
        const noteStartSec = clipStartSec + note.startBeat * secPerBeat;
        const noteDurSec = note.durationBeats * secPerBeat;
        if (noteStartSec < 0 || noteStartSec >= durationSeconds) continue;

        if (isDrumTrack || [36, 38, 39, 42, 46, 50].includes(note.pitch)) {
          let soundType: DrumSoundType = "kick";
          if (note.pitch === 38) soundType = "snare";
          else if (note.pitch === 39) soundType = "clap";
          else if (note.pitch === 42) soundType = "hihat_closed";
          else if (note.pitch === 46) soundType = "hihat_open";
          else if (note.pitch === 50) soundType = "perc";
          scheduleDrumSound(offlineCtx, effectChain.inputNode, soundType, noteStartSec, note.velocity);
        } else if (track.synthSettings) {
          scheduleSynthNote(
            offlineCtx,
            effectChain.inputNode,
            note,
            track.synthSettings,
            noteStartSec,
            noteDurSec
          );
        }
      }
    } else if (clip.type === "audio" && clip.assetId) {
      const audioBuf = cachedAudioBuffers.get(clip.assetId);
      if (audioBuf) {
        const source = offlineCtx.createBufferSource();
        source.buffer = clip.reversed ? reverseAudioBuffer(offlineCtx, audioBuf) : audioBuf;
        if (clip.pitchShiftSemitones) {
          source.detune.value = clip.pitchShiftSemitones * 100;
        }

        const clipGain = offlineCtx.createGain();
        const baseGain = clip.gain ?? 1.0;
        const durSec = clip.durationBeats * secPerBeat;
        const fadeInSec = (clip.fadeInBeats || 0) * secPerBeat;
        const fadeOutSec = (clip.fadeOutBeats || 0) * secPerBeat;
        applyClipFades(clipGain.gain, baseGain, clipStartSec, durSec, fadeInSec, fadeOutSec);

        source.connect(clipGain);
        clipGain.connect(effectChain.inputNode);

        const offsetSec = (clip.offsetBeat || 0) * secPerBeat;
        source.start(clipStartSec, offsetSec, clipDurationSec);
      }
    }
  }

  const renderedBuffer = await offlineCtx.startRendering();
  const blob = encodeWavBlob(renderedBuffer, bitDepth, options.normalize ?? false);

  return {
    blob,
    audioBuffer: renderedBuffer,
    durationSeconds,
    startBeat: minBeat,
    durationBeats: totalBeats,
  };
}

export interface StemExportOptions extends ExportOptions {
  selectedTrackIds?: string[];
  muteTrackEffects?: boolean;
}

export interface ExportedStemFile {
  trackId: string;
  trackName: string;
  fileName: string;
  blob: Blob;
  durationSeconds: number;
}

/**
 * Mix Down To Stems (Mixcraft 10 Hlm. 500–501):
 * Renders each selected track into an individual WAV file aligned from time zero.
 */
export async function exportProjectStems(
  project: StudioProject,
  cachedAudioBuffers: Map<string, AudioBuffer>,
  options: StemExportOptions = {},
  onProgress?: (progressPct: number, currentTrackName: string) => void
): Promise<ExportedStemFile[]> {
  const sampleRate = options.sampleRate ?? project.sampleRate ?? 44100;
  const bitDepth = options.bitDepth ?? 16;
  const secPerBeat = 60 / project.tempo;

  // Calculate full timeline length across all tracks so all stems are time-aligned to t=0
  let maxBeat = 8;
  if (options.range === "loop" && project.loopRange.enabled) {
    maxBeat = project.loopRange.endBeat;
  } else {
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const clipEnd = clip.startBeat + clip.durationBeats;
        if (clipEnd > maxBeat) maxBeat = clipEnd;
      }
    }
  }

  const durationSeconds = Math.max(1.0, maxBeat * secPerBeat + 1.5);
  const totalFrames = Math.ceil(sampleRate * durationSeconds);

  // Filter target tracks
  const targetTracks = project.tracks.filter((track) => {
    if (track.type === "video" || track.type === "video-text") return false;
    if (options.selectedTrackIds && !options.selectedTrackIds.includes(track.id)) {
      return false;
    }
    return track.clips.length > 0;
  });

  const results: ExportedStemFile[] = [];
  const safeProjectName = (project.name || "Project").replace(/[^a-zA-Z0-9_-]/g, "_");

  const OfflineCtxClass =
    (typeof window !== "undefined" && (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)) ||
    (typeof globalThis !== "undefined" && ((globalThis as any).OfflineAudioContext || (globalThis as any).webkitOfflineAudioContext));

  for (let idx = 0; idx < targetTracks.length; idx++) {
    const track = targetTracks[idx];
    const pct = Math.round((idx / targetTracks.length) * 100);
    onProgress?.(pct, track.name);

    if (!OfflineCtxClass) {
      // In environments without AudioContext, create deterministic dummy buffer
      const channelData = [new Float32Array(totalFrames), new Float32Array(totalFrames)];
      const mockBuf = {
        numberOfChannels: 2,
        length: totalFrames,
        sampleRate,
        duration: durationSeconds,
        getChannelData: (c: number) => channelData[c],
      } as unknown as AudioBuffer;
      const blob = encodeWavBlob(mockBuf, bitDepth, false);
      const safeTrackName = track.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `${safeProjectName}_Track${idx + 1}_${safeTrackName}.wav`;
      results.push({
        trackId: track.id,
        trackName: track.name,
        fileName,
        blob,
        durationSeconds,
      });
      continue;
    }

    const offlineCtx = new OfflineCtxClass(2, totalFrames, sampleRate);

    const trackGain = offlineCtx.createGain();
    trackGain.gain.value = track.volume;

    const trackPanner = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;
    if (trackPanner) {
      trackPanner.pan.value = track.pan;
      trackGain.connect(trackPanner);
      trackPanner.connect(offlineCtx.destination);
    } else {
      trackGain.connect(offlineCtx.destination);
    }

    // Effect chain: bypass if options.muteTrackEffects is true (Mixcraft 10 Hlm. 501)
    let inputNode: AudioNode = trackGain;
    if (!options.muteTrackEffects && track.plugins && track.plugins.length > 0) {
      const effectChain = buildEffectChain(offlineCtx, track.plugins);
      effectChain.outputNode.connect(trackGain);
      inputNode = effectChain.inputNode;
    }

    const isDrumTrack = track.name.toLowerCase().includes("drum") || track.name.toLowerCase().includes("beat");

    // Render clips aligned from time 0
    for (const clip of track.clips) {
      if (clip.muted) continue;
      if (track.mutedLaneIndices && clip.laneIndex !== undefined && track.mutedLaneIndices.includes(clip.laneIndex)) continue;

      const clipStartSec = clip.startBeat * secPerBeat;
      const clipDurationSec = clip.durationBeats * secPerBeat;

      if (clip.type === "midi" && clip.notes) {
        for (const note of clip.notes) {
          const noteStartSec = clipStartSec + note.startBeat * secPerBeat;
          const noteDurSec = note.durationBeats * secPerBeat;
          if (noteStartSec < 0 || noteStartSec >= durationSeconds) continue;

          if (isDrumTrack || [36, 38, 39, 42, 46, 50].includes(note.pitch)) {
            let soundType: DrumSoundType = "kick";
            if (note.pitch === 38) soundType = "snare";
            else if (note.pitch === 39) soundType = "clap";
            else if (note.pitch === 42) soundType = "hihat_closed";
            else if (note.pitch === 46) soundType = "hihat_open";
            else if (note.pitch === 50) soundType = "perc";
            scheduleDrumSound(offlineCtx, inputNode, soundType, noteStartSec, note.velocity);
          } else if (track.synthSettings) {
            scheduleSynthNote(
              offlineCtx,
              inputNode,
              note,
              track.synthSettings,
              noteStartSec,
              noteDurSec
            );
          }
        }
      } else if (clip.type === "audio" && clip.assetId) {
        const audioBuf = cachedAudioBuffers.get(clip.assetId);
        if (audioBuf) {
          const source = offlineCtx.createBufferSource();
          source.buffer = clip.reversed ? reverseAudioBuffer(offlineCtx, audioBuf) : audioBuf;
          if (clip.pitchShiftSemitones) {
            source.detune.value = clip.pitchShiftSemitones * 100;
          }

          const clipGain = offlineCtx.createGain();
          const baseGain = clip.gain ?? 1.0;
          const durSec = clipDurationSec;
          const fadeInSec = (clip.fadeInBeats || 0) * secPerBeat;
          const fadeOutSec = (clip.fadeOutBeats || 0) * secPerBeat;
          applyClipFades(clipGain.gain, baseGain, clipStartSec, durSec, fadeInSec, fadeOutSec);

          source.connect(clipGain);
          clipGain.connect(inputNode);

          const offsetSec = (clip.offsetBeat || 0) * secPerBeat;
          source.start(clipStartSec, offsetSec, clipDurationSec);
        }
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    const blob = encodeWavBlob(renderedBuffer, bitDepth, options.normalize ?? false);
    const safeTrackName = track.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${safeProjectName}_Track${idx + 1}_${safeTrackName}.wav`;

    results.push({
      trackId: track.id,
      trackName: track.name,
      fileName,
      blob,
      durationSeconds,
    });
  }

  onProgress?.(100, "Selesai");
  return results;
}


