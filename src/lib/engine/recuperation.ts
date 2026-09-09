import {
  addDays,
  compareIsoDate,
  daysInMonth,
  fromIsoDate,
  isoOf,
  toIsoDate,
  utcDate,
} from "@/lib/dates";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * Recuperation — how many days are owed, and in which month (specs.md item 15).
 *
 * **It owns the seniority ladder and the clock it is read against, and nothing
 * else.** What a day is worth is not here and is not derivable from the
 * salary: the day rate is a figure the application takes from outside itself,
 * so it lives in `src/lib/datedRates.ts` with the date it took effect, and the
 * month stores the one it was valued at. Days and money are kept apart on
 * purpose — the ladder is a rule about an employment and the rate is a number
 * about a year, and a module holding both would have to be corrected twice
 * whenever either moved.
 *
 * **Recuperation keeps its own clock, and deliberately** (item 15). It is
 * measured from the employment anniversary while vacation is measured by the
 * calendar year (item 7), because the two entitlements are governed by
 * different rules and each follows its own. `balances.ts` says the same thing
 * from the other side. The disagreement is the correct behaviour and not an
 * oversight in one of them.
 */

/**
 * The days owed for one completed employment year, by how many have been
 * completed.
 *
 * **Read off the statute and not off the family's sheet.** The first three
 * tiers are stated twice over — the caregiver's own terms page gives 5, 6 and 7
 * outright, and the general article repeats them — and the family's workbook
 * pays exactly them, which is the agreement criterion 1 asks for rather than
 * the source of the figure.
 *
 * **Above year ten only the general article answers**, and it is what this
 * follows, settled with the user on 2026-09-09: the caregiver page stops at the
 * tenth year, and stopping the ladder there would quietly underpay a worker of
 * eleven years by a day. The tiers are 8 days for years 11 to 15, 9 for 16 to
 * 19, and 10 from the twentieth on.
 *
 * Source: https://www.kolzchut.org.il/he/דמי_הבראה — read 2026-09-09 — and, for
 * the first three tiers, `links.ts`'s `recuperation` section of the caregiver
 * terms page.
 */
export function recuperationDaysPerYear(yearsCompleted: number): number {
  if (yearsCompleted < 1) return 0;
  if (yearsCompleted === 1) return 5;
  if (yearsCompleted <= 3) return 6;
  if (yearsCompleted <= 10) return 7;
  if (yearsCompleted <= 15) return 8;
  if (yearsCompleted <= 19) return 9;
  return 10;
}

/**
 * The date an employment turns a given number of years old — the anniversary of
 * its first day, which is the *first* day of the next employment year and not
 * the last of the one it closes.
 *
 * Built in UTC, because a date built in local time can shift by a whole day
 * across a daylight-saving boundary (`CLAUDE.md`, Part 5), and an anniversary
 * that moves by a day is a year that completes in the wrong month.
 *
 * A 29 February start has no anniversary in an ordinary year, and `utcDate`
 * rolls it to the 1st of March — so the second year opens on the 1st and the
 * first closes at the end of the 28th, which is the count and not a rounding:
 * 29.2.2024 plus 365 days is 28.2.2025.
 */
function anniversaryOf(employedSince: IsoDate, years: number): IsoDate {
  const start = fromIsoDate(employedSince);
  return toIsoDate(
    utcDate(
      start.getUTCFullYear() + years,
      start.getUTCMonth() + 1,
      start.getUTCDate(),
    ),
  );
}

/**
 * How many whole employment years have been completed by the end of a given
 * day.
 *
 * **A year is complete on the day before the anniversary, not on it.** An
 * employment that began on 1.4.2024 has worked a full year by the end of
 * 31.3.2025, and 1.4.2025 is the first day of its second year. That single day
 * is the whole of the question item 15 raised against the family's workbook:
 * `שכר_חודשי_להאנה2025.xlsx` → `חודש  3.25` pays five days in the March that
 * closes the first year, which reads as a payment made before the year is up
 * and is not one.
 *
 * Zero before the employment began and zero through its first year, which is
 * the statute read plainly: nothing is due until a full working year has been
 * completed.
 */
export function employmentYearsCompletedBy(
  employedSince: IsoDate,
  lastDay: IsoDate,
): number {
  if (compareIsoDate(lastDay, employedSince) < 0) return 0;
  // The day after, because the anniversary is the next year's first day: a year
  // is complete when the anniversary has arrived by the morning after `lastDay`.
  const dayAfter = addDays(lastDay, 1);
  const years =
    fromIsoDate(dayAfter).getUTCFullYear() -
    fromIsoDate(employedSince).getUTCFullYear();
  // The year difference overshoots by one whenever the anniversary has not come
  // round yet inside that calendar year.
  return compareIsoDate(anniversaryOf(employedSince, years), dayAfter) <= 0
    ? years
    : Math.max(0, years - 1);
}

/**
 * The days of recuperation a month pays, which is zero in every month but one.
 *
 * **The month it falls in is a term of the employment and is read off the
 * month** (specs.md Part 3): the family names it when the worker is created,
 * and a family that moves it in June must not thereby restate every earlier
 * month. `MonthTerms.recuperationMonth` is where it is read from, never the
 * profile.
 *
 * **Each payment covers one completed employment year and there is no
 * proration** (item 15). The count is taken at the month's own last day, so
 * every recuperation month covers exactly one more year than the one before it
 * — the ladder steps once a year no matter which month the family chose. The
 * article's proportional rule is for an employment that *ends* part way through
 * a year, and settling the end of an employment is deliberately out of scope
 * (the appendix): a year that has not been completed pays nothing here rather
 * than paying a fraction the application would have to invent.
 */
export function recuperationDaysFor(
  employedSince: IsoDate,
  recuperationMonth: number,
  month: YearMonth,
): number {
  if (month.month !== recuperationMonth) return 0;
  const lastDay = isoOf(month, daysInMonth(month));
  return recuperationDaysPerYear(
    employmentYearsCompletedBy(employedSince, lastDay),
  );
}
