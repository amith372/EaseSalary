import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth } from "@/lib/engine/month";
import { snapshotTerms} from "@/lib/engine/types";
import type { ClosedMonthFacts, ClosedSpan, WorkerTerms } from "@/lib/engine/types";
import { InvalidMonthError, validateMonth } from "@/lib/engine/validate";

/**
 * The deliberately invalid case (specs.md Part 4), and the two refusals it says
 * are the same refusal: a tenth paid holiday within a year, and a count of
 * worked rest days higher than the number of rest days in the month.
 *
 * `src/lib/spans.ts` already stops the first at the calendar and is tested
 * there. What is tested here is the engine refusing the facts if such a pair
 * reaches it anyway — the calendar is one caller and Stage 3's repository is
 * another.
 */

const terms: WorkerTerms = {
  employedSince: "2024-04-01",
  gender: "female",
  baseMonthlySalaryAgorot: 624765,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  incomeTax: DEFAULT_INCOME_TAX,
  standingLines: [],
  country: "PH",
  openingPosition: { vacationDays: 0, sickDays: 0, advances: [] },
};

function facts(
  spans: ClosedSpan[],
  extras: Partial<Pick<ClosedMonthFacts, "advances">> = {},
): ClosedMonthFacts {
  return {
    terms: snapshotTerms(terms),
    month: { year: 2025, month: 8 },
    confirmedWage: {
      baseAgorot: 624765,
      minimumAgorot: 624765,
      effectiveFrom: "2025-04-01",
    },
    spans,
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
    ...extras,
  };
}

const holiday = (date: string, worked = true): ClosedSpan => ({
  id: `hol-${date}`,
  kind: "holiday",
  from: date,
  to: date,
  worked,
});

describe("a paid holiday on a free rest day (specs.md Part 4)", () => {
  // The 16th of August 2025 is a Saturday, recorded as one the worker had off,
  // and then claimed as a paid holiday.
  const clashing = facts([
    { id: "free-16", kind: "freeRestDay", from: "2025-08-16", to: "2025-08-16" },
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
    const justTheFreeRestDay = facts([
      { id: "free-16", kind: "freeRestDay", from: "2025-08-16", to: "2025-08-16" },
    ]);
    expect(validateMonth(justTheFreeRestDay, terms)).toEqual([]);
    expect(calculateMonth(justTheFreeRestDay, terms).gross).toBe(674765 + 170540);
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
    const halfDay: ClosedSpan = { ...holiday("2025-08-13"), fraction: 0.5 };
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

describe("the rest-day counts cannot exceed the month (specs.md Part 4)", () => {
  it("refuses a free rest day recorded on a day that is not one", () => {
    // This is how the rest-day counts actually go wrong in stored data. The
    // 18th of August 2025 is a Monday, and this worker rests on Saturday.
    //
    // The refusal reads her own rest day off the month, so the case that tells
    // one worker from another — a Friday-resting worker's genuine free Friday,
    // refused for Hanna and recorded for her — lives in `rest-day.test.ts`.
    // This one holds for all three workers, because a Monday is nobody's rest
    // day.
    const [refusal] = validateMonth(
      facts([
        { id: "free-18", kind: "freeRestDay", from: "2025-08-18", to: "2025-08-18" },
      ]),
      terms,
    );
    expect(refusal.code).toBe("freeRestDayNotRestDay");
    expect(refusal.dates).toEqual(["2025-08-18"]);
  });

  it("never reports more rest days worked than the month holds", () => {
    // The count is derived from the calendar rather than typed, which is the
    // guarantee Part 4 is asking for: a month cannot claim a sixth rest day
    // because there is no sixth rest day to derive. Asserted across a month
    // with a free rest day and one without.
    for (const spans of [[], [{ id: "f", kind: "freeRestDay" as const, from: "2025-08-16", to: "2025-08-16" }]]) {
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
  const cases: { spans: ClosedSpan[]; code: string; link: string }[] = [
    {
      spans: [
        { id: "free-16", kind: "freeRestDay", from: "2025-08-16", to: "2025-08-16" },
        holiday("2025-08-16"),
      ],
      code: "restDayHoliday",
      link: "holidayWork",
    },
    {
      spans: [
        { id: "free-18", kind: "freeRestDay", from: "2025-08-18", to: "2025-08-18" },
      ],
      code: "freeRestDayNotRestDay",
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
        { id: "free-16", kind: "freeRestDay", from: "2025-08-16", to: "2025-08-16" },
        holiday("2025-08-16"),
        { id: "sick", kind: "sick", from: "2025-08-04", to: "2025-08-05" },
      ]),
      terms,
    );
    expect(refusals.length).toBeGreaterThan(1);
    for (const refusal of refusals) expect(refusal.link).toBeTruthy();
  });
});

describe("a date carrying more than one entry (specs.md Part 4)", () => {
  /**
   * A sick balance to draw on, so these months are refused for the overlap and
   * not for an exhausted balance (item 8): what is under test here is the
   * contradiction, not the balance.
   */
  const stocked: WorkerTerms = {
    ...terms,
    openingPosition: { vacationDays: 20, sickDays: 43.5, advances: [] },
  };

  /** Part 4's rest-day rate, ₪426.35 — what each of these mistakes was worth. */
  const REST_DAY_RATE = 42635;

  it("refuses a day recorded as both sick and worked as a holiday", () => {
    // The 16th of August 2025 is a Saturday inside a spell running 14-17, and
    // is also marked as a holiday she worked. She cannot have been absent ill
    // and at work on the same day, and the engine has no way to know which
    // happened.
    const spans: ClosedSpan[] = [
      { id: "sick", kind: "sick", from: "2025-08-14", to: "2025-08-17" },
      holiday("2025-08-16"),
    ];
    const refusal = validateMonth(facts(spans), stocked).find(
      (r) => r.code === "dayRecordedTwice",
    );
    expect(refusal).toBeDefined();
    expect(refusal?.dates).toEqual(["2025-08-16"]);
    expect(refusal?.link).toBe("holidayWork");
  });

  it("refuses at the engine and not only at the calendar", () => {
    // `calculateMonth` throws rather than returning the refusals, so a caller
    // that ignores them cannot receive a number instead. The calendar is one
    // caller; the repository and the export are others.
    const spans: ClosedSpan[] = [
      { id: "sick", kind: "sick", from: "2025-08-14", to: "2025-08-17" },
      holiday("2025-08-16"),
    ];
    expect(() => calculateMonth(facts(spans), stocked)).toThrow(InvalidMonthError);
  });

  it("refuses one date entered twice, rather than paying it twice", () => {
    // Two holiday spans over the 13th of August would be paid 2 × ₪426.35 for
    // one calendar day, and would draw two days off the nine of item 10.
    const spans: ClosedSpan[] = [
      { id: "a", kind: "holiday", from: "2025-08-13", to: "2025-08-13", worked: true },
      { id: "b", kind: "holiday", from: "2025-08-13", to: "2025-08-13", worked: true },
    ];
    const refusal = validateMonth(facts(spans), stocked).find(
      (r) => r.code === "dayRecordedTwice",
    );
    expect(refusal).toBeDefined();
    expect(refusal?.dates).toEqual(["2025-08-13"]);
    // What the refusal is worth: 2 × ₪426.35 = ₪852.70 for a single day.
    expect(2 * REST_DAY_RATE).toBe(85270);
  });

  it("leaves touching spans alone — they are one spell, not an overlap", () => {
    // A spell ends on the first day no sickness was reported, so 14-17 and
    // 18-20 are the one illness they are, however many ranges they were entered
    // as (item 8). Touching is not overlapping, and refusing it here would
    // break the rule sick.ts exists to keep.
    const spans: ClosedSpan[] = [
      { id: "a", kind: "sick", from: "2025-08-14", to: "2025-08-17" },
      { id: "b", kind: "sick", from: "2025-08-18", to: "2025-08-20" },
    ];
    expect(
      validateMonth(facts(spans), stocked).some(
        (r) => r.code === "dayRecordedTwice",
      ),
    ).toBe(false);
  });

  it("gives the holiday-on-a-free-rest-day pair its own reason, not two", () => {
    // Part 4 names that case, and a specific reason is worth more to the user
    // than a general one — so the date is left to `restDayHoliday` and is not
    // reported a second time as an overlap.
    const codes = validateMonth(
      facts([
        { id: "free-16", kind: "freeRestDay", from: "2025-08-16", to: "2025-08-16" },
        holiday("2025-08-16"),
      ]),
      stocked,
    ).map((r) => r.code);
    expect(codes).toContain("restDayHoliday");
    expect(codes).not.toContain("dayRecordedTwice");
  });
});

/**
 * Two movements of one kind on one advance in a single month (specs.md item
 * 20). The engine sees it because it is a fact about one month; what it does
 * *not* see is what is still owed, which needs the whole employment and is
 * refused where the figure is entered instead.
 */
describe("two movements of one kind on one advance", () => {
  it("is refused, and a grant beside a repayment is not", () => {
    const twice = validateMonth(
      facts([], {
        advances: [
          { number: 1, kind: "repaid", agorot: 100000 },
          { number: 1, kind: "repaid", agorot: 50000 },
        ],
      }),
      terms,
    );
    expect(twice.map((refusal) => refusal.code)).toEqual([
      "advanceRecordedTwice",
    ]);
    // A refusal about a row on the payslip points at what the payslip must
    // carry (specs.md items 2, 25): every payment as its type, its units and
    // its amount, which two rows sharing one key cannot do.
    expect(twice[0].link).toBe("wageProtection");

    expect(
      validateMonth(
        facts([], {
          advances: [
            { number: 1, kind: "granted", agorot: 300000 },
            { number: 1, kind: "repaid", agorot: 100000 },
          ],
        }),
        terms,
      ),
    ).toEqual([]);
  });

  it("stops the month rather than paying it twice", () => {
    expect(() =>
      calculateMonth(
        facts([], {
          advances: [
            { number: 2, kind: "granted", agorot: 100000 },
            { number: 2, kind: "granted", agorot: 100000 },
          ],
        }),
        terms,
      ),
    ).toThrow(InvalidMonthError);
  });
});
