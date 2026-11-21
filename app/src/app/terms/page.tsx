import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";
import { CONTACT_EMAIL, LEGAL_UPDATED, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "/terms",
  "Terms of Use · Signcerely",
  "The rules for using Signcerely: what the service does and doesn’t do, your responsibilities, fees during beta, and the public record.",
);

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Terms of Use"
      left="document"
      right="shield"
      cta={false}
      intro={
        <p>
          Last updated {LEGAL_UPDATED}. These terms apply when you use Signcerely to send, sign or check documents. By using it, you agree to them. If
          you don’t agree, please don’t use the service. Questions? Email {mail}.
        </p>
      }
    >
      <h2>1. What Signcerely does</h2>
      <p>
        Signcerely lets you send a PDF for signing, collect signatures in the order you choose, and keep a signed copy. It records fingerprints of the
        files and each signature on Stellar, a public network, so anyone can later check whether a copy is the signed version.
      </p>

      <h2>2. What Signcerely doesn’t do</h2>
      <ul>
        <li>
          <strong>It doesn’t check identity.</strong> A signature shows that a specific wallet account, reached through a specific invited email,
          approved a specific file at a specific time. Names are typed by the sender and confirmed by the signer, and aren’t checked against an ID.
        </li>
        <li>
          <strong>It isn’t a party to your agreements</strong> and doesn’t review what’s in them.
        </li>
        <li>
          <strong>It doesn’t give legal advice.</strong> Whether an electronic signature is valid or enforceable depends on where you are and what
          you’re signing. For important agreements, ask a lawyer.
        </li>
        <li>
          <strong>It doesn’t store your documents on the public network.</strong> Only fingerprints are recorded there; the files themselves are kept
          in private storage.
        </li>
      </ul>

      <h2>3. Beta</h2>
      <p>
        Signcerely is in beta. Features may change, and things may not always work as expected. During beta, records are kept on Stellar’s test
        network, which is meant for testing and may be reset from time to time. Always keep your own copy of important documents.
      </p>

      <h2>4. Your account and wallet</h2>
      <ul>
        <li>You sign in and approve signatures with your own wallet. You are responsible for keeping it, and its recovery details, safe.</li>
        <li>We never have your wallet’s secret key, so we can’t sign for you, and we can’t recover your wallet if you lose access to it.</li>
        <li>You’re responsible for what is done through your account, and for using a name and email address that are really yours.</li>
      </ul>

      <h2>5. Using Signcerely fairly</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use it for anything illegal, fraudulent or misleading,</li>
        <li>sign, or try to sign, a spot meant for someone else, or pretend to be someone you aren’t,</li>
        <li>upload files you don’t have the right to share, or files that contain malware,</li>
        <li>send invites to people who aren’t part of a real agreement, or use invites to spam or harass anyone,</li>
        <li>try to break, overload or get around the security of the service.</li>
      </ul>

      <h2>6. Your documents</h2>
      <p>
        You keep ownership of the documents and signatures you upload. You allow us to store them, process them and show or send them to the people on
        the document, only as needed to run the service. When you add signers, you confirm you may share their names and email addresses with us for
        that purpose. How we handle personal information is described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>7. The public record</h2>
      <p>
        When you send or sign a document, its fingerprints, the signing wallet addresses and times are written to a public network. This record is
        permanent: it can’t be changed or deleted by you, by us or by anyone else, even if your account or the document is deleted.
      </p>

      <h2>8. Fees</h2>
      <p>
        Sending and checking documents is free during beta. Each transaction on the network has a small fee, paid from your own wallet; during beta
        it’s paid in free test XLM. If we introduce charges, we’ll tell you before they apply to you.
      </p>

      <h2>9. Changes and availability</h2>
      <p>
        We may change, pause or stop parts of the service. We’ll try to give notice of major changes, but we can’t promise the service will always be
        available or free of errors. We may suspend accounts that break these terms.
      </p>

      <h2>10. No warranty</h2>
      <p>
        Signcerely is provided “as is” and “as available”, without warranties of any kind, to the fullest extent the law allows. We don’t promise that
        it will meet your needs, or that a signature made with it will be accepted for any particular purpose.
      </p>

      <h2>11. Limits on liability</h2>
      <p>
        To the fullest extent the law allows, Signcerely isn’t liable for indirect or consequential losses, lost data or profits, or disputes between
        the people on a document, arising from your use of the service. Nothing in these terms limits liability that can’t be limited by law.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        If we change these terms, we’ll update the date at the top of this page, and tell you by email or in the app if the change is significant.
        Using Signcerely after a change means you accept the new terms.
      </p>

      <h2>13. Contact</h2>
      <p>Questions about these terms: {mail}.</p>
    </ContentPage>
  );
}
