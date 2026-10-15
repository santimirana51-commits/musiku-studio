package com.musikku.app;

import android.content.Context;
import android.content.Intent;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

/**
 * Jembatan Native Equalizer untuk Android.
 * Mengontrol Equalizer & BassBoost hardware pada Audio Session 0 (Global Mix),
 * sehingga seluruh pemutaran audio (termasuk YouTube iframe di WebView)
 * terfilter secara langsung tanpa bisa diblokir oleh YouTube.
 */
@CapacitorPlugin(name = "NativeEqualizer")
public class NativeEqualizerPlugin extends Plugin {
    private static final String TAG = "NativeEqualizer";
    private Equalizer equalizer;
    private BassBoost bassBoost;
    private boolean isInitialized = false;

    @Override
    public void load() {
        super.load();
        initEffects();
    }

    private synchronized void initEffects() {
        if (isInitialized && equalizer != null) return;
        try {
            // Target output mix session 0 (mencakup seluruh output audio WebView & YouTube)
            equalizer = new Equalizer(1000, 0);
            equalizer.setEnabled(true);
            try {
                bassBoost = new BassBoost(1000, 0);
                bassBoost.setEnabled(true);
            } catch (Exception ex) {
                Log.w(TAG, "BassBoost hardware tidak didukung di perangkat ini", ex);
            }
            isInitialized = true;
            Log.i(TAG, "Native Equalizer berhasil diinisialisasi pada Audio Session 0");
        } catch (Exception e) {
            Log.w(TAG, "Inisialisasi Equalizer session 0 tertunda: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        initEffects();
        JSObject ret = new JSObject();
        boolean available = (equalizer != null);
        ret.put("available", available);
        if (available) {
            try {
                short numBands = equalizer.getNumberOfBands();
                ret.put("numBands", (int) numBands);
                short[] range = equalizer.getBandRange();
                ret.put("minMillibels", range[0]);
                ret.put("maxMillibels", range[1]);

                JSArray freqs = new JSArray();
                for (short b = 0; b < numBands; b++) {
                    freqs.put(equalizer.getCenterFreq(b) / 1000); // dalam Hz
                }
                ret.put("centerFreqs", freqs);
            } catch (Exception e) {
                Log.w(TAG, "Gagal membaca detail band equalizer", e);
            }
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        initEffects();
        boolean enabled = call.getBoolean("enabled", true);
        if (equalizer != null) {
            try {
                equalizer.setEnabled(enabled);
                if (bassBoost != null) {
                    bassBoost.setEnabled(enabled);
                }
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("enabled", enabled);
                call.resolve(ret);
                return;
            } catch (Exception e) {
                Log.e(TAG, "Gagal mengubah status aktif equalizer", e);
                call.reject("Gagal mengubah status: " + e.getMessage());
                return;
            }
        }
        call.reject("Equalizer hardware belum tersedia.");
    }

    @PluginMethod
    public void setGains(PluginCall call) {
        initEffects();
        if (equalizer == null) {
            call.reject("Equalizer hardware tidak tersedia.");
            return;
        }

        JSArray gainsArray = call.getArray("gains");
        if (gainsArray == null) {
            call.reject("Parameter gains (array dB) dibutuhkan.");
            return;
        }

        try {
            short numBands = equalizer.getNumberOfBands();
            short[] range = equalizer.getBandRange();
            short minMb = range[0];
            short maxMb = range[1];

            List<Double> inputGains = new ArrayList<>();
            for (int i = 0; i < gainsArray.length(); i++) {
                inputGains.add(gainsArray.getDouble(i));
            }

            // Standar frekuensi antarmuka MusikKu (10-Band atau 5-Band)
            int[] uiFreqs = new int[]{32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000};
            if (inputGains.size() == 5) {
                uiFreqs = new int[]{60, 230, 910, 4000, 14000};
            }

            // Pemetaan frekuensi UI ke hardware band ponsel terdekat
            for (short b = 0; b < numBands; b++) {
                int nativeCenterHz = equalizer.getCenterFreq(b) / 1000;

                int bestIdx = 0;
                int minDiff = Integer.MAX_VALUE;
                for (int u = 0; u < uiFreqs.length && u < inputGains.size(); u++) {
                    int diff = Math.abs(uiFreqs[u] - nativeCenterHz);
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestIdx = u;
                    }
                }

                double targetGainDb = inputGains.get(bestIdx);
                short millibels = (short) Math.round(targetGainDb * 100.0);
                if (millibels < minMb) millibels = minMb;
                if (millibels > maxMb) millibels = maxMb;

                equalizer.setBandLevel(b, millibels);
            }

            // Sinkronkan penguatan bass frekuensi rendah ke BassBoost hardware
            if (bassBoost != null && !inputGains.isEmpty()) {
                double bassGain = inputGains.get(0);
                if (inputGains.size() > 1) {
                    bassGain = Math.max(bassGain, inputGains.get(1));
                }
                if (bassGain > 0) {
                    short strength = (short) Math.min(1000, Math.round((bassGain / 12.0) * 1000.0));
                    bassBoost.setStrength(strength);
                } else {
                    bassBoost.setStrength((short) 0);
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Gagal menerapkan gain equalizer", e);
            call.reject("Gagal menerapkan gain: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openSystemEqualizer(PluginCall call) {
        Context context = getContext();
        try {
            Intent intent = new Intent(AudioEffect.ACTION_DISPLAY_AUDIO_EFFECT_CONTROL_PANEL);
            intent.putExtra(AudioEffect.EXTRA_PACKAGE_NAME, context.getPackageName());
            intent.putExtra(AudioEffect.EXTRA_CONTENT_TYPE, AudioEffect.CONTENT_TYPE_MUSIC);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (intent.resolveActivity(context.getPackageManager()) != null) {
                context.startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } else {
                call.reject("Panel equalizer sistem tidak didukung di perangkat ini.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Gagal membuka panel equalizer sistem", e);
            call.reject("Tidak dapat membuka panel: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (equalizer != null) {
            try {
                equalizer.release();
            } catch (Exception ignored) {}
            equalizer = null;
        }
        if (bassBoost != null) {
            try {
                bassBoost.release();
            } catch (Exception ignored) {}
            bassBoost = null;
        }
    }
}
