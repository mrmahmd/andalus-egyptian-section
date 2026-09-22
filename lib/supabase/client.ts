import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let publicBrowserClient: SupabaseClient | null = null;

function getPublicConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured. Add the public project URL and publishable key.");
  }

  return { url, publishableKey };
}

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const { url, publishableKey } = getPublicConfiguration();

  browserClient = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

/**
 * Public parent pages must never inherit a staff session from the same browser.
 * This client always uses the publishable key as an anonymous visitor and keeps
 * no auth state in local storage.
 */
export function getSupabasePublicClient() {
  if (publicBrowserClient) return publicBrowserClient;

  const { url, publishableKey } = getPublicConfiguration();
  publicBrowserClient = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return publicBrowserClient;
}
