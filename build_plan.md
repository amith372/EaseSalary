# build_plan.md — EaseSalary

The order in which the application is built, and what each stage is made of.

> **This file = *what to build next*.** It decides nothing about behavior — `specs.md`
> does that. If a stage and the spec disagree, the spec wins and this file is corrected.

The ordering principle has two clauses, and the second was added after the first had
already shaped the stages: **reach a correct number as early as possible, and then make it
touchable as early as possible.** The August 2025 case can be checked by hand at the end of
stage 2, before a database, a screen, or a login exists — if the engine is right the rest is
assembly, and if it is wrong everything built on top inherits the error. But an engine that
is right and cannot be clicked is still unverifiable by the only person whose verification
counts (working rule 7), so the stages are ordered to reach a **usable vertical slice**
before they reach completeness in any one layer.

## The vertical slice — the order the stages are actually built in

The slice is not a new architecture and nothing is built twice for it. Step 8's repository
interface exists precisely to permit it: with a month's facts moving through an interface
that names no Supabase, stage 4's screen runs on an in-memory store and stage 3 lands
*beside* it rather than in front of it.

| # | Piece | Stage | Blocked by | Preferred after |
|---|---|---|---|---|
| 1 | The month's term snapshot | 1 · step 7a | — | — |
| 2 | The rest-day rename and its three persisted values | 1 · step 7b | 1 | — |
| 3 | The rest-day generalisation — Friday and Sunday workers | 1 · step 7c | 2 | — |
| 4 | The open sick spell | 1 · step 7d | 3 | — |
| 5 | The repository interface and its in-memory implementation | 1 · step 8 | 1, 3, 4 | — |
| 6 | Two artboards reconciled with the shell — `חישוב החודש`, `דף המשכורת` | design pass, jobs 1–2 only | — | — |
| 7 | The month screen: calendar, marks, live preview | 4 | 5, 6 | — |
| 8 | The export, reachable by a user | 2 | 3 | 7 |
| 9 | Everything else | 3, 5, 6, 7 | 8 | — |

**"Blocked by" and "preferred after" are different things and the table keeps them apart
on purpose.** A blocking edge is a fact — the work cannot start. A preference is this
plan's chosen order and an agent may break it. Row 7 is the case: the export consumes the
engine's output, which has existed since stage 1, so it is genuinely blocked only on step
7c, which gives it the nine rest-day placeholders. It is *preferred* after the month screen
because "touchable as early as possible" wants the screen first and because the agreement
test needs a preview to compare against. Writing that preference as a blocking edge would
say the template fill cannot begin until the whole screen is done, which is false, and a
table whose edges are partly preferences cannot be used to decide what may be picked up.

**What the slice does not need:** a login, Postgres, row-level security, or a live
minimum-wage fetch. Stage 3 later swaps the repository implementation underneath a screen
that already works, and stage 5 replaces manual wage entry with the fetch on a confirmation
screen that already exists.

**How it gets past item 4's export gate without stage 5.** It does not evade the gate; it
takes the branch the spec already requires. Part 3: *a failed fetch degrades to the last
confirmed figure plus manual entry, and never blocks an export.* The slice has no fetch
yet, so it always takes that branch. This is a specified path built early rather than a
stub, which is why stage 5 can add scraping to it without rewriting it.

**What the slice is seeded with, and why it is not August 2025.** The dev store opens on
months of **2026** — the year whose workbook is the canonical layout reference — and the
user can move between them, which is also what exercises the balance chain that criterion
13 and the term snapshot both rest on. August 2025 stays where it belongs: it is the
**agent's** fixture, the only month whose four totals come from the family's own sheet and
therefore the only one that can prove the engine (`CLAUDE.md`, on where a test's expected
figure comes from). A seed month is for clicking; it proves nothing and must never be
mistaken for a case.

**The slice is production code, not a prototype.** Every part of it survives into the
finished application; only the repository implementation is replaced, and that is the one
thing already designed to be replaceable. A throwaway would answer a design question that
is not open — the screens are on the canvas.

## The design

Thirteen artboards sharing one design system, on the Claude Design canvas — project
`b11cf323-ac11-490d-994d-3145e8e07a6b`:
https://claude.ai/design/p/b11cf323-ac11-490d-994d-3145e8e07a6b

Three of the thirteen are home-screen variants. `דף הבית v3 לוח במרכז` is canonical;
`v2` and `v2 layout A` are superseded and kept on purpose, so the layouts that were
weighed against each other can be looked at rather than described.

The canvas is the source for how a screen looks; this table says only which stage
consumes which artboard. Nothing of the design is copied here — the tokens live in
`src/app/globals.css` and the conventions in `CLAUDE.md`, and a colour or an RTL rule
that appears in this file is in the wrong one.

| Artboard | Consumed by |
|---|---|
| `דף הבית v3 לוח במרכז` | Stage 6 — built in stage 0 against fixtures |
| `חישוב החודש`, `החודשים` | Stage 4 |
| `דף המשכורת` | Stages 2 + 4 |
| `העובדות`, `דף העובד`, `הוספת עובד` | Stage 3 |
| `הגדרות`, `תשלומים` | Stages 3 + 5 |
| `דוחות` | Stage 2 — the yearly balances file |
| `התראות` | Stage 6 — see the reconciliation below |

Every stage that builds a screen carries two further **done when** clauses, because the
application is expected to be read through Chrome's translation and both failures are
silent: the screen holds no meaningful text inside an image, and translating it to
English throws no `NotFoundError` on `removeChild` and leaves the layout intact when
translated back.

### The design pass — split by kind, not run as one block

Every screen stage builds against an artboard. Three of those artboards do not yet exist,
and most of the rest disagree with the shell. The pass that fixes both happens **in its own
right** rather than inside the first stage that trips over it: designing and implementing in
the same step is exactly what rule 7's check cannot catch, since the agent would be
verifying a screen against a drawing it had just made up itself.

It was once planned to run once, after stage 1 and before stage 3. It no longer does,
because jobs 1 and 2 are transcription while job 3 is design, and the vertical slice needs
only the transcription:

- **Jobs 1 and 2 run for `חישוב החודש` and `דף המשכורת` before stage 4.** Those are the two
  artboards the slice builds against. **The green sidebar is already gone from both**, which
  this file asserted for months and nobody had opened the canvas to check: read on 2026-09-02,
  each carries the 62px top bar as `AppShell` builds it, and so does `החודשים` from the older
  of the two edit batches. The ten unread artboards are therefore unknown rather than known to
  be stale. What the two do still lack is the worker switcher, and each marks `דף הבית` as the
  active tab on a route that is not home. The rest are transcribed when their own stage arrives.
- **Job 3 waits for the decisions it rests on.** The reconciliation table at the foot of
  this file now records all eleven as settled, so job 3 is no longer blocked on the user —
  but it is still design work and it is still not folded into a stage that consumes it.

Three jobs, in order of how much design they actually involve:

1. **Fold the home screen's four departures into `דף הבית v3`.** They are recorded in
   `CLAUDE.md` and in `docs/plan-calculation-engine.md` Step 0 (f) and (g), and they were
   settled by measuring the built screen — but while they live only in prose, every future
   screen session has to be told, and any session that is not told will faithfully undo
   them. Transcription, not design.
2. **Bring the artboards that still draw the v2 green sidebar onto the top bar.** They
   disagree with `AppShell` on every route. Also transcription.
3. **Draw the screens that have no artboard at all.** This is the real design work, and
   the `frontend-design` skill belongs here and nowhere else in this plan. The
   reconciliation list at the foot of this file says what they are — the holiday picker
   first, since no artboard exists for it and stage 5 needs it, then the part-day, the
   manual-override state, the third-party payments group, the two day counts, the
   pre-export questions, a future month filled but not exportable, and a sick spell
   crossing a month boundary. Three more join them from the settled canvas list: the
   worker's three documents and their expiry dates (item 28), the bell and its split from
   the opening screen's own list (item 27), and the per-year salary summary download
   (item 29).

Anything in job 3 that *ought to exist* was a `specs.md` decision before it became a
drawing. Those decisions have now been taken and the table below records them, so job 3
draws what the spec says and nothing it invents.

The canvas is edited in its own editor. An agent can read the artboards but does not write
them, so jobs 1 and 2 are handed over as a list of changes rather than made directly.
**That list is `docs/design-pass-jobs-1-2.md`**, written on 2026-09-03 against the three
artboards it names by etag. It is a work order and not a decision: what it asks for is
already settled in `specs.md` or in the built system, and each item says which. It also
ends with what stage 4 needs that jobs 1 and 2 cannot supply.

Writing it turned up one disagreement that was not recorded anywhere: **the canvas and the
code both let the user mark a day `חג`, and criterion 9 says the user never does.** Settled
on 2026-09-03 — the spec leads, and it needed no amendment, since the need behind the drift
(a family moving which date her holiday falls on) is criterion 10's editable date in the
yearly picker. The canvas half is in the hand-over; the code half is stage 4's, because
`MonthCalendar`'s picker and the yearly picker that replaces it have to be swapped in one
step or a holiday becomes impossible to record in between.

**Done when** every screen the stage about to run will build has an artboard that agrees
with the shell, and nothing that stage needs is still missing from the canvas. For the
slice that means exactly two artboards; for the later stages it means the rest.

**As of 2026-09-03 that is not met, and stage 4 started anyway.** The hand-over is written
and the canvas has not been changed, so the two slice artboards still carry the three bar
items, the pre-v3 mark colours, the tool-palette gesture and the folded `תוספות ומקדמות`
row. Stage 4 therefore builds against `docs/design-pass-jobs-1-2.md` — the description
rather than the drawing — which is the weaker of the two and is written down here so that
nobody later reads the built screens as having been checked against a canvas they were
not. It is the weaker of the two and not a licence: every item of the hand-over is
something already settled in `specs.md` or in the built system, which is why the
description can stand in for the drawing at all. When the canvas catches up, the artboards
become the reference again.

## Stage 0 — Repo, scaffold, design system · **done**

Outcomes only. `docs/plan-home-screen.md` is the description of how it was done.

- The repository initialised against the EaseSalary remote, with the three `.xlsx`
  templates and the six holiday lists committed under `data/`.
- Design tokens, the application shell and the shared components in `src/`.
- `src/lib/i18n/he.ts`, every Hebrew string in one file, and `src/lib/links.ts`, the
  single central list of kol-zchut references (item 26). It is referenced by nearly every
  screen, so it belongs beside the translations rather than scattered through them.
- `src/lib/dates.ts`, UTC-only month arithmetic, and `src/lib/spans.ts`, the entitlement
  rules for a swept range — both under test.
- The home screen rendering at `/` from fixtures typed by the engine's own output shape.

## Stage 1 — The calculation engine

Plain TypeScript, no framework, no I/O. Vitest.

- Types for a month's facts: the worker's terms, the confirmed wage, and the month's
  actions held as `{ kind, from, to, note }` **spans** rather than per-day marks. A sick
  spell is stored as the dates it ran between (Part 3), and the statutory tiers cannot be
  counted from a spell's own first day across a month boundary out of marks that know
  only their own day. A single day is a span of one.
- Calendar arithmetic: days in the month, its Fridays, its Saturdays, working days.
- Rate derivation from the base monthly salary, including the 25-hour rest-day rate.
- The month's components: base, Friday supplement, Saturdays, holidays, sick pay,
  vacation, one-off payments, third-party payments.
- Advances: numbered, several at once, granted and repaid.
- Balances: vacation and sick accrual, carry-forward, the ninety-day ceiling.
- An explanation per line, each under a stable key, so another screen can show one
  figure's reasoning without re-deriving it.
- A thin repository interface — a month's facts in and out, with no Supabase in the
  signature — so stage 4 can build against an in-memory store and stage 3 can land
  beside it rather than gating it.
- The August 2025 test, matching four totals to the agora.

### Steps 7a–7d — the weekly rest day, reopened, and the open spell

Stage 1 met its "done when" and is reopened on purpose, because the rest day turned out to
be a term of the employment rather than the constant the engine was built on (item 5).

This was first written as one step. It is three, because it is three different kinds of
change and only the first is checked by the compiler. **Expand–contract is deliberately
not used**: it earns its place when batches cannot land green together, and here one
`tsc --noEmit` pass finds every site in a single-package repo of roughly 6,700 lines. A
parallel rest-day form beside the Saturday form would mean two sources of truth for the
same fact coexisting across counting, refusals and span rules — more dangerous than the
rename, not less. One landing per step.

#### Step 7a — the month's term snapshot

The prefactor, and it comes first because `specs.md` Part 3 now says terms are read off the
month and **never off the profile**. `MonthFacts` gains the terms the month was confirmed
with, joining the `ConfirmedWage` that already lives there, and `calculateMonth` stops
taking a separate `WorkerTerms` argument off the profile. The profile still holds the
worker's *current* terms; the month holds the ones it was calculated with.

Doing it before the rename is what makes the rename easy: the rest day then arrives as one
more field on a concept that already exists, rather than as a new concept introduced in the
middle of a wide rename. Landing it after step 7c instead would reshape step 8's repository
interface twice, and landing it after stage 3 makes it a migration — which is the same
argument this plan already uses to justify reopening stage 1 at all.

**Check:** `august-2025.snap.md` byte-identical.

#### Step 7b — the rename, and three persisted values

Mechanical and compiler-checked: `saturdays`, `saturdaysWorked`, `isSaturday`,
`saturdaysOf` and their kin become rest-day equivalents across eight modules in
`src/lib/engine/` — `balances`, `counts`, `leave`, `month`, `rates`, `sick`, `thirdParty`,
`validate` — plus `dates.ts`, `spans.ts`, `types.ts`, `MonthCalendar.tsx`, `i18n/he.ts` and
`fixtures/home.ts`.

**Three of the names are stored values rather than identifiers, and they are the ones a
compiler cannot help with:** `MarkKind` at `src/lib/types.ts:24` is a string-literal union
whose `"freeSaturday"` member is persisted span data; `lineKeys.fridaySupplement` at
`src/lib/engine/month.ts:60` is a *stable* key by design, since a screen shows one figure's
reasoning by it; and the same key reaches the explanation text in `i18n/he.ts`. Renaming
each needs a migration story, not just an edit.

**Check:** `august-2025.snap.md` byte-identical.

#### Step 7c — the generalisation, and the check the snapshot cannot give

The semantic third: item 8's week re-anchors to the six days ending at the rest day, the
rest-eve supplement moves off Friday (item 14), and `validate`'s "must fall on a Saturday"
refusal becomes per-worker.

**The snapshot check does not cover this step, and saying so is the point of splitting.**
Hanna rests on Saturday, which is the default, so every non-Saturday path is unreachable
from `august-2025.snap.md` by construction: it proves the rename left the common case
alone and proves nothing whatever about the generalisation.

This paragraph used to name `counts.ts`'s sick week as the rewrite the snapshot could not
see, on the strength of its own comment calling the week "Sunday-anchored". **The comment
was wrong and the arithmetic was already right**: it computed the six days ending at the
*rest-eve*, which is item 8's window for all three rest days once the rest-eve is hers, so
generalising `isRestEve` was the whole of the change. The claim is corrected here rather
than deleted, because the reason it was believed still holds — a Saturday-only suite could
not have told the two apart either way, and a comment is not a test.

So this step carries **new cases for a Friday-resting and a Sunday-resting worker**, and
their expected figures are **derived on paper from items 5, 8 and 14** before the code is
written. No workbook covers them, which is exactly the condition under which `CLAUDE.md`
forbids reading an expected figure back out of the engine.

**Use the `mattpocock-skills:tdd` skill for this step, and for no other in this stage.**
Test-first is not a preference here but the only thing standing between the suite and an
engine that agrees with itself: 7a, 7b and 7d each have a byte-identical snapshot doing
that job, and 7c is the one step whose new behaviour no existing figure covers.

**Check:** `august-2025.snap.md` still byte-identical, *and* the two new workers' figures
match the paper derivation.

**Done when** the known case passes and the invalid case is refused, with no database and
no interface in existence.

**The user's own check is owed and cannot be paid here** (working rule 7). Nothing in the
application sets a worker's rest day — the home fixture is Saturday and there is no profile
to change it on — so the only check available for this step is the suite, which is the
agent verifying its own work and is the half already known. The debt is recorded rather
than waved through: the first screen that can set the rest day, in stage 5, is where the
Friday- and Sunday-resting cases become checkable by hand, and that stage should not close
without someone having done it.

#### Step 7d — the open sick spell

A spell with no end yet (item 8). `DaySpan`'s `to` becomes nullable, which is a change to a
**persisted shape** and so joins step 7b's three stored values as something the compiler
alone will not carry. The counting clips an open spell at the month's own last day; the
tiers are untouched, since an open spell is still one spell with one first day, which is
the whole reason the shape was chosen.

It is engine work and belongs here rather than in stage 4, though stage 4 is where the user
first meets it: the alternative is a screen that can draw a state the engine cannot count.
**Nothing in this step reads a clock** — a finished month clips at its own end, and the
current month's preview receives `today` as a prop from its caller (`CLAUDE.md`).

**Tests:** an open spell running past a month's end pays that month the same as the closed
spell of the same days; the clip is stable whatever `today` is; and a spell closed after the
fact moves the earlier month's figure, which is criterion 13 exercised at its smallest.

#### Step 8 — the repository interface, and the replay it makes possible

Two landings, because they are two different things and only the first is what the slice
was waiting for.

`src/lib/engine/repository.ts` is the store: a month's facts in and out, a worker's terms
and opening position, and **no database client anywhere in the signature** — which is what
lets stage 4's screen run on the in-memory implementation and stage 3 land its Postgres one
beside rather than in front of it.

**A month is stored without its spans, and that is the shape rather than an economy.**
Spans belong to the worker (`specs.md` Part 3): a spell crossing a boundary is stored once
and handed whole to every month it overlaps, so each month can place a day at its right
tier, and each draws from the balance only the days that fell in it. `MonthRecord` is
`MonthFacts` minus its spans, so the compiler refuses to write a span through the month and
nobody has to remember not to.

`src/lib/engine/series.ts` is the replay, and it is what makes `CLAUDE.md`'s "a series, not
a single month" true rather than merely claimed. Three things carry: the balances, without
limit and across the new year; the vacation days spent and the holiday days spent, which
reset at January because item 7's seven-day question and item 10's nine-day entitlement are
both asked of a calendar year. It walks the months the store holds and invents none, and a
refused month stops it with the month named on the error.

**Criterion 13 had never been tested across a month boundary** — the existing case compares
two calculations of the same August — so this step is where it is: correct January, and
March's closing balance moves by exactly the day, with nothing invalidated because there was
never a stored balance to invalidate.

**Tests:** facts written and read back identical; a month reproducible from its facts alone;
a crossing spell drawing three days from January and three from February; the year totals
carrying and resetting; the tenth holiday of a year refused in the month that reaches it.
Every expected figure is derived from items 7, 8 and 10 on paper — no workbook covers a
chain of months, which is exactly the condition `CLAUDE.md` names.

**Check:** `august-2025.snap.md` byte-identical, and `grep -ri supabase src/lib/engine`
returns nothing.

**The user's own check is owed again, and this is the fifth step running.** Nothing in the
application yet sets a rest day, opens a sick spell, adds a user line or moves between two
months, so the only check available here is the suite — the agent verifying its own work,
which is the half already known. The debt now covers steps 7a through 9 in full. Stage 4's
month screen is the first thing that pays any of it and stage 5 the rest; **neither should
close without someone having clicked the cases these steps were written for.**

#### Step 9 — a spell ends on the first *working* day

Unplanned, and found by the user asking how a spell is opened at all. The answer exposed a
worse gap than the missing gesture: **the natural way to record an illness is to mark the
days she was absent from work**, and the engine broke a spell on any unmarked day, so
marking Friday and Sunday and leaving the Saturday alone restarted the tiers and paid the
Sunday nothing. The month came out plausible and wrong, which is the class of failure
`specs.md` Part 5 exists for.

The rule now follows the source rather than the calendar: for a worker on a monthly salary
the period of illness is counted in calendar days, so a day she owed no attendance sits
inside it — the weekly rest day, said in so many words by Kol Zchut's *חישוב דמי מחלה
לעובד במשכורת חודשית* citing ד"מ 48713-10-17, and an unworked holiday, carried by the same
holding's reasoning and marked in `specs.md` as the extension it is. **Those days are drawn
from the sick balance too**, so the balance follows the spell and not the marks. A holiday
inside a spell is a sick day and is not drawn from the yearly entitlement; the family moves
the holiday, which is the one of the two that can be moved.

A vacation day between two reported days is left breaking the spell and is recorded in the
appendix as unsettled — the narrower answer, and the one that changes nothing already built.

**Check:** `august-2025.snap.md` byte-identical, which it is by construction: the known
month carries no sickness at all and both its holidays were worked.

## Stage 2 — The export

ExcelJS in a server route. One month template and one balances template.

- Load a template and fill it from the engine's output. **The filler owns the map** from
  the engine's stable line keys to the template's cells, and there is no sheet model in
  between: a third representation would be a third thing to keep in step, and the property
  that matters — the preview and the file saying the same thing — is already carried by
  their sharing one engine result, which the agreement test below asserts directly. A
  sheet model would earn its place only if a second output format existed, and the PDF the
  canvas drew is not being built.
- Generate the closing block from the month's advance lines. Part 3 builds it from
  however many advances the month has, "rather than from a fixed set of variants", so
  `template_month_advance_given.xlsx` is kept as a reference sample of the shape and not
  as a second template to branch on.
- **Insert rows for the lines the user added, and grow the sums over them.** The closing
  block is no longer the only region that varies: item 20's lines are rows the template
  does not hold in advance, in column E, column G or the block below. Part 3 requires the
  sheet's own totals to stay live formulas whose ranges expand to cover what was inserted
  — the family's workbook is a live spreadsheet today and a dead one would be a step back
  — so this is `insertRow`/`duplicateRow` against a row the template already designed,
  plus a rewrite of the `SUM` ranges beneath it.
  **The trap is that a range one row short prints a total wrong by exactly one line and
  looks entirely ordinary**, which no eye catches on a sheet of plausible numbers. The
  agreement test below is what catches it, extended one layer: assert the engine's figure
  equals what the spreadsheet's own formula evaluates to, on a month with added lines and
  a month without. Evaluating the formula means either reading it back through a
  calculating reader or asserting the range covers exactly the rows written — decide which
  when the shape of the template is in front of you, and say which was chosen and why.
- Placeholder tokens for identity and month fields.
- The two versions of the month export, differing only in whether the helper column of
  notes is shown (item 2). One file and one flag, not two files: a test asserts the two
  carry identical figures, since the whole reason for one file is that they cannot
  drift apart.
- The yearly balances export as its own file.
- A test that drives the preview's lines and the filled cells from the **same** engine
  output and asserts they say the same thing. That agreement is the property that
  matters, and a test sitting beside only the engine or only the filler cannot check it:
  each passes happily while wording the month differently from the other.
- The export stays internal and test-only until stage 5 closes its gate — item 4 requires
  the minimum wage confirmed before *every* export, and that confirmation lands there.
- The templates are committed data. `.gitignore` must never ignore `*.xlsx`: the
  application still runs without them and only the export breaks, so the mistake surfaces
  on someone else's clone rather than here.

**Done when** an exported file for August 2025 can be opened beside the family's own
sheet and read as the same document.

## Stage 3 — Accounts and storage

Supabase: Postgres, Auth, row-level security.

- Schema: account, worker, month, **day spans**, advances, third-party payments,
  overrides, confirmed wages, cached holiday lists. Spans rather than per-day rows, and a
  sick span may run past the end of the month it started in.
- **Item 13's cascade is no longer an open question here.** It was written as a choice
  between balances derived on read and balances stored with an invalidation; it is now
  decided the first way, in stage 1 rather than in this schema. The engine replays a
  worker's months from the opening position, so a corrected month moves every later
  month's balances by construction and there is nothing to invalidate. Replaying twenty
  years measured at 37ms, which is less than the round trip that fetches it. What this
  stage stores is therefore **facts only, never balances**; if a cache is ever wanted it
  goes in front of the replay, where deleting it is safe.
- **The month's term snapshot is a schema requirement, not an engine detail.** Part 3 has
  the month storing the terms it was confirmed with — rest day, rest-eve supplement,
  recuperation month — beside the confirmed wage it already stored. Step 7a builds the
  shape; this stage persists it. Discovered in stage 6 it is a migration.
- Roughly five tickets' worth, and the largest stage in the plan: nine entities, the
  household model of item 11 with its many-to-many membership and a two-worker limit that
  must not count a shared worker, row-level security whose "done when" is an adversarial
  property, and encryption across five fields.
- The month's state carries item 21: a future month may be filled in but not exported
  until it has ended.
- The worker's opening position: balances already accrued and an advance part repaid.
- Row-level security for account isolation; the two-worker limit on creation.
- Sharing by invitation, and a shared worker not counting against the other person's limit.
- Encryption of passport and bank account numbers, key in an environment variable.
- Anything stage 7 stores is account-scoped under the same row-level security, and its
  context is assembled from the engine's output rather than from the worker row, so an
  identity number cannot reach it.

**Run `/security-review` before this stage is committed**, and nowhere earlier — it is the
only stage that introduces an authorisation boundary, encryption at rest, and data reachable
by a request the user did not make. The stage's own "done when" is an adversarial property,
and the agent that wrote the policies is the worst placed to attack them.

**Done when** a second household cannot reach the first household's worker by any crafted
request, and the identity columns are unreadable in the database.

## Stage 4 — The month screen

Next.js App Router, Tailwind right-to-left, Hebrew strings in one translations file.

- The calendar: her rest days and rest-eves derived from her own rest day, not from
  Saturday, and days marked for what departed.
- **The holiday stops being a mark and becomes a state.** Criterion 9: the user never marks
  a day as a holiday — the year's dates are chosen in advance and arrive on the calendar
  already drawn, and the month records only whether she worked one, in two weights, an
  outline for a holiday she did not work and a fill for one she did. `MonthCalendar`'s
  picker currently offers `חג` and `MarkKind` cannot say whether a holiday was worked, so
  this is a change to the model and not only to the calendar. The picker that *chooses* the
  dates is stage 5's, so in this stage the year's chosen dates come from the repository as
  seeded data and the calendar only draws them and records the one fact about each. That
  keeps the swap in one step — the mark goes and the drawn state arrives together — without
  waiting on a screen two stages away, and stage 5 then puts a picker in front of the same
  stored dates rather than introducing them.
- **Range entry.** A week's vacation is one gesture, not seven clicks, and the stored
  shape is a span either way. The entitlement rules for a swept range are already written
  and tested in `src/lib/spans.ts`; this stage puts the calendar's gesture on top of them.
- **A sick spell is entered open, which is what closes the month-boundary gap.** The two
  shapes this stage once weighed — a sweep that carries past the month edge, or an end date
  the user sets past it — are both rejected, and neither is built. Each asks the user to
  express "she is still ill" as a range they do not have, and the first inverts under
  right-to-left, where a leftward drag moves *forward* in time. Instead the spell has no end
  until she returns (item 8): `to` is null, the calendar draws it as running, and the
  boundary is never crossed by a gesture because there is no gesture that crosses it. The
  span's counting is clipped at the month's last day, which keeps the clock out of every
  finished month; only the live preview of the current month clips at the `today` prop.
  Closing a spell late is a correction and rides on criterion 13, already built in stage 1.
- The three groups beside it: additional payments, third-party payments, yearly settings.
- A free-text note on every action; manual override of any computed amount, shown as
  manual.
- A future month accepts facts and refuses export, saying which of the two it is.
- The live preview, driven by the same engine as the export.

**Done when** the August 2025 facts can be entered by marking days, and the preview shows
the same four totals the engine produced in stage 1.

**It is built against `docs/design-pass-jobs-1-2.md` and not against the canvas.** The
hand-over was written on 2026-09-03 and has not been applied: the two slice artboards still
carry the three bar items, the pre-v3 mark colours, the tool-palette gesture and the folded
`תוספות ומקדמות` row. So the description is what this stage follows, item by item, and the
etags in the hand-over are what says whether that is still true. When the canvas catches up,
the artboards become the reference again and the hand-over becomes a record of what changed.

### Step 1 — the month screen exists, on the store, and draws · **done**

The first thing in this application anybody can check without reading a test. `/month` was a
404 the home screen linked to; it is now a route that reads the household out of the
repository, replays each worker's months, and draws one of them.

- `src/lib/dev/seed.ts` — the seeded household: two workers, January to September 2026, and
  the days that departed from an ordinary month in each. It is **for clicking and proves
  nothing**: the one month whose figures are known to be right is August 2025, which comes
  from the family's own sheet and stays in the suite. Two figures in it are *given* rather
  than invented — the opening position is a fact item 6 says the family states once — and
  the salary is the last minimum wage this repository has a source for, ₪6,247.65 from
  1.4.2025, rather than a 2026 figure nobody has fetched.
- `src/lib/dev/store.ts` — `getRepository()`, the only line in the application that names an
  implementation, and the one stage 3 substitutes. A module singleton hung off `globalThis`,
  so an edit under `next dev` does not silently reset the store mid-check.
- `src/app/month/page.tsx` — a **server** component. Part 3 says all salary logic runs on the
  server and the browser only collects facts and displays results, so the engine runs here
  and the browser receives calculated months. `connection()` keeps it out of the prerender.
- `src/components/MonthScreen.tsx` — the client half: it picks the worker off the shell's
  scope and the month off its own state, and draws. It holds no arithmetic.
- `src/lib/today.ts` — the one place in the application that reads a clock, on the server,
  in `Asia/Jerusalem`. "Today" is a local fact: a container running in UTC reads the 1st for
  three hours after Israel has reached the 2nd, which would move an open spell's last
  counted day.
- `overlapsMonth` moved from the repository to `src/lib/spans.ts`, and the home screen's
  span-overflow block became `src/components/SpanOverflow.tsx`. Both are span geometry with
  three callers, and a client component reaching into the repository for the first would
  pull a store into the browser to answer a question about dates.

**Three decisions taken here, none of them reopenable without a reason:**

1. **The whole household is calculated, not the worker on screen.** The switcher is in the
   shell and its choice is client state, so a page that calculated only "the current worker"
   would have to learn who that is before it could render. An account holds two workers
   (item 11) and a replay is tens of milliseconds.
2. **The month is client state and not a URL parameter.** Moving between months then costs
   no round trip, and the switcher stays exactly as built. The cost is that a month cannot
   be linked to, which nothing yet needs; when something does, `searchParams` on the server
   component is where it goes.
3. **The full-width row under the bar is dropped, not rehoused** — the hand-over's job 2a
   item 4 left the choice open. `› חזרה לדף הבית` is what the nav's own `דף הבית` tab already
   is, and `נשמר אוטומטית` describes a save that has not been built and will be immediate
   when it is.

**The calendar draws and does not mark, and that is a step boundary rather than a gap.**
Marking writes through the store, and the store cannot take a holiday span until the holiday
stops being a mark and becomes a state — the swap that has to happen in one step, since
dropping `חג` from the picker before the drawn state exists leaves a holiday impossible to
record at all. So a day here is not a button: a control that answers a click with silence
reads as a broken screen, and `MonthCalendar` gained a `readOnly` that turns marking off and
leaves the month buttons alone, because moving between months is reading.

**Check — the first one in seven steps that is not the suite.** With `npm run dev` running,
open http://localhost:3000/month.

- It opens on **ספטמבר 2026** and reads `26 / 26` work days, `₪6,247.65` base, `4 × ₪100.00`
  supplement, `₪8,353.05` as both `סך הכול החודש` and `לתשלום לעובד/ת`, and balances of
  15.50 vacation and 33.50 sick days. September 2026 has four Saturdays, so 30 − 4 = 26 —
  the standard count, and the actual count equals it because she took nothing.
- Press `‹` back to **מרץ** and then `›` to **אפריל**. `ניכוי ימי מחלה` reads **−₪374.86** in
  March and **−₪124.95** in April. That is the whole of what the crossing spell means: one
  spell of four days from 30.3 to 2.4, stored once, whose first day pays nothing, second and
  third pay half and fourth pays in full — so March deducts 1.5 days and April 0.5. **If
  April also read −₪374.86 the spell had been read as two, and the tiers restarted.**
- April also carries `ביטוח לאומי ₪1,000.00` in a card of its own under the total, with
  `בגין החודשים ינואר 2026, פברואר 2026, מרץ 2026`. It must **not** be inside `סך הכול החודש`
  (₪8,654.45) — that money went to the institute and never to her (item 16).
- Now press the **left** arrow of the worker switcher in the top bar and go to **מאי**.
  Every label that names a day has changed: `תוספת ימי חמישי` at `4 × ₪80.00`,
  `עבודה ביום שישי` at `3 × ₪426.35`, and the column's own subtotal reading
  `סך ימי שישי וחגים`. Her free rest day has moved from Saturday the 16th, where the first
  worker's is and where it reads `שבת חופשית`, to Friday the 15th, where it reads
  `יום שישי חופשי`.
- That May subtotal is ₪1,705.40 — **four** days' worth from a line of three plus a
  holiday, because the holiday she worked on Friday the 1st fell on her own rest day and is
  paid once and not twice (item 9). Five would be the double payment.

**What a failure looks like:** the same figure in March and April; a label naming Saturday
for the Friday-resting worker; the national-insurance ₪1,000 folded into the month's total;
or a day that highlights on hover as though it could be clicked.

**The rest-day column is not shaded, and that is on purpose.** The artboard shades it and
the hand-over's job 2a item 8 asks for the shading to follow her own day rather than
Saturday — but `src/app/globals.css` already records the decision the built system took:
an unmarked rest day is drawn exactly like an unmarked weekday, because `יום עבודה` names a
day she worked and an unmarked rest day is one of them (item 5). So the switch is read off
the labels and the free-rest-day mark, both of which move. Do not add the shading back
without reopening that decision first.

### Step 1b — the user's own lines choose their side of the total · **done**

Unplanned, and asked for by the user in two sentences while step 1 was being checked. Both
went into `specs.md` before any code moved.

**Fridays are shown beside Saturdays and holidays, and nothing about the file changes.**
The user asked for the rest-eve supplement to sit with the rest-day work and the worked
holiday. On the sheet it belongs to the salary column — criterion 1 pins August 2025 at
₪6,747.65 for column E, which is the base plus the ₪500 Friday supplement, against
₪2,558.10 for column F — so moving it would restate the one month the engine is checked
against. The resolution is item 5's new paragraph: **the preview groups by kind and the
sheet groups by column**, the three day lines are shown together under a heading that names
her own two days, and the column totals are shown *apart* at the foot rather than under the
groups. A column total printed under a group it does not add up to is worse than no
grouping, and that is exactly what the obvious reading would have produced — the first
mock-up of this drawn for the user had that error in it.

**A line the user adds now chooses its side of the month's total** (item 20, rewritten).
The direction decides the sign and nothing else; `placement` is a third independent choice
and defaults to where every line sat before it existed — an addition before, a deduction
after — so the whole suite went on asserting the figures it always had. The two
combinations that were previously impossible are now expressible and both are ordinary: a
deduction inside the month lowers what the month cost and with it item 19's estimate, and
an addition outside it adds to the transfer without reaching either.

**On the month screen the lines are summarised, one row per side.** The itemisation is the
payments screen's and the export's, and that division is not a preference: item 2 requires
the payslip to show every payment with its type, its units and its amount, so a summarised
row in the *file* would breach it while a summarised row on a *screen* answers "what did
this month come to" better than nine rows would.

**Check:** the two mutations that matter were made and both were caught — `placementOf`
returning `beforeGross` for everything failed six tests, and dropping the sign on a
before-gross deduction failed two.

**Check — click it.** On http://localhost:3000/month press `‹` to **יוני 2026**:

- The heading `ימי שישי, שבתות וחגים` now stands over `תוספת ימי שישי ₪400.00` and
  `עבודה בשבת ₪1,705.40` together. Switch worker and it reads `ימי חמישי, ימי שישי וחגים`.
- `תוספות והורדות שהוספת ₪250.00` sits **above** `סך הכול החודש ₪8,603.05`, and a second
  row of the same name reading **−₪180.00** sits below it, so
  `לתשלום לעובד/ת` is ₪8,423.05. The heading appears twice on purpose: one heading covers
  both directions, and the side of the total it sits on is what differs.
- At the foot, `לפי העמודות בדף המשכורת` reads `סך שכר החודש ₪6,647.65` — the ₪400 is
  still counted there, which is the whole point of "display only".
- Now `›` to **יולי 2026**. The added row is **−₪180.00 above** the total this time, the
  month comes to ₪8,273.05 instead of ₪8,453.05, and `סך תשלומים חד־פעמיים` is −₪180.00. A
  deduction placed before the total is a negative line in a column, not a row below them.

**What a failure looks like:** the Friday supplement missing from `סך שכר החודש`; July's
₪180 appearing below the total instead of above it; or the same figure for June and July,
which would mean the placement was being ignored.

**What the review found, and what is still owed.** A two-axis review ran over this change
before it was committed. Three findings were real and are fixed here: a line the user
withheld was signed on its **rate**, which puts a negative unit price in column D and is the
reading Part 5 warns about — it is signed on the units now, as the sickness deduction
already was; an **override** on such a line rounded differently on the two sides of the
total, so moving a line across it silently inverted an amount the user had typed (item 17),
and the sign is now forced from the direction on both sides; and the preview's groups were
keyed whitelists, so the next line the engine grows — the recuperation payment, item 15 —
would have counted in the total and appeared nowhere, which a catch-all group now makes
impossible by construction. Both engine fixes carry a test and both were mutation-checked.

**Still owed, and it is scope rather than a defect: nothing on any screen can yet *make*
the placement choice.** The spec says it is offered beside the line; today only the seed
sets it. The screen that adds a line is stage 4's "three groups beside it" step, and that
is where the control belongs — it is listed there and not forgotten here.

**Editing the seed needs the dev server restarted.** The store is a `globalThis` singleton
so that saving a file mid-check does not silently reset the marks — the same property means
a change to `src/lib/dev/seed.ts` is not picked up until the process restarts. This was
found the honest way: the seeded lines were added and the screen went on showing the month
without them.

### Step 2 — the holiday stops being a mark, and the calendar starts writing · **done**

The swap `build_plan.md` said had to happen in one step, and the step that makes the month
screen a screen rather than a display.

**The model splits in two.** `MarkKind` is now what the *user* may mark — `vacation`,
`sick`, `freeRestDay` — and `SpanKind` is what a span may *be*, which adds `holiday`. No
stored string moved: a holiday span still carries `"holiday"`. What moved is which code may
write one, and the compiler now says so — `MarkIntent.kind` is a `MarkKind`, so `applyMark`
cannot produce a holiday, and the picker is built from the same union it stores.

Three things fell out of that split and each was resolved rather than patched around:

- **`restDayHoliday` is no longer a skip reason**, because no sweep can produce a holiday.
  The refusal itself did not go — it moved wholly into `validate.ts`, which is where it
  belongs now that the only caller able to place a holiday is the year's chosen dates, a
  caller the calendar's own refusals never see. The test that asserted the old gesture was
  replaced by the behaviour that replaced it, not deleted.
- **A day carrying a holiday refuses a mark like any other marked day**, as `alreadyMarked`.
- **`specs.md` item 5 still listed "a holiday worked" among the things the user marks**,
  which contradicted item 9. Item 9 is the authority and item 5 was corrected.

**The gesture, which had no artboard and was the user's to decide.** A holiday answers a
**single click**: the panel that opens where the range picker would be asks `עבדה בחג?` and
offers two chips, and no "clear" — the date belongs to the year and removing one is the
yearly picker's (item 10). The cost is that a holiday cannot be the day a sweep *starts*
on; every other day still can, and a sweep that crosses one is unaffected. Asking the
question on the second click of a range would have been two clicks for a yes-or-no about a
day the user did not choose.

**Marking writes through the store, and the browser decides nothing.**
`src/app/month/actions.ts` holds three server actions — mark a range, clear a range, answer
a holiday. Which days inside a swept range may actually take the mark is an entitlement
question, so it is answered on the server by the same `spans.ts` the suite tests, against
the worker's stored rest day. Each action revalidates the route, so the figures beside the
calendar are the engine's answer to what was saved rather than something the browser
guessed; the preview dims while that round trip is in flight.

**Check — this is the first step in the project where the user changes something.** With
`npm run dev` running, open http://localhost:3000/month and press `‹` back to **אפריל 2026**.

1. The 3rd is drawn as a **filled** `חג` and the panel reads `24 / 26` work days with a
   line `עבודה בחג ₪426.35`, `סך הכול החודש ₪8,654.45`.
2. **Click the 3rd once.** A panel opens asking `עבדה בחג?`. Choose `לא עבדה`.
3. The day is redrawn as an **outline**, the `עבודה בחג` line disappears, the count falls
   to `23 / 26`, and the month falls to `₪8,228.10`. That is item 5's own check seen from
   both sides at once: a holiday worked changes the money and not the count, one she did
   not work changes the count and not the money.
4. **Now click the 20th, then the 22nd**, and choose `חופשה` from the panel. Three days are
   drawn, `ימים שנוצלו החודש` under חופשה reads 3, the balance falls from 9.67 to **6.67** —
   and `סך הכול החודש` does **not** move. Vacation never shrinks the base (item 5); if the
   money changed, the base is being computed from the actual count instead of the standard
   one.
5. **Reload the page.** The marks are still there. They are in the store, not in the
   browser — until the process restarts, which is what an in-memory store means.
6. The legend now has six entries, with `חג שנעבד` filled and `חג שלא נעבד` outlined, and
   the picker offers three kinds and no `חג`.

**What a failure looks like:** `חג` still among the picker's chips; the month's total moving
when a vacation is marked; the marks gone after a reload; or a holiday needing two clicks.

## Stage 5 — External data and yearly settings

`fetch` plus an HTML parser, server-side, cached in Postgres.

- The minimum wage with its effective date, and the plausibility check.
- Holiday lists per country and year, with the shipped files as fallback. An **empty**
  cached list is a failed fetch and not a country without holidays — the shipped
  `UA-2026.json` is empty and its `source_url` points at country code `UK`, which is what
  that mistake looks like from the inside.
- The fetched page text is cached beside the figure extracted from it rather than
  discarded. Stage 7 answers out of that text, and a corpus thrown away here has to be
  scraped a second time. It is cached **segmented by heading**, not as one blob per URL.
  Item 26's links already point at *sections* of the caregiver-terms page — `src/lib/links.ts`
  says so outright, and several of its keys share that one page on purpose — so a question,
  a legal link and a cached section all resolve to the same unit and Stage 7's matching has
  something to match on. Segmenting in Stage 7 instead means inventing it against text
  scraped two stages earlier, which is the scrape-it-twice outcome this bullet exists to
  avoid.
- The holiday picker: the candidate list, the entitlement, part days, the remainder.
- The recuperation month and entitlement from seniority.
- The confirmation questions that open an export, which are what make stage 2's export
  reachable by a user at all.

- The saved source pages and their three spoiled versions, as Part 4 requires: markup
  moved, an empty or failing response, and a figure outside the plausible range. They are
  fixtures in the test suite rather than a live fetch, so the suite neither depends on a
  site being up nor waits for one.

Roughly four tickets' worth: the wage scrape, the holiday scrape, the heading-segmented
cache, the holiday picker — which has no artboard at all — recuperation, and the pre-export
questions.

**Done when** a year with no stored holiday list fills itself, each of the three spoiled
pages produces a stated failure rather than a number, and a failed fetch leaves the user
able to type the figure and continue.

## Stage 6 — The opening screen

Same stack. The screen was built in stage 0 against fixtures; this stage replaces the
fixtures with what the earlier stages produce and adds nothing to the layout.

- The action list: quarterly national insurance, expiring licence or medical insurance,
  an advance still being repaid, holidays not all chosen, recuperation due, a year with
  no vacation taken, a finished month not exported, a wage that changed, a worker
  crossing into a new seniority year.
- The current month's calendar, its totals and the balances beside that list (item 27).
- The national-insurance tick, with the months it covers.

**Done when** an account with nothing outstanding shows an opening screen whose action
list is empty.

## Stage 7 — The help screen, and a possible assistant on top of it

Where the "צריך/ה עזרה?" card goes. The design draws that card on every artboard and
points it nowhere.

**Part one — the help screen.** It holds no explanation of its own (item 24). It points
at the explanation, the reference link, or the screen that settles the question, so an
answer stays written in exactly one place.

- A registry of screens: each route, its Hebrew name, and what it is for. The sidebar
  reads the same list rather than keeping its own.
- Question matching written by hand, over the explanations, the reference list and the
  page text cached in stage 5.
- The panel: a question, an answer, and the link or screen it points at.

**Part two — a model. A potential feature, not a decision taken.** Only worth it if the
hand-written matching turns out too rigid once part one has been used. It would read the
question and the candidate list and never the account; the answer would still be
assembled locally, so no worker, amount or identity number leaves the application and the
choice of model stays cheap to change or to reverse. Two conditions come with it if it is
ever built: the prompts are source files, reviewed and versioned like any other code,
because the behaviour lives in their wording and an unreviewed edit to a sentence is a
real fault with no diff anyone reads; and a hard ceiling on calls per question, so a loop
that goes wrong costs a known amount rather than whatever it manages to spend before
someone notices. **Whether to build it at all, and
which model, is a question to put to the user at the very end — not before.**

**Done when** a question reaches the right screen or the right explanation and the answer
names its source, and part two can be dropped entirely without part one changing.

## Design ↔ spec reconciliation

Where the canvas and `specs.md` disagreed, found while building stage 0. Every item is now
**settled**: each was a decision only the user could take, each was taken, and each went
into `specs.md` before becoming code. The table is kept rather than deleted so that a
contradiction already resolved is not rediscovered and re-argued — and so that the six
marked *drop* are known to be deliberate absences rather than things nobody got to.

**In the canvas, not in the spec — all eleven now settled**, and each resolution is written
where it belongs rather than here. The canvas is what changes for the six marked *drop*.

| Drawn on the canvas | Verdict | Where it now stands |
|---|---|---|
| Accrued-severance card on `דף העובד` | drop | `specs.md` future-features appendix — it arrives with end of employment or not at all |
| PDF export on `דף המשכורת` | drop | The spec exports `.xlsx` only |
| Payment date, payment method, "mark as paid" | drop | Bookkeeping about the family's bank, unverifiable, and it drives nothing |
| Notification toggles in `הגדרות` | drop | Item 27 — nothing leaves the application, so there is nothing to toggle |
| Separate `התראות` page | drop | Item 27 — one screen, two lists |
| The bell | **keep** | Item 27 — the bell is what is *about to* lapse; the screen's own list is what has lapsed or blocks a calculation |
| "להוריד את כל הנתונים" | **keep, reshaped** | Item 29 — one worker, one year, no identity numbers; not every year at once |
| Editable "ימי חופשה בשנה" / "ימי מחלה בשנה" | drop | Item 7 — derived and not editable: an editable entitlement is a figure the user must know, and under carried-forward balances it raises "which past months does the edit reach into", which has no answer a user could hold. An agreed extra is recorded as an additional payment (item 20) |
| Configurable weekly rest day | **keep** | Item 5 — Friday, Saturday or Sunday as the law allows ("לפי המקובל על העובד"), defaulting to Saturday. The largest of the eleven: it reopens Stage 1, renames the Friday supplement, moves the sick week, and turns nine template labels into placeholders |
| "היתר העסקה" number | **keep, and it was under-drawn** | Item 28 — three documents, three expiry dates, not one |
| "לסיים העסקה" | drop | The appendix keeps ending an employment out of v1 |

**In the spec, missing from the canvas.** The two day counts, standard and actual (items
2 and 5, a Wage Protection Act requirement) — half-corrected on 2026-09-02: `חישוב החודש`
now carries the pair on its confirm step as ימי עבודה (בפועל / תקני), while `דף המשכורת`,
which is the sheet the Act actually governs, still shows one count · minimum-wage confirmation before every
export (item 4) · the pre-export confirmation questions (item 18 — the wizard's third
step is a read-only summary, not questions) · part-days for vacation and holiday (items 7
and 10 — the calendar mark is binary) · the third-party payments group (items 5 and 16 —
column H, never inside the worker's total) · the holiday picker (item 10 — the home
screen links to it, but no artboard exists) · a sick spell crossing a month boundary
(item 8) · an override shown as manual (item 17) · a note on every action (item 5) · a
future month filled but not exportable (item 21).
