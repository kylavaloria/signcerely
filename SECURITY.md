# Security Policy

Signcerely handles signed agreements, so we take security reports seriously.
Thank you for helping keep it safe.

## Supported versions

| Version | Supported |
|---|---|
| The live app at [signcerely.site](https://signcerely.site) | Yes |
| The `main` branch | Yes |
| Older commits and forks | No |

The signing contract currently runs on the Stellar **testnet**, so no real funds
are at risk. Reports about it are still very welcome.

## Reporting a vulnerability

Please **don't** open a public issue for a security problem.

Report it privately in one of these ways:

- **GitHub:** open the **Security** tab of this repository and choose
  **Report a vulnerability**.
- **Email:** [concerns@signcerely.site](mailto:concerns@signcerely.site)

Please include:

- what you found and where (a page, an API route, or a contract function)
- the steps to reproduce it
- what an attacker could do with it

We'll acknowledge your report within 7 days, keep you updated while we fix it,
and credit you when the fix is released if you'd like.

## Scope

**In scope:**

- the web app at signcerely.site and the code in this repository
- the signing contract in `contracts/signing`
- sign-in, invite links, and who can open, sign or decline a document

**Out of scope:**

- problems in services we use (Stellar, Supabase, Vercel, Resend, Varial).
  Please report those to the service directly.
- denial-of-service attacks, spam, and social engineering
- reports from automated scanners without a working example

## Testing guidelines

- Use your own accounts and test documents. Don't open, change or delete other
  people's documents.
- Use the Stellar testnet only.
- Stop and report as soon as you confirm a problem, without going further than
  needed to show it.

We won't take legal action against anyone who reports a problem in good faith
and follows these guidelines.

## How Signcerely protects documents

See [Security and privacy](README.md#-security-and-privacy) in the README for how
documents, invites and signatures are protected.
