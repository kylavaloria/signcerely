"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";
import { AlertIcon, SignatureIcon, Spinner } from "@/components/icons";
import { PdfPage } from "@/components/PdfPage";
import { SIGNER_COLORS, type FieldInput } from "@/lib/doc-rules";
import { loadPdf } from "@/lib/pdf";

type Signer = { id: string; slot: number; name: string };

/** Read-only look at the PDF with every signature box, so the sender can check placement before sending. */
export function ReviewPreview({
  pdfUrl,
  pageCount,
  signers,
  fields,
}: {
  pdfUrl: string;
  pageCount: number;
  signers: Signer[];
  fields: FieldInput[];
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState(false);
  const firstWithBoxes = fields.length ? Math.min(...fields.map((f) => f.page)) : 1;
  const [page, setPage] = useState(firstWithBoxes);

  useEffect(() => {
    let alive = true;
    loadPdf(pdfUrl)
      .then((p) => alive && setPdf(p))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [pdfUrl]);

  const signerOf = (id: string) => signers.find((s) => s.id === id);
  const onPage = fields.filter((f) => f.page === page);
  const countOnPage = (p: number) => fields.filter((f) => f.page === p).length;

  return (
    <div className="card" style={{ boxShadow: "none", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-3)" }}>Preview</p>

      {pageCount > 1 && (
        <nav aria-label="Pages" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              className={p === page ? "btn btn-primary" : "btn btn-secondary"}
              aria-current={p === page ? "page" : undefined}
              onClick={() => setPage(p)}
              style={{ minHeight: 44, padding: "0 14px" }}
            >
              Page {p}
              {countOnPage(p) > 0 ? ` · ${countOnPage(p)}` : ""}
            </button>
          ))}
        </nav>
      )}

      <div style={{ background: "#E3E8F2", borderRadius: 12, padding: "clamp(10px, 3vw, 20px)" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          {loadError ? (
            <p className="note note-red">
              <AlertIcon />
              <span>We couldn’t load the preview. Refresh to try again.</span>
            </p>
          ) : !pdf ? (
            <div style={{ aspectRatio: "1 / 1.294", background: "#fff", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
              <Spinner size={28} />
            </div>
          ) : (
            <div style={{ position: "relative", boxShadow: "0 1px 3px rgba(15,27,61,.08),0 16px 40px rgba(15,27,61,.10)" }}>
              <PdfPage pdf={pdf} pageNumber={page} />
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {onPage.map((f, i) => {
                  const s = signerOf(f.signerId);
                  const c = SIGNER_COLORS[(s?.slot ?? 0) % SIGNER_COLORS.length];
                  return (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: `${f.x * 100}%`,
                        top: `${f.y * 100}%`,
                        width: `${f.width * 100}%`,
                        height: `${f.height * 100}%`,
                        background: c.tint,
                        border: `1.5px dashed ${c.solid}`,
                        borderRadius: 6,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        padding: "4px 8px",
                        containerType: "size",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 5, color: c.solid, fontWeight: 700, fontSize: "clamp(9px, 14cqh, 13px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <SignatureIcon size={13} /> {s?.name ?? "Signer"}
                      </span>
                      <span style={{ fontSize: "clamp(8px, 12cqh, 11.5px)", color: "var(--ink-2)", borderTop: `1px dashed ${c.solid}`, paddingTop: 2, whiteSpace: "nowrap", overflow: "hidden" }}>
                        Date signed · added automatically
                      </span>
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
      </div>
    </div>
  );
}
