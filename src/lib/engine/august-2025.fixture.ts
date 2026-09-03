import { SATURDAY } from "@/lib/dates";
import { snapshotTerms } from "@/lib/engine/types";
import type { MonthFacts, UserLine, WorkerTerms } from "@/lib/engine/types";

/**
 * August 2025 with nothing marked — the month the engine's non-workbook suites
 * build their cases from, held in one place so the two that use it cannot drift
 * apart.
 *
 * **This is not the August 2025 *case*.** That one lives in
 * `august-2025.test.ts`, carries the family's own marks, and is the only month
 * whose four totals come from their sheet (`CLAUDE.md`, on where a test's
 * expected figure comes from). What is here is the same month with an empty
 * calendar: a fixed, hand-checkable starting figure that each case then moves by
 * exactly one thing.
 *
 * **The figures are derived on paper and none is read back from the engine.**
 * Five Saturdays, all worked, and five Fridays:
 *
 *   column E   624,765 + 5 × 10,000                 = 674,765   ₪6,747.65
 *   column F   5 × 42,635.062087912… = 213,175.31…  = 213,175   ₪2,131.75
 *   the ברוטו                                        = 887,940   ₪8,879.40
 *
 * Part 4 states the ₪6,747.65 outright, and the rest-day rate is the one its
 * ₪2,558.10 is built from — one day plus one hour at 150%, which is the salary
 * over 25 plus the salary over 182, times 1.5 (Part 5).
 *
 * It carries no income tax and no advances, so a case that wants either adds it.
 */

export const AUGUST_2025 = { year: 2025, month: 8 } as const;

/** ₪6,247.65 — the last minimum wage this repository has a source for, in force
 * from 1.4.2025 and therefore the rate August 2025 is valued at (Part 3). */
export const SALARY = 624765;

/** ₪8,879.40 — the ברוטו of the month above, and the figure every case moves
 * from. Derived in the docblock, not read back. */
export const PLAIN_GROSS = 887940;

/** The worker of Part 4: she rests on Saturday, so her rest-eve is Friday. */
export function plainWorker(standingLines: UserLine[] = []): WorkerTerms {
  return {
    employedSince: "2024-04-01",
    baseMonthlySalaryAgorot: SALARY,
    restDay: SATURDAY,
    restEveSupplementAgorot: 10000,
    recuperationMonth: 7,
    standingLines,
    country: "PH",
    openingPosition: { vacationDays: 0, sickDays: 0, advances: [] },
  };
}

/**
 * The month's facts with an empty calendar. Callers spread their own case over
 * the result rather than taking more parameters here: what each case varies is
 * different, and a fixture that grew a parameter per case would be the union of
 * everything anyone ever needed.
 */
export function plainAugustFacts(terms: WorkerTerms): MonthFacts {
  return {
    month: AUGUST_2025,
    terms: snapshotTerms(terms),
    confirmedWage: {
      baseAgorot: SALARY,
      minimumAgorot: SALARY,
      effectiveFrom: "2025-04-01",
    },
    spans: [],
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    // Never calculated; the line starts at zero and is the user's to edit
    // (specs.md item 17).
    incomeTaxAgorot: 0,
    overrides: {},
  };
}
