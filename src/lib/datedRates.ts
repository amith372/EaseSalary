import { compareIsoDate, isoOf } from "@/lib/dates";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * The rates the application cannot derive, each held with the date it took
 * effect, so a month is valued at the figure in force during it and never at
 * today's (specs.md item 4, Part 3).
 *
 * **What belongs here is the short list of figures the application takes from
 * outside itself**, and nothing else. Item 3 requires every rate that *can* be
 * derived from the base monthly salary to be derived — the daily rate and the
 * rest-day rate are computed in `engine/rates.ts` and adding either to this
 * table would be a second, stored answer that drifts from the first the day
 * the engine is corrected.
 *
 * **A rate written into the code as a bare number has no date, and that is not
 * a hypothetical failure.** It is exactly how the family's own workbook went
 * wrong twice: the vacation-day rate stayed at its 2024 figure, and the
 * national-insurance line stayed at 2% after the rate rose to 3.6% (Part 5).
 * A month calculated after such a change is valued at today's figure and a
 * month calculated before it at yesterday's, with nothing in either month to
 * say which happened — so reproducing history as history, which criterion 13
 * rests on, is impossible without the dates.
 *
 * **It is seeded and a fetch updates it**, so the application works before any
 * fetch has ever succeeded and a failed one leaves a dated figure standing
 * rather than nothing (Part 3). A seeded figure has an effective date as
 * surely as a fetched one.
 */

/**
 * The rates the table holds. The list is the source and the union is derived
 * from it, as `advanceKinds` and `userLineDirections` already are: a key added
 * to a hand-kept union would compile clean against a hand-kept array that had
 * not grown with it.
 */
export const rateKeys = ["minimumWage", "nationalInsurance"] as const;

export type RateKey = (typeof rateKeys)[number];

/**
 * One figure, from one date, from one source.
 *
 * **`value` is read in the unit its key names, and the two keys do not share
 * one.** `minimumWage` is integer agorot, as every money figure in this
 * application is; `nationalInsurance` is a fraction of the month's gross —
 * 0.036, not 3.6. There is no unit field, because a unit that travels as data
 * is a unit a caller can get wrong at run time; the key is the unit, and each
 * call site names its key.
 */
export interface DatedRate {
  key: RateKey;
  /** Agorot for `minimumWage`, a fraction for `nationalInsurance`. */
  value: number;
  /**
   * The official date of application — the תאריך תחולה the statute or the
   * ministry's notice states, which is always the first of a month.
   *
   * **A rise decided mid-month is expressed as an earlier date and never as a
   * mid-month one**: an increase ordinarily applies from the first of the
   * month after it was published, and where it applies retroactively the
   * notice says so by naming an earlier first-of-month. So the date stored
   * here is the whole of the rule, and `rateInForce` needs no second one for
   * the case of a rate that changed in the middle of a month.
   */
  effectiveFrom: IsoDate;
  /** Where the figure came from: the address of the page it was fetched from,
   * or the workbook, tab and cell a seeded one was read out of (Part 3). */
  source: string;
}

/**
 * The figure in force during a month, or `null` where the table begins after
 * it.
 *
 * **In force at the month's first day**, which is the whole of the rule given
 * the effective dates the table holds: every one of them is a first of month,
 * so a month either opened under a row or it did not.
 *
 * **`null` is an answer and not a failure.** A month earlier than anything the
 * table knows has no figure the application can honestly offer, and inventing
 * one by reaching for the earliest row would be the same undated guess this
 * table exists to remove. What the caller does with it is the caller's: the
 * national-insurance estimate is a reporting figure and simply goes empty
 * (item 19), while a rate a payment depends on would refuse the month.
 */
export function rateInForce(
  rates: DatedRate[],
  key: RateKey,
  month: YearMonth,
): DatedRate | null {
  const firstDay = isoOf(month, 1);
  const candidates = rates
    .filter(
      (rate) =>
        rate.key === key && compareIsoDate(rate.effectiveFrom, firstDay) <= 0,
    )
    .sort((a, b) => compareIsoDate(a.effectiveFrom, b.effectiveFrom));
  return candidates[candidates.length - 1] ?? null;
}

/**
 * What the application ships knowing, before any fetch has run.
 *
 * **Three rows and no more.** Every figure here is one this repository can
 * cite: two minimum wages read out of the committed workbooks, and the
 * national-insurance percentage. Nothing is seeded from memory — a figure with
 * a date nobody can check is worse than an absent row, because an absent row
 * comes back as `null` and says so.
 *
 * **The wage rises in April and not in January**, which is why a table keyed by
 * calendar year would get March 2026 wrong: it is still valued at the 2025
 * figure. That is the case this whole mechanism exists for, and the workbook
 * shows it plainly — `חודש  3.26` pays 6,247.65 and `חודש  4.26` pays 6,443.85.
 */
export const SEEDED_RATES: DatedRate[] = [
  {
    key: "minimumWage",
    value: 624765,
    effectiveFrom: "2025-04-01",
    source: "שכר_חודשי_להאנה2025.xlsx → חודש  4.25 → D6",
  },
  {
    key: "minimumWage",
    value: 644385,
    effectiveFrom: "2026-04-01",
    source: "שכר_חודשי_להאנה2026.xlsx → חודש  4.26 → D6",
  },
  {
    key: "nationalInsurance",
    // 3.6% of the month's gross (specs.md item 19). The workbook's own D21 was
    // still at 2% of the 2024 wage when this was written, which is the stale
    // line Part 5 records and the reason this row carries a date at all.
    value: 0.036,
    effectiveFrom: "2025-01-01",
    source: "https://www.kolzchut.org.il/he/דיווח_ותשלום_דמי_ביטוח_לאומי_עבור_עובד_זר_בסיעוד",
  },
];

/**
 * The table with a fetched row written into it (Part 3: the table is seeded and
 * a fetch updates it).
 *
 * **A row is addressed by its key and its effective date together**, which is
 * the whole of the rule. Fetching the same page twice must not append the same
 * row twice, and a source that corrects a figure it already published must move
 * that figure rather than leave two rows claiming the same date — `rateInForce`
 * would then answer with whichever the sort left last, which is a coin toss
 * dressed as a lookup.
 *
 * **It returns a new table and mutates nothing.** `SEEDED_RATES` is a module-level
 * array reached by every caller that did not hand the engine a table of its own,
 * so a merge that pushed into it would make one request's fetch visible to the
 * next request's calculation.
 *
 * **Nothing here persists.** There is no store for the table yet and no consumer
 * that needs one: this is the writing-into-the-table half of the fetch, kept as
 * a function over a value so it can be tested without one. `SalaryRepository`
 * gains its methods with the screen that has to show a fetched figure.
 */
export function withFetchedRate(
  rates: DatedRate[],
  fetched: DatedRate,
): DatedRate[] {
  const others = rates.filter(
    (rate) =>
      !(rate.key === fetched.key && rate.effectiveFrom === fetched.effectiveFrom),
  );
  return [...others, fetched];
}
