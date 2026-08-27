"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bidi } from "@/components/Bidi";
import { Chevron } from "@/components/icons";
import {
  addDays,
  addMonths,
  compareIsoDate,
  daysBetween,
  fromIsoDate,
  isoOf,
  isSaturday,
  monthGrid,
  monthOf,
  orderDates,
  sameMonth,
  WEEK_LENGTH,
} from "@/lib/dates";
import { he } from "@/lib/i18n/he";
import type { DaySpan, IsoDate, MarkKind, YearMonth } from "@/lib/types";

/**
 * What the calendar hands up when the user finishes a gesture. Merging it with
 * what is already stored is the caller's, not the calendar's: merging changes
 * what the month pays, and the entitlement rules that decide which days inside
 * a range actually take the mark — a vacation span skips its Saturdays, a sick
 * span keeps them (specs.md items 5, 8) — belong to the engine.
 */
export interface SpanIntent {
  kind: MarkKind;
  from: IsoDate;
  to: IsoDate;
}

interface MonthCalendarProps {
  month: YearMonth;
  spans: DaySpan[];
  /** The mark tool the user has selected. With none, an existing span can still
   * be cleared but no new one is drawn. */
  tool?: MarkKind | null;
  /**
   * Today, passed in rather than read from the clock, so the component renders
   * the same on the server as in the browser. Without it the "היום" button is
   * not shown, because there is nowhere for it to go.
   */
  today?: IsoDate;
  onMonthChange?: (month: YearMonth) => void;
  onSelectRange?: (intent: SpanIntent) => void;
  onClearSpan?: (spanId: string) => void;
  className?: string;
}

const markClass: Record<MarkKind, string> = {
  vacation: "bg-vacation text-cream-hi",
  sick: "bg-sick text-cream-hi",
  holiday: "bg-holiday text-cream-hi",
  freeSaturday: "bg-rest text-ink",
};

/**
 * The legend, in the canvas's order, with a fifth entry for the ordinary weekly
 * rest day. The canvas greys every Saturday and labels that grey "שבת חופשית",
 * which conflates the default with the exception: a free Saturday is not an
 * entitlement (specs.md item 5), so the two are drawn as two states.
 */
const legend: { label: string; swatch: string }[] = [
  { label: he.calendar.marks.vacation, swatch: "bg-vacation" },
  { label: he.calendar.marks.sick, swatch: "bg-sick" },
  { label: he.calendar.marks.holiday, swatch: "bg-holiday" },
  { label: he.calendar.marks.freeSaturday, swatch: "bg-rest" },
  { label: he.calendar.marks.restDay, swatch: "bg-rest-bg" },
];

function monthLabel(ym: YearMonth): string {
  return `${he.calendar.monthNames[ym.month - 1]} ${ym.year}`;
}

export function MonthCalendar({
  month,
  spans,
  tool = null,
  today,
  onMonthChange,
  onSelectRange,
  onClearSpan,
  className,
}: MonthCalendarProps) {
  const cells = useMemo(() => monthGrid(month), [month]);
  const firstDay = isoOf(month, 1);

  /**
   * Which span covers each day. Where two spans cover the same day the first
   * wins here; refusing a paid holiday on a free Saturday is a decision the
   * engine makes (specs.md Part 4), not a drawing order.
   */
  const coverage = useMemo(() => {
    const byDate = new Map<IsoDate, DaySpan>();
    for (const span of spans) {
      const { from, to } = orderDates(span.from, span.to);
      for (let d = from; compareIsoDate(d, to) <= 0; d = addDays(d, 1)) {
        if (!byDate.has(d)) byDate.set(d, span);
      }
    }
    return byDate;
  }, [spans]);

  const [focusedDay, setFocused] = useState<IsoDate>(firstDay);
  const [anchor, setAnchor] = useState<IsoDate | null>(null);
  const [cursor, setCursor] = useState<IsoDate | null>(null);
  const sweeping = useRef(false);

  // The single tab stop follows the month when the month changes under it.
  // Derived while rendering rather than corrected afterwards in an effect,
  // which would render the grid once with a tab stop on no cell at all.
  const focused = sameMonth(monthOf(focusedDay), month) ? focusedDay : firstDay;

  /**
   * Always ordered by date. In a right-to-left calendar a leftward drag moves
   * forward in time, so a range keyed off column index or clientX inverts and
   * looks plausible while being wrong (specs.md Part 5).
   */
  const selection = useMemo(
    () => (anchor && cursor ? orderDates(anchor, cursor) : null),
    [anchor, cursor],
  );

  const commit = useCallback(() => {
    sweeping.current = false;
    if (anchor && cursor && tool && onSelectRange) {
      onSelectRange({ kind: tool, ...orderDates(anchor, cursor) });
    }
    setAnchor(null);
    setCursor(null);
  }, [anchor, cursor, tool, onSelectRange]);

  // A sweep released outside the grid still ends the sweep.
  useEffect(() => {
    if (!anchor) return;
    const end = () => {
      if (sweeping.current) commit();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [anchor, commit]);

  const clearOrStart = useCallback(
    (date: IsoDate, shiftKey: boolean) => {
      const covering = coverage.get(date);
      if (covering) {
        // A span is one thing: clicking inside it clears the whole of it rather
        // than punching a hole, which for a sick spell would change what it pays.
        onClearSpan?.(covering.id);
        setFocused(date);
        return;
      }
      if (!tool) return;
      if (shiftKey && anchor) {
        setCursor(date);
        setFocused(date);
        return;
      }
      sweeping.current = true;
      setAnchor(date);
      setCursor(date);
      setFocused(date);
    },
    [anchor, coverage, onClearSpan, tool],
  );

  /**
   * elementFromPoint rather than onPointerEnter, because a touch pointer stays
   * captured by the element it started on: without this a sweep works with a
   * mouse and does nothing on a phone.
   */
  function handlePointerMove(event: React.PointerEvent) {
    if (!sweeping.current) return;
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const date = under?.closest<HTMLElement>("[data-date]")?.dataset.date;
    if (date && date !== cursor) {
      setCursor(date);
      setFocused(date);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    // The document is right-to-left, so the earlier days of a week sit to the
    // right: ArrowRight steps back in time and ArrowLeft steps forward.
    const step =
      event.key === "ArrowRight"
        ? -1
        : event.key === "ArrowLeft"
          ? 1
          : event.key === "ArrowUp"
            ? -WEEK_LENGTH
            : event.key === "ArrowDown"
              ? WEEK_LENGTH
              : 0;

    if (step !== 0) {
      event.preventDefault();
      const next = addDays(focused, step);
      // The grid shows one month, so the arrows move within it; leaving it is
      // what the month buttons are for.
      if (!sameMonth(monthOf(next), month)) return;
      setFocused(next);
      if (event.shiftKey && tool) {
        if (!anchor) setAnchor(focused);
        setCursor(next);
      }
      return;
    }

    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();

    if (anchor) {
      commit();
      return;
    }
    if (coverage.has(focused)) {
      clearOrStart(focused, false);
      return;
    }
    if (tool && onSelectRange) {
      onSelectRange({ kind: tool, from: focused, to: focused });
    }
  }

  const selectionDays = selection ? daysBetween(selection.from, selection.to) + 1 : 0;

  return (
    <div className={["flex flex-col gap-5", className ?? ""].filter(Boolean).join(" ")}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[20px] font-semibold">
            <Bidi>{monthLabel(month)}</Bidi>
          </span>
          <span dir="auto" className="text-[15px] font-light text-ink-faint">
            {he.calendar.hint}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={he.calendar.previousMonth}
            onClick={() => onMonthChange?.(addMonths(month, -1))}
            className="flex size-8 items-center justify-center rounded-xs border border-sunken-line text-ink-mute transition-colors hover:bg-sand-hover hover:text-ink"
          >
            <Chevron towards="previous" />
          </button>
          {today ? (
            <button
              type="button"
              onClick={() => onMonthChange?.(monthOf(today))}
              className="rounded-xs border border-sunken-line px-3 py-1.5 text-[15px] font-medium text-ink-soft transition-colors hover:bg-sand-hover hover:text-ink"
            >
              <span dir="auto">{he.calendar.today}</span>
            </button>
          ) : null}
          <button
            type="button"
            aria-label={he.calendar.nextMonth}
            onClick={() => onMonthChange?.(addMonths(month, 1))}
            className="flex size-8 items-center justify-center rounded-xs border border-sunken-line text-ink-mute transition-colors hover:bg-sand-hover hover:text-ink"
          >
            <Chevron towards="next" />
          </button>
        </div>
      </div>

      {/* The keyboard handler belongs to the grid rather than to each day: a
          roving tabindex keeps the whole month to one tab stop, and the arrow
          keys move between days inside it. */}
      <div
        className="grid grid-cols-7 gap-1.5"
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
      >
        {he.calendar.dayNames.map((name) => (
          <span
            key={name}
            dir="auto"
            className="pb-1 text-center text-[14px] font-medium text-ink-faint"
          >
            {name}
          </span>
        ))}

        {cells.map((date, index) => {
          if (date === null) {
            return (
              <span key={`blank-${index}`} aria-hidden="true" className="aspect-square" />
            );
          }

          const span = coverage.get(date);
          const inSelection =
            selection !== null &&
            compareIsoDate(date, selection.from) >= 0 &&
            compareIsoDate(date, selection.to) <= 0;
          const dayNumber = fromIsoDate(date).getUTCDate();

          const tone = span
            ? markClass[span.kind]
            : isSaturday(date)
              ? "bg-rest-bg text-rest-ink"
              : "bg-day text-day-ink";

          return (
            <button
              key={date}
              type="button"
              data-date={date}
              tabIndex={date === focused ? 0 : -1}
              aria-label={`${dayNumber} ${monthLabel(month)}${
                span ? `, ${he.calendar.marks[span.kind]}` : ""
              }`}
              aria-pressed={span !== undefined}
              onPointerDown={(event) => clearOrStart(date, event.shiftKey)}
              onFocus={() => setFocused(date)}
              className={[
                "flex aspect-square touch-none items-center justify-center rounded-xs text-[16px] transition-colors",
                span ? "font-semibold" : "font-normal",
                tone,
                "hover:bg-day-hover hover:text-ink",
                inSelection ? "ring-2 ring-forest ring-offset-1 ring-offset-surface" : "",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Bidi>{String(dayNumber)}</Bidi>
            </button>
          );
        })}
      </div>

      {selection ? (
        <p aria-live="polite" className="text-[15px] font-light text-ink-soft">
          <Bidi>{selection.from}</Bidi>
          <span> {he.calendar.selection.separator} </span>
          <Bidi>{selection.to}</Bidi>
          <span> · </span>
          <Bidi>{String(selectionDays)}</Bidi>
          <span> </span>
          <span>{he.calendar.selection.dayCount}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4.5 border-t border-hairline pt-4">
        {legend.map((entry) => (
          <span
            key={entry.label}
            className="flex items-center gap-2 text-[15px] text-ink-soft"
          >
            <span
              aria-hidden="true"
              className={`size-[9px] flex-none rounded-full ${entry.swatch}`}
            />
            <span dir="auto">{entry.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
