import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import {
  HOLIDAYS_PER_YEAR,
  holidayAllowanceFor,
  holidayDaysOf,
  holidayDaysRemaining,
  holidayDaysWorked,
  restDayUnitsOf,
} from "@/lib/engine/leave";
import { calculateMonth, lineKeys } from "@/lib/engine/month";
import { snapshotTerms} from "@/lib/engine/types";
import type { ClosedMonthFacts, ClosedSpan, WorkerTerms } from "@/lib/engine/types";
import { validateMonth } from "@/lib/engine/validate";
import type { MonthResult, YearMonth } from "@/lib/types";

/**
 * Leave: the holidays that are paid, the entitlement they are drawn from, the
 * part days taken and paid in proportion, and the assertion that vacation costs
 * nothing at all.
 *
 * **Where each expected figure comes from.**
 *
 *   S = ₪6,247.65 = 624,765 agorot        the August 2025 wage (Part 4)
 *   the rest-day rate = ₪426.35            Part 4, and Part 5's formula:
 *                                          (S/25 + S/182) × 1.5 = 42,635.06…
 *   nine days a year                       item 10
 *   9 × 9/12 = 6.75 for 2024               item 10, measured in months employed
 *                                          and written out in the workbook:
 *                                          שכר_חודשי_להאנה2024.xlsx ->
 *                                          חודש  12.24 -> C9 = 6.75 days,
 *                                          F9 = 6.75 x 401.25 (I9 has the why)
 *
 * Not one figure is read back from what the engine returned.
 */

const SALARY = 624765;
const REST_DAY_RATE = 42635; // ₪426.35, Part 4
const REST_EVE_SUPPLEMENT = 10000;

const AUGUST_2025: YearMonth = { year: 2025, month: 8 };

/**
 * August 2025 off the calendar: five Saturdays — 2, 9, 16, 23, 30 — and five
 * Fridays, so 26 standard days, which is Part 4's "31-day month with 26
 * working days". The 13th and the 14th are a Wednesday and a Thursday.
 */
const holiday = (date: string, worked: boolean, fraction?: number): ClosedSpan => ({
  id: `hol-${date}`,
  kind: "holiday",
  from: date,
  to: date,
  worked,
  ...(fraction === undefined ? {} : { fraction }),
});

const vacation = (from: string, to: string, fraction?: number): ClosedSpan => ({
  id: `vac-${from}`,
  kind: "vacation",
  from,
  to,
  ...(fraction === undefined ? {} : { fraction }),
});

function terms(employedSince = "2024-04-01"): WorkerTerms {
  return {
    employedSince,
    gender: "female",
    baseMonthlySalaryAgorot: SALARY,
    restDay: SATURDAY,
    restEveSupplementAgorot: REST_EVE_SUPPLEMENT,
    recuperationMonth: 7,
    incomeTax: DEFAULT_INCOME_TAX,
    standingLines: [],
    country: "PH",
    openingPosition: { vacationDays: 20, sickDays: 43.5, advances: [] },
  };
}

function facts(spans: ClosedSpan[], month: YearMonth = AUGUST_2025): ClosedMonthFacts {
  return {
    terms: snapshotTerms(terms()),
    month,
    confirmedWage: {
      baseAgorot: SALARY,
      minimumAgorot: SALARY,
      effectiveFrom: "2025-04-01",
    },
    spans,
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

function unitsOf(result: MonthResult, key: string): number | null | undefined {
  return result.lines.find((line) => line.key === key)?.units;
}

function columnTotal(result: MonthResult, column: string): number {
  return result.lines
    .filter((line) => line.column === column)
    .reduce((total, line) => total + (line.amount ?? 0), 0);
}

describe("a holiday changes the money or the count, never both (item 9)", () => {
  // An ordinary August: nothing marked, all five rest days worked.
  const bare = calculateMonth(facts([]), terms());

  it("adds one rest-day rate for a holiday she worked", () => {
    // Wednesday 13 August, worked. Column F gains one day at ₪426.35 over the
    // five Saturdays already there: 6 × 42,635 = 255,810 agorot.
    const result = calculateMonth(facts([holiday("2025-08-13", true)]), terms());
    expect(unitsOf(result, lineKeys.holidaysWorked)).toBe(1);
    expect(columnTotal(result, "F")).toBe(columnTotal(bare, "F") + REST_DAY_RATE);
    expect(columnTotal(result, "F")).toBe(6 * REST_DAY_RATE);
  });

  it("adds nothing at all for a holiday she did not work", () => {
    // The monthly salary is paid on it in full and no vacation day is drawn, so
    // there is no line rather than a line worth nothing.
    const result = calculateMonth(facts([holiday("2025-08-13", false)]), terms());
    expect(result.lines.find((line) => line.key === lineKeys.holidaysWorked)).toBeUndefined();
    expect(result.gross).toBe(bare.gross);
    // It does leave the actual count, which is the half a holiday she did not
    // work moves (item 5): 26 less one day.
    expect(result.actualDays).toBe(25);
    expect(result.standardDays).toBe(26);
  });

  it("moves the count for the unworked one and the money for the worked one", () => {
    const worked = calculateMonth(facts([holiday("2025-08-13", true)]), terms());
    expect(worked.actualDays).toBe(26); // a working day like any other
    expect(worked.gross).not.toBe(bare.gross);
  });
});

describe("a holiday on a Saturday she works is paid once (specs.md item 9)", () => {
  // Saturday 16 August 2025, worked, and also a paid holiday. Both lines pay at
  // the same rest-day rate off the same date, so the day would be paid twice
  // unless one of them gives it up.
  const spans = [holiday("2025-08-16", true)];
  const result = calculateMonth(facts(spans), terms());

  it("pays column F for five days and not six", () => {
    // August has five Saturdays, all worked, one of which is the holiday.
    // 5 × 42,635 = 213,175 agorot. Six would be the double payment.
    expect(columnTotal(result, "F")).toBe(5 * REST_DAY_RATE);
    expect(columnTotal(result, "F")).not.toBe(6 * REST_DAY_RATE);
  });

  it("leaves the day on the holiday line and takes it out of the rest days", () => {
    expect(unitsOf(result, lineKeys.holidaysWorked)).toBe(1);
    expect(unitsOf(result, lineKeys.restDays)).toBe(4);
  });

  it("still reports all five rest days as worked, because she worked them", () => {
    // The count is a fact about the month and stays true; only what is paid on
    // which line moves.
    expect(restDayUnitsOf(spans, 5, SATURDAY)).toBe(4);
    expect(restDayUnitsOf([], 5, SATURDAY)).toBe(5);
  });

  it("comes to the same column F as the same holiday on a weekday would not", () => {
    // The contrast that makes the rule visible: on a Wednesday the holiday adds
    // a sixth day, on a Saturday it does not add a day at all.
    const weekday = calculateMonth(facts([holiday("2025-08-13", true)]), terms());
    expect(columnTotal(weekday, "F")).toBe(6 * REST_DAY_RATE);
    expect(columnTotal(result, "F")).toBe(5 * REST_DAY_RATE);
  });
});

describe("part days are paid and drawn in their own proportion (items 7, 10)", () => {
  it("pays half a rest-day rate for half a holiday worked", () => {
    // Half of ₪426.35 is ₪213.175, and the rounding happens once at the end:
    // 5.5 × 42,635.062… = 234,492.84… -> 234,493 agorot.
    const result = calculateMonth(
      facts([holiday("2025-08-13", true, 0.5)]),
      terms(),
    );
    expect(unitsOf(result, lineKeys.holidaysWorked)).toBe(0.5);
    expect(columnTotal(result, "F")).toBe(234493);
  });

  it("draws half a day from the entitlement for half a holiday", () => {
    expect(holidayDaysOf([holiday("2025-08-13", false, 0.5)], SATURDAY)).toBe(0.5);
    expect(holidayDaysOf([holiday("2025-08-13", false)], SATURDAY)).toBe(1);
  });

  it("counts a multi-day holiday span in days and not as one span", () => {
    // The entitlement counts days: nine for a full year. A span of three must
    // not weigh the same against it as a span of one.
    const threeDays: ClosedSpan = {
      id: "hol-run",
      kind: "holiday",
      from: "2025-08-11",
      to: "2025-08-13",
      worked: true,
    };
    expect(holidayDaysOf([threeDays], SATURDAY)).toBe(3);
    expect(holidayDaysWorked([threeDays])).toBe(3);
  });

  it("leaves half a day in the actual count for half a vacation day", () => {
    // Item 5: a day taken in part leaves the actual count in that proportion.
    const result = calculateMonth(
      facts([vacation("2025-08-13", "2025-08-13", 0.5)]),
      terms(),
    );
    expect(result.actualDays).toBe(25.5);
    expect(result.balances.find((b) => b.kind === "vacation")?.used).toBe(0.5);
  });
});

describe("the yearly entitlement (specs.md item 10)", () => {
  it("is nine days for a full year", () => {
    expect(HOLIDAYS_PER_YEAR).toBe(9);
    expect(holidayAllowanceFor("2024-04-01", 2025)).toBe(9);
    expect(holidayAllowanceFor("2024-04-01", 2028)).toBe(9);
  });

  it("is 6.75 for a worker employed from 1 April, in that calendar year", () => {
    // Nine months of 2024 — April counted whole — so 9 × 9/12 = 6.75. This is
    // the workbook's own figure — C9 of חודש  12.24 in שכר_חודשי_להאנה2024.xlsx,
    // paid at F9 — and not a day-by-day proration, which would give 6.76.
    expect(holidayAllowanceFor("2024-04-01", 2024)).toBe(6.75);
    expect(holidayAllowanceFor("2024-04-01", 2024)).not.toBe(6.76);
  });

  it("counts the month employment began as a whole month", () => {
    // A worker starting on the 30th of April has the same nine months as one
    // starting on the 1st: partial months are out of scope for this version.
    expect(holidayAllowanceFor("2024-04-30", 2024)).toBe(6.75);
    // January leaves all twelve; December leaves one, so 9 × 1/12 = 0.75.
    expect(holidayAllowanceFor("2024-01-15", 2024)).toBe(9);
    expect(holidayAllowanceFor("2024-12-31", 2024)).toBe(0.75);
  });

  it("turns over on the 1st of January, like the vacation year (item 7)", () => {
    // Not on the employment anniversary: every month of 2025 has the full nine,
    // including the three before her April anniversary.
    expect(holidayAllowanceFor("2024-04-01", 2025)).toBe(9);
    expect(holidayAllowanceFor("2024-04-01", 2023)).toBe(0);
  });

  it("shows the remainder as it falls, even when it is not whole", () => {
    // 6.75 less two and a half days taken is 4.25.
    expect(holidayDaysRemaining(6.75, 2.5)).toBe(4.25);
    // A day beyond the entitlement is refused rather than shown as a minus.
    expect(holidayDaysRemaining(6.75, 8)).toBe(0);
  });

  it("refuses a month against the entitlement the worker actually has", () => {
    // Seven whole holidays in December 2024, against an allowance of 6.75.
    // Nothing is handed in, so the refusal has to derive the allowance itself.
    const seven = [1, 2, 3, 4, 5, 8, 9].map((day) =>
      holiday(`2024-12-0${day}`, false),
    );
    const december = { year: 2024, month: 12 };
    const [refusal] = validateMonth(facts(seven, december), terms());
    expect(refusal?.code).toBe("holidayLimit");
    // Six is inside it; the seventh is what crosses 6.75.
    expect(validateMonth(facts(seven.slice(0, 6), december), terms())).toEqual([]);
  });
});

describe("vacation costs nothing, structurally (specs.md item 7)", () => {
  // The assertion the whole of item 7 rests on. Equal totals alone would not
  // prove it: a vacation payment and a shrunken base cancelling would give
  // equal totals too, and that is exactly the arrangement item 7 forbids. So
  // the lines are compared as well.
  const without = calculateMonth(facts([]), terms());
  const withVacation = calculateMonth(
    facts([vacation("2025-08-11", "2025-08-13")]),
    terms(),
  );
  // Sunday 10 to Saturday 16: a range with a Friday and a Saturday inside it.
  const week = calculateMonth(
    facts([vacation("2025-08-10", "2025-08-16")]),
    terms(),
  );

  it("comes to the same net", () => {
    expect(withVacation.net).toBe(without.net);
    expect(withVacation.gross).toBe(without.gross);
  });

  it("carries the very same lines, not lines that cancel", () => {
    expect(withVacation.lines).toEqual(without.lines);
    expect(withVacation.subtotals).toEqual(without.subtotals);
    expect(withVacation.closing).toEqual(without.closing);
  });

  it("carries no vacation line and no vacation rate anywhere", () => {
    expect(
      withVacation.lines.some((line) => line.key.toLowerCase().includes("vacation")),
    ).toBe(false);
  });

  it("differs only in the vacation balance and the actual count", () => {
    // The two figures the sheet does carry, and neither is an amount: three
    // days used off an opening balance of 20, and 26 less 3 actually worked.
    const before = without.balances.find((b) => b.kind === "vacation");
    const after = withVacation.balances.find((b) => b.kind === "vacation");
    expect(before?.used).toBe(0);
    expect(after?.used).toBe(3);
    expect(after?.closing).toBe((before?.closing ?? 0) - 3);
    expect(withVacation.actualDays).toBe(23);
    expect(withVacation.standardDays).toBe(26);
  });

  it("draws six days and not seven from a range spanning a Saturday", () => {
    // Sunday 10 to Saturday 16 August is seven days, six of which draw:
    // Saturday is already the weekly rest day, so a vacation day for it would
    // charge her twice (item 5). `spans.ts` owns the rule and would in fact
    // refuse the 16th at mark time; this is the engine consuming the same rule
    // for a span that reached it whole from storage.
    expect(week.balances.find((b) => b.kind === "vacation")?.used).toBe(6);
    expect(week.lines.find((line) => line.key === lineKeys.base)?.amount).toBe(
      624765,
    );
    expect(
      week.lines.some((line) => line.key.toLowerCase().includes("vacation")),
    ).toBe(false);
  });

  it("moves money only through the days she was away, never through the vacation", () => {
    // The week takes Friday 15 and Saturday 16 out of the days she attended,
    // and only one of them costs anything. A Saturday she did not work earns no
    // rest-day premium (item 5): −₪426.35. **The Friday costs nothing**, because
    // the rest-eve supplement is paid for every rest-eve of the month whether
    // she worked it or not (item 14) — it is an agreed term and attendance is
    // not a condition on it. Neither figure is a price on the vacation, and the
    // base is untouched above.
    expect((without.net ?? 0) - (week.net ?? 0)).toBe(REST_DAY_RATE);
  });
});
