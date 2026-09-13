import { eachDate, fromIsoDate, orderDates } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { holidayDatesCounted } from "@/lib/engine/holidayDates";
import { countsAsWorked } from "@/lib/engine/types";
import type { ClosedSpan } from "@/lib/engine/types";
import type { IsoDate } from "@/lib/types";

/**
 * Leave: the holidays that are paid, the entitlement they are drawn from, and
 * the part days that are both taken and paid in proportion.
 *
 * **There is no vacation function in this file, and that is the whole of the
 * vacation rule.** A vacation day never changes the month's total (specs.md
 * item 7), and not because a payment and a reduction cancel each other: the
 * base is computed from the standard count, which vacation does not touch, and
 * there is no vacation line to add back. Vacation reaches the sheet as two
 * figures only — the days used in the month and the balance left after them —
 * and `balances.ts` already computes both, without an amount. A function here
 * that returned a vacation *amount* would be that double payment arriving, so
 * the file's silence on vacation is deliberate and `leave.test.ts` asserts it.
 *
 * What is left is the holiday half. A holiday behaves oppositely in money and
 * in the counts (item 5): one she worked changes the money and not the count,
 * one she did not work changes the count and not the money. `counts.ts` owns
 * that second half; this file owns the first.
 */

/** One day a holiday span covers, and how much of that day it is. */
interface HolidayDay {
  date: IsoDate;
  /**
   * A holiday may be taken as part of a day, paid in the same proportion and
   * drawn from the entitlement in the same proportion (specs.md items 7, 10).
   * A whole day is 1.
   */
  fraction: number;
}

/**
 * Every day every holiday span covers, spans of more than one day included.
 *
 * Counted as days and not as spans, because the entitlement counts days: nine
 * for a full year (item 10). A span standing for one day and a span standing
 * for three must not weigh the same against that allowance, and counting spans
 * is the arrangement in which they do.
 */
function holidayDaysIn(
  spans: ClosedSpan[],
  restDay: RestDay,
  onlyWorked: boolean,
): HolidayDay[] {
  const counted = holidayDatesCounted(spans, restDay);
  return spans
    .filter(
      (span) =>
        span.kind === "holiday" && (!onlyWorked || countsAsWorked(span)),
    )
    .flatMap((span) => {
      const { from, to } = orderDates(span.from, span.to);
      return eachDate(from, to)
        // A holiday on her weekly rest day is not a holiday (item 9): the day
        // is paid as a rest day, worked or not, and spends nothing from the
        // year's nine.
        .filter((date) => counted.has(date))
        .map((date) => ({ date, fraction: span.fraction ?? 1 }));
    });
}

function totalFraction(days: HolidayDay[]): number {
  return days.reduce((total, day) => total + day.fraction, 0);
}

/**
 * Holiday days the month records, worked or not — what the yearly entitlement
 * is drawn against (specs.md item 10). A part day draws its own proportion, so
 * this is not always a whole number and the remainder is displayed as it falls.
 *
 * **A holiday inside a spell of sickness is a holiday and is drawn from here**
 * (item 10, reversed with the user on 2026-09-12). It pays the ordinary salary
 * like any holiday she did not work and draws nothing from the sick balance —
 * `sick.ts` is the other half of that — because charging it to the sick quota
 * would spend a day of illness on a day she was not going to be working anyway.
 *
 * **A holiday on her weekly rest day is not drawn from here either**, and for
 * the opposite reason (item 9): that day is her rest day and is paid as one, so
 * nothing about it is a holiday except how the calendar draws it.
 */
export function holidayDaysOf(
  spans: ClosedSpan[],
  restDay: RestDay,
): number {
  return totalFraction(holidayDaysIn(spans, restDay, false));
}

/**
 * Holiday days she worked — the ones that are paid, at the rest-day rate
 * (specs.md item 9). **A holiday nobody has answered for is among them**, which
 * is `countsAsWorked`'s whole subject: the preview leans towards paying her, and
 * the export refuses to proceed while the question is still open. A holiday she does not work changes nothing: the monthly
 * salary is paid in full on it and no vacation day is drawn, so it produces no
 * line at all rather than a line worth nothing.
 */
export function holidayDaysWorked(
  spans: ClosedSpan[],
  restDay: RestDay,
): number {
  return totalFraction(holidayDaysIn(spans, restDay, true));
}

/**
 * The rest days paid on the rest-day line.
 *
 * **It is the count itself as of 2026-09-12, and the subtraction it used to make
 * is gone with the rule that needed it** (item 9). A holiday on the weekly rest
 * day was once paid on the holiday line, with this taking it back out of the
 * rest days so the day was paid once rather than twice; such a day is now not a
 * holiday at all, so it is paid on this line like any other rest day she worked
 * and there is nothing to take out. The money is unchanged. The function stays
 * so the call site goes on naming the rule it obeys, and because the rate this
 * feeds is the rest-day rate whether or not a holiday is involved.
 */
export function restDayUnitsOf(restDaysWorked: number): number {
  return restDaysWorked;
}

/** Nine days for a full year (specs.md item 10). */
export const HOLIDAYS_PER_YEAR = 9;

const MONTHS_PER_YEAR = 12;

/**
 * The holiday entitlement for one **calendar** year.
 *
 * The year is the calendar year, as the vacation year is (item 7) and for the
 * same reason, and it is also what the holiday lists themselves assume: they
 * are stored and published per country and per calendar year — `UA-2026.json` —
 * and item 12 speaks of fetching "that country's list for that year".
 *
 * A year only partly worked is reduced **in proportion to the months employed
 * in it**, and the month employment began counts as a whole month. The family's
 * own workbook both states and pays it: `שכר_חודשי_להאנה2024.xlsx` ->
 * `חודש  12.24` -> C9 holds 6.75 days and F9 pays 6.75 x 401.25, with the note
 * in I9 giving the reasoning, "(9*9)/12 = 6.75" for the nine months 4-12/24.
 * The figure comes from the cells and the reasoning from the note, which is the
 * order Part 5 requires. Criterion 1 is agreement with the workbook: a day-by-day proration is arithmetically finer
 * and gives 6.76 rather than 6.75, but it is not the figure the family uses. It is also the measure item 7
 * already applies to vacation — a year employed for nine months of accrues nine
 * monthly twelfths — so the two entitlements are reduced the same way rather
 * than by two different rules.
 *
 * Held as a fraction and never as a decimal, for Part 5's reason: nine
 * twelfths of nine is 6.75 exactly, but writing a rounded month's worth into a
 * balance is how the workbook's own figures stopped tying out.
 */
export function holidayAllowanceFor(
  employedSince: IsoDate,
  calendarYear: number,
): number {
  const start = fromIsoDate(employedSince);
  const startYear = start.getUTCFullYear();
  if (calendarYear < startYear) return 0;
  if (calendarYear > startYear) return HOLIDAYS_PER_YEAR;
  // `getUTCMonth()` is 0-11, so a January start leaves twelve months and a
  // December start leaves one. The month employment began counts as a whole
  // month, which is what makes this a subtraction and not a proration of days.
  const monthsEmployed = MONTHS_PER_YEAR - start.getUTCMonth();
  return (HOLIDAYS_PER_YEAR * monthsEmployed) / MONTHS_PER_YEAR;
}

/**
 * What is left of the year's entitlement — displayed as it falls, even when it
 * is not a whole number (specs.md item 10), which a part day and a partly
 * worked year both make likely.
 *
 * It never goes below zero: a day beyond the entitlement is refused by
 * `validateMonth` rather than shown as a negative remainder, because a refusal
 * says what to do about it and a minus sign does not.
 */
export function holidayDaysRemaining(allowance: number, used: number): number {
  return Math.max(0, allowance - used);
}
