"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "@/components/icons";
import type { DraftSummary, SentDoc, ToSign } from "@/lib/documents";
import { ActiveTabIntoView } from "./ActiveTabIntoView";
import { DocFilters } from "./DocFilters";
import { Pagination } from "./Pagination";

type Signer = { invited_name: string; status: string; slot: number };
export type Tab = "sign" | "waiting" | "drafts" | "closed";
const TABS: { key: Tab; label: string }[] = [
  { key: "sign", label: "Waiting for your signature" },
  { key: "waiting", label: "Waiting for others" },
  { key: "drafts", label: "Drafts" },
  { key: "closed", label: "Completed and closed" },
];
const PAGE_SIZE = 6;

/** A document I sent, or one someone else sent me (then `from` says who, and View opens my copy). */
export type Listed = SentDoc & { from?: { name: string; wallet: string; signerId: string } };
/** A draft, with the link to the step where it should resume. */
export type DraftItem = DraftSummary & { href: string };

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";
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

function WaitingCard({ d }: { d: Listed }) {
  const href = d.from ? `/sign/${d.from.signerId}` : `/documents/${d.id}`;
  return (
    <Card
      title={
        <Link href={href} style={{ color: "var(--navy)", textDecoration: "none" }}>
          {d.title}
        </Link>
      }
      badge={<span style={pill("var(--blue-tint)", "var(--blue)")}>Waiting</span>}
      summary={d.summary}
      progress={<Progress signers={d.signers} />}
      details={[
        ["Sent by", d.from ? d.from.name : "You"],
        ["Signed", `${signedCount(d.signers)} of ${d.signers.length}`],
        ["Next up", nextUp(d.signers, d.in_order)],
        ["Signers", d.signers.map((s) => s.invited_name).join(", ")],
        ["Signing order", d.in_order ? "One after another" : "All at once"],
        ["Pages", d.page_count ?? "—"],
        ["Sent", day(d.sent_at)],
      ]}
      action={
        <Link className="btn btn-secondary" style={actionBtn} href={href}>
          View
        </Link>
      }
    />
  );
}

function DraftCard({ d }: { d: DraftItem }) {
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
        <Link className="btn btn-secondary" style={actionBtn} href={d.href}>
          Continue
        </Link>
      }
    />
  );
}

function ClosedCard({ d }: { d: Listed }) {
  const href = d.from ? `/sign/${d.from.signerId}` : `/documents/${d.id}`;
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
        ["Sent by", d.from ? d.from.name : "You"],
        ["Signed", `${signedCount(d.signers)} of ${d.signers.length}`],
        ["Signers", d.signers.map((s) => s.invited_name).join(", ")],
        ["Pages", d.page_count ?? "—"],
        ["Sent", day(d.sent_at)],
        [label, day(d.completed_at ?? d.updated_at)],
      ]}
      action={
        <Link className="btn btn-secondary" style={actionBtn} href={href}>
          View
        </Link>
      }
    />
  );
}

const EMPTY_TAB: Record<Tab, string> = {
  sign: "Nothing is waiting for your signature.",
  waiting: "Nothing is waiting on other people right now.",
  drafts: "No drafts. Anything you start and save shows up here.",
  closed: "Finished, declined and cancelled documents will show up here.",
};

/**
 * Tabs, search, "Sent by" and pages. Everything is already loaded, so this all
 * runs in the browser without asking the server again. The URL is kept in
 * step so links, refreshes and the back button still work.
 */
export function DocumentsView({
  me,
  toSign,
  waiting,
  drafts,
  closed,
  senders,
  initial,
}: {
  me: string;
  toSign: ToSign[];
  waiting: Listed[];
  drafts: DraftItem[];
  closed: Listed[];
  senders: { value: string; label: string }[];
  initial: { view?: string; q?: string; from?: string; page?: string };
}) {
  const validFrom = (f: string | undefined) => (f && senders.some((s) => s.value === f) ? f : "");
  const [q, setQ] = useState(initial.q ?? "");
  const [from, setFrom] = useState(validFrom(initial.from));
  const [view, setView] = useState<Tab | null>(TABS.find((t) => t.key === initial.view)?.key ?? null);
  const [page, setPage] = useState(Math.max(1, Math.floor(Number(initial.page)) || 1));

  const lists = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const titleOk = (title: string) => !needle || title.toLowerCase().includes(needle);
    const mineOk = from === "" || from === "me"; // everything I sent or drafted is from me
    const senderOk = (wallet: string) => from === "" || (from === "me" ? wallet === me : wallet === from);
    const listedOk = (d: Listed) => titleOk(d.title) && (d.from ? senderOk(d.from.wallet) : mineOk);
    return {
      sign: toSign.filter((t) => titleOk(t.title) && senderOk(t.senderWallet)),
      waiting: waiting.filter(listedOk),
      drafts: mineOk ? drafts.filter((d) => titleOk(d.title)) : [],
      closed: closed.filter(listedOk),
    };
  }, [q, from, me, toSign, waiting, drafts, closed]);

  const counts: Record<Tab, number> = {
    sign: lists.sign.length,
    waiting: lists.waiting.length,
    drafts: lists.drafts.length,
    closed: lists.closed.length,
  };
  // With no tab chosen, open the first one that has something in it.
  const tab: Tab = view ?? TABS.find((t) => counts[t.key] > 0)?.key ?? "sign";
  const pages = Math.max(1, Math.ceil(counts[tab] / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = <T,>(list: T[]) => list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filtering = Boolean(q.trim() || from);

  /** Keep the address bar in step without reloading anything. */
  const syncUrl = (next: { view?: Tab; q?: string; from?: string; page?: number }) => {
    const sp = new URLSearchParams(window.location.search);
    const set = (k: string, v: string | undefined) => (v ? sp.set(k, v) : sp.delete(k));
    if ("view" in next) set("view", next.view);
    if ("q" in next) set("q", next.q?.trim());
    if ("from" in next) set("from", next.from);
    if ("page" in next) set("page", next.page && next.page > 1 ? String(next.page) : undefined);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `/dashboard?${qs}` : "/dashboard");
  };

  const chooseTab = (t: Tab) => {
    setView(t);
    setPage(1);
    syncUrl({ view: t, page: 1 });
  };
  const changeQ = (v: string) => {
    setQ(v);
    setPage(1);
    syncUrl({ q: v, page: 1 });
  };
  const changeFrom = (v: string) => {
    setFrom(v);
    setPage(1);
    syncUrl({ from: v, page: 1 });
  };
  const changePage = (n: number) => {
    setPage(n);
    syncUrl({ page: n });
  };

  return (
    <>
      <DocFilters senders={senders} q={q} from={from} onQ={changeQ} onFrom={changeFrom} />

      <nav aria-label="Filter documents" className="doc-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => chooseTab(t.key)}
            aria-current={t.key === tab ? "true" : undefined}
            className={`doc-tab${t.key === tab ? " is-active" : ""}${t.key === "sign" && counts.sign > 0 ? " has-attention" : ""}`}
          >
            {t.label}
            <span className="doc-tab-count">{counts[t.key]}</span>
          </button>
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
              {tab === "sign" && slice(lists.sign).map((t) => <SignCard key={t.signerId} t={t} me={me} />)}
              {tab === "waiting" && slice(lists.waiting).map((d) => <WaitingCard key={d.from ? `${d.id}:${d.from.signerId}` : d.id} d={d} />)}
              {tab === "drafts" && slice(lists.drafts).map((d) => <DraftCard key={d.id} d={d} />)}
              {tab === "closed" && slice(lists.closed).map((d) => <ClosedCard key={d.from ? `${d.id}:${d.from.signerId}` : d.id} d={d} />)}
            </div>
            <Pagination page={current} pageSize={PAGE_SIZE} total={counts[tab]} onPage={changePage} />
          </div>
        )}
      </section>
    </>
  );
}
