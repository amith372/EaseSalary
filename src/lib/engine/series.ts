import { compareMonth } from "@/lib/dates";
import { holidayDaysOf } from "@/lib/engine/leave";
import { calculateMonth } from "@/lib/engine/month";
import { closeMonth } from "@/lib/engine/types";
import type {
  Employment,
  MonthContext,
  MonthFacts,
} from "@/lib/engine/types";
import type { IsoDate, MonthResult, YearMonth } from "@/lib/types";

/**
 * A worker's months, replayed from the opening position.
 *
 * **This is where the engine stops being a function of one month.** Balances are
 * never stored (`specs.md` Part 3): month N+1 opens with month N's closing
 * figures, so the only way to know what a month opened with is to walk the ones
 * before it. That is what makes criterion 13 free — a month corrected years
 * later moves every later month's balances because those balances were never
 * anything but this walk, and there is nothing to find and invalidate.
 *
 * Three things carry between months, and they carry differently:
 *
 * - **The balances** carry from one month to the next, across the new year and
 *   without limit. Vacation and sick balances have no year boundary.
 * - **The vacation days spent** and **the holiday days spent** carry only within
 *   a calendar year and reset at January, because the seven-day question and the
 *   nine-day entitlement are both asked of a calendar year (items 7 and 10).
 *   Neither is visible to a month looking only at itself, which is the whole
 *   reason for the walk.
 *
 * Nothing here reads a clock. `today` arrives from the caller and reaches every
 * month, which is safe because `clipEndOf` takes the earlier of it and the
 * month's own last day: a finished month clips at its own end whatever the date
 * is, and only a month still running clips at `today` (item 8, `CLAUDE.md`).
 */

/** One month of the walk: the facts it was calculated from beside what it came
 * to. The facts are carried because a caller that has the result usually wants
 * the marks behind it, and finding them again means matching on the month. */
export interface MonthInSeries {
  facts: MonthFacts;
  result: MonthResult;
}

/**
 * The same month handed to the walk twice.
 *
 * It cannot arise from the store, which keys a month by its date, but
 * `calculateSeries` takes an array and a caller could assemble one. Refused
 * rather than folded: two records of one month would accrue it twice and draw
 * its vacation twice, and the balance that came out would look entirely
 * ordinary — which is the class of mistake `specs.md` Part 5 is about.
 */
export class DuplicateMonthError extends Error {
  constructor(readonly month: YearMonth) {
    super(`The month ${month.year}-${month.month} appears more than once`);
    this.name = "DuplicateMonthError";
  }
}

/** The vacation days the month drew, read off the balance line rather than
 * counted again here. Counting them a second time would be a second path to one
 * figure, and the two would disagree the day either is corrected. */
function vacationDaysUsed(result: MonthResult): number {
  return result.balances.find((line) => line.kind === "vacation")?.used ?? 0;
}

function closingBalances(result: MonthResult) {
  const closing = (kind: "vacation" | "sick") =>
    result.balances.find((line) => line.kind === kind)?.closing ?? 0;
  return { vacationDays: closing("vacation"), sickDays: closing("sick") };
}

/**
 * Every month calculated in the light of the ones before it, oldest first.
 *
 * The months are **sorted here** rather than trusted from the caller. The store
 * already promises date order, but an unsorted array does not fail — it produces
 * balances that are merely wrong, which is exactly the failure this application
 * is written to make impossible rather than to make unlikely.
 *
 * It walks the months it is given and invents none. A gap in the history is a
 * month that was never recorded, and a month that never happened accrued
 * nothing: the accrual is a fact about a month that was worked, not about a
 * hole in a list.
 *
 * A refused month stops the walk, and the `InvalidMonthError` says which month
 * it was. That is not a limitation to work around: a month that cannot be
 * calculated has no closing balance, so the months after it have nothing to open
 * from, and continuing past it would mean inventing one.
 */
export function calculateSeries(
  months: MonthFacts[],
  employment: Employment,
  today?: IsoDate,
): MonthInSeries[] {
  const ordered = [...months].sort((a, b) => compareMonth(a.month, b.month));
  for (let i = 1; i < ordered.length; i += 1) {
    if (compareMonth(ordered[i - 1].month, ordered[i].month) === 0) {
      throw new DuplicateMonthError(ordered[i].month);
    }
  }

  let openingBalances: MonthContext["openingBalances"];
  let year: number | null = null;
  let vacationDaysEarlierInYear = 0;
  let holidayDaysEarlierInYear = 0;

  return ordered.map((facts) => {
    if (facts.month.year !== year) {
      year = facts.month.year;
      vacationDaysEarlierInYear = 0;
      holidayDaysEarlierInYear = 0;
    }

    const result = calculateMonth(facts, employment, {
      today,
      openingBalances,
      vacationDaysEarlierInYear,
      holidayDaysEarlierInYear,
    });

    openingBalances = closingBalances(result);
    vacationDaysEarlierInYear += vacationDaysUsed(result);
    // Counted the way the month counts its own, by the module that owns the
    // rule: a part day draws its own proportion (item 10). `closeMonth` is pure
    // and idempotent, so making the resolution twice costs a map and cannot
    // disagree with the one `calculateMonth` made.
    holidayDaysEarlierInYear += holidayDaysOf(
      closeMonth(facts, today).spans,
      facts.terms.restDay,
    );

    return { facts, result };
  });
}
