-- The base salary over time (specs.md item 3; `src/lib/engine/salary.ts`).
--
-- A change of salary takes effect from a month the family names, and the months
-- before it keep the salary they were calculated with (decided with the user on
-- 2026-09-13). `base_monthly_salary_agorot` stays what it was — the salary the
-- employment opened with — and this column holds the changes after it.
--
-- A list on the row rather than a table, for the reason `opening_advances` and
-- `standing_lines` are: it is written only when the profile is written and read
-- only with it. Each element is `{ "from": { "year", "month" }, "agorot" }`,
-- oldest first; the application reviews every element before writing it, so
-- the check here is only the one a crafted request could otherwise get past —
-- that it is a list at all.
alter table public.workers
  add column salary_changes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(salary_changes) = 'array');
