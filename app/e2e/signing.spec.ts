import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { linkIn, mailsTo, newUser, openInviteAndSignIn, runId, sendDocument, signDocument, signIn, waitForMail } from "./helpers";

test.describe.configure({ mode: "serial" });

test("signers sign one after another, everyone gets the signed copy, and it verifies", async ({ browser }) => {
  const alice = await newUser(browser, "Alice Sender");
  const bob = await newUser(browser, "Bob Signer");
  const carol = await newUser(browser, "Carol Signer");
  const title = `Lease ${runId} in order`;

  await signIn(alice);
  await expect(alice.page).toHaveURL(/\/dashboard/);
  await sendDocument(alice, { title, summary: "One year lease", signers: [bob, carol], inOrder: true });

  // Only the first signer is invited at first.
  const invite = await waitForMail(bob.email, /invited you to sign/);
  expect(await mailsTo(carol.email)).toHaveLength(0);

  await openInviteAndSignIn(bob, linkIn(invite, "/sign/"));
  await expect(bob.page.getByRole("heading", { name: title })).toBeVisible();
  await signDocument(bob);
  await expect(bob.page.getByText("You signed this document.")).toBeVisible({ timeout: 120_000 });

  // Then it's Carol's turn.
  const turn = await waitForMail(carol.email, /Your turn to sign/);
  await openInviteAndSignIn(carol, linkIn(turn, "/sign/"));
  await signDocument(carol);
  await expect(carol.page.getByText("Everyone has signed.")).toBeVisible({ timeout: 120_000 });

  // Everyone hears it's done.
  for (const u of [alice, bob, carol]) await waitForMail(u.email, /Signed by everyone/);

  // The downloaded copy checks out on the Verify page.
  const [download] = await Promise.all([
    carol.page.waitForEvent("download"),
    carol.page.getByRole("link", { name: "Download signed copy" }).click(),
  ]);
  const file = await readFile((await download.path())!);
  await carol.page.goto("/verify");
  await carol.page.locator("#v-file").setInputFiles({ name: "signed.pdf", mimeType: "application/pdf", buffer: file });
  await expect(carol.page.getByText("This document matches the signed version")).toBeVisible({ timeout: 60_000 });

  // Bob sees it under Completed and closed, sent by Alice.
  await bob.page.goto("/dashboard?view=closed");
  const card = bob.page.locator("article", { hasText: title });
  await expect(card).toBeVisible();
  await expect(card.getByText("Alice Sender")).toBeVisible();
  await expect(card.getByText("Completed", { exact: true }).first()).toBeVisible();

  // Alice sees it too, sent by her.
  await alice.page.goto("/dashboard?view=closed");
  await expect(alice.page.locator("article", { hasText: title }).getByText("You", { exact: true })).toBeVisible();
});

test("only the invited person can open and sign their invite", async ({ browser }) => {
  const alice = await newUser(browser, "Alice Owner");
  const bob = await newUser(browser, "Bob Invitee");
  const carol = await newUser(browser, "Carol Invitee");
  const mallory = await newUser(browser, "Mallory Other");
  const stranger = await newUser(browser, "Stranger", { fund: false });
  const title = `Contract ${runId} private`;

  await signIn(alice);
  await sendDocument(alice, { title, signers: [bob, carol], inOrder: false });
  const link = linkIn(await waitForMail(bob.email, /invited you to sign/), "/sign/");

  // Someone else signed in with Bob's link sees nothing of the document.
  await signIn(mallory);
  await mallory.page.goto(link);
  await expect(mallory.page.getByText("This document was sent to someone else")).toBeVisible();
  await expect(mallory.page.getByText(title)).toHaveCount(0);
  await expect(mallory.page.getByRole("button", { name: "Sign here" })).toHaveCount(0);

  // Without the link's key, a visitor doesn't see the title either.
  await stranger.page.goto(link.split("#")[0]);
  await expect(stranger.page.getByText(title)).toHaveCount(0);

  // Bob can.
  await openInviteAndSignIn(bob, link);
  await expect(bob.page.getByRole("heading", { name: title })).toBeVisible();
  await expect(bob.page.getByRole("button", { name: "Sign here" }).first()).toBeVisible();

  // Once Bob confirms his email, it waits for him on his dashboard.
  await bob.page.goto(linkIn(await waitForMail(bob.email, /Confirm your email/), "/confirm-email"));
  await expect(bob.page.getByText("Email confirmed")).toBeVisible();
  await bob.page.goto("/dashboard?view=sign");
  await expect(bob.page.locator("article", { hasText: title })).toBeVisible();
});

test("a signer can decline, and the sender is told why", async ({ browser }) => {
  const alice = await newUser(browser, "Alice Asker");
  const bob = await newUser(browser, "Bob Decliner");
  const carol = await newUser(browser, "Carol Waiting");
  const title = `Offer ${runId} declined`;

  await signIn(alice);
  await sendDocument(alice, { title, signers: [bob, carol], inOrder: false });
  await openInviteAndSignIn(bob, linkIn(await waitForMail(bob.email, /invited you to sign/), "/sign/"));

  await bob.page.getByRole("button", { name: "Decline", exact: true }).click();
  await bob.page.locator("#dc-reason").fill("The dates are wrong");
  await bob.page.getByRole("dialog").getByRole("button", { name: "Decline", exact: true }).click();
  await expect(bob.page.getByText("This document was declined")).toBeVisible({ timeout: 120_000 });

  const notice = await waitForMail(alice.email, /declined to sign/);
  expect(notice.text).toContain("The dates are wrong");
  await waitForMail(carol.email, /invited you to sign/); // Carol was invited, but no one else can sign now

  await alice.page.goto("/dashboard?view=closed");
  const card = alice.page.locator("article", { hasText: title });
  await expect(card.getByText("Declined", { exact: true }).first()).toBeVisible();
});

test("one confirmed email belongs to one account", async ({ browser }) => {
  const first = await newUser(browser, "Dana First", { fund: false });
  const second = await newUser(browser, "Dana Second", { fund: false });
  const shared = `dana.${runId}@e2e.test`;

  await signIn(first, { profileEmail: shared });
  const confirm = await waitForMail(shared, /Confirm your email/);
  await first.page.goto(linkIn(confirm, "/confirm-email"));
  await expect(first.page.getByText("Email confirmed")).toBeVisible();

  await signIn(second, { profileEmail: shared, expectProfileError: true });
  await expect(second.page.getByText("That email is already confirmed on another account.")).toBeVisible();
  await expect(second.page).toHaveURL(/\/welcome/);
});
