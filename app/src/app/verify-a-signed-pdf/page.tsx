import type { Metadata } from "next";
import Link from "next/link";
import { Clip } from "@/components/Clip";
import { ContentPage } from "@/components/ContentPage";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "/verify-a-signed-pdf",
  "How to check if a signed PDF was changed · Signcerely",
  "Find out in seconds whether a signed PDF is the real signed version, who signed it and when. Free, no account needed, and the file never leaves your device.",
);

export default function VerifyGuidePage() {
  return (
    <ContentPage
      eyebrow="Guide"
      title="How to check if a signed PDF was changed"
      left="magnifier"
      right="shield"
      intro={
        <p>
          A PDF can be edited after it’s signed, and the change can be invisible: a different amount, a new clause, a moved date. If the document was
          signed with Signcerely, you can check in a few seconds whether you’re holding the exact version everyone signed.
        </p>
      }
    >
      <h2>Check a PDF in three steps</h2>
      <ol>
        <li>
          Open the <Link href="/verify">Verify page</Link>. You don’t need an account or a wallet.
        </li>
        <li>Choose the PDF, or drop it on the page.</li>
        <li>Read the answer. If it matches, you’ll see the document’s title, who signed it and when.</li>
      </ol>
      <Clip name="step-7-verify" label="Screen recording: checking a signed PDF on the Verify page" />
      <p className="note note-green">
        <span>
          <strong>Your file stays on your device.</strong> Your browser calculates the file’s fingerprint and only that short code is looked up. The
          PDF itself is never uploaded.
        </span>
      </p>

      <h2>What the answers mean</h2>
      <h3>“This document matches the signed version”</h3>
      <p>
        You have the exact signed copy. Below the answer you’ll see who signed, in which order and when, as recorded at the time of signing.
      </p>
      <h3>“This is the original file that was sent for signing”</h3>
      <p>
        The file is the one the sender uploaded, before anyone signed. It’s genuine, but it isn’t the signed copy. Ask for the signed copy, which
        has everyone’s signatures and a summary page.
      </p>
      <h3>“This file doesn’t match any signed document”</h3>
      <p>
        No Signcerely document has this exact fingerprint. The file may have been edited after signing, re-saved in another app, scanned, or it’s a
        different draft. Don’t rely on it as the signed agreement.
      </p>
      <Clip name="verify-edited" label="Screen recording: an edited copy of a signed PDF doesn’t match" />

      <h2>Why a re-saved or scanned copy won’t match</h2>
      <p>
        The check compares fingerprints, and a fingerprint is calculated from every byte of the file. Printing and scanning, saving the PDF again
        from another app, or even changing its hidden details creates a different file, so it won’t match, even if the words look the same.
      </p>
      <p>
        That’s what makes the check trustworthy: nobody can change a signed document, even slightly, and still have it pass. Always keep the signed
        copy you downloaded from Signcerely (or the one you were emailed) and share that file.
      </p>

      <h2>Share a verification link instead</h2>
      <p>
        Don’t want to send the file? On a completed document, the sender can open its verification page and share the link. Anyone with the link
        sees the document’s title, its status, who signed and when. They can also upload their copy on that page to compare it.
      </p>
      <Clip name="verify-link" label="Screen recording: opening the shareable verification page of a signed document" />

      <h2>Who keeps the record?</h2>
      <p>
        Not just Signcerely. When a document is sent and signed, its fingerprints and each signature are recorded on Stellar, a public network that
        nobody, including us, can quietly edit. The Verify page reads that record directly, which is why the answer doesn’t depend on trusting our
        database.
      </p>

      <h2>Common questions</h2>
      <h3>Does this work for PDFs signed with other tools?</h3>
      <p>No. The check only knows documents sent and signed through Signcerely.</p>
      <h3>Does checking cost anything?</h3>
      <p>No. Checking a document is free and needs no account.</p>
      <h3>Can I check a document that hasn’t been fully signed yet?</h3>
      <p>
        Yes. The original file is recognized as soon as it’s sent, and the verification page shows who has signed so far. The signed copy exists
        only after everyone has signed.
      </p>
      <p>
        Want to see the whole signing flow? Read <Link href="/how-it-works">how Signcerely works</Link>.
      </p>
    </ContentPage>
  );
}
