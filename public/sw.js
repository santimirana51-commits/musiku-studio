// MusikKu PWA Service Worker (App Shell & Offline Fallback)
//
// Prinsip Keamanan & Kejujuran (§D & §E):
// - Hanya menyimpan app shell (HTML dasar, CSS, ikon).
// - TIDAK PERNAH mencache audio stream YouTube atau signed URL Supabase Storage berumur pendek.
// - Blob audio lokal tetap berada di IndexedDB, bukan Service Worker Cache.

const CACHE_NAME = "musikku-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Jangan tangani selain GET
  if (req.method !== "GET") return;

  // Jangan cache API routes, YouTube, Supabase Storage, atau chrome-extension
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("youtube.com") ||
    url.hostname.includes("googlevideo.com") ||
    url.hostname.includes("supabase.co") ||
    url.protocol.startsWith("chrome-extension")
  ) {
    return;
  }

  // Permintaan halaman navigasi (HTML): Network first -> fallback ke offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match("/offline");
        return cachedOffline || (await cache.match("/")) || Response.error();
      })
    );
    return;
  }

  // Aset statis (_next/static, favicon, manifest): Cache first -> Network fallback
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        });
      })
    );
  }
});
