/**
 * Captures the README images from a real run of the app (local Supabase and
 * local Stellar, same setup as the end-to-end tests). Only runs when
 * README_SHOTS_DIR is set; see .github/workflows/readme-shots.yml.
 */
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { linkIn, newUser, signIn, waitForMail, type User } from "../helpers";

const OUT = process.env.README_SHOTS_DIR ?? "";
test.skip(!OUT, "README_SHOTS_DIR not set");
test.setTimeout(600_000);

const shot = async (page: Page, name: string, opts: { full?: boolean; clip?: { x: number; y: number; width: number; height: number } } = {}) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: "jpeg", quality: 86, fullPage: opts.full ?? false, clip: opts.clip, animations: "disabled" });
};

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
async function leasePdf(): Promise<Buffer> {
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

async function drawSignature(page: Page, seed: number) {
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

async function signAs(u: User, wiggle: number) {
  await u.page.getByRole("button", { name: "Sign here" }).first().click();
  await drawSignature(u.page, wiggle);
}

test("README screenshots", async ({ browser }) => {
  await mkdir(OUT, { recursive: true });
  const maria = await newUser(browser, "Maria Santos");
  const juan = await newUser(browser, "Juan Dela Cruz");
  maria.email = "maria.santos@example.com";
  juan.email = "juan.delacruz@example.com";
  for (const u of [maria, juan]) await u.page.setViewportSize({ width: 1440, height: 1000 });

  // Banner (rendered with the real brand fonts).
  const bannerPage = await maria.context.newPage();
  await bannerPage.setViewportSize({ width: 1280, height: 420 });
  await bannerPage.setContent(await readFile(join(process.cwd(), "e2e/readme/banner.html"), "utf8"), { waitUntil: "networkidle" });
  await bannerPage.waitForTimeout(800);
  await bannerPage.screenshot({ path: join(OUT, "banner.png") });
  await bannerPage.close();

  // Sign in, finish the profile and confirm the email.
  await signIn(maria);
  await maria.page.goto(linkIn(await waitForMail(maria.email, /Confirm your email/), "/confirm-email"));

  // 1. Upload.
  const title = "Apartment Lease Agreement";
  await maria.page.goto("/documents/new");
  await maria.page.locator("#pdf").setInputFiles({ name: "Apartment Lease Agreement.pdf", mimeType: "application/pdf", buffer: await leasePdf() });
  await expect(maria.page.getByText(/2 pages/)).toBeVisible();
  await maria.page.locator("#title").fill(title);
  await maria.page.locator("#summary").fill("12-month lease for Unit 4B, starting December 1, 2026. Rent is PHP 18,000 a month.");
  await shot(maria.page, "step-1-upload");
  await maria.page.getByRole("button", { name: /Continue to signers/ }).click();

  // 2. Signers (Maria signs first, then Juan).
  await maria.page.waitForURL(/\/signers/);
  await maria.page.getByText("One after another", { exact: true }).click();
  const names = maria.page.locator('.signer-card input:not([type="email"])');
  const emails = maria.page.locator('.signer-card input[type="email"]');
  await names.nth(0).fill(maria.name);
  await emails.nth(0).fill(maria.email);
  await names.nth(1).fill(juan.name);
  await emails.nth(1).fill(juan.email);
  await shot(maria.page, "step-2-signers");
  await maria.page.getByRole("button", { name: /^Continue/ }).click();

  // 3. Signature boxes on the signature lines of page 2.
  await maria.page.waitForURL(/\/spots/);
  await maria.page.getByRole("button", { name: /^Page 2/ }).click();
  const surface = maria.page.getByTestId("spots-surface");
  await expect(surface).toBeVisible();
  await maria.page.waitForTimeout(800);
  const s = (await surface.boundingBox())!;
  const lineY = (792 - 170 - 0.085 * 792 * 0.5 + 4) / 792;
  for (const [who, fx] of [
    [maria.name, (72 + 100) / 612],
    [juan.name, (340 + 100) / 612],
  ] as const) {
    await maria.page.getByRole("radio", { name: new RegExp(who) }).click();
    await surface.click({ position: { x: fx * s.width, y: lineY * s.height } });
  }
  await expect(maria.page.getByText("Every signer has a box")).toBeVisible();
  await maria.page.mouse.click(5, 5);
  await shot(maria.page, "step-3-boxes", { full: true });
  await maria.page.getByRole("button", { name: /Continue to review/ }).click();

  // 4. Review and send.
  await maria.page.waitForURL(/\/review/);
  await shot(maria.page, "step-4-review", { full: true });
  await maria.page.getByRole("button", { name: /Send for signing/ }).click();
  await maria.page.waitForURL(/\?sent=1/, { timeout: 120_000 });
  const docUrl = maria.page.url();

  // 5. Maria signs her own spot from the document page.
  await maria.page.getByRole("link", { name: /Sign now/ }).click();
  await maria.page.waitForURL(/\/sign\//);
  await signAs(maria, 0);
  await shot(maria.page, "adopt-signature");
  await maria.page.getByRole("button", { name: "Use this signature" }).click();
  await maria.page.getByRole("button", { name: /Sign with Varial/ }).click();
  await expect(maria.page.getByText("You signed this document.")).toBeVisible({ timeout: 120_000 });

  // Juan's invite email.
  const turn = await waitForMail(juan.email, /Your turn to sign|invited you to sign/);
  const emailPage = await juan.context.newPage();
  await emailPage.setViewportSize({ width: 900, height: 820 });
  await emailPage.setContent(turn.html.replaceAll("http://localhost:3100", "https://signcerely.site"), { waitUntil: "networkidle" });
  await shot(emailPage, "email");
  await emailPage.close();

  // 6. Juan signs.
  await juan.page.goto(linkIn(turn, "/sign/"));
  await juan.page.getByRole("link", { name: "Continue with Varial" }).click();
  await juan.page.waitForURL(/\/sign-in/);
  await signIn(juan);
  await juan.page.waitForURL(/\/sign\//);
  const juanSign = juan.page.url();
  await juan.page.goto(linkIn(await waitForMail(juan.email, /Confirm your email/), "/confirm-email"));
  await juan.page.goto(juanSign);
  await juan.page.getByRole("button", { name: /^Page 2/ }).first().click().catch(() => {});
  await shot(juan.page, "step-5-sign", { full: true });
  await signAs(juan, 1);
  await juan.page.getByRole("button", { name: "Use this signature" }).click();
  await juan.page.getByRole("button", { name: /Sign with Varial/ }).click();
  await expect(juan.page.getByText("Everyone has signed.")).toBeVisible({ timeout: 120_000 });
  await juan.page.getByRole("button", { name: /^Page 2/ }).first().click().catch(() => {});
  await shot(juan.page, "step-6-complete", { full: true });

  // 7. Verify the signed copy.
  const [download] = await Promise.all([
    juan.page.waitForEvent("download"),
    juan.page.getByRole("link", { name: "Download signed copy" }).click(),
  ]);
  const signed = await readFile((await download.path())!);
  await juan.page.goto("/verify");
  await juan.page.locator("#v-file").setInputFiles({ name: "Apartment Lease Agreement (signed).pdf", mimeType: "application/pdf", buffer: signed });
  await expect(juan.page.getByText("This document matches the signed version")).toBeVisible({ timeout: 60_000 });
  await shot(juan.page, "step-7-verify", { full: true });

  // Dashboards and the sender's document page.
  await maria.page.goto(docUrl.replace(/\?.*$/, ""));
  await shot(maria.page, "document", { full: true });
  await maria.page.goto("/dashboard?view=closed");
  await shot(maria.page, "dashboard");
});
