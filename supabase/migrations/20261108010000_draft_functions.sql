-- Atomic saves for the New document wizard.
-- Called only by the app server (secret key); not exposed to anon/authenticated.

-- Let signers swap slots inside one transaction.
alter table public.document_signers
  drop constraint document_signers_document_id_slot_key;
alter table public.document_signers
  add constraint document_signers_document_id_slot_key
  unique (document_id, slot) deferrable initially deferred;

-- Replace a draft's signer list.
-- p_signers: [{ id?, slot, name, email, invite_public_key?, invite_secret_enc? }]
--   * item with id   -> existing signer kept (keys and signature boxes preserved)
--   * item without id -> new signer (must include both invite key fields)
--   * existing signers not listed are deleted (their boxes go with them)
create or replace function public.save_draft_signers(p_document_id uuid, p_signers jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
begin
  if not exists (
    select 1 from public.documents where id = p_document_id and status = 'draft'
  ) then
    raise exception 'document % is not a draft', p_document_id using errcode = 'P0001';
  end if;

  delete from public.document_signers s
  where s.document_id = p_document_id
    and s.id not in (
      select (e ->> 'id')::uuid
      from jsonb_array_elements(p_signers) e
      where e ? 'id'
    );

  for item in select * from jsonb_array_elements(p_signers) loop
    if item ? 'id' then
      update public.document_signers
      set slot = (item ->> 'slot')::int,
          invited_name = item ->> 'name',
          invited_email = item ->> 'email'
      where id = (item ->> 'id')::uuid and document_id = p_document_id;
    else
      insert into public.document_signers
        (document_id, slot, invited_name, invited_email, invite_public_key, invite_secret_enc)
      values
        (p_document_id, (item ->> 'slot')::int, item ->> 'name', item ->> 'email',
         item ->> 'invite_public_key', item ->> 'invite_secret_enc');
    end if;
  end loop;
end;
$$;

-- Replace a draft's signature boxes.
-- p_fields: [{ signer_id, page, x, y, width, height }]
create or replace function public.save_draft_fields(p_document_id uuid, p_fields jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.documents where id = p_document_id and status = 'draft'
  ) then
    raise exception 'document % is not a draft', p_document_id using errcode = 'P0001';
  end if;

  delete from public.signature_fields where document_id = p_document_id;

  insert into public.signature_fields (document_id, signer_id, page, x, y, width, height)
  select p_document_id,
         (f ->> 'signer_id')::uuid,
         (f ->> 'page')::int,
         (f ->> 'x')::numeric,
         (f ->> 'y')::numeric,
         (f ->> 'width')::numeric,
         (f ->> 'height')::numeric
  from jsonb_array_elements(p_fields) f
  where exists (
    select 1 from public.document_signers s
    where s.id = (f ->> 'signer_id')::uuid and s.document_id = p_document_id
  );
end;
$$;

revoke all on function public.save_draft_signers(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_draft_fields(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_draft_signers(uuid, jsonb) to service_role;
grant execute on function public.save_draft_fields(uuid, jsonb) to service_role;
