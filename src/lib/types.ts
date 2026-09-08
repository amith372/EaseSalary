import type { LegalLinkKey } from "@/lib/links";

/**
 * A calendar date with no time zone attached — "2026-08-16". The whole
 * application holds dates this way and converts to a Date only through
 * `src/lib/dates.ts`, which builds in UTC: a date constructed in local time can
 * shift by a day across a daylight-saving boundary and silently change how many
 * rest days a month has (specs.md Part 5).
 */
export type IsoDate = string;

/** `month` is 1-12, not the 0-11 a JavaScript Date uses. */
export interface YearMonth {
  year: number;
  month: number;
}

/**
 * What the user can mark on a day. `freeRestDay` is the weekly rest day the
 * worker had off — not an entitlement, and a month without one is unremarkable
 * (specs.md item 5), which is why it is a mark of its own rather than the
 * absence of one.
 *
 * **These four strings are stored span data, not identifiers, so no compiler
 * checks them.** `freeRestDay` was `freeSaturday` until the rest-day rename,
 * and the rename is landed here rather than deferred because there is no
 * database yet: stage 3 is what first writes a span to Postgres, so today the
 * change costs an edit and after stage 3 it costs a migration — an `update
 * spans set kind = 'freeRestDay' where kind = 'freeSaturday'` run against every
 * deployed database, ordered against the check constraint that names the
 * allowed kinds, with a reader that still understands the old value until the
 * last row is converted. That is the story, and the reason it is written down
 * rather than performed: **this is the last commit in which renaming a member
 * of this union is free.** Anything added to it after stage 3 is named once and
 * kept.
 */
export type MarkKind = "vacation" | "sick" | "freeRestDay";

/**
 * What a span on the calendar can be, which is **not** the same set.
 *
 * A holiday is a state the calendar draws and never a mark the user makes
 * (specs.md item 9): the year's dates are chosen in advance from the country's
 * candidate list, they arrive on the month already drawn, and the only thing the
 * month records about one is whether she worked it. Splitting the two unions is
 * what makes that a compile error rather than a convention — `applyMark` takes a
 * `MarkKind` and so cannot produce a holiday, and the picker that offers the
 * kinds is built from the same union it stores.
 *
 * The stored strings do not move: `"holiday"` is still what a holiday span
 * carries, so this is a change to which code may *write* one and not to any
 * value in the store.
 */
export type SpanKind = MarkKind | "holiday";

/**
 * A run of days carrying one mark. A single marked day is a span whose `from`
 * and `to` are equal — this is the storage shape, not a convenience over
 * per-day marks, because a spell of sickness is counted from its own first day
 * through to its last across a month boundary and cannot be expressed as marks
 * belonging to a month (specs.md Part 3, item 8).
 */
export interface DaySpan {
  id: string;
  kind: SpanKind;
  from: IsoDate;
  /**
   * `null` while the spell is still running.
   *
   * **A spell may be left open, and that is how one is normally recorded**
   * (specs.md item 8): on the day a worker falls ill nobody knows the day she
   * will return, so the application does not ask for one. An open spell is
   * never *crossed* by a month boundary — it simply has not ended — and it
   * stays one spell with one first day, which is what the tiers are counted
   * from. That is the whole reason the storage shape is a span and not a set of
   * per-day marks.
   *
   * Only sickness may be open. `MonthSpan` in `src/lib/engine/types.ts` is what
   * enforces it, narrowing this field back to a date for every other kind, the
   * same way it already makes a holiday without `worked` a compile error.
   *
   * **This is a change to a stored shape, so no compiler carries it** — it
   * joins `MarkKind` and the line keys above. The story is theirs: stage 3 is
   * what first writes a span to Postgres, so today the column is created
   * nullable and after stage 3 it would be an `alter column ... drop not null`
   * against every deployed database, with a reader that tolerates both until
   * the last row is migrated. Nothing has been stored yet, which is why the
   * shape settles here rather than later.
   */
  to: IsoDate | null;
  /** Every action can carry a free-text note (specs.md item 5). */
  note?: string;
  /**
   * Vacation and holiday may be taken as part of a day and are drawn from the
   * balance in that proportion (items 7, 10). A part-day is a single-day span,
   * so this is set only where `from` and `to` are equal.
   */
  fraction?: number;
}

/**
 * A span whose end is settled — every kind but an unfinished sick spell, and an
 * open spell once a month has resolved it to the last day it counts to.
 *
 * It is the shape almost everything works on: only storage, and the calendar
 * that draws straight from storage, ever meet an open one.
 */
export type ClosedDaySpan = DaySpan & { to: IsoDate };

/** Whether the worker worked a marked holiday decides whether it is paid a
 * premium, so "holiday" is never recorded without saying (specs.md Part 5). */
export interface HolidaySpan extends DaySpan {
  kind: "holiday";
  /** A holiday is one day or a run of them and is never open: the dates arrive
   * from the year's chosen list (specs.md item 9), so its end is always known. */
  to: IsoDate;
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
 * items, F the pay for rest days and holidays, G the one-off payments. H holds
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
  /**
   * The payslip shows every payment as its type, its units and its amount
   * (specs.md item 2), and `units × rate` must round to `amount` on every line.
   * That invariant is what keeps the units honest: the base salary is one
   * month at the monthly rate, not 26 days at it. The standard and actual day
   * counts are separate reporting figures on `MonthResult` and are never a
   * line's units.
   */
  units?: number | null;
  /**
   * The unit price — column D of the month tab. Carried at full precision and
   * never rounded, because it is a rate (specs.md item 3): only the amount it
   * produces is rounded. Reading it as a charge would invent payments in months
   * where nothing was paid (Part 5), so it is a price and never a total.
   */
  rate?: number | null;
  column: SheetColumn;
  /**
   * The months this line's money is for, where that is not the month the line
   * appears in. A national-insurance payment is made once a quarter and in
   * arrears, and the export carries the amount that was due together with the
   * months it covers (specs.md item 19); the family's workbook writes them into
   * the row's own label, in B21 of `שכר_חודשי_להאנה2025.xlsx` → `חודש  7.25`.
   *
   * Held beside the sentence rather than inside it, for the same reason
   * `Refusal.dates` are: a date written into a Hebrew paragraph is a mixed run
   * a browser may reorder, so the interface isolates it (specs.md Part 5).
   */
  coversMonths?: YearMonth[];
  /** An overridden amount is visibly marked as manual and survives every later
   * recalculation of that month (specs.md item 17). */
  manual: boolean;
  /**
   * What the engine worked out, present **only** where an override replaced it
   * (specs.md item 17).
   *
   * It is what lets the row still say what it would otherwise have been without
   * anything outside the engine multiplying `units` by `rate` and rounding the
   * result — a second copy of the one place the calculation rounds
   * (`lines.ts`), which would disagree with it the day either moved.
   */
  calculatedAmount?: number;
  /**
   * Whether the user may replace this amount by hand (specs.md item 17).
   *
   * **The engine says so and no screen decides it.** An override replaces a
   * figure the application worked out; a row carrying an amount the month
   * itself recorded is edited instead, because there is nothing under it to
   * replace. A screen testing keys for that would be the keyed whitelist this
   * file has been bitten by before — the next row the engine grows would fall
   * into whichever answer the `else` happened to give.
   */
  overridable: boolean;
  explanation: Explanation;
}

/**
 * One row of the block at the foot of the sheet, below the columns.
 *
 * The bottom of the month sheet is not a fixed layout: a month that grants an
 * advance carries a row adding it, a month that repays one carries a row
 * subtracting the instalment, and a month may carry several of both at once
 * (specs.md Part 5, item 20). It grows with the advances, so it is generated
 * rather than chosen from a fixed set of shapes — which is why it is a list of
 * its own and not a handful of optional fields on `MonthResult`.
 *
 * `amount` is signed: a row that adds to the total is positive, one that
 * subtracts is negative. The sign follows from what the row is, so it can never
 * disagree with the label beside it.
 */
export interface ClosingLine {
  key: string;
  label: string;
  amount: number | null;
  manual: boolean;
  /**
   * **No row of this block is overridable, so it carries no flag saying so**
   * (specs.md item 17). Every row here is an amount the month itself recorded
   * — the income tax, an advance movement, a one-off line the user placed after
   * the total — and those are corrected by editing the entry, because there is
   * nothing under them for an override to replace.
   *
   * The one row that would not be is a **standing** line placed after the
   * total, whose amount came from the profile. No standing line can exist yet:
   * `MonthTerms.standingLines` is empty in the seed and the profile screen that
   * would set one is `build_plan.md`'s unowned debt. A flag with one reachable
   * value is flexibility for a case that cannot arise, so it is added the day
   * the case can — and the override control reads `MonthResult.lines` alone
   * until then.
   */
  /** Which of the block's two halves the row belongs to, and with it which of
   * the two figures below it the row has already reached. */
  block: ClosingBlock;
  explanation: Explanation;
}

/**
 * Which half of the block below the columns a row sits in — and so which side
 * of the נטו it falls on (specs.md Part 5, items 17 and 20).
 *
 * `withholding` is what is taken **out of the ברוטו**: today the income-tax
 * line and nothing else. `transfer` is what only changes the sum handed over —
 * the advances, and a line the user added and placed after the total, which
 * item 20 says reaches neither the month's cost nor item 19's estimate.
 *
 * **It is decided here and not on a screen.** Which side a row falls on is a
 * rule about the row, so a screen that sorted the rows by their keys would be
 * the keyed whitelist this file has already been bitten by once: the next row
 * the block grows would land in whichever half the `else` happened to be.
 */
export type ClosingBlock = "withholding" | "transfer";

/**
 * A column's own total, as the month tab prints it.
 *
 * The sheet carries four total lines, not two: the monthly salary items come to
 * ₪6,747.65 and the rest days and holidays to ₪2,558.10 before the month's
 * total and the figure actually paid (specs.md criterion 1, Part 4). A subtotal
 * is emitted for every column the month has lines in, so a column with nothing
 * in it prints nothing rather than a zero.
 */
export interface ColumnSubtotal {
  column: SheetColumn;
  label: string;
  amount: number | null;
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
 * Something the user should know about a month that is nonetheless correct.
 *
 * A warning is the opposite of a `Refusal`: a refusal stops the calculation,
 * because a month that cannot be calculated correctly must never be calculated
 * wrongly in silence; a warning changes no figure and blocks nothing. The
 * seven-day vacation warning is the first of them, and it is worded as the law
 * asking for at least seven days a year rather than as the user having done
 * something wrong — item 7 says in so many words that the point is not pressed
 * further.
 */
export interface Warning {
  key: string;
  /** Hebrew. Any figure inside it is written by `formatDays`, so the sentence
   * the interface isolates is the sentence the engine produced. */
  message: string;
  /** The rule it rests on, resolved through `src/lib/links.ts`. */
  link?: LegalLinkKey;
}

/**
 * What the engine returns for one month. One calculation path serves both the
 * on-screen preview and the export, so this is the shape the .xlsx filler reads
 * as well (specs.md Part 3).
 */
export interface MonthResult {
  month: YearMonth;
  /**
   * The month's days less its rest days. Nothing the worker takes reduces it —
   * neither vacation nor sickness — and the salary is calculated from it
   * (specs.md item 5).
   */
  standardDays: number | null;
  /** The standard count less the days she did not in fact work. Read, not paid
   * from. */
  actualDays: number | null;
  lines: MonthLine[];
  /** One per column the month has lines in. Two of the sheet's four total lines
   * live here; `gross` and `net` are the other two. */
  subtotals: ColumnSubtotal[];
  /** The rows below the columns, generated from the month's advances and its
   * income-tax line. Each says which half of the block it is in. */
  closing: ClosingLine[];
  /**
   * Columns E, F and G alone — "the month's total" of specs.md Part 5, and
   * ₪9,305.75 in the August 2025 case. Adding H would overpay the worker
   * (item 16).
   */
  gross: number | null;
  /**
   * What is actually paid: the gross after the closing block, and ₪7,305.75 in
   * the August 2025 case. Part 4 names both figures without naming either, so
   * the two are given names here and the export and the preview use them both
   * (Part 5).
   */
  net: number | null;
  /**
   * The ברוטו less what was withheld from it — the נטו, and the middle of
   * the three figures the month screen shows (specs.md Part 5).
   *
   * **It is not `net`.** `net` is criterion 1's fourth total, the sum actually
   * transferred, and the Hebrew word for it is סך הכל תשלום לעובד/ת. The
   * sheet has a cell for the ברוטו (`A26`, ד) and for the transfer (`B29`) and
   * none for this one, which is why it is named for what it is rather than for
   * a column.
   *
   * With no income tax it equals `gross`, which is every month the family has
   * ever had and August 2025 among them; the month screen draws one row rather
   * than two identical ones in that case.
   */
  afterWithholding: number | null;
  /**
   * The vacation and sick days used in the month and the balances left after
   * them — a Wage Protection Act requirement of the payslip made from this
   * sheet (specs.md item 2), so they belong to the month's result and not to a
   * screen that assembles them afterwards.
   */
  balances: BalanceLine[];
  /**
   * Things the user should know that change no figure and stop nothing. Empty
   * on almost every month, which is the point: a warning that appears on every
   * month is one nobody reads.
   */
  warnings: Warning[];
  /**
   * This month's national-insurance estimate: 3.6% of the month's full cost,
   * taken before anything to do with advances (specs.md item 19). It is an
   * estimate to be confirmed and never a fact, because the sum actually billed
   * has differed from it — and it is not the money that left the account, which
   * appears only in the month it was paid, as a column H line of its own.
   */
  nationalInsuranceEstimate: number | null;
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
 * (specs.md item 27). The explanation carries the sentence and the reference
 * link together, so an alert opens the same "?" a money line does rather than
 * showing a bare link to the law: the explanation stays beside the thing it
 * explains, in one idiom (item 24). */
export interface HomeAlert {
  key: string;
  title: string;
  note: string;
  action: string;
  explanation: Explanation;
}
