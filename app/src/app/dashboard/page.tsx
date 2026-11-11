import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ArrowRight, PlusIcon, SignatureIcon } from "@/components/icons";
import { listDrafts, listSent, listToSign, nextStepHref, type DraftSummary, type SentDoc, type ToSign } from "@/lib/documents";
import { requireUser } from "@/lib/profile";
import { ActiveTabIntoView } from "./ActiveTabIntoView";
import { DocFilters } from "./DocFilters";
import { EmailNotice } from "./EmailNotice";
import { Pagination } from "./Pagination";

export const metadata: Metadata = { title: "Documents · Signcerely" };

type Signer = { invited_name: string; status: string; slot: number };
type Tab = "sign" | "waiting" | "drafts" | "closed";
const TABS: { key: Tab; label: string }[] = [
  { key: "sign", label: "Waiting for your signature" },
  { key: "waiting", label: "Waiting for others" },
  { key: "drafts", label: "Drafts" },
  { key: "closed", label: "Completed and closed" },
];

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const signedCount = (signers: Signer[]) => signers.filter((s) => s.status === "signed").length;

/** Who signs next: the first unsigned person in order, or "Anyone left" when order doesn't matter. */
function nextUp(signers: Signer[], inOrder: boolean): string {
  const left = signers.filter((s) => s.status !== "signed");
  if (left.length === 0) return "—";
  if (!inOrder) return left.length === signers.length ? "Everyone" : left.map((s) => s.invited_name).join(", ");
  return left[0].invited_name;
}

const pill = (bg: string, fg: string): React.CSSProperties => ({
  flex: "none",
  height: 24,
  padding: "0 10px",
  borderRadius: 999,
  background: bg,
  color: fg,
  fontSize: 12.5,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
});

const actionBtn: React.CSSProperties = { minHeight: 40, padding: "0 14px", fontSize: 14 };

function Progress({ signers }: { signers: Signer[] }) {
  const signed = signedCount(signers);
  return (
    <div aria-label={`${signed} of ${signers.length} signed`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {signers.map((s, i) => (
        <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: s.status === "signed" ? "var(--green)" : "#DCE2F0" }} />
      ))}
    </div>
  );
}

/** One labelled detail: the name on the left, the value on the right. */
function Details({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="doc-details">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Card({
  title,
  badge,
  summary,
  details,
  progress,
  action,
  tone = "plain",
}: {
  title: React.ReactNode;
  badge: React.ReactNode;
  summary?: string | null;
  details: [string, React.ReactNode][];
  progress?: React.ReactNode;
  action: React.ReactNode;
  tone?: "plain" | "sign";
}) {
  return (
    <article className={`card doc-card${tone === "sign" ? " doc-card-sign" : ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <h3 style={{ fontSize: 16.5, overflowWrap: "anywhere" }}>{title}</h3>
        {badge}
      </div>
      {summary && <p className="doc-summary">{summary}</p>}
      {progress}
      <Details rows={details} />
      <div className="doc-card-foot">{action}</div>
    </article>
  );
}

function SignCard({ t, me }: { t: ToSign; me: string }) {
  return (
    <Card
      tone="sign"
      title={t.title}
      badge={<span style={pill("var(--yellow)", "var(--navy)")}>Your sign</span>}
      summary={t.summary}
      details={[
        ["Sent by", t.senderWallet === me ? "You" : t.senderName],
        ["Signers", t.signers.map((s) => s.invited_name).join(", ") || "—"],
        ["Signing order", t.inOrder ? "One after another" : "All at once"],
        ["Pages", t.pageCount ?? "—"],
        ["Received", day(t.invitedAt)],
      ]}
      action={
        <Link className="btn btn-sign" style={actionBtn} href={`/sign/${t.signerId}`}>
          Review and sign <ArrowRight size={16} />
        </Link>
      }
    />
  );
}

function WaitingCard({ d }: { d: SentDoc }) {
  return (
    <Card
      title={
        <Link href={`/documents/${d.id}`} style={{ color: "var(--navy)", textDecoration: "none" }}>
          {d.title}
        </Link>
      }
      badge={<span style={pill("var(--blue-tint)", "var(--blue)")}>Waiting</span>}
      summary={d.summary}
      progress={<Progress signers={d.signers} />}
      details={[
        ["Sent by", "You"],
        ["Signed", `${signedCount(d.signers)} of ${d.signers.length}`],
        ["Next up", nextUp(d.signers, d.in_order)],
        ["Signers", d.signers.map((s) => s.invited_name).join(", ")],
        ["Signing order", d.in_order ? "One after another" : "All at once"],
        ["Pages", d.page_count ?? "—"],
        ["Sent", day(d.sent_at)],
      ]}
      action={
        <Link className="btn btn-secondary" style={actionBtn} href={`/documents/${d.id}`}>
          View
        </Link>
      }
    />
  );
}

function DraftCard({ d }: { d: DraftSummary }) {
  const step = d.signer_count < 2 ? "Add signers" : d.field_count === 0 ? "Place signature boxes" : "Review and send";
  return (
    <Card
      title={d.title}
      badge={<span style={pill("var(--line-2)", "var(--ink-2)")}>Draft</span>}
      summary={d.summary}
      details={[
        ["Sent by", "You"],
        ["Next step", step],
        ["Signers", d.signer_count],
        ["Signature boxes", d.field_count],
        ["Pages", d.page_count ?? "—"],
        ["Last edited", day(d.updated_at)],
      ]}
      action={
        <Link className="btn btn-secondary" style={actionBtn} href={nextStepHref(d)}>
          Continue
        </Link>
      }
    />
  );
}

function ClosedCard({ d }: { d: SentDoc }) {
  const label = d.status === "completed" ? "Completed" : d.status === "declined" ? "Declined" : "Cancelled";
  const style =
    d.status === "completed"
      ? pill("var(--green-tint)", "var(--green-ink)")
      : d.status === "declined"
        ? pill("#FBE9E9", "#A82E2E")
        : pill("var(--line-2)", "var(--ink-2)");
  return (
    <Card
      title={d.title}
      badge={<span style={style}>{label}</span>}
      summary={d.summary}
      progress={<Progress signers={d.signers} />}
      details={[
        ["Sent by", "You"],
        ["Signed", `${signedCount(d.signers)} of ${d.signers.length}`],
        ["Signers", d.signers.map((s) => s.invited_name).join(", ")],
        ["Pages", d.page_count ?? "—"],
        ["Sent", day(d.sent_at)],
        [label, day(d.completed_at ?? d.updated_at)],
      ]}
      action={
        <Link className="btn btn-secondary" style={actionBtn} href={`/documents/${d.id}`}>
          View
        </Link>
      }
    />
  );
}

const EMPTY_TAB: Record<Tab, string> = {
  sign: "Nothing is waiting for your signature.",
  waiting: "No one owes you a signature right now.",
  drafts: "No drafts. Anything you start and save shows up here.",
  closed: "Finished, declined and cancelled documents will show up here.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; deleted?: string; view?: string; q?: string; from?: string; page?: string }>;
}) {
  const user = await requireUser();
  const { email: emailFlag, deleted, view, q: rawQ, from: rawFrom, page: rawPage } = await searchParams;
  const me = user.wallet_address;
  const verifiedEmail = user.email_verified_at ? user.email : null;
  const [drafts, sent, toSign] = await Promise.all([
    listDrafts(user.wallet_address),
    listSent(user.wallet_address),
    listToSign(user.wallet_address, verifiedEmail),
  ]);
  // "Sent by" choices: me, plus everyone who has sent me something to sign.
  const otherSenders = new Map<string, string>();
  for (const t of toSign) if (t.senderWallet !== me) otherSenders.set(t.senderWallet, t.senderName);
  const senders = [
    { value: "me", label: "Me" },
    ...[...otherSenders].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const q = (rawQ ?? "").trim().toLowerCase();
  const from = rawFrom === "me" || (rawFrom && otherSenders.has(rawFrom)) ? rawFrom : "";
  const filtering = Boolean(q || from);
  const titleOk = (title: string) => !q || title.toLowerCase().includes(q);
  const mineOk = from === "" || from === "me"; // everything I sent or drafted is from me
  const senderOk = (wallet: string) => from === "" || (from === "me" ? wallet === me : wallet === from);

  const signList = toSign.filter((t) => titleOk(t.title) && senderOk(t.senderWallet));
  const waiting = sent.filter((d) => d.status === "pending" && mineOk && titleOk(d.title));
  const closed = sent.filter((d) => d.status !== "pending" && mineOk && titleOk(d.title));
  const draftList = drafts.filter((d) => mineOk && titleOk(d.title));
  const counts: Record<Tab, number> = { sign: signList.length, waiting: waiting.length, drafts: draftList.length, closed: closed.length };
  const justSent = emailFlag === "sent" || emailFlag === "failed" ? emailFlag : null;
  const firstName = user.full_name.split(/\s+/)[0];
  const empty = drafts.length + sent.length + toSign.length === 0;

  const requested = TABS.find((t) => t.key === view)?.key;
  const tab: Tab = requested ?? TABS.find((t) => counts[t.key] > 0)?.key ?? "sign";

  const PAGE_SIZE = 6;
  const pages = Math.max(1, Math.ceil(counts[tab] / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(rawPage)) || 1));
  const slice = <T,>(list: T[]) => list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const keep: Record<string, string> = { view: tab };
  if (rawQ?.trim()) keep.q = rawQ.trim();
  if (from) keep.from = from;
  const hrefWith = (extra: Record<string, string>) => `/dashboard?${new URLSearchParams({ ...keep, ...extra }).toString()}`;

  return (
    <div style={{ minHeight: "100vh" }}>
      <SiteHeader current="documents" user={{ name: user.full_name, wallet: user.wallet_address }} />
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
          <Link className="btn btn-primary" href="/documents/new">
            <PlusIcon /> New document
          </Link>
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
            <span style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--yellow-tint)", display: "grid", placeItems: "center", color: "var(--navy)" }}>
              <SignatureIcon size={30} />
            </span>
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
            <DocFilters senders={senders} />

            <nav aria-label="Filter documents" className="doc-tabs">
              {TABS.map((t) => (
                <Link
                  key={t.key}
                  href={hrefWith({ view: t.key })}
                  scroll={false}
                  aria-current={t.key === tab ? "page" : undefined}
                  className={`doc-tab${t.key === tab ? " is-active" : ""}${t.key === "sign" && counts.sign > 0 ? " has-attention" : ""}`}
                >
                  {t.label}
                  <span className="doc-tab-count">{counts[t.key]}</span>
                </Link>
              ))}
            </nav>
            <ActiveTabIntoView active={tab} />

            <section aria-label={TABS.find((t) => t.key === tab)!.label}>
              {counts[tab] === 0 ? (
                <p className="card muted" style={{ boxShadow: "none", padding: "40px 24px", textAlign: "center" }}>
                  {filtering ? "No documents here match your search." : EMPTY_TAB[tab]}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="doc-grid">
                    {tab === "sign" && slice(signList).map((t) => <SignCard key={t.signerId} t={t} me={me} />)}
                    {tab === "waiting" && slice(waiting).map((d) => <WaitingCard key={d.id} d={d} />)}
                    {tab === "drafts" && slice(draftList).map((d) => <DraftCard key={d.id} d={d} />)}
                    {tab === "closed" && slice(closed).map((d) => <ClosedCard key={d.id} d={d} />)}
                  </div>
                  <Pagination page={page} pageSize={PAGE_SIZE} total={counts[tab]} hrefFor={(n) => hrefWith({ page: String(n) })} keep={keep} />
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
