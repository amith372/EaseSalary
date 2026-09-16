-- The worker's first month, and the rest of the opening position (specs.md
-- item 6; Part 3's replay paragraph).
--
-- The replay walks every month from the first month to the month asked for,
-- so the first month is where the opening position applies. The two
-- used-this-year counts and the recuperation month exist for the same reason:
-- the calendar year and the employment year both began before the first month,
-- in months the replay never walks.
--
-- Months are the first day of the month, as a `date`. They are compared, not
-- built, so the daylight-saving trap `months.year`/`months.month` avoids
-- (Part 5) does not arise; the check keeps any other day out.
alter table public.workers
  add column first_month date
    check (extract(day from first_month) = 1),
  -- Days and not money, `numeric` for the reason `opening_vacation_days` is.
  add column opening_vacation_used_this_year numeric not null default 0
    check (opening_vacation_used_this_year >= 0),
  add column opening_holiday_used_this_year numeric not null default 0
    check (opening_holiday_used_this_year >= 0),
  -- Null is "not paid". A payment the application made is a month it holds,
  -- so an opening one is always before the first month.
  add column opening_recuperation_paid_in date
    check (extract(day from opening_recuperation_paid_in) = 1);

-- An existing worker starts from her earliest stored month, so nothing she
-- already has becomes unreachable; a worker with none starts from the month she
-- was added in, reckoned in Israel.
update public.workers w
set first_month = coalesce(
  (select make_date(m.year, m.month, 1)
     from public.months m
    where m.worker_id = w.id
    order by m.year, m.month
    limit 1),
  date_trunc('month', w.created_at at time zone 'Asia/Jerusalem')::date
);

alter table public.workers
  alter column first_month set not null,
  add constraint workers_recuperation_paid_before_first_month
    check (opening_recuperation_paid_in < first_month);
