# Contributing to Signcerely

Thanks for your interest in Signcerely. Bug reports, ideas and pull requests are
all welcome.

## Before you start

- **Found a bug?** Open an issue with the steps to reproduce it, what you expected,
  and what happened instead. Screenshots help.
- **Want to add or change a feature?** Open an issue first so we can agree on the
  approach before you spend time on it.
- **Found a security problem?** Please don't open a public issue. Follow
  [SECURITY.md](SECURITY.md) instead.

## Set up

Follow [Run it locally](README.md#-run-it-locally) in the README. You'll need
Node 22 for the web app, and Rust stable with the
[Stellar CLI](https://developers.stellar.org/docs/tools/cli) for the contract.

## Making a change

1. Create a branch from `main` with a short, descriptive name, such as
   `fix/invite-email-typo` or `feat/download-button`.
2. Keep each pull request to one topic. Smaller pull requests are reviewed faster.
3. Write commit messages in the [Conventional Commits](https://www.conventionalcommits.org)
   format: `type(scope): what changed`, in lowercase and the imperative mood.
   The scope is optional. For example:

   | Type | Use it for | Example |
   |---|---|---|
   | `feat` | a new feature | `feat(verify): show the signer's name` |
   | `fix` | a bug fix | `fix(dashboard): keep the search when changing tabs` |
   | `docs` | documentation only | `docs(readme): add a table of contents` |
   | `test` | adding or fixing tests | `test(contract): reject signing out of turn` |
   | `refactor` | a code change that adds no feature and fixes no bug | `refactor: split the signing page` |
   | `perf` | a speed improvement | `perf(db): index email lookups` |
   | `ci` | CI and GitHub Actions | `ci: run contract tests on pull requests` |
   | `chore` | anything else (config, dependencies) | `chore: update the Stellar SDK` |
4. Open a pull request into `main` and describe what changed and how you tested it.

## Checks to run

Every pull request runs these in CI, but running them first saves a round trip.

**Web app** (from `app/`):

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

**Contract** (from the repo root):

```bash
cargo test
```

The end-to-end tests (`npm run test:e2e`) need Docker, the Supabase CLI and the
Stellar CLI. See [app/e2e/README.md](app/e2e/README.md). CI runs them on every pull request, so
running them locally is optional.

## Guidelines

- **Database changes:** add a new file in `supabase/migrations/` with a later
  timestamp. Never edit a migration that has already been merged.
- **Contract changes:** add tests in `contracts/signing/src/test.rs`. A deployed
  contract can't be changed, so a contract change means a new testnet deploy and
  updating the contract ID in `.env.example`, the README, and the
  testnet integration workflow.
- **Privacy:** only fingerprints go on-chain. Never put a PDF, a signature image,
  a name or an email address in a transaction.
- **Text in the app:** keep it short and plain. Error messages should say what
  happened and what to do next, without technical details.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
