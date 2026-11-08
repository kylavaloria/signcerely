"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertIcon, ArrowRight, InfoIcon, PlusIcon, Spinner } from "@/components/icons";
import { MAX_SIGNERS, MIN_SIGNERS } from "@/lib/doc-rules";
import { saveSigners, type SignersResult } from "./actions";

type Row = { key: number; name: string; email: string };

const iconBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "#fff",
  color: "var(--ink-2)",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

const Arrow = ({ up }: { up?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {up ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M12 5v14M6 13l6 6 6-6" />}
  </svg>
);

export function SignersStep({
  documentId,
  title,
  me,
  initial,
  initialInOrder,
}: {
  documentId: string;
  title: string;
  me: { name: string; email: string | null };
  initial: { name: string; email: string }[];
  initialInOrder: boolean;
}) {
  const seed: Row[] = (initial.length ? initial : [{ name: me.name, email: me.email ?? "" }, { name: "", email: "" }]).map(
    (r, i) => ({ key: i, ...r }),
  );
  const [rows, setRows] = useState<Row[]>(seed);
  const [nextKey, setNextKey] = useState(seed.length);
  const [inOrder, setInOrder] = useState(initialInOrder);
  const [result, setResult] = useState<SignersResult>({});
  const [pending, start] = useTransition();

  const myEmail = me.email?.toLowerCase() ?? null;
  const isMe = (r: Row) => myEmail !== null && r.email.trim().toLowerCase() === myEmail;
  const includesMe = rows.some(isMe);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const j = i + d;
      if (j < 0 || j >= rs.length) return rs;
      const copy = rs.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const add = (row?: Partial<Row>) => {
    setRows((rs) => [...rs, { key: nextKey, name: row?.name ?? "", email: row?.email ?? "" }]);
    setNextKey((k) => k + 1);
  };

  function submit() {
    setResult({});
    start(async () => {
      const r = await saveSigners(documentId, { inOrder, signers: rows.map(({ name, email }) => ({ name, email })) });
      if (r) setResult(r);
    });
  }

  const fe = result.fieldErrors ?? {};
  const filled = rows.filter((r) => r.name.trim());

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 40, alignItems: "flex-start" }}>
        <div style={{ flex: "999 1 600px", minWidth: 0, display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 className="h" style={{ fontSize: 32, fontWeight: 700 }}>
              Who needs to sign?
            </h2>
            <p className="muted" style={{ fontSize: 17 }}>
              Add {MIN_SIGNERS} to {MAX_SIGNERS} people. Each one gets an email invitation to sign.
            </p>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <legend style={{ fontSize: 16, fontWeight: 700, padding: 0, marginBottom: 12 }}>Signing order</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {[
                { v: true, t: "One after another", d: "Each person is invited after the one before them signs." },
                { v: false, t: "All at once", d: "Everyone is invited now and can sign in any order." },
              ].map((o) => (
                <label
                  key={o.t}
                  style={{
                    flex: "1 1 260px",
                    display: "flex",
                    gap: 14,
                    padding: 18,
                    borderRadius: 12,
                    cursor: "pointer",
                    border: `1.5px solid ${inOrder === o.v ? "var(--blue)" : "#DCE2F0"}`,
                    background: inOrder === o.v ? "#F7F9FF" : "#fff",
                  }}
                >
                  <input type="radio" name="order" checked={inOrder === o.v} onChange={() => setInOrder(o.v)} style={{ width: 20, height: 20, accentColor: "var(--blue)", marginTop: 2 }} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>{o.t}</span>
                    <span style={{ fontSize: 14.5, color: "var(--ink-3)" }}>{o.d}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <section aria-labelledby="sg-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 id="sg-h" style={{ fontSize: 16 }}>
                Signers
              </h3>
              <span className="help">
                {rows.length} of {MAX_SIGNERS}
              </span>
            </div>

            {rows.map((r, i) => {
              const me = isMe(r);
              const err = fe[i] ?? {};
              return (
                <div key={r.key} className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "flex-start", boxShadow: "none" }}>
                  <span
                    aria-label={inOrder ? `Signs ${["first", "second", "third", "fourth", "fifth"][i]}` : `Signer ${i + 1}`}
                    style={{ flex: "none", width: 32, height: 32, borderRadius: "50%", background: "var(--blue)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14, marginTop: 28 }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 12 }}>
                    <div className="field" style={{ gap: 6 }}>
                      <label htmlFor={`n${r.key}`} style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", display: "flex", gap: 8, alignItems: "center" }}>
                        Full name
                        {me && (
                          <span style={{ height: 22, padding: "0 8px", borderRadius: 999, background: "var(--blue-tint)", color: "var(--blue)", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center" }}>
                            You
                          </span>
                        )}
                      </label>
                      <input
                        id={`n${r.key}`}
                        className="input"
                        value={r.name}
                        onChange={(e) => update(r.key, { name: e.target.value })}
                        autoComplete="off"
                        aria-invalid={Boolean(err.name)}
                        style={{ height: 48 }}
                      />
                      {err.name && <p className="error-text">{err.name}</p>}
                    </div>
                    <div className="field" style={{ gap: 6 }}>
                      <label htmlFor={`e${r.key}`} style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>
                        Email
                      </label>
                      <input
                        id={`e${r.key}`}
                        className="input"
                        type="email"
                        value={r.email}
                        onChange={(e) => update(r.key, { email: e.target.value })}
                        autoComplete="off"
                        aria-invalid={Boolean(err.email)}
                        style={{ height: 48 }}
                      />
                      {err.email && <p className="error-text">{err.email}</p>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, paddingTop: 26 }}>
                    <button type="button" style={iconBtn} aria-label={`Move ${r.name || `signer ${i + 1}`} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <Arrow up />
                    </button>
                    <button type="button" style={iconBtn} aria-label={`Move ${r.name || `signer ${i + 1}`} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                      <Arrow />
                    </button>
                    <button
                      type="button"
                      style={iconBtn}
                      aria-label={`Remove ${r.name || `signer ${i + 1}`}`}
                      disabled={rows.length <= MIN_SIGNERS}
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {rows.length < MAX_SIGNERS && (
              <button
                type="button"
                className="btn btn-block"
                style={{ background: "#fff", color: "var(--blue)", border: "1.5px dashed #AEBBE3" }}
                onClick={() => add()}
              >
                <PlusIcon /> Add another signer
              </button>
            )}
            {!includesMe && me.email && rows.length < MAX_SIGNERS && (
              <button type="button" className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => add({ name: me.name, email: me.email ?? "" })}>
                <PlusIcon /> Add myself
              </button>
            )}
            <p className="help">
              You need at least {MIN_SIGNERS} signers{rows.length <= MIN_SIGNERS ? ", so remove is turned off for now" : ""}. Use the arrows to
              change the order.
            </p>
            <p className="note" style={{ background: "#fff", border: "1px solid var(--line)" }}>
              <InfoIcon />
              <span>
                The name you type here is how they’re invited. When they sign in for the first time, they confirm or correct it — the signed
                copy shows the name they chose, with their email and wallet.
              </span>
            </p>
          </section>

          {(result.error || Object.keys(fe).length > 0) && (
            <p className="note note-red" role="alert">
              <AlertIcon />
              <span>{result.error ?? "Fix the highlighted fields."}</span>
            </p>
          )}
        </div>

        <aside aria-label="Document" style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 20, boxShadow: "none" }}>
            <p className="tag">Document</p>
            <p style={{ fontWeight: 700 }}>{title}</p>
          </div>
          <div style={{ background: "var(--blue-tint)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontWeight: 700 }}>How signing will go</p>
            <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: 14.5, color: "var(--ink-2)" }}>
              {inOrder ? (
                <>
                  {filled.slice(0, 1).map((r) => (
                    <li key={r.key}>
                      <strong style={{ color: "var(--navy)" }}>{r.name}</strong> signs first{isMe(r) ? " (that’s you)" : ""}
                    </li>
                  ))}
                  {filled.slice(1).map((r) => (
                    <li key={r.key}>
                      <strong style={{ color: "var(--navy)" }}>{r.name}</strong> is invited after that
                    </li>
                  ))}
                </>
              ) : (
                <li>Everyone is invited at the same time and can sign in any order</li>
              )}
              <li>Everyone gets the signed copy when the last person signs</li>
            </ol>
          </div>
        </aside>
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid var(--line)", margin: "0 -24px", padding: "14px 24px", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <Link className="btn btn-ghost" href="/dashboard">
          Save &amp; exit
        </Link>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={pending} aria-busy={pending}>
          {pending ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            <>
              Continue to signature spots <ArrowRight />
            </>
          )}
        </button>
      </div>
    </>
  );
}
