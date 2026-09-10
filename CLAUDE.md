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
| External data | `fetch` + `node-html-parser`, results cached in Postgres. The parser is named here rather than left open because the scrapers must agree on one idiom: the wage is a sentence in a classed div, the holiday list is a table, and the Stage 5 cache is a page split at its own headings, and three regexes would be three parsers nobody could correct in one place. Every scrape is a pure function over an HTML **string** with the request injected, so the suite reads saved pages and never the network (`specs.md` Part 4) |
| Deploy | Vercel; the encryption key and Supabase keys are env vars, never in the repo |
| Design | The canvas is read through the `claude_design` MCP server, registered in the committed `.mcp.json`. Run `/design-login` **once per clone** — without it the canvas URL is an address the session cannot open, and the screens get rebuilt from prose descriptions instead of from the design |
| Tests | Vitest — the calculation engine, the export filler, the scrapers' parsing — plus browser verification of the important user-facing flows (rules 9–12) |

## Working rules
1. **Spec first, and never change the spec without approval.** Read `specs.md` before changing code, and where the code and the spec disagree the spec is what holds. But if the spec itself looks wrong, stale, ambiguous, or too thin to support the work being asked for, **stop and ask before editing `specs.md`** — an agent free to edit the source of truth can settle any disagreement by rewriting the thing it was going to be judged against, and in a file this long nobody would see it happen. Never patch code around a spec you believe is stale either: say so, and wait.
2. **Ask when unclear.** If a requirement is ambiguous or you are about to guess, stop and ask one focused question before coding. Questions about salary rules and entitlements are asked in Hebrew; technical questions in English.
3. **Write approved decisions down where they belong.** Once the user has approved a change in behavior, edit whichever file holds it — `specs.md` (what) or `CLAUDE.md` (how) — in the same step as the code. A rule whose reason is not self-evident carries its reason in the same sentence. When a new decision supersedes an old one, replace the old wording outright; the files describe only what stands now.
4. **Do not invent product behavior.** Never add a feature, field, workflow, calculation, validation, or user-facing behavior because it seems useful or conventional. It must rest on `specs.md`, on the artboard the step named, or on an explicit decision by the user. Where those disagree or leave a real gap, ask — a plausible invention is the hardest kind of wrong answer to find later, because nothing about it looks like a mistake.
5. **Keep data-only files free of prose.** Rules and explanations live in `specs.md`; the templates and holiday lists hold data and nothing else.
6. **Cite the workbooks precisely.** Name the workbook, the tab, and the cell — never a bare row number, since row numbering differs between years.
7. **The mechanical checks are not yours to judge.** `npx next typegen && npx tsc --noEmit`, `npm run lint` and `npm test` all pass before anything is committed, and `hooks/pre-commit` refuses the commit when they don't — a rule the tools enforce is the only kind that survives a late hour. It scans the staged diff for keys first, because every other mistake here can be corrected in a later commit and a committed secret cannot: it stays in every clone for the life of the repository, so a key that reaches history is replaced rather than deleted. `npm install` points git at `hooks/` through the `prepare` script, so a fresh clone is gated without anyone remembering to do anything. Never commit with `--no-verify`, and never turn a lint rule off without writing the reason beside it — a rule switched off silently is indistinguishable from a rule that was never needed.
8. **Every stage ends with a check the user runs.** The stage order and its scope come from `build_plan.md`. Before committing a stage, write down what to open, type or click to confirm it works and what a failure looks like — the agent verifying its own work only proves the code does what the agent thought, which is the half already known. Nothing is pushed until the user confirms.
9. **Test the important flows through the real browser, and verify results rather than interactions.** Run the application and use its real navigation, inputs, calendar, controls, confirmations and export flow as a user meets them; never reach past the interface and call the functions underneath. A flow assembled out of unit tests that each pass is a flow nobody has ever performed, and the wiring between them is exactly where it breaks. A page that loaded, a button that clicked and a file that appeared prove nothing on their own: assert the resulting screen state, the figures displayed, the calculated result, and the values inside the exported workbook.
10. **Every expected figure comes from outside the code under test** — `specs.md`, the workbook, the statute, a fixed fixture, or an arithmetic worked by hand — and never from what the implementation returned. Cover realistic multi-step scenarios, and the edge cases where they bear on the change: partial days, sickness across a month boundary, sickness on a holiday, a holiday on a rest day, advances, manual overrides, a minimum wage that changed, a failed fetch, an unanswered pre-export question, a correction to a past month, and a future month. Not every edge case for every unrelated change.
11. **Preview and export must agree.** They are one calculation path shown twice, so when a change touches a calculated or an exported value, drive both from a single engine result and assert they say the same thing.
12. **Report what was actually verified.** For an important test, record the scenario, the data used, the expected result, the actual result, and what incorrect behavior the test would catch — the last of those is what separates a test from a demonstration. Capture screenshots at meaningful checkpoints, an important state change and either side of an export, rather than after every click; a screenshot supplements an assertion and never replaces one.
13. **Don't drift from the non-negotiables below.**

## Non-negotiables
Duplicated here on purpose, so they still hold in a session that never opens `specs.md`. On any conflict, `specs.md` wins.

- No rate is ever hardcoded. Derive from the worker's base monthly salary, which defaults to the confirmed minimum wage and may not be set below it. (Part 2)
- The minimum wage is confirmed by the user before every export, and a month is valued at the rate in force during it. (Parts 2–3)
- The user never enters a rate or a formula — only facts about the month, and the confirmations the workflow puts to her, such as the minimum wage and the recuperation rate. (Parts 1–2)
- The export keeps the structure of the 2026 workbook's month tab. (Parts 2–3)
- Income tax **is** calculated — from the month's wage, the brackets in force during it, and the worker's credit points — then confirmed before every export and stored with the month, like the minimum wage. The credit points are derived from her gender and never asked for: 2.25 for a foreign caregiver, half a point more for a woman. **It lands with stage 3's storage, because the gender it turns on is a profile field**; until then the line stays zero and user-editable, which is what it has always been. Reversed on 2026-09-10 — before that the rule was that it is never calculated. Pension and severance are still out of scope, their row empty for layout only. (Part 1, item 17)
- Any computed amount can be overridden; an override is marked manual and is never silently recalculated away. (Part 2)
- Holiday lists are fetched per country and per year and cached. No year is ever hardcoded; the shipped files are seed data. (Parts 2–3)
- Five identifying numbers are encrypted at rest with a key held outside the database, decrypted server-side only for display and export, and never logged: passport, bank account, and the employment permit, work visa and passport document numbers. Their **expiry dates are not encrypted** — the warnings have to query them. (Part 3, items 22 and 28)
- The weekly rest day is a term of the employment, not Saturday. It is Friday, Saturday or Sunday per worker, defaults to Saturday, and is read off the month rather than the profile. Anything that once counted Saturdays counts rest days. (Part 2 item 5, Part 3)
- Balances are never stored. They are derived by replaying the worker's months from the opening position, which is what makes a correction to a past month move every later month for free. (Part 3, item 13)
- Money is integer agorot in code, two decimals on display, rounded to the nearest agora. (Part 2)

## Where to read
`specs.md` is long and is read a part at a time, never whole. Locate the part with
`grep -n '^## Part' specs.md`, then read between that line and the next heading — the
anchors below are the literal headings, so they are what you are grepping for.

| Working on | Read |
|---|---|
| what the app is for, scope, what is deliberately excluded | `## Part 1 — Goal and reason` |
| what "done" means, anything test-shaped | `## Part 2 — Testable success criteria` |
| server/client boundary, storage, templates, external data | `## Part 3 — Architectural guidance` |
| the August 2025 known case, the invalid case, what a test has to prove | `## Part 4 — Validation approach` |
| rates, rounding, column meanings, date counting, layout traps | `## Part 5 — Known pitfalls` |
| what is deliberately deferred, so it is not rediscovered as a bug | `## Appendix — future features` |
| the look of a screen — layout, palette, type, spacing, components | the design canvas, thirteen artboards, the home screen in `EaseSalary - דף הבית v3 לוח במרכז.dc.html`: https://claude.ai/design/p/b11cf323-ac11-490d-994d-3145e8e07a6b — then Part 1 |
| what to build next, in what order, with what | `build_plan.md` |

Part 2's criteria are numbered and are cited by number throughout both files; find one with
`grep -n '^[0-9]\+\. ' specs.md` rather than by scrolling.

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
- **Never put `dir="auto"` on an element whose only child is a `<bdi>`** — it resolves to *left-to-right* and silently left-aligns the text in an RTL row. `dir="auto"` picks the direction from the first strong character, and a `<bdi>` is an isolate: from the parent it counts as a neutral object, so the parent sees no strong character at all and falls back to LTR. The label still reads correctly and sits against the wrong edge, which is why it survives a screenshot. Put `dir="auto"` on the element carrying the text, and let a wrapper inherit `rtl`.
- **Every dynamic string gets its own wrapping element.** Write `<span>שלום, </span><bdi>{name}</bdi>`, never `שלום, {name}` — Chrome swaps text nodes in place when it translates, and React then throws `NotFoundError` on `removeChild` wherever a bare string sits as a sibling of other nodes. This is the convention hardest to hold by hand and the one that crashes the page.
- **No meaningful text inside an image or a CSS `content:`** — Chrome can translate neither. Chevrons, badges and every directional glyph are inline `<svg aria-hidden="true">` beside a real label, mirrored by `rotate-180` under RTL rather than by hand at each call site.
- `translate="no"` on the wordmark, on amounts, and on passport and bank numbers: a translated identifier is a wrong identifier. `dir="auto"` on leaf text elements — headings, paragraphs, labels — while layout containers stay `dir="rtl"`, so Hebrew resolves right-to-left and translated English resolves left-to-right instead of hanging off the edge.
- A range of days is ordered by date, never by screen position. In right-to-left a leftward drag moves *forward* in time, so anything keyed off column index or `clientX` inverts while looking entirely plausible.
- Build dates outside a local time zone; a daylight-saving boundary must not change how many rest days a month has.
- Nothing reads the clock during a render. Today is passed in as a prop, or the server and the browser disagree and the page throws a hydration mismatch on a date.
- The calculation engine is pure functions over a worker's months — a series, not a single month, because balances carry forward and are replayed rather than stored. It is callable without a server, and one engine serves both the on-screen preview and the export.
- Nothing in the engine reads a clock. A finished month clips an open sick spell at its own last day; only the current month's preview clips at a `today` passed in by its caller.
- The canvas is read for every screen but implemented one artboard at a time: the step names the artboard it builds, and the rest are context rather than licence to build them — a session that implements an artboard its step did not name has skipped the check that step was going to end with (rule 8). A step that names none is reading only.
- **Where the code already departs from an artboard on purpose, the departure is written down and the artboard is not silently obeyed.** "Code moves to the artboard" holds for a screen being built; it does not license undoing a decision already taken against the built screen. The home screen departs from `דף הבית v3` in four measured places — read `docs/plan-calculation-engine.md` Step 0 (f) and (g) before "correcting" it back.
- **A test's expected figure comes from `specs.md`, the workbook, or the statute — never from what the engine returned.** An agent that writes a component and then its test reads its own code to do it, and records whatever that code produced: the suite then proves only that the engine agrees with itself, passes in full, and fails the day someone corrects the bug. August 2025 is safe because its four totals come from the family's own sheet; the accrual, the ninety-day ceiling and the derived rates have no such figure to hand, and those are exactly the ones to derive on paper first, or to write the test for before the component exists.
- Calculation code carries tests; interface code need not — except a test that two things *agree*, which belongs beside neither of them and would otherwise never be written. The preview and the export are one engine's output shown twice, so the test drives both from a single engine result and asserts they say the same thing; it lives with the calculation suite.
