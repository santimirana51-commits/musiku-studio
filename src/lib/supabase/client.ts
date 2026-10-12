import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Fallback dummy credentials agar tidak crash / throw error jika belum dikonfigurasi di hosting
    return createBrowserClient(
      "https://placeholder-anon.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy-anon-key-placeholder"
    );
  }
  return createBrowserClient(url, key);
}

