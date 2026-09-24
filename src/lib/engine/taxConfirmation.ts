import { calculateSeries } from "@/lib/engine/series";
import { lineKeys } from "@/lib/engine/lines";
import { sameMonth } from "@/lib/dates";
import type { DatedRate } from "@/lib/datedRates";
import type {
  Employment,
  IncomeTaxSetting,
  MonthFacts,
  WorkerTerms,
} from "@/lib/engine/types";
import type { TaxYearBrackets } from "@/lib/taxBrackets";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * The income tax a month is about to be confirmed with (specs.md item 17: the
 * tax is confirmed before an export and stored with the month like the minimum
 * wage is).
 *
 * **It is one calculation with two readers**, which is the whole reason it is
 * here rather than inside the action: the screen puts the figure to the user
 * and the action stores it, and a screen that worked its own figure out would
 * agree today and drift the first time either was corrected — the family would
 * then confirm one number and file another, with nothing anywhere saying so
 * (`CLAUDE.md` rule 12).
 */
export interface TaxToConfirm {
  /** A positive magnitude; the closing block gives the row its sign. */
  agorot: number;
  /**
   * The setting the month will be confirmed under, read off the month the
   * engine valued — the profile's while the month is still a draft, and the
   * month's own snapshot once it has been confirmed (Part 3).
   */
  setting: IncomeTaxSetting;
  /**
   * The tax year the application holds no bracket table for, or `null`.
   *
   * **It is asked of this calculation and not of the month as it stands**,
   * because a month already carrying a confirmed figure raises no such warning
   * — that figure is exactly what a missing table is not needed for. Confirming
   * again works the tax out afresh, so the year's table is needed again, and a
   * screen reading the month's own warnings would fall silent precisely on the
   * re-export that is about to store a zero.
   */
  missingTableYear: number | null;
  /**
   * The amount the user has typed over this month's tax row, or `null` where
   * she has not (specs.md item 17).
   *
   * **It is what the sheet will print**, and the screen shows it rather than
   * the figure under it: a card saying ₪0.00 in front of a file that prints
   * ₪450 is the one thing a confirmation may not do. The derived figure is
   * still what is *stored* — an override replaces a calculated amount and
   * leaves it standing underneath — which is why both travel here.
   */
  manualAgorot: number | null;
}

/**
 * The month with whatever tax it already carries set aside, so the question is
 * asked again rather than answered from the last time it was asked.
 *
 * The override goes with the stored figure: an override still wins on the
 * sheet — it is left on the month and only the figure under it is refreshed —
 * but it must not stand in as the answer to "what does the application make of
 * this month now".
 */
function withTaxSetAside(facts: MonthFacts): MonthFacts {
  const { incomeTaxAgorot, ...rest } = facts;
  void incomeTaxAgorot;
  const overrides = { ...facts.overrides };
  delete overrides[lineKeys.incomeTax];
  return { ...rest, overrides };
}

/**
 * What confirming this month would store as its income tax, and what the screen
 * has to say about it beforehand. `null` for a month outside the worker's
 * series — before her first month, or after the current one.
 */
export function taxToConfirm(
  months: readonly MonthFacts[],
  worker: WorkerTerms & Employment,
  today: IsoDate,
  rates: DatedRate[],
  taxBrackets: TaxYearBrackets[],
  month: YearMonth,
): TaxToConfirm | null {
  const entry = calculateSeries(
    months.map((facts) =>
      sameMonth(facts.month, month) ? withTaxSetAside(facts) : facts,
    ),
    worker,
    today,
    rates,
    taxBrackets,
  ).find((one) => sameMonth(one.facts.month, month));
  if (entry === undefined) return null;

  const line = entry.result.closing.find((row) => row.key === lineKeys.incomeTax);
  const missing = entry.result.warnings.find(
    (warning) => warning.key === "taxBracketsMissing",
  );
  // Read from the month as it stands and not from the copy above, which is the
  // same month with its override taken off.
  const manual = months.find((facts) => sameMonth(facts.month, month))
    ?.overrides[lineKeys.incomeTax];
  return {
    agorot: Math.abs(line?.amount ?? 0),
    setting: entry.facts.terms.incomeTax,
    missingTableYear: missing === undefined ? null : month.year,
    manualAgorot: manual === undefined ? null : Math.abs(manual.agorot),
  };
}
