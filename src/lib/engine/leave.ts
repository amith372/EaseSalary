import { eachDate, fromIsoDate, isRestDay, orderDates } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
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
function holidayDaysIn(spans: ClosedSpan[], onlyWorked: boolean): HolidayDay[] {
  return spans
    .filter((span) => span.kind === "holiday" && (!onlyWorked || span.worked))
    .flatMap((span) => {
      const { from, to } = orderDates(span.from, span.to);
      return eachDate(from, to).map((date) => ({
        date,
        fraction: span.fraction ?? 1,
      }));
    });
}

function totalFraction(days: HolidayDay[]): number {
  return days.reduce((total, day) => total + day.fraction, 0);
}

/**
 * Holiday days the month records, worked or not — what the yearly entitlement
 * is drawn against (specs.md item 10). A part day draws its own proportion, so
 * this is not always a whole number and the remainder is displayed as it falls.
 */
export function holidayDaysOf(spans: ClosedSpan[]): number {
  return totalFraction(holidayDaysIn(spans, false));
}

/**
 * Holiday days she worked — the ones that are paid, at the rest-day rate
 * (specs.md item 9). A holiday she does not work changes nothing: the monthly
 * salary is paid in full on it and no vacation day is drawn, so it produces no
 * line at all rather than a line worth nothing.
 */
export function holidayDaysWorked(spans: ClosedSpan[]): number {
  return totalFraction(holidayDaysIn(spans, true));
}

/**
 * The worked-holiday days that fall on a weekly rest day.
 *
 * A holiday on a rest day she works is **paid once, not twice** (specs.md
 * item 9), and both would otherwise be paid at the same rest-day rate off the
 * same date: `countMonth` sees a rest day carrying no absence and counts it as
 * a rest day worked, while the holiday line counts it again. The day is left
 * with the holiday line — a holiday is also what draws the yearly entitlement,
 * so the fact that makes the day special is the one that should carry it — and
 * `restDayUnitsOf` takes it back out of the rest days.
 */
export function holidayRestDaysWorked(
  spans: ClosedSpan[],
  restDay: RestDay,
): number {
  return totalFraction(
    holidayDaysIn(spans, true).filter((day) => isRestDay(day.date, restDay)),
  );
}

/**
 * The rest days paid on the rest-day line: the rest days she worked, less the
 * part of them a worked holiday is already paying for.
 *
 * `restDaysWorked` stays the true count of rest days she attended — it is a
 * fact about the month and is reported as one — and the subtraction happens
 * here, where the question is what to pay rather than what happened. A half-day
 * holiday worked on a rest day leaves half a rest day on this line and half a
 * day on the holiday line, which is one day paid once between them.
 */
export function restDayUnitsOf(
  spans: ClosedSpan[],
  restDaysWorked: number,
  restDay: RestDay,
): number {
  return Math.max(0, restDaysWorked - holidayRestDaysWorked(spans, restDay));
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
