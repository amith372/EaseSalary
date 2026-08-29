import { isSaturday, orderDates, compareIsoDate } from "@/lib/dates";
import { daysUsedIn, sickDaysAvailable } from "@/lib/engine/balances";
import { holidayAllowanceFor, holidayDaysOf } from "@/lib/engine/leave";
import type {
  MonthContext,
  MonthFacts,
  MonthSpan,
  WorkerTerms,
} from "@/lib/engine/types";
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
  | "saturdaysExceedMonth"
  /** More sick days recorded in the month than the balance can fund. The sick
   * balance is a floor and never falls below zero (specs.md item 8). */
  | "sickBalanceExhausted";

export interface Refusal {
  code: RefusalCode;
  /** Hebrew, and it says why rather than only what. */
  message: string;
  /** The dates the refusal concerns. Kept beside the sentence rather than
   * inside it, so the interface can isolate them: a date written into a Hebrew
   * paragraph is a mixed run a browser may reorder (specs.md Part 5). */
  dates: IsoDate[];
}

function coversDate(span: MonthSpan, date: IsoDate): boolean {
  const { from, to } = orderDates(span.from, span.to);
  return compareIsoDate(date, from) >= 0 && compareIsoDate(date, to) <= 0;
}

/**
 * `terms` is here for the sick balance alone: what a month may draw depends on
 * the opening position, which is a standing fact about the worker and not a
 * fact about the month (specs.md items 6, 8).
 */
export function validateMonth(
  facts: MonthFacts,
  terms: WorkerTerms,
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
  // Nine days for a full year, reduced in proportion for a year only partly
  // worked (item 10). Derived from the worker's own terms rather than defaulted
  // to nine, so a month standing alone in her first calendar year is refused
  // against the entitlement she actually has. The context may still hand one
  // in, which is what lets a figure settled elsewhere win over the derivation.
  const allowance =
    context.holidayAllowance ??
    holidayAllowanceFor(terms.employedSince, facts.month.year);
  const holidayDays =
    holidayDaysOf(spans) + (context.holidayDaysEarlierInYear ?? 0);
  if (holidayDays > allowance) {
    refusals.push({
      code: "holidayLimit",
      message: he.sheet.refusals.holidayLimit(allowance),
      dates: spans.filter((span) => span.kind === "holiday").map((s) => s.from),
    });
  }

  // Sick days beyond what the balance can fund. The sick balance is a floor and
  // never falls below zero (item 8): the entry is refused and said out loud,
  // rather than the extra days being paid or deducted for in silence. Days past
  // an exhausted balance are an absence with no entitlement behind them, which
  // item 5 puts out of scope for this version — so the refusal is what keeps
  // this version from depending on a calculation it deliberately does not have.
  // If it ever fires in earnest, that is the signal to build the unpaid absence
  // as a feature, never to route around the refusal with arithmetic.
  const sickUsed = daysUsedIn(facts.spans, facts.month, "sick");
  const sickAvailable = sickDaysAvailable(terms, context.openingBalances);
  if (sickUsed > sickAvailable) {
    refusals.push({
      code: "sickBalanceExhausted",
      message: he.sheet.refusals.sickBalanceExhausted(sickAvailable, sickUsed),
      dates: facts.spans
        .filter((span) => span.kind === "sick")
        .map((span) => span.from),
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
