import { describe, expect, it } from "vitest";
import { dailyRate, deriveRates, restDayRate } from "@/lib/engine/rates";
import { WAGE_2025, WAGE_2026 } from "@/lib/engine/workbook.fixture";

/**
 * The derived rates, checked against the rate the family wrote in `D8` and `D9`
 * of their own tabs across three wage eras.
 *
 * `specs.md` item 3 forbids storing any of these: the rest-day rate is one day
 * plus one hour at 150%, which is the salary over 25 plus the salary over 182,
 * times 1.5 (Part 5). Three different salaries reaching three different figures
 * that the workbook independently agrees with is what separates a formula from a
 * constant that happens to be right once.
 */

/** ₪5,880.02 — `D6` of every 2024 tab, the minimum wage in force to 31.3.2025. */
const WAGE_2024 = 588002;

describe("the rest-day rate, across three wage eras", () => {
  it("gives ₪426.35 at the 2025 wage — `D9` of `חודש  8.25`", () => {
    expect(Math.round(restDayRate(WAGE_2025))).toBe(42635);
  });

  it("gives ₪439.74 at the 2026 wage — `D9` of `חודש  5.26`", () => {
    // A second, independent salary. If the rate were a stored constant this is
    // the assertion that would fail, and it is why one era cannot check a rule.
    expect(Math.round(restDayRate(WAGE_2026))).toBe(43974);
  });

  it("prices a holiday she works at the same rate as a rest day (item 9)", () => {
    // `D8` and `D9` hold one figure in every tab of all three workbooks, and
    // `deriveRates` exposes one `restDay` rate rather than two — a holiday rate
    // of its own would be a second path to one figure, and the two would
    // disagree the day either is corrected.
    const rates = deriveRates(WAGE_2026);
    expect(Object.keys(rates).sort()).toEqual(["daily", "restDay"]);
    expect(Math.round(rates.restDay)).toBe(43974);
  });

  it("keeps full precision through the multiplication, never between steps", () => {
    // Six units at the 2026 rate. Rounding the rate first gives 43,974 × 6 =
    // 263,844 by luck here, so the assertion that matters is the unrounded
    // product: 43,973.96538… × 6 = 263,843.79…, which rounds to the ₪2,638.44
    // of `F24` in `חודש  5.26`. `CLAUDE.md` requires the round at the end alone.
    expect(restDayRate(WAGE_2026)).toBeCloseTo(43973.96538, 4);
    expect(Math.round(restDayRate(WAGE_2026) * 6)).toBe(263844);
  });
});

describe("the daily rate, which is the salary over twenty-five", () => {
  it("gives ₪235.20 at the 2024 wage — `D17` of `חודש  4.24`", () => {
    // The workbook's own vacation-day rate. `specs.md` item 7 leaves that cell
    // empty because the day is never paid, but the divisor it was built from is
    // the one item 8 prices a sick day at, and the workbook agrees with it.
    expect(Math.round(dailyRate(WAGE_2024))).toBe(23520);
  });

  it("gives ₪249.91 at the 2025 wage", () => {
    expect(Math.round(dailyRate(WAGE_2025))).toBe(24991);
  });
});

describe("where the 2024 workbook is wrong, and by how much", () => {
  it("derives ₪401.26 where `D9` of the 2024 tabs reads ₪401.25", () => {
    // Not a tolerance and not a bug: ₪5,880.02 over 25 is 235.2008 and over 182
    // is 32.3078…, summing to 267.5086… and giving 401.2629… at 150%. The
    // workbook wrote 401.25, which is what comes out if the hourly part is cut
    // to 32.30 before the multiplication — rounding between steps, the mistake
    // `CLAUDE.md` names outright.
    //
    // Part 5 says an exported figure may differ by an agora from the historical
    // sheet and that history is reproduced as history, never silently
    // rewritten. This assertion is that agora, pinned: if someone "fixes" the
    // engine to match the old sheet, every 2025 and 2026 month above breaks and
    // this test says why.
    expect(Math.round(restDayRate(WAGE_2024))).toBe(40126);
    expect(Math.round(restDayRate(WAGE_2024))).not.toBe(40125);
  });

  it("is the only era where the workbook and the formula disagree", () => {
    // 2025 and 2026 derive exactly, so the divergence is one year's arithmetic
    // and not a difference of method. That is what makes it safe to treat the
    // later tabs as an authority.
    expect(Math.round(restDayRate(WAGE_2025))).toBe(42635);
    expect(Math.round(restDayRate(WAGE_2026))).toBe(43974);
  });
});
