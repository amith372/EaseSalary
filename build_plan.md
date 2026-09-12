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

`דף הבית v3 לוח במרכז` is canonical; `v2` and `v2 layout A` are superseded and kept so the
layouts that were weighed against each other can be looked at rather than described.

The canvas is the source for how a screen looks; this table says only which stage consumes
which artboard. Nothing of the design is copied here — the tokens are in
`src/app/globals.css` and the conventions in `CLAUDE.md`.

| Artboard | Consumed by |
|---|---|
| `דף הבית v3 לוח במרכז` | Stage 6 — built in stage 0 against fixtures |
| `חישוב החודש`, `החודשים` | Stage 4 |
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

`src/components/AppShell.tsx` links five tabs plus the "?" and the bell on every screen, so
every one of them is a promise made on every page. A tab that 404s is worse than a tab that
is not there. Every address is built except these three:

| Route | Artboard | Owed by |
|---|---|---|
| `/settings` | `הגדרות` | Stage 3's yearly settings. The holiday picker already answers at `/settings/holidays`, reached from the worker's profile until `/settings` exists |
| `/alerts` | `התראות` | Stage 6 |
| `/help` | none — stage 7 draws it | Stage 7 |

## What is still owed

Carried forward from finished steps. None of these is a defect.

- **The profile cannot set a *standing* line** (item 20's lifetime choice). A standing line is
  a term of the employment, so it cannot be offered on a month's screen at all — only one-off
  lines belong to a month. `overridable: prefix === "standing"` therefore has one reachable
  value today. **Stage 3's**, with the rest of the profile's terms.
- **A salary field on the profile is not built**, which is why a raise is entered on the
  pre-export screen. `הגדרות` is stage 3's.
- **`שעות עבודה נוספות במהלך אישפוז` has no engine line**, so template row 22 stays empty. It
  is named in Part 5 and nowhere else, and has no `lineKeys` entry, so it cannot be overridden
  or explained (items 17, 24) until it does.
- **Nothing warns that a third-party payment is due.** The `תשלומים` artboard's
  `ממתין לתשלום` and `לקראת החודשים הבאים` sections are a *reminder* view resting on item 15's
  yearly clock and item 28's document dates. Four of their six rows wait on the profile's
  three documents. **Stage 6's**, with the rest of the alert list.
- **The advances section departs from its artboard**: the drawing has a progress bar and the
  date an advance was given; the screen has the same three figures in words.
- **`דף המשכורת` omits `אושר ב[תאריך]` and `להוסיף הערה לחודש`**, both settled with the user on
  2026-09-10. The first needs a confirmation timestamp the application does not store and can
  be built when stage 3 holds real storage; the second needs a note on the month as a whole,
  and a note belongs to a mark or to a line the user added.
- **`סיכום שנתי` carries no yearly total row.** Item 29 asks for "that year's months with
  their totals", and a figure no criterion names is one nobody has checked. A line of code if
  it is wanted.
- **Four rest-day labels in the month template stay literal** — `C5`, `B23`, `F1` and `F3` —
  because the user chose Part 3's nine and not the thirteen the template holds (2026-09-10).
  So a Friday-resting worker's sheet says `ימי חמישי` in `A26` while `B23` above it still says
  `ימי שישי`. Reopening it is an edit to Part 3 and hers to ask for.
- **`הוספת עובד` draws no shell at all** — a wizard chrome with no nav, which is the right
  shape for an add-flow but is a decision nothing in this plan sanctions, since `AppShell`
  wraps every route. It needs an answer from `AppShell`'s side before stage 3 builds it.
- **Six artboards draw the top bar without the worker switcher and without the greeting** —
  `דוחות`, `דף העובד`, `הגדרות`, `העובדות`, `התראות` and `תשלומים`. Transcription onto the
  canvas, owed by whichever stage next builds one of them.
- **The browser suite is intermittently flaky under six workers** — `payments-screen`,
  `before-export` and `month-screen` among them — and each passes when its own file is run
  alone. Measured on 2026-09-12 against a tree with the sign-in step stashed, so the cause is
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

## Stage 3 — Accounts and storage

Supabase: Postgres, Auth, row-level security. **The stage in progress.**

- Schema: account, worker, month, **day spans**, advances, third-party payments, overrides,
  confirmed wages, cached holiday lists. Spans rather than per-day rows, and a sick span may
  run past the end of the month it started in.
- **The month's term snapshot is a schema requirement, not an engine detail.** Part 3 has the
  month storing the terms it was confirmed with — rest day, rest-eve supplement, recuperation
  month — beside the confirmed wage. Stage 1 built the shape; this stage persists it.
  Discovered in stage 6 it is a migration.
- **Facts only, never balances.** Item 13's cascade is decided: the engine replays a worker's
  months from the opening position, so a corrected month moves every later month by
  construction and there is nothing to invalidate. Twenty years replays in 37ms. If a cache is
  ever wanted it goes in front of the replay, where deleting it is safe.
- The month's state carries item 21: a future month may be filled in but not exported until it
  has ended.
- The worker's opening position: balances already accrued and an advance part repaid.
- Row-level security for account isolation; the two-worker limit on creation.
- Sharing by invitation, and a shared worker not counting against the other person's limit.
- Encryption of the four identifying numbers, key in an environment variable. Their expiry
  dates are not encrypted — the warnings query them.
- The profile's remaining terms: the standing line and the salary field, both listed under
  "What is still owed".
- `/settings` — the last of the shell's 404s this stage owns.
- Anything stage 7 stores is account-scoped under the same row-level security, and its context
  is assembled from the engine's output rather than from the worker row, so an identity number
  cannot reach it.

Roughly five tickets' worth, and the largest stage in the plan: nine entities, the household
model of item 11 with its many-to-many membership and a two-worker limit that must not count a
shared worker, row-level security whose "done when" is an adversarial property, and encryption
across four fields.

**Landed so far:** the income tax calculated, with `gender` and the three tax modes on the
profile (2026-09-11); the sign-in at `/sign-in`, the household created on first sign-in, and
one person is one address (2026-09-12).

**Two things the stage's own tooling rests on.** The household isolation is checked against
the live database by hand with `node --env-file=.env scripts/check-household-isolation.mjs`,
never by the suite, which reads saved files and never the network (Part 4); it talks to
PostgREST with the **publishable** key exactly as a browser would, because the service-role key
bypasses row-level security and would prove nothing. The sub-address rule is checked the same
way, with `scripts/check-one-address-one-account.mjs`, because signing up sends mail that
Supabase delivers only to the project's team and only twice an hour.

**Run `/security-review` before this stage is committed**, and nowhere earlier — it is the only
stage that introduces an authorisation boundary, encryption at rest, and data reachable by a
request the user did not make. The agent that wrote the policies is the worst placed to attack
them.

**Done when** a second household cannot reach the first household's worker by any crafted
request, and the identity columns are unreadable in the database.

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

Same stack. The screen was built in stage 0 against fixtures; this stage replaces the fixtures
with what the earlier stages produce and adds nothing to the layout.

- **`/alerts` is this stage's address.** The bell links `התראות` from every screen and it
  404s. The action list below is its content at full length: the home screen shows the list and
  the bell is what lights (item 27), so the two are one thing built once.
- The action list: quarterly national insurance, expiring licence or medical insurance, an
  advance still being repaid, holidays not all chosen, recuperation due, a year with no
  vacation taken, a finished month not exported, a wage that changed, a worker crossing into a
  new seniority year.
- The `תשלומים` artboard's two reminder sections, which are the same clock read from the
  payments screen.
- The current month's calendar, its totals and the balances beside that list (item 27).
- The national-insurance tick, with the months it covers.

**Done when** an account with nothing outstanding shows an opening screen whose action list is
empty.

## Stage 7 — The help screen, and a possible assistant on top of it

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
