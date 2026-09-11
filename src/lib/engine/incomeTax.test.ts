import { describe, expect, it } from "vitest";
import { SEEDED_RATES } from "@/lib/datedRates";
import {
  CAREGIVER_CREDIT_POINTS,
  WOMANS_EXTRA_CREDIT_POINTS,
  annualTaxBeforeCredits,
  creditPointsFor,
  effectiveTaxRate,
  incomeTaxForMonth,
  monthlyIncomeTax,
  reviewTaxPercentage,
  taxForSetting,
  taxFromPercentage,
} from "@/lib/engine/incomeTax";
import type { IncomeTaxSetting } from "@/lib/engine/types";
import { SEEDED_TAX_BRACKETS, bracketsForYear } from "@/lib/taxBrackets";
import type { TaxYearBrackets } from "@/lib/taxBrackets";

/**
 * The income tax (specs.md item 17, approved 2026-09-10).
 *
 * **Every figure below is worked by hand from the statute's own tables** and
 * never from what this module returned (`CLAUDE.md`). The bracket bounds and
 * rates come from `taxBrackets.ts`, which cites Kol Zchut's
 * `מדרגות מס הכנסה`; the credit point is the ₪2,904 a year that table cites;
 * the minimum wage is the family's own workbook. The arithmetic is written out
 * beside each expectation so a reader can check it without running anything.
 */

const BRACKETS_2026 = bracketsForYear(SEEDED_TAX_BRACKETS, 2026)!.brackets;
const BRACKETS_2025 = bracketsForYear(SEEDED_TAX_BRACKETS, 2025)!.brackets;

/** ₪2,904 a year, the figure `datedRates.ts` seeds and cites. */
const CREDIT_POINT_A_YEAR = 290400;

/** The minimum wage from April 2026 — ₪6,443.85, read out of
 * `שכר_חודשי_להאנה2026.xlsx → חודש  4.26 → D6`. */
const MINIMUM_WAGE_2026 = 644385;

function taxFor(grossAgorot: number, gender: "female" | "male" = "female") {
  return incomeTaxForMonth({
    grossAgorot,
    brackets: BRACKETS_2026,
    creditPointValueAnnualAgorot: CREDIT_POINT_A_YEAR,
    gender,
  });
}

describe("the credit points, which are derived and never asked for", () => {
  /**
   * Kol Zchut, `נקודות זיכוי ממס הכנסה לעובד זר`, read 2026-09-10: a legally
   * employed foreign worker in home care holds 2.25 points and a woman holds
   * half a point more.
   */
  it("gives a female caregiver 2.75 and a male caregiver 2.25", () => {
    expect(creditPointsFor("female")).toBe(2.75);
    expect(creditPointsFor("male")).toBe(2.25);
  });

  it("keeps the half point as the whole of the difference", () => {
    expect(creditPointsFor("female") - creditPointsFor("male")).toBe(
      WOMANS_EXTRA_CREDIT_POINTS,
    );
    expect(creditPointsFor("male")).toBe(CAREGIVER_CREDIT_POINTS);
  });
});

describe("the brackets, each taxing only the slice inside it", () => {
  /**
   * **The test that catches the commonest way to get a progressive table
   * wrong**: taxing the whole income at the rate of the bracket it lands in.
   *
   * ₪120,000 a year lands in the 14% bracket. Taxing all of it at 14% gives
   * ₪16,800 — a plausible-looking figure ₪3,364.80 too high. The right answer
   * is 8,412,000 × 10% = 841,200 agorot, plus (12,000,000 − 8,412,000) ×
   * 14% = 502,320, which is 1,343,520 agorot, or ₪13,435.20.
   */
  it("taxes each slice at its own rate and not the whole at the top one", () => {
    expect(annualTaxBeforeCredits(12000000, BRACKETS_2026)).toBeCloseTo(
      1343520,
      6,
    );
    expect(annualTaxBeforeCredits(12000000, BRACKETS_2026)).not.toBeCloseTo(
      12000000 * 0.14,
      6,
    );
  });

  /** The first bound is inclusive: ₪84,120 is inside the 10% bracket, so the
   * whole of it is taxed at 10% and nothing spills into the 14% one. */
  it("keeps the bound itself inside its own bracket", () => {
    expect(annualTaxBeforeCredits(8412000, BRACKETS_2026)).toBeCloseTo(
      841200,
      6,
    );
  });

  /** An income of nothing is taxed nothing, and the walk must not run the
   * first bracket anyway. */
  it("taxes nothing at all on no income", () => {
    expect(annualTaxBeforeCredits(0, BRACKETS_2026)).toBe(0);
  });

  /**
   * The unbounded top bracket, which is the one a sentinel figure would get
   * wrong. ₪1,200,000 a year:
   *   8,412,000 × 10%  =    841,200
   *   3,660,000 × 14%  =    512,400
   *  10,728,000 × 20%  =  2,145,600
   *   7,320,000 × 31%  =  2,269,200
   *  25,908,000 × 35%  =  9,067,800
   *  16,128,000 × 47%  =  7,580,160
   *  47,844,000 × 50%  = 23,922,000
   *                      ----------
   *                      46,338,360 agorot, or ₪463,383.60
   */
  it("runs the top bracket to the income itself", () => {
    expect(annualTaxBeforeCredits(120000000, BRACKETS_2026)).toBeCloseTo(
      46338360,
      4,
    );
  });
});

describe("the month's tax at the minimum wage", () => {
  /**
   * **The ordinary answer is zero, and this is the case that says why.**
   *
   * ₪6,443.85 a month is ₪77,326.20 a year, entirely inside the 10% bracket,
   * so the tax before credits is ₪7,732.62 a year — ₪644.385 a month. A
   * woman's 2.75 points are worth 2.75 × ₪2,904 = ₪7,986 a year, which is
   * ₪665.50 a month. The credit is the larger of the two, and a credit is not
   * a refund, so the line is zero.
   *
   * It would catch a calculation that forgot the credits entirely — that one
   * withholds ₪644.39 from a worker who owes nothing — and one that let the
   * credit run negative, which would pay her ₪21.12 she is not owed.
   */
  it("withholds nothing from a woman at the minimum wage", () => {
    expect(taxFor(MINIMUM_WAGE_2026)).toBe(0);
  });

  /**
   * The same month for a man, whose 2.25 points are worth 2.25 × ₪2,904 =
   * ₪6,534 a year, or ₪544.50 a month. ₪644.385 − ₪544.50 = ₪99.885, which
   * rounds to ₪99.89 — 9,989 agorot.
   *
   * It is the test that proves the gender actually reaches the figure: a
   * calculation that hardcoded 2.75 would return zero here as well.
   */
  it("withholds ₪99.89 from a man at the same wage", () => {
    expect(taxFor(MINIMUM_WAGE_2026, "male")).toBe(9989);
  });

  /**
   * Where the line stops being zero. A woman's credit is ₪665.50 a month and
   * the first bracket is 10%, so the tax matches the credit at exactly
   * ₪6,655.00 a month. At ₪6,656.00 the tax is ₪665.60 and ₪0.10 is withheld.
   */
  it("starts withholding just above ₪6,655 a month", () => {
    expect(taxFor(665500)).toBe(0);
    expect(taxFor(665600)).toBe(10);
  });
});

describe("the month's tax above the first bracket", () => {
  /**
   * ₪10,000 a month is ₪120,000 a year, whose tax before credits is 1,343,520
   * agorot a year — worked out above — which is 111,960 agorot a month, or
   * ₪1,119.60. Less a woman's ₪665.50 credit: ₪454.10, which is 45,410
   * agorot.
   */
  it("crosses into the 14% bracket and credits once", () => {
    expect(taxFor(1000000)).toBe(45410);
  });

  /**
   * **The year matters, and this is the month that proves it** (criterion 4: a
   * month is valued at the figures in force during it).
   *
   * ₪18,000 a month is ₪216,000 a year. The two tables put the third bracket's
   * top in different places — ₪193,800 in 2025 and ₪228,000 in 2026 — so the
   * same income is taxed differently:
   *
   *   2025: 841,200 + 512,400 + 7,308,000 × 20% + 2,220,000 × 31%
   *       = 841,200 + 512,400 + 1,461,600 + 688,200 = 3,503,400 a year
   *       = 291,950 a month, less ₪665.50 → 225,400 agorot (₪2,254.00)
   *
   *   2026: 841,200 + 512,400 + 9,528,000 × 20%
   *       = 841,200 + 512,400 + 1,905,600 = 3,259,200 a year
   *       = 271,600 a month, less ₪665.50 → 205,050 agorot (₪2,050.50)
   *
   * It would catch a calculation that reached for whichever table came first,
   * or for the newest one — ₪203.50 a month of tax withheld from the wrong
   * year, which nothing on the sheet would show as an error.
   */
  it("taxes the same income differently in 2025 and in 2026", () => {
    const common = {
      grossAgorot: 1800000,
      creditPointValueAnnualAgorot: CREDIT_POINT_A_YEAR,
      gender: "female",
    } as const;
    expect(incomeTaxForMonth({ ...common, brackets: BRACKETS_2025 })).toBe(
      225400,
    );
    expect(incomeTaxForMonth({ ...common, brackets: BRACKETS_2026 })).toBe(
      205050,
    );
  });

  /** The top bracket, end to end: 46,338,360 agorot a year is 3,861,530 a
   * month, less a woman's ₪665.50 credit → 3,794,980 agorot (₪37,949.80). */
  it("reaches the 50% bracket and still credits once", () => {
    expect(taxFor(10000000)).toBe(3794980);
  });
});

describe("the month that has no table to be taxed by", () => {
  /**
   * **`null` is an answer and not a failure.** Brackets are restated every
   * January, so reaching for the nearest year is precisely the wrong guess; a
   * month outside every table has no tax the application can honestly work
   * out, and the month says so with a warning rather than withholding a figure
   * nobody can cite.
   */
  it("answers null for a year the application holds no table for", () => {
    expect(
      monthlyIncomeTax(
        1000000,
        { year: 2031, month: 3 },
        "female",
        SEEDED_RATES,
        SEEDED_TAX_BRACKETS,
      ),
    ).toBeNull();
  });

  /** The credit point is dated like every other rate, and a month before its
   * first row has no credit to apply — which is not the same as applying none. */
  it("answers null before the credit point has a dated value", () => {
    expect(
      monthlyIncomeTax(
        1000000,
        { year: 2026, month: 3 },
        "female",
        [],
        SEEDED_TAX_BRACKETS,
      ),
    ).toBeNull();
  });

  /** The ordinary path, read through the dated tables rather than handed
   * figures, so the seeds and the lookup are covered together. */
  it("finds the year's table and the credit point in force", () => {
    expect(
      monthlyIncomeTax(
        1000000,
        { year: 2026, month: 3 },
        "female",
        SEEDED_RATES,
        SEEDED_TAX_BRACKETS,
      ),
    ).toBe(45410);
  });
});

describe("the three modes a worker's tax can be set to (item 17)", () => {
  const rates = SEEDED_RATES;
  const march = { year: 2026, month: 3 } as const;
  /** ₪10,000 a month, whose automatic answer is worked out above: ₪454.10. */
  const GROSS = 1000000;

  it("works the figure out under automatic", () => {
    expect(
      taxForSetting(
        { mode: "automatic" },
        GROSS,
        march,
        "female",
        rates,
        SEEDED_TAX_BRACKETS,
      ),
    ).toBe(45410);
  });

  /**
   * **`none` is a settled zero and not an absent figure**, which is the whole
   * reason it is a mode rather than a typed amount: a family whose caregiver's
   * tax is settled elsewhere says so once instead of entering a zero into every
   * month for ever, and a zero entered twelve times cannot be told apart from
   * twelve months nobody looked at.
   */
  it("withholds nothing under none, whatever the month came to", () => {
    expect(
      taxForSetting(
        { mode: "none" },
        GROSS,
        march,
        "female",
        rates,
        SEEDED_TAX_BRACKETS,
      ),
    ).toBe(0);
  });

  /**
   * A flat rate of the ‏ברוטו‎, which is what an accountant hands a family as one
   * number. 2.5% of ₪10,000 is ₪250.00 — 25,000 agorot — and it is deliberately
   * *not* the ₪454.10 the brackets arrive at, so a mode that quietly fell back
   * to the calculation would fail here rather than agree by accident.
   */
  it("takes a flat share of the gross under percentage", () => {
    expect(
      taxForSetting(
        { mode: "percentage", percentage: 0.025 },
        GROSS,
        march,
        "female",
        rates,
        SEEDED_TAX_BRACKETS,
      ),
    ).toBe(25000);
  });

  /** The rate is carried as a fraction and rounded once, where it becomes an
   * amount: 3.33% of ₪8,353.05 is ₪278.155, which is 27,816 agorot. */
  it("rounds the flat share to the agora exactly once", () => {
    expect(
      taxForSetting(
        { mode: "percentage", percentage: 0.0333 },
        835305,
        march,
        "female",
        rates,
        SEEDED_TAX_BRACKETS,
      ),
    ).toBe(27816);
  });

  /** Neither settled mode needs a bracket table, so neither goes `null` in a
   * year the application holds none. Only `automatic` can. */
  it("answers without a bracket table under none and percentage", () => {
    const args: [number, { year: number; month: number }, "female", typeof rates, TaxYearBrackets[]] =
      [835305, { year: 2031, month: 3 }, "female", rates, []];
    expect(taxForSetting({ mode: "none" }, ...args)).toBe(0);
    expect(
      taxForSetting({ mode: "percentage", percentage: 0.05 }, ...args),
    ).toBe(41765);
    expect(taxForSetting({ mode: "automatic" }, ...args)).toBeNull();
  });
});

describe("the share of the month a tax came to", () => {
  /** ₪223.53 out of ₪8,353.05 is 2.6760...%, which the card rounds to 2.68%.
   * The figure exists because the automatic mode reaches a different percentage
   * every month, and it is the one number a family would otherwise work out by
   * hand to compare against an accountant's advice. */
  it("reports the fraction actually withheld", () => {
    const share = effectiveTaxRate(22353, 835305);
    expect(share).not.toBeNull();
    expect(((share ?? 0) * 100).toFixed(2)).toBe("2.68");
  });

  /** A month with no gross has no share, rather than a share of zero: dividing
   * by nothing is how a percentage sign ends up beside an infinity. */
  it("has no share where there is no gross", () => {
    expect(effectiveTaxRate(0, 0)).toBeNull();
  });
});

/**
 * A correction typed as a share of the month's ברוטו rather than as a sum
 * (settled with the user on 2026-09-11).
 *
 * **The figures are worked by hand and not read off the implementation**: the
 * seeded demo's August 2026 gross is ₪8,353.05, so 2.5% of it is 208.82625
 * shekels — 20,882.625 agorot — which rounds to 20,883, and one rounding is the
 * only one there may be (`CLAUDE.md`).
 *
 * **What it would catch**: a conversion that rounded the percentage before it
 * met the gross, which is short by an agora on most months and exact on the
 * ones a casual test would pick; a parse that accepted a rate nobody could have
 * meant, so a mistyped `250` withheld two and a half times the salary; and a
 * percentage mode on the profile arriving at a different figure from the same
 * percentage typed against one month, which is the disagreement one shared
 * function exists to prevent.
 */
describe("a correction typed as a percentage", () => {
  const GROSS = 835305;

  it("takes the share of the gross and rounds once", () => {
    expect(taxFromPercentage(0.025, GROSS)).toBe(20883);
  });

  it("agrees to the agora with the same rate set on the profile", () => {
    const setting: IncomeTaxSetting = { mode: "percentage", percentage: 0.025 };
    expect(
      taxForSetting(
        setting,
        GROSS,
        { year: 2026, month: 8 },
        "female",
        SEEDED_RATES,
        SEEDED_TAX_BRACKETS,
      ),
    ).toBe(taxFromPercentage(0.025, GROSS));
  });

  it("never pays her, whatever arrives past the form", () => {
    expect(taxFromPercentage(-0.5, GROSS)).toBe(0);
  });

  it("reads a rate with a decimal in it, which is the ordinary case", () => {
    expect(reviewTaxPercentage("2.5")).toBe(0.025);
    expect(reviewTaxPercentage(" 7 ")).toBe(0.07);
    expect(reviewTaxPercentage("100")).toBe(1);
  });

  it("refuses a rate nobody could have meant", () => {
    // Zero is `none`'s job on the profile, and an amount's job on a month.
    expect(reviewTaxPercentage("0")).toBeNull();
    expect(reviewTaxPercentage("-3")).toBeNull();
    // 250% withholds two and a half times what the month paid.
    expect(reviewTaxPercentage("250")).toBeNull();
    expect(reviewTaxPercentage("")).toBeNull();
    expect(reviewTaxPercentage("שני אחוזים")).toBeNull();
  });
});
