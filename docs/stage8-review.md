# Stage 8 — the review file

The working file of stage 8 (`build_plan.md`). Five review runs write into it one after
another, and together they produce the **Fix list** at the bottom, which is then executed
item by item. It is deleted when stage 8 closes; what it found lives on in the commits.

## Resume here

A fresh session told "continue with `docs/stage8-review.md`" reads this file whole and does
**the next step below, and only that step**. At the end of the step it updates this block and
the plan table, then stops and reports to the user.

- **Last done:** 2026-09-23, **F36** — the income-tax scraper is wired. Nothing was missing but
  the wiring: the scraper, its parser suite, the `tax_brackets` table and the `creditPointValue`
  rate key have all stood since stage 3, and `npx supabase migration list` says every local
  migration is live, so **no migration was needed**. The repository gained `listTaxBrackets`,
  `saveTaxBrackets` and `lastFetchedBrackets` in both implementations; `src/lib/incomeTaxRefresh.ts`
  reads each of the two pages on a day's staleness, independently, and saves what came back; and
  the three `calculateSeries` call sites that had all been falling through to `AS_SHIPPED`
  — `householdSeries`, the pre-export screen and `taxToConfirm` — now pass the household's own
  tables. The browser suite ran whole, 137/137, no flake. Committed as `d1d9b91`.
  Before that, 2026-09-23, **all of F33's sweep, S1–S8**, plus F27, which S7 was the whole
  of once the two panels were told not to merge. Committed as `b453175` (S1), `2290b31` (S2),
  `3720209` (S5), `409bfab` (S6) and `eb552e9` (S3, S4, S7, S8 and F27 together — they share
  three files and no split of them compiles). **F33 and F27 were the last of the Fix list's
  middle**; what remains is F32 and F37.
  Earlier, **stage 8½ and F28 went in together as `be4511f`**, for the same reason: F28's
  `followsProfile` is what stage 8½'s `strandedFreeRestDays` reads. F1–F31, F33–F35 are done;
  nothing on the list is half-built.
- **Outside stage 8, built 2026-09-22 and committed on its own:** the picker withholds a mark
  kind no day of the selection can take (`specs.md` item 5).
- **The refusal card is approved and is `build_plan.md` stage 8¾**, not a stage 8 item: its
  PRD was signed off 2026-09-22 and is committed as `fb6176f`. It owes a `specs.md` sentence,
  put to the user with its exact wording before it is written (rule 1).
- **Next is the per-worker rates and holiday lists PRD**, which the
  user placed before `/doctor` (2026-09-22), then F32, then F37. **Stop before F32 (`/doctor`)
  and ask** — she may want to change model for it; reaching it is not licence to start it.
  **The nine GO/NO-GO findings are a GO** (2026-09-22), to be taken up after the next `/clear`.
  **Where stage 8¾ (the refusal card) sits against all of this is the user's to say** — it is
  approved but unplaced, and it is the difference between a careful sentence and a stack trace.
  **Ask before each commit** (said on 2026-09-18).
- **Outside the list:** `43e0d5a` (an unanswered holiday could not be stored — a missing
  migration, now applied live) waits for the user to mark a holiday signed in and confirm.
- **A browser failure** is checked by rerunning it alone, and against HEAD with the change
  stashed. The `auth.setup.ts` server log "The destination stream closed early" is noise.
  **The switcher flake's mechanism is known** (found 2026-09-22): `stepUntilShowing`
  (`e2e/household.ts:84`) presses "next" **once** and then asserts, so a press that lands
  before hydration does nothing and the assertion waits out its five seconds on the *first*
  worker's name — which is why the failure names "האנה מונטנה Hanna Montana" and looks like
  stale data rather than a lost click. `openSettingsGroups` twenty lines below already retries
  for that reason. Retrying the press would end it; that is test code, not product, and it is
  not on the Fix list. On 2026-09-22 it took `holiday-picker.spec.ts:257` out of a full run
  (134/135) and three of a trio run, all of which passed alone.
- **Waiting on the user**, none of which a session may answer for her:
  1. The per-worker rates and holiday lists she asked for on 2026-09-22, which owes a PRD
     before any code (rule 2) and is not a stage 8 item.
  2. Where stage 8¾, the refusal card, sits in the order. Its PRD is approved and its steps
     are in `build_plan.md`; only its place is open.

  **Answered already, so do not ask again:** which household the broken one is — the live
  Postgres one, and she is no longer locked out of it.

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
| 1 | `code-simplifier` | **done** 2026-09-18 |
| 2 | `mattpocock-skills:code-review` | **done** 2026-09-18 |
| 3 | `mattpocock-skills:improve-codebase-architecture` | **done** 2026-09-18 |
| 4 | `ponytail-review` | **done** 2026-09-18 |
| 5 | `thermo-nuclear-code-quality-review` | **done** 2026-09-18 |
| 6 | Consolidate into the Fix list | **done** 2026-09-18 |
| 7 | The user signs the Fix list off | **done** 2026-09-18 — F1–F25 |
| 8 | Execute the Fix list, one item at a time | under way — F1–F31, F33–F36 done; F32 and F37 remain |

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
grilled at step 7. `specs.md` stands in for `CONTEXT.md`; there are no ADRs.

**Step 4 — `ponytail-review`.** Invoke the skill on the diff of step 0's fixes:
`git diff 511d3ca~1 511d3ca`, to catch any complexity the cleanup itself added.

**Step 5 — `thermo-nuclear-code-quality-review`.** Not loaded as a skill (it is
user-triggered), so its `SKILL.md` is *followed by hand*:
`~/.claude/skills/thermo-nuclear-code-quality-review/SKILL.md`. It reviews a branch's changes,
so like step 2 it takes the whole codebase as the diff from `9da6e03`, tests left out, run once
per area (the same four). Its lens is structure: files past 1,000 lines, ad-hoc branches grown
into shared flows, pass-through wrappers and casts, logic outside its canonical layer, and the
"code judo" restructuring that deletes a layer rather than moving it. Its approval verdict and
review-comment tone are not used — findings go into run 5's section in rule 3's one-line form,
and anything runs 0–4 already hold is not repeated (rule 2).

**Step 6 — consolidate.** Merge the five runs into the Fix list: duplicates become one item
naming every run that found it; anything contradicting `CLAUDE.md`/`specs.md` is dropped with
a word why; behaviour changes move to "Needs the user". Order: deletions first, then
duplication, then structure. Each item is small enough for one commit and names the check
that proves it changed nothing. Then stop for step 7.

**Step 8 — execute.** Take the first unchecked item, do it, run the checks, commit, mark it
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

## Run 1 — `code-simplifier`, 2026-09-18

Report-only, over the twelve files named in step 1, each read whole.

- R1.1 — `StandingLinesControl` copies `UserLinesControl`'s state, `reset`, `openEdit`, `submit`
  and panel — `WorkerTerms.tsx:507`, `MonthActions.tsx:738` — its doc says it *is* the
  `/payments` panel; the copies already differ (no placement hint, other buttons), so one
  `UserLinePanel` must pick a look (see "Needs the user").
- R1.2 — the clear / send / keep-refusal hook four times — `MonthActions.tsx:318`,
  `WorkerTerms.tsx:201`, `BeforeExportScreen.tsx:266`, `HolidayPickerScreen.tsx:114` — one
  generic `useAction<R>`.
- R1.3 — the `role="alert"` refusal paragraph three times — `MonthActions.tsx:285`,
  `WorkerTerms.tsx:171`, `HolidayPickerScreen.tsx:780` — one component.
- R1.4 — the "rule — באתר כל זכות" link hand-built four times — `MonthActions.tsx:430,694`,
  `AddWorkerScreen.tsx:671` (`RuleLink`), `HolidayPickerScreen.tsx:561` — share `RuleLink`.
- R1.5 — `(agorot / 100).toFixed(2)` as a field's opening text three times —
  `BeforeExportScreen.tsx:130`, `WorkerTerms.tsx:1300`, `AddWorkerScreen.tsx:143` — float
  arithmetic outside `money.ts`; move `amountFieldValue` there.
- R1.6 — a holiday's `worked` → state worked out three times — `MonthCalendar.tsx:203`,
  `HomeScreen.tsx:241`, `BeforeExportScreen.tsx:883` — export `holidayStateOf` and read it.
- R1.7 — nested ternaries — `HomeScreen.tsx:241-260` (four deep), `MonthCalendar.tsx:434`
  (arrow keys → a lookup table), `:540`, `:550`, `MonthActions.tsx:495,507,535,1658` — if/else
  or a record.
- R1.8 — the picker's second-row reset (`setPart(1)`, `setNote("")`, `setMoreOpen(false)`)
  written three times — `MonthCalendar.tsx:319,353,393` — one helper.
- R1.9 — `outlineButtonClass` exported from `MonthActions` for `HomeScreen`, its disabled
  suffix pasted three times — `MonthActions.tsx:410,641`, `HomeScreen.tsx:824` — move it
  beside `inputClass` in `Field.tsx`, disabled states included.
- R1.10 — `addOpeningAdvance` re-implements `nextAdvanceNumber` — `workers/actions.ts:509` —
  `advances.ts:174` exports it.
- R1.11 — the 1–12 recuperation-month check twice — `workers/actions.ts:289`, `profile.ts:619`.
- R1.12 — one membership guard three times (`isAllowedRestDay`, `isAllowedGender`, the
  `.some` + cast in `reviewIncomeTax`) — `profile.ts:68,77,100` — one `isOneOf(list, value)`.
- R1.13 — `monthNumberOf` parses an ISO date with its own regex —
  `AddWorkerScreen.tsx:1138` — `reviewDate` + `monthOf` already do.
- R1.14 — `noteFor(mode: unknown)` if-chain — `AddWorkerScreen.tsx:1143` — a record, as
  `WorkerTerms.tsx:348` does for the same three notes.
- R1.15 — casts the types already give — `AddWorkerScreen.tsx:565,747,1098`,
  `HomeScreen.tsx:245`, `workers/actions.ts:412,422,456` (`(line: UserLine)`).
- R1.16 — two identical opening-advance `onChange` map blocks — `AddWorkerScreen.tsx:957,975`.
- R1.17 — `SpanIntent = MarkIntent` kept for one importer — `MonthCalendar.tsx:52` —
  `HomeScreen` imports `MarkIntent` from `spans`.
- R1.18 — `const passportNumber = number` names all four numbers "passport" —
  `WorkerTerms.tsx:1185`.
- R1.19 — `EmployedSinceControl` rebuilds `DateField` — `WorkerTerms.tsx:1244` vs `:1342`;
  `DateForm`'s input class pasted three times — `HolidayPickerScreen.tsx:723,738,751`.
- R1.20 — comments on the wrong code: `MoneyCard`'s docblock sits on `MonthNote`
  (`HomeScreen.tsx:753`), `MonthFacts`' on `HospitalOvertime` (`types.ts:718`), the period's
  "null until she chooses" on `paidOn` (`MonthActions.tsx:1356`). Also seen by run 0 (R0.4).
- R1.21 — comments no longer true: `profile.ts:46` (five numbers, "stage 3");
  `profile.ts:396` and `workers/actions.ts:122` ("nothing can confirm a month yet");
  `workers/actions.ts:55` (`setPassportNumber`, "no control yet"), `:577`;
  `BeforeExportScreen.tsx:804` ("six", seven); `MonthCalendar.tsx:213` ("Seven", six);
  `month/actions.ts:59` ("three things"), `:582` (`/month`); "recorded in `CLAUDE.md`", now
  `DESIGN.md` — `HomeScreen.tsx:646,772,865`, `HolidayPickerScreen.tsx:47`.
- R1.22 — history R0.4 missed — `types.ts:793`, `WorkerTerms.tsx:7-9`,
  `MonthActions.tsx:1163`, `MonthCalendar.tsx:47,217`, `month/actions.ts:278`.
- R1.23 — (correctness, for run 2) `saveSpan` drops the error of its `before` read —
  `repository.ts:641` — the file's own rule is that every failure is raised.

Left alone: the file-per-concern docblocks (the repo's convention), and `className` arrays
joined for one conditional class — too small to be worth a commit.

## Run 2 — `mattpocock-skills:code-review`, 2026-09-18

Four areas × two axes, fixed point `9da6e03`, tests left out. The spec axis found mostly
behaviour gaps; those are under "Needs the user" (marked *run 2*), not here. Checked by hand
where marked ✓.

**Hard — a written convention broken**
- R2.1 ✓ — `dir="auto"` on a wrapper whose only child is `<Bidi>` — `MonthCalendar.tsx:478`,
  `WorkerProfileScreen.tsx:112`, `WorkersList.tsx:119`, `MonthActions.tsx:590,659,977,1278,1644`
  — the left-align trap `CLAUDE.md` names; drop it from the wrapper.
- R2.2 — bare text beside a node — `MonthActions.tsx:924`, `AppShell.tsx:373` (greeting re-renders
  every minute) — the translate `removeChild` crash rule.
- R2.3 — amounts inside a translatable sentence, no `translate="no"` possible —
  `MonthActions.tsx:664`, `BeforeExportScreen.tsx:892` — split the figure into its own element.
- R2.4 — inline shadow colour — `MonthStepper.tsx:10,62` — tokens live only in `globals.css`.
- R2.5 ✓ — Hebrew literals in a scraper — `scrape/religiousHolidays.ts:49-52`, shown by
  `HolidayPickerScreen.tsx:472` — one translations file.
- R2.6 ✓ — comments that are false — `export/template.ts:10` (`.gitignore` "must never ignore
  `*.xlsx`": the reverse holds); `monthSheet.ts:150` (holiday in sickness is drawn, item 10);
  `month.ts:448` ("says so with a warning": there is none); `rates.ts:55,77` (Saturday, not rest
  day); `holidayDates.ts:40` (`hasYear`); `lib/types.ts:477`, `store.ts:68`,
  `reports/file/route.ts:26` (Postgres "lands"/stage 3); rule numbers `workbook.ts:442` (9→10),
  `monthExport.ts:93` (11→12).
- R2.7 — history R0.4/R1.22 missed — about 24 "settled/decided on 2026-09-xx" in the engine
  (`balances.ts:406`, `beforeExport.ts:65,93,339,377`, `month.ts:13-17,98,414`, `incomeTax.ts:225`…);
  export (`monthSheet.ts:68,193,224,479`, `layout.ts:9,15,26,78`, `workbook.ts:428,474`,
  `reports.ts:154`); scrape (`incomeTax.ts:16`, `holidayList.ts:8`…); app (`reports/page.tsx:11`,
  `payslip/page.tsx:13`, `workers/[id]/page.tsx:20`); `build_plan.md` stage refs
  (`engine/repository.ts:45`, `types.ts:167,785`).
- R2.8 — comments on the wrong code — `monthExport.ts:89` (`niMonths` over `niPaidOn`),
  `monthSheet.ts:257`. Also seen by run 1 (R1.20).

**Judgement — smells**
- R2.9 — one series loop ~9 times, `listRates()` per worker — `app/page.tsx:83`,
  `payments/page.tsx:89`, `payslip/page.tsx:39`, `reports/page.tsx:41`, `workers/page.tsx:47`,
  `workers/[id]/page.tsx:55`, both file routes, `month/actions.ts:592` — `householdSeries()`.
- R2.10 — ISO-date check four ways — `today.ts:48`, `holidayAmendments.ts:39`, `profile.ts:132`,
  `month/export/actions.ts:81` (no round trip: `2026-02-31` passes) — one `isIsoDate` in `dates.ts`.
- R2.11 — after-total user line built by hand, repeating `toLine` — `month.ts:491-515`.
- R2.12 — export copies: `usedOf`/`closingOf`/`accruedOf` vs `balanceOf` (`monthSheet.ts:328`,
  `balancesSheet.ts:59`); note-into-`I` four times, hardcoded (`monthSheet.ts:378,427,450,462`);
  covered months worded twice (`reports.ts:295` vs `coveredMonthsLabel`).
- R2.13 — scrape copies: `collapse` inlined ×3 and `AS_OF` retyped (`religiousHolidays.ts:365,399`);
  empty-body guard in five parsers, not in `fetchPage`; `FetchedWage` = `CreditPointFetch`.
- R2.14 — dead or pass-through — `SheetLayout.addedLines`/`blockRows`/`taxRow` (`layout.ts:115-153`),
  `days()` (`balancesSheet.ts:74`), `export { lineKeys }` (`month.ts:18`, 12 importers).
- R2.15 — `userLinePrefixes[0]`/`[1]` by position — `notes.ts:565`, `month.ts:158`.
- R2.16 — `ReportKind` switched three times, a nested ternary — `reports/file/route.ts:40-87`.
- R2.17 — casts standing in for a type — `alertsView.ts:66-141` (11× `as LegalLinkKey`),
  `settings/holidays/actions.ts:220`, `alerts/actions.ts:24` (parsed, loosely guarded).
- R2.18 — revalidate lists disagree — `revalidateHolidays` omits `/payments`
  (`holidays/actions.ts:63`); `createWorker:649` repeats `revalidateWorker`.
- R2.19 — two `requireWorker`s, two errors — `store.ts:143`, `supabase/repository.ts:498`.
- R2.20 — fifth percent format — `payments/page.tsx:68` (R0.5); fifth input class —
  `AddWorkerScreen.tsx:435` (R0.2).
- R2.21 — the recorded-item row five times — `MonthActions.tsx:940,1178,1601,1833,1896` — and the
  file is 2,002 lines of six controls (for run 3).
- R2.22 — `12` as `DECEMBER`/`MONTHS_PER_YEAR`/bare in five files; year-bound shekel figures in a
  comment (`incomeTax.ts:109`); `?? SEEDED_RATES` defaulted in four places (`month.ts:595,616`,
  `balances.ts:481`, `series.ts:168`); `app/page.tsx:58` reads the clock beside `readToday`.

Dropped: the blank zero-tax cell (`monthSheet.ts:448`, chosen on purpose to match the family's
sheets); `{" "}` spacers (whitespace cannot crash).

## Run 3 — `mattpocock-skills:improve-codebase-architecture`, 2026-09-18

Followed by hand; hot spots from the last forty commits (the three repository files, the page
loaders, the action files). Report: `%TEMP%/architecture-review-20260918-204829.html`. Not
grilled — a candidate the user picks is grilled at step 7. Moving code changes no behaviour;
where a candidate touches a "Needs the user" question, the refactor still leaves the answer open.

- R3.1 **Strong** — one household replay module — `calculateSeries` is assembled by 12 callers
  (seven pages, `month/actions.ts:592`, `month/export/actions.ts:147`, both file routes,
  `alertsView.ts:184`), each re-reading months, rates and today; the home page replays each
  worker twice per request (itself, and the layout's `householdAlerts`). One
  `householdSeries()` / `monthInSeries(workerId, month)` under React `cache()`. Also R2.9, and
  retires R2.22's `?? SEEDED_RATES` defaults. Local-substitutable (in-memory store).
- R3.2 **Strong** — deepen the month's lifecycle — opening, changing and re-snapshotting a month
  live in `month/actions.ts:241,261`, `openMonth.ts`, `month/export/actions.ts:69,194`,
  `workers/actions.ts:135,330` (two `saveMonth` loops), `profile.ts:408,425` and
  `engine/repository.ts:282-352`. One "worker's months" module (`change`, `followProfile`,
  `confirm`) with the planning as its internal seam; the confirmed-month rule of "Needs the
  user" #1 then has one place to land. Builds on R3.1.
- R3.3 **Worth exploring** — the "is this save an edit?" rule leaks into both adapters —
  `stampFor`/`onlyTheExportMoved`/`touchMonthsOf` (`engine/repository.ts:446-487`),
  `touchMonths` (`supabase/repository.ts:521`) and triggers in four migrations; only the
  in-memory copy is unit-tested. Compute the stamp once above the seam, adapters store it.
  Needs a migration — after the two unapplied ones land.
- R3.4 **Worth exploring** — one recorded-entries module on the client — user lines, advances,
  third-party payments, overrides (`MonthActions.tsx:738,1028,1337,1715`) and standing lines
  (`WorkerTerms.tsx:507`) each re-implement row, action hook, refusal and panel. Collects
  R1.1–R1.3, R2.21; blocked in part on the user-line look question.
- R3.5 **Speculative** — `engine/repository.ts` holds four modules (`WorkerProfile`, 13
  importers; the port; the month-opening rules; the in-memory adapter). Mostly falls out of
  R3.2; alone it only moves code.
- R3.6 **Speculative** — four hand-kept revalidate lists, already disagreeing (R2.18): replace
  with one `revalidatePath("/", "layout")` rather than merge them.

Top recommendation: R3.1 — widest leverage for the smallest move, and R3.2 builds on it.

## Run 4 — `ponytail-review`, 2026-09-18

On `git diff 511d3ca~1 511d3ca`: 482 lines in, 1,416 out. The additions are the moves
themselves (`Field.tsx`, `requireWorker`, `toShekels`/`formatPercent` with their tests) and
un-exports; none adds a layer. What the cleanup left half-done:

- R4.1 — yagni: `MonthCalendar` now has one caller (`HomeScreen.tsx:346`), which passes every
  callback, yet `onMonthChange`, `onSelectRange`, `onClearRange`, `onSetHolidayWorked` and
  `onSelectDay` stay optional behind `?.` — `MonthCalendar.tsx:382,403,416,427,496` — make
  them required, call them directly, and pass `onMonthChange={onMonthChange}` instead of the
  wrapping arrow. `today`/`earliest` stay optional: `MonthStepper` has other callers.
- R4.2 — shrink: `const heading` is used once — `MonthCalendar.tsx:475` — inline it into
  `label=`, the comment moving with it.

Kept: `requireWorker`'s optional `repository` (callers reuse the store they already hold);
`toShekels` taking `undefined` (`reports.ts` passes `line?.amount`). Net: about −10 lines.

## Run 5 — `thermo-nuclear-code-quality-review`, 2026-09-18

Followed by hand over the four areas, structure only; what runs 0–4 hold is not repeated. It
found one reproduced money bug. That bug is under "Needs the user", and R5.1 is its structural
cause.

**Engine**
- R5.1 — the context's `rates`/`taxBrackets` are optional with a seeded fallback, and
  `calculateSeries` never passes them — `series.ts:204`, `month.ts:595,616`,
  `balances.ts:481` — make both required on `MonthContext`; the compile errors find every
  caller. Collects R2.22's `?? SEEDED_RATES`.
- R5.2 — spans belong to the worker, yet three places slice them onto months by overlap
  (`engine/repository.ts:372`, `supabase/repository.ts:690,710`, `series.ts:121`) and
  `everySpan` (`series.ts:87`) glues them back — hand the series the worker's spans once and
  let each month clip; `everySpan` and three filters go. It is also where the split-spell
  question of "Needs the user" would land.
- R5.3 — span order re-checked by every reader — `orderDates(span.from, span.to)` in
  `counts.ts:49`, `leave.ts:59`, `sick.ts:99,139`, `validate.ts:151`, `holidayDates.ts:31`,
  `holidayYear.ts:117`, `beforeExport.ts:186` — the writers order (`month/actions.ts:112,159`)
  and Postgres refuses the reverse (`spans_run_forwards`); order once in `closeSpans`
  (`types.ts:112`) and delete the rest. Check the fixtures for reversed spans first.
- R5.4 — one clip function twice — `clipToMonth` (`balances.ts:113`), `insideMonth`
  (`beforeExport.ts:180`) — one, in `spans.ts` beside `overlapsMonth`.
- R5.5 — the closing block has no draft layer: tax, user lines and advances each build a
  `ClosingLine` by hand with their own override, sign and rounding — `month.ts:449,496,530` —
  and already differ (only the user line keeps `calculatedAmount`). A `ClosingDraft` and
  `toClosingLine` beside `toLine`. Extends R2.11.
- R5.6 — rows carry no typed origin, so readers parse keys — `row.key.endsWith(".repaid")`
  (`monthSheet.ts:205`), `isUserLineKey` (`month.ts:119,122`, `monthSheet.ts:180,363`) — a
  `source` field set where the engine builds the row. With R2.15.
- R5.7 — the warnings live in `balances.ts` — five builders and `buildWarnings`
  (`balances.ts:306-486`, about 180 of its 486 lines), which import tax brackets and
  recuperation only to warn — move them to `warnings.ts`.

**App and lib**
- R5.8 — `saveProfile(profile, termsChanged)`: a flag picked by hand at 14 call sites and wrong
  at two — `setGender` (`workers/actions.ts:239`) and `setInsurer` (`:311`) pass `true`, yet
  neither is in `MonthTerms` — derive it by comparing `snapshotTerms` before and after, and
  the parameter goes.
- R5.9 — multi-writes that are not atomic — a profile change is `saveWorker` then one
  `saveMonth` per month, one at a time (`workers/actions.ts:141,330`), each with its own
  `requireWorker` round trip; `saveWorker` writes the worker, then the household
  (`supabase/repository.ts:600`); `touchMonths` sends one update per month (`:521`). A
  failure partway leaves months half re-snapshotted — one `saveMonths` upsert. R3.2 places
  the loops; this is their atomicity.

**Components**
- R5.10 — two more files past 1,000 lines besides `MonthActions` (R2.21): `WorkerTerms.tsx`
  1,377 (13 controls), `AddWorkerScreen.tsx` 1,206 — and they render the same terms twice
  (rest day, gender, tax mode with its note (R1.14), recuperation month, salary, supplement,
  opening position, documents). Share value/`onChange` fields: the wizard passes `change`, the
  profile passes `run(action)`. That takes both under 1,000.
- R5.11 — components of 400–580 lines — `HomeScreen` (`HomeScreen.tsx:125-703`: blockers,
  calendar card, skipped days, day panel, money), `MonthConfirmation`
  (`BeforeExportScreen.tsx:226-631`) — split along the sections the JSX already has.
- R5.12 — the alert card three times — `HomeScreen.tsx:291`, `AlertsScreen.tsx:119`,
  `Bell.tsx:115`, the law link in two of them — one `AlertCard` with a compact form.

Dropped: `he.ts` at 2,828 lines (one translations file is `CLAUDE.md`'s rule); `calculateMonth`
reading both `facts` and `month` (a nit).

## Sweep after F5 — `knip --production`, `jscpd`, test titles, 2026-09-18

Asked for by the user after F5; its three items were approved on 2026-09-19 and are on the
Fix list as F29, F30 and an addition to F14.

- R6.1 — dead but for their tests: `restDaysOf` (`dates.ts:286`), `holidayDaysRemaining`
  (`leave.ts:175`).
- R6.2 — `moveHoliday` and `setHolidayPart` open with the same eleven lines (state, then the
  holiday span or `entryUnknown`) — `settings/holidays/actions.ts:182,240`.
- R6.4 — (found while checking F6, 2026-09-19) the browser suite pins today with the
  `TODAY_COOKIE` (`requestToday.ts`), but the month's stamps read the real clock —
  `confirmedAt` (`month/export/actions.ts:249`), `exportedAt` (`month/export/file/route.ts:93`),
  and `repository.ts:394,485,699`. Once the real clock passes the pinned day, an export
  lands "in the future": `alerts.spec.ts:108,359` lose it from the ninety-day handled list,
  and `before-export.spec.ts:402` reads "אושר ב־19 בספטמבר". Fails identically on HEAD.
- R6.3 — "unreachable" tested once per scraper (a throw, an empty body, an error status) in
  four test files; once the guard is in `fetchPage` (F14) it is tested there once.

Seen and left: the unwired tax scraper and `pageSections` wait on "Needs the user"; 18
exports used only in their own file; shared test setup (`balances`/`series`,
`actionList`/`upcoming`) is a fixture to share, not a test to delete; the saved Kol Zchut
pages repeat the site's chrome by nature.

## Sweep after F28 — `knip`, `jscpd`, a read of the components, 2026-09-22

F33. `npx knip` and `npx knip --production`; `npx jscpd src --min-lines 12 --min-tokens 80`
(11 clones, 291 lines, 0.52%); then the components read for markup one component should hold.
Findings only — each is fixed as its own commit under the list's rules.

**Dead or over-exported** (`knip`, tests included, so these have no reader at all)
- S1 — **done 2026-09-23** — `followsProfile` is exported and read only inside its own file —
  `engine/profile.ts:467` — F28 added it as the one place the confirmed-month rule lives, and
  all three readers are in that file; R0.7 un-exported 54 of these.
- S2 — **done 2026-09-23** — `rateKeys` and `exportBlockKeys` were exported for nobody —
  `datedRates.ts:37`, `beforeExport.ts:325` — each is the source array its own
  `RateKey`/`ExportBlockKey` is derived from, and nothing iterates either at run time, so
  dropping the `export` leaves a value no code reads and lint warns on it. The rule is
  switched off for those two declarations with the reason beside them (`CLAUDE.md` rule 7),
  rather than the arrays deleted: the union is spelled in one place either way, and a reader
  of the rates will iterate it. These are the first two `eslint-disable` lines in `src`; the
  user chose the un-export knowing that (2026-09-23).

**Duplication** (`jscpd`, src only — the six test-file clones are the shared fixtures run 6
already left, not tests to delete)
- S3 — **done 2026-09-23** — the amount field — `<Field>` + `inputMode="decimal"` + `dir="ltr"` +
  `he.placeholder.amountInput` + `inputClass` — is written 13 times across five files —
  `MonthActions.tsx:356,778,1027,1426,1715`, `WorkerOpening.tsx:146,399,410`,
  `MonthConfirmation.tsx:215,294` (which builds `Field`'s own label markup by hand),
  `AddWorkerSteps.tsx:657,671` — one `AmountField` in `Field.tsx`, which already holds the
  field's shared parts (F15). **The wizard's two stay out**: they take its own `Field`, the one
  with a `refusal` prop at the wizard's larger scale, which F24 kept apart on purpose. Eleven
  sites, not thirteen. `MonthActions.tsx:572` stays out too — its placeholder is a percentage
  when the mode says so.
- S4 — **done 2026-09-23** — the panel's save/cancel pair is written four times in one file, identical to the
  character — `MonthActions.tsx:827,1039,1496,1727` — `outlineButtonClass` + `cancelClass` +
  `open === "new" ? words.submit : words.save`; one `PanelButtons` inside the file changes no
  screen. The fifth, `WorkerOpening.tsx:188`, uses the filled button and is the look question
  F27 waits on — it stays out.
- S5 — **done 2026-09-23** — the money row's `.map` twice per screen — `HomeScreen.tsx:712,753`,
  `PayslipScreen.tsx:321,350` — the withholding rows and the transfer rows draw the same row
  from the same shape; one local `rowsOf(lines)` per screen, each keeping its own size.
- S6 — **done 2026-09-23** — the wizard's refusal paragraph, hand-built three times —
  `AddWorkerSteps.tsx:180,215,691` — `Field.tsx` exports `RefusalLine`, but at 13px against
  the wizard's 14px, so this is the wizard's own one-line component and not that one (F24
  kept the two scales apart on purpose).
- S7 — **done 2026-09-23, and F27 with it** — also seen here: `StandingLinesControl` still copies `UserLinesControl` for 61 lines,
  the largest clone in `src` — `MonthActions.tsx:684`, `WorkerOpening.tsx:78` (the file R1.1
  named as `WorkerTerms.tsx:507`) — F27, blocked on the look question; the state /`reset`
  /`openEdit`/`submit` hook is the 61 lines, and the looks are not.

- S8 — **found while fixing S3, and done with it, 2026-09-23** — the note field — `<Field>` +
  `dir="auto"` + `inputClass` — is written seven times across two files —
  `MonthActions.tsx:393,805,1000,1434,1649`, `WorkerOpening.tsx:154,384` — one `NoteField` in
  `Field.tsx`, beside `AmountField`. It is not the amount field and S3 did not name it: `jscpd`
  only reported it once the amount field and the button pair had gone and what was left of each
  panel fell under its twelve-line floor. With it, `src` has no `tsx` clone left at all.

Seen and left: `MonthActions.tsx` at 1,937 lines (R2.21, inside F27); the unwired income-tax
scraper's five exports (F36); nine exported types read only in their own file, and the
`scripts/` live checks and `e2e` fixtures `knip` cannot see (run 0 left both).

## Needs the user

- **The household's rates never reach a month's calculation** (run 5, reproduced) — **done as
  part of F26 on 2026-09-22.**
  `calculateSeries` (`series.ts:204`) builds each month's context without `rates` or
  `taxBrackets`, so every page takes the minimum-wage warning, an unconfirmed month's
  recuperation rate, the NI estimate and the credit point from the seeded table, never the
  household's confirmed or fetched one. Reproduced: with a household minimum wage of ₪7,000
  from January 2026, a February month at ₪6,247.65 gets `belowMinimumWage` from
  `calculateMonth` but no warning from `calculateSeries` over the same table. Fixing it moves
  figures for any household whose table departs from the seed. **Answered 2026-09-20: fix as a
  bug, inside F26** — making both required on `MonthContext` is R5.1, and its compile errors land
  on the twelve callers F26 replaces, so paying it separately would be paying it twice.
- **A profile change restates confirmed months** (run 1). `saveProfile`
  (`workers/actions.ts:141`) re-snapshots the terms of *every* month through
  `monthsFollowingProfile` (`profile.ts:408`), which has no confirmed-month check: it was
  written when no month could be confirmed, and stage 7 made `confirmedAt` real. So changing the
  rest day, the tax mode or a standing line now rewrites months already filed — against
  `CLAUDE.md`'s "changing it never restates a month already filed". `profile.test.ts:246`
  still asserts the old rule. The fix changes behaviour: skip months with `confirmedAt`? And
  what about a *corrected* month (edited after confirming)? *Run 2:* `setSalaryChange` does the
  same through `monthsReachedBySalaryChange` (`profile.ts:425`) — against item 2's "never a
  restatement of months already paid". **Answered 2026-09-22: a month with `confirmedAt` is
  skipped, and a month corrected after confirming stays out too — a correction is a specific
  one and following the profile would undo it.** Fix as a bug, inside F28.
- **A rest-day change crashes the month when a free rest day is marked** — answered
  2026-09-19: `specs.md` item 5 now says what happens, and the work is `build_plan.md`
  stage 8½, after this stage.
- **Every refusal reaches the user as a crash and not as the sentence it was written to be**
  (found 2026-09-22, while unblocking the rest-day bug). `InvalidMonthError` carries `refusals`,
  each with a `message` written in Hebrew for the user to read — the sick-balance floor, the
  holiday entitlement, two marks on one day, a free rest day on the wrong day. Nothing renders
  any of them. `calculateMonth` throws, `calculateSeries` propagates, and the seven pages that
  replay have no boundary: `src/app` holds no `error.tsx` and no `global-error.tsx` at all. So a
  refusal the engine states carefully arrives as a stack trace, which is the opposite of
  "refused with a reason and named… worth saying out loud rather than deducting in silence".
  Stage 8½ removes one cause of one refusal; it leaves every other refusal arriving the same
  way. **Answered 2026-09-22: a card above the figures.** Where nothing can be computed the
  card stands alone and the calendar stays usable, since the calendar reads the marks and not
  the engine, and the mark she must correct is on it. It owes a PRD before any code (rule 2)
  and is not a stage 8 item; `DESIGN.md` and the canvas draw no such card.

**The nine marked GO/NO-GO below are findings `specs.md` already decides**, so each needs only
a yes to fixing it in stage 8 or a deferral — no design question is open in any of them, and one
answer covers all nine. Until that answer comes they stay here and off the Fix list (rule 1).

- **GO/NO-GO** — **The income tax is never confirmed, and a month exports unconfirmed** (run 2 ✓). The
  before-export screen has no tax card; `confirmMonth` stores `taxToConfirm`
  (`month/export/actions.ts:246`) unseen — against "confirmed before every export". And the file
  route checks only `blocksExport` (`month/export/file/route.ts:58`), never `confirmedAt`; the
  payslip and `/reports` link straight to it.
- **GO/NO-GO** — **A year with no tax table shows zero silently** (run 2 ✓) — `month.ts:448` folds `null` to 0
  with no warning; spec: "leaves the line at zero and says so".
- **Sickness split into two spans restarts its tiers** (run 2, reproduced) — **answered
  2026-09-20: fix as a bug; done as F35 on 2026-09-22.** The spec already decides it ("a spell crossing the end of a
  month needs no gesture"), so nothing was open but the approval. 28–31 Aug + 1–3 Sep as two
  spans: September deducts two days (−₪499.81) as a new spell, because the month is handed only
  the spans overlapping it and `spellsOf` never sees August's.
- **GO/NO-GO** — **A salary before the rate table is checked against today's minimum** — `salary.ts:95`
  (`atFrom ?? now`) (run 2 ✓); spec: such a month "has no figure… says nothing".
- **GO/NO-GO** — **The two-worker limit is not checked in `createWorker`** (run 2 ✓) —
  `workers/actions.ts:627`; Postgres throws unhandled, the in-memory store accepts a third.
- **GO/NO-GO** — **`/month/export` awaits a live fetch, and no scraper has a timeout** (run 2) —
  `month/export/page.tsx:49`; spec: "a slow or broken source never delays a screen".
  **What a failed fetch shows, answered 2026-09-22:** the cached figure, said plainly to be
  cached because the fetch did not answer, put to her as "is it still this?" — with the option
  to enter it by hand instead, and a way back out of that. It is the minimum wage this was
  asked about; whether the same shape serves the other fetched figures is not settled.
- **Rates are written to the caller's oldest household** (run 2, read only) — `saveRate`,
  `saveHolidayList` via `householdIdOf`; a member of two households can move another's figures.
  And confirming overwrites a fetched rate's source URL (`export/actions.ts:233`, unconfirmed).
  **Answered 2026-09-22, and it is larger than the finding: the rates table and the holiday list
  belong to the *worker*, not to the household — two workers of one household may hold
  different ones — and the user may return to the source URL at any time, entering a rate by
  hand or fetching it again.** That is a schema change, a migration and a spec change, so it
  owes a PRD before any code (`CLAUDE.md` rule 2) and does not belong in stage 8.
- **GO/NO-GO** — **The sheet's gendered wording is fixed** (run 2) — `he.ts:2525` `"עובד/ת"`, and the
  template's `I1`, `F1`, `G1`, `B7`, `B9` are feminine; spec 1304 fills them from the profile,
  which now has `gender`.
- **Three template labels name Friday/Saturday** (run 2) — `F1`, `F3`, `B23`; spec 1246-1249's
  list of placeholder cells leaves them out, so the spec needs a decision too. **Answered
  2026-09-22: the wording follows the day the worker actually rests.** No second template is
  needed — the labels are written into the cells at export, as the month sheet's other
  rest-day wording already is. The spec's placeholder list still needs the three cells added,
  which is a `specs.md` edit and is put to the user with its exact wording first.
- **GO/NO-GO** — **The fetched page text is not kept** (run 2) — `refreshMinimumWage` drops `text`,
  `fetchArticleSections` is uncalled, no table exists; spec 1344, and Stage 9 relies on it.
- **GO/NO-GO** — **Override and hospital-overtime notes never reach column I** (run 2) — `notesOf`
  (`notes.ts:40`) skips them; item 2 writes every action's note.
- **GO/NO-GO** — **An advance can be removed but not edited** (run 2 ✓) — spec 781-786 corrects it "by editing
  the entry".
- **The "your answer disagrees with the month" card** (run 2, unconfirmed) —
  `BeforeExportScreen.tsx:277,509`; not in `specs.md` or `DESIGN.md`. **Answered 2026-09-22: it
  is wanted, but as a popup error and not a card** — what it reports is a conflict between what
  she confirmed and what the calendar holds, which is a refusal rather than a note beside the
  figures.
- **One user-line panel, two looks** (R1.1). `/payments` shows why each placement is chosen
  and uses outlined buttons; `/settings` shows no hint and uses filled ones. **Answered
  2026-09-22: the `/payments` look, if they are merged at all — but the merge itself is
  questioned, because `/payments` shows the current state and `/settings` is where things are
  adjusted, which is two jobs and not one.** F27 therefore needs a decision on whether to merge
  before it needs a look.
- **The national-insurance quarter is worded two ways** (F13, 2026-09-19). The month sheet writes
  the covered months as a range, "אפריל 2025 – יוני 2025" (`coveredMonthsLabel`); the
  national-insurance report lists each, "אפריל 2025, מאי 2025, יוני 2025"
  (`reports.ts:170`, asserted by `reports.test.ts:156`). One wording changes a cell of one
  file. **Answered 2026-09-22: the range.** The report reads `coveredMonthsLabel` like the
  month sheet does, and `reports.test.ts:156` moves with it.
- **The income-tax scraper is not wired** (run 0). `fetchTaxBrackets` and
  `fetchCreditPointValue` in `src/lib/scrape/incomeTax.ts` are called by nothing, while
  `specs.md` Part 1 says the brackets and the credit point's value "are fetched per year and
  cached like the minimum wage". **Answered 2026-09-22: its own step on this list, placed
  immediately before F32 (`/doctor`).** On the list below as F36.

## Fix list

Written at step 6, approved at step 7, executed at step 8.

One item is one commit. `pre-commit` (typecheck, lint, unit suite) is every item's floor, and
the check named is the one that shows nothing changed. "Unedited" means the tests pass without
a single line of them changed, imports aside. **Browser** means the full browser suite
(ground rule 6). Nothing in runs 1–5 contradicted `CLAUDE.md` or `specs.md` beyond what each
run had already dropped.

**A. Deletions**
- [x] 2026-09-18 `e9dc38a` F1 — false and misplaced comments — R1.20, R1.21, R2.6, R2.8 — check: the diff touches
  only comment lines.
- [x] 2026-09-18 `7701497` F2 — history comments, including the year-bound figures at `incomeTax.ts:109` and the
  `build_plan.md` stage refs — R1.22, R2.7, R2.22 — check: comment lines only.
- [x] 2026-09-18 `45e83f9` F3 — dead and pass-through code: `SheetLayout.addedLines`/`blockRows`/`taxRow`,
  `days()`, `export { lineKeys }` (the 12 importers read `lines.ts`), `SpanIntent`, `const
  heading` — R2.14, R1.17, R4.2 — check: `knip` reports nothing new; export suite unedited.
- [x] 2026-09-18 `9a0dcda` F4 — optional props and casts the types already cover: `MonthCalendar`'s five callbacks
  required, the casts of R1.15, `LegalLinkKey` typed in `alertsView.ts` — R4.1, R1.15, R2.17 —
  check: Browser.
- [x] 2026-09-18 `2fb135e` F5 — nested ternaries and if-chains become records — R1.7, R1.14 — check: Browser.
- [x] 2026-09-19 `8db910b` F29 — `restDaysOf` and `holidayDaysRemaining` deleted with their tests — R6.1 — check:
  `knip --production` no longer lists them; the rest of the unit suite unedited.

**B. Written rules restored** — each fixes a sentence of `CLAUDE.md`; on screen, only alignment
and translation can change.
- [x] 2026-09-19 `5fca141` F6 — `dir="auto"` off `<Bidi>` wrappers, bare text wrapped, amounts in their own
  `translate="no"` element — R2.1, R2.2, R2.3 — check: Browser; screenshots of one fixed row
  before and after (right edge).
- [x] 2026-09-19 `af5ffb3` F7 — the shadow colour becomes a token, and the scraper's Hebrew moves to `he.ts` — R2.4,
  R2.5 — check: Browser; the holiday picker shows the same names.
- [x] 2026-09-19 `26a6d51` F8 — `saveSpan` raises the error from its `before` read — R1.23 — check: unit suite;
  only the failure path changes.

**C. Duplication**
- [x] 2026-09-19 `ca707d0` F9 — `amountFieldValue` moves to `money.ts` with tests; the fifth percent format goes
  through `formatPercent` — R1.5, R2.20 — check: `money.test.ts` with hand-worked figures;
  Browser.
- [x] 2026-09-19 `681293b` F10 — one `isIsoDate` in `dates.ts`, `monthNumberOf` replaced by
  `reviewDate`+`monthOf`, `12` named once, `app/page.tsx` reads `readToday` — R2.10, R1.13,
  R2.22 — **tightens one check:** `2026-02-31` is refused on the export form instead of
  passing — check: `dates.test.ts`; Browser.
- [x] 2026-09-19 `1f9c6af` F11 — `isOneOf`, one recuperation-month check, `nextAdvanceNumber` reused, one
  `requireWorker` error — R1.12, R1.11, R1.10, R2.19 — check: profile and repository suites
  unedited.
- [x] 2026-09-19 `f02acf9` F12 — span order settled once in `closeSpans`, one clip function, `holidayStateOf`
  exported — R5.3, R5.4, R1.6 — check: unit suite unedited; `orderDates` appears once in
  `src/lib/engine`.
- [x] 2026-09-19 `65d0ae4` F13 — the export's copies (`balanceOf`, the note into `I`, `coveredMonthsLabel`) and one
  `ReportKind` table — R2.12, R2.16 — check: export suite and `agreement.test.ts` unedited.
  `coveredMonthsLabel` was left: it changes a cell (see "Needs the user").
- [x] 2026-09-19 `735e45d` F14 — the scraper's copies: `collapse`, `AS_OF`, the empty-body guard moved into
  `fetchPage`, and one fetch type; the per-scraper "unreachable" tests fold into one set on
  `fetchPage` — R2.13, R6.3 — check: the parsing tests on the saved pages unedited; each
  failure kind still tested once.
- [x] 2026-09-19 `47f92a3` F31 — a stamp takes its day from the same pinned today the
  request reads, so the suite no longer depends on the real date — R6.4 — check: the three
  specs pass with the real clock past the pinned day. In production nothing moves: `todayFor`
  refuses the cookie there, so a stamp still reads the real clock.
- [x] 2026-09-19 `e13d95a` F30 — one helper for the holiday actions' shared opening — R6.2 — check: unit suite
  unedited; Browser (holiday picker).
- [x] 2026-09-19 `2f86a79` F15 — `Field.tsx` gains the button and input classes with their disabled states;
  `DateField`, `Refusal` and `RuleLink` are shared — R1.9, R1.19, R2.20, R1.3, R1.4 — check:
  Browser. The wizard's own input class (R2.20's fifth) stays: it is the wizard's larger
  field, not a copy. The settings screen's filled button stays apart: it has no focus ring,
  and giving it one changes the screen.
- [x] 2026-09-19 `d554393` F16 — one `useAction<R>` hook, the picker reset as one helper, one opening-advance
  `onChange`, the number named for what it is — R1.2, R1.8, R1.16, R1.18 — check: Browser.
- [x] 2026-09-19 `2eb1973` F17 — one `AlertCard`, with a compact form for the home strip and the bell — R5.12 —
  check: Browser; screenshots of `/` and `/alerts`. Done as `AlertTitle` and `LawLink`, the
  parts the three cards repeat: their layouts share nothing else, and one card drawing all
  three would take a prop per difference. `/`, `/alerts` and the bell's panel screenshot
  identical before and after.

**D. Structure**
- [x] 2026-09-19 `e9c7f95` F18 — the closing block gets drafts: `ClosingDraft` and `toClosingLine` beside `toLine`,
  and a typed `source` on every row replaces key parsing and prefix positions — R5.5, R2.11,
  R5.6, R2.15 — every row keeps today's output, `calculatedAmount` included — check:
  closing-block, overrides, August 2025 and agreement suites unedited. Two lines of test
  code had to move with it: `overrides.test.ts`'s two hand-built rows gain a `source`, and
  `agreement.test.ts` calls `isUserLine(line)` for `isUserLineKey(line.key)`; no expected
  figure changed. The tax row and the advances now carry `calculatedAmount` when replaced,
  as every column line does; neither is overridable, so no screen reads it.
- [x] 2026-09-19 `164bc64` F19 — the warnings move from `balances.ts` into `warnings.ts` — R5.7 — check: unit suite
  unedited.
- [x] 2026-09-19 `9d4d996` F20 — `saveProfile` works out `termsChanged` by comparing `snapshotTerms` before and
  after — R5.8 — **`setGender` and `setInsurer` stop re-saving every month** — check: profile
  suite, plus one new test that a gender change writes no month (from `MonthTerms`' own
  field list). `termsDiffer` in `profile.ts`; `saveProfile(before, after)`.
- [x] 2026-09-19 `dcc30c6` F21 — one `revalidatePath("/", "layout")` replaces the four lists — R3.6, which fixes
  R2.18 — check: Browser; a holiday change shows on `/payments` without a reload. It
  showed (a half day took April's worked holiday from ₪439.74 to ₪219.87, after Back and
  after the nav) — and did at HEAD too, so R2.18's stale screen never reproduced.
- [x] 2026-09-19 `dc466f0` F22 — one `saveMonths` upsert, and `touchMonths` as one statement; no migration — R5.9 —
  check: repository suite; Browser against the live e2e household. The suite never reaches
  Postgres, so the Supabase statements wait on the user's own signed-in check.
- [x] 2026-09-20 `981c956` F23 — the worker's spans reach the series once and each month still clips to what
  overlaps it, so the split-spell answer stays open — R5.2 — check: unit suite unedited.
  Narrow scope, chosen by the user 2026-09-20: the series clips; the two stores keep
  assembling a month's spans, so the three filters stay and go with R3.1/F26.
- [x] 2026-09-20 `6dec7f1`+`971198b` F24 — the wizard and the profile share their field components, and both files end
  under 1,000 lines. May take two commits: the fields, then the wizard — R5.10 — check:
  Browser (add-worker and profile flows). Split, not shared: the two draw the same terms at
  different scales and wirings (`Field`/`ChoiceGroup` at 18px against `Field.tsx` at 15px),
  so a shared control would have been one component with a flag for which screen it is on.
  `Field.tsx` was already common. `WorkerOpening.tsx` 461 + `WorkerTerms.tsx` 927;
  `AddWorkerSteps.tsx` 903 + `AddWorkerScreen.tsx` 364.
- [x] 2026-09-20 `0f262c8` F25 — `HomeScreen` and `MonthConfirmation` split along their existing sections — R5.11 —
  check: Browser. `HomeSections.tsx` 236 (the blockers and the balances rail) leaves
  `HomeScreen.tsx` 817; `MonthConfirmation.tsx` 734 leaves `BeforeExportScreen.tsx` 200.

**E. Reproduced money errors** — approved 2026-09-20 out of "Needs the user"; each moves a
figure, and each is a bug against a rule `specs.md` already states.
- [x] 2026-09-20 `decbea1` F34 — a rest day the spell bridged is not paid — `counts.ts` counts it out of
  `restDaysWorked` by spell membership and not by the marks — check: `spell-gap.test.ts` gains
  the rest-day line, which reads 213,175 at HEAD and 170,540 with the fix — the ₪426.35 a
  bridged Saturday was paid while the balance drew the same day.
- [x] 2026-09-22 `4822355` F35 — a spell is one spell across a month boundary: the series decides the
  spells over the worker's whole set and hands each month the run that led into it, as one
  closed sick span ending where the month's own spans begin — check: `series.test.ts` gains
  the split spell, whose September reads −51,551 at HEAD and no deduction line with the fix —
  the ₪515.51 a family was charged for putting the second mark in September.

**F. Architecture — grilled at step 7 before any code**
- [x] 2026-09-22 `4f7dd3a` F26 — one household replay module under `cache()`, with the rates fix folded in
  — R3.1, R2.9, R5.1, R2.22's `?? SEEDED_RATES` — check: Browser, and `series.test.ts` gains the
  household whose confirmed ₪7,000 never reached its months. `src/lib/householdSeries.ts` holds
  `householdSeries` / `workerInSeries` / `monthInSeries`; ten of the twelve callers read it.
  Two still walk their own and say why: `/month/export` values the household against the table
  its own fetch just returned, and `taxToConfirm` walks months with the tax set aside.
  `MonthContext.rates` and `.taxBrackets` are required, with `AS_SHIPPED` the one named way to
  ask for the seed.
- [x] 2026-09-23 F27 — the recorded-entries module on the client — R3.4, R2.21, R1.1 — **the two
  panels do not merge** (the user, 2026-09-22): `/payments` shows the current state and
  `/settings` adjusts, which is two jobs. Both looks stand; what is shared is
  `src/components/useUserLineForm.ts`, generic over the refusal because the two screens'
  actions answer with different ones, and taking one `save(open, draft)`. `MonthActions.tsx`
  is 1,854 lines, not 1,937 (R2.21 is smaller, not gone).
- [x] 2026-09-22 `be4511f` F28 — the month-lifecycle module, and the confirmed-month rule it had nowhere
  to land — R3.2, R3.5 — `followsProfile` in `profile.ts` is the one place the rule lives, read
  by `monthsFollowingProfile`, `monthsReachedBySalaryChange` and `strandedFreeRestDays`;
  `src/lib/openMonth.ts` becomes `src/lib/workerMonths.ts` and absorbs the two `listMonths` +
  `saveMonths` loops that sat in `workers/actions.ts` — check: `settings.spec.ts:292` on the
  `filed` seed — March 2026 filed at ₪400 of supplement stays there while May moves from ₪500
  to ₪1,000 — plus three unit tests that each fail when the predicate is neutered.

**G. Last**
- [x] 2026-09-23 F33 — **swept 2026-09-22; S1–S8 closed 2026-09-23** — (added 2026-09-19 at the user's request) a last sweep once F19–F28 are through:
  `knip --production` for dead code, `jscpd` over `src` for copied blocks, and a read of the
  components for markup repeated where a shared component should stand. Findings go into a
  "Sweep after F28" section in rule 3's one-line form and are fixed one commit each, under
  the same rules as the list; a finding that changes a screen goes under "Needs the user" —
  check: `knip` and `jscpd` report nothing the sweep left unexplained.
- [x] 2026-09-23 F36 — (added 2026-09-22 at the user's request) wire the income-tax scraper —
  `fetchTaxBrackets` and `fetchCreditPointValue` in `src/lib/scrape/incomeTax.ts` are called by
  nothing, while `specs.md` Part 1 says the brackets and the credit point's value are fetched
  per year and cached like the minimum wage — check: a year's brackets are fetched, cached and
  read by a month's tax, and the suite reads a saved page rather than the network (Part 4).
- [ ] F32 — `/doctor` (added 2026-09-19 at the user's request) — a built-in Claude Code
  command, so the user runs it and the session acts on what it reports; a finding that is
  not a setting goes under "Needs the user" — check: `/doctor` reports nothing left to fix.
- [ ] F37 — (added 2026-09-22 at the user's request) **strip the history out of `specs.md`.**
  The file carries its own changelog, against `CLAUDE.md` rule 3: these files describe only
  what stands now, and how a rule came to be what it is belongs in the commit message. What
  goes is every sentence that dates or narrates a change — "This reverses the rule that stood
  until …", "was until …", "before then …", "this reversed on …", and the attributions
  ("decided with the user on …", "asked for by the user on …"). What is left is the rule in
  force, worded as though it had always been the rule.

  **What the sweep must not touch**, because it looks the same and is not: Part 4's August
  2025 case and its four totals, which are the only figures a test may measure the engine
  against; the dated rates' own effective dates, which are content; and any date that is an
  example inside a rule. A deletion that would change what the application does or must prove
  is not part of this and goes under "Needs the user" instead.

  **Every deletion is put to the user first** (rule 1), quoted exactly, as one batch for one
  yes rather than one question per sentence — the sweep is a single decision the user has
  already described, and the batch is what makes it reviewable. The step is sized when it is
  reached, not before — check: no date, attribution or "used to" survives in `specs.md`
  outside the three exceptions above, and the part reads as one statement of what stands.

**Not on the list**
- R3.3 — needs a migration, so it waits until the two unapplied migrations are live.
- R3.5 — fell out of F28 (2026-09-22).
- R5.1 and R2.22's `?? SEEDED_RATES` — done inside F26, which is where making the rates
  required and fixing "the household's rates never reach a month" turned out to be one move.
