import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "/faq",
  "Frequently asked questions · Signcerely",
  "Answers about sending, signing and checking documents with Signcerely: cost, signers, wallets, privacy, and what a signature here proves.",
);

type QA = { q: string; a: string[] };

const groups: { title: string; items: QA[] }[] = [
  {
    title: "The basics",
    items: [
      {
        q: "What is Signcerely?",
        a: [
          "Signcerely is a way to send a PDF for signing and keep proof of who signed which version and when. It works like the e-signature tools you know: upload, invite, sign. The difference is that every signature is also recorded on a public record that nobody can quietly edit, so anyone can check a signed copy later.",
        ],
      },
      {
        q: "Does it cost anything?",
        a: [
          "Sending documents is free. Each signature has a very small network fee, paid from the signer’s wallet. During beta the fee is paid in free test XLM, and you can add some with one click if your wallet is empty. Checking a document is always free.",
        ],
      },
      {
        q: "Do I need any technical know-how?",
        a: [
          "No. You upload, invite and sign like any e-signature app, and the record is kept for you in the background. If you’re curious, every document has a “Technical details” section.",
        ],
      },
    ],
  },
  {
    title: "Sending a document",
    items: [
      { q: "What kind of file can I send?", a: ["A PDF of up to 10 MB."] },
      {
        q: "How many people can sign one document?",
        a: ["From 2 up to 20 signers. You can include yourself as one of them."],
      },
      {
        q: "Can I choose the order people sign in?",
        a: [
          "Yes. Choose “One after another” and each person is invited only after the one before them has signed, or “All at once” to invite everyone right away.",
        ],
      },
      {
        q: "Can I save a document and finish it later?",
        a: ["Yes. A document you haven’t sent yet is saved as a draft, and you can come back to any step from your dashboard."],
      },
      {
        q: "Someone hasn’t signed yet. What can I do?",
        a: [
          "From the document page you can send them a reminder email, or copy their invite link and send it yourself, for example in a chat. You can also cancel the document while it’s still waiting for signatures.",
        ],
      },
      {
        q: "Can I change a document after sending it?",
        a: [
          "No. Once it’s sent, the file is locked so everyone signs exactly the same version. If something needs to change, cancel it (or let the signer decline) and send the corrected PDF as a new document.",
        ],
      },
    ],
  },
  {
    title: "Signing",
    items: [
      {
        q: "What is Varial, and why do I need it?",
        a: [
          "Varial is a free, secure wallet that works in your browser. It acts as your personal signing key, so only you can sign as you. You also use it to sign in, instead of a password.",
        ],
      },
      {
        q: "How do I add my signature?",
        a: ["Draw it, or upload a photo of your signature. You can save it to use next time."],
      },
      {
        q: "Can someone else sign in my place?",
        a: [
          "No. Each signing spot can only be signed by the account whose email the invite was sent to, and an email address can be confirmed on only one account. Forwarding the invite link doesn’t let someone else sign.",
        ],
      },
      {
        q: "Can I refuse to sign?",
        a: ["Yes. You can decline with a reason. That stops the document, and the sender is emailed why."],
      },
      {
        q: "What happens when everyone has signed?",
        a: [
          "Signcerely creates the final PDF with every signature and date stamped on it, plus a summary page listing who signed and when. Everyone is emailed the signed copy, and it can be downloaded again from the document page.",
        ],
      },
    ],
  },
  {
    title: "Checking a document",
    items: [
      {
        q: "How can someone check that a PDF is the signed version?",
        a: [
          "They upload it on the Verify page. If it matches, they see who signed it and when. They don’t need an account or a wallet.",
        ],
      },
      {
        q: "Is my file uploaded when I check it?",
        a: ["No. Your browser calculates the file’s fingerprint and only that short code is looked up. The file stays on your device."],
      },
      {
        q: "Why does my copy say it doesn’t match?",
        a: [
          "The check compares exact fingerprints. A copy that was printed and scanned, saved again in another app, or edited in any way is a different file and won’t match, even if the words look the same. Use the signed copy you downloaded from Signcerely or received by email.",
        ],
      },
    ],
  },
  {
    title: "Privacy and trust",
    items: [
      {
        q: "Who can see my document?",
        a: [
          "Only you and the people you invite can open it. The public record keeps only a fingerprint of the file and the signatures, never the document itself.",
        ],
      },
      {
        q: "What exactly is recorded on the public record?",
        a: [
          "The fingerprint of the original file, the account that signed each spot with a fingerprint of the signature image and the time, and the fingerprint of the final signed copy. The record is kept on Stellar, a public network that Signcerely can’t edit.",
        ],
      },
      {
        q: "Is a signature here legally binding?",
        a: [
          "That depends on where you are and what you’re signing. Signcerely gives you a clear, tamper-proof record of who signed which version and when. It doesn’t check a signer’s ID. For high-stakes agreements, check with a lawyer.",
        ],
      },
    ],
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: groups.flatMap((g) =>
    g.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a.join(" ") } })),
  ),
};

export default function FaqPage() {
  return (
    <ContentPage
      eyebrow="FAQ"
      title="Frequently asked questions"
      left="star"
      right="magnifier"
      intro={
        <p>
          Everything about sending, signing and checking documents with Signcerely. New here? Start with{" "}
          <Link href="/how-it-works">how it works</Link>.
        </p>
      }
    >
      <script
        type="application/ld+json"
        // Static content defined above, no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h2>{g.title}</h2>
          <div className="card faq-list" style={{ padding: "4px 24px", boxShadow: "none" }}>
            {g.items.map((i) => (
              <details key={i.q}>
                <summary className="disclosure">{i.q}</summary>
                <div>
                  {i.a.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p style={{ marginTop: 32 }}>
        Want to check a document now? Go to the <Link href="/verify">Verify page</Link>, or read{" "}
        <Link href="/verify-a-signed-pdf">how checking a signed PDF works</Link>.
      </p>
    </ContentPage>
  );
}
