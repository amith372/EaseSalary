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
| The third-party and national-insurance rows sit **below** the total. v4 draws the third-party row among the others | Money paid to a third party never reaches the worker's total (item 16) and the national-insurance figure is an estimate still owed (item 19). Either drawn above `סך הכל תשלום לעובד/ת` reads as part of it — a sum the family would act on |

Measured after the cuts: nothing scrolls sideways at any width, and 1440×700
fits without scrolling.

### The calendar (on every screen that draws it)

- A line under the grid after the first press says to press the last day —
  nothing else teaches the second press.
- The picker folds its part-of-day and note row behind one button, so its first
  question is only the kind.

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
  open while the month is stepped. A heading's side item — the tax amount, the
  `לתת מקדמה` button — shows only while its section is open.

### The forms on payments, settings, the holiday picker, before the export and sign-in

- A text field's border is `line-field`, far firmer than the artboards'
  hairline: the border is the field's only outline, and the hairline held
  1.24:1 against the white card, under WCAG's 3:1 for a control's boundary.
- The bare text actions are padded out to a finger's height and give the
  space back with a negative margin, so the rows are drawn as the artboards
  have them.

### The settings screen

- The four groups start folded, each opened from its heading as the payments
  screen's sections are; the group's note is inside the fold. The account
  section below them does not fold. A worker switch folds them again.

### Before the export

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
- The closing line says that the data is kept, not the file (see `he.ts`).

### The sign-in screen

It has no artboard. It is built from the tokens, and its wordmark is the top
bar's: the v4 mark beside the name.

### Still owed to the canvas

The thirteen artboards do not yet draw the tab icons, the heading icons, the
two-row phone bar or the skip link. Canvas leftovers: a `3.200` typo in the
month artboard, and a stale comment saying sick is blue.
