-- One confirmed email belongs to one account.
--
-- Unconfirmed emails may repeat (anyone can type any address, so blocking those
-- would let a stranger squat on someone else's email). The first account to
-- confirm an address by clicking the emailed link keeps it.

-- Test data may already have the same email confirmed on two wallets: keep the
-- earliest confirmation and un-confirm the rest (they can confirm another email).
update public.profiles p
   set email_verified_at = null
 where p.email_verified_at is not null
   and exists (
     select 1
       from public.profiles q
      where lower(q.email) = lower(p.email)
        and q.email_verified_at is not null
        and (q.email_verified_at, q.wallet_address) < (p.email_verified_at, p.wallet_address)
   );

create unique index profiles_confirmed_email_key
  on public.profiles (lower(email))
  where email_verified_at is not null;
