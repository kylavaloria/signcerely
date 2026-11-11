//! Signcerely — on-chain record for multi-party document signing.
//!
//! The PDF itself never touches the chain. The contract stores:
//! - the SHA-256 fingerprint of the original file (when it is sent),
//! - one *signing slot* per invited person, and whether slots sign in order,
//! - each signer's wallet approval, the fingerprint of the signature image
//!   they used, and the ledger time it happened,
//! - the fingerprint of the final signed copy (sent with the last signature).
//!
//! ## Why invite keys
//! People are invited by email and may not have a wallet yet, so the sender
//! can't list wallet addresses up front. Instead the app makes a one-time
//! ed25519 *invite key* for each slot. Only the public half goes on-chain; the
//! secret half travels in that person's invite link. To sign, the invitee's
//! browser uses the invite secret to sign a short message naming their wallet
//! (`invite_message`), and their wallet approves the transaction. The contract
//! checks both, then binds that wallet to the slot. A copied proof is useless
//! to anyone else because it names the invitee's wallet.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, xdr::ToXdr, Address,
    Bytes, BytesN, Env, Vec,
};

/// Smallest and largest number of signers a document may have.
pub const MIN_SIGNERS: u32 = 2;
pub const MAX_SIGNERS: u32 = 20;

/// Domain separator for invite proofs. Bump the version if the format changes.
const PROOF_DOMAIN: &[u8] = b"signcerely:invite:v1";

/// Persistent entries are bumped to ~30 days on every write, and re-bumped
/// once they fall below ~7 days. Archived entries can be restored, so this
/// only affects rent, never correctness.
const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_TO: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// A document with this id already exists.
    AlreadyExists = 1,
    /// No document with this id.
    NotFound = 2,
    /// Signer count must be between MIN_SIGNERS and MAX_SIGNERS.
    InvalidSignerCount = 3,
    /// The same invite key appears twice.
    DuplicateInvite = 4,
    /// The slot number is out of range.
    NoSuchSlot = 5,
    /// This slot has already been signed.
    AlreadySigned = 6,
    /// Signing in order, and an earlier slot has not signed yet.
    NotYourTurn = 7,
    /// The document is completed, declined or cancelled.
    NotPending = 8,
    /// The last signature must include the final signed copy's fingerprint.
    FinalHashRequired = 9,
    /// Only the last signature may include a final fingerprint.
    FinalHashNotExpected = 10,
    /// Only the sender can do this.
    NotSender = 11,
    /// This fingerprint is already registered to another document.
    HashInUse = 12,
    /// This wallet already signed another slot of this document.
    WalletAlreadyUsed = 13,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Status {
    Pending = 0,
    Completed = 1,
    Declined = 2,
    Cancelled = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Document {
    pub sender: Address,
    pub original_hash: BytesN<32>,
    /// Public invite key per slot, in signing order.
    pub invite_keys: Vec<BytesN<32>>,
    pub in_order: bool,
    pub status: Status,
    pub signed_count: u32,
    pub created_at: u64,
    /// Fingerprint of the final stamped PDF; set when the last signer signs.
    pub final_hash: Option<BytesN<32>>,
    pub completed_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Signature {
    /// The wallet that signed this slot.
    pub signer: Address,
    /// Fingerprint of the signature image stamped on the PDF, so a swapped
    /// image can be detected later.
    pub image_hash: BytesN<32>,
    pub signed_at: u64,
}

/// What a fingerprint matches, for the Verify page.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum HashMatch {
    /// The original file that was sent for signing.
    Original(BytesN<32>),
    /// The final signed copy.
    Final(BytesN<32>),
    None,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Doc(BytesN<32>),
    /// (doc_id, slot) -> Signature
    Sig(BytesN<32>, u32),
    /// (doc_id, wallet) -> slot, so one wallet can't fill two slots.
    Wallet(BytesN<32>, Address),
    OriginalHash(BytesN<32>),
    FinalHash(BytesN<32>),
}

#[contractevent(topics = ["doc", "created"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DocCreated {
    #[topic]
    pub doc_id: BytesN<32>,
    pub sender: Address,
    pub original_hash: BytesN<32>,
    pub signer_count: u32,
    pub in_order: bool,
}

#[contractevent(topics = ["doc", "signed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DocSigned {
    #[topic]
    pub doc_id: BytesN<32>,
    pub slot: u32,
    pub signer: Address,
    pub image_hash: BytesN<32>,
    pub signed_count: u32,
}

#[contractevent(topics = ["doc", "completed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DocCompleted {
    #[topic]
    pub doc_id: BytesN<32>,
    pub final_hash: BytesN<32>,
}

#[contractevent(topics = ["doc", "declined"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DocDeclined {
    #[topic]
    pub doc_id: BytesN<32>,
    pub slot: u32,
    pub signer: Address,
}

#[contractevent(topics = ["doc", "cancelled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DocCancelled {
    #[topic]
    pub doc_id: BytesN<32>,
}

#[contract]
pub struct SigningContract;

#[contractimpl]
impl SigningContract {
    /// Register a document for signing. Called by the sender, who approves in
    /// their wallet. `doc_id` is chosen by the app (e.g. SHA-256 of a UUID) so
    /// the app's database and the chain share one id. `invite_keys` holds the
    /// public invite key for each signer, in signing order.
    pub fn create(
        env: Env,
        sender: Address,
        doc_id: BytesN<32>,
        original_hash: BytesN<32>,
        invite_keys: Vec<BytesN<32>>,
        in_order: bool,
    ) -> Result<(), Error> {
        sender.require_auth();

        let doc_key = DataKey::Doc(doc_id.clone());
        if env.storage().persistent().has(&doc_key) {
            return Err(Error::AlreadyExists);
        }
        let n = invite_keys.len();
        if n < MIN_SIGNERS || n > MAX_SIGNERS {
            return Err(Error::InvalidSignerCount);
        }
        for i in 0..n {
            for j in (i + 1)..n {
                if invite_keys.get_unchecked(i) == invite_keys.get_unchecked(j) {
                    return Err(Error::DuplicateInvite);
                }
            }
        }
        let orig_key = DataKey::OriginalHash(original_hash.clone());
        if env.storage().persistent().has(&orig_key) {
            return Err(Error::HashInUse);
        }

        let doc = Document {
            sender: sender.clone(),
            original_hash: original_hash.clone(),
            invite_keys,
            in_order,
            status: Status::Pending,
            signed_count: 0,
            created_at: env.ledger().timestamp(),
            final_hash: None,
            completed_at: None,
        };
        save(&env, &doc_key, &doc);
        save(&env, &orig_key, &doc_id);

        DocCreated {
            doc_id,
            sender,
            original_hash,
            signer_count: n,
            in_order,
        }
        .publish(&env);
        Ok(())
    }

    /// Sign `slot` as `signer`. `invite_proof` is the ed25519 signature, made
    /// with that slot's invite secret, over `invite_message(doc_id, slot,
    /// signer)`. The last signer must also pass the final signed copy's
    /// fingerprint, which completes the document.
    ///
    /// An invalid `invite_proof` aborts the transaction.
    pub fn sign(
        env: Env,
        signer: Address,
        doc_id: BytesN<32>,
        slot: u32,
        invite_proof: BytesN<64>,
        image_hash: BytesN<32>,
        final_hash: Option<BytesN<32>>,
    ) -> Result<(), Error> {
        signer.require_auth();

        let doc_key = DataKey::Doc(doc_id.clone());
        let mut doc = load_doc(&env, &doc_key)?;
        if doc.status != Status::Pending {
            return Err(Error::NotPending);
        }
        let invite_key = doc.invite_keys.get(slot).ok_or(Error::NoSuchSlot)?;
        let store = env.storage().persistent();
        if store.has(&DataKey::Sig(doc_id.clone(), slot)) {
            return Err(Error::AlreadySigned);
        }
        if store.has(&DataKey::Wallet(doc_id.clone(), signer.clone())) {
            return Err(Error::WalletAlreadyUsed);
        }
        if doc.in_order {
            for earlier in 0..slot {
                if !store.has(&DataKey::Sig(doc_id.clone(), earlier)) {
                    return Err(Error::NotYourTurn);
                }
            }
        }

        let is_last = doc.signed_count + 1 == doc.invite_keys.len();
        match (&final_hash, is_last) {
            (None, true) => return Err(Error::FinalHashRequired),
            (Some(_), false) => return Err(Error::FinalHashNotExpected),
            _ => {}
        }
        if let Some(fh) = &final_hash {
            if store.has(&DataKey::FinalHash(fh.clone()))
                || store.has(&DataKey::OriginalHash(fh.clone()))
            {
                return Err(Error::HashInUse);
            }
        }

        check_invite(&env, &invite_key, &doc_id, slot, &signer, &invite_proof);

        let now = env.ledger().timestamp();
        save(
            &env,
            &DataKey::Sig(doc_id.clone(), slot),
            &Signature {
                signer: signer.clone(),
                image_hash: image_hash.clone(),
                signed_at: now,
            },
        );
        save(&env, &DataKey::Wallet(doc_id.clone(), signer.clone()), &slot);
        doc.signed_count += 1;

        DocSigned {
            doc_id: doc_id.clone(),
            slot,
            signer,
            image_hash,
            signed_count: doc.signed_count,
        }
        .publish(&env);

        if let Some(fh) = final_hash {
            doc.status = Status::Completed;
            doc.final_hash = Some(fh.clone());
            doc.completed_at = Some(now);
            save(&env, &DataKey::FinalHash(fh.clone()), &doc_id);
            DocCompleted {
                doc_id: doc_id.clone(),
                final_hash: fh,
            }
            .publish(&env);
        }

        save(&env, &doc_key, &doc);
        Ok(())
    }

    /// The invitee for `slot` declines. The document stops; no one else can
    /// sign it. Needs the same invite proof as `sign`.
    pub fn decline(
        env: Env,
        signer: Address,
        doc_id: BytesN<32>,
        slot: u32,
        invite_proof: BytesN<64>,
    ) -> Result<(), Error> {
        signer.require_auth();
        let doc_key = DataKey::Doc(doc_id.clone());
        let mut doc = load_doc(&env, &doc_key)?;
        if doc.status != Status::Pending {
            return Err(Error::NotPending);
        }
        let invite_key = doc.invite_keys.get(slot).ok_or(Error::NoSuchSlot)?;
        if env
            .storage()
            .persistent()
            .has(&DataKey::Sig(doc_id.clone(), slot))
        {
            return Err(Error::AlreadySigned);
        }
        check_invite(&env, &invite_key, &doc_id, slot, &signer, &invite_proof);

        doc.status = Status::Declined;
        save(&env, &doc_key, &doc);
        DocDeclined {
            doc_id,
            slot,
            signer,
        }
        .publish(&env);
        Ok(())
    }

    /// The sender cancels a document that is still waiting for signatures.
    pub fn cancel(env: Env, sender: Address, doc_id: BytesN<32>) -> Result<(), Error> {
        sender.require_auth();
        let doc_key = DataKey::Doc(doc_id.clone());
        let mut doc = load_doc(&env, &doc_key)?;
        if doc.sender != sender {
            return Err(Error::NotSender);
        }
        if doc.status != Status::Pending {
            return Err(Error::NotPending);
        }
        doc.status = Status::Cancelled;
        save(&env, &doc_key, &doc);
        DocCancelled { doc_id }.publish(&env);
        Ok(())
    }

    // ---- Read-only helpers (free to simulate, used by the app and Verify) ----

    /// The exact bytes an invite proof must sign. The app fetches this by
    /// simulation, so it never has to rebuild the format itself.
    pub fn invite_message(env: Env, doc_id: BytesN<32>, slot: u32, signer: Address) -> Bytes {
        build_message(&env, &doc_id, slot, &signer)
    }

    pub fn get_document(env: Env, doc_id: BytesN<32>) -> Result<Document, Error> {
        load_doc(&env, &DataKey::Doc(doc_id))
    }

    /// One entry per slot, in signing order; `None` where not signed yet.
    pub fn get_signatures(env: Env, doc_id: BytesN<32>) -> Result<Vec<Option<Signature>>, Error> {
        let doc = load_doc(&env, &DataKey::Doc(doc_id.clone()))?;
        let mut out = Vec::new(&env);
        for i in 0..doc.invite_keys.len() {
            out.push_back(
                env.storage()
                    .persistent()
                    .get(&DataKey::Sig(doc_id.clone(), i)),
            );
        }
        Ok(out)
    }

    /// Look up a file fingerprint: is it a document's original or its final
    /// signed copy? Returns the doc id so the app can show who signed.
    pub fn find_by_hash(env: Env, hash: BytesN<32>) -> HashMatch {
        let store = env.storage().persistent();
        if let Some(id) = store.get::<_, BytesN<32>>(&DataKey::FinalHash(hash.clone())) {
            return HashMatch::Final(id);
        }
        if let Some(id) = store.get::<_, BytesN<32>>(&DataKey::OriginalHash(hash)) {
            return HashMatch::Original(id);
        }
        HashMatch::None
    }
}

/// domain || contract address (XDR) || doc_id || slot (big-endian u32) || signer (XDR)
fn build_message(env: &Env, doc_id: &BytesN<32>, slot: u32, signer: &Address) -> Bytes {
    let mut msg = Bytes::from_slice(env, PROOF_DOMAIN);
    msg.append(&env.current_contract_address().to_xdr(env));
    msg.append(&Bytes::from_array(env, &doc_id.to_array()));
    msg.append(&Bytes::from_array(env, &slot.to_be_bytes()));
    msg.append(&signer.clone().to_xdr(env));
    msg
}

fn check_invite(
    env: &Env,
    invite_key: &BytesN<32>,
    doc_id: &BytesN<32>,
    slot: u32,
    signer: &Address,
    proof: &BytesN<64>,
) {
    let msg = build_message(env, doc_id, slot, signer);
    env.crypto().ed25519_verify(invite_key, &msg, proof);
}

fn load_doc(env: &Env, key: &DataKey) -> Result<Document, Error> {
    env.storage()
        .persistent()
        .get(key)
        .ok_or(Error::NotFound)
}

fn save<V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(env: &Env, key: &DataKey, value: &V) {
    let store = env.storage().persistent();
    store.set(key, value);
    store.extend_ttl(key, BUMP_THRESHOLD, BUMP_TO);
}

#[cfg(test)]
mod test;
