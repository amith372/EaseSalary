-- How a worker's income tax is arrived at, and what each month was arrived at
-- under (specs.md item 17, settled with the user on 2026-09-11).
--
-- **Why this is a migration and not part of migration 5.** The tax was a figure
-- the user typed when that schema was written, so there was nothing to store
-- about *how* it was reached. Since 2026-09-10 the engine works it out, and
-- since 2026-09-11 the family chooses between three ways of arriving at it. The
-- choice is a term of the employment, so it belongs on the worker; and Part 3
-- requires every term a month was confirmed with to be snapshotted onto the
-- month, so it belongs there too.
--
-- **The snapshot is the whole point and not a duplicate.** A family that stops
-- withholding in June must not thereby restate January through May as months
-- that withheld nothing: those months were filed, and re-exporting one has to
-- reproduce the sheet that was filed for it. A single column on `workers`, read
-- at export time, would silently rewrite every month already closed.

-- ---------------------------------------------------------------------------
-- The worker's own setting.
-- ---------------------------------------------------------------------------

alter table public.workers
  -- 'automatic' is the default because the tax the law asks for, worked out, is
  -- where a worker starts. Choosing *not* to withhold is a decision the family
  -- makes, and a default is not a decision anyone made.
  add column income_tax_mode text not null default 'automatic'
    check (income_tax_mode in ('automatic', 'none', 'percentage')),

  -- A **fraction** of the month's gross -- 0.025, not 2.5 -- which is the unit
  -- `dated_rates` already holds `nationalInsurance` in, and the unit
  -- `IncomeTaxSetting.percentage` carries in the engine. The percentage the user
  -- types is divided once, on the server, and nowhere between there and here.
  --
  -- `numeric` and not a float: a rate is exact as it was typed, and a binary
  -- float would make 2.5% into something that prints as 2.4999999.
  add column income_tax_percentage numeric(6, 5)
    check (income_tax_percentage > 0 and income_tax_percentage <= 1);

-- **The mode and the rate are one value and the table enforces it.** A row in
-- 'percentage' mode with no rate is a worker whose tax is a percentage of
-- nothing, and a rate sitting under 'automatic' is a number nobody can see and
-- that would take effect the day the mode changed. Both are refused here and
-- not only in `reviewIncomeTax`, because the application is not the only thing
-- that can write this table.
alter table public.workers
  add constraint workers_income_tax_rate_matches_mode
    check (
      (income_tax_mode = 'percentage') = (income_tax_percentage is not null)
    );

-- ---------------------------------------------------------------------------
-- The same, snapshotted onto each month.
-- ---------------------------------------------------------------------------

alter table public.months
  -- The default is what every month already stored was calculated under: the
  -- rows that exist predate the choice, and every one of them was taxed
  -- automatically. A default is what makes this migration safe on a table with
  -- rows in it, and it is a true statement about those rows rather than a
  -- convenience.
  add column terms_income_tax_mode text not null default 'automatic'
    check (terms_income_tax_mode in ('automatic', 'none', 'percentage')),
  add column terms_income_tax_percentage numeric(6, 5)
    check (
      terms_income_tax_percentage > 0 and terms_income_tax_percentage <= 1
    );

alter table public.months
  add constraint months_terms_income_tax_rate_matches_mode
    check (
      (terms_income_tax_mode = 'percentage')
        = (terms_income_tax_percentage is not null)
    );

-- **No row-level-security change.** Both tables already force it and already
-- carry the household policies migrations 1 to 4 settled; a column added to a
-- table whose policies are written against the row rather than against a column
-- list is covered by them as it stands. Adding a policy here would be a second
-- statement of the same rule, and two statements of one rule are how the two
-- come to disagree.
