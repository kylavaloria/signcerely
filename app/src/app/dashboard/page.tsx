import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge, PageDecor, PixelArt } from "@/components/Decor";
import { PlusIcon } from "@/components/icons";
import { listDrafts, listFromOthers, listSent, listToSign, nextStepHref } from "@/lib/documents";
import { requireUser } from "@/lib/profile";
import { DocumentsView, type DraftItem, type Listed } from "./DocumentsView";
import { EmailNotice } from "./EmailNotice";
import { noIndex } from "@/lib/site";

export const metadata: Metadata = { title: "Documents · Signcerely", robots: noIndex };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; deleted?: string; view?: string; q?: string; from?: string; page?: string }>;
}) {
  const user = await requireUser();
  const { email: emailFlag, deleted, view, q, from, page } = await searchParams;
  const me = user.wallet_address;
  const verifiedEmail = user.email_verified_at ? user.email : null;
  const [drafts, sent, toSign, fromOthers] = await Promise.all([
    listDrafts(user.wallet_address),
    listSent(user.wallet_address),
    listToSign(user.wallet_address, verifiedEmail),
    listFromOthers(user.wallet_address, verifiedEmail),
  ]);
  // "Sent by" choices: me, plus everyone who has sent me something to sign.
  const otherSenders = new Map<string, string>();
  for (const t of toSign) if (t.senderWallet !== me) otherSenders.set(t.senderWallet, t.senderName);
  for (const c of fromOthers) otherSenders.set(c.senderWallet, c.senderName);
  const senders = [
    { value: "me", label: "Me" },
    ...[...otherSenders].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const asListed = (c: (typeof fromOthers)[number]): Listed => ({ ...c, from: { name: c.senderName, wallet: c.senderWallet, signerId: c.signerId } });
  // Other people's documents still in progress where it isn't my move (already signed, or not my turn yet).
  // The ones waiting on me are in "Waiting for your signature".
  const signIds = new Set(toSign.map((t) => t.documentId));
  const waiting: Listed[] = [...sent.filter((d) => d.status === "pending"), ...fromOthers.filter((c) => c.status === "pending" && !signIds.has(c.id)).map(asListed)].sort(
    (a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""),
  );
  const closedAt = (d: Listed) => d.completed_at ?? d.updated_at;
  const closed: Listed[] = [...sent.filter((d) => d.status !== "pending"), ...fromOthers.filter((c) => c.status !== "pending").map(asListed)].sort((a, b) =>
    closedAt(b).localeCompare(closedAt(a)),
  );
  const draftItems: DraftItem[] = drafts.map((d) => ({ ...d, href: nextStepHref(d) }));
  const justSent = emailFlag === "sent" || emailFlag === "failed" ? emailFlag : null;
  const firstName = user.full_name.split(/\s+/)[0];
  const empty = drafts.length + sent.length + toSign.length + fromOthers.length === 0;

  return (
    <div style={{ minHeight: "100vh" }}>
      <SiteHeader current="documents" user={{ name: user.full_name, wallet: user.wallet_address }} />
      <PageDecor content={1200} left="document" right="check" leftChip="• your docs" rightChip="{ signed }" />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 className="h" style={{ fontSize: "clamp(30px, 6vw, 40px)", fontWeight: 700 }}>
              Welcome back, {firstName}
            </h1>
            <p className="muted" style={{ fontSize: 17 }}>
              Here’s everything you’ve sent, saved and been asked to sign.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="decor-inline decor-float" style={{ display: "inline-flex", ["--tilt" as string]: "-8deg" }}>
              <PixelArt name="pen" pixel={4} />
            </span>
            <Link className="btn btn-primary" href="/documents/new">
              <PlusIcon /> New document
            </Link>
          </div>
        </div>

        {!user.email_verified_at && user.email && <EmailNotice email={user.email} justSent={justSent} />}
        {deleted && (
          <p className="note" role="status" style={{ background: "#fff", border: "1px solid var(--line)" }}>
            Draft deleted.
          </p>
        )}

        {empty ? (
          <section
            className="card"
            aria-labelledby="empty-title"
            style={{ padding: "56px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}
          >
            <Badge name="document" size={104} pixel={5} />
            <h2 id="empty-title" className="h" style={{ fontSize: 26, fontWeight: 700 }}>
              No documents yet
            </h2>
            <p className="muted" style={{ maxWidth: 460 }}>
              Upload a PDF, choose who signs and in what order, and we’ll email each person when it’s their turn.
            </p>
            <Link className="btn btn-primary" href="/documents/new">
              <PlusIcon /> Upload a PDF
            </Link>
          </section>
        ) : (
          <>
            <DocumentsView
              me={me}
              toSign={toSign}
              waiting={waiting}
              drafts={draftItems}
              closed={closed}
              senders={senders}
              initial={{ view, q, from, page }}
            />
          </>
        )}
      </main>
    </div>
  );
}
