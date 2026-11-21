import type { Metadata } from "next";
import Link from "next/link";
import { Clip } from "@/components/Clip";
import { ContentPage } from "@/components/ContentPage";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "/how-it-works",
  "How to sign a PDF online and prove who signed · Signcerely",
  "See how Signcerely works, step by step: upload a PDF, choose who signs and in what order, sign, and get a signed copy anyone can check.",
);

const steps = [
  {
    clip: "step-1-upload",
    title: "Upload your PDF",
    body: (
      <>
        <p>
          Choose the PDF you want signed (up to 10 MB), give it a title, and add a one-line summary of what people are agreeing to. Every signer sees
          exactly this file, so nobody can be shown a different version later.
        </p>
      </>
    ),
  },
  {
    clip: "step-2-signers",
    title: "Choose who signs, and in what order",
    body: (
      <p>
        Add each signer’s name and email, from 2 up to 20 people. You can include yourself. Then pick <strong>One after another</strong>, so each
        person is invited only when the one before them has signed, or <strong>All at once</strong>, so everyone is invited right away.
      </p>
    ),
  },
  {
    clip: "step-3-boxes",
    title: "Place the signature boxes",
    body: (
      <p>
        Pick a signer and click the page where their signature should go. The date is added under every signature automatically. If your document
        has no signature lines, you can skip this step and the signatures go on a summary page at the end of the signed copy.
      </p>
    ),
  },
  {
    clip: "step-4-send",
    title: "Review and send",
    body: (
      <p>
        Check the file, the signers and the boxes, then approve once in your wallet. Signcerely records the file’s fingerprint on a public network
        and locks the file, so everyone signs the same version. Signers are invited by email.
      </p>
    ),
  },
  {
    clip: "step-5-sign",
    title: "Each person signs",
    body: (
      <>
        <p>
          Each signer gets an email when it’s their turn. They review the document, draw their signature or upload a photo of it (and can save it
          for next time), then approve it in their Varial wallet.
        </p>
        <p>
          Only the person who was invited can sign their spot: signing needs the account whose email the invite was sent to. A signer can also
          decline with a reason, and the sender is told why.
        </p>
      </>
    ),
  },
  {
    clip: "step-6-signed-copy",
    title: "Everyone gets the signed copy",
    body: (
      <p>
        When the last person signs, Signcerely creates the final PDF with every signature and date stamped on it, plus a summary page listing who
        signed and when. Its fingerprint is recorded too, and everyone is emailed the signed copy. You can download it from the document page at
        any time.
      </p>
    ),
  },
  {
    clip: "step-7-verify",
    title: "Anyone can check it",
    body: (
      <p>
        Anyone you share the signed copy with can upload it on the <Link href="/verify">Verify page</Link> to see who signed it and when, and
        whether it has been changed. They don’t need an account, and the file never leaves their device. Read more in{" "}
        <Link href="/verify-a-signed-pdf">how to check if a signed PDF was changed</Link>.
      </p>
    ),
  },
];

export default function HowItWorksPage() {
  return (
    <ContentPage
      eyebrow="How it works"
      title="How to sign a PDF online and prove who signed"
      intro={
        <p>
          Signcerely works like the e-signature tools you know: upload, invite, sign. The difference is the proof. Every signature is recorded on a
          public record that nobody can quietly edit, so anyone can check a signed copy later without asking us.
        </p>
      }
    >
      {steps.map((s, i) => (
        <section key={s.clip} className="step" aria-labelledby={`step-${i + 1}`}>
          <span className="step-num" aria-hidden="true">
            {i + 1}
          </span>
          <h2 id={`step-${i + 1}`}>{s.title}</h2>
          <div>{s.body}</div>
          <Clip name={s.clip} label={`Screen recording: ${s.title.toLowerCase()} in Signcerely`} />
        </section>
      ))}

      <h2>What gets recorded, and what doesn’t</h2>
      <p>
        Your PDF is never published. It stays in private storage that only the sender and the invited signers can open. What goes on the public
        record is a <strong>fingerprint</strong> of the file: a short code calculated from its exact contents. Change even one character and the
        fingerprint changes completely.
      </p>
      <ul>
        <li>The fingerprint of the original file you sent</li>
        <li>For each signer: the account that signed, a fingerprint of their signature image, and the time</li>
        <li>The fingerprint of the final signed copy</li>
      </ul>
      <p>
        That record is kept on Stellar, a public network. Signcerely can’t edit or delete it, which is why a copy can be checked without trusting
        us.
      </p>

      <h2>What you need</h2>
      <ul>
        <li>
          <strong>A PDF</strong> of the agreement, up to 10 MB.
        </li>
        <li>
          <strong>The signers’ names and email addresses.</strong>
        </li>
        <li>
          <strong>A free Varial wallet</strong>, which works in your browser. It acts as your personal signing key, so only you can sign as you.{" "}
          <a href="https://varialwallet.com" target="_blank" rel="noopener noreferrer">
            Get Varial
          </a>
          .
        </li>
      </ul>
      <p>
        Have a question that isn’t covered here? See the <Link href="/faq">FAQ</Link>.
      </p>
    </ContentPage>
  );
}
