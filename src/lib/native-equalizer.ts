// src/lib/native-equalizer.ts
// Jembatan (Bridge) TypeScript ke Native Equalizer Plugin Android
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NativeEqualizerPlugin {
  isAvailable(): Promise<{
    available: boolean;
    numBands?: number;
    minMillibels?: number;
    maxMillibels?: number;
    centerFreqs?: number[];
  }>;
  setEnabled(options: { enabled: boolean }): Promise<{ success: boolean; enabled?: boolean }>;
  setGains(options: { gains: number[] }): Promise<{ success: boolean }>;
  openSystemEqualizer(): Promise<{ success: boolean }>;
}

const NativeEqualizer = registerPlugin<NativeEqualizerPlugin>("NativeEqualizer");

export function isAndroidNative(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

let isChecked = false;
let isAvailableCached = false;

export async function isNativeEqualizerAvailable(): Promise<boolean> {
  if (!isAndroidNative()) return false;
  if (isChecked) return isAvailableCached;

  try {
    const res = await NativeEqualizer.isAvailable();
    isAvailableCached = Boolean(res?.available);
    isChecked = true;
    return isAvailableCached;
  } catch {
    isChecked = true;
    isAvailableCached = false;
    return false;
  }
}

/**
 * Terapkan penguatan gain 10-Band / 5-Band ke equalizer hardware Android
 */
export async function applyNativeGains(gains: number[], enabled = true): Promise<boolean> {
  if (!isAndroidNative()) return false;
  try {
    if (!enabled) {
      await NativeEqualizer.setEnabled({ enabled: false });
      return true;
    }
    await NativeEqualizer.setEnabled({ enabled: true });
    const res = await NativeEqualizer.setGains({ gains });
    return Boolean(res?.success);
  } catch (err) {
    console.warn("[NativeEqualizer] Gagal menerapkan gain ke Android:", err);
    return false;
  }
}

/**
 * Aktifkan atau bypass equalizer hardware Android
 */
export async function setNativeEqualizerEnabled(enabled: boolean): Promise<boolean> {
  if (!isAndroidNative()) return false;
  try {
    const res = await NativeEqualizer.setEnabled({ enabled });
    return Boolean(res?.success);
  } catch (err) {
    console.warn("[NativeEqualizer] Gagal mengubah status equalizer:", err);
    return false;
  }
}

/**
 * Buka panel dialog equalizer sistem bawaan ponsel Android (Dolby Atmos, Xiaomi Sound, dsb.)
 */
export async function openSystemEqualizerPanel(): Promise<boolean> {
  if (!isAndroidNative()) return false;
  try {
    const res = await NativeEqualizer.openSystemEqualizer();
    return Boolean(res?.success);
  } catch (err) {
    console.warn("[NativeEqualizer] Gagal membuka panel sistem Android:", err);
    return false;
  }
}
