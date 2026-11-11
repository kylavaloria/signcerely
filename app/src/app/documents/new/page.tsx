import type { Metadata } from "next";
import { NewDocShell } from "@/components/NewDocShell";
import { requireUser } from "@/lib/profile";
import { UploadStep } from "./UploadStep";

export const metadata: Metadata = { title: "New document · Signcerely" };

export default async function NewDocumentPage() {
  await requireUser();
  return (
    <NewDocShell step={1}>
      <UploadStep />
    </NewDocShell>
  );
}
