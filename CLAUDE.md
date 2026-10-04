# CLAUDE.md — EaseSalary

How to build. Loaded into every session, so **a new rule arrives with a deletion** — a paragraph kept here is charged to every future session. How a rule came to be is in git, never here.

> **`specs.md` = *what* to build**, and it wins on any conflict. **`DESIGN.md` = *how it looks***. Both are read on demand, never auto-loaded — see **Where to read**.

## What this is
A Hebrew web application for families employing a live-in foreign caregiver. Each account holds up to two worker profiles. The user marks on a calendar what departed from an ordinary month, and at month's end exports one monthly salary sheet in the structure of the family's existing Excel workbook, with vacation and sick balances carried automatically.

**Why it exists:** the calculation is already solved in Excel, but it demands spreadsheet skill and legal upkeep the employing family does not have. Every rule, rate, and formula belongs in the application, not in the user's head. When an unwritten decision comes up, choose the option that requires the user to know less.

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript, one deployable. `npx next typegen` must run before `tsc --noEmit`, or the generated `LayoutProps` type is undefined and a fresh clone fails typecheck having changed nothing. Read the matching guide in `node_modules/next/dist/docs/` before writing framework code — this version's APIs differ from the trained-on ones |
| Calculation | Plain TypeScript modules, framework-agnostic and unit-testable |
| Data | Supabase — Postgres + Auth, row-level security for account isolation. **The schema is a series of `.sql` files in `supabase/migrations/`, never a change made in the dashboard**: a table altered by hand exists in one project and in no clone, so the next environment is built from a schema nobody wrote down. `npx supabase db push` applies what is unapplied, `npx supabase migration list` says what is live |
| Interface | Tailwind CSS, right-to-left, Hebrew strings in one translations file |
| Export | ExcelJS on the server, filling the stored .xlsx templates. Those templates are **committed on purpose**, and they are the only spreadsheets that may be: `.gitignore` ignores every `*.xlsx` except `data/templates/template_*.xlsx`, and `hooks/pre-commit` refuses any other spreadsheet even when force-added. **Never widen that exception** — the family's own workbooks carry passport and bank numbers, and a pushed file cannot be taken back |
| External data | `fetch` + `node-html-parser`, results cached in Postgres. Every scrape is a pure function over an HTML **string** with the request injected, so the suite reads saved pages and never the network (`specs.md` Part 4) |
| Deploy | Vercel; the encryption key and Supabase keys are env vars, never in the repo |
| Design | The canvas is read through the `claude_design` MCP server, registered in the committed `.mcp.json`. Run `/design-login` **once per clone**, or the canvas URL is an address the session cannot open |
| Tests | Vitest — the calculation engine, the export filler, the scrapers' parsing — plus browser verification of the important user-facing flows (rules 10–13) |

## Working rules
1. **Spec first, and never change the spec without approval.** Read `specs.md` before changing code; where code and spec disagree, the spec holds. A spec that looks wrong, stale, ambiguous or too thin is reported — never edited, and never patched around in code: say so, and wait. An agent free to edit the source of truth can settle any disagreement by rewriting what it was going to be judged against, unseen in a file this long. **Every write to `specs.md` — adding, rewording, or deleting — is put to the user first, as its own question, with the exact wording quoted, and is made only after a direct yes to that question.** Not silence, not approval of the code or the behavior, not "sounds good" about the work in general, not a yes given to a different addition a moment earlier; anything short of a plain yes to that wording leaves the spec exactly as it is and the disagreement reported. Ask before writing rather than writing and offering to revert — an edit already in the file is an edit approved by default. A stale cross-reference or a typo is corrected without asking; anything that changes what the application does or must prove is not. Keep `specs.md` general: no private file name, tab or cell belongs in it, Part 4's August 2025 case excepted, because its four totals are the only figures a test may measure the engine against.
2. **Ask when unclear.** Stop and ask me one focused question before guessing, never guess and carry on. Salary rules and entitlements are asked in Hebrew; technical questions in English.
   **A new feature or a setup change starts with a PRD, always.** Before any code, config or migration for something `specs.md` and `build_plan.md` do not already describe, draft a short PRD in the reply: the problem and why it matters now; success criteria; scope, in and explicitly out; constraints, dependencies and edge cases; open questions. **With it comes an implementation plan:** the steps in order, each with the files, routes and migrations it touches, the tests it adds and where their expected figures come from (rule 11), and the check the user runs at its end (rule 8). Show both and wait for an explicit sign-off on both — a request that sounded clear is where a wrong reading goes unnoticed. If asked to skip it, push back once, then write a lightweight one; never skip the questions. The PRD itself is not kept as a file: once approved, what it settled goes into `specs.md` under rule 1 and its steps into `build_plan.md`. A fix, or a step `build_plan.md` already names, needs no PRD.
3. **Write approved decisions down where they belong** — `specs.md` (what), `DESIGN.md` (how it looks), `CLAUDE.md` (how to build) — in the same step as the code. A rule whose reason is not self-evident carries its reason in the same sentence. **A new decision replaces the old wording outright; these files describe only what stands now.** How a rule came to be what it is belongs in the commit message, not in a file somebody has to read past it.
4. **Invent nothing on your own — neither product behavior nor process.** Never add a feature, field, workflow, calculation, validation, or user-facing behavior because it seems useful or conventional — and never a build step, file, script, convention or tool either. It must rest on `specs.md`, on the artboard the step named, on a step `build_plan.md` names, or on an explicit decision by the user. Where those disagree or leave a real gap, ask — a plausible invention is the hardest kind of wrong answer to find later, because nothing about it looks like a mistake.
5. **Keep data-only files free of prose.** Rules and explanations live in `specs.md`; the templates and holiday lists hold data and nothing else.
6. **Cite the workbooks precisely, and everywhere except `specs.md`.** Name the workbook, the tab, and the cell — never a bare row number, since row numbering differs between years. Such a citation belongs in a test or in a commit message, where it records where a figure was checked — not in `build_plan.md`, which holds no record of finished work (rule 9); `specs.md` states the rule instead (rule 1).
7. **The mechanical checks are not yours to judge.** `npx next typegen && npx tsc --noEmit`, `npm run lint` and `npm test` all pass before anything is committed, and `hooks/pre-commit` refuses the commit when they don't. A key that reaches history is replaced, not deleted: it stays in every clone for the life of the repository. Never commit with `--no-verify`, and never turn a lint rule off without writing the reason beside it — a rule switched off silently is indistinguishable from a rule that was never needed.
8. **Every stage ends with a check the user runs.** The stage order and its scope come from `build_plan.md`. Before committing a stage, write down what to open, type or click to confirm it works and what a failure looks like — the agent verifying its own work only proves the code does what the agent thought, which is the half already known. Nothing is pushed until the user confirms. **Put that check in the message to the user and in the commit, never into `build_plan.md`** — see rule 9.
9. **`build_plan.md` holds only what is not built yet.** It is read whole by every session that asks what to build next, so a paragraph about finished work is charged to every future session. **A step that lands is compressed to one line the same day** — its name, its date, nothing else. What it found, what its tests would catch and the check the user ran belong in the code, the tests, `specs.md` or the commit message, each read by whoever needs it rather than by everyone. The one thing that survives a finished step is what it left **unfinished**, which moves to the file's "What is still owed" section or into the stage that will pay it. **It is not in the repository** — it changes by the hour and means nothing outside the working copy it is kept in. So a fresh clone has no work list at all: a session that does not find the file asks the user what to build next, and never invents a step or writes a replacement from what the code appears to owe.
10. **Test the important flows through the real browser, and verify results rather than interactions.** `specs.md` Part 4's "Verifying through the browser" is the whole rule and is read before writing one; what follows is only what it does not say. Never reach past the interface to call the functions underneath — a page that loaded, a button that clicked and a file that appeared prove nothing on their own. `data-row` on a drawn row is the suite's handle on one figure, by what it is rather than by the Hebrew beside it.
11. **Every expected figure comes from outside the code under test**, never from what the implementation returned — a test written by reading the code under it records whatever that code produced, so the suite proves only that the engine agrees with itself, passes in full, and fails the day someone corrects the bug. Part 4 names the sources a figure may come from and lists the edge cases; **cover them where they bear on the change, not every edge case for every unrelated change.** August 2025's four totals come from the family's own sheet; the accrual, the ninety-day ceiling and the derived rates have no such figure, so those are derived on paper first, or tested before the component exists.
12. **Preview and export must agree.** They are one calculation path shown twice, so when a change touches a calculated or an exported value, drive both from a single engine result and assert they say the same thing.
13. **Report what was actually verified** — the scenario, the data used, the expected result, the actual result, and what incorrect behaviour the test would catch, the last of which is what separates a test from a demonstration. Part 4 settles where screenshots belong; they supplement an assertion and never replace one.

## Non-negotiables
These bear on any change, so they hold in a session that never opens `specs.md`. On any conflict,
`specs.md` wins.

- No rate is ever hardcoded. Derive from the worker's base monthly salary, which defaults to the confirmed minimum wage and may not be set below it. (items 3 and 4)
- The user never enters a rate or a formula — only facts about the month, and the confirmations the workflow puts to them, such as the minimum wage and the recuperation rate. (Part 1; items 5 and 15)
- Money is integer agorot in code, two decimals on display, rounded to the nearest agora. (item 3)
- Any computed amount can be overridden; an override is marked manual and is never silently recalculated away. (item 17)
- Balances are never stored. They are derived by replaying the worker's months from the opening position, which is what makes a correction to a past month move every later month for free. (items 7 and 13)

Binding equally, stated in full at the item cited, and read before working in that area:

| Area rule | Stated at |
|---|---|
| the minimum wage is confirmed before every export, and a month is valued at the rate in force during it | item 4; Part 3 |
| the export keeps the structure of the 2026 workbook's month tab | item 2; Part 3 |
| income tax **is** calculated; **how** is a term of the employment, snapshotted onto a month when it is confirmed, overridable for one month; pension and severance out of scope, their row empty for layout only | item 17; Part 1 |
| holiday lists are fetched per country and per year and cached; no year is ever hardcoded, and the shipped files are seed data | items 10 and 12; Part 3 |
| passport, bank account, employment permit and work visa numbers are encrypted at rest and never logged; their **expiry dates are not** | items 22 and 28; Part 3 |
| the weekly rest day is a term of the employment, not Saturday — Friday, Saturday or Sunday per worker, read off the month rather than the profile. **Anything that once counted Saturdays counts rest days** | item 5; Part 3 |

## Where to read
`specs.md` is long and is read a part at a time, never whole. Locate the part with
`grep -n '^## Part' specs.md`, then read between that line and the next heading — the
anchors below are the literal headings, so they are what you are grepping for.

| Working on | Read |
|---|---|
| what the app is for, scope, what is deliberately excluded | `## Part 1 — Goal and reason` |
| **what the application does** — every rule, entitlement and screen behaviour, as 31 numbered items — and what "done" means | `## Part 2 — Testable success criteria`, **via the index at its head** |
| server/client boundary, storage, templates, external data | `## Part 3 — Architectural guidance` |
| the August 2025 known case, the invalid case, what a test has to prove | `## Part 4 — Validation approach` |
| rates, rounding, column meanings, date counting, layout traps | `## Part 5 — Known pitfalls` |
| what is deliberately deferred, so it is not rediscovered as a bug | `## Appendix — future features` |
| the look of a screen — layout, palette, type, spacing, components, and every departure from the canvas | `DESIGN.md`, then that screen's own Part 2 item |
| **any component, page or user-facing string** — direction, `<bdi>`, gender, Chrome's translator | `docs/agents/rtl.md` |
| what to build next, in what order, with what | `build_plan.md`, which is local and untracked (rule 9) and is absent in a fresh clone |

Part 2's criteria are numbered and are cited by number throughout both files; find one with
`grep -n '^[0-9]\+\. ' specs.md` rather than by scrolling. **Items 1–31 are all in Part 2 and
nowhere else** — Parts 1 and 3–5 carry no numbered items — so "item 13" always means Part 2's,
and a citation reading "Part 3, item 13" means item 13 *and* Part 3, not an item inside Part 3. **Part 2 is 72% of `specs.md`, so it
is read one item at a time and never whole**: the index at its head says which item settles what,
and only that item is then read. Reading the part entire to answer a question about one item
charges a session seventeen thousand words for two thousand.

## Agent skills
Installed skills assume files this repo does not have. These two hold the mapping, where those
skills' own convention looks for it.

- **Domain docs:** `specs.md` is this repo's glossary and domain model; there is no `CONTEXT.md` and no `docs/adr/`. See `docs/agents/domain.md`.
- **Issue tracker:** none — `build_plan.md` is the work list and the stage order, and it is untracked (rule 9), so a clone that does not have it has no work list. See `docs/agents/issue-tracker.md`.

## Code conventions
- Code, comments, commit messages, and identifiers in English; every user-facing string Hebrew, in one translations file. Writing one: `docs/agents/rtl.md`.
- **A comment says the rule in force and why, never the history of how it got there.** "This was X until <date>, and it passed, because…" is a commit message. What survives in the file is the sentence a reader needs in order to change the code correctly.
- Never floating-point shekels. Carry full precision through a calculation and round only at the end, never between steps.
- Build dates outside a local time zone; a daylight-saving boundary must not change how many rest days a month has.
- Nothing reads the clock during a render. Today is passed in as a prop, or the server and the browser disagree and the page throws a hydration mismatch on a date.
- The calculation engine is pure functions over a worker's months — a series, not a single month, because balances carry forward and are replayed rather than stored. It is callable without a server.
- Nothing in the engine reads a clock. A finished month clips an open sick spell at its own last day; only the current month's preview clips at a `today` passed in by its caller.
- **The canvas is read for every screen but implemented one artboard at a time**: the step names the artboard it builds, and the rest are context rather than licence to build them — a session that implements an artboard its step did not name has skipped the check that step was going to end with (rule 8). A step that names none is reading only. **Where the code already departs from an artboard on purpose, the departure is written down in `DESIGN.md` and the artboard is not silently obeyed** — "code moves to the artboard" holds for a screen being built, and does not license undoing a decision already taken against the built screen.
- Calculation code carries tests; interface code need not — except a test that two things *agree*, which belongs beside neither of them and would otherwise never be written. Rule 12's preview-and-export test is that case, and it lives with the calculation suite.
