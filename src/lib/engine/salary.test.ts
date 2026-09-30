import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { monthsReachedBySalaryChange } from "@/lib/engine/profile";
import {
  reviewSalaryChange,
  salaryFor,
  withSalaryChange,
} from "@/lib/engine/salary";
import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import type { MonthFacts, WorkerTerms } from "@/lib/engine/types";
import type { YearMonth } from "@/lib/types";

/**
 * The base salary over time (specs.md item 3; decided with the user on
 * 2026-09-13 that a change holds from a month they name and the months before
 * it keep their salary).
 *
 * **Every figure is from the seeded rates or chosen here, and every expected
 * value is arithmetic worked by hand.** ₪6,247.65 and ₪6,443.85 are the minimum
 * wages the family's 2025 and 2026 workbooks pay (`datedRates.ts`); ₪6,500 and
 * ₪7,000 are raises this file invents, so which one a month reads is decided by
 * nothing but the dates written beside them.
 */

const WAGE_2025 = 624765;
const WAGE_2026 = 644385;

const TERMS: WorkerTerms = {
  employedSince: "2024-04-01",
  firstMonth: { year: 2024, month: 4 },
  gender: "female",
  baseMonthlySalaryAgorot: WAGE_2025,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  incomeTax: DEFAULT_INCOME_TAX,
  standingLines: [],
  country: "PH",
  openingPosition: { vacationDays: 0, sickDays: 0, vacationUsedThisYear: 0, holidayUsedThisYear: 0, recuperationPaidIn: null, advances: [] },
};

const ym = (year: number, month: number): YearMonth => ({ year, month });

const RAISED: WorkerTerms = {
  ...TERMS,
  salaryChanges: [
    { from: ym(2026, 4), agorot: 650000 },
    { from: ym(2026, 10), agorot: 700000 },
  ],
};

function facts(month: YearMonth, baseAgorot: number, minimumAgorot: number): MonthFacts {
  return {
    month,
    confirmedWage: { baseAgorot, minimumAgorot, effectiveFrom: "2026-04-01" },
    terms: {
      restDay: TERMS.restDay,
      restEveSupplementAgorot: TERMS.restEveSupplementAgorot,
      recuperationMonth: TERMS.recuperationMonth,
      incomeTax: DEFAULT_INCOME_TAX,
      standingLines: [],
    },
    spans: [],
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

describe("the salary in force during a month", () => {
  it("is the opening salary where no change was ever recorded", () => {
    expect(salaryFor(TERMS, ym(2026, 9))).toBe(WAGE_2025);
  });

  it("is the latest change dated on or before the month", () => {
    // Before the first change, the opening figure; each change holds from the
    // first of its own month and until the next one.
    expect(salaryFor(RAISED, ym(2026, 3))).toBe(WAGE_2025);
    expect(salaryFor(RAISED, ym(2026, 4))).toBe(650000);
    expect(salaryFor(RAISED, ym(2026, 9))).toBe(650000);
    expect(salaryFor(RAISED, ym(2026, 10))).toBe(700000);
    expect(salaryFor(RAISED, ym(2027, 1))).toBe(700000);
  });

  it("reads the dates and not the order the changes were stored in", () => {
    const reversed = {
      ...RAISED,
      salaryChanges: [...(RAISED.salaryChanges ?? [])].reverse(),
    };
    expect(salaryFor(reversed, ym(2026, 9))).toBe(650000);
  });
});

describe("recording a change", () => {
  it("replaces a change from the same month rather than adding a second", () => {
    const corrected = withSalaryChange(RAISED.salaryChanges, {
      from: ym(2026, 4),
      agorot: 660000,
    });
    expect(corrected).toEqual([
      { from: ym(2026, 4), agorot: 660000 },
      { from: ym(2026, 10), agorot: 700000 },
    ]);
  });

  it("keeps the list in date order", () => {
    const added = withSalaryChange(RAISED.salaryChanges, {
      from: ym(2026, 7),
      agorot: 680000,
    });
    expect(added.map((change) => change.from.month)).toEqual([4, 7, 10]);
  });
});

describe("what the user typed (item 3: never below the minimum wage)", () => {
  const floors = WAGE_2026;

  it("accepts the minimum wage itself", () => {
    expect(
      reviewSalaryChange("6443.85", ym(2026, 10), TERMS.employedSince, floors),
    ).toEqual({ ok: true, change: { from: ym(2026, 10), agorot: WAGE_2026 } });
  });

  it("refuses an agora below it", () => {
    expect(
      reviewSalaryChange("6443.84", ym(2026, 10), TERMS.employedSince, floors),
    ).toEqual({ ok: false, reason: "belowMinimum" });
  });

  it("checks a late-recorded raise against the minimum of its own month, not today's", () => {
    // ₪6,300 in May 2025 was above that month's ₪6,247.65 and is below today's
    // ₪6,443.85. It is a true figure about 2025 and must be recordable.
    expect(
      reviewSalaryChange("6300", ym(2025, 5), TERMS.employedSince, WAGE_2025),
    ).toEqual({ ok: true, change: { from: ym(2025, 5), agorot: 630000 } });
  });

  it("accepts where the table has no row that early, rather than judging by today's", () => {
    // June 2024 is before the seeded table's first row, so there is no figure
    // to judge it by. ₪6,300 is below today's ₪6,443.85, which is the reading
    // that would refuse a true statement about 2024 for a law passed after it.
    // The month is floored again at its own confirmation, which is where the
    // rule binds.
    expect(
      reviewSalaryChange("6300", ym(2024, 6), TERMS.employedSince, null),
    ).toEqual({ ok: true, change: { from: ym(2024, 6), agorot: 630000 } });
  });

  it("refuses an amount that is not one, or zero", () => {
    for (const text of ["", "abc", "0"]) {
      expect(
        reviewSalaryChange(text, ym(2026, 10), TERMS.employedSince, floors),
      ).toEqual({ ok: false, reason: "salary" });
    }
  });

  it("refuses a month before the employment began, and a missing month", () => {
    // Employed from 1.4.2024: March 2024 is before them, April 2024 is theirs.
    expect(
      reviewSalaryChange("7000", ym(2024, 3), TERMS.employedSince, floors),
    ).toEqual({ ok: false, reason: "salaryFrom" });
    expect(
      reviewSalaryChange("7000", null, TERMS.employedSince, floors),
    ).toEqual({ ok: false, reason: "salaryFrom" });
    expect(
      reviewSalaryChange("7000", ym(2024, 4), TERMS.employedSince, floors).ok,
    ).toBe(true);
  });
});

describe("the stored months a change reaches", () => {
  const stored = [
    facts(ym(2026, 8), WAGE_2026, WAGE_2026),
    facts(ym(2026, 9), WAGE_2026, WAGE_2026),
    facts(ym(2026, 11), WAGE_2026, WAGE_2026),
  ];

  it("rewrites the months from the change on and leaves the ones before it", () => {
    const terms = { ...TERMS, salaryChanges: [{ from: ym(2026, 9), agorot: 700000 }] };
    const reached = monthsReachedBySalaryChange(stored, terms, ym(2026, 9));

    expect(reached.map((record) => record.month)).toEqual([ym(2026, 9), ym(2026, 11)]);
    expect(reached.every((record) => record.confirmedWage.baseAgorot === 700000)).toBe(
      true,
    );
    // The confirmed minimum is the month's own and is not touched.
    expect(reached.every((record) => record.confirmedWage.minimumAgorot === WAGE_2026)).toBe(
      true,
    );
  });

  it("gives each month the salary in force during it, not the change just made", () => {
    // A raise from September recorded while a raise from November already
    // stands: November keeps ₪7,500, September takes ₪7,000.
    const terms = {
      ...TERMS,
      salaryChanges: [
        { from: ym(2026, 9), agorot: 700000 },
        { from: ym(2026, 11), agorot: 750000 },
      ],
    };
    const reached = monthsReachedBySalaryChange(stored, terms, ym(2026, 9));
    expect(reached.map((record) => record.confirmedWage.baseAgorot)).toEqual([
      700000, 750000,
    ]);
  });

  it("never reaches back into a month already confirmed", () => {
    // Item 2: a payslip is "never a restatement of months already paid", and
    // Part 5 puts the moment at the confirmation. September here was filed on
    // 2 October; a raise agreed afterwards and dated back to September leaves
    // it exactly as the family filed it, and reaches November alone.
    const filed = [
      { ...facts(ym(2026, 9), WAGE_2026, WAGE_2026), confirmedAt: "2026-10-02T08:00:00.000Z" },
      facts(ym(2026, 11), WAGE_2026, WAGE_2026),
    ];
    const terms = { ...TERMS, salaryChanges: [{ from: ym(2026, 9), agorot: 700000 }] };
    const reached = monthsReachedBySalaryChange(filed, terms, ym(2026, 9));

    expect(reached.map((record) => record.month)).toEqual([ym(2026, 11)]);
  });

  it("never writes a month below its own confirmed minimum", () => {
    // A 2025 salary change reaching a month whose confirmed minimum is 2026's.
    const terms = { ...TERMS, salaryChanges: [{ from: ym(2026, 9), agorot: 630000 }] };
    const reached = monthsReachedBySalaryChange(stored, terms, ym(2026, 9));
    expect(reached.map((record) => record.confirmedWage.baseAgorot)).toEqual([
      WAGE_2026, WAGE_2026,
    ]);
  });
});
