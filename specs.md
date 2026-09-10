# EaseSalary — Specification

> **This file = *what* to build**, written as prose in five parts. It is the source of
> truth and wins if it and `CLAUDE.md` ever disagree on behavior.
> **Rewrite this file before you rewrite code**, and where a rule exists for a reason
> that is not obvious, say so in the same sentence, so the reasoning survives here.
> The application interface is Hebrew and right-to-left; this file and `CLAUDE.md` are
> English.

## Part 1 — Goal and reason

EaseSalary is a Hebrew web application in which a family employing a live-in foreign
caregiver keeps a profile per worker (up to two workers per account), records the
handful of things that change in a given month — rest-eves worked, rest days worked,
holiday days used, sick days, vacation days taken, advances given and deducted, and
one-off fees — and at the end of the month exports a single monthly salary sheet with
the same structure as the family's existing Excel workbook, with vacation and sick-day
balances carried forward automatically.

The reason this exists: the calculation itself is already solved in Excel, but it
demands spreadsheet skill and legal upkeep that the employing family does not have, so
the application must move every rule, rate, and formula out of the spreadsheet and into
guided screens where the user supplies only facts about the month and never a formula
or a rate. When a decision is not covered by this specification, choose the option that
requires the user to know less.

The application works the income tax out and does not leave the family to. **This
reverses the rule that stood until 2026-09-10**, which was that income tax is never
calculated and its line is simply typed; the reason for reversing it is the reason
everything else here is calculated — the arithmetic is a rate table and a count of credit
points, and a family that has to look both up is a family that gets it wrong in the
direction that underpays the state or the worker. The figure is derived from the month's
wage, from the tax brackets in force during that month, and from the credit points the
worker is entitled to. It is offered rather than imposed: the user confirms it before
every export, exactly as she already confirms the minimum wage and the recuperation day
rate, and the confirmed figure is stored with the month so a past month reproduces at its
own rates. It can be overridden like any other computed amount, and a month that withholds
nothing holds zero, which is what every month held before this changed. Nothing about it
is hardcoded: the brackets and the value of a credit point are fetched per year and cached
like the minimum wage. **The credit points are derived and never asked for** — a legally
employed foreign worker in home care is entitled to 2.25, and a woman to half a point
more, so the count turns on the worker's own gender and on nothing the family has to know.
The pension and severance provision stays out of scope: its row survives in the export
template, empty and untouched, so the exported sheet keeps the layout and the row
numbering of the family's workbook. **It lands with the storage of Part 3** and not
before, because the gender it turns on is a profile field and the profile is built there.

## Part 2 — Testable success criteria

Each of these is true or false at a glance.

1. Entering the facts of August 2025 into a worker profile and exporting produces a
   sheet whose four total lines read 6,747.65 / 2,558.10 / 9,305.75 / 7,305.75.
2. The exported file is an .xlsx sheet for one month, with the same rows, the same
   Hebrew labels, and the same column layout as a month tab in the family's workbook. It
   also carries what the Wage Protection Act requires of the payslip made from it: both
   day counts, the vacation and sick days used in the month and the balances left after
   them, and every payment shown as its type, its number of units, and its amount.
   It is offered in two versions which differ in one thing only: whether the workbook's
   helper column of notes is shown. The notes the user wrote on the month's actions
   (item 5) are written into that column in both, and the plain version leaves it hidden,
   which is what the workbook itself instructs — cell I2 of a month tab says the column
   is for the person preparing the salary alone and is to be hidden before printing. It
   carries those notes and not the application's own explanations: an explanation stays
   beside the figure it explains and is never restated elsewhere (item 24). The two
   versions are one file with one flag changed and never two files, so the figures in
   them cannot disagree. Hidden is not removed, and the plain version is not a
   redaction: anyone who opens it can unhide the column and read every note, so a note
   that must not travel is a note that is not written.
3. Every derived rate — the daily rate, which is the monthly salary over twenty-five, and
   the rest-day and holiday rate — is computed from the worker's base monthly salary
   rather than stored as a constant, so changing that salary changes both. **The
   twenty-five is not only the workbook's.** Kol Zchut's *חישוב דמי מחלה לעובד במשכורת
   חודשית* records two readings of what a monthly salary is divided by to value one day —
   thirty, or the working days of the week, "21.67" for a five-day week and "25" for a
   six-day week — and this worker's week is six days, one weekly rest day. So the divisor
   the family's own sheet uses is the second reading applied to her week, which is worth
   writing down: it was chosen because the workbook uses it, and it turns out also to be
   defensible from the source rather than only from precedent. There is no
   vacation-day rate, because there is no vacation payment at all; see item 7. Rates and totals are
   carried at full precision through the calculation and rounded to two decimals only at
   the end, never between steps.
   The base monthly salary defaults to the confirmed minimum wage. It does not follow a
   rise on its own: when a fetch finds the minimum wage has changed, or when the salary
   on the profile sits below it, the application says so and leaves the decision to the
   user.
4. Before every export the application shows the minimum wage it fetched from its
   source and requires the user to confirm it; if the fetch fails, the application says
   so plainly and lets the user enter the figure by hand.
   **Every rate the application does not derive is held with the date it took effect, in
   one table, and a month reads the one in force during it.** The minimum wage is the
   first and most visible of them, but it is not the only one: the national-insurance
   percentage is set by the state and changes on a date, and so does anything else the
   application ever takes from outside itself. A rate written into the code as a bare
   number has no date, so a month calculated after it changes is valued at today's figure
   and a month calculated before it is valued at yesterday's — with nothing in either
   month to say which happened. That is not a hypothetical failure mode: it is exactly
   how the family's own workbook went wrong, and Part 5 records two instances of it, the
   vacation-day rate frozen at its 2024 figure and the national-insurance line left at 2%
   after the rate rose to 3.6%. Reproducing history as history (Part 5) is impossible
   without the dates, because a past month cannot be recalculated correctly from a figure
   that only knows what it is now.
   **The table is the same mechanism the minimum wage already needs**, extended to cover
   the rest rather than invented for them: a rate, the date it took effect, and where it
   came from. Deriving one is always preferred to storing one — item 3 requires every rate
   that *can* be derived from the base monthly salary to be — so what the table holds is
   the small set that cannot be: figures the state or a source publishes. It is seeded with
   what is known, and fetching is what keeps it current (Part 3); a rate the application
   has never fetched is still dated, because a seeded figure has an effective date as
   surely as a fetched one.
   **The date stored is the official תאריך תחולה, which is always the first of a
   month.** A rise ordinarily applies from the first of the month after it was published,
   so that employers have time to prepare, and where it applies retroactively the notice
   says so by naming an earlier first-of-month — in rare cases several months back. So a
   rate never takes effect in the middle of a month, the date is the whole of the rule,
   and a month reads the row in force on its own first day.
   **A month earlier than every row the table holds has no figure, and the application
   says nothing rather than guessing one.** Reaching for the earliest row would apply a
   rate to a month it was not in force during, which is the undated guess this table
   exists to remove. What follows from that is the caller's: the national-insurance
   estimate is a reporting figure that enters no subtotal (item 19), so its line simply
   shows nothing and the month still calculates, while a rate a payment depended on would
   refuse the month with its reason.
   **A month is valued at the rate in force during it and never at the current one**,
   which is the same sentence criterion 13 rests on from the other side: a month corrected
   years later moves every later month's balances precisely because nothing about it was
   frozen except the terms it snapshotted (Part 3). A rate looked up by today's date would
   put a second kind of freezing into the replay, invisible and in one direction only.
5. The month is presented as a calendar. Its rest days and rest-eves are counted from the
    calendar rather than typed, and the user marks a span of days for what departed from
    an ordinary month — a free rest day, a vacation day, sick days — of which a single day
    is the common case and is simply a span of one. **A holiday is not among them**: the
    year's dates are chosen in advance and arrive on the month already drawn, and the only
    thing the month records about one is whether she worked it, which is item 9's own
    question and not a fourth mark. A vacation span
    skips the rest days inside it, because the rest day already stands outside the
    standard count, so drawing a vacation day for one would charge the worker twice; a
    sick span keeps its rest days, for the reason given in criterion 8.
    The sheet reports two counts. The standard count is the month's days less its
    rest days, and nothing the worker takes reduces it — neither vacation nor sickness. The actual
    count is that same figure less the days she did not in fact work, and it exists to
    answer the Wage Protection Act's requirement to list the days the worker actually
    worked. What leaves it: a vacation day, a sick day, a holiday she did not work, and —
    once it is built — an absence with no entitlement. What does not leave it: a holiday
    she worked, which is a working day like any other. A day taken in part leaves the
    actual count in that same proportion, so half a vacation day leaves half a day.
    Rest days stand outside both counts from the start, so a free rest day touches
    neither. A holiday behaves oppositely in money and in the counts, and that is the
    check to hold on to: one she worked changes the money and not the count, one she did
    not work changes the count and not the money, and a holiday that changes both, or
    neither, is a mistake. The salary is
    calculated from the standard count, so vacation and sickness never shrink the base;
    the actual count is there to be read. An absence with no entitlement behind it — a day
    that is neither vacation nor sickness — is out of scope for the first version along
    with the rest of the partial-month cases in the appendix, and there is no mark for it.
    Both counts are nonetheless computed so that adding a single mark kind is enough to
    support it later: such a day would leave both counts and with them the base salary,
    and if it fell on a rest-eve the supplement, and if on a rest day the rest-day
    pay. A free rest day is not an entitlement and a month without
    one is unremarkable.
    **The month screen is the calendar and what the month came to, and nothing that
    records a payment.** Three groups carry the rest, and each is a screen of its own
    rather than a card beside the calendar: **additional payments** — the advances
    given and repaid, the income-tax line, the lines the user adds of her own (item
    20) and the manual overrides — and **payments to third parties** — national
    insurance, medical insurance, fees — are both the payments screen's, and **yearly
    settings** — the nine holidays, the recuperation month — are the settings
    screen's. Every action can carry a free-text note.
    This was once written as three groups beside the calendar and is corrected here
    rather than argued with, because the reason is what the screens are *for*: the
    month screen answers "what did this month come to", and every one of those groups
    is a place where something is *recorded*. A calendar with four control surfaces
    around it asks the user to find the right one before she can answer a question she
    came with. What stays beside the calendar is the preview, which summarises (item
    20) — and the summary is the thing that sends her to the screen that itemises.
    **The payments screen is scoped to one worker and to one month**, and carries the
    same month control the calendar does. Two of the things it records are facts about
    a month and not dated payments — what income tax was withheld, and a line the user
    added — so a screen that could not say *which* month could not record them at all;
    and a screen holding two ways of choosing a month, one for the dated payments and
    one for the rest, would be two answers to a question the user asks once.
    **The month's preview reads by kind, not by the sheet's columns.** The rest-eve
    supplement, the work on a rest day and the worked holiday are shown together, because
    to the family they are one thing — what the days of the week added to an ordinary
    month — while on the sheet the supplement belongs to the salary column and the other
    two to the rest-day column (item 2, Part 5). Neither the calculation nor the exported
    file moves an agora for it: the columns are the sheet's structure and the sheet is
    where they are totalled. **The preview therefore prints no subtotal for any column
    that reaches the worker** — E, F and G. A group whose lines do not add up to the total
    printed under it is worse than no grouping at all, which is what putting the supplement
    beside the rest days under a salary subtotal would produce; and printing those three
    apart from the lines instead, as this criterion once asked for, answers that by saying
    the same month twice, since the figures above already are the month grouped the way the
    family reads it. They are the sheet's own totals and are read on the sheet, where
    criterion 1 checks them.
    **Column H keeps its subtotal, and that is not an exception to the rule but the reason
    for it.** The third-party group is money that never reaches the worker (item 16), so it
    is drawn outside her total in a card of its own, and its lines *do* add up to the figure
    printed under them. What the rule forbids is a column total sitting under a group that
    is not that column; H is the one group on the screen that is a column.
    **The weekly rest day is a term of the employment, not a constant.** The law allows
    only Friday, Saturday or Sunday, whichever the worker holds as her own — a Catholic
    Filipina worker may ask for Sunday and a Muslim worker for Friday, and it is her right
    — while for a Jewish worker it is always Saturday. The profile therefore holds one of
    those three and refuses any other day; it defaults to Saturday, which is the common
    choice rather than the legal one. Everything that counted Saturdays counts rest days
    instead — the standard count, a rest day taken free, a rest day inside a spell of
    sickness, a holiday falling on a rest day, and column F — and the exported sheet names
    the worker's own day in its labels rather than saying Saturday to everyone. In the
    Hebrew interface a Saturday-resting worker still reads "שבת חופשית"; the term is
    derived from her rest day and is no longer fixed in the wording. No action asks the
    user for a rate or a formula.
6. A worker created in the middle of an employment starts from an opening position given
   once: the vacation and sick balances already accrued, and any advance still being
   repaid together with what has been repaid of it so far. From then on the application
   keeps them.
7. Balances carry forward: month N+1 opens with the previous balance plus the monthly
   accrual minus what was used in month N. A vacation day never changes the month's
   total: a monthly salary is paid in full for a month in which vacation was taken, and
   the day is drawn from the balance alone. The sheet carries no vacation payment line at
   all: the base is computed from the standard count and never shrinks, so a vacation line
   beside it would pay the day a second time. Vacation reaches the sheet as a **count and
   never as money**: the days used in the month and the balance left after them, in the
   reporting block, and the days used again on the workbook's own vacation row, whose
   units are filled and whose price and amount cells are left empty.
   **That row is where the double payment gets in, and the family's own sheet shows both
   ways of filling it.** The workbook has a row reading `ימי חופש עד 14 יום בשנה למשך 5
   שנים ראשונות. - ניצול בחודש זה`, and three months of one file fill it three ways: a
   month with one day recorded its unit and left the money empty against a **full** base; a
   month with one day wrote ₪235.20 against a base reduced by 0.96 of a day; and a month
   with 8.5 days wrote ₪1,999.20 against a base reduced by 8.5/25 of the salary. The last
   two reconcile exactly — 5,644.82 + 235.20 = 5,880.02, and 8.5/25 of the salary is
   1,999.20 — so all three reach the same money, and the second and third do it by
   *reducing the base and paying the day back*. **This application never reduces the base**
   (the standard count, above), so only the first is consistent with it: taking the second
   style without the reduction that makes it work pays the day twice, once inside the
   salary and once beside it. It would also enlarge the national-insurance base, which is
   columns E, F and G and nothing else (item 19).
   **The unit-price cell on that row stays empty and is not recalculated.** The row pays
   nothing, so there is no amount for a price to multiply into, and item 2's rule that a
   payment carries its type, its units and its amount does not govern a row that is not a
   payment — what it reports is a count. A price standing beside that count is an
   invitation to multiply it, which is how the second style got into the family's sheet in
   the first place: the figure sitting there, ₪235.20, is a day valued at a minimum wage
   that has since moved twice, and writing a *current* rate there would replace a stale
   invitation with a live one. Item 19's national-insurance estimate is not the precedent
   it looks like — there the figure in the unit-price column **is** the thing being
   reported, and here the thing being reported is the number of days. A vacation day, like a holiday, may be
   taken as part of a day and is drawn from the balance in that proportion. Vacation
   accrues by seniority — fourteen days a year through year four, sixteen in year five,
   eighteen in year six, twenty-one in year seven, and one more each year to a ceiling of
   twenty-eight. The year that counts here is the **calendar** year, because that is how
   the Annual Leave Act measures one: it turns over on the 1st of January, and a worker
   who started in the middle of a year completes her first working year on the 31st of
   December of that same year even though she did not work twelve months of it. So a
   worker employed from 1.4.2024 is in her first year through 2024, her second through
   2025, her fifth through 2028, and steps to sixteen days on 1.1.2028. A partial
   calendar year counts as a whole year on that ladder; what it reduces is the
   entitlement earned inside it, and that reduction happens on its own, because a year
   she was employed for nine months of accrues nine monthly twelfths — 10.5 days at the
   first-year rate — without anything prorating it by hand. An unused balance carries
   into the following years rather than being paid out at the end of December, and the
   application warns when a calendar year passed with fewer than seven vacation days
   taken in it, said in the December that closes that year, noting plainly that the law
   asks for at least seven days a year and without pressing the point further. The
   application never deletes accrued days on its own. The sick balance accrues at 1.5 days a month, stops at ninety
   days, and never resets at a year boundary.
   Neither yearly entitlement is ever entered by the user. The vacation days the ladder
   above gives and the eighteen sick days a year the 1.5 monthly accrual comes to are
   **derived and not editable** — the canvas draws them as fields and they are not built
   as fields. An editable entitlement would be a figure the user has to know, which is
   what item 3 forbids, and because balances carry forward it would also raise the
   question of which past months an edit reaches back into: a question with no answer the
   user could be expected to hold. A family paying more than the statute obliges records
   the difference where every other agreed extra is recorded, as an additional payment
   with a note (item 20), where it does not silently rewrite an accrual.
8. Sick days accrue at 1.5 a month to a ceiling of ninety, and the payment follows the
   statutory tiers from what was reported: nothing for the first day, half for the
   second and third, and the full day from the fourth onward. A sick day is worth the
   monthly salary over twenty-five.
   **The base it is priced from is the salary alone, and the rest-eve supplement is not
   in it.** The statute does not ask what a wage generally consists of; it names a closed
   list of the components that enter the regular wage — שכר יסוד without overtime,
   תוספת ותק, תוספת יוקר or פיצוי בעד התייקרות, תוספת משפחה, and
   תוספת מחלקתית או מקצועית — and a weekly supplement agreed between one family and one
   worker (item 14) is none of the five. The same rule is visible from the other side in
   what sickness does *not* pay: travel expenses are not paid for a day of absence, so
   payments standing alongside the wage are left out deliberately rather than by
   omission. The family's workbook prices a sick day the same way, so the statute and the
   anchor the engine is checked against agree, and there is one numerator and not two. Because the salary is calculated from the standard
   count, sickness never reduces the base; it appears instead as a deduction covering the
   unpaid part of the sick days — a whole day for the first, half a day for the second
   and third, nothing from the fourth onward — so the worker is left with exactly what
   the tiers give her. That deduction is written as a negative amount on the
   sickness-absence row of the salary column, inside the same subtotal as the base and the
   rest-eve supplement, and never among the one-off payments: a deduction is not a payment.
   Sick days leave the actual count and not the standard one. The sick balance is a floor
   and never falls below zero: sick days cannot be recorded beyond what is left in it, and
   the application says so and refuses the entry rather than paying the extra days or
   deducting for them in silence. Days past an exhausted balance would be an absence with
   no entitlement behind it, which item 5 puts out of scope for the first version, so the
   refusal is what keeps this version from depending on a calculation it deliberately does
   not have. A spell of sickness is counted from
   its first day through to its last, across a month boundary, rather than restarting
   each month. A rest day inside a spell does four separate things and they must not be
   collapsed into one: it is not paid; nothing is deducted from the money for it, because
   the standard count leaves rest days out, so the salary never paid for that day, there
   is nothing to take back, and a deduction would charge her for a day she was not paid;
   it is nonetheless drawn from the sick balance, which is a count of days and not a sum
   of money; and it advances the position in the spell, so the day after it stands one
   tier further on. A span marked over a day that cannot take the mark is
   applied to the days that can and the rest is reported, which leaves two spells where
   one was intended — and because the tiers count from each spell's own first day, that
   break changes what the sickness pays. So the skipped days and the reason for each are
   shown to the user rather than absorbed silently, and a spell entered as one range is
   stored as one span wherever it legally can be. **A spell ends on the first *working*
   day no sickness was reported.** Days that touch are one spell however many spans they
   were entered as, and so are days separated only by a day she owed no attendance: for a
   worker paid a monthly salary the period of illness is counted in calendar days, so the
   weekly rest day between two reported days sits inside the period rather than breaking
   it. Kol Zchut's *חישוב דמי מחלה לעובד במשכורת חודשית* states it plainly — "עובד
   במשכורת חודשית תקופת מחלתו הינה כל ימי מחלתו, לרבות ימי מנוחה שבועית" — citing
   ד"מ 48713-10-17, where counting "ימי המחלה הקלנדריים" rather than only the days
   actually worked was held to be no defect. **Those days are drawn from the sick balance
   like every other day of the spell**, because the same source says they are deducted
   from the accrued quota: the balance follows the spell and not the marks. This is not a
   corner case but the ordinary one, because the natural way to record an illness is to
   mark the days she was absent from work — a family that marks Friday and Sunday and
   leaves Saturday alone means one illness, and reading it as two restarts the tiers and
   pays the Sunday nothing. A day she *was* expected at work and no sickness was reported
   for does break the spell, which is what keeps the rule from swallowing an interval of
   any length.

   **A day she owed no attendance is the weekly rest day and a holiday she did not
   work.** The rest day is what the source says in so many words; the holiday is carried
   by the same holding rather than by a second authority, because what was held is that
   the count runs over calendar days and not over "ימי עבודה בפועל", and a holiday she did
   not work is precisely a day not worked in fact. That the extension is an extension is
   written here rather than left to be discovered: the page speaks of the weekly rest day
   alone, and the weekly rest day is simply the day that happened to be before the court.
   A holiday she **did** work breaks the spell like any other day of attendance, because
   she was at work. A **vacation** day breaks it too, and for a reason that is stronger
   than the balance of arguments it first looks like: the law does not let one day be
   both. Where a worker falls ill *during* a vacation, the days she is entitled to sick
   pay for are counted as sick days and only the days beyond them are drawn from the
   vacation quota — the day is converted rather than held in two places at once. So a day
   still recorded as vacation is by definition a day she was not ill on, and a vacation
   day sitting *inside* a period of illness is not a state that can arise. That is what
   separates it from the weekly rest day and the unworked holiday, which sit inside a
   period without contradicting it. That is how the law measures a period of
   illness: an unbroken
   run from its first day, the rest days inside it counted, regardless of how many
   medical certificates were written over it. Where two genuinely separate illnesses do
   run into each other the effect is to read them as one, so the fourth day is paid in
   full rather than starting again at nothing — which leans in the worker's favour, and
   is settled by the manual override of item 17 rather than by a mechanism built for it. **Sickness does not
   reach the rest-eve supplement at all**, and there is no rule here about weeks. The
   supplement is paid for every rest-eve of the month whichever days the illness covered
   (item 14), so nothing in this criterion has to define what losing a week would mean.
   An earlier version of this criterion did define one — the six days ending at the rest
   day — and it existed only to qualify a "pocket money" setting that item 14 no longer
   has. It is gone rather than kept for a caller that no longer exists.
   **A spell may be left open, and the application never asks for an end date.** On the day
   a worker falls ill nobody knows the day she will return, so it is not asked for: the
   spell runs from its first day and is closed when she comes back.

   **There is no gesture for opening one, and there is deliberately none.** A spell is
   entered the way an illness is actually recorded — the days she was absent are marked,
   as they happen or afterwards, in one range or several — and the days that touch are one
   spell however many spans they were entered as, with the weekly rest day and an unworked
   holiday between two of them sitting inside the period rather than breaking it (above).
   So continuity is *inferred* and never declared, and a second gesture meaning "she is
   still ill" would be a second way to say what marking the days already says, with two
   states to keep in step. A spell crossing the end of a month needs no gesture for the
   same reason: the days on either side touch, so they are one spell with one first day,
   which is what the tiers are counted from. The open shape stays in storage and in the
   engine — `to` may be null and a month clips such a spell at its own last day — because
   a spell genuinely has no end until she returns; what has gone is any screen that asks
   the user to say so. This is
   why a spell crossing the end of a month needs no gesture of its own — an open spell is
   never *crossed*, it simply has not ended, and it stays one spell with one first day,
   which is what the tiers are counted from. An open spell is counted in a month by
   clipping it at **that month's own last day**, which is a fact about the month and not
   about the present, so a finished month's figure is settled once the month has ended and
   never moves because of when it is looked at; only the current month's live preview
   clips at today. The hazard of an open spell is the opposite one — a worker who returned
   and whose spell nobody closed — so the export asks before it runs (item 18), and the
   opening screen carries an open spell as a warning rather than a blockage, by the test in
   item 27: the figure computes, it may simply be stale. Closing a spell later than the
   return corrects the months it touched and carries their balances forward, which is
   criterion 13 and needs nothing built for it here.
9. A holiday the worker does not work changes nothing: a monthly salary is paid in full
   and no vacation day is drawn. A holiday she works is paid at the rest-day rate, and a
   holiday falling on a rest day she works is paid once, not twice.
   The user never marks a day as a holiday on the month's calendar. The year's holidays
   are chosen in advance from the country's candidate list (item 10), so the dates arrive
   on the calendar already drawn, and the only thing the month records about one is
   whether she worked it. That single fact is shown as one colour in two weights: a
   holiday she did not work is an outline, and one she worked is filled, so the state that
   costs money is the louder of the two. Both appear in the calendar's legend, because a
   month read back later has to be tellable apart at a glance. A holiday nobody has
   answered for yet is caught by the pre-export questions (item 18) rather than counted as
   one she did not work, which is what keeps a silent default from quietly underpaying
   her.
10. The worker's holidays for the year are shown in advance as her country of origin's
   full candidate list, with another country's list selectable instead, of which the
   user marks the paid ones. **A religion's list may be chosen in place of a
   country's** (decided with the user on 2026-09-09): the candidate list is either the
   holidays of a country or the holidays of a faith — Jewish, Muslim, Christian or
   Druze — and the two are one choice with two kinds of answer rather than two separate
   settings. A worker's own holidays need not be her country's, and the four faiths are
   published in Israel as lists of their own, so the picker offers both and the user
   picks one. A religion's list is published as one page covering every year it knows
   rather than one page per year, and where such a page prints a date without a year at
   all that date does not move from year to year; where it prints a year, or says which
   year a date holds for, it holds for that year alone. The Christian list is published
   twice over, once for each of two rites, and both are offered with the rite named
   beside the holiday rather than merged into one. The yearly entitlement is nine days for a full year and is
   reduced in proportion for a year only partly worked, and the remainder is displayed
   even when it is not a whole number. The year here is the calendar year, as the
   vacation year is (item 7), and as the holiday lists themselves assume — they are
   published and stored per country and per calendar year. The reduction is measured in
   **months employed in that calendar year**: nine days times those months over twelve,
   with the month employment began counted as a whole month. So a worker employed from
   1.4.2024 has 6.75 days for 2024 and nine from 2025 onward. That is the calculation the
   family's workbook both states and pays. `שכר_חודשי_להאנה2024.xlsx` → `חודש  12.24`
   → C9 holds 6.75 days and F9 pays 6.75 × 401.25, and the note in I9 gives the reasoning
   behind them: "בגין חודשים 4-12/24 (9 חודשים) זכאית ל (9*9)/12 = 6.75 ימי חג". The
   figure comes from the cells and the reasoning from the note, which is the order Part 5
   requires. Criterion 1 is agreement with the workbook: a
   day-by-day proration is arithmetically finer and gives 6.76, but it is not the figure
   the family uses. It is also the measure
   item 7 applies to vacation, so the two entitlements are reduced the same way rather
   than by two rules that disagree for no reason. A holiday can be taken as part of a day, paid in
   the same proportion and drawn from the entitlement in the same proportion. A date can
   be edited, a day beyond the entitlement is refused, and an incomplete selection is
   visible at a glance.

   **A holiday that falls inside a spell of sickness is a sick day and not a holiday.**
   It is drawn from the sick balance with the rest of the spell and is **not** drawn from
   the yearly entitlement, because a day cannot be both taken as a holiday and spent ill,
   and drawing it twice would charge the worker for one day out of two separate quotas.
   The entitlement is not lost by it: the year's holidays are chosen in advance and a date
   can be edited (above), so a family whose holiday fell in the middle of an illness moves
   it to another date and keeps the day. That is the reason this resolves in favour of the
   sick balance rather than the other way round — the holiday is the one of the two that
   can be moved.
11. A worker belongs to a household, never to a person. An account is a person who signs
    in; a household is the group of people who look after the same workers, and it holds
    no more than two workers. Every member of a household sees the same workers, the same
    months and the same balances, and reaches nothing outside the households it belongs
    to. A second person joins by an invitation they accept, which makes them a member
    rather than handing them a copy of a worker — so there is no owner whose leaving
    strands a worker, and no second limit to count a shared worker against. One person
    may belong to more than one household, which is what lets someone keep their own
    caregiver and help with a parent's without either household's limit of two counting
    the other's workers.
12. When a worker's year has no holiday list yet, the application fetches that country's
    list for that year on its own; if the page cannot be reached or publishes nothing,
    it says so and lets the user enter the dates by hand. Nothing about this is tied to
    2026.
13. A month can be corrected after it was exported, and every later month's balances
    follow the correction rather than keeping the old figures.
14. The weekly **rest-eve supplement** is set per worker and can be changed at any time.
    It falls on the working day immediately before the weekly rest day — Friday for the
    Saturday rest day of the common case, and Saturday or Thursday for the other two — and
    it is called the rest-eve supplement rather than the Friday supplement because Friday
    is only where it lands for most workers and not what it is. **Nothing in law requires
    it.** Kol Zchut's caregiver-terms page describes no supplement for the day or the
    evening before the weekly rest, and says of the nearest thing to it that pocket money
    is owed only where the employment contract agreed it. The supplement is therefore paid
    because the family agreed to pay it, and that is recorded here as an agreed term rather
    than a statutory one so a later reader does not go looking for the law behind it.

    **It is paid for every rest-eve of the month, whether she worked that day or not**,
    and it is not conditional on anything: not on attendance, not on sickness, and not on
    a setting. A family that agreed to pay a weekly supplement pays it, and the profile
    changes the amount or stops it altogether when the agreement changes. Nothing in the
    sick-pay tiers of item 8 reaches it, and reading a rest-eve inside a spell of sickness
    at that spell's half rate is the mistake this sentence exists to stop: the tiers price
    the sickness, and the supplement is an agreed term of the employment rather than a
    statutory one.

    **There is deliberately no "is it pocket money?" setting.** There was one, and it
    branched the behaviour: under it a rest-eve she did not work was paid all the same,
    and it dragged criterion 8 into defining a working week so that a week wholly lost to
    sickness could be excepted. It was never a definition — whether a family calls the
    money pocket money is a remark about the money and not a fact that changes what is
    owed. A family that wants a second standing payment adds one of its own under
    item 20, with its own name and its own note, instead of bending this line into
    something it is not. The line may carry a note, which is where a family that thinks of
    it as pocket money writes that down — as the remark it is.
15. Recurring yearly items — the visa fee, the licence renewal, the agency fee, and the
    recuperation payment — are shown as due in the month they fall, without the user
    tracking the dates. The recuperation entitlement is worked out from the worker's
    seniority and offered as a suggestion the user can change before approving, and the
    month it is paid in is set on the worker's profile when the worker is created.
    Nothing is due until a full working year has been completed, and each payment covers
    the year running from one employment anniversary to the next. Recuperation keeps its
    own clock, and deliberately: it is measured from the employment anniversary while
    vacation is measured by the calendar year (item 7), because the two entitlements are
    governed by different rules and each follows its own. The disagreement is the correct
    behaviour, not an oversight in one of them, and it is written down here so that a
    later reader does not "fix" either one into agreement with the other. The recuperation day
    rate is not derived from the monthly salary — nothing in that salary implies it — so
    it is confirmed by the user the way the minimum wage is and stored with the month it
    was used for, which is also what lets a past month be reproduced at its own rate.
16. Payments that go to third parties rather than to the worker — the medical insurance
    premium, the national-insurance contribution, the agency and placement fees, the
    visa and licence fees — are recorded in their own column and are never added into
    the worker's monthly salary total. Neither are any of them taken *out* of it. The
    law permits an employer to deduct part of some of these from the wage — up to half
    the cost of the medical insurance and no more than ₪154.29 a month, and sums for
    lodging and food — and this application deducts none of them, which is what the
    family's own workbook does: the base line of every month tab is labelled
    "משכורת בסיסית ללא הורדות (לינה ,מזון, שתיה,ביטוח רפואי )". A deduction the user
    did not ask for would quietly reduce the wage, and there is no way for her to
    notice a figure that was never shown.
    The sheet holds one row per kind of payment, and a month recording two of the same
    kind is refused rather than merged: two rows under one name can be neither
    overridden nor explained apart (items 17, 24), and merging them would lose the
    months each covers. Two payments of one kind are entered as one summed payment,
    which is what the workbook itself writes.
    **The kinds are the sheet's own rows, and there are seven of them because the sheet
    has two visa rows.** `template_month_standard.xlsx` cell **B14** is the fee for
    extending the work visa and **B15** is `ויזת עובד זר`, the visa itself, which item 28 says
    is issued through the private agency against a charge of its own. They are two
    payments and a month may make both. One name covering both would not merely be a
    missing kind: the rule immediately above refuses two payments of one kind, so a month
    that paid both would be refused outright, with a message telling the family to sum two
    figures their own sheet keeps apart. The extension fee is therefore named for what it
    is — the visa **extension** fee, which is the wording item 28 already uses for B14 —
    and the visa itself is a seventh kind beside it.
    **Each kind is named on screen in the template's own words and never in a paraphrase.**
    Item 2 requires the exported file to carry the same Hebrew labels a month tab carries,
    and a screen that taught the user a different name would send her looking for it on the
    sheet. `דמי השמה` (B12) and `דמי תאגיד` (B13) are two different fees in this
    industry and neither is `דמי תיווך`; B16 is `אגרה להארכת רשיון העסקה` and not a
    licence "renewal" in general. Where the two disagree the template is the authority and
    the interface is what moves, because the family reads the two side by side.
    **A payment records four things and the user has to know none of them by heart:** which
    kind it is, chosen from the kinds this month has not already recorded; how much left the
    account; the months it covers, where those are not simply the month it was paid in; and
    a note, like every other action. **The covered period is a first month and a last month,
    and it is optional** — most payments cover the month they were made in and say nothing.
    Where a kind has a period the application can work out, it is *offered* and not imposed:
    the national insurance is paid once a quarter and in arrears (item 19), so a payment of
    it is offered the quarter that ended before the month it is being recorded in, and the
    user changes it if the family paid late. The offer stops following the kind the moment
    she touches it, exactly as item 20's placement chips stop following the direction. No
    period is derived for the yearly fees, and deriving one would be wrong rather than
    merely unhelpful: item 15's year runs from one employment anniversary to the next, so a
    fee paid in March covers the year *forward* from March while a quarter covers the months
    *behind* it, and one rule cannot serve both.
    **A kind this month has already recorded is not offered a second time.** The refusal
    above is what would answer the click, and a control that answers a click with a refusal
    is a control that should not have been drawn. The refusal stands underneath it all the
    same, in the engine and where the payment is entered, because what the screen offers is
    never the rule (Part 3).
    **A recorded payment is edited in place, and every one of its four things
    may change.** Correcting it by removing it and recording it again is the
    same two refusals read twice and loses the note in between, so the entry is
    reopened with what it holds already in the fields. Changing the *kind* is
    part of that and is checked like any other: the kind it is changed to must be
    one this month has not otherwise recorded, since the sheet still holds one
    row per kind, and the row it leaves behind takes any override addressed to
    the old kind with it, for the reason the removal rule below gives. An amount
    here is edited and never overridden, because the figure is what left the
    account and there is nothing under it for an override to replace (item 17).
    **Removing a payment takes any override on it away with it**, for the reason items 17
    and 20 already give for a line the user added and for an advance movement: an override
    is addressed by the row's own key, and one left behind is an amount waiting to reattach
    itself to a row that never asked for it.
17. Any amount the application worked out for a month can be overridden by the user from
    that month's actions, and the income-tax line is editable in the same way while
    defaulting to zero. An overridden amount is visibly marked as manual and survives
    every later recalculation of that month.
    **The income tax is withheld from the ברוטו and an advance is not**, and the month
    screen draws that difference rather than describing it: the tax comes off the month's
    total and what is left is the נטו, while an advance — and a line the user placed after
    the total (item 20) — comes off the נטו and changes only what is transferred. The
    three figures and the order they are drawn in are given in Part 5.
    **A level is drawn only when something below it changes the figure.** With the tax at
    zero the נטו is the ברוטו, and with nothing transferred the figure paid is the נטו;
    the same number printed twice under two headings reads as an error and sends the user
    looking for a difference that is not there. So a month with neither closes on one
    figure, a month with an advance shows the נטו above it, and only a month that actually
    withholds something shows all three. The figure actually paid is always drawn, because
    it is the screen's answer. This is a rule about the screen and not about the sheet:
    the export prints the sheet's own rows whatever they come to.
    **When two levels collapse, the surviving name is the one that describes what
    actually happened**, which is what keeps the rule from needing a table of cases. The
    two lower names are not interchangeable: נטו is the ברוטו less what was withheld, and
    סך הכל תשלום לעובד/ת is the name of a *difference* — what is left after the advances
    and after a line placed below the total. **A month that transferred nothing has no
    such difference, so its bottom figure is called נטו**, and the second name is not
    borrowed to describe a step that did not happen. So a month with no tax shows נטו and
    not ברוטו; a month that withholds a tax but transfers nothing shows ברוטו, the tax,
    and then נטו; and only a month that actually transfers something carries סך הכל תשלום
    לעובד/ת, where the two figures genuinely are two. Decided with the user on 2026-09-10,
    replacing the earlier rule that the lower name always survived: under that rule the
    same untransferred month was called סך הכל תשלום לעובד/ת on the payslip and נטו on
    `/reports`, which is one figure under two names — the thing this criterion exists to
    prevent, one screen further out.
    **Hiding the zero row moves the tax's explanation and does not delete it.** The rule a
    user needs before typing a figure — the 2.25 credit points below, with its link — is
    attached to the place the figure is *entered*, which this criterion already says is the
    month's actions, and not to a row printed at zero in the preview. A preview that draws
    no row for a tax nobody owes must therefore not be the only place that rule appears, or
    the collapse takes item 26's link with it.
    **Beside the control the rule stands in words, and not behind the "?".** Everywhere
    else an explanation is reached through the button beside a figure (item 24), and this
    one is not: it is what the user has to know *before* she types, and someone who does
    not know it deducts too much. A rule that is merely reachable is reachable by the user
    who already suspects there is something to find, which is the user who did not need it.
    **The figure is typed as what is withheld, and the application gives it its sign** —
    the same rule item 20 states for a line the user adds, for the same reason: a sign the
    user types can disagree with the label beside it, and a tax entered negative would pay
    her instead. A figure of zero is not an entry but the absence of one, and it is what
    every month holds until the user says otherwise.
    Income tax **is** calculated, which it was not until 2026-09-10, and the
    paragraph that said it never would be is replaced rather than qualified. The
    employer deducts on the basis of the wage and of the credits the worker is
    entitled to: the brackets in force during the month, less her credit points at
    the value a point held that year. A legally employed foreign worker in home care
    is entitled to 2.25 points and a woman to half a point more, so a female
    caregiver has 2.75 and a male one 2.25; a foreign worker in another sector has
    one, and an asylum seeker holding a 2א5 permit none, neither of whom this
    application employs. The count is therefore read off the worker's own gender and
    is never a number the family is asked for — someone who does not know the rule
    deducts too much, which is the reason the figure moved out of her hands rather
    than a reason to explain it to her better. The line's explanation still says the
    rule and still links it (items 25, 26), because a figure the application worked
    out is one it has to be able to justify. The derived figure is confirmed before
    every export and is overridable afterwards like any other.
    **What may be overridden is what the application worked out, and what the
    month itself recorded is edited instead.** The two are different gestures and
    naming them apart is what keeps either usable. An override replaces a figure
    the application derived — the salary, the rest-eve supplement, the rest-day
    and holiday pay, the sickness deduction — and leaves the fact behind it
    standing, which is why the row still says what it would otherwise have been.
    A line the user added, an advance movement and a payment to a third party
    carry no derived figure at all: the amount **is** what she typed, so an
    override on one would be a second amount standing in front of the first with
    nothing on screen to say which is which, and the row would be marked manual
    against a figure that was manual already. Those are corrected by **editing
    the entry** — its amount, and everything else it records — which is the
    surface items 16 and 20 each defer to this one.
    **A standing line is on the overridable side, and it is the case that shows
    why the division is not "typed or derived".** Its amount was typed, but it
    was typed on the profile: item 20 says it appears in every month afterwards
    at the same amount, so a month in which the family paid something else has no
    other way to say so — editing it would restate every month, which is the one
    thing a term of the employment must not do. The test is not who typed the
    figure but **where**: an amount this month recorded is edited in this month,
    and an amount that reached this month from somewhere else is overridden in it.
    **The income-tax line is not offered twice.** It is editable in the same way
    — that is this criterion's own first sentence — and the control that edits it
    is the one described above, where its rule stands. Offering it again among
    the overrides would be two controls writing one figure, and a user who set it
    in one place and saw the other still reading zero would have no way to tell
    which the month held.
    **An override is a magnitude and the application gives it its sign**, taken
    from the figure it replaces, which is the rule this criterion already states
    for the income tax and item 20 states for a line the user adds. The sickness
    deduction is the row that proves it is needed: it is a negative amount, and
    an override typed over it without a sign of its own would turn a deduction
    into a payment while looking like an ordinary correction.
    **Zero is an ordinary override**, and here it differs from a line the user
    adds (item 20), which refuses zero because a line that moves no money is not
    a line. A derived figure of zero is a real answer — a month in which the
    family did not pay the rest-eve supplement — and it is the only way to say so
    without pretending the row is absent.
    **Clearing an override is its own gesture and never the typing back of the
    calculated figure.** The two produce the same number and mean opposite
    things: one says "the application is right after all" and leaves the row
    derived, the other stores that number by hand and leaves the row marked
    manual for ever, so a later correction to the wage would move every figure on
    the sheet except that one.
    **An override outlives the row it addresses, which is what "survives every
    later recalculation" means — and it is therefore never stored out of
    sight.** A month whose rest-day work is all unmarked stops drawing a
    rest-day row, and the amount typed over it is still held and comes back with
    the row. So the control lists any override whose row the month no longer
    draws, together with the rows it does, and offers it to be cleared: an
    amount that is stored, will reappear, and cannot be seen is the one failure
    in this criterion that looks like nothing went wrong.
    **Such an override is named by the row's own name as it stood when the
    figure was typed**, kept with the amount rather than looked up. There is no
    row left to read a name off — that is what makes it an orphan — and the
    names of several of these rows are derived from the worker's rest day
    (item 5), so a name worked out afresh would rename an override she set
    years ago the day her rest day changed. The name that is true of the moment
    she chose the figure is the one that lets her recognise it. An override
    stored before the name was kept has none, and is known by its amount and by
    the reason she gave it.
    **The control lives in the additional-payments group** — item 5 puts it
    there with the advances, the income tax and the user's own lines, and item 5
    puts that group on the payments screen. So that screen sees the month's
    derived figures, which is what an override addresses; it is the one thing on
    it that is not simply an amount somebody typed.
18. Exporting begins with a short set of confirmation questions covering everything that
    changes the month — whether an advance was given, whether an instalment is being
    repaid, whether a rest day was free, which holidays were worked, whether there were
    vacation days, whether there were sick days, and whether anything was paid to
    somebody other than the worker — so nothing is left out by silence.
    **Each question shows the month's own dates and amounts, not only a count**: the
    days the calendar holds for it, and the sums the payments screen holds. Added on
    2026-09-10, and it is what makes the set a confirmation of the month rather than of
    its totals — a count is a figure a family agrees with while the days sit on the wrong
    dates, and it is the dates she actually remembers. The screen is therefore also the
    summary of the month it is about, which is the second thing it is for: what was
    forgotten is visible as an absence.
    Where the month holds a spell of sickness still open (item 8), the question is the
    specific one: has she returned, and on what day. A month is not exported over an unanswered open spell, because the one
    thing an open spell can get wrong is counting days for a worker who was already back.
19. The national-insurance contribution is 3.6% of the month's full cost, taken before
    anything to do with advances. Kol Zchut settles what that cost is, so it is no
    longer inferred from the workbook: the base is the gross wage including sick pay,
    vacation pay, holiday pay, recuperation, travel reimbursement and the premium for
    work in the weekly rest. In this application that is columns E, F and G together
    and nothing else. Three of those six are already inside the monthly salary rather
    than beside it — the base is computed from the standard count and never shrinks, so
    a day of vacation, of sickness or of holiday not worked is paid within it (items 5,
    7, 8) — which is why the sheet carries no vacation *payment* line and still bases the
    contribution correctly. Its vacation row reports a count and no money (item 7), so it
    reaches neither column E nor this base; a figure written there would enlarge the
    contribution by a day the salary has already paid for. What is missing from the base is what the worker was not
    paid: the third-party column, which is money to somebody else (item 16), and the
    advances, which are the same money moved in time. It is shown as an
    estimate to be confirmed rather than as a fact, because the sum actually billed has
    differed from it. Every month carries its own estimate, and the money actually paid
    appears only in the month it was paid, together with the months it covers. These are
    two different figures in two different columns and not one figure written twice: the
    first is what the month accrued, the second is what left the account. The family's
    workbook keeps them in two cells and the export follows it: in
    `שכר_חודשי_להאנה2025.xlsx` → `חודש  8.25` the estimate is D21 and H21 is empty,
    because August settled no quarter, while in `חודש  7.25` D21 carries the same
    monthly figure and H21 the ₪936 paid on 20.7.25 for 4-6/25, with B21 naming those
    months. So the estimate is a reported figure in the unit-price column and never a
    payment line — nothing in the sheet sums column D — and only what left the account
    is added into the third-party total.
    It is paid once a quarter and in arrears: the reminder
    appears on the opening screen in the month after the last covered month has ended,
    and stays there until the user ticks the payment as made. The export carries the
    amount that was due, that tick, and the months the payment covers. The licence
    renewal that falls once every four years is recorded the same way, and the
    application warns before either runs out.
20. The user can add lines of their own to a month, with a reason of their own, and each
    appears as its own line in the export — which is how a shortfall from an earlier
    month is settled later. A line the user adds has **three independent choices** and
    every combination of them is meant:

    - **Which way it moves.** An *addition* is money that reaches the worker; a
      *deduction* is money withheld from what is transferred to her. The sign follows
      from what the line is, so it can never disagree with the label beside it, and the
      user picks the kind rather than typing a minus.
    - **How long it lasts.** A *one-off* line belongs to one month. A *standing* line is
      set once on the profile and appears in every month afterwards, at the same amount,
      until the user changes it or stops it. A standing line is a term of the employment
      and is snapshotted onto the month like every other term (Part 3), so stopping it in
      June leaves the earlier months exactly as they were.
    - **Where it sits: before the month's total, or after it.** This is the user's own
      choice on every line, and it is not implied by the direction. A line placed
      *before* is part of what the month came to — it enters the month's total and with it
      the national-insurance estimate, which is 3.6% of the month's full cost (item 19). A
      line placed *after* changes only what is transferred at the end, and reaches neither.
      **The two are different money and the difference is real**, which is why the
      application asks rather than deciding: a standing payment the family agreed as part
      of the wage belongs inside the month's cost, while a sum handed over on the side does
      not, and no rule the application could apply would tell them apart.

    **Where each lands on the sheet.** A line placed *before* the month's total needs a
    column, and which one follows from how long it lasts: a standing line sits in column E
    beside the salary and the rest-eve supplement, because that is where what she earns
    every month lives, and a one-off line sits in column G, which is what that column is
    for. A line placed *after* goes to the block below the columns, beside the income tax
    and the advance instalment — that block is where everything on the way from the
    month's total to the figure actually transferred already lives, and it already grows
    with however many rows the month has.

    **On the month screen that block has two halves and the line sits in the lower one**,
    with the advances and not with the income tax. The screen shows three figures where
    the sheet shows two (Part 5, item 17): the tax is withheld from the ברוטו and what is
    left is the נטו, while a line placed after the total does what this criterion already
    says it does — it "changes only what is transferred at the end" and reaches neither
    the month's cost nor item 19's estimate, which is the same sentence as an advance and
    not the same as a withholding. So it comes off the נטו and never moves it. The sheet
    is unaffected: it has one block below the columns and the line is in it.

    **The application defaults the placement and lets the user move it.** An addition
    defaults to *before* and a deduction to *after*, which is where each usually belongs
    and which is what the user would have chosen without being asked; the choice is
    offered beside the line and never demanded of someone who does not want it. The
    default is not a rule, and the two combinations it does not produce are ordinary: an
    addition after the total is a payment that is not part of the month's cost, and a
    deduction before it is one the wage itself is meant to be net of.

    **The month's preview summarises them and the payments screen itemises them, and so
    does the export.** The two answer different questions and now sit on different screens
    (item 5). The preview answers "what did this month come to", which nine rows answer
    worse than one. The payments screen is where the lines are *made*, and a control
    surface that hides what it has already recorded cannot be used — a user who cannot see
    the line she just added adds it a second time. So it lists that month's own lines, each
    with its reason, its direction and the side of the total it sits on, and each can be
    removed from there. **Removing a line takes any
    manual override on it away with it** (item 17): an override is addressed by the line's
    own key, and a key with nothing behind it is an amount waiting to reattach itself to a
    line that never asked for it.
    **A line is edited in place and not removed and re-added**, and all four of
    the things it records may change — the words, the amount, the direction and
    the placement. Removing and adding again would lose the note and mint a new
    id, and the id is what the line's own key is built from (item 17), so a
    reader looking for the line she corrected would find one that had never
    existed before. Its amount is edited and never overridden, for the reason
    item 17 gives: what is written on a one-off line is the figure itself, and
    nothing under it was derived.
    However many lines a month carries, the preview shows one row for the ones
    placed before the total and one for the ones placed after it, each holding the sum of
    its own and carrying a single heading that covers both directions — a group's sum may
    therefore come out either way, and the heading says "added and withheld" rather than
    naming one of them. The full list, line by line with the reason on each, is on the
    payments screen and in the exported file. The two rows are not a saving of space but a
    division of labour: the preview answers "what did this month come to", and a
    month with nine added lines answers it worse by printing nine of them, while the
    document that must account for each one is the sheet. That the export itemises is
    therefore not a preference here but the requirement of item 2 — the payslip shows every
    payment as its type, its number of units and its amount — and a summarised row in the
    file would breach it.

    **This is what a family uses instead of bending another line into a shape it is not**,
    and the direction follows from the agreement rather than from what the money is
    called. Money handed over during the month that the salary already contains is a
    deduction — the gross holds it and the transfer at month end is what shrinks — while a
    payment the family agreed *on top of* the salary is an addition. Reading the first as
    the second pays it twice, once inside the salary and once beside it.

    Every one of these carries a free-text note, because the reason is the part the
    application cannot derive and the part a later reader needs.

    Advances are numbered and tracked one by one, and stay their own mechanism rather than
    becoming standing deductions: a month may both grant one advance and repay another,
    each on its own line, the amount repaid is entered for the month rather than fixed by
    a schedule, and what is still owed is carried from the opening position (item 6). A
    repayment that varies month by month is exactly what a standing line cannot express.

    **The number is the application's and is never typed.** It is minted in order — one
    past the highest the worker already carries, the opening position's included — so the
    user chooses which advance she is repaying from the advances she has, and never has to
    know or remember a number (Part 1: the option that requires the user to know less). It
    is the workbook's own number and it is what the closing block's rows are addressed by,
    so it belongs to the worker for the life of the employment and is never reused.

    **What is still owed is a fact about the whole employment and not about a month.** It
    is the advance's principal less every repayment recorded against it in any month, which
    is why it cannot be read off the month being edited: a repayment entered in June is
    still a repayment of an advance granted in February. From it follow three refusals, and
    each says which:

    - **A repayment may not exceed what is still owed.** Over-repaying is not an advance
      at all — money withheld beyond the debt is a deduction, which item 20's own lines
      already express — and an advance that has been repaid twice over leaves a negative
      balance no screen has a way to name.
    - **A repayment may not name an advance that had not been given yet.** The month it
      was granted in is the first month it can be repaid in; an advance carried in from the
      opening position was given before the application existed and may be repaid in any
      month.
    - **One movement of a kind per advance per month.** Two repayments of one advance in a
      single month are entered as one summed repayment, which is what item 16 already says
      for two payments of one kind to a third party, and for the same reason: the two rows
      would share a key, so neither could be overridden or explained apart from the other
      (items 17, 24).

    **The first two are refused where the figure is entered and not inside the month's
    calculation**, which is the one place this differs from item 16's pair. What is owed
    can only be counted by walking the worker's months, and a month refused by the engine
    stops the replay that produces every later month's balances (item 13) — so an
    over-repayment that reached storage would close the screen it would have to be
    corrected on. The third is refused in both places, because it is a fact about one month
    and the engine can see it.

    **Removing a movement takes any override on it away with it**, for the reason already
    given above for a line the user added: an override is addressed by the row's own key
    (item 17), and one left behind is an amount waiting to reattach itself to a row that
    never asked for it.
21. A future month can be filled in ahead of time through the calendar, but it can only
    be exported once it has ended.
22. Reading the identifying columns straight out of the database shows unreadable values;
    the real numbers appear only on the worker's own screen and in the export. The
    columns are the passport number, the bank account number, the employment permit
    number and the work visa number — **four in all**. This said five until 2026-09-10,
    which counted the passport twice: it is one of the three documents of criterion 28
    *and* the number written into the sheet's identity line, and a passport carries one
    number for both. The expiry dates beside those document numbers are deliberately
    **not** among them, for the reason criterion 28 gives.
23. The balances can be exported on their own as a yearly table — a row per month with
    the accrual, what was used, and the closing balance, kept separate for vacation and
    for sick days — so whoever turns the sheet into a payslip can check the figures. It
    is a separate file, produced on request, and leaves the monthly export untouched.
24. Any figure the application worked out can be opened to show how it was reached, in
    words rather than as a formula, so a user who wants to follow the reasoning can,
    while a user who does not never has to read arithmetic to use the application. These
    explanations, with the reference links beside them, stay beside the figure they
    explain and are never restated in a manual. A single help screen may sit alongside
    them, but it holds no explanation of its own: it points at the explanation, the
    reference link, or the screen that settles the question, so a given answer is
    written in exactly one place and a page that moves is fixed there.
25. A refusal carries the same link as the action it refused. A user who has been
    stopped is exactly the user who wants to know why, and a refusal is the moment the
    application can least afford to be taken on its word: it has just told her she may
    not do something. The reference therefore belongs to the refusal itself rather than
    to a screen that assembles one beside it, for item 24's reason — a thing is
    explained where it happens — and every refusal the engine can produce resolves to
    one of the pages of item 26: a holiday refused points at the holiday rule, a free
    rest day refused at the weekly rest, sick days beyond the balance at the sick-pay
    rule. A refusal with no link is a refusal the user can only argue with.
    **This is a rule about refusals that rest on a legal rule, which is what gives them a
    page to point at.** A refusal about the *form* of an entry carries none, because there
    is none: an empty field, an amount that is not a number, a choice outside the two the
    application offers. Nothing in law says a line must be given a name before it can be
    added — the application says it, because it cannot show the user a line with nothing
    written on it. Such a refusal owes her the reason and not a reference, and inventing a
    link for it would send her to a page that does not mention what stopped her, which is
    worse than the sentence alone. The test is item 26's own: a refusal carries a link
    exactly where the action it refused would have carried one.
26. Every action that rests on a legal rule carries a link to the page that states it —
    the minimum wage, the rest-day and holiday premium, annual leave, sick pay,
    recuperation, national insurance — so a user who wants to check a figure can read
    the rule rather than take the application's word for it.
27. The opening screen leads with the things that need the user to do something — a
    quarterly national-insurance payment due, one of the three documents of item 28 or
    the medical insurance about to expire, an advance still being repaid, holidays not yet all chosen, recuperation due
    this month, a year passing with no vacation taken, a finished month not yet
    exported, a minimum wage that changed since the last export, and a worker crossing
    into a new year of seniority. Beside that list it may also carry the current month's
    calendar, the month's totals, and the vacation and sick balances, so the month can be
    marked and read where the application opens rather than one screen further in. What
    needs doing comes first, and nothing else joins them: a running figure earns its
    place on this screen only by being one the user came to see.
    Two lists, not one, and the split is by urgency rather than by kind. The **bell**
    carries what is *about to* lapse and still has time in it — a document nearing its
    expiry, a recuperation month approaching, a seniority year about to turn. The list on
    the opening screen itself carries what has **already** lapsed or what the application
    needs from the user before it can calculate a full salary at all — an expired
    document, holidays not yet chosen, a minimum wage awaiting confirmation, a month whose
    facts are incomplete. The test that decides which list an item belongs to is whether
    the salary can be produced correctly today without it: if it can, the item is a
    warning and belongs in the bell; if it cannot, it is a blockage and belongs on the
    screen. Neither list is a notification that leaves the application: nothing is sent by
    mail or by push in this version.
28. A worker's employment rests on **three separate documents with three separate
    expiry dates**, and the application holds each with its own number and its own date.
    They are not one thing under different names, and the law makes both of the first two
    conditions at once: employing a foreign worker without an **employment permit**
    (היתר העסקה), which belongs to the *employer* — the person being cared for — and is
    renewed by the employer's own online application to the Population and Immigration
    Authority, is forbidden; and so is employing one without a **work visa** (אשרת עבודה,
    B/1), which belongs to the *worker* and is issued and renewed through the private
    agency against a fee. The third is the **passport**, which the employer is obliged to
    check stays valid, and for which the threshold is not expiry but **eighteen months
    remaining** — so the application warns when fewer than eighteen months are left on it,
    not when it lapses. Each of the two renewal fees is recorded as an ordinary payment to
    a third party (item 16), and they are two fees and not one: the family's workbook has
    carried them as separate lines all along — `template_month` cell **B14** is the visa
    extension fee, belonging to the worker's visa, and cell **B16** is the licence fee,
    belonging to the employer's permit. The sheet always knew the distinction; it simply
    never wrote it down. Because the permit belongs to the employer and the visa to the
    worker, a household with two workers holds one permit position and two visas. Of
    the three **numbers**, the permit's and the visa's are encrypted at rest beside the
    passport and bank account numbers of item 22, and the passport's *is* that item's
    passport number rather than a fourth one — so the encrypted columns are four and not
    five. The three **expiry dates are not** encrypted. A date identifies nobody, and the
    warnings of item 27 have to find what is coming due — an encrypted date cannot be
    queried or indexed, so the bell would have to decrypt every worker's three dates on
    every load to discover it has nothing to say.

29. The user can download a salary summary for one worker and one year — that year's
    months with their totals — so a family keeps a copy of what the application holds
    without depending on it staying available. It is downloaded a year at a time and never
    every year at once, so the file stays one a person can read. It carries no passport
    number and no bank account number: those are shown on the screen that needs them and
    are not written into a file that leaves the application (item 22).

## Part 3 — Architectural guidance

The application separates browser, server, and database. All salary logic runs on the
server; the browser only collects facts and displays results. Isolation is enforced in the
database rather than only in the interface, so a user reaches their own workers and nothing
else even when a request is crafted by hand. The unit of isolation is the **household** and
not the account (criterion 11): a worker belongs to a household, a person may belong to
more than one, and every rule in the database is written against the households a person
belongs to rather than against the person. Writing it against the account instead is the
mistake that makes a shared worker either invisible to the second member or visible to
everyone.

One calculation path serves both the on-screen preview and the export, so the numbers a
user sees before exporting are the numbers in the file. Each month record stores two wage
figures: the minimum wage confirmed for it, and the base monthly salary the rates are
derived from, copied off the profile at the moment the month was confirmed. They are
usually the same number and are not the same field — the salary may sit above the minimum
wage and never below it (criterion 3), so rates that followed the minimum wage would be
wrong for every family paying more than it. Storing the salary with the month is what lets
re-exporting a past month years later reproduce that month rather than recalculate it at
today's rates; the rates themselves are re-derived from that stored salary rather than
stored beside it, since a stored result is a second calculation path and would drift from
the first the day the engine is corrected.

**Balances are derived the same way and for the same reason: by replaying the worker's
months from the opening position, never by storing a running total.** The database holds a
worker's facts and no balance of any kind. This is what makes criterion 13 hold without a
mechanism of its own — a month corrected years later moves every later month's balances
because those balances were never anything but a replay, so there is no stored figure to
find and invalidate. The cost is honest and small: replaying twenty years of a worker's
months takes tens of milliseconds, less than the single round trip that fetches them, and a
live-in employment rarely reaches half that. Should a cache ever be wanted it belongs in
front of the replay and not instead of it, because a cache that can be deleted without
consequence is safe and a stored balance that is the only copy is not.

**The replay belongs to the calculation and not to the store.** The store hands over the
worker's months in date order and knows nothing of what they add up to; one pure function
walks them, opening each month with the closing figures of the month before it and carrying
into it what the calendar year has already spent — the vacation days the seven-day question
is asked of, and the holiday days the yearly entitlement is drawn against. Both of those
reset at January and neither is visible to a month looking only at itself, which is the
whole reason the walk exists. It walks the months the store holds and invents none: a month
that was never recorded accrued nothing, because the accrual is a fact about a month that
happened and not about a gap in a list. A month asked for on its own is still calculable
and is read as the worker's and the year's first, which is what keeps a single month's
preview honest before any history exists.

**The same reasoning governs every other term of the employment, so the month stores all
of them and not the wage alone.** The weekly rest day, the rest-eve supplement, the
recuperation month, and any entitlement the user edited are copied onto the month when it
is confirmed, exactly as the salary is. Terms are read off the month and never off the
profile, so re-exporting August two years later reproduces August: a family that moves the
rest day from Saturday to Sunday in June does not thereby turn every earlier month's
Saturdays into Sundays. This is what makes criterion 13 safe rather than dangerous — a
corrected month is replayed against **its own** stored terms, so the correction moves the
figures the correction touched and nothing else. Terms are not stored per month as an
alternative to freezing the month: the month is never frozen, because criterion 13 requires
it to stay correctable.

The export is produced by filling a stored .xlsx template modelled on the 2026 workbook,
which is the canonical reference for layout and wording; earlier years are historical
only. No worker's name or details survive anywhere in a template, including inside a
sentence: every such place is a placeholder the export fills, so a template can never
carry one family's data into another's sheet. **The weekly rest day is one of those
details, and the month template names it in nine of its own labels** — `E1` and the two
day counts `B33` and `B34` all say "not including Saturdays"; `G1`, `B9`, `B24` and the
total sentence in `A26` all say "Saturdays"; `F5` says "a holiday or a Saturday"; and `B7`
names Fridays for the weekly supplement. Every one of those becomes a placeholder filled
from the month's stored rest day, so a worker whose rest day is Friday receives a sheet
that says Friday throughout and counts her Fridays, and Hanna's sheet is unchanged word
for word. There is **one** template and not one per rest day: three templates would be
three copies of a layout that must not diverge, and the rule below that a layout change is
a template change would then mean making it three times. The closing block is built from however many advance lines the month has — one for
each advance granted and each instalment repaid, numbered as in the workbook — rather
than from a fixed set of variants.

**The sheet grows with the month, and its own sums grow with it.** The closing block is
not the only region that varies: a month may carry any number of lines the user added
(item 20), and each one is a row the template does not hold in advance. The export
therefore inserts the rows it needs, in the column or the block the line belongs to, and
**the totals stay live formulas whose ranges expand to cover what was inserted**. A sheet
whose figures are right only because the engine wrote them is a sheet that becomes wrong
the moment somebody edits a cell — and the family's own workbook is a live spreadsheet
today, so handing them a dead one would be a step back from what they already have. Both
column subtotals, the month's total and the figure actually paid are formulas over ranges,
not written numbers.

That makes the engine and the sheet two ways of reaching the same figure, so **the test is
that they agree**: the amount the engine computed and the amount the spreadsheet's own
formula produces must be equal, for a month with lines added and for one without. It is
the same argument that already binds the preview to the export, applied one layer further
down, and it is the only check that catches a range that failed to grow — a `SUM` one row
short prints a total that is wrong by exactly one line and looks entirely ordinary.

A layout change is a template change and not a code change, and inserting a row is not a
layout change: the template still owns what a row **looks like**, and the code decides
only **how many** there are. A row the code inserts is a copy of a row the template
already designed. If a row has to look like nothing already in the workbook, that is a
template change and belongs in the .xlsx. The employer
of record is the person being cared for; whoever actually transfers the money is not a
field of its own and can be written in the note attached to the relevant action. The
template and the per-country
holiday lists are data-only files: the code reads them, and they carry no rules, prose, or
instructions.

Passport numbers and bank account numbers are stored encrypted, never in readable form.
They are decrypted on the server only at the moment they are shown to their own account
or written into an export, and the key lives outside the database, so a copy of the
database on its own reveals nothing. These values never appear in a log, in a URL, or in
anything sent to the browser beyond the screen that needs them. Holiday lists are fetched per country and per year from
the published caregiver holiday pages, whose addresses follow a fixed pattern of country
code and year, and are cached once fetched; the files that ship with the application are
seed data for years already gathered, not the only years it can ever know. A worker's
own chosen dates are stored against the worker and are never overwritten by a later
fetch.

The worker's name is written into the export in Hebrew only, never with a Latin
transliteration beside it, so a line of Hebrew is never broken up by a run in another
script. Wording that names the worker by gender is filled from the profile rather than
fixed in the template, so a sheet never calls a man a woman.

A spell of sickness is stored as the dates it ran between, not as marks belonging to a
month, because its tiers are counted from its own first day and a spell that begins in
one month and ends in the next must be read as one thing.

**Every span belongs to the worker rather than to a month, and a month's facts are
assembled from the spans that overlap it.** A spell crossing a boundary reaches both
months whole — which is what lets each of them place a day at its right tier — and each
month draws from the balance only the days that fell inside it. Storing a copy of the
spell against each month would say the same thing twice, and closing it would then have to
find every copy. An open spell overlaps every month from the one it began in onward, so a
spell nobody closed goes on drawing sick days month after month: that is what an unclosed
spell means and the application says so rather than quietly deciding she recovered, since
the only thing that ends a spell is the worker coming back. It does not run away
unnoticed, because it runs into the floor — once the days it draws pass the sick balance
the month is refused with its reason rather than over-drawn (item 8), so a spell left open
by mistake announces itself as a month that will not calculate instead of as a salary
quietly short.

External data is never load-bearing. The minimum wage is read from the Kol Zchut
minimum-wage page (https://www.kolzchut.org.il/he/שכר_מינימום), which publishes both the
figure and the date it takes effect, so a month is always valued at the rate in force
during it.

**Both halves of that sentence are stored, and they are stored for every undeliverable
rate rather than for the wage alone** (criterion 4). The store holds one dated-rates
table — which rate, the figure, the date it took effect, and the source it came from —
and the engine asks it for the figure in force during the month it is calculating, never
for the latest one. The national-insurance percentage belongs in it beside the minimum
wage: it is set by the state and changes on a date, and it is today a constant in the code
with no date at all. The table is **seeded** with what is known and a fetch updates it, so
the application works before any fetch has ever succeeded and a failed one leaves a dated
figure standing rather than nothing (the degradation this Part already requires). Nothing
that can be derived from the base monthly salary goes in it — item 3 requires those to be
derived — so it stays the short list of figures the application takes from outside itself.
 The same source supplies the reference links shown beside the actions, kept
in one list rather than scattered through the interface, so a page that moves is fixed
in a single place. The cached figure is shown first and a fetch runs behind it, so a slow
or broken source never delays a screen. **The text of a fetched page is kept beside the
figure taken from it rather than thrown away**, and it is kept **segmented by the page's own
headings** rather than as one block. The help screen answers out of that text, and a corpus
discarded here would have to be scraped a second time to get it back; segmenting it at the
moment of the fetch is what lets a question, a reference link and a stored section resolve
to the same unit, since the reference links already point at sections of a page rather than
at whole pages. Anything scraped is checked for plausibility
before it is offered to the
user — a wage far outside the range of recent years, or a holiday list of implausible
length, is treated as a failed fetch rather than a new fact. A failed fetch degrades to
the last confirmed figure plus manual entry, and never blocks an export.

**The range a fetched wage is judged against is the dated-rates table's own history and
never a figure written into the code** (decided 2026-09-09). The comparison is with the row
already in force on the *fetched figure's own* effective date, not with the latest row the
table holds: those are two different rows whenever a figure arrives dated to a month that
has already passed, and judging against the latest would refuse it for having fallen. A
fetched wage below the one standing on its own date, or more than double it, is a failed
fetch — the first is what reading the hourly rate in place of the monthly one produces, the
second what a lost decimal point does, and no real rise has ever come near either bound. A
ratio is not a rate: it values no month and enters no calculation, which is why it may sit
in the code where criterion 4's figures may not.

**A fetched holiday list is judged the same way, against the same source's own nearest
stored year** (decided with the user on 2026-09-09). A list of no holidays at all is a
failed fetch and never a year without any: the source answers an address it does not know
with a page whose heading names no country and which carries no rows, which is exactly what
a mistyped country code produces, and believing it would record "this country publishes no
holidays" — a mistake that surfaces half a year later, the first time someone adds a worker
from that country. Beyond that, a list is disbelieved when it is under half or over twice
the count of the nearest year already stored for the same source. **A source with no other
stored year is believed if it is not empty**, and that is the one place this rule and the
wage's differ: the dated-rates table always ships seeded, so a wage with no row to judge
against means a page that has moved backwards, while a country nobody has fetched before
and every one of the religious lists genuinely has no history — and item 12 requires a year
with no list to fill itself, which refusing the first fetch would make impossible.

**A page with no rows is not one failure but two, and the user is told which.** A heading
that names no country is an address the source does not know, and the list exists elsewhere;
a heading that names the country over a page with no rows is markup that has moved, and the
defect is in this application. Only one of the two is anyone's to fix here, and collapsing
them sends whoever reads the log to the wrong place.

**A failed fetch says which of the three failures happened and not merely that it failed**
— the source could not be reached, the page arrived and the statement was not in it, or the
figure was read and disbelieved. The user is told which, because they mean different things
to her: the first may work in a minute, the second is a defect in this application, and the
third means the page and this application disagree about a number.

## Part 4 — Validation approach

The known case is August 2025: a worker paid the minimum wage, employed since 1.4.2024,
in a 31-day month with 26 working days, five Fridays worked, four Saturdays worked, one
free Saturday on the 16th, and two paid holidays on the 19th and the 21st, while a
₪10,000 advance from an earlier month is repaid at ₪2,000 a month. The advance and the
balances it starts from are entered once as the worker's opening position, since neither
originates inside the application. Entering only those
facts must produce a base of ₪6,247.65 plus a Friday supplement of ₪500, giving
₪6,747.65; two holidays and four Saturdays at ₪426.35, giving ₪2,558.10; a gross of
₪9,305.75; and ₪7,305.75 after the advance instalment. Every figure must match to the
agora, with no tolerance.

The deliberately invalid case is a paid holiday landing on a free Saturday: the user
records the 16th as a Saturday the worker had off, then tries to mark the same date as
one of her paid holidays. The application must refuse the second entry and explain why,
rather than paying both the rest-day rate and the holiday rate for a single day. The
same refusal covers a tenth paid holiday within a year, and a date carrying more than
one entry at all — a day recorded as both sick and worked as a holiday, or recorded
twice over. The second of those is a contradiction the application cannot resolve: she
cannot have been absent ill and at work on the same day, and choosing one reading
silently would produce a figure that looks entirely ordinary. Left unrefused it costs a
rest day — a spell of sickness covering a Saturday that is also marked as a holiday
worked makes the sheet report three Saturdays where she worked four, because the
holiday is subtracted from a count sickness had already reduced.

A count of worked Saturdays higher than the number of Saturdays in the month is **not**
among the refusals, and its absence is a decision rather than an omission. That count is
filtered from the calendar's own Saturdays rather than read from a number, so no stored
data can produce one: the guarantee holds by construction and a check for it would be
unreachable code pretending to be a safeguard. The failure mode is real in the family's
workbook, where the figure is typed — G2 of `שכר_חודשי_להאנה2025.xlsx` → `חודש  8.25` —
and deriving it moved the danger rather than removing it, because the holiday count is
the one the calendar does not bound. That is where the refusal above now sits.

Every refusal is made in the calculation engine and not only on the screen that draws
the calendar, and `calculateMonth` throws rather than returning them, so a caller that
ignores the refusals cannot receive a number instead. The calendar is one caller; the
repository and the export are others, and a rule enforced only where the user happens to
be looking is a rule the stored data can walk around.

The two cases above check the calculation, which is deterministic and fails loudly. The
fetched pages are neither, so they are checked a third way: by being handed a broken
answer on purpose. A saved copy of each source page is kept beside the parser as a
fixture, together with three spoiled versions of it — one whose markup has moved so that
nothing is found, one that returns an error or an empty body, and one that yields a
figure outside the plausible range. Each must end with the application saying which of
the three happened and leaving the user able to continue by hand, and none may end with a
number that merely looks right. This is what separates a failure from a wrong answer
presented as a result, and a scraper is only ever checked against a page that has already
changed once.

### What a test has to prove

Tests verify actual behavior and results, never merely that code runs. For every
meaningful feature or change:

- Assert the **correct result**, against a value derived independently of the code under
  test — from this specification, a verified workbook cell, a fixed fixture, or an
  arithmetic worked by hand. **Never from what the implementation returned**, or the suite
  proves only that the engine agrees with itself and fails the day the bug is corrected.
- Include realistic cases and at least one case a likely implementation mistake would
  fail. A test every plausible wrong version also passes is a test that measures nothing.
- A bug fix carries a regression test.
- Salary calculations and exports verify actual values, rows and balances — never merely
  that an `.xlsx` file was produced.

### Verifying through the browser

The important user-facing flows are exercised through the running application as a user
meets them, and not by calling the functions underneath. A flow assembled from unit tests
that each pass is a flow nobody has ever performed: the wiring between them is exactly
where it breaks, and it is invisible to both halves.

- Open the real site and use its real navigation, inputs, calendar, buttons,
  confirmations and export flow, with realistic data, through the whole workflow.
- Verify both what the screen displays and what the calculation came to. A browser test is
  not successful because the page loaded, a button clicked, or a file appeared.
- Where a month is exported, open the file and check its values against the screen and
  against the expected figures. The preview and the export are one calculation shown
  twice (Part 3), so a test that reads both must find them equal.
- Capture screenshots at meaningful checkpoints — an important state change, and before
  and after an export — and not after every click. A screenshot supplements an assertion
  and never replaces one.
- Cover the edge cases where they are relevant: partial days, sickness across a month
  boundary, sickness on a holiday, a holiday on a rest day, advances, manual overrides, a
  minimum wage that changed, a failed fetch, an unanswered pre-export question, a
  correction to a past month, and a future month.

For an important test, record the scenario, the data used, the expected result, the actual
result, and what incorrect behavior the test would catch — the last of these is what
separates a test from a demonstration.

## Part 5 — Known pitfalls

A holiday list for a new year is found by taking the source address already stored with
that country's list and changing the year in it, never by rebuilding the address from the
country code. A stored address carries more than the code: Nepal's list is published under
`/en/` while every other shipped list is under `/he/`, so an address assembled from the code
would quietly change the path along with the year. It returns nothing, which reads exactly
like a country that publishes no holidays at all, and the failure would surface half a year
later, the first time someone adds a worker from that country.

The balances tab rounds inconsistently and should not be copied. In
`שכר_חודשי_להאנה2026.xlsx` → `חישוב ימי מחלה וחופשה` the monthly vacation accrual is written as
1.17 in January to March and as fourteen twelfths from April onward, in the same column.
Use the fraction throughout, or a balance drifts by a hundredth of a day a year and the
figures stop tying out against the workbook for reasons no one can find later.

The helper column of notes is not a source for figures either, and the same workbook
shows why. Cell I9 of `שכר_חודשי_להאנה2024.xlsx` → `חודש  12.24` works the holiday
entitlement out correctly — "בגין חודשים 4-12/24 (9 חודשים) זכאית ל (9*9)/12 = 6.75 ימי
חג" — and then, in the same sentence, says the payment is for 9.75 days. The note
contradicts itself; the sheet paid 6.75, at 6.75 × 401.25 in F9. **Where a note and an
amount disagree, the amount is what happened.** Those notes were written by hand and were
never checked against the formulas beside them, so they are a good source for intent —
why a figure was chosen, which rule it rests on, what was agreed — and a poor one for the
figure itself. Read them for the reasoning and take the numbers from the cells.

Right-to-left is not only a matter of alignment, and its failures are quiet. A browser
reorders mixed runs of Hebrew and Latin text, so a month range, a passport number, or a
worker's name written partly in each script can appear with its pieces in the wrong
order — exactly where it matters most, in the national-insurance reminder and in the
identity block of the export. Isolate every number, date, range, and identifier rather
than trusting the surrounding paragraph. The calendar is reversed twice over: the week
begins on Sunday and Sunday sits on the right, so a component built for a
left-to-right week shifts every day by one, which looks plausible on screen and is
wrong. Use logical direction properties throughout so nothing has to be mirrored by
hand, and mirror the icons that carry direction. The exported workbook has its own
direction flag: filling the stored template preserves it, while building a sheet from
scratch produces a file that opens left-to-right and reads as a foreign document to the
family.

Counting the days of a month is where a quiet, systematic error is easiest to make.
Build dates without a local time zone, because a date constructed in local time can
shift by a whole day across a daylight-saving boundary and silently change how many
Saturdays a month has. Check the day of the week deliberately as well: in JavaScript
Saturday is six, not five, and being one off there corrupts every month of the year
rather than announcing itself. A thirty-one-day month beginning on a Saturday holds five
Saturdays and twenty-six working days, while the same length beginning on a Sunday holds
four and twenty-seven; both still pay a whole salary, so the mistake stays invisible
until a month with an absence in it.

The month sheet's columns are not interchangeable, and only three of them reach the
worker. Column E carries the monthly salary items, F the pay for rest days and holidays,
and G the one-off payments such as recuperation and hospital overtime — not vacation,
which is never paid as a line at all (item 7); the month's total is the sum of those three
alone. **That total is named the `gross`, and what is left after the closing block is the
`net`** — the two figures Part 4 gives for August 2025 as ₪9,305.75 and ₪7,305.75 without
naming either. They are written down here because the export and the on-screen preview are
two views of one calculation and must call the same figure by the same word; two names for
one number is how the sheet and the screen begin to disagree while both are right. The
income-tax line sits in the closing block and not in column E, so it reduces the net and
never the gross: the gross is what she earned, the net is what she is handed.

**In Hebrew there are three figures and not two, and `net` is not נטו.** The user's own
words are ברוטו for the month's total and סך הכל תשלום לעובד/ת for the figure actually
transferred, which are the code's `gross` and `net`. On the sheet those two are **labels
in one cell and money in another**: `A26` (ד) and `B29` carry the Hebrew, and the figures
they name are one column over in `E26` and `E29`. **Neither row number is fixed and the
second one moves the most** — the block at the foot of the sheet grows by a row for every
advance granted, every instalment repaid and every line the user added, so the transferred
total sits at row 29 only in the simplest month and at row 31 in a month with two advances.
It is therefore found **by its own label** and never by a row number, which is what
`layoutOf` in `src/lib/export/layout.ts` derives and what the export's tests read. Corrected
on 2026-09-10: the cells had been cited as `A26` and `B29` alone, which names the words
rather than the numbers and fixes a row that moves.
Between them stands the נטו — the ברוטו less what was **withheld from it**, today the
income-tax line and nothing else — which the sheet has no cell for and the code therefore
names `afterWithholding` rather than `net`. That the English `net` and the Hebrew נטו name
different figures is a trap and is written here so that nobody resolves it by renaming one
of them: `net` is criterion 1's fourth total and Part 4's ₪7,305.75, and it keeps that
meaning everywhere.

**The block below the columns therefore has two halves.** A row is *withheld* if it comes
out of the ברוטו — the income tax — and a *transfer* row if it only changes the sum handed
over: the advances, and a line the user placed after the total (item 20). Which half a row
is in is a fact about the row and belongs to the calculation, not to a screen sorting rows
by name; a screen that sorted them would put the next row the block grows into whichever
half it happened to fall through to. Item 17 gives the rule for when each of the three
figures is drawn. Column H holds money paid
to third parties — the medical insurance premium, the national-insurance contribution
paid quarterly, the agency and placement fees, the visa and licence fees — and is
deliberately excluded from that total. Reading H as salary would overpay the worker, and
reading a fee's unit price in column D as a charge would invent payments in months where
nothing was paid.

The rest day of a live-in caregiver is twenty-five hours, not twenty-four, so the
rest-day and holiday rate is one day plus one hour at 150%, which is the base monthly
salary divided by 25 plus the same salary divided by 182, multiplied by 1.5. A plain
150% of the daily rate is short by roughly fifty shekels a day and will quietly
underpay every rest day of the year.

The premium is owed for a holiday the worker works. A holiday she takes off is covered
by her ordinary salary and earns nothing extra, so the interface must never let
"holiday" be recorded without saying whether she worked it.

Do not copy numbers out of the source workbooks. Several are stale: the vacation-day
rate stayed at the 2024 figure through 2025 and 2026 — and is not carried forward at all,
since the sheet has no vacation line (item 7) — and the national-insurance line stayed at
2% of the 2024 wage after the rate rose to 3.6%. Derive every rate instead.
For the same reason, an exported figure may differ by an agora from the historical
sheet; reproduce history as history and never silently rewrite a past month.

The bottom of the month sheet is not a fixed layout. A month in which an advance is
given carries a row that adds it to the total, a month in which one is repaid carries a
row that subtracts the instalment, and a month may carry several of both at once — the
block grows with the advances, so it has to be generated rather than chosen from a
fixed set of shapes.

The helper column of notes exists for the person preparing the sheet and is hidden
before printing — which is where the user's own notes on the month's actions are written
(item 2) — and some of its cells reference other months. Anything carried into the
template must be treated as text, not as live formulas, or the export will arrive with
broken references.

Finally, the sheet is Hebrew and right-to-left, and its dates are written as loose text
rather than as date values. Preserve the sheet's direction, column order, and the way
each field is written, because the family compares the export against last month's page
by eye.

**A month has four states, and they are the vocabulary four other things share.** A month
is *draft* while it only holds facts; *confirmed* when the user has confirmed the minimum
wage against it, which is the moment the base monthly salary is copied off the profile
onto the month (Part 3) and the moment its figures stop moving with the profile;
*exported* once a file has been produced from it; and a confirmed or exported month whose
facts are then edited is *corrected*, which sends it back through confirmed and moves
every later month's balances with it (criterion 13). Exported is therefore not the end of
the line, and any code that treats it as final breaks criterion 13. A month whose calendar
month has not finished yet may sit in draft and refuse to leave it (criterion 21); that is
a separate axis from the four states and not a fifth state — a future month is a draft that
cannot be confirmed, not a state of its own.

## Appendix — future features

Deliberately out of scope for the first version, recorded so they are not rediscovered
as bugs:

- Partial months: a worker starting or leaving mid-month, and unpaid leave. The first
  version assumes whole months only.
- End of employment: settling the vacation balance, prorating recuperation, and closing
  an advance that has not finished being repaid. A settled balance day is valued at the
  same monthly salary over twenty-five that values a sick day, recorded here so the
  divisor is not decided a second time when it is built. **The divisor carries over and
  the numerator is not decided with it**: item 8's closed list of wage components is the
  sick-pay statute's, and what a settled vacation day is priced from rests on the annual
  leave law instead. Reading the one answer onto the other is the mistake this sentence
  exists to stop.
- Accrued severance shown on the worker's screen. The canvas draws such a card and the
  first version does not build it: severance accrual turns on continuity rules, partial
  years and end-of-employment prorating, all of which are deferred with the item above,
  and a figure about a real liability is read as authoritative whether or not it is right.
  It arrives with end of employment or not at all.
- History: keeping past exported files and a log of edits, so a corrected month can be
  compared against what was originally produced.
