# CLAUDE.md — EaseSalary

Standing instructions for the coding agent in this repo. This is the only file loaded into *every* session, so it stays short.

> **This file = *how* to build.** **`specs.md` = *what* to build** — five prose parts, read on demand, never auto-loaded. It is the source of truth for behavior and wins if the two disagree.

## What this is
A Hebrew web application for families employing a live-in foreign caregiver. Each account holds up to two worker profiles. The user marks on a calendar what departed from an ordinary month, and at month's end exports one monthly salary sheet in the structure of the family's existing Excel workbook, with vacation and sick balances carried automatically.

**Why it exists:** the calculation is already solved in Excel, but it demands spreadsheet skill and legal upkeep the employing family does not have. Every rule, rate, and formula belongs in the application, not in the user's head. When an unwritten decision comes up, choose the option that requires the user to know less.

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript, one deployable. `npx next typegen` must run before `tsc --noEmit`, or the generated `LayoutProps` type is undefined and a fresh clone fails typecheck having changed nothing. This version's APIs differ from what a model was trained on — read the matching guide in `node_modules/next/dist/docs/` before writing framework code. `next dev` appends a managed block to this file saying so; `agentRules: false` in `next.config.ts` turns that off, so the file stays hand-written and a Next upgrade cannot rewrite it inside an unrelated diff |
| Calculation | Plain TypeScript modules, framework-agnostic and unit-testable |
| Data | Supabase — Postgres + Auth, row-level security for account isolation |
| Interface | Tailwind CSS, right-to-left, Hebrew strings in one translations file |
| Export | ExcelJS on the server, filling the stored .xlsx templates. Those templates are **committed on purpose** — `.gitignore` must never ignore `*.xlsx`. Without them the app still runs and only the export breaks, so the mistake surfaces on someone else's clone rather than here |
| External data | `fetch` + an HTML parser, results cached in Postgres |
| Deploy | Vercel; the encryption key and Supabase keys are env vars, never in the repo |
| Design | The canvas is read through the `claude_design` MCP server, registered in the committed `.mcp.json`. Run `/design-login` **once per clone** — without it the canvas URL is an address the session cannot open, and the screens get rebuilt from prose descriptions instead of from the design |
| Tests | Vitest — the calculation engine, the export filler, the scrapers' parsing |

## Working rules
1. **Spec first.** Fix `specs.md` before you fix code; never patch code around a stale spec. Judge quality by the spec, not the code.
2. **Ask when unclear.** If a requirement is ambiguous or you are about to guess, stop and ask one focused question before coding. Questions about salary rules and entitlements are asked in Hebrew; technical questions in English.
3. **Write the decision down where it belongs.** When something changes behavior, edit whichever file holds it — `specs.md` (what) or `CLAUDE.md` (how) — in the same step as the code. A rule whose reason is not self-evident carries its reason in the same sentence. When a new decision supersedes an old one, replace the old wording outright; the files describe only what stands now.
4. **Keep data-only files free of prose.** Rules and explanations live in `specs.md`; the templates and holiday lists hold data and nothing else.
5. **Cite the workbooks precisely.** Name the workbook, the tab, and the cell — never a bare row number, since row numbering differs between years.
6. **The mechanical checks are not yours to judge.** `npx next typegen && npx tsc --noEmit`, `npm run lint` and `npm test` all pass before anything is committed, and `hooks/pre-commit` refuses the commit when they don't — a rule the tools enforce is the only kind that survives a late hour. It scans the staged diff for keys first, because every other mistake here can be corrected in a later commit and a committed secret cannot: it stays in every clone for the life of the repository, so a key that reaches history is replaced rather than deleted. `npm install` points git at `hooks/` through the `prepare` script, so a fresh clone is gated without anyone remembering to do anything. Never commit with `--no-verify`, and never turn a lint rule off without writing the reason beside it — a rule switched off silently is indistinguishable from a rule that was never needed.
7. **Every stage ends with a check the user runs.** Before committing a stage, write down what to open, type or click to confirm it works and what a failure looks like — the agent verifying its own work only proves the code does what the agent thought, which is the half already known. Nothing is pushed until the user confirms.
8. **Don't drift from the non-negotiables below.**

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
| the look of a screen — layout, palette, type, spacing, components | the design canvas, thirteen artboards, the home screen in `EaseSalary - דף הבית v3 לוח במרכז.dc.html`: https://claude.ai/design/p/b11cf323-ac11-490d-994d-3145e8e07a6b — then Part 1 |
| what to build next, in what order, with what | `build_plan.md` |

## Agent skills
Installed skills written for other repos assume files this repo does not have. The two files below
hold the whole mapping, and they are where the skills' own convention looks for it — keeping it out
of `CLAUDE.md` keeps the always-loaded file short.

### Domain docs
`specs.md` is this repo's glossary and domain model; there is no `CONTEXT.md` and no `docs/adr/`.
See `docs/agents/domain.md`.

### Issue tracker
None — `build_plan.md` is the work list and the stage order. See `docs/agents/issue-tracker.md`.

## Code conventions
- Code, comments, commit messages, and identifiers in English; every user-facing string Hebrew, in one translations file.
- Money is held as integer agorot and converted only for display and export. Never floating-point shekels. Carry full precision through a calculation and round only at the end, never between steps.
- Right-to-left throughout: logical properties only (`ms`/`me`/`ps`/`pe`, `text-start`/`text-end`), never `left`/`right`; `lang="he"` and `dir="rtl"` on the document; directional icons mirrored.
- Isolate mixed-script content — numbers, dates, ranges, passport numbers, names written in two scripts — with `<bdi>` or `unicode-bidi: isolate`. Numeric inputs stay `dir="ltr"` inside.
- **Every dynamic string gets its own wrapping element.** Write `<span>שלום, </span><bdi>{name}</bdi>`, never `שלום, {name}` — Chrome swaps text nodes in place when it translates, and React then throws `NotFoundError` on `removeChild` wherever a bare string sits as a sibling of other nodes. This is the convention hardest to hold by hand and the one that crashes the page.
- **No meaningful text inside an image or a CSS `content:`** — Chrome can translate neither. Chevrons, badges and every directional glyph are inline `<svg aria-hidden="true">` beside a real label, mirrored by `rotate-180` under RTL rather than by hand at each call site.
- `translate="no"` on the wordmark, on amounts, and on passport and bank numbers: a translated identifier is a wrong identifier. `dir="auto"` on leaf text elements — headings, paragraphs, labels — while layout containers stay `dir="rtl"`, so Hebrew resolves right-to-left and translated English resolves left-to-right instead of hanging off the edge.
- A range of days is ordered by date, never by screen position. In right-to-left a leftward drag moves *forward* in time, so anything keyed off column index or `clientX` inverts while looking entirely plausible.
- Build dates outside a local time zone; a daylight-saving boundary must not change how many Saturdays a month has.
- Nothing reads the clock during a render. Today is passed in as a prop, or the server and the browser disagree and the page throws a hydration mismatch on a date.
- The calculation engine is pure functions over a month's facts, callable without a server, and one engine serves both the on-screen preview and the export.
- The canvas is read for every screen but implemented one artboard at a time: the step names the artboard it builds, and the rest are context rather than licence to build them — a session that implements an artboard its step did not name has skipped the check that step was going to end with (rule 7). A step that names none is reading only.
- **Where the code already departs from an artboard on purpose, the departure is written down and the artboard is not silently obeyed.** "Code moves to the artboard" holds for a screen being built; it does not license undoing a decision already taken against the built screen. The home screen departs from `דף הבית v3` in four places, none of them yet on the canvas: the greeting and worker switcher are in the top bar, the balances are a strip under the calendar rather than a third card, "אוגוסט … מוכן לחישוב" is the page's `h1` rather than a card's `h2`, and the vertical rhythm is trimmed throughout. All four came out of measuring the built screen in a real viewport — the artboard's own layout scrolled — and they are recorded in `docs/plan-calculation-engine.md` Step 0 (f) and (g). Read those before "correcting" the screen back. The other artboards still draw the v2 green sidebar and disagree with the shell; each is rebuilt when its own stage arrives.
- **A test's expected figure comes from `specs.md`, the workbook, or the statute — never from what the engine returned.** An agent that writes a component and then its test reads its own code to do it, and records whatever that code produced: the suite then proves only that the engine agrees with itself, passes in full, and fails the day someone corrects the bug. August 2025 is safe because its four totals come from the family's own sheet; the accrual, the ninety-day ceiling and the derived rates have no such figure to hand, and those are exactly the ones to derive on paper first, or to write the test for before the component exists.
- Calculation code carries tests; interface code need not — except a test that two things *agree*, which belongs beside neither of them and would otherwise never be written. The preview and the export are one engine's output shown twice, so the test drives both from a single engine result and asserts they say the same thing; it lives with the calculation suite.
