"use server";

import { redirect } from "next/navigation";
import { sendCancelledEmails } from "@/lib/invites";
import { getSession } from "@/lib/session";
import {
  buildCancelTx,
  chainConfigFromEnv,
  checkSignedCancel,
  explainChainError,
  submitAndWait,
} from "@/lib/stellar/contract";
import { db } from "@/lib/supabase";

type Fail = { ok: false; error: string; needsFunds?: boolean };

async function pendingDocOfSender(documentId: string) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return null;
  const { data } = await db()
    .from("documents")
    .select("id, chain_doc_id, status, sender_wallet")
    .eq("id", documentId)
    .eq("sender_wallet", session.wallet)
    .maybeSingle();
  return data ? { doc: data, wallet: session.wallet } : null;
}

/** Step 1: build the contract `cancel` call for the sender's wallet to approve. */
export async function prepareCancel(documentId: string): Promise<{ ok: true; xdr: string } | Fail> {
  const found = await pendingDocOfSender(documentId);
  if (!found) return { ok: false, error: "Only the sender can cancel this document." };
  if (found.doc.status !== "pending") return { ok: false, error: "This document is no longer waiting for signatures." };
  try {
    return { ok: true, xdr: await buildCancelTx(chainConfigFromEnv(), { sender: found.wallet, chainDocId: found.doc.chain_doc_id }) };
  } catch (e) {
    console.error("prepareCancel failed", e);
    const why = explainChainError(e);
    if (why === "NO_ACCOUNT") {
      return { ok: false, needsFunds: true, error: "Your wallet isn’t on the test network yet. Add free test XLM to cover the fee." };
    }
    return { ok: false, error: why };
  }
}

/** Step 2: check and record the cancellation, then tell invited signers. */
export async function submitCancel(documentId: string, signedXdr: string, reason: string): Promise<{ ok: true } | Fail> {
  const found = await pendingDocOfSender(documentId);
  if (!found) return { ok: false, error: "Only the sender can cancel this document." };
  if (found.doc.status !== "pending") return { ok: false, error: "This document is no longer waiting for signatures." };
  const note = reason.trim().slice(0, 500);
  let hash: string;
  try {
    const c = chainConfigFromEnv();
    hash = (await submitAndWait(c, checkSignedCancel(c, signedXdr, { sender: found.wallet, chainDocId: found.doc.chain_doc_id }))).hash;
  } catch (e) {
    console.error("submitCancel failed", e);
    const msg = e instanceof Error ? e.message : "";
    return { ok: false, error: /doesn’t match|wasn’t signed|Still waiting|busy/.test(msg) ? msg : explainChainError(e) };
  }
  await db().from("documents").update({ status: "cancelled" }).eq("id", documentId).eq("status", "pending");
  await db().from("document_events").insert({
    document_id: documentId,
    kind: "cancelled",
    actor_wallet: found.wallet,
    tx_hash: hash,
    detail: note ? { reason: note } : {},
  });
  await sendCancelledEmails(documentId, note);
  return { ok: true };
}
