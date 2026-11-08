# It's Your Sign

**This is your sign.** Send a PDF, choose who signs and in what order, and get a signed copy anyone can check — with each signature recorded on Stellar.

> Beta on Stellar testnet. Not for production use yet.

## What's in this repo

| Path | What it is |
|---|---|
| `contracts/signing` | Soroban smart contract that records documents, signatures and the final signed copy |
| `scripts/deploy-testnet.sh` | Builds and deploys the contract to testnet |
| `app/` *(coming next)* | Next.js web app |

## How it works

The PDF never goes on-chain. The contract keeps a small, permanent record:

1. **Send** — the sender registers the document: the SHA-256 fingerprint of the original PDF, the 2–5 signer wallets, and whether they sign in order. The sender approves this in their wallet.
2. **Sign** — each signer approves in their wallet. The contract checks it's really them, that it's their turn (if signing in order), and that they haven't signed already. It also stores the fingerprint of the signature image they used, so a swapped image can be spotted later.
3. **Complete** — the last signer's approval also carries the fingerprint of the final signed copy (the PDF with every signature and date stamped on it). No extra transaction is needed.
4. **Verify** — anyone can upload a file; the app fingerprints it in the browser and asks the contract whether it matches an original or a final signed copy.

Signers can **decline**, and the sender can **cancel** while a document is still waiting.

### Contract functions

| Function | Who calls it | Notes |
|---|---|---|
| `create(sender, doc_id, original_hash, signers, in_order)` | Sender | 2–5 unique signers; id and fingerprint must be new |
| `sign(signer, doc_id, image_hash, final_hash?)` | Signer | `final_hash` required on the last signature only |
| `decline(signer, doc_id)` | Signer | Stops the document |
| `cancel(sender, doc_id)` | Sender | Only while pending |
| `get_document(doc_id)` | Anyone (read) | Status, signers, fingerprints, times |
| `get_signatures(doc_id)` | Anyone (read) | One entry per signer, in order |
| `find_by_hash(hash)` | Anyone (read) | `Original(id)`, `Final(id)` or `None` |

Events are emitted for every step (`doc/created`, `doc/signed`, `doc/completed`, `doc/declined`, `doc/cancelled`).

**Fees:** each user pays their own small network fee in XLM. On testnet, wallets can be funded for free.

## Develop

Requirements: Rust (stable) and, for deploying, the [Stellar CLI](https://developers.stellar.org/docs/tools/cli).

```bash
# run the contract tests
cargo test

# build the WASM
rustup target add wasm32v1-none
stellar contract build

# deploy to testnet (creates and funds a testnet identity if needed)
./scripts/deploy-testnet.sh
```

**No local setup?** Open the repo's **Actions** tab → **Deploy to testnet** → **Run workflow**. It runs the tests, deploys with a throwaway funded testnet wallet, and shows the contract ID and explorer link on the run page.

Built with `soroban-sdk` 28 (Stellar protocol 28).

## License

MIT
