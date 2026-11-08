//! It's Your Sign — on-chain record for multi-party document signing.
//!
//! The PDF itself never touches the chain. The contract stores:
//! - the SHA-256 fingerprint of the original file (when it is sent),
//! - who must sign, and whether they sign in order,
//! - each signer's approval (their wallet's auth), the fingerprint of the
//!   signature image they used, and the ledger time it happened,
//! - the fingerprint of the final signed copy (sent with the last signature).
//!
//! Lookups by fingerprint let the public Verify page find a document from an
//! uploaded file alone.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env, Vec,
};

/// Smallest and largest number of signers a document may have.
pub const MIN_SIGNERS: u32 = 2;
pub const MAX_SIGNERS: u32 = 5;

/// Persistent entries are bumped to ~30 days on every write and read-through
/// helper, and re-bumped once they fall below ~7 days. Archived entries can be
/// restored, so this only affects rent, never correctness.
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
    /// The same wallet appears twice in the signer list.
    DuplicateSigner = 4,
    /// The caller is not on this document's signer list.
    NotASigner = 5,
    /// The caller has already signed.
    AlreadySigned = 6,
    /// Signing in order, and an earlier signer has not signed yet.
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
    pub signers: Vec<Address>,
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
    /// (doc_id, signer index in the signer list)
    Sig(BytesN<32>, u32),
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
    /// the app's database and the chain share one id.
    pub fn create(
        env: Env,
        sender: Address,
        doc_id: BytesN<32>,
        original_hash: BytesN<32>,
        signers: Vec<Address>,
        in_order: bool,
    ) -> Result<(), Error> {
        sender.require_auth();

        let doc_key = DataKey::Doc(doc_id.clone());
        if env.storage().persistent().has(&doc_key) {
            return Err(Error::AlreadyExists);
        }
        let n = signers.len();
        if n < MIN_SIGNERS || n > MAX_SIGNERS {
            return Err(Error::InvalidSignerCount);
        }
        for i in 0..n {
            for j in (i + 1)..n {
                if signers.get_unchecked(i) == signers.get_unchecked(j) {
                    return Err(Error::DuplicateSigner);
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
            signers,
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

    /// Record `signer`'s signature. The last signer must also pass the
    /// fingerprint of the final signed copy, which completes the document.
    pub fn sign(
        env: Env,
        signer: Address,
        doc_id: BytesN<32>,
        image_hash: BytesN<32>,
        final_hash: Option<BytesN<32>>,
    ) -> Result<(), Error> {
        signer.require_auth();

        let doc_key = DataKey::Doc(doc_id.clone());
        let mut doc = load_doc(&env, &doc_key)?;
        if doc.status != Status::Pending {
            return Err(Error::NotPending);
        }
        let idx = doc
            .signers
            .first_index_of(&signer)
            .ok_or(Error::NotASigner)?;
        if env
            .storage()
            .persistent()
            .has(&DataKey::Sig(doc_id.clone(), idx))
        {
            return Err(Error::AlreadySigned);
        }
        if doc.in_order {
            for earlier in 0..idx {
                if !env
                    .storage()
                    .persistent()
                    .has(&DataKey::Sig(doc_id.clone(), earlier))
                {
                    return Err(Error::NotYourTurn);
                }
            }
        }

        let is_last = doc.signed_count + 1 == doc.signers.len();
        match (&final_hash, is_last) {
            (None, true) => return Err(Error::FinalHashRequired),
            (Some(_), false) => return Err(Error::FinalHashNotExpected),
            _ => {}
        }
        if let Some(fh) = &final_hash {
            let store = env.storage().persistent();
            if store.has(&DataKey::FinalHash(fh.clone()))
                || store.has(&DataKey::OriginalHash(fh.clone()))
            {
                return Err(Error::HashInUse);
            }
        }

        let now = env.ledger().timestamp();
        save(
            &env,
            &DataKey::Sig(doc_id.clone(), idx),
            &Signature {
                signer: signer.clone(),
                image_hash: image_hash.clone(),
                signed_at: now,
            },
        );
        doc.signed_count += 1;

        DocSigned {
            doc_id: doc_id.clone(),
            signer,
            image_hash,
            signed_count: doc.signed_count,
        }
        .publish(&env);

        if let Some(fh) = final_hash {
            let final_key = DataKey::FinalHash(fh.clone());
            doc.status = Status::Completed;
            doc.final_hash = Some(fh.clone());
            doc.completed_at = Some(now);
            save(&env, &final_key, &doc_id);
            DocCompleted {
                doc_id: doc_id.clone(),
                final_hash: fh,
            }
            .publish(&env);
        }

        save(&env, &doc_key, &doc);
        Ok(())
    }

    /// A signer declines. The document stops; no one else can sign it.
    pub fn decline(env: Env, signer: Address, doc_id: BytesN<32>) -> Result<(), Error> {
        signer.require_auth();
        let doc_key = DataKey::Doc(doc_id.clone());
        let mut doc = load_doc(&env, &doc_key)?;
        if doc.status != Status::Pending {
            return Err(Error::NotPending);
        }
        if doc.signers.first_index_of(&signer).is_none() {
            return Err(Error::NotASigner);
        }
        doc.status = Status::Declined;
        save(&env, &doc_key, &doc);
        DocDeclined { doc_id, signer }.publish(&env);
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

    pub fn get_document(env: Env, doc_id: BytesN<32>) -> Result<Document, Error> {
        load_doc(&env, &DataKey::Doc(doc_id))
    }

    /// One entry per signer, in signer-list order; `None` where not signed yet.
    pub fn get_signatures(env: Env, doc_id: BytesN<32>) -> Result<Vec<Option<Signature>>, Error> {
        let doc = load_doc(&env, &DataKey::Doc(doc_id.clone()))?;
        let mut out = Vec::new(&env);
        for i in 0..doc.signers.len() {
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
