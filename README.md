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

1. **Send** — the sender registers the document: the SHA-256 fingerprint of the original PDF, one *signing slot* per invited person, and whether slots sign in order. The sender approves this in their wallet.
2. **Invite** — people are invited by email and may not have a wallet yet, so the app makes a one-time *invite key* per slot. Only its public half goes on-chain; the secret half is in that person's invite link.
3. **Sign** — the invitee connects any wallet. Their browser uses the invite secret to sign a short message naming that wallet (`invite_message`), and the wallet approves the transaction. The contract checks both, checks it's their turn (if signing in order), and binds that wallet to the slot. A copied proof is useless to anyone else because it names the invitee's wallet. The contract also stores the fingerprint of the signature image they used, so a swapped image can be spotted later.
4. **Complete** — the last signer's approval also carries the fingerprint of the final signed copy (the PDF with every signature and date stamped on it). No extra transaction is needed.
5. **Verify** — anyone can upload a file; the app fingerprints it in the browser and asks the contract whether it matches an original or a final signed copy.

Signers can **decline**, and the sender can **cancel** while a document is still waiting.

### Contract functions

| Function | Who calls it | Notes |
|---|---|---|
| `create(sender, doc_id, original_hash, invite_keys, in_order)` | Sender | 2–5 unique invite keys; id and fingerprint must be new |
| `sign(signer, doc_id, slot, invite_proof, image_hash, final_hash?)` | Invitee | `final_hash` required on the last signature only; one wallet per document |
| `decline(signer, doc_id, slot, invite_proof)` | Invitee | Stops the document |
| `cancel(sender, doc_id)` | Sender | Only while pending |
| `invite_message(doc_id, slot, signer)` | Anyone (read) | The exact bytes an invite proof signs |
| `get_document(doc_id)` | Anyone (read) | Status, invite keys, fingerprints, times |
| `get_signatures(doc_id)` | Anyone (read) | One entry per slot: wallet, image fingerprint, time |
| `find_by_hash(hash)` | Anyone (read) | `Original(id)`, `Final(id)` or `None` |

Events are emitted for every step (`doc/created`, `doc/signed`, `doc/completed`, `doc/declined`, `doc/cancelled`).

**Known limit:** the final fingerprint is supplied by the last signer's app. A wrong value can't fake anyone's signature, but the real signed copy would then not match on Verify.

### Testnet deployment

| | |
|---|---|
| Contract ID | `CCG4G2T6F7K2PVGSGRTRSTB4GSMLB4GLMULEMODGYI74MOWMTNZ5RZMP` |
| Explorer | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCG4G2T6F7K2PVGSGRTRSTB4GSMLB4GLMULEMODGYI74MOWMTNZ5RZMP) · [Stellar Lab](https://lab.stellar.org/r/testnet/contract/CCG4G2T6F7K2PVGSGRTRSTB4GSMLB4GLMULEMODGYI74MOWMTNZ5RZMP) |
| Deployed | Nov 8, 2026 from commit `5b0f633` via the *Deploy to testnet* workflow |

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
