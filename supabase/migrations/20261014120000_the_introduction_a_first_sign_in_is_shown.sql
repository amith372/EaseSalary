-- The one card a family's first sign-in opens, remembered once it is left
-- (specs.md item 32).
--
-- **It is remembered for the person and not for the browser.** A flag in local
-- storage would teach a family twice — once on the laptop they registered on
-- and again on the phone — and there is nowhere else in this application that
-- keeps a person's own state, so it goes on the row that *is* the person in a
-- household.
--
-- **Null means "not shown yet"**, which is what every membership made by
-- `create_household` starts as: the person who created a household has nothing
-- in it, which is the screen the card is about. Accepting an invitation sets it
-- at the moment of joining instead, because somebody joining an existing
-- household signs in for the first time to workers and months already recorded,
-- and a card about adding a first worker would describe a screen they are not
-- looking at.

alter table public.household_members
  add column tutorial_dismissed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Why these are functions and not a policy
-- ---------------------------------------------------------------------------
--
-- An `update` policy on `household_members` is what this would otherwise want,
-- and it cannot be had: the table's columns are the membership itself, so a
-- member allowed to update their own row could rewrite `household_id` and join
-- any household they could name — `with check (user_id = auth.uid())` would
-- still be true of the rewritten row. `insert` and `delete` were revoked for
-- the same reason (a membership begins only through a function), and an update
-- grant would reopen from the side what those closed from the front.
--
-- So the two things the application needs are the two functions below, each
-- `security definer`, each reading the caller from `auth.uid()` inside its own
-- body, and neither taking an argument that could make it act for anybody else.

-- Whether the card is still to be shown in this household.
--
-- **The household is an argument and that grants nothing**: the query is
-- restricted to the caller's own membership, so a household id naming somebody
-- else's household matches no row and the answer is `false` — the same answer a
-- household that does not exist gets, which is what keeps it from being used to
-- ask whether one does.
create function public.tutorial_pending(household uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = household
      and user_id = (select auth.uid())
      and tutorial_dismissed_at is null
  );
$$;

-- Leaving the card, by any of its ways out.
--
-- **It marks every household the caller belongs to**, where the read above asks
-- about one. The card is an introduction to the application rather than to a
-- household, so a person is introduced once; the ordinary account belongs to a
-- single household and the two are then the same thing.
--
-- `tutorial_dismissed_at is null` in the predicate keeps the first instant: the
-- card can be re-opened on purpose afterwards (item 32), and leaving it a
-- second time must not rewrite when it was first left.
create function public.dismiss_tutorial()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.household_members
  set tutorial_dismissed_at = now()
  where user_id = (select auth.uid())
    and tutorial_dismissed_at is null;
$$;

revoke execute on function public.tutorial_pending(uuid) from anon, public;
revoke execute on function public.dismiss_tutorial() from anon, public;
grant execute on function public.tutorial_pending(uuid) to authenticated;
grant execute on function public.dismiss_tutorial() to authenticated;

-- ---------------------------------------------------------------------------
-- The invitation path marks it as it joins
-- ---------------------------------------------------------------------------
--
-- Replaced whole rather than patched, because `create or replace function`
-- carries no record of what the body used to be and a reader of this file needs
-- the whole of what runs. Everything but the insert is unchanged from
-- `an_invitation_is_accepted_through_its_link`: the token, the confirmed-address
-- check, the single `0` for every kind of refusal.
create or replace function public.accept_household_invitation(invitation_token uuid)
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

  if address is null or invitation_token is null then
    return 0;
  end if;

  with accepted as (
    update public.household_invitations
    set accepted_at = now(), accepted_by = caller
    where token = invitation_token
      and normalised_email = private.normalise_email(address)
      and accepted_at is null
    returning household_id
  )
  -- The one change: a member who joins this way is not shown the card (item
  -- 32). `now()` and not a sentinel, so the column means one thing wherever it
  -- is set — the moment this person stopped needing the introduction.
  insert into public.household_members (household_id, user_id, tutorial_dismissed_at)
  select household_id, caller, now() from accepted
  on conflict do nothing;

  get diagnostics joined = row_count;
  return joined;
end;
$$;
