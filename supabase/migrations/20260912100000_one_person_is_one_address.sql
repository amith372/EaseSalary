-- One person is one address, and a sub-address is not a second person
-- (build_plan.md stage 3, the sign-in step, settled with the user 2026-09-11).
--
-- `paulk+1@gmail.com` must not become a second account beside `paulk@gmail.com`.
-- The refusal is **here and not in the form**: the same division
-- `reviewWageConfirmation` already draws, where the server decides and the
-- screen only reports. A request crafted past the sign-in screen -- straight at
-- GoTrue's own sign-up endpoint, which the publishable key reaches -- meets the
-- same unique index, because the trigger below fires on `auth.users` itself and
-- not on anything the application calls.

-- ---------------------------------------------------------------------------
-- The normalisation, which is per domain and not one rule for all of them
-- ---------------------------------------------------------------------------

-- A `+` suffix is a sub-address almost everywhere, so it is stripped for every
-- domain. A **dot** is ignored by Gmail and is significant at many other
-- providers, so dots are stripped for `gmail.com` and `googlemail.com` alone.
-- Stripping dots everywhere would merge two real strangers at a provider that
-- distinguishes them -- a worse failure than the duplicate it prevents, and one
-- nobody would ever see reported, because the second stranger simply cannot
-- sign up and has no way to say why.
create or replace function private.normalise_email(address text)
returns text
language sql
immutable
as $$
  select case
           when domain in ('gmail.com', 'googlemail.com')
             then replace(local_part, '.', '')
           else local_part
         end || '@' || domain
  from (
    select split_part(split_part(lower(btrim(address)), '@', 1), '+', 1) as local_part,
           split_part(lower(btrim(address)), '@', 2)                     as domain
  ) as parts;
$$;

-- ---------------------------------------------------------------------------
-- The table the index lives on
-- ---------------------------------------------------------------------------

-- `auth.users` is GoTrue's own table and is not ours to add a column or an index
-- to: a managed migration of theirs would meet a constraint they did not write.
-- So the normalised form lives beside it, one row per account, written by a
-- trigger rather than by anything that can be skipped.
create table public.account_emails (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- The real address is what Supabase authenticates and what the confirmation
  -- mail goes to. It is kept here only so that a duplicate can be explained to
  -- whoever investigates one; nothing reads it to sign anybody in.
  email text not null,

  -- The normalised one is only ever compared.
  normalised_email text not null unique,

  created_at timestamptz not null default now()
);

alter table public.account_emails enable row level security;

-- Nothing in the application reads this table; the policy exists so that the
-- table is not merely unreadable by accident. A person may see their own row
-- and no other, which is what makes the table useless as a directory of who
-- else has an account here.
create policy account_emails_read_own on public.account_emails
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.account_emails to authenticated;

-- ---------------------------------------------------------------------------
-- The trigger
-- ---------------------------------------------------------------------------

-- `after insert` on `auth.users`, so the sub-address is refused during sign-up
-- itself: the unique index raises, the insert's transaction rolls back, and
-- GoTrue answers the sign-up with a failure rather than leaving an account
-- behind that the application would have to notice later.
create or replace function private.record_account_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_emails (user_id, email, normalised_email)
  values (new.id, new.email, private.normalise_email(new.email));
  return new;
end;
$$;

create trigger account_email_is_recorded
  after insert on auth.users
  for each row execute function private.record_account_email();

-- Whoever already signed up before this migration existed. `on conflict do
-- nothing` so that an existing pair of sub-addresses -- which was allowed until
-- this moment -- does not make the migration itself unrunnable; the index then
-- holds for everyone who arrives after.
insert into public.account_emails (user_id, email, normalised_email)
select id, email, private.normalise_email(email)
from auth.users
where email is not null
on conflict do nothing;
