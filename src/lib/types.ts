import type { LegalLinkKey } from "@/lib/links";

/**
 * A calendar date with no time zone attached — "2026-08-16". The whole
 * application holds dates this way and converts to a Date only through
 * `src/lib/dates.ts`, which builds in UTC: a date constructed in local time can
 * shift by a day across a daylight-saving boundary and silently change how many
 * Saturdays a month has (specs.md Part 5).
 */
export type IsoDate = string;

/** `month` is 1-12, not the 0-11 a JavaScript Date uses. */
export interface YearMonth {
  year: number;
  month: number;
}

/**
 * What the user can mark on a day. `freeSaturday` is the Saturday the worker
 * had off — not an entitlement, and a month without one is unremarkable
 * (specs.md item 5), which is why it is a mark of its own rather than the
 * absence of one.
 */
export type MarkKind = "vacation" | "sick" | "holiday" | "freeSaturday";

/**
 * A run of days carrying one mark. A single marked day is a span whose `from`
 * and `to` are equal — this is the storage shape, not a convenience over
 * per-day marks, because a spell of sickness is counted from its own first day
 * through to its last across a month boundary and cannot be expressed as marks
 * belonging to a month (specs.md Part 3, item 8).
 */
export interface DaySpan {
  id: string;
  kind: MarkKind;
  from: IsoDate;
  to: IsoDate;
  /** Every action can carry a free-text note (specs.md item 5). */
  note?: string;
  /**
   * Vacation and holiday may be taken as part of a day and are drawn from the
   * balance in that proportion (items 7, 10). A part-day is a single-day span,
   * so this is set only where `from` and `to` are equal.
   */
  fraction?: number;
}

/** Whether the worker worked a marked holiday decides whether it is paid a
 * premium, so "holiday" is never recorded without saying (specs.md Part 5). */
export interface HolidaySpan extends DaySpan {
  kind: "holiday";
  worked: boolean;
}

/**
 * How a figure was reached, in words rather than as a formula, so a user who
 * wants to follow the reasoning can and a user who does not never has to read
 * arithmetic (specs.md item 24). Every computed figure carries one from the
 * engine's first commit: an explanation retrofitted later has to be rebuilt out
 * of intermediate reasoning the calculation has already thrown away.
 */
export interface Explanation {
  text: string;
  /** The rule the figure rests on, resolved through `src/lib/links.ts`. */
  link?: LegalLinkKey;
}

/**
 * Which column of the month tab the amount belongs in. The columns are not
 * interchangeable and only three of them reach the worker: E the monthly salary
 * items, F the pay for Saturdays and holidays, G the one-off payments. H holds
 * money paid to third parties and is deliberately excluded from the month's
 * total (specs.md Part 5, item 16).
 */
export type SheetColumn = "E" | "F" | "G" | "H";

/**
 * One line of the month. `amount` is integer agorot — never floating-point
 * shekels — and is `null` until the engine has supplied it, which is what lets
 * a fixture stand in for a calculation without inventing a figure.
 */
export interface MonthLine {
  key: string;
  label: string;
  /** A secondary line under the label: "[מספר] ימים שסומנו". */
  hint?: string;
  amount: number | null;
  /** The payslip shows every payment as its type, its units and its amount
   * (specs.md item 2). */
  units?: number | null;
  column: SheetColumn;
  /** An overridden amount is visibly marked as manual and survives every later
   * recalculation of that month (specs.md item 17). */
  manual: boolean;
  explanation: Explanation;
}

export type BalanceKind = "vacation" | "sick";

/**
 * Days are carried as a plain number at full precision and rounded only for
 * display. The workbook's balances tab writes the monthly vacation accrual as
 * 1.17 in some months and as fourteen twelfths in others; using the fraction
 * throughout is what keeps a balance from drifting a hundredth of a day a year
 * (specs.md Part 5).
 */
export interface BalanceLine {
  kind: BalanceKind;
  opening: number | null;
  accrued: number | null;
  used: number | null;
  closing: number | null;
  explanation: Explanation;
}

/**
 * What the engine returns for one month. One calculation path serves both the
 * on-screen preview and the export, so this is the shape the .xlsx filler reads
 * as well (specs.md Part 3).
 */
export interface MonthResult {
  month: YearMonth;
  /**
   * The month's days less its Saturdays. Nothing the worker takes reduces it —
   * neither vacation nor sickness — and the salary is calculated from it
   * (specs.md item 5).
   */
  standardDays: number | null;
  /** The standard count less the days she did not in fact work. Read, not paid
   * from. */
  actualDays: number | null;
  lines: MonthLine[];
  /** Columns E, F and G alone. Adding H would overpay the worker. */
  totalToWorker: number | null;
  balances: BalanceLine[];
}

export interface Worker {
  id: string;
  /** Written in Hebrew only; a Latin transliteration beside it would break a
   * line of Hebrew with a run in another script (specs.md Part 3). */
  name: string;
  /** The first name alone, for "לדף של [שם]". */
  firstName: string;
}

/** A thing on the opening screen that needs the user to do something
 * (specs.md item 26). */
export interface HomeAlert {
  key: string;
  title: string;
  note: string;
  action: string;
  link?: LegalLinkKey;
}
