-- Two columns the schema owed the repository contract, found while implementing
-- it (build_plan.md stage 3, the Postgres repository).
--
-- Both are the same kind of mistake and neither is a change of behaviour: the
-- schema of 2026-09-10 was written against `src/lib/engine/repository.ts` as it
-- stood that day, and two things were added to the contract afterwards without
-- a column following them. Nothing noticed, because until now nothing wrote a
-- row.

-- ---------------------------------------------------------------------------
-- Who the medical insurance premium is paid through
-- ---------------------------------------------------------------------------

-- `WorkerProfile.insurer` (specs.md item 16). It exists because cell `B10` of
-- both month templates carried one family's agency and insurer written into the
-- binary, which Part 3 forbids; the names came out of the template and became a
-- field on the profile, and the profile had no column.
--
-- **The empty string is "not entered yet"** and is the state of every worker
-- the family has not typed one for, which is exactly what the interface's own
-- docblock says. `not null default ''` rather than a nullable column, so a
-- reader never has two ways of spelling the same absence.
--
-- **Not encrypted, unlike the four numbers of item 22.** It names a business
-- the family deals with and not the worker: it identifies nobody, and it is
-- printed on the sheet in the clear.
alter table public.workers
  add column insurer text not null default '';

-- ---------------------------------------------------------------------------
-- The fourth rate key
-- ---------------------------------------------------------------------------

-- `rateKeys` in `src/lib/datedRates.ts` has held four members since the income
-- tax landed (2026-09-11) and this check listed three, so a household that
-- fetched the value of a credit point could not store what it fetched — the
-- insert would have been refused by a constraint naming a closed set that had
-- since opened.
--
-- The unit is the key's own and there is still no unit column, for the reason
-- the table already gives: `minimumWage` and `recuperationDayRate` are integer
-- agorot, `nationalInsurance` is a fraction of the month's gross, and
-- `creditPointValue` is integer agorot **a year** — a unit that travelled as
-- data would be a unit a caller could get wrong at run time.
alter table public.dated_rates
  drop constraint dated_rates_key_check;

alter table public.dated_rates
  add constraint dated_rates_key_check check (
    key in (
      'minimumWage',
      'nationalInsurance',
      'recuperationDayRate',
      'creditPointValue'
    )
  );
