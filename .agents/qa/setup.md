# How the end-to-end setup works

## Pieces

| Piece | What it is | Where |
|---|---|---|
| Test runner | Playwright, Chromium only, one worker, tests run in order | `app/playwright.config.ts` |
| Tests | Specs and shared helpers | `app/e2e/*.spec.ts`, `app/e2e/helpers.ts` |
| Database | Local Supabase started fresh per CI run, schema from `supabase/migrations` | `supabase/config.toml` |
| Blockchain | Private Stellar network (`stellar/quickstart --local`), contract built and deployed fresh per run | CI workflow |
| CI | Runs on pull requests and pushes to `main` that touch `app/`, `contracts/`, `supabase/` | `.github/workflows/e2e.yml` |
| Human docs | How to run it on a computer | `app/e2e/README.md` |

## Test-mode hooks in the app

These only switch on in test builds. Production never sets the variables.

- **Stand-in wallet** (`app/src/lib/wallet.ts`). With `NEXT_PUBLIC_E2E=1` baked into
  the build, the wallet functions use `window.__signcerelyTestWallet` instead of the
  Varial extension. `newUser()` in `helpers.ts` installs it per browser context and
  signs with that user's own Stellar keypair (SEP-53 messages and transactions).
- **Local network** (`app/src/lib/env.ts`, `app/src/lib/stellar/contract.ts`).
  `NEXT_PUBLIC_STELLAR_NETWORK=local` uses the Standalone network passphrase.
- **Email to files** (`app/src/lib/email.ts`). With `E2E_MAIL_DIR` set, every email
  is written there as JSON (`to`, `subject`, `html`, `text`) instead of being sent.
  `waitForMail()` and `linkIn()` read them.
- **Spots surface handle**: `data-testid="spots-surface"` on the signature-box
  placement area (it has no visible label).

## Helpers (`app/e2e/helpers.ts`)

- `newUser(browser, name, { fund })`: new browser context, new funded keypair, stand-in wallet, unique email.
- `signIn(user, { profileEmail, expectProfileError })`: sign-in page → connect → continue → finish profile if needed.
- `sendDocument(sender, { title, summary, signers, inOrder })`: upload a generated 2-page PDF, add signers, place one box each, send. Returns the document id.
- `openInviteAndSignIn(signer, url)`: open an invite link logged out, sign in, land on the signing page.
- `signDocument(signer)`: draw a signature, adopt it, sign with the wallet.
- `waitForMail(to, /subject/)`, `mailsTo(to)`, `linkIn(mail, "/sign/")`, `makePdf(title, pages)`.

## Environment the tests need

Build time (browser): `NEXT_PUBLIC_E2E=1`, `NEXT_PUBLIC_STELLAR_NETWORK=local`,
`NEXT_PUBLIC_STELLAR_RPC_URL`, `NEXT_PUBLIC_CONTRACT_ID`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Run time (server): the same `NEXT_PUBLIC_*` values plus `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `INVITE_ENCRYPTION_KEY`, `APP_URL`,
`E2E_MAIL_DIR`, and for the helpers `E2E_FRIENDBOT_URL`.

The CI workflow sets all of these. Changing a `NEXT_PUBLIC_*` value needs a rebuild.

## Known limits

- Emails are captured, not delivered; Resend itself isn't exercised.
- The "Add free test XLM" path isn't tested: users are funded before the test.
- Only desktop Chromium runs. Phone layouts aren't covered.
- Failure screenshots and traces are uploaded as the `playwright-report` artifact in CI.
