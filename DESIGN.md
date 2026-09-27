# Design — EaseSalary

Read when working on a screen. `CLAUDE.md` holds the conventions that apply to
every file; this holds the look, and the places the code departs from the canvas.

- Source of truth for the look: the Claude Design canvas, home screen `דף הבית v4`:
  https://claude.ai/design/p/b11cf323-ac11-490d-994d-3145e8e07a6b
- Tokens (colour, radius, fonts): `src/app/globals.css`. Add or change tokens there, never inline.
- Type: Assistant for UI; Gveret Levin only for the band's hand-written slogan.
- RTL, bidi isolation, `dir="auto"`, `translate="no"`: CLAUDE.md "Code conventions".
- No meaningful text inside an image or CSS `content:`; icons are inline `<svg aria-hidden>`.
- A visual change is made on the canvas first, or written down as a departure below.
- Out of scope: redesigns, "bolder", "overdrive", "delight".

## Departures from the canvas

**The canvas is obeyed for a screen being built; it does not license undoing a
decision already taken against the built screen.** Every departure below is the
user's, and each carries the reason it was made — a departure with no reason
beside it is indistinguishable from a screen nobody finished. `דף הבית v4` is
canonical for the home screen and supersedes the v3 departures recorded in
`docs/plan-calculation-engine.md` Step 0 (f) and (g).

### The opening screen

| Departure | Why |
|---|---|
| A strip of up to four blocker cards leads the screen, above the columns, with the rest counted beside "הצג הכל". v4 draws none | `specs.md` item 27: the opening screen leads with what blocks a correct salary |
| v4's workers card is cut from the rail | The top bar's switcher and its `עובדים/ות` tab already reach both workers, and the balances name them |
| v4's row of action cards under the columns is cut | The tabs, the money card's link and the blockers lead to each of them |
| The day panel's `סוג יום` and `עובד/ת` rows are cut; `חלק מהיום` and `הערה` show only when the day has one | The tinted card is the kind and the switcher is the worker |
| The day panel draws no kind card at all for an ordinary work day | An ordinary day has nothing to say about itself |
| `עריכת היום` opens the calendar's own picker on that day | It is no editor of its own |
| The "החודש" button stays beside the band's arrows | — |
| The money card carries **one** link, to the payslip. v4 draws two | See *The link* below |
| The money card opens with `ימים בפועל / ימי תקן`, which v4 has no row for | The Wage Protection Act asks both counts of the payslip (items 2, 5). The payslip has them, but it opens on the last month that *ended* — so without this the running month's counts are readable nowhere, and a vacation day wrongly shrinking the standard count would show on no screen at all |
| Each balance in the rail carries a `ימים שנוצלו החודש` hint. v4 draws the balance alone | Criterion 2: a balance with no days behind it cannot be checked, and this month's are what the user just changed by marking a day |
| Under the money card: the payslip link first, then a `כדאי לדעת` card that v4 does not draw | The warnings appear on no other screen. The link is read first; a running month raises no warning, since it is this screen's ordinary state |
| Under the payslip link: a `הערה לחודש` card, a text field and a save button, which no artboard draws. The payslip's `להוסיף הערה לחודש` opens here on its own month | `specs.md` item 5 writes the month's note on the month screen, and the payslip only shows it |
| The third-party and national-insurance rows sit **below** the total. v4 draws the third-party row among the others | Money paid to a third party never reaches the worker's total (item 16) and the national-insurance figure is an estimate still owed (item 19). Either drawn above `סך הכל תשלום לעובד/ת` reads as part of it — a sum the family would act on |

Measured after the cuts: nothing scrolls sideways at any width, and 1440×700
fits without scrolling.

### A refused month (every screen that replays her months)

**The canvas draws no such card, because it draws no refused month.** The engine
declines to value a month it cannot value correctly (`specs.md` item 25, Part 4)
and carries a Hebrew sentence per refusal, the dates each names and the rule
behind it; until stage 8¾ nothing drew any of them, so what reached the user was
a stack trace.

| Departure | Why |
|---|---|
| One card, carrying the month at fault, one sentence per refusal with its dates and its rule, and a line saying the months after it are waiting on the same correction | Two refusals in one month are one month's state; stacked cards would read as two separate failures. The month is named because one refused month stops the replay of every later one (item 13), so the screen catching it is usually asking about a different month |
| On the opening screen the card sits **above** the columns and the calendar still draws beneath it, with its marks | That calendar is where the mark that caused the refusal is corrected, and it reads her spans rather than the engine, so it survives. A screen that drew only the card would state a problem and withhold the one control that fixes it |
| The money column draws nothing at all while the card stands — not the `החודש הזה עדיין ריק` card it would otherwise fall back to | A refused month is not an empty one, and the fallback would contradict the card above it |
| The refused worker's two rows leave the balances card, and the card itself goes only where nobody is left — a one-worker household, or both refused — leaving the rail holding `לייצא לאקסל` alone, drawn full width | A balance is derived by replaying the months (item 13), so a month the engine declined to value leaves nothing to derive one from, and her rows drew `[מספר] ימים` instead — a bracketed placeholder on screen, which is what `[השם שלך]` was cut for. An empty figure beside a real one is worse than no figure. The other worker's rows stay, because the rail answers where the *household* stands and her balances were never in question |
| On the payslip, the payments screen and `דוחות` the card **is** the screen — for the worker the switcher is showing, and not for the other | None of the three has a calendar, every figure on them comes off the replay, and `דוחות` would otherwise offer a file for a month the engine declined to value. One step of the switcher and the other worker's screen is whole (`specs.md` item 25) |
| The blocker strip is drawn as it always is, and the card sits below it as an `h2` | The strip is the household's and a refused worker is simply left out of its count (`alertsView.ts`), so the other worker's list stands. The card led the outline only while a refusal emptied the strip for everybody |
| On `/workers` and `/workers/[id]` the card is drawn **compact**: the reason, its dates, the month and the rule stay; the body paragraph and the “every month after it is waiting” line go (the user, 2026-09-27) | Those two are lists of an employment and not screens that explain a month. The two lines that go are prose; the four that stay are what item 25 requires. One component with a `tone`, so the wording cannot fork between the screens that explain and the screens that list |
| On `/workers` her card keeps the terms of her employment — name, avatar, country, employed-since — and loses the whole four-figure grid, her base salary with it (the user, 2026-09-27) | The terms are stored and not replayed, so a refusal says nothing about them. The salary would still be true, and it goes anyway: a grid of one cell is not the grid, and the card is what her row is now about. An empty figure beside a real one is worse than no figure |
| Her status chip is not drawn at all while she is refused | The chip states `waitingMonth`, which is derived from the replay: a chip reporting `הכל מעודכן` beside a card saying the month could not be valued is the plainest kind of wrong answer |
| The other worker's card on `/workers` is untouched, and the add-worker card behaves exactly as it does otherwise | A refusal belongs to the employment whose month it is (item 25). An account holds two, and whether there is room for another is not a question the replay answers |
| On `/workers/[id]` the card **is** the screen and carries the `h1`, with her name stated above it | Her months and her balances are the whole of that screen and both come off the replay. On the list her own card's heading names her; here nothing else would, so an address reached from a bookmark still says whose month it is |
| A way back to the calendar sits **inside** the card, under the reason, on `/workers/[id]` — and **nowhere on `/workers`** (the user, 2026-09-27) | The refusal and its exit read as one thing. It is on her own page and not on the list because the opening screen shows one worker at a time and only an address naming a worker chooses her (`WorkerScope`): from `/workers/[id]` the link lands on her calendar, and from a list of two it would as often land on the other worker's, with no refusal on it to correct |
| Neither screen gets an `error.tsx`, then or now | A refused month is a known state with a sentence written for it, not an error. A boundary would paper over the state the card exists to say, and would swallow genuine faults with it |
| The two download addresses draw no refusal of their own: they send her to the opening screen, showing the worker the download named | A file is not a place to word a refusal, and the card is already written. The opening screen is the only one that draws the card *and* carries the calendar the mark is corrected on |

### The calendar (on every screen that draws it)

- A line under the grid after the first press says to press the last day —
  nothing else teaches the second press.
- The picker folds its part-of-day and note row behind one button, so its first
  question is only the kind.
- A kind no day of the selection can take is drawn greyed rather than removed,
  with one quiet line under the row saying why — a Friday-resting worker's
  Saturday offers no free rest day. The canvas draws one worker, who rests on
  Saturday, so it never meets the case. Greyed and not hidden, because a control
  that vanishes leaves the user looking for it, and the row already greys a kind
  that cannot be taken in part.

### The calendar band (the home screen alone)

**The canvas draws one band and the code draws four**, one per season of the
month the calendar is showing: the drawing, the wave behind the controls, the
slogan, its underline and the month's name all follow it. `v4`'s branch, its
cream sun and its sage wave are summer, unchanged, and are what a band with no
season on it falls back to. The user drew the other three on 2026-09-27 and
their colours are sampled from those drawings.

| Departure | Why |
|---|---|
| The season is Israel's and not the astronomical one: **summer is June to September** and autumn only October and November | The user, 2026-09-27. September here is summer by any thermometer, and a band that turned brown on the first of the month would be describing somewhere else |
| It is read off the **month being shown** and never off today | A family correcting March in July is looking at March (`CLAUDE.md`: nothing reads the clock during a render) |
| The month's name takes the band's ink rather than the page's `ink` | It is inside the band, and the page ink is the one warm-brown thing in a winter scene. Summer's band ink is a hair warmer than the page's, which is the only visible change the seasons made to the built screen |
| The **arrows and `החודש` keep their neutral border and ink** in all four scenes, where the drawings tint them | `MonthStepper` is shared with the payments screen, which draws no band; tinting it there would need band-scoped overrides of global tokens, and the buttons are the one part of the band nobody looks at |
| All four scenes share one frame, one sun position and one wave path; only the colours and the shapes inside change | The band's clipping rules are measured against that frame — the branch is clipped before the slogan and the sun is never cut — so a scene drawn to its own dimensions would be a second layout to keep true. The drawings' waves differ by a few pixels of curve, which at 104px tall is nothing the fill does not already say |
| Spring's underline is `#8ca57e`, one step deeper than the `#98b08b` of the drawing | At 2.4px the sampled green read as a smudge under the slogan rather than as a stroke |
| The ground `--color-band` is the same cream in all four | It is what keeps the band one object across a year instead of four cards |

The scene is set by `data-season` on the band and nothing else: the colours are
inherited by every `band-*` utility inside it, so a scene is a list of tokens in
`globals.css` and never a second set of class names in the markup.

### The top bar (owed to the canvas, which draws none of it)

- Each nav tab carries its screen's two-tone icon, and each of those four
  screens repeats it beside its own heading.
- The bar wraps to two rows below `xl`, the tabs taking the lower one and
  scrolling sideways: five Hebrew tabs with the switcher and the greeting need
  about 1200px in one line, and no artboard draws a narrow bar at all. A
  scrolling strip owes two things a static row does not — the current tab is
  scrolled into view on every route change, and a fade marks whichever edge
  still has tabs behind it.
- Below `sm` the wordmark is read but not drawn beside the mark, which is what
  keeps the switcher off a third row of chrome at 400px.
- A skip link stands above the bar, seen only while focused.
- The greeting follows the user's clock — בוקר טוב, צהריים טובים, ערב טוב, לילה טוב
  from 05, 12, 17 and 21 — and names nobody, since no name is stored; the
  artboard's `[השם שלך]` read as a broken screen.
- The alerts pill counts warnings only, and its dot shows only while the count
  is above zero: item 27 puts blockages on the opening screen, not in the bell.
- With four warnings or fewer the pill opens a panel under it — a heading, the
  warnings as links, and `הצג הכל` · `להגדיר אילו תזכורות לקבל` — which no
  artboard draws; the user asked for it on 2026-09-17 (item 27). Below `sm` the
  panel spans the screen under the top row, because hung from the pill it ran
  past the edge.
- Every control in the bar is at least 44px in each direction.

### The alerts page

| Departure | Why |
|---|---|
| The heading is 24px, as on every other screen, not the artboard's 34px | One heading size across the application |
| Each card names its worker after the title when the household has two | `specs.md` item 27: the page lists the whole household |
| The tag is `לטיפול עכשיו` on a blockage and `תזכורת` on a warning; a document running out says `בעוד N ימים` | The artboard's `החודש` / `לא דחוף` have no rule behind them; the list is what item 27 splits by |
| `לא עכשיו` appears on warnings only, and a month not yet exported offers `סמן כטופל` in its place | A blockage cannot be put off; the user, 2026-09-17, for a month whose sheet was produced some other way (item 27) |
| `להגדיר אילו תזכורות לקבל` opens a pop-up of the four warning kinds, one checkbox each, rather than leading to `הגדרות` | The user, 2026-09-17: the settings rows did not say clearly what is on and what is off (item 27) |
| The artboard's `[חודש] מוכן לחישוב` card is not drawn | No entry of item 27 says a month is ready; a finished month not yet exported is the one that exists |
| `כבר טופל` lists exports, third-party payments and confirmed recuperation months of the last ninety days | Those are the handled events the months record (item 27) |
| Entries of one kind that differ only in the month they are about are one card, its title counting them, and it carries one action. The artboard draws a card per entry | The user, 2026-09-24 (F58): a dozen cards saying one sentence about a different month read as a screen of separate problems — `/alerts` was 7,135px tall at 390 wide. `specs.md` item 27 carries the rule, and the count the bell and the strip give is the number of cards drawn |
| Where such a card offers `סמן כטופל`, it draws one button per month — a row of month chips under the note, each named `סמן את <חודש> כטופל` — and the note then lists no months. A card standing for one month keeps the single plain button | The user, 2026-09-25: the gesture removes a month's warning for good and cannot be undone from the screen, so no press may answer four months at once. Item 27's "one action on it" is the way in (`לייצא`), not the putting-off |

### The export badge (every screen that draws it)

The tile holds a spreadsheet's ruled cells where the canvas draws a crossed
mark, which on the export button read as "close".

### The link

The money card carries one link and v4 draws two, which cost a route before it
settled. The header's `לחישוב` was cut as a duplicate of
`לצפייה בדף המשכורת המלא` below it, on the strength of two names that read
alike; they never led to the same place, and the cut left `חישוב החודש`
reachable from home only through the payslip and back out of it. The link was
then pointed at `חישוב החודש` instead — and that screen turned out to be the one
that worked while the home screen was a fixture of it. So the calculation moved
onto the opening screen and `חישוב החודש` went. The cut was right after all:
there is one screen further in, and it is the payslip.

It is drawn in the export card's shape — a bordered card with a sage icon tile,
a bold title and a chevron — and not as v4's muted line under the cards, which
was easy to miss. Its icon is a ruled page, so it does not share the export's
folded sheet.

### The payslip

- Its rows are drawn a step larger than the home screen's (`SummaryRow`
  `size="sheet"`), but a line keeps the light weight and only a subtotal or a
  level is bold. The artboard draws a line bold and its subtotal smaller than
  it, which makes the total read as the lesser figure.
- `הימים בחודש` is one column below `sm`: two columns at phone width broke
  `27 / 27` over two lines.

### The workers list and the worker's page

- The list has no header `להוסיף עובד/ת` button; the dashed card at its foot
  is the one way in, and it shows only while the household has room. Two
  buttons for one action, one of them offering a save the database refuses.
- The avatar tile holds a person glyph; the artboard draws it empty. Nothing
  stores a photo, and an empty tile reads as a picture that failed to load.
- Each list card closes with `החודשים` and `פרטים והגדרות` beside the profile
  link; the second selects that worker in the switcher, since `/settings`
  shows whoever the switcher holds.
- The add-worker fields show focus as the forest outline `Chip` uses, as well
  as the border and fill change. The artboard draws only a 1px border
  colour, which is too faint to find the caret by keyboard.
- The `משותף/ת עם` chip on a list card names an **email address**, where the
  artboard draws a name: a share is an invitation sent to an address, and the
  account holds nothing else about the person (the user, 2026-09-18). It is
  drawn only for an invitation that was accepted, and only for the side that
  sent it — a joined member is shown the invitations addressed to them and
  never the address of the family that invited them, so a worker shared into
  their view carries no chip.
- What the artboards draw and nothing yet supplies is listed in
  `build_plan.md`, not drawn as placeholders.

### The payments screen

- All five sections of the card start folded, and a section's heading is the
  button that opens it, with a chevron beside it that points towards the end
  of the line when folded and down when open. The artboard draws them open:
  five forms at once were too much to take in on arrival. What is open stays
  open while the month is stepped.
- **A folded section says what is inside it**, which the artboard does not draw
  because it draws them open. What sits beside the heading depends on which
  state it is in: a *control* — `לתת מקדמה` — appears only once the section is
  open, since a button acting on what the user cannot see is a trap, while a
  *figure or a name* is drawn folded as well. Each of the six says the thing it
  is for: the tax its amount, `מקדמות` how many are still being repaid, and the
  three that hold what she entered herself — her own lines, the payments to
  third parties, and the figures she typed over the calculated ones — the names
  of what is in them, or a sentence saying there is nothing. Names and not
  counts: these hold things she named or chose, so a name answers "what is in
  there" where a number only says how much opening it would cost.
- **A movement of an advance carries a לתקן beside its להסיר**, which the
  canvas draws on a line the user added and not here. The amount of an advance is
  what she typed, so it is corrected rather than overridden (`specs.md` item 20),
  and without the action the only correction was to remove the movement and record
  it again — which mints a grant a new number. The panel is the group's own, opened
  under the movement it corrects and prefilled with what it holds, in the idiom the
  line she adds already uses.

### The forms on payments, settings, the holiday picker, before the export and sign-in

- A text field's border is `line-field`, far firmer than the artboards'
  hairline: the border is the field's only outline, and the hairline held
  1.24:1 against the white card, under WCAG's 3:1 for a control's boundary.
- The bare text actions are padded out to a finger's height and give the
  space back with a negative margin, so the rows are drawn as the artboards
  have them. **The idiom is `touchTargetClass` in `Field.tsx` and it is not the
  forms' alone**: every bare action on `/`, `/alerts`, `/settings` and the
  holiday picker takes it, since a link drawn as a line of text is about 20px
  tall and WCAG 2.2 AA asks 24 (2.5.8). A link *inside a sentence* does not
  take it — WCAG's own inline exception — because an enlarged area there would
  overlap the lines above and below it. A control drawn at a fixed size takes a
  pseudo-element hit area instead (`after:-inset-*`), as the `?` disclosure,
  the month stepper and the holiday tick do, since padding a fixed box shrinks
  what it draws rather than growing what it answers.
- **A disabled filled button goes to the chip grey**, not to a lighter forest.
  `opacity-50` turned it into a sage indistinguishable from a deliberate quiet
  action, so a screen with three saves dark and three sage read as two button
  styles rather than as three dead controls.
- **Each term's heading is its control's accessible name.** The row draws its
  name once, as the `<h3>`, and the control under it is a bare field; a `Field`
  label would draw that name a second time and change the screen, so the
  heading's id goes to the control instead.
- **A change on its way to the store is said by the control that was pressed,
  never by the region around it.** The control dims and takes `cursor-wait`
  (`busyAttrs` in `Field.tsx`); the region keeps `aria-busy` alone, which says
  the same thing without repainting anything. `/payments` used to put
  `opacity-60` and `pointer-events-none` on the card holding all six sections
  and `/settings` on the card holding all four groups, so saving one note
  greyed every other row and, on a slow answer, read as the page failing rather
  than as one field being written. **The busy control is not drawn as a
  disabled one** — disabled is the chip grey above and means it cannot be
  pressed — and the repeat press it therefore admits is dropped by `useAction`,
  where one change at a time is enforced. **Where the gesture closes the control
  that made it**, as the calendar's mark panel on `/` does, nothing is left to
  wear it and the column keeps `aria-busy` alone.

### The home screen

- **The screen's `h1` goes to whatever leads it**, rather than a heading being
  added: the blocker strip where it is drawn (`specs.md` item 27 puts what
  blocks a correct salary first), then a refused month's card, then the
  calendar's month. The screen opens straight onto the calendar with no heading
  of its own, which is a departure this one keeps — so the level moves instead
  of a title appearing above the calendar.

### The payslip and `דוחות`

- **A month nobody has confirmed offers `לאשר ולייצא` where a confirmed one
  offers its file** (the user, 2026-09-24). `/month/export/file` refuses such a
  month, since the wage and the tax are confirmed before every export and stored
  by that confirmation, and neither screen may offer a link the route answers
  with a refusal. It is a link and not a withheld control, which is what tells it
  apart from a blocked month: nothing is wrong with the month, and the file is one
  press further on. The link names the month, and `/month/export` opens on the
  month the URL names rather than on the one it would choose for itself.

### The settings screen

- The four groups start folded, each opened from its heading as the payments
  screen's sections are; the group's note is inside the fold. The account
  section below them does not fold. A worker switch folds them again.
- **The rest-day row can raise a panel the canvas does not draw**: a change that
  would strand a free rest day already marked on the old day asks about each
  mark before it saves (`specs.md` item 5). It is drawn inside the row, in an
  inset `bg-ground` card in the idiom of the rows around it, rather than as a
  screen or a dialog of its own — the question belongs where the change is being
  made, and a user sent elsewhere to answer it would have lost the change.
- **The employment group carries an `ארץ מוצא` row the canvas does not draw**, beside
  `מין` and in the same chips: the country was written once by the wizard and by
  nothing since, so a family that chose wrong held a profile permanently wrong
  about where she is from, and printed it on `/workers` and on her own page. The
  chips offer exactly the countries a holiday list is stored for — the same offer
  the wizard makes — and the hint says what the answer decides, since the country
  is only the *default* her holiday list is drawn from: a worker already moved to
  another list keeps it.
- **The minimum wage is drawn among the employment's rows, directly under
  `שכר בסיס לחודש`**, and not in the group the canvas puts it in. The salary's own
  hint already says it may not fall below the minimum, so the figure and the
  floor it is measured against are read as one thing; what is left in the other
  group is `ביטוח לאומי` and the medical insurer, which is why that group is
  titled `ביטוחים` rather than for a cadence only one of the two has. **The
  failed-fetch sentence before an export links to `#employment` for this
  reason** — it promises to show which wage figure is held and out of where, so
  it has to land on the group that draws it. The household's figure sitting
  inside a per-worker group is no departure of its own: the card is drawn per
  worker and the wage is the same on both.
- **A rate row carries where its figure was read from**, which the canvas does
  not draw: `נקרא מ־` and the link `המקור` where the source is an address, and
  otherwise **a sentence of the screen's own** — `נקרא מהגיליון של המשפחה`, or
  `הוזן ואושר על ידך`. It is `specs.md` item 4's fourth thing, and until now the
  only screen that showed it was the one confirming an export — so the answer to
  "which figure is the application holding, and out of where" existed nowhere the
  user could go and look. The failed-fetch sentence before an export sends her
  here for it.
- **A standing line carries a lifetime the canvas does not draw**, and it is two
  selects over months and not a typed date (`specs.md` item 20). The wording the
  third-party period already gives is the reason: a browser's own `type="month"`
  picker is laid out and worded by the browser's locale rather than the page's, so
  on a Hebrew right-to-left page it can arrive left-to-right and in another
  language — which is why `MonthSelect` moved out of `MonthActions.tsx` and both
  controls now share it. The empty option at each end is an answer and not a
  blank: "no end on this side", and both empty is a line that applies to every
  month, which is what every standing line meant before the lifetime existed. The
  row above says the range beside the line's own words, each month isolated, and a
  line with no lifetime says nothing — the plain case is the quiet one. The salary
  row's `YYYY-MM` text field in the same group is not the model here and is the
  thing that should move: a family should not have to know the idiom.
- **A line whose last month has passed keeps a row, under a quieter heading**
  (`שורות שנגמרו`) rather than leaving the screen. Item 20 asks for it, and the
  reason is the gesture beside it: the edit that clears or extends the last month
  is on that row, so a line dropped from the screen is a line that cannot be
  started again. The two endings are two gestures and wear two words — `להסיר`
  deletes the line outright, which a line added by mistake needs, and a last month
  merely ends it (the user, 2026-09-26).
- **The row never prints the stored source string.** It used to, and for the
  seeded wage that was `שכר_חודשי_להאנה2026.xlsx → חודש  4.26 → D6`: a path into
  a file the application does not hold, and one the right-to-left run reordered
  so the extension was drawn in front of the name. What a family can use is the
  *fact* — whose sheet, or whose confirmation — and the citation belongs in the
  test and the commit message (`CLAUDE.md` rule 6). A source the screen has no
  sentence for draws no line at all, rather than the string or a guess at whose
  it was.

### Before the export

- **The income tax has a card of its own, which the canvas does not draw.** The
  tax is confirmed before every export and stored with the month exactly as the
  minimum wage is (`specs.md` item 17), and it had no surface at all: the figure
  was worked out and written when the export button was pressed. The card shows
  the amount, names which of the three settings produced it in the payments
  card's own words, and says where the year has no bracket table. **It carries no
  field**, unlike the wage's and the recuperation's: a month departs from the
  worker's setting through the field on the payments screen (item 17), and a
  second one beside the button that files the month would be a second way to
  write the same override. The card links there instead (the user, 2026-09-24).

- The yes/no answers are the shared `Chip`, filled sage when chosen. The
  artboard draws a chosen answer in the warm tint, a step from an unchosen one
  that a glance does not catch.
- The artboard's `הסכום נכון` button and `עדיין לא חזרה` link are not drawn:
  the export buttons already confirm the wage, and an open spell is answered
  only by a return date, so each would add a step that decides nothing.
- Two export buttons of equal weight, where the artboard draws one: the plain
  file and the one with notes, which the family chooses between.
- Every card that blocks or warns wears the open spell's look — the warmer
  fill and the clay dot — so a block is told from a confirmation at a glance.
  The artboard draws only the spell, since it draws no other block.
- **A failed fetch's sentence ends in a link to `/settings#rates`**, which the
  artboard does not draw. The sentence already said the figure shown is the last
  one the application knows and that another may be typed; what it could not say
  is *which* figure that is and where it came from, because this screen shows
  only the month being exported. The link is the way to that, and the rates group
  is where it lands.

### The reports screen

- The four report cards are one column below `sm`; two columns at phone width
  left each card too narrow for its note.
- The artboard's `לכל החודשים` link is not drawn: the list already holds every
  month, and there is no screen of months to go to.
- The hero carries no `הדוח שמבוקש הכי הרבה` label above its heading: nothing
  measures what is requested, so the label claimed what the application cannot
  know.
- The hero carries no lead sentence under its heading, where the artboard
  draws one: the heading and the list below it already say what the screen
  holds.
- `חודשים קודמים` carries a heading per year, newest first, where the artboard draws one
  unbroken list. The user, 2026-09-24 (F59): the list is seventeen rows and one longer every
  month, and the year is the only boundary in it a reader can aim at.
- On a month that has not ended, `החודש עדיין לא הסתיים` is drawn under `לאשר ולייצא`
  as that link's own note and not beside it. `specs.md` item 21 makes it the condition the
  month is filed under, so the row says one thing rather than two.
- The closing line says that the data is kept, not the file (see `he.ts`).

### The add-worker wizard

| Departure | Why |
|---|---|
| `מדינת מקור` is required where the artboard marks it optional, and its select **opens on `לבחור מדינה` rather than on the first country** | It is what her holiday list is drawn from (item 12), so the first of six offered as an answer is a country nobody chose — and a step whose fields all look answered is one a family presses past without reading. `reviewNewWorker` refuses an empty one, in the browser and again in the action |

Its other two departures are about what a step *asks* rather than how it looks —
step 2's first month and step 3's insurer — and are in `AddWorkerScreen.tsx`'s
own header, beside the spec items that decide them.

### The sign-in screen

It has no artboard. It is built from the tokens, and its wordmark is the top
bar's: the v4 mark beside the name.

### Still owed to the canvas

The thirteen artboards do not yet draw the tab icons, the heading icons, the
two-row phone bar or the skip link. Canvas leftovers: a `3.200` typo in the
month artboard, and a stale comment saying sick is blue.
