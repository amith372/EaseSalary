import { fromIsoDate } from "@/lib/dates";
import { he } from "@/lib/i18n/he";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * Dates as the interface writes them, in one place.
 *
 * These were three functions in two components until a range swept across a
 * month boundary came back reading "30–4 באוקטובר": the label took its month
 * from the range's last day and said nothing about the first. The answer was
 * wrong and entirely plausible, which is the class of mistake `specs.md` Part 5
 * keeps warning about, so the assembly moved here where it can be tested —
 * beside `money.ts`, for the same reason formatting money is tested there.
 *
 * Every string produced here is a mixed run of digits and Hebrew, so each is
 * rendered inside a `<Bidi>` isolate by its caller (`CLAUDE.md`). Nothing here
 * reads a clock.
 *
 * **`dayLabel` writes "26 אוגוסט" and `rangeLabel` writes "26 באוגוסט".** The
 * preposition is right and the bare form is not, but the bare form is what the
 * overflow list has always shown; it is recorded here rather than changed
 * quietly, because it is a visible string and changing it is the user's call.
 */

/** "אוגוסט 2026" — the calendar's own heading. */
export function monthLabel(ym: YearMonth): string {
  return `${he.calendar.monthNames[ym.month - 1]} ${ym.year}`;
}

/** "26 אוגוסט". */
export function dayLabel(iso: IsoDate): string {
  const date = fromIsoDate(iso);
  return `${date.getUTCDate()} ${he.calendar.monthNames[date.getUTCMonth()]}`;
}

/** "20 באוגוסט" for one day, "16–20 באוגוסט" inside a month. */
function withinMonth(from: Date, to: Date): string {
  const days =
    from.getTime() === to.getTime()
      ? String(from.getUTCDate())
      : `${from.getUTCDate()}${he.calendar.selection.separator}${to.getUTCDate()}`;
  const month = he.calendar.monthNames[to.getUTCMonth()];
  return `${days} ${he.calendar.selection.inMonth}${month}`;
}

/**
 * A swept range in words.
 *
 * Three shapes, because a range that crosses a month cannot be written as days
 * against one month name: "30 בספטמבר – 4 באוקטובר" names both. A range that
 * also crosses a year carries the years, since December and January say nothing
 * about which of the two is meant — and a spell of sickness running over the new
 * year is an ordinary thing to record, not an edge case (specs.md item 8).
 *
 * The range is expected already ordered by date. In a right-to-left calendar a
 * leftward drag moves forward in time, so the ordering is the caller's job and
 * `orderDates` does it before the range ever reaches here (Part 5).
 */
export function rangeLabel(from: IsoDate, to: IsoDate): string {
  const first = fromIsoDate(from);
  const last = fromIsoDate(to);

  const sameMonth =
    first.getUTCFullYear() === last.getUTCFullYear() &&
    first.getUTCMonth() === last.getUTCMonth();
  if (sameMonth) return withinMonth(first, last);

  const year = (date: Date) =>
    first.getUTCFullYear() === last.getUTCFullYear()
      ? ""
      : ` ${date.getUTCFullYear()}`;
  const side = (date: Date) =>
    `${date.getUTCDate()} ${he.calendar.selection.inMonth}${
      he.calendar.monthNames[date.getUTCMonth()]
    }${year(date)}`;

  return `${side(first)} ${he.calendar.selection.separator} ${side(last)}`;
}
