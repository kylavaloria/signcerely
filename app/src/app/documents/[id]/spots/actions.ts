"use server";

import { redirect } from "next/navigation";
import { fieldsSchema } from "@/lib/doc-rules";
import { getDraftSigners, getOwnedDraft } from "@/lib/documents";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

/**
 * Save the signature boxes. `skip` saves none: signatures then go only on the
 * signed copy's summary page.
 */
export async function saveSpots(documentId: string, input: unknown, skip = false): Promise<{ error: string }> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const doc = await getOwnedDraft(documentId, session.wallet);

  const parsed = fieldsSchema.safeParse(skip ? [] : input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Some boxes are invalid." };

  const signers = await getDraftSigners(doc.id);
  const ids = new Set(signers.map((s) => s.id));
  const fields = parsed.data;
  if (fields.some((f) => !ids.has(f.signerId) || f.page > (doc.page_count ?? 1))) {
    return { error: "Some boxes no longer match a signer or page. Reload and try again." };
  }
  if (!skip) {
    const missing = signers.filter((s) => !fields.some((f) => f.signerId === s.id));
    if (missing.length) return { error: `Add a signature box for ${missing.map((s) => s.invited_name).join(", ")}.` };
  }

  const { error } = await db().rpc("save_draft_fields", {
    p_document_id: doc.id,
    p_fields: fields.map((f) => ({ signer_id: f.signerId, page: f.page, x: f.x, y: f.y, width: f.width, height: f.height })),
  });
  if (error) {
    console.error("save_draft_fields failed", error);
    return { error: "Couldn’t save the signature boxes. Please try again." };
  }
  redirect(`/documents/${doc.id}/review`);
}
