// Evaluasi kejujuran tab-capture: tersedia? diizinkan? Murni agar teruji.
// Catatan: capture audio tab HANYA setelah tombol eksplisit user, dan EQ tab
// tetap dinonaktifkan kecuali sesi capture benar-benar berjalan.

export interface CaptureEnv {
  tabCapture?: {
    getMediaStreamId: (opts: { targetTabId: number }) => Promise<string>;
  };
}

export interface CaptureCheck {
  available: boolean;
  reason: string;
  streamId?: string;
}

export async function checkTabCapture(env: CaptureEnv, tabId: number): Promise<CaptureCheck> {
  if (!env.tabCapture?.getMediaStreamId) {
    return { available: false, reason: "API tabCapture tak tersedia di browser ini." };
  }
  if (!Number.isInteger(tabId) || tabId < 0) {
    return { available: false, reason: "Tab tidak valid." };
  }
  try {
    const streamId = await env.tabCapture.getMediaStreamId({ targetTabId: tabId });
    if (!streamId) return { available: false, reason: "Stream capture kosong." };
    return { available: true, reason: "Capture tersedia (eksperimental).", streamId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/denied|permission|not allowed/i.test(msg)) {
      return { available: false, reason: "Capture ditolak: butuh tab audible + gestur pengguna." };
    }
    return { available: false, reason: `Capture gagal: ${msg}` };
  }
}
