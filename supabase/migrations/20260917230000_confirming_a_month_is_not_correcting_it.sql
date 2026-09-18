-- Confirming a month is not a correction of it.
--
-- "Corrected" is `updated_at > confirmed_at` (Part 5's four states). The two
-- instants are written by two clocks: `confirmed_at` is the application's, sent
-- with the row, while `updated_at` was `now()` in the trigger -- always a few
-- milliseconds later. So every month reported itself as corrected from the
-- moment it was confirmed, and the *confirmed* state could never be seen.
--
-- A save that sets `confirmed_at` now stamps that same instant on `updated_at`,
-- which is what makes the two equal where the schema always said they were. A
-- save that changes nothing but `exported_at` still leaves the stamp alone, and
-- every other update still moves it to `now()`.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- `old` is unassigned on an insert and reading a field off it raises, so the
  -- insert is answered before anything looks at it: a month inserted already
  -- confirmed takes its own instant, and one inserted as a draft takes now().
  if tg_op = 'INSERT' then
    new.updated_at := coalesce(new.confirmed_at, now());
  elsif new.confirmed_at is not null
     and new.confirmed_at is distinct from old.confirmed_at then
    new.updated_at := new.confirmed_at;
  elsif to_jsonb(new) - 'exported_at' - 'updated_at'
     = to_jsonb(old) - 'exported_at' - 'updated_at' then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.touch_updated_at() from public, anon, authenticated;

-- The trigger fires `before update` only, so a month **inserted** already
-- confirmed -- which is what an upsert of a month nobody had opened is -- took
-- the column default `now()` and read as corrected on its first day. It fires on
-- insert too now, and the function answers that case first.
drop trigger if exists months_touch_updated_at on public.months;

create trigger months_touch_updated_at
  before insert or update on public.months
  for each row execute function private.touch_updated_at();
