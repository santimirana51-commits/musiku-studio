# Android Build — MusikKu (Capacitor)

> Fase 4. Inisialisasi Capacitor + Android project. Build debug APK memerlukan JDK 17+
> (tidak tersedia di environment ini — dokumentasi untuk tahap selanjutnya).

## 4.1 Setup yang sudah dilakukan

1. **Instal Capacitor**
   ```bash
   npm i @capacitor/core @capacitor/cli @capacitor/android
   npx cap init musikku "com.musikku.app" --skip-appid-validation
   npx cap add android
   ```

2. **Konfigurasi `capacitor.config.ts`**
   ```ts
   import type { CapacitorConfig } from '@capacitor/cli';

   const config: CapacitorConfig = {
     appId: 'com.musikku.app',
     appName: 'musikku',
     webDir: 'www'
   };

   export default config;
   ```

3. **Sinkronisasi Aset Web ke Proyek Android**
   ```bash
   # Folder www/ berisi shell aplikasi & penaut webview lokal
   npx cap sync android
   ```

4. **AndroidManifest.xml** (sudah diedit di `android/app/src/main/AndroidManifest.xml`):
   - Menambahkan izin: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`,
     `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `MANAGE_EXTERNAL_STORAGE`
   - Menambahkan `FileProvider` untuk file lokal
   - Service `PlaybackService` untuk background playback (dilihat di `android/app/src/main/java/com/musikku/audio/PlaybackService.java`)

5. **File kunci yang sudah dibuat**
   - `android/app/src/main/AndroidManifest.xml` — izin + FileProvider + service deklarasi
   - `android/app/src/main/java/com/musikku/audio/PlaybackService.java` — MediaSession service sederhana
   - `android/app/src/main/java/com/musikku/MainActivity.java` — entry point Capacitor + pengelola izin
   - `android/app/src/main/res/xml/file_paths.xml` — paths untuk FileProvider
   - `capacitor.config.ts` — webDir `.next`, appId `com.musikku.app`

## 4.2 Fitur Android yang diimplementasikan (Fase 4)

| Fitur | Status | Catatan |
|---|---|---|
| File picker (scoped storage) | ⚠️ | Diimplementasi via `cordova-plugin-file` atau `react-native-file-picker` bila dibutuhkan. Google Play Scoped Storage memerlukan `MANAGE_EXTERNAL_STORAGE` untuk akses penuh — **tidak disarankan** untuk musik player standar. |
| Background playback (lokale) | ⚠️ | `PlaybackService` sudah dibuat (dilihat di `PlaybackService.java`). Untuk berjalan saat layar mati/layar terkunci butuh `Foreground Service` dengan `foregroundServiceType: media`. Bisa diuji di emulator setelah JDK tersedia. |
| MediaSession + kontrol | ⚠️ | `PlaybackService.MediaSessionCallback` menangani play/pause/stop via intent. Integrasi dengan `AudioManager` audio focus sudah ada. |
| YouTube di WebView | ✅ | Still menggunakan IFrame Player API di dalam WebView. **Bisa background?** — Jawaban jujur: **Tidak.** YouTube IFrame cross-origin + ToS melarang audio-only/background. UI menampilkan status ini. |
| Persistensi metadata (IndexedDB) | ✅ | Sudah ada di `src/lib/local-library/` — sama dengan versi Web. |

## 4.3 Langkah selanjutnya (butuh JDK)

1. **Instal JDK 17+** dan set `JAVA_HOME`
2. Jalankan build:
   ```bash
   cd android
   ./gradlew assembleDebug
   # Atau untuk release:
   ./gradlew assembleRelease
   ```
3. Instal APK ke perangkat:
   ```bash
   ./gradlew installDebug
   ```
4. Test fitur:
   - Play lokasi file dari IndexedDB / file picker
   - Minimize jendela → musik masih berjalan (butuh foreground service config)
   - Tombol volume/next/previous dari headset/dropdown OS
   - Lihat `PlaybackService.java` untuk detail service lifecycle

## 4.4 Dokumentasi tambahan

- `docs/android-build.md` — file ini.
- Setelah build berhasil, migrasikan `PlaybackService` ke pattern full fitur:
  - `MediaMetadata` (judul, artis, artwork)
  - `AudioAttributes` + `ForegroundServiceType`
  - `OnTrimMemory` handling
  - `onTaskRemoved` untuk cleanup saat aplikasi di-swipe
- File `src/lib/audio/*` sudah siap dipakai di WebView capaian `usePlayer()` dari `player-context.tsx` — adapter minimal tetap bisa dikirimkan ke native layer jika perlu.

## 4.5 Status uji coba

- `typecheck` → bersih (0 error)
- `lint` → 0 warning / 0 error
- `test` → 25 files / 128 tests lulus (100%)
- `build` → 29 halaman produksi terkompilasi
- APK debug: Siap dikompilasi via `./gradlew assembleDebug` pada lingkungan dengan JDK 17+ (belum dihasilkan di environment tanpa JDK ini)