import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import { describe, expect, it } from "vitest";
import { FRIDAY, SATURDAY, SUNDAY, THURSDAY } from "@/lib/dates";
import {
  isAllowedRestDay,
  monthsFollowingProfile,
  parseDays,
  restDayChoices,
  reviewDate,
  reviewDocuments,
  reviewIncomeTax,
  reviewOpeningAdvance,
  reviewOpeningDays,
} from "@/lib/engine/profile";
import type { MonthFacts, WorkerTerms } from "@/lib/engine/types";

/**
 * The rules the worker's profile is changed by (`build_plan.md` stage 4, step
 * 9; specs.md items 5, 6, 20, 28).
 *
 * **Every expected value here comes from `specs.md` or from arithmetic worked
 * by hand, and none from what the code returned** (`CLAUDE.md`). The three rest
 * days are item 5's own list; ₪10,000 and its ₪2,000 instalment are Part 4's;
 * the eighteen-month passport threshold is item 28's and is deliberately *not*
 * asserted here, because nothing in this file computes it — the field holds an
 * expiry and the warning that reads it is item 27's.
 */

const TERMS: WorkerTerms = {
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

function facts(month: number, terms: WorkerTerms): MonthFacts {
  return {
    month: { year: 2026, month },
    confirmedWage: {
      baseAgorot: 624765,
      minimumAgorot: 624765,
      effectiveFrom: "2025-04-01",
    },
    terms: {
      restDay: terms.restDay,
      restEveSupplementAgorot: terms.restEveSupplementAgorot,
      recuperationMonth: terms.recuperationMonth,
      incomeTax: DEFAULT_INCOME_TAX,
      standingLines: terms.standingLines,
    },
    spans: [],
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

describe("the weekly rest day is one of three (specs.md item 5)", () => {
  it("offers exactly Friday, Saturday and Sunday", () => {
    // Item 5 names three and no more: "the law allows only Friday, Saturday or
    // Sunday". The list is what the chips are built from and what the server
    // checks against, so a fourth day added to it would be a day the profile
    // could store — which item 5 says it refuses.
    expect([...restDayChoices].sort()).toEqual([SUNDAY, FRIDAY, SATURDAY].sort());
    expect(restDayChoices).toHaveLength(3);
  });

  it("refuses a day outside the three, whatever the chip sent", () => {
    // Thursday is a real weekday and a real *rest-eve* — it is the rest-eve of
    // a Friday-resting worker (item 14) — which is exactly why it is the value
    // to test with: a check written as "is it a weekday" would accept it.
    expect(isAllowedRestDay(THURSDAY)).toBe(false);
    expect(isAllowedRestDay(SATURDAY)).toBe(true);
    expect(isAllowedRestDay("שבת")).toBe(false);
    expect(isAllowedRestDay(undefined)).toBe(false);
  });
});

describe("a document's expiry date (specs.md item 28)", () => {
  it("takes a real date and refuses one that only looks like a date", () => {
    // 2026 is not a leap year, so 29 February is not a day. A `Date` built from
    // it rolls forward to 1 March and a regular expression accepts it outright:
    // a permit that silently expires on the wrong day is the class of mistake
    // Part 5 is about, so the check is a round trip through the date itself.
    expect(reviewDate("2027-03-31")).toBe("2027-03-31");
    expect(reviewDate("2026-02-29")).toBe("invalid");
    expect(reviewDate("2028-02-29")).toBe("2028-02-29");
    expect(reviewDate("2026-13-01")).toBe("invalid");
    expect(reviewDate("31/03/2027")).toBe("invalid");
  });

  it("reads an empty field as a date not yet entered, and never as no expiry", () => {
    // Item 28: every one of the three documents has an expiry date. An empty
    // field says the family has not typed it in, so the warning that would have
    // fired has nothing to fire on — it does not say the document never lapses.
    expect(reviewDate("")).toBeNull();
    expect(reviewDate("   ")).toBeNull();
  });

  it("holds three dates and no number at all (items 22, 28)", () => {
    const reviewed = reviewDocuments({
      employmentPermitExpiry: "2026-11-30",
      workVisaExpiry: "",
      passportExpiry: "2029-06-30",
    });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;

    // The three dates are separate values and are not one date under three
    // names (item 28), and the *numbers* are absent by construction: the
    // returned object has three keys and every one of them is a date. A field
    // for a number here would be a plaintext identifier in an in-memory store,
    // which the non-negotiables forbid.
    expect(Object.keys(reviewed.documents).sort()).toEqual([
      "employmentPermitExpiry",
      "passportExpiry",
      "workVisaExpiry",
    ]);
    expect(reviewed.documents.employmentPermitExpiry).toBe("2026-11-30");
    expect(reviewed.documents.workVisaExpiry).toBeNull();
    expect(reviewed.documents.passportExpiry).toBe("2029-06-30");
  });

  it("refuses the whole panel when any one of the three is not a date", () => {
    expect(
      reviewDocuments({
        employmentPermitExpiry: "2026-11-30",
        workVisaExpiry: "2026-02-30",
        passportExpiry: "",
      }),
    ).toEqual({ ok: false, reason: "date" });
  });
});

describe("the opening position (specs.md item 6)", () => {
  it("takes the days already accrued, including none and a half", () => {
    // A part-day of vacation leaves the balance in that proportion (item 7), so
    // a half is a real opening figure; zero is Hanna's own opening position in
    // Part 4 and is an answer rather than an empty field.
    expect(parseDays("0")).toBe(0);
    expect(parseDays("9.5")).toBe(9.5);
    expect(parseDays("")).toBeNull();
    expect(parseDays("-1")).toBeNull();
    expect(parseDays("שלושה")).toBeNull();
  });

  it("carries the advances through when only the days change", () => {
    const advances = [
      { number: 1, principalAgorot: 1000000, repaidAgorot: 0 },
    ];
    const reviewed = reviewOpeningDays(
      { vacationDays: "9", sickDays: "24" },
      advances,
    );
    expect(reviewed).toEqual({
      ok: true,
      position: { vacationDays: 9, sickDays: 24, advances },
    });
  });

  it("takes Part 4's own advance: ₪10,000 given and nothing repaid", () => {
    // The figure is Part 4's, not the engine's: "a ₪10,000 advance from an
    // earlier month, repaid at ₪2,000 a month". ₪10,000 is 1,000,000 agorot.
    const reviewed = reviewOpeningAdvance(
      { principal: "10000", repaid: "", note: "" },
      1,
    );
    expect(reviewed).toEqual({
      ok: true,
      advance: { number: 1, principalAgorot: 1000000, repaidAgorot: 0 },
    });
  });

  it("takes an advance already part repaid, and keeps the reason", () => {
    // The demo household's own case: ₪2,000 given, ₪500 of it already repaid,
    // so ₪1,500 is still owed. The arithmetic is not asserted here — what is
    // owed is walked by `advanceLedger` and belongs to its own suite — but the
    // two figures it walks from are.
    const reviewed = reviewOpeningAdvance(
      { principal: "2,000", repaid: "500", note: "  מלפני שהתחלנו  " },
      3,
    );
    expect(reviewed).toEqual({
      ok: true,
      advance: {
        number: 3,
        principalAgorot: 200000,
        repaidAgorot: 50000,
        note: "מלפני שהתחלנו",
      },
    });
  });

  it("refuses more repaid than was ever given", () => {
    // The same refusal item 20 makes of a repayment entered in a month, made
    // where the figure first enters: a debt already overpaid before the
    // application saw it would open a negative standing, and every later month
    // would repay against it.
    expect(
      reviewOpeningAdvance({ principal: "2000", repaid: "2500", note: "" }, 1),
    ).toEqual({ ok: false, reason: "overRepaid" });
    // Repaid in full is not over-repaid, and is an ordinary thing to record.
    expect(
      reviewOpeningAdvance({ principal: "2000", repaid: "2000", note: "" }, 1)
        .ok,
    ).toBe(true);
  });

  it("refuses an advance of nothing and an advance of a minus", () => {
    // An advance of zero would stand on the payments screen for ever as a debt
    // that can never be repaid, because nothing is owed.
    expect(
      reviewOpeningAdvance({ principal: "0", repaid: "", note: "" }, 1),
    ).toEqual({ ok: false, reason: "principal" });
    expect(
      reviewOpeningAdvance({ principal: "-500", repaid: "", note: "" }, 1),
    ).toEqual({ ok: false, reason: "principal" });
    expect(
      reviewOpeningAdvance({ principal: "2000", repaid: "-1", note: "" }, 1),
    ).toEqual({ ok: false, reason: "repaid" });
  });
});

describe("a term changed on the profile reaches the months that follow it (Part 5)", () => {
  it("re-snapshots every month, because none of them can be confirmed yet", () => {
    // Part 5: confirming a month is "the moment its figures stop moving with
    // the profile". Nothing in the application can confirm one — the
    // confirmation is item 4's and arrives with the export — so every month a
    // worker has is a draft and follows her profile.
    const before = [facts(1, TERMS), facts(2, TERMS)];
    expect(before.every((month) => month.terms.restDay === SATURDAY)).toBe(true);

    const moved = { ...TERMS, restDay: FRIDAY } as const;
    const after = monthsFollowingProfile(before, moved);

    expect(after).toHaveLength(2);
    expect(after.every((record) => record.terms.restDay === FRIDAY)).toBe(true);
    // The months themselves are untouched — the function returns records and
    // writes nothing, which is what lets the rule be checked without a store.
    expect(before.every((month) => month.terms.restDay === SATURDAY)).toBe(true);
  });

  it("carries a standing line onto every month that follows the profile", () => {
    // Item 20: a standing line is "set once on the profile and appears in every
    // month afterwards, at the same amount". It is a term, so it travels with
    // the rest of them rather than through a mechanism of its own.
    const line = {
      id: "pocket",
      label: "דמי כיס",
      direction: "addition" as const,
      placement: "beforeGross" as const,
      agorot: 20000,
    };
    const after = monthsFollowingProfile(
      [facts(1, TERMS), facts(2, TERMS)],
      { ...TERMS, standingLines: [line] },
    );
    expect(after.map((record) => record.terms.standingLines)).toEqual([
      [line],
      [line],
    ]);
  });

  it("drops the spans, which belong to the worker and not to a month", () => {
    // `MonthRecord` is `MonthFacts` without them (`repository.ts`): a spell
    // crossing a boundary is one spell stored once, and writing it back from
    // each month it reaches would make it two.
    const withSpan: MonthFacts = {
      ...facts(3, TERMS),
      spans: [
        { id: "s1", kind: "vacation", from: "2026-03-02", to: "2026-03-04" },
      ],
    };
    const [record] = monthsFollowingProfile([withSpan], TERMS);
    expect("spans" in record).toBe(false);
  });
});

describe("the income-tax setting the server accepts (specs.md item 17)", () => {
  /** The two modes that carry no number are stored as they arrive, and the
   * percentage field is ignored for them rather than smuggled in. */
  it("stores automatic and none without a rate", () => {
    expect(reviewIncomeTax("automatic", "")).toEqual({
      ok: true,
      setting: { mode: "automatic" },
    });
    expect(reviewIncomeTax("none", "9")).toEqual({
      ok: true,
      setting: { mode: "none" },
    });
  });

  /** Typed as a percentage and held as a fraction, which is the unit
   * `nationalInsurance` already uses: 2.5 becomes 0.025, and the division
   * happens here and nowhere between here and the engine. */
  it("holds a typed percentage as a fraction", () => {
    expect(reviewIncomeTax("percentage", "2.5")).toEqual({
      ok: true,
      setting: { mode: "percentage", percentage: 0.025 },
    });
  });

  /**
   * **Zero is refused rather than accepted as "nothing".** `none` is what says
   * that, and the whole reason there are three modes is so a family never has
   * to express a decision as an amount — a stored rate of zero would be a
   * worker whose tax is a percentage of nothing, which reads on every screen
   * exactly like a worker nobody has set up.
   */
  it("refuses a rate of zero and points at the mode that means it", () => {
    expect(reviewIncomeTax("percentage", "0")).toEqual({
      ok: false,
      reason: "incomeTaxRate",
    });
  });

  /** The two that cannot be meant. A rate above the whole salary would pay her
   * nothing while looking like an ordinary withholding. */
  it("refuses a negative rate, a rate above 100, and an empty one", () => {
    for (const text of ["-1", "101", "", "  ", "abc"]) {
      expect(reviewIncomeTax("percentage", text)).toEqual({
        ok: false,
        reason: "incomeTaxRate",
      });
    }
  });

  /**
   * **A crafted request is refused by the same check the control passes**
   * (Part 3). The mode arrives as request data, which a union cannot check, and
   * a fourth mode stored on a profile would leave a worker whose tax the engine
   * has no branch for.
   */
  it("refuses a mode that is not one of the three", () => {
    expect(reviewIncomeTax("whatever", "")).toEqual({
      ok: false,
      reason: "incomeTaxMode",
    });
    expect(reviewIncomeTax(undefined, "")).toEqual({
      ok: false,
      reason: "incomeTaxMode",
    });
  });
});
