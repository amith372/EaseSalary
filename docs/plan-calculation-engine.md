# EaseSalary — Stage 1: the calculation engine

## Context

Stage 0 is done and pushed. What exists: `src/lib/dates.ts` (UTC month arithmetic),
`src/lib/spans.ts` (which days inside a swept range take a mark, and how many days a span
draws from its balance), `src/lib/money.ts` (integer agorot in, formatted string out),
`src/lib/types.ts` (the engine's **output** shape, written before the engine so the home
screen could be built against it), the design tokens and shell, and `src/app/page.tsx`
rendering from `src/lib/fixtures/home.ts` where every amount is `null`.

What does not exist: any calculation at all. `MonthResult.totalToWorker` has never held a
number.

This pass writes the engine. Plain TypeScript, no framework, no I/O, no clock. It ends
with the August 2025 case matching to the agora and the invalid case refused, with no
database and no screen in existence — which is build_plan's ordering principle: reach a
correct number as early as possible, because if the engine is wrong everything built on
top of it inherits the error.

**Already decided, not re-opened here** (build_plan Stage 1): a month's facts are
`{ kind, from, to, note }` spans and not per-day marks; the engine returns an explanation
per line under a stable key from the first commit rather than retrofitted; the repository
is a thin interface with no Supabase in its signature. `src/lib/spans.ts` already holds
and tests the entitlement rules for a swept range — the engine **consumes** it and does
not restate them.

**Step 0 is not Stage 1.** It rebuilds the home screen against `דף הבית v3`, the canonical
artboard, and it goes first because it is independent of the engine and gives something to
look at before any of the rest lands. It is Stage 0 rework and is committed as such.

---

## Verifying and pushing

Per CLAUDE.md rule 7 every step ends with a **You verify** block: what to run, what you
should see, and what a failure looks like. The agent stops there and waits. It commits
nothing until you say the check passed, and pushes nothing until you say so separately.

Three steps are **push points**. The steps between them are commits only.

Before any commit, `hooks/pre-commit` runs these and refuses the commit if any fails —
the agent runs them first and pastes the output, so a refusal is never a surprise:

```
npx next typegen && npx tsc --noEmit     # typegen first, or LayoutProps is undefined
npm run lint
npm test
git status --short                       # empty: nothing stray, nothing forgotten
```

Never `--no-verify`. Failure output goes in the report as-is.

### What a "You verify" block can and cannot prove here

Stage 1 builds no screen, so most checks are `npm test` — and a suite the agent wrote,
passing against an engine the same agent wrote, proves only that the engine agrees with
itself. Two things guard against that, and both are load-bearing:

- **Every expected figure is sourced.** Each assertion below names where its number comes
  from: `specs.md` Part 4, a formula in Part 5, a rule in Part 2, or arithmetic between
  two spec figures shown in the open. A figure with no such source is a **question for
  you**, not a number the agent settles from what its own code returned. Nine such figures
  came up while writing this plan; all nine were asked and answered, and the table at the
  end of this file says which criterion each one now lives in. A tenth arriving mid-step is
  asked the same way rather than decided.
- **Step 3 writes a readable document you check by eye.** `npm test` renders the whole
  August 2025 month — every line, its units, its column, its amount, and the Hebrew
  sentence explaining it — to `src/lib/engine/august-2025.snap.md`, a file you open and
  read against the family's own sheet. That file is a **snapshot for reading**, never an
  assertion: the four totals are asserted separately and explicitly against Part 4's
  figures, so `vitest -u` can never quietly bless a wrong number.

---

## Step 0 — The home screen, rebuilt against `דף הבית v3`

Stage 0 rework, not engine work, and `git log` will show it as such.

**`EaseSalary - דף הבית v3 לוח במרכז` is canonical and this step does not modify it.** The code
moves to the artboard; the artboard does not move to the code. `דף הבית v2` and `v2 layout A` stay
on the canvas as superseded alternatives — kept on purpose, so the two layouts that were weighed
against each other can still be looked at rather than described.

v3 changes more than a layout, so this is a larger step than the three fixes it replaces.

**(a) The shell becomes a top bar, and not only on this screen.** `AppShell` today is a 232px
`bark` sidebar plus a header below it. v3 replaces both with a single 62px white bar: the wordmark,
the five nav items as pill tabs, then a circular `?`, the alerts pill, and the user's name beside
an avatar. **The green sidebar leaves the application, not just the home screen** — confirmed, so
`AppShell` is rebuilt rather than forked, and every route gets the bar.

Three consequences worth having written down before the edit rather than discovered during it:

- The "צריך/ה עזרה?" card is gone, so **(a) as it was originally written — pin the help card —
  no longer exists as a problem.** Help is a `?` in the bar, which is always in view by
  construction. `he.nav.help.title` survives as its `aria-label`; `he.nav.help.body` loses its home.
- **The surface tokens invert.** Today the page is white and cards are `#FFFDFA`. v3 makes the page
  `#FBF8F4` and the cards plain `#FFFFFF`. That is a token change, not a per-component one, and
  doing it as the latter is how a screen ends up half-converted.
- **The other ten artboards still draw the sidebar.** They now disagree with the shell, and each
  will be rebuilt when its own stage arrives. Nothing is done to them here; the disagreement is
  noted so a later session does not read one of them as current and put the sidebar back.

**(b) The range is drawn first and named afterwards — v3 already says how.** This paragraph was
written from the artboard's *resting* state and got the interaction wrong; the artboard's own script
settles it. v3 marks a range by clicking a day and then a second day, at which point a picker panel
opens between the grid and the legend carrying the four kinds, "לנקות סימון" and "ביטול". The card's
hint says exactly that: `לחיצה על יום, ואז על יום נוסף, מסמנת טווח`. The five-chip legend at the
foot has no handlers on it and never gains a selected state — it says what the colours mean.

So the kind is chosen **after** the days rather than before them, and that is the better half of the
trade as well as the drawn one: there is no mode to be in, and no way to draw a mark the user did
not mean to draw (specs.md Part 1 — choose the option that requires the user to know less). At rest
the screen still looks exactly as v3 draws it, because with no range open there is no picker.

Clearing goes through the same panel: a range with "לנקות סימון" removes every span it touches,
whole. A span is one thing — clearing part of a sick spell would change what it pays (item 8) — so a
range that clips a span clears all of it rather than punching a hole. One day is cleared by clicking
it twice and choosing "לנקות סימון".

`MarkToolPicker` from Stage 0 is deleted rather than left unrouted: its job moves into the picker
panel, and a component that no longer renders is a component someone re-wires by mistake later. So
is `StatusPill`, whose only render site was the v2 hero: v3's "צריך לטפל" is plain text beside a
sprout, and a later artboard that wants a pill brings its own values.

**(c) The `?` on the alerts.** v3 already draws it, so this is now just the code catching up.
`HomeAlert.link?: LegalLinkKey` becomes `HomeAlert.explanation: Explanation`, which already carries
the sentence and the optional link together, and the row renders the circular `?` the way a money
line does. `he.home.alerts.whatTheLawSays` is **kept**, as v3's own `aria-label` for that `?` — it is
not orphaned, it stops being a visible link and becomes what the button means to a screen reader.
This is item 24 reaching the alerts: the explanation stays beside the thing it explains, in one
idiom, and the link to the law moves inside the panel beside the sentence.

**(d) One desktop screen, no scrolling.** v3's own container is `overflow: auto` at a 1440×1000
preview, but that is headroom rather than a requirement — measured at 1440×900 its content comes to
roughly 620px against 796px of available body height. So the fit is already there; the code locks
the page to the viewport and lets the calendar take the surplus, which its `flex: 1 1 auto`
already does. Below `md` it falls back to a stacked scroll, since a phone has no screen to fit.

**(f) The greeting row is gone, and this is the one deliberate departure from v3.** The artboard
draws "בוקר טוב, [השם שלך] / החודש של [שם העובד/ת]" and the worker switcher as a row of their own
above the calendar. That row costs about seventy pixels, which was the difference between the screen
fitting and the screen scrolling — your call, made against the built screen. Both move into the top
bar: the greeting joins the name beside the avatar, and the switcher becomes two arrows around the
name, with v3's "מוצג/ת כרגע" caption becoming the group's label, since a 62px bar has room for one
line. The subtitle is dropped outright rather than rehoused, because the switcher already names the
worker and the line would print that name twice on one screen.

Which worker is being shown therefore stops being the home screen's state and becomes the shell's:
`src/components/WorkerScope.tsx` is a small client context that `AppShell` provides and any screen
reads. That is where it belonged in any case — the calendar, the totals and the balances beside them
are all one worker's — and Stage 3 changes only where the list of workers comes from. With the
greeting row gone the page has no heading, so "אוגוסט 2026 מוכן לחישוב" becomes its `h1`.

**(g) The balances moved under the calendar, and the screen is measured rather than estimated.**
(d)'s claim that the fit "is already there" was an estimate, and it was wrong: measured in a headless
Chrome at 1440×900, the alerts strip was already clipped, and a real browser's viewport is some
100px shorter than its window. The right column was the driver — as three stacked cards it had to be
as tall as all three, and the calendar merely stretched to match it.

So the vertical rhythm was trimmed throughout (page padding, card padding, the gaps inside a card),
worth about sixty pixels, and the "יתרות" card was dissolved: its two rows now sit in a strip under
the calendar, beside the legend, with "יתרות" as a quiet label at the start. That is where they
belong on reflection — a balance is a count of the days marked directly above it — and it takes
about 130px out of the column that was setting the height.

Measured after both: the whole screen fits a **1440×700** viewport with nothing clipped and no
scrollbar, and starts to clip below about 660. Every screenshot was taken against the running dev
server, which is the only way this particular claim can be made honestly.

**(e) Colour, and the calendar cell.** v3 fills a marked day solid with dark ink and no dot, which
is a return to the artboard's original treatment at a softer set of hues. Taken as drawn.

| Kind | Cell fill (v3) | Identity token |
|---|---|---|
| חופשה | `#F7D08A` | `#D9A441` |
| מחלה | `#C6CFE8` | `#8394C4` |
| חג | `#EFC0C2` | — |
| שבת חופשית | `#DCD3C4` | — |
| יום עבודה | `#F7F3ED` | — |

The identity token is the saturated value the balance pill's dot uses; `#D9A441` for vacation is
your answer, so the day fill and the balance dot are deliberately two values and not a mistake to
be reconciled. Only the two balance kinds need one.

**An unmarked Saturday is drawn exactly like an unmarked weekday** — confirmed, and the two answers
that produced it agree rather than merely coexist. If "יום עבודה" names *a day she worked* rather
than *a day with no mark*, an unmarked Saturday belongs to it too: she worked it, and it is paid at
the rest-day rate instead of being folded into the base. The column header carries which day it is.
So `he.calendar.marks.restDay` has nothing left to label and is deleted.

**Strings.** Reworded to the artboard's own wording, which is canonical for the screen it draws:
`marks.vacation` "יום חופש" → "חופשה" and `marks.sick` "יום מחלה" → "מחלה", both of which v3 writes
short because the label is also printed inside the day cell; and `calendar.hint`, which now says how
a range is drawn. Deleted: `he.calendar.marks.restDay`, `he.nav.help.body`, `he.header.greeting` and
`he.header.today` — the top bar carries neither a greeting nor the date. Added: `יום עבודה` for the
legend, the four `calendar.picker` strings, `selection.oneDay` and `selection.inMonth`, and one
explanation sentence per alert. Everything else in `he.ts` is untouched.

**The worked-holiday question is settled, and deliberately does not land in this step.** Item 9 now
says how it is asked: the year's holidays are chosen in advance (item 10), so their dates arrive on
the calendar already drawn, and the month records only whether she worked one — an outline for a
holiday not worked, a filled cell for one worked, so the state that costs money is the louder.
`HolidaySpan.worked` already exists in `src/lib/types.ts`, so nothing in the engine changes.

But **v3 draws no outline state and its legend has five chips, not six**, and v3 is not modified by
this step. So Step 0 renders the artboard as drawn — the fixture's holiday is one she worked, which
is the solid fill v3 already has — and the outline, the sixth legend chip and the toggle arrive
with the month screen in Stage 4, along with the yearly picker that supplies the dates. Building
half of it here would mean departing from the canonical artboard to draw a state no fixture needs.

### You verify — Step 0 · **push point 1**

```
npm run dev
```

**The shell**
- The greeting and the worker switcher are in the top bar, and the home screen opens straight onto
  the calendar with no heading row above it. Stepping the switcher changes the worker the whole
  screen is about, not the calendar alone.
- The green sidebar is **gone from every route**, replaced by the white top bar. Visit `/workers`
  or `/reports`: the bar is there too. A sidebar surviving on any route means `AppShell` was forked
  instead of rebuilt.
- The page ground is the warm off-white and the cards are pure white — not the other way round. If
  the cards look tinted against a white page, the tokens were changed per-component.

**One screen**
- At 1440×900, maximised, 100% zoom: **the page does not scroll**, and the calendar, the month's
  total, the balance pills under the calendar and all three alerts are visible at once. The
  browser's own scrollbar is absent. Measured to fit a viewport as short as 700px; below roughly
  660 it clips, which is a window smaller than any laptop this is meant to run on.

**Marking**
- The legend is not clickable and shows no selected state. Clicking a legend chip must do nothing:
  it labels the colours, and marking is the picker's job.
- Click the 16th, then the 20th: the picker opens under the grid reading "16–20 באוגוסט · 5 ימים".
  Choose "חופשה" and those five days take the vacation fill in one go.
- Do the same **in the opposite order** — click the 20th, then the 16th: the identical span, and the
  panel still reads "16–20 באוגוסט". Anything else is the RTL inversion trap, where the range was
  keyed off screen position rather than dates.
- A **vacation** range across a Saturday leaves that Saturday unmarked; a **sick** range keeps it.
  This asymmetry is items 5 and 8 and is already tested in `src/lib/spans.ts`. The Saturday that was
  skipped is named under the calendar with the reason, rather than being dropped in silence.
- Click a marked day twice and choose "לנקות סימון": the **whole** span clears, not one day.
- "ביטול", and the Escape key, drop the range with nothing marked.

**The `?`**
- Every alert row ends with the same `?` the amounts use, and **no row shows a "מה אומר החוק"
  link**. Clicking one opens a panel below that row with the sentence and the Kol Zchut link.

**Chrome translate** — the failure this application is most likely to ship with
- Right-click → *Translate to English*, console open. Every string translates; the console shows
  **no** `NotFoundError: Failed to execute 'removeChild'`; toggling back to Hebrew leaves the
  layout intact. Re-checked here because (a) and (b) move a great many dynamic strings.

Push once this passes. It is a screen you can judge, and it is finished on its own.

---

## Step 1 — The month's facts, and the rates derived from the wage

Two files, because the input shape and the rate arithmetic are what everything after this reads.

**`src/lib/engine/types.ts`** — the engine's **inputs**. `src/lib/types.ts` keeps the output
shape it already has; it is what the screen reads and it does not move.

| Type | Holds | Why here |
|---|---|---|
| `WorkerTerms` | `employedSince`, `baseMonthlySalaryAgorot`, `fridaySupplementAgorot`, `fridayIsPocketMoney`, `recuperationMonth`, `country`, `openingPosition` | Item 14 sets the supplement per worker; item 6 gives the opening balances once; item 3 puts the salary **on the profile** — "the salary on the profile sits below it" — so it is a standing term and not a monthly fact |
| `OpeningPosition` | `vacationDays`, `sickDays`, advances already part-repaid | Item 6 — neither figure originates inside the application |
| `MonthFacts` | `month`, `confirmedWage`, `spans`, `advances`, `thirdPartyPayments`, `extraPayments`, `incomeTaxAgorot`, `overrides` | One month, and everything that changes it |
| `ConfirmedWage` | `baseAgorot`, `minimumAgorot`, `effectiveFrom` | Part 3 stores the wage confirmed **for that month** with the rates derived from it, so re-exporting a past month years later reproduces that month rather than recalculating it at today's rates |

**`ConfirmedWage` carries two figures and not one, because item 3 describes two.** This row
was written as a single `agorot` and that turned out to be a compression of Part 3's own
sentence, which names "the minimum wage confirmed for it" while item 3 derives the rates
from "the worker's base monthly salary", a profile figure that *defaults* to the minimum
wage and may sit above it but never below. One field cannot be both: the rates would follow
the minimum wage rather than the salary the moment a family paid above it. So the month
stores `baseAgorot` — what the rates derive from, copied off the profile when the month was
confirmed, which is what keeps a past month reproducible after the profile has moved on —
beside `minimumAgorot` and its `effectiveFrom`, which are what item 4's confirmation and item
3's "may not be set below it" check against. For August 2025 the two are equal, which is
exactly why a single field would have passed Step 3 and failed silently on the first month a
worker was paid more than the minimum.
| `Advance` | `number`, `kind: "granted" \| "repaid"`, `agorot`, `note` | Item 20 — numbered, several at once, the repaid amount entered per month rather than fixed by a schedule |

Spans arriving in `MonthFacts.spans` may **start before the month and end inside it, or start
inside it and end after it** — a sick spell is stored as the dates it ran between (Part 3,
item 8), and the engine reads it whole and clips it to the month itself.

`spans` is typed as a `MonthSpan` union rather than as `DaySpan[]`, so a holiday span that does
not say whether she worked it is a **compile** error. Part 5 requires that "holiday" is never
recorded without saying, and item 9 explains what the alternative costs: a holiday nobody has
answered for, read as one she did not work, is a silent default that quietly underpays her.
The pre-export questions (item 18) catch it at the interface; this catches it a layer lower,
where a repository in Stage 3 is the other caller.

**`src/lib/engine/rates.ts`** — `deriveRates(baseMonthlySalaryAgorot)`:

| Rate | Formula | Source |
|---|---|---|
| daily | `S / 25` | Item 8 — "a sick day is worth the monthly salary over twenty-five" |
| hourly | `S / 182` | Part 5 — "the same salary divided by 182" |
| rest day / holiday | `(S / 25 + S / 182) × 1.5` | Part 5 — one day **plus one hour** at 150%, because a live-in caregiver's rest day is twenty-five hours and not twenty-four. A plain 150% of the daily rate is short by roughly fifty shekels a day |

There is **no vacation-day rate**, because there is no vacation payment — your answer, now
item 3 and item 7. The `25` divisor exists for the sick-day value alone. `deriveRates` returns
two rates and not three, and a third appearing later is a bug rather than a feature: the
appendix records that a balance settled at the end of an employment uses the same divisor, so
even the future case adds no new rate. The hourly figure in the table above is **not** one of
the two: nothing in this application is paid by the hour, and it exists only as the named half
of the rest-day formula, so it is an exported function beside `deriveRates` rather than a field
on `Rates` — which is also what lets the test assert it against Part 5's own quotient.

**The precision rule, written down because it is where a systematic error hides.** CLAUDE.md
holds money as integer agorot; item 3 requires full precision carried through and rounding only
at the end. Those two meet like this: a **rate** is a `number` of agorot that may carry a fraction
and is never rounded; a **line amount** is integer agorot, rounded exactly once, with
`Math.round`, at the moment it becomes a `MonthLine.amount`. Nothing rounds between those two
points. The rest-day rate for ₪6,247.65 is 42,635.0620879… agorot and stays that way through six
days; only 255,810.372… is rounded, to 255,810.

**Tests, and where each figure comes from:**

- `deriveRates(624765).restDay` rounds to `42635` — Part 4 names ₪426.35 for that salary.
- The daily and hourly rates are asserted as the exact quotients above, since Part 5 supplies
  the formula and not a figure.
- A rate is asserted **not** to be an integer, so a `Math.round` slipped into `rates.ts` later
  fails here rather than drifting a few agorot a year somewhere further down.

### You verify — Step 1 · commit only

```
npx vitest run src/lib/engine/rates.test.ts --reporter=verbose
```

- The rest-day test passes, and its name reads *"the rest day rate for a ₪6,247.65 salary is
  ₪426.35 (specs.md Part 4)"*. **The name citing Part 4 is the point**: a passing test whose name
  cites nothing is a test whose figure came out of the code.
- The "a rate is not rounded" test passes. If it fails, a `Math.round` is sitting inside
  `rates.ts` where it must not be.

Nothing renders and nothing here is judgeable as a screen, so this is a commit, not a push.

---

## Step 2 — The month's counts

`src/lib/engine/counts.ts`, over `MonthFacts` and the calendar in `dates.ts`.

| Count | Rule | Source |
|---|---|---|
| standard days | days in the month less its Saturdays; **nothing the worker takes reduces it** | Item 5 |
| actual days | the standard count less the days she did not in fact work | Item 5 |
| Fridays | the month's Fridays, from the calendar | Item 5 — counted, never typed |
| Fridays worked | the Fridays she actually worked | Item 5 |
| Fridays paid the supplement | the Fridays less those lost, per item 14's pocket-money flag and item 8's sickness rule | Items 8, 14 |
| Saturdays | the month's Saturdays, from the calendar | Item 5 |
| Saturdays worked | the Saturdays she worked — less the free one, less any inside a spell of sickness | Items 5, 8 |

**Two rows above were corrected while writing the file, both because the original
conflated two things.**

*Fridays worked is not the count that earns the supplement.* Where the supplement is
pocket money, a Friday she did not work is paid it all the same (item 14) — so under that
setting the two counts differ by every Friday she took off, and a single field would have
to mean "worked" on one profile and "paid" on another. `MonthCounts` carries both:
`fridaysWorked` is the day count the payslip reports, `fridaysPaidSupplement` is what
Step 3 multiplies by the supplement. August 2025 has all five Fridays worked, so the two
agree there and the split is invisible in the known case — which is the reason to write it
down here rather than discover it on the first profile that sets the flag.

*Saturdays worked is not simply "less the free one".* Item 8 says the Saturdays inside a
spell of sickness count toward the spell and are drawn from the balance **but are not
paid**, so a Saturday spent sick must not reach the rest-day rate; a holiday on a Saturday
she did not work is the same case. All three fall out of asking "did she work this day"
once, which is also what item 5 asks for when it says the counts must be written so that
one more mark kind is enough later.

**There is no mark for an absence with no entitlement**, and item 5 now says so — it is out of
scope for this version along with the rest of the appendix's partial-month cases. But the counts
are computed so that adding one mark kind later is enough: such a day would leave both counts and
with them the base, the Friday supplement if it fell on a Friday, and the Saturday pay if on a
Saturday. Writing `actualDays` as "standard less the days not worked" rather than as "standard less
vacation less sickness" is what buys that, and it costs nothing today.

The counts are derived from `dates.ts` and the spans, never from a number the user typed.
Part 5's warning is the reason: a 31-day month beginning on a Saturday holds five Saturdays and
26 working days, the same length beginning on a Sunday holds four and 27, and **both still pay a
whole salary** — so the mistake stays invisible until a month with an absence in it.

**Tests, sourced from Part 4's August 2025:** 31 days · 5 Saturdays · **26** standard days ·
5 Fridays, all worked · 4 Saturdays worked after the free one on the 16th. Part 4 states the 31
days, the 26 working days, the five Fridays and the four Saturdays outright, so every figure here
is quoted rather than computed. A second case takes a month whose 1st is a Sunday, to catch the
off-by-one Part 5 describes.

The free Saturday on the 16th changes **neither** count — Saturdays sit outside the standard count
already — and that is asserted, because it is the mistake that would silently shrink the base.

### You verify — Step 2 · commit only

```
npx vitest run src/lib/engine/counts.test.ts --reporter=verbose
```

- August 2025 gives **26** standard days. Anything else and the base salary is wrong before a
  single rate is applied to it.
- The test asserting the free Saturday leaves both counts alone passes.
- The Sunday-start month gives a different Saturday count from the Saturday-start month of the
  same length. Two months of the same length agreeing is the off-by-one.

---

## Step 3 — The lines, the closing block, the totals, and August 2025

The step the stage exists for.

**Part 4's four figures map exactly onto the sheet's structure**, which is what tells the engine
what its outputs have to be:

| Part 4 figure | What it is | Column |
|---|---|---|
| ₪6,747.65 | base ₪6,247.65 + Friday supplement ₪500 | **E** — the monthly salary items |
| ₪2,558.10 | 2 holidays + 4 Saturdays × ₪426.35 | **F** — the pay for Saturdays and holidays |
| ₪9,305.75 | E + F + G | the month's total to the worker |
| ₪7,305.75 | less the ₪2,000 instalment | after the closing block |

The Friday supplement sits in **E** and not F: Part 4 groups it with the base, and Part 5 gives F
as "the pay for Saturdays and holidays". Column **H** is built here too and is excluded from the
total — reading it as salary would overpay the worker (item 16, Part 5).

**`src/lib/types.ts` needs two corrections**, both made in this step:

- `totalToWorker` is ambiguous between ₪9,305.75 and ₪7,305.75, and the home screen already reads
  it as the second. It becomes **`gross`** (E + F + G, which is "the month's total" of Part 5) and
  **`net`** (after the closing block, what is actually paid). `page.tsx` and `fixtures/home.ts`
  follow in the same commit.
- A **`closing`** block, separate from `lines`. Part 5 is explicit that the bottom of the sheet is
  not a fixed layout: a month that grants an advance carries a row adding it, a month that repays
  one carries a row subtracting the instalment, and a month may carry several of both. It grows
  with the advances, so it is generated — not a column line, and not one of a fixed set of shapes.

**Explanation keys.** Every line carries `key`, and the keys are stable from this commit so
another screen can address one figure without re-deriving it (item 24, and build_plan improvement
note 1): `base`, `fridaySupplement`, `restDays`, `holidaysWorked`, `sickDeduction`, `incomeTax`,
`extra.<id>`, `thirdParty.<kind>`, `advance.<number>.granted`, `advance.<number>.repaid`. An
override (item 17) sets `manual: true` and replaces the amount without touching the key, so a
manual figure is still addressable and still says what it would otherwise have been.

**Three corrections you made after reading the first draft of the snapshot**, all of which
changed the shape of `MonthResult` rather than a figure:

- **The sheet prints four total lines, not two.** Criterion 1 checks four figures, and the
  first draft exposed only `gross` and `net` — the two column subtotals existed nowhere but
  in a test helper. `MonthResult.subtotals` now carries one per column the month has lines
  in, so August 2025 prints ₪6,747.65 and ₪2,558.10 beside the other two, and an empty
  column prints nothing rather than a zero.
- **A line's units are its own, and `units × rate` must give its amount.** The base was
  drafted at 26 units, which read as 26 days at a monthly price. It is one month at the
  monthly rate. The standard and actual counts are separate reporting figures and are never
  a line's units. `MonthLine.rate` is the unit price — column D, which Part 5 already names
  — carried at full precision, and the invariant is asserted over every line.
- **The reporting block belongs to this step, not to Step 4.** Criterion 2 requires the
  payslip to carry the days used, the balances left, and both day counts; build_plan puts
  the balances in stage 1. So `src/lib/engine/balances.ts` arrives here — accrual by
  seniority as a fraction, the 1.5-a-month sick accrual with its ninety-day ceiling,
  carry-forward through `MonthContext.openingBalances`, and days used clipped to the month
  through `balanceDaysOf`. The national-insurance estimate comes with it, at 3.6% of the
  gross. **Step 4 is now the refusals and the warnings** — the sick balance as a floor that
  never goes negative, and the seven-day vacation warning — plus the multi-month
  carry-forward tests, and its "You verify" block still holds.

**Three placements the step had to settle, none of which the table above fixed.**

*The income-tax row is in the closing block, not column E.* The gross is what she earned;
tax is withheld from it on the way to what is actually transferred, exactly as the advance
instalment is — so putting it in E would make ₪9,305.75 mean "earned" on a month with no
tax and "earned less tax" on one with it. The plan's own key list already mixes column
lines with closing rows (`advance.<number>.granted` is a closing row), so `incomeTax`
sitting there breaks nothing. It is always emitted, at zero when nothing was entered,
because item 17 speaks of *the* income-tax line rather than a line that may be absent.
August 2025 has no tax, so the ₪7,305.75 is unaffected either way — which is why it needed
deciding on the argument rather than on the case.

*`sickDeduction` is reserved and not emitted here.* Step 5 owns the statutory tiers, and a
key placed in this list now is what makes it stable from this commit — the list fixes the
key set, not which step writes each line. August 2025 has no sickness, so nothing is
missing from the known case.

*The refusals live in `src/lib/engine/validate.ts`, not inside the engine.* The interface
wants to show the reasons before anyone presses export, and the engine must refuse whatever
reaches it — so `validateMonth` is exported for the first and `calculateMonth` throws
`InvalidMonthError` for the second. A refusal returned rather than thrown would be a
refusal a caller can ignore and still get a number. The tenth-holiday check needs to see
past the month it is handed, so it takes an optional `YearContext`: Stage 3's repository
supplies the days already taken, and a month handed over alone is read as the year's first.

**There is no `vacationDays` line, and that is the point.** Your answer to question 1 is now
item 7: the sheet carries no vacation payment line at all, because the base is computed from
the standard count and never shrinks, so a vacation line beside it would pay the day twice.
Vacation reaches the sheet only as two figures in the reporting block — days used in the month,
balance left after them — and `BalanceLine` in `src/lib/types.ts` already carries exactly those
four fields. So vacation is a **balance concern and never a `lines` concern**, and a
`vacationDays` key appearing in a later commit is the double payment coming back.

`sickDeduction` sits in column **E**, as a negative amount, inside the same subtotal as the base
and the Friday supplement — your answer to question 3, now in item 8. Not column G: G holds
one-off payments, and a deduction is not a payment.

**The August 2025 test.** Facts in, four totals asserted to the agora with no tolerance, each
`expect` carrying Part 4 in a comment beside it:

```
base salary ₪6,247.65 · employed since 1.4.2024 · August 2025
5 Fridays worked · 4 Saturdays worked · free Saturday on the 16th
paid holidays on the 19th and the 21st, both worked
₪2,000 instalment against a ₪10,000 advance from the opening position
```

The Friday supplement is set to **₪100 per Friday**: Part 4 gives ₪500 across five Fridays worked,
and item 14 calls the supplement *weekly*, so the per-Friday figure is those two spec statements
divided — shown here in the open rather than presented as a constant.

**And the invalid case**, Part 4's other half, in the same file: a paid holiday marked on a date
already recorded as a free Saturday is refused with a reason, and never paid at both the rest-day
rate and the holiday rate. `src/lib/spans.ts` already returns `restDayHoliday` for exactly this
and is already tested; what this step adds is the engine **refusing the facts** if such a pair
reaches it anyway — the screen is one caller and a repository in Stage 3 is another. The same
refusal covers a tenth paid holiday within a year and a count of worked Saturdays higher than the
number of Saturdays in the month.

**The readable snapshot.** The same test renders the month to
`src/lib/engine/august-2025.snap.md` through `toMatchFileSnapshot` — a table of every line with its
units, column, amount and Hebrew explanation, then the closing block and the two totals. It is
committed, and it is for **reading**. The four totals are asserted separately by explicit `expect`,
so the snapshot can be regenerated without any assertion moving with it.

### You verify — Step 3 · **push point 2**

```
npm test
```

- The August 2025 test passes. A failure prints the four totals it got beside the four it wanted;
  paste that output rather than describing it.

Then open **`src/lib/engine/august-2025.snap.md`** and read it against the family's own sheet. This
is the check that matters, and it is yours because it is the half no test can do:

- The four totals read **6,747.65 / 2,558.10 / 9,305.75 / 7,305.75**.
- Each line names a **type, a number of units, and an amount** — item 2's Wage Protection Act
  requirement, and the shape the export has to carry in Stage 2.
- The columns read E for the base and the Friday supplement, F for the Saturdays and the holidays,
  and H for nothing that reached the total.
- **Read the Hebrew sentences.** Each says how its figure was reached in words rather than as a
  formula (item 24). A sentence naming a rate you do not recognise, or reading as arithmetic rather
  than as an explanation, is a real failure of this step even with every number right — those
  sentences are the application's whole help, and no test can judge them.

```
npx vitest run src/lib/engine/invalid.test.ts --reporter=verbose
```

- The holiday-on-a-free-Saturday case is **refused with a stated reason**, not silently dropped and
  not paid twice.

Push once this passes. It is the first commit that carries a correct number, and build_plan's
"done when" for this stage is now half satisfied.

---

## Step 4 — Balances

`src/lib/engine/balances.ts`. Sourced entirely from items 7 and 8; nothing here needs a figure the
spec does not state.

- **Vacation accrual by seniority**: fourteen days a year through year four, sixteen in year five,
  eighteen in year six, twenty-one in year seven, and one more each year to a ceiling of
  twenty-eight. The monthly accrual is the yearly figure **over twelve as a fraction** and never as
  a decimal — Part 5 names the workbook writing it as `1.17` in January to March and as fourteen
  twelfths from April in the same column, and warns that copying it drifts a hundredth of a day a
  year until the figures stop tying out for reasons no one can find later.
- **Sick accrual**: 1.5 days a month, ceiling ninety, **never reset at a year boundary** (items 7,
  8).
- **Carry-forward**: month N+1 opens with the previous balance plus the accrual less what was used
  in month N (item 7). An unused vacation balance carries into the following years rather than
  being paid out in December, and **the application never deletes accrued days on its own**.
- **The opening position** (item 6) seeds month one and nothing else.
- **Days used** come from `balanceDaysOf` in `src/lib/spans.ts`, which already knows that vacation
  counts its non-Saturdays and sickness counts every day it ran across, and is already tested. The
  engine calls it; it does not restate it.
- **The seven-day warning** (item 7): a year that passed with fewer than seven vacation days taken
  is reported, worded as the law asking for at least seven a year and not pressed further.

Two further rules, both now answered and in `specs.md`:

- **The sick balance is a floor and never falls below zero** (item 8). Sick days cannot be recorded
  beyond what is left in it: the engine refuses the entry and says so, rather than paying the extra
  days or deducting for them in silence. The reason is worth carrying into the code comment as well
  as the spec — days past an exhausted balance are an absence with no entitlement, which item 5
  puts out of scope for this version, so the refusal is what stops v1 depending on a calculation it
  deliberately does not have. In practice the balance stands at 43.5 against a ceiling of 90 with
  no day ever taken, so this guard will not fire; it is a fence around a gap, not a case being
  handled. If it ever does fire, that is the signal to build the unpaid absence as a feature — not
  to route around the refusal.
- **The seniority year is the calendar year** (item 7, rewritten in this step after your answer).
  It turns over on the 1st of January, and a worker who started mid-year completes her first
  working year on the 31st of December of that year. A partial calendar year still counts as a
  whole year on the ladder; what it reduces is what is earned inside it, and that happens on its
  own out of the monthly twelfths. The old wording — the year in force on the month's first day,
  stepping at an employment anniversary — is gone, not qualified. Recuperation is the one
  entitlement that stays on the anniversary, and item 15 now says why in so many words.

**Tests:** the ninety-day ceiling holds across a year boundary. Twelve months of accrual at
fourteen twelfths comes to exactly fourteen — the assertion that catches the `1.17` drift, and the
reason it is written before the code rather than after. The seniority tiers are asserted at each
boundary named in item 7.

### You verify — Step 4 · commit only

```
npx vitest run src/lib/engine/balances.test.ts --reporter=verbose
```

- Twelve months of accrual comes to **14**, not 14.04 and not 13.99. Anything else means a
  monthly figure was rounded, which is Part 5's warning arriving. The test asserts it to a
  ten-billionth of a day rather than as an exact equality, and says why beside the assertion: a
  twelfth has no exact form in binary floating point, so twelve carried-forward months land 2e-15
  short of fourteen — thirteen orders of magnitude below the hundredth of a day Part 5 warns
  about, where a 1.17 a month would miss by a hundred million times more. Snapping the balance each
  month would remove the residue and bias the carry-forward upward instead, so it is left alone.
- The sick balance stops at **90** and does not reset in January.
- The seniority tiers step at years five, six and seven and stop at 28, and they step on the
  **1st of January** — a worker employed from 1.4.2024 accrues at fourteen through 2027 and at
  sixteen from 1.1.2028, and no month inside a year accrues at a different rate from its
  neighbours.
- A calendar year passing with **fewer than seven vacation days** taken in it is reported as a
  warning on that December, in the law's own terms and not pressed further.
- A five-day spell against a two-day balance is **refused with a reason**. A balance that comes back
  as `-3`, or a spell that quietly pays three unfunded days, is the fence in the previous section
  having been built as an arithmetic case instead of a refusal.

---

## Step 5 — Sick pay

`src/lib/engine/sick.ts`. Fully specified — questions 3 and 4 are answered and in item 8.

- The statutory tiers, counted **from the spell's own first day**: nothing for the first, half for
  the second and third, and the full day from the fourth onward. A spell that begins in one month
  and ends in the next is read as one thing and not restarted at the boundary — which is why a
  spell is stored as the dates it ran between (Part 3), and why the engine reads spans that start
  before the month it is calculating.
- Because the salary is calculated from the standard count, **sickness never reduces the base**. It
  appears instead as a **deduction** covering the unpaid part — a whole day for the first, half a
  day for the second and third, nothing from the fourth onward — so the worker is left with exactly
  what the tiers give her. It is written as a **negative amount on the sickness-absence row of
  column E**, inside the same subtotal as the base and the Friday supplement.
- Sick days leave the **actual** count and not the standard one.
- The Saturdays inside a spell **count toward it and are drawn from the balance, but are not
  paid** — `balanceDaysOf` already does the drawing.
- The Friday supplement is still paid for a Friday on which sickness was reported, **unless every
  working day of that week — Sunday through Friday — was lost to sickness**. Saturday is the
  weekly rest day and is not counted, and **one day worked in the week is enough** for the
  supplement to be paid. The week is Sunday-anchored, so it is computed from the calendar in
  `dates.ts` and never from a seven-day window ending on the Friday.

**Tests:** a one-day spell pays nothing and deducts a whole day; a three-day spell deducts two
days' worth; a four-day spell deducts the same two and no more. A spell running 29 August to
3 September is asserted to deduct in **August** as days one to three, and in September as day four
and onward — the case that fails the moment anything restarts the tiers at the month boundary, and
the reason build_plan put spans in this stage. Every one of these figures is item 8's own wording
turned into agorot at `S / 25`; none is read back from the engine.

Two more, straight from your answer to question 4: sickness Sunday **through Thursday** with the
Friday worked still pays the supplement; sickness Sunday **through Friday** does not. That pair is
the whole rule, and it is the pair that fails if "the week" is ever computed as the seven days
before the Friday.

### You verify — Step 5 · commit only

```
npx vitest run src/lib/engine/sick.test.ts --reporter=verbose
```

- The 29 August → 3 September spell deducts **three tier-days in August and none in September**. If
  September deducts as though the spell began there, the tiers are being counted per month and the
  worker is being underpaid twice over.
- A four-day spell and a three-day spell deduct the **same** amount. The fourth day is fully paid,
  so it adds nothing to the deduction — a difference between the two means the tiers are off by one.
- Sunday–Thursday sick with Friday worked **pays** the supplement; Sunday–Friday sick does not.

---

## Step 6 — Holidays, part days, and vacation as a reported figure

`src/lib/engine/leave.ts`. Unblocked: questions 1 and 2 are answered, and the answer removed most
of this step's money. **Vacation produces no amount anywhere in the engine** — it moves a balance
and reports two numbers, both of which Step 4 already computes into `BalanceLine`. What is left
here is the holiday half, the part-day fractions, and the assertion that vacation really does cost
nothing.

- **A holiday the worker does not work changes nothing**: a monthly salary is paid in full and no
  vacation day is drawn (item 9).
- **A holiday she works is paid at the rest-day rate**, and a holiday falling on a Saturday she
  works is **paid once, not twice** (item 9). The interface never records "holiday" without saying
  whether she worked it (Part 5), which is why `HolidaySpan` already carries `worked`.
- **The yearly entitlement is nine days**, reduced in proportion for a year only partly worked, with
  the remainder displayed even when it is not a whole number (item 10). A **tenth** paid holiday in
  a year is refused — Part 4's second invalid case, asserted in Step 3.
- **A part day** is a single-day span carrying a fraction, paid in that proportion and drawn from
  the entitlement in the same proportion (items 7, 10). `DaySpan.fraction` already exists and
  `balanceDaysOf` already applies it.
- **A vacation day never changes the month's total** (item 7), and now for a structural reason
  rather than an arithmetic one: the base is computed from the standard count, which vacation does
  not touch, and there is no vacation line to add back. The two figures the sheet does carry —
  days used, balance left — come from `BalanceLine` and carry no amount.

**Tests:** a month with a vacation day and a month without it produce the **same** net *and the
same `lines` array*, differing only in the vacation `BalanceLine`. That second half is the
assertion worth having: equal totals could also come from two lines cancelling, which is exactly
the arrangement item 7 now rules out. A worked holiday adds one rest-day rate; an unworked one adds
nothing. A holiday on a worked Saturday adds one rest-day rate and not two. A half vacation day
draws 0.5 from the balance and still moves no money.

### You verify — Step 6 · commit only

```
npx vitest run src/lib/engine/leave.test.ts --reporter=verbose
```

- The two months — one with vacation, one without — come to the **same net** *and carry the same
  lines*. Differing nets mean vacation is costing the worker money; identical nets with differing
  lines mean a vacation line and a shrunken base are cancelling each other, which is the
  arrangement item 7 was just corrected to forbid.
- A holiday on a worked Saturday is paid **once**.

---

## Step 7 — Third-party payments and national insurance

`src/lib/engine/thirdParty.ts`. Column **H**, and nothing in it ever reaches the worker's total
(item 16, Part 5).

- The medical insurance premium, the national-insurance contribution, the agency and placement
  fees, the visa and licence fees.
- **National insurance is 3.6% of the month's full cost** — the salary, the Friday supplement, the
  Saturday and holiday pay, and the one-off payments such as recuperation — taken **before anything
  to do with advances** (item 19). It is produced as an **estimate to be confirmed** and never as a
  fact, because the sum actually billed has differed from it. Part 5 warns that the workbook's line
  is stale at 2% of the 2024 wage: derive, never copy.
- **Both figures, in two different columns** — your answer, now item 19, and it resolves a
  contradiction that was already in the files: one place said the national insurance was monthly
  "as in the sheet", another said quarterly with a tick. Both were right, because they were
  describing two different numbers. **Every month carries its own estimate** — 3.6% of that month's
  full cost, a figure to confirm rather than a fact. **The money actually paid appears only in the
  month it was paid**, with the months it covers. One is what the month accrued; the other is what
  left the account. The engine emits them under separate keys and the export writes them to
  separate columns, and anything that folds them into one line has reintroduced the contradiction.
- **Recuperation** (item 15) is worked out from seniority and offered as a suggestion the user can
  change. Its per-day rate is **not** derived from the monthly salary — nothing in that salary
  implies it — so it arrives on `MonthFacts` as a confirmed figure the way the minimum wage does,
  and is stored with the month it was used for, which is what lets a past month be reproduced at
  its own rate. Confirmed by you, now item 15. Stage 5 fills it in.

**Tests:** an H line does not move the gross. The national-insurance base is asserted to be
E + F + G **before** the closing block, using August 2025's ₪9,305.75 — a Part 4 figure — so the
3.6% is applied to a number that is itself sourced.

### You verify — Step 7 · commit only

```
npx vitest run src/lib/engine/thirdParty.test.ts --reporter=verbose
```

- Adding a ₪500 medical-insurance premium leaves the gross and the net **unchanged**. If either
  moves, column H is reaching the worker, which Part 5 says would overpay her.
- The national-insurance estimate is computed on **9,305.75** for August 2025, not on the 7,305.75
  that follows the advance.
- A month that accrued an estimate but paid nothing shows **the estimate and no payment**; the month
  the quarter is settled in shows **both**, the payment naming the months it covers. One line
  carrying both is the two numbers collapsed back into one.

---

## Step 8 — The repository interface

`src/lib/engine/repository.ts`. A thin interface — a month's facts in and out, a worker's terms, an
opening position — with **no Supabase in its signature**, and an in-memory implementation beside it.

This is build_plan improvement note 9: Stage 3's Supabase, auth and row-level security would
otherwise gate the month screen entirely. With the interface here, Stage 4 builds against the
in-memory store and Stage 3 lands beside it rather than in front of it.

It stores facts and never results. Part 3 requires one calculation path serving both the preview
and the export, and a stored result is a second path that drifts the first time the engine is
corrected. Item 13 is the same argument from the other side: a month corrected after export must
move every later month's balances, which a stored balance would have to be invalidated to do — and
**where that invalidation lives is Stage 3's schema decision, not this one**. What this step owes
Stage 3 is an interface that permits either answer.

**Tests:** facts written and read back are identical. A month's calculation is reproducible from its
facts alone — the same facts in twice give the same result, with nothing read from a clock or a
random source, which is also what makes the August 2025 snapshot stable.

### You verify — Step 8 · **push point 3**

```
npm test
npx next typegen && npx tsc --noEmit
npm run lint
```

- Everything green, and the August 2025 snapshot **unchanged** — `git status --short` shows no
  modification to `src/lib/engine/august-2025.snap.md`. A snapshot that moved while a repository was
  added means something in the engine reads state it should not.
- Grep the signature yourself: `grep -ri supabase src/lib/engine` returns **nothing**. A single hit
  and Stage 4 is gated on Stage 3 again.

Then the stage's own "done when", which is yours to call: **the known case passes and the invalid
case is refused, with no database and no interface in existence.** Push.

---

## Step 9 — `specs.md` and `build_plan.md`

Per CLAUDE.md rule 3, an answer is written into `specs.md` where it belongs rather than collected
in this file — which is why the section below is a table of where each one landed and not a list of
rules. This step is what is left over: `build_plan.md`'s Stage 1 marked **done** with outcomes only, and any wording in `specs.md`
the work proved ambiguous replaced outright rather than appended to.

**Four amendments have already landed**, before a line of engine code exists — rule 1, spec first.
All nine answers are in `specs.md` now: item 3 (no vacation-day rate, and the daily rate named as
the monthly salary over twenty-five), item 5 (no unpaid-absence mark in this version, and the
counts written so one mark kind is enough later), item 7 (no vacation payment line at all, the
"reduced base plus a cancelling vacation line" sentence removed outright, and the seniority year
as the calendar year), item 8 (the sick deduction's column, "the whole of
that week" as Sunday through Friday, and the balance as a floor that never goes negative), item 15
(the recuperation day rate confirmed rather than derived), item 19 (the monthly estimate and the
quarterly payment as two figures in two columns), Part 5's column paragraph and its stale-numbers
paragraph, and the appendix (a settled balance day uses the same divisor). One is still owed:

- ~~The `gross` / `net` distinction from Step 3.~~ **Landed.** Part 5's column paragraph now names
  both, with the reason: the export and the preview are two views of one calculation and must call
  the same figure by the same word.

### You verify — Step 9 · commit only

```
git diff specs.md build_plan.md
```

- Every answer in the table below appears in `specs.md` as **replaced wording**, not as a new
  sentence sitting under a contradicting old one. Items 5, 7 and 8 are the ones to read closely:
  each had an old sentence removed outright, and an old sentence left standing above a new one is
  the failure this check exists for.
- `build_plan.md`'s Stage 1 lists **outcomes**, and this file is the description of how.
- No rate, no formula and no colour appears in `build_plan.md`. If one does, it is in the wrong file.

> **This file is stale from Step 8 onward.** `build_plan.md` now carries Stage 1 as steps
> **7a–7d** — the month's term snapshot, the rest-day rename and its three persisted values,
> the rest-day generalisation, and the open sick spell — none of which existed when this file
> was written, and all of which come before Step 8. Read `build_plan.md` for the stage's
> shape and this file for how steps 0–7 were done. Where the two disagree, `build_plan.md`
> wins, and this file is corrected rather than followed.

**What comes after this stage is not stage 2.** `build_plan.md`'s design pass runs next —
the four home-screen departures folded into `דף הבית v3`, the artboards still drawing the
v2 sidebar brought onto the top bar, and the screens with no artboard drawn for the first
time. It sits here because the engine stages neither need it nor are blocked by it, and
because the first stage that builds a screen against an artboard that does not exist would
otherwise have to invent one mid-step.

---

## Open questions — שאלות פתוחות

**None outstanding.** All nine are answered, and every answer is written into `specs.md` rather
than kept here — CLAUDE.md rule 3, the decision lives where it belongs. This section records only
which criterion each one landed in, so a reader of this plan can find the wording that governs.

| השאלה | התשובה, בקצרה | איפה |
|---|---|---|
| שורת תשלום חופשה | אין כזו כלל. הבסיס מחושב מספירת התקן ואינו קטן, ולכן שורת חופשה לצידו הייתה תשלום כפול. חופשה מופיעה כשני מספרים בלבד: ימים שנוצלו והיתרה | סעיף 7, חלק 5 |
| תעריף יום חופשה | אין. המכנה 25 נחוץ לערך יום מחלה בלבד | סעיף 3, נספח |
| עמודת ניכוי המחלה | עמודת השכר, כסכום שלילי, באותו סיכום עם הבסיס ותוספת השישי | סעיף 8 |
| "כל השבוע אבד למחלה" | ראשון עד שישי. שבת אינה נספרת, ויום עבודה אחד מספיק | סעיף 8 |
| יתרת מחלה שנגמרה | היתרה לעולם לא יורדת למינוס. הרישום נחסם ונאמר בקול, לא משולם ולא מנוכה בשקט | סעיף 8 |
| ביטוח לאומי בדף החודשי | שניהם, בשתי עמודות: אומדן חודשי בכל חודש, והכסף ששולם רק בחודש ששולם בו | סעיף 19 |
| היעדרות בלי זכאות | לא נבנה בגרסה הראשונה; הספירות נכתבות כך שסוג סימון אחד יספיק בהמשך | סעיף 5 |
| שנת הוותק לחופשה | שנה קלנדרית, מתהפכת ב־1 בינואר; שנה חלקית נספרת כשנה מלאה בסולם | סעיף 7 |
| מתי נדלקת אזהרת שבעת הימים | לפי שנה קלנדרית, בדצמבר שסוגר אותה | סעיף 7 |
| תעריף דמי הבראה | מספר מאושר על `MonthFacts`, כמו שכר המינימום, ולא נגזר מהשכר | סעיף 15 |

**One note on where an answer landed.** The recuperation rate was directed to criterion 13; 13 is
the post-export correction cascade and has nothing to do with recuperation, so it went into **15**,
which is the criterion that already carries recuperation and its seniority entitlement. Say if a
different home was meant — it is one sentence to move.

**Two of these answers close contradictions that were already in the files**, and both are worth
noting because each would have surfaced as a bug rather than as a question:

- The national insurance was described in one place as monthly "as in the sheet" and in another as
  quarterly with a tick. Both were true; they were describing two different numbers. Item 19 now
  says so outright.
- Item 5 described the arithmetic of an absence with no entitlement while the appendix put unpaid
  leave out of the first version. Item 5 now carries the exclusion **and** what the arithmetic
  would be, so the rule is recorded without the feature being implied.
