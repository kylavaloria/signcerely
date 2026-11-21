import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "/sign-a-lease-online",
  "Sign a lease online: landlord and tenant, no printing · Signcerely",
  "Send a lease agreement as a PDF, have the landlord and every tenant sign online in order, and keep a signed copy anyone can check later.",
);

export default function LeasePage() {
  return (
    <ContentPage
      eyebrow="Landlords and tenants"
      title="Sign a lease online, without printing or meeting up"
      left="document"
      right="people"
      intro={
        <p>
          Leases are often signed in a rush: a photo of a printed page, a scan sent back by chat, a version nobody can find a year later. Here’s how
          to have a landlord and tenants sign the same lease online, and keep proof of exactly which version they signed.
        </p>
      }
    >
      <h2>Why it matters which version was signed</h2>
      <p>
        Rent, deposit, the move-in date and the rules on repairs are exactly the things that get disputed later. If the lease that was signed can’t
        be told apart from a later edit, nobody can settle it. Signcerely records the lease’s fingerprint and each signature when they happen, so
        the signed copy can be <Link href="/verify-a-signed-pdf">checked by anyone</Link>, and any edited copy simply won’t match.
      </p>

      <h2>How to send a lease for signing</h2>
      <ol>
        <li>
          <strong>Save the lease as a PDF</strong>, up to 10 MB.
        </li>
        <li>
          <strong>Upload it</strong> with a short summary, for example “12-month lease, Unit 4B, starting December 1”.
        </li>
        <li>
          <strong>Add everyone who signs:</strong> the landlord or property manager and each tenant, up to 20 people. Co-tenants can each sign
          their own spot.
        </li>
        <li>
          <strong>Choose the order.</strong> <em>One after another</em> works well when the landlord signs first and tenants follow;{" "}
          <em>All at once</em> invites everyone together.
        </li>
        <li>
          <strong>Place each person’s signature box</strong> on the signature lines, then review and send.
        </li>
      </ol>
      <p>
        Each person signs from the email invite, and when the last one signs, everyone receives the final signed copy with all signatures, dates and
        a summary page. See each step in <Link href="/how-it-works">how it works</Link>.
      </p>

      <h2>A quick checklist before you send</h2>
      <ul>
        <li>The names of every tenant and the landlord, spelled as on their IDs</li>
        <li>The property address and unit</li>
        <li>The start date, end date and how the lease renews or ends</li>
        <li>Rent, due date, late fees and accepted payment methods</li>
        <li>The deposit amount and when and how it’s returned</li>
        <li>Who pays which utilities and dues, and who handles repairs</li>
        <li>Rules on pets, guests and subletting</li>
      </ul>
      <p className="note note-yellow">
        <span>
          This is general guidance, not legal advice. Some places require a lease to be notarized, registered or signed in a particular way. Check
          the rules where the property is.
        </span>
      </p>

      <h2>If a tenant asks for a correction</h2>
      <p>
        The tenant can decline with a reason, for example “the deposit should be one month”, and the sender is emailed. Fix the PDF and send it as a
        new document. A document that’s still waiting can also be cancelled by the sender.
      </p>

      <h2>Keep the signed copy</h2>
      <p>
        Everyone gets the signed lease by email and can download it again from the document page. Keep that exact file. If there’s ever a question,
        upload it on the <Link href="/verify">Verify page</Link> to confirm it’s the version everyone signed.
      </p>
    </ContentPage>
  );
}
