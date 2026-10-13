import { createBrowserClient } from "@supabase/ssr";

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

// Helper lazy singleton
export function createClient() {
  if (clientInstance) return clientInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    const fallback = createBrowserClient(
      "https://placeholder-anon.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy-anon-key-placeholder"
    );
    clientInstance = fallback;
    return fallback;
  }

  const real = createBrowserClient(url, key);
  clientInstance = real;
  return real;
}

