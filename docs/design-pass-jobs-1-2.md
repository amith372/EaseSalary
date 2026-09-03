# The design pass — jobs 1 and 2, handed over as changes

`build_plan.md` says the canvas is edited in its own editor and that an agent reads the
artboards but does not write them, so jobs 1 and 2 are handed over as a list rather than
made directly. This is that list. Job 3 — the screens that have no artboard at all — is
not here.

Read on 2026-09-03, against the canvas as it then stood:

| Artboard | etag when read |
|---|---|
| `EaseSalary - חישוב החודש.dc.html` | 1788026549188290 |
| `EaseSalary - דף המשכורת.dc.html` | 1788026560139988 |
| `EaseSalary - דף הבית v3 לוח במרכז.dc.html` | 1788026524904809 |

**The green sidebar is gone from all three, and the top bar is otherwise faithful.**
Measured element by element against `src/components/AppShell.tsx`, the bar on the two
slice artboards agrees with the built one on its height (62px), its gaps, its padding, the
wordmark and its 19px clay square, all five nav tabs and their radii, the circular help
button, the alerts pill and its dot and count, and the avatar — every colour and every
radius. `src/app/globals.css` carries the same numbers under names. So what follows about
the bar is three items, not a rebuild.

## Job 2a — `EaseSalary - חישוב החודש.dc.html`

### The bar

1. **No nav tab is active on this route.** The script sets `active: true` on `דף הבית`.
   The month screen is `/month`, which is under none of the five top-level tabs, and
   `AppShell` decides the active tab from the route. Set `active` on none: all five at
   `#8C7A67`, weight 400, transparent background.

2. **The worker switcher is missing.** It belongs in the bar's left-hand group as its
   *first* child, so that in right-to-left it sits nearest the nav — the built order,
   right to left, is switcher · `?` · התראות · name+avatar. Draw it as `WorkerSwitcher`
   builds it, which is v3's control with the caption removed: a group with a 1px `#EFE6DA`
   border, radius 11px, 4px padding, two 26px chevron buttons (radius 9px, `#A2907C`,
   hover background `#F6EFE6`) with the name between them at 15px weight 500, truncating
   at 160px. There is no visible `מוצג/ת כרגע` line — a 62px bar has room for the name and
   not for both, so that caption became the group's accessible label.

3. **The greeting joins the name.** The profile link reads `[השם שלך]`; the built bar reads
   `בוקר טוב, [השם שלך]`. This is job 1's first departure, and it applies here because the
   bar is one shell on every route rather than a per-screen drawing.

### The shell below the bar

4. **The full-width row under the bar has nowhere to live.** `› חזרה לדף הבית` and
   `נשמר אוטומטית · אפשר לעצור ולהמשיך אחר כך` are drawn edge to edge with their own bottom
   border and 40px side padding. The shell has exactly one full-width bar; everything below
   it is page content inside `main`, which is centred at 1320px with 28px gutters. A second
   full-bleed bar would have to be drawn in `AppShell` and would then appear on every route,
   including the home screen, which does not want it. Either fold the row into the page's
   own column, or drop it.

5. **The page's outer padding is the shell's, not the screen's.** The artboard sets
   `44px 40px 120px` on `main`; the shell already gives 28px sides and 12px top and bottom,
   and the artboard's gutters are then doubled. Set the artboard's own page padding to zero
   and keep `max-width: 880px` as this screen's choice of column — that part is a design
   decision and stays yours.

### The calendar — the largest disagreement, and it is not the bar

6. **The mark colours are the pre-v3 set.** The script's `COLORS` are
   `#5B8AA6` / `#C1798A` / `#C89A4A` / `#DDD5C7`. The system's, which `globals.css` and
   `MonthCalendar` both carry and which `דף הבית v3` already draws, are:

   | Mark | Cell fill | Ink on the fill | Identity dot |
   |---|---|---|---|
   | חופשה | `#F7D08A` | `#4A3D31` | `#D9A441` |
   | מחלה | `#C6CFE8` | `#33291F` | `#8394C4` |
   | חג | `#EFC0C2` | `#33291F` | — |
   | יום מנוחה חופשי | `#DCD3C4` | `#4A3D31` | — |

   An unmarked day is `#F7F3ED`; the work-day legend swatch is `#F0EAE1`. Note the ink:
   the artboard paints a marked day in light ink (`#FFFBF4`) on a dark fill, and v3's
   softer hues take dark ink instead.

7. **The mark names are not the system's.** `יום חופש` and `יום מחלה` are `חופשה` and
   `מחלה` in `he.calendar.marks`.

8. **`שבת חופשית` is a placeholder, not a label.** The weekly rest day is a term of the
   employment, is Friday, Saturday or Sunday per worker, and every label that once named
   Saturday is now a function of her day — `שבת חופשית` for one worker and `יום שישי חופשי`
   for another. Draw it as a placeholder so the next session cannot read it as a constant.
   The same holds for the shaded column: the script hardcodes `[1, 8, 22, 29]` as Saturdays,
   and the shaded column is her rest day.

9. **The gesture is the wrong way round.** The artboard picks a tool from a palette and
   then toggles days one at a time. Both `MonthCalendar` and `דף הבית v3` do the
   opposite — click a day, click a second day, and a panel opens asking `איך לסמן?` with
   the four kinds and `לנקות סימון` — and stage 4's own bullet says a week's vacation is one
   gesture and not seven clicks. Replace the tool row with v3's picker panel, which is
   already drawn there and can be copied across, and add v3's hint line
   `לחיצה על יום, ואז על יום נוסף, מסמנת טווח`.

10. **The calendar cannot move between months.** v3 draws the previous / `החודש` / next
    trio and `MonthCalendar` builds all three. Stage 4 needs them: moving between two months
    is what exercises the balance chain.

11. **There is no legend.** The counts row under the calendar is not one, and a month read
    back later has to be tellable apart at a glance. v3's five-entry legend is the one to
    copy: יום עבודה, and the marks.

12. **`חג` is not one of the marking tools — settled 2026-09-03, the spec leads.** Drop it
    from the tool row. Criterion 9 says the user never marks a day as a holiday on the
    month's calendar: the year's holidays are chosen in advance from the country's candidate
    list, the dates arrive on the calendar already drawn, and the only thing the month
    records about one is whether she worked it. Moving a holiday to a different date is a
    real need and it is already answered elsewhere — criterion 10's *a date can be edited*,
    in the yearly picker, which is also how a holiday that fell inside a spell of sickness
    is recovered. So the calendar keeps three marks the user makes — חופשה, מחלה and her own
    free rest day — and a fourth state it draws rather than offers.

13. **A holiday is drawn in two weights, and both are in the legend.** Same criterion: one
    she did not work is an outline, one she worked is filled, so that the state costing
    money is the louder of the two. The artboard draws a single filled `חג` chip. Draw the
    outline as well and give the legend both entries — that takes it to six.

### The steps

14. **`תוספות ומקדמות` folds three separate lines into one.** `תוספת לשישי, שבת וחג` is the
    rest-eve supplement, the rest-day work and the worked holiday added together. Those are
    three rows in the engine and two different columns of the sheet — the supplement sits in
    the salary column and the other two in the rest-day column — and folding them
    reintroduces exactly the contradiction the rest-day rename separated. Split into:
    `תוספת ימי שישי` (the rest-*eve*, per worker), `עבודה בשבת` (the rest *day*, per worker),
    and `עבודה בחג`. The first two are placeholders like item 8's.

15. **Two rows are missing from that step.** `ניכוי ימי מחלה`, which is a negative amount
    inside the salary column's subtotal and never among the one-off payments; and
    `מקדמה שניתנה`, the advance given this month, which the step draws only the repayment of.

16. **The confirm step is right about the day counts and needs nothing.** It already carries
    `ימי עבודה (בפועל / תקני)`, which is the Wage Protection Act pair.

## Job 2b — `EaseSalary - דף המשכורת.dc.html`

### The bar and the shell

1. Same three bar items as 2a: no tab is active (`/sheet` is under no top-level tab), the
   worker switcher is missing, and the profile link needs the greeting.
2. Same full-width row under the bar (`› חזרה לדף הבית` / `אושר ב[תאריך]`) and same doubled
   page padding (`44px 40px 120px`, over an 820px column).

### Two things the reconciliation settled as *drop*, still drawn

3. **`להוריד כ‑PDF`** — the spec exports `.xlsx` only.
4. **The payment block** — `שולם ב[תאריך] · [אופן התשלום]` and `לעדכן את פרטי התשלום`.
   Payment date, payment method and mark-as-paid are bookkeeping about the family's bank,
   unverifiable, and they drive nothing.

### The rows

5. **The line set is not the sheet's.** Drawn: שכר החודש · תוספת לשבת ולשישי · תוספת לחג ·
   סכום ברוטו · מס הכנסה · מקדמה שנפרעה · תוספת או ניכוי אחר. The engine's rows are
   שכר החודש · תוספת ימי שישי · עבודה בשבת · עבודה בחג · ניכוי ימי מחלה · מס הכנסה ·
   מקדמה שניתנה · מקדמה שנפרעת, plus the user's own lines and the third-party group.
   Concretely: split `תוספת לשבת ולשישי` into the rest-eve supplement and the rest-day work
   as in 2a item 14; rename `תוספת לחג` to `עבודה בחג`; add `ניכוי ימי מחלה` and
   `מקדמה שניתנה`; and `מקדמה שנפרעה` is `מקדמה שנפרעת` — the sheet names a standing
   arrangement, not a past event.

6. **One flat list where the sheet has four column subtotals.** Criterion 1 checks four
   totals, and they are named: `סך שכר החודש` · `סך שבתות וחגים` · `סך תשלומים חד־פעמיים` ·
   `סך תשלומים לגורמים שלישיים`. The screen and the export are one engine's output shown
   twice, so a screen that can show only a single `סכום ברוטו` cannot be compared against the
   file. The fourth of those subtotals is the third-party group, which the reconciliation
   already lists as missing from the canvas — that part is job 3, and it is flagged rather
   than designed here. What belongs in job 2 is that the other three appear, and that the
   third-party total is drawn *outside* the worker's own total and never inside it.

7. **`הימים בחודש` hardcodes Saturday twice.** `שבתות חופשיות` and
   `ימי עבודה בשבת או בחג` are both functions of her rest day. Its six dots are also the
   pre-v3 palette — use the table in 2a item 6.

8. **One work-day count where the Act requires two.** `חישוב החודש` was corrected to
   `ימי עבודה (בפועל / תקני)` and this screen was not, which is the wrong way round: the
   sheet is the document the Wage Protection Act actually governs.

9. **`אחרי החודש הזה` shows the balances but not the days used.** Criterion 2 asks for
   both — the vacation and sick days used *in the month* and the balances left after them.
   Add `ימים שנוצלו החודש` beside each of the two balances.

10. **An overridden amount is not drawn as overridden.** `MoneyValue` already has the
    treatment and the artboard has no state for it. On the reconciliation's list, so job 3.

## Job 1 — `EaseSalary - דף הבית v3 לוח במרכז.dc.html`

Four departures were recorded in prose and are folded in here so that a future screen
session is not obliged to be told about them. Three still need applying; the fourth turns
out to have converged already.

1. **The greeting moves into the bar.** Delete the `h1` `בוקר טוב, [השם שלך]` and the line
   under it, `החודש של [שם העובד/ת]`. The bar's profile link becomes
   `בוקר טוב, [השם שלך]`. The subtitle is dropped outright rather than rehoused: the
   switcher already names the worker, and the line would print her name twice on one screen.

2. **The worker switcher moves into the bar**, trimmed as job 2a item 2 describes — one
   line, no `מוצג/ת כרגע` caption above the name, 26px buttons rather than 30px, no 128px
   minimum. With both gone, the whole greeting `<section>` above the calendar goes with
   them; that row cost about seventy pixels and was the difference between the screen
   fitting and the screen scrolling.

3. **The `יתרות` card dissolves into a strip under the calendar.** Delete the third card in
   the right-hand column, and inside the calendar card, under the legend, draw: a top rule
   in `#EFE6DA`, the quiet label `יתרות` at 15px weight 300 `#A2907C`, then for each of the
   two balances a dot (`#D9A441` for חופשה, `#8394C4` for מחלה), its label at 16px weight
   300 `#6E5D4D`, a chip (`#F4EFE7`, radius 9px, 3px 10px) reading `[מספר] ימים`, and the
   `?` button. A balance is a count of the days marked directly above it, which is where it
   now reads; as a third card it forced the whole right column to be as tall as three, and
   dissolving it took about 130px out of the column that was setting the height.

4. **`אוגוסט 2026 מוכן לחישוב` becomes the page's `h1`.** Nothing moves and nothing is
   restyled — with the greeting row gone the page has no heading, and this is it. It stays
   inside the `צריך לטפל` card at its current size.

5. **The vertical rhythm needs nothing.** This was the fourth departure and it no longer
   describes a disagreement. Measured against the code as both now stand, every remaining
   delta is 1–4px and they fall in both directions: the page's top and bottom padding
   (14/16 on the artboard, 12/12 in code), the two-column grid gap (20 against 16), the
   calendar card's padding (16/20/14 against 14/20/12), the right column's gap (9 against
   10) and its cards' padding (11/15 against 12/18). Every radius matches exactly. The one
   difference worth a decision is the calendar card's minimum height: 262px on the artboard,
   288px in code. Leave the rest alone in both places.

## What stage 4 needs that this list does not supply

Flagged, not designed — job 3 is not part of this hand-over.

**The holiday question is settled and has moved into the list.** It was raised here as a
three-way disagreement between the spec, the canvas and the code, and it was answered on
2026-09-03: **the spec leads.** Criterion 9 stands as written — the user never marks a day
as a holiday on the month's calendar — and the need behind the question, a family changing
which date her holiday falls on, is criterion 10's editable date in the yearly picker and
not a mark on the month. Nothing in `specs.md` changed, because the spec was already right;
what drifted were the canvas and the code. The canvas half is jobs 2a items 12 and 13. The
code half belongs to stage 4 and is not done here: `MonthCalendar`'s picker still offers
`חג`, `MarkKind` still has no way to say whether a holiday was worked, and removing the
mark before the yearly picker that replaces it exists would leave a holiday impossible to
record at all. Stage 4 builds both ends of that swap together.

- **An open sick spell, and a spell crossing a month boundary.** Nothing is drawn for
  either. Deliberately left alone: how a spell is opened is the stage-4 question that is
  still open, and nothing should be drawn for it before it is answered.
- The holiday picker, part-days, the third-party payments group, the pre-export questions,
  a note on every action, and a future month filled but not exportable — all already on the
  reconciliation list at the foot of `build_plan.md`.
