-- Row-level security decides **which rows** a role may see. A grant decides
-- whether the role may touch the table **at all**, and the two are separate
-- gates: the previous migration wrote the policies and left the outer gate
-- shut, so every signed-in request came back
-- `42501 permission denied for table households`.
--
-- This is worth writing down rather than quietly fixing, because the failure
-- mode of getting it backwards is the dangerous one. A table with grants and no
-- policies is readable by everyone who is signed in, and it looks exactly like a
-- table that works.
--
-- The grants are per table and per verb rather than `grant all ... in schema
-- public`, so a table added later is shut until someone says otherwise -- which
-- is the direction a mistake should fail in.

grant usage on schema public to authenticated;

-- No `delete` on households: a household is what every worker, month and span
-- hangs off, and deleting one cascades away a family's whole history. Nothing
-- in the application asks to, and a verb nobody granted is a verb no crafted
-- request can use.
grant select, insert, update on public.households to authenticated;

-- `delete` here is leaving a household, which is a thing a member does.
grant select, insert, delete on public.household_members to authenticated;

grant select, insert, update, delete on public.workers to authenticated;

-- `anon` is a request with no signed-in person behind it. It is granted
-- nothing: every row in these tables belongs to some household, so there is no
-- row it could be right to hand out. The publishable key that reaches the
-- browser carries this role until someone signs in.
revoke all on public.households from anon;
revoke all on public.household_members from anon;
revoke all on public.workers from anon;
