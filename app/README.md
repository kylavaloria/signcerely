# It's Your Sign — web app

Next.js app for It's Your Sign. See the repo README for how signing works.

## Run locally

```bash
cd app
cp ../.env.example .env.local   # then fill in the values
npm install
npm run dev                     # http://localhost:3000
```

You'll need the [Freighter](https://www.freighter.app) browser extension set to **Test Net**.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build` | Production build |

## How sign-in works

1. The browser asks `/api/auth/challenge` for a one-time code for the connected wallet.
2. Freighter signs a short message containing that code (SEP-53 message signing — no transaction, no fee).
3. `/api/auth/verify` uses the code once, checks the signature with the Stellar SDK, and sets an HTTP-only session cookie (7 days).
4. New wallets go to **Finish your profile** (name + email); returning ones go to the dashboard.

All database access happens on the server with the Supabase secret key. Row Level Security blocks the public key entirely.
