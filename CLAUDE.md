# CLAUDE.md — EaseSalary

Standing instructions for the coding agent in this repo. This is the only file loaded into *every* session, so it stays short.

> **This file = *how* to build.** **`specs.md` = *what* to build** — five prose parts, read on demand, never auto-loaded. It is the source of truth for behavior and wins if the two disagree.

## What this is
A Hebrew web application for families employing a live-in foreign caregiver. Each account holds up to two worker profiles. The user marks on a calendar what departed from an ordinary month, and at month's end exports one monthly salary sheet in the structure of the family's existing Excel workbook, with vacation and sick balances carried automatically.

**Why it exists:** the calculation is already solved in Excel, but it demands spreadsheet skill and legal upkeep the employing family does not have. Every rule, rate, and formula belongs in the application, not in the user's head. When an unwritten decision comes up, choose the option that requires the user to know less.

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript, one deployable |
| Calculation | Plain TypeScript modules, framework-agnostic and unit-testable |
| Data | Supabase — Postgres + Auth, row-level security for account isolation |
| Interface | Tailwind CSS, right-to-left, Hebrew strings in one translations file |
| Export | ExcelJS on the server, filling the stored .xlsx templates |
| External data | `fetch` + an HTML parser, results cached in Postgres |
| Deploy | Vercel; the encryption key and Supabase keys are env vars, never in the repo |
| Tests | Vitest — the calculation engine, the export filler, the scrapers' parsing |

## Working rules
1. **Spec first.** Fix `specs.md` before you fix code; never patch code around a stale spec. Judge quality by the spec, not the code.
2. **Ask when unclear.** If a requirement is ambiguous or you are about to guess, stop and ask one focused question before coding. Questions about salary rules and entitlements are asked in Hebrew; technical questions in English.
3. **Write the decision down where it belongs.** When something changes behavior, edit whichever file holds it — `specs.md` (what) or `CLAUDE.md` (how) — in the same step as the code. A rule whose reason is not self-evident carries its reason in the same sentence. When a new decision supersedes an old one, replace the old wording outright; the files describe only what stands now.
4. **Keep data-only files free of prose.** Rules and explanations live in `specs.md`; the templates and holiday lists hold data and nothing else.
5. **Cite the workbooks precisely.** Name the workbook, the tab, and the cell — never a bare row number, since row numbering differs between years.
6. **Don't drift from the non-negotiables below.**

## Non-negotiables
Duplicated here on purpose, so they still hold in a session that never opens `specs.md`. On any conflict, `specs.md` wins.

- No rate is ever hardcoded. Derive from the worker's base monthly salary, which defaults to the confirmed minimum wage and may not be set below it. (Part 2)
- The minimum wage is confirmed by the user before every export, and a month is valued at the rate in force during it. (Parts 2–3)
- The user never enters a rate or a formula — only facts about the month. (Parts 1–2)
- The export keeps the structure of the 2026 workbook's month tab. (Parts 2–3)
- Income tax is never calculated: the line defaults to zero and is user-editable. Pension and severance are out of scope, their row empty for layout only. (Part 1)
- Any computed amount can be overridden; an override is marked manual and is never silently recalculated away. (Part 2)
- Holiday lists are fetched per country and per year and cached. No year is ever hardcoded; the shipped files are seed data. (Parts 2–3)
- Passport and bank account numbers are encrypted at rest with a key held outside the database, decrypted server-side only for display and export, and never logged. (Part 3)
- Money is integer agorot in code, two decimals on display, rounded to the nearest agora. (Part 2)

## Where to read
| Working on | Read |
|---|---|
| what the app is for, scope, what is deliberately excluded | `specs.md` Part 1 |
| what "done" means, anything test-shaped | Part 2 |
| server/client boundary, storage, templates, external data | Part 3 |
| the August 2025 known case and the invalid case | Part 4 |
| rates, rounding, column meanings, date counting, layout traps | Part 5 |
| what to build next, in what order, with what | `build_plan.md` |

## Code conventions
- Code, comments, commit messages, and identifiers in English; every user-facing string Hebrew, in one translations file.
- Money is held as integer agorot and converted only for display and export. Never floating-point shekels. Carry full precision through a calculation and round only at the end, never between steps.
- Right-to-left throughout: logical properties only (`ms`/`me`/`ps`/`pe`, `text-start`/`text-end`), never `left`/`right`; `lang="he"` and `dir="rtl"` on the document; directional icons mirrored.
- Isolate mixed-script content — numbers, dates, ranges, passport numbers, names written in two scripts — with `<bdi>` or `unicode-bidi: isolate`. Numeric inputs stay `dir="ltr"` inside.
- Build dates outside a local time zone; a daylight-saving boundary must not change how many Saturdays a month has.
- The calculation engine is pure functions over a month's facts, callable without a server, and one engine serves both the on-screen preview and the export.
- Calculation code carries tests; interface code need not.
