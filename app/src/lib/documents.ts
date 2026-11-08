import "server-only";
import { notFound } from "next/navigation";
import { db } from "./supabase";

export const DOCS_BUCKET = "documents";

export type DraftDoc = {
  id: string;
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

const DOC_COLS = "id, title, summary, file_path, page_count, original_hash, in_order, status, created_at, updated_at";

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
  if (error) throw error;
  if (!data || !data.file_path) notFound();
  return data as DraftDoc;
}

export async function getDraftSigners(documentId: string): Promise<DraftSigner[]> {
  const { data, error } = await db()
    .from("document_signers")
    .select("id, slot, invited_name, invited_email")
    .eq("document_id", documentId)
    .order("slot");
  if (error) throw error;
  return data ?? [];
}

export async function getDraftFields(documentId: string): Promise<DraftField[]> {
  const { data, error } = await db()
    .from("signature_fields")
    .select("id, signer_id, page, x, y, width, height")
    .eq("document_id", documentId)
    .order("page");
  if (error) throw error;
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
  if (error) throw error;
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
    .select("id, title, status, in_order, sent_at, completed_at, document_signers(invited_name, status, slot)")
    .eq("sender_wallet", wallet)
    .neq("status", "draft")
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    ...d,
    signers: ((d.document_signers as SentDoc["signers"]) ?? []).sort((a, b) => a.slot - b.slot),
  })) as SentDoc[];
}

export type ToSign = { signerId: string; documentId: string; title: string; senderName: string; invitedAt: string | null };

/**
 * Documents waiting for this person's signature: invites to their confirmed
 * email, or already linked to their wallet.
 */
export async function listToSign(wallet: string, verifiedEmail: string | null): Promise<ToSign[]> {
  let q = db()
    .from("document_signers")
    .select("id, invited_at, invited_email, wallet_address, status, documents!inner(id, title, status, sender_wallet, profiles(full_name))")
    .in("status", ["invited", "viewed"])
    .eq("documents.status", "pending");
  q = verifiedEmail
    ? q.or(`wallet_address.eq.${wallet},invited_email.ilike."${verifiedEmail.replace(/["\\%_]/g, "")}"`)
    : q.eq("wallet_address", wallet);
  const { data, error } = await q.order("invited_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const d = r.documents as unknown as { id: string; title: string; profiles: { full_name: string } | null };
    return { signerId: r.id, documentId: d.id, title: d.title, senderName: d.profiles?.full_name ?? "Someone", invitedAt: r.invited_at };
  });
}
