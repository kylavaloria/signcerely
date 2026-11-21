import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "/multiple-signers-in-order",
  "Get several people to sign a PDF, in the order you choose · Signcerely",
  "Send one PDF to up to 20 signers, one after another or all at once. Track who has signed, send reminders, and give everyone the signed copy.",
);

export default function MultipleSignersPage() {
  return (
    <ContentPage
      eyebrow="Several signers"
      title="Get several people to sign a PDF, in the order you choose"
      left="people"
      right="pen"
      intro={
        <p>
          Passing one PDF around by email gets messy fast: who has the latest copy, who has signed, who is next? Signcerely sends one locked file to
          everyone, invites each person at the right time, and shows you exactly where things stand.
        </p>
      }
    >
      <h2>One after another, or all at once</h2>
      <p>When you add signers, you choose how they’re invited:</p>
      <ul>
        <li>
          <strong>One after another.</strong> Each person is invited only after the person before them has signed. Use it when order matters, for
          example a manager approving before a client signs, or a landlord signing before the tenants.
        </li>
        <li>
          <strong>All at once.</strong> Everyone is invited right away and can sign in any order. Use it when you just need everyone’s signature
          quickly.
        </li>
      </ul>
      <p>You can add from 2 to 20 signers, and you can include yourself.</p>

      <h2>How it works</h2>
      <ol>
        <li>Upload the PDF and add a short summary of what people are agreeing to.</li>
        <li>Add each signer’s name and email, and choose the order.</li>
        <li>Place a signature box for each person, or skip this to put signatures on a summary page.</li>
        <li>Review and send. Each person gets an email when it’s their turn.</li>
      </ol>
      <p>
        Every signer signs the same locked file, and only the invited person can sign their own spot. See it step by step in{" "}
        <Link href="/how-it-works">how it works</Link>.
      </p>

      <h2>Keep track of who has signed</h2>
      <p>
        The document page shows each signer’s status (waiting for their turn, invited, opened the document, signed or declined) and a timeline of
        what happened. From there you can:
      </p>
      <ul>
        <li>
          <strong>Send a reminder</strong> to someone who hasn’t signed.
        </li>
        <li>
          <strong>Copy their invite link</strong> and send it yourself, for example in a chat, if an email doesn’t arrive.
        </li>
        <li>
          <strong>Cancel the document</strong> while it’s still waiting, if plans change.
        </li>
      </ul>
      <p>
        Your dashboard also lists everything waiting for your signature, everything waiting for others, your drafts, and what’s completed or closed.
      </p>

      <h2>When someone declines</h2>
      <p>
        Any signer can decline with a reason. That stops the document, and the sender is emailed why. To try again, fix the PDF and send it as a new
        document.
      </p>

      <h2>When everyone has signed</h2>
      <p>
        Signcerely creates the final PDF with every signature and date stamped on it and a summary page listing who signed and when. Everyone is
        emailed the signed copy, and anyone can confirm it on the <Link href="/verify">Verify page</Link>. Learn{" "}
        <Link href="/verify-a-signed-pdf">how checking a signed PDF works</Link>.
      </p>
    </ContentPage>
  );
}
