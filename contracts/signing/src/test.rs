#![cfg(test)]
extern crate std;

use super::*;
use ed25519_dalek::{Signer as _, SigningKey};
use soroban_sdk::{
    testutils::{storage::Persistent as _, Address as _, Events as _, Ledger as _},
    xdr, Address, BytesN, Env, Vec,
};

const T0: u64 = 1_762_560_000;

struct Setup<'a> {
    env: Env,
    client: SigningContractClient<'a>,
    sender: Address,
    /// Wallets of the people who end up signing.
    w: std::vec::Vec<Address>,
    /// Invite secrets, one per slot (the app emails these in the links).
    keys: std::vec::Vec<SigningKey>,
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(T0);
    let id = env.register(SigningContract, ());
    let client = SigningContractClient::new(&env, &id);
    let w = (0..6).map(|_| Address::generate(&env)).collect();
    let keys = (0..(MAX_SIGNERS as u8 + 1))
        .map(|i| SigningKey::from_bytes(&[100 + i; 32]))
        .collect();
    Setup {
        sender: Address::generate(&env),
        w,
        keys,
        client,
        env,
    }
}

fn h(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

impl Setup<'_> {
    fn invites(&self, n: usize) -> Vec<BytesN<32>> {
        let mut v = Vec::new(&self.env);
        for k in &self.keys[..n] {
            v.push_back(BytesN::from_array(&self.env, &k.verifying_key().to_bytes()));
        }
        v
    }

    fn create(&self, n: usize, in_order: bool) {
        self.client.create(
            &self.sender,
            &h(&self.env, DOC),
            &h(&self.env, ORIGINAL),
            &self.invites(n),
            &in_order,
        );
    }

    /// What the invitee's browser does: sign the contract's message with the
    /// invite secret from their link.
    fn proof(&self, key: &SigningKey, slot: u32, wallet: &Address) -> BytesN<64> {
        let msg = self
            .client
            .invite_message(&h(&self.env, DOC), &slot, wallet);
        let bytes: std::vec::Vec<u8> = msg.iter().collect();
        BytesN::from_array(&self.env, &key.sign(&bytes).to_bytes())
    }

    /// Same as `proof`, for any document id.
    fn proof_for(&self, doc: u8, key: &SigningKey, slot: u32, wallet: &Address) -> BytesN<64> {
        let msg = self
            .client
            .invite_message(&h(&self.env, doc), &slot, wallet);
        let bytes: std::vec::Vec<u8> = msg.iter().collect();
        BytesN::from_array(&self.env, &key.sign(&bytes).to_bytes())
    }

    /// Create another document with its own id and original fingerprint.
    fn create_doc(&self, doc: u8, original: u8, n: usize, in_order: bool) {
        self.client.create(
            &self.sender,
            &h(&self.env, doc),
            &h(&self.env, original),
            &self.invites(n),
            &in_order,
        );
    }

    fn try_decline(&self, slot: u32) -> Result<(), Error> {
        let wallet = &self.w[slot as usize];
        let proof = self.proof(&self.keys[slot as usize], slot, wallet);
        match self
            .client
            .try_decline(wallet, &h(&self.env, DOC), &slot, &proof)
        {
            Ok(_) => Ok(()),
            Err(Ok(e)) => Err(e),
            Err(Err(_)) => panic!("host error"),
        }
    }

    fn sign(&self, slot: u32, final_hash: Option<u8>) {
        let wallet = &self.w[slot as usize];
        let proof = self.proof(&self.keys[slot as usize], slot, wallet);
        self.client.sign(
            wallet,
            &h(&self.env, DOC),
            &slot,
            &proof,
            &h(&self.env, IMG + slot as u8),
            &final_hash.map(|n| h(&self.env, n)),
        );
    }

    fn try_sign(&self, slot: u32, final_hash: Option<u8>) -> Result<(), Error> {
        let wallet = &self.w[slot as usize];
        let proof = self.proof(&self.keys[slot as usize], slot, wallet);
        match self.client.try_sign(
            wallet,
            &h(&self.env, DOC),
            &slot,
            &proof,
            &h(&self.env, IMG + slot as u8),
            &final_hash.map(|n| h(&self.env, n)),
        ) {
            Ok(_) => Ok(()),
            Err(Ok(e)) => Err(e),
            Err(Err(_)) => panic!("host error"),
        }
    }
}

const DOC: u8 = 1;
const ORIGINAL: u8 = 10;
const FINAL: u8 = 20;
const IMG: u8 = 30;

#[test]
fn full_flow_in_order_completes_and_is_findable() {
    let s = setup();
    let e = &s.env;
    s.create(2, true);

    let doc = s.client.get_document(&h(e, DOC));
    assert_eq!(doc.status, Status::Pending);
    assert_eq!(doc.invite_keys.len(), 2);

    s.sign(0, None);
    e.ledger().set_timestamp(T0 + 600);
    s.sign(1, Some(FINAL));

    let doc = s.client.get_document(&h(e, DOC));
    assert_eq!(doc.status, Status::Completed);
    assert_eq!(doc.signed_count, 2);
    assert_eq!(doc.final_hash, Some(h(e, FINAL)));
    assert_eq!(doc.completed_at, Some(T0 + 600));

    let sigs = s.client.get_signatures(&h(e, DOC));
    let first = sigs.get(0).unwrap().unwrap();
    let second = sigs.get(1).unwrap().unwrap();
    assert_eq!(first.signer, s.w[0]);
    assert_eq!(first.image_hash, h(e, IMG));
    assert_eq!(first.signed_at, T0);
    assert_eq!(second.signer, s.w[1]);
    assert_eq!(second.signed_at, T0 + 600);

    assert_eq!(
        s.client.find_by_hash(&h(e, FINAL)),
        HashMatch::Final(h(e, DOC))
    );
    assert_eq!(
        s.client.find_by_hash(&h(e, ORIGINAL)),
        HashMatch::Original(h(e, DOC))
    );
    assert_eq!(s.client.find_by_hash(&h(e, 99)), HashMatch::None);
}

#[test]
fn create_needs_sender_approval_and_sign_needs_signer_approval() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    let auths = e.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.sender);

    s.sign(1, None);
    let auths = e.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.w[1]);
}

#[test]
#[should_panic]
fn create_without_wallet_approval_fails() {
    let env = Env::default();
    let id = env.register(SigningContract, ());
    let client = SigningContractClient::new(&env, &id);
    let sender = Address::generate(&env);
    let mut keys = Vec::new(&env);
    keys.push_back(h(&env, 1));
    keys.push_back(h(&env, 2));
    // No mock_all_auths: the sender never approved.
    client.create(&sender, &h(&env, DOC), &h(&env, ORIGINAL), &keys, &true);
}

#[test]
fn signer_count_must_be_within_limits() {
    let s = setup();
    let e = &s.env;
    assert_eq!(
        s.client
            .try_create(&s.sender, &h(e, DOC), &h(e, ORIGINAL), &s.invites(1), &true),
        Err(Ok(Error::InvalidSignerCount))
    );
    assert_eq!(
        s.client.try_create(
            &s.sender,
            &h(e, DOC),
            &h(e, ORIGINAL),
            &s.invites(MAX_SIGNERS as usize + 1),
            &true
        ),
        Err(Ok(Error::InvalidSignerCount))
    );
    s.create(MAX_SIGNERS as usize, true);
}

#[test]
fn duplicate_invites_ids_and_hashes_are_rejected() {
    let s = setup();
    let e = &s.env;
    let mut dup = s.invites(2);
    dup.set(1, dup.get(0).unwrap());
    assert_eq!(
        s.client
            .try_create(&s.sender, &h(e, DOC), &h(e, ORIGINAL), &dup, &true),
        Err(Ok(Error::DuplicateInvite))
    );
    s.create(2, true);
    assert_eq!(
        s.client
            .try_create(&s.sender, &h(e, DOC), &h(e, 11), &s.invites(2), &true),
        Err(Ok(Error::AlreadyExists))
    );
    assert_eq!(
        s.client
            .try_create(&s.sender, &h(e, 2), &h(e, ORIGINAL), &s.invites(2), &true),
        Err(Ok(Error::HashInUse))
    );
}

#[test]
fn in_order_blocks_later_slots_until_their_turn() {
    let s = setup();
    s.create(3, true);
    assert_eq!(s.try_sign(1, None), Err(Error::NotYourTurn));
    assert_eq!(s.try_sign(2, None), Err(Error::NotYourTurn));
    s.sign(0, None);
    assert_eq!(s.try_sign(2, None), Err(Error::NotYourTurn));
    s.sign(1, None);
    s.sign(2, Some(FINAL));
    assert_eq!(
        s.client.get_document(&h(&s.env, DOC)).status,
        Status::Completed
    );
}

#[test]
fn all_at_once_allows_any_order() {
    let s = setup();
    s.create(3, false);
    s.sign(2, None);
    s.sign(0, None);
    s.sign(1, Some(FINAL));
    let sigs = s.client.get_signatures(&h(&s.env, DOC));
    assert!(sigs.iter().all(|x| x.is_some()));
}

#[test]
fn proof_from_the_wrong_invite_is_rejected() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    // Slot 0's invitee tries to sign slot 1 with their own invite secret.
    let proof = s.proof(&s.keys[0], 1, &s.w[0]);
    let res = s
        .client
        .try_sign(&s.w[0], &h(e, DOC), &1, &proof, &h(e, IMG), &None);
    assert!(res.is_err());
    // Nothing was recorded; the real invitee can still sign.
    assert_eq!(s.client.get_document(&h(e, DOC)).signed_count, 0);
    s.sign(1, None);
}

#[test]
fn a_copied_proof_is_useless_to_another_wallet() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    // An attacker sees slot 0's proof (made for wallet w0) and replays it
    // from their own wallet.
    let attacker = Address::generate(e);
    let stolen = s.proof(&s.keys[0], 0, &s.w[0]);
    let res = s
        .client
        .try_sign(&attacker, &h(e, DOC), &0, &stolen, &h(e, IMG), &None);
    assert!(res.is_err());
    s.sign(0, None);
    assert_eq!(
        s.client
            .get_signatures(&h(e, DOC))
            .get(0)
            .unwrap()
            .unwrap()
            .signer,
        s.w[0]
    );
}

#[test]
fn one_wallet_cannot_fill_two_slots() {
    let s = setup();
    let e = &s.env;
    s.create(3, false);
    s.sign(0, None);
    // w0 also holds slot 1's invite (e.g. forwarded email) but already signed.
    let proof = s.proof(&s.keys[1], 1, &s.w[0]);
    assert_eq!(
        s.client
            .try_sign(&s.w[0], &h(e, DOC), &1, &proof, &h(e, IMG), &None),
        Err(Ok(Error::WalletAlreadyUsed))
    );
}

#[test]
fn bad_slots_repeats_and_unknown_docs_are_rejected() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    let proof = s.proof(&s.keys[0], 7, &s.w[0]);
    assert_eq!(
        s.client
            .try_sign(&s.w[0], &h(e, DOC), &7, &proof, &h(e, IMG), &None),
        Err(Ok(Error::NoSuchSlot))
    );
    s.sign(0, None);
    assert_eq!(s.try_sign(0, None), Err(Error::AlreadySigned));
    assert_eq!(
        s.client
            .try_sign(&s.w[1], &h(e, 77), &0, &proof, &h(e, IMG), &None),
        Err(Ok(Error::NotFound))
    );
}

#[test]
fn final_hash_only_and_always_on_last_signature() {
    let s = setup();
    let e = &s.env;
    s.create(2, true);
    assert_eq!(s.try_sign(0, Some(FINAL)), Err(Error::FinalHashNotExpected));
    s.sign(0, None);
    assert_eq!(s.try_sign(1, None), Err(Error::FinalHashRequired));
    // The final copy can't reuse the original's fingerprint.
    assert_eq!(s.try_sign(1, Some(ORIGINAL)), Err(Error::HashInUse));
    // Failed attempts left nothing behind.
    s.sign(1, Some(FINAL));
    assert_eq!(s.client.get_document(&h(e, DOC)).signed_count, 2);
    assert_eq!(s.try_sign(1, None), Err(Error::NotPending));
}

#[test]
fn decline_needs_the_invite_and_stops_the_document() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    let wrong = s.proof(&s.keys[0], 1, &s.w[1]);
    assert!(s
        .client
        .try_decline(&s.w[1], &h(e, DOC), &1, &wrong)
        .is_err());
    assert_eq!(s.client.get_document(&h(e, DOC)).status, Status::Pending);

    let right = s.proof(&s.keys[1], 1, &s.w[1]);
    s.client.decline(&s.w[1], &h(e, DOC), &1, &right);
    assert_eq!(s.client.get_document(&h(e, DOC)).status, Status::Declined);
    assert_eq!(s.try_sign(0, None), Err(Error::NotPending));
}

#[test]
fn only_the_sender_can_cancel_a_pending_document() {
    let s = setup();
    let e = &s.env;
    s.create(2, true);
    assert_eq!(
        s.client.try_cancel(&s.w[0], &h(e, DOC)),
        Err(Ok(Error::NotSender))
    );
    s.client.cancel(&s.sender, &h(e, DOC));
    assert_eq!(s.client.get_document(&h(e, DOC)).status, Status::Cancelled);
    assert_eq!(
        s.client.try_cancel(&s.sender, &h(e, DOC)),
        Err(Ok(Error::NotPending))
    );
    assert_eq!(s.try_sign(0, None), Err(Error::NotPending));
}

#[test]
fn every_step_emits_an_event() {
    let s = setup();
    let e = &s.env;
    s.create(2, true);
    assert_eq!(e.events().all().events().len(), 1);
    s.sign(0, None);
    assert_eq!(e.events().all().events().len(), 1);
    s.sign(1, Some(FINAL));
    // signed + completed
    assert_eq!(e.events().all().events().len(), 2);
}

/// The second topic of each event from the last call, e.g. "declined".
fn event_names(e: &Env) -> std::vec::Vec<std::string::String> {
    e.events()
        .all()
        .events()
        .iter()
        .map(|ev| match &ev.body {
            xdr::ContractEventBody::V0(b) => match &b.topics[1] {
                xdr::ScVal::Symbol(sym) => std::string::String::from_utf8(sym.0.to_vec()).unwrap(),
                _ => std::string::String::new(),
            },
        })
        .collect()
}

// ---- Decline ----

#[test]
fn declining_an_already_signed_slot_fails() {
    let s = setup();
    s.create(3, false);
    s.sign(0, None);
    assert_eq!(s.try_decline(0), Err(Error::AlreadySigned));
    assert_eq!(
        s.client.get_document(&h(&s.env, DOC)).status,
        Status::Pending
    );
}

#[test]
fn declining_a_finished_document_fails() {
    // Completed
    let s = setup();
    s.create(2, true);
    s.sign(0, None);
    s.sign(1, Some(FINAL));
    assert_eq!(s.try_decline(1), Err(Error::NotPending));

    // Cancelled
    let s = setup();
    s.create(2, true);
    s.client.cancel(&s.sender, &h(&s.env, DOC));
    assert_eq!(s.try_decline(0), Err(Error::NotPending));

    // Already declined
    let s = setup();
    s.create(2, false);
    s.try_decline(0).unwrap();
    assert_eq!(s.try_decline(1), Err(Error::NotPending));
}

#[test]
fn declining_a_missing_slot_or_document_fails() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    let proof = s.proof(&s.keys[0], 7, &s.w[0]);
    assert_eq!(
        s.client.try_decline(&s.w[0], &h(e, DOC), &7, &proof),
        Err(Ok(Error::NoSuchSlot))
    );
    assert_eq!(
        s.client.try_decline(&s.w[0], &h(e, 77), &0, &proof),
        Err(Ok(Error::NotFound))
    );
}

#[test]
fn a_copied_decline_proof_is_useless_to_another_wallet() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    let attacker = Address::generate(e);
    let stolen = s.proof(&s.keys[1], 1, &s.w[1]);
    assert!(s
        .client
        .try_decline(&attacker, &h(e, DOC), &1, &stolen)
        .is_err());
    assert_eq!(s.client.get_document(&h(e, DOC)).status, Status::Pending);
}

#[test]
fn declining_needs_the_invitee_to_approve_in_their_wallet() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    s.try_decline(1).unwrap();
    let auths = e.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.w[1]);
}

// ---- Cancel ----

#[test]
fn cancelling_a_finished_document_fails() {
    // Completed
    let s = setup();
    s.create(2, true);
    s.sign(0, None);
    s.sign(1, Some(FINAL));
    assert_eq!(
        s.client.try_cancel(&s.sender, &h(&s.env, DOC)),
        Err(Ok(Error::NotPending))
    );

    // Declined
    let s = setup();
    s.create(2, false);
    s.try_decline(0).unwrap();
    assert_eq!(
        s.client.try_cancel(&s.sender, &h(&s.env, DOC)),
        Err(Ok(Error::NotPending))
    );
}

#[test]
fn the_sender_can_cancel_after_some_signatures_and_no_one_signs_after() {
    let s = setup();
    let e = &s.env;
    s.create(3, true);
    s.sign(0, None);
    s.client.cancel(&s.sender, &h(e, DOC));
    assert_eq!(s.client.get_document(&h(e, DOC)).status, Status::Cancelled);
    assert_eq!(s.try_sign(1, None), Err(Error::NotPending));
    // The signature made before cancelling is kept.
    let sigs = s.client.get_signatures(&h(e, DOC));
    assert_eq!(sigs.get(0).unwrap().unwrap().signer, s.w[0]);
    assert!(sigs.get(1).unwrap().is_none());
}

#[test]
fn cancelling_a_missing_document_fails() {
    let s = setup();
    assert_eq!(
        s.client.try_cancel(&s.sender, &h(&s.env, 77)),
        Err(Ok(Error::NotFound))
    );
}

// ---- Invite proofs ----

#[test]
fn a_proof_with_one_changed_byte_is_rejected() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    let mut bytes = s.proof(&s.keys[0], 0, &s.w[0]).to_array();
    bytes[10] ^= 0x01;
    let tampered = BytesN::from_array(e, &bytes);
    assert!(s
        .client
        .try_sign(&s.w[0], &h(e, DOC), &0, &tampered, &h(e, IMG), &None)
        .is_err());
    assert_eq!(s.client.get_document(&h(e, DOC)).signed_count, 0);
    s.sign(0, None);
}

#[test]
fn a_proof_made_for_another_document_is_rejected() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    s.create_doc(2, 12, 2, false);
    // Same invite key, slot and wallet, but signed for document 2.
    let other = s.proof_for(2, &s.keys[0], 0, &s.w[0]);
    assert!(s
        .client
        .try_sign(&s.w[0], &h(e, DOC), &0, &other, &h(e, IMG), &None)
        .is_err());
    assert_eq!(s.client.get_document(&h(e, DOC)).signed_count, 0);
}

#[test]
fn a_proof_made_for_another_deployment_is_rejected() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    // A second copy of the contract at a different address.
    let other_id = e.register(SigningContract, ());
    let other = SigningContractClient::new(e, &other_id);
    let msg = other.invite_message(&h(e, DOC), &0, &s.w[0]);
    let bytes: std::vec::Vec<u8> = msg.iter().collect();
    let proof = BytesN::from_array(e, &s.keys[0].sign(&bytes).to_bytes());
    assert!(s
        .client
        .try_sign(&s.w[0], &h(e, DOC), &0, &proof, &h(e, IMG), &None)
        .is_err());
    assert_eq!(s.client.get_document(&h(e, DOC)).signed_count, 0);
}

// ---- Signing ----

#[test]
fn the_final_copy_cannot_reuse_a_fingerprint_from_another_document() {
    let s = setup();
    let e = &s.env;
    s.create(2, true);
    s.sign(0, None);
    s.sign(1, Some(FINAL));

    s.create_doc(2, 12, 2, true);
    let p0 = s.proof_for(2, &s.keys[0], 0, &s.w[2]);
    s.client.sign(&s.w[2], &h(e, 2), &0, &p0, &h(e, IMG), &None);
    let p1 = s.proof_for(2, &s.keys[1], 1, &s.w[3]);
    // Another document's final copy, then another document's original.
    for taken in [FINAL, ORIGINAL] {
        assert_eq!(
            s.client
                .try_sign(&s.w[3], &h(e, 2), &1, &p1, &h(e, IMG), &Some(h(e, taken))),
            Err(Ok(Error::HashInUse))
        );
    }
    s.client
        .sign(&s.w[3], &h(e, 2), &1, &p1, &h(e, IMG), &Some(h(e, 21)));
    assert_eq!(s.client.get_document(&h(e, 2)).status, Status::Completed);
}

#[test]
fn one_wallet_can_sign_different_documents() {
    let s = setup();
    let e = &s.env;
    s.create(2, false);
    s.create_doc(2, 12, 2, false);
    s.sign(0, None);
    let proof = s.proof_for(2, &s.keys[0], 0, &s.w[0]);
    s.client
        .sign(&s.w[0], &h(e, 2), &0, &proof, &h(e, IMG), &None);
    assert_eq!(s.client.get_document(&h(e, 2)).signed_count, 1);
}

#[test]
fn the_sender_can_also_be_a_signer() {
    let s = setup();
    let e = &s.env;
    s.create(2, true);
    let proof = s.proof(&s.keys[0], 0, &s.sender);
    s.client
        .sign(&s.sender, &h(e, DOC), &0, &proof, &h(e, IMG), &None);
    s.sign(1, Some(FINAL));
    let sigs = s.client.get_signatures(&h(e, DOC));
    assert_eq!(sigs.get(0).unwrap().unwrap().signer, s.sender);
    assert_eq!(s.client.get_document(&h(e, DOC)).status, Status::Completed);
}

// ---- Storage and events ----

#[test]
fn every_stored_entry_lives_about_30_days() {
    let s = setup();
    let e = &s.env;
    s.create(2, true);
    s.sign(0, None);
    s.sign(1, Some(FINAL));
    let keys = [
        DataKey::Doc(h(e, DOC)),
        DataKey::OriginalHash(h(e, ORIGINAL)),
        DataKey::FinalHash(h(e, FINAL)),
        DataKey::Sig(h(e, DOC), 0),
        DataKey::Sig(h(e, DOC), 1),
        DataKey::Wallet(h(e, DOC), s.w[0].clone()),
        DataKey::Wallet(h(e, DOC), s.w[1].clone()),
    ];
    e.as_contract(&s.client.address, || {
        for key in keys.iter() {
            assert_eq!(e.storage().persistent().get_ttl(key), BUMP_TO);
        }
    });
}

#[test]
fn decline_and_cancel_each_emit_their_event() {
    let s = setup();
    s.create(2, false);
    s.try_decline(1).unwrap();
    assert_eq!(event_names(&s.env), ["declined"]);

    let s = setup();
    s.create(2, false);
    s.client.cancel(&s.sender, &h(&s.env, DOC));
    assert_eq!(event_names(&s.env), ["cancelled"]);
}
