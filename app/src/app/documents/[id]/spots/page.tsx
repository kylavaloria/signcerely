import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewDocShell } from "@/components/NewDocShell";
import { getDraftFields, getDraftSigners, getOwnedDraft, signedPdfUrl } from "@/lib/documents";
import { requireUser } from "@/lib/profile";
import { SpotsEditor } from "./SpotsEditor";
import { noIndex } from "@/lib/site";

export const metadata: Metadata = { title: "Signature spots · New document · Signcerely", robots: noIndex };

export default async function SpotsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await getOwnedDraft(id, user.wallet_address);
  const signers = await getDraftSigners(doc.id);
  if (signers.length < 2) redirect(`/documents/${doc.id}/signers`);
  const [fields, pdfUrl] = await Promise.all([getDraftFields(doc.id), signedPdfUrl(doc.file_path!)]);

  return (
    <NewDocShell step={3}>
      <SpotsEditor
        documentId={doc.id}
        pdfUrl={pdfUrl}
        pageCount={doc.page_count ?? 1}
        signers={signers.map((s) => ({ id: s.id, slot: s.slot, name: s.invited_name }))}
        initial={fields.map((f) => ({ signerId: f.signer_id, page: f.page, x: f.x, y: f.y, width: f.width, height: f.height }))}
      />
    </NewDocShell>
  );
}
