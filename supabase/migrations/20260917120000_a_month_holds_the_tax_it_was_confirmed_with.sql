-- A month's income tax is the figure it was confirmed with, or nothing
-- (specs.md item 17, Part 3).
--
-- Null is "not confirmed yet", and the engine then works the tax out from the
-- month's gross. A zero default made every month read as confirmed at zero, so
-- the automatic figure never reached a stored month, and opening a month by a
-- mark changed what it withheld.
--
-- A confirmed month keeps its stored figure: that is what its exported sheet
-- showed. An unconfirmed one had nothing confirmed, so its zero goes.
alter table public.months
  alter column income_tax_agorot drop not null,
  alter column income_tax_agorot drop default;

update public.months
set income_tax_agorot = null
where confirmed_at is null;
