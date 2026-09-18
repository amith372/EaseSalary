# Stage 8 — the review file

The working file of stage 8 (`build_plan.md`). Four review runs write into it one after
another, and together they produce the **Fix list** at the bottom, which is then executed
item by item. It is deleted when stage 8 closes; what it found lives on in the commits.

## Resume here

A fresh session told "continue with `docs/stage8-review.md`" reads this file whole and does
**the next step below, and only that step**. At the end of the step it updates this block and
the plan table, then stops and reports to the user.

- **Last done:** step 0 — `ponytail-audit`, committed as `511d3ca`.
- **Next:** step 1 — `code-simplifier`.
- **Waiting on the user:** the income-tax scraper, under "Needs the user". It does not block
  the next step.

## Ground rules for every step

1. **Stage 8 changes no behaviour.** A proposal that would change what the application does —
   a figure, a screen, a rule — does not go on the Fix list. It goes under "Needs the user"
   and is put to her (working rule 1).
2. **Read the whole file before a run.** Anything already listed under an earlier run or on
   the Fix list is not reported again — at most "also seen by run N", added to that entry.
3. **A run writes only into its own section, and edits no code.** One line per finding:
   `R<run>.<n> — <what> — <file:line> — <why>`. Keep a section under about 40 lines: the
   strongest findings, not every one.
4. **`CLAUDE.md` and `specs.md` outrank every skill's defaults.** A skill convention that
   contradicts them (for example "remove comments", or a style the repo does not use) is
   dropped, not reported.
5. **Commits.** A run's findings are committed with the file alone (`Stage 8: run N
   findings`). A fix is one commit per Fix-list item. Never push (the user decides that).
   `hooks/pre-commit` runs typecheck, lint and the unit suite; never `--no-verify`.
6. **The browser suite** (`npx playwright test --reporter=line`, about eight minutes, one
   worker) runs after any fix that touches a screen. A failure that moves between runs and
   fails inside `e2e/household.ts`'s worker switcher is the known flake: rerun that test alone.

## The plan

| # | Step | Status |
|---|---|---|
| 0 | `ponytail-audit` over the whole repository | **done** 2026-09-18, `511d3ca` |
| 1 | `code-simplifier` | not run |
| 2 | `mattpocock-skills:code-review` | not run |
| 3 | `mattpocock-skills:improve-codebase-architecture` | not run |
| 4 | `ponytail-review` | not run |
| 5 | Consolidate into the Fix list | not run |
| 6 | The user signs the Fix list off | — |
| 7 | Execute the Fix list, one item at a time | — |

### How each step is run

**Step 1 — `code-simplifier`.** A plugin agent, not a skill, and it edits by default — so it
is *followed by hand, report-only*. Read its instructions at
`~/.claude/plugins/cache/claude-plugins-official/code-simplifier/1.0.0/agents/code-simplifier.md`
and apply its lens (needless nesting, nested ternaries, redundant code, unclear names,
logic that belongs together) to these files, reading each whole:
`src/components/MonthActions.tsx`, `src/components/WorkerTerms.tsx`,
`src/components/AddWorkerScreen.tsx`, `src/components/HomeScreen.tsx`,
`src/components/BeforeExportScreen.tsx`, `src/components/MonthCalendar.tsx`,
`src/components/HolidayPickerScreen.tsx`, `src/lib/supabase/repository.ts`,
`src/lib/engine/types.ts`, `src/lib/engine/profile.ts`, `src/app/month/actions.ts`,
`src/app/workers/actions.ts`. Its own coding-standard list (ES-module extensions, explicit
return types everywhere, `function` over arrows) is **not** this repo's and is ignored.

**Step 2 — `mattpocock-skills:code-review`.** Invoke the skill. It reviews a git diff, so the
whole codebase is reviewed as the diff from the root commit `9da6e03` — which is too much for
one pass (its two sub-agents answer in 400 words each). It is therefore run **once per area**,
each time with the fixed point `9da6e03` and a path filter, and the findings of all four
passes go into run 2's section:
`src/lib/engine`, `src/lib/export` + `src/lib/scrape`, `src/app` + `src/lib` (the rest),
`src/components`. Standards = `CLAUDE.md` and `DESIGN.md`; Spec = `specs.md` (read a part at a
time, as `CLAUDE.md` says). Tests are left out of the diff.

**Step 3 — `mattpocock-skills:improve-codebase-architecture`.** Not loaded as a skill (it is
user-triggered), so its `SKILL.md` is *followed by hand*:
`~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.2.3/skills/engineering/improve-codebase-architecture/SKILL.md`,
with the vocabulary of `mattpocock-skills:codebase-design`. Hot spots come from
`git log --stat` over the last forty commits. It writes its HTML report to the temp
directory, as it says; the **candidates are copied here** with their recommendation strength.
Its grilling loop is not run during the step — a candidate the user wants to pursue is
grilled at step 6. `specs.md` stands in for `CONTEXT.md`; there are no ADRs.

**Step 4 — `ponytail-review`.** Invoke the skill on the diff of step 0's fixes:
`git diff 511d3ca~1 511d3ca`, to catch any complexity the cleanup itself added.

**Step 5 — consolidate.** Merge the four runs into the Fix list: duplicates become one item
naming every run that found it; anything contradicting `CLAUDE.md`/`specs.md` is dropped with
a word why; behaviour changes move to "Needs the user". Order: deletions first, then
duplication, then structure. Each item is small enough for one commit and names the check
that proves it changed nothing. Then stop for step 6.

**Step 7 — execute.** Take the first unchecked item, do it, run the checks, commit, mark it
`[x] <date> <commit>`, update "Resume here", and go on to the next — stopping when the user
says so or the list is done.

## Already run

### Run 0 — `ponytail-audit`, 2026-09-18, `511d3ca`

Whole-repo, with `knip` for dead exports. All seven cuts applied; typecheck, lint, 1,139 unit
tests and 128 browser tests pass (two flaked on the worker switcher, passed on rerun).

- [x] R0.1 — unit-test DOM stack nobody used: `jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`, `@vitejs/plugin-react`, `vitest.setup.ts`. Vitest runs in `node`.
- [x] R0.2 — `Field` copied between `MonthActions` and `WorkerTerms`; `inputClass` in four
  files. Now `src/components/Field.tsx`.
- [x] R0.3 — `profileOf` in three action files, and inline in `month/export/actions.ts`. Now
  `requireWorker` in `src/lib/store.ts`.
- [x] R0.4 — ~40 comments narrating history rather than the rule in force. Also: two doc
  comments detached from `DocumentsControl` and `InsurerControl`, one of them wrong about the
  identifying numbers; three `MonthCalendar` props (`decorated`, `asPageHeading`, `readOnly`)
  its only caller never varied — removed with their branches and `he.calendar.hint`.
- [x] R0.5 — `shekels()` twice in the export; the percent formatting four times. Now
  `toShekels` and `formatPercent` in `src/lib/money.ts`, with tests.
- [x] R0.6 — `spacerRow`, `SPACER_ROW`, `TEST_WORKER_ID`: never called.
- [x] R0.7 — 54 exports used only in their own file, and an unused type re-export.

Seen and left: the hand-run live checks under `scripts/` look unused to `knip` and are not;
`supabase` in devDependencies is the CLI.

## Run 1 — `code-simplifier`

_Not run yet._

## Run 2 — `mattpocock-skills:code-review`

_Not run yet._

## Run 3 — `mattpocock-skills:improve-codebase-architecture`

_Not run yet._

## Run 4 — `ponytail-review`

_Not run yet._

## Needs the user

- **The income-tax scraper is not wired** (run 0). `fetchTaxBrackets` and
  `fetchCreditPointValue` in `src/lib/scrape/incomeTax.ts` are called by nothing, while
  `specs.md` Part 1 says the brackets and the credit point's value "are fetched per year and
  cached like the minimum wage". Pay it as its own step, or add it to `build_plan.md`'s
  "Still to pay"?

## Fix list

Written at step 5, approved at step 6, executed at step 7.

_Empty until step 5._
