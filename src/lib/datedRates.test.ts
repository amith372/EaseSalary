import { describe, expect, it } from "vitest";
import {
  SEEDED_RATES,
  rateInForce,
  type DatedRate,
} from "@/lib/datedRates";
import type { YearMonth } from "@/lib/types";

/**
 * The dated-rates table (specs.md item 4, Part 3).
 *
 * **Where each expected figure comes from.** Not one is read back from what the
 * lookup returned.
 *
 *   the 2025 minimum wage      ₪6,247.65   שכר_חודשי_להאנה2025.xlsx ->
 *                                          חודש  4.25 -> D6, and every tab
 *                                          through חודש  3.26
 *   the 2026 minimum wage      ₪6,443.85   שכר_חודשי_להאנה2026.xlsx ->
 *                                          חודש  4.26 -> D6 onward
 *   when each took effect      1 April     the same two cells: the rise lands
 *                                          in April and not in January, which
 *                                          is why חודש  3.26 still pays the
 *                                          2025 figure
 *   the national-insurance     3.6%        specs.md item 19, in force from
 *   percentage                             January 2025 (Part 5)
 *
 * **What these tests would catch.** A table read by calendar year rather than
 * by date, which pays March 2026 at the April 2026 wage — the single mistake
 * the workbook's own arrangement demonstrates. A lookup that takes the last
 * matching row in array order rather than the latest by date, which is correct
 * until a fetch appends an older row. A lookup that reaches for the earliest
 * row when the table begins after the month, which is the undated guess this
 * table exists to remove. And a key that leaks into another key's answer,
 * which would value a month at 0.036 agorot of minimum wage.
 */

const APRIL_2025: YearMonth = { year: 2025, month: 4 };
const MARCH_2026: YearMonth = { year: 2026, month: 3 };
const APRIL_2026: YearMonth = { year: 2026, month: 4 };

const WAGE_2025 = 624765;
const WAGE_2026 = 644385;

/**
 * The two wage rows, deliberately written **newest first**, so a lookup that
 * trusts array order rather than the dates fails here rather than in a year's
 * time when a fetch happens to append an older figure.
 */
const wages: DatedRate[] = [
  {
    key: "minimumWage",
    value: WAGE_2026,
    effectiveFrom: "2026-04-01",
    source: "שכר_חודשי_להאנה2026.xlsx → חודש  4.26 → D6",
  },
  {
    key: "minimumWage",
    value: WAGE_2025,
    effectiveFrom: "2025-04-01",
    source: "שכר_חודשי_להאנה2025.xlsx → חודש  4.25 → D6",
  },
];

describe("the figure in force during a month (specs.md item 4)", () => {
  it("reads the rate the month opened under and not the latest one", () => {
    expect(rateInForce(wages, "minimumWage", MARCH_2026)?.value).toBe(WAGE_2025);
    expect(rateInForce(wages, "minimumWage", APRIL_2026)?.value).toBe(WAGE_2026);
  });

  it("applies a rate from the month its effective date falls in", () => {
    // 1.4.2025 is the first day of April 2025, so April is the first month
    // valued at it — not May.
    expect(rateInForce(wages, "minimumWage", APRIL_2025)?.value).toBe(WAGE_2025);
  });

  it("is not keyed by calendar year", () => {
    // The two months either side of the rise are in one calendar year and are
    // valued differently, which a year-keyed table cannot express.
    expect(rateInForce(wages, "minimumWage", MARCH_2026)?.value).not.toBe(
      rateInForce(wages, "minimumWage", APRIL_2026)?.value,
    );
  });

  it("answers null for a month the table begins after", () => {
    // March 2025 predates every row. The honest answer is that the application
    // has no figure for it; reaching for the 2025 row would be a rate applied
    // to a month it was not in force during.
    expect(rateInForce(wages, "minimumWage", { year: 2025, month: 3 })).toBe(
      null,
    );
  });

  it("never answers with another key's row", () => {
    expect(rateInForce(wages, "nationalInsurance", APRIL_2026)).toBe(null);
    expect(
      rateInForce(SEEDED_RATES, "nationalInsurance", APRIL_2026)?.key,
    ).toBe("nationalInsurance");
  });

  it("carries the source of the figure it answers with", () => {
    // A figure without its source is a figure nobody can check, which is what
    // Part 3 asks the table to hold beside the date.
    expect(rateInForce(wages, "minimumWage", APRIL_2026)?.source).toContain(
      "חודש  4.26",
    );
  });
});

describe("what the application ships knowing", () => {
  it("holds the national-insurance percentage with the date it took effect", () => {
    const rate = rateInForce(SEEDED_RATES, "nationalInsurance", APRIL_2025);
    expect(rate?.value).toBe(0.036);
    expect(rate?.effectiveFrom).toBe("2025-01-01");
  });

  it("offers no national-insurance percentage for a month before it rose", () => {
    // The workbook's own line stayed at 2% of the 2024 wage after the rise
    // (Part 5). The application holds no dated figure for those months and
    // says so rather than valuing them at today's percentage.
    expect(
      rateInForce(SEEDED_RATES, "nationalInsurance", { year: 2024, month: 12 }),
    ).toBe(null);
  });

  it("holds both minimum wages the committed workbooks state", () => {
    expect(rateInForce(SEEDED_RATES, "minimumWage", MARCH_2026)?.value).toBe(
      WAGE_2025,
    );
    expect(rateInForce(SEEDED_RATES, "minimumWage", APRIL_2026)?.value).toBe(
      WAGE_2026,
    );
  });

  it("dates every seeded row to a first of month, and sources it", () => {
    // The lookup rests on the stored date being the official תאריך תחולה, which
    // is always a first of month: a rise that applies retroactively is written
    // as an earlier first-of-month rather than as a date inside a month.
    for (const rate of SEEDED_RATES) {
      expect(rate.effectiveFrom).toMatch(/^\d{4}-\d{2}-01$/);
      expect(rate.source).not.toBe("");
    }
  });
});
