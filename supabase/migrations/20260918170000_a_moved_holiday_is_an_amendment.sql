-- A chosen holiday moved after the year's list came into force (specs.md item
-- 10): an amendment to the terms of the employment, agreed between the two
-- sides. The span itself is moved as before; this row is the record of the move,
-- kept so the list as first agreed can always be read back. Nothing values it.
create table public.holiday_amendments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers (id) on delete cascade,

  -- The day the two sides agreed the change. Both dates it moves between fall
  -- after it; the application checks that, and so does the constraint below.
  agreed_on date not null,
  from_date date not null,
  to_date date not null,

  -- Item 10 has an amendment record a note, so a blank one is refused.
  note text not null check (btrim(note) <> ''),

  created_at timestamptz not null default now(),

  constraint holiday_amendments_moves_somewhere check (from_date <> to_date),
  constraint holiday_amendments_after_agreement
    check (from_date > agreed_on and to_date > agreed_on)
);

create index holiday_amendments_worker on public.holiday_amendments (worker_id, agreed_on);

alter table public.holiday_amendments enable row level security;

create policy holiday_amendments_all on public.holiday_amendments
  for all to authenticated
  using ((select private.owns_worker(worker_id)))
  with check ((select private.owns_worker(worker_id)));

grant select, insert, update, delete on public.holiday_amendments to authenticated;
