# Stage 8 — the review file

The working file of stage 8 (`build_plan.md`). Four review runs write into it one after
another, and together they produce the **Fix list** at the bottom, which is then executed
item by item. It is deleted when stage 8 closes; what it found lives on in the commits.

**Stage 8 changes no behaviour.** Anything a review proposes that would change what the
application does — a figure, a screen, a rule — does not go on the Fix list. It goes under
"Needs the user" and is put to her (working rule 1).

## How every run uses this file

1. **Read the whole file first.** Anything already listed under an earlier run, under
   "Already run", or on the Fix list is not reported again — at most "also seen by <run>",
   added to the existing entry.
2. **Write findings into your own section, and change nothing else.** One line per finding:
   `R<run>.<n> — <what> — <file:line> — <why>`. No code is edited during a run.
3. **`CLAUDE.md` and `specs.md` outrank every skill's defaults.** A skill's convention that
   contradicts them (for example "remove comments", or "prefer `function` over arrows"
   where the repo is silent) is dropped, not reported.

## The plan

| # | Run | Scope | How it is run | Status |
|---|---|---|---|---|
| 0 | `ponytail-audit` | whole repository | the skill | **done** — see "Already run" |
| 1 | `code-simplifier` | the twelve largest non-test source files (listed in its section) | its agent definition followed by hand, report-only: the plugin was installed after this session began, and the agent edits by default | not run |
| 2 | `mattpocock-skills:code-review` | `git diff 9da6e03...HEAD -- src` — the whole of `src/` since the root commit | the skill; Standards = `CLAUDE.md` + `DESIGN.md`, Spec = `specs.md` | not run |
| 3 | `mattpocock-skills:improve-codebase-architecture` | hot spots from `git log`, then as the skill finds them | its `SKILL.md` followed by hand; the HTML report goes to the temp directory, the candidates are copied here | not run |
| 4 | `ponytail-review` | the stage 8 diff — everything run 0's fixes changed | the skill | not run |
| 5 | **Consolidate** | this file | merge duplicates across runs, drop what contradicts `CLAUDE.md`/`specs.md`, move behaviour changes to "Needs the user", order the Fix list | not run |
| 6 | **Sign-off** | the Fix list | the user approves, strikes or reorders items | — |
| 7 | **Execute** | one Fix-list item at a time | typecheck, lint and `npm test` after each; the browser suite after any that touches a screen; mark `[x]` with the date and commit | — |

## Already run

### Run 0 — `ponytail-audit`, 2026-09-18

Whole-repo, with `knip` for dead exports. All seven cuts applied the same day; typecheck,
lint, 1,139 unit tests and 128 browser tests pass (two browser tests flaked on the worker
switcher and passed on rerun).

- [x] R0.1 — unit-test DOM stack nobody used: `jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`, `@vitejs/plugin-react`, `vitest.setup.ts`. Vitest runs in `node`.
- [x] R0.2 — `Field` copied between `MonthActions` and `WorkerTerms`; `inputClass` in four
  files. Now `src/components/Field.tsx`.
- [x] R0.3 — `profileOf` in three action files, and inline in `month/export/actions.ts`. Now
  `requireWorker` in `src/lib/store.ts`.
- [x] R0.4 — ~40 comments narrating history rather than the rule in force (`CLAUDE.md`, code
  conventions). Also found: two doc comments detached from `DocumentsControl` and
  `InsurerControl`, one of them wrong about the identifying numbers; and three
  `MonthCalendar` props (`decorated`, `asPageHeading`, `readOnly`) its only caller never
  varies — removed with their branches and `he.calendar.hint`.
- [x] R0.5 — `shekels()` twice in the export; the percent formatting four times. Now
  `toShekels` and `formatPercent` in `src/lib/money.ts`, with tests.
- [x] R0.6 — `spacerRow`, `SPACER_ROW`, `TEST_WORKER_ID`: never called.
- [x] R0.7 — 54 exports used only in their own file, and an unused type re-export.

**Not a cut, and open:** `fetchTaxBrackets` and `fetchCreditPointValue`
(`src/lib/scrape/incomeTax.ts`) are called by nothing, but `specs.md` Part 1 says the brackets
and the credit point's value "are fetched per year and cached like the minimum wage". An
unwired scraper, not dead code — listed under "Needs the user".

## Run 1 — `code-simplifier`

Scope: `MonthActions.tsx`, `WorkerTerms.tsx`, `AddWorkerScreen.tsx`, `HomeScreen.tsx`,
`BeforeExportScreen.tsx`, `MonthCalendar.tsx`, `HolidayPickerScreen.tsx`,
`src/lib/supabase/repository.ts`, `src/lib/engine/types.ts`, `src/lib/engine/profile.ts`,
`src/app/month/actions.ts`, `src/app/workers/actions.ts`.

_Not run yet._

## Run 2 — `mattpocock-skills:code-review`

_Not run yet._

## Run 3 — `mattpocock-skills:improve-codebase-architecture`

_Not run yet._

## Run 4 — `ponytail-review`

_Not run yet._

## Needs the user

- **The income-tax scraper is not wired** (run 0). Pay it as its own step, or add it to
  `build_plan.md`'s "Still to pay"?

## Fix list

Written at step 5, approved at step 6, executed at step 7. Each item names the runs that
found it and the check that proves it changed nothing.

_Empty until step 5._
