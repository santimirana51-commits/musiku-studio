"use client";

import { useEffect } from "react";

/**
 * Mendaftarkan Service Worker PWA di peramban saat environment mendukung.
 */
export function PwaRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Service worker terdaftar
        })
        .catch(() => {
          // Abaikan kegagalan registrasi tanpa mengganggu user
        });
    }
  }, []);

  return null;
}
