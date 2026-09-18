-- A free-text note on the month as a whole (specs.md item 5), written on the
-- month screen and shown on `דף המשכורת`. Null is "no note"; an empty string is
-- refused so the two cannot both mean it.
alter table public.months
  add column note text,
  add constraint months_note_not_blank
    check (note is null or btrim(note) <> '');

-- **A note is not a correction.** It is written to no sheet, so a file already
-- produced from the month still matches it, and a month confirmed or exported
-- stays so when a note is written on it. The trigger therefore ignores the note
-- the way it ignores `exported_at`; every other rule is the one
-- `20260918090000_a_mark_is_an_edit_to_its_month.sql` set.
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
  elsif to_jsonb(new) - 'exported_at' - 'updated_at' - 'note'
     = to_jsonb(old) - 'exported_at' - 'updated_at' - 'note' then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.touch_updated_at() from public, anon, authenticated;
