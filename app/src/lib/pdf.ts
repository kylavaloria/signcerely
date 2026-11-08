"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

/** Load a PDF in the browser with pdf.js (worker served from /pdf.worker.min.mjs). */
export async function loadPdf(source: ArrayBuffer | string): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task =
    typeof source === "string"
      ? pdfjs.getDocument({ url: source })
      : // pdf.js takes ownership of the buffer, so give it a copy.
        pdfjs.getDocument({ data: new Uint8Array(source.slice(0)) });
  return task.promise;
}

/** SHA-256 of the file bytes, as lowercase hex (the document's fingerprint). */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Quick check that the bytes look like a PDF (header "%PDF-"). */
export function looksLikePdf(buf: ArrayBuffer): boolean {
  const head = new Uint8Array(buf.slice(0, 5));
  return String.fromCharCode(...head) === "%PDF-";
}
