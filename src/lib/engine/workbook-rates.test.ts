import { describe, expect, it } from "vitest";
import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
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

describe("where the 2026 workbook is stale, and by how much", () => {
  /**
   * **The recuperation rate the 2026 workbook still pays, and the one in force
   * when it paid it** (specs.md item 15).
   *
   * `I18` of `חודש  3.26` states the family's arithmetic outright — six days at
   * ₪418 a day, ₪2,508 — and `G18` of that tab carries the ₪2,508. ₪418 is the
   * rate that preceded 1.7.2025; the rate in force in March 2026 is ₪451.50, so
   * the engine reaches ₪2,709 and is right to. The sheet is stale in the way
   * Part 5 records for the national-insurance line that stayed at 2%.
   *
   * **What it would catch**: `חודש  3.25` or `חודש  3.26` being seeded or added
   * to `WORKBOOK_MONTHS` on the strength of the ₪418 now being known — the
   * demo would show a ברוטו the workbook disagrees with, and somebody would
   * then "fix" the rate table to the family's stale figure and underpay every
   * later recuperation by ₪33.50 a day.
   */
  it("holds ₪451.50 a day for March 2026, where `I18` of that tab says ₪418", () => {
    const rate = rateInForce(SEEDED_RATES, "recuperationDayRate", {
      year: 2026,
      month: 3,
    });
    // ₪451.50 — the private sector's rate for the recuperation year running
    // 1.7.2025 to 30.6.2026, from kolzchut via `datedRates.ts`.
    expect(rate?.value).toBe(45150);
    // And explicitly not the family's figure, which is the pre-July-2025 rate.
    // Six days at each: ₪2,709 against the ₪2,508 the tab pays.
    expect(rate?.value).not.toBe(41800);
  });
});
