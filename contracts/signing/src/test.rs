#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    vec, Address, BytesN, Env,
};

struct Setup<'a> {
    env: Env,
    client: SigningContractClient<'a>,
    sender: Address,
    a: Address,
    b: Address,
    c: Address,
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_762_560_000);
    let id = env.register(SigningContract, ());
    let client = SigningContractClient::new(&env, &id);
    Setup {
        sender: Address::generate(&env),
        a: Address::generate(&env),
        b: Address::generate(&env),
        c: Address::generate(&env),
        client,
        env,
    }
}

fn h(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

const DOC: u8 = 1;
const ORIGINAL: u8 = 10;
const FINAL: u8 = 20;
const IMG_A: u8 = 31;
const IMG_B: u8 = 32;
const IMG_C: u8 = 33;

#[test]
fn full_flow_in_order_completes_and_is_findable() {
    let s = setup();
    let e = &s.env;
    s.client.create(
        &s.sender,
        &h(e, DOC),
        &h(e, ORIGINAL),
        &vec![e, s.a.clone(), s.b.clone()],
        &true,
    );

    let doc = s.client.get_document(&h(e, DOC));
    assert_eq!(doc.status, Status::Pending);
    assert_eq!(doc.signed_count, 0);
    assert_eq!(doc.final_hash, None);

    s.client.sign(&s.a, &h(e, DOC), &h(e, IMG_A), &None);
    e.ledger().set_timestamp(1_762_560_600);
    s.client
        .sign(&s.b, &h(e, DOC), &h(e, IMG_B), &Some(h(e, FINAL)));

    let doc = s.client.get_document(&h(e, DOC));
    assert_eq!(doc.status, Status::Completed);
    assert_eq!(doc.signed_count, 2);
    assert_eq!(doc.final_hash, Some(h(e, FINAL)));
    assert_eq!(doc.completed_at, Some(1_762_560_600));

    let sigs = s.client.get_signatures(&h(e, DOC));
    let first = sigs.get(0).unwrap().unwrap();
    let second = sigs.get(1).unwrap().unwrap();
    assert_eq!(first.signer, s.a);
    assert_eq!(first.image_hash, h(e, IMG_A));
    assert_eq!(first.signed_at, 1_762_560_000);
    assert_eq!(second.signed_at, 1_762_560_600);

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
fn create_requires_sender_auth_and_sign_requires_signer_auth() {
    let s = setup();
    let e = &s.env;
    s.client.create(
        &s.sender,
        &h(e, DOC),
        &h(e, ORIGINAL),
        &vec![e, s.a.clone(), s.b.clone()],
        &false,
    );
    let auths = e.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.sender);

    s.client.sign(&s.b, &h(e, DOC), &h(e, IMG_B), &None);
    let auths = e.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.b);
}

#[test]
#[should_panic]
fn sign_without_wallet_approval_fails() {
    let env = Env::default();
    let id = env.register(SigningContract, ());
    let client = SigningContractClient::new(&env, &id);
    let sender = Address::generate(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    // No mock_all_auths: the sender never approved.
    client.create(&sender, &h(&env, DOC), &h(&env, ORIGINAL), &vec![&env, a, b], &true);
}

#[test]
fn signer_count_must_be_two_to_five() {
    let s = setup();
    let e = &s.env;
    assert_eq!(
        s.client
            .try_create(&s.sender, &h(e, DOC), &h(e, ORIGINAL), &vec![e, s.a.clone()], &true),
        Err(Ok(Error::InvalidSignerCount))
    );
    let mut six = vec![e];
    for _ in 0..6 {
        six.push_back(Address::generate(e));
    }
    assert_eq!(
        s.client
            .try_create(&s.sender, &h(e, DOC), &h(e, ORIGINAL), &six, &true),
        Err(Ok(Error::InvalidSignerCount))
    );
    let mut five = vec![e];
    for _ in 0..5 {
        five.push_back(Address::generate(e));
    }
    s.client
        .create(&s.sender, &h(e, DOC), &h(e, ORIGINAL), &five, &true);
}

#[test]
fn duplicate_signers_and_ids_and_hashes_are_rejected() {
    let s = setup();
    let e = &s.env;
    assert_eq!(
        s.client.try_create(
            &s.sender,
            &h(e, DOC),
            &h(e, ORIGINAL),
            &vec![e, s.a.clone(), s.a.clone()],
            &true
        ),
        Err(Ok(Error::DuplicateSigner))
    );
    s.client.create(
        &s.sender,
        &h(e, DOC),
        &h(e, ORIGINAL),
        &vec![e, s.a.clone(), s.b.clone()],
        &true,
    );
    assert_eq!(
        s.client.try_create(
            &s.sender,
            &h(e, DOC),
            &h(e, 11),
            &vec![e, s.a.clone(), s.b.clone()],
            &true
        ),
        Err(Ok(Error::AlreadyExists))
    );
    assert_eq!(
        s.client.try_create(
            &s.sender,
            &h(e, 2),
            &h(e, ORIGINAL),
            &vec![e, s.a.clone(), s.b.clone()],
            &true
        ),
        Err(Ok(Error::HashInUse))
    );
}

#[test]
fn in_order_blocks_later_signers_until_their_turn() {
    let s = setup();
    let e = &s.env;
    s.client.create(
        &s.sender,
        &h(e, DOC),
        &h(e, ORIGINAL),
        &vec![e, s.a.clone(), s.b.clone(), s.c.clone()],
        &true,
    );
    assert_eq!(
        s.client.try_sign(&s.b, &h(e, DOC), &h(e, IMG_B), &None),
        Err(Ok(Error::NotYourTurn))
    );
    assert_eq!(
        s.client.try_sign(&s.c, &h(e, DOC), &h(e, IMG_C), &None),
        Err(Ok(Error::NotYourTurn))
    );
    s.client.sign(&s.a, &h(e, DOC), &h(e, IMG_A), &None);
    assert_eq!(
        s.client.try_sign(&s.c, &h(e, DOC), &h(e, IMG_C), &None),
        Err(Ok(Error::NotYourTurn))
    );
    s.client.sign(&s.b, &h(e, DOC), &h(e, IMG_B), &None);
    s.client
        .sign(&s.c, &h(e, DOC), &h(e, IMG_C), &Some(h(e, FINAL)));
    assert_eq!(
        s.client.get_document(&h(e, DOC)).status,
        Status::Completed
    );
}

#[test]
fn all_at_once_allows_any_order() {
    let s = setup();
    let e = &s.env;
    s.client.create(
        &s.sender,
        &h(e, DOC),
        &h(e, ORIGINAL),
        &vec![e, s.a.clone(), s.b.clone(), s.c.clone()],
        &false,
    );
    s.client.sign(&s.c, &h(e, DOC), &h(e, IMG_C), &None);
    s.client.sign(&s.a, &h(e, DOC), &h(e, IMG_A), &None);
    s.client
        .sign(&s.b, &h(e, DOC), &h(e, IMG_B), &Some(h(e, FINAL)));
    let sigs = s.client.get_signatures(&h(e, DOC));
    assert!(sigs.iter().all(|x| x.is_some()));
}

#[test]
fn outsiders_and_repeat_signers_are_rejected() {
    let s = setup();
    let e = &s.env;
    s.client.create(
        &s.sender,
        &h(e, DOC),
        &h(e, ORIGINAL),
        &vec![e, s.a.clone(), s.b.clone(), s.c.clone()],
        &false,
    );
    let stranger = Address::generate(e);
    assert_eq!(
        s.client.try_sign(&stranger, &h(e, DOC), &h(e, 40), &None),
        Err(Ok(Error::NotASigner))
    );
    s.client.sign(&s.a, &h(e, DOC), &h(e, IMG_A), &None);
    assert_eq!(
        s.client.try_sign(&s.a, &h(e, DOC), &h(e, IMG_A), &None),
        Err(Ok(Error::AlreadySigned))
    );
    assert_eq!(
        s.client.try_sign(&s.a, &h(e, 77), &h(e, IMG_A), &None),
        Err(Ok(Error::NotFound))
    );
}

#[test]
fn final_hash_only_and_always_on_last_signature() {
    let s = setup();
    let e = &s.env;
    s.client.create(
        &s.sender,
        &h(e, DOC),
        &h(e, ORIGINAL),
        &vec![e, s.a.clone(), s.b.clone()],
        &true,
    );
    assert_eq!(
        s.client
            .try_sign(&s.a, &h(e, DOC), &h(e, IMG_A), &Some(h(e, FINAL))),
        Err(Ok(Error::FinalHashNotExpected))
    );
    s.client.sign(&s.a, &h(e, DOC), &h(e, IMG_A), &None);
    assert_eq!(
        s.client.try_sign(&s.b, &h(e, DOC), &h(e, IMG_B), &None),
        Err(Ok(Error::FinalHashRequired))
    );
    // The final copy can't reuse the original's fingerprint.
    assert_eq!(
        s.client
            .try_sign(&s.b, &h(e, DOC), &h(e, IMG_B), &Some(h(e, ORIGINAL))),
        Err(Ok(Error::HashInUse))
    );
    // Failed attempts left nothing behind: b can still sign.
    s.client
        .sign(&s.b, &h(e, DOC), &h(e, IMG_B), &Some(h(e, FINAL)));
    assert_eq!(s.client.get_document(&h(e, DOC)).signed_count, 2);
    assert_eq!(
        s.client.try_sign(&s.b, &h(e, DOC), &h(e, IMG_B), &None),
        Err(Ok(Error::NotPending))
    );
}

#[test]
fn decline_stops_the_document() {
    let s = setup();
    let e = &s.env;
    s.client.create(
        &s.sender,
        &h(e, DOC),
        &h(e, ORIGINAL),
        &vec![e, s.a.clone(), s.b.clone()],
        &false,
    );
    let stranger = Address::generate(e);
    assert_eq!(
        s.client.try_decline(&stranger, &h(e, DOC)),
        Err(Ok(Error::NotASigner))
    );
    s.client.decline(&s.b, &h(e, DOC));
    assert_eq!(s.client.get_document(&h(e, DOC)).status, Status::Declined);
    assert_eq!(
        s.client.try_sign(&s.a, &h(e, DOC), &h(e, IMG_A), &None),
        Err(Ok(Error::NotPending))
    );
}

#[test]
fn only_the_sender_can_cancel_a_pending_document() {
    let s = setup();
    let e = &s.env;
    s.client.create(
        &s.sender,
        &h(e, DOC),
        &h(e, ORIGINAL),
        &vec![e, s.a.clone(), s.b.clone()],
        &true,
    );
    assert_eq!(
        s.client.try_cancel(&s.a, &h(e, DOC)),
        Err(Ok(Error::NotSender))
    );
    s.client.cancel(&s.sender, &h(e, DOC));
    assert_eq!(s.client.get_document(&h(e, DOC)).status, Status::Cancelled);
    assert_eq!(
        s.client.try_cancel(&s.sender, &h(e, DOC)),
        Err(Ok(Error::NotPending))
    );
    assert_eq!(
        s.client.try_sign(&s.a, &h(e, DOC), &h(e, IMG_A), &None),
        Err(Ok(Error::NotPending))
    );
}

#[test]
fn every_step_emits_an_event() {
    let s = setup();
    let e = &s.env;
    s.client.create(
        &s.sender,
        &h(e, DOC),
        &h(e, ORIGINAL),
        &vec![e, s.a.clone(), s.b.clone()],
        &true,
    );
    assert_eq!(e.events().all().events().len(), 1);
    s.client.sign(&s.a, &h(e, DOC), &h(e, IMG_A), &None);
    assert_eq!(e.events().all().events().len(), 1);
    s.client
        .sign(&s.b, &h(e, DOC), &h(e, IMG_B), &Some(h(e, FINAL)));
    // signed + completed
    assert_eq!(e.events().all().events().len(), 2);
}
