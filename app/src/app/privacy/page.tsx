import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";
import { CONTACT_EMAIL, LEGAL_UPDATED, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "/privacy",
  "Privacy Policy · Signcerely",
  "What Signcerely collects, what goes on the public record, who can see your documents, and how to ask for your data to be deleted.",
);

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Privacy Policy"
      left="shield"
      right="document"
      cta={false}
      intro={
        <p>
          Last updated {LEGAL_UPDATED}. This policy explains what Signcerely collects when you send, sign or check a document, what is recorded on a
          public network, and the choices you have. Questions? Email {mail}.
        </p>
      }
    >
      <h2>The short version</h2>
      <ul>
        <li>Your PDFs, names and email addresses are kept in private storage. Only you and the people on a document can open it.</li>
        <li>
          Only <strong>fingerprints</strong> of files and signatures, wallet addresses and times are written to the public network. They can’t be
          deleted by anyone, including us.
        </li>
        <li>We don’t sell your data, show ads, or use tracking or analytics cookies.</li>
        <li>You can ask us to see, correct or delete your data at {mail}.</li>
      </ul>

      <h2>What we collect</h2>
      <h3>Your account</h3>
      <ul>
        <li>Your wallet’s public address, which is how you sign in. We never see or store your wallet’s secret key.</li>
        <li>Your name and email address, and whether you’ve confirmed the email.</li>
        <li>If you choose “save for next time”, an image of your signature.</li>
      </ul>
      <h3>Documents you send</h3>
      <ul>
        <li>The PDF, its title and the short summary you write.</li>
        <li>Each signer’s name and email address, the signing order and where each signature box goes.</li>
        <li>
          What happens to the document: when it was sent, when each signer was invited, opened it, signed or declined, reminders, and the reason given
          when someone declines.
        </li>
        <li>The final signed copy, once everyone has signed.</li>
      </ul>
      <h3>When you sign</h3>
      <ul>
        <li>The image of your signature as it appears on the document, the wallet address that signed and the time.</li>
      </ul>
      <h3>Technical information</h3>
      <ul>
        <li>A one-time sign-in code linked to your wallet address, which expires shortly after it’s created.</li>
        <li>Links we email you to confirm your address, which also expire.</li>
        <li>
          Like most websites, our hosting provider may record technical details of requests, such as IP address, browser type and time, to keep the
          service running and secure.
        </li>
      </ul>
      <p>
        When you check a document on the <Link href="/verify">Verify page</Link>, the file never leaves your device. Your browser calculates its
        fingerprint and only that is looked up.
      </p>

      <h2>What goes on the public record</h2>
      <p>
        To make signatures checkable by anyone, Signcerely writes a small record to Stellar, a public network. For each document this record contains:
      </p>
      <ul>
        <li>a document ID and the fingerprint of the original file,</li>
        <li>the public half of each signer’s one-time invite key,</li>
        <li>for each signature: the signer’s wallet address, a fingerprint of the signature image, and the time,</li>
        <li>the fingerprint of the final signed copy, and the document’s status.</li>
      </ul>
      <p>
        Names, email addresses, titles and the documents themselves are <strong>not</strong> written to the public network. A fingerprint can’t be
        turned back into the file. But this record is public and permanent: anyone can read it, and neither we nor anyone else can change or delete
        it. Wallet addresses don’t show your name, but they could be linked to you by someone who knows your address.
      </p>

      <h2>Who can see what</h2>
      <ul>
        <li>
          <strong>The sender and invited signers</strong> can open the document and see the other signers’ names, email addresses and progress.
        </li>
        <li>
          <strong>Anyone who has a copy of the file or the document’s verification link</strong> can see its title, the sender’s name, each signer’s
          name, whether and when they signed, and a shortened wallet address. They can’t open the document or see email addresses.
        </li>
        <li>
          <strong>Anyone else</strong>, signed in or not, can’t open a document. Following an invite link while signed in to a different account only
          shows who invited whom.
        </li>
      </ul>
      <p>Private pages such as invites, documents and your dashboard are marked so search engines don’t list them.</p>

      <h2>How we use it</h2>
      <ul>
        <li>
          To run the service: create documents, email invites, reminders and notifications, build the signed copy and answer verification checks.
        </li>
        <li>To make sure only the invited person can sign their spot, and that each confirmed email belongs to one account.</li>
        <li>To keep the service secure and fix problems.</li>
      </ul>
      <p>We don’t sell your data, use it for advertising, or share it except as described here.</p>

      <h2>Services we rely on</h2>
      <ul>
        <li>
          <strong>Supabase</strong> stores our database and files (PDFs and signature images) in private storage.
        </li>
        <li>
          <strong>Vercel</strong> hosts the website.
        </li>
        <li>
          <strong>Resend</strong> sends our emails, so it receives recipients’ addresses and email content.
        </li>
        <li>
          <strong>Stellar</strong> is the public network that keeps the record described above.
        </li>
        <li>
          <strong>Varial</strong> is the wallet you use to sign in and approve signatures. It’s run separately and has its own privacy policy.
        </li>
      </ul>

      <h2>Cookies and browser storage</h2>
      <p>
        We use one essential cookie to keep you signed in. It lasts up to 7 days and is removed when you sign out. When you open an invite link, its
        one-time key is kept in your browser’s session storage for that tab, so you can still sign after signing in. We don’t use analytics,
        advertising or tracking cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and documents for as long as you use Signcerely, so senders and signers can download their signed copies and verification
        keeps working. Sign-in codes and email confirmation links expire on their own. If you ask us to delete your data, we’ll delete what we can.
        Two limits apply: the public record can’t be deleted by anyone, and a document you were part of also belongs to the other people on it, who
        may already have their own copies.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Choose whether to save your signature for next time when you sign.</li>
        <li>Ask us for a copy of your data, or to correct or delete it, by emailing {mail}. We aim to reply within 30 days.</li>
      </ul>

      <h2>Security</h2>
      <p>
        The database is reached only by our servers, never directly from your browser. Files are kept in private storage, invite keys are stored
        encrypted, and the site is served over HTTPS. Every signature must be approved with the signer’s own wallet, so we can’t sign on anyone’s
        behalf. No system is perfectly secure, but we work to protect your information.
      </p>

      <h2>Beta</h2>
      <p>
        Signcerely is in beta. During beta, records are kept on Stellar’s test network, which is meant for testing and may be reset from time to time.
        Keep your own copy of anything important.
      </p>

      <h2>Children</h2>
      <p>Signcerely isn’t meant for children. Please don’t use it to send or sign documents on behalf of a child.</p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy, we’ll update the date at the top of this page, and tell you by email or in the app if the change is significant.
      </p>

      <h2>Contact</h2>
      <p>Questions or requests about your privacy: {mail}.</p>
      <p>
        See also our <Link href="/terms">Terms of Use</Link>.
      </p>
    </ContentPage>
  );
}
