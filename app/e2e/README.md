# End-to-end tests

A real browser (Playwright) clicks through the built app: sign in, upload, add
signers, place boxes, send, sign, decline, dashboard, verify.

Everything runs against throwaway services, never the live ones:

- **Database:** a local Supabase (`supabase start`, using `supabase/migrations`).
- **Blockchain:** a private Stellar network (`stellar/quickstart --local`) with the
  contract deployed fresh.
- **Wallet:** Varial can't be clicked by a robot, so the app built with
  `NEXT_PUBLIC_E2E=1` uses a stand-in wallet that signs with a test key. Production
  builds never read it.
- **Email:** with `E2E_MAIL_DIR` set, emails are written to that folder as JSON and
  the tests open the links inside them.

CI runs it on every pull request (`.github/workflows/e2e.yml`).

## Running on your computer

Needs Docker, the Supabase CLI and the Stellar CLI.

```bash
# from the repo root
docker run -d --name stellar -p 8000:8000 stellar/quickstart:latest --local --enable core,horizon,rpc
stellar contract build
stellar keys generate deployer --network local --fund
stellar contract deploy --wasm target/wasm32v1-none/release/signcerely.wasm --source-account deployer --network local
supabase start      # note the API URL and keys it prints

cd app
# put these in your shell (values from above):
#   NEXT_PUBLIC_E2E=1 NEXT_PUBLIC_STELLAR_NETWORK=local NEXT_PUBLIC_STELLAR_RPC_URL=http://localhost:8000/rpc
#   NEXT_PUBLIC_CONTRACT_ID=... NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
#   SUPABASE_URL=... SUPABASE_SECRET_KEY=... SESSION_SECRET=<32+ chars> INVITE_ENCRYPTION_KEY=<32+ chars>
#   APP_URL=http://localhost:3100 E2E_MAIL_DIR=/tmp/signcerely-mail
npm run build
npx playwright test
```
