import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth } from "@/lib/engine/month";
import type { ClosedMonthFacts, ClosedSpan, WorkerTerms } from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import { formatAgorot, formatDays } from "@/lib/money";
import type { MonthResult } from "@/lib/types";

/**
 * The known case (specs.md Part 4). Every expected figure below is quoted from
 * Part 4 and none is read back from the engine:
 *
 *   base ₪6,247.65 + rest-eve supplement ₪500      = ₪6,747.65   column E
 *   two holidays and four rest days at ₪426.35     = ₪2,558.10   column F
 *   the month's total                              = ₪9,305.75   E + F + G
 *   after the ₪2,000 instalment                    = ₪7,305.75   net
 *
 * The rest-eve supplement is ₪100 per rest-eve. That is not a constant taken
 * from anywhere: Part 4 gives ₪500 across five Fridays worked and item 14 calls
 * the supplement weekly, so the per-rest-eve figure is those two statements
 * divided, shown here in the open.
 *
 * Hanna rests on Saturday, which is the default, so her rest-eve is Friday and
 * every weekday named below is hers rather than the rule. That is exactly why
 * this case cannot check the rest day's generalisation and why `build_plan.md`
 * `rest-day.test.ts` exists, with figures derived on paper.
 */

const AUGUST_2025_SALARY = 624765;
const REST_EVE_SUPPLEMENT = 10000;
const INSTALMENT = 200000;

const spans: ClosedSpan[] = [
  // Part 4: "one free Saturday on the 16th".
  { id: "free-16", kind: "freeRestDay", from: "2025-08-16", to: "2025-08-16" },
  // Part 4: "two paid holidays on the 19th and the 21st", both worked.
  { id: "hol-19", kind: "holiday", from: "2025-08-19", to: "2025-08-19", worked: true },
  { id: "hol-21", kind: "holiday", from: "2025-08-21", to: "2025-08-21", worked: true },
];

const facts: ClosedMonthFacts = {
  month: { year: 2025, month: 8 },
  // The terms the month was confirmed with (specs.md Part 3), which for August
  // 2025 are the profile's own: ₪100 a rest-eve, not pocket money, recuperation
  // in July. Written out rather than snapshotted off `terms` below, because
  // that const is declared after this one.
  terms: {
    restDay: SATURDAY,
    restEveSupplementAgorot: REST_EVE_SUPPLEMENT,
    recuperationMonth: 7,
    incomeTax: DEFAULT_INCOME_TAX,
    standingLines: [],
  },
  confirmedWage: {
    baseAgorot: AUGUST_2025_SALARY,
    minimumAgorot: AUGUST_2025_SALARY,
    effectiveFrom: "2025-04-01",
  },
  spans,
  // Part 4: "a ₪10,000 advance from an earlier month is repaid at ₪2,000 a
  // month". The advance itself is in the opening position, since it did not
  // originate inside the application (item 6).
  advances: [{ number: 1, kind: "repaid", agorot: INSTALMENT }],
  thirdPartyPayments: [],
  userLines: [],
  incomeTaxAgorot: 0,
  overrides: {},
};

const terms: WorkerTerms = {
  // Part 4: "employed since 1.4.2024".
  employedSince: "2024-04-01",
  gender: "female",
  baseMonthlySalaryAgorot: AUGUST_2025_SALARY,
  restDay: SATURDAY,
  restEveSupplementAgorot: REST_EVE_SUPPLEMENT,
  recuperationMonth: 7,
  incomeTax: DEFAULT_INCOME_TAX,
  standingLines: [],
  country: "PH",
  openingPosition: {
    // Zero on purpose, and confirmed as such. Part 4 gives no opening balance
    // for August 2025, so inventing one would put a figure with no source into
    // the case the whole engine is checked against. The balances below are
    // therefore the month's own accrual, which is the part that *is* sourced —
    // items 7 and 8. A real opening position is a fact the worker's profile
    // supplies, and it changes these two figures without changing any other.
    vacationDays: 0,
    sickDays: 0,
    advances: [{ number: 1, principalAgorot: 1000000, repaidAgorot: 0 }],
  },
};

function columnTotal(result: MonthResult, column: string): number {
  return result.lines
    .filter((line) => line.column === column)
    .reduce((total, line) => total + (line.amount ?? 0), 0);
}

describe("August 2025, to the agora and with no tolerance (specs.md Part 4)", () => {
  const result = calculateMonth(facts, terms);

  it("pays ₪6,747.65 in column E — the base plus the rest-eve supplement", () => {
    expect(columnTotal(result, "E")).toBe(674765); // Part 4: ₪6,747.65
  });

  it("pays ₪2,558.10 in column F — four rest days and two holidays", () => {
    expect(columnTotal(result, "F")).toBe(255810); // Part 4: ₪2,558.10
  });

  it("gives a gross of ₪9,305.75", () => {
    expect(result.gross).toBe(930575); // Part 4: ₪9,305.75
  });

  it("gives ₪7,305.75 after the ₪2,000 instalment", () => {
    expect(result.net).toBe(730575); // Part 4: ₪7,305.75
  });

  it("prints all four of the sheet's total lines, not two", () => {
    // Criterion 1 checks four figures. Two are the column subtotals and two are
    // the month's own totals, and all four are Part 4's.
    const e = result.subtotals.find((s) => s.column === "E");
    const f = result.subtotals.find((s) => s.column === "F");
    expect(e?.amount).toBe(674765); // Part 4: ₪6,747.65
    expect(f?.amount).toBe(255810); // Part 4: ₪2,558.10
    expect(result.gross).toBe(930575); // Part 4: ₪9,305.75
    expect(result.net).toBe(730575); // Part 4: ₪7,305.75
  });

  it("prints no subtotal for a column the month has nothing in", () => {
    // G and H are empty in August 2025, so the sheet shows exactly the two
    // subtotals Part 4 names rather than two more reading zero.
    expect(result.subtotals.map((s) => s.column)).toEqual(["E", "F"]);
  });

  it("makes units × rate equal the amount on every line (units are honest)", () => {
    // The base is one month at the monthly rate, not 26 days at it: the day
    // counts are separate reporting figures and are never a line's units.
    for (const line of result.lines) {
      expect(line.units).not.toBeNull();
      expect(line.rate).not.toBeNull();
      expect(Math.round((line.units ?? 0) * (line.rate ?? 0))).toBe(line.amount);
    }
    const base = result.lines.find((line) => line.key === "base");
    expect(base?.units).toBe(1);
    expect(base?.rate).toBe(624765);
  });

  it("puts the base at ₪6,247.65 and the supplement at ₪500", () => {
    // The two halves of Part 4's own sentence, asserted separately so a failure
    // says which one moved.
    const base = result.lines.find((line) => line.key === "base");
    const supplement = result.lines.find((line) => line.key === "restEveSupplement");
    expect(base?.amount).toBe(624765);
    expect(supplement?.amount).toBe(50000);
    expect(supplement?.units).toBe(5); // Part 4: five Fridays worked
    expect(supplement?.rate).toBe(10000); // ₪500 over five Fridays (item 14)
  });

  it("reports 26 standard days and 26 actual days", () => {
    // Part 4: "a 31-day month with 26 working days". Nothing was taken, so the
    // two counts agree.
    expect(result.standardDays).toBe(26);
    expect(result.actualDays).toBe(26);
  });

  it("carries no vacation line at all (specs.md item 7)", () => {
    // The base is computed from the standard count and never shrinks, so a
    // vacation line beside it would pay the day a second time. A `vacationDays`
    // key appearing here is that double payment coming back.
    expect(result.lines.map((line) => line.key)).not.toContain("vacationDays");
    expect(result.lines.some((line) => line.key.includes("vacation"))).toBe(false);
  });

  it("shows every line as a type, a number of units and an amount (item 2)", () => {
    // The Wage Protection Act requirement, and the shape the export has to
    // carry in Stage 2.
    for (const line of result.lines) {
      expect(line.label.length).toBeGreaterThan(0);
      expect(line.amount).not.toBeNull();
      expect(line.explanation.text.length).toBeGreaterThan(0);
    }
  });
});

describe("what the payslip requires beyond the payments (specs.md item 2)", () => {
  const result = calculateMonth(facts, terms);

  it("reports the days used and the balances left", () => {
    // Nothing was taken in August 2025 — Part 4 records no vacation and no
    // sickness — so both are zero and the balances are the opening position
    // plus the month's own accrual.
    const vacation = result.balances.find((b) => b.kind === "vacation");
    const sick = result.balances.find((b) => b.kind === "sick");
    expect(vacation?.used).toBe(0);
    expect(sick?.used).toBe(0);
    expect(sick?.accrued).toBe(1.5); // item 8: 1.5 days a month
  });

  it("accrues vacation as fourteen twelfths, never as 1.17 (Part 5)", () => {
    // Employed since 1.4.2024, so August 2025 opens in her second year, and
    // years one to four accrue fourteen days a year (item 7). The workbook
    // writes 1.17 in some months and the fraction in others; using the decimal
    // drifts a hundredth of a day a year.
    const vacation = result.balances.find((b) => b.kind === "vacation");
    expect(vacation?.accrued).toBe(14 / 12);
    expect(vacation?.accrued).not.toBe(1.17);
  });

  it("estimates the national insurance on the gross, not the net (item 19)", () => {
    // 3.6% of the month's full cost, taken before anything to do with advances:
    // 3.6% of Part 4's ₪9,305.75, and not of the ₪7,305.75 that follows the
    // instalment.
    expect(result.nationalInsuranceEstimate).toBe(Math.round(930575 * 0.036));
    expect(result.nationalInsuranceEstimate).not.toBe(Math.round(730575 * 0.036));
  });

  it("keeps the estimate out of the money paid to the worker", () => {
    // An estimate is not a payment: it must move neither total.
    expect(result.gross).toBe(930575);
    expect(result.net).toBe(730575);
  });
});

describe("column H never reaches the worker (specs.md item 16, Part 5)", () => {
  it("leaves the gross and the net where they were", () => {
    // Reading H as salary would overpay her, so a ₪500 premium must move
    // neither figure.
    const withPremium = calculateMonth(
      {
        ...facts,
        thirdPartyPayments: [{ kind: "medicalInsurance", agorot: 50000 }],
      },
      terms,
    );
    expect(withPremium.gross).toBe(930575);
    expect(withPremium.net).toBe(730575);
    expect(columnTotal(withPremium, "H")).toBe(50000);
  });
});

describe("an override replaces the amount and keeps the key (specs.md item 17)", () => {
  it("marks the line manual without moving it to another key", () => {
    const overridden = calculateMonth(
      { ...facts, overrides: { base: { agorot: 700000 } } },
      terms,
    );
    const base = overridden.lines.find((line) => line.key === "base");
    expect(base?.amount).toBe(700000);
    expect(base?.manual).toBe(true);
    // Still addressable, and the rest of the sheet followed it.
    expect(overridden.gross).toBe(700000 + 50000 + 255810);
  });
});

/**
 * The readable snapshot. It is committed and it is for **reading** against the
 * family's own sheet — never an assertion: the four totals are asserted above
 * by explicit `expect`, so `vitest -u` can regenerate this file without any
 * assertion moving with it.
 */
function render(result: MonthResult): string {
  const out: string[] = [];
  out.push("# דף החודש — אוגוסט 2025");
  out.push("");
  out.push(
    "נוצר מהמנוע, לקריאה מול הדף של המשפחה. הסכומים כאן אינם קובעים דבר — " +
      "ארבעת הסיכומים נבדקים בנפרד מול חלק 4 של specs.md.",
  );
  out.push("");
  out.push(`- ימי תקן: ${result.standardDays}`);
  out.push(`- ימים בפועל: ${result.actualDays}`);
  out.push("");
  out.push("## שורות הדף");

  for (const line of result.lines) {
    out.push("");
    out.push(`### ${line.label}`);
    out.push(`- עמודה: ${line.column}`);
    out.push(`- יחידות: ${line.units ?? "—"}`);
    out.push(`- סכום: ${formatAgorot(line.amount ?? 0)}`);
    if (line.manual) out.push("- הוזן ידנית");
    out.push(`- למה: ${line.explanation.text}`);
  }

  out.push("");
  out.push("## תחתית הדף");
  for (const row of result.closing) {
    out.push("");
    out.push(`### ${row.label}`);
    out.push(`- סכום: ${formatAgorot(row.amount ?? 0)}`);
    if (row.manual) out.push("- הוזן ידנית");
    out.push(`- למה: ${row.explanation.text}`);
  }

  out.push("");
  out.push("## סיכומים");
  out.push("");
  for (const subtotal of result.subtotals) {
    out.push(`- ${subtotal.label}: ${formatAgorot(subtotal.amount ?? 0)}`);
  }
  out.push(`- סכום החודש (עמודות E, F, G): ${formatAgorot(result.gross ?? 0)}`);
  out.push(`- לתשלום בפועל: ${formatAgorot(result.net ?? 0)}`);

  out.push("");
  out.push("## יתרות");
  for (const balance of result.balances) {
    out.push("");
    out.push(`### ${he.home.balances[balance.kind]}`);
    out.push(`- יתרת פתיחה: ${formatDays(balance.opening ?? 0)}`);
    out.push(`- נצבר החודש: ${formatDays(balance.accrued ?? 0)}`);
    out.push(`- ${he.sheet.reporting.daysUsed}: ${formatDays(balance.used ?? 0)}`);
    out.push(
      `- ${he.sheet.reporting.balanceLeft}: ${formatDays(balance.closing ?? 0)}`,
    );
    out.push(`- למה: ${balance.explanation.text}`);
  }

  out.push("");
  out.push("## דיווח נוסף");
  out.push("");
  out.push(`- ${he.sheet.reporting.standardDays}: ${result.standardDays}`);
  out.push(`- ${he.sheet.reporting.actualDays}: ${result.actualDays}`);
  out.push(
    `- ${he.sheet.reporting.nationalInsuranceEstimate}: ${formatAgorot(
      result.nationalInsuranceEstimate ?? 0,
    )}`,
  );
  out.push(`- למה: ${he.sheet.why.nationalInsuranceEstimate}`);
  out.push("");
  return out.join("\n");
}

describe("the month, rendered for reading", () => {
  it("matches the committed snapshot", async () => {
    await expect(render(calculateMonth(facts, terms))).toMatchFileSnapshot(
      "./august-2025.snap.md",
    );
  });
});
