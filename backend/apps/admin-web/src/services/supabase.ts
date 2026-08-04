import { createClient } from "@supabase/supabase-js";

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
}

if (!supabasePublishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local",
  );
}

/**
 * Browser-safe Supabase client.
 *
 * This uses the publishable key, so authorization must be enforced with
 * Supabase Row Level Security policies. Never put a service-role key here.
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

