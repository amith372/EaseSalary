/**
 * Every rate the application pays at, derived from the worker's base monthly
 * salary and never stored as a constant, so changing the salary changes all of
 * them (specs.md item 3). Nothing else in the engine may hold a rate.
 *
 * **The precision rule, and it is where a systematic error hides.** Money is
 * integer agorot everywhere in the application (CLAUDE.md), but a *rate* is not
 * money: it is a `number` of agorot that may carry a fraction, and it is never
 * rounded. Rounding happens exactly once, with `Math.round`, at the moment a
 * rate becomes a line's amount — full precision is carried through the
 * calculation and rounded only at the end, never between steps (item 3). The
 * rest-day rate for a salary of ₪6,247.65 is 42,635.0620879… agorot and stays
 * that way through six days; only the product, 255,810.372…, is rounded.
 */

/**
 * A sick day is worth the monthly salary over twenty-five (specs.md item 8),
 * and the future-features appendix records that a vacation balance settled at
 * the end of an employment is valued at the same divisor — so it is decided here
 * once and not a second time when that is built. These are divisors from the
 * rule, not rates standing in for a figure the salary should have supplied.
 *
 * **The numerator is the salary alone and the rest-eve supplement is not in
 * it.** The sick-pay statute names a closed list of what enters the regular
 * wage and an agreed weekly supplement is none of it (item 8), which is why
 * `dailyRate` takes the base salary and not the month's column E. It is the
 * change this function most invites and it would be wrong.
 */
const SICK_DAY_DIVISOR = 25;

/** The monthly hours a salary is spread over (specs.md Part 5, "the same salary
 * divided by 182"). */
const MONTHLY_HOURS = 182;

/** Work in the weekly rest day and on a holiday is paid at 150% (Part 5). */
const REST_DAY_PREMIUM = 1.5;

/** The monthly salary over twenty-five (specs.md item 8). */
export function dailyRate(baseMonthlySalaryAgorot: number): number {
  return baseMonthlySalaryAgorot / SICK_DAY_DIVISOR;
}

/** The same salary over 182 (specs.md Part 5). Nothing is paid by the hour;
 * this exists because it is one half of the rest-day formula below, and naming
 * it is what lets that formula read the way Part 5 states it. */
export function hourlyRate(baseMonthlySalaryAgorot: number): number {
  return baseMonthlySalaryAgorot / MONTHLY_HOURS;
}

/**
 * One day **plus one hour** at 150%.
 *
 * The rest day of a live-in caregiver is twenty-five hours, not twenty-four, so
 * a plain 150% of the daily rate is short by roughly fifty shekels a day and
 * would quietly underpay every Saturday of the year (specs.md Part 5).
 */
export function restDayRate(baseMonthlySalaryAgorot: number): number {
  return (
    (dailyRate(baseMonthlySalaryAgorot) + hourlyRate(baseMonthlySalaryAgorot)) *
    REST_DAY_PREMIUM
  );
}

/**
 * Two rates, and there is no third.
 *
 * There is no vacation-day rate because there is no vacation payment at all:
 * the base is computed from the standard count and never shrinks, so a vacation
 * line beside it would pay the day a second time. Vacation reaches the sheet as
 * two figures only — the days used in the month and the balance left after them
 * (specs.md items 3 and 7). A third rate appearing in this type later is that
 * double payment coming back, not a feature.
 */
export interface Rates {
  /** What a sick day is worth. Fractional; never rounded here. */
  daily: number;
  /** What a Saturday worked and a holiday worked are paid at. */
  restDay: number;
}

export function deriveRates(baseMonthlySalaryAgorot: number): Rates {
  return {
    daily: dailyRate(baseMonthlySalaryAgorot),
    restDay: restDayRate(baseMonthlySalaryAgorot),
  };
}
