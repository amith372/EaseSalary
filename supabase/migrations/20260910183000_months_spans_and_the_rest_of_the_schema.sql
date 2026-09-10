-- The rest of the schema: what a worker carries from month to month, the spans
-- that belong to her, the months themselves, and the two tables the household
-- shares between its workers (specs.md Part 3; build_plan.md stage 3).
--
-- **The shape follows the repository contract and not a general preference.**
-- `src/lib/engine/repository.ts` is the interface stage 3 implements, and it
-- reads and writes a month **whole**: `saveMonth` takes one `MonthRecord`,
-- `listMonths` returns every month in date order, and nothing anywhere asks for
-- an advance, a third-party payment or an override across months. So the four
-- collections that belong to exactly one month are held on the month's own row
-- as `jsonb`, and a save is one statement rather than a delete-and-reinsert
-- across five tables inside a function. What is *shared* between months, or
-- written on its own, is a table: the spans, which belong to the worker and are
-- saved and deleted one at a time, and the household's holiday lists and rates.
--
-- **It stores facts and never results** (Part 3). No balance, no derived rate
-- and no calculated total appears in any column here: balances are replayed
-- from the opening position by `calculateSeries`, which is what makes a
-- correction to a past month move every later month for free (criterion 13).

-- ---------------------------------------------------------------------------
-- The employment permit belongs to the household
-- ---------------------------------------------------------------------------

-- Criterion 28 in its own words: the **employment permit** (היתר העסקה) belongs
-- to the employer, the work visa and the passport to the worker, and so "a
-- household with two workers holds one permit position and two visas". The
-- in-memory store holds all three per worker because there was no household
-- record to hold this one on, and `WorkerDocuments.employmentPermitExpiry` says
-- in its own docblock that it moves here with the schema. This is that schema,
-- so it moves now rather than becoming a migration later.
--
-- **The expiry date is not encrypted and the number will be** (item 28). A date
-- identifies nobody, and item 27's warnings have to *query* what is coming due:
-- an encrypted date cannot be indexed, so the bell would have to decrypt every
-- household's dates on every load to discover it has nothing to say. The
-- permit's number arrives with the other four encrypted columns.
alter table public.households
  add column employment_permit_expiry date;

-- ---------------------------------------------------------------------------
-- The rest of the worker's profile
-- ---------------------------------------------------------------------------

-- What `WorkerProfile` holds that the first migration did not yet: the opening
-- position given once (criterion 6), the standing lines (item 20), the holiday
-- source where it is not her own country's (item 10), and two of the three
-- document dates (item 28).
alter table public.workers
  -- Criterion 6: what a worker created in the middle of an employment starts
  -- from. `numeric` and not a float: the workbook accrues 14/12 of a day a
  -- month, and a balance held as a float drifts a hundredth of a day a year
  -- (Part 5). These are days and not money, so they are the one quantity in the
  -- schema that is not integer agorot.
  add column opening_vacation_days numeric not null default 0
    check (opening_vacation_days >= 0),
  add column opening_sick_days numeric not null default 0
    check (opening_sick_days >= 0),

  -- An advance still being repaid when the worker was created, numbered as the
  -- workbook numbers it (item 20). A list on the row rather than a table: it is
  -- written only when the profile is written, and read only with it.
  add column opening_advances jsonb not null default '[]'::jsonb
    check (jsonb_typeof(opening_advances) = 'array'),

  -- Lines the user set once that appear in every month afterwards (item 20).
  -- They are a **term** of the employment, so a month copies them into its own
  -- terms when it is confirmed and reads them from there ever after; stopping
  -- one in June leaves every earlier month exactly as it was (Part 3).
  add column standing_lines jsonb not null default '[]'::jsonb
    check (jsonb_typeof(standing_lines) = 'array'),

  -- The list her year's holidays are chosen from, **where it is not her own
  -- country's** (item 10). Null is `country` — storing the exception rather
  -- than restating `country` is what keeps one worker from having two fields
  -- that can disagree about where her holidays come from.
  --
  -- Two columns and not one `jsonb`, because this is a closed union of two
  -- shapes and a check constraint can say so: a religion carries a religion and
  -- a country carries nothing here, since the code is already `workers.country`.
  add column holiday_source_kind text
    check (holiday_source_kind in ('country', 'religion')),
  add column holiday_source_religion text,

  -- Item 28's other two dates. The worker's own; the employer's permit is on
  -- the household above. Null is "not entered yet" and is the ordinary state of
  -- a worker whose papers the family has not typed in -- it is never "no
  -- expiry", because every one of the three has one.
  add column work_visa_expiry date,
  add column passport_expiry date,

  -- A religion is named exactly when the source is a religion. Written as one
  -- constraint rather than two nullable columns nobody relates, so the pair
  -- cannot come to rest in a state the union has no member for.
  add constraint workers_holiday_source_is_one_of_two check (
    (holiday_source_kind is distinct from 'religion' and holiday_source_religion is null)
    or (holiday_source_kind = 'religion' and holiday_source_religion is not null)
  );

-- ---------------------------------------------------------------------------
-- Spans
-- ---------------------------------------------------------------------------

-- **A span belongs to the worker and not to a month** (Part 3). A spell of
-- sickness is stored as the dates it ran between, because its tiers are counted
-- from its own first day and a spell beginning in one month and ending in the
-- next must be read as one thing; a month's spans are *assembled* from the ones
-- that overlap it. Storing a copy against each month would say the same thing
-- twice, and closing the spell would then have to find every copy.
create table public.spans (
  worker_id uuid not null references public.workers (id) on delete cascade,

  -- `text` and not `uuid`: the application mints a span's id from what it is --
  -- `${kind}-${from}-${to}` in `src/lib/spans.ts` -- so that marking the same
  -- run twice replaces it rather than stacking two spans on one day. A uuid
  -- column would refuse the ids the application actually produces.
  id text not null,

  -- The four stored strings of `SpanKind`. A holiday is a state the calendar
  -- draws and never a mark the user makes (item 9), but it is stored as a span
  -- like the rest, because what the month records about one is whether she
  -- worked it.
  kind text not null check (kind in ('vacation', 'sick', 'freeRestDay', 'holiday')),

  "from" date not null,

  -- **Null is a spell still running, and that is how one is normally recorded**
  -- (item 8): on the day a worker falls ill nobody knows the day she will
  -- return, so the application does not ask for one. Only sickness may be open
  -- -- a vacation with no end is not a thing the user can mean -- which is what
  -- the constraint below says.
  "to" date,

  -- Every action can carry a free-text note (item 5).
  note text,

  -- Vacation and a holiday may be taken as part of a day and are drawn from the
  -- balance in that proportion (items 7, 10). A part-day is a single-day span,
  -- which the constraint below requires rather than trusts.
  fraction numeric check (fraction > 0 and fraction <= 1),

  -- A holiday is never recorded without saying whether she worked it: a holiday
  -- she takes off is covered by her ordinary salary and earns nothing extra, so
  -- a null here on a holiday span would underpay her (Part 5, item 9).
  worked boolean,

  primary key (worker_id, id),

  constraint spans_only_sickness_is_open
    check ("to" is not null or kind = 'sick'),
  constraint spans_run_forwards
    check ("to" is null or "to" >= "from"),
  constraint spans_a_part_day_is_one_day
    check (fraction is null or "to" = "from"),
  constraint spans_a_holiday_says_whether_she_worked
    check ((kind = 'holiday') = (worked is not null))
);

-- The primary key leads with `worker_id`, so "every span this worker has" --
-- which is the only way anything reads this table -- is already covered.
-- Overlap with a month is decided in the engine and not by an index: the ranges
-- are per worker and number in the dozens.

-- ---------------------------------------------------------------------------
-- Months
-- ---------------------------------------------------------------------------

create table public.months (
  worker_id uuid not null references public.workers (id) on delete cascade,

  -- The month itself, as two integers rather than a date pinned to its first
  -- day. `YearMonth` is what the whole application passes around, and a date
  -- column would invite somebody to build one in local time -- which across a
  -- daylight-saving boundary lands in the month before (Part 5).
  year smallint not null,
  month smallint not null check (month between 1 and 12),

  -- **The wage position confirmed for this month** (Part 3). Two figures and
  -- not one: the salary may sit above the minimum wage and never below it
  -- (criterion 3), so rates that followed the minimum wage would be wrong for
  -- every family paying more than it. The rates themselves are re-derived from
  -- `confirmed_base_agorot` by `deriveRates`, a pure function of it, so storing
  -- the wage stores the rates without a second calculation path to drift from
  -- the first.
  confirmed_base_agorot bigint not null check (confirmed_base_agorot > 0),
  confirmed_minimum_agorot bigint not null check (confirmed_minimum_agorot > 0),
  -- The date that minimum wage took effect, so a month is always valued at the
  -- rate in force during it (criterion 4).
  confirmed_effective_from date not null,

  -- **The terms as they stood when this month was confirmed** -- Part 3's own
  -- requirement, and a migration if it were discovered in stage 6. Terms are
  -- read off the month and never off the profile, so a family that moves the
  -- rest day from Saturday to Sunday in June does not thereby turn every
  -- earlier month's Saturdays into Sundays.
  terms_rest_day smallint not null check (terms_rest_day in (0, 5, 6)),
  terms_rest_eve_supplement_agorot bigint not null default 0
    check (terms_rest_eve_supplement_agorot >= 0),
  terms_recuperation_month smallint not null
    check (terms_recuperation_month between 1 and 12),
  terms_standing_lines jsonb not null default '[]'::jsonb
    check (jsonb_typeof(terms_standing_lines) = 'array'),

  -- What the month recorded, each list held with the month it belongs to. The
  -- shapes are `Advance`, `ThirdPartyPayment`, `UserLine` and the override map
  -- of `MonthFacts.overrides`, which is keyed by the line's explanation key --
  -- the same key the explanation is addressed by (items 17, 24).
  advances jsonb not null default '[]'::jsonb
    check (jsonb_typeof(advances) = 'array'),
  third_party_payments jsonb not null default '[]'::jsonb
    check (jsonb_typeof(third_party_payments) = 'array'),
  user_lines jsonb not null default '[]'::jsonb
    check (jsonb_typeof(user_lines) = 'array'),
  overrides jsonb not null default '{}'::jsonb
    check (jsonb_typeof(overrides) = 'object'),

  -- Income tax is calculated from the month's wage, the brackets in force
  -- during it and the worker's credit points, then **confirmed** before every
  -- export and stored with the month exactly as the minimum wage is -- which is
  -- what lets a past month reproduce rather than recalculate (build_plan.md
  -- stage 3, approved 2026-09-10). Zero until that lands, which is what every
  -- month has held all along.
  income_tax_agorot bigint not null default 0 check (income_tax_agorot >= 0),

  -- What one day of recuperation was worth when this month was valued (item
  -- 15). Null in almost every month: only the recuperation month prices
  -- anything with it, and a month that has not been through item 18's
  -- confirmation has none -- the engine then falls back to the dated-rates
  -- table, which is the same figure from the same source. Null is therefore
  -- "not confirmed for this month" and never "worth nothing".
  recuperation_day_rate_agorot bigint check (recuperation_day_rate_agorot > 0),

  -- **The four states of Part 5, held as the two facts that cannot be derived.**
  -- A month is *draft* while it only holds facts; *confirmed* once the user has
  -- confirmed the minimum wage against it; *exported* once a file has been
  -- produced from it; and *corrected* when a confirmed or exported month's facts
  -- are then edited. Only the second and third are events nothing else records,
  -- so they are stored and the states are read off them: draft is
  -- `confirmed_at is null`, corrected is `updated_at > confirmed_at`. Storing a
  -- state word beside them would be a fifth thing that can disagree with the
  -- four.
  --
  -- **Exported is not the end of the line**: criterion 13 requires a month to
  -- stay correctable for ever, so nothing here is frozen and no trigger refuses
  -- a write to a month that carries `exported_at`. Criterion 21's rule -- a
  -- future month may be filled in but not confirmed -- is a rule about *when*
  -- `confirmed_at` may be set and belongs where the confirming happens, not to a
  -- constraint here that would need to read a clock.
  confirmed_at timestamptz,
  exported_at timestamptz,
  updated_at timestamptz not null default now(),

  -- One row per worker per month, which is also how `saveMonth` addresses one.
  -- The month has no id of its own because nothing refers to a month from
  -- elsewhere: its collections are on the row and its spans belong to the
  -- worker.
  primary key (worker_id, year, month)
);

-- `updated_at` is what tells a *corrected* month from a confirmed one, so it is
-- maintained by the database and not by the caller: a save that forgot to set it
-- would leave a month looking untouched since its confirmation, which is the one
-- state it is being read for. It is set on every update, including the update
-- that sets `confirmed_at` -- so a month that has just been confirmed has the
-- two equal, and "corrected" is `updated_at > confirmed_at` rather than `<>`.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.touch_updated_at() from public, anon, authenticated;

create trigger months_touch_updated_at
  before update on public.months
  for each row execute function private.touch_updated_at();

-- `listMonths` promises oldest first -- the order `calculateSeries` replays them
-- in -- and the primary key already sorts that way, `worker_id` then `year` then
-- `month`, so the replay reads the index in order and sorts nothing.

-- ---------------------------------------------------------------------------
-- What the household shares between its workers
-- ---------------------------------------------------------------------------

-- **A holiday list belongs to the household and not to a worker** (the
-- repository's own words): a list is a source and a year and nothing about one
-- worker, so two workers from the same country share one, and a list fetched
-- for the first is the list the second reads. Which list a worker's year is
-- drawn from is her own, and that is `workers.holiday_source_kind` above.
create table public.holiday_lists (
  household_id uuid not null references public.households (id) on delete cascade,

  -- `HolidaySource` split the same way it is on the worker. `source_key` is the
  -- country code or the religion, whichever `source_kind` says.
  source_kind text not null check (source_kind in ('country', 'religion')),
  source_key text not null,
  year smallint not null,

  -- **The address the list actually came from**, which is the address the next
  -- year is fetched at with the year in it changed -- never an address rebuilt
  -- from the source (Part 5). Nepal publishes under `/en/` where every other
  -- shipped list is under `/he/`, so an address built from the code changes the
  -- path along with the year and returns nothing, which reads exactly like a
  -- country that publishes no holidays at all.
  source_url text not null,

  -- Hebrew, for the picker.
  name_he text not null,

  -- `{ date, name }` per holiday. The candidate list for a year, from which the
  -- user chooses the dates the worker actually takes (item 10); the choices
  -- themselves are spans against the worker and are never overwritten by a
  -- later fetch (Part 3).
  holidays jsonb not null default '[]'::jsonb
    check (jsonb_typeof(holidays) = 'array'),

  fetched_at timestamptz not null default now(),

  -- One list per source per year: `withFetchedList` replaces rather than
  -- appends, so this is the key an upsert names.
  primary key (household_id, source_kind, source_key, year)
);

-- **The dated-rates table**: every rate the application does not derive, with
-- the date it took effect (criterion 4). The engine asks it for the figure in
-- force during the month it is calculating, never for the latest one.
--
-- Nothing derivable from the base monthly salary goes in it -- item 3 requires
-- those to be derived -- so it stays the short list of figures the application
-- takes from outside itself. It belongs to the household for the reason the
-- holiday lists do: the minimum wage is the state's figure and not one
-- worker's. What a *month* was valued at is on the month and is never read back
-- from here.
create table public.dated_rates (
  household_id uuid not null references public.households (id) on delete cascade,

  -- `RateKey`. **The value is read in the unit its key names, and the keys do
  -- not share one**: `minimumWage` and `recuperationDayRate` are integer
  -- agorot, `nationalInsurance` is a fraction of the month's gross -- 0.036,
  -- not 3.6. There is no unit column, because a unit that travels as data is a
  -- unit a caller can get wrong at run time. `numeric` covers both without
  -- either losing precision.
  key text not null
    check (key in ('minimumWage', 'nationalInsurance', 'recuperationDayRate')),
  value numeric not null check (value > 0),

  -- The official date of application, always a first of month: a rise decided
  -- mid-month is expressed as an earlier date and never as a mid-month one, so
  -- this date is the whole of the rule and `rateInForce` needs no second one.
  effective_from date not null,

  -- The address the figure was fetched from, or the workbook, tab and cell a
  -- seeded one was read out of (Part 3).
  source text not null,

  fetched_at timestamptz not null default now(),

  -- `withFetchedRate` replaces a row for the same key and effective date rather
  -- than appending beside it, so a table with two figures for one date -- which
  -- would make "the rate in force" ambiguous -- cannot arise.
  primary key (household_id, key, effective_from)
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

-- The two household-scoped tables ask the question the first migration already
-- wrote down. The two worker-scoped ones ask it one join further out, and they
-- ask it through a helper for the same reason `is_household_member` is a helper:
-- two tables asking separately are two chances for one of them to answer
-- differently, and this one is *defined in terms of* that one, so there is still
-- one answer.
--
-- `security definer` here is not about recursion -- it is so the check does not
-- depend on the caller's own visibility of `public.workers`. A policy written as
-- a subquery against `workers` would be filtered by that table's policy in turn,
-- which happens to give the same answer today and would silently change meaning
-- the day the worker policy grew a condition of its own.
create or replace function private.owns_worker(worker uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.workers
    where id = worker
      and private.is_household_member(household_id)
  );
$$;

-- **Granted, and safe for the same reason the membership helper is** (the third
-- migration's lesson, which cost three corrections to learn): a policy's
-- expression is evaluated as the role making the request, so a function named in
-- a policy must be executable by that role. This one answers a single question
-- -- is *the caller* able to reach this worker -- reading the caller's identity
-- inside its own body through `is_household_member`, and takes no argument that
-- could make it answer for anyone else. So a signed-in person who calls it
-- directly learns only whether a worker they already hold exists.
grant execute on function private.owns_worker(uuid) to authenticated;
revoke execute on function private.owns_worker(uuid) from anon, public;

alter table public.spans enable row level security;
alter table public.spans force row level security;
alter table public.months enable row level security;
alter table public.months force row level security;
alter table public.holiday_lists enable row level security;
alter table public.holiday_lists force row level security;
alter table public.dated_rates enable row level security;
alter table public.dated_rates force row level security;

-- `force` on every one of them: without it the table owner is exempt from its
-- own policies, so the isolation would hold for everyone except the role the
-- migrations run as -- which is the role a mistake is most likely to run under.

create policy spans_all on public.spans
  for all to authenticated
  using ((select private.owns_worker(worker_id)))
  with check ((select private.owns_worker(worker_id)));

create policy months_all on public.months
  for all to authenticated
  using ((select private.owns_worker(worker_id)))
  with check ((select private.owns_worker(worker_id)));

create policy holiday_lists_all on public.holiday_lists
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy dated_rates_all on public.dated_rates
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

-- Row-level security decides **which rows**; a grant decides whether the role
-- may touch the table at all, and the two are separate gates -- the second
-- migration exists because the first left this one shut and every request came
-- back `42501 permission denied for table households`.
--
-- Per table and per verb rather than `grant all ... in schema public`, so a
-- table added later is shut until someone says otherwise.
grant select, insert, update, delete on public.spans to authenticated;
grant select, insert, update, delete on public.months to authenticated;
grant select, insert, update, delete on public.holiday_lists to authenticated;
grant select, insert, update, delete on public.dated_rates to authenticated;

-- `anon` is a request with nobody signed in behind it. Every row in these tables
-- belongs to some household, so there is no row it could be right to hand out.
revoke all on public.spans from anon;
revoke all on public.months from anon;
revoke all on public.holiday_lists from anon;
revoke all on public.dated_rates from anon;
