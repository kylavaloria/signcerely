#![cfg(test)]
extern crate std;

use super::*;
use ed25519_dalek::{Signer as _, SigningKey};
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    Address, BytesN, Env, Vec,
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

    assert_eq!(s.client.find_by_hash(&h(e, FINAL)), HashMatch::Final(h(e, DOC)));
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
        s.client
            .try_create(&s.sender, &h(e, DOC), &h(e, ORIGINAL), &s.invites(MAX_SIGNERS as usize + 1), &true),
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
        s.client.get_signatures(&h(e, DOC)).get(0).unwrap().unwrap().signer,
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
