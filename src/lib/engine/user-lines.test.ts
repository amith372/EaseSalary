import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth } from "@/lib/engine/month";
import { snapshotTerms } from "@/lib/engine/types";
import type { MonthFacts, UserLine, WorkerTerms } from "@/lib/engine/types";

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

const pocketMoney: UserLine = {
  id: "pocket",
  label: "דמי כיס",
  direction: "addition",
  agorot: 50000,
  note: "סוכם עם המשפחה",
};

const standingDeduction: UserLine = {
  id: "phone",
  label: "השתתפות בטלפון",
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

describe("a standing addition — pocket money (specs.md items 14, 20)", () => {
  const w = worker([pocketMoney]);
  const result = calculateMonth(facts(w), w);

  it("sits in column E, because she earns it every month", () => {
    // 674,765 + 50,000. This is what a family uses instead of bending the
    // rest-eve supplement into a second agreement about a different day.
    expect(column(result, "E")).toBe(724765);
    expect(result.gross).toBe(937940);
    expect(result.net).toBe(937940);
  });

  it("keeps the user's own words as the label and its own key", () => {
    const line = result.lines.find((l) => l.key === "standing.pocket");
    expect(line?.label).toBe("דמי כיס");
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
    expect(row?.label).toBe("השתתפות בטלפון");
  });
});

describe("all four at once", () => {
  it("adds and withholds each exactly once", () => {
    // E 674,765 + 50,000 = 724,765; G 30,000; gross 967,940; then 20,000 and
    // 15,000 withheld, so 932,940 transferred.
    const w = worker([pocketMoney, standingDeduction]);
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
    // was confirmed with (Part 3), so the family stopping pocket money today
    // leaves August exactly where it was. The month is calculated against its
    // own snapshot and never against the profile.
    const before = worker([pocketMoney]);
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
    // adding pocket money today must not reach back into a month that never
    // had it.
    const w = worker([]);
    expect(calculateMonth(facts(w), worker([pocketMoney])).gross).toBe(887940);
  });
});

describe("an override reaches a user line by its own key (specs.md item 17)", () => {
  it("replaces the amount and marks it manual", () => {
    const w = worker([pocketMoney]);
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
