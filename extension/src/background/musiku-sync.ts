// Sinkronisasi baca-saja playlist/favorit via Supabase REST proyek MusikKu.
//
// Keamanan: hanya anon key (publik) + JWT sesi user. TIDAK PERNAH password
// tersimpan (hanya dipakai sekali saat login) dan TIDAK PERNAH service-role.
// Sesi kedaluwarsa -> refresh sekali -> gagal = LOGOUT + error jujur.

export interface SyncSession {
  url: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export interface SyncDeps {
  fetchFn: typeof fetch;
  store: {
    get(keys: string | string[] | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
  };
}

const SESSION_KEY = "musiku-sync-session";

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export async function loadSession(deps: SyncDeps): Promise<SyncSession | null> {
  const got = await deps.store.get(SESSION_KEY);
  const s = got[SESSION_KEY] as SyncSession | undefined;
  if (!s || !s.accessToken || !s.url) return null;
  return s;
}

export async function login(
  deps: SyncDeps,
  opts: { url: string; anon: string; email: string; password: string }
): Promise<void> {
  const base = cleanUrl(opts.url);
  if (!/^https?:\/\//.test(base)) throw new Error("URL Supabase tidak valid (butuh http(s)).");
  if (!opts.anon) throw new Error("Anon key wajib diisi (kunci publik, bukan service-role).");
  if (!opts.email.includes("@") || opts.password.length === 0) throw new Error("Email/kata sandi tidak valid.");
  const res = await deps.fetchFn(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: opts.anon },
    body: JSON.stringify({ email: opts.email, password: opts.password }),
  });
  if (!res.ok) throw new Error("Login gagal. Periksa URL, anon key, email, dan kata sandi.");
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error("Respons auth tak lengkap.");
  const session: SyncSession = {
    url: base,
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? "",
    expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
  };
  await deps.store.set({ [SESSION_KEY]: session, "musiku-sync-meta": { url: base, anon: opts.anon } });
}

// Anon key tersimpan saat login (kunci publik, aman di ekstensi).
async function anonKey(deps: SyncDeps, base: string): Promise<string | null> {
  const got = await deps.store.get("musiku-sync-meta");
  const meta = got["musiku-sync-meta"] as { url?: string; anon?: string } | undefined;
  if (meta?.url === base && meta.anon) return meta.anon;
  return null;
}

async function refresh(deps: SyncDeps, s: SyncSession): Promise<SyncSession | null> {
  if (!s.refreshToken) return null;
  const meta = await anonKey(deps, s.url);
  try {
    const res = await deps.fetchFn(`${s.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: meta ?? "" },
      body: JSON.stringify({ refresh_token: s.refreshToken }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    const next: SyncSession = {
      ...s,
      accessToken: j.access_token,
      refreshToken: j.refresh_token ?? s.refreshToken,
      expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
    };
    await deps.store.set({ [SESSION_KEY]: next });
    return next;
  } catch {
    return null;
  }
}

export async function logout(deps: SyncDeps): Promise<void> {
  await deps.store.remove([SESSION_KEY]);
}

/** Fetch terautentikasi: refresh sekali saat 401, gagal = sesi kedaluwarsa. */
export async function authedFetch(deps: SyncDeps, path: string): Promise<Response> {
  let s = await loadSession(deps);
  if (!s) throw new Error("Belum login.");
  const meta = await anonKey(deps, s.url);
  const call = (token: string) =>
    deps.fetchFn(`${s!.url}/rest/v1/${path}`, {
      headers: { apikey: meta ?? "", Authorization: `Bearer ${token}` },
    });
  let res = await call(s.accessToken);
  if (res.status === 401) {
    const next = await refresh(deps, s);
    if (!next) {
      await logout(deps);
      throw new Error("Sesi kedaluwarsa. Login ulang.");
    }
    s = next;
    res = await call(s.accessToken);
  }
  return res;
}

function countFrom(res: Response): number | null {
  // Supabase: Prefer count=exact -> header Content-Range "0-0/N".
  const cr = res.headers.get("Content-Range") ?? res.headers.get("content-range");
  if (!cr) return null;
  const m = cr.match(/\/(\d+|\*)/);
  if (!m || m[1] === "*") return null;
  return Number(m[1]);
}

/** Hitung playlist & favorit milik user (baca-saja). null = belum login. */
export async function getCounts(deps: SyncDeps): Promise<{ playlists: number | null; favorites: number | null } | null> {
  const s = await loadSession(deps);
  if (!s) return null;
  const meta = await anonKey(deps, s.url);
  const headers = (t: string) => ({
    apikey: meta ?? "",
    Authorization: `Bearer ${t}`,
    Prefer: "count=exact",
    Range: "0-0",
  });
  const get = async (table: string, token: string) =>
    deps.fetchFn(`${s.url}/rest/v1/${table}?select=id`, { headers: headers(token) });
  let pl = await get("playlists", s.accessToken);
  let fv = await get("favorites", s.accessToken);
  if (pl.status === 401 || fv.status === 401) {
    const next = await refresh(deps, s);
    if (!next) {
      await logout(deps);
      throw new Error("Sesi kedaluwarsa. Login ulang.");
    }
    pl = await get("playlists", next.accessToken);
    fv = await get("favorites", next.accessToken);
  }
  return { playlists: countFrom(pl), favorites: countFrom(fv) };
}
