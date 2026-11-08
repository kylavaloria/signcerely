"use server";

import { redirect } from "next/navigation";
import { DOCS_BUCKET, getOwnedDraft } from "@/lib/documents";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export async function deleteDraft(documentId: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const doc = await getOwnedDraft(documentId, session.wallet);
  if (doc.file_path) await db().storage.from(DOCS_BUCKET).remove([doc.file_path]);
  await db().from("documents").delete().eq("id", doc.id).eq("status", "draft");
  redirect("/dashboard?deleted=1");
}
