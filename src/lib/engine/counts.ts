import {
  compareIsoDate,
  eachDate,
  everyDayOf,
  isRestEve,
  isRestDay,
} from "@/lib/dates";
import { spellsOf } from "@/lib/engine/sick";
import { countsAsWorked } from "@/lib/engine/types";
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
   * The standard count less the days they did not in fact work. It answers the
   * Wage Protection Act's requirement to list the days actually worked (item 2)
   * and is never paid from. Not always a whole number: a day taken in part
   * leaves it in that same proportion (item 5).
   */
  actualDays: number;
  /** The month's rest-eves — the working day before each weekly rest day —
   * counted from the calendar. */
  restEves: number;
  /** The rest-eves they actually worked. */
  restEvesWorked: number;
  /** The month's weekly rest days, counted from the calendar. */
  restDays: number;
  /** The rest days they worked, which are the ones paid at the rest-day rate. */
  restDaysWorked: number;
}

function covers(span: ClosedSpan, date: IsoDate): boolean {
  return compareIsoDate(date, span.from) >= 0 && compareIsoDate(date, span.to) <= 0;
}

function spansCovering(spans: ClosedSpan[], date: IsoDate): ClosedSpan[] {
  return spans.filter((span) => covers(span, date));
}

/**
 * How much of the day they did not in fact work, from 0 to 1.
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
 * A holiday never moves the actual count (item 5): one they worked are a working
 * day, and one they did not is a paid day the law lets them take without a
 * deduction. `countHolidays` false is that reading; the rest-day and rest-eve
 * counts still read an unworked holiday as a day they were not there.
 */
function notWorkedFraction(
  spans: ClosedSpan[],
  date: IsoDate,
  countHolidays = true,
): number {
  let lost = 0;
  for (const span of spansCovering(spans, date)) {
    // A holiday they worked are a working day like any other, and so is one
    // nobody has answered for: the preview reads an unanswered holiday as
    // worked (item 9), and the count has to agree with the money or the month
    // pays for a day it also counted as not worked.
    if (span.kind === "holiday" && (!countHolidays || countsAsWorked(span)))
      continue;
    // Vacation, sickness, an unworked holiday, and the rest day they had off are
    // all days not worked. A span cannot legally overlap another (`spans.ts`
    // refuses the day as `alreadyMarked`), so the max is the one that covers it.
    lost = Math.max(lost, span.fraction ?? 1);
  }
  return Math.min(lost, 1);
}

/** A whole day not worked. A day worked in part is a day they attended, so it
 * counts as a rest-eve or a rest day worked even though it leaves a fraction of
 * the actual count. */
function notWorked(spans: ClosedSpan[], date: IsoDate): boolean {
  return notWorkedFraction(spans, date) >= 1;
}

export function countMonth(facts: ClosedMonthFacts): MonthCounts {
  const days = everyDayOf(facts.month);
  const { spans } = facts;

  const { restDay } = facts.terms;
  const restDays = days.filter((date) => isRestDay(date, restDay));
  const restEves = days.filter((date) => isRestEve(date, restDay));
  const standardDaysList = days.filter((date) => !isRestDay(date, restDay));

  // **A rest day the spell bridged carries no span of its own.** The natural
  // way to record an illness is to mark the days they were absent from work, so
  // a family marks Friday and Sunday and leaves the Saturday between them
  // alone — and that Saturday is a day of the period, not a day they attended
  // (specs.md item 8). Read off the marks alone it would be paid at the
  // rest-day rate while the balance is drawing it for the same day, which
  // collapses two of the four separate things item 8 keeps apart. Only the
  // rest day needs this: a gap is made of days they owed no attendance, and the
  // other kind — a holiday they did not work — carries a span of its own.
  const spellDays = new Set(
    spellsOf(spans, restDay).flatMap((spell) => eachDate(spell.from, spell.to)),
  );

  return {
    standardDays: standardDaysList.length,
    actualDays: standardDaysList.reduce(
      (days, date) => days - notWorkedFraction(spans, date, false),
      standardDaysList.length,
    ),

    // Every rest-eve of the month earns the supplement, worked or not: it is an
    // agreed term and nothing conditions it (item 14). `restEves` is therefore
    // what the money is priced from, and `restEvesWorked` is reporting beside
    // it.
    restEves: restEves.length,
    restEvesWorked: restEves.filter((date) => !notWorked(spans, date)).length,

    restDays: restDays.length,
    // A free rest day is not worked (item 5), and neither is a rest day inside
    // a spell of sickness: those count toward the spell and are drawn from the
    // balance, but are not paid (item 8). A marked one falls out of
    // `notWorked`; one the spell bridged falls out of `spellDays`.
    restDaysWorked: restDays.filter(
      (date) => !notWorked(spans, date) && !spellDays.has(date),
    ).length,
  };
}
