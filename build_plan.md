# build_plan.md — EaseSalary

The order in which the application is built, and what each stage is made of.

> **This file = *what to build next*.** It decides nothing about behavior — `specs.md`
> does that. If a stage and the spec disagree, the spec wins and this file is corrected.

The ordering principle: **reach a correct number as early as possible.** The August 2025
case can be checked by hand at the end of stage 2, before a database, a screen, or a
login exists. If the engine is right, the rest is assembly; if it is wrong, everything
built on top of it inherits the error.

## Stage 1 — The calculation engine

Plain TypeScript, no framework, no I/O. Vitest.

- Types for a month's facts: the marked days, the worker's terms, the confirmed wage.
- Calendar arithmetic: days in the month, its Fridays, its Saturdays, working days.
- Rate derivation from the base monthly salary, including the 25-hour rest-day rate.
- The month's components: base, Friday supplement, Saturdays, holidays, sick pay,
  vacation, one-off payments, third-party payments.
- Advances: numbered, several at once, granted and repaid.
- Balances: vacation and sick accrual, carry-forward, the ninety-day ceiling.
- The August 2025 test, matching four totals to the agora.

**Done when** the known case passes and the invalid case is refused, with no database and
no interface in existence.

## Stage 2 — The export

ExcelJS in a server route. The three stored templates.

- Load a template and fill it from the engine's output.
- Generate the closing block from the month's advance lines.
- Placeholder tokens for identity and month fields.
- The yearly balances export as its own file.

**Done when** an exported file for August 2025 can be opened beside the family's own
sheet and read as the same document.

## Stage 3 — Accounts and storage

Supabase: Postgres, Auth, row-level security.

- Schema: account, worker, month, day marks, advances, third-party payments, overrides,
  confirmed wages, cached holiday lists.
- The worker's opening position: balances already accrued and an advance part repaid.
- Row-level security for account isolation; the two-worker limit on creation.
- Sharing by invitation, and a shared worker not counting against the other person's limit.
- Encryption of passport and bank account numbers, key in an environment variable.

**Done when** a second account cannot reach the first account's worker by any crafted
request, and the identity columns are unreadable in the database.

## Stage 4 — The month screen

Next.js App Router, Tailwind right-to-left, Hebrew strings in one translations file.

- The calendar: Fridays and Saturdays derived, days marked for what departed.
- The three groups beside it: additional payments, third-party payments, yearly settings.
- A free-text note on every action; manual override of any computed amount.
- The live preview, driven by the same engine as the export.

**Done when** the August 2025 facts can be entered by marking days, and the preview shows
the same four totals the engine produced in stage 1.

## Stage 5 — External data and yearly settings

`fetch` plus an HTML parser, server-side, cached in Postgres.

- The minimum wage with its effective date, and the plausibility check.
- Holiday lists per country and year, with the shipped files as fallback.
- The holiday picker: the candidate list, the entitlement, part days, the remainder.
- The recuperation month and entitlement from seniority.
- The confirmation questions that open an export.

**Done when** a year with no stored holiday list fills itself, and a failed fetch leaves
the user able to type the figure and continue.

## Stage 6 — The opening screen

Same stack. Nothing new; it reads what the earlier stages produce.

- The action list: quarterly national insurance, expiring licence or medical insurance,
  an advance still being repaid, holidays not all chosen, recuperation due, a year with
  no vacation taken, a finished month not exported, a wage that changed, a worker
  crossing into a new seniority year.
- The national-insurance tick, with the months it covers.

**Done when** an account with nothing outstanding shows an empty opening screen.
