// Content script injeksi on-demand (programmatic, BUKAN default semua situs).
// Hanya membaca/mengontrol elemen <audio>/<video> di tab yang dipilih user
// dan telah diberi izin host. Tanpa cookie, tanpa history, tanpa DOM lain.

(function () {
  const g = globalThis as unknown as { __musikuMediaInjected?: boolean };
  if (g.__musikuMediaInjected) return; // injeksi idempoten
  g.__musikuMediaInjected = true;

  try {
    document.documentElement.setAttribute("data-musiku-extension", "true");
    window.postMessage({ type: "MUSIKU_EXTENSION_READY", version: "0.1.0" }, "*");
  } catch {}

  function findMedia(): HTMLMediaElement | null {
    const els = Array.from(document.querySelectorAll("audio,video")).filter(
      (e): e is HTMLMediaElement => e instanceof HTMLMediaElement
    );
    return els.find((e) => !e.paused) ?? els[0] ?? null;
  }

  function report() {
    const m = findMedia();
    if (!m) return { hasMedia: false, paused: true, currentTime: 0, duration: NaN };
    return {
      hasMedia: true,
      paused: m.paused,
      currentTime: Number.isFinite(m.currentTime) ? m.currentTime : 0,
      duration: Number.isFinite(m.duration) ? m.duration : NaN,
    };
  }

  window.addEventListener("message", (ev: MessageEvent) => {
    if (ev.data?.type === "MUSIKU_PAGE_PING") {
      window.postMessage(
        {
          type: "MUSIKU_EXTENSION_PONG",
          version: "0.1.0",
          injected: true,
          hasMedia: !!findMedia(),
        },
        "*"
      );
    }
  });

  chrome.runtime.onMessage.addListener((raw: unknown, _sender, respond) => {
    const msg = raw as { type: string; cmd?: string; value?: number };
    if (msg.type === "MUSIKU_MEDIA_GET") {
      respond(report());
      return;
    }
    if (msg.type === "MUSIKU_MEDIA_CMD") {
      const m = findMedia();
      if (!m) {
        respond({ ok: false, note: "no-media" });
        return;
      }
      try {
        if (msg.cmd === "play") void m.play().catch(() => {});
        else if (msg.cmd === "pause") m.pause();
        else if (msg.cmd === "seek" && typeof msg.value === "number") m.currentTime = Math.max(0, msg.value);
        else {
          respond({ ok: false, note: "unsupported" });
          return;
        }
        respond({ ok: true, note: "ok" });
      } catch {
        respond({ ok: false, note: "unsupported" });
      }
    }
  });
})();
