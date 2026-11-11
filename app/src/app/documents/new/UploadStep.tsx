"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AlertIcon, ArrowRight, CheckIcon, Spinner } from "@/components/icons";
import { PageStepper } from "@/components/PageStepper";
import { PdfPage } from "@/components/PdfPage";
import { MAX_PDF_BYTES, prettyBytes } from "@/lib/doc-rules";
import { loadPdf, looksLikePdf, sha256Hex } from "@/lib/pdf";
import { browserStorage } from "@/lib/supabase-browser";
import { createDraft, finishUpload } from "./actions";
import { friendlyError } from "@/lib/errors";

type Picked = { file: File; buf: ArrayBuffer; pdf: PDFDocumentProxy; hash: string };

function titleFromFilename(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function UploadStep() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState<null | "preparing" | "uploading" | "checking">(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_PDF_BYTES) return setError(`That file is ${prettyBytes(file.size)}. PDFs can be up to 10 MB.`);
    setReading(true);
    try {
      const buf = await file.arrayBuffer();
      if (!looksLikePdf(buf)) throw new Error("That file isn’t a PDF.");
      const [pdf, hash] = await Promise.all([loadPdf(buf), sha256Hex(buf)]);
      setPicked({ file, buf, pdf, hash });
      setPage(1);
      if (!title) setTitle(titleFromFilename(file.name));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/password/i.test(msg) ? "This PDF is password-protected. Remove the password and try again." : msg.includes("PDF") ? msg : "We couldn’t open that PDF. It may be damaged.");
    } finally {
      setReading(false);
    }
  }

  async function submit() {
    if (!picked) return;
    setError(null);
    if (!title.trim()) return setError("Give the document a title.");
    try {
      setSaving("preparing");
      const draft = await createDraft({
        title,
        summary,
        pageCount: picked.pdf.numPages,
        sha256: picked.hash,
        size: picked.file.size,
      });
      if (!draft.ok) throw new Error(draft.error);

      setSaving("uploading");
      const { error: upErr } = await browserStorage()
        .from("documents")
        .uploadToSignedUrl(draft.path, draft.token, new Blob([picked.buf], { type: "application/pdf" }), {
          contentType: "application/pdf",
        });
      if (upErr) throw new Error("The upload failed. Check your connection and try again.");

      setSaving("checking");
      const done = await finishUpload(draft.id);
      if (!done.ok) throw new Error(done.error);
      router.push(`/documents/${draft.id}/signers`);
    } catch (e) {
      setError(friendlyError(e));
      setSaving(null);
    }
  }

  const busyLabel =
    saving === "preparing" ? "Saving draft…" : saving === "uploading" ? "Uploading…" : saving === "checking" ? "Checking file…" : null;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))", gap: 40, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 className="h" style={{ fontSize: 32, fontWeight: 700 }}>
              Upload your agreement
            </h2>
            <p className="muted" style={{ fontSize: 17 }}>
              PDF only, up to 10 MB. Signers will see exactly this file.
            </p>
          </div>

          <input
            ref={input}
            id="pdf"
            type="file"
            accept="application/pdf,.pdf"
            className="visually-hidden"
            onChange={(e) => choose(e.target.files?.[0])}
          />

          {picked ? (
            <div className="card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, boxShadow: "none" }}>
              <span style={{ flex: "none", width: 48, height: 48, borderRadius: 10, background: "var(--blue-tint)", color: "var(--blue)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12 }}>
                PDF
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{picked.file.name}</p>
                <p className="help" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckIcon size={16} color="#1F9D61" /> {picked.pdf.numPages} {picked.pdf.numPages === 1 ? "page" : "pages"} ·{" "}
                  {prettyBytes(picked.file.size)}
                </p>
              </div>
              <label htmlFor="pdf" className="btn btn-secondary" style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }}>
                Replace
              </label>
            </div>
          ) : (
            <label
              htmlFor="pdf"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void choose(e.dataTransfer.files?.[0]);
              }}
              style={{
                border: `2px dashed ${dragOver ? "var(--blue)" : "#AEBBE3"}`,
                background: dragOver ? "var(--blue-tint)" : "#fff",
                borderRadius: 16,
                padding: "40px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              {reading ? <Spinner size={28} /> : null}
              <span className="btn btn-primary" style={{ pointerEvents: "none" }}>
                {reading ? "Opening…" : "Choose a PDF"}
              </span>
              <span className="help">or drag it here</span>
            </label>
          )}

          <div className="field">
            <label htmlFor="title" className="label">
              Document title
            </label>
            <input id="title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            <p className="help">This is what signers see in their email and on their dashboard.</p>
          </div>

          <div className="field">
            <label htmlFor="summary" className="label">
              What signers are agreeing to <span style={{ fontWeight: 500, color: "var(--ink-3)" }}>(optional)</span>
            </label>
            <textarea
              id="summary"
              className="input"
              rows={4}
              maxLength={300}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              style={{ height: "auto", padding: "12px 14px", resize: "vertical", lineHeight: 1.45 }}
            />
            <p className="help" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>A short, plain summary shown next to the document.</span>
              <span>{summary.length} / 300</span>
            </p>
          </div>

          {error && (
            <p className="note note-red" role="alert">
              <AlertIcon />
              <span>{error}</span>
            </p>
          )}
        <div className="wizard-footer" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" disabled={!picked || Boolean(saving)} onClick={submit} aria-busy={Boolean(saving)}>
            {busyLabel ? (
              <>
                <Spinner /> {busyLabel}
              </>
            ) : (
              <>
                Continue to signers <ArrowRight />
              </>
            )}
          </button>
        </div>
        </div>

        <section aria-label="Document preview" style={{ background: "#E9EDF5", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 12, }}>
          {picked ? (
            <>
              <div style={{ boxShadow: "0 1px 3px rgba(15,27,61,.08),0 12px 32px rgba(15,27,61,.10)" }}>
                <PdfPage pdf={picked.pdf} pageNumber={page} />
              </div>
              {picked.pdf.numPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <PageStepper page={page} pageCount={picked.pdf.numPages} onChange={setPage} />
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                margin: "0 auto",
                aspectRatio: "8.5 / 13",
                background: "#fff",
                border: "1.5px dashed #C3CCE3",
                borderRadius: 6,
                display: "grid",
                placeItems: "center",
                padding: 24,
              }}
            >
              <p className="help" style={{ textAlign: "center" }}>
                Your PDF will show here.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
