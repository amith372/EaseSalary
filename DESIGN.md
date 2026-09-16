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
| A strip of blocker cards leads the screen, above the columns. v4 draws none | `specs.md` item 27: the opening screen leads with what blocks a correct salary |
| v4's workers card is cut from the rail | The top bar's switcher and its `עובדים/ות` tab already reach both workers, and the balances name them |
| v4's row of action cards under the columns is cut | The tabs, the money card's link and the blockers lead to each of them |
| The day panel's `סוג יום` and `עובד/ת` rows are cut; `חלק מהיום` and `הערה` show only when the day has one | The tinted card is the kind and the switcher is the worker |
| The day panel draws no kind card at all for an ordinary work day | An ordinary day has nothing to say about itself |
| `עריכת היום` opens the calendar's own picker on that day | It is no editor of its own |
| The "החודש" button stays beside the band's arrows | — |
| The money card carries **one** link, to the payslip. v4 draws two | See *The link* below |
| The money card opens with `ימים בפועל / ימי תקן`, which v4 has no row for | The Wage Protection Act asks both counts of the payslip (items 2, 5). The payslip has them, but it opens on the last month that *ended* — so without this the running month's counts are readable nowhere, and a vacation day wrongly shrinking the standard count would show on no screen at all |
| Each balance in the rail carries a `ימים שנוצלו החודש` hint. v4 draws the balance alone | Criterion 2: a balance with no days behind it cannot be checked, and this month's are what the user just changed by marking a day |
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

### Still owed to the canvas

The thirteen artboards do not yet draw the tab icons, the heading icons, the
two-row phone bar or the skip link. Canvas leftovers: a `3.200` typo in the
month artboard, and a stale comment saying sick is blue.
