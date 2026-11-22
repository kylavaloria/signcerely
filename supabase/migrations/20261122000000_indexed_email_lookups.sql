-- Case-insensitive email lookups as plain equality, so they can use an index.
--
-- The dashboard finds invites for a person by their confirmed email, and sign-up
-- checks whether a confirmed email is already taken. Both used ILIKE, which
-- can't use the lower(email) indexes, so every lookup scanned the whole table.
-- A stored lowercase copy of each email lets them use a normal index instead.

alter table public.document_signers
  add column invited_email_lower text generated always as (lower(invited_email)) stored;
create index document_signers_email_lower_idx on public.document_signers (invited_email_lower);
-- Superseded by the column above. (document_signers_doc_email_uidx, which keeps
-- one invite per email per document, stays.)
drop index if exists public.document_signers_email_idx;

alter table public.profiles
  add column email_lower text generated always as (lower(email)) stored;
create index profiles_email_lower_idx on public.profiles (email_lower);
drop index if exists public.profiles_email_idx;
