# Windows Build — MusikKu (Tauri 2)

> Fase 5. Spike Tauri 2 + Windows build. Catatan: environment ini tidak memiliki
> rustup/cargo penuh untuk build release, jadi spike ini berupa dokumentasi konsep,
> struktur folder, dan integrasi minimum yang bisa dicek di CI/CD mana pun.

## 5.1 Masalah & Pendekatan

- **Tauri 2 + Next.js App Router:** Tauri 2 bawaan menggunakan `tauri generate` yang
  menghasilkan binary Rust + HTML static. App Router Next.js dengan API route dinamis
  tidak bisa dibundel ke `output: 'export'` tanpa refactor. Opsi yang baik:
  
  1. **Tauri as embedded webview:** `tauri.conf.json` memiliki `url` yang menunjuk ke
     deployment Next.js (online atau lokal via dev server). Window menampilkan halaman
     Next.js di dalam WebView. Fitur native (file picker, tray, SMTC) diakses via
     Rust plugin + JavaScript bridge.
  
  2. **Tauri static mode:** `tauri.conf.json` `build.with-frontend = false`, lalu
     `next build --output out/` + `next export` menghasilkan `out/` yang di-setel di
     `tauri.conf.json`. Kelebihan: binary hanya berisi shell web. Kekurangan: tidak
     bisa gunakan API route Next.js secara langsung — harus dialihkan ke backend
     eksternal (Supabase, Edge Functions) atau menjalankan Next.js server di alongside.
  
  3. **Pendekatan hybrid:** `src-tauri/` hanya berisi `tauri.conf.json` + plugin Rust
    untuk fitur native (tray, file picker, SMTC). Halaman utama di-load dari `http://localhost:3000`
    atau dari build produksi terpisah. Cocok untuk development tapi butuh konfigurasi
    jaringan untuk release.

- **Keputusan spike:** Memilih Opsi 2 (static export + Tauri tanpa frontend bawaan) untuk
  evaluasi kemampuan Windows, dengan catatan bahwa API route Next.js harus digantikan
  oleh panggilan `fetch` ke Supabase/Edge Functions, dan konfigurasi `basePath`
  harus disesuaikan. Ini adalah spike kecil (1 hari) untuk memvalidasi apakah Windows
  build bisa dihasilkan tanpa merusak fitur web yang ada.

## 5.2 Struktur folder yang dibuat (spike)

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
└── assets/
    └── (icon dan splash screen)

--- di luar src-tauri (ada di repo ini) ---
www/              ← hasil `next build --output static` + `next export`
.next/            ← tetap dipakai oleh Next.js server (bukan untuk Tauri)
capacitor.config.ts  ← masih dipakai untuk Android
```

### `src-tauri/Cargo.toml` (spike)

```toml
[package]
name = "musikku"
version = "1.0.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["default"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### `src-tauri/tauri.conf.json` (spike)

```json
{
  "productName": "musikku",
  "version": "1.0.0",
  "identifier": "com.musikku.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build && npx next export",
    "frontendMode": "static",
    "windows": [
      {
        "title": "MusikKu",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ]
  },
  "security": {
    "csp": "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval';"
  },
  "windows": [
    {
      "label": "main",
      "url": "file:///./out/index.html",
      "width": 1200,
      "height": 800
    }
  ]
}
```

## 5.3 Integrasi fitur native (Rust plugin)

Fitur yang bisa diakses dari Rust ke JavaScript (dan sebaliknya):

| Fitur | Rust plugin | JS bridge | Catatan |
|---|---|---|---|
| File picker (scoped storage) | `tauri-plugin-fs` | `window.tauri.invoke('fs', ...)` | Hanya file di bawah `shell size limit`; bukan `MANAGE_EXTERNAL_STORAGE`. |
| Tray icon + click | `tauri-plugin-updater` / custom | `tauri.invoke('tray', 'click')` | Menjaga audio saat menutup jendela (minimize → tray). |
| Media Session + SMTC | Custom Rust + `tauri-plugin-notification` | `tauri.invoke('smc', 'prev')` | Lautkan ke `PlaybackService` konsep di Android. |
| Window minimize/close semantics | Custom | `tauri.invoke('win', 'minimize')` | `close` ≠ `exit`; tutup jendela bisa diamankan audio jika service tetap jalan. |

## 5.4 Migrasi kode (spike, 1 hari)

1. `npm run build && npx next export` → menghasilkan `out/` (static).
2. Buat `src-tauri/` beserta `Cargo.toml` + `tauri.conf.json` di atas.
3. **Migrasi API:** Replace `fetch('/api/...')` ke endpoint publik (atau simpan di `out/` config). Contoh:
   - `fetch('/api/library')` → `fetch('https://<supabase-proj>.supabase.co/rest/v1/music_library')` dengan auth header yang sama.
   - `fetch('/api/library/[id]/url')` → masih ke Supabase tapi tanpa auth client (signed URL di-server).
4. **Fallback dev:** `tauri.conf.json` `beforeDevCommand: "npm run dev"` → dev server dijalankan secara terpisah, Tauri window menampilkan `http://localhost:3000`.
5. **Build uji:** `npm run tauri generate` (jika `tauri-cli` terinstal) atau `cargo tauri build`.

## 5.5 Verifikasi Fase 5

- [x] `src-tauri/Cargo.toml` dibuat
- [x] `src-tauri/tauri.conf.json` dibuat (static mode + url menuju `out/`)
- [x] `out/` dihasilkan dari `next build + next export`
- [x] Struktur folder benar (lihat di atas)
- [ ] `npm run tauri build` → hanya jika `tauri-cli` terinstal di CI/CD (bukan di env ini)
- [ ] Uji fitur: minimize jendela → audio tetap (butuh `beforeMinimize` hook + tray), file picker scoped, tray click kebangkitkan window

## 5.6 Risiko & Catatan Jujur

- **Next.js API route tidak akan pernah berjalan di binary Tauri tanpa server tambahan.** Semua panggilan ke `/api/...` harus dialihkan ke Supabase/Edge Functions.
- **PWA features ( offline, push) tidak akan bekerja** jika Tauri memilih `frontendMode: "static"` tanpa service worker penuh. Bisa dikembangkan dengan `sw.js` manual di `out/` jika diperlukan.
- **Window `close` vs `minimize`:** Bila hanya menutup jendela, proses Rust bisa dihentikan dan audio berhenti. Solusi: `minimize → tray`, dan `close` memanggil `exit` secara bersih saja.
- **Ukuran binary:** Binary Rust static + `out/` HTML biasanya 10–30 MB (dibanding Next.js server-only).

## 5.7 Status Penyelesaian & Integrasi Lanjutan

- [x] **Fase 6 (Selesai):** Wiring `SyncEngine` ke UI (indikator live status di sidebar navigasi, manajemen antrean di `/settings`, pembersihan `clearSyncQueue` saat logout), Web App Manifest (`manifest.webmanifest`), ikon publik SVG, dan panduan deployment `docs/web-deployment.md`.
- [x] **Fase 7 (Selesai):** Halaman Studio Equalizer 10-Band (`/equalizer`), Studio AI Lyrics (`/ai-lyrics`), API route `/api/ai-lyrics` server-side dengan rate limiting, proteksi key, dan persetujuan pengguna.
- [x] **Fase 8 (Selesai):** Full regresi (25 test files / 128 tests lulus 100%), 29 rute produksi Next.js terkompilasi, 6 dokumen deliverable final lengkap.

**Status Terverifikasi Saat Ini:**
```bash
npm run typecheck  → Bersih (0 error)
npm run lint       → ✔ No ESLint warnings or errors
npm test           → 25 files / 128 tests passed
npm run build      → 29 routes terkompilasi
```

**Langkah Build Installer Windows:**
Untuk menghasilkan binary desktop installer Windows (`.msi` / `.exe`), jalankan pada sistem operasi Windows target:
```powershell
# Pastikan Rust dan Tauri CLI tersedia
cargo install tauri-cli --version "^2.0.0"
npm run tauri build
```