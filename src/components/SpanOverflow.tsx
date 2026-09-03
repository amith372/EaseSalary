"use client";

import { useMemo } from "react";
import { Bidi } from "@/components/Bidi";
import { daysInMonth, isoOf } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { dayLabel } from "@/lib/dateLabels";
import { he } from "@/lib/i18n/he";
import { overlapsMonth, spanOverflow } from "@/lib/spans";
import type { DaySpan, YearMonth } from "@/lib/types";

/**
 * What a span running past the month on screen is saying.
 *
 * A span is stored whole and drawn clipped — the calendar shows one month and a
 * spell of sickness is counted from its own first day across a boundary
 * (specs.md item 8) — so the part that fell outside is said in words rather than
 * left looking like a span that simply ended on the last of the month.
 *
 * It lives beside both screens that draw a calendar rather than inside either.
 * The wording is bidirectionally awkward — a Hebrew sentence with two dates in
 * it — and two copies of it would be two places for the isolation to be got
 * wrong, in a way that looks fine in Hebrew and reorders once the page is
 * translated.
 */
export function SpanOverflowNotes({
  spans,
  month,
  restDay,
  className,
}: {
  spans: DaySpan[];
  month: YearMonth;
  restDay: RestDay;
  className?: string;
}) {
  const overflowing = useMemo(() => {
    const monthStart = isoOf(month, 1);
    const monthEnd = isoOf(month, daysInMonth(month));
    return spans
      // A span belonging to another month altogether overflows this one in both
      // directions and is not this month's business, so it is dropped before
      // anything is said about it.
      .filter((span) => overlapsMonth(span, month))
      .map((span) => ({ span, ...spanOverflow(span, monthStart, monthEnd) }))
      .filter(({ before, after }) => before || after);
  }, [spans, month]);

  if (overflowing.length === 0) return null;

  const marks = he.calendar.marks(restDay);

  return (
    <ul className={["flex flex-none flex-col gap-1", className ?? ""].filter(Boolean).join(" ")}>
      {overflowing.map(({ span, before }) => (
        <li key={span.id} className="text-[14px] font-light text-ink-mute">
          <span>{marks[span.kind]}</span>
          <span> · </span>
          <Bidi>{dayLabel(span.from)}</Bidi>
          {/* An open spell has no last day to print, and it has not "continued
              into next month" either — it may end tomorrow. What is true of it
              is only that it has not ended, so that is the whole of what is
              said (specs.md item 8). */}
          {span.to === null ? (
            <>
              <span> · </span>
              <span>{he.calendar.selection.stillOpen}</span>
            </>
          ) : (
            <>
              <span> </span>
              <span>{he.calendar.selection.separator}</span>
              <span> </span>
              <Bidi>{dayLabel(span.to)}</Bidi>
              <span> · </span>
              <span>
                {before
                  ? he.calendar.selection.continuesFrom
                  : he.calendar.selection.continuesInto}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
