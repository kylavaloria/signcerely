import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

/**
 * Builds the final signed copy: each signer's signature image and signing
 * date stamped into their boxes, plus a summary page listing who signed.
 * Box positions are fractions of the page measured from the top-left.
 */

export type FinalSigner = {
  id: string;
  name: string;
  email: string;
  wallet: string;
  signedAt: Date;
  imagePng: Uint8Array;
};

export type FinalField = { signerId: string; page: number; x: number; y: number; width: number; height: number };

export type FinalInput = {
  original: Uint8Array;
  title: string;
  originalHash: string;
  documentRef: string; // on-chain document id (hex)
  verifyUrl: string;
  signers: FinalSigner[]; // in signing order
  fields: FinalField[];
};

const NAVY = rgb(15 / 255, 27 / 255, 61 / 255);
const INK = rgb(51 / 255, 64 / 255, 106 / 255);
const LINE = rgb(227 / 255, 232 / 255, 242 / 255);

export function formatSignedDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
}

/** WinAnsi (standard fonts) can't draw every character; replace what it can't. */
function safe(font: PDFFont, text: string): string {
  const ok = (ch: string) => {
    try {
      font.encodeText(ch);
      return true;
    } catch {
      return false;
    }
  };
  return [...text]
    .map((ch) => {
      if (ok(ch)) return ch;
      // Drop accents and emoji variation selectors, else show "?".
      const plain = ch.normalize("NFD").replace(/[̀-ͯ️]/g, "");
      if (plain === "") return "";
      return ok(plain) ? plain : "?";
    })
    .join("");
}

function fitImage(img: PDFImage, maxW: number, maxH: number) {
  const s = Math.min(maxW / img.width, maxH / img.height);
  return { width: img.width * s, height: img.height * s };
}

function stampBox(page: PDFPage, f: FinalField, img: PDFImage, date: string, font: PDFFont) {
  const { width: pw, height: ph } = page.getSize();
  const bx = f.x * pw;
  const bw = f.width * pw;
  const bh = f.height * ph;
  const top = ph - f.y * ph; // pdf-lib's origin is bottom-left
  const dateH = Math.max(7, Math.min(10, bh * 0.22));
  const sigArea = { w: bw - 4, h: bh - dateH - 6 };
  const size = fitImage(img, sigArea.w, sigArea.h);
  page.drawImage(img, { x: bx + 2, y: top - 2 - size.height, width: size.width, height: size.height });
  const lineY = top - bh + dateH + 2;
  page.drawLine({ start: { x: bx, y: lineY }, end: { x: bx + bw, y: lineY }, thickness: 0.6, color: NAVY });
  page.drawText(safe(font, `Signed ${date}`), { x: bx + 1, y: top - bh + 1.5, size: dateH * 0.85, font, color: NAVY });
}

export async function buildFinalPdf(input: FinalInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input.original, { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const images = new Map<string, PDFImage>();
  for (const s of input.signers) images.set(s.id, await pdf.embedPng(s.imagePng));

  const pages = pdf.getPages();
  for (const f of input.fields) {
    const page = pages[f.page - 1];
    const signer = input.signers.find((s) => s.id === f.signerId);
    if (!page || !signer) continue;
    stampBox(page, f, images.get(signer.id)!, formatSignedDate(signer.signedAt), font);
  }

  // ---- summary page (A4) ----
  const A4: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(A4);
  const { width, height } = page.getSize();
  const m = 56;
  let y = height - m;
  const text = (t: string, opts: { size?: number; f?: PDFFont; color?: typeof NAVY; x?: number } = {}) => {
    const size = opts.size ?? 10;
    page.drawText(safe(opts.f ?? font, t), { x: opts.x ?? m, y, size, font: opts.f ?? font, color: opts.color ?? NAVY });
  };

  text("Signcerely", { size: 11, f: bold });
  y -= 30;
  text("Signature summary", { size: 22, f: bold });
  y -= 22;
  const title = input.title.length > 80 ? `${input.title.slice(0, 77)}...` : input.title;
  text(title, { size: 12, color: INK });
  y -= 26;
  page.drawLine({ start: { x: m, y }, end: { x: width - m, y }, thickness: 1, color: LINE });
  y -= 24;

  for (const s of input.signers) {
    const boxH = 92;
    if (y - boxH < m + 90) {
      // Out of room: carry on with the next signers on a new summary page.
      page = pdf.addPage(A4);
      y = height - m;
      text("Signature summary (continued)", { size: 14, f: bold });
      y -= 22;
      text(title, { size: 10, color: INK });
      y -= 20;
      page.drawLine({ start: { x: m, y }, end: { x: width - m, y }, thickness: 1, color: LINE });
      y -= 24;
    }
    const img = images.get(s.id)!;
    const size = fitImage(img, 150, 48);
    page.drawImage(img, { x: m, y: y - size.height, width: size.width, height: size.height });
    const cx = m + 170;
    text(s.name, { size: 12, f: bold, x: cx });
    y -= 15;
    text(s.email, { size: 9.5, color: INK, x: cx });
    y -= 13;
    text(`Signed ${formatSignedDate(s.signedAt)}`, { size: 9.5, color: INK, x: cx });
    y -= 13;
    text(`Wallet ${s.wallet}`, { size: 7.5, f: mono, color: INK, x: cx });
    y -= boxH - 41;
    page.drawLine({ start: { x: m, y: y + 14 }, end: { x: width - m, y: y + 14 }, thickness: 0.5, color: LINE });
  }

  y = m + 70;
  text("Original document fingerprint (SHA-256)", { size: 8, f: bold, color: INK });
  y -= 11;
  text(input.originalHash, { size: 7.5, f: mono, color: INK });
  y -= 14;
  text("On-chain document ID", { size: 8, f: bold, color: INK });
  y -= 11;
  text(input.documentRef, { size: 7.5, f: mono, color: INK });
  y -= 18;
  text(`Check this copy at ${input.verifyUrl} - each signature is recorded on Stellar.`, { size: 8.5, color: INK });

  pdf.setTitle(`${input.title} (signed)`);
  pdf.setProducer("Signcerely");
  return pdf.save();
}
