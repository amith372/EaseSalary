-- A membership begins in one of two ways and no other (specs.md item 11): the
-- person who creates a household (`create_household`), and a person accepting
-- an invitation through its link (`accept_household_invitation`). Both are
-- `security definer` and insert past row-level security.
--
-- So the table itself takes no insert from anyone. `household_members_insert`
-- let a member add any account to their household with no invitation, which
-- skipped the one step where the invited person agrees to it.

drop policy household_members_insert on public.household_members;

revoke insert on public.household_members from authenticated;
