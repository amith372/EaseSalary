import { compareMonth, monthOf } from "@/lib/dates";
import { parseShekels } from "@/lib/money";
import type { YearMonth } from "@/lib/types";
import type { WorkerTerms } from "./types";

/**
 * The base monthly salary over time (specs.md item 3).
 *
 * **A change of salary takes effect from a month the user names, and the months
 * before it keep the salary they were calculated with** (the user, 2026-09-13).
 * That is what a raise is: agreed from some month on, and never a restatement of
 * months already paid. So the profile holds the salary the employment opened
 * with and a dated list of changes after it, and every month reads the one in
 * force during it — the same shape, and the same reasoning, as the dated rates
 * table (item 4), applied to a figure the family sets rather than the state.
 *
 * A single figure could not do it. A month the store has no record of is opened
 * from the profile when its first mark arrives, so a raise from September would
 * reach a June nobody had opened yet and value it at September's salary.
 */

/** One change of the base salary: the amount, from the first of that month. */
export interface SalaryChange {
  from: YearMonth;
  agorot: number;
}

type SalaryTerms = Pick<WorkerTerms, "baseMonthlySalaryAgorot" | "salaryChanges">;

/**
 * The base salary in force during a month: the latest change dated on or before
 * it, or the salary the employment opened with where no change is.
 */
export function salaryFor(terms: SalaryTerms, month: YearMonth): number {
  let salary = terms.baseMonthlySalaryAgorot;
  let latest: YearMonth | null = null;
  for (const change of terms.salaryChanges ?? []) {
    if (compareMonth(change.from, month) > 0) continue;
    if (latest === null || compareMonth(change.from, latest) >= 0) {
      latest = change.from;
      salary = change.agorot;
    }
  }
  return salary;
}

/**
 * The list with this change in it. A second change from the same month replaces
 * the first rather than standing beside it: two salaries from one month is a
 * correction of a figure, not two figures.
 */
export function withSalaryChange(
  changes: readonly SalaryChange[] | undefined,
  change: SalaryChange,
): SalaryChange[] {
  return [
    ...(changes ?? []).filter((one) => compareMonth(one.from, change.from) !== 0),
    change,
  ].sort((a, b) => compareMonth(a.from, b.from));
}

export type SalaryChangeRefusal =
  /** Not an amount, or zero. */
  | "salary"
  /** Below the minimum wage (item 3). */
  | "belowMinimum"
  /** Not a month, or a month before the employment began. */
  | "salaryFrom";

/**
 * What the user typed, read and checked.
 *
 * **The floor is the minimum wage in force in the month the change starts**,
 * because that is the month that will pay it, and never today's: a raise
 * recorded late for 2025 is checked against 2025's minimum, or a correct
 * historical figure would be refused for a law that came after it. A salary a
 * later minimum overtakes is item 3's other case — the month is floored when it
 * is confirmed and the family is told, not refused here. Where the table has no
 * row that early, today's minimum is the floor, and with neither the salary is
 * refused as uncheckable rather than accepted against nothing.
 */
export function reviewSalaryChange(
  amountText: string,
  from: YearMonth | null,
  employedSince: WorkerTerms["employedSince"],
  minimumAgorot: { atFrom: number | null; now: number | null },
): { ok: true; change: SalaryChange } | { ok: false; reason: SalaryChangeRefusal } {
  if (from === null || compareMonth(from, monthOf(employedSince)) < 0) {
    return { ok: false, reason: "salaryFrom" };
  }

  const agorot = parseShekels(amountText);
  if (agorot === null || agorot === 0) return { ok: false, reason: "salary" };

  const floor = minimumAgorot.atFrom ?? minimumAgorot.now;
  if (floor === null || agorot < floor) {
    return { ok: false, reason: "belowMinimum" };
  }

  return { ok: true, change: { from, agorot } };
}
