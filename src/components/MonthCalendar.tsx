"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bidi } from "@/components/Bidi";
import { Chevron } from "@/components/icons";
import {
  addDays,
  addMonths,
  compareIsoDate,
  daysBetween,
  fromIsoDate,
  isoOf,
  monthGrid,
  monthOf,
  orderDates,
  sameMonth,
  WEEK_LENGTH,
} from "@/lib/dates";
import { he } from "@/lib/i18n/he";
import type { DaySpan, IsoDate, MarkKind, YearMonth } from "@/lib/types";

/**
 * The month, marked as `EaseSalary - דף הבית v3 לוח במרכז` draws it: a day is
 * clicked, then a second day, and the picker that opens asks what the range
 * means. The kind is chosen after the range rather than before it, so there is
 * no mode to be in and no way to draw a mark the user did not mean to draw —
 * the option that requires the user to know less (specs.md Part 1).
 *
 * What the calendar hands up is the range and the kind, and it decides nothing
 * else: which days inside a range actually take the mark — a vacation span
 * skips its rest days, a sick span keeps them (specs.md items 5, 8) — is
 * calculation and lives in `src/lib/spans.ts`.
 */

export interface SpanIntent {
  kind: MarkKind;
  from: IsoDate;
  to: IsoDate;
}

interface MonthCalendarProps {
  month: YearMonth;
  spans: DaySpan[];
  /**
   * Today, passed in rather than read from the clock, so the component renders
   * the same on the server as in the browser. Without it the "היום" button is
   * not shown, because there is nowhere for it to go.
   */
  today?: IsoDate;
  onMonthChange?: (month: YearMonth) => void;
  onSelectRange?: (intent: SpanIntent) => void;
  /** Clearing takes a range the way marking does, and the caller decides what a
   * span lying half inside it means. */
  onClearRange?: (from: IsoDate, to: IsoDate) => void;
  className?: string;
}

/** The four kinds a range can be marked as, in the artboard's order. */
const pickerKinds: MarkKind[] = ["vacation", "sick", "holiday", "freeRestDay"];

/** The fill a marked day takes, and the ink that stays legible on it. */
const markClass: Record<MarkKind, string> = {
  vacation: "bg-vacation text-day-ink",
  sick: "bg-sick text-ink",
  holiday: "bg-holiday text-ink",
  freeRestDay: "bg-rest text-day-ink",
};

const dotClass: Record<MarkKind, string> = {
  vacation: "bg-vacation",
  sick: "bg-sick",
  holiday: "bg-holiday",
  freeRestDay: "bg-rest",
};

/**
 * Five entries, as v3 draws them. "יום עבודה" is a day she worked, which is
 * every unmarked day including an unmarked rest day — so there is no sixth
 * entry for the weekly rest day and no separate fill for it. The legend says
 * what the colours mean and marks nothing: marking is the picker's job.
 */
const legend: { label: string; swatch: string }[] = [
  { label: he.calendar.marks.workDay, swatch: "bg-workday-dot" },
  { label: he.calendar.marks.vacation, swatch: "bg-vacation" },
  { label: he.calendar.marks.sick, swatch: "bg-sick" },
  { label: he.calendar.marks.holiday, swatch: "bg-holiday" },
  { label: he.calendar.marks.freeRestDay, swatch: "bg-rest" },
];

function monthLabel(ym: YearMonth): string {
  return `${he.calendar.monthNames[ym.month - 1]} ${ym.year}`;
}

/** "20 באוגוסט" for a day, "16–20 באוגוסט" for a range. */
function rangeLabel(from: IsoDate, to: IsoDate): string {
  const first = fromIsoDate(from);
  const last = fromIsoDate(to);
  const days =
    from === to
      ? String(first.getUTCDate())
      : `${first.getUTCDate()}${he.calendar.selection.separator}${last.getUTCDate()}`;
  const month = he.calendar.monthNames[last.getUTCMonth()];
  return `${days} ${he.calendar.selection.inMonth}${month}`;
}

export function MonthCalendar({
  month,
  spans,
  today,
  onMonthChange,
  onSelectRange,
  onClearRange,
  className,
}: MonthCalendarProps) {
  const cells = useMemo(() => monthGrid(month), [month]);
  const firstDay = isoOf(month, 1);

  /**
   * Which span covers each day. Where two spans cover the same day the first
   * wins here; refusing a paid holiday on a free rest day is a decision the
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
  const [picking, setPicking] = useState(false);
  const firstChip = useRef<HTMLButtonElement>(null);

  // The single tab stop follows the month when the month changes under it.
  // Derived while rendering rather than corrected afterwards in an effect,
  // which would render the grid once with a tab stop on no cell at all.
  const focused = sameMonth(monthOf(focusedDay), month) ? focusedDay : firstDay;

  /**
   * Always ordered by date. In a right-to-left calendar the second day of a
   * range can sit to the left of the first and still be the later of the two,
   * so a range keyed off column index or clientX inverts and looks entirely
   * plausible while being wrong (specs.md Part 5).
   */
  const selection = useMemo(
    () => (anchor === null ? null : orderDates(anchor, cursor ?? anchor)),
    [anchor, cursor],
  );

  // Pointer and keyboard both end at the picker, so the picker takes the focus
  // when it opens rather than leaving the next Tab to go and find it.
  useEffect(() => {
    if (picking) firstChip.current?.focus();
  }, [picking]);

  function reset() {
    setAnchor(null);
    setCursor(null);
    setPicking(false);
  }

  /** The first click opens a range, the second closes it and asks what it is.
   * A click while the picker is open starts again from that day. */
  function pressDay(date: IsoDate) {
    setFocused(date);
    if (anchor === null || picking) {
      setAnchor(date);
      setCursor(null);
      setPicking(false);
      return;
    }
    setCursor(date);
    setPicking(true);
  }

  /** The range follows the pointer between the two clicks, so the days it will
   * cover are visible before the second click commits them. */
  function previewTo(date: IsoDate) {
    if (anchor !== null && !picking) setCursor(date);
  }

  function applyKind(kind: MarkKind) {
    if (selection) onSelectRange?.({ kind, ...selection });
    reset();
  }

  function clearSelection() {
    if (selection) onClearRange?.(selection.from, selection.to);
    reset();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && anchor !== null) {
      event.preventDefault();
      reset();
      return;
    }

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
      previewTo(next);
      return;
    }

    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    pressDay(focused);
  }

  const selectionDays = selection ? daysBetween(selection.from, selection.to) + 1 : 0;

  return (
    <div className={["flex min-h-0 flex-col gap-2", className ?? ""].filter(Boolean).join(" ")}>
      <div className="flex flex-wrap items-start justify-between gap-4.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[24px] font-bold tracking-[-0.02em]">
            <Bidi>{monthLabel(month)}</Bidi>
          </span>
          <span dir="auto" className="text-[15px] font-light text-ink-quiet">
            {he.calendar.hint}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={he.calendar.previousMonth}
            onClick={() => onMonthChange?.(addMonths(month, -1))}
            className="flex size-8 items-center justify-center rounded-tab border border-line text-ink-quiet transition-colors hover:bg-hover hover:text-ink"
          >
            <Chevron towards="previous" />
          </button>
          {today ? (
            <button
              type="button"
              onClick={() => onMonthChange?.(monthOf(today))}
              className="rounded-tab border border-line px-3.5 py-1.5 text-[15px] font-medium text-ink-warm transition-colors hover:bg-hover hover:text-ink"
            >
              <span dir="auto">{he.calendar.today}</span>
            </button>
          ) : null}
          <button
            type="button"
            aria-label={he.calendar.nextMonth}
            onClick={() => onMonthChange?.(addMonths(month, 1))}
            className="flex size-8 items-center justify-center rounded-tab border border-line text-ink-quiet transition-colors hover:bg-hover hover:text-ink"
          >
            <Chevron towards="next" />
          </button>
        </div>
      </div>

      <div className="grid flex-none grid-cols-7 gap-1.5">
        {he.calendar.dayNames.map((name) => (
          <span key={name} dir="auto" className="pb-0.5 text-center text-[14px] text-ink-quiet">
            {name}
          </span>
        ))}
      </div>

      {/* The keyboard handler belongs to the grid rather than to each day: a
          roving tabindex keeps the whole month to one tab stop, and the arrow
          keys move between days inside it. */}
      <div
        className="grid min-h-44 flex-1 auto-rows-[minmax(28px,1fr)] grid-cols-7 gap-1.25"
        onKeyDown={handleKeyDown}
      >
        {cells.map((date, index) => {
          if (date === null) {
            return <span key={`blank-${index}`} aria-hidden="true" />;
          }

          const span = coverage.get(date);
          const inSelection =
            selection !== null &&
            compareIsoDate(date, selection.from) >= 0 &&
            compareIsoDate(date, selection.to) <= 0;
          const dayNumber = fromIsoDate(date).getUTCDate();

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
              onClick={() => pressDay(date)}
              onMouseEnter={() => previewTo(date)}
              onFocus={() => setFocused(date)}
              className={[
                "flex flex-col items-center justify-center gap-px rounded-day text-[17px] transition-colors",
                span ? `font-semibold ${markClass[span.kind]}` : "bg-day font-normal text-day-ink",
                inSelection
                  ? "outline-2 -outline-offset-2 outline-forest"
                  : "hover:outline hover:-outline-offset-1 hover:outline-line-hover",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest",
              ].join(" ")}
            >
              <Bidi noTranslate className="leading-[1.1]">
                {String(dayNumber)}
              </Bidi>
              {span ? (
                <span dir="auto" className="text-[10px] leading-[1.1] font-semibold opacity-75">
                  {he.calendar.marks[span.kind]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* What the range means, asked once the range exists. Nothing on the
          screen is displaced by it: with no range open there is no picker. */}
      {picking && selection ? (
        <div className="flex flex-none flex-wrap items-center gap-3.5 rounded-card-sm border border-line-strong bg-ground px-3.5 py-3">
          <div className="flex min-w-0 flex-col gap-px">
            <span className="text-[15px] font-semibold">
              <Bidi noTranslate>{rangeLabel(selection.from, selection.to)}</Bidi>
            </span>
            <span dir="auto" className="text-[13px] font-light text-ink-quiet">
              <Bidi noTranslate>
                {selectionDays > 1
                  ? `${selectionDays} ${he.calendar.selection.dayCount}`
                  : he.calendar.selection.oneDay}
              </Bidi>
              <span> · </span>
              <span>{he.calendar.picker.title}</span>
            </span>
          </div>
          <div className="flex flex-auto flex-wrap items-center gap-2">
            {pickerKinds.map((kind, index) => (
              <button
                key={kind}
                type="button"
                ref={index === 0 ? firstChip : undefined}
                onClick={() => applyKind(kind)}
                className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.25 py-1.75 text-[14px] font-medium text-day-ink transition-colors hover:border-line-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <span
                  aria-hidden="true"
                  className={`size-2.75 flex-none rounded-full ${dotClass[kind]}`}
                />
                <span dir="auto">{he.calendar.marks[kind]}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearSelection}
              className="px-1 py-1.75 text-[14px] text-ink-mute transition-colors hover:text-clay-deep"
            >
              <span dir="auto">{he.calendar.picker.clear}</span>
            </button>
          </div>
          <button
            type="button"
            aria-label={he.calendar.picker.cancelLabel}
            onClick={reset}
            className="flex-none text-[14px] text-ink-quiet transition-colors hover:text-ink"
          >
            <span dir="auto">{he.calendar.picker.cancel}</span>
          </button>
        </div>
      ) : null}

      <div className="flex flex-none flex-wrap items-center gap-4">
        {legend.map((entry) => (
          <span
            key={entry.label}
            className="flex items-center gap-2.25 text-[15px] font-light text-ink-mute"
          >
            <span aria-hidden="true" className={`size-3.25 flex-none rounded-full ${entry.swatch}`} />
            <span dir="auto">{entry.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
