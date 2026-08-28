import { describe, expect, it } from "vitest";
import {
  dailyRate,
  deriveRates,
  hourlyRate,
  restDayRate,
} from "@/lib/engine/rates";

/**
 * Every expected figure below comes from `specs.md` — Part 4 for a stated
 * amount, Part 5 or item 8 for a formula written out in the open — and never
 * from what `rates.ts` returned. Each test name cites its source, because a
 * passing test whose name cites nothing is a test whose figure came out of the
 * code it is meant to check (CLAUDE.md).
 */

/** The known case: the minimum wage of August 2025, ₪6,247.65 (Part 4). */
const AUGUST_2025_SALARY = 624765;

describe("the rest day and holiday rate", () => {
  it("is ₪426.35 for a ₪6,247.65 salary (specs.md Part 4)", () => {
    // Part 4 states the rate outright: "two holidays and four Saturdays at
    // ₪426.35". Rounded here only because a line amount is integer agorot; the
    // rate itself carries its fraction.
    expect(Math.round(deriveRates(AUGUST_2025_SALARY).restDay)).toBe(42635);
  });

  it("pays two holidays and four Saturdays ₪2,558.10 (specs.md Part 4)", () => {
    // Part 4's second total, and the one the precision rule is for: six units
    // of a fractional rate, rounded once at the end and not six times.
    expect(Math.round(deriveRates(AUGUST_2025_SALARY).restDay * 6)).toBe(255810);
  });

  it("is a day plus an hour at 150%, not 150% of a day (specs.md Part 5)", () => {
    // Part 5: the rest day of a live-in caregiver is twenty-five hours, not
    // twenty-four, and a plain 150% of the daily rate is "short by roughly
    // fifty shekels a day". That sentence is the expected figure here — the
    // bounds are what "roughly fifty" licenses, and the naive formula lands
    // ₪51.49 below, well inside them.
    const naive = dailyRate(AUGUST_2025_SALARY) * 1.5;
    const short = restDayRate(AUGUST_2025_SALARY) - naive;
    expect(short).toBeGreaterThan(4500);
    expect(short).toBeLessThan(5500);
  });
});

describe("the rates derived from the salary", () => {
  it("values a day at the monthly salary over twenty-five (specs.md item 8)", () => {
    // Item 8 supplies the formula and not a figure, so the quotient is written
    // out rather than quoted as a number.
    expect(dailyRate(AUGUST_2025_SALARY)).toBe(624765 / 25);
    expect(deriveRates(AUGUST_2025_SALARY).daily).toBe(624765 / 25);
  });

  it("values an hour at the same salary over 182 (specs.md Part 5)", () => {
    expect(hourlyRate(AUGUST_2025_SALARY)).toBe(624765 / 182);
  });

  it("carries a fraction and is never rounded (specs.md item 3)", () => {
    // Rates and totals are carried at full precision and rounded to two
    // decimals only at the end, never between steps. A `Math.round` slipped
    // into rates.ts later fails here rather than drifting a few agorot a year
    // somewhere further down.
    const rates = deriveRates(AUGUST_2025_SALARY);
    expect(Number.isInteger(rates.daily)).toBe(false);
    expect(Number.isInteger(rates.restDay)).toBe(false);
    expect(Number.isInteger(hourlyRate(AUGUST_2025_SALARY))).toBe(false);
  });

  it("follows the salary rather than standing as a constant (specs.md item 3)", () => {
    // "Computed from the worker's base monthly salary rather than stored as a
    // constant, so changing that salary changes both."
    const doubled = deriveRates(AUGUST_2025_SALARY * 2);
    expect(doubled.daily).toBe(dailyRate(AUGUST_2025_SALARY) * 2);
    expect(doubled.restDay).toBe(restDayRate(AUGUST_2025_SALARY) * 2);
  });

  it("has no vacation rate, and no third rate at all (specs.md items 3 and 7)", () => {
    // There is no vacation payment, so the 25 divisor exists for the sick-day
    // value alone. A third key appearing here is the double payment item 7
    // rules out, arriving as a "feature".
    expect(Object.keys(deriveRates(AUGUST_2025_SALARY)).sort()).toEqual([
      "daily",
      "restDay",
    ]);
  });
});
