// Sinkronisasi baca-saja playlist/favorit via Supabase REST proyek MusikKu.
//
// Keamanan: hanya anon key (publik) + JWT sesi user. TIDAK PERNAH password
// tersimpan (hanya dipakai sekali saat login) dan TIDAK PERNAH service-role.
// Sesi kedaluwarsa -> refresh sekali -> gagal = LOGOUT + error jujur.
const SESSION_KEY = "musiku-sync-session";
function cleanUrl(url) {
    return url.trim().replace(/\/+$/, "");
}
export async function loadSession(deps) {
    const got = await deps.store.get(SESSION_KEY);
    const s = got[SESSION_KEY];
    if (!s || !s.accessToken || !s.url)
        return null;
    return s;
}
export async function login(deps, opts) {
    const base = cleanUrl(opts.url);
    if (!/^https?:\/\//.test(base))
        throw new Error("URL Supabase tidak valid (butuh http(s)).");
    if (!opts.anon)
        throw new Error("Anon key wajib diisi (kunci publik, bukan service-role).");
    if (!opts.email.includes("@") || opts.password.length === 0)
        throw new Error("Email/kata sandi tidak valid.");
    const res = await deps.fetchFn(`${base}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: opts.anon },
        body: JSON.stringify({ email: opts.email, password: opts.password }),
    });
    if (!res.ok)
        throw new Error("Login gagal. Periksa URL, anon key, email, dan kata sandi.");
    const j = (await res.json());
    if (!j.access_token)
        throw new Error("Respons auth tak lengkap.");
    const session = {
        url: base,
        accessToken: j.access_token,
        refreshToken: j.refresh_token ?? "",
        expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
    };
    await deps.store.set({ [SESSION_KEY]: session, "musiku-sync-meta": { url: base, anon: opts.anon } });
}
// Anon key tersimpan saat login (kunci publik, aman di ekstensi).
async function anonKey(deps, base) {
    const got = await deps.store.get("musiku-sync-meta");
    const meta = got["musiku-sync-meta"];
    if (meta?.url === base && meta.anon)
        return meta.anon;
    return null;
}
async function refresh(deps, s) {
    if (!s.refreshToken)
        return null;
    const meta = await anonKey(deps, s.url);
    try {
        const res = await deps.fetchFn(`${s.url}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: meta ?? "" },
            body: JSON.stringify({ refresh_token: s.refreshToken }),
        });
        if (!res.ok)
            return null;
        const j = (await res.json());
        if (!j.access_token)
            return null;
        const next = {
            ...s,
            accessToken: j.access_token,
            refreshToken: j.refresh_token ?? s.refreshToken,
            expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
        };
        await deps.store.set({ [SESSION_KEY]: next });
        return next;
    }
    catch {
        return null;
    }
}
export async function logout(deps) {
    await deps.store.remove([SESSION_KEY]);
}
/** Fetch terautentikasi: refresh sekali saat 401, gagal = sesi kedaluwarsa. */
export async function authedFetch(deps, path) {
    let s = await loadSession(deps);
    if (!s)
        throw new Error("Belum login.");
    const meta = await anonKey(deps, s.url);
    const call = (token) => deps.fetchFn(`${s.url}/rest/v1/${path}`, {
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
function countFrom(res) {
    // Supabase: Prefer count=exact -> header Content-Range "0-0/N".
    const cr = res.headers.get("Content-Range") ?? res.headers.get("content-range");
    if (!cr)
        return null;
    const m = cr.match(/\/(\d+|\*)/);
    if (!m || m[1] === "*")
        return null;
    return Number(m[1]);
}
/** Hitung playlist & favorit milik user (baca-saja). null = belum login. */
export async function getCounts(deps) {
    const s = await loadSession(deps);
    if (!s)
        return null;
    const meta = await anonKey(deps, s.url);
    const headers = (t) => ({
        apikey: meta ?? "",
        Authorization: `Bearer ${t}`,
        Prefer: "count=exact",
        Range: "0-0",
    });
    const get = async (table, token) => deps.fetchFn(`${s.url}/rest/v1/${table}?select=id`, { headers: headers(token) });
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
