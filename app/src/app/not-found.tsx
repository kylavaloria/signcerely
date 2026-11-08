import type { Metadata } from "next";
import Link from "next/link";
import { StatusPage } from "@/components/StatusPage";

export const metadata: Metadata = { title: "Not found · It's Your Sign" };

export default function NotFound() {
  return (
    <StatusPage
      eyebrow="Not found"
      title="We couldn’t find that page"
      actions={
        <>
          <Link className="btn btn-primary" href="/dashboard">
            Go to your documents
          </Link>
          <Link className="btn btn-secondary" href="/verify">
            Verify a document
          </Link>
        </>
      }
    >
      <p>The link may be mistyped, or the document was deleted or isn’t shared with you.</p>
      <p>
        Opening an invitation? Use the exact link from your email, and sign in with the email address it was sent to.
      </p>
    </StatusPage>
  );
}
