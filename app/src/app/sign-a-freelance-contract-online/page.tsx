import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "/sign-a-freelance-contract-online",
  "Sign a freelance contract online, with proof of who agreed · Signcerely",
  "Send a freelance contract as a PDF, get your client’s signature online, and keep a signed copy either of you can check later. Free, no printing.",
);

export default function FreelanceContractPage() {
  return (
    <ContentPage
      eyebrow="Freelancers"
      title="Sign a freelance contract online, with proof of who agreed"
      left="pen"
      right="check"
      intro={
        <p>
          “I sent it in chat and they said OK” isn’t much help when a client disputes the scope or the payment terms. Here’s how to get a freelance
          contract signed properly, without printing or scanning, and keep proof of exactly what was agreed.
        </p>
      }
    >
      <h2>Why a proper signature matters for freelancers</h2>
      <p>
        Most freelance disagreements come down to one question: what did we actually agree? A chat message or an emailed attachment shows that a
        file was sent, not that the other person agreed to that exact version. A signed contract settles it, as long as both sides can show it’s
        the same file that was signed.
      </p>
      <p>
        With Signcerely, the contract’s fingerprint and each signature are recorded on a public record when they happen. If the PDF is changed later,
        even by one character, it no longer matches. Either of you can{" "}
        <Link href="/verify-a-signed-pdf">check a copy</Link> at any time.
      </p>

      <h2>How to send a freelance contract for signing</h2>
      <ol>
        <li>
          <strong>Export your contract as a PDF</strong> (up to 10 MB) from Word, Google Docs or any editor.
        </li>
        <li>
          <strong>Upload it to Signcerely</strong> and add a one-line summary, for example “Website redesign, 3 milestones, ₱60,000 total”.
        </li>
        <li>
          <strong>Add the signers.</strong> Usually that’s you and your client. Choose <em>One after another</em> if you want to sign first, or{" "}
          <em>All at once</em>.
        </li>
        <li>
          <strong>Place the signature boxes</strong> on the signature lines.
        </li>
        <li>
          <strong>Send it.</strong> Your client gets an email, signs in their browser and approves it in their wallet. When everyone has signed,
          you both receive the signed copy.
        </li>
      </ol>
      <p>
        See every step with screen recordings in <Link href="/how-it-works">how it works</Link>.
      </p>

      <h2>What to check before you send</h2>
      <p>Signcerely proves who signed which version. It can’t check what’s in it, so read your contract once more for the usual sticking points:</p>
      <ul>
        <li>
          <strong>Scope:</strong> what you’ll deliver, and what isn’t included.
        </li>
        <li>
          <strong>Payment:</strong> the amount, currency, deposit, milestones and due dates.
        </li>
        <li>
          <strong>Revisions:</strong> how many rounds are included and what extra rounds cost.
        </li>
        <li>
          <strong>Deadlines</strong> for both sides, including how fast the client gives feedback.
        </li>
        <li>
          <strong>Ownership:</strong> when the client owns the work, often after the final payment.
        </li>
        <li>
          <strong>Ending early:</strong> what happens to payment if either side stops the project.
        </li>
      </ul>
      <p className="note note-yellow">
        <span>
          This is general guidance, not legal advice. Whether an electronic signature is legally binding depends on where you are and what you’re
          signing. For high-stakes contracts, check with a lawyer.
        </span>
      </p>

      <h2>If your client asks for a change</h2>
      <p>
        A signed document can’t be edited, and that’s the point. If the client wants a correction before signing, they can decline with a reason,
        and you’ll be emailed why. Update your PDF and send it as a new document. As the sender, you can also cancel a document while it’s still
        waiting for signatures.
      </p>

      <h2>After it’s signed</h2>
      <ul>
        <li>Keep the signed copy you were emailed, or download it from the document page.</li>
        <li>Share that exact file. A re-saved, printed or scanned copy won’t match when someone checks it.</li>
        <li>
          If there’s ever a question about what was agreed, anyone can upload the file on the <Link href="/verify">Verify page</Link> and see who
          signed it and when.
        </li>
      </ul>
    </ContentPage>
  );
}
