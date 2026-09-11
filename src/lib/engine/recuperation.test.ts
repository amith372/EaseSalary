import { describe, expect, it } from "vitest";

import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { calculateMonth } from "@/lib/engine/month";
import { lineKeys } from "@/lib/engine/month";
import {
  employmentYearsCompletedBy,
  recuperationDaysFor,
  recuperationDaysPerYear,
} from "@/lib/engine/recuperation";
import { snapshotTerms } from "@/lib/engine/types";
import type { MonthFacts } from "@/lib/engine/types";
import {
  WORKBOOK_MONTHS,
  workbookFacts,
  workbookWorker,
} from "@/lib/engine/workbook.fixture";

/**
 * Recuperation: the days from seniority, the month they fall in, and the line
 * they are priced into (specs.md item 15).
 *
 * **Every expected figure here comes from outside the code under test.**
 *
 *  - The ladder is https://www.kolzchut.org.il/he/דמי_הבראה, read 2026-09-09:
 *    5 days for the first year, 6 for the second and third, 7 for the fourth
 *    through tenth, 8 for the eleventh through fifteenth, 9 for the sixteenth
 *    through nineteenth, and 10 from the twentieth. The caregiver's own terms
 *    page states the first three tiers as well.
 *  - The day counts for Hanna are the family's workbook:
 *    `שכר_חודשי_להאנה2025.xlsx` → `חודש  3.25` pays five days and
 *    `שכר_חודשי_להאנה2026.xlsx` → `חודש  3.26` pays six, against `C4`'s
 *    "התחלת עבודה:  1.4.2024".
 *  - ₪451.50 and its 1.7.2025 effective date are the same article's, and are
 *    what `SEEDED_RATES` carries.
 *  - ₪2,709.00 is 6 × ₪451.50, worked by hand.
 *
 * Nothing below reads a figure the engine produced.
 */

/** Hanna: employed 1.4.2024, recuperation paid in March (`workbook.fixture`). */
const HANNA = "2024-04-01";
const MARCH = 3;

describe("the seniority ladder", () => {
  it("gives the days the statute gives, at every tier and every boundary", () => {
    const expected: [number, number][] = [
      [1, 5],
      [2, 6],
      [3, 6],
      [4, 7],
      [10, 7],
      [11, 8],
      [15, 8],
      [16, 9],
      [19, 9],
      [20, 10],
      [30, 10],
    ];
    for (const [yearsCompleted, days] of expected) {
      expect(recuperationDaysPerYear(yearsCompleted)).toBe(days);
    }
  });

  /**
   * The caregiver-terms page stops at the tenth year, and a ladder that stopped
   * with it would pay a worker of eleven years seven days instead of eight.
   * Settled with the user on 2026-09-09: the general article continues, and it
   * is what the application follows.
   */
  it("does not flatten above the tenth year", () => {
    expect(recuperationDaysPerYear(11)).toBeGreaterThan(
      recuperationDaysPerYear(10),
    );
  });

  it("owes nothing before a full year has been completed", () => {
    expect(recuperationDaysPerYear(0)).toBe(0);
  });
});

describe("when an employment year is complete", () => {
  /**
   * The single day the whole question turned on. An employment beginning
   * 1.4.2024 has worked a full year by the end of 31.3.2025 — 1.4.2025 is the
   * second year's first day, not the first year's last. Read the other way the
   * workbook's `חודש  3.25` looks like a payment made a day early, and the
   * engine would pay nothing in the March the family actually pays in.
   */
  it("counts the year as complete on the day before the anniversary", () => {
    expect(employmentYearsCompletedBy(HANNA, "2025-03-30")).toBe(0);
    expect(employmentYearsCompletedBy(HANNA, "2025-03-31")).toBe(1);
    expect(employmentYearsCompletedBy(HANNA, "2025-04-01")).toBe(1);
  });

  it("counts none before the employment began, and none inside its first year", () => {
    expect(employmentYearsCompletedBy(HANNA, "2024-03-31")).toBe(0);
    expect(employmentYearsCompletedBy(HANNA, "2024-04-01")).toBe(0);
    expect(employmentYearsCompletedBy(HANNA, "2024-12-31")).toBe(0);
  });

  it("counts one more each year, on the same day of the year", () => {
    expect(employmentYearsCompletedBy(HANNA, "2026-03-31")).toBe(2);
    expect(employmentYearsCompletedBy(HANNA, "2027-03-31")).toBe(3);
    expect(employmentYearsCompletedBy(HANNA, "2034-03-31")).toBe(10);
  });

  /**
   * A 29 February start has no anniversary in an ordinary year, and the second
   * year therefore opens on the 1st of March. That closes the first year at the
   * end of the 28th of February, which is the correct count and not a rounding:
   * 29.2.2024 plus 365 days is 28.2.2025.
   */
  it("closes a 29 February year at the end of the 28th", () => {
    expect(employmentYearsCompletedBy("2024-02-29", "2025-02-27")).toBe(0);
    expect(employmentYearsCompletedBy("2024-02-29", "2025-02-28")).toBe(1);
  });
});

describe("the month the payment falls in", () => {
  it("pays in the month the family named and in no other", () => {
    for (let month = 1; month <= 12; month++) {
      const days = recuperationDaysFor(HANNA, MARCH, { year: 2026, month });
      expect(days).toBe(month === MARCH ? 6 : 0);
    }
  });

  /** The workbook's own two payments: five days in `חודש  3.25` and six in
   * `חודש  3.26`. This is criterion 1 — agreement with the family's sheet. */
  it("agrees with the workbook's own two recuperation payments", () => {
    expect(recuperationDaysFor(HANNA, MARCH, { year: 2025, month: 3 })).toBe(5);
    expect(recuperationDaysFor(HANNA, MARCH, { year: 2026, month: 3 })).toBe(6);
  });

  it("pays nothing in the recuperation month of the first employment year", () => {
    expect(recuperationDaysFor(HANNA, MARCH, { year: 2024, month: 3 })).toBe(0);
  });

  /**
   * A family that pays in a month other than the one its employment year ends
   * in still gets one payment a year, stepping once. July 2025 is inside
   * Hanna's second year, so the year completed by then is her first.
   */
  it("steps once a year whichever month the family chose", () => {
    const july = 7;
    expect(recuperationDaysFor(HANNA, july, { year: 2025, month: july })).toBe(5);
    expect(recuperationDaysFor(HANNA, july, { year: 2026, month: july })).toBe(6);
    expect(recuperationDaysFor(HANNA, july, { year: 2027, month: july })).toBe(6);
    expect(recuperationDaysFor(HANNA, july, { year: 2028, month: july })).toBe(7);
  });
});

describe("the day rate, which the application does not derive", () => {
  it("is the article's ₪451.50 from the 1st of July 2025", () => {
    const rate = rateInForce(SEEDED_RATES, "recuperationDayRate", {
      year: 2025,
      month: 7,
    });
    expect(rate?.value).toBe(45150);
    expect(rate?.effectiveFrom).toBe("2025-07-01");
  });

  /** `null` is an answer and not a failure: the previous rate has no start date
   * anyone can read off the page, so no row claims one. */
  it("has no figure for a month before it", () => {
    expect(
      rateInForce(SEEDED_RATES, "recuperationDayRate", { year: 2025, month: 6 }),
    ).toBeNull();
  });
});

/** March 2026 as the engine's facts, built from the workbook's own March tab
 * shape: Hanna's terms, her salary, and nothing else recorded. */
function marchFacts(overrides: Partial<MonthFacts> = {}): MonthFacts {
  const july2026 = WORKBOOK_MONTHS[WORKBOOK_MONTHS.length - 1];
  const worker = workbookWorker(july2026.salaryAgorot);
  return {
    ...workbookFacts(
      { ...july2026, month: { year: 2026, month: 3 }, freeRestDays: [], advances: [] },
      worker,
    ),
    terms: snapshotTerms(worker),
    ...overrides,
  };
}

const EMPLOYMENT = {
  employedSince: HANNA,
  gender: "female",
  openingPosition: workbookWorker(0).openingPosition,
} as const;

describe("the line the month draws", () => {
  it("prices six days at ₪451.50 into column G", () => {
    const result = calculateMonth(marchFacts(), EMPLOYMENT);
    const line = result.lines.find((l) => l.key === lineKeys.recuperation);
    expect(line?.units).toBe(6);
    expect(line?.rate).toBe(45150);
    // 6 × ₪451.50 = ₪2,709.00, worked by hand.
    expect(line?.amount).toBe(270900);
    expect(line?.column).toBe("G");
    expect(line?.overridable).toBe(true);
  });

  /**
   * Column G reaches the worker, so the payment is part of what the month came
   * to and part of what the national insurance is estimated on (item 19, Part
   * 5's column paragraph). A line drawn in H instead would look identical on
   * screen and pay her nothing.
   */
  it("raises the gross by exactly the payment", () => {
    const without = calculateMonth(
      marchFacts({ terms: { ...marchFacts().terms, recuperationMonth: 4 } }),
      EMPLOYMENT,
    );
    const with_ = calculateMonth(marchFacts(), EMPLOYMENT);
    expect((with_.gross ?? 0) - (without.gross ?? 0)).toBe(270900);
    expect(with_.nationalInsuranceEstimate).toBeGreaterThan(
      without.nationalInsuranceEstimate ?? 0,
    );
  });

  it("draws no line in an ordinary month", () => {
    const april = calculateMonth(
      marchFacts({ month: { year: 2026, month: 4 } }),
      EMPLOYMENT,
    );
    expect(april.lines.some((l) => l.key === lineKeys.recuperation)).toBe(false);
  });

  /**
   * The rate the month carries wins over the table's, which is what lets a past
   * month be reproduced at its own rate rather than at today's (item 15). The
   * figure below is the article's previous private-sector rate, ₪418.
   */
  it("uses the rate stored on the month over the table's", () => {
    const result = calculateMonth(
      marchFacts({ recuperationDayRateAgorot: 41800 }),
      EMPLOYMENT,
    );
    const line = result.lines.find((l) => l.key === lineKeys.recuperation);
    // 6 × ₪418.00 = ₪2,508.00, worked by hand.
    expect(line?.amount).toBe(250800);
  });

  /**
   * The suggestion may be changed before it is approved (item 15), and item
   * 17's override is how. The units and the rate stay as the engine worked them
   * out, so the screen can still show what the figure replaced.
   */
  it("lets the user replace the amount, and says it is manual", () => {
    const result = calculateMonth(
      marchFacts({ overrides: { [lineKeys.recuperation]: { agorot: 300000 } } }),
      EMPLOYMENT,
    );
    const line = result.lines.find((l) => l.key === lineKeys.recuperation);
    expect(line?.amount).toBe(300000);
    expect(line?.manual).toBe(true);
    expect(line?.calculatedAmount).toBe(270900);
  });

  /**
   * A recuperation month with no rate anywhere says so rather than going
   * quietly absent, which would read as an ordinary month.
   */
  it("warns rather than silently omitting the line when no rate exists", () => {
    const march2025 = calculateMonth(
      marchFacts({ month: { year: 2025, month: 3 } }),
      EMPLOYMENT,
      { rates: [] },
    );
    expect(march2025.lines.some((l) => l.key === lineKeys.recuperation)).toBe(
      false,
    );
    expect(
      march2025.warnings.some((w) => w.key === "recuperationRateMissing"),
    ).toBe(true);
  });

  it("raises no such warning in a month that is not the recuperation month", () => {
    const april = calculateMonth(
      marchFacts({ month: { year: 2025, month: 4 } }),
      EMPLOYMENT,
      { rates: [] },
    );
    expect(april.warnings.some((w) => w.key === "recuperationRateMissing")).toBe(
      false,
    );
  });
});
