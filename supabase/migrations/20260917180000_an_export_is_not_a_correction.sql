-- Recording that a file was produced from a month is not an edit to the month.
--
-- "Corrected" is `updated_at > confirmed_at` (Part 5's four states), and the
-- trigger moved `updated_at` on every update. Stamping `exported_at` is an
-- update, so every download would have turned a confirmed month into a
-- corrected one. An update that changes nothing but `exported_at` now leaves
-- `updated_at` where it was; every other update still moves it.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) - 'exported_at' - 'updated_at'
     = to_jsonb(old) - 'exported_at' - 'updated_at' then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.touch_updated_at() from public, anon, authenticated;
