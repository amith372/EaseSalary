/**
 * The income-tax brackets, held per tax year (specs.md Part 1 item 17,
 * build_plan.md stage 3, approved 2026-09-10).
 *
 * **Keyed by the tax year and not by an effective date**, which is the one
 * place this table differs from `datedRates.ts` and is not an inconsistency:
 * the minimum wage steps in April and the recuperation rate in July, so both
 * need a date, while a bracket table *is* a tax year by definition — the
 * statute states it for a year, the income it applies to is a year's income,
 * and a month is taxed by the table for the year it falls in. Keying it by a
 * date would invite a table that took effect in the middle of a tax year, which
 * is a thing that does not exist.
 *
 * **The bounds are annual, because the statute's are.** The source page says it
 * in so many words — מדרגות המס מחושבות על בסיס הכנסה שנתית בלבד — and prints a
 * monthly column marked לצורך המחשה בלבד, which is the annual figure divided by
 * twelve. So the annual bound is what is stored and the monthly one is derived,
 * for the same reason item 3 derives every rate it can rather than storing a
 * second copy that can disagree.
 *
 * **It is seeded and a fetch updates it**, exactly as the dated-rates table is:
 * the application taxes a month correctly before any fetch has run, and a
 * failed fetch leaves the seeded table standing rather than nothing (Part 3).
 */

/**
 * One bracket: everything up to `upToAnnualAgorot` is taxed at `rate`.
 *
 * `null` is the top bracket, which has no upper bound. Writing it as `null`
 * rather than as a very large number is what keeps the table honest — a
 * sentinel would be a figure nobody could cite to the statute.
 */
export interface TaxBracket {
  /** Annual, integer agorot, and inclusive: the 2026 table's first bracket runs
   * to ₪84,120 a year and ₪84,120 is inside it. */
  upToAnnualAgorot: number | null;
  /**
   * A fraction of the income in the bracket — 0.1, not 10 — which is the unit
   * `nationalInsurance` already uses in the dated-rates table. Carried at full
   * precision and rounded only where it produces an amount.
   */
  rate: number;
}

/** One tax year's table, and where it was read. */
export interface TaxYearBrackets {
  /** The calendar year the table applies to. */
  year: number;
  /**
   * Ordered from the lowest bracket up, with the unbounded one last. The order
   * is what the calculation walks, so it is part of the value rather than
   * something a caller sorts: a table out of order would tax the top slice at
   * the bottom rate and produce a figure that looks entirely ordinary.
   */
  brackets: TaxBracket[];
  /** The address the table was read from, or the page and table a seeded one
   * was taken out of (Part 3). */
  source: string;
}

const BRACKETS_PAGE = "https://www.kolzchut.org.il/he/מדרגות_מס_הכנסה";
const PAST_BRACKETS_PAGE =
  "https://www.kolzchut.org.il/he/מדרגות_מס_הכנסה_-_נתוני_עבר";

/**
 * What the application ships knowing.
 *
 * **Two years, and both are tables for income מיגיעה אישית** — income from a
 * person's own work, which a salary is. The same pages print a second table for
 * income that is not, whose first bracket is 31% rather than 10%, and reading
 * that one would tax a caregiver at three times the right rate on her first
 * shekel. It is the trap this source carries, and it is why the parser finds
 * its table by the heading above it rather than by taking the first one on the
 * page.
 *
 * **2025 and 2026 differ only above ₪120,720 a year**, which is far above
 * anything this application will ever calculate. They are both here anyway,
 * because a month is valued at the figures in force during it (criterion 4) and
 * "close enough for our salaries" is the reasoning that leaves the wrong table
 * in place the year it stops being close enough.
 */
export const SEEDED_TAX_BRACKETS: TaxYearBrackets[] = [
  {
    year: 2025,
    source: PAST_BRACKETS_PAGE,
    brackets: [
      { upToAnnualAgorot: 8412000, rate: 0.1 },
      { upToAnnualAgorot: 12072000, rate: 0.14 },
      { upToAnnualAgorot: 19380000, rate: 0.2 },
      { upToAnnualAgorot: 26928000, rate: 0.31 },
      { upToAnnualAgorot: 56028000, rate: 0.35 },
      { upToAnnualAgorot: 72156000, rate: 0.47 },
      { upToAnnualAgorot: null, rate: 0.5 },
    ],
  },
  {
    year: 2026,
    source: BRACKETS_PAGE,
    brackets: [
      { upToAnnualAgorot: 8412000, rate: 0.1 },
      { upToAnnualAgorot: 12072000, rate: 0.14 },
      { upToAnnualAgorot: 22800000, rate: 0.2 },
      { upToAnnualAgorot: 30120000, rate: 0.31 },
      { upToAnnualAgorot: 56028000, rate: 0.35 },
      { upToAnnualAgorot: 72156000, rate: 0.47 },
      { upToAnnualAgorot: null, rate: 0.5 },
    ],
  },
];

/**
 * The table for one tax year, or `null` where none is held.
 *
 * **`null` is an answer and not a failure**, exactly as `rateInForce`'s is: a
 * year the application has no table for has no tax it can honestly work out,
 * and reaching for the nearest year would be the undated guess this table
 * exists to remove — brackets are restated every January, so the nearest year
 * is precisely the wrong one. The caller says what to do with it, and what the
 * month does is leave the line at what it holds and say why.
 */
export function bracketsForYear(
  tables: TaxYearBrackets[],
  year: number,
): TaxYearBrackets | null {
  return tables.find((table) => table.year === year) ?? null;
}

/**
 * The table with a fetched year's brackets in it, replacing any held for the
 * same year rather than appended beside it.
 *
 * The same shape `withFetchedRate` and `withFetchedList` already have, and for
 * the same reason: two tables for one year would make "the brackets for 2026"
 * ambiguous, and which of the two answered would depend on the order rows came
 * back in.
 */
export function withFetchedBrackets(
  tables: TaxYearBrackets[],
  fetched: TaxYearBrackets,
): TaxYearBrackets[] {
  return [
    ...tables.filter((table) => table.year !== fetched.year),
    fetched,
  ].sort((a, b) => a.year - b.year);
}
