import "server-only";
import { redirect } from "next/navigation";
import { db } from "./supabase";
import { getSession } from "./session";

export type Profile = {
  wallet_address: string;
  full_name: string;
  email: string | null;
  email_verified_at: string | null;
};

export async function getProfile(wallet: string): Promise<Profile | null> {
  const { data, error } = await db()
    .from("profiles")
    .select("wallet_address, full_name, email, email_verified_at")
    .eq("wallet_address", wallet)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** For pages that need a signed-in user who has finished their profile. */
export async function requireUser(): Promise<Profile> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const profile = await getProfile(session.wallet);
  if (!profile) redirect("/welcome");
  return profile;
}

/**
 * Name and email the sender typed when inviting this person, if any. Used to
 * prefill "Finish your profile". Matches on email isn't possible yet (we
 * don't know it), so this looks for invites already linked to the wallet.
 */
export async function getInvitePrefill(
  wallet: string,
): Promise<{ name: string; email: string; invitedBy: string | null } | null> {
  const { data, error } = await db()
    .from("document_signers")
    .select("invited_name, invited_email, documents(sender_wallet, profiles(full_name))")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const doc = data.documents as unknown as { profiles: { full_name: string } | null } | null;
  return {
    name: data.invited_name,
    email: data.invited_email,
    invitedBy: doc?.profiles?.full_name ?? null,
  };
}
