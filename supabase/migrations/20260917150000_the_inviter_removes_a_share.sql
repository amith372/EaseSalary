-- The person who sent an invitation may take the share back (specs.md item 11).
--
-- Removing is the invitation's inverse, so it is keyed on the invitation: the
-- member who sent it, and nobody else, removes the person who accepted it.
-- Everything that person recorded stays with the household, because a worker
-- and her months belong to the household and never to whoever typed them.
--
-- **No member deletes a membership directly any more.** `household_members_write`
-- was `for all`, so any member could remove any other, the inviter included.
-- Insert keeps the reach it had; update and delete now have no policy, and this
-- function is the one way a membership ends.

drop policy household_members_write on public.household_members;

create policy household_members_insert on public.household_members
  for insert to authenticated
  with check ((select private.is_household_member(household_id)));

revoke delete on public.household_members from authenticated;

-- `security definer` because no policy now lets anyone delete a membership.
-- The only argument is an invitation id, and the caller's right to act on it is
-- read from `auth.uid()` inside the body: it must be the invitation's sender and
-- still a member of its household. Returns 1 when a person was removed and 0
-- for anything else, without saying which, so it cannot be used to ask whether
-- an invitation exists.
--
-- A person who joined only through the link has no household of their own, and
-- every screen needs one; they are given an empty one here, as their first
-- sign-in would have, rather than left signed in to nothing.
create function public.remove_household_share(invitation_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  household uuid;
  removed_user uuid;
  own_household uuid;
begin
  if caller is null then
    raise exception 'only a signed-in person may remove a share'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.household_invitations i
  where i.id = invitation_id
    and i.invited_by = caller
    and i.accepted_at is not null
    and exists (
      select 1 from public.household_members m
      where m.household_id = i.household_id and m.user_id = caller
    )
  returning i.household_id, i.accepted_by into household, removed_user;

  if household is null then
    return 0;
  end if;

  -- An accepted invitation whose account was since deleted has no one left to
  -- remove; the membership went with the account.
  if removed_user is null or removed_user = caller then
    return 1;
  end if;

  delete from public.household_members
  where household_id = household and user_id = removed_user;

  if not exists (
    select 1 from public.household_members where user_id = removed_user
  ) then
    insert into public.households (name) values (null)
    returning id into own_household;
    insert into public.household_members (household_id, user_id)
    values (own_household, removed_user);
  end if;

  return 1;
end;
$$;

revoke execute on function public.remove_household_share(uuid) from anon, public;
grant execute on function public.remove_household_share(uuid) to authenticated;
