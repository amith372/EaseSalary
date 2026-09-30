import type { LineOverride } from "@/lib/engine/types";
import type {
  ClosingBlock,
  ClosingLine,
  Explanation,
  LineSource,
  MonthLine,
  SheetColumn,
  YearMonth,
} from "@/lib/types";

/**
 * Explanation keys, stable from this commit so another screen can address one
 * figure without re-deriving it (specs.md item 24). An override replaces the
 * amount and sets `manual` without touching the key, so a manual figure is
 * still addressable and still says what it would otherwise have been (item 17).
 *
 * `sickDeduction` is emitted below, and `src/lib/engine/sick.ts` owns the
 * statutory tiers behind it: this file asks that module how many days the month
 * deducts and prices them, and restates none of the rule.
 *
 * **These are stored values as well as identifiers, and the string is the part
 * that is stored.** `MonthFacts.overrides` is keyed by them (item 17), so a key
 * that moves orphans the amount a user typed by hand and the line silently
 * reverts to the calculated figure — the one failure in this file that looks
 * like nothing went wrong. **A key never moves**: renaming one would mean
 * reading the old key alongside the new and rewriting every stored `overrides`
 * map on the way past, month by month.
 */
export const lineKeys = {
  base: "base",
  restEveSupplement: "restEveSupplement",
  restDays: "restDays",
  holidaysWorked: "holidaysWorked",
  sickDeduction: "sickDeduction",
  recuperation: "recuperation",
  hospitalOvertime: "hospitalOvertime",
  incomeTax: "incomeTax",
} as const;

/**
 * A line before it is rounded, and the one place a rate becomes an amount.
 *
 * `units * rate` is the amount, always: the base salary is one month at the
 * monthly rate, never 26 days at it. Writing a draft this way is what keeps the
 * invariant true by construction rather than by everyone remembering it — and
 * keeping the draft and its rounding in one file is what keeps it true across
 * the modules that build lines, of which there are several.
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
  /**
   * Whether the user may replace this line's amount by hand (specs.md item 17).
   *
   * **It is declared by whoever builds the draft and is never a list of keys
   * kept somewhere else.** An override replaces a figure the application
   * *worked out*; a row that carries an amount the month itself recorded — a
   * line the user added to this month, a payment to a third party — has nothing
   * under it to replace, and is corrected by editing the entry instead. Which
   * of the two a draft is, is known where the draft is made and nowhere else,
   * so a screen or an action asking "may this be overridden" reads the answer
   * off the line rather than testing its key against a whitelist that would
   * silently stop covering the next row the engine grows.
   *
   * **Absent means no**, which is the safe direction: a row added later is not
   * overridable until someone says it is, where the opposite default would let
   * a new row quietly acquire a control nobody designed for it.
   */
  overridable?: boolean;
  /** Absent means the engine worked the figure out. */
  source?: LineSource;
  explanation: Explanation;
}

/**
 * An override replaces the amount and sets `manual` without touching the key,
 * so a manual figure is still addressable and still says what it would
 * otherwise have been (specs.md items 17, 24). The units and the rate stay as
 * the engine worked them out, and `calculatedAmount` carries the figure they
 * came to, so the control that offered the override can show what it replaced
 * without multiplying anything itself.
 *
 * **The override is a magnitude and the sign comes from the line** (item 17).
 * `units` is where a draft carries its sign — the sickness deduction is one
 * withheld unit at a positive price, and so is a user's deduction placed before
 * the total — so the sign is read from there and applied to whatever the user
 * typed. Taken verbatim instead, an override typed over the sickness deduction
 * would turn a deduction into a payment while looking like an ordinary
 * correction, and `parseShekels` refuses a minus precisely so that the user
 * never has the option of disagreeing with the label beside their figure.
 */
export function toLine(
  draft: LineDraft,
  overrides: Record<string, LineOverride>,
): MonthLine {
  const override = overrides[draft.key];
  // The one rounding in the whole calculation: a rate carries its fraction up
  // to here and the amount is integer agorot from here on (item 3).
  const calculated = Math.round(draft.units * draft.rate);
  const sign = draft.units < 0 ? -1 : 1;
  return {
    key: draft.key,
    label: draft.label,
    source: draft.source ?? "engine",
    units: draft.units,
    rate: draft.rate,
    column: draft.column,
    ...(draft.coversMonths ? { coversMonths: draft.coversMonths } : {}),
    // `|| 0` is not decoration: `-1 * 0` is -0, which `Object.is` — and so
    // `toBe` — reports as different from 0.
    amount: override ? sign * Math.abs(override.agorot) || 0 : calculated,
    manual: override !== undefined,
    ...(override ? { calculatedAmount: calculated } : {}),
    overridable: draft.overridable === true,
    explanation: draft.explanation,
  };
}

/**
 * A row of the block below the columns before it is rounded — the closing
 * block's `LineDraft`. It has no units and no rate: its figure is an amount,
 * and the sign is what the row is (withheld, repaid, a deduction) rather than
 * anything the amount says.
 */
export interface ClosingDraft {
  key: string;
  label: string;
  source: LineSource;
  /** The figure the month arrives at, as a magnitude; `sign` places it. */
  agorot: number;
  sign: 1 | -1;
  block: ClosingBlock;
  /** Absent means no, as on a `LineDraft`. */
  overridable?: boolean;
  explanation: Explanation;
}

/**
 * `toLine` for the closing block, and the same three rules: rounded once, an
 * override is a magnitude signed by the row (item 17), and a replaced row
 * still carries what it came to as `calculatedAmount`.
 */
export function toClosingLine(
  draft: ClosingDraft,
  overrides: Record<string, LineOverride>,
): ClosingLine {
  const override = overrides[draft.key];
  // `|| 0` for the reason `toLine` gives: a negated zero is -0.
  const signed = (agorot: number) =>
    draft.sign * Math.round(Math.abs(agorot)) || 0;
  const calculated = signed(draft.agorot);
  return {
    key: draft.key,
    label: draft.label,
    source: draft.source,
    amount: override ? signed(override.agorot) : calculated,
    manual: override !== undefined,
    ...(override ? { calculatedAmount: calculated } : {}),
    overridable: draft.overridable === true,
    block: draft.block,
    explanation: draft.explanation,
  };
}
