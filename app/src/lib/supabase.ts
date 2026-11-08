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

/** Turn a Supabase/PostgREST error into a real Error with a readable message. */
export function dbError(e: { message?: string; code?: string; details?: string | null; hint?: string | null }): Error {
  return new Error(`Database error ${e.code ?? ""}: ${e.message ?? "unknown"}${e.details ? ` — ${e.details}` : ""}${e.hint ? ` (${e.hint})` : ""}`);
}
