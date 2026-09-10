-- The unit of isolation, and the workers inside it (specs.md criterion 11, Part 3).
--
-- A worker belongs to a **household** and never to a person. An account is a
-- person who signs in; a household is the group of people who look after the
-- same workers. Every rule below is therefore written against the households a
-- person belongs to and never against the person: writing it against the account
-- is the mistake that makes a shared worker either invisible to the second
-- member or visible to everyone.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- `uuid` and not `bigint generated always as identity`, against the general
-- preference, for two reasons that hold here: a worker's id travels in a URL
-- (`/month/payslip?worker=...`), where a sequential integer says how many
-- workers the application has and invites the crafted request this stage exists
-- to refuse; and `auth.users.id` is already a uuid, so a mixed scheme would make
-- every join read as though the two kinds of key meant different things. The
-- index-locality cost of a random uuid is real and is irrelevant at this size --
-- a household holds at most two workers.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  -- What the family calls it. Hebrew, like every user-facing string.
  name text,
  created_at timestamptz not null default now()
);

-- The many-to-many of criterion 11: one person may belong to more than one
-- household, which is what lets someone keep their own caregiver and help with
-- a parent's without either household's limit of two counting the other's
-- workers. Membership is the whole of sharing -- a second person joins by
-- accepting an invitation and becomes a member, rather than being handed a copy
-- of a worker. So there is no owner whose leaving strands a worker.
create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Postgres does not index a foreign key on its own, and this one is walked from
-- the other side by every policy below: "which households is this person in".
-- The primary key already covers `household_id` first, so only `user_id` needs
-- its own index.
create index household_members_user_id_idx
  on public.household_members (user_id);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,

  -- Written in Hebrew only; a Latin transliteration beside it would break a
  -- line of Hebrew with a run in another script (Part 3).
  name text not null,
  first_name text not null,

  -- **Why the profile knows this at all** (build_plan.md stage 3, approved
  -- 2026-09-10). The income-tax credit points turn on it and on nothing else:
  -- Kol Zchut's page on credit points for a foreign worker gives a legally
  -- employed foreign worker in home care 2.25 points and a woman half a point
  -- more, so a female caregiver has 2.75 and a male one 2.25. This application
  -- employs only caregivers, so the sector half of that rule is settled and the
  -- gender is the whole of what is left. It also answers `he.sheet.workerRole`,
  -- which says the doubled form precisely because the profile could not yet say
  -- which.
  gender text not null check (gender in ('female', 'male')),

  employed_since date not null,

  -- Integer agorot, never floating-point shekels (CLAUDE.md). `bigint` and not
  -- `numeric(10,2)`: the application rounds to the nearest agora once, at the
  -- end of a calculation, and a column holding shekels-and-cents would be a
  -- second place where rounding happens.
  base_monthly_salary_agorot bigint not null check (base_monthly_salary_agorot > 0),
  rest_eve_supplement_agorot bigint not null default 0
    check (rest_eve_supplement_agorot >= 0),

  -- The weekly rest day is a term of the employment and not Saturday
  -- (criterion 5). The numbers are JavaScript's own day-of-week, which is what
  -- `RestDay` in `src/lib/dates.ts` holds: 0 Sunday, 5 Friday, 6 Saturday.
  rest_day smallint not null default 6 check (rest_day in (0, 5, 6)),

  -- 1-12, the month the recuperation payment falls in.
  recuperation_month smallint not null check (recuperation_month between 1 and 12),

  -- Which country's holiday list she is offered (criterion 12). A code and not
  -- a name, because the published pages are addressed by code.
  country text not null,

  created_at timestamptz not null default now()
);

create index workers_household_id_idx on public.workers (household_id);

-- ---------------------------------------------------------------------------
-- The limit of two, enforced where it cannot be talked past
-- ---------------------------------------------------------------------------

-- Criterion 11: a household "holds no more than two workers". In the database
-- and not only in the interface, for the same reason isolation is: a limit the
-- screen keeps is a limit a crafted request does not.
--
-- **It locks the household row before it counts.** Two inserts arriving at once
-- would otherwise each see one existing worker and each be allowed, leaving
-- three; taking the row lock first makes the second wait for the first to
-- commit, so it counts a settled number.
--
-- `security definer` is what lets it count rows the inserting person may not
-- read. `set search_path = ''` and fully-qualified names keep a caller from
-- resolving those names to a table of their own.
create or replace function private.enforce_two_worker_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing integer;
begin
  perform 1 from public.households where id = new.household_id for update;

  select count(*) into existing
  from public.workers
  where household_id = new.household_id
    and id is distinct from new.id;

  if existing >= 2 then
    raise exception 'a household holds no more than two workers'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger workers_two_per_household
  before insert or update of household_id on public.workers
  for each row execute function private.enforce_two_worker_limit();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

-- Asked once, in one function, because three tables ask it and three copies of
-- the question are three chances for one of them to answer differently.
--
-- `security definer` is required rather than convenient: the policy on
-- `household_members` cannot be written in terms of a query against
-- `household_members` without recursing into itself. The function bypasses RLS
-- on that table, which is why it checks the caller's own identity inside its own
-- body and is executable by nobody directly.
create or replace function private.is_household_member(household uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = household
      and user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_household_member(uuid)
  from public, anon, authenticated;

revoke execute on function private.enforce_two_worker_limit()
  from public, anon, authenticated;

alter table public.households enable row level security;
alter table public.households force row level security;
alter table public.household_members enable row level security;
alter table public.household_members force row level security;
alter table public.workers enable row level security;
alter table public.workers force row level security;

-- `force` above matters: without it the table owner is exempt from its own
-- policies, so the isolation would hold for everyone except the role the
-- migrations run as -- which is the role a mistake is most likely to run under.

-- `(select auth.uid())` and not a bare `auth.uid()`: wrapped in a select it is
-- evaluated once for the statement instead of once per row.

create policy households_read on public.households
  for select to authenticated
  using ((select private.is_household_member(id)));

create policy households_write on public.households
  for update to authenticated
  using ((select private.is_household_member(id)))
  with check ((select private.is_household_member(id)));

-- Anyone signed in may create a household; the trigger below makes them its
-- first member in the same transaction, so a household never exists with nobody
-- able to reach it.
create policy households_create on public.households
  for insert to authenticated
  with check (true);

create policy household_members_read on public.household_members
  for select to authenticated
  using ((select private.is_household_member(household_id)));

-- A member may add another member -- that is what accepting an invitation comes
-- to -- and may remove themselves or another. Inviting is a flow this stage has
-- not built yet; the policy says only who may write here, and it is never
-- someone outside the household.
create policy household_members_write on public.household_members
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy workers_all on public.workers
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

-- The creator of a household is its first member. Without this the insert
-- policy above would let someone create a household they cannot then read,
-- which reads as the insert having silently failed.
create or replace function private.add_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_members (household_id, user_id)
  values (new.id, (select auth.uid()))
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function private.add_creator_as_member()
  from public, anon, authenticated;

create trigger households_creator_is_member
  after insert on public.households
  for each row execute function private.add_creator_as_member();
