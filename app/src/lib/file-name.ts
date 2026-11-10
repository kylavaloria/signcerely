/**
 * File name for a downloaded signed copy: "Affidavit Template" → "affidavit-template-signed.pdf".
 * Only letters, numbers, "-" and "_" are kept. Brackets and spaces get
 * percent-encoded in the download header (it showed up as "%28signed%29"),
 * so they are never used.
 */
export function signedFileName(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "") // é → e
    .replace(/\.pdf$/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${base || "document"}-signed.pdf`;
}
