-- Creating a household and joining it are one act, so they become one call.
--
-- **The bootstrap problem this solves.** A household is readable by its
-- members; the creator becomes a member only once the household row exists. An
-- `insert ... returning`, which is what a client library issues by default,
-- evaluates its `returning` clause inside the insert -- before any `after`
-- trigger has fired -- so the row comes back through the select policy at the
-- one moment nobody is yet a member of it. The insert succeeded and the reply
-- was `42501`, which reads as "the insert was refused" and sends whoever
-- debugs it to the insert policy, where nothing is wrong.
--
-- The previous shape -- an insert policy of `with check (true)` plus an `after
-- insert` trigger adding the creator -- is replaced rather than patched. It had
-- two ways to be wrong that this has none of: a household could exist with
-- nobody able to reach it if the trigger were ever dropped, and the insert
-- policy allowed a row to be created that its creator could not then read.
-- Here there is exactly one way to make a household and it always leaves a
-- member behind.

create or replace function public.create_household(household_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator uuid := (select auth.uid());
  created uuid;
begin
  if creator is null then
    raise exception 'only a signed-in person may create a household'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.households (name)
  values (household_name)
  returning id into created;

  insert into public.household_members (household_id, user_id)
  values (created, creator);

  return created;
end;
$$;

-- Safe to grant for the same reason the membership helper is: it takes no
-- argument that could make it act for anyone but the caller. It reads the
-- caller's identity from `auth.uid()` inside its own body and refuses outright
-- when there is nobody signed in, so the worst a crafted call can do is make
-- the caller a household of their own.
grant execute on function public.create_household(text) to authenticated;
revoke execute on function public.create_household(text) from anon, public;

-- With one way in, the other two are removed rather than left standing beside
-- it. A policy nothing needs is a policy nobody re-reads.
drop policy if exists households_create on public.households;
drop trigger if exists households_creator_is_member on public.households;
drop function if exists private.add_creator_as_member();

-- `insert` on the table itself goes with them: the function is `security
-- definer` and inserts as its owner, so the caller needs no privilege of their
-- own here, and leaving one would leave the unreadable-household case reachable.
revoke insert on public.households from authenticated;
