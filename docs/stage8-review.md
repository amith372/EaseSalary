# Stage 8 — the review file

The working file of stage 8 (`build_plan.md`). Five review runs write into it one after
another, and together they produce the **Fix list** at the bottom, which is then executed
item by item. It is deleted when stage 8 closes; what it found lives on in the commits.

## Resume here

A fresh session told "continue with `docs/stage8-review.md`" reads this file whole and does
**the next step below, and only that step**. At the end of the step it updates this block and
the plan table, then stops and reports to the user.

> ### ✅ Everything through step 9 is committed.
> **Step 9 — F37, the history stripped out of `specs.md`, and the size question it raised —
> went in on 2026-09-26** after she approved all twenty-five deletions as one batch, then the
> Part 2 index and three further cuts as two more. 31 exact replacements in all, each matched
> once and once only by a script that aborts on a near-miss. Typecheck, lint and the unit suite
> **1,265/1,265** clean, and no code was touched, so rule 6's browser suite does not apply.
> **`specs.md` is now read one item at a time.** Part 2 carries an index at its head naming what
> each of the twenty-nine items settles, so a session reads item 17's 2,240 words instead of
> Part 2's 17,000; `CLAUDE.md`'s "Where to read" says so. The index **adds** ~2.6KB on disk and
> that is the intended trade — rule 9 charges a file for what it costs a session, not what it
> weighs.
> Before it: **step 8 — a standing line with a lifetime — went in as `f56f602` on 2026-09-26** once she answered the
> one word it waited on: the row's button says **`להסיר`**, the word four other removable rows
> on the same screens already wear. Its evidence, on the finished tree: browser suite
> **169/169 in 11.6 minutes, no flake**, unit suite **1,265/1,265** (nineteen new), typecheck
> and lint clean. **Her own check passed** — the ₪300 recurring deduction over three months —
> and so did step 1's, outstanding since 2026-09-18.
> Before it: **step 7 — the two refusal debts — went in as `9c52ca4` on 2026-09-26** with `specs.md` item 25's
> approved paragraph, `DESIGN.md`'s four rewritten departures and `build_plan.md`'s two debts
> paid. The evidence it rests on, measured on the committed tree: browser suite
> **168/168 in 13.6 minutes, no flake**, unit suite **1,246/1,246**, typecheck and lint clean.
> Before it: **run 8's fifteen and F64 together as `62a7070`**, one batch as she asked, with
> `specs.md` item 20's approved replacement, `DESIGN.md`'s two entries and `CLAUDE.md`'s three
> duplications folded in; stage 8⅞ as `f72eadc`; run 7's seventeen as `e492ddf`
> and `591a67b`. **Nothing is pushed**; she decides that.
> **A run measures one code state and nothing else** — a source file written while the suite is
> going makes the dev server recompile underneath it, and the run that follows is evidence of
> neither state. One such run was discarded on 2026-09-25 and re-run clean; its six "failures"
> were all `worker process exited unexpectedly`, which is a crashed browser and never an
> assertion.
> **A per-file run is not evidence for a batch.** The whole-suite run before `591a67b` found
> F62's regression — five failures in two spec files F62 never touched.

> ### → A fresh session told "continue" does this
> **The next step is 10, F32 — `/doctor` again**, and its first half is **hers**: the Claude Docs
> connector, which no local config file holds, so it goes through `/mcp` or claude.ai. A session
> does not answer it for her. Then `/doctor` is run once more and the entry's own check —
> "`/doctor` reports nothing left to fix" — is what closes it.
> **The order, and a session does the first that is not done:** ~~6 run 8's fifteen~~,
> ~~6½ F64~~, ~~7 the two refusal debts~~, ~~8 the standing-line lifetime~~, ~~9 F37~~ are
> **done and committed** · **10 F32 again**.
> **The size question is answered and closed, 2026-09-26.** She chose the recommendation —
> lever 1 in full and lever 3 only in its narrow form — and both are built. **Lever 2 was not
> taken and is not owed:** moving items 17 and 20's screen prose to `DESIGN.md` would put a
> behavioural rule where no test-writer looks, which is why it was recommended against.
> **No further compression of `specs.md` is on anyone's list.** The measurement that settles it,
> so nobody re-measures: 614 sentences over 60 chars, **zero exact duplicates**, 23 of 23,069
> twelve-word phrases repeated (0.1%). The file is not padded, and lever 3 done safely bought
> only ~185 words — 1% of Part 2. A session that thinks `specs.md` is too long reads the index
> instead of the part.
> **What step 7 left behind, and it is not a defect:** `/workers` and `/workers/[id]` still
> fail whole on a refused month, on purpose — every card on them states a balance and a
> refused worker has none, so drawing her opening position would state a figure nobody
> checked. They raise the refusal in sight, which is what they always did. It is the one entry
> in `build_plan.md`'s "Still to pay", and **where the card goes on a screen that lists both
> workers is her decision** — a session does not invent it.
> **F32 (`/doctor`) was run on 2026-09-25 and is not closed.** Its settings actions are
> applied — eight unused skills off, auto mode saved as the default, Claude Code at 2.1.282 —
> and `CLAUDE.md` lost three duplications she approved. **One item is hers and is outstanding:**
> the Claude Docs connector, which has no local config file, so it goes through `/mcp` or
> claude.ai. **Whether it is already off is not known**: the server disconnected during the
> session of 2026-09-25, but a disconnect is not a removal and nothing here confirms one — it
> was reported as done on that evidence, which was too thin, and the claim is withdrawn.
> F32's own two findings are under "Needs the user". **The check F32 names — "`/doctor`
> reports nothing left to fix" — is not met.** Step 10 is: confirm the connector is off, then
> re-run `/doctor`.
> **After a commit this file's header is corrected to name it, and that one change is left
> uncommitted** — the user's standing instruction of 2026-09-25 is to **fold it into the next
> commit** rather than commit it alone. Do not commit it on its own and do not revert it.
> **Ask before every commit.**
> **Step 8 is decided in full.** The row's button **deletes** the line, a confirmed month keeps
> what it was confirmed with, `specs.md` item 20 carries the approved paragraph, and the button's
> word is **`להסיר`**, answered 2026-09-26. **Nothing about step 8 is left to decide or to ask.**
> **Everything else that was open is answered, in place:**
> F48's sweep **joins the suite** (R8.4 finishes it; the file is preserved at
> `e2e/contrast-sweep.parked.ts`, which the suite ignores until it is renamed); `useAction`'s
> dropped second press is **kept**; the refused download **redirects to the screen that draws
> the card**; and the mark panel's missing busy state was **handed back to the session** and is
> decided where the finding is. **The user's own outstanding actions** are listed under
> "Waiting on the user"; none may be answered for her, and after 2026-09-26 **one is left** —
> the Claude Docs connector, which is step 10's.
> **Never push.**

- **Last done: step 8 — a standing line with a lifetime**, `f56f602`, on 2026-09-26.
  A standing line now carries `from?` and `until?` as month keys, and **the filter is applied
  where the snapshot is taken** (`standingLinesFor`, `snapshotTerms(worker, month)`): a month's
  `terms.standingLines` therefore means "the lines this month carries", so the sheet, the
  payslip and `notes.ts` need no filter of their own and a confirmed month keeps whatever it
  was confirmed with for free. `snapshotTerms` gained the month at every call site;
  `profileTerms` is the unfiltered view and exists for one reason — `termsDiffer` must answer
  "yes" to a lifetime moved from June to August, which changes no single month's snapshot and
  still has to refill the drafts. `monthsFollowingProfile` snapshots per month rather than once.
  `reviewStandingLine` wraps `reviewUserLine` and reads the two ends, refusing a last month
  before the first; `stopStandingLine` is **`removeStandingLine`**, because it deletes and a
  lifetime is what ends a line. `standingLineEnding` joins the warning list in the month before
  a line's last month, with its own switch in the reminders pop-up — the seventh.
  On the screen the panel gained the lifetime as two month selects, and `MonthSelect` moved out
  of `MonthActions.tsx` so the covered period and the lifetime share one control and one reason
  against `<input type="month">`; a line whose last month has passed keeps a row under
  `שורות שנגמרו`, where the edit that restarts it is. `DESIGN.md` has both departures.
  **Checked against the bug and not only against itself:** with `standingLinesFor` stubbed to
  filter nothing, five of `profile.test.ts`'s lifetime cases and the rule-12
  "leaves it out of both once the month is past its last month" fail, each at the month it
  names. The expected months are 2026's, worked out on paper from item 20's own sentence — a
  line from June to August reaches June, July and August, so May and September are asserted
  empty. **Its evidence:** browser suite **169/169 in 11.6 minutes, no flake**, unit suite
  **1,265/1,265**, typecheck and lint clean.
  **What it did not do:** the two screens did not move (decision 7, reversed by her on
  2026-09-26), and the salary row's `YYYY-MM` text field beside it was left alone — it is named
  in `DESIGN.md` as the thing that should move to a select, and it is not this step's.

- **Before it: step 7 — the two refusal debts, together**, `9c52ca4`, on 2026-09-26.
  **The refusal is now a fact about one worker rather than about the household.**
  `householdSeries` catches `InvalidMonthError` inside the per-worker map and hands it back on
  `WorkerInSeries.refusal`, so it never escapes the replay; `householdSeriesOrRefusal` is gone
  and `refusalShown` is the one step from the error to the card's input. The four screens read
  it off the worker the switcher is showing — `/` from `entry`, and `PayslipScreen`,
  `PaymentsScreen` and `ReportsScreen` each return the card after their last hook, which is
  why the check sits below them and not at the top. `BalancesRail` drops the refused worker's
  two rows and keeps everyone else's, and withholds the whole card only when nobody is left.
  Switching to a refused worker moves the calendar to her refused month, adjusted during
  render rather than in an effect. **`alertsView` leaves a refused worker out of the count
  altogether** — handing her over as a worker with no months would have reported every quarter
  of her employment unpaid and every month never filed — which is what let the bell's catch in
  `layout.tsx` go, dead once nothing throws. The two download addresses answer with
  `refusedDownload`: a 303 to `/` carrying the `worker` cookie, because a redirect that lost
  the worker lands on a screen with no card on it. **`/workers` and `/workers/[id]` raise the
  refusal again on purpose**, in sight, with the reason beside it: every card on them states a
  balance and drawing her opening position instead would state a figure nobody checked. That
  is the one debt left, and it is in `build_plan.md`.
  **Checked against the restored bug, not only against itself:** with `src/` stashed, four of
  the six tests in `refusal-card.spec.ts` fail, each at the assertion its own debt names — the
  rail missing, the card standing over the first worker, the three screens drawing no heading,
  and the download address staying on `/month/export/file` instead of landing on `/`.
  The expected figures in "leaves the other worker's month exactly as it was" come from the
  **`demo` household**, which is the `refused` household minus the one stray span: the rule
  says a refusal in one employment says nothing about the other, so equality is the
  expectation and nothing was read back off the implementation (rule 11).
  `home-screen.spec.ts`'s outline test moved with the behaviour and was not silenced: the
  strip leads a refused household now, because the other worker still has things to do, and
  the card is the `h2` it is on any screen with a strip above it. `specs.md` item 25 carries
  the approved paragraph, quoted to her and answered yes on 2026-09-26; `DESIGN.md`'s refusal
  section has four rewritten departures.
  **Its evidence, on the finished tree:** browser suite **168/168 in 13.6 minutes, no flake**
  — the 166 that stood plus this step's two new cases — unit suite **1,246/1,246**, typecheck
  and lint clean.

- **And before that: stage 8⅞ — the country of origin is correctable**, on 2026-09-25, whole.
  `setCountry` sits beside `setGender` and checks the code against `countriesWithLists`, which
  is now the one offer `/workers/new` and `/settings` both read — the wizard's inline
  dedup-and-sort moved into `holidaySources.ts` with the `Country` type, which had been
  declared twice in the two wizard components and is now declared once. `CountryControl` is a
  row of chips in the **employment** group beside `מין`, as the user asked, and a select was
  not used for the reason `RecuperationControl` gives. **Nothing else was needed**:
  `holidaySourceOf` already derives the list from the country rather than storing a default,
  so a worker never moved follows the correction and one moved on purpose does not — and
  `setCountry` writing `holidaySource` too is exactly the bug the second browser test was
  **checked against**, where it fails on `NP` and the rest pass. `e2e/country-change.spec.ts`
  is new and holds all three halves of the done-when: the correction reaching `/workers`, her
  page and the picker's default; the worker moved to נפאל staying there; and the month's
  `נטו` figure not moving — read as the amount alone, since the row carries its label and its
  "why" button beside it. Five new unit tests in `holidaySources.test.ts`, whose six country
  names come off the shipped `data/holidays/XX-2026.json` files and whose order is the Hebrew
  alphabet's, worked out rather than read back. `specs.md` item 10 gained the approved
  paragraph — put to the user as its own question and answered yes on 2026-09-25 — and
  `DESIGN.md`'s settings section carries the row the canvas does not draw.
  **Its evidence, on the finished tree:** browser suite **164/164 in 11.6 minutes, no flake**
  — the 161 that stood before plus this stage's three — unit suite **1,246/1,246**, typecheck
  and lint clean.
  **Before it: all seventeen of run 7 — F47–F63**, committed as `e492ddf` and `591a67b` on
  2026-09-24–25, not pushed. **Step 4½ is closed.**
  What comes next is in the box above.
  **F63** stops the rates group printing the stored source string. `datedRates.ts` gains
  `rateSources` — `familyWorkbook` and `userConfirmed`, names and not prose — and
  `drawnRateSource`, which answers an address, a name, or **nothing**. The two seeded wage
  rows carry `familyWorkbook` and their workbook citations moved into comments beside them
  and into `datedRates.test.ts`'s header, which is rule 6's own division; `confirmMonth`
  stores `userConfirmed` where it stored a Hebrew sentence, so the last user-facing string
  outside `he.ts` on this path is gone. `he.settings.sourceSaid` holds both sentences, and
  they are **whole sentences rather than nouns after `נקרא מ־`** — `נקרא מ־` before
  `אושר על ידי המשתמש/ת` was not Hebrew anyone writes, which the old branch had been
  drawing all along. **An unknown source draws no line**: printing it is how the path reached
  the screen, and calling it the user's confirmation would be a claim about provenance nobody
  checked. A row written before the names holds the one sentence the column has ever held and
  is read as `userConfirmed`, so nothing live loses its source. Measured on the demo: the wage
  row reads `₪6,443.85 · מ־1 באפריל 2026 · מחושב לפי החוק · נקרא מהגיליון של המשפחה` and the
  national-insurance row still `נקרא מ־ המקור` as a link. Five new unit tests; the three
  browser assertions in `before-export.spec.ts` now name `he.ts`'s sentences, and one asserts
  no `.xlsx` reaches the row. **Checked against the restored bug in full** — the citation put
  back in the seed *and* the verbatim branch put back on the screen — where the browser
  reports the row as `שכר_חודשי_להאנה2026.xlsx → חודש  4.26 → D6` and two browser tests and
  one unit test fail. `DESIGN.md`'s settings section carries the departure. Nothing owed to
  `specs.md`: item 4 asks for where a figure was read from and does not say in what words.
  **F62 broke three browser specs, and the whole-batch run is what found it.** The wizard is
  driven from `add-worker.spec.ts`, from `alerts.spec.ts` twice and from `first-month.spec.ts`,
  and only the first was updated with the fix; the other three filled a name and pressed
  `להמשיך`, which now refuses. Each chooses `PH` now. **That is the argument for the
  whole-suite run before a commit** — the five failures were in two files F62 never touched,
  so no per-file run after the fix would have met any of them.
  **F62** opens the wizard's `מדינת מקור` on nothing: the draft's `country` is `""` rather
  than `countries[0]?.code`, and the select carries a first option `לבחור מדינה`
  (`he.addWorker.who.countryPlaceholder`). **Nothing else was needed** — `reviewNewWorker`
  has always refused an empty country and `STEP_OF` has always put it on step 1, so the
  sentence `צריך לבחור מדינה.` and the `aria-invalid` were there and unreachable; the defect
  was the default alone. `add-worker.spec.ts` gains `the country is chosen and not defaulted`
  — the select opens empty, the step refuses and stays at 1, and choosing `PH` leaves it —
  and `fillWho` now chooses a country, as the check asks. The full-flow test also asserts
  `הפיליפינים` on the saved profile, which is the half that proves the *choice* is what is
  stored. **Checked against the restored bug**: with the default put back, the new test fails
  on `toHaveValue("")` and the other eight pass. `DESIGN.md` gains a short
  `### The add-worker wizard` section for it — the file had none, the wizard's departures
  having lived only in `AddWorkerScreen.tsx`'s header. Nothing owed to `specs.md`: item 12
  already makes the holiday list the country's.
  **Seen, reported, and now scheduled:** **the country cannot be changed after the wizard.**
  It is on no settings row and no action writes it — only `settings/holidays` reads it. It
  was outside F62's scope and nothing was invented into it (working rule 4); it was put to
  the user, who approved a PRD for it on 2026-09-25. It is **stage 8⅞ in `build_plan.md`**
  and runs after F63. **Do not re-open it here.**
  **F61** withholds the balances card while a refused month's card stands — a `refused` prop on
  `BalancesRail` — leaving the rail its export link alone and **drawn full width**, since
  `sm:grid-cols-2` goes with the card rather than leaving the link half a row beside a gap
  (measured at 768, 1024 and 1279: 712, 968 and 1223 wide). What it replaces is `[מספר] ימים`
  drawn four times — a refused replay hands every worker `months: []`, so every row of both
  workers fell to the no-record placeholder. `refusal-card.spec.ts` asserts the card is gone,
  that `[מספר]` is **nowhere on the screen** — on `/` the rail is its only site — and that the
  export link stays; and, after the day is cleared, that the card and a real balance row come
  back. **Checked against the restored bug**: `refused={false}` fails it on the card's count.
  `DESIGN.md`'s refused-month table gains the row. **Nothing is owed to `specs.md`** — item 13
  already says a balance is derived by replaying the months, so a month the engine declined to
  value has none, and F61 is that sentence drawn.
  **F60** takes the dim off the five regions that wore it — `/payments`, `/settings`, the day
  and money column on `/`, the pre-export screen and the holiday picker — leaving each its
  `aria-busy`, and puts it on the control that was pressed: `busyAttrs` in `Field.tsx`, which is
  `cursor-wait opacity-60` plus a `data-busy` the suite addresses it by. **The busy control is
  deliberately not a disabled one** — F51 made disabled the chip grey, which says "cannot be
  pressed" and not "working" — so the repeat press it admits is dropped by `useAction`, where
  the in-flight guard now lives. That guard moved down from `PaymentsScreen`, whose own
  screen-wide one **stays as well and had to**: every section writes the same month record
  read-modify-write, so two sections saving at once would lose one of the two changes, and it is
  `pointer-events-none` that used to stop it. `Send` therefore answers a boolean — a parent that
  drops a change has to say so, or the dropped control waits for a result that is never coming.
  **Where one hook backs several controls** — a list's rows and the panel above them, the holiday
  rows' tick and day parts, the source chips — `run` takes the pressed one's name and `busyAt`
  answers for it; `Chip` gained a `busy` prop, so every picker in the application says it the
  same way. **One place is left saying nothing but `aria-busy`, and it is a real gap**: on `/`
  the calendar's mark panel closes on the press, so by the time the write is in flight there is
  no control left to wear the state. Nothing was invented to fill it (working rule 4) — it was
  **reported to the user on 2026-09-25, and she answered the same day by handing the choice
  back: do what is best.** That delegation is working rule 4's "an explicit decision by the
  user", so the gap is now filled rather than left. **What was chosen, and why:** the busy
  state goes onto **the day cells the gesture marked**, not onto the kind chip. `applyKind`
  (`src/components/MonthCalendar.tsx:430`) calls `onSelectRange` and then `reset()`, so the
  chip that committed the mark is unmounted before the write resolves — holding the picker
  open until it lands would make every mark feel slower, to say something the calendar can say
  better. The days are still on screen, they are the subject of the change, and the dim then
  reads as "these days are being written" rather than as the page failing, which is the exact
  failure the comment on `HomeScreen.tsx:364` warns about. It needs the component to remember
  which range is in flight, because `reset()` clears the selection; that state is cleared when
  the write answers. **It is a visual change, so it goes into `DESIGN.md` in the same step**
  (rule 3), and it is built with run 8's findings rather than on its own. `e2e/busy-state.spec.ts` is new: it holds the server action at
  the network for 2.5s and measures the browser's computed `opacity`, because opacity is not
  inherited as a computed value and a child of a dimmed region still reads 1 — so it is the
  region that has to be measured. **Both halves were checked against the restored bug**: with
  `busyAttrs` neutralised `[data-busy]` is nowhere, and with the region dim put back the wrapper
  measures 0.6.
  **F59** groups `חודשים קודמים` under a heading per year in `ReportsScreen.tsx` — the grouping is
  built before the render rather than by comparing a row with the one before it, so a heading
  cannot fall to a row that is not a year's first — and draws `החודש עדיין לא הסתיים` under
  `לאשר ולייצא` as that link's own note. **Its browser test measures the note against the
  link** — below it and starting at the same edge — rather than reading the markup, and both
  halves of it were checked against the restored bug: the note put back beside the link fails
  it, and the heading removed fails it. The seventeen rows it asserts come from the seed and the
  pinned day, so the test pins the day itself; `reports.spec.ts` had been riding the real clock.
  **F58** gathers entries of one kind that differ only in their month into one card
  (`groupedEntries` in `src/lib/engine/alerts.ts`, which runs *after* `shownEntries`, so a
  month put off on its own leaves the group instead of taking the rest with it). **Only the two
  kinds a replay raises month after month are gathered** — `monthUnconfirmed` and
  `monthNotExported`; recuperation's two carry a month as well and neither can repeat, one
  being raised for this month and the other for next. A card carries **one fingerprint per month**
  it stands for and the deferral record stays per month — which is what keeps "until a figure it
  carries changes" working month by month. Measured on the demo at the
  pinned day: `/alerts` draws 11 cards and the strip says 4 of 6, where run 7 measured 4 of 28
  — the two workers' 16 and 8 unconfirmed months are two cards now.
  **`סמן כטופל` is one press per month and never one that answers them all** (the user,
  2026-09-25, asked and decided): the gesture removes a month's warning for good and cannot be
  undone from the screen. A gathered card draws a row of month chips under its note, each named
  `סמן את <חודש> כטופל`, and its note lists no months; a card standing for one month keeps
  the plain button it always had. Item 27's "one action on it" is the way in (`לייצא`) and not
  the putting-off, so no `specs.md` sentence was owed for it. `dismiss` therefore still takes
  one fingerprint.
  **The national-insurance quarters repeat in the same way and are left alone** — one entry per
  ended quarter nobody has recorded, so a family behind on them accumulates a card a quarter,
  though the demo shows one apiece because it records four quarterly payments. **Asked and
  declined** (the user, 2026-09-25): item 27's sentence says "differ only in the month they are
  about" and a quarter is a period, and the period a card would name moves as payments cover
  different spans. **Do not ask again.** **Nothing was asked of `specs.md`:**
  the sentence approved on 2026-09-24 is already in item 27, after "the first four blockages".
  **F59 owes no `specs.md` sentence, and the Fix-list entry saying it does is wrong.** Item 21
  already decides it: "The current month can be exported before its last day, with a warning
  that it has not ended." So `החודש עדיין לא הסתיים` is not competing with `לאשר ולייצא` — it is
  the condition on it, and both belong on the row. F59 is therefore layout only: the year
  headings, and the warning drawn as the link's own note rather than as a second statement.
  **Do not ask the user for a sentence for it.** (Done, 2026-09-24, and nothing was asked.)
  **A scope call in F56 that is the user's to overturn:** F56 says "what each section's folded
  line says is part of this item" and names three. `מקדמות`, `מס הכנסה` and
  `שעות נוספות באשפוז` now say something folded; `userLines`, `thirdParty` and `overrides` have
  no existing wording to show and none was invented (working rule 4). She was told, and has not
  answered.
  **F54** caps the calendar grid's height — `MAX_CELL_HEIGHT` in `MonthCalendar.tsx` — so the
  day holds 91×100 from 800px tall to 1440px, where it used to reach 91×177. **The cap is on the
  grid and not on the row**: `minmax(58px, 100px)` sizes a row to its content and would draw a
  58px day at every height, which looks right in the source and is wrong on screen.
  **F55** adds `useScrollRestoration` to `AppShell.tsx`. The offset is read **in the click that
  begins the navigation**, not from a scroll listener: the framework scrolls `<main>` to the top
  as a navigation starts, and a scroll listener records that nought over the place she was at.
  Only a Back or a Forward is restored, so an address naming an anchor still reaches its anchor.
  **Its test cost an hour and the reason is worth keeping**: Playwright scrolls a target into
  view before pressing it, so pressing the blocker strip — which is at the *top* — scrolled the
  screen back to 0 and the test proved the bug it was meant to catch. It presses a link that
  genuinely sits at the foot instead.
  **F56** gives `FoldSection` a `summary`, drawn while folded, falling back to `aside`; the
  advances pass one of their own because their aside is a *control*, and a button inside a
  folded section acts on what the user cannot see. Nought outstanding is said as nought and not
  as "none recorded" — an advance repaid in full is a fact about the month.
  **F57** puts the four `/settings` folds inside one card divided by hairlines, as `/payments`
  has them. `aria-busy` stays on a wrapper outside the card, because `Card` takes `data-*` and
  nothing else.
  Before those, **all of section I — F47 through F53, the seven rule defects.**
  **F49** gives `TermRow` a `useId` for its `<h3>` and passes it down as a render prop, so the
  four identifying numbers, the insurer, the rest-eve supplement and the employment start take
  `aria-labelledby` from the row's own heading; `DateInput` takes it only where it stands outside
  a `Field`, whose wrapping label would otherwise be overridden. Seven fields had no accessible
  name; two more were named only by their placeholder. The assertion counts Playwright's own
  accessible names rather than reading the markup, which is the point — 13 textboxes, 8 named on
  HEAD.
  **F50** puts `touchTargetClass` (`-my-3 py-3`) in `Field.tsx` and applies it to the blocker
  strip's action, `הצג הכל`, `RuleLink`, `LawLink`, the two account actions on `/settings` and
  **the two `להוסיף` links in `WorkerOpening`**, which run 7's list did not name and the sweep
  found; the holiday tick takes a pseudo-element hit area instead, since padding a fixed box
  shrinks what it draws. `e2e/pointer-targets.spec.ts` is new and hit-tests with
  `elementFromPoint` over four screens at five widths. **Two things it deliberately leaves out**:
  a link inside a sentence (WCAG's inline exception — `כל זכות` on `/month/export` and `המקור`
  on `/settings`, which F63 rewrites anyway), and `/month/export` and `/payments`, which the
  approved check does not name. Neutralising the class reports 72 targets.
  **F51** disables `buttonClass` with `bg-chip`/`text-ink-quiet`/`cursor-not-allowed` instead of
  `opacity-50`. **F52** moves the `h1` to whatever leads `/` — the strip, then the refusal card,
  then the month — through a `heading` prop on all three; **the third branch has no seed**, since
  every seed carries 28 blockers, so the browser covers the strip and the refusal card and not
  the month. **F53** is one word in `he.ts`, and it **cost three browser
  locators**: `לשמור` now names two buttons on one screen, so the tax group's save is addressed
  through its `data-group` in `income-tax.spec.ts` and `profile-and-payments.spec.ts`. That was
  the finding rather than the cost — a locator that reads a button's word alone was only ever
  unambiguous because one group disagreed with the other six.
  F48 moves the three body paragraphs that took `text-ink-faint` to `text-ink-soft` —
  `ReportsScreen.tsx:382`, `WorkersList.tsx:235`, `WorkerProfileScreen.tsx:209` — and corrects
  both tokens' comments in `globals.css`, which had scoped `ink-faint` to a greeting line that
  no longer uses it. After it, `ink-faint` carries only the three `aria-hidden` `·` separators,
  and its comment says so. **The contrast sweep is not in the suite**: it was written for the
  check, run over eleven screens (the ten plus a worker profile, reached through the list) at 390
  and 1440, and parked in the session scratchpad as `contrast-sweep.spec.ts` rather than
  committed — keeping it is a question for the user, not a decision a fix may take. It reported
  nothing after the change and all three sites before it, at 3.23 on the page ground and 3.42 on
  a card, which are the figures the WCAG formula gives for #9a8874 against #fbf8f4 and #ffffff.
  Before that, 2026-09-24, **F47** (`e492ddf`) dropped `dir="auto"` from the wrapper around a
  holiday's name in
  `HolidayPickerScreen.tsx`, whose only child is a `<Bidi>` — the pattern `CLAUDE.md` forbids,
  and the last instance in the application. The name and its date now share an edge; they were
  **649px apart**, measured. The row's name and date each gained a `data-role`, and the
  assertion measures the *text* with a `Range` rather than the element, because both sit in a
  stretched flex column whose box reports the column's edge whichever way the text inside it
  resolved. `holiday-picker.spec.ts` 15/15, and the new test was checked against the restored
  bug, where it fails at 649. Nothing is owed to `DESIGN.md`: the fix restores the alignment
  the canvas already draws.
  Before that, 2026-09-24, **step 4 of the order — the layout and UI/UX review, and the
  writing-up of its fixes. All seventeen were approved the same day.** The review itself changed
  no code: its edits are run 7's section in this file, the seventeen Fix-list items, this block
  and the plan table.
  **F47–F53 are defects against a rule already written down** (`CLAUDE.md`, `DESIGN.md`, WCAG),
  so none of them needed a design answer. **F54–F63 change a screen**, and each was approved
  as run 7 recommended it (the user, 2026-09-24, on all ten at once); each Fix-list entry
  carries the decision itself, so nothing has to be read back out of the recommendation.
  Each of the ten owes its departure to `DESIGN.md` in the same commit. **Two of them owe a
  `specs.md` sentence before they are code** — F58's grouping of repeated alerts (item 27) and
  F59's question of whether a month that has not ended may be confirmed — and that sentence is
  put to her with its exact wording first: **no `specs.md` wording has been approved**, only the
  change.
  Seventeen findings, and **every figure in them is the browser's rather than a reading of the
  markup** — contrast, pointer targets hit-tested with `elementFromPoint` so a pseudo-element hit
  area counts, computed direction, and cell size against viewport — over the ten screens at 390,
  768, 1024, 1279 and 1440 wide and at four heights, on the `demo` and `refused` seeds at the
  pinned day. That is what a later session should not redo: the measuring is in run 7's section
  and each finding names the file and the figure. **The judgment call step 4 was left is
  answered as R7.17** and is one of the ten. There is nothing for the user to check (rule 8),
  since no behaviour changed.
  Before that, 2026-09-24, **step 3 of the order — stage 8¾, the refusal card**, committed as
  `6b131d5` and not pushed.
  `src/lib/refusalView.ts`'s `refusedMonthOf` turns the thrown `InvalidMonthError` into the
  card's input — the month written out in Hebrew, one reason per refusal with its dates
  written out beside the sentence and the rule behind it — and `householdSeriesOrRefusal`
  is the one place the throw is caught, so `/`, the payslip, `/payments` and `/reports` do
  not each invent a catch. On `/` the card sits above the columns and the calendar still
  draws with its marks, because the mark to correct is on it: `HomeScreen`'s spans now fall
  back to the worker's own spans wherever there is no valued month, which is what a month
  ahead already needed. On the other three the card is the screen.
  **No gesture in the interface can produce a refused month** — the calendar stops a second
  mark, the picker withholds a kind no selected day can take, and stage 8½'s panel answers a
  stranded mark before saving — so `refusedSeed` in `src/lib/dev/seed.ts` puts two marks on
  2026-08-20 and `e2e/refusal-card.spec.ts` works from it. August and not September on
  purpose: it proves the card names the month at fault and not the month asked for.
  Six unit tests in `refusalView.test.ts`, every refusal in them raised by the engine rather
  than assembled by hand, and all six checked against three mutations of the mapping. Four
  browser tests, and the calendar assertion was checked against the restored bug. Unit suite
  1,225/1,225; the browser suite ran whole, 147/147, no flake.
  The `specs.md` paragraph stage 8¾ owed was put to the user with its exact wording and
  approved on 2026-09-24; item 25 carries it. `DESIGN.md` carries the departure, as its own
  section, since the canvas draws no such card. **Two debts moved to `build_plan.md`'s "What
  is still owed":** the two file routes still throw on a refused month, and a refusal hides
  the other worker's figures too.
  **What it owes is the user's own check (rule 8):** open `/` on a household whose August is
  refused — the card names אוגוסט 2026, says a day was marked twice, names 20 באוגוסט 2026
  beside the sentence and links the rule, and the calendar below it still draws August with
  its marks and no figures beside it; the payslip, `/payments` and `/דוחות` say the same
  thing and `/דוחות` offers no file; then sweep 19–20 August, press `לנקות סימון`, and the
  card goes and the figures come back for September as well as August. A failure looks like
  a stack trace on any of the four, a card with no month or no dates in it, a calendar that
  draws August empty, or figures that stay away after the day is cleared.
  Before that, 2026-09-24, **step 2 of the order in full — F38 through F46.** The nine are
  committed and none is pushed.
  **F42 last, on 2026-09-24** (`b0f3514`), and its PRD was signed off the same day (three open questions,
  each answered as recommended): the fetch stores what it reads and no caregiver-terms fetch is
  invented for it, the table is per household, and a page is one row. Nothing was missing but
  the far end — `segmentArticle` has stood since stage 5 and all three article fetches already
  produced a `text`, so three scrapes a day segmented a page and discarded the result.
  `supabase/migrations/20260924120000_the_text_of_a_fetched_page_is_kept.sql` adds
  `cached_pages`, keyed `(household_id, url)` so a re-fetch replaces the page; `listCachedPages`
  and `saveCachedPage` are in both repositories; and `src/lib/pageCorpus.ts`'s `keepPageText`
  is called from `refreshMinimumWage` and from both halves of `refreshIncomeTaxIfStale`.
  **It cannot fail the refresh that called it** — the figure is load-bearing and the corpus is
  not — so a refused write is swallowed there, and that is one of the seven tests in
  `pageCorpus.test.ts`. The text is kept even when the *figure* could not be read, which the
  `RateFetch` comment already promised and nothing honoured. Unit suite 1,219/1,219; the five
  positive tests were checked against the unwired code and all five fail there. No screen
  changed, so nothing is owed to `DESIGN.md`, but `home-screen`, `before-export` and
  `month-export` were run anyway because all three trigger a refresh: 32/32.
  **The user ran `npx supabase db push` on 2026-09-24 and `migration list` says the migration is
  live, so what F42 still owes is the check under rule 8** — open the home screen so the daily
  refresh runs, and confirm in the Supabase table editor that `cached_pages` holds a row for the
  wage page with a title and a non-empty `sections` array; re-open the home screen and confirm
  the row count has not grown. A failure looks like an empty table after a refresh, a growing
  row count, or a home screen that errors.
  What the eight before it were, oldest first:
  2026-09-23, **five of the nine: F38, F39, F40, F41 and
  F43.** The nine were moved onto the Fix list first (`0036a40`), where the GO of 2026-09-22
  had already put them in principle. Each of the five was checked against the code before it
  was built, and **F38 turned out to be built already** — `taxBracketsMissingWarning` has
  stood since the rates reached the series, and only a comment in `month.ts` still called it
  an open question, so that item is a corrected comment and no behaviour (`7d85953`). F39 is
  the salary floor, **answered by the user on 2026-09-23**: a change dated before every row
  of the rate table is accepted rather than judged by today's minimum, since the month is
  floored again at its own confirmation (`cb6233a`). F40 gives `createWorker` the two-worker
  check the list already had, so the two stores stop disagreeing about a request made past
  the withheld control (`c748563`). F41 made the template's six gendered labels placeholders,
  by the same ZipArchive method `7227e91` used, and `workerRole`'s inclusive stand-in goes
  with them (`580e981`). F43 gathers the override and hospital-overtime notes into column I
  (`16a0439`). Unit suite 1,190/1,190 through every commit.
  **F44 followed on 2026-09-24** (`b2c0cf1`): `updateAdvance` and `reviewAdvanceEdit` correct a
  movement in place, keeping its number and its kind, and the ledger is asked from both sides —
  a grant lowered below what has been repaid is refused as `advanceBelowRepaid`, a sentence of
  its own because `advanceRepaidAlready` tells her to remove the repayments first, which is not
  what she is doing. `DESIGN.md` carries the departure: the canvas draws `לתקן` on a line the
  user added and not on a movement. Unit suite 1,199/1,199; `payments-screen.spec.ts` 7/7,
  including the new browser flow.
  **F45 followed on 2026-09-24** (`b981ae3`): `fetchPage` runs under `AbortSignal.timeout`, five
  seconds, which covers every scrape because every scrape goes through it. **It bounds one
  request and not the screen's whole work** — the pre-export screen reads up to three pages, the
  two tax ones only on a day's staleness, so a day when all three sources are down still costs
  fifteen seconds; the budget across a screen was put to the user and not built, and the five
  seconds is the agent's figure, reasoned in the constant's own comment. The abort is read from
  `signal.aborted` rather than from the error, and the body read moved inside the same attempt —
  a throwing `text()` used to leave `fetchPage` by exception rather than as one of its three
  failures. Unit suite 1,201/1,201; `before-export` and `month-export` 19/19. No screen changed,
  so nothing is owed to `DESIGN.md`.
  **F46 followed on 2026-09-24** (`4ac69b6`), and it was the largest of the nine.
  `src/lib/engine/taxConfirmation.ts` is one calculation with two readers — the card and
  `confirmMonth` — so the figure she is shown is the figure that is stored (rule 12). It works
  the tax out afresh, setting aside what the month already carries, and asks the missing-table
  question on that same basis: the month's own warning falls silent on exactly the re-export
  that would store a zero. The card shows **what the sheet will print**, which is an override
  where one stands — ₪0.00 in front of a file saying ₪450 is the one thing a confirmation may
  not do — and it carries no field, because item 17 puts that gesture on `/payments` and the
  card links there (the user, 2026-09-24). `/month/export/file` now refuses a month nobody
  confirmed, so the payslip and `/דוחות` offer **לאשר ולייצא** to `/month/export?month=…`
  instead, and that screen opens on the month the address names — read as a server
  `searchParams` prop, since a client subtree resolving after hydration replaced the questions
  mid-answer. Both departures are in `DESIGN.md`.
  **The rule cost eight browser tests, and that was the finding rather than a cost**: the demo
  seed confirms nothing, so its every screen had been handing over files for months nobody had
  confirmed. `store.ts` gained a `confirmed` household (the demo with 2026 filed) for the tests
  that download a month, and two of the eight became F46's own assertions — the payslip and
  `/דוחות` offer the confirmation for an unconfirmed month and no file. `alerts.spec.ts`'s
  "stays a blockage after a file is made from the reports" is now "the reports have no file to
  make".
  **The eight owe the user's own check (rule 8), which has not been run.** For F46: open
  `/דוחות` on a household whose months are drafts — each ended month offers `לאשר ולייצא` and no
  Excel link, and pressing it opens the confirmation on that month; take a month through it and
  the row offers its file. On the confirmation screen itself, the income-tax card says what will
  be filed — for a month carrying a manual correction it says her figure and calls it hers, and
  the exported sheet prints that same figure. And for F44: open `/payments` on a
  month that records a movement of an advance, press `לתקן` beside it, change the amount and the
  reason and save — the row says the new figure, the advance keeps the number it had, and what is
  still owed moves with it in that month and in every later one; then reopen it and type an
  amount smaller than what has already been repaid, which is refused on the screen and leaves the
  figure as it was. And for the five before it: open `/settings`
  and record a salary change dated to a month before April 2025 — it is accepted now, where
  it used to be refused as below the minimum; export a month and open the sheet — `B10`,
  `F29`, `G1`, `B9` and `I1` should read for a woman exactly as they did before, and a
  worker whose profile says male should get the masculine wording throughout; and export a
  month carrying an override and a hospital-overtime entry with notes on them, unhide column
  I, and confirm both notes sit beside their own rows. F40 has no screen to check from — the
  list withholds the control, which is the whole reason the action now checks too.
  Before that, 2026-09-23, **step 1 of the order — the rate PRD, which the user's answers
  reduced to two fixes and no schema change.** The PRD asked four questions and each one closed
  a branch of it: the fetched tables stay shared, the holiday lists already answer per worker
  through `holidaySource`, the tax brackets are the state's, and the base wage above the minimum
  — the flexibility the user was after — is `SalaryControl` on `/settings`, built since stage 7.
  No migration, no new table, no repository change. What was left was the finding's other half:
  `confirmMonth` now writes the wage row **only where that date does not already hold the
  figure**, so confirming an offered wage no longer replaces the address it was fetched from
  with "אושר על ידי המשתמש/ת" under one primary key; and the failed-fetch sentence
  before an export now links to `/settings#rates`. **That link needed a screen to land on**, so
  the rate rows there gained `נקרא מ־` — item 4's fourth thing, which no screen but the export
  confirmation had ever shown. `DESIGN.md` carries both departures. Three browser tests, and the
  source one was checked against the restored bug. The `specs.md` sentence for the rate row's
  source was put to the user with its exact wording and approved on 2026-09-23; item 4 carries
  it, and nothing is owed. The browser suite ran whole, 140/140, no flake.
  Committed as `a97dedc`.
  Before that, 2026-09-23, **F36** — the income-tax scraper is wired. Nothing was missing but
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
- **The refusal card was `build_plan.md` stage 8¾, not a stage 8 item, and it is done**
  (2026-09-24). Its PRD was signed off 2026-09-22 (`fb6176f`) and the `specs.md` sentence it
  owed was approved and written on 2026-09-24, so neither is asked again.
- **The order from here, settled with the user on 2026-09-23**, and the whole of it — a session
  does the first of these that is not done, and only that one:
  1. ~~**The per-worker rate override PRD.**~~ **Done 2026-09-23** — see "Last done" above.
     It closed as two fixes and no schema change; the override layer was not wanted.
  2. ~~**The nine GO/NO-GO findings.**~~ **Done 2026-09-24.** They are a **GO** (2026-09-22) and are the Fix list's
     F38–F46; the detail of each stays under "Needs the user" below, marked `GO/NO-GO`.
     **Done in full: F38–F41 and F43 on 2026-09-23, F44–F46 and F42 on 2026-09-24.**
     `specs.md` decided every one, so each was a fix and none
     was a design question — the two screen questions F46 raised were put to the user and
     answered (2026-09-24), and its departures are in `DESIGN.md` as F44's are.
  3. ~~**Stage 8¾, the refusal card.**~~ **Done 2026-09-24** — see "Last done" above. Its
     browser scenario had to be rewritten: the plan's "strand a free rest day without
     answering the panel" is a state stage 8½ closed, so the suite seeds the refusal
     instead. Its own "Open" question — whether the export file route refuses with the same
     card — is not answered and is now a debt in `build_plan.md`.
  4. ~~**A review of the layout and the UI/UX methods the application uses.**~~ **Done
     2026-09-24** — see "Last done" above. Its seventeen findings are run 7's section, and the
     judgment call it was left — the rate row's verbatim workbook citation — is answered there
     as R7.17.
  4½. **Execute F47–F63**, the review's seventeen fixes, one commit each and in that order —
     the seven rule defects first, then the ten screen changes she approved on 2026-09-24.
     **All of them come before F32**, which she said the same day. **All seventeen are done,
     2026-09-25, and only F47 is committed — the rest are the uncommitted batch.**
  4¾. **Stage 8⅞ — the country of origin is correctable.** Its PRD was put to the user and
     signed off on 2026-09-25, with both open questions answered: it runs **after F63 and
     before F32**, and the control goes in the **employment** group beside `מין`. The steps
     are in `build_plan.md`, not here. It **changes behaviour**, so it is not a Fix-list item
     (ground rule 1) and it is a stage of its own. It owes a `specs.md` sentence, whose exact
     wording is put to her first.
  5. ~~**F32 (`/doctor`)**.~~ **Run 2026-09-25, not closed** — see step 9 below, where she
     moved it to last.
  **The order was replaced on 2026-09-25, after run 8. What stands is steps 6 to 9, in this
  order, and a session does the first that is not done:**
  6. **Run 8's fifteen findings.** R8.1–R8.7 and R8.15 are fixes against a rule already
     written down; R8.8–R8.14 are judgement calls, and she asked for **all fifteen**. Each is
     one commit unless she asks for a batch. The browser suite runs whole afterwards, and
     **nothing is written to a source file while it runs** — see the header.
  7. ~~**The two refusal debts**~~ — **done 2026-09-26, `9c52ca4`.** Both from
     `build_plan.md`'s "Still to pay", both in one step
     because they share `calculateSeries`' callers and no split of them is worth paying twice.
     **(a)** `/month/export/file` and `/reports/file` throw on a refused month —
     **answered 2026-09-25: the route redirects to the screen that already draws the refusal
     card**, so she lands where the mark she must correct is, and no second surface is
     invented for a refusal the card already words. **(b)** A refusal in one worker's month
     takes the other worker's figures off the screen — the four screens catch around the whole
     replay where `calculateSeries` runs per worker. **Answered 2026-09-25: fix it here.**
     This step **changes behaviour**, so it is not a Fix-list item (ground rule 1); it owes a
     `specs.md` sentence whose exact wording is put to her first (rule 1), and the debts come
     out of `build_plan.md` as they are paid.
  8. ~~**A standing line with a lifetime**~~ — **done 2026-09-26, `f56f602`.** Asked for 2026-09-25,
     and she placed it **before F37**. **What exists already:** `UserLine`
     (`src/lib/engine/types.ts:580`) serves both lifetimes — a one-off on the month
     (`MonthFacts.userLines`) and a **standing** one on the profile
     (`WorkerTerms.standingLines`, snapshotted onto each month with the other terms at
     `month.ts:158`), already positive or negative by `direction` and already placed before or
     after the gross. It can be added, edited and removed (`src/app/workers/actions.ts:540`,
     `:573`, `:606`). **What is missing, and is the whole of this step:** a standing line has
     **no lifetime**. It has no first month and no last month, so it cannot run for a range;
     and the only way to stop one is to delete it, which loses the record and cannot be undone,
     so it cannot be *turned off* and on again. **The screen half:** `/payments` currently
     explains the difference in prose and sends her to another page for the recurring kind —
     she said that reads poorly, and the wording and the control both move with this step.
     It **changes behaviour and adds a field**, so rule 2 applied: **the PRD and its
     implementation plan were put to her on 2026-09-25 and every open question was answered
     the same day.** The `specs.md` paragraph was quoted to her and answered **yes**, and is
     **already written into item 20**, under the "How long it lasts" bullet — so no session
     asks for it again. What is left is the build.

     **What was settled, and none of it is re-decided by a session:**
     1. **One lifetime, not two controls.** A first month and an optional last month.
        "Turning off" **sets the last month**; clearing it starts the line again. A separate
        on/off switch was rejected because a range plus a switch is four states the user has
        to hold, and Part 1 says to choose the option that requires her to know less.
     2. **Extending refills** every month inside the new range **that is not confirmed**. A
        confirmed month keeps the snapshot it was confirmed with — F28's rule, not a second one.
     3. **Months, never days.** `from` and `until` are month keys. A line starting in the
        current month applies to it while that month is unconfirmed and not yet over.
     4. **A missing lifetime means "always"**, which is exactly what every standing line
        written before this step meant — the idiom `placement?` already uses, where an
        omitted value and the old behaviour are the same thing rather than merely similar.
        **This is why there is no migration:** `standing_lines` is a `jsonb` array
        (`supabase/migrations/20260910183000_…sql:70`), so the new keys need no schema change.
     5. **A stopped line stays listed**, under its own quieter heading, with its range shown —
        otherwise the edit that would restart it is on a row she cannot see.
     6. **A line about to end raises a warning.** `standingLineEnding` in the **warning** list
        of `src/lib/engine/actionList.ts`, in the month before the line's last month, naming
        the line and the worker. **It is not a new shape:** it is the second stage of the
        pattern `documentExpiring`/`documentExpired` and `recuperationApproaching`/
        `recuperationDue` already run. It fires only for a line that *has* a last month, and
        never for one already stopped.
     7. **The two screens stay exactly as they are** — reversed by her on 2026-09-26, after
        the decision of 2026-09-25 to move all editing to `/settings`. `/payments` keeps its
        one-off control and `/settings` keeps the standing one, which is where both already
        are. **No screen moves in this step.** The only screen work is wherever the lifetime
        itself has to be shown and edited, and wherever a stopped line is listed.
     8. **Whatever words the lifetime needs are genderless.** `he.ts`'s convention is the
        infinitive for a control (`לצאת`, `לבטל`, `להמשיך`) and the impersonal for prose
        (`אחרי שמוסיפים אותה`); only the *worker* takes dual forms (`עובד/ת`). A second-person
        feminine draft was rejected for that reason. The existing screens keep their existing
        strings (decision 7), so what this step adds is only the lifetime's own words — a
        range, and the quieter heading a stopped line sits under.

     **Answered by her on 2026-09-26: the button deletes, and a confirmed month keeps what it
     was confirmed with.** The question was whether a line *added by mistake* keeps a real
     deletion once the lifetime exists, and both halves are hers in her own words — "do delete if
     they clicked להפסיק", and "if it was confirmed then do keep it on the month that was
     confirmed". So the gesture on the row removes the line from the profile, which is what
     `stopStandingLine` (`src/app/workers/actions.ts:597`) already does, and `saveProfile`'s
     re-snapshot takes it out of every month not yet confirmed while a confirmed month keeps its
     snapshot — F28's rule, unchanged and not this step's to touch. The third-party payments she
     asked about in the same breath already have both gestures (`לתקן` and `להסיר` per row,
     `MonthActions.tsx:1440`, `:1451`), so this is the standing kind alone.
     **What it replaces in the plan:** decision 1's "turning off **sets the last month**" and
     decision 5's "a stopped line stays listed" no longer describe that button. The lifetime
     itself stays and is the range — a line whose last month has passed reaches no later month,
     stays listed, and is started again by clearing or extending that month — and decision 6's
     warning is unaffected. What is gone is stopping *as* the way of ending a line.
     **Two things follow, and neither is a session's to settle.**
     **(a) `specs.md` item 20 is corrected and nothing is owed.** Its sentence said the
     opposite — a line is stopped by setting its last month rather than by deleting it, and a
     stopped line stays listed — so the replacement was **quoted to her as its own question and
     approved on 2026-09-26** (rule 1). Item 20 now carries both endings: a line removed outright
     when she asks, a confirmed month keeping its snapshot, and a line *meant* to end ended by its
     last month and restarted by clearing it. **No session reopens it.**
     **(b) A button that deletes cannot keep the word `להפסיק`.** **Answered 2026-09-26:
     `להסיר`**, which is the word four other removable rows already wear — the opening advance
     and the three per-row removals on `/payments`. `he.workers.profile.terms.standing.stop` is
     gone and `remove`/`removeLabel` stand in its place.

     **What was built**, against the plan's own six steps. (1)–(4) as written. (5) **No screen
     moved** — decision 7 reversed that, so the only screen work was the lifetime itself: two
     month selects in the panel, the range under each row, and `שורות שנגמרו` for a line whose
     last month has passed. `MonthSelect` moved out of `MonthActions.tsx` on the way, so the
     covered period and the lifetime share one control rather than two copies of the argument
     against `<input type="month">`. (6) The rule-12 test is two cases in
     `src/lib/export/agreement.test.ts`, and the second is the one worth having: the sheet's
     own column E, read off its cached figure, is **lighter by exactly the line's ₪50** in a
     month past the line's last — a total that merely differed would prove nothing about which
     line left it. **Expected figures came from outside the code** (rule 11): the boundary
     months are item 20's sentence worked out on paper, and the ₪50 is the fixture's own.

     **`specs.md` item 20 is settled and nothing in it is owed.** The approved paragraph is
     in, and its one sentence that decision 7's reversal made wrong — the one sending all
     editing to settings — was **quoted to her and removed on 2026-09-26 with her plain yes**,
     under rule 1. Item 20's own older sentences about where each kind is made are correct and
     stand. **No session reopens item 20 for this step.**

     **The check she ran (rule 8), passed 2026-09-26:** add a recurring deduction of ₪300 from next month until
     three months after, where standing lines are set today; confirm it appears on those three months and on no others; stop it
     early and confirm the months after the new end lose it while a month already confirmed
     keeps it; confirm the warning appears the month before it ends; export one affected month
     and confirm the sheet agrees with the screen. A failure looks like the line appearing
     outside its range, a confirmed month's total moving, or the sheet and the screen
     disagreeing.
  9. ~~**F37** — strip the history out of `specs.md`~~ — **done 2026-09-26.** Twenty-five
     deletions quoted to her and approved as one batch; nothing else in the file was touched.
  10. **F32 again.** Its settings half is done. What is left is **the Claude Docs connector,
     which is hers** (`/mcp` here, or claude.ai → Settings → Connectors — prefer the latter,
     because `/mcp` is per-project and this project is registered twice; see "Needs the user").
     Then `/doctor` is run once more, and the entry's own check — "`/doctor` reports nothing
     left to fix" — is what closes it.

  **Ask before each commit** (said on 2026-09-18).
- **The migrations are live.** The user ran `npx supabase db push` twice on 2026-09-24, the
  second time for F42's `cached_pages`, and `npx supabase migration list` shows every local
  migration remote. Nothing is unapplied.
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
- **Waiting on the user**, and a session may answer none of it for her: **the Claude Docs
  connector**, which is the one item left and is step 10's.

  **Answered already, so do not ask again:** where stage 8¾ sits, which is step 3 above; the
  sign-off on step 1, given 2026-09-23 and built; which household the broken one is — the
  live Postgres one, and she is no longer locked out of it; **step 1's check (rule 8), run and
  passed on 2026-09-26**; and **step 8's check — the ₪300 recurring deduction over three
  months — run and passed the same day**. Neither is re-run and neither is re-asked.

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
| 8 | Execute the Fix list, one item at a time | under way — F1–F31, F33–F46 done; F32 and F37 remain. Stage 8¾ landed between step 2 and step 4 |
| 9 | Layout and UI/UX review (step 4 of the order, asked for 2026-09-23) | **done** 2026-09-24 — run 7's section. All seventeen findings approved the same day: sections I (F47–F53, rule defects) and J (F54–F63, screen changes), executed before F32 |
| 10 | Execute run 7's seventeen (step 4½) | **done** 2026-09-25 — F47–F63, committed as `e492ddf` and `591a67b` |
| 11 | Stage 8⅞ — the country of origin is correctable | **done** 2026-09-25, `f72eadc` |
| 12 | F32 — `/doctor` | **run 2026-09-25**; its settings actions are applied. Not closed: one item is the user's (the Claude Docs connector) and two findings owe a line under "Needs the user" |
| 13 | Run 8 — the two-axis code review and a second `ponytail-audit` | **done** 2026-09-25 — fifteen findings, fixed point `9327b3d`. **Awaiting the user's GO**, which is step 14 |
| 14 | The user signs run 8 off | **done** 2026-09-25 — **all fifteen**, and the four open questions answered. The order she set is steps 6–10 under "The order from here" |
| 15 | Execute run 8's fifteen | **done** 2026-09-26, `62a7070` — fourteen fixed, R8.15 withdrawn as wrong; the commit carries F64 too |
| 16 | The two refusal debts, together | **done** 2026-09-26, `9c52ca4` — both paid; `/workers` and `/workers/[id]` are the one debt left in their place |
| 17 | A standing line with a lifetime | **done** 2026-09-26, `f56f602` — the button's word answered the same day (`להסיר`). 169/169 browser, 1,265/1,265 unit, and her own check passed |
| 18 | F37, and the size question | **done** 2026-09-26 — 25 approved deletions, then the Part 2 index and 3 narrow cuts; 31 replacements in all. Typecheck, lint, 1,265/1,265 |
| 19 | F32 again | **open** — the connector is hers, then `/doctor` is re-run |
| 20 | F64 — her two notes on the rates group | **done** 2026-09-26, `62a7070` — committed inside run 8's batch, as she asked, rather than alone |

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

## Run 7 — layout and UI/UX, 2026-09-24 (step 4 of the order)

Report-only; no code changed. Every screen was opened in headless Chrome against the `demo`
and `refused` seeds on the pinned day, at 390, 768, 1024, 1279 and 1440 wide and at four
heights, and the measurements below are the browser's rather than a reading of the markup —
contrast, pointer targets (hit-tested with `elementFromPoint`, so a pseudo-element hit area
counts), computed direction, and cell size against viewport. Nothing scrolls sideways at any
width and no screen logs a console error. **The `?` disclosure was checked and is not a
finding**: its `after:-inset-2.5` gives a real 40px target though the circle is drawn at 20.

**Against a rule already written down** — these need no design decision.
- R7.1 — a holiday's name sits at the opposite edge of its row from its own date, and moves
  250px sideways depending on whether the row is chosen — `HolidayPickerScreen.tsx:530` — the
  `dir="auto"` wrapper holds only a `<Bidi>`, so it resolves **left**-to-right (`CLAUDE.md`,
  "Never put `dir=auto` on an element whose only child is a `<bdi>`"); measured `dir=ltr` on
  the name against `dir=rtl` on the date inside one box. F6 swept the wrappers R2.1 listed and
  this one was not among them. It is the only instance left in the application, and it flips a
  Hebrew list (`תאריך שהוסף`) exactly as it flips the Philippine one.
- R7.2 — `text-ink-faint` (#9a8874) carries body sentences at 3.23:1, under 4.5 —
  `ReportsScreen.tsx:382` (16px), `WorkersList.tsx:235` (15/16px), `WorkerProfileScreen.tsx:209`
  (13px) — the token's own comment in `globals.css` scopes it to "the line under the greeting",
  and these three are the only text in the application that fails a contrast sweep of every
  screen.
- R7.3 — seven inputs on `/settings` have no accessible name, and four of them are the
  identifying numbers — `WorkerTerms.tsx:124` — `TermRow` draws the row's name as an `<h3>` and
  the control under it is a bare `<input>`, so passport, employment permit, work visa and bank
  are four fields a screen reader announces alike; the other three are the rest-eve supplement,
  the employment start date and the insurer. `Field.tsx` already associates a label and is what
  the panels use.
- R7.4 — pointer targets under 24×24 (WCAG 2.2 AA 2.5.8), measured: the blocker strip's actions
  and `הצג הכל` at 21px (`HomeSections.tsx`), `RuleLink` at 19–23px wherever it stands on a line
  of its own (`WhyDisclosure.tsx:114`, on `/`, `/alerts`, `/month/export`), `להתנתק` and
  `להוריד סיכום שנתי` at 23px, the holiday tick at 24×23 — `DESIGN.md` already holds the fix
  ("padded out to a finger's height and given back with a negative margin"), applied to the forms
  and not to these.
- R7.5 — a disabled filled button reads as a second, lighter *enabled* one — `Field.tsx:15` —
  `buttonClass` disables with `opacity-50` alone, which turns forest into a sage indistinguishable
  from a quiet action; on `/settings` with the groups open, three saves are dark and three sage,
  and only the sage ones are dead. `outlineButtonClass` four lines below gets border, ink and
  `cursor-not-allowed`.
- R7.6 — `/` draws its `h1` after an `h2`: the opening screen's outline starts at `צריך לטפל`
  and reaches `ספטמבר 2026`, the calendar's month, second. Every other screen's first heading is
  its own `h1`.
- R7.7 — one action, two words, on one screen — `he.ts:1117` `שמירה` in `hospitalOvertime`
  against `לשמור` in the six sibling groups of `/payments`.

**Layout the viewport breaks**
- R7.8 — a day cell's height is the window's and not the content's: 91×83 at 1440×900, 91×105 at
  1440×1080, 77×177 at 1280×1440 — the grid stretches inside `md:h-screen`, so the artboard's
  near-square day holds at about one window height and becomes a tall rectangle above it, the
  number floating in the middle of an empty cell.
- R7.9 — `<main>` is the scroller from `md` up — `AppShell.tsx:383` with
  `md:h-screen md:overflow-hidden` — so the document never scrolls: back-navigation restores no
  position (press a blocker card from the foot of `/` and come back to the top), `Ctrl+P` prints
  one screenful of the payslip, and a full-page capture takes one screenful. Worth weighing
  against what the lock buys, which is a bar that never leaves.

**What the screens do with what they hold** — each of these changes a screen, so each is a
proposal and not a fix (ground rule 1).
- R7.10 — a folded section says nothing about what is inside it: `/payments` opens as six
  headings and no figure, and the five advances under `מקדמות` are invisible until it is opened
  — `FoldSection.tsx` draws `aside` only while the section is open, which is the one place a
  count or a sum could sit.
- R7.11 — the same fold reads as two controls: `/payments` puts its headings inside the white
  card, `/settings` leaves them on the page ground above four separate cards, so on `/settings` a
  heading is not visibly attached to what it opens and its chevron sits 800px away from it.
- R7.12 — one recurring alert reads as a screen of separate problems: the strip shows 4 of 28 and
  `/alerts` draws all 28 at full height (7,135px at 390 wide), a dozen of them the same sentence
  about a different month with the same button.
- R7.13 — `חודשים קודמים` on `/דוחות` is 17 rows and one longer every month, with no year break
  and `לאשר ולייצא` + `לדף המשכורת` on each; September's row carries `החודש עדיין לא הסתיים` and
  the confirm-and-export link beside it.
- R7.14 — a save dims the whole screen: `opacity-60` on the page, and `pointer-events-none` too
  on `/payments` — `PaymentsScreen.tsx:215`, `SettingsScreen.tsx:138`, `HomeScreen.tsx:361`,
  `MonthConfirmation.tsx:122`, `HolidayPickerScreen.tsx:150` — so saving one note greys the
  calendar and every other row, which on a slow answer reads as the page failing rather than as
  one field being written.
- R7.15 — a refused month leaves the balances rail drawing `[מספר] ימים` four times —
  `HomeSections.tsx:160,200` — `DESIGN.md` withholds the money column while the card stands and
  says nothing about the rail; a bracketed placeholder on screen is the thing `[השם שלך]` was
  cut for.
- R7.16 — `מדינת מקור` opens on `אוזבקיסטן`, the first of six, and it is what decides the
  worker's holiday list — `AddWorkerSteps.tsx:315` — a default nobody chose is saved as an answer.

**The judgment call step 4 was left** (the rate row's source, 2026-09-23)
- R7.17 — **the verbatim string should not be printed; the row should carry a sentence.**
  `SettingsScreen.tsx:574` branches on `source.startsWith("http")`: a URL becomes the link
  `המקור`, and anything else is printed as it was stored — which for the seeded minimum wage is
  `שכר_חודשי_להאנה2026.xlsx → חודש  4.26 → D6`. Two things decide it, and neither is taste. It
  is not a source she can go to: the link branch keeps the row's promise and the other hands her
  a path into a file the application does not hold. And printed it is not even exact — the mixed
  Hebrew and Latin filename reorders in the right-to-left span and renders as
  `xlsx.2026שכר_חודשי_להאנה`, the extension in front of the name, and it carries no
  `translate="no"`, so a translated page rewrites a cell address. So: keep the fact — read from
  the family's own sheet, typed by hand, read from the law — and keep the citation itself in the
  test and the commit message, which is `CLAUDE.md` rule 6's own division.

Seen and left: the demo's two placeholder names (`[שם]`, `[שם העובד/ת השני/ה]`) make every
screenshot of the application read as unfinished, but they are seed data and not a screen; the
`·` separators that fail contrast are `aria-hidden` decoration; `MonthActions.tsx` at 1,903
lines (R2.21, which F27 took as far as it goes).

## Run 8 — `mattpocock-skills:code-review` (both axes) and `ponytail-audit`, 2026-09-25

Fixed point `9327b3d` — the three commits run 7's execution and stage 8⅞ became, which no
review had seen. Both axes were spot-checked against the files before being written down.
`ponytail-audit` found **nothing to cut** repo-wide (no dead deps, no hand-rolled stdlib, no
single-implementation abstraction; `jszip` earns its place reading raw parts `exceljs` parses
back as its own); its one finding is R8.15, routed here because it is correctness and not bulk.

R8.1 — the per-month "handled" chips are drawn disabled while a press is in flight — `src/components/AlertsScreen.tsx:150` — `DESIGN.md` says the busy control is not drawn as a disabled one and the region around it says nothing; one press disables every month on the card, which is the state the same commit removed from five other screens.
R8.2 — a null month writes a broken accessible name — `src/components/AlertsScreen.tsx:153` — `one.month ?? ""` renders a label with a hole in it; the non-null invariant lives in `alertsView.ts:247` and not in the type.
R8.3 — the Hebrew sentence outside `he.ts` carries no note saying why it may stay — `src/lib/datedRates.ts:105` — it is a stored-row sentinel nothing draws, which is the exemption, but the comment says only what it replaced, so the next reader moves it into `he.ts` and changes what a stored row means.
R8.4 — F48's own check was never built — no contrast sweep in `e2e/`, `scripts/` or `package.json` — three faint paragraphs moved to `text-ink-soft` and nothing stops the fourth; the file that would close it is the parked one under "Needs the user", which this run does not decide.
R8.5 — F52 is asserted on two households where its entry names three — `e2e/home-screen.spec.ts:601` — the loop is demo and refused only, so the `leads === "month"` branch (`src/components/HomeScreen.tsx:291`) is the case F52 singled out and the one not covered.
R8.6 — F56 left three of six sections without a folded line — `src/components/MonthActions.tsx:832`, `:1563`, `:1777` — `userLines`, `thirdParty` and `overrides` pass neither `aside` nor `summary`, so each still opens as a bare heading, which is the defect R7.10 named.
R8.7 — F50's sweep drops the two controls F50 names first — `e2e/pointer-targets.spec.ts:53` — the inline-link exception skips any anchor whose parent holds more text, so the blocker strip's action (`HomeSections.tsx:64`) and the show-all link (`:87`) are excluded before measurement and the spec's own docstring claim is false.
R8.8 — the in-flight guard and its five-line comment are copied whole — `src/components/useAction.ts:45` and `src/components/PaymentsScreen.tsx:153` — one rule kept in two places drifts at the next edit.
R8.9 — `MonthConfirmation` reimplements `useAction`'s `pressed`/`busyAt` by hand — `src/components/MonthConfirmation.tsx:79` — because its key is a boolean; passing `String(withNotes)` to `run` would delete the state.
R8.10 — the busy key is an ad-hoc string minted five ways — `src/components/MonthActions.tsx:968`, `src/components/HolidayPickerScreen.tsx:464` and three inline forms — a typo yields a control that never shows busy, and nothing catches it.
R8.11 — `act(at, action, control = at)` carries two key spaces told apart only by a comment — `src/components/HolidayPickerScreen.tsx:118` — one `{ anchor, control }` argument would name them.
R8.12 — the singular/plural branch is repeated per key — `src/lib/alertsView.ts:148`, `:157` — a third gathered kind means a third copy.
R8.13 — `GRID_GAP = 7` mirrors a Tailwind class and is wrong below `sm` — `src/components/MonthCalendar.tsx:260` — `sm:gap-1.75` sits on line 553 and `gap-1` (4px) under it; nothing keeps the number and the class string in step.
R8.14 — `drawnRateSource` still takes a bare string — `src/lib/datedRates.ts:121` — it branches on `startsWith("http")` over a field that `rateSources` now makes a union.
R8.15 — the bracket parser's plausibility guard is never called — `src/lib/scrape/incomeTax.ts:182` — `checkBracketsPlausible` is exported, documented at length and referenced nowhere, while its sibling `checkPlausible` (`src/lib/scrape/minimumWage.ts:111`) is called at `:189`; a table read out of order produces a tax figure that looks ordinary, which is what the guard was written to refuse.

Seen and not reported: the `heading` prop threaded through `Blockers`, `RefusalCard` and
`MonthCalendar` reads as Shotgun Surgery but is `DESIGN.md`'s rule decided once in
`HomeScreen.tsx`; `TermRow`'s `children` union is the documented idiom. The diff is otherwise
clean against this repo's own conventions — no physical `left`/`right`, no `dir="auto"` over a
lone `<bdi>`, every new dynamic string wrapped, no clock read in a render, money untouched.

**Executed 2026-09-26, all fifteen, as one batch she asked for.** Fourteen are fixed and
**R8.15 is withdrawn as wrong**: `checkBracketsPlausible` *is* called, at
`src/lib/scrape/incomeTax.ts:242` inside `parseTaxBracketsPage`, so no tax figure is offered
without it. What is true of it is only that it is exported and used in its own file — and
`knip --production` lists it beside `checkPlausible`, the sibling the finding held up as
correct, along with a dozen other exports this repository already tolerates. Nothing was
changed for it rather than a fix being invented for a defect that is not there.
**What the other fourteen became, in one line each:** R8.1 the alerts card's chips take
`useAction`'s `busyAt` and drop `disabled`, with `e2e/busy-state.spec.ts` gaining the third
case — and its neighbour assertions are **plain reads and not `expect` retries**, which is how
the first version of that test passed against the restored bug; R8.2 `AlertCard.dismiss` is a
union of `one` and `each`, so the screen branches on the type and the `?? ""` and the `months[0]!`
are both gone; R8.3 the stored Hebrew sentinel now says why it may live outside `he.ts`;
R8.4 the sweep is `e2e/contrast-sweep.spec.ts`, its header rewritten, green on ten screens at
two widths and checked against a paragraph put back to `text-ink-faint` (3.42:1); R8.5 the
month-leading outline case is asserted in `alerts.spec.ts`'s no-blockage household, which is
the only place that state exists; R8.6 `userLines`, `thirdParty` and `overrides` gained folded
lines naming what is inside them, and `he.ts` one new sentence for a month whose calculated
rows are all untouched; R8.7 the pointer sweep's inline exception now asks whether the link is
in a **text flow**, since every string here is wrapped and "the parent holds more text" excused
every standalone action — removing one `touchTargetClass` now fails it 142 times; R8.8 the
one-at-a-time rule is `useOneAtATime` and `useAction` and `/payments` both hold it at their own
scope; R8.9 the two export buttons key off `notes`/`plain` through `busyAt`; R8.10 every busy
key is built by a named builder at both ends; R8.11 `act` takes one `{ anchor, control }`
gesture; R8.12 the gathered singular/plural branch is written once; R8.13 the grid gap is
`--calendar-gap`, read by the `gap` and the cap, so below `sm` the cap stops using the `sm`
gap; R8.14 `RateSource` types what may be written as a source, which caught a workbook citation
still sitting in a test fixture.

**R8.1–R8.7 and R8.15 are defects against a rule already written down**, so each is a fix and
none is a design question. **R8.8–R8.14 are judgement calls** and change no behaviour.
**One behaviour change is in the diff and is nobody's approved item** — it is under
"Needs the user" below, and this run does not decide it.

## Needs the user

**Whether `specs.md` should be made shorter — asked and answered 2026-09-26. Settled; kept
only because it says what was measured, so nobody measures it again.** F37 took 3.3KB out; the file is 132,615 chars over 1,690 lines, and **Part 2 is 95,504 of
them — 72%**. Within Part 2, six of twenty-nine items carry **57%** of the words: item 17 (2,240),
item 20 (2,163), item 8 (1,700), item 5 (1,459), item 16 (1,120) and item 7 (1,053), against a
median item of 340. **Nothing is padding**: 614 sentences over 60 chars hold **zero exact
duplicates**, and 23 of 23,069 twelve-word phrases recur (0.1%). So there is no cut that costs
nothing, and the three levers differ in what is lost:

1. **Make Part 2 addressable, deleting no word.** `CLAUDE.md`'s read protocol is "grep the part,
   read to the next heading" — and Part 2 has no sub-heading, so reading "Part 2" means reading
   95KB. Per-item `###` headings, or an index at Part 2's head, would let a session read item 17's
   2,240 words instead of 17,000. **This is the one lever that loses nothing**, and it cuts what
   the file actually costs a session rather than what it weighs. It needs a `CLAUDE.md` line too.
2. **Move the screen prose in items 17 and 20 to `DESIGN.md`.** Both argue at length about what a
   screen *draws* — the three-figure block, which half a line sits in, which name survives a
   collapse. `DESIGN.md` is the "how it looks" file and is read by whoever is building a screen.
   A relocation, not a deletion, but the specs/design boundary is genuinely blurred here: which
   figure is drawn when is behaviour, and moving it would put a rule where no test-writer looks.
3. **Compress the big six's reasoning.** Perhaps 3,700 words, ~22% of Part 2. **This is the lever
   to refuse by default**: what would go is the *reasons*, and working rule 4 exists because "a
   plausible invention is the hardest kind of wrong answer to find later". Every reason deleted is
   one a future session can re-litigate from scratch. Worth doing only sentence by sentence, and
   only where a sentence argues against an alternative nobody proposed or restates a rule another
   item already owns.

**She took the recommendation: 1 in full, 3 in its narrow form, 2 refused.** All three of
lever 3's cuts were quoted to her and approved — item 8's doubled sentence, item 17's third
statement of the credit-points rule, and item 20's self-quotation. **Nothing here is still owed.**

**Her two notes on the rates group, 2026-09-26 — asked and answered the same day, and now F64.**
Raised by her and not by a run: `שערים ותשלומים קבועים` over `מה משולם מלבד המשכורת, ובאיזה קצב`
(`he.ts:1628`) describes none of the three rows under it (`SettingsScreen.tsx:244`) — a wage the
salary may not fall below, a percentage fixed in law, and the words the medical-insurance line is
printed with — and the note promises a cadence two of the three do not have. **Answered 2026-09-26,
both halves:** the minimum wage moves under `שכר בסיס לחודש`, and what is left is named `ביטוחים`
with a note saying what each of the two is set by. She chose that note against two alternatives, so
**the exact Hebrew is F64's and is quoted only there.** Nothing is owed to `specs.md` — item 4 asks
for the figure, its date and its source on this screen and names no group and no heading — and
`DESIGN.md` takes the departure in F64's own commit (working rule 3).

**Where the four-yearly payment is — she asked on 2026-09-26, and it is already built.** Recorded
as a third-party payment on `/payments`, `אגרה להארכת רשיון העסקה` (the sheet's B16, `specs.md`
item 19's "licence renewal that falls once every four years"); reminded in
`לקראת החודשים הבאים` in the month `היתר העסקה` expires, and warned by `documentExpiring`
(`actionList.ts:159`). The four years themselves are stored nowhere: the due month is derived from
the expiry date on `/settings`, so the reminder recurs at the document's own pace and only
`agencyFee` carries a fixed period. **No work follows from the question** — it is written down here
only so it is not asked twice.

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

**A second press is silently dropped, and no item asked for it. Found by run 8, 2026-09-25.**
`useAction` gained an `inFlight` ref and its `Send` contract changed from `void` to `boolean`
(`src/components/useAction.ts:42`), so a second press while the first is travelling now does
nothing. F60 asked only that the busy state move onto the pressed control. On `/payments` the
`pointer-events-none` it replaced already enforced this, so nothing changed there; on `/`,
`/settings` and the holiday picker a second press used to go through and no longer does. It is
written down in the `DESIGN.md` paragraph the same commit added, which is rule 3's form — but
the change was never put as its own question. **Answered 2026-09-25: keep it.** The drop
stands, and nothing in run 8 restores the second press.

**F48's contrast sweep — answered 2026-09-25: it joins the suite.**
`contrast-sweep.spec.ts`, 133 lines, is in the F48 session's scratchpad, under
`AppData\Local\Temp\claude\d--school-LLM-vibe-coding-EaseSalary\551c64fe-4943-4745-a3ff-0a2b31f49b92\scratchpad\`.
It walks ten screens and, for every run of visible text, measures the real foreground against
the nearest actually-painted background, computes the WCAG ratio and fails anything under AA
(4.5, or 3.0 for large text), skipping `aria-hidden` decoration. It is what found F48's three
`text-ink-faint` paragraphs at 3.23:1, and it would catch the next token used for body text.
Its own header says "TEMPORARY — delete before committing", so F48 parked it rather than
decide. **A session must not decide this either** — keeping it costs suite time, and a
whole-screen sweep is not a check a fix may add on its own authority (ground rule 1).
It sat in a session scratchpad, which is not forever, so on 2026-09-25 it was **copied into
the repository as `e2e/contrast-sweep.parked.ts`** — that name does not match Playwright's
`testMatch`, so the suite ignores it and nothing it might fail can be blamed on a run that
did not choose to include it. **R8.4 is what finishes it**: rename it to
`e2e/contrast-sweep.spec.ts`, rewrite the header (it still says "TEMPORARY — delete before
committing", which is now false), and make it pass on every screen it walks. **Also seen by
run 8, as R8.4**, which found no sweep anywhere in the repository and so could not report
F48's check as built.


**Run 7's ten screen changes — answered 2026-09-24: every one as recommended, and all of them
before F32.** They are the Fix list's section J, F54–F63, and the detail of each is there rather
than repeated here. Two of them owe a `specs.md` sentence before they are code — the grouping of
repeated alerts (item 27) and whether a month that has not ended may be confirmed — and that
sentence is put to the user with its exact wording when the item is reached (working rule 1).
What she said yes to is the change; no wording in `specs.md` has been approved.

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
answer covers all nine. **Answered GO on 2026-09-22**, so each is on the Fix list below as one
of F38–F46; the detail stays here rather than being copied, and each Fix-list entry names it.

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
  **F36 widened this on 2026-09-23**: the screen now awaits the income tax's two pages in front
  of the wage's, so a stale day is up to three sequential live fetches rather than one. They are
  stale-gated to a day, so most requests fetch nothing — but the day they do, this is the
  finding that decides what the user waits for, and the timeout it asks for is now worth three.
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

  **Answered 2026-09-23, and it is smaller than the sentence above: the fetched tables stay
  shared and are fetched once — what belongs to the worker is an *override* the family sets
  where it wants to pay differently.** The holiday lists need no change at all: which list a
  worker's year is drawn from is already hers (`holidaySource`), so one worker may take her own
  country's list and the other a religious one out of the same shared table. The income-tax
  brackets stay shared too — they are the state's table and do not depend on the salary; what
  differs per worker is her own gross and her credit points, and both already come from the
  month and the profile. A rate's **source address is kept** when a month is confirmed, and is
  overwritten only where the figure was actually typed. Manual entry lives on `/settings`; a
  failed fetch on the export screen says it failed and links there. **The oldest-household
  write is not part of this** — it is `build_plan.md`'s "a person in two households puts what
  is new into the first they joined", which the user accepted on 2026-09-18.

  **Asked on 2026-09-23 and already built, so it is not work:** that the family may set a base
  wage above the minimum, the minimum being only the automatic default. `SalaryControl` on
  `/settings` (`SettingsScreen.tsx:153`) is that control — per worker, dated from a chosen
  month, floored by the server at the minimum in force in that month
  (`workers/actions.ts:451`). **That it was looked for elsewhere is a finding for the UI/UX
  review**, step 4 of the order: the wage the family sets sits in the `העסקה` group and the
  minimum it is floored by sits in `תעריפים` further down, so the relation between the
  two figures is not visible on the screen that holds both.
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
- [x] 2026-09-26 F37 — (added 2026-09-22 at the user's request) **strip the history out of `specs.md`.**
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

**H. The nine GO/NO-GO findings** — approved as one **GO** on 2026-09-22 and moved here on
2026-09-23, which is step 2 of the order. Each one's detail stays under "Needs the user"; the
entry below names it and says what its fix is checked by. Each changes behaviour, and each
change is one `specs.md` already states — no design question is open in any of them.
- [x] 2026-09-23 `7d85953` F38 — **was already built; only a false comment was left** — a year with no tax bracket table leaves the line at zero **and says so** — spec 733
  — `buildClosing` (`month.ts`) folds `null` to 0 with no warning, and its own comment calls
  the warning an open question — check: a month in a year the table does not reach draws a
  warning naming the year, and its tax line is still zero.
- [x] 2026-09-23 `cb6233a` F39 — a salary change dated before the rate table reaches is not measured against
  today's minimum — `reviewSalaryChange` (`salary.ts`, `atFrom ?? now`) — **accepted without a
  check, answered by the user 2026-09-23**: such a month has no figure and the application says
  nothing, and the floor still binds at the month's own confirmation — check: a change dated to
  a month before the table's first row is accepted, and one inside it is unaffected.
- [x] 2026-09-23 `c748563` F40 — `createWorker` refuses a third worker itself — `workers/actions.ts:737` — Postgres
  throws unhandled and the in-memory store accepts it — check: a third worker is refused with
  a sentence in both stores, and the two-worker case still passes.
- [x] 2026-09-23 `580e981` F41 — the sheet's gendered wording follows the profile's `gender` — `he.ts`'s
  `workerRole` and the template's `I1`, `F1`, `G1`, `B7`, `B9`, which spec 1304 fills from the
  profile — check: the export suite reads a male worker's sheet and a female one's and they
  differ in those cells only.
- [x] 2026-09-24 `b0f3514` F42 — the fetched page's text is kept — spec 1344; `refreshMinimumWage` drops `text` and
  `fetchArticleSections` is called by nothing — check: a fetch stores the text it read, and a
  failed fetch stores nothing.
- [x] 2026-09-23 `16a0439` F43 — an override's note and the hospital-overtime note reach column I — `notesOf`
  (`notes.ts`) gathers neither; item 2 writes every action's note — check: the export suite
  finds both notes in `I`, on the rows their figures sit on.
- [x] 2026-09-24 `b2c0cf1` F44 — an advance movement is corrected by **editing the entry** — spec 800-809;
  the month had `addAdvance` and `removeAdvance` and no edit — check: an advance's amount and
  note are changed in place, its number is unchanged, and a repaid advance still refuses what it
  refuses.
- [x] 2026-09-24 `b981ae3` F45 — a slow or broken source never delays a screen — `/month/export` awaited
  the wage's and the tax's live fetches in front of the render and no scraper had a timeout —
  check: a source that never answers leaves the screen drawn on the cached figures within the
  timeout.
- [x] 2026-09-24 `4ac69b6` F46 — the income tax is confirmed before every export, and the file route refuses an
  unconfirmed month — `confirmMonth` stored `taxToConfirm` unseen and
  `month/export/file/route.ts` checked only `blocksExport` — check: the tax appears on the
  before-export screen as the wage does, what is confirmed is what the sheet prints, and the
  file address refuses a month nobody confirmed.

**I. Run 7 — the written rules the layout broke.** Seven items from the layout and UI/UX
review of 2026-09-24, each a defect against `CLAUDE.md`, `DESIGN.md` or WCAG 2.2 AA and none of
them a design question; the user asked for them to be written up as work on 2026-09-24. One item
is one commit, and `pre-commit` is every item's floor. **Run 7's other ten findings are not
here** — each changes a screen, so each is a question under "Needs the user" and is built only
after she answers it. Do these seven first, in order; F49 and F50 are the two that are more than
a line.

- [x] 2026-09-24 `e492ddf` F47 — a holiday's name is drawn at the same edge as its own date — R7.1 —
  `HolidayPickerScreen.tsx:530` carries `dir="auto"` on a `<span>` whose only child is
  `<Bidi>{row.name}</Bidi>`, which is the pattern `CLAUDE.md` forbids: the wrapper sees a
  neutral isolate, resolves left-to-right, and `text-align: start` then means *left*, so the
  name sits against the far edge while the Hebrew date beneath it sits against the near one, and
  slides 250px sideways when the row gains its controls. **Drop `dir="auto"` from that wrapper
  and leave it on the inner `<span>{words.own}</span>`**, which carries Hebrew text of its own
  and needs it. It is the last instance in the application — F6 fixed the eight R2.1 listed and
  this one was not among them — check: a browser assertion in `holiday-picker.spec.ts` that a
  row's name and its date share a right edge, measured rather than looked at, and that it holds
  for a chosen row and an unchosen one (the two that disagree today); it fails on HEAD.

- [x] 2026-09-24 F48 — three body paragraphs are drawn at 3.23:1 — R7.2 — `ReportsScreen.tsx:382` (16px),
  `WorkersList.tsx:235` (15/16px) and `WorkerProfileScreen.tsx:209` (13px) take
  `text-ink-faint` (#9a8874), which `globals.css` scopes in its own comment to "the line under
  the greeting". **Move the three to `text-ink-soft`** (#7b6a59, 4.90:1 on the page's ground and
  5.19 on a card) — the faintest token that passes, so the hierarchy the screens draw is kept
  and only the failure goes. The token itself does not change: the greeting's line is 14px and
  decorative and stays as it is — check: a contrast sweep of every screen reports nothing, and
  the `·` separators that also measure 3.23 stay out of it because they are `aria-hidden`
  decoration.

- [x] 2026-09-24 F49 — seven inputs on `/settings` have no accessible name, four of them the identifying
  numbers — R7.3 — `TermRow` (`WorkerTerms.tsx:124`) draws the row's name as an `<h3>` and the
  control under it is a bare `<input>`, so passport, employment permit, work visa and bank
  account are four fields a screen reader announces alike, and the rest-eve supplement, the
  employment start date and the insurer are three more. **`TermRow` mints an id for its `<h3>`
  and hands it down**, and each control inside takes `aria-labelledby` from it — not a `Field`
  label, which would draw the row's name a second time under the heading and change the screen.
  `Field.tsx` already does the association for the panels, so nothing new is invented — check: a
  browser assertion that every input on `/settings` has an accessible name, and that the four
  number fields' names differ from one another; it fails on HEAD. No screenshot changes.

- [x] 2026-09-24 F50 — six pointer targets are under 24×24 (WCAG 2.2 AA 2.5.8) — R7.4 — the blocker
  strip's actions and `הצג הכל` at 21px (`HomeSections.tsx`), `RuleLink` at 19–23px
  (`WhyDisclosure.tsx:114`), `להתנתק` and `להוריד סיכום שנתי` at 23px (`SettingsScreen.tsx`) and
  the holiday tick at 24×23 (`HolidayPickerScreen.tsx`). **Use the idiom `DESIGN.md` already
  records** — "padded out to a finger's height and given back with a negative margin" — which
  the forms have and these do not, so the rows are drawn exactly as they are now. **`RuleLink`
  is padded only where it stands on a line of its own**, not where it sits inside a sentence
  (`/month/export`'s `כל זכות`): WCAG's inline exception covers that one, and padding an inline
  link would overlap the hit areas of the lines above and below it — check: the hit-test sweep
  reports nothing under 24 on `/`, `/alerts`, `/settings` and the holiday picker, and
  screenshots of the blocker strip and an alert card before and after are identical.

- [x] 2026-09-24 F51 — a disabled filled button reads as a second, quieter *enabled* one — R7.5 —
  `buttonClass` (`Field.tsx:15`) disables with `disabled:opacity-50` alone, which turns forest
  into a sage indistinguishable from a deliberate quiet action: on `/settings` with the groups
  open, three saves are dark and three sage, and only the sage ones are dead.
  **`disabled:bg-chip disabled:text-ink-quiet disabled:cursor-not-allowed`, replacing the
  opacity** — the same three things `outlineButtonClass` four lines below already says, in
  tokens that exist. It is a visible change to a disabled state, so the screenshot goes to the
  user with the commit — check: Browser; a screenshot of `/settings` with the groups open,
  where the disabled saves must no longer read as a second button style.

- [x] 2026-09-24 F52 — `/` draws its `h1` after an `h2` — R7.6 — the outline opens at `צריך לטפל` and
  reaches `ספטמבר 2026`, the calendar's month, second; every other screen's first heading is its
  own `h1`. **The blocker strip's heading becomes the `h1`** rather than a heading being added:
  `DESIGN.md` records that the home screen deliberately opens straight onto the calendar with no
  heading of its own, so a new visible one would undo a departure, and `specs.md` item 27 says
  this screen leads with what blocks a correct salary — which is what `צריך לטפל` names. The
  month then becomes the `h2` it reads as. **Where the strip is not drawn** — a household with
  nothing blocked, and a refused month — the `h1` has to fall to whatever leads the screen
  instead, so check both — check: a browser assertion on `/` that the first heading is the
  `h1`, on a household with blockers, one with none, and a refused one.

- [x] 2026-09-24 F53 — one action, two words, on one screen — R7.7 — `he.ts:1117` says `שמירה` in
  `hospitalOvertime` where the six sibling groups of `/payments` all say `לשמור`. One word
  changes — check: `payments-screen.spec.ts`, whose hospital-overtime step addresses the button
  by its text and so moves with it.

**J. Run 7 — the ten that change a screen.** Approved on 2026-09-24, each as the review
recommended, and **all of them before F32**. Each entry carries the decision itself, so no
session has to go back to the recommendation to know what was chosen. The departures they create
go into `DESIGN.md` in the same commit (working rule 3), since the canvas draws none of them.
**One owed a `specs.md` sentence** — F58 — **and it is written**: the user approved its exact
wording on 2026-09-24 and it is in item 27, after "the first four blockages". It is not asked
again. F59 was listed as owing one too and does not; its entry says why.

- [x] 2026-09-24 F54 — **cap the calendar day cell's height** so the cell keeps roughly the proportion the
  artboard draws and the slack goes to the page instead of into the grid — R7.8 — measured
  91×83 at 1440×900, 91×105 at 1440×1080 and 77×177 at 1280×1440, the grid stretching inside
  `md:h-screen`, so above about one window height the day is a tall rectangle with its number
  floating in an empty cell — check: the cell measured at four heights from 800 to 1440 stays
  within a step of its 1440×900 size, and screenshots at 1440×900 are unchanged.

- [x] 2026-09-24 F55 — **keep the desktop height lock and restore the scroll position by hand** — R7.9 —
  `<main>` is the scroller from `md` up (`AppShell.tsx:383`, `md:h-screen md:overflow-hidden`),
  so the document never scrolls and a Back lands at the top: press a blocker card from the foot
  of `/` and come back. The lock buys a bar that never leaves, which is the switcher and the
  bell, and that is worth more than the position. **What it does not pay back is printing** —
  `Ctrl+P` still gives one screenful of the payslip — so if the family is ever meant to print a
  payslip this returns as a question rather than being quietly solved here — check: scroll `/`
  to its foot, follow a blocker, come Back, and the screen is where it was; at HEAD it is at the
  top.

- [x] 2026-09-24 F56 — **a folded section says what is inside it**: `FoldSection` draws its `aside` folded
  as well as open — R7.10 — `/payments` opens as six headings and no figure, and the five
  advances under `מקדמות` are invisible until it is opened. The `aside` is the one place a count
  or a sum can sit and it is already there for the open state. **What each section's folded line
  says is part of this item**, not a later one: `מקדמות` says how many are outstanding, `מס
  הכנסה` the amount, and a section with nothing recorded says its existing `none` wording —
  check: `/payments` on arrival names the five advances without a click, and a household with
  none says so; Browser.

- [x] 2026-09-24 F57 — **`/settings`' folds take `/payments`' arrangement**, the heading inside the white
  card it opens — R7.11 — today the four group headings sit on the page ground above four
  separate cards, so a heading is not visibly attached to what it opens and its chevron sits at
  the far end of an 800px row. One fold, one reading — check: Browser; screenshots of
  `/settings` folded and open, and `/payments` unchanged.

- [x] 2026-09-24 F58 — **alerts of one kind that differ only by month become one card naming the months**,
  with the action on the card — R7.12 — the strip shows 4 of 28 and `/alerts` draws all 28 at
  full height (7,135px at 390 wide), a dozen of them the same sentence about a different month
  with the same button, so one recurring alert reads as a screen of separate problems. Its
  `specs.md` sentence was approved on 2026-09-24 and is in item 27 — check: a household with a
  dozen unconfirmed months draws one card naming them, the count in the bell and the strip
  agrees with what is drawn, and a household with one such month is unchanged.

- [x] 2026-09-24 F59 — **`חודשים קודמים` on `/דוחות` gets a heading between the years**, and the row of a
  month that has not ended stops offering `לאשר ולייצא` beside `החודש עדיין לא הסתיים` — R7.13 —
  the list is 17 rows now and one longer every month. **It owes no `specs.md` sentence after
  all, and the line that said it did was wrong** — item 21 already says "The current month can
  be exported before its last day, with a warning that it has not ended", so
  `החודש עדיין לא הסתיים` is the condition on `לאשר ולייצא` and not a second statement competing
  with it. Both stay on the row and are drawn as one thing, which leaves F59 as layout alone.
  Corrected 2026-09-24: the review had read the spec as silent and it is not — check: the list draws
  a year heading at each boundary, and September's row says one thing rather than two.

- [x] 2026-09-25 F60 — **the busy state moves onto the control that was pressed**, `aria-busy` staying on
  the screen — R7.14 — `opacity-60` on the whole page, and `pointer-events-none` too on
  `/payments` (`PaymentsScreen.tsx:215`, `SettingsScreen.tsx:138`, `HomeScreen.tsx:361`,
  `MonthConfirmation.tsx:122`, `HolidayPickerScreen.tsx:150`), so saving one note greys the
  calendar and every other row and on a slow answer reads as the page failing — check: Browser
  with the action delayed, where the pressed button says it is working and nothing else on the
  screen changes.

- [x] 2026-09-25 F61 — **a refused month withholds the balances rail** as it already withholds the money
  column — R7.15 — `HomeSections.tsx:160,200` draw `[מספר] ימים` four times instead, and a
  bracketed placeholder on screen is the thing `[השם שלך]` was cut for. A balance cannot be
  derived from a month the engine declined to value (item 13), so an empty figure beside a real
  one is worse than no figure — check: `refusal-card.spec.ts` gains the assertion that no
  balance is drawn while the card stands, and that the rail returns with the figures when the
  day is cleared; `DESIGN.md`'s refused-month table gains the row.

- [x] 2026-09-25 F62 — **`מדינת מקור` opens on nothing and the wizard step is refused until she chooses** —
  R7.16 — `AddWorkerSteps.tsx:315` opens on `אוזבקיסטן`, the first of six, and that field is
  what decides the worker's holiday list, so a default nobody chose is saved as an answer. The
  artboard marks the field optional; it is not — check: the step refuses with a sentence when
  nothing is chosen, and `add-worker.spec.ts` chooses a country explicitly.

- [x] 2026-09-25 F63 — **the rate row carries a sentence and never the stored string** — R7.17, the
  judgment call step 4 was left on 2026-09-23 — `SettingsScreen.tsx:574` branches on
  `source.startsWith("http")`: a URL becomes the link `המקור`, anything else is printed as
  stored, which for the seeded minimum wage is `שכר_חודשי_להאנה2026.xlsx → חודש  4.26 → D6`.
  That branch hands her a path into a file the application does not hold, and printed it is not
  even exact — the mixed Hebrew and Latin filename reorders in the right-to-left span and
  renders as `xlsx.2026שכר_חודשי_להאנה`, the extension in front of the name, with no
  `translate="no"` on it. What the row says is the *fact*: read from the family's own sheet,
  typed by hand, or read from the law. The citation itself stays in the test and the commit
  message, which is `CLAUDE.md` rule 6's own division. **It touches the seed as well as the
  screen** — check: the rate row on `/settings` names a source in words for the seeded wage and
  still links the address for a fetched one, and no workbook path appears on any screen.

**K. Her own notes.** Raised by the user rather than by a review, and each answered by her when it
was raised, so none is a design question a session re-opens. The departure goes into `DESIGN.md` in
the same commit (working rule 3).

- [x] 2026-09-26 `62a7070` F64 — committed with run 8's batch, as she asked, rather than alone.
  **The group that holds only insurance is named for it, and the minimum wage goes to the
  salary it is the floor of** — her two notes of 2026-09-26, answered the same day.
  `he.settings.rates` becomes `title: "ביטוחים"` and
  `note: "ביטוח לאומי לפי אחוז שבחוק, וביטוח רפואי דרך מי שבחרתם"` — her own wording, chosen against
  two alternatives, so it is not paraphrased in the code. The minimum-wage `ValueRow` leaves the
  `rates` group for `employment`, **directly under `SalaryControl`**, whose hint already says the
  salary may not fall below it; it moves whole, its date, its `מחושב לפי החוק` badge and F63's
  source sentence all being its own props.
  **The third half, and the one a session would miss:** the failed-fetch sentence before an export
  links to `/settings#rates` (`MonthConfirmation.tsx:181`) **because that is where the wage's source
  is drawn**, so the link becomes `#employment` and travels with the row — otherwise the one
  sentence in the application that sends her to find a figure's provenance lands on the group that
  no longer holds it. `before-export.spec.ts:653` drives exactly that link and moves with it.
  **The group's `id` stays `rates`** — it is the fold's anchor and `[data-group="rates"]` in the
  suite, and a rename is a second change with no user-facing half — check: `/settings` draws
  `שכר מינימום` as the second row of `תנאי ההעסקה` with its date and `נקרא מהגיליון של המשפחה`
  intact, `ביטוחים` draws its two rows under the new note, and the failed-fetch link lands on the
  group that draws the wage; Browser.

**Not on the list**
- R3.3 — needs a migration of its own. The local ones are live as of 2026-09-24, so what it
  waits on now is being wanted, not being unblocked.
- R3.5 — fell out of F28 (2026-09-22).
- R5.1 and R2.22's `?? SEEDED_RATES` — done inside F26, which is where making the rates
  required and fixing "the household's rates never reach a month" turned out to be one move.
