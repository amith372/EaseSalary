-- Which wage the national-insurance estimate is reckoned on (specs.md item 19).
--
-- The rule speaks of the wage, and that is what the column defaults to: `false`
-- is the law's base, so every household that has never touched this -- and every
-- household made before this migration ran -- is valued exactly as it was. A
-- family that files on what they handed over turns it on for themselves.
--
-- **It is the household's and not a worker's**, like the rates and the bracket
-- tables beside it: one family files one return, so a setting per employment
-- would let two workers of one household be reckoned two different ways and
-- there would be no answer to which the return followed.
--
-- **Nothing stores the figure it produces.** Balances are replayed rather than
-- stored (item 13) and so is this estimate, which is what makes a household that
-- changes this see its own past months move -- exported or not -- instead of
-- holding one rule for the months ahead and another for the months behind.
--
-- `not null default false` and never nullable: "the household has not said"
-- and "the household said the wage" are the same instruction, and a third
-- state would be a figure nobody could act on.

alter table public.households
  add column national_insurance_on_what_was_paid boolean not null default false;

-- No policy of its own, and that is deliberate rather than an omission.
-- `households_write` in `households_workers_and_isolation` is `for update` over
-- the whole row, restricted to `private.is_household_member(id)` in both
-- `using` and `with check`, and `grant_table_privileges` grants `update` on the
-- table to `authenticated`. A member may therefore set this for their own
-- household and for no other, which is the rule wanted here; a second policy
-- naming the column would widen nothing and would have to be kept in step with
-- the first.
