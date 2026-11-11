"use server";

import { redirect } from "next/navigation";
import { getDraftFields, getDraftSigners, getOwnedDraft } from "@/lib/documents";
import { chainDocId } from "@/lib/invite-keys";
import { inviteSigners } from "@/lib/invites";
import { getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";
import {
  buildCreateTx,
  chainConfigFromEnv,
  checkSignedCreate,
  explainChainError,
  fundWithFriendbot,
  submitAndWait,
  type CreateArgs,
} from "@/lib/stellar/contract";
import { db } from "@/lib/supabase";

type Fail = { ok: false; error: string; needsFunds?: boolean };

async function createArgsFor(documentId: string, wallet: string): Promise<CreateArgs | Fail> {
  const doc = await getOwnedDraft(documentId, wallet);
  const [signers, fields] = await Promise.all([getDraftSigners(doc.id), getDraftFields(doc.id)]);
  if (signers.length < 2) return { ok: false, error: "Add at least 2 signers first." };
  if (fields.length > 0) {
    const missing = signers.filter((s) => !fields.some((f) => f.signer_id === s.id));
    if (missing.length) return { ok: false, error: `Add a signature box for ${missing.map((s) => s.invited_name).join(", ")}.` };
  }
  const { data: keys, error } = await db()
    .from("document_signers")
    .select("slot, invite_public_key")
    .eq("document_id", doc.id)
    .order("slot");
  if (error || !keys) return { ok: false, error: "Couldn’t load the signers. Please try again." };
  return {
    sender: wallet,
    chainDocId: doc.chain_doc_id ?? chainDocId(doc.id),
    originalHash: doc.original_hash!,
    inviteKeys: keys.map((k) => k.invite_public_key),
    inOrder: doc.in_order,
  };
}

/** Step 1: build the `create` transaction for the sender's wallet to approve. */
export async function prepareSend(documentId: string): Promise<{ ok: true; xdr: string } | Fail> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const c = chainConfigFromEnv();
  if (!c.contractId) return { ok: false, error: "The app isn’t connected to a contract yet (NEXT_PUBLIC_CONTRACT_ID)." };

  const args = await createArgsFor(documentId, session.wallet);
  if ("ok" in args) return args;
  try {
    return { ok: true, xdr: await buildCreateTx(c, args) };
  } catch (e) {
    console.error("prepareSend failed", e);
    const why = explainChainError(e);
    if (why === "NO_ACCOUNT") {
      return { ok: false, needsFunds: true, error: "Your wallet isn’t on the test network yet. Add free test XLM to cover the fee." };
    }
    return { ok: false, error: why };
  }
}

/** Testnet only: top up the signed-in wallet with free test XLM. */
export async function addTestXlm(): Promise<{ ok: true } | Fail> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  try {
    await fundWithFriendbot(chainConfigFromEnv(), session.wallet);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn’t add test XLM." };
  }
}

/** Step 2: check the wallet-signed transaction, record it on Stellar, then invite people. */
export async function submitSend(
  documentId: string,
  signedXdr: string,
): Promise<{ ok: true; next: string; emailFailed: string[] } | Fail> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const c = chainConfigFromEnv();
  const args = await createArgsFor(documentId, session.wallet);
  if ("ok" in args) return args;

  let hash: string;
  try {
    const tx = checkSignedCreate(c, signedXdr, args);
    hash = (await submitAndWait(c, tx)).hash;
  } catch (e) {
    console.error("submitSend failed", e);
    const msg = e instanceof Error ? e.message : "";
    return { ok: false, error: /doesn’t match|wasn’t signed|Still waiting|busy/.test(msg) ? msg : explainChainError(e) };
  }

  const now = new Date().toISOString();
  const { data: updated } = await db()
    .from("documents")
    .update({ status: "pending", sent_at: now, create_tx_hash: hash })
    .eq("id", documentId)
    .eq("status", "draft")
    .select("id, in_order");
  if (!updated?.length) return { ok: true, next: `/documents/${documentId}`, emailFailed: [] };

  await db().from("document_events").insert([
    { document_id: documentId, kind: "created", actor_wallet: session.wallet, tx_hash: hash },
    { document_id: documentId, kind: "sent", actor_wallet: session.wallet },
  ]);

  const profile = await getProfile(session.wallet);
  const { data: all } = await db().from("document_signers").select("slot").eq("document_id", documentId);
  const slots = updated[0].in_order ? [0] : (all ?? []).map((s) => s.slot);
  const { failed } = await inviteSigners(documentId, slots, {
    senderName: profile?.full_name ?? "Someone",
    senderWallet: session.wallet,
    senderEmail: profile?.email ?? null,
  });
  return { ok: true, next: `/documents/${documentId}?sent=1`, emailFailed: failed };
}
