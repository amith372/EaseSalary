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

/**
 * The rate held against the two authorities that publish it worked out, rather
 * than against `specs.md`.
 *
 * These are the only figures in this suite that come from outside the project
 * entirely: both documents state a finished shekel amount for a named monthly
 * salary, so neither can have been derived from this code. They are six years
 * and two minimum wages apart, which is what makes them worth asserting
 * together — a formula that happens to fit one wage cannot fit both by
 * accident.
 *
 * Read 2026-10-07. The sources are kept in `.sources/README.txt`, which also
 * holds their URLs.
 */
describe("the rest-day rate against the published figures", () => {
  /** ₪5,300 — the minimum wage the 2020 document works its example at. */
  const WAGE_2020 = 530000;
  /** ₪6,443.85 — the minimum wage in force when Kol Zchut was read. */
  const WAGE_2026 = 644385;

  // The Commissioner for Foreign Workers' Rights, תשלום בגין עבודה בימי חג,
  // September 2020, publishes the whole derivation and not only its total:
  // "ערך יום עבודה רגיל של העובד (השכר החודשי חלקי 25) עומד על 212 ₪ ליום",
  // the 150% day is "318 ₪", the twenty-fifth hour adds "43.68 ₪", and the
  // worker is owed "361.68 ₪". Asserting the three parts and not just the sum
  // is what catches a formula that reaches the right total by a wrong route.
  it("matches all three published components at ₪5,300 (gov.il, 09/2020)", () => {
    expect(Math.round(dailyRate(WAGE_2020))).toBe(21200);
    expect(Math.round(dailyRate(WAGE_2020) * 1.5)).toBe(31800);
    expect(Math.round(hourlyRate(WAGE_2020) * 1.5)).toBe(4368);
    expect(Math.round(restDayRate(WAGE_2020))).toBe(36168);
  });

  // Kol Zchut, תנאי העסקה של עובד זר בסיעוד המועסק בבית המטופל: "עובד
  // המשתכר שכר מינימום (6,443.85 ₪ לחודש) זכאי לתוספת בסך 439.73 ₪ עבור יום
  // עבודה במנוחה השבועית."
  //
  // **The published figure is truncated, not rounded, and the agora of
  // difference is theirs.** The rate works out to ₪439.7397: Kol Zchut prints
  // 439.73, this application rounds to the nearest agora (439.74) because
  // every money figure here does. Asserting the published 43973 outright would
  // encode their truncation as this engine's rule, so the assertion is that
  // the two agree to within one agora — which is the strongest claim the
  // source actually supports.
  it("matches the published ₪439.73 at ₪6,443.85 to the agora (Kol Zchut)", () => {
    const published = 43973;
    expect(Math.abs(Math.round(restDayRate(WAGE_2026)) - published)).toBeLessThanOrEqual(1);
  });

  // The same two documents, used the other way round: whatever the wage, the
  // naive reading underpays. 2020's own sentence is the evidence — a plain
  // 150% of 212 is 318, and the worker is owed 361.68.
  it("is never a plain 150% of the daily rate, at either wage", () => {
    for (const wage of [WAGE_2020, WAGE_2026]) {
      expect(restDayRate(wage)).toBeGreaterThan(dailyRate(wage) * 1.5);
    }
    expect(Math.round(restDayRate(WAGE_2020) - dailyRate(WAGE_2020) * 1.5)).toBe(4368);
  });
});
