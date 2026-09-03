import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth } from "@/lib/engine/month";
import { placementOf, snapshotTerms } from "@/lib/engine/types";
import type { MonthFacts, UserLine, WorkerTerms } from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";

/**
 * Lines the user added, in both directions and both lifetimes (specs.md
 * item 20).
 *
 * **The figures are derived on paper from Part 4's own salary.** August 2025
 * with nothing marked: five Saturdays all worked and five Fridays, so
 *
 *   column E   624,765 + 5 × 10,000                 = 674,765   ₪6,747.65
 *   column F   5 × 42,635.062087912… = 213,175.31…  = 213,175   ₪2,131.75
 *   gross                                            = 887,940   ₪8,879.40
 *
 * Part 4 states the ₪6,747.65 outright and the rest-day rate is the one its
 * ₪2,558.10 is built from, so nothing below is read back from the engine.
 *
 * **The four combinations, each moving one thing.** A standing addition of ₪500
 * lands in column E, because a payment made every month is part of what she
 * earns; a one-off addition of ₪300 lands in G, which is what that column is
 * for. Deductions of either lifetime land in the block below the columns, so
 * they move what is transferred and never what she earned:
 *
 *   standing addition   E 724,765   gross 937,940   net 937,940
 *   one-off addition    G  30,000   gross 917,940   net 917,940
 *   standing deduction  E 674,765   gross 887,940   net 867,940
 *   one-off deduction   E 674,765   gross 887,940   net 872,940
 */

const AUGUST_2025 = { year: 2025, month: 8 } as const;
const SALARY = 624765;

function worker(standingLines: UserLine[] = []): WorkerTerms {
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

function facts(w: WorkerTerms, userLines: UserLine[] = []): MonthFacts {
  return {
    month: AUGUST_2025,
    terms: snapshotTerms(w),
    confirmedWage: {
      baseAgorot: SALARY,
      minimumAgorot: SALARY,
      effectiveFrom: "2025-04-01",
    },
    spans: [],
    advances: [],
    thirdPartyPayments: [],
    userLines,
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

/** A payment the family agreed **on top of** the salary (specs.md item 20). */
const agreedExtra: UserLine = {
  id: "pocket",
  label: "תוספת שסוכמה מעבר לשכר",
  direction: "addition",
  agorot: 50000,
  note: "סוכם עם המשפחה",
};

/** Money handed over during the month that the salary already contains, so what
 * shrinks is the transfer at month end and never the gross (specs.md item 20). */
const standingDeduction: UserLine = {
  id: "phone",
  label: "מקדמה ששולמה במזומן",
  direction: "deduction",
  agorot: 20000,
};

const oneOffAddition: UserLine = {
  id: "bonus",
  label: "השלמה מחודש קודם",
  direction: "addition",
  agorot: 30000,
};

const oneOffDeduction: UserLine = {
  id: "breakage",
  label: "השתתפות בנזק",
  direction: "deduction",
  agorot: 15000,
};

function column(result: { lines: { column: string; amount: number | null }[] }, c: string) {
  return result.lines
    .filter((line) => line.column === c)
    .reduce((total, line) => total + (line.amount ?? 0), 0);
}

describe("the month with no lines of the user's own", () => {
  it("comes to ₪8,879.40, which every case below moves from", () => {
    const result = calculateMonth(facts(worker()), worker());
    expect(column(result, "E")).toBe(674765);
    expect(column(result, "F")).toBe(213175);
    expect(result.gross).toBe(887940);
    expect(result.net).toBe(887940);
  });
});

describe("a standing addition — a payment agreed on top (specs.md item 20)", () => {
  const w = worker([agreedExtra]);
  const result = calculateMonth(facts(w), w);

  it("sits in column E, because she earns it every month", () => {
    // 674,765 + 50,000. What a family uses instead of bending the rest-eve
    // supplement into a second agreement about a different day.
    expect(column(result, "E")).toBe(724765);
    expect(result.gross).toBe(937940);
    expect(result.net).toBe(937940);
  });

  it("keeps the user's own words as the label and its own key", () => {
    const line = result.lines.find((l) => l.key === "standing.pocket");
    expect(line?.label).toBe("תוספת שסוכמה מעבר לשכר");
    expect(line?.column).toBe("E");
    expect(line?.amount).toBe(50000);
  });

  it("counts inside column E's own subtotal", () => {
    // The subtotal is the sum of the lines in the column, so a standing line
    // that reached E but not its subtotal would make the sheet stop adding up.
    expect(result.subtotals.find((s) => s.column === "E")?.amount).toBe(724765);
  });
});

describe("a one-off addition (specs.md item 20)", () => {
  it("sits in column G, which is what that column is for", () => {
    // 887,940 + 30,000, and column E untouched.
    const w = worker();
    const result = calculateMonth(facts(w, [oneOffAddition]), w);
    expect(column(result, "E")).toBe(674765);
    expect(column(result, "G")).toBe(30000);
    expect(result.gross).toBe(917940);
  });
});

describe("a deduction is withheld, never un-earned (specs.md item 20)", () => {
  it("moves the standing case's net and leaves its gross alone", () => {
    // 887,940 earned, 20,000 withheld, 867,940 transferred. A deduction that
    // moved the gross would be saying she never earned the money, which is a
    // different claim and the wrong one.
    const w = worker([standingDeduction]);
    const result = calculateMonth(facts(w), w);
    expect(result.gross).toBe(887940);
    expect(result.net).toBe(867940);
    expect(column(result, "E")).toBe(674765);
  });

  it("moves the one-off case's net and leaves its gross alone", () => {
    const w = worker();
    const result = calculateMonth(facts(w, [oneOffDeduction]), w);
    expect(result.gross).toBe(887940);
    expect(result.net).toBe(872940);
  });

  it("takes its sign from the direction, never from the amount", () => {
    // The user picks the kind and never types a minus, so `agorot` is positive
    // on the way in and the row is negative on the way out. A sign that came
    // from the figure could disagree with the label beside it.
    const w = worker([standingDeduction]);
    const row = calculateMonth(facts(w), w).closing.find(
      (r) => r.key === "standing.phone",
    );
    expect(standingDeduction.agorot).toBeGreaterThan(0);
    expect(row?.amount).toBe(-20000);
    expect(row?.label).toBe("מקדמה ששולמה במזומן");
  });
});

describe("all four at once", () => {
  it("adds and withholds each exactly once", () => {
    // E 674,765 + 50,000 = 724,765; G 30,000; gross 967,940; then 20,000 and
    // 15,000 withheld, so 932,940 transferred.
    const w = worker([agreedExtra, standingDeduction]);
    const result = calculateMonth(
      facts(w, [oneOffAddition, oneOffDeduction]),
      w,
    );
    expect(column(result, "E")).toBe(724765);
    expect(column(result, "G")).toBe(30000);
    expect(result.gross).toBe(967940);
    expect(result.net).toBe(932940);
  });
});

describe("a standing line is a term, so stopping it does not restate the past", () => {
  it("keeps paying the month that was calculated with it", () => {
    // Criterion 13's safety, applied to item 20: the month holds the terms it
    // was confirmed with (Part 3), so the family stopping a standing line today
    // leaves August exactly where it was. The month is calculated against its
    // own snapshot and never against the profile.
    const before = worker([agreedExtra]);
    const august = facts(before);

    const after = worker([]);
    expect(after.standingLines).toEqual([]);

    // The same stored month, calculated after the profile changed.
    const result = calculateMonth(august, after);
    expect(column(result, "E")).toBe(724765);
    expect(result.gross).toBe(937940);
  });

  it("does not pay a month confirmed before the line existed", () => {
    // The other direction, and the one that would be a silent restatement:
    // adding a standing line today must not reach back into a month that never
    // had it.
    const w = worker([]);
    expect(calculateMonth(facts(w), worker([agreedExtra])).gross).toBe(887940);
  });
});

describe("an override reaches a user line by its own key (specs.md item 17)", () => {
  it("replaces the amount and marks it manual", () => {
    const w = worker([agreedExtra]);
    const result = calculateMonth(
      { ...facts(w), overrides: { "standing.pocket": { agorot: 60000 } } },
      w,
    );
    const line = result.lines.find((l) => l.key === "standing.pocket");
    expect(line?.amount).toBe(60000);
    expect(line?.manual).toBe(true);
    expect(result.gross).toBe(887940 + 60000);
  });
});

/**
 * **Where a line sits is the user's choice and is not implied by its direction**
 * (specs.md item 20). Every figure below is derived from the same ₪8,879.40 the
 * first case in this file states, and from item 19's 3.6% of the month's full
 * cost:
 *
 *   the month itself       gross 887,940   estimate 887,940 × 3.6% = 31,965.84
 *   ₪150 withheld before   gross 872,940   estimate 872,940 × 3.6% = 31,425.84
 *   ₪500 added before      gross 937,940   estimate 937,940 × 3.6% = 33,765.84
 *
 * None of the three is read back from the engine: the gross is the base case
 * plus or minus the line, and the estimate is the rate applied to it by hand.
 */
describe("a line placed before or after the month's total (specs.md item 20)", () => {
  /** A deduction the user chose to put *inside* the month, which is the
   * combination the old rule could not express at all. */
  const withheldBefore: UserLine = {
    ...oneOffDeduction,
    placement: "beforeGross",
  };

  /** An addition the user chose to put *outside* it — money handed over that is
   * not part of what the month cost. */
  const addedAfter: UserLine = { ...agreedExtra, placement: "afterGross" };

  it("puts a deduction into its column, negative, when placed before", () => {
    const w = worker();
    const result = calculateMonth(facts(w, [withheldBefore]), w);
    const line = result.lines.find((l) => l.key === "extra.breakage");
    expect(line?.column).toBe("G");
    expect(line?.amount).toBe(-15000);
    // The sheet must still add up by eye: units × rate rounds to the amount on
    // every line, including one that withholds.
    expect(Math.round((line?.units ?? 0) * (line?.rate ?? 0))).toBe(-15000);
    expect(result.subtotals.find((s) => s.column === "G")?.amount).toBe(-15000);
  });

  it("signs the units and never the unit price", () => {
    // Column D of the sheet is a price, and a price is not negative (Part 5).
    // The sickness deduction already writes a withheld row this way — negative
    // days at what a day is worth — and a line the user withholds is one unit
    // taken back at what that unit costs.
    const w = worker();
    const line = calculateMonth(facts(w, [withheldBefore]), w).lines.find(
      (l) => l.key === "extra.breakage",
    );
    expect(line?.units).toBe(-1);
    expect(line?.rate).toBe(15000);
  });

  it("keeps an overridden line on the direction's side of zero, either way", () => {
    // The failure this closes: the same key sits in a column when placed before
    // and in the block below when placed after, and the two rounded an override
    // differently — so moving the line across the total inverted an amount the
    // user had typed, and the sheet looked entirely ordinary (items 17, 20).
    const w = worker();
    const overrides = { "extra.breakage": { agorot: 20000 } };

    const before = calculateMonth(
      { ...facts(w, [withheldBefore]), overrides },
      w,
    ).lines.find((l) => l.key === "extra.breakage");
    const after = calculateMonth(
      { ...facts(w, [oneOffDeduction]), overrides },
      w,
    ).closing.find((r) => r.key === "extra.breakage");

    expect(before?.amount).toBe(-20000);
    expect(after?.amount).toBe(-20000);
    expect(before?.manual).toBe(true);
    expect(after?.manual).toBe(true);
  });

  it("takes that deduction out of the month's total and its estimate", () => {
    const w = worker();
    const result = calculateMonth(facts(w, [withheldBefore]), w);
    expect(result.gross).toBe(872940);
    expect(result.net).toBe(872940);
    // 3.6% of a month that cost ₪150 less. This is the whole reason the choice
    // exists: the same ₪150 placed after the total leaves the estimate alone.
    expect(result.nationalInsuranceEstimate).toBe(31426);
  });

  it("keeps an addition placed after out of the total and the estimate", () => {
    const w = worker([addedAfter]);
    const result = calculateMonth(facts(w), w);
    expect(column(result, "E")).toBe(674765);
    expect(result.gross).toBe(887940);
    expect(result.net).toBe(937940);
    expect(result.nationalInsuranceEstimate).toBe(31966);
  });

  it("pays the worker the same either way, and estimates a different cost", () => {
    // The check that says what the choice is actually about. She is transferred
    // ₪9,379.40 in both, and what differs is whether the ₪500 was part of the
    // month's cost — so the two estimates are 3.6% of ₪9,379.40 and of
    // ₪8,879.40.
    const after = worker([addedAfter]);
    const before = worker([{ ...agreedExtra, placement: "beforeGross" }]);

    const afterResult = calculateMonth(facts(after), after);
    const beforeResult = calculateMonth(facts(before), before);

    expect(afterResult.net).toBe(beforeResult.net);
    expect(afterResult.net).toBe(937940);
    expect(beforeResult.gross).toBe(937940);
    expect(afterResult.gross).toBe(887940);
    expect(beforeResult.nationalInsuranceEstimate).toBe(33766);
    expect(afterResult.nationalInsuranceEstimate).toBe(31966);
  });

  it("defaults to where every line sat before the choice existed", () => {
    // An omitted placement and the old behaviour are the same thing rather than
    // merely similar, which is what lets every case above this block go on
    // asserting the figures it always did.
    expect(placementOf(agreedExtra)).toBe("beforeGross");
    expect(placementOf(oneOffDeduction)).toBe("afterGross");
    expect(agreedExtra.placement).toBeUndefined();
    expect(oneOffDeduction.placement).toBeUndefined();
  });

  it("explains where the line sits, and says so differently for each", () => {
    const w = worker();
    const inside = calculateMonth(facts(w, [withheldBefore]), w).lines.find(
      (l) => l.key === "extra.breakage",
    );
    const outside = calculateMonth(facts(w, [oneOffDeduction]), w).closing.find(
      (r) => r.key === "extra.breakage",
    );
    expect(inside?.explanation.text).toContain(he.sheet.why.userLine.beforeGross);
    expect(outside?.explanation.text).toContain(he.sheet.why.userLine.afterGross);
    // Both are one-off lines, so both open with the same first half.
    expect(inside?.explanation.text).toContain(he.sheet.why.userLine.oneOff);
    expect(outside?.explanation.text).toContain(he.sheet.why.userLine.oneOff);
  });
});
