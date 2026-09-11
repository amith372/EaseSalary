import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import { describe, expect, it } from "vitest";
import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth } from "@/lib/engine/month";
import {
  nationalInsuranceEstimateOf,
  thirdPartyLineKey,
} from "@/lib/engine/thirdParty";
import { snapshotTerms, thirdPartyKinds} from "@/lib/engine/types";
import type {
  ClosedMonthFacts,
  ClosedSpan,
  ThirdPartyKind,
  ThirdPartyPayment,
  WorkerTerms,
} from "@/lib/engine/types";
import { InvalidMonthError, validateMonth } from "@/lib/engine/validate";
import { he } from "@/lib/i18n/he";
import type { MonthResult, YearMonth } from "@/lib/types";

/**
 * Column H, and the national-insurance estimate that sits beside it without
 * being it.
 *
 * **Where each expected figure comes from.** Not one is read back from what the
 * engine returned.
 *
 *   the gross of August 2025      ₪9,305.75   specs.md Part 4
 *   after the ₪2,000 instalment   ₪7,305.75   specs.md Part 4
 *   the national-insurance rate   3.6%        specs.md item 19
 *   this month's estimate         ₪335.01     those two multiplied, in the
 *                                             open: 930,575 × 0.036 =
 *                                             33,500.7 agorot, rounded once
 *   the workbook's own line       ₪117.60     שכר_חודשי_להאנה2025.xlsx ->
 *                                             חודש  8.25 -> D21. Stale, and
 *                                             therefore the figure the engine
 *                                             must **not** produce
 *   why it is stale               ₪5,880.02   שכר_חודשי_להאנה2024.xlsx ->
 *                                             חודש  12.24 -> D7, the 2024
 *                                             monthly minimum wage. 2% of it
 *                                             is 117.60, which is what the
 *                                             cell still holds after the rate
 *                                             rose to 3.6% (Part 5)
 *   a quarter actually paid       ₪936        שכר_חודשי_להאנה2025.xlsx ->
 *                                             חודש  7.25 -> H21, for 4-6/25,
 *                                             named in B21 and I21
 *   a month that settled none     D21 present and H21 empty, H25 = 0:
 *                                 שכר_חודשי_להאנה2026.xlsx -> חודש  2.26
 *
 * The facts below are August 2025's, because August is the month whose gross
 * Part 4 fixes — so the estimate standing beside a payment is sourced too. The
 * quarter it settles is the one the workbook records in 7.25; which month a
 * quarter is settled in is a fact about the family's calendar and not a
 * property this file is testing.
 */

const SALARY = 624765; // Part 4: ₪6,247.65
const REST_EVE_SUPPLEMENT = 10000; // Part 4: ₪500 across five Fridays (item 14)
const INSTALMENT = 200000; // Part 4: ₪2,000 a month

const GROSS = 930575; // Part 4: ₪9,305.75
const NET = 730575; // Part 4: ₪7,305.75

/** 930,575 × 0.036 = 33,500.7, rounded once (item 3). */
const ESTIMATE = 33501;

/** ₪117.60 — D21, and 2% of the ₪5,880.02 of 2024. Never a figure to produce. */
const STALE_WORKBOOK_LINE = 11760;

/** ₪936 — H21 of חודש  7.25, the quarter 4-6/25. */
const QUARTER_PAID = 93600;

const QUARTER_COVERED: YearMonth[] = [
  { year: 2025, month: 4 },
  { year: 2025, month: 5 },
  { year: 2025, month: 6 },
];

const spans: ClosedSpan[] = [
  { id: "free-16", kind: "freeRestDay", from: "2025-08-16", to: "2025-08-16" },
  { id: "hol-19", kind: "holiday", from: "2025-08-19", to: "2025-08-19", worked: true },
  { id: "hol-21", kind: "holiday", from: "2025-08-21", to: "2025-08-21", worked: true },
];

const terms: WorkerTerms = {
  employedSince: "2024-04-01",
  gender: "female",
  baseMonthlySalaryAgorot: SALARY,
  restDay: SATURDAY,
  restEveSupplementAgorot: REST_EVE_SUPPLEMENT,
  recuperationMonth: 7,
  incomeTax: DEFAULT_INCOME_TAX,
  standingLines: [],
  country: "PH",
  openingPosition: {
    vacationDays: 0,
    sickDays: 0,
    advances: [{ number: 1, principalAgorot: 1000000, repaidAgorot: 0 }],
  },
};

/** The month every case below is set in, named once so the rate looked up by
 * date and the month calculated cannot drift apart. */
const AUGUST_2025: YearMonth = { year: 2025, month: 8 };

function facts(payments: ThirdPartyPayment[] = []): ClosedMonthFacts {
  return {
    terms: snapshotTerms(terms),
    month: AUGUST_2025,
    confirmedWage: {
      baseAgorot: SALARY,
      minimumAgorot: SALARY,
      effectiveFrom: "2025-04-01",
    },
    spans,
    advances: [{ number: 1, kind: "repaid", agorot: INSTALMENT }],
    thirdPartyPayments: payments,
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

function columnTotal(result: MonthResult, column: string): number {
  return result.lines
    .filter((line) => line.column === column)
    .reduce((total, line) => total + (line.amount ?? 0), 0);
}

// Read from the engine's own list rather than kept by hand here. A second copy
// would compile clean the day a seventh kind was added and would quietly stop
// covering it, which is the drift `thirdPartyKinds` exists to end — and it is
// exactly what happened to `visaFee` before B15 was given a member of its own.
const ALL_KINDS: readonly ThirdPartyKind[] = thirdPartyKinds;

describe("column H never reaches the worker (specs.md item 16, Part 5)", () => {
  const bare = calculateMonth(facts(), terms);

  it("leaves the gross and the net exactly where they were", () => {
    // Reading H as salary would overpay her. ₪500 of medical insurance must
    // move neither of Part 4's two totals.
    const withPremium = calculateMonth(
      facts([{ kind: "medicalInsurance", agorot: 50000 }]),
      terms,
    );
    expect(withPremium.gross).toBe(GROSS); // Part 4: ₪9,305.75
    expect(withPremium.net).toBe(NET); // Part 4: ₪7,305.75
    expect(columnTotal(withPremium, "H")).toBe(50000);
  });

  it("does that for every kind of third-party payment there is", () => {
    // The workbook totals the month as E23+F24+G25 and leaves H25 standing
    // apart (שכר_חודשי_להאנה2025.xlsx -> חודש  7.25 -> E26, H25), so no kind
    // is an exception.
    for (const kind of ALL_KINDS) {
      const result = calculateMonth(facts([{ kind, agorot: 100000 }]), terms);
      expect(result.gross).toBe(GROSS);
      expect(result.net).toBe(NET);
      expect(columnTotal(result, "H")).toBe(100000);
      const line = result.lines.find((l) => l.key === thirdPartyLineKey(kind));
      expect(line?.column).toBe("H");
    }
  });

  it("prints an H subtotal that no other total contains", () => {
    const result = calculateMonth(
      facts([{ kind: "nationalInsurance", agorot: QUARTER_PAID }]),
      terms,
    );
    const h = result.subtotals.find((s) => s.column === "H");
    expect(h?.amount).toBe(QUARTER_PAID); // H25 = 936 in חודש  7.25
    const reachesWorker = result.subtotals
      .filter((s) => s.column !== "H")
      .reduce((total, s) => total + (s.amount ?? 0), 0);
    expect(reachesWorker).toBe(GROSS); // E26 = E23+F24+G25, H excluded
  });

  it("keeps units × rate equal to the amount on an H line too", () => {
    // Every payment is shown as its type, its units and its amount (item 2).
    // A fee has no meaningful unit price: the ₪936 quarter is one payment, not
    // three months at ₪312, and inventing a per-month price would put a charge
    // in column D that Part 5 warns is read as a payment.
    const result = calculateMonth(
      facts([{ kind: "nationalInsurance", agorot: QUARTER_PAID }]),
      terms,
    );
    const line = result.lines.find(
      (l) => l.key === thirdPartyLineKey("nationalInsurance"),
    );
    expect(line?.units).toBe(1);
    expect(line?.rate).toBe(QUARTER_PAID);
    expect(line?.amount).toBe(QUARTER_PAID);
  });

  it("emits no H line at all in a month that paid nobody", () => {
    // A month with nothing paid prints nothing rather than a zero, exactly as
    // an empty column G does (criterion 1).
    expect(bare.lines.some((line) => line.column === "H")).toBe(false);
    expect(bare.subtotals.some((s) => s.column === "H")).toBe(false);
  });
});

describe("the national-insurance estimate (specs.md item 19)", () => {
  it("is 3.6% of the month's full cost, taken before the advances", () => {
    // 3.6% of Part 4's ₪9,305.75 — the salary, the rest-eve supplement and the
    // Saturday and holiday pay — and not of the ₪7,305.75 that follows the
    // instalment: the contribution cannot depend on whether the family happened
    // to lend her money.
    const result = calculateMonth(facts(), terms);
    // The percentage is looked up by date rather than read off a constant
    // (specs.md item 4): August 2025 falls after the 1.1.2025 row, so it is
    // valued at 3.6%.
    expect(rateInForce(SEEDED_RATES, "nationalInsurance", AUGUST_2025)?.value).toBe(
      0.036,
    );
    expect(result.nationalInsuranceEstimate).toBe(ESTIMATE); // ₪335.01
    expect(nationalInsuranceEstimateOf(GROSS, SEEDED_RATES, AUGUST_2025)).toBe(
      ESTIMATE,
    );
    expect(result.nationalInsuranceEstimate).not.toBe(
      nationalInsuranceEstimateOf(NET, SEEDED_RATES, AUGUST_2025),
    );
  });

  it("is derived and is never the workbook's stale line", () => {
    // D21 of every 2025 and 2026 month tab still reads ₪117.60, which is 2% of
    // the ₪5,880.02 that שכר_חודשי_להאנה2024.xlsx -> חודש  12.24 -> D7 pays
    // the 2024 salary at. The rate rose to 3.6% in January 2025 and the cell
    // never followed. Derive, never copy (Part 5).
    const result = calculateMonth(facts(), terms);
    expect(Math.round(588002 * 0.02)).toBe(STALE_WORKBOOK_LINE);
    expect(result.nationalInsuranceEstimate).not.toBe(STALE_WORKBOOK_LINE);
  });

  it("is empty in a month earlier than any percentage the table holds", () => {
    // The rate rose to 3.6% in January 2025 and the application holds no dated
    // figure before that. A month of 2024 therefore gets no estimate rather
    // than today's percentage applied to a month it was not in force during
    // (specs.md item 4) — which is the stale-line mistake of Part 5 with the
    // sign reversed.
    expect(
      nationalInsuranceEstimateOf(GROSS, SEEDED_RATES, { year: 2024, month: 12 }),
    ).toBe(null);
  });

  it("follows the table it is handed rather than a constant", () => {
    // 2% is what the workbook's own line was left at (Part 5). Handed a table
    // that says so, the engine must produce 2% of Part 4's ₪9,305.75 —
    // 930,575 × 0.02 = 18,611.5 agorot, rounded once to 18,612 — which proves
    // the percentage travels from the table and is not baked into the engine.
    const result = calculateMonth(facts(), terms, {
      rates: [
        {
          key: "nationalInsurance",
          value: 0.02,
          effectiveFrom: "2024-01-01",
          source: "שכר_חודשי_להאנה2024.xlsx → חודש  12.24 → D21",
        },
      ],
    });
    expect(result.nationalInsuranceEstimate).toBe(18612);
    expect(result.nationalInsuranceEstimate).not.toBe(ESTIMATE);
  });

  it("moves neither of the totals paid to the worker", () => {
    // An estimate is not a payment: it is a figure to confirm, and it enters no
    // subtotal — nothing in the sheet sums column D.
    const result = calculateMonth(facts(), terms);
    expect(result.gross).toBe(GROSS);
    expect(result.net).toBe(NET);
    expect(result.subtotals.some((s) => s.amount === ESTIMATE)).toBe(false);
  });

  it("takes no notice of what column H paid", () => {
    // The base is E + F + G. A ₪936 quarter leaving the account this month is
    // not part of the cost this month accrued.
    const result = calculateMonth(
      facts([{ kind: "nationalInsurance", agorot: QUARTER_PAID }]),
      terms,
    );
    expect(result.nationalInsuranceEstimate).toBe(ESTIMATE);
  });
});

describe("the estimate and the payment are two figures, never one (item 19)", () => {
  it("shows the estimate and no payment in a month that settled no quarter", () => {
    // חודש  2.26: D21 holds the per-month figure, H21 is empty, H25 is 0.
    const result = calculateMonth(facts(), terms);
    expect(result.nationalInsuranceEstimate).toBe(ESTIMATE);
    expect(
      result.lines.find((l) => l.key === thirdPartyLineKey("nationalInsurance")),
    ).toBeUndefined();
  });

  it("shows both in the month the quarter is settled, and they differ", () => {
    // חודש  7.25: D21 carries the month's own figure and H21 the ₪936 that
    // left the account on 20.7.25. One line carrying both is the two numbers
    // collapsed back into one.
    const result = calculateMonth(
      facts([
        {
          kind: "nationalInsurance",
          agorot: QUARTER_PAID,
          coversMonths: QUARTER_COVERED,
        },
      ]),
      terms,
    );
    const paid = result.lines.find(
      (l) => l.key === thirdPartyLineKey("nationalInsurance"),
    );
    expect(paid?.amount).toBe(QUARTER_PAID); // ₪936
    expect(result.nationalInsuranceEstimate).toBe(ESTIMATE); // ₪335.01
    expect(paid?.amount).not.toBe(result.nationalInsuranceEstimate);
  });

  it("has the payment name the months it covers", () => {
    // B21 of חודש  7.25 writes "הפרשות בגין חודשים 4-6/25" into the row itself,
    // and the export carries the amount that was due together with the months
    // it covers. They travel beside the sentence, not inside it (Part 5).
    const result = calculateMonth(
      facts([
        {
          kind: "nationalInsurance",
          agorot: QUARTER_PAID,
          coversMonths: QUARTER_COVERED,
        },
      ]),
      terms,
    );
    const paid = result.lines.find(
      (l) => l.key === thirdPartyLineKey("nationalInsurance"),
    );
    expect(paid?.coversMonths).toEqual(QUARTER_COVERED);
  });

  it("leaves a payment that covers only its own month without the field", () => {
    // A premium paid for the month it appears in has nothing to say about other
    // months, so it carries no list rather than a list repeating itself.
    const result = calculateMonth(
      facts([{ kind: "medicalInsurance", agorot: 32559 }]),
      terms,
    );
    const paid = result.lines.find(
      (l) => l.key === thirdPartyLineKey("medicalInsurance"),
    );
    expect(paid?.coversMonths).toBeUndefined();
  });

  it("keeps the estimate when the payment is taken away", () => {
    // Which is what makes it derived: every month carries its own estimate,
    // whether or not a quarter was settled in it.
    const withPayment = calculateMonth(
      facts([{ kind: "nationalInsurance", agorot: QUARTER_PAID }]),
      terms,
    );
    const without = calculateMonth(facts(), terms);
    expect(withPayment.nationalInsuranceEstimate).toBe(
      without.nationalInsuranceEstimate,
    );
    expect(without.nationalInsuranceEstimate).toBe(ESTIMATE);
  });
});

describe("one row per kind, and a month with two is refused (item 16)", () => {
  it("refuses two payments of the same kind, naming the type", () => {
    // The sheet holds one row per kind — rows 10 and 12 to 16 and 21 of a month
    // tab — so two would share the explanation key `thirdParty.medicalInsurance`
    // and an override could not reach one without reaching the other.
    const refusals = validateMonth(
      facts([
        { kind: "medicalInsurance", agorot: 32559 },
        { kind: "medicalInsurance", agorot: 34816 },
      ]),
      terms,
    );
    const refusal = refusals.find((r) => r.code === "thirdPartyPaidTwice");
    expect(refusal).toBeDefined();
    expect(refusal?.message).toContain(he.sheet.thirdParty.medicalInsurance);
    // The rule the payment rests on, the same one its line carries (item 25).
    expect(refusal?.link).toBe("medicalInsurance");
    // A payment carries no date of its own: what it concerns is a kind.
    expect(refusal?.dates).toEqual([]);
  });

  it("refuses at the engine, so no caller can have a number instead", () => {
    expect(() =>
      calculateMonth(
        facts([
          { kind: "visaExtensionFee", agorot: 19500 },
          { kind: "visaExtensionFee", agorot: 21000 },
        ]),
        terms,
      ),
    ).toThrow(InvalidMonthError);
  });

  it("lets a month pay both of the sheet's two visa rows", () => {
    // The reason B15 has a member of its own (specs.md items 16, 28). While one
    // `visaFee` covered both rows, a month that paid the extension fee and the
    // visa itself was two payments of one kind — so it was refused outright,
    // and the family was told to sum two figures their own sheet keeps apart in
    // B14 and B15. The figures are two different fees and neither is derived:
    // what is asserted is that the month calculates at all and that both rows
    // reach column H.
    const result = calculateMonth(
      facts([
        { kind: "visaExtensionFee", agorot: 19500 },
        { kind: "workerVisa", agorot: 21000 },
      ]),
      terms,
    );
    // `calculateMonth` throws on a refusal, so reaching this line at all is the
    // assertion that the pair is no longer refused.
    expect(columnTotal(result, "H")).toBe(40500);
    // Two rows, addressable apart, which is what an override and an
    // explanation each need (items 17, 24).
    expect(
      result.lines.find((l) => l.key === thirdPartyLineKey("visaExtensionFee"))
        ?.amount,
    ).toBe(19500);
    expect(
      result.lines.find((l) => l.key === thirdPartyLineKey("workerVisa"))
        ?.amount,
    ).toBe(21000);
    // And still none of it reaches her.
    expect(result.gross).toBe(GROSS);
    expect(result.net).toBe(NET);
  });

  it("allows two payments of different kinds in one month", () => {
    // A month may settle a quarter and renew a policy at once — חודש  4.25 has
    // both — so this refusal must not stand in the way of an ordinary month.
    const result = calculateMonth(
      facts([
        { kind: "nationalInsurance", agorot: QUARTER_PAID },
        { kind: "medicalInsurance", agorot: 32559 },
      ]),
      terms,
    );
    expect(columnTotal(result, "H")).toBe(QUARTER_PAID + 32559);
    expect(result.gross).toBe(GROSS);
  });

  it("keeps every kind addressable under its own key", () => {
    // Which is the whole point of the refusal: one key, one line, one override.
    const result = calculateMonth(
      facts(ALL_KINDS.map((kind) => ({ kind, agorot: 10000 }))),
      terms,
    );
    const keys = result.lines
      .filter((line) => line.column === "H")
      .map((line) => line.key);
    expect(new Set(keys).size).toBe(ALL_KINDS.length);
  });
});

describe("an H line can be overridden like any other (specs.md item 17)", () => {
  it("replaces the amount, marks it manual, and still moves no total", () => {
    const result = calculateMonth(
      {
        ...facts([{ kind: "medicalInsurance", agorot: 50000 }]),
        overrides: { [thirdPartyLineKey("medicalInsurance")]: { agorot: 34816 } },
      },
      terms,
    );
    const line = result.lines.find(
      (l) => l.key === thirdPartyLineKey("medicalInsurance"),
    );
    expect(line?.amount).toBe(34816);
    expect(line?.manual).toBe(true);
    // Still addressable under the same key, and column H still reaches neither
    // total (item 16).
    expect(result.gross).toBe(GROSS);
    expect(result.net).toBe(NET);
  });
});
