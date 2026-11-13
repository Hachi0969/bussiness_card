-- Applied to the Supabase project "open-house-card" on 2026-11-13.
-- Follow-up entries live in a private schema that the public API cannot see.
-- The website can only call the four public functions below.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.leads (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null check (char_length(name) between 1 and 80),
  grade          int  not null check (grade between 9 and 12),
  program_id     text not null,
  contact_method text not null check (contact_method in ('phone', 'email', 'line')),
  contact_value  text not null check (char_length(contact_value) between 1 and 120),
  consent_at     timestamptz not null,
  notice_version text not null,
  status         text not null default 'new'
                 check (status in ('new', 'contacted', 'interested', 'not_interested', 'do_not_contact'))
);
create index leads_created_at_idx on private.leads (created_at desc);

-- Must match the program ids in public/config.js.
create table private.programs (id text primary key);
insert into private.programs (id) values ('program-a'), ('program-b'), ('program-c'), ('undecided');

-- One row. notice_version must match public/config.js. The staff token is stored only as a SHA-256 hash.
create table private.settings (
  id               boolean primary key default true check (id),
  notice_version   text not null,
  staff_token_hash text
);
insert into private.settings (notice_version) values ('draft-1');

alter table private.leads enable row level security;
alter table private.programs enable row level security;
alter table private.settings enable row level security;

create function private.require_staff(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  expected text;
begin
  select staff_token_hash into expected from private.settings;
  if expected is null or p_token is null
     or encode(extensions.digest(p_token, 'sha256'), 'hex') <> expected then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
end $$;

create function public.submit_lead(
  p_name text, p_grade int, p_program_id text, p_contact_method text,
  p_contact_value text, p_consent boolean, p_notice_version text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_value text := btrim(coalesce(p_contact_value, ''));
begin
  if p_consent is distinct from true then raise exception 'consent_required'; end if;
  if p_notice_version is distinct from (select notice_version from private.settings) then raise exception 'notice_outdated'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'invalid_name'; end if;
  if p_grade is null or p_grade not between 9 and 12 then raise exception 'invalid_grade'; end if;
  if not exists (select 1 from private.programs where id = p_program_id) then raise exception 'invalid_program'; end if;

  if p_contact_method = 'email' then
    if char_length(v_value) > 120 or v_value !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'invalid_contact'; end if;
  elsif p_contact_method = 'phone' then
    v_value := regexp_replace(v_value, '[\s-]', '', 'g');
    if v_value !~ '^0[0-9]{8,9}$' then raise exception 'invalid_contact'; end if;
  elsif p_contact_method = 'line' then
    v_value := regexp_replace(v_value, '^@', '');
    if v_value !~ '^[A-Za-z0-9._-]{1,50}$' then raise exception 'invalid_contact'; end if;
  else
    raise exception 'invalid_contact';
  end if;

  -- Overall cap to stop the table being flooded. High enough for a busy event.
  if (select count(*) from private.leads where created_at > now() - interval '1 minute') >= 120 then
    raise exception 'too_many_requests';
  end if;

  insert into private.leads (name, grade, program_id, contact_method, contact_value, consent_at, notice_version)
  values (v_name, p_grade, p_program_id, p_contact_method, v_value, now(), p_notice_version);
end $$;

create function public.staff_list_leads(p_token text)
returns table (
  id uuid, created_at timestamptz, name text, grade int, program_id text,
  contact_method text, contact_value text, consent_at timestamptz, notice_version text, status text
)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_staff(p_token);
  return query
    select l.id, l.created_at, l.name, l.grade, l.program_id, l.contact_method,
           l.contact_value, l.consent_at, l.notice_version, l.status
    from private.leads l order by l.created_at desc;
end $$;

create function public.staff_set_status(p_token text, p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_staff(p_token);
  update private.leads set status = p_status where id = p_id;
  if not found then raise exception 'not_found'; end if;
end $$;

create function public.staff_delete_lead(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_staff(p_token);
  delete from private.leads where id = p_id;
  if not found then raise exception 'not_found'; end if;
end $$;

-- Only these four functions are callable from the website, and only with the public key.
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.submit_lead(text, int, text, text, text, boolean, text) from public, authenticated;
revoke execute on function public.staff_list_leads(text) from public, authenticated;
revoke execute on function public.staff_set_status(text, uuid, text) from public, authenticated;
revoke execute on function public.staff_delete_lead(text, uuid) from public, authenticated;
grant execute on function public.submit_lead(text, int, text, text, text, boolean, text) to anon;
grant execute on function public.staff_list_leads(text) to anon;
grant execute on function public.staff_set_status(text, uuid, text) to anon;
grant execute on function public.staff_delete_lead(text, uuid) to anon;

-- To set or change the staff token, run in the Supabase SQL editor (replace the text):
--   update private.settings set staff_token_hash = encode(extensions.digest('your-long-random-token', 'sha256'), 'hex');
