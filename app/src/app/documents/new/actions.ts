"use server";

import { createHash, randomUUID } from "node:crypto";
import { draftInfoSchema, MAX_PDF_BYTES } from "@/lib/doc-rules";
import { DOCS_BUCKET } from "@/lib/documents";
import { chainDocId } from "@/lib/invite-keys";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

type Fail = { ok: false; error: string };

/**
 * Step 1a: register the draft and hand back a one-time upload link so the
 * browser can send the PDF straight to private storage.
 */
export async function createDraft(
  input: unknown,
): Promise<{ ok: true; id: string; path: string; token: string } | Fail> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session ended. Please sign in again." };

  const parsed = draftInfoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  const d = parsed.data;

  // Same file again? Point to the draft that already has it.
  const { data: existing } = await db()
    .from("documents")
    .select("id, status, sender_wallet, file_path")
    .eq("original_hash", d.sha256)
    .maybeSingle();
  if (existing) {
    if (existing.sender_wallet === session.wallet && existing.status === "draft" && !existing.file_path) {
      // An earlier upload of this file never finished; clear it and start over.
      await db().from("documents").delete().eq("id", existing.id);
    } else {
      return {
        ok: false,
        error:
          existing.sender_wallet === session.wallet && existing.status === "draft"
            ? "You’ve already uploaded this exact file. Open it from your dashboard to continue."
            : "This exact file has already been sent for signing. If it’s a new agreement, save it as a new PDF first.",
      };
    }
  }

  const id = randomUUID();
  const path = `${id}/original.pdf`;
  const { error } = await db().from("documents").insert({
    id,
    chain_doc_id: chainDocId(id),
    sender_wallet: session.wallet,
    title: d.title,
    summary: d.summary || null,
    page_count: d.pageCount,
    original_hash: d.sha256,
    status: "draft",
  });
  if (error) {
    console.error("draft insert failed", error);
    return { ok: false, error: "Couldn’t create the draft. Please try again." };
  }

  const { data: up, error: upErr } = await db().storage.from(DOCS_BUCKET).createSignedUploadUrl(path);
  if (upErr || !up) {
    console.error("signed upload url failed", upErr);
    await db().from("documents").delete().eq("id", id);
    return { ok: false, error: "Couldn’t prepare the upload. Please try again." };
  }
  return { ok: true, id, path, token: up.token };
}

/**
 * Step 1b: after the browser uploads, check the stored file really is the
 * PDF whose fingerprint we recorded, then make the draft visible.
 */
export async function finishUpload(id: string): Promise<{ ok: true } | Fail> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session ended. Please sign in again." };

  const { data: doc } = await db()
    .from("documents")
    .select("id, original_hash, status, file_path")
    .eq("id", id)
    .eq("sender_wallet", session.wallet)
    .maybeSingle();
  if (!doc || doc.status !== "draft") return { ok: false, error: "Draft not found." };
  if (doc.file_path) return { ok: true };

  const path = `${id}/original.pdf`;
  const { data: blob, error } = await db().storage.from(DOCS_BUCKET).download(path);
  const discard = async (msg: string): Promise<Fail> => {
    await db().storage.from(DOCS_BUCKET).remove([path]);
    await db().from("documents").delete().eq("id", id);
    return { ok: false, error: msg };
  };
  if (error || !blob) return discard("The upload didn’t arrive. Please try again.");

  const bytes = Buffer.from(await blob.arrayBuffer());
  if (bytes.length > MAX_PDF_BYTES) return discard("PDFs can be up to 10 MB.");
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return discard("That file isn’t a PDF.");
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== doc.original_hash) return discard("The uploaded file didn’t match. Please try again.");

  const { error: upd } = await db().from("documents").update({ file_path: path }).eq("id", id);
  if (upd) return { ok: false, error: "Couldn’t save the draft. Please try again." };
  return { ok: true };
}
