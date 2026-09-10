-- The income tax's two stored figures (build_plan.md stage 3, approved
-- 2026-09-10): the year's brackets, and what one credit point is worth.
--
-- **The credit point's value is a dated rate and the brackets are not.** One is
-- a single figure that takes effect on a date, which is exactly what
-- `dated_rates` holds; the other is a table of seven bounds and seven rates,
-- which `value numeric` cannot express. So the point's value joins the existing
-- table by widening its key constraint, and the brackets get a table of their
-- own.
--
-- This departs from stage 3's own wording, which said the brackets would be
-- "cached in the dated-rates table stage 5 built". They cannot be: the row
-- there is one number. The dating is what that sentence was really asking for,
-- and it is kept — a month is taxed by the table for the year it falls in, and
-- no year is hardcoded.

-- ---------------------------------------------------------------------------
-- The credit point's value
-- ---------------------------------------------------------------------------

-- `check` constraints cannot be altered in place, so the old one is dropped and
-- the new one added. The name is the one the previous migration's inline
-- `check` was given by Postgres.
alter table public.dated_rates
  drop constraint dated_rates_key_check;

alter table public.dated_rates
  add constraint dated_rates_key_check check (
    key in (
      'minimumWage',
      'nationalInsurance',
      'recuperationDayRate',
      -- Integer agorot **a year** — ₪2,904, which is ₪242 a month. The annual
      -- figure is stored because that is the one the statute states and the one
      -- the source page leads with; the monthly figure is derived from it, the
      -- same way the brackets' monthly column is derived from their annual
      -- bounds. It steps in January, where the wage steps in April and the
      -- recuperation rate in July, which is why every row here carries its own
      -- date instead of sharing a year.
      'creditPointValue'
    )
  );

-- ---------------------------------------------------------------------------
-- The brackets
-- ---------------------------------------------------------------------------

-- **Keyed by the tax year and not by an effective date**, which is the one place
-- this differs from `dated_rates` and is not an inconsistency: a bracket table
-- *is* a tax year by definition. The statute states it for a year, the income it
-- applies to is a year's income, and a table taking effect in the middle of a
-- tax year is a thing that does not exist. Giving it a date column would invite
-- one.
--
-- It belongs to the household for the reason the rates and the holiday lists do:
-- the brackets are the state's table and not one worker's.
create table public.tax_brackets (
  household_id uuid not null references public.households (id) on delete cascade,

  tax_year smallint not null,

  -- The brackets themselves, lowest first, with the unbounded one last:
  -- `[{ upToAnnualAgorot, rate }, ...]`, where `upToAnnualAgorot` is null for
  -- the top bracket and `rate` is a fraction — 0.1, not 10, which is the unit
  -- `nationalInsurance` already uses.
  --
  -- **The order is part of the value.** A table read out of order taxes the top
  -- slice at the bottom rate and produces a figure that looks entirely
  -- ordinary, which is why the parser refuses a table whose rates do not rise
  -- rather than sorting one into shape.
  brackets jsonb not null
    check (jsonb_typeof(brackets) = 'array' and jsonb_array_length(brackets) >= 2),

  -- The address the table was read from, or the page a seeded one was taken out
  -- of (Part 3).
  source text not null,

  fetched_at timestamptz not null default now(),

  -- One table per year, so "the brackets for 2026" is never ambiguous and a
  -- re-fetch replaces rather than appends.
  primary key (household_id, tax_year)
);

alter table public.tax_brackets enable row level security;
alter table public.tax_brackets force row level security;

create policy tax_brackets_all on public.tax_brackets
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

grant select, insert, update, delete on public.tax_brackets to authenticated;
revoke all on public.tax_brackets from anon;
