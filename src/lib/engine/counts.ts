import {
  addDays,
  compareIsoDate,
  eachDate,
  everyDayOf,
  isRestEve,
  isRestDay,
  orderDates,
} from "@/lib/dates";
import type { ClosedMonthFacts, ClosedSpan } from "@/lib/engine/types";
import type { IsoDate } from "@/lib/types";

/**
 * The month's counts, derived from the calendar and the spans and never from a
 * number the user typed (specs.md item 5).
 *
 * Part 5 says why this is a file of its own rather than a few expressions
 * inline: a 31-day month beginning on its rest day holds five of them and 26
 * working days, the same length beginning the day after holds four and 27, and
 * **both still pay a whole salary** — so an off-by-one here stays invisible
 * until a month with an absence in it, and then misprices that month alone.
 */

export interface MonthCounts {
  /**
   * The month's days less its rest days. Nothing the worker takes reduces it —
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
  /** The month's rest-eves — the working day before each weekly rest day —
   * counted from the calendar. */
  restEves: number;
  /** The rest-eves she actually worked. */
  restEvesWorked: number;
  /**
   * The rest-eves that earn the supplement, which is not the same count: where
   * the supplement is pocket money a rest-eve she did not work is paid it all
   * the same (item 14), unless the whole of that week was lost to sickness
   * (item 8).
   */
  restEvesPaidSupplement: number;
  /** The month's weekly rest days, counted from the calendar. */
  restDays: number;
  /** The rest days she worked, which are the ones paid at the rest-day rate. */
  restDaysWorked: number;
}

function covers(span: ClosedSpan, date: IsoDate): boolean {
  const { from, to } = orderDates(span.from, span.to);
  return compareIsoDate(date, from) >= 0 && compareIsoDate(date, to) <= 0;
}

function spansCovering(spans: ClosedSpan[], date: IsoDate): ClosedSpan[] {
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
function notWorkedFraction(spans: ClosedSpan[], date: IsoDate): number {
  let lost = 0;
  for (const span of spansCovering(spans, date)) {
    // A holiday she worked is a working day like any other.
    if (span.kind === "holiday" && span.worked) continue;
    // Vacation, sickness, an unworked holiday, and the rest day she had off are
    // all days not worked. A span cannot legally overlap another (`spans.ts`
    // refuses the day as `alreadyMarked`), so the max is the one that covers it.
    lost = Math.max(lost, span.fraction ?? 1);
  }
  return Math.min(lost, 1);
}

/** A whole day not worked. A day worked in part is a day she attended, so it
 * counts as a rest-eve or a rest day worked even though it leaves a fraction of
 * the actual count. */
function notWorked(spans: ClosedSpan[], date: IsoDate): boolean {
  return notWorkedFraction(spans, date) >= 1;
}

/**
 * Whether every working day of the rest-eve's own week was lost to sickness.
 *
 * The week is the six working days ending at the rest-eve; the rest day itself
 * is not counted, and one day worked in that week is enough for the supplement
 * to be paid (specs.md item 8).
 *
 * **Anchored to her rest-eve, which is what makes it her week.** Item 8 anchors
 * the week to the worker's own rest day and the rest-eve is the day before it,
 * so the six days ending at the rest-eve are exactly the six ending at the rest
 * day with the rest day itself left out: Sunday through Friday for a
 * Saturday-resting worker, Saturday through Thursday for a Friday-resting one,
 * Monday through Saturday for a Sunday-resting one. The six are always
 * adjacent, which is the whole reason item 8 anchors rather than fixing the
 * week to Sunday — a fixed Sunday anchor would give a Friday-resting worker a
 * week with a hole in the middle of it.
 *
 * The arithmetic below is therefore unchanged from when the rest day was a
 * constant, and that is worth saying rather than leaving to be rediscovered:
 * it was already written against the rest-eve, so generalising `isRestEve` was
 * the whole of the change. What was wrong was the comment, which called the
 * week Sunday-anchored — true only of the one worker it was written for.
 *
 * The week's first day may fall in the previous month. A spell of sickness is
 * stored as the dates it ran between rather than as marks belonging to a month
 * (Part 3), so the span reaching back over the boundary is read whole here.
 */
function weekLostToSickness(spans: ClosedSpan[], restEve: IsoDate): boolean {
  const weekStart = addDays(restEve, -5);
  return eachDate(weekStart, restEve).every((date) =>
    spansCovering(spans, date).some((span) => span.kind === "sick"),
  );
}

export function countMonth(facts: ClosedMonthFacts): MonthCounts {
  const days = everyDayOf(facts.month);
  const { spans } = facts;

  const { restDay } = facts.terms;
  const restDays = days.filter((date) => isRestDay(date, restDay));
  const restEves = days.filter((date) => isRestEve(date, restDay));
  const standardDaysList = days.filter((date) => !isRestDay(date, restDay));

  return {
    standardDays: standardDaysList.length,
    actualDays: standardDaysList.reduce(
      (days, date) => days - notWorkedFraction(spans, date),
      standardDaysList.length,
    ),

    restEves: restEves.length,
    restEvesWorked: restEves.filter((date) => !notWorked(spans, date)).length,
    restEvesPaidSupplement: restEves.filter((restEve) =>
      facts.terms.restEveIsPocketMoney
        ? !weekLostToSickness(spans, restEve)
        : !notWorked(spans, restEve),
    ).length,

    restDays: restDays.length,
    // A free rest day is not worked (item 5), and neither is a rest day inside
    // a spell of sickness: those count toward the spell and are drawn from the
    // balance, but are not paid (item 8). Both fall out of `notWorked`.
    restDaysWorked: restDays.filter((date) => !notWorked(spans, date)).length,
  };
}
