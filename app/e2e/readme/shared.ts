/** Shared by the README screenshots and the website clips. */
import type { Page } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if ((line + " " + w).trim().length > max) {
      out.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

/** A two-page lease with a signature block at the bottom of page 2. */
export async function leasePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const ink = rgb(0.1, 0.12, 0.2);
  const para = (p: ReturnType<typeof doc.addPage>, y: number, heading: string, body: string) => {
    p.drawText(heading, { x: 72, y, size: 12, font: bold, color: ink });
    let yy = y - 18;
    for (const l of wrap(body, 92)) {
      p.drawText(l, { x: 72, y: yy, size: 11, font: reg, color: ink });
      yy -= 15;
    }
    return yy - 12;
  };
  const p1 = doc.addPage([612, 792]);
  p1.drawText("APARTMENT LEASE AGREEMENT", { x: 72, y: 710, size: 18, font: bold, color: ink });
  p1.drawText("Unit 4B, 128 Mabini Street, Makati City", { x: 72, y: 688, size: 11, font: reg, color: ink });
  let y = 650;
  y = para(p1, y, "1. Parties", "This Lease Agreement is made between Maria Santos (the Landlord) and Juan Dela Cruz (the Tenant). Both parties agree to the terms below.");
  y = para(p1, y, "2. Term", "The lease starts on December 1, 2026 and runs for twelve (12) months, ending on November 30, 2027, unless renewed in writing by both parties.");
  y = para(p1, y, "3. Rent", "Monthly rent is PHP 18,000, due on the first day of each month. Rent paid more than five days late carries a fee of PHP 500.");
  y = para(p1, y, "4. Deposit", "The Tenant pays a security deposit of two months' rent. It is returned within thirty days after the lease ends, less the cost of any damage beyond normal wear.");
  para(p1, y, "5. Utilities", "The Tenant pays for electricity, water and internet. Association dues are paid by the Landlord.");
  const p2 = doc.addPage([612, 792]);
  y = 710;
  y = para(p2, y, "6. Use of the unit", "The unit is for residential use only. The Tenant may not sublet the unit or keep pets without the Landlord's written consent.");
  y = para(p2, y, "7. Repairs", "The Landlord handles major repairs. The Tenant reports damage promptly and keeps the unit clean and in good condition.");
  y = para(p2, y, "8. Ending the lease", "Either party may end the lease early with sixty days' written notice. The deposit covers any unpaid rent at that time.");
  para(p2, y, "9. Entire agreement", "This document is the entire agreement between the parties. Any change must be in writing and signed by both.");
  p2.drawText("Signed by the parties:", { x: 72, y: 250, size: 12, font: bold, color: ink });
  for (const [x, who, role] of [
    [72, "Maria Santos", "Landlord"],
    [340, "Juan Dela Cruz", "Tenant"],
  ] as const) {
    p2.drawLine({ start: { x, y: 170 }, end: { x: x + 200, y: 170 }, thickness: 1, color: ink });
    p2.drawText(`${who}, ${role}`, { x, y: 154, size: 10, font: reg, color: ink });
  }
  return Buffer.from(await doc.save());
}

export async function drawSignature(page: Page, seed: number) {
  const pad = page.getByLabel(/Signature drawing area/);
  const b = (await pad.boundingBox())!;
  const x0 = b.x + 50;
  const y0 = b.y + b.height * 0.55;
  const len = b.width * 0.62;
  const loops = 5 + seed;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    const r = 13 + 7 * Math.sin(t * 7 + seed);
    const a = 2 * Math.PI * loops * t;
    pts.push([x0 + len * t - r * Math.sin(a), y0 - r * Math.cos(a) - 14 * Math.sin(t * Math.PI) + 10 * t]);
  }
  await page.mouse.move(...pts[0]);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1], { steps: 2 });
  await page.mouse.up();
  // underline flourish
  await page.mouse.move(x0 + len * 0.15, y0 + 34);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(x0 + len * (0.15 + 0.9 * (i / 20)), y0 + 34 - 10 * Math.sin((i / 20) * Math.PI), { steps: 2 });
  await page.mouse.up();
}
