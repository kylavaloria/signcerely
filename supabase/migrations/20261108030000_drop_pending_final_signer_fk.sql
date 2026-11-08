-- A second foreign key between documents and document_signers makes
-- PostgREST embeds ("documents with their signers") ambiguous (PGRST201).
-- Keep the column; drop the constraint. The app only reads it as an id.
alter table public.documents drop constraint if exists documents_pending_final_signer_fkey;
