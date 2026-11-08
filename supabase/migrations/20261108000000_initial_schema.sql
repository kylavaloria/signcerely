-- It's Your Sign — initial schema.
--
-- Access model: people sign in with their Stellar wallet (not Supabase Auth).
-- The Next.js server verifies the wallet, then reads and writes these tables
-- with the secret (service-role) key. Row Level Security is ON for every
-- table with NO policies, so the public/publishable key can read nothing.

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
create table public.profiles (
  wallet_address    text primary key
                    check (wallet_address ~ '^G[A-Z2-7]{55}$'),
  full_name         text not null check (char_length(full_name) between 1 and 120),
  email             text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_verified_at timestamptz,
  -- saved signature ("Save to my profile for next time")
  signature_path    text,
  signature_kind    text check (signature_kind in ('drawn', 'uploaded')),
  signature_hash    text check (signature_hash ~ '^[0-9a-f]{64}$'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- one-time nonces for "sign in with Freighter"
create table public.auth_challenges (
  nonce          text primary key,
  wallet_address text not null check (wallet_address ~ '^G[A-Z2-7]{55}$'),
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index auth_challenges_expires_idx on public.auth_challenges (expires_at);

-- email confirmation links (store only a hash of the token)
create table public.email_verifications (
  token_hash     text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  wallet_address text not null references public.profiles (wallet_address) on delete cascade,
  email          text not null,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);

-- ---------- documents ----------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  -- 32-byte id used on-chain (hex), e.g. sha256 of id
  chain_doc_id    text unique check (chain_doc_id ~ '^[0-9a-f]{64}$'),
  sender_wallet   text not null references public.profiles (wallet_address),
  title           text not null check (char_length(title) between 1 and 200),
  summary         text check (char_length(summary) <= 300),
  file_path       text,
  page_count      int check (page_count > 0),
  original_hash   text unique check (original_hash ~ '^[0-9a-f]{64}$'),
  final_file_path text,
  final_hash      text unique check (final_hash ~ '^[0-9a-f]{64}$'),
  in_order        boolean not null default true,
  status          text not null default 'draft'
                  check (status in ('draft', 'pending', 'completed', 'declined', 'cancelled')),
  create_tx_hash  text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  completed_at    timestamptz,
  updated_at      timestamptz not null default now()
);
create index documents_sender_idx on public.documents (sender_wallet, created_at desc);
create index documents_status_idx on public.documents (status);
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- one row per signing slot
create table public.document_signers (
  id                   uuid primary key default gen_random_uuid(),
  document_id          uuid not null references public.documents (id) on delete cascade,
  slot                 int not null check (slot between 0 and 4),
  invited_name         text not null check (char_length(invited_name) between 1 and 120),
  invited_email        text not null check (invited_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- public half of the slot's invite key (hex), also stored on-chain
  invite_public_key    text not null check (invite_public_key ~ '^[0-9a-f]{64}$'),
  -- secret half, encrypted by the app (needed to re-send the invite link)
  invite_secret_enc    text not null,
  -- set once this person signs (or links their wallet when opening the invite)
  wallet_address       text check (wallet_address ~ '^G[A-Z2-7]{55}$'),
  status               text not null default 'waiting'
                       check (status in ('waiting', 'invited', 'viewed', 'signed', 'declined')),
  signature_image_path text,
  signature_image_hash text check (signature_image_hash ~ '^[0-9a-f]{64}$'),
  invited_at           timestamptz,
  viewed_at            timestamptz,
  signed_at            timestamptz,
  declined_at          timestamptz,
  sign_tx_hash         text,
  created_at           timestamptz not null default now(),
  unique (document_id, slot),
  unique (invite_public_key)
);
create unique index document_signers_doc_email_uidx
  on public.document_signers (document_id, lower(invited_email));
create index document_signers_wallet_idx on public.document_signers (wallet_address);
create index document_signers_email_idx on public.document_signers (lower(invited_email));

-- signature boxes placed by the sender (positions are fractions of the page, 0..1)
create table public.signature_fields (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  signer_id   uuid not null references public.document_signers (id) on delete cascade,
  page        int not null check (page >= 1),
  x           numeric(6, 5) not null check (x >= 0 and x <= 1),
  y           numeric(6, 5) not null check (y >= 0 and y <= 1),
  width       numeric(6, 5) not null check (width > 0 and width <= 1),
  height      numeric(6, 5) not null check (height > 0 and height <= 1),
  kind        text not null default 'signature' check (kind in ('signature')),
  created_at  timestamptz not null default now()
);
create index signature_fields_doc_idx on public.signature_fields (document_id);
create index signature_fields_signer_idx on public.signature_fields (signer_id);

-- activity timeline for the Details page
create table public.document_events (
  id           bigint generated always as identity primary key,
  document_id  uuid not null references public.documents (id) on delete cascade,
  kind         text not null
               check (kind in ('created', 'sent', 'invited', 'viewed', 'signed',
                               'declined', 'cancelled', 'completed', 'reminder_sent')),
  actor_wallet text,
  signer_id    uuid references public.document_signers (id) on delete set null,
  tx_hash      text,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index document_events_doc_idx on public.document_events (document_id, created_at);
create index document_events_signer_idx on public.document_events (signer_id);

-- ---------- lock everything down: server-only access ----------
alter table public.profiles            enable row level security;
alter table public.auth_challenges     enable row level security;
alter table public.email_verifications enable row level security;
alter table public.documents           enable row level security;
alter table public.document_signers    enable row level security;
alter table public.signature_fields    enable row level security;
alter table public.document_events     enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- ---------- private storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents',  'documents',  false, 10485760, array['application/pdf']),
  ('signatures', 'signatures', false, 2097152,  array['image/png', 'image/jpeg'])
on conflict (id) do nothing;
