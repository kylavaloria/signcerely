/**
 * Records the short clips used on the website's "How it works" and "Verify a
 * signed PDF" pages, from a real run of the app (local Supabase and local
 * Stellar, same setup as the end-to-end tests). Only runs when
 * README_SHOTS_DIR is set; see .github/workflows/readme-shots.yml.
 *
 * Output (in README_SHOTS_DIR/clips): one video per person and timeline.json,
 * which says where each clip starts and ends and which waits can be sped up.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { linkIn, newUser, signIn, waitForMail, type User } from "../helpers";
import { drawSignature, leasePdf } from "./shared";

const OUT = process.env.README_SHOTS_DIR ? join(process.env.README_SHOTS_DIR, "clips") : "";
test.skip(!OUT, "README_SHOTS_DIR not set");
test.setTimeout(900_000);

const SIZE = { width: 1280, height: 800 };

type Clip = { name: string; who: string; start: number; end: number; fast: [number, number][] };
const clips: Clip[] = [];
let current: Clip | null = null;

const now = (u: User) => (Date.now() - u.startedAt) / 1000;
function begin(u: User, name: string) {
  current = { name, who: u.name.split(" ")[0].toLowerCase(), start: now(u), end: 0, fast: [] };
}
function end(u: User) {
  current!.end = now(u);
  clips.push(current!);
  current = null;
}
/** Run a slow step (waiting for the network) and mark it so the clip can speed it up. */
async function fast<T>(u: User, run: () => Promise<T>): Promise<T> {
  const a = now(u);
  const out = await run();
  current?.fast.push([a, now(u)]);
  return out;
}

const pause = (p: Page, ms = 700) => p.waitForTimeout(ms);

/** A visible cursor, so viewers can follow what is clicked. */
const CURSOR = () => {
  const add = () => {
    if (document.getElementById("__clip-cursor")) return;
    const c = document.createElement("div");
    c.id = "__clip-cursor";
    c.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6 4.2 7.4-2.9 1.6-4.2-7.5L4 19z" fill="#12305c" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><span></span>';
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", transform: "translate(-100px,-100px)" });
    const ring = c.querySelector("span") as HTMLSpanElement;
    Object.assign(ring.style, { position: "absolute", left: "-11px", top: "-11px", width: "26px", height: "26px", borderRadius: "50%", background: "rgba(255,221,31,.55)", transform: "scale(0)", transition: "transform .18s ease-out, opacity .3s" });
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => (c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`), true);
    addEventListener("mousedown", () => { ring.style.opacity = "1"; ring.style.transform = "scale(1.2)"; }, true);
    addEventListener("mouseup", () => { ring.style.opacity = "0"; ring.style.transform = "scale(.4)"; }, true);
  };
  if (document.body) add();
  else addEventListener("DOMContentLoaded", add);
};

/** Glide the cursor to an element, then click it. */
async function click(p: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const b = (await target.boundingBox())!;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await pause(p, 180);
  await p.mouse.down();
  await p.mouse.up();
}

async function type(p: Page, field: Locator, text: string, delay = 28) {
  await click(p, field);
  await field.fill("");
  await field.pressSequentially(text, { delay });
  await pause(p, 250);
}

async function scrollTo(p: Page, top: number | "bottom", ms = 1100) {
  await p.evaluate(
    ([t, d]) =>
      new Promise<void>((done) => {
        const from = scrollY;
        const to = t === "bottom" ? document.documentElement.scrollHeight - innerHeight : (t as number);
        const t0 = performance.now();
        const step = (n: number) => {
          const k = Math.min(1, (n - t0) / (d as number));
          window.scrollTo(0, from + (to - from) * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      }),
    [top, ms] as const,
  );
  await pause(p, 300);
}

test("website clips", async ({ browser }) => {
  await mkdir(OUT, { recursive: true });
  const video = { dir: OUT, size: SIZE };
  const maria = await newUser(browser, "Maria Santos", { context: { viewport: SIZE, recordVideo: video } });
  const juan = await newUser(browser, "Juan Dela Cruz", { context: { viewport: SIZE, recordVideo: video } });
  maria.email = "maria@example.com";
  juan.email = "juan@example.com";
  for (const u of [maria, juan]) await u.context.addInitScript(CURSOR);
  const m = maria.page;
  const j = juan.page;

  await signIn(maria);
  await m.goto(linkIn(await waitForMail(maria.email, /Confirm your email/), "/confirm-email"));

  // 1. Upload.
  await m.goto("/documents/new");
  await pause(m, 600);
  begin(maria, "step-1-upload");
  await pause(m, 900);
  await m.locator("#pdf").setInputFiles({ name: "Apartment Lease Agreement.pdf", mimeType: "application/pdf", buffer: await leasePdf() });
  await expect(m.getByText(/2 pages/)).toBeVisible();
  await pause(m, 800);
  await type(m, m.locator("#title"), "Apartment Lease Agreement");
  await type(m, m.locator("#summary"), "12-month lease for Unit 4B, starting December 1, 2026.", 22);
  await pause(m, 900);
  await click(m, m.getByRole("button", { name: /Continue to signers/ }));
  await m.waitForURL(/\/signers/);
  await pause(m, 500);
  end(maria);

  // 2. Signers.
  begin(maria, "step-2-signers");
  await pause(m, 600);
  await click(m, m.getByText("One after another", { exact: true }));
  const names = m.locator('.signer-card input:not([type="email"])');
  const emails = m.locator('.signer-card input[type="email"]');
  await type(m, names.nth(0), maria.name);
  await type(m, emails.nth(0), maria.email, 18);
  await type(m, names.nth(1), juan.name);
  await type(m, emails.nth(1), juan.email, 18);
  await pause(m, 900);
  await click(m, m.getByRole("button", { name: /^Continue/ }));
  await m.waitForURL(/\/spots/);
  await pause(m, 500);
  end(maria);

  // 3. Signature boxes on the signature lines of page 2.
  begin(maria, "step-3-boxes");
  await pause(m, 600);
  await click(m, m.getByRole("button", { name: /^Page 2/ }));
  const surface = m.getByTestId("spots-surface");
  await expect(surface).toBeVisible();
  await pause(m, 900);
  await surface.scrollIntoViewIfNeeded();
  const lineY = (792 - 170 - 0.085 * 792 * 0.5 + 4) / 792;
  for (const [who, fx] of [
    [maria.name, (72 + 100) / 612],
    [juan.name, (340 + 100) / 612],
  ] as const) {
    await click(m, m.getByRole("radio", { name: new RegExp(who) }));
    await pause(m, 300);
    const s = (await surface.boundingBox())!;
    await m.mouse.move(s.x + fx * s.width, s.y + lineY * s.height, { steps: 22 });
    await pause(m, 200);
    await m.mouse.down();
    await m.mouse.up();
    await pause(m, 700);
  }
  await expect(m.getByText("Every signer has a box")).toBeVisible();
  await pause(m, 900);
  await click(m, m.getByRole("button", { name: /Continue to review/ }));
  await m.waitForURL(/\/review/);
  await pause(m, 500);
  end(maria);

  // 4. Review and send.
  begin(maria, "step-4-send");
  await pause(m, 900);
  await scrollTo(m, "bottom", 1600);
  await pause(m, 700);
  await click(m, m.getByRole("button", { name: /Send for signing/ }));
  await fast(maria, () => m.waitForURL(/\?sent=1/, { timeout: 120_000 }));
  await pause(m, 1800);
  end(maria);
  const docUrl = m.url().replace(/\?.*$/, "");

  // Maria signs her own spot (not part of a clip).
  await m.getByRole("link", { name: /Sign now/ }).click();
  await m.waitForURL(/\/sign\//);
  await m.getByRole("button", { name: "Sign here" }).first().click();
  await drawSignature(m, 0);
  await m.getByRole("button", { name: "Use this signature" }).click();
  await m.getByRole("button", { name: /Sign with Varial/ }).click();
  await expect(m.getByText("You signed this document.")).toBeVisible({ timeout: 120_000 });

  // Juan gets his turn by email and signs in.
  const turn = await waitForMail(juan.email, /Your turn to sign|invited you to sign/);
  await j.goto(linkIn(turn, "/sign/"));
  await j.getByRole("link", { name: "Continue with Varial" }).click();
  await j.waitForURL(/\/sign-in/);
  await signIn(juan);
  await j.waitForURL(/\/sign\//);
  const juanSign = j.url();
  await j.goto(linkIn(await waitForMail(juan.email, /Confirm your email/), "/confirm-email"));
  await j.goto(juanSign);
  await pause(j, 800);

  // 5. Juan signs.
  begin(juan, "step-5-sign");
  await pause(j, 900);
  await click(j, j.getByRole("button", { name: /^Page 2/ }).first()).catch(() => {});
  await pause(j, 900);
  await click(j, j.getByRole("button", { name: "Sign here" }).first());
  await pause(j, 600);
  await drawSignature(j, 1);
  await pause(j, 700);
  await click(j, j.getByRole("button", { name: "Use this signature" }));
  await pause(j, 900);
  await click(j, j.getByRole("button", { name: /Sign with Varial/ }));
  await fast(juan, () => expect(j.getByText("Everyone has signed.")).toBeVisible({ timeout: 120_000 }));
  await pause(j, 1500);
  end(juan);

  // 6. Everyone gets the signed copy.
  begin(juan, "step-6-signed-copy");
  await pause(j, 600);
  await click(j, j.getByRole("button", { name: /^Page 2/ }).first()).catch(() => {});
  await pause(j, 1200);
  await scrollTo(j, "bottom", 1800);
  await pause(j, 900);
  const dl = j.getByRole("link", { name: "Download signed copy" });
  await dl.scrollIntoViewIfNeeded();
  const db = (await dl.boundingBox())!;
  await j.mouse.move(db.x + db.width / 2, db.y + db.height / 2, { steps: 20 });
  await pause(j, 1400);
  const [download] = await Promise.all([j.waitForEvent("download"), j.mouse.click(db.x + db.width / 2, db.y + db.height / 2)]);
  await pause(j, 900);
  end(juan);
  const signed = await readFile((await download.path())!);

  // 7. Verify the signed copy (used on both pages).
  await j.goto("/verify");
  await pause(j, 600);
  begin(juan, "step-7-verify");
  await pause(j, 1000);
  const drop = j.locator('label[for="v-file"]');
  const vb = (await drop.boundingBox())!;
  await j.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2, { steps: 20 });
  await pause(j, 400);
  await j.locator("#v-file").setInputFiles({ name: "Apartment Lease Agreement (signed).pdf", mimeType: "application/pdf", buffer: signed });
  await fast(juan, () => expect(j.getByText("This document matches the signed version")).toBeVisible({ timeout: 60_000 }));
  await pause(j, 900);
  await scrollTo(j, "bottom", 2200);
  await pause(j, 1500);
  end(juan);

  // An edited copy: same words, saved again, so the fingerprint changes.
  const edited = await PDFDocument.load(signed);
  edited.setTitle("Apartment Lease Agreement (edited)");
  const editedBytes = Buffer.from(await edited.save());
  await j.goto("/verify");
  await pause(j, 600);
  begin(juan, "verify-edited");
  await pause(j, 1000);
  await j.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2, { steps: 20 });
  await pause(j, 400);
  await j.locator("#v-file").setInputFiles({ name: "Apartment Lease Agreement (edited).pdf", mimeType: "application/pdf", buffer: editedBytes });
  await fast(juan, () => expect(j.getByText("This file doesn’t match any signed document")).toBeVisible({ timeout: 60_000 }));
  await pause(j, 900);
  await scrollTo(j, "bottom", 1400);
  await pause(j, 1600);
  end(juan);

  // The shareable verification page, opened from the sender's document page.
  await m.goto(docUrl);
  await pause(m, 600);
  begin(maria, "verify-link");
  await pause(m, 900);
  await click(m, m.getByRole("link", { name: "Open verification page" }));
  await fast(maria, () => m.waitForURL(/\/v\/[0-9a-f]{64}/, { timeout: 60_000 }));
  await pause(m, 1200);
  await scrollTo(m, "bottom", 2200);
  await pause(m, 1500);
  end(maria);

  // Save the videos (written when each browser context closes).
  const vids = [
    ["maria", m.video()],
    ["juan", j.video()],
  ] as const;
  await maria.context.close();
  await juan.context.close();
  for (const [who, v] of vids) await v!.saveAs(join(OUT, `${who}.webm`));
  await writeFile(join(OUT, "timeline.json"), JSON.stringify({ size: SIZE, clips }, null, 2));
});
