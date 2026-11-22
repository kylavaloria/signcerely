import "server-only";
import { notFound } from "next/navigation";
import { db, dbError } from "./supabase";

export const DOCS_BUCKET = "documents";

export type DraftDoc = {
  id: string;
  chain_doc_id: string | null;
  title: string;
  summary: string | null;
  file_path: string | null;
  page_count: number | null;
  original_hash: string | null;
  in_order: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export type DraftSigner = {
  id: string;
  slot: number;
  invited_name: string;
  invited_email: string;
};

export type DraftField = {
  id: string;
  signer_id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

const DOC_COLS = "id, chain_doc_id, title, summary, file_path, page_count, original_hash, in_order, status, created_at, updated_at";

/** A draft owned by `wallet`, or 404. Drafts are visible only to their sender. */
export async function getOwnedDraft(id: string, wallet: string): Promise<DraftDoc> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data, error } = await db()
    .from("documents")
    .select(DOC_COLS)
    .eq("id", id)
    .eq("sender_wallet", wallet)
    .eq("status", "draft")
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data || !data.file_path) notFound();
  return data as DraftDoc;
}

export async function getDraftSigners(documentId: string): Promise<DraftSigner[]> {
  const { data, error } = await db()
    .from("document_signers")
    .select("id, slot, invited_name, invited_email")
    .eq("document_id", documentId)
    .order("slot");
  if (error) throw dbError(error);
  return data ?? [];
}

export async function getDraftFields(documentId: string): Promise<DraftField[]> {
  const { data, error } = await db()
    .from("signature_fields")
    .select("id, signer_id, page, x, y, width, height")
    .eq("document_id", documentId)
    .order("page");
  if (error) throw dbError(error);
  return (data ?? []).map((f) => ({ ...f, x: Number(f.x), y: Number(f.y), width: Number(f.width), height: Number(f.height) }));
}

/** Short-lived link so the sender's browser can render their own PDF. */
export async function signedPdfUrl(path: string): Promise<string> {
  const { data, error } = await db().storage.from(DOCS_BUCKET).createSignedUrl(path, 60 * 30);
  if (error || !data) throw error ?? new Error("Couldn't create a link to the PDF.");
  return data.signedUrl;
}

export type DraftSummary = DraftDoc & { signer_count: number; field_count: number };

export async function listDrafts(wallet: string): Promise<DraftSummary[]> {
  const { data, error } = await db()
    .from("documents")
    .select(`${DOC_COLS}, document_signers(count), signature_fields(count)`)
    .eq("sender_wallet", wallet)
    .eq("status", "draft")
    .not("file_path", "is", null)
    .order("updated_at", { ascending: false });
  if (error) throw dbError(error);
  return (data ?? []).map((d) => {
    const { document_signers, signature_fields, ...doc } = d as typeof d & {
      document_signers: { count: number }[];
      signature_fields: { count: number }[];
    };
    return {
      ...(doc as DraftDoc),
      signer_count: document_signers?.[0]?.count ?? 0,
      field_count: signature_fields?.[0]?.count ?? 0,
    };
  });
}

/** Where a draft should resume. */
export function nextStepHref(d: { id: string; signer_count: number }): string {
  return d.signer_count < 2 ? `/documents/${d.id}/signers` : `/documents/${d.id}/review`;
}

export type SentDoc = {
  id: string;
  title: string;
  summary: string | null;
  page_count: number | null;
  updated_at: string;
  status: string;
  in_order: boolean;
  sent_at: string | null;
  completed_at: string | null;
  signers: { invited_name: string; status: string; slot: number }[];
};

/** Documents this wallet sent (anything past draft). */
export async function listSent(wallet: string): Promise<SentDoc[]> {
  const { data, error } = await db()
    .from("documents")
    .select("id, title, summary, page_count, updated_at, status, in_order, sent_at, completed_at, document_signers(invited_name, status, slot)")
    .eq("sender_wallet", wallet)
    .neq("status", "draft")
    .order("sent_at", { ascending: false });
  if (error) throw dbError(error);
  return (data ?? []).map((d) => ({
    ...d,
    signers: ((d.document_signers as SentDoc["signers"]) ?? []).sort((a, b) => a.slot - b.slot),
  })) as SentDoc[];
}

/** A confirmed email as stored in the indexed lowercase columns, safe inside a PostgREST or() filter. */
const emailKey = (email: string) => email.toLowerCase().replace(/["\\]/g, "");

export type ToSign = {
  signerId: string;
  documentId: string;
  title: string;
  summary: string | null;
  pageCount: number | null;
  inOrder: boolean;
  senderName: string;
  senderWallet: string;
  invitedAt: string | null;
  /** Everyone on the document, in signing order. */
  signers: { invited_name: string; status: string; slot: number }[];
};

/**
 * Documents waiting for this person's signature: invites to their confirmed
 * email, or already linked to their wallet.
 */
export async function listToSign(wallet: string, verifiedEmail: string | null): Promise<ToSign[]> {
  let q = db()
    .from("document_signers")
    .select(
      "id, invited_at, invited_email, wallet_address, status, documents!inner(id, title, summary, page_count, in_order, status, sender_wallet, profiles(full_name), document_signers(invited_name, status, slot))",
    )
    .in("status", ["invited", "viewed"])
    .eq("documents.status", "pending");
  q = verifiedEmail
    ? q.or(`wallet_address.eq.${wallet},invited_email_lower.eq."${emailKey(verifiedEmail)}"`)
    : q.eq("wallet_address", wallet);
  const { data, error } = await q.order("invited_at", { ascending: false });
  if (error) throw dbError(error);
  // Everyone on each document comes back in the same query, so this is a single round trip.
  return (data ?? []).map((r) => {
    const d = r.documents as unknown as {
      id: string;
      title: string;
      summary: string | null;
      page_count: number | null;
      in_order: boolean;
      sender_wallet: string;
      profiles: { full_name: string } | null;
      document_signers: ToSign["signers"] | null;
    };
    return {
      signerId: r.id,
      documentId: d.id,
      title: d.title,
      summary: d.summary,
      pageCount: d.page_count,
      inOrder: d.in_order,
      senderName: d.profiles?.full_name ?? "Someone",
      senderWallet: d.sender_wallet,
      invitedAt: r.invited_at,
      signers: [...(d.document_signers ?? [])].sort((a, b) => a.slot - b.slot),
    };
  });
}

export type FromOthers = SentDoc & {
  signerId: string;
  /** This person's own slot status (waiting, invited, viewed, signed, declined). */
  myStatus: string;
  senderName: string;
  senderWallet: string;
};

/**
 * Sent (non-draft) documents that someone else sent this person: slots linked to
 * their wallet, or invites to their confirmed email.
 */
export async function listFromOthers(wallet: string, verifiedEmail: string | null): Promise<FromOthers[]> {
  let q = db()
    .from("document_signers")
    .select(
      "id, status, documents!inner(id, title, summary, page_count, updated_at, status, in_order, sent_at, completed_at, sender_wallet, profiles(full_name), document_signers(invited_name, status, slot))",
    )
    .in("documents.status", ["pending", "completed", "declined", "cancelled"])
    .neq("documents.sender_wallet", wallet);
  q = verifiedEmail
    ? q.or(`wallet_address.eq.${wallet},invited_email_lower.eq."${emailKey(verifiedEmail)}"`)
    : q.eq("wallet_address", wallet);
  const { data, error } = await q;
  if (error) throw dbError(error);
  const seen = new Set<string>();
  const out: FromOthers[] = [];
  for (const r of data ?? []) {
    const d = r.documents as unknown as Omit<SentDoc, "signers"> & {
      sender_wallet: string;
      profiles: { full_name: string } | null;
      document_signers: SentDoc["signers"];
    };
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const { sender_wallet, profiles, document_signers, ...doc } = d;
    out.push({
      ...doc,
      signers: [...(document_signers ?? [])].sort((a, b) => a.slot - b.slot),
      signerId: r.id,
      myStatus: r.status,
      senderName: profiles?.full_name ?? "Someone",
      senderWallet: sender_wallet,
    });
  }
  return out;
}
