-- What the alerts page remembers (specs.md item 27): the warning kinds a
-- household switched off, and the warnings put off with 'not now'.

-- The kinds are `WarningKind` in `src/lib/engine/alerts.ts`. Empty is every
-- warning on, which is the default the spec sets.
alter table public.households
  add column warnings_off text[] not null default '{}'
    check (warnings_off <@ array[
      'documentExpiring',
      'recuperationApproaching',
      'monthNotExported',
      'seniorityYearTurning'
    ]::text[]);

-- A warning put off, by worker. `fingerprint` is the whole entry as the engine
-- raised it, so an entry whose dates or figures change is a different row and
-- shows again at once. `until` is the first day it shows again.
create table public.warning_deferrals (
  worker_id uuid not null references public.workers (id) on delete cascade,
  fingerprint text not null,
  until date not null,
  primary key (worker_id, fingerprint)
);

alter table public.warning_deferrals enable row level security;
alter table public.warning_deferrals force row level security;

create policy warning_deferrals_all on public.warning_deferrals
  for all to authenticated
  using ((select private.owns_worker(worker_id)))
  with check ((select private.owns_worker(worker_id)));

grant select, insert, update, delete on public.warning_deferrals to authenticated;
revoke all on public.warning_deferrals from anon;
