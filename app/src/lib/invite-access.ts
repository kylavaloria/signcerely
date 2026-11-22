import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { serverEnv } from "./env";
import { publicKeyFromSecret } from "./invite-keys";
import { getProfile, type Profile } from "./profile";
import { getSession } from "./session";
import { decideAccess } from "./signer-identity";
import { db } from "./supabase";

/**
 * Who may open a signing page:
 *  - someone who opened the invite link (its key is checked once, then
 *    remembered in a signed cookie for this browser), or
 *  - the signed-in person whose confirmed email the invite was sent to, or
 *    whose wallet already signed this slot, or
 *  - the document's sender (view only).
 * Signing is narrower: the account must also be the invited person's (see signer-identity.ts).
 */

const COOKIE = "sc_invites";
const MAX_AGE = 60 * 60 * 24 * 30;
const key = () => new TextEncoder().encode(serverEnv("SESSION_SECRET"));

async function unlockedIds(): Promise<string[]> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return [];
  try {
    const { payload } = await jwtVerify(t, key(), { algorithms: ["HS256"] });
    return Array.isArray(payload.inv) ? (payload.inv as string[]) : [];
  } catch {
    return [];
  }
}

/** Check an invite link's key and remember it for this browser. */
export async function unlockWithKey(signerId: string, secretHex: string): Promise<boolean> {
  const { data } = await db().from("document_signers").select("invite_public_key").eq("id", signerId).maybeSingle();
  if (!data) return false;
  let pub: string;
  try {
    pub = publicKeyFromSecret(secretHex);
  } catch {
    return false;
  }
  if (pub !== data.invite_public_key) return false;
  const ids = [signerId, ...(await unlockedIds()).filter((i) => i !== signerId)].slice(0, 20);
  const token = await new SignJWT({ inv: ids })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return true;
}

export type SignerRow = {
  id: string;
  document_id: string;
  slot: number;
  invited_name: string;
  invited_email: string;
  invite_secret_enc: string;
  wallet_address: string | null;
  status: string;
  signature_image_path: string | null;
  signature_image_hash: string | null;
  signed_at: string | null;
  sign_tx_hash: string | null;
};

export type DocRow = {
  id: string;
  chain_doc_id: string;
  sender_wallet: string;
  title: string;
  summary: string | null;
  status: string;
  in_order: boolean;
  page_count: number;
  file_path: string;
  original_hash: string;
  final_file_path: string | null;
  final_hash: string | null;
  sent_at: string | null;
  completed_at: string | null;
  pending_final_hash: string | null;
  pending_final_path: string | null;
  pending_final_signer: string | null;
};

export type Access = {
  signer: SignerRow;
  doc: DocRow;
  /** May this visitor sign this slot (as opposed to only viewing)? */
  canSign: boolean;
  /** Has this visitor proven the invite (link key or confirmed email)? */
  invited: boolean;
  /** Signed in with the invite in hand, but as an account the invite wasn't meant for. */
  wrongAccount: boolean;
  isSender: boolean;
  wallet: string | null;
  /** The signed-in person's profile, if any (loaded here so pages don't fetch it again). */
  profile: Profile | null;
};

const SIGNER_COLS =
  "id, document_id, slot, invited_name, invited_email, invite_secret_enc, wallet_address, status, signature_image_path, signature_image_hash, signed_at, sign_tx_hash";
const DOC_COLS =
  "id, chain_doc_id, sender_wallet, title, summary, status, in_order, page_count, file_path, original_hash, final_file_path, final_hash, sent_at, completed_at, pending_final_hash, pending_final_path, pending_final_signer";

export async function getAccess(signerId: string): Promise<Access | null> {
  if (!/^[0-9a-f-]{36}$/i.test(signerId)) return null;
  const session = await getSession();
  const wallet = session?.wallet ?? null;
  // One round trip: the slot with its document, the visitor's profile and their unlocked invites together.
  const [{ data: row }, profile, unlocked] = await Promise.all([
    db().from("document_signers").select(`${SIGNER_COLS}, documents!inner(${DOC_COLS})`).eq("id", signerId).maybeSingle(),
    wallet ? getProfile(wallet) : Promise.resolve(null),
    unlockedIds(),
  ]);
  if (!row) return null;
  const { documents, ...signerCols } = row as unknown as SignerRow & { documents: DocRow };
  const signer = signerCols as SignerRow;
  const doc = documents;
  if (!doc || doc.status === "draft") return null;

  const isSender = Boolean(wallet && doc.sender_wallet === wallet);
  const { invited, canSign, wrongAccount } = decideAccess({
    wallet,
    slotWallet: signer.wallet_address,
    invitedEmail: signer.invited_email,
    profileEmail: profile?.email ?? null,
    emailConfirmed: Boolean(profile?.email_verified_at),
    isSender,
    byLink: unlocked.includes(signer.id),
  });
  if (!invited && !isSender) return { signer, doc, canSign: false, invited: false, wrongAccount: false, isSender: false, wallet, profile };
  return { signer, doc, canSign, invited, wrongAccount, isSender, wallet, profile };
}

/** First time the invited person opens their signing page: mark the slot "viewed" and log it once. */
export async function recordView(a: Access): Promise<void> {
  if (!a.invited || a.wrongAccount || a.signer.status !== "invited") return;
  const { data } = await db()
    .from("document_signers")
    .update({ status: "viewed", viewed_at: new Date().toISOString() })
    .eq("id", a.signer.id)
    .eq("status", "invited")
    .select("id");
  if (data?.length) await db().from("document_events").insert({ document_id: a.doc.id, kind: "viewed", signer_id: a.signer.id, actor_wallet: a.wallet });
}

/**
 * Name/email to prefill "Finish your profile", only for the invite the person is
 * signing in to answer (`/sign/<id>`), and only if its link was opened in this browser.
 * The browser remembers opened invites for 30 days, so without this check a later,
 * unrelated sign-up on the same browser would show someone else's invite.
 */
export async function unlockedInvitePrefill(
  signerId: string | null,
): Promise<{ name: string; email: string; invitedBy: string | null } | null> {
  if (!signerId || !(await unlockedIds()).includes(signerId)) return null;
  const { data } = await db()
    .from("document_signers")
    .select("invited_name, invited_email, documents(profiles(full_name))")
    .eq("id", signerId)
    .maybeSingle();
  if (!data) return null;
  const d = data.documents as unknown as { profiles: { full_name: string } | null } | null;
  return { name: data.invited_name, email: data.invited_email, invitedBy: d?.profiles?.full_name ?? null };
}
