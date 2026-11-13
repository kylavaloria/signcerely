# Checklist for every app change

Run through this for each merged pull request or branch you're asked to check.

## 1. See what changed

```bash
git remote set-url origin https://github.com/kylavaloria/it-s-your-sign.git
git fetch origin
git log --oneline <last-checked-commit>..origin/main
git diff --stat <last-checked-commit>..origin/main
```

Read the diff, not just the commit titles.

## 2. Sort each change

| Kind of change | What to do |
|---|---|
| New or changed user flow (a page, a step, a button, an email) | Add or update a test that walks through it. |
| New or changed rule (who can see, sign, decline, cancel; limits; validation) | Add a test for the allowed case and the blocked case. |
| Wording change on something a test reads (button names, headings, notices, email subjects) | Update the selectors and text in the tests and helpers. |
| Layout or styling only | No test change, unless a selector broke. |
| Contract change (`contracts/`) | Make sure every on-chain step still passes; add a test if a new action exists. |
| Database change (`supabase/migrations/`) | Nothing to wire up (CI applies migrations), but test the behaviour the migration enables. |
| New environment variable | Add it to `.github/workflows/e2e.yml`, `setup.md` and `app/e2e/README.md`. |

Search the tests for any text you saw change:

```bash
grep -rn "<old text>" app/e2e
```

## 3. Write or fix the tests

- Prefer extending the helpers over repeating steps in specs.
- Use exact names when a word could match more than one control (`{ exact: true }`).
- Give every user their own email (`newUser` already does).
- Wait for what a person would wait for (a visible message, a URL), not fixed delays.
- Chain steps take seconds on the local network; use generous timeouts only on those.

## 4. Check

```bash
cd app
npx tsc --noEmit
npx eslint e2e
npx playwright test --list
```

Then push the branch: the End-to-end workflow runs on pull requests. If you can't
watch CI, ask the owner to paste the failing part of the "Run end-to-end tests" log.

## 5. Update the docs here

- `coverage.md`: add or edit the row for each test you touched, and remove items
  from "Not covered yet" that are now covered.
- `setup.md`: any new hook, helper, variable or limit.

## 6. Report back

Short and plain: which changes needed tests, which tests you added or changed,
CI result, and any app bug you found (with steps to reproduce). Keep messages short.
