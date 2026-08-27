# build_plan.md — EaseSalary

The order in which the application is built, and what each stage is made of.

> **This file = *what to build next*.** It decides nothing about behavior — `specs.md`
> does that. If a stage and the spec disagree, the spec wins and this file is corrected.

The ordering principle: **reach a correct number as early as possible.** The August 2025
case can be checked by hand at the end of stage 2, before a database, a screen, or a
login exists. If the engine is right, the rest is assembly; if it is wrong, everything
built on top of it inherits the error.

## The design

Eleven artboards sharing one design system, on the Claude Design canvas — project
`b11cf323-ac11-490d-994d-3145e8e07a6b`:
https://claude.ai/design/p/b11cf323-ac11-490d-994d-3145e8e07a6b

The canvas is the source for how a screen looks; this table says only which stage
consumes which artboard. Nothing of the design is copied here — the tokens live in
`src/app/globals.css` and the conventions in `CLAUDE.md`, and a colour or an RTL rule
that appears in this file is in the wrong one.

| Artboard | Consumed by |
|---|---|
| `דף הבית v2` | Stage 6 — built in stage 0 against fixtures |
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

## Stage 0 — Repo, scaffold, design system · **done**

Outcomes only. `docs/plan-home-screen.md` is the description of how it was done.

- The repository initialised against the EaseSalary remote, with the three `.xlsx`
  templates and the six holiday lists committed under `data/`.
- Design tokens, the application shell and the shared components in `src/`.
- `src/lib/i18n/he.ts`, every Hebrew string in one file, and `src/lib/links.ts`, the
  single central list of kol-zchut references (item 25). It is referenced by nearly every
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

**Done when** the known case passes and the invalid case is refused, with no database and
no interface in existence.

## Stage 2 — The export

ExcelJS in a server route. One month template and one balances template.

- Load a template and fill it from the engine's output.
- Generate the closing block from the month's advance lines. Part 3 builds it from
  however many advances the month has, "rather than from a fixed set of variants", so
  `template_month_advance_given.xlsx` is kept as a reference sample of the shape and not
  as a second template to branch on.
- Placeholder tokens for identity and month fields.
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
- How item 13's cascade is served — a month corrected after export moves every later
  month's balances — is decided here: balances derived on read, or stored with an
  invalidation. Discovered in stage 6 it is a migration.
- The month's state carries item 21: a future month may be filled in but not exported
  until it has ended.
- The worker's opening position: balances already accrued and an advance part repaid.
- Row-level security for account isolation; the two-worker limit on creation.
- Sharing by invitation, and a shared worker not counting against the other person's limit.
- Encryption of passport and bank account numbers, key in an environment variable.
- Anything stage 7 stores is account-scoped under the same row-level security, and its
  context is assembled from the engine's output rather than from the worker row, so an
  identity number cannot reach it.

**Done when** a second account cannot reach the first account's worker by any crafted
request, and the identity columns are unreadable in the database.

## Stage 4 — The month screen

Next.js App Router, Tailwind right-to-left, Hebrew strings in one translations file.

- The calendar: Fridays and Saturdays derived, days marked for what departed.
- **Range entry.** A week's vacation is one gesture, not seven clicks, and the stored
  shape is a span either way. The entitlement rules for a swept range are already written
  and tested in `src/lib/spans.ts`; this stage puts the calendar's gesture on top of them.
- **A sick span crossing a month boundary cannot yet be created by gesture.** Such a span
  is stored whole, drawn clipped, and covered by tests, but `MonthCalendar` stops a sweep
  at the month edge — so the only way to enter one today is as two spans, which the
  statutory tiers then count from two first days and which therefore pays differently.
  This stage closes the gap: either a sweep that reaches the edge carries on into the next
  month, or the span takes an end date the user can set past it.
- The three groups beside it: additional payments, third-party payments, yearly settings.
- A free-text note on every action; manual override of any computed amount, shown as
  manual.
- A future month accepts facts and refuses export, saying which of the two it is.
- The live preview, driven by the same engine as the export.

**Done when** the August 2025 facts can be entered by marking days, and the preview shows
the same four totals the engine produced in stage 1.

## Stage 5 — External data and yearly settings

`fetch` plus an HTML parser, server-side, cached in Postgres.

- The minimum wage with its effective date, and the plausibility check.
- Holiday lists per country and year, with the shipped files as fallback. An **empty**
  cached list is a failed fetch and not a country without holidays — the shipped
  `UA-2026.json` is empty and its `source_url` points at country code `UK`, which is what
  that mistake looks like from the inside.
- The fetched page text is cached beside the figure extracted from it rather than
  discarded. Stage 7 answers out of that text, and a corpus thrown away here has to be
  scraped a second time.
- The holiday picker: the candidate list, the entitlement, part days, the remainder.
- The recuperation month and entitlement from seniority.
- The confirmation questions that open an export, which are what make stage 2's export
  reachable by a user at all.

**Done when** a year with no stored holiday list fills itself, and a failed fetch leaves
the user able to type the figure and continue.

## Stage 6 — The opening screen

Same stack. The screen was built in stage 0 against fixtures; this stage replaces the
fixtures with what the earlier stages produce and adds nothing to the layout.

- The action list: quarterly national insurance, expiring licence or medical insurance,
  an advance still being repaid, holidays not all chosen, recuperation due, a year with
  no vacation taken, a finished month not exported, a wage that changed, a worker
  crossing into a new seniority year.
- The current month's calendar, its totals and the balances beside that list (item 26).
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
choice of model stays cheap to change or to reverse. **Whether to build it at all, and
which model, is a question to put to the user at the very end — not before.**

**Done when** a question reaches the right screen or the right explanation and the answer
names its source, and part two can be dropped entirely without part one changing.

## Design ↔ spec reconciliation

Where the canvas and `specs.md` disagree, found while building stage 0. All of it is
recorded and **none of it is built**: anything below that ought to exist is a decision
only the user can take, and it goes into `specs.md` before it becomes code.

**In the canvas, not in the spec.** An accrued-severance card on `דף העובד` (Part 1 puts
severance out of scope) · a PDF export on `דף המשכורת` (the spec exports `.xlsx` only) ·
a payment date, a payment method and "mark as paid" for the salary itself · notification
toggles in `הגדרות` · "להוריד את כל הנתונים" · editable "ימי חופשה בשנה" and
"ימי מחלה בשנה" (items 7–8 derive both, and the user never enters a rate) · a
configurable weekly rest day (item 5 fixes it at Saturday for every worker) · a
"היתר העסקה" number · a separate `התראות` page and bell (item 26 puts the actions on the
opening screen) · "לסיים העסקה" (the appendix puts ending an employment out of scope for
v1).

**In the spec, missing from the canvas.** The two day counts, standard and actual (items
2 and 5, a Wage Protection Act requirement) · minimum-wage confirmation before every
export (item 4) · the pre-export confirmation questions (item 18 — the wizard's third
step is a read-only summary, not questions) · part-days for vacation and holiday (items 7
and 10 — the calendar mark is binary) · the third-party payments group (items 5 and 16 —
column H, never inside the worker's total) · the holiday picker (item 10 — the home
screen links to it, but no artboard exists) · a sick spell crossing a month boundary
(item 8) · an override shown as manual (item 17) · a note on every action (item 5) · a
future month filled but not exportable (item 21).
