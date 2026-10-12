import { describe, it, expect, vi } from "vitest";
import { MicEffectsChain, makeImpulse } from "@/lib/karaoke/audio-effects";

// AudioContext palsu: node minimal dengan connect/disconnect + param .value.
function fakeParam(v = 0) {
  return { value: v, setValueAtTime: vi.fn() };
}
function fakeNode() {
  return { connect: vi.fn(), disconnect: vi.fn() };
}
function fakeCtx() {
  const nodes: Array<{ connect: (...a: never[]) => void; disconnect: (...a: never[]) => void }> = [];
  const mk = () => {
    const n = fakeNode() as unknown as { connect: (...a: never[]) => void; disconnect: (...a: never[]) => void };
    nodes.push(n);
    return n;
  };
  return {
    nodes,
    currentTime: 0,
    sampleRate: 44100,
    destination: fakeNode(),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
    createBiquadFilter: vi.fn(() => ({ ...mk(), type: "", frequency: fakeParam(), Q: fakeParam(), gain: fakeParam(0) })),
    createDelay: vi.fn(() => ({ ...mk(), delayTime: fakeParam() })),
    createGain: vi.fn(() => ({ ...mk(), gain: fakeParam(0) })),
    createConvolver: vi.fn(() => ({ ...mk(), buffer: null })),
    createBuffer: vi.fn((_ch: number, len: number) => ({
      getChannelData: () => new Float32Array(len),
    })),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
}

const PARAMS = {
  gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  echo: 0.3,
  reverb: 0.4,
  micVolume: 0.8,
  monitor: false,
};

describe("MicEffectsChain", () => {
  it("init membangun 10 filter EQ + echo + reverb", async () => {
    const ctx = fakeCtx();
    const chain = new MicEffectsChain(() => ctx as unknown as AudioContext);
    await chain.init({} as MediaStream, PARAMS);
    expect(chain.isRunning).toBe(true);
    expect(ctx.createBiquadFilter).toHaveBeenCalledTimes(10);
    expect(ctx.createDelay).toHaveBeenCalledTimes(1);
    expect(ctx.createConvolver).toHaveBeenCalledTimes(1);
    chain.dispose();
  });

  it("perubahan gain band diteruskan ke filter (di-clamp)", async () => {
    const ctx = fakeCtx();
    const chain = new MicEffectsChain(() => ctx as unknown as AudioContext);
    await chain.init({} as MediaStream, PARAMS);
    chain.setBand(0, 99);
    chain.setBand(9, -99);
    const filters = vi.mocked(ctx.createBiquadFilter).mock.results;
    expect(filters[0].value.gain.value).toBe(12);
    expect(filters[9].value.gain.value).toBe(-12);
    chain.dispose();
  });

  it("dispose menutup context, memutus node, dan idempoten", async () => {
    const ctx = fakeCtx();
    const chain = new MicEffectsChain(() => ctx as unknown as AudioContext);
    await chain.init({} as MediaStream, PARAMS);
    chain.dispose();
    chain.dispose();
    expect(chain.isRunning).toBe(false);
    expect(ctx.close).toHaveBeenCalled();
    for (const n of ctx.nodes) expect(n.disconnect).toHaveBeenCalled();
  });

  it("makeImpulse menghasilkan buffer stereo dengan decay", () => {
    const ctx = fakeCtx();
    const buf = makeImpulse(ctx as unknown as AudioContext, 0.1, 3);
    expect(buf).toBeTruthy();
    expect(ctx.createBuffer).toHaveBeenCalled();
  });
});
