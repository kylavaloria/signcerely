import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildFinalPdf, formatSignedDate } from "./final-pdf";

// 1x1 transparent PNG
const PNG = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
);

async function samplePdf(pages: number) {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) d.addPage([612, 792]).drawText(`Page ${i + 1}`, { x: 50, y: 700, font: f, size: 12 });
  return d.save();
}

const signers = [
  { id: "a", name: "Ana Reyes", email: "ana@x.ph", wallet: "G".padEnd(56, "A"), signedAt: new Date("2026-11-10T03:00:00Z"), imagePng: PNG },
  { id: "j", name: "Jomar Villañueva", email: "jomar@x.ph", wallet: "G".padEnd(56, "B"), signedAt: new Date("2026-11-12T03:00:00Z"), imagePng: PNG },
];

describe("buildFinalPdf", () => {
  it("adds one summary page and keeps the original pages", async () => {
    const out = await buildFinalPdf({
      original: await samplePdf(3),
      title: "Event Catering Agreement – Tech Summit 2026",
      originalHash: "ab".repeat(32),
      documentRef: "cd".repeat(32),
      verifyUrl: "https://signcerely.com/verify",
      signers,
      fields: [
        { signerId: "a", page: 3, x: 0.1, y: 0.8, width: 0.3, height: 0.085 },
        { signerId: "j", page: 3, x: 0.6, y: 0.8, width: 0.3, height: 0.085 },
      ],
    });
    const back = await PDFDocument.load(out);
    expect(back.getPageCount()).toBe(4);
    expect(back.getTitle()).toContain("(signed)");
  });

  it("works with no signature boxes (summary page only) and odd characters", async () => {
    const out = await buildFinalPdf({
      original: await samplePdf(1),
      title: "Kasunduan ✍️ sa Pag-upa",
      originalHash: "ab".repeat(32),
      documentRef: "cd".repeat(32),
      verifyUrl: "https://signcerely.com/verify",
      signers,
      fields: [],
    });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  });

  it("ignores boxes on pages that don't exist", async () => {
    const out = await buildFinalPdf({
      original: await samplePdf(1),
      title: "T",
      originalHash: "ab".repeat(32),
      documentRef: "cd".repeat(32),
      verifyUrl: "x",
      signers,
      fields: [{ signerId: "a", page: 9, x: 0.1, y: 0.1, width: 0.3, height: 0.08 }],
    });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  });

  it("formats dates in Philippine time", () => {
    expect(formatSignedDate(new Date("2026-11-07T20:30:00Z"))).toBe("Nov 8, 2026");
  });
});
