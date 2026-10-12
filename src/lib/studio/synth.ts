import type { MidiNote, SynthSettings } from "./types";

/**
 * Konversi MIDI note number (0-127) ke frekuensi Hz (A4 = 69 = 440 Hz)
 */
export function midiPitchToFreq(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

export type DrumSoundType = "kick" | "snare" | "clap" | "hihat_closed" | "hihat_open" | "perc";

export interface SynthPreset {
  id: string;
  name: string;
  category: "bass" | "lead" | "pad" | "pluck" | "keys";
  settings: SynthSettings;
}

export const SYNTH_PRESETS: SynthPreset[] = [
  {
    id: "preset.sub_bass",
    name: "808 Sub Bass",
    category: "bass",
    settings: {
      waveform: "sine",
      attack: 0.005,
      decay: 0.3,
      sustain: 0.4,
      release: 0.25,
      filterCutoff: 350,
      filterResonance: 1.2,
      volume: 0.9,
    },
  },
  {
    id: "preset.synth_bass",
    name: "Punchy Saw Bass",
    category: "bass",
    settings: {
      waveform: "sawtooth",
      attack: 0.005,
      decay: 0.18,
      sustain: 0.2,
      release: 0.15,
      filterCutoff: 900,
      filterResonance: 3.5,
      volume: 0.85,
    },
  },
  {
    id: "preset.neon_lead",
    name: "Neon Saw Lead",
    category: "lead",
    settings: {
      waveform: "sawtooth",
      attack: 0.01,
      decay: 0.2,
      sustain: 0.7,
      release: 0.3,
      filterCutoff: 3800,
      filterResonance: 2.0,
      volume: 0.8,
    },
  },
  {
    id: "preset.square_lead",
    name: "Chiptune Square Lead",
    category: "lead",
    settings: {
      waveform: "square",
      attack: 0.005,
      decay: 0.15,
      sustain: 0.6,
      release: 0.2,
      filterCutoff: 4500,
      filterResonance: 1.5,
      volume: 0.75,
    },
  },
  {
    id: "preset.warm_pad",
    name: "Analog Warm Pad",
    category: "pad",
    settings: {
      waveform: "triangle",
      attack: 0.35,
      decay: 0.6,
      sustain: 0.85,
      release: 1.2,
      filterCutoff: 1800,
      filterResonance: 1.0,
      volume: 0.7,
    },
  },
  {
    id: "preset.pluck",
    name: "Crystal Pluck",
    category: "pluck",
    settings: {
      waveform: "sawtooth",
      attack: 0.002,
      decay: 0.18,
      sustain: 0.05,
      release: 0.2,
      filterCutoff: 2600,
      filterResonance: 4.0,
      volume: 0.85,
    },
  },
];

/**
 * Mainkan satu not sintetis polifonik dengan envelope ADSR dan filter cutoff
 */
export function scheduleSynthNote(
  ctx: BaseAudioContext,
  destination: AudioNode,
  note: MidiNote,
  settings: SynthSettings,
  startTime: number,
  durationSeconds: number
): { osc: OscillatorNode; gain: GainNode } {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = settings.waveform;
  osc.frequency.setValueAtTime(midiPitchToFreq(note.pitch), startTime);

  // Filter konfigurasi
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.max(20, settings.filterCutoff), startTime);
  filter.Q.setValueAtTime(Math.max(0.1, settings.filterResonance), startTime);

  // Peak level berbanding lurus dengan velocity (1-127)
  const normVelocity = Math.max(0.1, Math.min(1.0, note.velocity / 127));
  const peakGain = settings.volume * normVelocity;
  const sustainGain = peakGain * settings.sustain;

  const attackEnd = startTime + Math.max(0.002, settings.attack);
  const decayEnd = attackEnd + Math.max(0.01, settings.decay);
  const noteEnd = Math.max(decayEnd, startTime + durationSeconds);
  const releaseEnd = noteEnd + Math.max(0.01, settings.release);

  // ADSR Gain Envelope
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), attackEnd);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustainGain), decayEnd);
  gain.gain.setValueAtTime(Math.max(0.0001, sustainGain), noteEnd);
  gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

  // Routing
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  // Start & Stop
  osc.start(startTime);
  osc.stop(releaseEnd);

  // Cleanup references saat selesai untuk menghindari memory leak
  osc.onended = () => {
    try {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    } catch {}
  };

  return { osc, gain };
}

/**
 * Sintesis suara drum prosedural real-time (Kick, Snare, Clap, Hi-Hat, Percussion)
 * Menghasilkan audio berkualitas tinggi tanpa memerlukan file sampel eksternal berpemilik.
 */
export function scheduleDrumSound(
  ctx: BaseAudioContext,
  destination: AudioNode,
  sound: DrumSoundType,
  startTime: number,
  velocity = 100
): void {
  const normVel = Math.max(0.1, Math.min(1.0, velocity / 127));

  switch (sound) {
    case "kick": {
      // Sub sweep oscillator: 160Hz drop ke 36Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, startTime);
      osc.frequency.exponentialRampToValueAtTime(38, startTime + 0.08);

      gain.gain.setValueAtTime(normVel * 0.95, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
      break;
    }

    case "snare": {
      // Snare Body + White Noise
      const toneOsc = ctx.createOscillator();
      const toneGain = ctx.createGain();
      toneOsc.type = "triangle";
      toneOsc.frequency.setValueAtTime(220, startTime);
      toneOsc.frequency.exponentialRampToValueAtTime(140, startTime + 0.07);

      toneGain.gain.setValueAtTime(normVel * 0.6, startTime);
      toneGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      toneOsc.connect(toneGain);
      toneGain.connect(destination);
      toneOsc.start(startTime);
      toneOsc.stop(startTime + 0.2);

      // Noise generator
      const bufferSize = Math.floor(ctx.sampleRate * 0.22);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1200, startTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(normVel * 0.7, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(destination);

      noiseSource.start(startTime);
      noiseSource.stop(startTime + 0.23);
      noiseSource.onended = () => {
        try {
          toneOsc.disconnect();
          toneGain.disconnect();
          noiseSource.disconnect();
          filter.disconnect();
          noiseGain.disconnect();
        } catch {}
      };
      break;
    }

    case "clap": {
      // 3 Bursts of noise
      const bufferSize = Math.floor(ctx.sampleRate * 0.25);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, startTime);
      filter.Q.setValueAtTime(1.8, startTime);

      const gain = ctx.createGain();
      const peak = normVel * 0.8;
      // Burst 1
      gain.gain.setValueAtTime(peak, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.015);
      // Burst 2
      gain.gain.setValueAtTime(peak * 0.9, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.035);
      // Burst 3 + Decay
      gain.gain.setValueAtTime(peak, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      noiseSource.start(startTime);
      noiseSource.stop(startTime + 0.24);
      noiseSource.onended = () => {
        try {
          noiseSource.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {}
      };
      break;
    }

    case "hihat_closed": {
      // Highpass resonant noise, decay singkat (45 ms)
      const bufferSize = Math.floor(ctx.sampleRate * 0.06);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(7500, startTime);
      filter.Q.setValueAtTime(3.5, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(normVel * 0.65, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      noise.start(startTime);
      noise.stop(startTime + 0.055);
      noise.onended = () => {
        try {
          noise.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {}
      };
      break;
    }

    case "hihat_open": {
      // Highpass resonant noise, decay panjang (280 ms)
      const bufferSize = Math.floor(ctx.sampleRate * 0.35);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(6500, startTime);
      filter.Q.setValueAtTime(2.5, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(normVel * 0.6, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      noise.start(startTime);
      noise.stop(startTime + 0.3);
      noise.onended = () => {
        try {
          noise.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {}
      };
      break;
    }

    case "perc": {
      // Woodblock / Tom pitch sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(480, startTime);
      osc.frequency.exponentialRampToValueAtTime(180, startTime + 0.08);

      gain.gain.setValueAtTime(normVel * 0.7, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(startTime);
      osc.stop(startTime + 0.13);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
      break;
    }
  }
}
