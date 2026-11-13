import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { hash, Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

const MAIL_DIR = process.env.E2E_MAIL_DIR ?? "";
const FRIENDBOT = process.env.E2E_FRIENDBOT_URL ?? "http://localhost:8000/friendbot";
const PASSPHRASE = Networks.STANDALONE;

/** Unique per run so tests never collide with data from an earlier run. */
export const runId = Date.now().toString(36);
export const emailFor = (who: string) => `${who}.${runId}@e2e.test`;

export type User = {
  name: string;
  email: string;
  keypair: Keypair;
  context: BrowserContext;
  page: Page;
};

async function fund(address: string) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(address)}`);
    if (res.ok) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Friendbot couldn't fund ${address}`);
}

/**
 * A person with their own browser and a funded Stellar key. The app talks to
 * a stand-in for Varial (only active in E2E builds) that signs with this key.
 */
export async function newUser(browser: Browser, name: string, opts: { fund?: boolean } = {}): Promise<User> {
  const keypair = Keypair.random();
  if (opts.fund !== false) await fund(keypair.publicKey());
  const context = await browser.newContext({ acceptDownloads: true });
  await context.exposeBinding("__e2eWallet", async (_source, op: string, arg: string) => {
    if (op === "address") return keypair.publicKey();
    if (op === "signMessage") {
      const digest = hash(Buffer.concat([Buffer.from("Stellar Signed Message:\n", "utf8"), Buffer.from(arg, "utf8")]));
      return Buffer.from(keypair.sign(digest)).toString("base64");
    }
    if (op === "signTransaction") {
      const tx = TransactionBuilder.fromXDR(arg, PASSPHRASE);
      tx.sign(keypair);
      return tx.toXDR();
    }
    throw new Error(`Unknown wallet op ${op}`);
  });
  await context.addInitScript(() => {
    const call = (window as unknown as { __e2eWallet: (op: string, arg?: string) => Promise<string> }).__e2eWallet;
    (window as unknown as { __signcerelyTestWallet: unknown }).__signcerelyTestWallet = {
      address: () => call("address"),
      signMessage: (m: string) => call("signMessage", m),
      signTransaction: (x: string) => call("signTransaction", x),
    };
  });
  const page = await context.newPage();
  return { name, email: emailFor(name.toLowerCase().split(" ")[0]), keypair, context, page };
}

/** Sign in from the sign-in page; finish the profile if it's the first time. */
export async function signIn(user: User, opts: { profileEmail?: string; expectProfileError?: boolean } = {}) {
  const { page } = user;
  if (!page.url().includes("/sign-in")) await page.goto("/sign-in");
  await page.getByRole("button", { name: "Connect Varial wallet" }).click();
  await expect(page.getByText("Varial connected")).toBeVisible();
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
  if (new URL(page.url()).pathname === "/welcome") {
    await page.locator("#fullName").fill(user.name);
    await page.locator("#email").fill(opts.profileEmail ?? user.email);
    await page.getByRole("button", { name: /^Continue/ }).click();
    if (opts.expectProfileError) return;
    await page.waitForURL((u) => u.pathname !== "/welcome");
  }
}

/** A plain PDF with a few pages of text. */
export async function makePdf(title: string, pages = 2): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([612, 792]);
    p.drawText(`${title} — page ${i}`, { x: 72, y: 700, size: 18, font });
    p.drawText("Signature: ______________________", { x: 72, y: 200, size: 12, font });
  }
  return Buffer.from(await doc.save());
}

type Mail = { to: string; subject: string; html: string; text: string };

/** Wait for an email to `to` whose subject matches, from the app's test mail folder. */
export async function waitForMail(to: string, subject: RegExp, timeoutMs = 60_000): Promise<Mail> {
  if (!MAIL_DIR) throw new Error("E2E_MAIL_DIR isn't set");
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const files = await readdir(MAIL_DIR).catch(() => [] as string[]);
    for (const f of files.sort()) {
      const m = JSON.parse(await readFile(join(MAIL_DIR, f), "utf8")) as Mail;
      if (m.to.toLowerCase() === to.toLowerCase() && subject.test(m.subject)) return m;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email to ${to} matching ${subject} within ${timeoutMs}ms`);
}

/** All emails sent to `to` so far. */
export async function mailsTo(to: string): Promise<Mail[]> {
  const files = await readdir(MAIL_DIR).catch(() => [] as string[]);
  const all = await Promise.all(files.map(async (f) => JSON.parse(await readFile(join(MAIL_DIR, f), "utf8")) as Mail));
  return all.filter((m) => m.to.toLowerCase() === to.toLowerCase());
}

/** The first link in an email's text that contains `part`. */
export function linkIn(mail: Mail, part: string): string {
  const url = mail.text.match(/https?:\/\/\S+/g)?.find((u) => u.includes(part));
  if (!url) throw new Error(`No ${part} link in "${mail.subject}"`);
  return url;
}

type NewDoc = { title: string; summary?: string; signers: User[]; inOrder: boolean };

/** Upload, add signers, place one box per signer, and send. Returns the document id. */
export async function sendDocument(sender: User, doc: NewDoc): Promise<string> {
  const { page } = sender;
  await page.goto("/documents/new");
  await page.locator("#pdf").setInputFiles({ name: `${doc.title}.pdf`, mimeType: "application/pdf", buffer: await makePdf(doc.title) });
  await expect(page.getByText(/2 pages/)).toBeVisible();
  await page.locator("#title").fill(doc.title);
  if (doc.summary) await page.locator("#summary").fill(doc.summary);
  await page.getByRole("button", { name: /Continue to signers/ }).click();

  await page.waitForURL(/\/documents\/[0-9a-f-]{36}\/signers/);
  const id = page.url().match(/documents\/([0-9a-f-]{36})/)![1];
  await page.getByText(doc.inOrder ? "One after another" : "All at once", { exact: true }).click();
  for (let i = 2; i < doc.signers.length; i++) await page.getByRole("button", { name: /Add another signer/ }).click();
  const names = page.locator('.signer-card input:not([type="email"])');
  const emails = page.locator('.signer-card input[type="email"]');
  for (const [i, s] of doc.signers.entries()) {
    await names.nth(i).fill(s.name);
    await emails.nth(i).fill(s.email);
  }
  await page.getByRole("button", { name: /^Continue/ }).click();

  await page.waitForURL(/\/spots/);
  const surface = page.getByTestId("spots-surface");
  await expect(surface).toBeVisible();
  for (const [i, s] of doc.signers.entries()) {
    await page.getByRole("radio", { name: new RegExp(s.name) }).click();
    await surface.click({ position: { x: 80 + i * 220, y: 620 } });
  }
  await expect(page.getByText("Every signer has a box")).toBeVisible();
  await page.getByRole("button", { name: /Continue to review/ }).click();

  await page.waitForURL(/\/review/);
  await page.getByRole("button", { name: /Send for signing/ }).click();
  await page.waitForURL(new RegExp(`/documents/${id}\\?sent=1`), { timeout: 120_000 });
  return id;
}

/** Open an invite link as a signer who isn't signed in yet, sign in, and land on the document. */
export async function openInviteAndSignIn(signer: User, inviteUrl: string) {
  const { page } = signer;
  await page.goto(inviteUrl);
  await page.getByRole("link", { name: "Continue with Varial" }).click();
  await page.waitForURL(/\/sign-in/);
  await signIn(signer);
  await page.waitForURL(/\/sign\/[0-9a-f-]{36}/);
}

/** Draw a signature into every box and approve it. */
export async function signDocument(signer: User) {
  const { page } = signer;
  await page.getByRole("button", { name: "Sign here" }).first().click();
  const pad = page.getByLabel(/Signature drawing area/);
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + box.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 40 + i * 20, box.y + box.height * (0.6 - 0.25 * Math.sin(i / 2)), { steps: 2 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Use this signature" }).click();
  await page.getByRole("button", { name: /Sign with Varial/ }).click();
}
