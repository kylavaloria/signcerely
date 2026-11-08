import type { Metadata } from "next";
import { NewDocShell } from "@/components/NewDocShell";
import { getDraftSigners, getOwnedDraft } from "@/lib/documents";
import { requireUser } from "@/lib/profile";
import { SignersStep } from "./SignersStep";

export const metadata: Metadata = { title: "Signers · New document · It's Your Sign" };

export default async function SignersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await getOwnedDraft(id, user.wallet_address);
  const signers = await getDraftSigners(doc.id);

  return (
    <NewDocShell step={2}>
      <SignersStep
        documentId={doc.id}
        title={doc.title}
        me={{ name: user.full_name, email: user.email }}
        initial={signers.map((s) => ({ name: s.invited_name, email: s.invited_email }))}
        initialInOrder={doc.in_order}
      />
    </NewDocShell>
  );
}
