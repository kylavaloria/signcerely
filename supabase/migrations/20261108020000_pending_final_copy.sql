-- The last signer's transaction carries the final signed copy's fingerprint.
-- The app builds that PDF before the wallet approves, so keep it as "pending"
-- until the transaction is confirmed.
alter table public.documents
  add column pending_final_hash text check (pending_final_hash ~ '^[0-9a-f]{64}$'),
  add column pending_final_path text,
  add column pending_final_signer uuid;

create index document_signers_document_idx on public.document_signers (document_id);
