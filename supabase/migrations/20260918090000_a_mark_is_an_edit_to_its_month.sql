-- A mark on the calendar is an edit to the month it falls in.
--
-- **Spans belong to the worker and not to the month** (Part 3): a sick spell
-- crossing a boundary is one spell, stored once. So marking, clearing or
-- moving a day writes to `spans` and never to `months` -- and `updated_at` on
-- the month, which is the whole of what tells a *corrected* month from a
-- confirmed one (Part 5), never moved. A day marked on a month already exported
-- went on reporting itself as exported, which is criterion 13's chain left
-- standing on a file nobody would know to produce again.
--
-- The repository now touches the months a span overlaps, in the same call that
-- writes the span, so no caller has to remember. That touch is an update that
-- changes `updated_at` and nothing else, and the trigger discarded exactly such
-- an update -- so it now honours an `updated_at` the caller set deliberately.
-- Nothing else sends the column: `MonthRecord` has no such field and
-- `monthRowOf` writes no such key, so the only statement that reaches this
-- branch is the touch itself.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_at := coalesce(new.confirmed_at, now());
  elsif new.updated_at is distinct from old.updated_at then
    -- Deliberate: a span changed, and the month is being told so.
    null;
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
