# Stage 8 — the review file

The working file of stage 8 (`build_plan.md`). Eight review runs produced the **Fix list** at
the bottom, which was then executed item by item; **all sixty-four are done as of 2026-09-26**.
What is left is not work but proof: four checks only the user can run. It is deleted when stage 8
closes; what it found lives on in the commits, which is why the finished parts are one line here
and not a narrative.

## Resume here

A fresh session told "continue with `docs/stage8-review.md`" reads this file whole and does
**the next step below, and only that step**. At the end of the step it updates this block and
the plan table, then stops and reports to the user.

**This file holds only what is not finished.** A step that lands is compressed to one line —
its name, its date, its commit — the same day, because every future session is charged for
whatever stays. What a step found, why a control looks as it does, and what its tests would
catch live in the commit, in the code and in `specs.md`, each read by whoever needs it rather
than by everyone. The one thing that survives a finished step is what it left **unfinished**.

### → The next step

**Nothing is open in stage 8 but the user's own checks.** The Fix list is complete: F32 closed
2026-09-26 when `/doctor` was re-run and everything it proposed was applied. There is no step 11.

**What a fresh session does: nothing but offer the four checks below** and wait. It does not
start new work in this file, and it does not delete the file — closing stage 8 is the user's call.

**The connector question is answered, and it cost no work.** `/doctor` found no Claude Docs
connector to remove: it is in no config file, a session's tool roster carries no Docs tools, and
across 50 transcripts over 2026-09-16 to 09-26 there is not one Docs call — the only MCP server
ever invoked is `claude_design`, 12 times. The 2026-09-25 "connector removed" claim was withdrawn
as too thin; the correct finding is that there was nothing there. **Do not hunt for the setting
again, in the config or in claude.ai.**

**What `/doctor` fixed on 2026-09-26**, all of it user-scope and reversible from
`~/.claude/settings.json.bak-20260926-223200`: Claude Code 2.1.282 → 2.1.283, four unused skills
off (`thermo-nuclear-code-quality-review`, `plan`, `next`, `onboard`) and the `code-simplifier`
plugin disabled — about 165 est. tokens a session. Auto mode was already the default and stayed.
**Checks 0 and 2–5 found nothing**: one clean install, all five config files parse, no broken or
colliding skill and agent frontmatter, no local `CLAUDE.md` to dedup, no Claude Code hooks, and
`CLAUDE.md` already lean at 22,796 chars against a ~40,000 threshold — nothing to cut or migrate.
**Check 9 proposed no permission rule**: all ten denials in the window were writes, interpreters
or carried pipes and redirections, so none clears the read-only bar.

**Two F32 findings stay open under "Needs the user" and neither is a repository change** — the
project registered twice in `~/.claude.json`, and `Bash(python -c ' *)` allowed at user scope.
The `/doctor` run confirmed both still live, and confirmed the second buys nothing anyway: the
denials show the heredoc form `python - <<'PY'` never matched that pattern.

### Standing rules, in force for every step

- **Never push.** The user decides that.
- **Ask before every commit** (said 2026-09-18). Report what is staged and wait.
- **After a commit, this file's header is corrected to name it, and that one change is left
  uncommitted** — her standing instruction of 2026-09-25 is to **fold it into the next commit**
  rather than commit it alone. Do not commit it on its own and do not revert it.
- **A run measures one code state and nothing else.** A source file written while the suite is
  going makes the dev server recompile underneath it, and the run that follows is evidence of
  neither state. One such run was discarded on 2026-09-25 and re-run clean; its six "failures"
  were all `worker process exited unexpectedly`, which is a crashed browser and never an
  assertion.
- **A per-file run is not evidence for a batch.** The whole-suite run before `591a67b` found
  F62's regression — five failures in two spec files F62 never touched.
- **A browser failure** is checked by rerunning it alone, and against HEAD with the change
  stashed. The `auth.setup.ts` server log "The destination stream closed early" is noise.
  **The switcher flake's mechanism is known** (found 2026-09-22): `stepUntilShowing`
  (`e2e/household.ts:84`) presses "next" **once** and then asserts, so a press landing before
  hydration does nothing and the assertion waits out its five seconds on the *first* worker's
  name — which is why it names "האנה מונטנה Hanna Montana" and looks like stale data rather
  than a lost click. `openSettingsGroups` twenty lines below already retries for that reason.
  Retrying the press would end it; that is test code, not product, and not on the Fix list.
- **The migrations are live.** `npx supabase db push` was run twice on 2026-09-24, the second
  time for F42's `cached_pages`, and `migration list` shows every local migration remote.

### The rule-8 checks — all run and passed

**Every check stage 8 owed has been run by the user and passed.** Nothing here is re-run and
nothing is re-asked; a check is recorded the day it passes, or it is silently re-owed for ever.

| Check | Owed by | Passed |
|---|---|---|
| A refused month: the card names the month and the doubled day, the calendar keeps its marks without figures, `/דוחות` offers no file — and clearing the sweep brings August and September back | step 7, `9c52ca4` | 2026-09-27 |
| `cached_pages` holds the wage row with a title and non-empty `sections`, and reopening the screen does not grow the row count | F42, `b0f3514` | 2026-09-27 |
| F46's draft-month export gate and its income-tax card; F44's advance correction and the refusal below what is repaid; and the five before them — a pre-April-2025 salary change, the gendered wording in `B10`, `F29`, `G1`, `B9` and `I1`, and both notes in column I | F38–F46 | 2026-09-27 |
| A holiday marked signed in stores | `43e0d5a` | 2026-09-27 |
| Step 1's check | step 1 | 2026-09-26 |
| The ₪300 recurring deduction over three months | step 8, `f56f602` | 2026-09-26 |

**Stage 8 owes no further proof.** What survives it is one user-scope setting that is not a
repository change at all — `Bash(python -c ' *)`, still allowed at user scope. The `/workers`
refusal decision that used to stand here was taken and built on 2026-09-27 (see "Settled" below).
**The duplicate project registration is fixed**: `~/.claude.json` keeps
`D:/school/LLM vibe coding/EaseSalary` and the lower-case twin was removed on 2026-09-27 at the
user's instruction. Sessions open the project with that spelling, since the key is the exact
string and a differently-cased path makes a second entry.

### Settled — do not reopen, do not ask again

- **Where the refusal card goes on a screen that lists both workers was her decision, and she
  took it on 2026-09-27.** Both screens now raise the refusal in sight instead of failing whole,
  and neither states a balance for a refused worker — the compact card, the grid and the status
  chip she withheld, and the way back to the calendar are each a row of `DESIGN.md`'s refusal
  table marked "(the user, 2026-09-27)". `e2e/refusal-card.spec.ts` holds it through the browser.
  A session does not redesign it: a change to what those two screens draw for a refused worker is
  hers again.
- **Whether `specs.md` should be shorter** — answered 2026-09-26. Lever 1 (the Part 2 index) and
  lever 3 (three narrow cuts) are built; lever 2 was refused, because moving items 17 and 20's
  screen prose to `DESIGN.md` would put a behavioural rule where no test-writer looks. **No
  further compression is on anyone's list.** The measurement that settles it, so nobody
  re-measures: 614 sentences over 60 chars, **zero exact duplicates**, 23 of 23,069 twelve-word
  phrases repeated. The file is not padded.
- **`specs.md` never says "agorot".** The integer representation of money is `CLAUDE.md`'s own
  convention and its citation says so. **Nothing is owed to `specs.md` for it.**
- **F59 owes no `specs.md` sentence**, whatever the Fix-list entry says; nothing was asked and
  nothing should be.
- **`סמן כטופל` is one press per month and never one that answers them all** (asked and decided
  2026-09-25): it removes a month's warning for good and cannot be undone from the screen.
- F48's sweep **joins the suite** (preserved at `e2e/contrast-sweep.parked.ts`, which the suite
  ignores until it is renamed); `useAction`'s dropped second press is **kept**; the refused
  download **redirects to the screen that draws the card**; the mark panel's busy state is
  decided where the finding is; **R8.15 is withdrawn as wrong** — `checkBracketsPlausible` *is*
  called, inside `parseTaxBracketsPage`.
- Where stage 8¾ sits; the sign-off on step 1; which household the broken one is — the live
  Postgres one, and she is no longer locked out of it.

### Done and committed

**These are the step numbers of "the order from here", which is what the next-step block above
counts in.** "The plan" table further down numbers the same work its own way, 0 to 20, and the
two are not the same scale: step 10 here is row 19 there. Where they disagree about *what is
left*, they do not — as of 2026-09-26 both say the Fix list is complete.

| Step | | Commit |
|---|---|---|
| 10 | F32 — `/doctor` re-run and its proposals applied | *(this change)* |
| — | this file compacted to what is unfinished | `c23b8c0` |
| 9 | F37, the Part 2 index, and `CLAUDE.md`'s pointers | `8413a4d`, `1cf0e3c` |
| 8 | a standing line with a lifetime | `f56f602` |
| 7 | the two refusal debts, together | `9c52ca4` |
| 6, 6½ | run 8's fifteen, and F64 | `62a7070` |
| 8⅞ | the country of origin is correctable | `f72eadc` |
| 4½ | run 7's seventeen | `e492ddf`, `591a67b` |
| — | F1–F31, F33–F46, stage 8½, 8¾ | in their own commits |

All of stage 8 is committed and **nothing is pushed**. What each step did is in its commit
message; what it decided is in `specs.md`, `DESIGN.md` or `CLAUDE.md`.

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
   findings`). A fix is one commit per Fix-list item, **except where the user asks for a batch**
   — she did on 2026-09-24, for run 7's interface work, so section I went in as one commit. Never push (the user decides that).
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
| 8 | Execute the Fix list, one item at a time | **done** 2026-09-26 — all 64 items. Stage 8¾ landed between step 2 and step 4 |
| 9 | Layout and UI/UX review (step 4 of the order, asked for 2026-09-23) | **done** 2026-09-24 — run 7's section. All seventeen findings approved the same day: sections I (F47–F53, rule defects) and J (F54–F63, screen changes), executed before F32 |
| 10 | Execute run 7's seventeen (step 4½) | **done** 2026-09-25 — F47–F63, committed as `e492ddf` and `591a67b` |
| 11 | Stage 8⅞ — the country of origin is correctable | **done** 2026-09-25, `f72eadc` |
| 12 | F32 — `/doctor` | **run 2026-09-25**; its settings actions are applied. Not closed: one item is the user's (the Claude Docs connector) and two findings owe a line under "Needs the user" |
| 13 | Run 8 — the two-axis code review and a second `ponytail-audit` | **done** 2026-09-25 — fifteen findings, fixed point `9327b3d`. **Awaiting the user's GO**, which is step 14 |
| 14 | The user signs run 8 off | **done** 2026-09-25 — **all fifteen**, and the four open questions answered. The order she set is steps 6–10 under "The order from here" |
| 15 | Execute run 8's fifteen | **done** 2026-09-26, `62a7070` — fourteen fixed, R8.15 withdrawn as wrong; the commit carries F64 too |
| 16 | The two refusal debts, together | **done** 2026-09-26, `9c52ca4` — both paid; `/workers` and `/workers/[id]` are the one debt left in their place |
| 17 | A standing line with a lifetime | **done** 2026-09-26, `f56f602` — the button's word answered the same day (`להסיר`). 169/169 browser, 1,265/1,265 unit, and her own check passed |
| 18 | F37, and the size question | **done** 2026-09-26, `8413a4d` — 25 approved deletions, then the Part 2 index and 3 narrow cuts; 31 replacements in all. Typecheck, lint, 1,265/1,265 |
| 19 | F32 again | **done** 2026-09-26 — `/doctor` re-run; no connector existed to remove, and its two proposals were applied |
| 20 | F64 — her two notes on the rates group | **done** 2026-09-26, `62a7070` — committed inside run 8's batch, as she asked, rather than alone |

## The runs, and where their findings went

Eight review runs produced the Fix list below, which is the record. **Their finding sections
are deleted**: every finding was either executed — and the commit that executed it says what
changed — or dropped with its reason in the Fix list. Nothing here is re-run.

| Run | Date | Produced |
|---|---|---|
| 0 — `ponytail-audit` | 2026-09-18 | executed as `511d3ca` |
| 1 — `code-simplifier` | 2026-09-18 | folded into F1–F25 |
| 2 — `mattpocock-skills:code-review` | 2026-09-18 | folded into F1–F25 |
| 3 — `improve-codebase-architecture` | 2026-09-18 | folded into F1–F25 |
| 4 — `ponytail-review` | 2026-09-18 | folded into F1–F25 |
| 5 — `thermo-nuclear-code-quality-review` | 2026-09-18 | folded into F1–F25 |
| sweeps after F5 and F28 | 2026-09-18, 09-22 | folded into the Fix list |
| 7 — layout and UI/UX | 2026-09-24 | seventeen, all executed — `e492ddf`, `591a67b` |
| 8 — two-axis review + `ponytail-audit` | 2026-09-25 | fifteen; fourteen in `62a7070`, R8.15 withdrawn |

## Needs the user

**Ten questions were put here across stage 8. All ten are answered and executed** — the size of
`specs.md` (2026-09-26), her two notes on the rates group (F64), where the four-yearly payment
is (already built), `useAction`’s dropped second press (kept), F48’s contrast sweep (joins the
suite), run 7’s ten screen changes (F54–F63) and the nine GO/NO-GO findings (F38–F46). **Their
text is deleted: each became a Fix-list row and a commit, and what each decided is in
`specs.md`, `DESIGN.md` or `CLAUDE.md`.** What was decided and must not be reopened is listed
under "Settled" in the resume block. **One entry survives, and it is the user’s — not a
question but two findings that are hers to judge:**

**F32's two findings that are not a setting, so the entry says they come here. 2026-09-25.**
The Fix list's F32 says a `/doctor` finding that is not a setting goes under "Needs the user".
Two are. **First:** `~/.claude.json` holds this project twice, as `d:/school/…` and
`D:/school/…`, and per-project state — MCP toggles, trust, history — is keyed by that exact
string, so a toggle set under one spelling does not apply when the working directory resolves
to the other. Nothing is broken by it today and no fix was proposed, because the file is
written live by the running application and merging its entries mid-session risks losing
state. **Second:** `Bash(python -c ' *)` is allowed at user scope, which is a standing
pre-approval for arbitrary Python in every project, not only this one. It predates the
`/doctor` run and was left untouched. Neither is a repository change; both are the user's.


## Fix list

Written at step 6, approved at step 7, executed at step 8. **All 64 are executed; each is one
line** — what each changed is in
its commit, and so is the check that proved it changed nothing. One item was one commit except
where she asked for a batch: run 7’s ten went in `591a67b`, and run 8’s fourteen with F64 in
`62a7070`, so those rows share a commit or show none of their own.

### Open — none

### Executed — 64 items

| # | date | commit | what it did |
|---|---|---|---|
| F1 | 2026-09-18 | `e9dc38a` | false and misplaced comments |
| F2 | 2026-09-18 | `7701497` | history comments, including the year-bound figures at `incomeTax.ts:109` and the `build_plan.md` |
| F3 | 2026-09-18 | `45e83f9` | dead and pass-through code: `SheetLayout.addedLines`/`blockRows`/`taxRow`, `days()`, `export { l |
| F4 | 2026-09-18 | `9a0dcda` | optional props and casts the types already cover: `MonthCalendar`'s five callbacks required, the |
| F5 | 2026-09-18 | `2fb135e` | nested ternaries and if-chains become records |
| F6 | 2026-09-19 | `5fca141` | `dir="auto"` off `<Bidi>` wrappers, bare text wrapped, amounts in their own `translate="no"` ele |
| F7 | 2026-09-19 | `af5ffb3` | the shadow colour becomes a token, and the scraper's Hebrew moves to `he.ts` |
| F8 | 2026-09-19 | `26a6d51` | `saveSpan` raises the error from its `before` read |
| F9 | 2026-09-19 | `ca707d0` | `amountFieldValue` moves to `money.ts` with tests; the fifth percent format goes through `format |
| F10 | 2026-09-19 | `681293b` | one `isIsoDate` in `dates.ts`, `monthNumberOf` replaced by `reviewDate`+`monthOf`, `12` named on |
| F11 | 2026-09-19 | `1f9c6af` | `isOneOf`, one recuperation-month check, `nextAdvanceNumber` reused, one `requireWorker` error |
| F12 | 2026-09-19 | `f02acf9` | span order settled once in `closeSpans`, one clip function, `holidayStateOf` exported |
| F13 | 2026-09-19 | `65d0ae4` | the export's copies (`balanceOf`, the note into `I`, `coveredMonthsLabel`) and one `ReportKind`  |
| F14 | 2026-09-19 | `735e45d` | the scraper's copies: `collapse`, `AS_OF`, the empty-body guard moved into `fetchPage`, and one  |
| F15 | 2026-09-19 | `2f86a79` | `Field.tsx` gains the button and input classes with their disabled states; `DateField`, `Refusal |
| F16 | 2026-09-19 | `d554393` | one `useAction<R>` hook, the picker reset as one helper, one opening-advance `onChange`, the num |
| F17 | 2026-09-19 | `2eb1973` | one `AlertCard`, with a compact form for the home strip and the bell |
| F18 | 2026-09-19 | `e9c7f95` | the closing block gets drafts: `ClosingDraft` and `toClosingLine` beside `toLine`, and a typed ` |
| F19 | 2026-09-19 | `164bc64` | the warnings move from `balances.ts` into `warnings.ts` |
| F20 | 2026-09-19 | `9d4d996` | `saveProfile` works out `termsChanged` by comparing `snapshotTerms` before and after |
| F21 | 2026-09-19 | `dcc30c6` | one `revalidatePath("/", "layout")` replaces the four lists |
| F22 | 2026-09-19 | `dc466f0` | one `saveMonths` upsert, and `touchMonths` as one statement; no migration |
| F23 | 2026-09-20 | `981c956` | the worker's spans reach the series once and each month still clips to what overlaps it, so the  |
| F24 | 2026-09-20 | `6dec7f1`+`971198b` | the wizard and the profile share their field components, both files under 1,000 lines |
| F25 | 2026-09-20 | `0f262c8` | `HomeScreen` and `MonthConfirmation` split along their existing sections |
| F26 | 2026-09-22 | `4f7dd3a` | one household replay module under `cache()`, with the rates fix folded in |
| F27 | 2026-09-23 | `eb552e9` | the recorded-entries module on the client (with F33’s S3, S4, S7, S8) |
| F28 | 2026-09-22 | `be4511f` | the month-lifecycle module, and the confirmed-month rule it had nowhere to land |
| F29 | 2026-09-19 | `8db910b` | `restDaysOf` and `holidayDaysRemaining` deleted with their tests |
| F30 | 2026-09-19 | `e13d95a` | one helper for the holiday actions' shared opening |
| F31 | 2026-09-19 | `47f92a3` | a stamp takes its day from the same pinned today the request reads, so the suite no longer depen |
| F33 | 2026-09-23 | S1–S8 | `b453175` `2290b31` `3720209` `409bfab` `eb552e9` — eight sub-items, no split of the last four compiles |
| F34 | 2026-09-20 | `decbea1` | a rest day the spell bridged is not paid |
| F35 | 2026-09-22 | `4822355` | a spell is one spell across a month boundary: the series decides the spells over the worker's wh |
| F36 | 2026-09-23 | `d1d9b91` | wire the income-tax scraper |
| F37 | 2026-09-26 | `8413a4d` | (added 2026-09-22 at the user's request) strip the history out of `specs.md`. The file carries i |
| F38 | 2026-09-23 | `7d85953` | was already built; only a false comment was left |
| F39 | 2026-09-23 | `cb6233a` | a salary change dated before the rate table reaches is not measured against today's minimum |
| F40 | 2026-09-23 | `c748563` | `createWorker` refuses a third worker itself |
| F41 | 2026-09-23 | `580e981` | the sheet's gendered wording follows the profile's `gender` |
| F42 | 2026-09-24 | `b0f3514` | the fetched page's text is kept |
| F43 | 2026-09-23 | `16a0439` | an override's note and the hospital-overtime note reach column I |
| F44 | 2026-09-24 | `b2c0cf1` | an advance movement is corrected by editing the entry |
| F45 | 2026-09-24 | `b981ae3` | a slow or broken source never delays a screen |
| F46 | 2026-09-24 | `4ac69b6` | the income tax is confirmed before every export, and the file route refuses an unconfirmed month |
| F47 | 2026-09-24 | `e492ddf` | a holiday's name is drawn at the same edge as its own date |
| F48 | 2026-09-24 | — | three body paragraphs are drawn at 3.23:1 |
| F49 | 2026-09-24 | — | seven inputs on `/settings` have no accessible name, four of them the identifying numbers |
| F50 | 2026-09-24 | — | six pointer targets are under 24×24 (WCAG 2.2 AA 2.5.8) |
| F51 | 2026-09-24 | — | a disabled filled button reads as a second, quieter *enabled* one |
| F52 | 2026-09-24 | — | `/` draws its `h1` after an `h2` |
| F53 | 2026-09-24 | — | one action, two words, on one screen |
| F54 | 2026-09-24 | — | cap the calendar day cell's height so the cell keeps roughly the proportion the artboard draws a |
| F55 | 2026-09-24 | — | keep the desktop height lock and restore the scroll position by hand |
| F56 | 2026-09-24 | — | a folded section says what is inside it: `FoldSection` draws its `aside` folded as well as open |
| F57 | 2026-09-24 | — | `/settings`' folds take `/payments`' arrangement, the heading inside the white card it opens |
| F58 | 2026-09-24 | — | alerts of one kind that differ only by month become one card naming the months, with the action  |
| F59 | 2026-09-24 | — | `חודשים קודמים` on `/דוחות` gets a heading between the years, and the row of a month that has no |
| F60 | 2026-09-25 | — | the busy state moves onto the control that was pressed, `aria-busy` staying on the screen |
| F61 | 2026-09-25 | — | a refused month withholds the balances rail as it already withholds the money column |
| F62 | 2026-09-25 | — | `מדינת מקור` opens on nothing and the wizard step is refused until she chooses |
| F63 | 2026-09-25 | — | the rate row carries a sentence and never the stored string |
| F32 | 2026-09-26 | *(this change)* | `/doctor` re-run: no Docs connector existed; version 2.1.282→2.1.283, four unused skills and one plugin off. Its two non-setting findings stay with the user |
| F64 | 2026-09-26 | `62a7070` | committed with run 8's batch, as she asked, rather than alone. The group that holds only insuran |

**Committed alongside, and not Fix-list items:** `6b131d5` and `fb6176f` (stage 8¾, the refused
month’s card), `7227e91` (the nine labels naming her rest day), `a97dedc` (a confirmation stops
erasing where the wage came from), `0036a40` (the GO/NO-GO findings put on the list). Every
stage-8 commit is reachable with `git log --grep 'Stage 8'`.

**Not on the list**
- R3.3 — needs a migration of its own. The local ones are live as of 2026-09-24, so what it
  waits on now is being wanted, not being unblocked.
- R3.5 — fell out of F28 (2026-09-22).
- R5.1 and R2.22's `?? SEEDED_RATES` — done inside F26, which is where making the rates
  required and fixing "the household's rates never reach a month" turned out to be one move.
