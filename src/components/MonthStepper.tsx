"use client";

import type { ReactNode } from "react";
import { Chevron } from "@/components/icons";
import { addMonths, compareMonth, monthOf, sameMonth } from "@/lib/dates";
import { he } from "@/lib/i18n/he";
import type { IsoDate, YearMonth } from "@/lib/types";

const stepButton =
  "flex size-8 items-center justify-center rounded-tab border border-ink-quiet bg-surface text-ink-warm shadow-stepper transition-colors hover:bg-hover hover:text-ink disabled:cursor-default disabled:opacity-40 disabled:hover:bg-surface disabled:hover:text-ink-warm";

/**
 * Back a month, to this month, forward a month.
 *
 * **It is one control because it is one question.** The calendar asks it and so
 * does the payments screen, which is scoped to one worker and one month
 * (specs.md item 5) — and two screens that each drew their own stepper would be
 * two places for "forward" to stop meaning the same thing, in a right-to-left
 * layout where the arrow that means *forward in time* is the one on the left.
 * `Chevron` already carries that mirroring and is read from here rather than
 * decided again.
 *
 * `today` is a prop and never a clock (`CLAUDE.md`): without it the "this
 * month" button is not drawn at all, because a control that cannot say which
 * month is this one is a control with nothing to do.
 *
 * `earliest` is the worker's first month (specs.md item 6): nothing before it
 * can be opened, so the backward arrow is disabled there rather than stepping
 * onto a month the application has no position for.
 */
export function MonthStepper({
  month,
  today,
  earliest,
  onMonthChange,
  label,
}: {
  month: YearMonth;
  today?: IsoDate;
  earliest?: YearMonth;
  onMonthChange: (month: YearMonth) => void;
  /** The month's name, drawn between the two arrows as the home band has it;
   * the "this month" button then follows the arrows instead of parting them. */
  label?: ReactNode;
}) {
  const atEarliest = earliest !== undefined && compareMonth(month, earliest) <= 0;
  const previous = (
    <button
      type="button"
      aria-label={he.calendar.previousMonth}
      disabled={atEarliest}
      onClick={() => onMonthChange(addMonths(month, -1))}
      className={stepButton}
    >
      <Chevron towards="previous" />
    </button>
  );
  const thisMonth = today ? (
    <button
      type="button"
      onClick={() => onMonthChange(monthOf(today))}
      className="rounded-tab border border-ink-quiet bg-surface px-3.5 py-1.5 text-[15px] font-medium text-ink-warm shadow-stepper transition-colors hover:bg-hover hover:text-ink"
    >
      <span dir="auto">{he.calendar.thisMonth}</span>
    </button>
  ) : null;

  const next = (
    <button
      type="button"
      aria-label={he.calendar.nextMonth}
      onClick={() => onMonthChange(addMonths(month, 1))}
      className={stepButton}
    >
      <Chevron towards="next" />
    </button>
  );

  if (label) {
    return (
      <div className="flex items-center gap-3">
        {previous}
        {label}
        {next}
        {thisMonth ? <span className="ms-1">{thisMonth}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {previous}
      {thisMonth}
      {next}
    </div>
  );
}

/** The later of a month and the worker's first month — what a screen shows
 * when the month it was left on is before their first (specs.md item 6): after
 * switching to a worker who started later, or before their employment begins. */
export function notBefore(month: YearMonth, earliest: YearMonth): YearMonth {
  return compareMonth(month, earliest) < 0 ? earliest : month;
}

/**
 * The month a screen opens on: the current one where anybody has a record of
 * it, and otherwise the last month anybody has a record of.
 *
 * A screen that opened on a month nobody has entered would greet the user with
 * an empty calendar and no figures, which is a true statement about that month
 * and a poor answer to "show me the month". It lives beside the stepper because
 * it is the same question asked once rather than repeatedly: the month screen
 * and the payments screen must not open on different months from the same
 * store.
 */
export function openingMonthOf(
  recorded: readonly YearMonth[],
  today: IsoDate,
): YearMonth {
  const current = monthOf(today);
  if (recorded.length === 0) return current;
  if (recorded.some((month) => sameMonth(month, current))) return current;
  return recorded.reduce((latest, month) =>
    month.year > latest.year ||
    (month.year === latest.year && month.month > latest.month)
      ? month
      : latest,
  );
}
