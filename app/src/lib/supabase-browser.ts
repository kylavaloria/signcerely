"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Browser client with the publishable key. Row Level Security blocks it from
 * reading anything; it's only used to send a file to a one-time signed
 * upload link the server created.
 */
export function browserStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set.");
  return createClient(url, key, { auth: { persistSession: false } }).storage;
}
