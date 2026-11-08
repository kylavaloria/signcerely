import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { serverEnv } from "./env";
import { publicKeyFromSecret } from "./invite-keys";
import { getProfile } from "./profile";
import { getSession } from "./session";
import { db } from "./supabase";

/**
 * Who may open a signing page:
 *  - someone who opened the invite link (its key is checked once, then
 *    remembered in a signed cookie for this browser), or
 *  - the signed-in person whose confirmed email the invite was sent to, or
 *    whose wallet already signed this slot, or
 *  - the document's sender (view only).
 */

const COOKIE = "iys_invites";
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
  isSender: boolean;
  wallet: string | null;
};

const SIGNER_COLS =
  "id, document_id, slot, invited_name, invited_email, invite_secret_enc, wallet_address, status, signature_image_path, signature_image_hash, signed_at, sign_tx_hash";
const DOC_COLS =
  "id, chain_doc_id, sender_wallet, title, summary, status, in_order, page_count, file_path, original_hash, final_file_path, final_hash, sent_at, completed_at, pending_final_hash, pending_final_path, pending_final_signer";

export async function getAccess(signerId: string): Promise<Access | null> {
  if (!/^[0-9a-f-]{36}$/i.test(signerId)) return null;
  const { data: signer } = await db().from("document_signers").select(SIGNER_COLS).eq("id", signerId).maybeSingle();
  if (!signer) return null;
  const { data: doc } = await db().from("documents").select(DOC_COLS).eq("id", signer.document_id).maybeSingle();
  if (!doc || doc.status === "draft") return null;

  const session = await getSession();
  const wallet = session?.wallet ?? null;
  const profile = wallet ? await getProfile(wallet) : null;
  const byLink = (await unlockedIds()).includes(signer.id);
  const byWallet = Boolean(wallet && signer.wallet_address === wallet);
  const isSender = Boolean(wallet && doc.sender_wallet === wallet);
  const sameEmail = Boolean(profile?.email && profile.email.toLowerCase() === signer.invited_email.toLowerCase());
  // A confirmed email counts; so does the sender's own (unconfirmed) email on their own document.
  const byEmail = sameEmail && Boolean(profile?.email_verified_at || isSender);
  const invited = byLink || byEmail || byWallet;
  if (!invited && !isSender) return { signer, doc, canSign: false, invited: false, isSender: false, wallet };
  return { signer, doc, canSign: invited && Boolean(wallet), invited, isSender, wallet };
}

/** Name/email to prefill "Finish your profile" from invites opened in this browser. */
export async function unlockedInvitePrefill(): Promise<{ name: string; email: string; invitedBy: string | null } | null> {
  const ids = await unlockedIds();
  if (!ids.length) return null;
  const { data } = await db()
    .from("document_signers")
    .select("invited_name, invited_email, documents(profiles(full_name))")
    .eq("id", ids[0])
    .maybeSingle();
  if (!data) return null;
  const d = data.documents as unknown as { profiles: { full_name: string } | null } | null;
  return { name: data.invited_name, email: data.invited_email, invitedBy: d?.profiles?.full_name ?? null };
}
