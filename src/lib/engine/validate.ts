import { isSaturday, orderDates, compareIsoDate } from "@/lib/dates";
import type { MonthFacts, MonthSpan } from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import type { IsoDate } from "@/lib/types";

/**
 * The facts the engine refuses, with the reason each was refused.
 *
 * `src/lib/spans.ts` already stops these at the calendar: a holiday swept over
 * a free Saturday comes back as a `restDayHoliday` skip rather than a mark. But
 * the calendar is one caller and the repository in Stage 3 is another, so the
 * engine refuses the facts if such a pair reaches it anyway (specs.md Part 4).
 * A month that cannot be calculated correctly is refused with a reason and
 * never calculated wrongly in silence.
 */

export type RefusalCode =
  /** A paid holiday on a date already recorded as a free Saturday. The day
   * would be paid at both the rest-day rate and the holiday rate (Part 4). */
  | "restDayHoliday"
  /** More paid holidays in the year than the entitlement allows (item 10). */
  | "holidayLimit"
  /** A free Saturday recorded on a day that is not a Saturday (item 5). */
  | "freeSaturdayNotSaturday"
  /** More Saturdays worked than the month holds (Part 4). */
  | "saturdaysExceedMonth";

export interface Refusal {
  code: RefusalCode;
  /** Hebrew, and it says why rather than only what. */
  message: string;
  /** The dates the refusal concerns. Kept beside the sentence rather than
   * inside it, so the interface can isolate them: a date written into a Hebrew
   * paragraph is a mixed run a browser may reorder (specs.md Part 5). */
  dates: IsoDate[];
}

/** The yearly entitlement is nine days for a full year (specs.md item 10). It
 * is prorated for a year only partly worked, which is why the allowance is
 * passed in rather than read from here. */
export const HOLIDAYS_PER_YEAR = 9;

/**
 * What the engine needs to know that one month's facts cannot say. Stage 3's
 * repository supplies it; a month handed over on its own is treated as the
 * worker's and the year's first, so the entitlement check fires only on a month
 * carrying more than the whole year's allowance by itself, and the balances
 * open from the opening position.
 */
export interface MonthContext {
  /** Holiday days already recorded earlier in the same year, counted the way
   * this month counts its own — a part day as its fraction (item 10). */
  holidayDaysEarlierInYear?: number;
  /** The entitlement for this worker's year, reduced in proportion for a year
   * only partly worked (item 10). Whole years use the statutory nine. */
  holidayAllowance?: number;
  /**
   * The balances this month opens with — the previous month's closing figures.
   * Month N+1 opens with the previous balance plus the accrual less what was
   * used in month N (item 7). Absent for the worker's first month, which opens
   * from the opening position given once (item 6).
   */
  openingBalances?: { vacationDays: number; sickDays: number };
}

function coversDate(span: MonthSpan, date: IsoDate): boolean {
  const { from, to } = orderDates(span.from, span.to);
  return compareIsoDate(date, from) >= 0 && compareIsoDate(date, to) <= 0;
}

/** A holiday may be taken as part of a day and is drawn from the entitlement in
 * that same proportion (specs.md item 10), so the entitlement counts days and
 * not spans. */
export function holidayDaysOf(spans: MonthSpan[]): number {
  return spans
    .filter((span) => span.kind === "holiday")
    .reduce((days, span) => days + (span.fraction ?? 1), 0);
}

export function validateMonth(
  facts: MonthFacts,
  context: MonthContext = {},
): Refusal[] {
  const refusals: Refusal[] = [];
  const { spans } = facts;

  // A paid holiday landing on a free Saturday: the deliberately invalid case of
  // Part 4. Refused rather than paid at both rates.
  const clashes = spans
    .filter((span) => span.kind === "holiday")
    .flatMap((holiday) =>
      spans
        .filter(
          (other) =>
            other.kind === "freeSaturday" && coversDate(other, holiday.from),
        )
        .map(() => holiday.from),
    );
  if (clashes.length > 0) {
    refusals.push({
      code: "restDayHoliday",
      message: he.sheet.refusals.restDayHoliday,
      dates: [...new Set(clashes)],
    });
  }

  // A free Saturday on a day that is not a Saturday. The weekly rest day is
  // Saturday for every worker (item 5), so this is how the Saturday counts go
  // wrong in stored data even though the calendar refuses it at mark time.
  const notSaturdays = spans
    .filter((span) => span.kind === "freeSaturday" && !isSaturday(span.from))
    .map((span) => span.from);
  if (notSaturdays.length > 0) {
    refusals.push({
      code: "freeSaturdayNotSaturday",
      message: he.sheet.refusals.freeSaturdayNotSaturday,
      dates: notSaturdays,
    });
  }

  // A tenth paid holiday within a year. The entitlement is nine for a full year
  // and is reduced in proportion for a year only partly worked (item 10).
  const allowance = context.holidayAllowance ?? HOLIDAYS_PER_YEAR;
  const holidayDays =
    holidayDaysOf(spans) + (context.holidayDaysEarlierInYear ?? 0);
  if (holidayDays > allowance) {
    refusals.push({
      code: "holidayLimit",
      message: he.sheet.refusals.holidayLimit(allowance),
      dates: spans.filter((span) => span.kind === "holiday").map((s) => s.from),
    });
  }

  return refusals;
}

/**
 * Thrown rather than returned, so a caller that ignores the refusals cannot
 * quietly receive a number instead. `validateMonth` is exported beside it for
 * the interface, which wants to show the reasons before anyone presses export.
 */
export class InvalidMonthError extends Error {
  readonly refusals: Refusal[];

  constructor(refusals: Refusal[]) {
    super(refusals.map((refusal) => refusal.message).join(" "));
    this.name = "InvalidMonthError";
    this.refusals = refusals;
  }
}
