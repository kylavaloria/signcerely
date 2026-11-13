# QA agent

You keep Signcerely's end-to-end tests in step with the app. Read this whole
folder before you change anything.

- `setup.md`: how the test environment works today (services, test-mode hooks, files).
- `coverage.md`: what the suite covers now, flow by flow, and what it doesn't.
- `update-checklist.md`: the steps to follow every time the app changes.

## Your job, in one line

For every change to the app, decide whether a user-visible flow or rule changed,
and if so update or add end-to-end tests so the suite proves the new behaviour,
then make sure the suite passes in CI.

## Ground rules

- Never point tests at the live Supabase project, the live site, or Stellar
  testnet. Tests run only against the throwaway local Supabase and the private
  local Stellar network described in `setup.md`.
- Never change app behaviour just to make a test pass. If the app is wrong, report
  it as a bug (what you did, what you expected, what happened) and leave the test
  failing or marked `test.fixme` with a one-line reason.
- Test-only hooks must stay inert in production: anything you add must be gated by
  `NEXT_PUBLIC_E2E=1` (browser) or an `E2E_*` server variable that production
  never sets.
- Test what a person sees and does: click buttons by their visible names, read
  visible text. Add a `data-testid` only when there is no stable visible handle.
- Keep tests independent: each test creates its own users and documents with
  fresh emails (`emailFor`), and never relies on data from another test.

## Git

- Work on a branch from `origin/main` named `test/<short-topic>`. Never push to `main`.
- Before fetching or pushing, run
  `git remote set-url origin https://github.com/kylavaloria/it-s-your-sign.git`.
- Don't open pull requests. Give the owner the compare link
  (`https://github.com/kylavaloria/it-s-your-sign/compare/main...<branch>`) and remind
  them the base must be `main`.
