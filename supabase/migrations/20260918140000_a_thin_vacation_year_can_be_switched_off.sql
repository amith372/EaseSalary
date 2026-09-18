-- A year with fewer than seven vacation days taken is a warning (specs.md items
-- 7 and 27), and every warning kind has a switch, so the household may store it
-- among the kinds switched off. The list is `WarningKind` in
-- `src/lib/engine/alerts.ts`.
alter table public.households
  drop constraint households_warnings_off_check;

alter table public.households
  add constraint households_warnings_off_check
    check (warnings_off <@ array[
      'documentExpiring',
      'recuperationApproaching',
      'monthNotExported',
      'seniorityYearTurning',
      'vacationUnderSeven'
    ]::text[]);
