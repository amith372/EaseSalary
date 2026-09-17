# build_plan.md — EaseSalary

The order in which the application is built, and what each stage is made of.

> **This file = *what to build next*.** It decides nothing about behavior — `specs.md`
> does that. If a stage and the spec disagree, the spec wins and this file is corrected.

**How this file is kept.** It holds only work that is not yet done, plus the debts a
finished step handed forward. **A step that lands is compressed to one line the same day** —
its name, its date, and nothing else. What it found, why a control looks the way it does, and
what its tests would catch are not recorded here: they are in the code, in the tests, in
`specs.md`, or in the commit. Anything a finished step left **unfinished** is the one thing
that survives it, and it moves into "What is still owed" below or into the stage that will
pay it. This file is read whole by every session that asks what to build next, so a paragraph
about work already done is a paragraph charged to every future session.

**The ordering principle:** reach a correct number as early as possible, then make it
touchable as early as possible. An engine that is right and cannot be clicked is still
unverifiable by the only person whose verification counts (working rule 8).

**Fixture policy, which every later stage inherits.** The demo household is two workers
answering two different questions. The first is seeded from the family's own sheets, so what
the application shows can be held against the tab it came from. The second carries the
*ordinary* terms and is the one every browser test works on — a test whose subject is unusual
tests the unusual case twice and the ordinary one never. **A browser test names the worker it
acts on and never takes whichever one is first.** August 2025 is the agent's fixture and never
a seed month: it is the only month whose totals come from the family's sheet.

## The design

Thirteen artboards sharing one design system, on the Claude Design canvas — project
`b11cf323-ac11-490d-994d-3145e8e07a6b`:
https://claude.ai/design/p/b11cf323-ac11-490d-994d-3145e8e07a6b

`דף הבית v4` is canonical, and the other twelve artboards are restyled to match it;
`v3 לוח במרכז`, `v2` and `v2 layout A` are superseded and kept so the layouts that were
weighed against each other can be looked at rather than described.

The canvas is the source for how a screen looks; this table says only which stage consumes
which artboard. Nothing of the design is copied here — the tokens are in
`src/app/globals.css` and the conventions in `CLAUDE.md`.

| Artboard | Consumed by |
|---|---|
| `דף הבית v4` | Stage 6 — on the engine since 2026-09-16; the blocker strip is still fixtures |
| `חישוב החודש`, `החודשים` | Stage 4 — `חישוב החודש` is the home screen since 2026-09-16 |
| `דף המשכורת` | Stages 2 + 4 |
| `העובדות`, `דף העובד`, `הוספת עובד` | Stage 3 |
| `תשלומים` | Stage 4 |
| `הגדרות` | Stages 3 + 5 |
| `דוחות` | Stage 2 |
| `התראות` | Stage 6 |
| `בחירת חגים` | Stage 5 |
| `לפני הייצוא` | Stage 5 |

Every stage that builds a screen carries two further **done when** clauses, because the
application is expected to be read through Chrome's translation and both failures are
silent: the screen holds no meaningful text inside an image, and translating it to English
throws no `NotFoundError` on `removeChild` and leaves the layout intact when translated back.

The design pass ran on 2026-09-05 and 2026-09-08 and is closed. `docs/design-pass-jobs-1-2.md`
is its record.

## The routes — what is still unanswered

`src/components/AppShell.tsx` links five tabs on every screen, so every one of them is a
promise made on every page. A link that 404s is worse than one that is not there, which is why
the bell is left out until `/alerts` exists and the "?" the home artboard draws beside it until
stage 9 (the user, 2026-09-13). Every address is built except these two:

| Route | Artboard | Owed by |
|---|---|---|
| `/alerts` | `התראות` | Stage 6 |
| `/help` | none — stage 9 draws it | Stage 9, which also puts the "?" back in the bar |

## What is still owed

Carried forward from finished steps. None of these is a defect.

- **`שעות עבודה נוספות במהלך אישפוז` has no engine line**, so template row 22 stays empty. It
  is named in Part 5 and nowhere else, and has no `lineKeys` entry, so it cannot be overridden
  or explained (items 17, 24) until it does.
- **Nothing warns that a third-party payment is due.** The `תשלומים` artboard's
  `ממתין לתשלום` and `לקראת החודשים הבאים` sections are a *reminder* view resting on item 15's
  yearly clock and item 28's document dates. Four of their six rows wait on the profile's
  three documents. **Stage 6's**, with the rest of the alert list.
- **`דף העובד` draws six things the profile does not**: the `צריך לטפל` hero card and the
  months' status badges (the month's four states, which nothing sets yet), the seniority in
  the subtitle, day counts on a month row, a month row linking to that month's payslip (the
  payslip takes no month), the `?` explaining each balance, and the closing links row.
  `העובדות` likewise draws a status chip and a `משותף/ת עם` chip per card.
- **`דף המשכורת` omits `להוסיף הערה לחודש`**, settled with the user on 2026-09-10: it needs a
  note on the month as a whole, and a note belongs to a mark or to a line the user added.
- **`סיכום שנתי` carries no yearly total row.** Item 29 asks for "that year's months with
  their totals", and a figure no criterion names is one nobody has checked. A line of code if
  it is wanted.
- **Four rest-day labels in the month template stay literal** — `C5`, `B23`, `F1` and `F3` —
  because the user chose Part 3's nine and not the thirteen the template holds (2026-09-10).
  So a Friday-resting worker's sheet says `ימי חמישי` in `A26` while `B23` above it still says
  `ימי שישי`. Reopening it is an edit to Part 3 and hers to ask for.
- **The sheet's identity line wording is unconfirmed.** `A4` prints `מספר דרכון: <number>`
  (`he.sheet.passportLine`); the template carries only `{{passport_line}}` and nothing states
  the words. `C2` (bank name and branch) and `A2` (employer of record) stay empty: no field
  holds either.
- **An invited person with no account cannot confirm one**, because Supabase's built-in mail
  reaches only the project's team. The user chose on 2026-09-15 to set up no custom SMTP and to
  invite only people who already have an account; SMTP in the Supabase dashboard is what
  reopens sign-up to anyone, and needs no code.
- **Signing up from an invitation link is not driven by the suite**, for that same mail; the
  link's screen and an existing account's acceptance are (`e2e/invitation.spec.ts`). The live
  isolation check cannot ask that an unconfirmed address accepts nothing — it has no session
  for one.
- **A person in two households puts what is new into the first they joined** — a worker they
  create, a fetched rate. Shared workers appear beside their own and are written back to their
  own household.
- **`household_members_insert` lets a member add any user to their household** without an
  invitation. It exposes nothing of the added person's, and tightening it now that invitations
  exist is the user's call.
- **The holiday picker's button still goes to the worker's page**, not back to `/settings`,
  which is where the picker is now reached from.
- **The live repository test "comes back exactly as she was saved" fails on a clean tree** —
  the profile read back has seventeen fields and the fixture sixteen. Measured 2026-09-13 with
  that day's changes stashed. Not investigated.
- **The seeded stores are still how the browser suite runs.** A request carrying the
  `household` cookie gets an in-memory household outside production (`src/lib/store.ts`), which
  is what keeps fourteen spec files working. There are three seeds now: the demo, the known
  case, and `empty`, which is the state a new account is in and the only one the add-worker
  flow can start from.
- **The home screen's blocker strip is three fixed cards** (`src/lib/fixtures/home.ts`), the
  same for every household, with placeholders where a date or a sum belongs. **Stage 6's**,
  with the action list.
- **A chosen holiday can be moved freely, and the user wants it to be a contract amendment.**
  The regulator's position is that the list is set at the start of the employment and does not
  change month to month; employer and worker may still agree to amend it. So the move becomes an
  explicit profile-level action with an effective date, regenerating only months after it and
  never a closed one, with the change kept as an audit trail. Today `moveHoliday` rewrites the
  date in place with no record. Asked for by the user on 2026-09-12 and not yet built.
- **Whether an unworked holiday should leave "ימי עבודה בפועל" is unsettled.** It does today
  (item 5), and her pay is unaffected either way, because the salary comes from the standard
  count. The user asked for the family's workbooks to settle it, and they cannot: the workbooks
  are not in this repository, and `workbook.fixture.ts`, which records them, says every holiday
  in those months was worked, so there is no unworked holiday to compare against.
- **`SalaryRepository` has no `deleteWorker`**, because nothing in the application removes one.
  The live check tidies up through the client instead.
- **The browser suite is intermittently flaky under load** — `payments-screen`,
  `before-export`, `month-screen` and `payslip` among them — and each passes when its own file
  is run alone. Measured on 2026-09-12 against a tree with the sign-in step stashed, so the cause is
  the dev server compiling routes under load and not the proxy.

## Stage 0 — Repo, scaffold, design system · **done**

`docs/plan-home-screen.md` is the description of how it was done.

## Stage 1 — The calculation engine · **done**

Plain TypeScript, no framework, no I/O. Vitest. Steps 7a–7d reopened the stage for the weekly
rest day (item 5), step 8 added the repository interface and `calculateSeries`, and step 9
settled that a sick spell ends on the first *working* day.

## Stage 2 — The export · **done**

ExcelJS in a server route, filling the committed templates. Four steps, all landed
2026-09-10: the month file and the two buttons that produce it, the rest-day wording made a
placeholder, `/reports` with the four files it offers, and `דף המשכורת` at `/month/payslip`.

The templates are committed data. `.gitignore` must never ignore `*.xlsx`: the application
still runs without them and only the export breaks, so the mistake surfaces on someone else's
clone rather than here.

## Stage 3 — Accounts and storage · **done**

Landed between 2026-09-10 and 2026-09-17. The live checks are run by hand, never by the suite:
`node --env-file=.env scripts/check-household-isolation.mjs`,
`scripts/check-one-address-one-account.mjs`, and
`npx vitest run --config vitest.live.config.ts` — run the first after any migration.

## Stage 4 — The month screen · **done**

Eleven steps, landed between 2026-09-03 and 2026-09-09: the screen on the store, the user's
own lines, the holiday as a state rather than a mark, the closing block, the additional
payments, the advances, `/payments`, the third-party payments and the seventh kind, the manual
overrides, the worker's profile at `/workers`, the browser verification of both screens, and
the part-day and the note on a sweep.

## Stage 5 — External data and yearly settings · **done**

`fetch` plus `node-html-parser`, server-side, cached in Postgres. Seven steps, landed between
2026-09-08 and 2026-09-09: the dated-rates table, the minimum-wage scrape with its effective
date and plausibility check, the holiday lists per source and year, the heading-segmented
cache, the holiday picker, the recuperation month and its entitlement, and the confirmation
questions that open an export.

**One thing was verified by hand and not by the suite.** Nothing in the application can
*open* a sick spell yet — `markRange` always writes an end, and the seed carries no open spell
because one would go on drawing days from the balance month after month. So the export block
and the question that closes it were checked once against a seed opened by hand on 2026-09-09,
and the seed was put back. A browser test lands with the gesture that opens a spell.

## Stage 6 — The opening screen

Same stack. The calendar, the figures and the balances run on the engine since 2026-09-16;
the action list is an engine function since 2026-09-17, and what remains is putting it on screen.
**The stage in progress.**

- The action list as an engine function (`src/lib/engine/actionList.ts`) — 2026-09-17.

**The next step is `/alerts`**, built from the `התראות` artboard. Then the steps below, each
a step of its own:

- **`/alerts`** — a new route under `src/app/alerts/`. For each worker in the household it
  replays `calculateSeries(months, profile, todayInIsrael(), rates)` and passes that with
  `listSpans` and `listRates` to `actionList`; every entry is phrased in `he.ts` from its
  `key` and fields (the engine returns data, never words), with its item-26 link. Both lists
  are shown, the bell's and the opening screen's (item 27).
- **The bell in the bar** — drawn in `AppShell.tsx` where its comment marks the place, linking
  `/alerts` and lit by the count of `warning` entries.
- **The home screen's blocker strip** — `HomeScreen.tsx` reads `homeAlerts` from
  `src/lib/fixtures/home.ts`, three fixed cards. It moves onto the `blockage` entries and the
  fixture file is deleted.
- **The `תשלומים` artboard's two reminder sections**, which are the same clock read from the
  payments screen.
- **The national-insurance tick**, with the months it covers. A quarter leaves the list when a
  recorded payment's `coversMonths` includes its last month.

Unfinished, carried by this stage:

- A month whose facts are incomplete, which item 27 names as a blockage, is not in
  `actionList` yet: nothing defines "incomplete" beyond what `blocksExport` already asks at
  export time.
- `supabase/migrations/20260917180000_an_export_is_not_a_correction.sql` is not applied to
  the live project. `npx supabase db push` is the user's to run; until then stamping
  `exported_at` also moves `updated_at`, so an exported month reads as corrected.
- Every month exported before 2026-09-17 has no `exported_at`, so the bell will list each of
  them as not exported until it is exported again or stamped by hand.
- A browser session carrying the `household` cookie works on the in-memory demo household
  (`src/lib/store.ts`), so an export made there stamps nothing in Supabase. Checking
  `exported_at` needs a signed-in account without that cookie.

**Done when** an account with nothing outstanding shows an opening screen whose action list is
empty.

## Stage 7 — Close what finished stages still owe

Every entry under "What is still owed" is paid, or is put to the user and settled, here. The
list is that section, and it is not copied into this stage.

**Done when** "What is still owed" is empty, or holds only what the user has chosen to leave
open.

- **Waiting on the user:** why the month sheet carries rows 32–38 (`נתוני דיווח נדרשים`, the
  six Wage Protection Act figures `writeReporting` fills in column C). Answered on 2026-09-17;
  the user will come back to whether they stay.

## Stage 8 — Clean the code

Run the installed review skills over the whole repository — `ponytail-audit`,
`simplify`, `code-review` and `mattpocock-skills:codebase-design` among them — and act on
what they find: duplicated logic, structure that has drifted, dead code and over-built
abstractions. Behaviour does not change in this stage, so every step ends with the full suite
passing unchanged.

**Done when** a fresh audit finds no duplicate worth removing and the checks of rule 7 pass.

## Stage 9 — The help screen, and a possible assistant on top of it

Where the "צריך/ה עזרה?" card goes. The design draws that card on every artboard and points it
nowhere.

**Part one — the help screen.** It holds no explanation of its own (item 24). It points at the
explanation, the reference link, or the screen that settles the question, so an answer stays
written in exactly one place.

- A registry of screens: each route, its Hebrew name, and what it is for. The sidebar reads
  the same list rather than keeping its own.
- Question matching written by hand, over the explanations, the reference list and the page
  text cached in stage 5.
- The panel: a question, an answer, and the link or screen it points at.

**Part two — a model. A potential feature, not a decision taken.** Only worth it if the
hand-written matching turns out too rigid once part one has been used. It would read the
question and the candidate list and never the account; the answer would still be assembled
locally, so no worker, amount or identity number leaves the application and the choice of
model stays cheap to change or to reverse. Two conditions come with it if it is ever built:
the prompts are source files, reviewed and versioned like any other code, because the
behaviour lives in their wording and an unreviewed edit to a sentence is a real fault with no
diff anyone reads; and a hard ceiling on calls per question, so a loop that goes wrong costs a
known amount. **Whether to build it at all, and which model, is a question to put to the user
at the very end — not before.**

**Done when** a question reaches the right screen or the right explanation and the answer names
its source, and part two can be dropped entirely without part one changing.

## Design ↔ spec reconciliation · **closed**

Eleven disagreements between the canvas and `specs.md`, found while building stage 0, and ten
gaps the other way. All settled between 2026-09-05 and 2026-09-08, each resolution written
into `specs.md` rather than here. Seven were settled *drop* and are deliberate absences rather
than things nobody got to: the accrued-severance card, PDF export, payment date and method,
the notification toggles, a separate `התראות` page, editable yearly entitlements, and
`לסיים העסקה`. `specs.md` and its future-features appendix are where each now stands.
