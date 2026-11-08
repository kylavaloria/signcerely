"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertIcon, CheckIcon, SignatureIcon, Spinner } from "@/components/icons";
import { PdfPage } from "@/components/PdfPage";
import { SIGNER_COLORS } from "@/lib/doc-rules";
import { loadPdf } from "@/lib/pdf";
import { signTx } from "@/lib/wallet";
import { addTestXlm } from "@/app/documents/[id]/review/send-actions";
import { AdoptSignature, type Adopted } from "./AdoptSignature";
import { DeclineButton } from "./DeclineButton";
import { prepareSign, submitSign } from "./actions";

export type ViewField = { id: string; signerId: string; page: number; x: number; y: number; width: number; height: number };
export type ViewSigner = {
  id: string;
  slot: number;
  name: string;
  status: string;
  signedLabel: string | null;
  imageUrl: string | null;
};

type Props = {
  signerId: string;
  wallet: string | null;
  canSign: boolean;
  blockedReason: string | null;
  pdfUrl: string;
  pageCount: number;
  fields: ViewField[];
  signers: ViewSigner[];
  myName: string;
  today: string;
  savedSignatureUrl: string | null;
  canDecline: boolean;
  senderName: string;
};

type Phase = "idle" | "preparing" | "wallet" | "recording" | "funding";
const LABEL: Record<Phase, string> = {
  idle: "Finish — sign with Varial",
  preparing: "Preparing…",
  wallet: "Approve in Varial…",
  recording: "Recording on Stellar…",
  funding: "Adding test XLM…",
};

export function SigningView(p: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const myFields = p.fields.filter((f) => f.signerId === p.signerId);
  const [page, setPage] = useState(myFields[0]?.page ?? 1);
  const [adopted, setAdopted] = useState<Adopted | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsFunds, setNeedsFunds] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPdf(p.pdfUrl)
      .then((d) => alive && setPdf(d))
      .catch(() => alive && setLoadError("We couldn’t load the PDF. Refresh to try again."));
    return () => {
      alive = false;
    };
  }, [p.pdfUrl]);

  const signerOf = (id: string) => p.signers.find((s) => s.id === id);
  const onPage = p.fields.filter((f) => f.page === page);
  const pagesWithMine = [...new Set(myFields.map((f) => f.page))].sort((a, b) => a - b);
  const done = adopted ? myFields.length : 0;
  const busy = phase !== "idle";

  async function finish() {
    if (!adopted) return dialog.current?.showModal();
    setError(null);
    setNeedsFunds(false);
    try {
      setPhase("preparing");
      const prep = await prepareSign(p.signerId, {
        pngBase64: adopted.pngBase64,
        kind: adopted.kind,
        saveToProfile: adopted.saveToProfile,
      });
      if (!prep.ok) {
        setNeedsFunds(Boolean(prep.needsFunds));
        throw new Error(prep.error);
      }
      setPhase("wallet");
      const signed = await signTx(prep.xdr, p.wallet!);
      if ("error" in signed) {
        throw new Error(signed.error.kind === "declined" ? "You declined in Varial. Nothing was recorded." : signed.error.message);
      }
      setPhase("recording");
      const res = await submitSign(p.signerId, signed.signedXdr);
      if (!res.ok) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }

  async function fund() {
    setPhase("funding");
    const r = await addTestXlm();
    setPhase("idle");
    if (!r.ok) return setError(r.error);
    setNeedsFunds(false);
    void finish();
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
      <AdoptSignature ref={dialog} signerName={p.myName} today={p.today} savedSignatureUrl={p.savedSignatureUrl} onAdopt={setAdopted} />

      <section aria-label={`Page ${page} of ${p.pageCount}`} style={{ flex: "999 1 600px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card" style={{ boxShadow: "none", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ minHeight: 40, padding: "0 12px" }} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              ‹
            </button>
            <span style={{ fontWeight: 600, fontSize: 14.5 }} aria-live="polite">
              Page {page} of {p.pageCount}
            </span>
            <button type="button" className="btn btn-secondary" style={{ minHeight: 40, padding: "0 12px" }} disabled={page >= p.pageCount} onClick={() => setPage(page + 1)} aria-label="Next page">
              ›
            </button>
          </div>
          {pagesWithMine.length > 0 && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span className="help">Your boxes:</span>
              {pagesWithMine.map((pg) => (
                <button key={pg} type="button" className="btn btn-ghost" style={{ minHeight: 36, padding: "0 10px", fontSize: 13.5, background: pg === page ? "var(--yellow-tint)" : undefined }} onClick={() => setPage(pg)}>
                  Page {pg}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: "#E3E8F2", borderRadius: 14, padding: "clamp(10px, 3vw, 28px)" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", position: "relative", boxShadow: "0 1px 3px rgba(15,27,61,.08),0 16px 40px rgba(15,27,61,.10)" }}>
            {loadError ? (
              <p className="note note-red">
                <AlertIcon />
                <span>{loadError}</span>
              </p>
            ) : !pdf ? (
              <div style={{ aspectRatio: "1 / 1.294", background: "#fff", display: "grid", placeItems: "center" }}>
                <Spinner size={28} />
              </div>
            ) : (
              <>
                <PdfPage pdf={pdf} pageNumber={page} />
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {onPage.map((f) => {
                    const s = signerOf(f.signerId);
                    const mine = f.signerId === p.signerId;
                    const box: React.CSSProperties = {
                      position: "absolute",
                      left: `${f.x * 100}%`,
                      top: `${f.y * 100}%`,
                      width: `${f.width * 100}%`,
                      height: `${f.height * 100}%`,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      containerType: "size",
                    };
                    const img = mine ? adopted?.dataUrl : s?.status === "signed" ? s.imageUrl : null;
                    const dateLabel = mine ? (adopted ? `Signed ${p.today}` : null) : s?.signedLabel;
                    if (mine && !adopted && p.canSign && !p.blockedReason) {
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => dialog.current?.showModal()}
                          style={{
                            ...box,
                            pointerEvents: "auto",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 6,
                            flexDirection: "row",
                            border: "2px solid #E0B000",
                            background: "var(--yellow-tint)",
                            borderRadius: 8,
                            boxShadow: "0 0 0 4px rgba(255,210,63,.35)",
                            cursor: "pointer",
                            font: "700 clamp(10px, 28cqh, 16px) var(--font-body)",
                            color: "var(--navy)",
                          }}
                        >
                          <SignatureIcon size={18} /> Sign here
                        </button>
                      );
                    }
                    if (img) {
                      return (
                        <div key={f.id} style={box}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt={`${mine ? "Your" : `${s?.name}'s`} signature`} style={{ maxWidth: "100%", maxHeight: "70%", objectFit: "contain", objectPosition: "left bottom" }} />
                          <span style={{ fontFamily: "Georgia, serif", fontSize: "clamp(7px, 18cqh, 12px)", borderTop: "1px solid #1C2440", color: "#1C2440", whiteSpace: "nowrap" }}>
                            {dateLabel}
                          </span>
                          {mine && (
                            <button
                              type="button"
                              onClick={() => dialog.current?.showModal()}
                              disabled={busy}
                              style={{ pointerEvents: "auto", position: "absolute", right: 0, top: -34, height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #C7D0EC", background: "#fff", font: "600 12.5px var(--font-body)", color: "var(--blue)", cursor: "pointer" }}
                            >
                              Change
                            </button>
                          )}
                        </div>
                      );
                    }
                    const c = SIGNER_COLORS[(s?.slot ?? 0) % SIGNER_COLORS.length];
                    return (
                      <div key={f.id} style={{ ...box, border: `1.5px dashed ${c.solid}`, background: c.tint, borderRadius: 6, justifyContent: "center", padding: "0 8px" }}>
                        <span style={{ color: c.solid, fontWeight: 700, fontSize: "clamp(8px, 20cqh, 12.5px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {mine ? "Your signature" : `${s?.name ?? "Signer"} · waiting`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <aside aria-label="Your progress" style={{ flex: "1 1 320px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 16 }}>
        <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, boxShadow: "none" }}>
          {p.blockedReason ? (
            <p className="note note-yellow" role="status">
              <span>{p.blockedReason}</span>
            </p>
          ) : (
            <>
              <div>
                <p className="tag">Your signature {myFields.length === 1 ? "box" : "boxes"}</p>
                <p className="h" style={{ fontSize: 24, fontWeight: 700 }}>
                  {myFields.length === 0 ? (adopted ? "Signature added" : "No boxes on the page") : `${done} of ${myFields.length} done`}
                </p>
              </div>
              {myFields.length > 0 && (
                <div style={{ height: 8, borderRadius: 4, background: "var(--line-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(done / myFields.length) * 100}%`, background: "var(--green)" }} />
                </div>
              )}
              <p style={{ fontSize: 14.5, color: "var(--ink-2)" }}>
                {adopted
                  ? "All set. Finish to record your signature."
                  : myFields.length
                    ? "Click the yellow Sign here box to add your signature."
                    : "Your signature will go on the summary page of the signed copy."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--line-2)", paddingTop: 16 }}>
                {!adopted && (
                  <button type="button" className="btn btn-secondary btn-block" onClick={() => dialog.current?.showModal()}>
                    Add your signature
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sign btn-lg btn-block"
                  onClick={finish}
                  disabled={!adopted || busy}
                  aria-busy={busy}
                  style={!adopted ? { background: "var(--line-2)", color: "#8A93AD" } : undefined}
                >
                  {busy ? <Spinner /> : <SignatureIcon />} {LABEL[phase]}
                </button>
                <p className="help" style={{ textAlign: "center" }}>
                  {phase === "wallet"
                    ? "Varial shows the transaction. A small fee in test XLM applies."
                    : "You’ll approve in Varial before anything is recorded."}
                </p>
              </div>
            </>
          )}
          {p.canDecline && p.wallet && (
            <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 14 }}>
              <DeclineButton signerId={p.signerId} wallet={p.wallet} senderName={p.senderName} />
            </div>
          )}
          {error && (
            <p className="note note-red" role="alert">
              <AlertIcon />
              <span>
                {error}{" "}
                {needsFunds && (
                  <button type="button" onClick={fund} disabled={busy} style={{ border: 0, background: "none", padding: 0, font: "inherit", fontWeight: 700, color: "var(--blue)", textDecoration: "underline", cursor: "pointer" }}>
                    Add free test XLM
                  </button>
                )}
              </span>
            </p>
          )}
        </div>

        <div className="card" style={{ padding: 20, boxShadow: "none", display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="tag">Signers</p>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {p.signers.map((s) => (
              <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", background: SIGNER_COLORS[s.slot % 5].solid, color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700 }}>
                  {s.slot + 1}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 14.5 }}>
                    {s.name} {s.id === p.signerId && <span className="muted">(you)</span>}
                  </span>
                  <span className="help">{s.status === "signed" ? s.signedLabel : s.status === "declined" ? "Declined" : "Not signed yet"}</span>
                </span>
                {s.status === "signed" && <CheckIcon size={18} color="#1F9D61" />}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
