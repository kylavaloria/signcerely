import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "./env";

let client: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the secret key. Row Level Security
 * blocks the public key entirely, so every read and write goes through here,
 * after the app has checked who the caller is.
 */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(serverEnv("SUPABASE_URL"), serverEnv("SUPABASE_SECRET_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
