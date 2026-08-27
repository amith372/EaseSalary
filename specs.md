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
handful of things that change in a given month — Fridays worked, Saturdays worked,
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

The application never calculates income tax. Its line defaults to zero, exactly as in the
family's workbook, and the user can edit it from the actions on the worker's month if
their own situation requires a figure there. The pension and severance provision stays
out of scope: its row survives in the export template, empty and untouched, so the
exported sheet keeps the layout and the row numbering of the family's workbook.

## Part 2 — Testable success criteria

Each of these is true or false at a glance.

1. Entering the facts of August 2025 into a worker profile and exporting produces a
   sheet whose four total lines read 6,747.65 / 2,558.10 / 9,305.75 / 7,305.75.
2. The exported file is an .xlsx sheet for one month, with the same rows, the same
   Hebrew labels, and the same column layout as a month tab in the family's workbook. It
   also carries what the Wage Protection Act requires of the payslip made from it: both
   day counts, the vacation and sick days used in the month and the balances left after
   them, and every payment shown as its type, its number of units, and its amount.
3. Every derived rate — the daily rate, the rest-day and holiday rate, and the
   vacation-day rate — is computed from the worker's base monthly salary rather than
   stored as a constant, so changing that salary changes all three. Rates and totals are
   carried at full precision through the calculation and rounded to two decimals only at
   the end, never between steps.
   The base monthly salary defaults to the confirmed minimum wage. It does not follow a
   rise on its own: when a fetch finds the minimum wage has changed, or when the salary
   on the profile sits below it, the application says so and leaves the decision to the
   user.
4. Before every export the application shows the minimum wage it fetched from its
   source and requires the user to confirm it; if the fetch fails, the application says
   so plainly and lets the user enter the figure by hand.
5. The month is presented as a calendar. Its Fridays and Saturdays are counted from the
    calendar rather than typed, and the user marks on a day what departed from an
    ordinary month — a free Saturday, a vacation day, sick days, a holiday worked. The
    sheet reports two counts. The standard count is the month's days less its Saturdays,
    and nothing the worker takes reduces it — neither vacation nor sickness. The actual
    count is that same figure less the days she did not in fact work. The salary is
    calculated from the standard count, so vacation and sickness never shrink the base;
    the actual count is there to be read. A day that is neither vacation nor sickness —
    an absence with no entitlement behind it — leaves both counts and with them the base
    salary, and if it falls on a Friday it also leaves the Friday supplement, and if on a
    Saturday the Saturday pay. A free Saturday is not an entitlement and a month without
    one is unremarkable.
    Beside the calendar sit three groups: additional payments (advances given and
    repaid, the income-tax line, manual overrides), payments to third parties (national
    insurance, medical insurance, fees), and yearly settings (the nine holidays, the
    recuperation month). Every action can carry a free-text note. The weekly rest day is
    Saturday for every worker, and no action asks the user for a rate or a formula.
6. A worker created in the middle of an employment starts from an opening position given
   once: the vacation and sick balances already accrued, and any advance still being
   repaid together with what has been repaid of it so far. From then on the application
   keeps them.
7. Balances carry forward: month N+1 opens with the previous balance plus the monthly
   accrual minus what was used in month N. A vacation day never changes the month's
   total: a monthly salary is paid in full for a month in which vacation was taken, and
   the day is drawn from the balance alone. The workbook presents this as a reduced base
   plus a separate vacation line, which comes to the same figure, so where the sheet
   shows it that way the two must cancel exactly. A vacation day, like a holiday, may be
   taken as part of a day and is drawn from the balance in that proportion. Vacation
   accrues by seniority — fourteen days a year through year four, sixteen in year five,
   eighteen in year six, twenty-one in year seven, and one more each year to a ceiling of
   twenty-eight. An unused balance carries into the following years rather than being
   paid out at the end of December, and the application warns when a year passed with
   fewer than seven vacation days taken, noting plainly that the law asks for at least
   seven days a year, without pressing the point further. The application never deletes
   accrued days on its own. The sick balance accrues at 1.5 days a month, stops at ninety
   days, and never resets at a year boundary.
8. Sick days accrue at 1.5 a month to a ceiling of ninety, and the payment follows the
   statutory tiers from what was reported: nothing for the first day, half for the
   second and third, and the full day from the fourth onward. A sick day is worth the
   monthly salary over twenty-five. Because the salary is calculated from the standard
   count, sickness never reduces the base; it appears instead as a deduction covering the
   unpaid part of the sick days — a whole day for the first, half a day for the second
   and third, nothing from the fourth onward — so the worker is left with exactly what
   the tiers give her. Sick days leave the actual count and not the standard one. A spell of sickness is counted from
   its first day through to its last, across a month boundary, rather than restarting
   each month; the Saturdays inside a spell count toward it and are drawn from the
   balance, but are not paid. Where the Friday supplement is pocket money, a Friday on
   which sickness was reported is still paid it, unless the whole of that week was lost
   to sickness, in which case it is not.
9. A holiday the worker does not work changes nothing: a monthly salary is paid in full
   and no vacation day is drawn. A holiday she works is paid at the rest-day rate, and a
   holiday falling on a Saturday she works is paid once, not twice.
10. The worker's holidays for the year are shown in advance as her country of origin's
   full candidate list, with another country's list selectable instead, of which the
   user marks the paid ones. The yearly entitlement is nine days for a full year and is
   reduced in proportion for a year only partly worked, and the remainder is displayed
   even when it is not a whole number. A holiday can be taken as part of a day, paid in
   the same proportion and drawn from the entitlement in the same proportion. A date can
   be edited, a day beyond the entitlement is refused, and an incomplete selection is
   visible at a glance.
11. An account can see only its own workers and can create no more than two. A worker can
   additionally be shared with a second account by an invitation the other person
   accepts, and a worker received this way does not count against that person's limit of
   two; both then see the same months and balances.
12. When a worker's year has no holiday list yet, the application fetches that country's
    list for that year on its own; if the page cannot be reached or publishes nothing,
    it says so and lets the user enter the dates by hand. Nothing about this is tied to
    2026.
13. A month can be corrected after it was exported, and every later month's balances
    follow the correction rather than keeping the old figures.
14. The weekly Friday supplement is set per worker and can be changed at any time. The
    profile also decides whether it counts as pocket money: when it does, a Friday the
    worker did not work is paid the supplement all the same; when it does not, the
    supplement follows the day like every other figure.
15. Recurring yearly items — the visa fee, the licence renewal, the agency fee, and the
    recuperation payment — are shown as due in the month they fall, without the user
    tracking the dates. The recuperation entitlement is worked out from the worker's
    seniority and offered as a suggestion the user can change before approving, and the
    month it is paid in is set on the worker's profile when the worker is created.
    Nothing is due until a full working year has been completed, and each payment covers
    the year running from one employment anniversary to the next.
16. Payments that go to third parties rather than to the worker — the medical insurance
    premium, the national-insurance contribution, the agency and placement fees, the
    visa and licence fees — are recorded in their own column and are never added into
    the worker's monthly salary total.
17. Any amount the application worked out for a month can be overridden by the user from
    that month's actions, and the income-tax line is editable in the same way while
    defaulting to zero. An overridden amount is visibly marked as manual and survives
    every later recalculation of that month.
18. Exporting begins with a short set of confirmation questions covering everything that
    changes the month — whether an advance was given, whether an instalment is being
    repaid, whether a Saturday was free, which holidays were worked, whether there were
    sick days — so nothing is left out by silence.
19. The national-insurance contribution is 3.6% of the month's full cost — the salary,
    the Friday supplement, the Saturday and holiday pay, and the one-off payments such
    as recuperation — taken before anything to do with advances. It is shown as an
    estimate to be confirmed rather than as a fact, because the sum actually billed has
    differed from it. It is paid once a quarter and in arrears: the reminder
    appears on the opening screen in the month after the last covered month has ended,
    and stays there until the user ticks the payment as made. The export carries the
    amount that was due, that tick, and the months the payment covers. The licence
    renewal that falls once every four years is recorded the same way, and the
    application warns before either runs out.
20. The user can add an extra payment to a month with a reason of their own, and it
    appears as its own line in the export — which is how a shortfall from an earlier
    month is settled later. Advances are numbered and tracked one by one: a month may
    both grant one advance and repay another, each on its own line, and the amount
    repaid is entered for the month rather than fixed by a schedule.
21. A future month can be filled in ahead of time through the calendar, but it can only
    be exported once it has ended.
22. Reading the passport and bank account columns straight out of the database shows
    unreadable values; the real numbers appear only on the worker's own screen and in
    the export.
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
25. Every action that rests on a legal rule carries a link to the page that states it —
    the minimum wage, the rest-day and holiday premium, annual leave, sick pay,
    recuperation, national insurance — so a user who wants to check a figure can read
    the rule rather than take the application's word for it.
26. The opening screen carries only things that need the user to do something — a
    quarterly national-insurance payment due, a licence or medical insurance about to
    expire, an advance still being repaid, holidays not yet all chosen, recuperation due
    this month, a year passing with no vacation taken, a finished month not yet
    exported, a minimum wage that changed since the last export, and a worker crossing
    into a new year of seniority. Balances and running figures live on the worker's
    profile instead, so the opening screen stays worth reading.

## Part 3 — Architectural guidance

The application separates browser, server, and database. All salary logic runs on the
server; the browser only collects facts and displays results. Account isolation is
enforced in the database rather than only in the interface, so a user reaches their own
workers and nothing else even when a request is crafted by hand.

One calculation path serves both the on-screen preview and the export, so the numbers a
user sees before exporting are the numbers in the file. Each month record stores the
minimum wage confirmed for it along with the rates derived from it, so re-exporting a
past month years later reproduces that month rather than recalculating it at today's
rates.

The export is produced by filling a stored .xlsx template modelled on the 2026 workbook,
which is the canonical reference for layout and wording; earlier years are historical
only. No worker's name or details survive anywhere in a template, including inside a
sentence: every such place is a placeholder the export fills, so a template can never
carry one family's data into another's sheet. The closing block is built from however many advance lines the month has — one for
each advance granted and each instalment repaid, numbered as in the workbook — rather
than from a fixed set of variants. A layout change is a template change and not a code
change. The employer
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

External data is never load-bearing. The minimum wage is read from the Kol Zchut
minimum-wage page (https://www.kolzchut.org.il/he/שכר_מינימום), which publishes both the
figure and the date it takes effect, so a month is always valued at the rate in force
during it. The same source supplies the reference links shown beside the actions, kept
in one list rather than scattered through the interface, so a page that moves is fixed
in a single place. The cached figure is shown first and a fetch runs behind it, so a slow
or broken source never delays a screen. Anything scraped is checked for plausibility
before it is offered to the
user — a wage far outside the range of recent years, or a holiday list of implausible
length, is treated as a failed fetch rather than a new fact. A failed fetch degrades to
the last confirmed figure plus manual entry, and never blocks an export.

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
same refusal covers a tenth paid holiday within a year and a count of worked Saturdays
higher than the number of Saturdays in the month.

## Part 5 — Known pitfalls

A holiday list for a new year is found by taking the source address already stored with
that country's list and changing the year in it, never by rebuilding the address from the
country code. The two do not always agree — Ukraine's list is filed under one code and
published under another — and an address built from the code returns nothing, which reads
exactly like a country that publishes no holidays at all. The failure would surface half a
year later, the first time someone adds a worker from that country.

The balances tab rounds inconsistently and should not be copied. In
שכר_חודשי_להאנה2026 → חישוב ימי מחלה וחופשה the monthly vacation accrual is written as
1.17 in January to March and as fourteen twelfths from April onward, in the same column.
Use the fraction throughout, or a balance drifts by a hundredth of a day a year and the
figures stop tying out against the workbook for reasons no one can find later.

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
worker. Column E carries the monthly salary items, F the pay for Saturdays and holidays,
and G the one-off payments such as recuperation, vacation days taken, and hospital
overtime; the month's total is the sum of those three alone. Column H holds money paid
to third parties — the medical insurance premium, the national-insurance contribution
paid quarterly, the agency and placement fees, the visa and licence fees — and is
deliberately excluded from that total. Reading H as salary would overpay the worker, and
reading a fee's unit price in column D as a charge would invent payments in months where
nothing was paid.

The rest day of a live-in caregiver is twenty-five hours, not twenty-four, so the
rest-day and holiday rate is one day plus one hour at 150%, which is the base monthly
salary divided by 25 plus the same salary divided by 182, multiplied by 1.5. A plain
150% of the daily rate is short by roughly fifty shekels a day and will quietly
underpay every Saturday of the year.

The premium is owed for a holiday the worker works. A holiday she takes off is covered
by her ordinary salary and earns nothing extra, so the interface must never let
"holiday" be recorded without saying whether she worked it.

Do not copy numbers out of the source workbooks. Several are stale: the vacation-day
rate stayed at the 2024 figure through 2025 and 2026, and the national-insurance line
stayed at 2% of the 2024 wage after the rate rose to 3.6%. Derive every rate instead.
For the same reason, an exported figure may differ by an agora from the historical
sheet; reproduce history as history and never silently rewrite a past month.

The bottom of the month sheet is not a fixed layout. A month in which an advance is
given carries a row that adds it to the total, a month in which one is repaid carries a
row that subtracts the instalment, and a month may carry several of both at once — the
block grows with the advances, so it has to be generated rather than chosen from a
fixed set of shapes.

The helper column of notes exists for the person preparing the sheet and is hidden
before printing, and some of its cells reference other months. Anything carried into the
template must be treated as text, not as live formulas, or the export will arrive with
broken references.

Finally, the sheet is Hebrew and right-to-left, and its dates are written as loose text
rather than as date values. Preserve the sheet's direction, column order, and the way
each field is written, because the family compares the export against last month's page
by eye.

## Appendix — future features

Deliberately out of scope for the first version, recorded so they are not rediscovered
as bugs:

- Partial months: a worker starting or leaving mid-month, and unpaid leave. The first
  version assumes whole months only.
- End of employment: settling the vacation balance, prorating recuperation, and closing
  an advance that has not finished being repaid.
- History: keeping past exported files and a log of edits, so a corrected month can be
  compared against what was originally produced.

## Appendix — open questions

None outstanding.
