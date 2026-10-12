import { describe, it, expect, vi, afterEach } from "vitest";
import { MicController, UnavailablePitchEstimator } from "@/lib/karaoke/mic";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockMediaDevices(getUserMedia: unknown) {
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    "AudioContext",
    vi.fn(() => ({
      createMediaStreamSource: () => ({ connect: vi.fn() }),
      createAnalyser: () => ({ fftSize: 0 }),
      resume: async () => {},
      close: async () => {},
    }))
  );
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

describe("MicController", () => {
  it("kegagalan izin (NotAllowedError) dilaporkan sebagai denied", async () => {
    const err = new DOMException("denied", "NotAllowedError");
    mockMediaDevices(vi.fn(async () => { throw err; }));
    const mic = new MicController();
    await expect(mic.start()).rejects.toThrow(/ditolak/i);
    expect(mic.permission).toBe("denied");
    expect(mic.isRunning).toBe(false);
  });

  it("tanpa perangkat (NotFoundError) dilaporkan sebagai no-device", async () => {
    const err = new DOMException("none", "NotFoundError");
    mockMediaDevices(vi.fn(async () => { throw err; }));
    const mic = new MicController();
    await expect(mic.start()).rejects.toThrow(/tidak ditemukan/i);
    expect(mic.permission).toBe("no-device");
  });

  it("tanpa API browser dilaporkan unsupported", async () => {
    vi.stubGlobal("navigator", {});
    const mic = new MicController();
    expect(MicController.supported()).toBe(false);
    await expect(mic.start()).rejects.toThrow(/tidak mendukung/i);
    expect(mic.permission).toBe("unsupported");
  });

  it("stop menghentikan semua track dan idempoten", async () => {
    const stopTrack = vi.fn();
    mockMediaDevices(vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })));
    const mic = new MicController();
    await mic.start();
    expect(mic.isRunning).toBe(true);
    mic.stop();
    mic.stop(); // idempoten, tidak melempar
    expect(mic.isRunning).toBe(false);
    expect(stopTrack).toHaveBeenCalled();
  });

  it("estimator pitch bawaan jujur: tidak tersedia, tanpa skor palsu", () => {
    const est = new UnavailablePitchEstimator();
    expect(est.available).toBe(false);
    expect(est.estimate(new Float32Array(8), 44100)).toBeNull();
    const mic = new MicController();
    expect(mic.pitch.available).toBe(false);
  });

  it("start memakai deviceId pilihan dan fallback ke default bila constraint ditolak", async () => {
    const over = new DOMException("gone", "OverconstrainedError");
    const gum = vi.fn()
      .mockRejectedValueOnce(over)
      .mockResolvedValueOnce({ getTracks: () => [] });
    mockMediaDevices(gum);
    const mic = new MicController();
    await mic.start(undefined, { deviceId: "abc123" });
    expect(mic.isRunning).toBe(true);
    expect(gum).toHaveBeenCalledTimes(2);
    expect(gum.mock.calls[0][0]).toEqual({ audio: { deviceId: { exact: "abc123" } } });
    expect(gum.mock.calls[1][0]).toEqual({ audio: true });
    mic.stop();
  });

  it("penolakan izin tidak di-fallback (langsung denied)", async () => {
    const denied = new DOMException("no", "NotAllowedError");
    const gum = vi.fn(async () => { throw denied; });
    mockMediaDevices(gum);
    const mic = new MicController();
    await expect(mic.start(undefined, { deviceId: "abc123" })).rejects.toThrow(/ditolak/i);
    expect(gum).toHaveBeenCalledTimes(1);
    expect(mic.permission).toBe("denied");
  });
});

describe("listMicrophones", () => {
  it("mengembalikan daftar input audio", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: async () => [
          { kind: "audioinput", label: "Mic USB", deviceId: "d1" },
          { kind: "videoinput", label: "Cam", deviceId: "v1" },
          { kind: "audioinput", label: "", deviceId: "d2" },
        ],
      },
    });
    const list = await MicController.listMicrophones();
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe("Mic USB");
    expect(list[1].label).toBe("Mikrofon 2"); // label kosong diberi nomor
  });

  it("tanpa API enumerate melempar error jelas", async () => {
    vi.stubGlobal("navigator", {});
    await expect(MicController.listMicrophones()).rejects.toThrow(/deteksi/i);
  });
});
