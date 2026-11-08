"use client";

import Link from "next/link";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AlertIcon, ArrowRight, CheckIcon, SignatureIcon, Spinner } from "@/components/icons";
import { PdfPage } from "@/components/PdfPage";
import { BOX_HEIGHT, BOX_WIDTH, SIGNER_COLORS, type FieldInput } from "@/lib/doc-rules";
import { loadPdf } from "@/lib/pdf";
import { saveSpots } from "./actions";
import { friendlyError, rethrowNext } from "@/lib/errors";

type Signer = { id: string; slot: number; name: string };
type Box = FieldInput & { key: string };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 10000) / 10000;
let keySeq = 0;
const newKey = () => `b${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export function SpotsEditor({
  documentId,
  pdfUrl,
  pageCount,
  signers,
  initial,
}: {
  documentId: string;
  pdfUrl: string;
  pageCount: number;
  signers: Signer[];
  initial: FieldInput[];
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(pageCount); // signature blocks are usually on the last page
  const [who, setWho] = useState(signers[0]?.id ?? "");
  const [boxes, setBoxes] = useState<Box[]>(() => initial.map((f) => ({ ...f, key: newKey() })));
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: string; dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    loadPdf(pdfUrl)
      .then((p) => alive && setPdf(p))
      .catch(() => alive && setLoadError("We couldn’t load the PDF. Refresh to try again."));
    return () => {
      alive = false;
    };
  }, [pdfUrl]);

  const colorOf = (signerId: string) => {
    const s = signers.find((x) => x.id === signerId);
    return SIGNER_COLORS[(s?.slot ?? 0) % SIGNER_COLORS.length];
  };
  const nameOf = (signerId: string) => signers.find((x) => x.id === signerId)?.name ?? "Signer";
  const countFor = (signerId: string) => boxes.filter((b) => b.signerId === signerId).length;
  const onPage = boxes.filter((b) => b.page === page);
  const missing = signers.filter((s) => countFor(s.id) === 0);

  const pointToFrac = (clientX: number, clientY: number) => {
    const r = surface.current!.getBoundingClientRect();
    return { fx: (clientX - r.left) / r.width, fy: (clientY - r.top) / r.height };
  };

  function placeAt(fx: number, fy: number) {
    if (!who) return;
    const b: Box = {
      key: newKey(),
      signerId: who,
      page,
      width: BOX_WIDTH,
      height: BOX_HEIGHT,
      x: round(clamp(fx - BOX_WIDTH / 2, 0, 1 - BOX_WIDTH)),
      y: round(clamp(fy - BOX_HEIGHT / 2, 0, 1 - BOX_HEIGHT)),
    };
    setBoxes((bs) => [...bs, b]);
    setSelected(b.key);
  }

  const remove = useCallback((key: string) => {
    setBoxes((bs) => bs.filter((b) => b.key !== key));
    setSelected(null);
  }, []);

  const nudge = useCallback((key: string, dx: number, dy: number) => {
    setBoxes((bs) =>
      bs.map((b) =>
        b.key === key
          ? { ...b, x: round(clamp(b.x + dx, 0, 1 - b.width)), y: round(clamp(b.y + dy, 0, 1 - b.height)) }
          : b,
      ),
    );
  }, []);

  function onSurfacePointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return; // clicks on boxes are handled by the box
    const { fx, fy } = pointToFrac(e.clientX, e.clientY);
    placeAt(fx, fy);
  }

  function onBoxPointerDown(e: React.PointerEvent, b: Box) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { fx, fy } = pointToFrac(e.clientX, e.clientY);
    drag.current = { key: b.key, dx: fx - b.x, dy: fy - b.y, moved: false };
    setSelected(b.key);
  }

  function onBoxPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const { fx, fy } = pointToFrac(e.clientX, e.clientY);
    d.moved = true;
    setBoxes((bs) =>
      bs.map((b) =>
        b.key === d.key
          ? { ...b, x: round(clamp(fx - d.dx, 0, 1 - b.width)), y: round(clamp(fy - d.dy, 0, 1 - b.height)) }
          : b,
      ),
    );
  }

  function onBoxKeyDown(e: React.KeyboardEvent, b: Box) {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      nudge(b.key, ...moves[e.key]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove(b.key);
    }
  }

  function save(skip: boolean) {
    setError(null);
    start(async () => {
      try {
        const r = await saveSpots(
          documentId,
          boxes.map(({ signerId, page, x, y, width, height }) => ({ signerId, page, x, y, width, height })),
          skip,
        );
        if (r?.error) setError(r.error);
      } catch (e) {
        rethrowNext(e);
        setError(friendlyError(e));
      }
    });
  }

  return (
    <>
      <p className="note note-yellow mobile-only">
        <span>Placing boxes is easiest on a computer. On a phone, tap the page to drop a box, then drag it into place.</span>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 className="h" style={{ fontSize: 32, fontWeight: 700 }}>
          Show each person where to sign
        </h2>
        <p className="muted" style={{ fontSize: 17 }}>
          Pick a signer, then click (or tap) on the page where they should sign. Drag a box to move it. The date is added under it
          automatically when they sign.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <aside aria-label="Signers and tools" style={{ flex: "0 1 290px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }} role="radiogroup" aria-label="Who signs here?">
            <p className="tag">1 · Who signs here?</p>
            {signers.map((s) => {
              const c = SIGNER_COLORS[s.slot % SIGNER_COLORS.length];
              const on = who === s.id;
              const n = countFor(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setWho(s.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: 12,
                    borderRadius: 12,
                    background: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    font: "inherit",
                    color: "var(--navy)",
                    border: on ? `2px solid ${c.solid}` : "1px solid var(--line)",
                    boxShadow: on ? `0 0 0 3px ${c.tint}` : "none",
                  }}
                >
                  <span style={{ flex: "none", width: 14, height: 14, borderRadius: 4, background: c.solid }} aria-hidden="true" />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontWeight: 700, fontSize: 15 }}>{s.name}</span>
                    <span style={{ display: "block", fontSize: 13, color: "var(--ink-3)" }}>
                      {n === 0 ? "No box yet" : `${n} signature ${n === 1 ? "box" : "boxes"}`}
                    </span>
                  </span>
                  {n > 0 && <CheckIcon size={18} color="#1F9D61" />}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p className="tag">2 · Click on the page</p>
            <p className="help">
              Using a keyboard? Tab to a box, move it with the arrow keys (Shift for bigger steps), and press Delete to remove it.
            </p>
          </div>

          <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, boxShadow: "none" }} role="status">
            {missing.length === 0 ? (
              <p style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700, fontSize: 15 }}>
                <CheckIcon size={18} color="#1F9D61" /> Every signer has a box
              </p>
            ) : (
              <p style={{ fontSize: 14.5, color: "var(--ink-2)" }}>
                Still needs a box: <strong>{missing.map((s) => s.name).join(", ")}</strong>
              </p>
            )}
            <p className="help">
              No signature lines in your PDF?{" "}
              <button type="button" onClick={() => save(true)} disabled={pending} style={{ border: 0, background: "none", padding: 0, font: "inherit", color: "var(--blue)", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
                Skip this step
              </button>{" "}
              — signatures will go on the summary page of the signed copy.
            </p>
          </div>
        </aside>

        <section className="spots-layout" aria-label={`Page ${page} of ${pageCount}`} style={{ flex: "999 1 560px", minWidth: 0, background: "#E3E8F2", borderRadius: 16, padding: "clamp(10px, 3vw, 20px)" }}>
          <nav aria-label="Pages" className="spots-pages">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
              const n = boxes.filter((b) => b.page === p).length;
              return (
                <button
                  key={p}
                  type="button"
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Page ${p}${n ? `, ${n} ${n === 1 ? "box" : "boxes"}` : ""}`}
                  onClick={() => {
                    setPage(p);
                    setSelected(null);
                  }}
                  style={{
                    position: "relative",
                    flex: "none",
                    width: 52,
                    height: 66,
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    font: "600 14px var(--font-body)",
                    color: "var(--ink-2)",
                    border: p === page ? "2px solid var(--blue)" : "1px solid #DCE2F0",
                  }}
                >
                  {p}
                  {n > 0 && (
                    <span style={{ position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, background: "var(--yellow)", color: "var(--navy)", fontSize: 11.5, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 5px" }}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div style={{ flex: 1, minWidth: 0, maxWidth: 760, margin: "0 auto" }}>
            {loadError ? (
              <p className="note note-red">
                <AlertIcon />
                <span>{loadError}</span>
              </p>
            ) : !pdf ? (
              <div style={{ aspectRatio: "1 / 1.294", background: "#fff", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
                <Spinner size={28} />
              </div>
            ) : (
              <div style={{ position: "relative", boxShadow: "0 1px 3px rgba(15,27,61,.08),0 16px 40px rgba(15,27,61,.10)" }}>
                <PdfPage pdf={pdf} pageNumber={page} />
                <div
                  ref={surface}
                  onPointerDown={onSurfacePointerDown}
                  style={{ position: "absolute", inset: 0, cursor: "crosshair", touchAction: "none" }}
                >
                  {onPage.map((b) => {
                    const c = colorOf(b.signerId);
                    const sel = selected === b.key;
                    return (
                      <div
                        key={b.key}
                        role="button"
                        tabIndex={0}
                        aria-label={`${nameOf(b.signerId)}'s signature box. Arrow keys move it, Delete removes it.`}
                        onPointerDown={(e) => onBoxPointerDown(e, b)}
                        onPointerMove={onBoxPointerMove}
                        onPointerUp={() => (drag.current = null)}
                        onFocus={() => setSelected(b.key)}
                        onKeyDown={(e) => onBoxKeyDown(e, b)}
                        style={{
                          position: "absolute",
                          left: `${b.x * 100}%`,
                          top: `${b.y * 100}%`,
                          width: `${b.width * 100}%`,
                          height: `${b.height * 100}%`,
                          background: c.tint,
                          border: sel ? `2px solid ${c.solid}` : `1.5px dashed ${c.solid}`,
                          boxShadow: sel ? `0 0 0 4px ${c.tint}` : "none",
                          borderRadius: 6,
                          cursor: "grab",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          padding: "4px 8px",
                          overflow: "visible",
                          containerType: "size",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 5, color: c.solid, fontWeight: 700, fontSize: "clamp(9px, 14cqh, 13px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <SignatureIcon size={13} /> {nameOf(b.signerId)}
                        </span>
                        <span style={{ fontSize: "clamp(8px, 12cqh, 11.5px)", color: "var(--ink-2)", borderTop: `1px dashed ${c.solid}`, paddingTop: 2, whiteSpace: "nowrap", overflow: "hidden" }}>
                          Date signed · added automatically
                        </span>
                        {sel && (
                          <button
                            type="button"
                            aria-label={`Remove ${nameOf(b.signerId)}'s box`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => remove(b.key)}
                            style={{ position: "absolute", top: -40, right: 0, height: 34, padding: "0 10px", borderRadius: 8, border: 0, background: "var(--navy)", color: "#fff", font: "600 13px var(--font-body)", cursor: "pointer" }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="help" style={{ textAlign: "center", marginTop: 10 }} aria-live="polite">
              Page {page} of {pageCount}
            </p>
          </div>
        </section>
      </div>

      {error && (
        <p className="note note-red" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </p>
      )}

      <div className="wizard-footer">
        <Link className="btn btn-ghost" href={`/documents/${documentId}/signers`}>
          Back
        </Link>
        <button type="button" className="btn btn-primary" onClick={() => save(false)} disabled={pending || missing.length > 0} aria-busy={pending}>
          {pending ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            <>
              Continue to review <ArrowRight />
            </>
          )}
        </button>
      </div>
    </>
  );
}
