import { describe, expect, it } from "vitest";
import { calculateSeries } from "@/lib/engine/series";
import { snapshotTerms } from "@/lib/engine/types";
import type { MonthFacts } from "@/lib/engine/types";
import {
  WAGE_2025,
  WAGE_2026,
  workbookWorker,
} from "@/lib/engine/workbook.fixture";
import type { YearMonth } from "@/lib/types";

/**
 * The sick balance, against the running figure the family kept by hand for
 * twenty-eight consecutive months.
 *
 * Every month tab carries the balance in the `J` column of its sickness row —
 * `J19` in the 2025 tabs, `J20` in `חודש  12.24`, since the rows move between
 * years. Hanna was never ill in any of the three workbooks, so the column is a
 * pure accrual ladder from her first month: 1.5 a month from 1.4.2024, written
 * out month after month by somebody with no engine to help them.
 *
 * **This is what item 13 and Part 3 actually rest on.** Balances are never
 * stored; they are derived by replaying the worker's months from the opening
 * position. A replay is the one thing a single month's test cannot check, and
 * an off-by-one in it — an opening balance carried from the wrong month, a month
 * accrued twice, the first month skipped — produces a figure that looks
 * completely ordinary. Twenty-eight hand-written checkpoints are the answer to
 * that.
 *
 * **The ninety-day ceiling is not checked here and cannot be.** She reaches 42
 * days by July 2026, so the workbook never approaches it; `sick.test.ts` derives
 * that case on paper, which is what `CLAUDE.md` requires of a figure the sheet
 * has no answer for.
 */

/** ₪5,880.02, the wage to 31.3.2025. */
const WAGE_2024 = 588002;

function wageFor(month: YearMonth): { agorot: number; from: string } {
  const ordinal = month.year * 12 + month.month;
  if (ordinal >= 2026 * 12 + 4) return { agorot: WAGE_2026, from: "2026-04-01" };
  if (ordinal >= 2025 * 12 + 4) return { agorot: WAGE_2025, from: "2025-04-01" };
  return { agorot: WAGE_2024, from: "2024-04-01" };
}

/**
 * Every month from her first to July 2026, with an empty calendar.
 *
 * The marks are left off deliberately. Sickness accrual does not depend on any
 * of them, and the 2025 tabs pay ten holidays against an entitlement of nine
 * (see `workbook-holidays.test.ts`), so a replay carrying the real holiday marks
 * would be refused at the tenth — correctly, and before reaching the balances
 * this file is about.
 */
function everyMonth(): MonthFacts[] {
  const months: MonthFacts[] = [];
  for (let ordinal = 2024 * 12 + 4; ordinal <= 2026 * 12 + 7; ordinal += 1) {
    const month = {
      year: Math.floor((ordinal - 1) / 12),
      month: ((ordinal - 1) % 12) + 1,
    };
    const wage = wageFor(month);
    months.push({
      month,
      terms: snapshotTerms(workbookWorker(wage.agorot)),
      confirmedWage: {
        baseAgorot: wage.agorot,
        minimumAgorot: wage.agorot,
        effectiveFrom: wage.from,
      },
      spans: [],
      advances: [],
      thirdPartyPayments: [],
      userLines: [],
      incomeTaxAgorot: 0,
      overrides: {},
    });
  }
  return months;
}

/** `J` of the sickness row, tab by tab. Read off the workbooks, not computed. */
const LADDER: [YearMonth, number][] = [
  [{ year: 2024, month: 4 }, 1.5], // `חודש  4.24`  — her first month
  [{ year: 2024, month: 9 }, 9],
  [{ year: 2024, month: 11 }, 12],
  [{ year: 2024, month: 12 }, 13.5],
  [{ year: 2025, month: 3 }, 18],
  [{ year: 2025, month: 4 }, 19.5],
  [{ year: 2025, month: 8 }, 25.5], // the month of Part 4
  [{ year: 2025, month: 11 }, 30],
  [{ year: 2026, month: 2 }, 34.5],
  [{ year: 2026, month: 3 }, 36],
  [{ year: 2026, month: 7 }, 42],
];

describe("the sick balance the family kept by hand", () => {
  const series = calculateSeries(everyMonth(), workbookWorker(WAGE_2025));

  const closingSick = (month: YearMonth) => {
    const entry = series.find(
      (m) => m.facts.month.year === month.year && m.facts.month.month === month.month,
    );
    if (!entry) throw new Error(`${month.year}-${month.month} not in the series`);
    return entry.result.balances.find((b) => b.kind === "sick")?.closing;
  };

  for (const [month, expected] of LADDER) {
    it(`closes ${month.month}/${month.year} at ${expected} days`, () => {
      expect(closingSick(month)).toBe(expected);
    });
  }

  it("never resets at a year boundary (item 8)", () => {
    // December 2024 closes at 13.5 and January 2025 opens from it, closing at
    // 15. Sick days are the entitlement that does *not* turn over with the
    // calendar year, unlike the vacation seven-day question and the holiday
    // allowance, both of which reset in January (Part 3). Resetting this one is
    // a single line's mistake and the workbook is the thing that catches it.
    expect(closingSick({ year: 2024, month: 12 })).toBe(13.5);
    expect(closingSick({ year: 2025, month: 1 })).toBe(15);
  });

  it("accrues once a month and not once a tab read", () => {
    // The whole ladder is 1.5 × the months elapsed, so a month accrued twice
    // shows up as a doubled figure and a month skipped as a short one. Checked
    // against the arithmetic rather than the engine: twenty-eight months from
    // April 2024 to July 2026 inclusive.
    expect(series).toHaveLength(28);
    expect(closingSick({ year: 2026, month: 7 })).toBe(28 * 1.5);
  });
});
