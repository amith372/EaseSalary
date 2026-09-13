-- Sharing by invitation (specs.md item 11; decided with the user on 2026-09-13
-- that an invitation is sent by email).
--
-- A second person joins a household by an invitation they accept, which makes
-- them a member rather than handing them a copy of a worker. An invitation is a
-- household and an address; accepting it is signing in with that address,
-- confirmed. Nothing here sends mail: the application asks Supabase Auth to send
-- the invitation (`src/app/settings/actions.ts`), and this table is what makes
-- the acceptance independent of whether that mail arrived — an address that
-- already has an account gets no invitation mail at all, and still finds the
-- household at its next sign-in.
--
-- **No expiry.** The specification gives an invitation none, and a duration
-- chosen here would be a rule nobody asked for. A member withdraws an
-- invitation by deleting it.

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- As the member typed it, for the screen that lists pending invitations.
  email text not null check (position('@' in email) > 1),
  -- The form `account_emails` is unique on, so an invitation to a `+` suffix
  -- or a dotted Gmail address reaches the one account that address can belong
  -- to (migration `one_person_is_one_address`).
  normalised_email text generated always as (private.normalise_email(email)) stored,
  invited_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);

-- One pending invitation per address per household: inviting again is sending
-- again, not a second row to accept.
create unique index household_invitations_one_pending
  on public.household_invitations (household_id, normalised_email)
  where accepted_at is null;

-- Walked by the acceptance, which looks invitations up by address.
create index household_invitations_normalised_email_idx
  on public.household_invitations (normalised_email)
  where accepted_at is null;

alter table public.household_invitations enable row level security;
alter table public.household_invitations force row level security;

-- A member sees and withdraws their own household's invitations, and invites
-- only into a household they belong to and only in their own name. Nobody
-- outside the household can read an invitation, including the person invited:
-- they accept through the function below, which reads nothing back to them.
create policy household_invitations_read on public.household_invitations
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy household_invitations_create on public.household_invitations
  for insert to authenticated
  with check (
    (select private.is_household_member(household_id))
    and invited_by = (select auth.uid())
  );

create policy household_invitations_withdraw on public.household_invitations
  for delete to authenticated
  using (
    (select private.is_household_member(household_id))
    and accepted_at is null
  );

grant select, insert, delete on public.household_invitations to authenticated;

-- Accepting: every pending invitation addressed to the caller's own confirmed
-- address makes the caller a member of that household.
--
-- `security definer` because the caller is by definition not yet a member, so
-- no policy above lets them see the invitation or write the membership. It
-- takes no argument: whose address, and so which invitations, is read from
-- `auth.uid()` inside its own body, and an address not yet confirmed accepts
-- nothing — otherwise signing up with somebody else's address would be enough
-- to walk into their household. The worst a crafted call can do is accept the
-- caller's own invitations.
create or replace function public.accept_household_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  address text;
  joined integer;
begin
  if caller is null then
    raise exception 'only a signed-in person may accept an invitation'
      using errcode = 'insufficient_privilege';
  end if;

  select email into address
  from auth.users
  where id = caller and email_confirmed_at is not null;

  if address is null then
    return 0;
  end if;

  with accepted as (
    update public.household_invitations
    set accepted_at = now(), accepted_by = caller
    where normalised_email = private.normalise_email(address)
      and accepted_at is null
    returning household_id
  )
  insert into public.household_members (household_id, user_id)
  select distinct household_id, caller from accepted
  on conflict do nothing;

  get diagnostics joined = row_count;
  return joined;
end;
$$;

grant execute on function public.accept_household_invitations() to authenticated;
revoke execute on function public.accept_household_invitations() from anon, public;
