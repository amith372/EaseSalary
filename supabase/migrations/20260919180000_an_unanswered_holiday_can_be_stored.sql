-- A holiday nobody has answered for is its own state (specs.md item 9): chosen
-- in advance, it is stored with `worked` null, paid as worked in the preview,
-- and stops the export until somebody says (item 18). So a holiday's `worked`
-- may be null, and only a holiday may carry it at all.
alter table public.spans
  drop constraint spans_a_holiday_says_whether_she_worked;

alter table public.spans
  add constraint spans_only_a_holiday_says_whether_she_worked
    check (kind = 'holiday' or worked is null);

comment on column public.spans.worked is
  'A holiday only: whether she worked it, or null while nobody has said (specs.md items 9 and 18).';
