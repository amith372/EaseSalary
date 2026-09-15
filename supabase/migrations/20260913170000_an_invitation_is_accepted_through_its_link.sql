-- An invitation is accepted by opening its link, not by signing in (specs.md
-- item 11: "an invitation they accept").
--
-- `accept_household_invitations()` accepted every pending invitation to the
-- caller's confirmed address on every signed-in request. A confirmed address
-- proves the caller owns it, not that they agreed to anything: any member of
-- any household could invite a stranger's address, and the stranger's first
-- sign-in — made on their own, with no link — put them in that household and
-- no household of their own, so the caregiver they then added, passport number
-- and all, was saved where the inviter could read her.
--
-- So an invitation now carries a token that exists only in the link the member
-- copies, and the acceptance takes it. The address check stays: a forwarded
-- link still joins nobody but the person it was addressed to.
--
-- The token is readable by the household's members, who need it to copy the
-- link again. That grants them nothing — they are the ones inviting — and the
-- invited person still cannot read the invitation.

alter table public.household_invitations
  add column token uuid not null default gen_random_uuid();

create unique index household_invitations_token_idx
  on public.household_invitations (token);

drop function public.accept_household_invitations();

-- `security definer` for the reason the function it replaces gave: the caller
-- is not yet a member, so no policy lets them see the invitation or write the
-- membership. Returns 1 when the token named a pending invitation to the
-- caller's own confirmed address, and 0 for anything else, without saying which
-- — so it cannot be used to ask whether a token exists.
create function public.accept_household_invitation(invitation_token uuid)
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
  insert into public.household_members (household_id, user_id)
  select household_id, caller from accepted
  on conflict do nothing;

  get diagnostics joined = row_count;
  return joined;
end;
$$;

revoke execute on function public.accept_household_invitation(uuid) from anon, public;
grant execute on function public.accept_household_invitation(uuid) to authenticated;
