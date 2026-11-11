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

export type ToSign = {
  signerId: string;
  documentId: string;
  title: string;
  summary: string | null;
  pageCount: number | null;
  inOrder: boolean;
  senderName: string;
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
      "id, invited_at, invited_email, wallet_address, status, documents!inner(id, title, summary, page_count, in_order, status, sender_wallet, profiles(full_name))",
    )
    .in("status", ["invited", "viewed"])
    .eq("documents.status", "pending");
  q = verifiedEmail
    ? q.or(`wallet_address.eq.${wallet},invited_email.ilike."${verifiedEmail.replace(/["\\%_]/g, "")}"`)
    : q.eq("wallet_address", wallet);
  const { data, error } = await q.order("invited_at", { ascending: false });
  if (error) throw dbError(error);
  const rows = (data ?? []).map((r) => ({
    r,
    d: r.documents as unknown as {
      id: string;
      title: string;
      summary: string | null;
      page_count: number | null;
      in_order: boolean;
      profiles: { full_name: string } | null;
    },
  }));

  const signersByDoc = new Map<string, ToSign["signers"]>();
  const ids = [...new Set(rows.map(({ d }) => d.id))];
  if (ids.length) {
    const { data: all, error: e2 } = await db()
      .from("document_signers")
      .select("document_id, invited_name, status, slot")
      .in("document_id", ids);
    if (e2) throw dbError(e2);
    for (const s of all ?? []) {
      const list = signersByDoc.get(s.document_id) ?? [];
      list.push({ invited_name: s.invited_name, status: s.status, slot: s.slot });
      signersByDoc.set(s.document_id, list);
    }
  }

  return rows.map(({ r, d }) => ({
    signerId: r.id,
    documentId: d.id,
    title: d.title,
    summary: d.summary,
    pageCount: d.page_count,
    inOrder: d.in_order,
    senderName: d.profiles?.full_name ?? "Someone",
    invitedAt: r.invited_at,
    signers: (signersByDoc.get(d.id) ?? []).sort((a, b) => a.slot - b.slot),
  }));
}
