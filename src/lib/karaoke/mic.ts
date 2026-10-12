// Microphone Mode — input vokal lokal via Web Audio API + getUserMedia.
//
// Prinsip privasi:
// - Izin diminta eksplisit lewat tombol (tidak auto-start).
// - Tidak ada perekaman/upload default: stream hanya dianalisis lokal
//   (level meter) dan tidak pernah dikirim ke server.
// - Seluruh track dihentikan saat mode dimatikan atau halaman ditutup.
//
// Penilaian pitch/ketepatan waktu: disediakan ANTARMUKA (PitchEstimator)
// untuk tahap berikutnya. Tidak ada skor palsu — implementasi bawaan
// selalu melaporkan tidak-tersedia dan UI wajib menampilkannya jujur.

export type MicPermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported"
  | "no-device";

export interface MicLevelCallback {
  (level: number): void; // 0..1 RMS
}

/** Hasil estimasi pitch (Hz). Tahap berikutnya mengisi implementasi nyata. */
export interface PitchResult {
  frequencyHz: number;
  clarity: number; // 0..1
  atMs: number;
}

export interface PitchEstimator {
  readonly available: boolean;
  readonly reason: string;
  estimate(_samples: Float32Array, _sampleRate: number): PitchResult | null;
}

/** Estimator bawaan: jujur melaporkan belum tersedia (tanpa skor palsu). */
export class UnavailablePitchEstimator implements PitchEstimator {
  readonly available = false;
  readonly reason =
    "Penilaian pitch belum tersedia. Dibutuhkan algoritma & pengujian khusus (tahap berikutnya).";
  estimate(_samples: Float32Array, _sampleRate: number): PitchResult | null {
    return null;
  }
}

function hasMicApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioContext !== "undefined"
  );
}

/** Perangkat input audio yang terdeteksi browser. */
export interface MicDevice {
  deviceId: string;
  /** Kosong bila izin belum diberikan (kebijakan privasi browser). */
  label: string;
}

export interface MicStartOptions {
  /** deviceId dari listMicrophones(); default = perangkat bawaan. */
  deviceId?: string;
}

export class MicController {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId = 0;
  private running = false;
  private onLevel: MicLevelCallback | null = null;
  readonly pitch: PitchEstimator = new UnavailablePitchEstimator();

  permission: MicPermissionState = "unknown";

  get isRunning(): boolean {
    return this.running;
  }

  /** Stream aktif (untuk rantai efek). null bila belum start. */
  getStream(): MediaStream | null {
    return this.stream;
  }

  static supported(): boolean {
    return hasMicApi();
  }

  /**
   * Deteksi mikrofon via enumerateDevices. Label kosong = normal sebelum
   * izin diberikan (browser menyembunyikan label demi privasi) — jumlah
   * perangkat tetap terdeteksi. Melempar bila API tak tersedia.
   */
  static async listMicrophones(): Promise<MicDevice[]> {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      throw new Error("Browser tidak mendukung deteksi perangkat audio.");
    }
    const all = await navigator.mediaDevices.enumerateDevices();
    return all
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Mikrofon ${i + 1}` }));
  }

  async start(onLevel?: MicLevelCallback, opts: MicStartOptions = {}): Promise<void> {
    if (!hasMicApi()) {
      this.permission = "unsupported";
      throw new Error("Browser tidak mendukung akses mikrofon (butuh HTTPS + Web Audio API).");
    }
    if (this.running) return;
    this.onLevel = onLevel ?? null;
    // Perangkat pilihan (exact) dengan fallback ke default bila constraint
    // ditolak — mis. perangkat dicabut di antara deteksi dan start.
    const constraints: MediaStreamConstraints[] = opts.deviceId
      ? [{ audio: { deviceId: { exact: opts.deviceId } } }, { audio: true }]
      : [{ audio: true }];
    let stream: MediaStream | null = null;
    let lastErr: unknown = null;
    for (const c of constraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        break;
      } catch (err) {
        lastErr = err;
        // Hanya fallback untuk constraint perangkat; penolakan izin final.
        if (!(err instanceof DOMException) || err.name !== "OverconstrainedError") break;
      }
    }
    if (!stream) {
      const err = lastErr;
      this.permission = err instanceof DOMException && err.name === "NotAllowedError"
        ? "denied"
        : "no-device";
      const msg =
        this.permission === "denied"
          ? "Izin mikrofon ditolak. Aktifkan di pengaturan browser lalu coba lagi."
          : "Mikrofon tidak ditemukan atau tidak dapat dibuka.";
      throw new Error(msg);
    }
    try {
      this.ctx = new AudioContext();
      const src = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      src.connect(this.analyser);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      this.permission = "no-device";
      throw new Error("Gagal memproses audio mikrofon di perangkat ini.");
    }
    this.stream = stream;
    this.permission = "granted";
    this.running = true;
    // Lanjutkan context bila autoplay policy menahannya (tetap butuh gestur).
    void this.ctx.resume().catch(() => {});
    this.loop();
  }

  /** Level input 0..1 dari buffer waktu analyser (RMS). */
  readLevel(): number {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.min(1, Math.sqrt(sum / buf.length) * 3);
  }

  private loop = (): void => {
    if (!this.running) return;
    try {
      this.onLevel?.(this.readLevel());
    } catch {}
    if (typeof requestAnimationFrame === "function") {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  /** Hentikan SEMUA track + tutup context + batalkan loop. Idempoten. */
  stop(): void {
    this.running = false;
    if (typeof cancelAnimationFrame === "function" && this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = 0;
    try {
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.stream = null;
    try {
      void this.ctx?.close().catch(() => {});
    } catch {}
    this.ctx = null;
    this.analyser = null;
  }
}
