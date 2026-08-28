import {
  addDays,
  compareIsoDate,
  eachDate,
  everyDayOf,
  isFriday,
  isSaturday,
  orderDates,
} from "@/lib/dates";
import type { MonthFacts, MonthSpan, WorkerTerms } from "@/lib/engine/types";
import type { IsoDate } from "@/lib/types";

/**
 * The month's counts, derived from the calendar and the spans and never from a
 * number the user typed (specs.md item 5).
 *
 * Part 5 says why this is a file of its own rather than a few expressions
 * inline: a 31-day month beginning on a Saturday holds five Saturdays and 26
 * working days, the same length beginning on a Sunday holds four and 27, and
 * **both still pay a whole salary** — so an off-by-one here stays invisible
 * until a month with an absence in it, and then misprices that month alone.
 */

export interface MonthCounts {
  /**
   * The month's days less its Saturdays. Nothing the worker takes reduces it —
   * neither vacation nor sickness — and the salary is calculated from it
   * (specs.md item 5).
   */
  standardDays: number;
  /**
   * The standard count less the days she did not in fact work. It answers the
   * Wage Protection Act's requirement to list the days actually worked (item 2)
   * and is never paid from. Not always a whole number: a day taken in part
   * leaves it in that same proportion (item 5).
   */
  actualDays: number;
  /** The month's Fridays, counted from the calendar. */
  fridays: number;
  /** The Fridays she actually worked. */
  fridaysWorked: number;
  /**
   * The Fridays that earn the supplement, which is not the same count: where
   * the supplement is pocket money a Friday she did not work is paid it all the
   * same (item 14), unless the whole of that week was lost to sickness (item 8).
   */
  fridaysPaidSupplement: number;
  /** The month's Saturdays, counted from the calendar. */
  saturdays: number;
  /** The Saturdays she worked, which are the ones paid at the rest-day rate. */
  saturdaysWorked: number;
}

function covers(span: MonthSpan, date: IsoDate): boolean {
  const { from, to } = orderDates(span.from, span.to);
  return compareIsoDate(date, from) >= 0 && compareIsoDate(date, to) <= 0;
}

function spansCovering(spans: MonthSpan[], date: IsoDate): MonthSpan[] {
  return spans.filter((span) => covers(span, date));
}

/**
 * How much of the day she did not in fact work, from 0 to 1.
 *
 * Written as "not worked" rather than as "vacation or sickness" on purpose.
 * There is no mark for an absence with no entitlement in this version (item 5),
 * but the counts are computed so that adding one mark kind later is enough:
 * such a day would leave both counts, and with them the base salary. Naming the
 * question this way is what buys that, and it costs nothing today.
 *
 * A day taken in part leaves the actual count in that same proportion, so half
 * a vacation day leaves half a day (item 5). The count is therefore not always
 * a whole number, which is why it is carried as one.
 *
 * A holiday behaves oppositely in money and in the counts, and it is the check
 * worth holding on to: one she worked changes the money and not the count, one
 * she did not work changes the count and not the money, and a holiday that
 * changes both, or neither, is a mistake (item 5).
 */
function notWorkedFraction(spans: MonthSpan[], date: IsoDate): number {
  let lost = 0;
  for (const span of spansCovering(spans, date)) {
    // A holiday she worked is a working day like any other.
    if (span.kind === "holiday" && span.worked) continue;
    // Vacation, sickness, an unworked holiday, and the Saturday she had off are
    // all days not worked. A span cannot legally overlap another (`spans.ts`
    // refuses the day as `alreadyMarked`), so the max is the one that covers it.
    lost = Math.max(lost, span.fraction ?? 1);
  }
  return Math.min(lost, 1);
}

/** A whole day not worked. A day worked in part is a day she attended, so it
 * counts as a Friday or a Saturday worked even though it leaves a fraction of
 * the actual count. */
function notWorked(spans: MonthSpan[], date: IsoDate): boolean {
  return notWorkedFraction(spans, date) >= 1;
}

/**
 * Whether every working day of the Friday's own week was lost to sickness.
 *
 * The week is Sunday-anchored and runs Sunday through Friday: Saturday is the
 * weekly rest day and is not counted, and one day worked in that week is enough
 * for the supplement to be paid (specs.md item 8). It is computed from the
 * calendar rather than as the seven days ending on the Friday, which is the
 * arrangement that quietly passes the Sunday-to-Thursday case.
 *
 * The Sunday may fall in the previous month. A spell of sickness is stored as
 * the dates it ran between rather than as marks belonging to a month (Part 3),
 * so the span reaching back over the boundary is read whole here.
 */
function weekLostToSickness(spans: MonthSpan[], friday: IsoDate): boolean {
  const sunday = addDays(friday, -5);
  return eachDate(sunday, friday).every((date) =>
    spansCovering(spans, date).some((span) => span.kind === "sick"),
  );
}

export function countMonth(facts: MonthFacts, terms: WorkerTerms): MonthCounts {
  const days = everyDayOf(facts.month);
  const { spans } = facts;

  const saturdays = days.filter(isSaturday);
  const fridays = days.filter(isFriday);
  const standardDaysList = days.filter((date) => !isSaturday(date));

  return {
    standardDays: standardDaysList.length,
    actualDays: standardDaysList.reduce(
      (days, date) => days - notWorkedFraction(spans, date),
      standardDaysList.length,
    ),

    fridays: fridays.length,
    fridaysWorked: fridays.filter((date) => !notWorked(spans, date)).length,
    fridaysPaidSupplement: fridays.filter((friday) =>
      terms.fridayIsPocketMoney
        ? !weekLostToSickness(spans, friday)
        : !notWorked(spans, friday),
    ).length,

    saturdays: saturdays.length,
    // A free Saturday is not worked (item 5), and neither is a Saturday inside a
    // spell of sickness: those count toward the spell and are drawn from the
    // balance, but are not paid (item 8). Both fall out of `notWorked`.
    saturdaysWorked: saturdays.filter((date) => !notWorked(spans, date)).length,
  };
}
