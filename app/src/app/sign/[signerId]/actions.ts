"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { DOCS_BUCKET } from "@/lib/documents";
import { appUrl } from "@/lib/email";
import { buildFinalPdf, type FinalSigner } from "@/lib/final-pdf";
import { getAccess, unlockWithKey, type Access } from "@/lib/invite-access";
import { decryptSecret, signWithInvite } from "@/lib/invite-keys";
import { inviteSigners, sendCompletedEmails, sendDeclinedEmail } from "@/lib/invites";
import { getProfile } from "@/lib/profile";
import {
  buildDeclineTx,
  buildSignTx,
  chainConfigFromEnv,
  checkSignedDecline,
  checkSignedSign,
  explainChainError,
  inviteMessage,
  submitAndWait,
  type SignArgs,
} from "@/lib/stellar/contract";
import { db } from "@/lib/supabase";

const SIG_BUCKET = "signatures";
const MAX_SIG_BYTES = 1024 * 1024;
const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

type Fail = { ok: false; error: string; needsFunds?: boolean };

export async function unlockInvite(signerId: string, secretHex: string): Promise<{ ok: boolean }> {
  if (!/^[0-9a-f]{64}$/.test(secretHex)) return { ok: false };
  return { ok: await unlockWithKey(signerId, secretHex) };
}

/** Everything that must be true before this visitor can sign this slot. */
async function readyToSign(signerId: string): Promise<{ a: Access; wallet: string } | Fail> {
  const a = await getAccess(signerId);
  if (!a) return { ok: false, error: "This invite doesn’t exist." };
  if (!a.wallet) redirect(`/sign-in?next=/sign/${signerId}`);
  if (!a.canSign) return { ok: false, error: "Open this page from your invite email to sign." };
  if (a.doc.status !== "pending") return { ok: false, error: "This document is no longer waiting for signatures." };
  if (a.signer.status === "signed") return { ok: false, error: "You’ve already signed this document." };
  if (a.signer.wallet_address && a.signer.wallet_address !== a.wallet) {
    return { ok: false, error: "This spot is linked to a different wallet. Switch to that wallet in Varial." };
  }
  const { data: others } = await db()
    .from("document_signers")
    .select("id, slot, status, wallet_address")
    .eq("document_id", a.doc.id);
  if (others?.some((o) => o.id !== signerId && o.wallet_address === a.wallet && o.status === "signed")) {
    return { ok: false, error: "This wallet already signed this document for someone else. Use a different wallet." };
  }
  if (a.doc.in_order && others?.some((o) => o.slot < a.signer.slot && o.status !== "signed")) {
    return { ok: false, error: "It isn’t your turn yet. We’ll email you when it is." };
  }
  return { a, wallet: a.wallet };
}

async function isLastSigner(documentId: string, signerId: string): Promise<boolean> {
  const { data } = await db().from("document_signers").select("id, status").eq("document_id", documentId);
  return Boolean(data && data.filter((s) => s.id !== signerId).every((s) => s.status === "signed"));
}

async function download(bucket: string, path: string): Promise<Uint8Array> {
  const { data, error } = await db().storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Couldn’t read ${path}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Build the final signed copy for the last signer, store it as pending, return its fingerprint. */
async function prepareFinalCopy(a: Access, wallet: string, myImage: Uint8Array, myName: string, myEmail: string): Promise<string> {
  const [{ data: signers }, { data: fields }] = await Promise.all([
    db()
      .from("document_signers")
      .select("id, slot, invited_name, invited_email, wallet_address, signed_at, signature_image_path, status")
      .eq("document_id", a.doc.id)
      .order("slot"),
    db().from("signature_fields").select("signer_id, page, x, y, width, height").eq("document_id", a.doc.id),
  ]);
  const wallets = (signers ?? []).map((s) => s.wallet_address).filter(Boolean) as string[];
  const { data: profiles } = wallets.length
    ? await db().from("profiles").select("wallet_address, full_name, email").in("wallet_address", wallets)
    : { data: [] };
  const final: FinalSigner[] = [];
  for (const s of signers ?? []) {
    if (s.id === a.signer.id) {
      final.push({ id: s.id, name: myName, email: myEmail, wallet, signedAt: new Date(), imagePng: myImage });
      continue;
    }
    if (s.status !== "signed" || !s.signature_image_path || !s.wallet_address) throw new Error("Someone else hasn’t signed yet.");
    const p = profiles?.find((x) => x.wallet_address === s.wallet_address);
    final.push({
      id: s.id,
      name: p?.full_name ?? s.invited_name,
      email: p?.email ?? s.invited_email,
      wallet: s.wallet_address,
      signedAt: new Date(s.signed_at!),
      imagePng: await download(SIG_BUCKET, s.signature_image_path),
    });
  }
  const bytes = await buildFinalPdf({
    original: await download(DOCS_BUCKET, a.doc.file_path),
    title: a.doc.title,
    originalHash: a.doc.original_hash,
    documentRef: a.doc.chain_doc_id,
    verifyUrl: `${await appUrl()}/v/${a.doc.chain_doc_id}`,
    signers: final,
    fields: (fields ?? []).map((f) => ({
      signerId: f.signer_id,
      page: f.page,
      x: Number(f.x),
      y: Number(f.y),
      width: Number(f.width),
      height: Number(f.height),
    })),
  });
  const hash = sha256(bytes);
  const path = `${a.doc.id}/signed.pdf`;
  const { error } = await db()
    .storage.from(DOCS_BUCKET)
    .upload(path, new Blob([Buffer.from(bytes)], { type: "application/pdf" }), { upsert: true, contentType: "application/pdf" });
  if (error) throw new Error("Couldn’t save the signed copy.");
  await db()
    .from("documents")
    .update({ pending_final_hash: hash, pending_final_path: path, pending_final_signer: a.signer.id })
    .eq("id", a.doc.id);
  return hash;
}

async function signArgsFor(a: Access, wallet: string, imageHash: string, finalHash: string | null): Promise<SignArgs> {
  const c = chainConfigFromEnv();
  const msg = await inviteMessage(c, a.doc.chain_doc_id, a.signer.slot, wallet);
  return {
    signer: wallet,
    chainDocId: a.doc.chain_doc_id,
    slot: a.signer.slot,
    inviteProof: signWithInvite(decryptSecret(a.signer.invite_secret_enc), msg),
    imageHash,
    finalHash,
  };
}

/**
 * Step 1: store the signature image (and, for the last signer, the final
 * signed copy), then build the `sign` transaction for the wallet to approve.
 */
export async function prepareSign(
  signerId: string,
  input: { pngBase64: string; kind: "drawn" | "uploaded"; saveToProfile: boolean },
): Promise<{ ok: true; xdr: string; last: boolean } | Fail> {
  const ready = await readyToSign(signerId);
  if ("ok" in ready) return ready;
  const { a, wallet } = ready;

  const png = Buffer.from(input.pngBase64, "base64");
  if (png.length === 0 || png.length > MAX_SIG_BYTES) return { ok: false, error: "That signature image is too large." };
  if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return { ok: false, error: "The signature must be a PNG image." };
  const imageHash = sha256(png);

  const sigPath = `docs/${a.doc.id}/${a.signer.id}.png`;
  const up = await db()
    .storage.from(SIG_BUCKET)
    .upload(sigPath, new Blob([png], { type: "image/png" }), { upsert: true, contentType: "image/png" });
  if (up.error) return { ok: false, error: "Couldn’t save your signature. Please try again." };
  await db()
    .from("document_signers")
    .update({ signature_image_path: sigPath, signature_image_hash: imageHash })
    .eq("id", a.signer.id);

  const profile = await getProfile(wallet);
  if (input.saveToProfile) {
    const profPath = `profiles/${wallet}.png`;
    const saved = await db()
      .storage.from(SIG_BUCKET)
      .upload(profPath, new Blob([png], { type: "image/png" }), { upsert: true, contentType: "image/png" });
    if (!saved.error) {
      await db()
        .from("profiles")
        .update({ signature_path: profPath, signature_kind: input.kind, signature_hash: imageHash })
        .eq("wallet_address", wallet);
    }
  }

  const last = await isLastSigner(a.doc.id, a.signer.id);
  let finalHash: string | null = null;
  try {
    if (last) {
      finalHash = await prepareFinalCopy(a, wallet, png, profile?.full_name ?? a.signer.invited_name, profile?.email ?? a.signer.invited_email);
    }
    const args = await signArgsFor(a, wallet, imageHash, finalHash);
    return { ok: true, xdr: await buildSignTx(chainConfigFromEnv(), args), last };
  } catch (e) {
    console.error("prepareSign failed", e);
    const why = explainChainError(e);
    if (why === "NO_ACCOUNT") {
      return { ok: false, needsFunds: true, error: "Your wallet isn’t on the test network yet. Add free test XLM to cover the fee." };
    }
    return { ok: false, error: e instanceof Error && /Couldn’t|hasn’t/.test(e.message) ? e.message : why };
  }
}

/** Step 2: check the wallet-signed transaction, record it, then move the document along. */
export async function submitSign(signerId: string, signedXdr: string): Promise<{ ok: true; completed: boolean } | Fail> {
  const ready = await readyToSign(signerId);
  if ("ok" in ready) return ready;
  const { a, wallet } = ready;
  if (!a.signer.signature_image_hash) return { ok: false, error: "Add your signature first." };

  const last = await isLastSigner(a.doc.id, a.signer.id);
  const finalHash = last && a.doc.pending_final_signer === a.signer.id ? a.doc.pending_final_hash : null;
  if (last && !finalHash) return { ok: false, error: "Please press Finish again so we can prepare the signed copy." };

  let hash: string;
  try {
    const c = chainConfigFromEnv();
    const args = await signArgsFor(a, wallet, a.signer.signature_image_hash, finalHash);
    hash = (await submitAndWait(c, checkSignedSign(c, signedXdr, args))).hash;
  } catch (e) {
    console.error("submitSign failed", e);
    const msg = e instanceof Error ? e.message : "";
    return { ok: false, error: /doesn’t match|wasn’t signed|Still waiting|busy/.test(msg) ? msg : explainChainError(e) };
  }

  const now = new Date().toISOString();
  await db()
    .from("document_signers")
    .update({ status: "signed", signed_at: now, sign_tx_hash: hash, wallet_address: wallet })
    .eq("id", a.signer.id);
  await db()
    .from("document_events")
    .insert({ document_id: a.doc.id, kind: "signed", signer_id: a.signer.id, actor_wallet: wallet, tx_hash: hash });

  if (last) {
    await db()
      .from("documents")
      .update({
        status: "completed",
        completed_at: now,
        final_hash: finalHash,
        final_file_path: a.doc.pending_final_path,
        pending_final_hash: null,
        pending_final_path: null,
        pending_final_signer: null,
      })
      .eq("id", a.doc.id);
    await db().from("document_events").insert({ document_id: a.doc.id, kind: "completed", tx_hash: hash });
    await sendCompletedEmails(a.doc.id);
    return { ok: true, completed: true };
  }

  if (a.doc.in_order) {
    const sender = await getProfile(a.doc.sender_wallet);
    await inviteSigners(a.doc.id, [a.signer.slot + 1], {
      senderName: sender?.full_name ?? "Someone",
      senderWallet: a.doc.sender_wallet,
      senderEmail: sender?.email ?? null,
      kind: "your-turn",
    });
  }
  return { ok: true, completed: false };
}

/** Mark the invite as opened (once). */
export async function markViewed(signerId: string): Promise<void> {
  const a = await getAccess(signerId);
  if (!a?.invited || a.signer.status !== "invited") return;
  await db().from("document_signers").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", signerId).eq("status", "invited");
  await db().from("document_events").insert({ document_id: a.doc.id, kind: "viewed", signer_id: signerId, actor_wallet: a.wallet });
}

// ---------- decline ----------

async function readyToDecline(signerId: string): Promise<{ a: Access; wallet: string } | Fail> {
  const a = await getAccess(signerId);
  if (!a) return { ok: false, error: "This invite doesn’t exist." };
  if (!a.wallet) redirect(`/sign-in?next=/sign/${signerId}`);
  if (!a.canSign) return { ok: false, error: "Open this page from your invite email to respond." };
  if (a.doc.status !== "pending") return { ok: false, error: "This document is no longer waiting for signatures." };
  if (a.signer.status === "signed") return { ok: false, error: "You’ve already signed this document." };
  if (a.signer.wallet_address && a.signer.wallet_address !== a.wallet) {
    return { ok: false, error: "This spot is linked to a different wallet. Switch to that wallet in Varial." };
  }
  return { a, wallet: a.wallet };
}

async function declineArgs(a: Access, wallet: string) {
  const c = chainConfigFromEnv();
  const msg = await inviteMessage(c, a.doc.chain_doc_id, a.signer.slot, wallet);
  return {
    signer: wallet,
    chainDocId: a.doc.chain_doc_id,
    slot: a.signer.slot,
    inviteProof: signWithInvite(decryptSecret(a.signer.invite_secret_enc), msg),
  };
}

/** Step 1 of declining: build the `decline` transaction for the wallet to approve. */
export async function prepareDecline(signerId: string): Promise<{ ok: true; xdr: string } | Fail> {
  const ready = await readyToDecline(signerId);
  if ("ok" in ready) return ready;
  try {
    return { ok: true, xdr: await buildDeclineTx(chainConfigFromEnv(), await declineArgs(ready.a, ready.wallet)) };
  } catch (e) {
    console.error("prepareDecline failed", e);
    const why = explainChainError(e);
    if (why === "NO_ACCOUNT") {
      return { ok: false, needsFunds: true, error: "Your wallet isn’t on the test network yet. Add free test XLM to cover the fee." };
    }
    return { ok: false, error: why };
  }
}

/** Step 2: record the decline, stop the document, tell the sender. */
export async function submitDecline(signerId: string, signedXdr: string, reason: string): Promise<{ ok: true } | Fail> {
  const ready = await readyToDecline(signerId);
  if ("ok" in ready) return ready;
  const { a, wallet } = ready;
  const note = reason.trim().slice(0, 500);
  let hash: string;
  try {
    const c = chainConfigFromEnv();
    hash = (await submitAndWait(c, checkSignedDecline(c, signedXdr, await declineArgs(a, wallet)))).hash;
  } catch (e) {
    console.error("submitDecline failed", e);
    const msg = e instanceof Error ? e.message : "";
    return { ok: false, error: /doesn’t match|wasn’t signed|Still waiting|busy/.test(msg) ? msg : explainChainError(e) };
  }
  const now = new Date().toISOString();
  await db()
    .from("document_signers")
    .update({ status: "declined", declined_at: now, wallet_address: wallet })
    .eq("id", a.signer.id);
  await db().from("documents").update({ status: "declined" }).eq("id", a.doc.id).eq("status", "pending");
  await db().from("document_events").insert({
    document_id: a.doc.id,
    kind: "declined",
    signer_id: a.signer.id,
    actor_wallet: wallet,
    tx_hash: hash,
    detail: note ? { reason: note } : {},
  });
  const profile = await getProfile(wallet);
  await sendDeclinedEmail(a.doc.id, profile?.full_name ?? a.signer.invited_name, note);
  return { ok: true };
}
