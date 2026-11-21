import type { Metadata } from "next";
import { NewDocShell } from "@/components/NewDocShell";
import { requireUser } from "@/lib/profile";
import { UploadStep } from "./UploadStep";
import { noIndex } from "@/lib/site";

export const metadata: Metadata = { title: "New document · Signcerely", robots: noIndex };

export default async function NewDocumentPage() {
  await requireUser();
  return (
    <NewDocShell step={1}>
      <UploadStep />
    </NewDocShell>
  );
}
