"use server";

import { redirect } from "next/navigation";
import { signersSchema } from "@/lib/doc-rules";
import { getDraftSigners, getOwnedDraft } from "@/lib/documents";
import { encryptSecret, generateInviteKey } from "@/lib/invite-keys";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export type SignersResult = {
  error?: string;
  fieldErrors?: Record<number, { name?: string; email?: string }>;
};

export async function saveSigners(documentId: string, input: unknown): Promise<SignersResult> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const doc = await getOwnedDraft(documentId, session.wallet);

  const parsed = signersSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: SignersResult["fieldErrors"] = {};
    let error: string | undefined;
    for (const issue of parsed.error.issues) {
      const [, idx, key] = issue.path as [string, number?, string?];
      if (typeof idx === "number" && (key === "name" || key === "email")) {
        fieldErrors[idx] = { ...fieldErrors[idx], [key]: issue.message };
      } else {
        error ??= issue.message;
      }
    }
    return { error, fieldErrors };
  }

  // Keep existing signers (and their invite keys + boxes) when the email matches.
  const existing = new Map((await getDraftSigners(doc.id)).map((s) => [s.invited_email.toLowerCase(), s]));
  const payload = parsed.data.signers.map((s, slot) => {
    const prev = existing.get(s.email);
    if (prev) return { id: prev.id, slot, name: s.name, email: s.email };
    const key = generateInviteKey();
    return {
      slot,
      name: s.name,
      email: s.email,
      invite_public_key: key.publicKeyHex,
      invite_secret_enc: encryptSecret(key.secretHex),
    };
  });

  const { error } = await db().rpc("save_draft_signers", { p_document_id: doc.id, p_signers: payload });
  if (error) {
    console.error("save_draft_signers failed", error);
    return { error: "Couldn’t save signers. Please try again." };
  }
  await db().from("documents").update({ in_order: parsed.data.inOrder }).eq("id", doc.id);

  redirect(`/documents/${doc.id}/spots`);
}
