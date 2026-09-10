# build_plan.md — EaseSalary

The order in which the application is built, and what each stage is made of.

> **This file = *what to build next*.** It decides nothing about behavior — `specs.md`
> does that. If a stage and the spec disagree, the spec wins and this file is corrected.

The ordering principle has two clauses, and the second was added after the first had
already shaped the stages: **reach a correct number as early as possible, and then make it
touchable as early as possible.** The August 2025 case can be checked by hand at the end of
stage 2, before a database, a screen, or a login exists — if the engine is right the rest is
assembly, and if it is wrong everything built on top inherits the error. But an engine that
is right and cannot be clicked is still unverifiable by the only person whose verification
counts (working rule 7), so the stages are ordered to reach a **usable vertical slice**
before they reach completeness in any one layer.

## The vertical slice — the order the stages are actually built in

The slice is not a new architecture and nothing is built twice for it. Step 8's repository
interface exists precisely to permit it: with a month's facts moving through an interface
that names no Supabase, stage 4's screen runs on an in-memory store and stage 3 lands
*beside* it rather than in front of it.

| # | Piece | Stage | Blocked by | Preferred after |
|---|---|---|---|---|
| 1 | The month's term snapshot | 1 · step 7a | — | — |
| 2 | The rest-day rename and its three persisted values | 1 · step 7b | 1 | — |
| 3 | The rest-day generalisation — Friday and Sunday workers | 1 · step 7c | 2 | — |
| 4 | The open sick spell | 1 · step 7d | 3 | — |
| 5 | The repository interface and its in-memory implementation | 1 · step 8 | 1, 3, 4 | — |
| 6 | The canvas reconciled with the shell and with `specs.md` | design pass — jobs 1, 2 and 3, **all run 2026-09-05** | — | — |
| 7 | The month screen: calendar, marks, live preview | 4 | 5, 6 | — |
| 8 | The export, reachable by a user | 2 | 3 | 7 |
| 9 | Everything else | 3, 5, 6, 7 | 8 | — |

**"Blocked by" and "preferred after" are different things and the table keeps them apart
on purpose.** A blocking edge is a fact — the work cannot start. A preference is this
plan's chosen order and an agent may break it. Row 7 is the case: the export consumes the
engine's output, which has existed since stage 1, so it is genuinely blocked only on step
7c, which gives it the nine rest-day placeholders. It is *preferred* after the month screen
because "touchable as early as possible" wants the screen first and because the agreement
test needs a preview to compare against. Writing that preference as a blocking edge would
say the template fill cannot begin until the whole screen is done, which is false, and a
table whose edges are partly preferences cannot be used to decide what may be picked up.

**Row 7 grew two pieces on 2026-09-08 and the table is not reordered by them.** Stage 4's
steps 9 and 10 — the worker's profile and the browser verification of the two screens already
built — are part of row 7, not part of row 9, so nothing in this table puts them after the
export. The profile is blocked on step 8's repository interface (row 5) and on nothing else;
reading row 9's "everything else … blocked by 8" as covering it is what kept it unowned.

**What the slice does not need:** a login, Postgres, row-level security, or a live
minimum-wage fetch. Stage 3 later swaps the repository implementation underneath a screen
that already works, and stage 5 replaces manual wage entry with the fetch on a confirmation
screen that already exists.

**How it gets past item 4's export gate without stage 5.** It does not evade the gate; it
takes the branch the spec already requires. Part 3: *a failed fetch degrades to the last
confirmed figure plus manual entry, and never blocks an export.* The slice has no fetch
yet, so it always takes that branch. This is a specified path built early rather than a
stub, which is why stage 5 can add scraping to it without rewriting it.

**What the slice is seeded with, and why it is not August 2025.** The dev store opens on
months of **2026** — the year whose workbook is the canonical layout reference — and the
user can move between them, which is also what exercises the balance chain that criterion
13 and the term snapshot both rest on. August 2025 stays where it belongs: it is the
**agent's** fixture, the only month whose four totals come from the family's own sheet and
therefore the only one that can prove the engine (`CLAUDE.md`, on where a test's expected
figure comes from). A seed month is for clicking; it proves nothing and must never be
mistaken for a case.

**The slice is production code, not a prototype.** Every part of it survives into the
finished application; only the repository implementation is replaced, and that is the one
thing already designed to be replaceable. A throwaway would answer a design question that
is not open — the screens are on the canvas.

## The design

Thirteen artboards sharing one design system, on the Claude Design canvas — project
`b11cf323-ac11-490d-994d-3145e8e07a6b`:
https://claude.ai/design/p/b11cf323-ac11-490d-994d-3145e8e07a6b

Three of the thirteen are home-screen variants. `דף הבית v3 לוח במרכז` is canonical;
`v2` and `v2 layout A` are superseded and kept on purpose, so the layouts that were
weighed against each other can be looked at rather than described.

The canvas is the source for how a screen looks; this table says only which stage
consumes which artboard. Nothing of the design is copied here — the tokens live in
`src/app/globals.css` and the conventions in `CLAUDE.md`, and a colour or an RTL rule
that appears in this file is in the wrong one.

| Artboard | Consumed by |
|---|---|
| `דף הבית v3 לוח במרכז` | Stage 6 — built in stage 0 against fixtures |
| `חישוב החודש`, `החודשים` | Stage 4 |
| `דף המשכורת` | Stages 2 + 4 |
| `העובדות`, `דף העובד`, `הוספת עובד` | Stage 3 |
| `תשלומים` | Stage 4 — pulled forward; see step 6 |
| `הגדרות` | Stages 3 + 5 |
| `דוחות` | Stage 2 — the yearly balances file |
| `התראות` | Stage 6 — see the reconciliation below |

Every stage that builds a screen carries two further **done when** clauses, because the
application is expected to be read through Chrome's translation and both failures are
silent: the screen holds no meaningful text inside an image, and translating it to
English throws no `NotFoundError` on `removeChild` and leaves the layout intact when
translated back.

## The routes — every address the application answers, and who builds it

Added on 2026-09-04, because five of the shell's own nav tabs were 404s that no line of
this file named. The design table above says which stage consumes which *artboard*; this
one says which stage owes which *address*, and they are not the same list — an artboard
with no route is a screen nobody can reach, and a route in the nav with no stage is a tab
that 404s until someone notices.

**The nav is the contract.** `src/components/AppShell.tsx` links five tabs plus the "?" and
the bell on every screen, so every one of them is a promise the application makes on every
page. A tab that 404s is worse than a tab that is not there.

| Route | Artboard | Stage | State on 2026-09-04 |
|---|---|---|---|
| `/` | `דף הבית v3 לוח במרכז` | 6 — built in stage 0 against fixtures | **built**, on fixtures |
| `/month` | `חישוב החודש` | 4 | **built** — the stage in progress |
| `/month/export` | `לפני הייצוא` | 5 (the questions) + 2 (the file) | **built on 2026-09-09** by stage 5's step 7 |
| `/payments` | `תשלומים` | 4 (pulled forward, step 6) + 5 | **built** for what it records (step 7); the artboard's two reminder sections are stage 5's |
| `/workers` | `העובדות` | 3 in this table, **built by stage 4's step 9** | **built** on 2026-09-09, with `/workers/[id]` beside it |
| `/settings` | `הגדרות` | 3 + 5 | 404 |
| `/reports` | `דוחות` | 2 — four report files, item 23 among them | **built** |
| `/month/payslip` | `דף המשכורת` | 2 — the month seen a third way | **built** |
| `/alerts` | `התראות` | 6 | 404 |
| `/help` | none — stage 7 draws it | 7 | 404 |

**Two artboards were added on 2026-09-05 and both were given routes on 2026-09-09**, by
stage 5's steps 5 and 7. The rows are kept because where each landed, and why, is the
part a later session would otherwise have to reconstruct:

| Artboard | What it is | Whose route |
|---|---|---|
| `בחירת חגים` | The year's holidays chosen in advance (item 10). Reached from `הגדרות` and from the home screen's own alert, so it draws `הגדרות` as the active tab | **stage 5's**, which is the stage that needs it |
| `לפני הייצוא` | The confirmation questions and the minimum-wage confirmation (items 18 and 4). No tab is active: it is a step in an action, not a section | **built on 2026-09-09** at `/month/export`, by stage 5's step 7. The address is the home screen's own link from stage 0, so the questions landed where the application already pointed; stage 2 puts the file behind the button they end with |

**Three artboards had no route at all, and each was a different kind of gap. The
first is now built:**

- **`דף המשכורת`** — the payslip as the family reads it, mapped to stages 2 and 4.
  **Built on 2026-09-10 at `/month/payslip`** by stage 2's step 4, which is the stage
  whose export it mirrors. The home screen had linked it at `/sheet` since stage 0 —
  an address nobody had chosen and which 404'd, a fifth 404 no table counted — and
  that link now points here, as does `/reports`, month by month.
- **`החודשים`** — the list of the worker's months. Stage 4's per the design table, and the
  one thing in this stage nothing has yet asked for: `/month` moves between months with its
  own stepper, so the list answers "which months exist and which are done" rather than
  "take me to a month". It is built when the month's four states are (Part 5), which is
  what gives the list something to say.
- **`דף העובד` and `הוספת עובד`** — the worker's profile. **This is the unowned debt, and it
  is now recorded in four places**: step 7c could not check the rest day because there is no
  profile to change it on; step 4 could not offer item 20's standing line for the same
  reason; step 5 seeded an opening advance rather than letting anyone enter one; and here.
  The design table maps both artboards to stage 3, but **stage 3's own bullets are the
  schema, the opening position and row-level security and name no screen** — so writing
  "stage 3 builds it" would assign the work to a step that does not exist. It stays recorded
  **It was given one on 2026-09-08: stage 4's step 9**, because the profile is a screen on
  the repository interface and this slice builds screens before stage 3 persists what they
  write. Assigning it to stage 3 is precisely what left it unowned for four stages, and the
  four things waiting on it are why it is built now rather than late.

**Where the five 404s stand after 2026-09-08.** The table above is a dated snapshot and is
left as it was read; what changed since is that each remaining 404 now answers to a *step*
rather than to this table alone, which is the difference between a debt and a plan. `/workers`
and the profile are **stage 4's step 9**; `/reports` is a bullet of **stage 2** and `/alerts`
a bullet of **stage 6**, both written into those stages rather than inferred from here;
`/help` was always stage 7's, whose bullets name it outright. `/settings` stays split between
stage 3's yearly settings and stage 5's holiday picker, and is the one address still held by
two stages at once.

**Three of the five 404s remain after stage 5's holiday picker.** It answers at
`/settings/holidays`, which is the address the `בחירת חגים` artboard names, so `הגדרות`
lights in the nav — but `/settings` itself still 404s and is stage 3's to answer. Until it
does, the way into the picker is a row on the worker's profile, settled with the user on
2026-09-09 and recorded in stage 5's step 5.

**`/month/export/file` was added on 2026-09-10** by stage 2's step 1. It is not in
the table above and does not belong there: it answers with a file rather than a
page, no nav tab points at it and no artboard draws it, so it is the export's own
address and not a screen. The two buttons on `/month/export` are the only things
that link to it.

**Four of the five 404s remain, and `/workers` is not one of them.** Step 9 built it and
`/workers/[id]` on 2026-09-09, which is the first of the five the nav promised to be
answered; the dated table above is left as it was read, and this line is what says it has
moved. `/settings`, `/alerts` and `/help` still 404, each against the step or
stage named two paragraphs above.

**Nothing here reorders the stages.** The table is what each stage already owed, written
down as addresses so that a 404 is a known debt rather than a discovery. The one change it
records is step 6's: `/payments` came forward into stage 4 because the group the user was
looking at belongs on it.

### The design pass — split by kind, not run as one block

Every screen stage builds against an artboard. Three of those artboards do not yet exist,
and most of the rest disagree with the shell. The pass that fixes both happens **in its own
right** rather than inside the first stage that trips over it: designing and implementing in
the same step is exactly what rule 7's check cannot catch, since the agent would be
verifying a screen against a drawing it had just made up itself.

It was once planned to run once, after stage 1 and before stage 3. It no longer does,
because jobs 1 and 2 are transcription while job 3 is design, and the vertical slice needs
only the transcription:

- **Jobs 1 and 2 run for `חישוב החודש` and `דף המשכורת` before stage 4.** Those are the two
  artboards the slice builds against. **The green sidebar is already gone from both**, which
  this file asserted for months and nobody had opened the canvas to check: read on 2026-09-02,
  each carries the 62px top bar as `AppShell` builds it, and so does `החודשים` from the older
  of the two edit batches. What the two still lacked was the worker switcher, and each marked
  `דף הבית` as the active tab on a route that is not home — **both fixed on 2026-09-05**, along
  with the greeting, which moved into the bar with the switcher. The rest are transcribed when
  their own stage arrives.
- **The whole canvas was surveyed on 2026-09-05 and the green sidebar is not on it.** This was
  the last thing left from job 2: the unread artboards were *unknown* rather than known to be
  stale, and reading all thirteen settles it in the direction this file had not expected.
  **Only `דף הבית v2` and `דף הבית v2 layout A` draw the 232px `#2E4636` aside, and neither is
  a screen the application owes** — they are the comparison pair `דף הבית v3 לוח במרכז` came
  out of, kept for the record. Every artboard that answers a route carries the 62px white top
  bar as `AppShell` builds it, and the five active tabs are each correct: `דוחות`, `הגדרות`,
  `העובדות` and `דף העובד` (both `עובדים/ות`), and `תשלומים`. **So job 2's premise was wrong
  and the work it named is smaller than the work the survey found**, which is the next two
  bullets.
- **Six artboards draw the top bar without the worker switcher and without the greeting.**
  `דוחות`, `דף העובד`, `הגדרות`, `העובדות`, `התראות` and `תשלומים` each draw the profile link
  as a bare `[השם שלך]` beside the avatar — no `בוקר טוב,` and no `‹ [שם העובד/ת] ›`. **Jobs 1
  and 2 created this gap rather than finding it**: they moved the greeting into the bar and
  added the switcher, on the four artboards those jobs named and nowhere else, so a shell that
  was consistent before the pass is inconsistent after it. It is transcription and it is the
  only thing job 2 still owes.
- **`התראות` marks `דף הבית` as the active tab, which is the bug job 2 fixed twice already.**
  `/alerts` is its own route and it is reached from the **bell**, which is not one of the five
  tabs — so it is `החודשים`'s case and the answer is the same, no tab lit. Its etag sits
  between the two edit batches, which is why the sweep that caught `חישוב החודש` and
  `דף המשכורת` passed over it.
- **The built `/month` draws the month name twice, and the artboard now draws it once.**
  `MonthScreen.tsx` renders `monthLabel(month)` as the page `h1`, and `MonthCalendar.tsx`
  renders it again in its own header at the same 24px bold, directly beneath. Confirmed on
  the running dev server on 2026-09-05. It is almost certainly a leftover from step 6, when
  the stepper and the month label moved into the calendar's header and the page `h1` was
  left behind. **`חישוב החודש` names it once**, in the calendar card's header beside the hint
  and opposite the stepper — the control that changes the month has to sit next to it. The
  code fix is owed and is not this pass's: delete the page `h1`. **Done in step 8b on
  2026-09-08**, with the calendar's own label promoted to the `h1` behind a prop, since
  `דף הבית v3` draws the same label as a `span` beneath a hero card that is already the `h1`.
- **`הוספת עובד` draws neither shell, and that is an undocumented decision rather than drift.**
  It carries a focused wizard chrome — the wordmark, `לצאת בלי לשמור`, a four-step progress
  bar, and no nav at all — which is the right shape for an add-flow, since a wizard offering
  five ways out is a wizard the user leaves halfway. But `AppShell` wraps every route today,
  nothing in this plan says a route may opt out of it, and the artboard carries the oldest etag
  on the canvas by a wide margin: it predates both edit batches and escaped the green sidebar
  only by never having had a nav. **The decision is recorded here so that the stage which
  builds it inherits it rather than rediscovers it**, and it needs an answer from `AppShell`'s
  side before that stage runs.
- **Job 3 waits for the decisions it rests on.** The reconciliation table at the foot of
  this file now records all eleven as settled, so job 3 is no longer blocked on the user —
  but it is still design work and it is still not folded into a stage that consumes it.

Three jobs, in order of how much design they actually involve:

1. **Fold the home screen's four departures into `דף הבית v3`.** They are recorded in
   `CLAUDE.md` and in `docs/plan-calculation-engine.md` Step 0 (f) and (g), and they were
   settled by measuring the built screen — but while they live only in prose, every future
   screen session has to be told, and any session that is not told will faithfully undo
   them. Transcription, not design.
2. **Bring the artboards whose top bar is out of date onto the current one.** This job was
   written as "the ones that still draw the v2 green sidebar", and the survey above found no
   such artboard: what is actually out of date is the *right-hand end* of a bar that is
   otherwise correct — six artboards with no worker switcher and no greeting, and `התראות`
   lighting a tab it should not. Also transcription, and now a defined list rather than a
   suspicion.
3. **Draw the screens that have no artboard at all.** This is the real design work, and
   the `frontend-design` skill belongs here and nowhere else in this plan. **Run on
   2026-09-05 and almost entirely closed**; what it drew is recorded under "Job 3 as it
   ran" below.

Anything in job 3 that *ought to exist* was a `specs.md` decision before it became a
drawing. Those decisions have now been taken and the table below records them, so job 3
draws what the spec says and nothing it invents.

The canvas is edited in its own editor. An agent can read the artboards but does not write
them, so jobs 1 and 2 are handed over as a list of changes rather than made directly.
**That list is `docs/design-pass-jobs-1-2.md`**, written on 2026-09-03 against the three
artboards it names by etag. It is a work order and not a decision: what it asks for is
already settled in `specs.md` or in the built system, and each item says which. It also
ends with what stage 4 needs that jobs 1 and 2 cannot supply.

Writing it turned up one disagreement that was not recorded anywhere: **the canvas and the
code both let the user mark a day `חג`, and criterion 9 says the user never does.** Settled
on 2026-09-03 — the spec leads, and it needed no amendment, since the need behind the drift
(a family moving which date her holiday falls on) is criterion 10's editable date in the
yearly picker. The canvas half is in the hand-over; the code half is stage 4's, because
`MonthCalendar`'s picker and the yearly picker that replaces it have to be swapped in one
step or a holiday becomes impossible to record in between.

**Done when** every screen the stage about to run will build has an artboard that agrees
with the shell, and nothing that stage needs is still missing from the canvas. For the
slice that means exactly two artboards; for the later stages it means the rest.

**The wizard is gone.** `חישוב החודש` was drawn as a three-step wizard while `/month` is a
calendar and a preview with the recording groups on `/payments`, and this file called it the
largest disagreement left between the canvas and the built application. It was restructured
on 2026-09-05 into the shape the route actually has: the calendar on one side, and on the
other the four cards `MonthPreview` renders — the two day counts, the grouped lines under
their own headings, the closing block with its collapse rule, the third-party payments
outside the worker's total, the balances with the days each month drew, and `כדאי לדעת`.

**Stage 4 was built against the description and the canvas caught up afterwards.** From
2026-09-03 the hand-over was written and the canvas was not changed, so stage 4 built
against `docs/design-pass-jobs-1-2.md` — the description rather than the drawing, which is
the weaker of the two and was written down here so that nobody later read the built screens
as having been checked against a canvas they were not. It was never a licence: every item of
the hand-over was something already settled in `specs.md` or in the built system, which is
why the description could stand in for the drawing at all.

### Job 3 as it ran — 2026-09-05

Two artboards were **created**, five were **restructured or corrected**, and the canvas grew
from thirteen files to fifteen. What each closed:

| Drawn | Closes | Where |
|---|---|---|
| The yearly holiday picker | item 10 in full — the candidate list, another country's list, the nine-day quota with its proration *and the reasoning behind it*, the remainder shown fractional, an editable date, the refusal past the quota, and an incomplete selection visible at a glance. Plus **item 12's degradation**: the fetch failing, with manual entry beside it | **`בחירת חגים`**, new |
| Part-days | item 10's "a holiday can be taken as part of a day" — `יום מלא` / `חצי יום` on each chosen date | same |
| The pre-export questions | item 18, each question arriving **with what the month already knows** so the user confirms rather than recalls; and the open sick spell drawn as a **block** rather than a warning, because a month is not exported over an unanswered one | **`לפני הייצוא`**, new |
| The minimum-wage confirmation | item 4 — the figure, the date it took effect, where it was read from, a way to correct it, and the sentence that a month is valued at the rate in force during it | same |
| The manual-override control | item 17 — the derived rows and only those, `להחליף סכום`, the `ידני` badge, `היישום חישב …` beneath the figure it replaced, and `לבטל את ההחלפה` as its own button. The panel opens **empty**, and says why | `תשלומים` |
| The user-line edit panel | item 20 — one panel for adding and editing, with the direction and the placement set explicitly and the placement rule stated beneath them | same |
| The third-party edit panel | item 16 — the seven kinds as chips in the template's own words, the amount, and the months the payment covers | same |
| A future month, filled and not exportable | item 21 — the `כדאי לדעת` card | `חישוב החודש` |
| The two day counts, the third-party group, an override shown as manual, balances with days used | items 2, 5, 16, 17 | `דף המשכורת` (job 2b) |
| The worker's three documents and their expiry dates | item 28 — three, not one | `הגדרות` |
| The per-year salary summary | item 29, reshaped — one worker, one year | `דוחות`, `הגדרות` |
| The bell as its own state | item 27 — `התראות` is reached from the bell, so the bell is what lights, not a nav tab | `התראות` |

**The two things job 3 nearly missed, drawn on 2026-09-08.** A free-text note on a
*calendar mark* (item 5) and a **part-day for vacation** (item 7) are one surface, not two:
both belong to the picker that opens when a range is swept. The picker now carries a second
row — `כמה מהיום נלקח` with `יום מלא`/`חצי יום`, and a `הערה` field — under the kind chips,
with the rule stated beneath rather than hidden: vacation may be taken as half a day and is
deducted from the quota in the same proportion, while sickness and a free rest day are whole
days. The same row went into `חישוב החודש` and `דף הבית v3` in one step, because two
calendars that disagree about what a mark can carry is the failure this was going to be.
The picker draws in each artboard's resting state behind a `showPicker` prop, since a
control that only appears mid-drag is a control nobody reviewing the artboard ever sees.

### What job 3 found that was not on its list

Reading every artboard to draw the missing ones turned up **settled decisions that never
reached the canvas** — the same class as the `חג` picker, and more of it than anyone had
counted. All are now applied:

- **`הגדרות` carried three *drops* at once**: the notification toggles (item 27 — nothing
  leaves the application, so there is nothing to toggle), the editable `ימי חופשה בשנה` and
  `ימי מחלה בשנה` (item 7 — derived, and an editable quota raises "which past months does
  the edit reach into", which has no answer), and `להוריד את כל הנתונים` (item 29 gave it a
  narrower shape). The two entitlements now read as derived, with the reason on the row.
- **`דוחות` offered PDF in three places** against a spec that exports `.xlsx` only, and a
  severance report that Part 1 puts out of scope. Both gone; the report is `דמי הבראה`.
- **`דף העובד` drew the accrued-severance card and `לסיים העסקה`**, both settled *drop*. In
  the card's place is the advance still owed, which is the third figure that carries across
  the whole employment rather than sitting in one month.
- **`דף העובד`'s balance colours were its own** — blue for vacation, pink for sickness —
  where the calendar, the legend and the home strip use amber and dust-blue. A balance and
  the days that produced it now read as the same thing on every screen.
- **`התראות` lit `דף הבית`**, the bug job 2 fixed twice elsewhere.
- **Four artboards carried a full-width row under the bar** (`› חזרה ל…`, or the date) that
  job 2a item 4 had already settled has nowhere to live in the shell. All removed.

**On 2026-09-05 jobs 1 and 2 were applied to the canvas**, and `docs/design-pass-jobs-1-2.md`
is now a record of what changed rather than a work order. All four artboards it names are
written: `דף הבית v3` and `חישוב החודש` in the session that composed them, and
`דף המשכורת` and `החודשים` on the next one, the design server having dropped before they
could be uploaded. They waited in `docs/canvas-pending/` in the meantime; that directory was
deleted with the upload, because a `.dc.html` living in the repo is a second copy of a
drawing whose home is the canvas. **For all four, the artboard is the reference again.**

## Stage 0 — Repo, scaffold, design system · **done**

Outcomes only. `docs/plan-home-screen.md` is the description of how it was done.

- The repository initialised against the EaseSalary remote, with the three `.xlsx`
  templates and the six holiday lists committed under `data/`.
- Design tokens, the application shell and the shared components in `src/`.
- `src/lib/i18n/he.ts`, every Hebrew string in one file, and `src/lib/links.ts`, the
  single central list of kol-zchut references (item 26). It is referenced by nearly every
  screen, so it belongs beside the translations rather than scattered through them.
- `src/lib/dates.ts`, UTC-only month arithmetic, and `src/lib/spans.ts`, the entitlement
  rules for a swept range — both under test.
- The home screen rendering at `/` from fixtures typed by the engine's own output shape.

## Stage 1 — The calculation engine

Plain TypeScript, no framework, no I/O. Vitest.

- Types for a month's facts: the worker's terms, the confirmed wage, and the month's
  actions held as `{ kind, from, to, note }` **spans** rather than per-day marks. A sick
  spell is stored as the dates it ran between (Part 3), and the statutory tiers cannot be
  counted from a spell's own first day across a month boundary out of marks that know
  only their own day. A single day is a span of one.
- Calendar arithmetic: days in the month, its Fridays, its Saturdays, working days.
- Rate derivation from the base monthly salary, including the 25-hour rest-day rate.
- The month's components: base, Friday supplement, Saturdays, holidays, sick pay,
  vacation, one-off payments, third-party payments.
- Advances: numbered, several at once, granted and repaid.
- Balances: vacation and sick accrual, carry-forward, the ninety-day ceiling.
- An explanation per line, each under a stable key, so another screen can show one
  figure's reasoning without re-deriving it.
- A thin repository interface — a month's facts in and out, with no Supabase in the
  signature — so stage 4 can build against an in-memory store and stage 3 can land
  beside it rather than gating it.
- The August 2025 test, matching four totals to the agora.

### Steps 7a–7d — the weekly rest day, reopened, and the open spell

Stage 1 met its "done when" and is reopened on purpose, because the rest day turned out to
be a term of the employment rather than the constant the engine was built on (item 5).

This was first written as one step. It is three, because it is three different kinds of
change and only the first is checked by the compiler. **Expand–contract is deliberately
not used**: it earns its place when batches cannot land green together, and here one
`tsc --noEmit` pass finds every site in a single-package repo of roughly 6,700 lines. A
parallel rest-day form beside the Saturday form would mean two sources of truth for the
same fact coexisting across counting, refusals and span rules — more dangerous than the
rename, not less. One landing per step.

#### Step 7a — the month's term snapshot

The prefactor, and it comes first because `specs.md` Part 3 now says terms are read off the
month and **never off the profile**. `MonthFacts` gains the terms the month was confirmed
with, joining the `ConfirmedWage` that already lives there, and `calculateMonth` stops
taking a separate `WorkerTerms` argument off the profile. The profile still holds the
worker's *current* terms; the month holds the ones it was calculated with.

Doing it before the rename is what makes the rename easy: the rest day then arrives as one
more field on a concept that already exists, rather than as a new concept introduced in the
middle of a wide rename. Landing it after step 7c instead would reshape step 8's repository
interface twice, and landing it after stage 3 makes it a migration — which is the same
argument this plan already uses to justify reopening stage 1 at all.

**Check:** `august-2025.snap.md` byte-identical.

#### Step 7b — the rename, and three persisted values

Mechanical and compiler-checked: `saturdays`, `saturdaysWorked`, `isSaturday`,
`saturdaysOf` and their kin become rest-day equivalents across eight modules in
`src/lib/engine/` — `balances`, `counts`, `leave`, `month`, `rates`, `sick`, `thirdParty`,
`validate` — plus `dates.ts`, `spans.ts`, `types.ts`, `MonthCalendar.tsx`, `i18n/he.ts` and
`fixtures/home.ts`.

**Three of the names are stored values rather than identifiers, and they are the ones a
compiler cannot help with:** `MarkKind` at `src/lib/types.ts:24` is a string-literal union
whose `"freeSaturday"` member is persisted span data; `lineKeys.fridaySupplement` at
`src/lib/engine/month.ts:60` is a *stable* key by design, since a screen shows one figure's
reasoning by it; and the same key reaches the explanation text in `i18n/he.ts`. Renaming
each needs a migration story, not just an edit.

**Check:** `august-2025.snap.md` byte-identical.

#### Step 7c — the generalisation, and the check the snapshot cannot give

The semantic third: item 8's week re-anchors to the six days ending at the rest day, the
rest-eve supplement moves off Friday (item 14), and `validate`'s "must fall on a Saturday"
refusal becomes per-worker.

**The snapshot check does not cover this step, and saying so is the point of splitting.**
Hanna rests on Saturday, which is the default, so every non-Saturday path is unreachable
from `august-2025.snap.md` by construction: it proves the rename left the common case
alone and proves nothing whatever about the generalisation.

This paragraph used to name `counts.ts`'s sick week as the rewrite the snapshot could not
see, on the strength of its own comment calling the week "Sunday-anchored". **The comment
was wrong and the arithmetic was already right**: it computed the six days ending at the
*rest-eve*, which is item 8's window for all three rest days once the rest-eve is hers, so
generalising `isRestEve` was the whole of the change. The claim is corrected here rather
than deleted, because the reason it was believed still holds — a Saturday-only suite could
not have told the two apart either way, and a comment is not a test.

So this step carries **new cases for a Friday-resting and a Sunday-resting worker**, and
their expected figures are **derived on paper from items 5, 8 and 14** before the code is
written. No workbook covers them, which is exactly the condition under which `CLAUDE.md`
forbids reading an expected figure back out of the engine.

**Use the `mattpocock-skills:tdd` skill for this step, and for no other in this stage.**
Test-first is not a preference here but the only thing standing between the suite and an
engine that agrees with itself: 7a, 7b and 7d each have a byte-identical snapshot doing
that job, and 7c is the one step whose new behaviour no existing figure covers.

**Check:** `august-2025.snap.md` still byte-identical, *and* the two new workers' figures
match the paper derivation.

**Done when** the known case passes and the invalid case is refused, with no database and
no interface in existence.

**The user's own check is owed and cannot be paid here** (working rule 7). Nothing in the
application sets a worker's rest day — the home fixture is Saturday and there is no profile
to change it on — so the only check available for this step is the suite, which is the
agent verifying its own work and is the half already known. The debt is recorded rather
than waved through: the first screen that can set the rest day, in stage 5, is where the
Friday- and Sunday-resting cases become checkable by hand, and that stage should not close
without someone having done it.

#### Step 7d — the open sick spell

A spell with no end yet (item 8). `DaySpan`'s `to` becomes nullable, which is a change to a
**persisted shape** and so joins step 7b's three stored values as something the compiler
alone will not carry. The counting clips an open spell at the month's own last day; the
tiers are untouched, since an open spell is still one spell with one first day, which is
the whole reason the shape was chosen.

It is engine work and belongs here rather than in stage 4, though stage 4 is where the user
first meets it: the alternative is a screen that can draw a state the engine cannot count.
**Nothing in this step reads a clock** — a finished month clips at its own end, and the
current month's preview receives `today` as a prop from its caller (`CLAUDE.md`).

**Tests:** an open spell running past a month's end pays that month the same as the closed
spell of the same days; the clip is stable whatever `today` is; and a spell closed after the
fact moves the earlier month's figure, which is criterion 13 exercised at its smallest.

#### Step 8 — the repository interface, and the replay it makes possible

Two landings, because they are two different things and only the first is what the slice
was waiting for.

`src/lib/engine/repository.ts` is the store: a month's facts in and out, a worker's terms
and opening position, and **no database client anywhere in the signature** — which is what
lets stage 4's screen run on the in-memory implementation and stage 3 land its Postgres one
beside rather than in front of it.

**A month is stored without its spans, and that is the shape rather than an economy.**
Spans belong to the worker (`specs.md` Part 3): a spell crossing a boundary is stored once
and handed whole to every month it overlaps, so each month can place a day at its right
tier, and each draws from the balance only the days that fell in it. `MonthRecord` is
`MonthFacts` minus its spans, so the compiler refuses to write a span through the month and
nobody has to remember not to.

`src/lib/engine/series.ts` is the replay, and it is what makes `CLAUDE.md`'s "a series, not
a single month" true rather than merely claimed. Three things carry: the balances, without
limit and across the new year; the vacation days spent and the holiday days spent, which
reset at January because item 7's seven-day question and item 10's nine-day entitlement are
both asked of a calendar year. It walks the months the store holds and invents none, and a
refused month stops it with the month named on the error.

**Criterion 13 had never been tested across a month boundary** — the existing case compares
two calculations of the same August — so this step is where it is: correct January, and
March's closing balance moves by exactly the day, with nothing invalidated because there was
never a stored balance to invalidate.

**Tests:** facts written and read back identical; a month reproducible from its facts alone;
a crossing spell drawing three days from January and three from February; the year totals
carrying and resetting; the tenth holiday of a year refused in the month that reaches it.
Every expected figure is derived from items 7, 8 and 10 on paper — no workbook covers a
chain of months, which is exactly the condition `CLAUDE.md` names.

**Check:** `august-2025.snap.md` byte-identical, and `grep -ri supabase src/lib/engine`
returns nothing.

**The user's own check is owed again, and this is the fifth step running.** Nothing in the
application yet sets a rest day, opens a sick spell, adds a user line or moves between two
months, so the only check available here is the suite — the agent verifying its own work,
which is the half already known. The debt now covers steps 7a through 9 in full. Stage 4's
month screen is the first thing that pays any of it and stage 5 the rest; **neither should
close without someone having clicked the cases these steps were written for.**

#### Step 9 — a spell ends on the first *working* day

Unplanned, and found by the user asking how a spell is opened at all. The answer exposed a
worse gap than the missing gesture: **the natural way to record an illness is to mark the
days she was absent from work**, and the engine broke a spell on any unmarked day, so
marking Friday and Sunday and leaving the Saturday alone restarted the tiers and paid the
Sunday nothing. The month came out plausible and wrong, which is the class of failure
`specs.md` Part 5 exists for.

The rule now follows the source rather than the calendar: for a worker on a monthly salary
the period of illness is counted in calendar days, so a day she owed no attendance sits
inside it — the weekly rest day, said in so many words by Kol Zchut's *חישוב דמי מחלה
לעובד במשכורת חודשית* citing ד"מ 48713-10-17, and an unworked holiday, carried by the same
holding's reasoning and marked in `specs.md` as the extension it is. **Those days are drawn
from the sick balance too**, so the balance follows the spell and not the marks. A holiday
inside a spell is a sick day and is not drawn from the yearly entitlement; the family moves
the holiday, which is the one of the two that can be moved.

A vacation day between two reported days breaks the spell, and it is **settled** rather
than left as the narrower answer (`specs.md` item 8, 2026-09-04): the law converts a day of
illness taken during a vacation into a sick day and draws only the rest from the vacation
quota, so a day still recorded as vacation is a day she was not ill on. Nothing in the code
moved — the answer is the one already built — and the reasoning is now beside the rule.

**Check:** `august-2025.snap.md` byte-identical, which it is by construction: the known
month carries no sickness at all and both its holidays were worked.

## Stage 2 — The export

ExcelJS in a server route. One month template and one balances template.

- Load a template and fill it from the engine's output. **The filler owns the map** from
  the engine's stable line keys to the template's cells, and there is no sheet model in
  between: a third representation would be a third thing to keep in step, and the property
  that matters — the preview and the file saying the same thing — is already carried by
  their sharing one engine result, which the agreement test below asserts directly. A
  sheet model would earn its place only if a second output format existed, and the PDF the
  canvas drew is not being built.
- Generate the closing block from the month's advance lines. Part 3 builds it from
  however many advances the month has, "rather than from a fixed set of variants", so
  `template_month_advance_given.xlsx` is kept as a reference sample of the shape and not
  as a second template to branch on.
- **Insert rows for the lines the user added, and grow the sums over them.** The closing
  block is no longer the only region that varies: item 20's lines are rows the template
  does not hold in advance, in column E, column G or the block below. Part 3 requires the
  sheet's own totals to stay live formulas whose ranges expand to cover what was inserted
  — the family's workbook is a live spreadsheet today and a dead one would be a step back
  — so this is `insertRow`/`duplicateRow` against a row the template already designed,
  plus a rewrite of the `SUM` ranges beneath it.
  **The trap is that a range one row short prints a total wrong by exactly one line and
  looks entirely ordinary**, which no eye catches on a sheet of plausible numbers. The
  agreement test below is what catches it, extended one layer: assert the engine's figure
  equals what the spreadsheet's own formula evaluates to, on a month with added lines and
  a month without. Evaluating the formula means either reading it back through a
  calculating reader or asserting the range covers exactly the rows written — decide which
  when the shape of the template is in front of you, and say which was chosen and why.
- Placeholder tokens for identity and month fields.
- The two versions of the month export, differing only in whether the helper column of
  notes is shown (item 2). One file and one flag, not two files: a test asserts the two
  carry identical figures, since the whole reason for one file is that they cannot
  drift apart.
- The yearly balances export as its own file.
- **`/reports` is this stage's address and not only its file.** The nav links `דוחות` on
  every page and it 404s, which is worse than a tab that is not there. Item 23's file is
  generated here, so the screen that offers it — with the per-year salary summary and the
  `דמי הבראה` report job 3 reshaped onto that artboard — is built beside it. Naming it only
  in the routes table is what leaves a tab 404ing until someone notices.
- A test that drives the preview's lines and the filled cells from the **same** engine
  output and asserts they say the same thing. That agreement is the property that
  matters, and a test sitting beside only the engine or only the filler cannot check it:
  each passes happily while wording the month differently from the other.
- The export stays internal and test-only until stage 5 closes its gate — item 4 requires
  the minimum wage confirmed before *every* export, and that confirmation lands there.
- The templates are committed data. `.gitignore` must never ignore `*.xlsx`: the
  application still runs without them and only the export breaks, so the mistake surfaces
  on someone else's clone rather than here.

**Done when** an exported file for August 2025 can be opened beside the family's own
sheet and read as the same document.

### What the committed template's own rows say, and five things they turn up

Read out of `data/templates/template_month_standard.xlsx` on 2026-09-04, cell by cell,
because the user pointed at a screenshot of the fee rows and nothing in this repository had
ever checked the model against the template it is supposed to reproduce. The month tab
carries **seventeen numbered rows** in column B:

| # | The template's own label | Where it lives today |
|---|---|---|
| 1 | `משכורת בסיסית ללא הורדות (לינה ,מזון, שתיה,ביטוח רפואי )` | `lineKeys.base` |
| 2 | `תוספת שבועית בגין ימי שישי` | `lineKeys.restEveSupplement` |
| 3 | `תשלום ימי חג` | `lineKeys.holidaysWorked` |
| 4 | `עבודה בשבת` | `lineKeys.restDays` |
| 5 | `ביטוח רפואי ל…` | `medicalInsurance` |
| 6 | `תשלום פיצויי פיטורין ופנסיה.` | out of scope, row empty for layout only |
| 7 | `דמי השמה` | `placementFee` |
| 8 | `דמי תאגיד` | `agencyFee` |
| 9 | `אגרה להארכת ויזה ל…` | `visaFee` |
| 10 | `ויזת עובד זר` | **nothing** |
| 11 | `אגרה להארכת רשיון העסקה , אחת ל- 4 שנים.` | `licenceFee` |
| 12 | `ימי חופש עד 14 יום בשנה למשך 5 שנים ראשונות. - ניצול בחודש זה` | **nothing — see below** |
| 13 | `דמי הבראה.` | item 15, **no engine line** |
| 14 | `העדרות עקב מחלה` | `lineKeys.sickDeduction` |
| 15 | `מס הכנסה` | `lineKeys.incomeTax` |
| 16 | `ביטוח לאומי.` | `nationalInsurance` |
| 17 | `שעות עבודה נוספות במהלך אישפוז בביח` | Part 5 names it, **no engine line** |

**1. `ויזת עובד זר` has no kind, and item 16 would refuse the month that paid it.**
**Fixed in stage 4's step 7 — 2026-09-04.** The template holds **two** visa rows — row 9 at
B14, the fee for extending the visa, and row 10 at B15, the visa itself — and
`ThirdPartyKind` had one `visaFee`. That was not merely a missing member: item 16 refuses
two payments of one kind in a single month, so a month that paid both was refused outright,
with a message telling the family to sum two figures the sheet itself keeps apart. The
union now has seven members, `visaFee` is `visaExtensionFee`, and `workerVisa` is B15's.

**2. Five labels do not match the template.** Item 2 requires the exported file to carry
"the same Hebrew labels" as a month tab. `he.ts` says `דמי תיווך` where the template says
`דמי השמה`, `דמי טיפול` where it says `דמי תאגיד`, `אגרת ויזה` where it says
`אגרה להארכת ויזה`, and `חידוש רישיון` where it says `אגרה להארכת רשיון העסקה`. These are
not synonyms a reader would gloss: `דמי השמה` and `דמי תיווך` are two different fees in this
industry, and a family comparing the file against last month's sheet reads a renamed row as
a different payment. **The template is the authority and `he.ts` is what moves.**

**Moved in stage 4's step 7 — 2026-09-04, earlier than this paragraph expected.** The
argument for deferring was that item 2's "same labels" is checkable only against the
exported file; the argument that overtook it is that step 7 puts these names *on a screen*,
where a user reads them long before an export exists. Deferring the fix would have taught
her four names the sheet does not use and then changed them under her. The keys did not
move, so no stored override was touched.

**3. Two of column G's one-off payments are not built.** `דמי הבראה` is item 15 and was
already named by step 1b's review as the next line the engine grows; `שעות עבודה נוספות
במהלך אישפוז` is named in Part 5 and nowhere else. Neither has a `lineKeys` entry, so
neither can be overridden or explained (items 17, 24) until it does.

**4. Row 12 is a vacation row, and it is a reporting row — settled 2026-09-04 against the
family's own file.** Items 3, 7 and 19 each said the sheet carries no vacation line, and
item 19 leans on it, since the national-insurance base is correct only because vacation is
already inside the monthly salary. The template appeared to disagree. It does not, and the
evidence is that **the same file fills the row three different ways**: one month put a
single unit against a **full** base and left the money empty; one wrote ₪235.20 against a
base reduced by 0.96 of a day; one wrote ₪1,999.20 for 8.5 days against a base reduced by
8.5/25 of the salary. The last two reconcile to the agora, so all three reach the same
money — the second and third by *reducing the base and paying the day back*. This
application never reduces the base, so only the first style is consistent with it, and the
other two taken without their reduction are exactly item 7's double payment. **The export
therefore fills the row's units and leaves its price and amount cells empty**, and item 7
now says so with the figures. Item 19's wording was loosened from "no vacation line" to "no
vacation *payment* line", which is what it always meant.

**5. The two rates in the family's sheet are stale, which is the application's own
argument.** Row 12's per-unit figure is ₪235.20, and 235.20 × 25 = ₪5,880 — a minimum wage
that has since moved twice. **It is not refreshed and the cell is left empty instead**
(item 7): a price beside a count nothing multiplies is an invitation, and replacing a stale
invitation with a live one is worse, not better — the stale figure is how the second filling
style got into the sheet at all. Row 13's is ₪418, a recuperation day rate that has also moved.
Neither is wrong in the sheet; both are simply from the year they were typed. That is the
whole reason no rate is hardcoded (item 3) and the reason the workbook needs "legal upkeep
the employing family does not have" (Part 1). It is also a caution for the export: the
figures in the template are **sample data, not defaults**, and a filler that left one
standing would ship a stale rate to every family.

**None of this changes a figure the engine produces today.** Rows 10, 12, 13 and 17 are
rows nothing yet writes, and the four labels are strings only the export will read. It is
recorded here rather than fixed in place because fixing it belongs to the export, and
because item 2's "same labels" is checkable only against the file this stage produces.

### The steps stage 2 is built in — settled 2026-09-10

Four, ordered so each leaves something the user can open and read. The month file
first, because it is what the button on `/month/export` has been waiting for since
stage 5's step 7; the template's own rest-day wording second; `/reports` third,
because it is the stage's other address and a nav tab that 404s today; `דף המשכורת`
last, because it is the file's own layout seen on screen and reads best once the
file it mirrors exists.

**Three things were settled with the user on 2026-09-10, before any code**, each
because the template and `specs.md` left them genuinely open and a guess would have
looked like a decision:

1. **Income tax is written at `E20`** — the row the template already labels
   `מס הכנסה`, numbered 15. Part 5 says the tax "sits in the closing block and not
   in column E", which is a statement about `MonthResult.closing` and not about a
   cell: on the sheet the figure goes in the row the family's own workbook keeps for
   it, and the family's sheets show that row present and empty because they chose not
   to withhold, not because the row is unused. What keeps the tax out of the ברוטו is
   therefore **the range and not the column**: `א` is `SUM(E6:E19)` and stops one row
   short of it. A generated row below `ד` was the alternative and was refused, because
   it prints the label `מס הכנסה` twice on one sheet — once empty and once with the
   figure.
2. **The two versions of item 2 are two equal buttons**, `לייצא לאקסל` and
   `לייצא עם ההערות`, side by side. Both artboards draw one button and no chooser, so
   this is a control the canvas does not hold; it is recorded here rather than left to
   be re-derived, and it is the one place stage 2 adds a control the design pass did
   not draw.
3. **The block below `ד` keeps `ה` on the template's own row and letters nothing
   else.** The user's rule is that the file must match the 2026 workbook's structure —
   with a letter where it has one, without where it does not — and the committed files
   answer it directly: `template_month_advance_given.xlsx` is the standard layout with
   **one extra row that carries no letter, no label and no styling at all** (row 28
   there, pushing `ה` to 29). So row 28's `ה` sentence stays exactly as the template
   writes it and is the row a *repaid* advance is written on; every other row of the
   block is an unlettered copy of it carrying the engine's own label. A month with no
   repaid advance leaves row 28 labelled and empty, which is what rows 6 (pension) and
   20 (tax) already do.

#### Step 1 — the month file, and the two buttons that produce it · **done**

`exceljs` on the server, filling `data/templates/template_month_standard.xlsx`.

**The filler is a pure function over the template's bytes**, with the file read
injected — the same idiom the scrapers use for HTML (Part 4), so the suite fills real
templates and never touches the filesystem layout. It owns the map from the engine's
line keys to the template's cells and there is no sheet model between them.

**The cell map**, read out of the template on 2026-09-10. Rows 1–22 keep the
template's own labels untouched; the filler writes figures into them and never a
label, which is how item 2's "same Hebrew labels" is satisfied without `he.ts` and
the template having to agree about anything.

| Cell | What is written |
|---|---|
| `C1` | `{{month_year}}` |
| `A2`, `A3`, `A4`, `C2`, `C3`, `C4`, `F29`, `F30`, `B10`, `B14` | the identity placeholders, and `{{worker_role}}` where a label carries it |
| `D2` | the month's own day count |
| `E2` | `standardDays` |
| `F2` | the rest-eve supplement's units |
| `G2` | the rest days worked |
| `H2` | the holiday days used |
| `J2` | the sick days used |
| `G3` | the free rest day's date, as text |
| `C6`–`C22`, `D6`–`D22` | each line's units and its unit price, at full precision |
| `E`,`F`,`G`,`H` of 6–22 | each line's amount, in the column the engine gave it |
| `C17` | the vacation days used — **units only**, price and amount left empty (item 7, and the finding above) |
| `E20` | the income tax |
| `J17`, `J19` | the vacation and the sick accrual for the month |
| `E23` | `=SUM(E6:E19)` |
| `F24` | `=SUM(F6:F22)` |
| `G25` | `=SUM(G6:G22)` |
| `E26` | `=E23+F24+G25` |
| row 28 down | the block below `ד`, generated as decision 3 says |
| the net row | `=E26+E20+SUM(<the block's rows>)` |
| `C33`–`C38` | the six reporting figures, beside the labels the template puts in `B33`–`B38` |
| `I6`–`I22` and the inserted rows | the user's own notes on the month's actions |

**Four cells the template formats and step 1 leaves empty, each for a reason.** `D17`
and `G17`, because item 7's finding says the vacation row carries units and no money;
`E4` and `J4`, two unlabelled text cells whose meaning nothing in the workbook or the
spec states — a figure written into a cell nobody can name is worse than an empty one.
Row 11 (severance and pension) stays empty by the non-negotiable, and row 22 (hospital
overtime) and row 15 (`ויזת עובד זר`) stay empty until an engine line exists for them.

**`C33`–`C38` is a choice and not a reading**: the template puts the six reporting
labels in `B33`–`B38` with no formatted cell beside them, so the column is the
filler's to pick and `C` is the only neighbour. Written down because the next session
would otherwise have to re-derive it from an empty cell.

**The rows the user added grow the sheet, and the sums grow over them** (item 20). A
line placed before the total is an inserted copy of a row the template already
designed, in column `E` for a standing line and `G` for a one-off; a line placed after
it joins the block below `ד`. The `SUM` ranges are then written from the row positions
the filler tracked rather than from constants — **the trap is that a range one row
short prints a total wrong by exactly one line and looks entirely ordinary.** The
check chosen is that the range covers exactly the rows written, asserted against the
filler's own layout on a month with added lines and a month without, because it is the
one that fails loudly: reading the total back would need a calculating reader, and
`exceljs` writes a formula without evaluating it, so a `result` read back from a file
this application wrote would be a figure this application put there.

**The two versions are one file and one flag.** Column `I` is written in both and
`hidden` on the plain one, which is what cell `I1` instructs. A test asserts the two
carry identical figures.

**The agreement test drives the preview's lines and the filled cells from a single
engine result** and asserts they say the same thing — the property this stage exists
to protect, and one that a test sitting beside only the engine or only the filler
cannot see.

**The route is `/month/export/file`**, a `GET` route handler taking the worker, the
month and the notes flag, so the browser downloads it the way it downloads any file
and the two buttons are two links. The button confirms the month first, which is stage
5's own settled decision.

**What step 1 does not do, written down rather than left to be found.** The template's
Saturday and Friday wording stays literal, so a worker whose rest day is not Saturday
receives a sheet that counts her rest days correctly and *names* them Saturdays. That
is step 2's whole subject. `worker-2` of the demo seed is a Friday worker, so the
check below is run on `worker-1` and on the known seed, both of which rest on Saturday
as Hanna does.

**Landed on 2026-09-10.** `src/lib/export/` holds four modules — `layout.ts` the
row map and every range derived from it, `monthSheet.ts` the filler as a pure
function over the template's bytes, `notes.ts` the user's notes gathered by the
row each action reaches, `template.ts` the one place that touches the
filesystem — plus `monthExport.ts`, which assembles the filler's input out of the
replay. The address is `/month/export/file`, a `GET` route handler, and the two
buttons on `/month/export` are two links to it.

**Three things the step turned up that were not on its list.**

**1. `H2` is not the count of holidays she worked.** The template heads `G1`
`שבתות שעבדה` and `H1` `ניצול יום חג` — one counts attendance and the other counts
what the yearly entitlement was drawn against — and the first draft filled both
from the worked count. They are different figures: `holidayDaysOf` draws against
every holiday the month records, worked or not, less any that fell inside a spell
of sickness, and a part day draws its own proportion. `H2` is now that function,
which is the same one `calculateSeries` counts the year's entitlement with, so the
sheet and the replay cannot disagree about it. **Caught by reading the filled file,
not by a test** — both figures are plausible and neither is a type error.

**The first correction then carried a wrong reason**, which reading the file a
second time caught: it said a worked holiday draws nothing from the quota, and it
does draw. The cell was right and three sentences beside it were not, one of them
a test fixture supplying zero for Part 4's two holidays — a figure no assertion
could contradict, because the test handed it in. That is the shape of the mistake
worth remembering here: a corrected value with an uncorrected explanation, which
the next reader believes.

**2. The browser test's first version compared two different months.** `/month`
opens on the current month and the file is of the last one that ended, so the
figure read off the screen was September's and the figure read out of the file was
August's. It failed, which is the only reason it was noticed; a comparison made
where the screen happens to land is not a comparison at all, and the spec now
steps to the month it exported by reading the heading rather than by counting
clicks.

**3. August 2026 is the seeded month that exercises the whole sheet**, and the
first version of the browser test asserted it withheld nothing. `seed.ts` gives it
a ₪450 income tax and a ₪200 deduction the user wrote in her own words and placed
after the total, so it is the one month that fills `E20` *and* a row of the block
below `ד` at once — exactly the two regions decision 1 above separates. The
assumption was written into the test as a comment and was simply wrong; the seed
is the authority and the test now names both figures out of it.

**What the suite covers.** 33 unit tests across
`monthSheet.test.ts`, `notes.test.ts` and `agreement.test.ts`, and four browser
tests in `e2e/month-export.spec.ts`. The agreement test drives the preview and the
file from one `MonthInSeries` and compares them at the *rendered* figure through
`formatAgorot`, which is what catches an agora lost on the way into a cell; the
browser test compares the file against the figures the month screen actually
printed. Both were checked against two deliberate defects — the base salary
written one row off, and a `SUM` range one row short — and the two together fail
eight tests, which is what says they are tests rather than demonstrations.

**Two things found in the template while filling it.** `duplicateRow` copies a
row's value and style but **does not move a merge** with the rows it shifts, so
the `ד` label's `A26:D26` is unmerged before the sheet grows and merged again at
the row the label ended on; without that a month with an added line carries a
four-cell merge on the wrong row and reads as damaged. And the advance sample's
extra row is unstyled and unlabelled, which is what settled decision 3.

**The check to run before this is committed.**

Run `npm run dev` and open `http://localhost:3000/month/export`. It opens on
אוגוסט 2026 for the first worker. Answer all six questions — `כן` to
`אילו חגים נעבדו` and `לא` to the rest, which is what August 2026 records — and
confirm the wage. Two green buttons of equal weight then become pressable:
`לייצא לאקסל` and `לייצא עם ההערות`, with a sentence under them saying the two
files carry identical amounts and differ only in whether the notes column shows.

Press `לייצא לאקסל`. A file called `משכורת - [שם] - אוגוסט 2026.xlsx` downloads and
the screen says `החודש אושר, והקובץ ירד למחשב.` Open it beside a month tab of the
family's own workbook. What to read:

- It opens **right-to-left**, with the same seventeen numbered rows in the same
  order and the same Hebrew labels. Nothing anywhere says `{{`.
- `E6` is the base salary, `E7` the rest-eve supplement, `F9` the rest days.
- `E20` beside `מס הכנסה` is **−450.00**, and row 28 below `ד` reads
  `קניות שהעברתי לה במזומן` at **−200.00** — the two the seed gives August 2026.
- The four total lines are **formulas and not typed figures**: click `E23`, `F24`,
  `E26` and `E29` and the formula bar shows a `SUM` or a chain of cells. Editing
  any line's amount should move all four.
- `א` at `E23` reads `=SUM(E6:E19)+SUM(E21:E22)` — two ranges, stopping short of
  the tax row, so a withheld figure reduces the נטו and never the ברוטו.
- The reporting block at rows 33–38 carries both day counts and the two balances
  in column `C`.
- Column `I` is **hidden**. Unhide it and it is empty for this month, because the
  seed's August note is on the deduction row of the block.

Then press `לייצא עם ההערות`. The same figures, and column `I` visible.

**What a failure looks like.** A total that is a typed number rather than a
formula. A range that stops one row short, which prints a total wrong by exactly
one line and looks entirely ordinary — `E23` reaching only `E18`, say. The `ד`
label spanning four cells of the wrong row. A `{{token}}` anywhere. And the one
that is not visible in the file at all: the figures in it disagreeing with what
`/month` shows for אוגוסט 2026, so open that too and compare the ברוטו.

**Two things this check cannot show, and both are known.** The template's
Saturday and Friday wording is still literal, so switching to the second worker —
who rests on Friday — exports a sheet that counts her Fridays correctly and calls
them Saturdays; that is step 2. And nothing in the application can open a sick
spell yet, so the file has never been produced for a month with one.

#### Between steps 1 and 2 — the pre-export screen made a summary of the month · **done**

**Landed on 2026-09-10, at the user's request after reading the built screen.** Not a
step of stage 2 and not a widening of one: the screen it changes is stage 5's, and the
button stage 2 put on it is untouched.

**What she asked for.** The questions were answering with counts — "no free Saturdays
were marked", "2 sick days were marked" — and a count is a figure a family agrees with
while the days sit on the wrong dates. So each question now lists the month's own
items beneath it: the dates the calendar holds, and the amounts the payments screen
holds. Written into item 18, which now says so.

**Vacation became the seventh question.** It was the one mark on the calendar this
screen said nothing about, and it draws on a balance that is replayed rather than
stored (item 13) — so a vacation day marked on the wrong month moves every later
month's balance, silently. `exportQuestionKeys` is the source and the screen gates its
button on the whole of it, so adding the key is the whole of adding the question.

**The dates are the month's own days and the count is derived from the same clip.**
A spell running 30.3–2.4 is listed in April as `1–2 באפריל`, because a row reading
"2 days" above "30 March – 2 April" is a contradiction the user has to resolve
herself. The holidays list both the worked and the unworked, since the question is
*which* of them was worked and a list of only the worked ones cannot be read against
the calendar.

**Two wording defects the built screen showed, and neither a test could.** A single
advance printed its amount twice — once in the sentence and once in the list beneath
it — so a lone money item is not listed, while a payment to a third party always is
because its sentence carries neither the amount nor what it was for. And two advances
in one month read `נרשמה מקדמה של 1,000 ₪`, describing one advance of a sum that was
never given; the sentence now counts them and calls the figure a total.

**The free-Saturday disagreement the report opened with could not be reproduced.** The
calendar showed a mark the questions did not, and the marks were no longer in the dev
store by the time it was looked at — that store lives only as long as the `next dev`
process (`dev/store.ts`), and the running one had started at 13:05. Walking the path
by hand in the browser — the export screen, back to the month, the mark, the export
screen again through the home screen's link, and the same again with the browser's
back button — the mark arrives every time, with and without the extra
`revalidatePath("/month/export")` that was the first suspect. That call was tried and
reverted: `revalidatePath` clears the whole client router cache for any path, so
adding a dynamic route to the list changes nothing, and committing it with a story
attached would have left a false cause written down. The path is now covered by a
browser test that walks it, so the version of this that *is* the application's fault
would fail.

#### Step 2 — the rest-day wording, made a placeholder · **done**

Part 3 requires every label that names the rest day to become a placeholder filled
from the month's stored rest day, and names nine cells. Nine is what was built.

**The template holds thirteen, and the user chose the nine — 2026-09-10.** The
count was put to her before any code, because the plan had said eleven and the
template turned out to say more than that. Read out of
`data/templates/template_month_standard.xlsx` cell by cell: Part 3's nine, plus `F1`
(`ימי שישי שעבדה בחודש זה`) and `F3` (`תאריך שבת חופשית`) which this plan had already
spotted, plus two neither list held — `C5`, the column-C header
`כמות יחידות/ימים/ שבתות/חגים`, and `B23`, the `א` subtotal
`א. סה"כ  משכורת בסיסית + תוספת ימי שישי +דמי מחלה`. `A26` is a merged `A26:D26` and is
one label, not four.

**She chose the nine, so `specs.md` is unedited and the four stay literal.** That is
a deliberate departure and is written here so nobody corrects it back: a
Friday-resting worker's sheet says `ימי חמישי` in `A26` while `B23` directly above it
still says `ימי שישי`, and `G1` says `ימי שישי` above a `C5` header that still says
`שבתות`. Reopening it is an edit to Part 3 and hers to ask for.

**The mechanism this step described was wrong about this file, and the correction is
the point of recording it.** The labels are *not* shared strings: the committed
template has no `xl/sharedStrings.xml` part at all, and every label is an inline
string (`<c t="inlineStr"><is><t>`) in `xl/worksheets/sheet1.xml`. So that one part is
rewritten and put back through .NET's `ZipArchive` in update mode, which copies every
untouched entry's compressed bytes — `diff -rq` against the extracted `HEAD` version
shows `sheet1.xml` as the only part that differs. Cell count is 285 before and after,
`<f>` count is zero before and after, the single merge `A26:D26` survives, and the
fonts do. That is what keeps the formatting the family compares by eye out of the
change. The one-off rewriting script is not committed: the template diff is the
artifact, and a script whose assertions have already been consumed is a second thing
to keep in step with the template.

**Five tokens, not one**, because the labels use four grammatical forms and two
different days. `{{rest_day}}` bare, `{{rest_days}}` plural, `{{rest_days_definite}}`
definite plural, and `{{rest_eve_days}}` / `{{rest_eve_days_definite}}` for the
rest-eve, which is the working day before the rest day and is Friday only for the
Saturday-resting common case (item 14). The one-letter prefixes compose, which
`he.ts` already said and relies on here: `עבודה ב{{rest_day}}` is `עבודה בשבת` for
Hanna and `עבודה ביום שישי` for a Friday-resting worker, so no prefixed form is
stored. `he.sheet.restDayTokens` is the one place that builds them, and the filler is
handed the words rather than learning any — the same idiom `freeRestDays` already
used, and the reason the file's "writes figures and never a label" claim needed only
a qualification and not a retraction.

**The words come off the month's terms and never off the profile.** `monthSheetInputOf`
reads `facts.terms.restDay`, which is what stops a family who moves the rest day in
June from relabelling every earlier month's sheet — the whole reason the terms are
snapshotted (Part 3).

**What the tests prove, and what they would catch.**
`src/lib/export/rest-day-wording.test.ts` drives the whole path — the replay, then
`monthSheetInputOf`, then the filled bytes — for a Saturday-resting worker and a
Friday-resting one, and reads the nine cells back out of the produced file. The
Saturday expectations are the template's own wording as it stood *before* the edit,
so the half of Part 3 that says "Hanna's sheet is unchanged word for word" is a
regression test and not a restatement; the Friday expectations are that wording with
the Hebrew day names substituted by hand. Two mutations were run to check the tests
bite rather than merely pass: hardcoding Saturday in `monthSheetInputOf` fails two of
them, and filling `rest_eve_days` from the rest day instead of the rest-eve fails
three. The fourth test asserts `F2` and `G2` still hold 4 and 5 — August 2025's
Thursdays and Fridays, counted off a calendar — because a label alone proves half of
"says Friday throughout and counts her Fridays". The suite's existing "leaves no
placeholder token anywhere in the sheet" test already covers the five new tokens.

**The check the user runs.** Open `/month/export` for the **second** worker, the one
who rests on Friday, and press `לייצא לאקסל`. In the downloaded file: `E1` reads
`ימי עבודה בחודש זה (לא כולל ימי שישי )`, `G1` reads `ימי שישי שעבדה בחודש זה`, `B9`
reads `עבודה ביום שישי (...)`, and `B7` reads `תוספת שבועית בגין ימי חמישי (...)` —
Thursday, not Friday, because that is her rest-eve. Then export for Hanna and confirm
those same four cells read exactly as her sheet always has: `שבתות`, `בשבת`,
`ימי שישי`. A failure looks like a `{{rest_day}}` printed literally onto the sheet, or
Hanna's file reading `יום שבת` where her workbook has always said `שבת`. `C5`, `B23`,
`F1` and `F3` still say Saturday and Friday for both workers, which is the decision
above and not a defect.

#### Step 3 — `/reports`, and the four files it offers · **done**

The third of the four remaining 404s, closed. The nav has linked `דוחות` from every
page since stage 0.

**Four reports and not three, settled with the user on 2026-09-10.** The artboard
draws four cards and this step named three; the fourth,
`ביטוח לאומי לרבעונים`, has no numbered criterion and the question was put to her
before any code. She chose all four, so it is built on the strength of that decision
and of the card's own words — "מה שולם ומתי, לצורך הדיווח" — which is recorded in
`reports.ts` and in `he.ts` beside the strings themselves.

**One report is filled and three are built.** `חופשה ומחלה` is item 23 and has a
committed template, so it goes through a filler in the idiom `monthSheet.ts` set: the
bytes are injected and nothing reads a file. The other three have no template, and a
fourth `.xlsx` committed for them would be a layout nobody asked for kept in step
with nothing. What a built sheet loses that a filled one keeps is the reading
direction, so `buildReport` sets `rightToLeft` and all three go through it (Part 5).

**No report adds arithmetic of its own.** Every figure comes off one
`calculateSeries`, and the whole history is replayed before a year is filtered out of
it: a 2026 file built from 2026's months alone would open that January from zero,
because balances are derived and never stored (item 13). Column E of the balances
sheet — `סהכ ניצול השנה` — is the one figure the engine does not carry, since a
`BalanceLine` knows its own month, and it is accumulated across the block rather than
summed by a formula so a worker employed in June adds up from her first recorded
month.

**Two things the artboard drew that the code does not.**

1. **The closing line promised storage the application does not have.** It read
   "כל קובץ נשמר גם אצלנו", and item 23 produces the file on request; nothing is
   stored. Put to the user on 2026-09-10 and reworded to what is true: the data is
   kept and any file can be produced again, which is the reassurance the drawn
   sentence was reaching for and one the application can actually keep.
2. **A month that cannot be exported offers no link.** Not a design change so much
   as the screen agreeing with the route — see below.

**The defect the built screen turned up, and nothing else could have.** The hero's
green button, `המשכורת של ספטמבר 2026 לאקסל`, pointed at a month that had not ended.
`/month/export/file` answers **409** for it (item 21), so the largest control on the
screen produced an error page rather than a file. The types were right, the lint was
clean, and every unit test passed: the screen and the route simply disagreed about
which months have a file. Both now read the same `blocksExport`, the hero offers the
latest month that has *ended*, and a blocked row says why — in `beforeExport`'s own
two sentences rather than a third wording of one fact.

**What is deliberately not written.** `סיכום שנתי` carries no yearly total row. Item
29 asks for "that year's months with their totals", and a figure no criterion names
is one nobody has checked. Say so if it is wanted; it is a line of code.

**What the tests prove, and what they would catch.** `balancesSheet.test.ts` derives
three months on paper from items 7 and 8 — fourteen twelfths of vacation a month in
Hanna's second employment year, 1.5 sick days — and asserts the two blocks separately,
which is what catches a filler that wrote one block twice. `reports.test.ts` asserts
item 15's ladder outright: two completed years, six days, ₪2,709.00, the figure this
plan already records from the family's own confirmation screen. It also asserts the
national-insurance report is **empty** when nothing was paid, because a report built
off `nationalInsuranceEstimate` instead would print plausible figures nobody ever paid.
`e2e/reports.spec.ts` walks the nav, presses each card, opens the downloaded workbook
and compares its cells against the figures rendered on the page. The hero test was
checked by mutation: pointing `latest` back at the last month recorded fails it with
`unexpected value "המשכורת של ספטמבר 2026 לאקסל"`.

**The check the user runs.** Open `דוחות` from the nav. The hero must say
`המשכורת של אוגוסט 2026 לאקסל` and not September, and the September row must read
`החודש עדיין לא הסתיים` where the other rows say `אקסל`. Press each of the four cards
in `דוחות נוספים`. `דמי הבראה` must hold one row: יולי 2026, 2 years, 6 days,
₪2,709.00. `חופשה ומחלה` must have sickness in the upper block and vacation in the
lower, twelve rows apiece, with the vacation accrual displaying 1.17 — the cell holds
the exact fourteen twelfths and the template's own `0.00` format is what rounds the
display. `סיכום שנתי` must repeat the same ברוטו and נטו the rows on screen show. A
failure looks like a card that downloads an error page, a balances file with 1.5 in
both blocks, or a yearly file whose figures differ from the screen above it.

#### Step 4 — `דף המשכורת` · **done**

The payslip as the family reads it, at `/month/payslip`. The address is stage 2's to
choose and this was the choice: a sibling of `/month/export`, because it is the same
month seen a third way and no nav tab owns it.

**It closed a 404 nobody had counted.** The home screen's `לצפייה בדף המשכורת המלא`
had pointed at `/sheet` since stage 0 — an address no table lists and no stage chose —
and it 404'd. The routes table tracked four remaining 404s and this was a fifth.

**It groups by the sheet's columns, where the month screen groups by kind.** That is
what makes it a third view of the month rather than a second month screen, and item 5
already says why the two differ. Criterion 1 checks four totals; a screen able to show
only one ברוטו is one the file cannot be compared against. The subtotal names are the
sheet's own, from `he.sheet.subtotals`.

**`SummaryRow` was extracted rather than copied.** The month screen's `Row` — a label,
a figure and the "?" that explains it — is now `src/components/SummaryRow.tsx` and both
screens import it. Two implementations would have drifted in exactly the details that
matter: which figure carries the `ידני` badge, where an explanation opens, and what the
browser suite can take hold of through `data-row`.

**No new counting was written.** `הימים בחודש` reads `exportQuestions`, which is what
the pre-export screen already counts a month's holidays and vacation days with, so the
two screens cannot disagree about how many the month had. The unworked holidays are
every holiday less the worked ones, not a second sweep of the calendar.

**Two things the artboard draws are not built, both put to the user on 2026-09-10 and
both deliberate.** `אושר ב[תאריך]` needs a confirmation date the application does not
store — a confirmed month is one that has a `confirmedWage`, with no timestamp — so any
date shown would be invented; she chose to omit the line, and it can be built when
stage 3 holds real storage. `להוסיף הערה לחודש` needs a note on the month as a whole,
and a note belongs to a mark or to a line the user added; she chose to omit the link
rather than have it lead somewhere that means something else.

**Three defects the built screen showed, and none was reachable by a type or a test.**
The headline total rendered at the row size rather than the artboard's 42px, because
`MoneyValue` applied its own size over the wrapper's — it now has an `xl` for the one
figure the family looks for first. The outlined dot that tells an unworked holiday from
a worked one was invisible, because `border-1.5` is not a class Tailwind resolves and
`border-[1.5px]` is. And this screen's address carried a `worker` it then ignored, the
shell's switcher being the one place that choice lives — a link that lied about which
worker it opened. The last was caught by a browser test rather than by reading, which
is the one of the three a test could reach.

**What the tests prove, and what they would catch.** `e2e/payslip.spec.ts` reads the
four totals off the rendered page, presses the export button, opens the workbook and
compares them against `E23`, `F24`, `E26` and the transferred total — rule 11 asserted
end to end, at the figure the user reads. The transferred total is found by the sheet's
own label rather than by a row number, because the block below `ד` grows with the
month's advances and added lines: a hardcoded row reads a neighbouring figure on a
month with one more line, quietly and plausibly. Another test switches worker through
the shell's own control and asserts the free-rest-day count follows her to Fridays.

**The check the user runs.** From the home screen press `לצפייה בדף המשכורת המלא`. It
must open `אוגוסט 2026` and not September, with the total in large type at the top and
`ברוטו` beside it. Under `מה מרכיב את הסכום` the rows must be grouped as the sheet
groups them — `סך שכר החודש` closing one group and `סך שבתות וחגים` the next — and each
"?" must open its explanation. Press `לייצא לאקסל` and check the file's `E23`, `F24`
and `E26` against the three totals on screen. Then step to `ספטמבר 2026` from `דוחות`:
the export button must be absent. Switch to the second worker with the arrows in the
bar and confirm `הימים בחודש` names her Fridays rather than Saturdays. A failure looks
like a total on screen that differs from the file, a group whose subtotal is missing, or
an export button on a month that has not ended.

## Stage 3 — Accounts and storage

Supabase: Postgres, Auth, row-level security.

- Schema: account, worker, month, **day spans**, advances, third-party payments,
  overrides, confirmed wages, cached holiday lists. Spans rather than per-day rows, and a
  sick span may run past the end of the month it started in.
- **Item 13's cascade is no longer an open question here.** It was written as a choice
  between balances derived on read and balances stored with an invalidation; it is now
  decided the first way, in stage 1 rather than in this schema. The engine replays a
  worker's months from the opening position, so a corrected month moves every later
  month's balances by construction and there is nothing to invalidate. Replaying twenty
  years measured at 37ms, which is less than the round trip that fetches it. What this
  stage stores is therefore **facts only, never balances**; if a cache is ever wanted it
  goes in front of the replay, where deleting it is safe.
- **The month's term snapshot is a schema requirement, not an engine detail.** Part 3 has
  the month storing the terms it was confirmed with — rest day, rest-eve supplement,
  recuperation month — beside the confirmed wage it already stored. Step 7a builds the
  shape; this stage persists it. Discovered in stage 6 it is a migration.
- Roughly five tickets' worth, and the largest stage in the plan: nine entities, the
  household model of item 11 with its many-to-many membership and a two-worker limit that
  must not count a shared worker, row-level security whose "done when" is an adversarial
  property, and encryption across five fields.
- The month's state carries item 21: a future month may be filled in but not exported
  until it has ended.
- The worker's opening position: balances already accrued and an advance part repaid.
- Row-level security for account isolation; the two-worker limit on creation.
- Sharing by invitation, and a shared worker not counting against the other person's limit.
- Encryption of passport and bank account numbers, key in an environment variable.
- Anything stage 7 stores is account-scoped under the same row-level security, and its
  context is assembled from the engine's output rather than from the worker row, so an
  identity number cannot reach it.

**Run `/security-review` before this stage is committed**, and nowhere earlier — it is the
only stage that introduces an authorisation boundary, encryption at rest, and data reachable
by a request the user did not make. The stage's own "done when" is an adversarial property,
and the agent that wrote the policies is the worst placed to attack them.

**Done when** a second household cannot reach the first household's worker by any crafted
request, and the identity columns are unreadable in the database.

## Stage 4 — The month screen

Next.js App Router, Tailwind right-to-left, Hebrew strings in one translations file.

- The calendar: her rest days and rest-eves derived from her own rest day, not from
  Saturday, and days marked for what departed.
- **The holiday stops being a mark and becomes a state.** Criterion 9: the user never marks
  a day as a holiday — the year's dates are chosen in advance and arrive on the calendar
  already drawn, and the month records only whether she worked one, in two weights, an
  outline for a holiday she did not work and a fill for one she did. `MonthCalendar`'s
  picker currently offers `חג` and `MarkKind` cannot say whether a holiday was worked, so
  this is a change to the model and not only to the calendar. The picker that *chooses* the
  dates is stage 5's, so in this stage the year's chosen dates come from the repository as
  seeded data and the calendar only draws them and records the one fact about each. That
  keeps the swap in one step — the mark goes and the drawn state arrives together — without
  waiting on a screen two stages away, and stage 5 then puts a picker in front of the same
  stored dates rather than introducing them.
- **Range entry.** A week's vacation is one gesture, not seven clicks, and the stored
  shape is a span either way. The entitlement rules for a swept range are already written
  and tested in `src/lib/spans.ts`; this stage puts the calendar's gesture on top of them.
- **A sick spell needs no gesture of its own — settled 2026-09-03.** It was the last thing
  in this stage the user had reserved, and the answer is that a spell is simply a
  continuous range: the days she was absent are marked like any others, and the engine
  joins the ones that touch into one spell (step 9's rule, already built and tested). So
  nothing is built for opening one, nothing is built for saying "she is still ill", and a
  spell crossing a month boundary needs nothing either — the days on either side touch.
  The open shape stays in storage and in the engine; what was never added is a screen
  asking the user to declare it. `specs.md` item 8 now says so outright.
- **A sick spell is entered open, which is what closes the month-boundary gap.** The two
  shapes this stage once weighed — a sweep that carries past the month edge, or an end date
  the user sets past it — are both rejected, and neither is built. Each asks the user to
  express "she is still ill" as a range they do not have, and the first inverts under
  right-to-left, where a leftward drag moves *forward* in time. Instead the spell has no end
  until she returns (item 8): `to` is null, the calendar draws it as running, and the
  boundary is never crossed by a gesture because there is no gesture that crosses it. The
  span's counting is clipped at the month's last day, which keeps the clock out of every
  finished month; only the live preview of the current month clips at the `today` prop.
  Closing a spell late is a correction and rides on criterion 13, already built in stage 1.
- The three groups, which **step 6 moved off this screen**: additional payments and
  third-party payments are the payments screen's and the yearly settings are the settings
  screen's (item 5, corrected). The month screen is the calendar and the preview.
  **The first of them exists** (step 4), and with it the two things stage 4 had owed since
  its own earlier steps: the control for item 20's before/after-the-total choice, which
  until then only the seed could set (step 1b), and the income-tax line's control together
  with the rule beside it — the 2.25 credit points and item 26's link — which step 3 took
  off the preview when it stopped drawing a tax row that reads zero. **The advances joined
  it in step 5**, given and repaid, with what is still owed walked from the whole
  employment, and **the payments to third parties arrived in step 7** — the payments
  screen's second group, together with the seventh kind the sheet had always held and the
  union never had. **The last of item 5's four contents, the manual overrides, arrived in
  step 8**, which is also where `/payments` stopped being a route that runs no engine — an
  override addresses a derived figure, so the group holding it has to be shown one.
- A free-text note on every action — **a line the user adds carries one** (step 4) and so
  does an advance (step 5), which also carries the reason forward onto the debt so a later
  month reads why it was given; **an override carries one too** (step 8); the marks on the
  calendar do not yet. **Manual override of any computed amount, shown as manual, arrived in
  step 8**, together with the division it turned out to rest on: an amount the application
  worked out is *overridden* and an amount the month itself recorded is *edited*, so the
  same step gave the user's own lines and the third-party payments the edit panels steps 4
  and 7 had each deferred to it.
- A future month accepts facts and refuses export, saying which of the two it is.
- The live preview, driven by the same engine as the export.

**Done when** the August 2025 facts can be entered by marking days, and the month the
engine calculates from them is the one stage 1 produced.

**That is checked against the engine and not by reading four figures off the screen.** This
clause once said "the preview shows the same four totals", which stopped being possible in
step 3: two of criterion 1's four are the column subtotals, and the preview no longer prints
column totals at all (item 5) — it groups by kind, and the columns are the sheet's. The
preview shows the month's own figures, the export shows the sheet's, and the test that they
agree drives both from one engine result and belongs with the calculation suite
(`CLAUDE.md`). Criterion 1 is checked on the exported file, which is what it is about.

**It was built against `docs/design-pass-jobs-1-2.md` and the canvas caught up on
2026-09-05.** The hand-over was written on 2026-09-03 and applied two days later, so
`חישוב החודש` now carries the system's mark colours, the range-then-picker gesture, the
six-entry legend, the month stepper and the split `תוספות ומקדמות` rows. The artboard is the
reference again — with one thing it still gets wrong, recorded in the hand-over: it is drawn
as a three-step wizard, while this stage built a calendar with a preview and put the
recording groups on `/payments`. That is job 3's to settle, not this stage's.

### Step 1 — the month screen exists, on the store, and draws · **done**

The first thing in this application anybody can check without reading a test. `/month` was a
404 the home screen linked to; it is now a route that reads the household out of the
repository, replays each worker's months, and draws one of them.

- `src/lib/dev/seed.ts` — the seeded household: two workers, January to September 2026, and
  the days that departed from an ordinary month in each. It is **for clicking and proves
  nothing**: the one month whose figures are known to be right is August 2025, which comes
  from the family's own sheet and stays in the suite. Two figures in it are *given* rather
  than invented — the opening position is a fact item 6 says the family states once — and
  the salary is the last minimum wage this repository has a source for, ₪6,247.65 from
  1.4.2025, rather than a 2026 figure nobody has fetched.
- `src/lib/dev/store.ts` — `getRepository()`, the only line in the application that names an
  implementation, and the one stage 3 substitutes. A module singleton hung off `globalThis`,
  so an edit under `next dev` does not silently reset the store mid-check.
- `src/app/month/page.tsx` — a **server** component. Part 3 says all salary logic runs on the
  server and the browser only collects facts and displays results, so the engine runs here
  and the browser receives calculated months. `connection()` keeps it out of the prerender.
- `src/components/MonthScreen.tsx` — the client half: it picks the worker off the shell's
  scope and the month off its own state, and draws. It holds no arithmetic.
- `src/lib/today.ts` — the one place in the application that reads a clock, on the server,
  in `Asia/Jerusalem`. "Today" is a local fact: a container running in UTC reads the 1st for
  three hours after Israel has reached the 2nd, which would move an open spell's last
  counted day.
- `overlapsMonth` moved from the repository to `src/lib/spans.ts`, and the home screen's
  span-overflow block became `src/components/SpanOverflow.tsx`. Both are span geometry with
  three callers, and a client component reaching into the repository for the first would
  pull a store into the browser to answer a question about dates.

**Three decisions taken here, none of them reopenable without a reason:**

1. **The whole household is calculated, not the worker on screen.** The switcher is in the
   shell and its choice is client state, so a page that calculated only "the current worker"
   would have to learn who that is before it could render. An account holds two workers
   (item 11) and a replay is tens of milliseconds.
2. **The month is client state and not a URL parameter.** Moving between months then costs
   no round trip, and the switcher stays exactly as built. The cost is that a month cannot
   be linked to, which nothing yet needs; when something does, `searchParams` on the server
   component is where it goes.
3. **The full-width row under the bar is dropped, not rehoused** — the hand-over's job 2a
   item 4 left the choice open. `› חזרה לדף הבית` is what the nav's own `דף הבית` tab already
   is, and `נשמר אוטומטית` describes a save that has not been built and will be immediate
   when it is.

**The calendar draws and does not mark, and that is a step boundary rather than a gap.**
Marking writes through the store, and the store cannot take a holiday span until the holiday
stops being a mark and becomes a state — the swap that has to happen in one step, since
dropping `חג` from the picker before the drawn state exists leaves a holiday impossible to
record at all. So a day here is not a button: a control that answers a click with silence
reads as a broken screen, and `MonthCalendar` gained a `readOnly` that turns marking off and
leaves the month buttons alone, because moving between months is reading.

**Check — the first one in seven steps that is not the suite.** With `npm run dev` running,
open http://localhost:3000/month.

- It opens on **ספטמבר 2026** and reads `26 / 26` work days, `₪6,247.65` base, `4 × ₪100.00`
  supplement, `₪8,353.05` once as `סך הכל תשלום לעובד/ת`, and balances of 15.50 vacation
  and 33.50 sick days. September 2026 has four Saturdays, so 30 − 4 = 26 — the standard
  count, and the actual count equals it because she took nothing. The figure appears
  **once and not three times**: September withholds nothing and transfers nothing, so the
  ברוטו and the נטו would both equal it and step 3's rule draws neither (item 17).
- Press `‹` back to **מרץ** and then `›` to **אפריל**. `ניכוי ימי מחלה` reads **−₪374.86** in
  March and **−₪124.95** in April. That is the whole of what the crossing spell means: one
  spell of four days from 30.3 to 2.4, stored once, whose first day pays nothing, second and
  third pay half and fourth pays in full — so March deducts 1.5 days and April 0.5. **If
  April also read −₪374.86 the spell had been read as two, and the tiers restarted.**
- April also carries `ביטוח לאומי ₪1,000.00` in a card of its own under the total, with
  `בגין החודשים ינואר 2026, פברואר 2026, מרץ 2026`. It must **not** be inside `נטו`
  (₪8,654.45) — that money went to the institute and never to her (item 16). April *does*
  show a `נטו`, because it repays an advance: `נטו ₪8,654.45`, then `מקדמה שנפרעת −₪1,000.00`,
  then `סך הכל תשלום לעובד/ת ₪7,654.45`.
- Now press the **left** arrow of the worker switcher in the top bar and go to **מאי**.
  Every label that names a day has changed: the group heading reads
  `ימי חמישי, ימי שישי וחגים`, `תוספת ימי חמישי` at `4 × ₪80.00` and `עבודה ביום שישי` at
  `3 × ₪426.35`. Her free rest day has moved from Saturday the 16th, where the first
  worker's is and where it reads `שבת חופשית`, to Friday the 15th, where it reads
  `יום שישי חופשי`.
- Under that heading `עבודה ביום שישי ₪1,279.05` and `עבודה בחג ₪426.35` come to ₪1,705.40
  between them — **four** days' worth from a line of three plus a holiday, because the
  holiday she worked on Friday the 1st fell on her own rest day and is paid once and not
  twice (item 9). Five would be the double payment. The column subtotal that used to print
  this figure is gone with step 3's `לפי העמודות` block; the two lines still add to it, and
  criterion 1 checks the columns on the sheet where they belong.

**What a failure looks like:** the same figure in March and April; a label naming Saturday
for the Friday-resting worker; or the national-insurance ₪1,000 folded into the month's
total. *(This check once ended "or a day that highlights on hover as though it could be
clicked" — true while the calendar only drew. Step 2 made a day a button, so a day that
highlights is now correct and that clause no longer applies.)*

**The rest-day column is not shaded, and that is on purpose.** The artboard shades it and
the hand-over's job 2a item 8 asks for the shading to follow her own day rather than
Saturday — but `src/app/globals.css` already records the decision the built system took:
an unmarked rest day is drawn exactly like an unmarked weekday, because `יום עבודה` names a
day she worked and an unmarked rest day is one of them (item 5). So the switch is read off
the labels and the free-rest-day mark, both of which move. Do not add the shading back
without reopening that decision first.

### Step 1b — the user's own lines choose their side of the total · **done**

Unplanned, and asked for by the user in two sentences while step 1 was being checked. Both
went into `specs.md` before any code moved.

**Fridays are shown beside Saturdays and holidays, and nothing about the file changes.**
The user asked for the rest-eve supplement to sit with the rest-day work and the worked
holiday. On the sheet it belongs to the salary column — criterion 1 pins August 2025 at
₪6,747.65 for column E, which is the base plus the ₪500 Friday supplement, against
₪2,558.10 for column F — so moving it would restate the one month the engine is checked
against. The resolution is item 5's new paragraph: **the preview groups by kind and the
sheet groups by column**, the three day lines are shown together under a heading that names
her own two days, and the column totals are shown *apart* at the foot rather than under the
groups. A column total printed under a group it does not add up to is worse than no
grouping, and that is exactly what the obvious reading would have produced — the first
mock-up of this drawn for the user had that error in it.

**A line the user adds now chooses its side of the month's total** (item 20, rewritten).
The direction decides the sign and nothing else; `placement` is a third independent choice
and defaults to where every line sat before it existed — an addition before, a deduction
after — so the whole suite went on asserting the figures it always had. The two
combinations that were previously impossible are now expressible and both are ordinary: a
deduction inside the month lowers what the month cost and with it item 19's estimate, and
an addition outside it adds to the transfer without reaching either.

**On the month screen the lines are summarised, one row per side.** The itemisation is the
payments screen's and the export's, and that division is not a preference: item 2 requires
the payslip to show every payment with its type, its units and its amount, so a summarised
row in the *file* would breach it while a summarised row on a *screen* answers "what did
this month come to" better than nine rows would.

**Check:** the two mutations that matter were made and both were caught — `placementOf`
returning `beforeGross` for everything failed six tests, and dropping the sign on a
before-gross deduction failed two.

**Check — click it.** On http://localhost:3000/month press `‹` to **יוני 2026**:

- The heading `ימי שישי, שבתות וחגים` now stands over `תוספת ימי שישי ₪400.00` and
  `עבודה בשבת ₪1,705.40` together. Switch worker and it reads `ימי חמישי, ימי שישי וחגים`.
- `תוספות והורדות שהוספת ₪250.00` sits **above** `נטו ₪8,603.05`, and a second
  row of the same name reading **−₪180.00** sits below it, so
  `סך הכל תשלום לעובד/ת` is ₪8,423.05. The heading appears twice on purpose: one heading
  covers both directions, and the side of the total it sits on is what differs. June shows
  a `נטו` at all because that −₪180 is a transfer row; it withholds no tax, so there is no
  `ברוטו` row above it (item 17).
- Now `›` to **יולי 2026**. The added row is **−₪180.00 above** the total this time, and
  the month closes on a single `סך הכל תשלום לעובד/ת ₪8,273.05` instead of ₪8,453.05 —
  one figure, because July neither withholds nor transfers anything. A deduction placed
  before the total is a negative line among the month's own lines, not a row below them.

**What a failure looks like:** July's ₪180 appearing below the total instead of above it;
the same figure for June and July, which would mean the placement was being ignored; or a
`ברוטו` row on either month, neither of which withholds anything.

*(Written for step 1b against the `לפי העמודות בדף המשכורת` block, which step 3 removed at
the user's request. The two clauses that read the column subtotals off the screen are gone
with it; the column totals are criterion 1's and are checked on the exported sheet.)*

**What the review found, and what is still owed.** A two-axis review ran over this change
before it was committed. Three findings were real and are fixed here: a line the user
withheld was signed on its **rate**, which puts a negative unit price in column D and is the
reading Part 5 warns about — it is signed on the units now, as the sickness deduction
already was; an **override** on such a line rounded differently on the two sides of the
total, so moving a line across it silently inverted an amount the user had typed (item 17),
and the sign is now forced from the direction on both sides; and the preview's groups were
keyed whitelists, so the next line the engine grows — the recuperation payment, item 15 —
would have counted in the total and appeared nowhere, which a catch-all group now makes
impossible by construction. Both engine fixes carry a test and both were mutation-checked.

**Nothing on any screen could yet *make* the placement choice, and step 4 is where it
arrived.** The spec says the choice is offered beside the line; for three steps only the
seed could set it. The control is now in the additional-payments group, as two chips that
follow the direction until the user touches them — which is `defaultPlacementFor` read
forwards rather than a second copy of the default.

**Editing the seed needs the dev server restarted.** The store is a `globalThis` singleton
so that saving a file mid-check does not silently reset the marks — the same property means
a change to `src/lib/dev/seed.ts` is not picked up until the process restarts. This was
found the honest way: the seeded lines were added and the screen went on showing the month
without them.

### Step 2 — the holiday stops being a mark, and the calendar starts writing · **done**

The swap `build_plan.md` said had to happen in one step, and the step that makes the month
screen a screen rather than a display.

**The model splits in two.** `MarkKind` is now what the *user* may mark — `vacation`,
`sick`, `freeRestDay` — and `SpanKind` is what a span may *be*, which adds `holiday`. No
stored string moved: a holiday span still carries `"holiday"`. What moved is which code may
write one, and the compiler now says so — `MarkIntent.kind` is a `MarkKind`, so `applyMark`
cannot produce a holiday, and the picker is built from the same union it stores.

Three things fell out of that split and each was resolved rather than patched around:

- **`restDayHoliday` is no longer a skip reason**, because no sweep can produce a holiday.
  The refusal itself did not go — it moved wholly into `validate.ts`, which is where it
  belongs now that the only caller able to place a holiday is the year's chosen dates, a
  caller the calendar's own refusals never see. The test that asserted the old gesture was
  replaced by the behaviour that replaced it, not deleted.
- **A day carrying a holiday refuses a mark like any other marked day**, as `alreadyMarked`.
- **`specs.md` item 5 still listed "a holiday worked" among the things the user marks**,
  which contradicted item 9. Item 9 is the authority and item 5 was corrected.

**The gesture, which had no artboard and was the user's to decide.** A holiday answers a
**single click**: the panel that opens where the range picker would be asks `עבדה בחג?` and
offers two chips, and no "clear" — the date belongs to the year and removing one is the
yearly picker's (item 10). The cost is that a holiday cannot be the day a sweep *starts*
on; every other day still can, and a sweep that crosses one is unaffected. Asking the
question on the second click of a range would have been two clicks for a yes-or-no about a
day the user did not choose.

**Marking writes through the store, and the browser decides nothing.**
`src/app/month/actions.ts` holds three server actions — mark a range, clear a range, answer
a holiday. Which days inside a swept range may actually take the mark is an entitlement
question, so it is answered on the server by the same `spans.ts` the suite tests, against
the worker's stored rest day. Each action revalidates the route, so the figures beside the
calendar are the engine's answer to what was saved rather than something the browser
guessed; the preview dims while that round trip is in flight.

**Check — this is the first step in the project where the user changes something.** With
`npm run dev` running, open http://localhost:3000/month and press `‹` back to **אפריל 2026**.

1. The 3rd is drawn as a **filled** `חג` and the panel reads `24 / 26` work days with a
   line `עבודה בחג ₪426.35`, `נטו ₪8,654.45`. April says `נטו` rather than `ברוטו`
   because it repays an advance below it and withholds no tax (item 17).
2. **Click the 3rd once.** A panel opens asking `עבדה בחג?`. Choose `לא עבדה`.
3. The day is redrawn as an **outline**, the `עבודה בחג` line disappears, the count falls
   to `23 / 26`, and the month falls to `₪8,228.10`. That is item 5's own check seen from
   both sides at once: a holiday worked changes the money and not the count, one she did
   not work changes the count and not the money.
4. **Now click the 20th, then the 22nd**, and choose `חופשה` from the panel. Three days are
   drawn, `ימים שנוצלו החודש` under חופשה reads 3, the balance falls from 9.67 to **6.67** —
   and `נטו` does **not** move. Vacation never shrinks the base (item 5); if the money
   changed, the base is being computed from the actual count instead of the standard one.
5. **Reload the page.** The marks are still there. They are in the store, not in the
   browser — until the process restarts, which is what an in-memory store means.
6. The legend now has six entries, with `חג שנעבד` filled and `חג שלא נעבד` outlined, and
   the picker offers three kinds and no `חג`.

**What a failure looks like:** `חג` still among the picker's chips; the month's total moving
when a vacation is marked; the marks gone after a reload; or a holiday needing two clicks.

### Step 3 — the closing block gets a middle level, and the user's own words · **done**

The three things the user asked for on 2026-09-03 after clicking step 2. Two were settled
when they were asked; the third was the question this step opened with, and the answer
changed the shape of the block rather than only its wording.

**The words are the user's** (item 1 of the three). `סך הכול החודש` is gone: the month's
total is `ברוטו` and the figure transferred is `סך הכל תשלום לעובד/ת`, which is what the
user calls them. The `/ת` is the one departure — the codebase writes `עובד/ת` everywhere
because a worker may be male, and one gendered label among neutral ones would be the
inconsistency, not the fidelity. The home screen's own total was renamed with it: it shows
the same `net` and Part 5 forbids two names for one number.

**`לפי העמודות בדף המשכורת` is gone** (item 2). It was step 1b's, and it printed the
column subtotals under the lines they do not add up to — which item 5 had asked for as the
lesser of two evils and which is simply the month said twice. `specs.md` item 5 now says
the preview prints no column totals at all; criterion 1 checks them on the exported sheet,
which is what the criterion is about.

**The block has three levels and two halves** (item 3, asked and answered). The user:
*"מס הכנסה is taken from the ברוטו while if she had taken מקדמה that is after the ברוטו
then its for the סך הכל תשלום לעובדת."* The template settles what the sheet does —
`template_month_standard.xlsx` has `A26` (`ד=א+ב+ג`), then `B28` (`ה. הפחתה מקדמה`), then
`B29`, and **no income-tax row at all** — so the middle figure is the screen's and not the
sheet's. Three answers came out of asking:

1. **Three levels**, not two: `ברוטו` → what is withheld → `נטו` → what is transferred →
   `סך הכל תשלום לעובד/ת`.
2. **A line the user placed after the total sits below the `נטו`, with the advances** and
   not beside the tax — which is item 20's own sentence about it, that it "changes only
   what is transferred at the end".
3. **A level is drawn only when something below it changes the figure.** The user asked for
   the collapse at the upper boundary ("if מס הכנסה is at 0 then hide that part") and for
   the surviving row to keep the name `נטו`. Applying the same rule at the lower boundary
   was not asked for and is this step's own call: September has neither a tax nor an
   advance, so `נטו` and `סך הכל` were the same figure printed twice — the redundancy the
   user had just asked to remove one boundary up. One rule now covers both.

**Which half a row is in is the engine's answer.** `ClosingLine.block` is `withholding` or
`transfer` and is set where the row is built; `MonthResult.afterWithholding` is the ברוטו
plus the withholding half. A screen sorting the rows by their keys would be the keyed
whitelist step 1b's review already caught once — the next row the block grows would land in
whichever half the `else` happened to be.

**`net` is not `נטו`, and that is written into Part 5 rather than left to be discovered.**
`net` stays criterion 1's fourth total, Part 4's ₪7,305.75, labelled `סך הכל תשלום לעובד/ת`;
the Hebrew `נטו` is the middle figure and is `afterWithholding` in code. Renaming either to
make them agree would break the tie between Part 4's two named figures and the engine.

**Nothing in the calculation moved.** `august-2025.snap.md` is byte-identical and the 299
tests that existed before this step all still pass; 13 were added, and the three mutations
that matter were made and caught — the advance rows tagged `withholding` (4 failures), the
after-gross user lines tagged `withholding` (3), and `afterWithholding` never withholding
(4).

**August 2026 is seeded with income tax**, because a month that withholds nothing cannot
show the block at its full height and no other seeded month has any. It is the one month
no earlier check names. A seeded month still proves nothing: the figures below are derived
on paper from the calendar and the rates, and the engine was run afterwards to confirm
them, not to supply them.

**Check — restart the dev server first.** The store is seeded once per process, so August's
income tax is not there until the running `npm run dev` is stopped and started again. Then
open http://localhost:3000/month.

1. It opens on **ספטמבר 2026** and the panel closes on **one** figure:
   `סך הכל תשלום לעובד/ת ₪8,353.05`. No `ברוטו`, no `נטו` — September withholds nothing and
   transfers nothing, so both would read ₪8,353.05 as well. There is also no
   `לפי העמודות בדף המשכורת` block at the foot any more.
2. Press `‹` back to **אוגוסט 2026**. The block is now at its full height and the three
   figures are all different:
   `ברוטו ₪9,205.75` → `מס הכנסה −₪450.00` → `נטו ₪8,755.75` →
   `תוספות והורדות שהוספת −₪200.00` → `סך הכל תשלום לעובד/ת ₪8,555.75`.
   Derived on paper: 1.8.2026 is a Saturday, so August holds five Saturdays and four
   Fridays; 31 − 5 = 26 standard days, `26 / 26` because the holiday on the 20th was
   worked. Column E is 6,247.65 + 4 × 100 = ₪6,647.65 and column F is 5 × 426.35 + 426.35
   = ₪2,558.10, which come to ₪9,205.75.
3. **The ₪200 is below the `נטו` and not above it.** That is the whole of the second
   question settled here: it is a line the user added and left where a deduction defaults
   to — after the total — so it changes the transfer and must leave the `נטו` alone. If it
   sat above the `נטו`, the `נטו` would read ₪8,555.75 and the answer had been inverted.
4. Press `‹` twice more to **יוני 2026**. Two levels, not three: `נטו ₪8,603.05` above
   `סך הכל תשלום לעובד/ת ₪8,423.05`, with the added −₪180.00 between them and **no**
   `ברוטו` row, because June withholds nothing.
5. Press `›` to **יולי 2026**. One level again, `סך הכל תשלום לעובד/ת ₪8,273.05`, with the
   user's −₪180.00 **above** it — a deduction placed before the total is a line among the
   month's own lines, and July neither withholds nor transfers anything.
6. **Open http://localhost:3000/ — the home screen.** Its own total now reads
   `סך הכל תשלום לעובד/ת` too. It is the same `net` the month screen closes on, and Part 5
   forbids two names for one number; renaming the month screen alone would have created
   exactly the disagreement that rule exists to stop.

**What a failure looks like:** `ברוטו` and `נטו` reading the same figure in any month; the
₪200 in August moving the `נטו`; September or July showing three figures where two of them
are equal; `סך הכול החודש` surviving anywhere; or the `לפי העמודות` block still at the foot.

**What this step owes the next one, found by the two-axis review and not fixed here.**
Hiding the income-tax row when it reads zero hides its *explanation* with it — the 2.25
credit points a foreign caregiver in home care is entitled to, and item 26's link to the
rule — and today `MonthScreen` is the only thing that reads `result.closing`, so in a month
with no tax that rule is now reachable nowhere. That is the right place for it to stop
being: item 17 says the figure is entered from the month's actions, so the rule belongs
beside the **control**, in the additional-payments group of the next step, and not on a row
printed at zero. `specs.md` item 17 now says so outright. **Step 4 built that group and the
rule is reachable again** — it stands under the tax field in words rather than behind the
"?", because it is what the user has to know before she types. The gap was written down here
while it stood, which is the only reason it was closed by the next step rather than found
by the family.

**Two of the review's findings were defects in this step's own work and are fixed above.**
`specs.md` item 5 was amended to say the preview prints no column totals at all, which was
false — column H keeps its subtotal, and item 5 now says why that is the rule rather than
an exception to it. And the transfer rows were drawn unconditionally while the `נטו` above
them was gated, so a transfer row that moved no money would have printed under no heading
and above a total it did not move; the whole lower half is now gated together, as the
upper half already was.

### Step 4 — the additional-payments group, and the two controls stage 4 owed · **done**

The first of item 5's three groups beside the calendar, and the step that turns two recorded
gaps into things a user can press. Both were listed at stage 4's own bullet and at the steps
that created them, so this is the step they were waiting for:

- **The control for item 20's before/after-the-total choice**, which since step 1b only the
  seed could set.
- **The income-tax line's control and the rule beside it** — the 2.25 credit points and item
  26's link — which step 3 took off the preview when it stopped drawing a tax row reading
  zero, leaving that rule reachable nowhere.

**The group is named for the group and not for what is in it.** `תשלומים נוספים` is item 5's
own "additional payments", which the criterion says holds the advances given and repaid, the
income-tax line and the manual overrides. Two of those are built here and two are not; naming
the card after today's contents would mean renaming it twice more.

**`specs.md` moved first, and item 20 needed a decision rather than a transcription.** The
criterion says the month screen *summarises* the user's lines — one row for those before the
total, one for those after — and that the itemisation belongs to the export and the payments
screen. But the group that *adds* a line is on the month screen too, and a control surface
that hides what it has already recorded cannot be used: a user who cannot see the line she
just added adds it a second time. The reading that resolves it is item 20's own sentence about
the division of labour, applied one level finer: **the preview summarises and the group
itemises**, because they answer two different questions on one screen. Item 20 now says so and
says why. Item 17 gained two sentences: the tax is typed as what is withheld and the
application signs it, and the rule stands beside the control in words rather than behind the
"?" — a rule that is merely reachable is reachable by the user who already suspects there is
something to find, which is the user who did not need it.

**Removing a line takes its override with it, and that is a rule rather than plumbing.** An
override is addressed by the line's own key (item 17) and *replaces* the calculated figure, so
one left behind is an amount waiting to reattach itself to a line that never asked for it —
and the line it landed on would show an amount nobody entered, marked as manual, with nothing
on screen to say where it came from. It is `withoutUserLine` in
`src/lib/engine/userLines.ts` and it carries five tests; the server action calls it and holds
no rule of its own.

**Four things were built and each decides on the server side of the boundary** (Part 3):

- `src/lib/money.ts` — `parseShekels`, the one place a figure crosses from the interface into
  the calculation. **It never goes through a float.** `Math.round(Number("1.005") * 100)` is
  100 and the nearest agora to 1.005 shekels is 101, so the digits are read as digits and the
  third decimal place decides the second. Which amounts a float gets wrong cannot be reasoned
  about from the decimal — 12.345 comes out right and 1.005 does not — which is why there is
  no set of "careful" figures to route around and the whole path is replaced instead.
- `src/lib/engine/userLines.ts` — `reviewUserLine`, the pure rule for what a draft may be, and
  `withoutUserLine`. The amount travels as the user typed it and is parsed here rather than in
  the browser; the direction and the placement are checked against their unions, because a
  server action is reachable by a crafted request and a stored `placement` outside the union
  would reach `placementOf`, match neither branch, and leave the line in whichever half the
  engine's filter happened to put it.
- `src/app/month/actions.ts` — `setIncomeTax`, `addUserLine`, `removeUserLine`, with `recordOf`
  added to the repository beside them. The id of a new line is minted on the server: an id is
  the store's to give and never a caller's.
- `src/components/MonthActions.tsx` — the card, drawn under the preview it changes and above
  everything that is only read.

**Two decisions inside it, neither reopenable without a reason:**

1. **The placement chips follow the direction until she touches them.** That is
   `defaultPlacementFor` read forwards and not a second copy of it — the default was exported
   from `engine/types.ts` for exactly this, so the sentence that decides which side of the
   month's total a line lands on exists once. An addition defaults to part of the month and a
   deduction to the transfer alone (item 20), and the moment she chooses, her choice stops
   moving.
2. **The chips are named for what the choice does, not for the row it lands under.**
   `חלק מהשכר של החודש` and `רק מהתשלום בסוף`, with the sentence below them naming the ברוטו
   for the user who thinks in those terms. A chip reading "בתוך הברוטו" would name a row the
   preview does not always draw — a month withholding nothing shows no ברוטו at all (item 17)
   — so the chip explaining the choice would depend on which rows the collapse happened to
   leave standing.

**No artboard draws this group, and that is written into the component.** The two slice
artboards fold the month's additions into a preview row and carry no control surface at all;
`docs/design-pass-jobs-1-2.md` lists the missing screens as job 3. So it is built in the idiom
the calendar's own picker established — a panel of chips that opens where it is needed and
closes when it is answered — rather than against a drawing, and the file says so, so that
nobody later reads it as having been checked against one.

**Nothing in the calculation moved.** The 312 tests that existed before this step all still
pass; 25 were added, and the four mutations that matter were made and caught — parsing through
a float (1 failure, and it is the only test that catches it), storing no placement on the line
(3), keeping the orphaned override (1), and accepting a line of zero (1).

**Check — no restart needed.** This step changed no seed data, so the running `npm run dev` is
enough. Open http://localhost:3000/month; it opens on **ספטמבר 2026**. Under the
`החישוב של החודש` card there is now a `תשלומים נוספים` card.

The figures below were derived on paper from September's calendar and the rates, and the
engine was run afterwards to confirm them rather than to supply them. September 2026 holds
four Saturdays, so 30 − 4 = 26 standard days; column E is 6,247.65 + 4 × 100 = ₪6,647.65 and
column F is the four Saturdays she worked at 426.35 = ₪1,705.40, which come to **₪8,353.05**.
The national-insurance estimate is 3.6% of that (item 19): 835,305 × 0.036 = 30,070.98
agorot, so **₪300.71**.

1. **The tax line reads `לא נוכה מס החודש`**, and under the field stands the rule in words —
   2.25 נקודות זיכוי — with `ניכוי מס הכנסה משכר העובד/ת — באתר כל זכות` beside it. That
   sentence is the whole of what step 3 owed: it is on screen in a month with no tax, which is
   exactly where it had become unreachable.
2. **Type `450` into `כמה נוכה החודש` and press `לשמור`.** The preview goes from one figure to
   three rows and *not* to four: `ברוטו ₪8,353.05` → `מס הכנסה −₪450.00` →
   `סך הכל תשלום לעובד/ת ₪7,903.05`, with **no `נטו` between them**. That is item 17's own
   sentence about the lower boundary — the figure below the tax is the figure paid, and naming
   it twice is the thing being avoided.
3. **Clear the field and press `לשמור` again.** Back to one figure, ₪8,353.05. Zero is an
   ordinary entry and not an empty one, which is how a tax typed by mistake comes off.
4. **Press `להוסיף שורה`.** Type anything into `על מה`, `250` into `סכום`, and leave `תוספת`
   selected. The placement chip already on is `חלק מהשכר של החודש`. Press `להוסיף`.
5. The line appears in the group in your own words, and `תוספות והורדות שהוספת ₪250.00`
   appears in the preview **above** the total, which reads ₪8,603.05. **The national-insurance
   estimate moves to ₪309.71** — that is the whole of item 20's before/after difference, and
   the only place on the screen it is visible.
6. **Press `להסיר` on the line, then add the same line again with `רק מהתשלום בסוף` chosen.**
   The total is ₪8,603.05 again, but now a `נטו ₪8,353.05` row stands above it and **the
   estimate is back to ₪300.71**. Same money, same direction, different side of the total.
7. **Press `הורדה` while adding a line and watch the placement chip move to `רק מהתשלום בסוף`
   on its own** — then press `חלק מהשכר של החודש` and switch back to `תוספת`: the chip stays
   where you put it. The default follows the direction until the user touches it, and never
   afterwards.

**What a failure looks like:** a `נטו` row in step 2, which would mean the collapse is not
applied at the lower boundary; the estimate moving in step 6 or standing still in step 5,
which would mean the placement is being ignored; the placement chip jumping back after step
7's second half, which would mean the default is being applied as a rule; or a tax entered as
`-450` being accepted.

**What this step owes the next ones, and none of it is a defect:**

- **A line cannot be edited, only removed and added again.** Item 20 asks that the placement
  choice be "offered beside the line", which adding satisfies; changing an amount or a
  direction after the fact is the manual-override step's surface and belongs with it.
- **The lifetime choice is not offered, and it has no owner in this plan.** Item 20's three
  choices are direction, lifetime and placement; a *standing* line is a term of the
  employment set once on the profile, so it cannot be offered here at all — only one-off
  lines belong to a month, which is what this group is for. **What is missing is the screen
  that sets one.** The design table maps `דף העובד` and `הוספת עובד` to stage 3, but stage 3's
  own bullets are the schema, the opening position and row-level security and name no
  screen — the same gap step 7c already recorded from the other side, where the rest day
  could not be checked because "there is no profile to change it on". Writing "the profile
  screen is stage 3's" here would assign the debt to a step that does not exist; it is
  recorded as unowned instead, and it is the same debt in both places.
- **A month the store has no record of refuses the group entirely.** The action answers
  `noMonth` and the screen draws `החודש הזה עדיין ריק` instead of the card. Creating a month
  out of a fact entered into it is the "future month accepts facts" step, which is where that
  belongs (item 21).
- **The manual overrides are still owed to this group.** They are item 5's own contents and
  the last of them, and the step after this one. **The advances arrived in step 5.**

### Step 5 — the advances, given and repaid · **done**

The second half of the additional-payments group, and the first thing in this application
whose figure cannot be read off the month it is entered in.

**`specs.md` moved first, and item 20 needed four decisions rather than a transcription.**
The criterion already said that advances are numbered and tracked one by one, that a month
may grant one and repay another, that the amount repaid is entered per month, and that what
is still owed is carried from the opening position. What it did not say was who mints the
number, what happens when a repayment is more than the debt, whether a repayment may name an
advance that had not been given yet, and what a month does with two repayments of one
advance. All four are now in item 20 and each says why.

**The number is the application's and is never typed.** It is minted one past the highest
the worker carries, the opening position's included, so the user chooses which advance she
is repaying from the advances she has and never has to know a number (Part 1: the option
that requires the user to know less). It is also what the closing block's rows are addressed
by, which is why it is never reused.

**What is still owed is a fact about the whole employment**, and that is the shape of this
step. An advance granted in February and repaid across March, April and May is one debt seen
from four months, so `advanceLedger` walks every month the worker has from the opening
position outwards — the same walk `calculateSeries` makes for the balances, with the same
consequence: nothing is stored, so a repayment corrected in a past month moves what every
later month may repay for free (item 13). The screen receives the walk already done and
computes nothing.

**Where each refusal lives, and why they are not all in one place.** Two of them need the
whole employment, and a month `validateMonth` refuses stops the replay that produces every
later month's balances — so an over-repayment that reached storage would close the very
screen it would have to be corrected on. Those two are refused where the figure is entered.
The third is a fact about one month and the engine can see it, so it is refused in both
places, exactly as item 16's pair of third-party payments already is.

**One rule with two readers.** `whyRepaymentIsRefused` answers everything settled before an
amount is read — the advance is not hers, the month already repays it, it had not been given
yet, nothing is left — and both the server's refusal and the screen's decision whether to
*offer* the button at all read it. The screen deciding that for itself would have been a
second copy of the same three sentences, one that agrees today and drifts the first time
either is corrected. It was two copies when this step was first written, and the review is
what turned it into one.

**Four things were built:**

- `src/lib/engine/advances.ts` — `advanceLedger` and the walk behind it, `nextAdvanceNumber`,
  `reviewAdvance`, `whyRepaymentIsRefused`, `whyRemovalIsRefused`, `withoutAdvance`, and
  `advanceKey`. All pure, all tested.
- **`advanceKey` moved out of `month.ts`**, where it was a template string built inline. It
  is a stored value — `MonthFacts.overrides` is keyed by it (item 17) — so the code that
  *removes* a movement has to build the same string the engine built when it drew one, and
  two call sites assembling it from the same two pieces is one too many. It is the same
  argument `userLineKey` already carries.
- `compareMonth` in `src/lib/dates.ts`, which `series.ts` had privately and the ledger needs.
  Two modules ordering months separately is two chances for one of them to compare the month
  before the year, which sorts December 2025 after January 2026 and produces figures that are
  merely wrong.
- `src/app/month/actions.ts` gained `addAdvance` and `removeAdvance`, and
  `src/components/MonthActions.tsx` the group's third section.

**A grant cannot be taken away from under a repayment, and that is this step's own
finding.** Removing February's ₪3,000 while March and April still repay ₪1,000 each leaves an
advance whose principal is nothing and whose repayments are ₪2,000 — the negative balance
item 20 refuses from the other direction when it refuses over-repaying. It was missed when
the step was written, found by the spec review, and it is the way in that is easy to miss
because it makes the *debt* smaller rather than the repayment bigger. The repayments come off
first, and then the grant. `AdvanceStanding.outstandingAgorot` now says what actually keeps
it positive instead of claiming it cannot be negative.

**The seed gained an opening advance for the second worker** — ₪2,000 given, ₪500 repaid, so
₪1,500 still owed. It is the only place a debt with **no granting month** is visible, which
is the case item 20 says may be repaid in any month, and it is why her next advance is
numbered 2. It changes no figure in any month: an opening advance is a position, not a
movement, and nothing in the calculation reads it.

**Nothing in the calculation moved.** The 337 tests that existed before this step all still
pass; 30 were added, and the six mutations that matter were made and caught — loosening the
over-repayment bound by one agora (1 failure, and it is the only test that catches it), the
ledger reading only the opening position and never the months (8), the removal rule never
refusing (1), the removal rule comparing the standing as it is rather than as it would become
(1), a repayment before the grant being allowed (1), and a new number filling a gap instead of
counting past the highest (1).

**One test passed for the wrong reason and was rewritten.** "The months are sorted here
rather than trusted from the caller" was asserted with a single grant, and with one grant the
answer is the same whatever order the months arrive in — deleting the sort broke nothing. It
takes two grants on one number to exercise it at all, which cannot arise from this
application and is exactly why the sort is there: the same defence against an assembled array
that `calculateSeries` keeps for the balances. The test now uses two and fails without the
sort.

**Check — restart the dev server first, and run it on `/payments`.** The store is seeded once
per process, so the second worker's opening advance is not there until the running
`npm run dev` is stopped and started again. **The card this check was written against moved
in step 6**, so open http://localhost:3000/payments rather than `/month`; it opens on
**ספטמבר 2026** and the `תשלומים נוספים` card there ends with a `מקדמות` section. Where a
step below says the preview moved, that is read on http://localhost:3000/month, on the same
month.

The figures below are September's from step 4, derived there on paper: ברוטו **₪8,353.05**
and a national-insurance estimate of **₪300.71**.

1. `מקדמה 1` reads `נפרעה במלואה`, with `ניתנה ₪3,000.00 · נפרעו ₪3,000.00` under it, and
   **no `לפרוע` button** — the seed grants ₪3,000 in February and repays ₪1,000 in each of
   March, April and May, so nothing is left. That figure is on screen in September, which is
   the whole point: no month of it can be read off September alone.
2. **Press `לתת מקדמה`, type `1200`, type anything into `למה`, and press `לתת`.** A
   `מקדמה 2` appears reading `נותרו ₪1,200.00`, with your own words beside the figures, and
   under it `מקדמה שניתנה ₪1,200.00 · נרשם החודש`. The preview goes to two levels:
   `נטו ₪8,353.05` → `מקדמה שניתנה ₪1,200.00` → `סך הכל תשלום לעובד/ת ₪9,553.05`.
   **The estimate stays at ₪300.71.** An advance is the same money moved in time and is
   outside the base item 19 takes 3.6% of — this is the one place on the screen that says so.
3. **Press `לפרוע` on `מקדמה 2`, type `500`, press `לפרוע`.** `סך הכל תשלום לעובד/ת` falls to
   **₪9,053.05**, `מקדמה 2` reads `נותרו ₪700.00`, and **the `לפרוע` button is gone** — one
   repayment per advance per month, entered as one summed figure (item 20).
4. **Press `להסיר` on the repayment.** `נותרו` goes back to ₪1,200.00 and `לפרוע` comes back.
   Now press `לפרוע` and type `1300`: it is refused with
   `הסכום גדול ממה שנותר לפרוע מהמקדמה…` and no figure moves.
5. **Press `להסיר` on `מקדמה שניתנה` — it works, because nothing repays it.** Now give it
   again, repay ₪500 of it, and press `להסיר` on the grant: it is refused with
   `כבר נרשמו פירעונות של המקדמה הזו…`. That is the negative balance being refused before it
   can exist.
6. **Press `‹` back to אוגוסט 2026.** `מקדמה 2` is listed there too, with what is still owed
   — a debt belongs to the worker and not to a month — but **there is no `לפרוע` button**,
   because it was given in September and August is before it. August's own three figures are
   unchanged: `ברוטו ₪9,205.75` → `מס הכנסה −₪450.00` → `נטו ₪8,755.75` → `−₪200.00` →
   `סך הכל תשלום לעובד/ת ₪8,555.75`.
7. **Switch worker with the left arrow in the top bar and go to ינואר 2026.** `מקדמה 1` reads
   `נותרו ₪1,500.00`, with `ניתנה ₪2,000.00 · נפרעו ₪500.00 · מלפני תחילת השימוש ביישום`, and
   `לפרוע` **is** offered — in January, the first month she has. An advance carried in from
   the opening position was given before the application existed, so no month is too early
   for it. Press `לתת מקדמה` there and the new one is `מקדמה 2` and not `מקדמה 1`: the number
   counts past what she already carries.

**What a failure looks like:** the estimate moving in step 2, which would mean an advance is
reaching item 19's base; a `לפרוע` button on a settled advance, or on `מקדמה 2` in August;
the second worker's first advance numbered 1; `נותרו` not moving when a repayment is removed,
which would mean the debt is being stored rather than walked; or a grant removable while a
repayment stands against it.

**One thing found while writing the check, and it is not this step's to settle.** Grant
₪1,200 and repay ₪1,200 in the same month and the preview draws `נטו ₪8,353.05`, the two
rows, and `סך הכל תשלום לעובד/ת ₪8,353.05` — the same figure twice, which item 17's collapse
rule says should not happen. Step 3's gate asks whether any row below the level is non-zero,
not whether the rows *come to* something, and the two readings differ only when rows cancel
exactly. The row-based reading is the one that keeps both movements on screen: summing would
hide two payments the family actually made, and a preview that drops a payment is worse than
one that prints a figure twice. It is left as it is and written down here rather than changed
inside a step about advances.

### Step 6 — the groups leave the calendar, and `/payments` exists · **done**

Asked for by the user on 2026-09-04 in one sentence, while step 5 was being read: what the
`תשלומים נוספים` card was showing belongs to `/payments`. `specs.md` moved first, and it was
a correction rather than a transcription — item 5 had said, from the beginning, that three
groups sit *beside the calendar*.

**The canvas already agreed and nobody had opened it.** `EaseSalary - תשלומים.dc.html` draws
a `מקדמות` section — `לרשום מקדמה חדשה`, `לעדכן פירעון`, and what is repaid out of what —
beside the third-party payments, and it has done since the batch of edits read here on
2026-09-04. It is the same class of thing the design pass found twice before: this file
asserted a placement for months and the drawing said otherwise. The artboard does **not**
draw the income-tax field or the user's own lines, which `docs/design-pass-jobs-1-2.md`
already lists among job 3's missing screens, so those two sections keep the idiom the
calendar's picker established and the component says so.

**What item 5 now says, and why it is the better rule and not only the user's.** The month
screen answers "what did this month come to", and every one of the three groups is a place
where something is *recorded* — so two of them are the payments screen's and the yearly
settings are the settings screen's, which is also where the nav has always pointed. A
calendar with four control surfaces around it asks the user to find the right one before she
can answer the question she arrived with. What stays beside the calendar is the preview,
which summarises (item 20), and the summary is the thing that sends her to the screen that
itemises.

**The one decision this needed, and it was the user's** (asked and answered on 2026-09-04):
**the payments screen is scoped to one worker and one month**, and carries the same month
control the calendar does. Two of the things it records are facts about a month rather than
dated payments — what income tax was withheld, and a line the user added — so a screen that
could not say *which* month could not record them at all. The alternative considered was a
list across months keyed off a payment's own date, which is closer to the artboard's own
closing sentence but leaves the income tax with no home, since a withholding is not a dated
payment. Item 5 records the choice and the reason.

**Nothing about the group itself changed.** `MonthActions` moved screens and kept its shape,
its actions and its rules; the actions stayed in `src/app/month/actions.ts`, because what
they change is a *month* — `incomeTaxAgorot`, `userLines` and `advances` are fields of
`MonthFacts` — and filing them by which button presses them rather than by what they write
would be the wrong axis.

**Two things were extracted rather than copied, and each is a rule that must not exist
twice:**

- `MonthStepper` — back a month, to this month, forward a month. Two screens each drawing
  their own would be two places for "forward" to stop meaning the same thing, in a layout
  where the arrow that means *forward in time* is the one on the **left** (`CLAUDE.md`).
- `openingMonthOf` — which month a screen opens on. The month screen and the payments screen
  reading the same store must not open on different months, and they would have the moment
  either rule was corrected alone.

**`/payments` ran no engine, and step 8 changed that** — the sentence is kept because the
reasoning still holds for everything but the one thing that overturned it. Nothing on this
route is a derived figure: the amounts are the ones the user typed, and the one walked
figure — what is still owed on an advance — is a sum of typed amounts and not a rate applied
to anything. The exception is the **manual overrides**, which by definition address a figure
the application *worked out* (item 17), so the group that holds them has to be shown one;
step 8 therefore runs `calculateSeries` here and hands the month's lines down. It is still
not a second calculation path and this route still totals nothing: what the entries come to
is `/month`'s answer, from the one calculation that also fills the export (Part 3). The
advance ledger moved to the payments route with the group; the month route no longer walks
it.

**Nothing in the calculation moved.** All 368 tests still pass and none was added: this step
changed which screen draws a control and no rule about what it records.

**Check — the same restart step 5 asks for, and then both screens.**

1. **http://localhost:3000/payments.** `תשלומים` is the active tab in the top bar. The screen
   opens on **ספטמבר 2026**, named at the top beside a `‹ החודש ›` stepper, over one column
   holding `תשלומים נוספים` with its three sections — `מס הכנסה`, `תוספות והורדות שהוספת`,
   `מקדמות`. Step 5's check runs here, in full.
2. **http://localhost:3000/month.** The `תשלומים נוספים` card is **gone**. What is left is the
   calendar, `החישוב של החודש` closing on `סך הכל תשלום לעובד/ת ₪8,353.05`, and
   `יתרות אחרי החודש הזה`. The calendar still marks: click the 20th, then the 22nd, choose
   `חופשה`, and the balance falls from 15.50 to 12.50 — the month screen lost a card and no
   gesture.
3. **The two screens agree about which month they are on.** On `/payments` press `‹` to
   **אוגוסט 2026** and type `450` into `כמה נוכה החודש`. Then open `/month` and press `‹` to
   August: `ברוטו ₪9,205.75` → `מס הכנסה −₪450.00` → `נטו ₪8,755.75` → `−₪200.00` →
   `סך הכל תשלום לעובד/ת ₪8,555.75`. That is the whole of the split working — recorded on one
   screen, calculated on the other, one store between them.
4. **The month follows the worker and not the other way round.** On `/payments`, press the
   left arrow of the worker switcher in the top bar: the month stays where it was and the
   `מקדמות` section changes to hers — `מקדמה 1 · נותרו ₪1,500.00 · מלפני תחילת השימוש ביישום`.

**What a failure looks like:** the `תשלומים נוספים` card still on `/month`; `/payments`
opening on a different month from `/month` against the same store; the stepper's `‹` moving
*forward* in time on either screen; or August's tax typed on one screen not reaching the
other's figures.

**What this step owes the next ones.** `/payments` holds one of its two groups. **The
third-party payments** — national insurance, medical insurance, the fees (item 16) — are the
other, and **step 7 built them**. What step 7 did *not* build is the artboard's own
`ממתין לתשלום` and `לקראת החודשים הבאים`: read properly, those two are a
*reminder* view resting on item 15's yearly clock and item 28's document dates rather than
a surface that records anything, and step 7's own table says what each of their six rows is
still waiting on. The manual overrides join the additional-payments group in their own step,
as step 4 already recorded. And the artboard's advances section draws a progress bar and names
the date an advance was given, neither of which is built: what is on screen is the same three
figures in words. That is a departure from a drawing and is written down here rather than left
to be found.

### Step 7 — the third-party payments, and the seventh kind · **done**

The second of `/payments`'s two groups, and the last of item 16 the application had no way
to reach: until this step a payment to somebody other than the worker could only be
**seeded**. The engine has drawn column H since stage 1 and refused two payments of one
kind since then too — what was missing was any surface that could produce one.

**`specs.md` moved first, and item 16 needed five decisions rather than a transcription.**
The criterion already said that these payments are their own column, that they are neither
added to the worker's total nor taken out of it, and that a month recording two of one kind
is refused. What it did not say was how many kinds there are, what a payment records
besides its amount, whether the user enters the months it covers, what the application may
offer her there, and what a removal takes with it. All five are now in item 16 and each
says why.

**The union had six members and the sheet has seven rows.** `template_month_standard.xlsx`
-> `sheet1` -> B14 is `אגרה להארכת ויזה ל{{worker_role}}.` and **B15 is `ויזת עובד זר`** —
the fee for extending the visa, and the visa itself, which item 28 says is issued through
the private agency against a charge of its own. Item 28 had already cited B14 and B16 by
cell and called them two fees; nothing had noticed that B15 was a third. One `visaFee`
covering two rows was not a missing member so much as a **refusal**: item 16 refuses two
payments of one kind, so a month that paid both was turned away and told to sum two figures
its own sheet keeps apart. `visaFee` is now `visaExtensionFee`, which is item 28's own
wording for B14, and `workerVisa` is B15's. **The rename is deliberate and costs nothing
today** — the store is in memory and no month holds a `thirdParty.visaFee` override — while
after stage 3 it would be a migration; a name meaning "the visa fee" where there are two
visa payments preserves exactly the confusion the seventh member exists to end.

**The list is now the source and the union derived from it**, as `userLineDirections`
already was, and in the template's own row order. The hand-kept `ALL_KINDS` array in
`thirdParty.test.ts` is gone with it — a second copy that would have compiled clean the day
a seventh kind arrived and quietly stopped covering it, which is precisely what happened.

**Four labels moved to the template's words**, which this file had recorded as the export's
to fix. Putting the names on a screen is what overtook that: `דמי השמה` (B12) and
`דמי תאגיד` (B13) are two different fees and neither is `דמי תיווך`, and a user taught the
wrong name looks for a row that is not on her sheet.

**The covered period is the one thing here that needed inventing, and it is offered rather
than derived.** A payment records which kind, how much, the months it covers and a note.
The period is optional — most payments cover the month they were made in — and it is
entered as a first month and a last month. Where the application can work one out it is
*offered* and stops following the kind the moment the user touches it, exactly as item 20's
placement chips stop following the direction. **Only the national insurance has an offer**,
and the shape of it is `previousQuarter`: the last calendar quarter to have **closed**, not
the three preceding months. The two agree for a punctual payment and part company for a
late one — recorded in May the three preceding months are February–April, which is no
quarter anybody is billed for. The yearly fees get no offer at all, and that is a decision
rather than a gap: item 15's year runs *forward* from an employment anniversary while a
quarter runs *backwards*, so one rule cannot serve both, and a period on the sheet's own
row reads as a fact somebody checked.

**Six things were built:**

- `src/lib/engine/thirdParty.ts` — `reviewThirdPartyPayment`, the pure rule for what a
  draft may be; `withoutThirdPartyPayment`, which takes the row's override with it; and
  `offeredPeriodFor`. All pure, all tested.
- `src/lib/dates.ts` — `parseYearMonth`, `yearMonthText`, `eachMonth` and `previousQuarter`.
  The parser is strict about padding on purpose: `2026-9` and `2026-09` would otherwise be
  two spellings of one month, and a stored month that round-trips to a different string is
  one the sheet's row label cannot be compared against. Month 0 and month 13 are refused
  rather than normalised, because `addMonths` would carry either into a neighbouring year.
- `src/lib/engine/types.ts` — `thirdPartyKinds`, and the union derived from it.
- `src/app/month/actions.ts` — `addThirdPartyPayment` and `removeThirdPartyPayment`. The
  first reads the month before it accepts anything, which is `addAdvance`'s own shape and
  for the same reason: the rule that decides it is a fact about the month rather than about
  the draft, and a refused draft never reaches `saveMonth`.
- `src/components/MonthActions.tsx` — the group's fourth section, and `MonthSelect`.
- `src/lib/i18n/he.ts` — the group's words, and the four corrected labels.

**Three decisions inside it, none reopenable without a reason:**

1. **A kind the month already holds is not offered.** The refusal is what would answer the
   click, and a control that answers a click with a refusal should not have been drawn —
   the rule `AdvancesControl` already follows for a repayment it would be refused. The
   server refuses it again regardless, because the offer is never the rule (Part 3).
2. **`MonthSelect` is a `<select>` and not `<input type="month">`.** That control's picker
   is laid out and worded by the *browser's* locale rather than the page's, so on a Hebrew
   right-to-left page it can arrive left-to-right and in another language — the mixed
   direction failure Part 5 warns about, in a widget the application can neither style nor
   isolate. A select holds labels the application wrote. **Its range reaches a year forward
   as well as four years back**, which was a defect found while writing this entry rather
   than a decision taken up front: the first version offered past months only, on the
   reasoning that a payment cannot cover months nobody has lived through — which is item
   19's arrears and exactly backwards for item 15, whose yearly fee covers the year running
   *forward* from an employment anniversary. A visa fee paid in March is for March through
   next February, and the control could not have recorded one.
3. **The amount is drawn positive.** It is money that left the account, but it leaves
   nobody's total on this screen, and a minus beside it would read as a deduction from her
   pay — the one thing item 16 says it is not.

**`CoveredMonths` was extracted, and it is the second defect this step found in itself.**
Driving the two screens after the group was built showed `/month` printing
`בגין החודשים אפריל 2026, מאי 2026, יוני 2026` while `/payments` printed
`אפריל 2026 – יוני 2026` — one period, two spellings, on two screens reading one stored
value. It is now one component both import, and it draws the run as its two ends: a stored
period is contiguous by construction, so the ends carry what the list carries and stay
readable at twelve months or at the permit's forty-eight, where a list would not. The
month screen's recorded decision was that the months travel *beside* the label and are
isolated (Part 5); how many of them are enumerated was never a decision, which is what
makes this safe to settle here. Same argument as `MonthStepper` and `advanceKey`.

**A period is bounded at forty-eight months, and the bound comes from a rule.** It is the
employment permit's own four-year cycle (item 28), the slowest clock the application knows.
It exists because `coversMonths` stores one entry per month and a crafted request naming
`0001-01` to `9999-12` is ninety-six thousand of them; it is taken from a rule rather than
from a round number so that a later reader is not left guessing what it protected. No
period the screen offers can reach it, which is why it comes back as `shape` rather than as
a sentence of its own.

**What this step does *not* build, and why the artboard is not the reference.**
`EaseSalary - תשלומים` draws two sections for this group — `ממתין לתשלום` and
`לקראת החודשים הבאים` — and **both are a reminder view rather than a recording surface**.
Read on 2026-09-04, they draw six rows between them, and the data stands like this:

| Row | Needs | Have it? |
|---|---|---|
| `ביטוח לאומי` quarterly | the month's own estimates and which quarters are settled | **yes** — derivable today |
| `דמי הבראה` | `terms.recuperationMonth` **and** an amount | month yes, amount no — item 15 has no engine line (finding 3 above) |
| `ביטוח רפואי` "עומד לפוג" | the policy's expiry date | no — nothing holds one |
| `אגרת ויזה` | the visa's date | no — item 28's dates, unheld |
| `דמי טיפול לחברה` | the fee's yearly date | no |
| `חידוש היתר העסקה` | the permit's expiry | no — item 28's, unheld |

So four of six need item 28's three documents and their dates, which no type holds and no
screen sets — the **profile screen**, which the routes table above already records as this
plan's unowned debt. This is now the fifth place that debt is written down and the
strongest of them, because here it blocks a whole artboard rather than one control.

The artboard draws **no recording surface at all**, exactly as it draws no income-tax field
and no user lines — the same finding step 6 made about it from the other side. So this
section is built in the idiom the calendar's picker established, the component says so, and
the two sections the artboard *does* draw belong to stage 5, which is where the routes
table has always put the second half of this route. **The one derivable row was deliberately
not built early**: it would have put an engine run on `/payments`, which step 6 established
runs none, and item 19 puts that reminder on the *opening* screen (stage 6), so building it
here would have created it in two places before either had an owner.

**Nothing in the calculation moved.** The 368 tests that existed before this step all still
pass; 22 were added, and the nine mutations that matter were made and caught — half a
period completed instead of refused (1 failure), a backwards period quietly reordered (1),
a duplicate kind accepted at entry (1), a payment of zero accepted (1), an unbounded period
(1), the override orphaned when its payment is removed (1), the quarter read as the three
preceding months (2), an unpadded month accepted (1), and month 0 and month 13 accepted (1).

**Check — restart the dev server first, and not for the reason the earlier steps ask.**
This step changed no seed data, so the code needs no restart; the *store* does, if anything
has been clicked into September already. The store is a module singleton and keeps every
entry made since the process started, so a September carrying a tax or a line from an
earlier session will not show the figures quoted below. Stop and start `npm run dev` and
September is back to its seeded state.

Open http://localhost:3000/payments; it opens on **ספטמבר 2026**. The
`תשלומים נוספים` card now ends with a fourth section, `תשלומים לגורמים שלישיים`, reading
`לא נרשם החודש תשלום לגורם שלישי.` over a `לרשום תשלום` button.

September's figures are step 4's, derived there on paper: ברוטו **₪8,353.05** and a
national-insurance estimate of **₪300.71**.

1. **Press `לרשום תשלום`.** Seven chips, in the sheet's own row order:
   `ביטוח רפואי` · `דמי השמה` · `דמי תאגיד` · `אגרה להארכת ויזה` · `ויזת עובד זר` ·
   `אגרה להארכת רשיון העסקה` · `ביטוח לאומי`. **Two of them are visa rows** — that pair is
   the whole of what this step fixed, and four of the seven read differently from last week
   because they now read as the template does.
2. **Press `ביטוח לאומי`.** The two month fields fill themselves: `אפריל 2026` and
   `יוני 2026`. That is the last quarter to have **closed** — September sits inside
   July–September, which has not — and it is the one place on screen item 19's "once a
   quarter and in arrears" is visible. Type `936` and press `לרשום`.
3. The row appears reading `ביטוח לאומי ₪936.00`, with `בגין החודשים אפריל 2026 – יוני 2026`
   under it. **Press `לרשום תשלום` again: `ביטוח לאומי` is no longer among the chips.** One
   row per kind, and the kind is simply not offered rather than refused after the fact.
4. **Press `אגרה להארכת ויזה`. Both month fields are empty** — no period is offered, because
   a yearly fee runs forward from an anniversary and the quarter rule cannot serve it. Type
   `195` and press `לרשום`. Now add `ויזת עובד זר` at `210`. **Both are accepted**, and that
   is the seventh kind doing its whole job: before this step the second was refused as a
   second payment of one kind.
5. **Press `לרשום תשלום`, choose any kind, fill only `מחודש` and press `לרשום`.** Refused
   with `צריך לבחור את שני החודשים…`. Now set `מחודש` to a month *later* than `עד חודש`:
   refused with `החודש האחרון מוקדם מהחודש הראשון…` and nothing is reordered for you.
6. **Open http://localhost:3000/month on the same month.** A
   `תשלומים לגורמים שלישיים` card stands **outside** `החישוב של החודש`, holding the three
   rows and a subtotal of **₪1,341.00** (936 + 195 + 210). And the month is untouched:
   `סך הכל תשלום לעובד/ת` is still **₪8,353.05** and the estimate is still **₪300.71**.
   That is item 16 and item 19 in one screen — column H reaches neither her total nor the
   base the estimate is taken from.
7. **Back on `/payments`, press `להסיר` on `ויזת עובד זר`.** It goes, `/month`'s subtotal
   falls to ₪1,131.00, and the chip is offered again.

**What a failure looks like:** a `ביטוח לאומי` chip still offered after one is recorded;
`ויזת עובד זר` refused after `אגרה להארכת ויזה` was accepted, which would mean the union is
back to six; the offered quarter reading `יולי – ספטמבר` (the quarter still in progress) or
`יוני – אוגוסט` (the three preceding months) instead of `אפריל – יוני`; a period offered for
one of the fees; `סך הכל תשלום לעובד/ת` or the national-insurance estimate moving in step 6,
which would mean column H is reaching the worker; or a backwards period being accepted and
silently turned round.

**What this step owes the next ones, and none of it is a defect:**

- **A recorded payment cannot be edited, only removed and recorded again**, which is the
  same debt step 4 left for a user line and which belongs to the same step: the manual
  overrides.
- **Nothing warns that a payment is due.** That is the artboard's two sections, and the
  table above says what each of their six rows is waiting on. Four wait on the profile
  screen and item 28's three documents.
- **`דמי הבראה` and `שעות עבודה נוספות במהלך אישפוז` still have no engine line**, as
  finding 3 of stage 2 records. Neither is a third-party payment, so neither is this step's
  — but the recuperation one is what `לקראת החודשים הבאים` most wants.

### Step 8 — the manual overrides, and the division between overriding and editing · **done**

The last of item 5's four contents, and the step that finished the additional-payments
group. Until it, an override could only be **seeded**: `MonthFacts.overrides` had been in
the engine since stage 1 and no surface could write one, which is the same shape step 7
found in the third-party payments a week earlier.

**`specs.md` moved first, and three criteria moved rather than one.** Item 17 gained the
whole override/edit division and six decisions under it; items 16 and 20 gained the
edit-in-place paragraphs steps 4 and 7 had each deferred to "the manual-override step".
What the criterion had said was that any amount the application worked out can be
overridden and that an override is marked manual and survives recalculation. What it had
not said was **which amounts those are**, and that question had been quietly answered the
wrong way by every earlier step: item 20 and item 16 both promised that an override on a
user line or a third-party payment would be carried and removed with it, which describes a
figure standing in front of an amount that was already the user's own.

**The rule is that an amount the application worked out is *overridden* and an amount this
month *recorded* is edited.** The two are different gestures and naming them apart is what
keeps either usable: a row whose amount **is** what she typed has nothing under it for an
override to replace, so an override on one would be a second amount in front of the first
with nothing on screen to say which is which, and the row would be marked manual against a
figure that was manual already.

**The test is not who typed the figure but *where*, and the standing line is the case that
proves it.** Its amount was typed — on the profile — and item 20 says it appears in every
month afterwards at the same amount, so a month in which the family paid something else has
no other way to say so; editing it would restate every month it appears in, which is the one
thing a term of the employment must not do. So `overridable` is not "derived" and not
"typed": it is *reached this month from somewhere else*. A standing line is on the
overridable side and a one-off line is not, and they are the same shape of object.

**The engine declares it and nothing else may.** `LineDraft.overridable` is set where each
draft is made and `MonthLine.overridable` carries it out; absent means no, which is the safe
direction, because the opposite default would let the next row the engine grows quietly
acquire a control nobody designed for it. The server action validates an override against
that flag on the line the engine actually drew — **never against a list of keys**, which
would compile clean and stop covering a new row silently. This file has been bitten by a
keyed whitelist twice already (`ClosingBlock`, `thirdPartyKinds`), and this is the third
place the lesson is written down.

**`ClosingLine` deliberately has neither field, and that is not an omission.** Every row of
the block below the columns is an amount the month itself recorded — the income tax, an
advance movement, a one-off line placed after the total — so none of them is overridable and
a flag with one reachable value is flexibility for a case that cannot arise. The one row
that *would* be is a **standing** line placed after the total, and no standing line can
exist: `MonthTerms.standingLines` is empty in the seed and the profile screen that would set
one is this plan's unowned debt. The flag is added the day the case can happen; until then
the override control reads `MonthResult.lines` alone.

**Six things were built:**

- `src/lib/engine/overrides.ts` — `reviewOverride`, the pure rule for what an override may
  be; `withOverride` and `withoutOverride`; and `orphanedOverrides`. All pure, all tested.
- `src/lib/engine/lines.ts` — `LineDraft.overridable`, and **`toLine` now signs an override
  from the draft's own `units`**. `signedUserLine` in `month.ts` is deleted rather than
  moved: it wrapped the user's own lines because `toLine` took an override verbatim, and
  signing inside `toLine` says the rule once and covers the **sickness deduction**, which
  the wrapper never did. Reverting the sign rule fails two tests — `sick.test.ts` and
  `user-lines.test.ts` — which is what proved the deletion safe.
- `src/lib/engine/types.ts` — `LineOverride.label`, the name the row carried when the figure
  was typed. It is a snapshot and not a lookup, for the reason item 17 now gives: an orphan
  has no row left to read a name off, and several of these names are derived from the
  worker's rest day, so a name worked out afresh would rename an old override the day her
  rest day changed.
- `src/app/month/actions.ts` — `setOverride`, `clearOverride`, `updateUserLine` and
  `updateThirdPartyPayment`, and `revalidateMonth` beside them.
- `src/app/payments/page.tsx` — the engine, which this route did not run.
- `src/components/MonthActions.tsx` — the group's fifth section, and the edit panels on the
  user's own lines and on the third-party payments.

**Five decisions inside it, none reopenable without a reason:**

1. **`/payments` runs the engine now, and step 6's sentence is corrected above rather than
   left standing.** Everything else on the route is an amount somebody typed; an override
   addresses a figure the application worked out, so the group holding it has to be shown
   one. It is still not a second calculation path — the route totals nothing, and the lines
   it hands down came out of the same `calculateSeries` the month screen and the export run.
2. **Clearing is its own button and the field is never prefilled with the calculated
   figure.** The two produce the same number and mean opposite things (item 17), so a panel
   opened over a derived row opens **empty** — it is asking what should stand instead — and
   one opened over a row already replaced opens with the figure standing there. A prefilled
   calculated figure would make "press save" the shortest path to storing that number by
   hand for ever, which is exactly the failure the criterion names.
3. **`clearOverride` validates nothing about the key**, which is the one place it differs
   from setting one. The override that most needs clearing is the one whose row the month no
   longer draws, and a check against the drawn lines would refuse the only case it exists
   for.
4. **The edit panel is the add panel, in all three places.** Adding a line and correcting
   one ask the same question — what should this say — and a second panel would be a second
   place for the placement rule, the period offer and the chip defaults to drift. What the
   two do differ in is what the panel *opens with*: an edit sets the placement and the
   period explicitly rather than letting the defaults take them again, or reopening a line
   to fix a typo would silently move it across the month's total.
5. **A third-party payment being corrected is offered its own kind among the chips.** The
   available kinds are those the month has not recorded **plus the one the panel was opened
   over**, and the server checks the draft against the month's *other* payments — otherwise
   a payment whose kind did not change would be refused as a second payment of its own kind,
   which is a control refusing to leave a field where it found it.

**One defect was fixed rather than carried.** `month.ts` set the income-tax row
`manual: true` whenever a tax had been typed, override or not — so the badge meant
"overridden" on five rows and "filled in" on that one, and this step is what put the two
meanings on one screen. A typed tax is not a manual amount: the tax is never worked out at
all, entering it is the only way it can exist, and item 17 says it is *edited*, in the
control where its rule stands. The row now says `manual` only for an override, like every
other row, and a test pins it.

**No artboard draws any of the three surfaces, and each component says so.** The two edit
panels and the whole override section are among `docs/design-pass-jobs-1-2.md`'s job 3
missing screens — `EaseSalary - תשלומים` draws no recording surface at all, as steps 6 and 7
each found from their own side. So they are built in the idiom the calendar's picker
established, and that is written into the files so nobody later reads them as having been
checked against a drawing. **They are the first thing job 3 should draw after the holiday
picker**, because they are now built and unowned rather than merely unbuilt.

**Nothing else in the calculation moved.** The 392 tests that existed before this step all
still pass; 12 were added, and the six mutations that matter were made and caught — an
override accepted on a row the month itself recorded (1 failure), zero refused as it is for
a user line (1), the row's name not stored with the amount (1), an orphan hidden because the
closing block draws its key (1), the sign taken from the typed figure rather than from the
row (2, in `sick.test.ts` and `user-lines.test.ts`), and the income tax marked manual for
having been entered (1).

**Check — restart the dev server first.** The store is a module singleton and keeps
everything clicked in since the process started, so a September carrying entries from an
earlier session will not show the figures below. Stop and start `npm run dev`.

Open http://localhost:3000/payments; it opens on **ספטמבר 2026**. September's figures are
step 4's, derived there on paper: ברוטו **₪8,353.05**, of which שכר החודש ₪6,247.65,
תוספת ימי שישי ₪400.00 (4 × 100) and עבודה בשבת ₪1,705.40 (4 × 426.35).

1. **The card now ends with a fifth section, `סכומים שהיישום חישב`**, holding exactly those
   three rows and no others. **`מס הכנסה` is not among them and neither is
   `מזומן לקניות`** — that is the whole of the division: the tax is edited in its own
   section above, where its rule stands, and a line you typed is edited on the line.
2. **Press `להחליף סכום` on `עבודה בשבת`. The field is empty.** Type `1600` and press
   `להחליף`. The row reads **₪1,600.00** with a `ידני` badge, and under it
   `היישום חישב ₪1,705.40` — what it would otherwise have been, beside what it says.
3. **Open http://localhost:3000/month on the same month.** `ברוטו` has fallen from
   ₪8,353.05 to **₪8,247.65**, and the national-insurance estimate from ₪300.71 to
   **₪296.92** (3.6% of the new ברוטו). The rest-day row carries the same `ידני` badge. One
   store, one calculation, two screens.
4. **Back on `/payments`, press `לחזור לחישוב של היישום`.** The row is ₪1,705.40 again with
   no badge, and `/month` is back to ₪8,353.05 and ₪300.71. **Now press `להחליף סכום` again
   and type `1705.40` yourself:** the row shows the same figure *with* the badge. Those are
   the two gestures item 17 says must not be confused — same number, opposite meanings.
5. **The sign is the row's and never yours.** Mark two sick days on `/month` (click a day,
   then a second, choose `מחלה`) so a `ניכוי ימי מחלה` row appears in the section. Press
   `להחליף סכום` on it, type `300` — **no minus** — and press `להחליף`. The row reads
   **−₪300.00**. Typing `-300` instead is refused before it is sent.
6. **Zero is an ordinary override.** Press `להחליף סכום` on `תוספת ימי שישי`, type `0`, press
   `להחליף`: the row reads ₪0.00 with the badge, and `ברוטו` falls by ₪400. That is the only
   way to say the family did not pay it, and it is where an override differs from a line the
   user adds, which refuses zero.
7. **An override outlives its row.** With that ₪0 override standing on `תוספת ימי שישי`,
   leave it and press `להחליף סכום` on `עבודה בשבת` and set `1600`. Now on `/month` clear
   every Saturday she worked (sweep the four Saturdays and press the clear gesture). Return
   to `/payments`: `עבודה בשבת` is **gone from the list**, and a block headed
   `סכומים ששמורים לשורות שאינן בחודש הזה` now holds `עבודה בשבת ₪1,600.00` with its own
   `לחזור לחישוב של היישום`. Mark one Saturday worked again and it moves back up into the
   list, still at ₪1,600.00.
8. **A line the user added is corrected in place.** In `תוספות והורדות שהוספת`, press `לתקן`
   on a line: the panel opens **under that line** with its words, its amount, its direction
   and its placement already in it. Change the amount and press `לשמור` — the line keeps its
   place in the list and its note, and `/month`'s summarised row moves by the difference.
9. **A third-party payment likewise, its kind included.** Press `לתקן` on `ביטוח לאומי`: the
   chips offer `ביטוח לאומי` **and** every kind the month has not recorded. Change it to
   `ביטוח רפואי`, press `לשמור`, and the row is renamed rather than duplicated. Press `לתקן`
   again and press `לשמור` without changing anything: it is **accepted**, not refused as a
   second payment of its own kind.

**What a failure looks like:** `מס הכנסה` or a line you typed appearing in the fifth
section, which would mean the division is being read off a key rather than off the engine; a
panel opening over a derived row with the calculated figure already in it; the sickness
deduction turning positive at step 5; `להחליף` refusing `0`; the override at step 7
disappearing with its row instead of moving into the block below; a corrected user line
jumping to the end of the list or losing its note, which would mean it was removed and added
rather than edited; or `לשמור` on an unchanged third-party payment being refused.

**What this step owes the next ones, and none of it is a defect:**

- **`NATIONAL_INSURANCE_RATE = 0.036` is still a bare constant with no effective date**, in
  the one file whose own comment explains how the family's workbook went stale exactly that
  way. It belongs with the dated-rates question stage 5 has to answer, and it is recorded
  here because this step is what made the estimate move on screen for the first time.
- **A standing line still cannot be set**, so the one case that makes the override/edit
  division *necessary* rather than merely tidy has no screen behind it and `overridable:
  prefix === "standing"` has one reachable value. That is the profile screen, this plan's
  unowned debt, and this is the sixth place it is written down.
- **The three new surfaces have no artboard**, and are now the strongest argument for job 3
  after the holiday picker.

### Step 8b — the duplicate heading, item 21, the month with no record, and the known case made enterable · **done**

**Written and built 2026-09-08.** Four things the design pass and the steps before it had
left owed, done in one step because the middle two are the same screen and the last is what
makes any of them checkable end to end.

**The duplicate `h1`.** `MonthScreen.tsx` named the month above the calendar card and
`MonthCalendar.tsx` named it again inside it, both at 24px bold; `חישוב החודש` names it once,
in the card's header beside the hint and opposite the stepper. The page `h1` is gone and the
calendar's label became the `h1` — behind a prop, because the two artboards genuinely differ:
`דף הבית v3` heads itself with the hero card and draws the same label as a `span`, so a
calendar that promoted it unconditionally would give the home screen two `h1`s.

**Item 21, and where its condition lives.** A month that has not ended raises a warning and
nothing else: it is calculated, it takes every fact, and Part 5 is explicit that it is a draft
that cannot be *confirmed* rather than a fifth state. The condition is `monthHasEnded` in
`dates.ts`, named for what it tests and not `isExportable` — confirming the wage (item 4) and
answering the pre-export questions (item 18) are conditions of an export too, and neither is
date arithmetic. **The month still running is one of them**, which is one boundary rather than
two: September cannot be exported on the 30th either, and the export stage reads the same
function the warning does.

**A month is opened by the first mark on its calendar, and by nothing else.** Every action in
`month/actions.ts` answered `noMonth` for a month the store had no record of, so a future
month could not in fact be filled in. The gesture item 21 names is the calendar, and it is the
only one: no button that says "start this month", and no month brought into being by a page
being looked at, since a render that writes grows the store every time somebody steps forward.
`/payments` offers nothing for a month with no record, so the question cannot arise there.
The new month carries the wage position last confirmed nearest to it (`wageToCarry`), which
until stage 5's dated-rates table is the only source in the application that is not an
invented number — and item 4's confirmation before every export is where a carried figure is
replaced by a real one.

**The known case, as a second seeded household.** `august-2025.test.ts` already checks the
engine's answer to Part 4 to the agora from facts handed to it directly. What was missing was
the half rule 9 names: the same four figures reached by clicking. `src/lib/dev/known.ts` seeds
Hanna, her opening position and its ₪10,000 advance, August 2025, and the year's two holiday
dates — and **nothing else**. The free rest day of the 16th is swept, each holiday's one
question is answered on the day, and the ₪2,000 instalment is entered on `/payments`: three
gestures move ₪8,879.40 to ₪9,305.75 and ₪7,305.75. A seed that arrived at the four figures on
its own would be a demonstration.

**The store is selected by a cookie, and that is what makes the second household reachable.**
`getRepository()` reads `household` and keys a per-name singleton; the seed is the part before
the first hyphen, so `known-e2e-<run>` is the known case seeded fresh. That last part is not a
convenience: the store outlives a test run, so a fixed name hands the second run the marks the
first one made, and the "before" assertions would be asserting the previous run. An env var
chosen at server start was the alternative and was rejected with the user on 2026-09-08 — it
gives one household per running server and no isolation at all.

**What the second household found, which was a real bug and not its own.** `AppShell` handed
`WorkerScopeProvider` the home screen's fixtures, so the switcher's worker — the id **every
write action is made against** — was `worker-1` whatever household was loaded. On the known
household every mark threw `No worker with id worker-1`. The layout now reads the household's
workers from the store and passes them down: one bar, one read, and stage 3 changes only where
the layout reads them from. It would have surfaced on the first real account and not before.

**A `data-row` attribute on each preview row**, which is the browser suite's handle on one
figure. Rule 9 requires the figures be asserted rather than looked at, and a selector built
out of the Hebrew beside a figure breaks on a wording change that broke nothing.

**The check the user runs.** `npm run test:e2e` — six specs in `e2e/month-screen.spec.ts`, all
green. By hand: open `/month` and the month is named once, in the calendar card; the
`כדאי לדעת` card says the month has not ended; step forward to a month past the seeded range
and it says it is empty, then sweep a range on it and the preview appears with the same
sentence still under it. Then set the `household` cookie to `known`, reload, and August 2025
opens at ₪8,879.40; mark the 16th free, answer both holidays "she worked it", and record a
₪2,000 repayment on `/payments`; the נטו reads ₪9,305.75 and the סך הכל ₪7,305.75.

**What a failure looks like:** the month named twice again, or named nowhere; the warning on a
month that has ended, or absent from the month still running — the second is the one that
looks fine, because most months a user opens have ended; a month that stays empty after a
sweep, or one that opens carrying a base salary no month before it was confirmed at; the four
figures reached without all three gestures, which would mean the seed answered a question the
case exists to put to the user.

**What it does not do.** Nothing refuses an export, because there is no export: item 21's
second half is one function call in stage 2, and it is `monthHasEnded`. Step 10 below still
owns the rest of the browser verification — the part-day and the note, the advances walked
across months, the third-party edit, and the overrides.

### Step 9 — the worker's profile, the debt given a step · **done**

**Written 2026-09-08 and built 2026-09-09, and it exists because the debt was recorded six
times and never assigned.** The route table maps `דף העובד` and `הוספת עובד` to stage 3, but
stage 3's own bullets are the schema, the opening position and row-level security and **draw
nothing** — which is how a screen four built things were waiting on stayed nobody's for four
stages.

**It lands in stage 4 rather than in stage 3 because it is a screen on the repository
interface**, which is the whole reason step 8 built that interface: the slice builds a screen
on the in-memory store and stage 3 persists what it writes, exactly as it will for the month.
Nothing here is built twice, and nothing here waits on Postgres.

Routes: `/workers`, the list with item 11's two-worker limit, and `/workers/[id]`, the
profile itself. Both artboards were corrected in job 3, so both are the reference.

**Each thing it builds is something already built that had been waiting on it:**

- **The rest day as a term of the employment** — Friday, Saturday or Sunday, defaulting to
  Saturday (Part 2 item 5). Step 7c built the generalisation and could not check it, because
  no screen could change the value from its default.
- **Item 20's standing line**, which is the one case that makes step 8's override/edit
  division *necessary* rather than merely tidy: `overridable: prefix === "standing"` had one
  reachable value until a standing line could be set.
- **The opening position** — balances already accrued and an advance part repaid. Step 5
  seeded an opening advance because nothing could enter one, and criterion 13's replay reads
  from it, so a wrong opening position is wrong in every month at once.
- **The three documents and their expiry dates** (item 28, drawn in job 3). The dates are not
  encrypted — the warnings query them.

**The five identifying numbers are not built here, and that is deliberate.** Passport, bank
account and the three document numbers are encrypted at rest with a key held outside the
database, and there is no database yet: a profile screen that took them now would put five
plaintext identifiers into the in-memory store, which is the one thing the non-negotiables
say may never happen. They arrive with their encryption, in stage 3, on a screen this step
has already built.

#### The two things settled with the user before any code was written

**Where the editing lives — on the profile page** (2026-09-09). `דף העובד` is drawn
read-only and its `פרטים והגדרות` link points at `הגדרות`, whose route the plan splits
between stages 3 and 5; of the four things this step exists to make settable, only the rest
day is drawn as editable anywhere, and it is drawn there. Taking `/settings` would have
widened the step into two later stages' route, and the standing line and the opening position
would still have had to be invented onto it, since that artboard draws neither. So the
profile carries the read-only artboard as drawn and an editable `תנאי ההעסקה` section below
it, in `הגדרות`'s own row vocabulary — a label, the hint under it, the value, and a control
that changes it — and the header's link scrolls to that section instead of leaving the page.
**This is a measured departure from `דף העובד` and is written down here and in
`WorkerProfileScreen.tsx` rather than the artboard being silently obeyed** (`CLAUDE.md`).
When `/settings` is built it inherits the vocabulary rather than inventing a second one.

**Which months a changed term reaches — every month that has not been confirmed**
(2026-09-09). Part 5 says it outright: a month is *confirmed* at "the moment its figures stop
moving with the profile", and until then it is a draft that follows the profile. Nothing in
the application can confirm a month — the confirmation is item 4's and arrives with the
export in stage 2 — **so today the change reaches every month the worker has, past months
included**, and the predicate that will exclude a confirmed one lives in
`monthsFollowingProfile` and nowhere else. The step as first written said a failure looked
like "a past month keeping its Saturdays"; that sentence assumed the four states, and it is
replaced rather than argued with. What Part 3 forbids is the *engine* reading the profile,
and it still does not: the terms are re-snapshotted onto the months at the moment the profile
is saved, and every rule goes on reading them off the month.

#### What else the artboards draw and this step does not

Each is an absence rather than an invention (`CLAUDE.md` rule 4), and each is named here so
it is not rediscovered as a gap:

- **The status badges** on `העובדות`'s cards and on `דף העובד`'s months list, and the
  `צריך לטפל` hero card, name the month's four states (Part 5). Nothing can yet confirm or
  export a month, so a badge would be a state invented to fill a shape.
- **`להוסיף עובד/ת`** links to `הוספת עובד`, which no stage has built. The routes table calls
  a tab that 404s worse than a tab that is not there, and the same holds for a card. Item
  11's limit is still stated, in the sentence the artboard closes with.
- **`משותף/ת עם [שם]` and `לשתף עם בן/בת משפחה`** are item 11's invitation, which is stage
  3's.
- **The country** is shown as the code the application actually holds — the code the holiday
  list is filed under (item 10) — because there is no country list until stage 5 fetches one.
- **The rest-eve supplement, the base salary and the employment start** are drawn as editable
  on `הגדרות` and are *not* built here. None of them is one of the four things waiting on
  this screen, and the base salary in particular drags item 4's minimum-wage confirmation in
  with it, which is stage 2's.

#### One thing item 28 asks for that the store cannot yet hold correctly

The **employment permit belongs to the employer**, so a household with two workers holds one
permit and two visas. There is no household record — the store is keyed by worker and stage 3
is the stage that builds one — so each worker carries a copy of the one date and nothing
stops two of them disagreeing. It is held per worker, the screen labels it as the employer's
so the user is not told otherwise, and both demo workers are seeded with the same date. It
moves to the household with the schema, and the reason is written beside the field in
`src/lib/types.ts` rather than only here.

#### One thing step 9 opened rather than closed, and closed in the same step

Step 8 left `ClosingLine` with **no** `overridable` flag, and said so in as many words: the
one row that would need it is a **standing** line placed *after* the month's total, no
standing line could exist, and "a flag with one reachable value is flexibility for a case that
cannot arise, so it is added the day the case can". This step is that day — and it is not a
corner of the case but the middle of it, because a standing *deduction* lands on that side of
the total by default (`defaultPlacementFor`). Left alone, a family setting one would have had
a line in every month whose amount no month could replace.

So the flag was added to `ClosingLine` with `calculatedAmount` beside it, `reviewOverride` now
takes anything carrying a key, a label and the flag — written structurally, because naming the
two row shapes would be the keyed whitelist `overrides.ts` refuses in a different spelling —
and both routes hand the columns and the closing block down together. Every other row of the
block answers `false`, which `closing-block.test.ts` asserts by name and not only by the list.
It is a defect this step introduced and is fixed in it rather than filed.

**The check the user runs.** `npm run test:e2e` — fifteen specs, six of them new in
`e2e/worker-profile.spec.ts`, all green. By hand: open `/workers` and see both workers with
their four facts and the sentence about the limit; follow the link to `האנה` in the `known`
household and change her rest day to Friday — `/month`'s legend stops saying `שבת חופשית` and
the rest-eve supplement falls from ₪500 to ₪400, because August 2025 has four Thursdays
against five Fridays. Set a standing line and it appears in the month's summarised row and is
offered `להחליף סכום` on `/payments`, while a line typed into the month offers `לתקן`. Enter
an opening advance of ₪2,000 with ₪500 repaid and `/payments` reads ₪1,500 still owed, under
a number minted past the one she already carries. Type the three document dates, reload, and
all three read back; type `2026-02-29` into one and it is refused.

**What a failure looks like:** the rest day changing on the profile while the month's figures
go on counting Saturdays, which would mean the terms were written to the profile and not onto
the months — the calendar would redraw and the money would not, and the money is the half
nobody checks; a confirmed month moving with the profile once stage 2 can confirm one, which
is what `monthsFollowingProfile` is the single place to prevent; a standing line offering
`לתקן`, or a this-month line offering `להחליף סכום`, which would mean the division is keyed
off the row rather than off who produced the amount; an opening advance numbered so that it
collides with one a month already granted, which would put two rows on one override key; a
date field accepting `2026-02-29`, which a `Date` rolls forward to 1 March and which is a
permit silently expiring on the wrong day; or any identity field appearing on the screen
before stage 3.


### Step 10 — the two built screens verified through a real browser · **done**

**Written 2026-09-08 and built 2026-09-09.** `e2e/home-screen.spec.ts` was the only Playwright
spec in the repository and all four of its tests were on `/`, while eight steps of this stage
built `/month` and `/payments`. Every one of those steps was checked by the user by hand,
once, and none of them was held by anything that runs again.

**No behaviour changed.** What was added is coverage of what the eight steps already built, so
that stage 3 swapping the store underneath these screens and stage 5 putting a picker in front
of their holidays cannot break a gesture in silence. `e2e/payments-screen.spec.ts` holds four
tests; with step 8b's six and step 9's six and the home screen's four, the suite is nineteen.

- **The calendar's sweep, ordered by date and never by screen position.** The same range is
  swept from each of its two ends, in two stores of its own, and both reach the same four days
  — asserted as the days themselves and as the balance they draw, not as the click. In
  right-to-left a leftward drag moves *forward* in time, which is the failure that looks
  entirely plausible on screen.
- **An advance given and repaid, walked across months.** The standing reads the same in
  September, in March and in February, because what is owed is a fact about the whole
  employment; what is per-month is the movement recorded in it, and the two are asserted
  apart. A screen that showed the debt as it stood *in the month being viewed* would pass the
  second and fail the first, which is the reading that sounds reasonable until it is written
  down.
- **A third-party payment corrected in place**, including `לשמור` on an unchanged payment
  being accepted — the kind is checked against the month's *other* payments, or a payment
  whose kind did not change would refuse itself — and the edit renaming rather than
  duplicating, with the amount travelling with the new name and staying outside her total.
- **An override on a derived row**: the `ידני` badge, `היישום חישב` with the figure it
  replaced, `0` accepted rather than refused, and the clear button returning the row to
  derived. The expected figure is worked out from Part 4's own ₪426.35 and the five Saturdays
  of January 2026 rather than read off the screen — ₪2,131.75 — and the replacement is
  ₪1,234.56, which no rate in the application can produce.

**Two of the four things this step was written to cover do not exist to be covered, and that
is a finding rather than an omission.** The step named "the part-day and the note on a sweep".
The engine reads both — `DaySpan.fraction` and `DaySpan.note`, and `leave.ts` counts a part
day as its fraction — and the design pass drew both on the sweep picker on 2026-09-08. **No
gesture writes either.** `MarkIntent` carries a kind and two dates and nothing else, and
`grep -rn fraction src --include=*.tsx` returns nothing. Building them here would be new
behaviour, which this step forbids in its own first line, so they are recorded as a step of
their own to be scheduled rather than smuggled in: the calendar's sweep needs a second row on
its picker before either can be tested through the interface. Until then the fraction is
reachable only from a seeded span, and the note not at all.

**One thing this step fixed that it did not set out to.** `npm run lint` was linting
Playwright's own `playwright-report/`, which exists only after a browser run and contains a
bundled copy of CodeMirror: a failing e2e run left three thousand warnings in front of the
next lint, and `hooks/pre-commit` runs lint — so a failing browser run blocked the commit that
would have fixed it. Both output directories are now in eslint's `globalIgnores` with the
reason beside them. They were already in `.gitignore`; eslint's flat config does not read it.

**Done when**, and the check the user runs: `npx playwright test` covers both screens and is
green, and **changing one figure in the store on purpose turns the suite red** — which was
run: the seeded medical insurance moved from ₪1,300 to ₪1,400 and March's instalment from
₪1,000 to ₪900, and the two tests that read them failed while the other two passed. A test
that cannot fail is a demonstration (rule 12).

**What a failure looks like:** a suite that stays green when a seeded figure moves, which
means it is asserting the screen against itself; a sweep that reaches different days depending
on which end was clicked first; a debt that shrinks or grows as the stepper moves, which would
mean it is being read off the month rather than walked across the employment; an unchanged
third-party payment refused on save, which would mean the kind is checked against all of the
month's payments including itself; or an override of `0` refused, which is the only way to say
that a derived row came to nothing.


### Step 11 — the part-day and the note on a sweep · **done**

**Found by step 10 on 2026-09-09, while trying to test it**, and built on the same day once
the user scheduled it. Step 10 was written to cover "the part-day and the note on a sweep"
and could not, because neither gesture existed: `DaySpan.fraction` and `DaySpan.note` were
stored fields the engine already read — `leave.ts` counts a part day as its fraction,
`counts.ts` takes the largest fraction lost on a day — and the design pass had drawn both on
a second row of the sweep picker in `חישוב החודש` and in `דף הבית v3`, but `MarkIntent`
carried only a kind and two dates, so nothing wrote either.

**The gesture.** `MarkIntent` gained a `fraction` and a `note`; the picker gained the second
row the artboard draws — `כמה מהיום נלקח` with `יום מלא` and `חצי יום`, the free-text note
beside it, and the rule stated in words beneath both; and `applyMark` writes both onto the
spans a sweep produces, the note onto every span where a broken sweep produced more than one.

**Only one day of vacation may be taken in part, and the picker offers nothing else.**
`partIsAllowed` in `spans.ts` is that rule, and it has three readers rather than three copies:
the picker draws the part chips only for a single-day range and closes the two kinds that are
whole days while `חצי יום` stands, `applyMark` writes no fraction the rule refuses, and
`markRange` throws on one — a server action is reachable by a crafted request, which is the
only way the combination can arrive. Item 7 gives the part-day to vacation and item 10 to a
holiday, which is not a mark at all; sickness is counted in whole days from the spell's own
first day (item 8) and a free rest day is not an entitlement (item 5).

**Why the chosen chip is filled and the kind chips are not.** The part is a choice where one
option always stands — `יום מלא` from the moment the picker opens — so the border-only
selected state the kind chips use came out unreadable in the browser, two chips a shade apart
with nothing to say which was chosen. The artboard fills it, and so does the code. The kinds
are pressed rather than standing, so they keep the quieter treatment.

**A half day is drawn as a day filled to half its height**, asked for by the user once the
gesture worked and the marked day still looked exactly like a whole one. The gradient is a
`background-image` painted over the fill `markClass` already gave the cell, so the mark keeps
its own colour in the lower half and the upper half returns to the colour of an unmarked day —
one class for every kind, and no second palette entry. The split runs across the cell rather
than down it: a vertical or a diagonal half would mean the opposite thing in a right-to-left
month. The cell's accessible name carries `חצי יום` as well, because the fill says nothing to
a reader who cannot see it, and that is what the browser test asserts — the fill itself is
checked by eye in the browser, the 15th half filled beside a whole vacation day on the 17th.

**The note is stored and has no read-back surface yet, on purpose.** Item 2 says where it
goes: the workbook's helper column, in both versions of the export, which is stage 2 and is
not built. Every other note in the application is shown back beside the thing it belongs to,
so this is the one that is not — and it is written here rather than left to be rediscovered
as a bug. Nothing about a mark's note is decided by stage 2 except where it is printed.

**Verified through the browser** (`month-screen.spec.ts`): half a vacation day on Tuesday 15
September 2026 leaves the actual count at 25.50 against a standard count of 26 and draws 0.50
from the vacation balance — the two halves of item 5's own sentence — and survives a reload,
so the fraction went to the store rather than to the browser. The standard count does not
move, which is what would catch a part-day that shrank the base. Both figures are derived on
paper in the spec's comment: September 2026 has 30 days and four Saturdays, so 30 − 4 = 26.
The test was confirmed to fail against two separate mutations — the fraction dropped in
`applyMark`, and the fraction dropped in the picker — rather than only confirmed to pass. A
second test asserts that the half is not offered for a range of more than one day and that
choosing it disables sickness and the free rest day. The name assertion was confirmed to fail
against a third mutation, the half dropped from the cell's label.


## Stage 5 — External data and yearly settings · **done**

`fetch` plus an HTML parser, server-side, cached in Postgres. Seven steps, all landed
between 2026-09-08 and 2026-09-09; the last of them is what makes stage 2's export
reachable by a user at all, so stage 2 is what follows.

- **The dated-rates table, first, because everything else in this stage writes into it.**
  Criterion 4 and Part 3: one table holding every rate the application does not derive —
  which rate, the figure, the date it took effect, where it came from — and the engine asks
  it for the figure in force during the month it is calculating rather than for the latest
  one. It is **seeded** with what is known, so the application works before any fetch has
  succeeded, and the wage scrape below then updates a table that already exists instead of
  introducing one. Two rates go in it on day one: the minimum wage, and
  `NATIONAL_INSURANCE_RATE = 0.036`, which is a bare constant with no effective date in
  `src/lib/engine/thirdParty.ts` — the file whose own comment explains how the family's
  workbook went stale in exactly that way, since its national-insurance line stayed at 2%
  after the rate rose to 3.6% (Part 5). Anything item 3 can derive from the base monthly
  salary stays derived and never enters the table.
- The minimum wage with its effective date, and the plausibility check.
- Holiday lists per source and year, with the shipped files as fallback. A source is a
  country **or a religion** — item 10, decided with the user on 2026-09-09. An **empty**
  cached list is a failed fetch and not a source without holidays: `UA-2026.json` shipped
  empty with its `source_url` pointing at country code `UK`, which is what that mistake
  looks like from the inside, and commit 38d44d0 corrected it.
- The fetched page text is cached beside the figure extracted from it rather than
  discarded. Stage 7 answers out of that text, and a corpus thrown away here has to be
  scraped a second time. It is cached **segmented by heading**, not as one blob per URL.
  Item 26's links already point at *sections* of the caregiver-terms page — `src/lib/links.ts`
  says so outright, and several of its keys share that one page on purpose — so a question,
  a legal link and a cached section all resolve to the same unit and Stage 7's matching has
  something to match on. Segmenting in Stage 7 instead means inventing it against text
  scraped two stages earlier, which is the scrape-it-twice outcome this bullet exists to
  avoid.
- The holiday picker: the candidate list, the entitlement, part days, the remainder.
- The recuperation month and entitlement from seniority.
- The confirmation questions that open an export, which are what make stage 2's export
  reachable by a user at all. **Done** — step 7, and the stage's last.

- The saved source pages and their three spoiled versions, as Part 4 requires: markup
  moved, an empty or failing response, and a figure outside the plausible range. They are
  fixtures in the test suite rather than a live fetch, so the suite neither depends on a
  site being up nor waits for one.

Roughly five tickets' worth: the dated-rates table, the wage scrape, the holiday scrape, the
heading-segmented cache, the holiday picker — `בחירת חגים`, drawn by the design pass's job 3
on 2026-09-05, after this line was written — recuperation, and the pre-export questions.

**Done when** a year with no stored holiday list fills itself, each of the three spoiled
pages produces a stated failure rather than a number, a failed fetch leaves the user able to
type the figure and continue, and **no rate the application did not derive is still a
number in the code without a date beside it**.

### Step 1 — the dated-rates table · **done**

`src/lib/datedRates.ts`, and it is the whole of the stage's first bullet: which rate, the
figure, the date it took effect, and where it came from. `rateInForce` answers with the row
in force on the month's **first day**, and `SEEDED_RATES` is what the application ships
knowing before any fetch has run.

**Three seeded rows, and every one of them citable.** The two minimum wages come out of the
committed workbooks — ₪6,247.65 from 1.4.2025 (`שכר_חודשי_להאנה2025.xlsx` → `חודש  4.25`
→ D6) and ₪6,443.85 from 1.4.2026 (`שכר_חודשי_להאנה2026.xlsx` → `חודש  4.26` → D6) — and
the third is the national-insurance percentage, 3.6% from 1.1.2025. Nothing is seeded from
memory: a figure whose date nobody can check is worse than an absent row, because an absent
row comes back as `null` and says so. **Two wage rows rather than one on purpose**, because
the rise lands in April and not in January, so `חודש  3.26` is still valued at the 2025
figure — the mistake a table keyed by calendar year makes, demonstrated by the workbook
itself.

**`NATIONAL_INSURANCE_RATE` is gone.** It was a bare constant in `engine/thirdParty.ts` whose
own docblock explained how the workbook's D21 went stale in exactly that way, and named this
step as the fix. `nationalInsuranceEstimateOf` now takes the table and the month and looks the
percentage up, so the estimate travels from a dated row rather than from a number in the code.

**Two rules the spec did not settle, asked and answered on 2026-09-09, and written into item
4 in the same step.** The stored date is the official תאריך תחולה, which is always a first
of month — a retroactive rise is expressed as an earlier first-of-month, never as a date
inside a month — so the lookup needs no second rule for a rate that changed mid-month. And a
month earlier than every row gets no figure: `rateInForce` answers `null`, and the
national-insurance estimate goes empty rather than being valued at a percentage that was not
in force then. `MonthResult.nationalInsuranceEstimate` was already `number | null` and the
month screen already renders the empty case, so nothing on screen had to change to allow it.

**The engine reads no store, so the table is handed in.** `MonthContext.rates` is the seam,
beside `today` and for the same reason; left out, the seeded table is read. The scrape that
lands next updates a table that already exists rather than introducing one, which is why this
step came first. **Persistence is deliberately not built here** — there is no consumer yet,
and `SalaryRepository` gains its two methods with the fetch that needs them.

**What the tests would catch** (`src/lib/datedRates.test.ts`, ten cases, every expected
figure from the workbook or from `specs.md`): a table read by calendar year, which pays March
2026 at the April 2026 wage; a lookup that takes the last matching row in **array order**
rather than the latest by date, which is correct until a fetch appends an older row — the
fixture is written newest-first for that reason alone; a lookup that falls back to the
earliest row instead of answering `null`; and one key's row answering for another. Two cases
in `engine/thirdParty.test.ts` cover the wiring: a 2024 month gets no estimate, and a month
handed a table saying 2% produces 2% of Part 4's ₪9,305.75 — 930,575 × 0.02 = 18,611.5
agorot, rounded once to 18,612 — which is what proves the percentage is not baked into the
engine.

**The check the user runs.** Open `/month` on the demo household and read the
אומדן ביטוח לאומי לחודש line at the foot of the balances card. It is 3.6% of the month's
ברוטו and must read exactly what it read before this step — the change is where the
percentage comes from and not what it is. A failure looks like an empty line, a line that
moved, or a month that refuses to calculate.

### Step 2 — the minimum wage scrape, its effective date, and the plausibility check · **done**

`src/lib/scrape/minimumWage.ts`, and it is the stage's second bullet: the figure, the date
it takes effect, and the check that decides whether to believe it. It writes into the table
step 1 built rather than introducing one, which is why that step came first.

**The source publishes both halves in one sentence**, which is why Part 3 named this page.
`https://www.kolzchut.org.il/he/שכר_מינימום` carries, in its summary box,
`החל מיום 01.04.2026 שכר המינימום הוא 6,443.85 ₪ לחודש למשרה מלאה ו-35.40 ₪ לשעה` — the
תאריך תחולה and the monthly figure together, which is exactly the pair criterion 4 stores.
A sentence carrying only one of the two is not a partial success: it is a failed fetch,
because a figure without its date is the undated constant the table exists to remove.

**The statement is found by its shape and not by a keyword.** Four boxes on the page share
the class, and one of them contains the words שכר המינימום as well; the statement is the one
holding *both* a date of application and a monthly figure. The monthly figure is matched by
the words that follow it — `₪ לחודש` — because the hourly rate ₪35.40 sits in the same
sentence, and reading it as the monthly wage is the realistic corruption here.

**`node-html-parser`, decided with the user on 2026-09-09.** The alternative was a scoped
regex and no dependency, which is shorter for this one sentence; the parser was chosen
because the two scrapes still owed — a holiday **table** and a page split at its own
headings — are structural, and three regexes would be three parsers nobody could correct in
one place. `CLAUDE.md`'s stack row now names it. The parse is a pure function over an HTML
string with the request injected beside it, so the suite reads saved pages and never the
network.

**The plausibility range is the table's own history, decided with the user in the same
exchange, and written into Part 3.** The baseline is the minimum-wage row already in force
on the **fetched figure's own** effective date, and the fetched figure must lie between it
and twice it. The alternative was an absolute floor and ceiling, which would have been two
invented numbers with no date beside them — the shape criterion 4 exists to remove. The
baseline is the row in force and not the latest row, because those differ the moment a
figure arrives dated to a month already past, and the latest would refuse it for having
fallen. A table with no row in force yet refuses rather than accepts; the table always ships
seeded, so that is reached only by a page that has moved backwards.

**Part 4's saved page and its three spoiled versions.**
`src/lib/scrape/fixtures/kolzchut-minimum-wage.html` is the real page, fetched 2026-09-09
and committed whole rather than trimmed — a fixture cut down to the interesting div is a
page that has already been parsed once, and it would stop catching a selector that matches
something else on a page full of other things.
`src/lib/scrape/minimum-wage-page.fixture.ts` derives the three spoiled versions from it by
transform rather than saving three more hundred-kilobyte copies: four near-identical files
would differ in one line nobody could find in a diff, and each would rot on its own the next
time the page was re-saved. **Every transform asserts that it changed something**, which is
the risk that shape carries and the answer to it — a transform that quietly matched nothing
would hand the parser an unspoiled page and the test would pass for the opposite of its
reason. The three are: the statement's class renamed, with the sentence left in the page
word for word; an empty body; and the hourly ₪35.40 put in the monthly slot, which is a real
figure off the same page and reads as corrupt to nothing but the plausibility check.

**Three failure kinds and not one**, because the user is told which happened —
`unreachable`, `notFound`, `implausible`. Their `detail` is English, for a log and a test;
the Hebrew sentence she reads is chosen from the kind in the translations file when the
screen exists.

**What the tests would catch** (`src/lib/scrape/minimumWage.test.ts`, eighteen cases; the
expected figures are the workbook's D6 cells and the hourly rate off the page, none read
back from the parser). Six wrong implementations were written and run against the suite, and
each was caught: a parser searching the whole document text instead of the statement's
element, which still finds the sentence in the markup-moved page and reports success; a
parser taking the last figure in the sentence, which is the hourly rate; a parser stamping
today's date instead of reading the page's, which today is September and the answer April; a
plausibility check judging against the latest row rather than the one in force; a merge
appending rather than replacing, which puts two rows under one date and makes `rateInForce`
answer with whichever the sort left last; and no plausibility check at all.

**One mutant deliberately not chased.** A figure regex that drops the `לחודש` requirement
and takes the first `₪` figure still answers correctly on this page, because the monthly
figure happens to come first. The suite does not catch it and no test was contorted to: what
protects against that ordering changing is the plausibility check, which is the layer built
for exactly the case where the page is read and the number is wrong.

**Two things left out on purpose.** Nothing persists the fetched row: `withFetchedRate` in
`datedRates.ts` is the writing-into-the-table half, a pure function over a value, and
`SalaryRepository` still gains its methods with the screen that has to show a fetched
figure. And the heading-segmented cache is not built here — the fetch does not need it, and
Stage 5's own bullet owns it.

**The check the user runs.** Two parts, because this step changes nothing on screen.

First, that nothing regressed: open `/month` on the demo household and read the
אומדן ביטוח לאומי לחודש line at the foot of the balances card. It must read exactly what it
read before. A failure looks like an empty line or a month that refuses to calculate.

Second, that the scrape works against the site as it is today and not only against a page
saved this morning — which is the half no fixture can prove. Run `node scripts/check-minimum-wage-page.mjs`
from the repository root.

It must print a sentence naming a first-of-month date and a monthly figure — on 2026-09-09
it printed `החל מיום 01.04.2026 שכר המינימום הוא 6,443.85 ₪ לחודש למשרה מלאה  ו-35.40 ₪ לשעה`.
`NOT FOUND` means the page's markup has moved and the saved fixture is stale; `UNREACHABLE`
means the address or the network is the problem, not the parser.

**One thing the page turned up that is not a bug and is not acted on here.** The source
page's history table writes the 2025 wage as **₪6,247.67**, while the family's workbook
(`שכר_חודשי_להאנה2025.xlsx` → `חודש  4.25` → D6) and `SEEDED_RATES` both carry **₪6,247.65**
— two agorot apart. The scrape reads only the current dated statement and never that table,
so nothing here touches it, and August 2025's four totals come from the workbook and stay
exactly as they are. It is written down so it is not rediscovered as a rounding bug.

### Step 3 — the holiday lists, per source and per year · **done**

`src/lib/holidayLists.ts` holds them and `src/lib/scrape/countryHolidays.ts` and
`src/lib/scrape/religiousHolidays.ts` fetch them. It is the stage's third bullet, built the
way step 2 was: a pure parse over an HTML string with the request injected, three named
failures, and the source pages committed whole with their spoiled versions derived by
transform.

**The step widened, and by a decision the user took inside it.** Item 10 said a candidate
list was a country's, with another country's selectable instead. Asked what the four Kol
Zchut religious-holiday pages were for, the user answered that a list may be chosen **either
by religion or by country** — so the four are a second kind of candidate list and not a
reference link, and item 10 now says so. The picker that chooses between them is still its
own ticket in this stage; what landed here is the fetching of both kinds.

**Two rules the spec did not settle, asked and answered on 2026-09-09, and written into
`specs.md` in the same step.** A list of no holidays is a failed fetch, and beyond that a
list is judged against the same source's own nearest stored year — under half or over twice
its count is disbelieved. A source with no other stored year is believed if it is not empty,
which is the one place this differs from the wage's check and is why: the dated-rates table
always ships seeded, while a new country and all four religions genuinely have no history,
and item 12 requires a year with no list to fill itself.

**A page with no rows is two different failures.** The source answers an address it does not
know with a 200 whose heading reads `חגים לאומיים - - 2026`, no country between the dashes
and no rows under it. A heading naming the country over a page with no rows is the other
thing: markup that moved. The first is `implausible`, the second `notFound`, and the whole
reason for splitting them is that only one of the two is a defect here.

**The address is the stored one with its year changed, never rebuilt from the country
code** (Part 5), and it is changed only as the address's last segment. Nepal's list is the
live demonstration and it is asserted: `NP-2026.json` is filed under `/en/` while every
other shipped file is under `/he/`, so an address assembled from the code would quietly
change the path along with the year.

**Part 4's saved pages and their spoiled versions.** Five pages committed whole —
`isavta-holidays-PH-2026.html` and the four `kolzchut-*-holidays.html` — with
`holiday-pages.fixture.ts` deriving the spoiled versions by transform, each asserting it
changed something, as the wage fixture does and for the same reasons. The country page has
five: markup moved, an empty body, the source's answer for an address it does not know, a
truncated list, and a row whose date is gone. The religious page has three.

**What the tests would catch** (55 cases across `holidayLists.test.ts`,
`countryHolidays.test.ts` and `religiousHolidays.test.ts`; every expected date read off the
saved pages or the shipped JSON files, none off a parser). Twelve wrong implementations were
written and run against the suite. Caught: a range read as its two ends, which drops the
middle days of עיד אל פיטר; a parser ignoring `(נכון ל-2026)`, which restamps 2026's Easter
as 2027's; an address whose *first* year segment is swapped rather than its last; a
plausibility check reading the latest stored year instead of the nearest; a merge appending
rather than replacing; no plausibility check at all; two religions treated as one source; a
page with no rows accepted; and a per-row year check removed, which is what lets a 2026 page
answer a request for 2027.

**Two mutants deliberately not chased**, both equivalent on the pages as they stand. Reading
a holiday's name from the whole `strong` rather than from its first text node answers the
same today, because the span the page nests inside each name is empty; the first text node
is kept because the two stop agreeing the day the source puts a badge in it. And pairing the
dates and the names off their positions rather than reading each name's own preceding
`small` answers the same on every page saved here — the structural read is kept because it
reports a row it cannot place instead of shifting a year by one, but no test distinguishes
them and none was contorted to.

**Three things left out on purpose, and none is a bug.** Nothing persists a fetched list —
`withFetchedList` is the writing-into-the-table half, a pure function over a value, and
`SalaryRepository` still gains its methods with the screen that shows one, exactly as step 2
left the wage. The picker is its own ticket, so nothing on screen chooses between a country
and a religion yet. And no seed file ships for the four religious pages: a religion's first
fetch has no history and is believed if it is not empty, which is the rule above, and
committing four scraped files to give it one would be seed data nobody asked for.

**One limitation of the source, written down so it is not rediscovered as a bug.** The
Christian and Druze pages mark their movable feasts `(נכון ל-2026)`, so asking those pages
for 2027 answers with the fixed holidays alone — eight of the Christian page's sixteen. That
is the page's own limit and not the parser's: the dates genuinely are not published yet, and
item 12's manual entry is what covers the rest until they are.

**Part 5's justification was disputed and is now corrected; its rule never changed.** Part 5
told the scraper never to rebuild an address from the country code on the grounds that
"Ukraine's list is filed under one code and published under another". That was a typo rather
than a fact: `UA-2026.json` shipped with its address pointing at `UK`, commit 38d44d0
corrected it, and the live `.../holidays/UA/2026` answers with twelve holidays under
Ukraine's own code. **Decided with the user on 2026-09-09: the reason is replaced by Nepal's
`/en/` path**, which is undisputed and is asserted by the suite — a list published under a
path no other shipped list uses, so an address assembled from the code changes the path along
with the year. The paragraph in Part 5, the same sentence in `engine/types.ts` and the same
reference in `links.ts` now say so. The rule itself is unchanged, and so is every test.

**The check the user runs.** Two parts, because this step changes nothing on screen.

First, that nothing regressed: open `/month` on the demo household and read the
אומדן ביטוח לאומי לחודש line at the foot of the balances card. It must read exactly what it
read before, and the month must still calculate.

Second, that the parsers work against the sites as they are today and not only against pages
saved this morning. Run `node scripts/check-holiday-pages.mjs` from the repository root. It
fetches all six shipped lists at their own stored addresses and all four religious pages,
and prints a count for each — on 2026-09-09 it printed fifty for India, twenty-seven for Sri
Lanka against the twenty-six shipped, eleven for Nepal, twenty-four for the Philippines,
twelve for Ukraine, eighteen for Uzbekistan, and six, four, seven and three for the Jewish,
Muslim, Christian and Druze pages. `NOT FOUND` against any line means that page's markup has
moved or its stored address has stopped answering; `UNREACHABLE` means the network or the
address, not the parser. It exits non-zero if any line failed.

**One difference the check turned up that is not a bug.** Sri Lanka's page now publishes
twenty-seven holidays where the shipped `LK-2026.json` holds twenty-six, and the
Philippines' page now writes `all saint day eve` where the shipped file has
`All Saints' Day Eve`. Both are edits at the source since the files were gathered. The
shipped files are seed data and are not rewritten here; the second is asserted by name in
the test, so a parser that lower-cased or trimmed names itself would still be caught.

### Step 4 — the heading-segmented cache · **done**

`src/lib/scrape/pageSections.ts`, and it is the stage's fourth bullet: the text of a fetched
page kept beside what was taken from it, segmented by the page's own headings rather than
stored as one blob per address.

**The unit is a heading, because that is already the unit a link points at.** `links.ts` puts
several keys on one caregiver-terms page on purpose — the wage, the weekly rest, sick pay,
recuperation, the medical insurance and the deductions are all sections of it — so a question,
a reference link and a stored section resolve to the same thing only if that thing is a
section. A `PageSection` is therefore an anchor, a heading, its level and its text, and
`sectionUrl` writes it as `page#anchor`, which is the form a link already takes.

**The corpus gained the page stage 7 actually needs, and that was a decision the user took
inside this step (2026-09-09).** The bullet reads as though it caches only pages a figure was
taken from, but nothing takes a figure from the caregiver-terms page, and a cache shipped
without it would hold none of the sections item 26 points at. So the terms page is fetched
for its text alone — `fetchArticleSections` over any Kol Zchut article — and
`kolzchut-caregiver-terms.html` is committed whole beside the five pages step 3 saved.

**The links now name their section, decided in the same exchange.** Six keys in `links.ts`
carry the heading id of the section they mean, and a user following one lands on the rule
rather than on the top of a long page. The anchors are the page's own ids, never assembled
from a Hebrew label — the same rule the addresses in that file already follow.

**The wage fetch returns both halves of its one request.** `fetchMinimumWage` now answers
`{ rate, text }`: the dated row and the segmented page. A caller that got only the figure
would fetch the same page again to get the text, which is exactly the scrape-it-twice outcome
Part 3's rule exists to prevent. The text survives a failed reading — a page whose statement
moved is still a page the help screen can answer out of — and is `null` only when no page
arrived at all.

**The holiday pages are deliberately not cached.** They are tables of dates: a heading
segments nothing in them, and the dates are already stored as a list. Caching them would put
a wall of dates into the corpus a question is matched against.

**Two spoiled versions here and not three, and the reason is written into the fixture.**
Part 4's third is a figure outside the plausible range, and this page yields no figure —
nothing is read off it that could be judged against the application's own history, because
what is taken is the text itself. Its nearest analogue, a page that arrived without its
article, is markup that moved and is already `notFound`. Inventing a plausibility rule for
prose would be a rule with no figure behind it.

**What the tests would catch** (`src/lib/scrape/pageSections.test.ts`, nineteen cases; every
expected string read off a saved page, off `links.ts` or off item 8). A segmenter that walked
the whole document, which files the accessibility toolbar's תפריט נגישות as a section of the
employment terms. One that read the article's direct children only, which loses
`מוקדים_ממשלתיים` — the one heading this page wraps in a `div` — and files its text under the
heading above it. One that ran a section to the end of the page instead of stopping at the
next heading, which puts the recuperation ladder inside sick pay and makes every question
match every section. One that folded an `h3` into the `h2` above it, which is most of what
this application pays out, since דמי מחלה, דמי הבראה and שכר מינימום are all `h3`s under
מרכיבי שכר. One that kept the table of contents, which repeats every heading and would match
a question in the lead instead of in the section that answers it. One that tidied an anchor,
which produces a fragment no link resolves to — `מי_זכאי?` keeps its question mark. And the
agreement the suite would otherwise have nobody to ask: **every `links.ts` fragment must name
a section the saved page actually has**, which is the one assertion neither file owns and the
only thing that turns a renamed heading into a failing test rather than a link that silently
opens the wrong place.

**Nothing persists it**, exactly as steps 2 and 3 left the wage and the lists.
`SalaryRepository` gains its methods with the screen that reads a cached section, which is
stage 7's.

**The check the user runs.** Three parts, because this step changes nothing on screen.

First, that nothing regressed: open `/month` on the demo household and read the
אומדן ביטוח לאומי לחודש line at the foot of the balances card. It must read exactly what it
read before, and the month must still calculate.

Second, that the links still open where they say. Anywhere the interface shows a
"באתר כל זכות" link — a refusal panel or an explanation — follow one that points at the terms
page. The browser must land on the section, with its heading at the top of the window, rather
than at the head of the article. A failure looks like a page that opens at the top: the
heading was renamed at the source.

Third, that the page still carries those headings today and not only in a copy saved this
morning. Run `node scripts/check-caregiver-terms-page.mjs` from the repository root. It prints
the number of headings on the live page and one line per linked section — on 2026-09-09 it
printed thirty-five headings and `ok` for all six. `NOT FOUND` against a line means that
heading was renamed and the link would open the top of the page; `UNREACHABLE` means the
network or the address, not the segmenter. It exits non-zero if any line failed.

### Step 5 — the holiday picker · **done**

`/settings/holidays`, `src/lib/engine/holidayYear.ts` and
`src/components/HolidayPickerScreen.tsx`, and it is the stage's fifth bullet: the
candidate list, the entitlement, part days and the remainder. It is the artboard
`בחירת חגים`, which job 3 drew on 2026-09-05 for exactly this step — so the line
in this stage's summary calling the picker "the one with no artboard at all" is
older than the canvas and is superseded here.

**It is the only place a holiday's date is decided.** On the month's calendar the
user never marks a day as a holiday (item 9), so until now the dates arrived from
the dev seed, and item 10's picker was the one thing the whole holiday half of the
application rested on and did not have. What a month records about a holiday is
still one fact and only one — whether she worked it — and a date chosen here is a
span on the worker, so it is drawn on the calendar and counted in the month's
figures the moment it is written.

**Two decisions the artboard could not settle, asked and answered on 2026-09-09.**
The screen keeps the artboard's address so `הגדרות` is the tab that lights, and
**the way in is a row on the worker's profile**: `/settings` is split between
stages 3 and 5 and the home screen's alert is stage 6's, so neither of the
artboard's own two ways in exists, and building a settings screen to hold one row
would be building two other stages' work in order to reach this one. And **nothing
is held as a draft** — each tick, each part and each move writes on its own, as the
calendar and the profile already do, so `לשמור את הבחירה` is a way back rather than
a save. The artboard's own closing sentence, `אפשר לחזור ולשנות כל עוד החודש לא יוצא`,
is what the screen now means literally.

**The chips offer the four faiths beside the countries**, which the artboard does
not draw. It was drawn on 2026-09-05 and item 10 gained the religions on
2026-09-09: the candidate list is a country's *or* a faith's, one choice with two
kinds of answer. A country is offered only where a list of some year is stored for
it — the address a year is fetched at comes from that stored list and is never
rebuilt from the code (Part 5) — while all four faiths are always offered, each
being one page the application holds. Her own country stands whether or not
anything is stored for it, or the screen would show a chosen source with no chip
selected.

**The quota bar has as many slots as the entitlement has days, not nine.** Nine is
a full year's; a worker employed from April has 6.75, and nine slots would draw her
a quota she does not have.

**One rule the spec leaves open, decided here and worth revisiting.** Item 10 says
a holiday may be taken as part of a day, and that a day beyond the entitlement is
refused, but not what the *tick* takes when less than a whole day is left. It takes
**the largest part that fits** — a whole day, or a half where only a half or three
quarters remains — because the alternative is a remainder the user can see and
cannot spend, and working out that she must first halve some other day to reach it
is the kind of knowledge this application exists to hold for her. It is one
function, `partThatFits`, if it should be the other way.

**What the picker refuses, and where each rule already lived.** A tenth day against
a nine-day entitlement is `validateMonth`'s `holidayLimit` asked at the gesture; a
date another span already covers is its `dayRecordedTwice` asked at the gesture.
Neither is a new rule and neither is a second arithmetic: the entitlement is
`holidayAllowanceFor`'s and the count is `holidayYear`'s, and the profile row that
reports "chosen, of the entitlement" reads the same function rather than counting
for itself.

**`SalaryRepository` gained the methods steps 2, 3 and 4 deferred**, because this is
the screen that reads a stored list: `listHolidayLists` and `saveHolidayList`,
household-wide and not per worker — a list is a source and a year and nothing about
one worker, while *which* list her year is drawn from is hers and sits on the
profile as `holidaySource`. That field is on the profile and not in `WorkerTerms`
for the reason the documents are: it is not a term of a month, and moving her to
another list in June does not restate May. A year the household holds no list for is
fetched when the screen is opened (item 12) and written into the store on success; a
failure is not written, so the next opening tries again, which is what the panel
promises.

**What the tests would catch** (27 cases in `holidayYear.test.ts`, six in
`holidaySources.test.ts`, four in `holidayList.test.ts`, four added to
`repository.test.ts`, and seven browser flows in `e2e/holiday-picker.spec.ts`).
Every expected figure is item 10's, the workbook's C9 of `חודש  12.24`, Part 5's own
rate formula, or a date read off the shipped `PH-2026.json` — none off the picker.
Caught: a count of spans rather than of days, which lets a five-day holiday draw one
day of the quota; a chosen date the source never published dropped from the screen
while still drawing on the quota; a choice from another calendar year counted
against this one; a row blocked while half a day is left, which leaves the last half
of an entitlement unspendable; a chosen row blocked, which makes a full year
impossible to undo; a part change judged against the whole fraction rather than
against the increase, which refuses the very gesture that makes room; a collision
check that does not exclude the span being moved, so a holiday can never be moved
onto its own date; a faith sent through the country fetch, which answers `notFound`
and sends someone looking at the parser; and — the two only a browser can see — a
date chosen here that never reaches the month's calendar, and a part day the picker
records that the sheet still pays whole.

**The half-day figure is the one to read twice.** April 2026's worked holiday is
₪426.35, which is Part 4's own figure and also what Part 5's formula gives for the
seeded wage. Taken as half a day it is ₪213.18 — that rate halved and rounded at the
end. The browser spec asserts both on the month screen, after the gesture was made
on the picker, which is rule 11's "preview and export agree" applied to the two
screens that exist.

**Five things left out on purpose, and none is a bug.** `/settings` itself still
404s. The candidate list is not fetched for the profile's own row, which reports
only what is chosen — a live scrape behind a page that shows no candidates would be
a scrape nobody asked for. The fetch on opening a year with no list is live, so the
browser suite stays on 2026 where both workers' lists ship, and the three failure
kinds are covered by unit tests over the pure functions with the request injected.
A holiday span covering several days is listed a day at a time and unchoosing any
of its days removes the whole span; the picker cannot create one, and only seed data
can. And the pre-export question about a holiday nobody has answered for (item 18)
belongs to the pre-export ticket and not to this one.

**The check the user runs.** Four parts.

First, open a worker — `/workers/worker-1` on the demo household. Under
תנאי ההעסקה there is now a חגי השנה row reading "נבחרו 3 מתוך 9" with
לבחור חגים beside it. Press it.

Second, the picker itself. The heading reads חגים לשנת 2026, the count reads 3 of 9,
the sentence beneath says not all the days are chosen, and הגדרות is the tab lit in
the bar. Tick a date — 12 ביוני is a good one — and the count moves to 4. Then open
`/month`, step back to June, and the 12th is drawn as a חג. A failure looks like a
date that ticks on the picker and never appears on the calendar.

Third, the part day. Back on the picker, press חצי יום on 3 באפריל; the count falls
to 3.50. Open `/month`, step back to April, and the עבודה בחג line reads ₪213.18
where it read ₪426.35. A failure is the line still reading ₪426.35 — a part day
recorded and paid whole.

Fourth, the refusals. Tick 2 באפריל, which the seeded spell of sickness covers: the
row must say the date is already marked rather than take it. Then tick on until nine
days are chosen — every remaining row greys, says המכסה נוצלה במלואה, and cannot be
pressed.

### Step 6 — the recuperation month, and the entitlement from seniority · **done**

`src/lib/engine/recuperation.ts`, a fourth row in `src/lib/datedRates.ts`, one line
in column G, and one row on the worker's profile. It is the stage's sixth bullet
and item 15's first half; the day rate's **confirmation** is item 18's and belongs
to the pre-export ticket, which is next.

**No artboard draws recuperation anywhere**, which was read before building rather
than discovered after. `הגדרות` lists neither the month nor the day rate among its
rows, `דף העובד` does not carry them, and `לפני הייצוא` asks six questions of which
none is this one. So the row is built in the `הגדרות` artboard's own vocabulary on
the profile — a label, its hint, the control, and the figure beneath it — which is
the departure step 9 already took and wrote down, applied once more rather than
invented here.

**Three decisions were asked and answered on 2026-09-09.** The first was put to the
user and sent back to the source: *check what the law says*. It does, and the answer
resolved what looked like a contradiction between item 15 and the family's own sheet.

- **When a year is complete.** `שכר_חודשי_להאנה2025.xlsx` → `חודש  3.25` pays five
  days and `שכר_חודשי_להאנה2026.xlsx` → `חודש  3.26` six, against `C4`'s
  "התחלת עבודה:  1.4.2024" — which reads like a payment made a day before the first
  year is out. It is not: an employment beginning 1.4.2024 has worked a full year by
  the **end of 31.3.2025**, and 1.4.2025 is the second year's first day. So item 15's
  "nothing is due until a full working year has been completed" and the workbook agree
  exactly, and **`specs.md` needed no amendment** — the disagreement was a reading of
  it. The count is taken at the recuperation month's own last day, so every
  recuperation month covers one more year than the one before it whichever month the
  family chose.
- **Above the tenth year.** The caregiver-terms page stops at "years four to ten —
  seven days" and the general `דמי_הבראה` article continues: 8 days for years 11–15,
  9 for 16–19, 10 from the twentieth. The application follows the general article,
  because stopping at seven would quietly underpay a worker of eleven years, and the
  page stopping is a fact about that page rather than about the law.
- **Where the suggested day rate comes from.** A seeded row in the dated-rates table,
  exactly as the minimum wage is: ₪451.50 from **1.7.2025**, the private sector's
  figure for the recuperation year running to 30.6.2026. The caregiver page names the
  same ₪451.50 and gives it **no date at all**, which is precisely the undated number
  that table exists to refuse, so the figure is corroborated by two pages and dated by
  one. **The private sector's rate and not the public sector's ₪511.60.** It steps in
  **July** where the minimum wage steps in April, so no single date serves both — the
  case a table keyed by calendar year gets wrong twice over. **One row only**: the
  previous ₪418 is named without a start anyone can read off the page, so a month
  before July 2025 gets `null` and says so rather than a guessed date.

**Days and money are kept in separate modules on purpose.** The ladder is a rule about
an employment and the rate is a number about a year; `recuperation.ts` holds the first
and `datedRates.ts` the second, so neither has to be corrected when the other moves.
The month prefers **its own** stored rate over the table's, which is the same argument
`ConfirmedWage` already makes for the minimum wage, and it is what lets a past month be
re-exported at its own rate.

**A recuperation month with no rate anywhere warns rather than going quiet.** It is a
warning and not a refusal, for item 21's reason — the rest of the month is still
correct and a refusal would take it all away over one line — but a line that simply
vanished would make the month look ordinary, which is the class of mistake Part 5 is
about. Every month from July 2025 on has a seeded figure, so it is a fence around a
gap rather than a case that arises.

**The line is overridable and the profile row is not editable**, which is item 15 read
as it is written: the entitlement is "offered as a suggestion the user can change
before approving", and item 17's override is how a suggestion is changed — so the row
on the profile *reports* the days and offers only the twelve months. A field for the
days would be a number the family has to know, which is what this application exists
not to ask.

**What the tests would catch** (20 cases in `recuperation.test.ts`, four browser flows
in `e2e/recuperation.spec.ts`). Every expected figure is the `דמי_הבראה` article's
ladder, the workbook's own two payments, the article's ₪451.50, or arithmetic worked by
hand — none off the engine. Caught: a ladder flattened at the tenth year, which
underpays a worker of eleven; a year counted complete on the anniversary rather than the
day before it, which pays nothing in the March the family actually pays in; a payment
that fails to step when the recuperation month is not the month the employment year ends
in; a line drawn in column H, which would look identical on screen and pay her nothing;
a line drawn every month rather than one; a stored rate ignored in favour of today's,
which would restate a past month; a missing rate swallowed silently; and — the two only
a browser can see — a month chip that writes a term no month reads, and a payment that
does not leave the month it used to be paid in.

**Four things left out on purpose, and none is a bug.** The **rate's confirmation** is
item 18's and arrives with the pre-export questions, so until then a month is valued at
the table's figure and the field on `MonthFacts` that would hold a confirmed one is
optional and unwritten. The **other three yearly items** of item 15 — the visa fee, the
licence renewal, the agency fee — are recorded as third-party payments already (item 16),
and "shown as due in the month they fall" is a reminder rather than a calculation; the
`תשלומים` artboard's two reminder sections are where they land. **Proration is not
built**: each payment covers one whole completed year, and the article's proportional
rule is for an employment that *ends* part way through a year, which the appendix defers.
And the `הגדרות` artboard is still unbuilt, so the row lives on the profile.

**The check the user runs.** Four parts.

First, the profile. Open `/workers/worker-1` on the demo household. Under
תנאי ההעסקה there is a חודש דמי ההבראה row: twelve month chips with יולי selected,
and beneath them "השנה ישולמו 6 ימים". A failure is a field asking you to type the
number of days.

Second, the money. Open `/month` and step back to יולי 2026. The preview carries a
דמי הבראה row reading ₪2,709.00, with 6 × ₪451.50 beneath it. Step to any other
month and the row is gone. A failure is the row appearing every month, or an amount
that is not 6 × 451.50.

Third, the wire. Back on the profile, press מאי. Then open `/month`, step back to
מאי 2026 — the ₪2,709.00 row is now there — and step on to יולי, where it is gone. A
failure is the chip changing on the profile while the money stays in July.

Fourth, the worker with no entitlement yet. Open `/workers/worker-2`, who began on
1.9.2025. Her recuperation row says אין עדיין זכאות rather than a figure, because her
first employment year is not out. A failure is a payment offered to a worker who has
not completed a year.

### Step 7 — the questions that open an export · **done**

`src/lib/engine/beforeExport.ts`, `/month/export`, and two methods on the
repository. It is the stage's seventh bullet and the whole of item 18, with
item 4's minimum-wage confirmation and item 15's day rate beside it — the two
figures the application cannot derive, confirmed at the one moment both are
needed. It closes stage 5.

**The address was chosen in stage 0 and not here.** The home screen has linked
to `/month/export` since the first commit, with a comment saying the
confirmation behind the link is built in stage 5. Picking a different address
now would have left that link on a 404 while the screen it names sat somewhere
else, so the artboard `לפני הייצוא` — which the routes table above assigns to
stage 2 — is built at stage 0's address by stage 5. No tab lights, which is what
the artboard draws: it is a step in an action and not a section.

**Two decisions were asked and answered on 2026-09-09, and a third came out of
the browser.**

- **What the `לייצא לאקסל` button does**, with no export built. It **confirms
  the month**: the minimum wage with its effective date, the base salary copied
  off the profile, and the recuperation day rate where one is owed, written
  together in one gesture. That is Part 5's *confirmed* state, which nothing had
  ever reached before — the moment a month's figures stop moving with the
  profile. Stage 2 puts the file behind the same button and changes nothing
  else.
- **An answer that contradicts what the month recorded is a warning, not a
  refusal.** The user is the one who knows what happened, and a month she has
  looked at and answered for is a month she may export; what item 18 buys is
  that she was *asked*. The warning names the screen where the missing fact is
  actually recorded, so it is a way forward rather than a verdict.
- **A salary that has fallen below the minimum wage is raised to it**, and the
  screen says so before she presses. This was found by running the flow: the
  demo pays the 1.4.2025 figure and every month of 2026 is valued at the
  1.4.2026 one, so the first version refused every month the household has.
  Item 3 settles it — a salary may sit above the minimum and may never sit below
  it — and the profile itself is left alone, because how far *above* the minimum
  she is paid stays the family's decision.

**Two things block and everything else warns, and each block says so in
`specs.md` itself.** Item 21: a month may be filled in ahead of time and may
only be exported once it has ended. Item 18: a month is not exported over an
unanswered open spell, because the one thing an open spell can get wrong is
counting days for a worker who was already back. Both are re-checked in the
action and not merely disabled on the button — a disabled button is a courtesy,
and the rule has to be true where a crafted request also arrives.

**The questions are answered in the browser and are never stored.** Item 18 says
exporting *begins* with them, so they are asked again before every export;
storing them would make a month "already answered" and turn the second export
into a silence. What reaches the server is only the confirmations they lead to.
That is also why the screen adds no state to `MonthRecord`: stage 3 has nothing
extra to migrate.

**The open spell is answered by the day she returned, and the spell ends the day
before.** The user is asked the event the family witnessed rather than the last
day of illness, which is how item 18 words it and how the artboard asks it. The
subtraction is in the engine, so the one place it happens carries a test.

**`SalaryRepository` gained `listRates` and `saveRate`**, which is what
`datedRates.ts` said would happen with the screen that has to show a fetched
figure. A confirmed wage enters that table dated, so a figure typed by hand
after a failed fetch is known the next time rather than typed again.

**What the tests would catch** (27 cases in `beforeExport.test.ts`, four more in
`repository.test.ts`, seven browser flows in `e2e/before-export.spec.ts`). Every
expected figure is item 18's own list, the seeded table's two minimum wages, the
recuperation ladder, or a day count read off a calendar by hand. Caught: a
question dropped from the six, which is a thing then left out by silence; a
question arriving without what the month knows, which turns a confirmation into
a memory test; a crossing spell reported to both months as its whole length,
which is the neighbouring month's days confirmed as this one's; a month exported
before it ended, or over an open spell; a spell closed on the day she returned
rather than the day before, which pays one sick day too many; a salary left
below its own confirmed minimum; a recuperation rate asked for in an ordinary
month or missing from the one that owes it; and — the two only a browser can see
— a button that enables before every question is answered, and a confirmation
that writes nothing and leaves every screen looking exactly as it did.

**Two wording defects were found by the user reading the built screen on
2026-09-09, and both are corrected.** The holidays row asked `אילו חגים נעבדו?`
— the artboard's own wording — under כן/לא chips, which is a question its own
control cannot answer; it now asks whether there were any, and *which* one she
worked stays marked on the holiday itself in the month's calendar, which is
where the row's warning sends her. And every count that named its noun read
`1 חגים`: Hebrew writes one as a word after the noun and every other number as
a numeral before a plural, so four of the six sentences were wrong for a month
that recorded exactly one of something — the commonest month there is. The
agreement table that already inflects her rest day gained the three words this
needed. Both are worth recording because neither is caught by a type, a lint or
a figure: the screen was right and read wrong.

**One thing is verified by hand and not by the suite, and it is written down
rather than left to be discovered.** Nothing in the application can *open* a
sick spell yet: `markRange` always writes an end, and the seed deliberately
carries no open spell because one would go on drawing days from the balance
month after month and start failing on a date nobody chose. So the block and the
question that closes it were checked once against a seed opened by hand on
2026-09-09 — the panel appeared, the export was refused, the return date closed
the spell and the block went — and then the seed was put back. The rules
themselves carry unit tests. A browser test lands with the gesture that opens a
spell.

**Three things left out on purpose, and none is a bug.** The **file** is stage
2's; this screen is what makes it reachable and the button is where it plugs in.
A **salary field on the profile** is not built, which is why the raise happens
here — the screen that sets a salary is stage 3's `הגדרות` work, and building it
to get past this would be building another stage. And the questions are not
carried between months: stepping the stepper starts the conversation again,
because an answer is about the month it was given for.

**The check the user runs.** Four parts.

First, the questions. Open `/month/export` on the demo household. It opens on
אוגוסט 2026 — the last month that ended, not the current one. Six questions,
each with a line under it saying what the month already holds, and
`לייצא לאקסל` greyed out with "אפשר לייצא אחרי שכל השאלות נענו" beneath it.
Answer all six and the button lights. A failure is a button that was pressable
before the questions were answered.

Second, the wage. In the same card at the top: ₪6,443.85, בתוקף מ־1 באפריל 2026,
with a link to כל זכות and a `לתקן` that opens a field. Beneath it a sentence
saying the month will be confirmed at ₪6,443.85 because the salary recorded for
her is lower. A failure is a figure with no date beside it.

Third, the month that has not ended. Step forward to ספטמבר 2026. A
`החודש עדיין לא הסתיים` panel appears and the button stays greyed out however
the questions are answered. A failure is an unfinished month that can be
exported.

Fourth, the confirmation. Step back to יולי 2026 — the recuperation month — and
a `ערך יום הבראה` field appears holding 451.50. Answer the six questions and
press `לייצא לאקסל`. The screen says the month was confirmed. Then open `/month`,
step back to יולי, and the דמי הבראה row still reads ₪2,709.00. A failure is a
press that says nothing happened, or a July that lost its recuperation line.

## Stage 6 — The opening screen

Same stack. The screen was built in stage 0 against fixtures; this stage replaces the
fixtures with what the earlier stages produce and adds nothing to the layout.

- **`/alerts` is this stage's address.** The bell links `התראות` from every screen and it
  404s. The action list below is its content at full length: the home screen shows the list
  and the bell is what lights (item 27), so the two are one thing built once, not a bullet
  here and a table row elsewhere.
- The action list: quarterly national insurance, expiring licence or medical insurance,
  an advance still being repaid, holidays not all chosen, recuperation due, a year with
  no vacation taken, a finished month not exported, a wage that changed, a worker
  crossing into a new seniority year.
- The current month's calendar, its totals and the balances beside that list (item 27).
- The national-insurance tick, with the months it covers.

**Done when** an account with nothing outstanding shows an opening screen whose action
list is empty.

## Stage 7 — The help screen, and a possible assistant on top of it

Where the "צריך/ה עזרה?" card goes. The design draws that card on every artboard and
points it nowhere.

**Part one — the help screen.** It holds no explanation of its own (item 24). It points
at the explanation, the reference link, or the screen that settles the question, so an
answer stays written in exactly one place.

- A registry of screens: each route, its Hebrew name, and what it is for. The sidebar
  reads the same list rather than keeping its own.
- Question matching written by hand, over the explanations, the reference list and the
  page text cached in stage 5.
- The panel: a question, an answer, and the link or screen it points at.

**Part two — a model. A potential feature, not a decision taken.** Only worth it if the
hand-written matching turns out too rigid once part one has been used. It would read the
question and the candidate list and never the account; the answer would still be
assembled locally, so no worker, amount or identity number leaves the application and the
choice of model stays cheap to change or to reverse. Two conditions come with it if it is
ever built: the prompts are source files, reviewed and versioned like any other code,
because the behaviour lives in their wording and an unreviewed edit to a sentence is a
real fault with no diff anyone reads; and a hard ceiling on calls per question, so a loop
that goes wrong costs a known amount rather than whatever it manages to spend before
someone notices. **Whether to build it at all, and
which model, is a question to put to the user at the very end — not before.**

**Done when** a question reaches the right screen or the right explanation and the answer
names its source, and part two can be dropped entirely without part one changing.

## Design ↔ spec reconciliation

Where the canvas and `specs.md` disagreed, found while building stage 0. Every item is now
**settled**: each was a decision only the user could take, each was taken, and each went
into `specs.md` before becoming code. The table is kept rather than deleted so that a
contradiction already resolved is not rediscovered and re-argued — and so that the six
marked *drop* are known to be deliberate absences rather than things nobody got to.

**In the canvas, not in the spec — all eleven now settled**, and each resolution is written
where it belongs rather than here. The canvas is what changes for the six marked *drop*.

| Drawn on the canvas | Verdict | Where it now stands |
|---|---|---|
| Accrued-severance card on `דף העובד` | drop | `specs.md` future-features appendix — it arrives with end of employment or not at all |
| PDF export on `דף המשכורת` | drop | The spec exports `.xlsx` only |
| Payment date, payment method, "mark as paid" | drop | Bookkeeping about the family's bank, unverifiable, and it drives nothing |
| Notification toggles in `הגדרות` | drop | Item 27 — nothing leaves the application, so there is nothing to toggle |
| Separate `התראות` page | drop | Item 27 — one screen, two lists |
| The bell | **keep** | Item 27 — the bell is what is *about to* lapse; the screen's own list is what has lapsed or blocks a calculation |
| "להוריד את כל הנתונים" | **keep, reshaped** | Item 29 — one worker, one year, no identity numbers; not every year at once |
| Editable "ימי חופשה בשנה" / "ימי מחלה בשנה" | drop | Item 7 — derived and not editable: an editable entitlement is a figure the user must know, and under carried-forward balances it raises "which past months does the edit reach into", which has no answer a user could hold. An agreed extra is recorded as an additional payment (item 20) |
| Configurable weekly rest day | **keep** | Item 5 — Friday, Saturday or Sunday as the law allows ("לפי המקובל על העובד"), defaulting to Saturday. The largest of the eleven: it reopens Stage 1, renames the Friday supplement, moves the sick week, and turns nine template labels into placeholders |
| "היתר העסקה" number | **keep, and it was under-drawn** | Item 28 — three documents, three expiry dates, not one |
| "לסיים העסקה" | drop | The appendix keeps ending an employment out of v1 |

**In the spec, missing from the canvas — four of the ten closed on 2026-09-05.** Job 2b
drew them onto `דף המשכורת` and they are struck from the list rather than left standing:
the **two day counts** (items 2 and 5, a Wage Protection Act requirement) now read
`ימי עבודה (בפועל / תקני)` there as well as on `חישוב החודש`'s confirm step, which is what
the Act actually governs; the **third-party payments group** (items 5 and 16) has its own
section outside the worker's total with a column subtotal of its own; an **override shown
as manual** (item 17) carries the `ידני` badge beside the figure it replaced; and
`אחרי החודש הזה` now shows the days used beside each balance, which criterion 2 asks for.

**A fifth is struck for a different reason: a sick spell crossing a month boundary
(item 8) needs no drawing at all.** Stage 4 settled on 2026-09-03 that a spell has no
gesture of its own — the days on either side of the boundary touch and the engine joins
them — so there is no screen to draw and this was a gap in the list rather than in the
canvas.

**Job 3 drew five of the six remaining on 2026-09-05, and the sixth on 2026-09-08.**
Closed: the **holiday picker** and the **minimum-wage confirmation** and the
**pre-export questions** each got an artboard of their own (`בחירת חגים`,
`לפני הייצוא`); a **future month filled but not exportable** is `חישוב החודש`'s
`כדאי לדעת` card; and **part-days** are drawn for holidays, in the picker where a holiday
is chosen.

**The sixth closed on 2026-09-08, and the list is empty.** A **part-day for vacation**
(item 7) and a **note on a calendar mark** (item 5) were one surface rather than two, and
the sweep picker in both `חישוב החודש` and `דף הבית v3` now carries them on a second row.
Everywhere else a note was already offered: an override panel has one, and a line the user
adds is its own words by definition.
