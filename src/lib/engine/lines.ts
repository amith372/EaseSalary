import type { LineOverride } from "@/lib/engine/types";
import type { Explanation, MonthLine, SheetColumn, YearMonth } from "@/lib/types";

/**
 * A line before it is rounded, and the one place a rate becomes an amount.
 *
 * `units * rate` is the amount, always: the base salary is one month at the
 * monthly rate, never 26 days at it. Writing a draft this way is what keeps the
 * invariant true by construction rather than by everyone remembering it — and
 * keeping the draft and its rounding in one file is what keeps it true across
 * the modules that build lines, which since Step 7 is more than one.
 *
 * **The precision rule.** A rate carries its fraction and is never rounded; a
 * line amount is integer agorot, rounded exactly once with `Math.round` at the
 * moment it becomes a `MonthLine.amount`. Nothing rounds between the two
 * (specs.md item 3). The totals are then sums of already-rounded line amounts,
 * which is what makes the sheet add up by eye.
 */
export interface LineDraft {
  key: string;
  label: string;
  units: number;
  /** The unit price — column D. Full precision, never rounded here. */
  rate: number;
  column: SheetColumn;
  /** The months this line's money is for, where that is not the month itself —
   * a quarterly national-insurance payment, an annual premium (specs.md
   * item 19). Structured rather than written into the label, for `Refusal`'s
   * reason: dates inside a Hebrew sentence are a mixed run a browser may
   * reorder (Part 5). */
  coversMonths?: YearMonth[];
  explanation: Explanation;
}

/**
 * An override replaces the amount and sets `manual` without touching the key,
 * so a manual figure is still addressable and still says what it would
 * otherwise have been (specs.md items 17, 24). The units and the rate stay as
 * the engine worked them out, which is what "says what it would otherwise have
 * been" means in practice.
 */
export function toLine(
  draft: LineDraft,
  overrides: Record<string, LineOverride>,
): MonthLine {
  const override = overrides[draft.key];
  return {
    key: draft.key,
    label: draft.label,
    units: draft.units,
    rate: draft.rate,
    column: draft.column,
    ...(draft.coversMonths ? { coversMonths: draft.coversMonths } : {}),
    // The one rounding in the whole calculation: a rate carries its fraction up
    // to here and the amount is integer agorot from here on (item 3).
    amount: override ? override.agorot : Math.round(draft.units * draft.rate),
    manual: override !== undefined,
    explanation: draft.explanation,
  };
}
