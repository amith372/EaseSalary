"use client";

import { Chevron } from "@/components/icons";
import { addMonths, monthOf, sameMonth } from "@/lib/dates";
import { he } from "@/lib/i18n/he";
import type { IsoDate, YearMonth } from "@/lib/types";

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
 */
export function MonthStepper({
  month,
  today,
  onMonthChange,
}: {
  month: YearMonth;
  today?: IsoDate;
  onMonthChange: (month: YearMonth) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={he.calendar.previousMonth}
        onClick={() => onMonthChange(addMonths(month, -1))}
        className="flex size-8 items-center justify-center rounded-tab border border-line text-ink-quiet transition-colors hover:bg-hover hover:text-ink"
      >
        <Chevron towards="previous" />
      </button>
      {today ? (
        <button
          type="button"
          onClick={() => onMonthChange(monthOf(today))}
          className="rounded-tab border border-line px-3.5 py-1.5 text-[15px] font-medium text-ink-warm transition-colors hover:bg-hover hover:text-ink"
        >
          <span dir="auto">{he.calendar.thisMonth}</span>
        </button>
      ) : null}
      <button
        type="button"
        aria-label={he.calendar.nextMonth}
        onClick={() => onMonthChange(addMonths(month, 1))}
        className="flex size-8 items-center justify-center rounded-tab border border-line text-ink-quiet transition-colors hover:bg-hover hover:text-ink"
      >
        <Chevron towards="next" />
      </button>
    </div>
  );
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
