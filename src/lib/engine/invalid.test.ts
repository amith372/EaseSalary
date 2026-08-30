import { describe, expect, it } from "vitest";
import { calculateMonth } from "@/lib/engine/month";
import type { MonthFacts, MonthSpan, WorkerTerms } from "@/lib/engine/types";
import { InvalidMonthError, validateMonth } from "@/lib/engine/validate";

/**
 * The deliberately invalid case (specs.md Part 4), and the two refusals it says
 * are the same refusal: a tenth paid holiday within a year, and a count of
 * worked Saturdays higher than the number of Saturdays in the month.
 *
 * `src/lib/spans.ts` already stops the first at the calendar and is tested
 * there. What is tested here is the engine refusing the facts if such a pair
 * reaches it anyway — the calendar is one caller and Stage 3's repository is
 * another.
 */

const terms: WorkerTerms = {
  employedSince: "2024-04-01",
  baseMonthlySalaryAgorot: 624765,
  fridaySupplementAgorot: 10000,
  fridayIsPocketMoney: false,
  recuperationMonth: 7,
  country: "PH",
  openingPosition: { vacationDays: 0, sickDays: 0, advances: [] },
};

function facts(spans: MonthSpan[]): MonthFacts {
  return {
    month: { year: 2025, month: 8 },
    confirmedWage: {
      baseAgorot: 624765,
      minimumAgorot: 624765,
      effectiveFrom: "2025-04-01",
    },
    spans,
    advances: [],
    thirdPartyPayments: [],
    extraPayments: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

const holiday = (date: string, worked = true): MonthSpan => ({
  id: `hol-${date}`,
  kind: "holiday",
  from: date,
  to: date,
  worked,
});

describe("a paid holiday on a free Saturday (specs.md Part 4)", () => {
  // The 16th of August 2025 is a Saturday, recorded as one the worker had off,
  // and then claimed as a paid holiday.
  const clashing = facts([
    { id: "free-16", kind: "freeSaturday", from: "2025-08-16", to: "2025-08-16" },
    holiday("2025-08-16"),
  ]);

  it("is refused rather than calculated", () => {
    expect(() => calculateMonth(clashing, terms)).toThrow(InvalidMonthError);
  });

  it("states a reason, and names the date it is about", () => {
    // Refused with a reason and not silently dropped: the sentence has to say
    // why the day cannot be both.
    const [refusal, ...rest] = validateMonth(clashing, terms);
    expect(rest).toHaveLength(0);
    expect(refusal.code).toBe("restDayHoliday");
    expect(refusal.message.length).toBeGreaterThan(0);
    expect(refusal.dates).toEqual(["2025-08-16"]);
  });

  it("never pays the day at both the rest-day rate and the holiday rate", () => {
    // The whole point of the refusal. Nothing comes back at all, so there is no
    // figure that could carry the double payment.
    let result: unknown = "the engine returned a month";
    try {
      result = calculateMonth(clashing, terms);
    } catch (error) {
      result = error;
    }
    expect(result).toBeInstanceOf(InvalidMonthError);
  });

  it("calculates the same month once the clash is removed", () => {
    // The refusal is about the pair, not about either mark on its own.
    const justTheFreeSaturday = facts([
      { id: "free-16", kind: "freeSaturday", from: "2025-08-16", to: "2025-08-16" },
    ]);
    expect(validateMonth(justTheFreeSaturday, terms)).toEqual([]);
    expect(calculateMonth(justTheFreeSaturday, terms).gross).toBe(674765 + 170540);
  });
});

describe("a tenth paid holiday within a year (specs.md item 10, Part 4)", () => {
  const nine = [3, 4, 5, 6, 7, 8, 10, 11, 12].map((d) =>
    holiday(`2025-08-${String(d).padStart(2, "0")}`),
  );

  it("accepts the ninth", () => {
    expect(validateMonth(facts(nine), terms)).toEqual([]);
  });

  it("refuses the tenth with a reason", () => {
    const ten = [...nine, holiday("2025-08-13")];
    const [refusal] = validateMonth(facts(ten), terms);
    expect(refusal.code).toBe("holidayLimit");
    expect(refusal.message.length).toBeGreaterThan(0);
    expect(() => calculateMonth(facts(ten), terms)).toThrow(InvalidMonthError);
  });

  it("counts the days already taken earlier in the year", () => {
    // One month cannot see the rest of its year, so the count is handed in.
    // Eight earlier plus two here is ten.
    const two = [holiday("2025-08-13"), holiday("2025-08-14")];
    expect(
      validateMonth(facts(two), terms, { holidayDaysEarlierInYear: 8 }),
    ).toHaveLength(1);
    expect(validateMonth(facts(two), terms, { holidayDaysEarlierInYear: 7 })).toEqual([]);
  });

  it("draws a part day from the entitlement in its own proportion", () => {
    // Item 10: a holiday taken as part of a day is drawn in the same
    // proportion, so half a day does not consume a whole one.
    const halfDay: MonthSpan = { ...holiday("2025-08-13"), fraction: 0.5 };
    expect(
      validateMonth(facts([halfDay]), terms, { holidayDaysEarlierInYear: 8.5 }),
    ).toEqual([]);
    expect(
      validateMonth(facts([halfDay]), terms, { holidayDaysEarlierInYear: 9 }),
    ).toHaveLength(1);
  });

  it("reduces the entitlement for a year only partly worked", () => {
    // Item 10: nine days for a full year, reduced in proportion otherwise.
    const five = nine.slice(0, 5);
    expect(validateMonth(facts(five), terms, { holidayAllowance: 4.5 })).toHaveLength(1);
    expect(validateMonth(facts(five), terms, { holidayAllowance: 5 })).toEqual([]);
  });
});

describe("the Saturday counts cannot exceed the month (specs.md Part 4)", () => {
  it("refuses a free Saturday recorded on a day that is not a Saturday", () => {
    // This is how the Saturday counts actually go wrong in stored data. The
    // 18th of August 2025 is a Monday, and the weekly rest day is Saturday for
    // every worker (item 5).
    const [refusal] = validateMonth(
      facts([
        { id: "free-18", kind: "freeSaturday", from: "2025-08-18", to: "2025-08-18" },
      ]),
      terms,
    );
    expect(refusal.code).toBe("freeSaturdayNotSaturday");
    expect(refusal.dates).toEqual(["2025-08-18"]);
  });

  it("never reports more Saturdays worked than the month holds", () => {
    // The count is derived from the calendar rather than typed, which is the
    // guarantee Part 4 is asking for: a month cannot claim a sixth Saturday
    // because there is no sixth Saturday to derive. Asserted across a month
    // with a free Saturday and one without.
    for (const spans of [[], [{ id: "f", kind: "freeSaturday" as const, from: "2025-08-16", to: "2025-08-16" }]]) {
      const result = calculateMonth(facts(spans), terms);
      const restDays = result.lines.find((line) => line.key === "restDays");
      expect(restDays?.units ?? 0).toBeLessThanOrEqual(5);
    }
  });
});

describe("every refusal carries the rule it rests on (specs.md item 25)", () => {
  /**
   * A refusal points at the link of the **action that was refused**, not of the
   * check that refused it: a tenth holiday points at the holiday rule, because
   * what the user was doing was marking a holiday. `Refusal.link` is required
   * rather than optional, which is what makes "every" testable at all — a
   * refusal with no rule behind it would be the application refusing on its own
   * authority.
   */
  const cases: { spans: MonthSpan[]; code: string; link: string }[] = [
    {
      spans: [
        { id: "free-16", kind: "freeSaturday", from: "2025-08-16", to: "2025-08-16" },
        holiday("2025-08-16"),
      ],
      code: "restDayHoliday",
      link: "holidayWork",
    },
    {
      spans: [
        { id: "free-18", kind: "freeSaturday", from: "2025-08-18", to: "2025-08-18" },
      ],
      code: "freeSaturdayNotSaturday",
      link: "restDayWork",
    },
    {
      // Ten holidays against an allowance of nine (item 10).
      spans: Array.from({ length: 10 }, (_, i) =>
        holiday(`2025-08-${String(i + 1).padStart(2, "0")}`, false),
      ),
      code: "holidayLimit",
      link: "holidayWork",
    },
    {
      // The opening position holds no sick days, so the balance is the month's
      // own accrual of 1.5 and two days are more than it can fund (item 8).
      spans: [{ id: "sick", kind: "sick", from: "2025-08-04", to: "2025-08-05" }],
      code: "sickBalanceExhausted",
      link: "sickPay",
    },
  ];

  for (const { spans, code, link } of cases) {
    it(`points ${code} at ${link}`, () => {
      const refusal = validateMonth(facts(spans), terms).find(
        (r) => r.code === code,
      );
      expect(refusal).toBeDefined();
      expect(refusal?.link).toBe(link);
    });
  }

  it("gives every refusal a link, whichever ones a month produces", () => {
    const refusals = validateMonth(
      facts([
        { id: "free-16", kind: "freeSaturday", from: "2025-08-16", to: "2025-08-16" },
        holiday("2025-08-16"),
        { id: "sick", kind: "sick", from: "2025-08-04", to: "2025-08-05" },
      ]),
      terms,
    );
    expect(refusals.length).toBeGreaterThan(1);
    for (const refusal of refusals) expect(refusal.link).toBeTruthy();
  });
});

