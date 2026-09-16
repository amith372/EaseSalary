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
  reviewNewWorker,
  firstNameOf,
  type NewWorkerDraft,
  firstMonthFor,
  firstMonthChoices,
  reviewEmployedSince,
  type OpeningDraft,
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
  firstMonth: { year: 2024, month: 4 },
  gender: "female",
  baseMonthlySalaryAgorot: 624765,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  incomeTax: DEFAULT_INCOME_TAX,
  standingLines: [],
  country: "PH",
  openingPosition: { vacationDays: 0, sickDays: 0, vacationUsedThisYear: 0, holidayUsedThisYear: 0, recuperationPaidIn: null, advances: [] },
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

  it("carries the rest of the position through when only the days change", () => {
    const current = {
      vacationDays: 1,
      sickDays: 2,
      vacationUsedThisYear: 3,
      holidayUsedThisYear: 1.5,
      recuperationPaidIn: { year: 2026, month: 3 },
      advances: [{ number: 1, principalAgorot: 1000000, repaidAgorot: 0 }],
    };
    const reviewed = reviewOpeningDays(
      { vacationDays: "9", sickDays: "24" },
      current,
    );
    expect(reviewed).toEqual({
      ok: true,
      position: { ...current, vacationDays: 9, sickDays: 24 },
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

/**
 * The worker the `הוספת עובד` wizard creates (`build_plan.md` stage 3).
 *
 * **The minimum wage below is April 2026's, ₪6,443.85, read out of the
 * committed 2026 workbook and already seeded in `SEEDED_RATES` with that
 * provenance** — not a figure this suite invented and not one the function
 * returned. It is passed in rather than looked up, which is what lets the
 * refusal below be asserted at all.
 */
describe("the first month of a worker added today (specs.md item 6)", () => {
  it("is the month she is added in when the employment already began", () => {
    expect(firstMonthFor("2024-04-01", "2026-09-17")).toEqual({ year: 2026, month: 9 });
    expect(firstMonthFor("2026-09-30", "2026-09-17")).toEqual({ year: 2026, month: 9 });
  });

  it("is the month the employment begins when that is still ahead", () => {
    expect(firstMonthFor("2026-11-15", "2026-09-17")).toEqual({ year: 2026, month: 11 });
  });

  it("may be the month before, unless the employment began after it", () => {
    const september = { year: 2026, month: 9 };
    const august = { year: 2026, month: 8 };
    expect(firstMonthChoices("2024-04-01", "2026-09-17")).toEqual([september, august]);
    // Began during August: August is still a month of the employment.
    expect(firstMonthChoices("2026-08-20", "2026-09-17")).toEqual([september, august]);
    // Began this month: last month was before the employment.
    expect(firstMonthChoices("2026-09-03", "2026-09-17")).toEqual([september]);
    // Begins later: that month, and nothing to choose.
    expect(firstMonthChoices("2026-11-15", "2026-09-17")).toEqual([{ year: 2026, month: 11 }]);
  });
});

describe("the start date's range (specs.md item 6)", () => {
  it("counts the year from the day it is given", () => {
    expect(reviewEmployedSince("2025-03-10", "2024-03-10")).toBe("2025-03-10");
    expect(reviewEmployedSince("2025-03-11", "2024-03-10")).toBe("range");
  });

  it("gives 29 February the last day of the next February", () => {
    expect(reviewEmployedSince("2029-02-28", "2028-02-29")).toBe("2029-02-28");
    expect(reviewEmployedSince("2029-03-01", "2028-02-29")).toBe("range");
  });

  it("refuses a corrected date after the worker's first month", () => {
    const september = { year: 2026, month: 9 };
    // The first month's own last day is still inside it; the next day is not.
    expect(reviewEmployedSince("2026-09-30", "2026-09-17", september)).toBe("2026-09-30");
    expect(reviewEmployedSince("2026-10-01", "2026-09-17", september)).toBe("afterFirstMonth");
    // Earlier is always a correction the first month can hold.
    expect(reviewEmployedSince("2024-04-01", "2026-09-17", september)).toBe("2024-04-01");
    // Out of range is said before the first month is considered.
    expect(reviewEmployedSince("2028-01-01", "2026-09-17", september)).toBe("range");
  });

  it("tells a date that is not a date from one out of range", () => {
    expect(reviewEmployedSince("", "2026-09-16")).toBe("invalid");
    expect(reviewEmployedSince("2026-02-30", "2026-09-16")).toBe("invalid");
    expect(reviewEmployedSince("2019-06-01", "2026-09-16")).toBe("range");
  });
});

describe("reviewNewWorker", () => {
  /** April 2026's minimum wage, in agorot. */
  const MINIMUM = 644385;
  const TODAY = "2026-09-16";

  const draft = (over: Partial<NewWorkerDraft> = {}): NewWorkerDraft => ({
    name: "מריה סנטוס",
    gender: "female",
    passportNumber: "P1234567",
    country: "PH",
    employedSince: "2026-04-01",
    restDay: SATURDAY,
    recuperationMonth: "7",
    baseMonthlySalary: "6443.85",
    restEveSupplement: "300",
    insurer: "",
    incomeTaxMode: "automatic",
    incomeTaxPercentage: "",
    firstMonth: "2026-09",
    opening: opening(),
    ...over,
  });

  const opening = (over: Partial<OpeningDraft> = {}): OpeningDraft => ({
    vacationDays: "0",
    sickDays: "0",
    vacationUsedThisYear: "0",
    holidayUsedThisYear: "0",
    recuperationPaid: null,
    recuperationPaidIn: "",
    advances: [],
    ...over,
  });

  it("refuses a first month the start date does not offer", () => {
    // July is two months before the month she is added in.
    expect(reviewNewWorker(draft({ firstMonth: "2026-07" }), MINIMUM, TODAY)).toEqual({
      ok: false,
      reason: "firstMonth",
    });
    // August, for an employment that began in September.
    expect(
      reviewNewWorker(
        draft({ employedSince: "2026-09-01", firstMonth: "2026-08" }),
        MINIMUM,
        TODAY,
      ),
    ).toEqual({ ok: false, reason: "firstMonth" });
    const reviewed = reviewNewWorker(draft({ firstMonth: "2026-08" }), MINIMUM, TODAY);
    expect(reviewed.ok && reviewed.profile.firstMonth).toEqual({ year: 2026, month: 8 });
  });

  /** An employment the application sees from its first month has no opening
   * position, so a figure left in a field the wizard did not show is not read. */
  it("reads no opening position when the employment began in the first month", () => {
    const reviewed = reviewNewWorker(
      draft({
        employedSince: "2026-09-01",
        opening: opening({ vacationDays: "5", advances: [{ principal: "100", repaid: "", note: "" }] }),
      }),
      MINIMUM,
      TODAY,
    );
    expect(reviewed.ok && reviewed.profile.openingPosition).toEqual({
      vacationDays: 0,
      sickDays: 0,
      vacationUsedThisYear: 0,
      holidayUsedThisYear: 0,
      recuperationPaidIn: null,
      advances: [],
    });
  });

  /**
   * An employment since 1.4.2024 added in September 2026, recuperation in July.
   * The employment year running in September 2026 began in April 2026, so its
   * payment month is July 2026 — before the first month — and two full years
   * are complete by then, so it is owed (item 15). The question is asked.
   */
  describe("an employment that began before the first month", () => {
    const midway = (over: Partial<OpeningDraft>) =>
      reviewNewWorker(draft({ employedSince: "2024-04-01", opening: opening(over) }), MINIMUM, TODAY);

    it("keeps every figure the family stated", () => {
      const reviewed = midway({
        vacationDays: "12.5",
        sickDays: "30",
        vacationUsedThisYear: "3",
        holidayUsedThisYear: "2",
        recuperationPaid: true,
        recuperationPaidIn: "2026-07",
        advances: [{ principal: "10000", repaid: "2000", note: "" }],
      });
      expect(reviewed.ok && reviewed.profile.openingPosition).toEqual({
        vacationDays: 12.5,
        sickDays: 30,
        vacationUsedThisYear: 3,
        holidayUsedThisYear: 2,
        recuperationPaidIn: { year: 2026, month: 7 },
        advances: [{ number: 1, principalAgorot: 1000000, repaidAgorot: 200000 }],
      });
    });

    it("needs the recuperation question answered, and a no stores no month", () => {
      expect(midway({})).toEqual({ ok: false, reason: "recuperationPaid" });
      const no = midway({ recuperationPaid: false, recuperationPaidIn: "2026-07" });
      expect(no.ok && no.profile.openingPosition.recuperationPaidIn).toBeNull();
    });

    it("refuses a payment month outside the employment before the first month", () => {
      expect(midway({ recuperationPaid: true, recuperationPaidIn: "2026-09" })).toEqual({
        ok: false,
        reason: "recuperationPaidIn",
      });
      expect(midway({ recuperationPaid: true, recuperationPaidIn: "2024-03" })).toEqual({
        ok: false,
        reason: "recuperationPaidIn",
      });
      expect(midway({ recuperationPaid: true, recuperationPaidIn: "" })).toEqual({
        ok: false,
        reason: "recuperationPaidIn",
      });
    });

    it("refuses what is not a count of days, and an advance repaid past its sum", () => {
      const answered = { recuperationPaid: false };
      expect(midway({ ...answered, sickDays: "" })).toEqual({ ok: false, reason: "openingDays" });
      expect(midway({ ...answered, vacationUsedThisYear: "-1" })).toEqual({
        ok: false,
        reason: "openingUsed",
      });
      expect(
        midway({ ...answered, advances: [{ principal: "100", repaid: "150", note: "" }] }),
      ).toEqual({ ok: false, reason: "openingAdvance" });
    });

    /** October's payment for the year that began in April 2026 is still ahead
     * of September, so nothing fell before the first month and nothing is asked. */
    it("does not ask about recuperation whose month is still ahead", () => {
      const reviewed = reviewNewWorker(
        draft({ employedSince: "2024-04-01", recuperationMonth: "10" }),
        MINIMUM,
        TODAY,
      );
      expect(reviewed.ok && reviewed.profile.openingPosition.recuperationPaidIn).toBeNull();
    });

    /** January has nothing of its year before it, so the counts are not read. */
    it("does not read the days used this year for a January first month", () => {
      const reviewed = reviewNewWorker(
        draft({
          employedSince: "2024-04-01",
          firstMonth: "2026-01",
          opening: opening({ vacationUsedThisYear: "x", recuperationPaid: false }),
        }),
        MINIMUM,
        "2026-01-10",
      );
      expect(reviewed.ok && reviewed.profile.openingPosition.vacationUsedThisYear).toBe(0);
    });
  });

  it("makes a profile whose every stated term is the one that was typed", () => {
    const reviewed = reviewNewWorker(draft(), MINIMUM, TODAY);
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;

    expect(reviewed.profile).toMatchObject({
      name: "מריה סנטוס",
      gender: "female",
      employedSince: "2026-04-01",
      restDay: SATURDAY,
      recuperationMonth: 7,
      baseMonthlySalaryAgorot: 644385,
      restEveSupplementAgorot: 30000,
      country: "PH",
      insurer: "",
    });
  });

  /**
   * **What the wizard never asked for opens empty rather than guessed**
   * (`CLAUDE.md` rule 4). This is the assertion that would catch a later
   * session giving a new worker a plausible opening balance or a standing line
   * nobody entered: item 6's position is the family's to state, and a figure
   * invented here would be replayed into every month's balances for ever
   * (item 13).
   */
  it("opens with nothing the family did not state", () => {
    const reviewed = reviewNewWorker(draft(), MINIMUM, TODAY);
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;

    expect(reviewed.profile.openingPosition).toEqual({
      vacationDays: 0,
      sickDays: 0,
      vacationUsedThisYear: 0,
      holidayUsedThisYear: 0,
      recuperationPaidIn: null,
      advances: [],
    });
    expect(reviewed.profile.standingLines).toEqual([]);
    expect(reviewed.profile.documents).toEqual({
      employmentPermitExpiry: null,
      workVisaExpiry: null,
      passportExpiry: null,
    });
  });

  /** The first name is read off the full name rather than asked for twice, so
   * "לדף של [שם]" has something to say. A single-word name is its own. */
  it("reads the first name off the full name", () => {
    expect(firstNameOf("מריה סנטוס")).toBe("מריה");
    expect(firstNameOf("  מריה   דה לה קרוס  ")).toBe("מריה");
    expect(firstNameOf("מריה")).toBe("מריה");
  });

  /**
   * **The salary may not be set below the confirmed minimum wage**
   * (`CLAUDE.md`'s non-negotiables, item 3). One agora under April 2026's
   * ₪6,443.85 is the boundary, and it is its own refusal rather than "not a
   * number" because a family that typed it typed a number they may not agree
   * to.
   */
  it("refuses a salary below the minimum wage, and accepts the minimum wage itself", () => {
    expect(reviewNewWorker(draft({ baseMonthlySalary: "6443.84" }), MINIMUM, TODAY)).toEqual({
      ok: false,
      reason: "belowMinimum",
    });
    expect(reviewNewWorker(draft({ baseMonthlySalary: "6443.85" }), MINIMUM, TODAY).ok).toBe(true);
  });

  /** No supplement is a family that agreed none, not a refusal: nothing in law
   * requires it (item 14). */
  it("takes an empty rest-eve supplement as none", () => {
    const reviewed = reviewNewWorker(draft({ restEveSupplement: "" }), MINIMUM, TODAY);
    expect(reviewed.ok).toBe(true);
    if (reviewed.ok) expect(reviewed.profile.restEveSupplementAgorot).toBe(0);
  });

  /**
   * **A crafted request is refused by the same check the control passes**
   * (Part 3). Every one of these arrives as request data that a union cannot
   * check, and each would leave a worker the engine has no branch for: a fourth
   * rest day nothing counts against, a gender the credit points have no value
   * for, a thirteenth recuperation month that never falls.
   */
  it("refuses what a control could not have sent", () => {
    expect(reviewNewWorker(draft({ name: "   " }), MINIMUM, TODAY)).toEqual({
      ok: false,
      reason: "name",
    });
    expect(reviewNewWorker(draft({ gender: "other" }), MINIMUM, TODAY)).toEqual({
      ok: false,
      reason: "gender",
    });
    expect(reviewNewWorker(draft({ country: "" }), MINIMUM, TODAY)).toEqual({
      ok: false,
      reason: "country",
    });
    expect(reviewNewWorker(draft({ restDay: THURSDAY }), MINIMUM, TODAY)).toEqual({
      ok: false,
      reason: "restDay",
    });
    expect(reviewNewWorker(draft({ recuperationMonth: "13" }), MINIMUM, TODAY)).toEqual({
      ok: false,
      reason: "recuperationMonth",
    });
    expect(reviewNewWorker(draft({ recuperationMonth: "0" }), MINIMUM, TODAY)).toEqual({
      ok: false,
      reason: "recuperationMonth",
    });
  });

  /**
   * A start date is refused where a document date is accepted empty, and the
   * difference is not an inconsistency: seniority is counted from this one, so
   * a worker without it has no accrual tier, no recuperation entitlement and no
   * year to prorate a holiday over (items 7, 10, 15).
   *
   * `2026-02-30` is the case a regular expression accepts and a `Date` rolls
   * forward into March — `specs.md` Part 5's own class of mistake.
   */
  it("refuses a start date that is missing or is not a date", () => {
    expect(reviewNewWorker(draft({ employedSince: "" }), MINIMUM, TODAY)).toEqual({
      ok: false,
      reason: "employedSince",
    });
    expect(reviewNewWorker(draft({ employedSince: "2026-02-30" }), MINIMUM, TODAY)).toEqual({
      ok: false,
      reason: "employedSince",
    });
  });

  // Item 6: from 1 January 2020 to one year after the day she was added.
  // TODAY is 2026-09-16, so the last accepted day is 2027-09-16.
  it.each([
    ["2020-01-01", true],
    ["2019-12-31", false],
    ["2027-09-16", true],
    ["2027-09-17", false],
    ["1901-01-01", false],
  ])("takes %s as a start date: %s", (employedSince, accepted) => {
    // The rest of the draft made valid for the date: a start a year ahead
    // makes that month the first, and one in 2020 is asked about recuperation.
    const reviewed = reviewNewWorker(
      draft({
        employedSince,
        firstMonth: employedSince.startsWith("2027") ? "2027-09" : "2026-09",
        opening: opening({ recuperationPaid: false }),
      }),
      MINIMUM,
      TODAY,
    );
    expect(reviewed.ok ? true : reviewed.reason).toBe(
      accepted ? true : "employedSinceRange",
    );
  });

  /** The flat rate travels as a fraction, which is the unit the dated-rates
   * table already uses, so the profile and a month's own correction cannot come
   * to disagree about what "2.5" means. */
  it("stores a flat tax rate as a fraction and refuses one that is not a rate", () => {
    const reviewed = reviewNewWorker(
      draft({ incomeTaxMode: "percentage", incomeTaxPercentage: "2.5" }),
      MINIMUM,
      TODAY,
    );
    expect(reviewed.ok).toBe(true);
    if (reviewed.ok) expect(reviewed.profile.incomeTax).toEqual({
      mode: "percentage",
      percentage: 0.025,
    });

    expect(
      reviewNewWorker(
        draft({ incomeTaxMode: "percentage", incomeTaxPercentage: "" }),
        MINIMUM,
        TODAY,
      ),
    ).toEqual({ ok: false, reason: "incomeTaxRate" });
  });
});
