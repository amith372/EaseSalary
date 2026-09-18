"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bidi } from "@/components/Bidi";
import {
  addDays,
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
import type { RestDay } from "@/lib/dates";
import { dayLabel, monthLabel, rangeLabel } from "@/lib/dateLabels";
import { clipEndOf } from "@/lib/engine/types";
import { CalendarBand } from "@/components/CalendarBand";
import { MonthStepper } from "@/components/MonthStepper";
import { TwoToneIcon, type TwoToneName } from "@/components/icons";
import { he } from "@/lib/i18n/he";
import { dayParts, endOf, partIsAllowed, type MarkIntent } from "@/lib/spans";
import type {
  DaySpan,
  HolidaySpan,
  IsoDate,
  MarkKind,
  YearMonth,
} from "@/lib/types";

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

interface MonthCalendarProps {
  month: YearMonth;
  spans: DaySpan[];
  /**
   * Her weekly rest day, which is a term of the employment and not a constant
   * (specs.md item 5). The calendar needs it for the words alone — a
   * Saturday-resting worker reads שבת חופשית and a Friday-resting one
   * שישי חופשי — since what a swept range *means* is decided by
   * `spans.ts`, which the caller reaches through `onSelectRange`.
   */
  restDay: RestDay;
  /**
   * Today, passed in rather than read from the clock, so the component renders
   * the same on the server as in the browser. Without it the "היום" button is
   * not shown, because there is nowhere for it to go.
   */
  today?: IsoDate;
  /** The worker's first month, where the backward arrow stops (specs.md
   * item 6). */
  earliest?: YearMonth;
  onMonthChange: (month: YearMonth) => void;
  onSelectRange: (intent: MarkIntent) => void;
  /** Clearing takes a range the way marking does, and the caller decides what a
   * span lying half inside it means. */
  onClearRange: (from: IsoDate, to: IsoDate) => void;
  /**
   * The one fact a month records about a holiday (specs.md item 9). The dates
   * themselves are not the calendar's to change: they come from the year's
   * chosen list, and moving one is criterion 10's editable date in the yearly
   * picker.
   */
  onSetHolidayWorked: (spanId: string, worked: boolean) => void;
  /**
   * The day a panel beside the calendar is showing, ringed in the grid. The
   * calendar reports every day it is pressed on through `onSelectDay`, and
   * holds no selected day of its own.
   */
  selectedDay?: IsoDate;
  onSelectDay: (date: IsoDate) => void;
  /**
   * Open the picker on one day from outside the grid — the day panel's
   * "עריכת היום". It is the picker a second click on that day opens, and
   * nothing else: a request with a new `seq` opens it, the same `seq` again
   * does nothing.
   */
  editRequest?: { date: IsoDate; seq: number };
  className?: string;
}

/**
 * **The three kinds the user may mark — and a holiday is not one of them**
 * (specs.md item 9). The year's holidays are chosen in advance from the
 * country's candidate list, arrive on the month already drawn, and the only
 * thing recorded about one is whether she worked it. `MarkKind` does not
 * contain `"holiday"`, so this list cannot grow it by accident.
 */
const pickerKinds: MarkKind[] = ["vacation", "sick", "freeRestDay"];

/** The fill a marked day takes, and the ink that stays legible on it. */
const markClass: Record<MarkKind, string> = {
  vacation: "bg-vacation text-vacation-ink",
  sick: "bg-sick text-sick-ink",
  freeRestDay: "bg-rest text-rest-ink",
};

/** Each kind's shape, drawn beside its name in the cell, the legend and the
 * picker, so a mark is never told apart by its colour alone. */
const markIcon: Record<MarkKind | "holiday", TwoToneName> = {
  vacation: "sun",
  sick: "cross",
  freeRestDay: "home",
  holiday: "star",
};

/**
 * The picker's own control, in its three states. Written once because this file
 * draws it three times over — the kinds, the holiday's two answers, and the
 * part of a day — and they are one mechanism seen three times rather than three
 * that happen to look alike.
 */
function chipClass({
  selected = false,
  disabled = false,
  /**
   * Fill the chip when it is the chosen one, rather than only firming its
   * border.
   *
   * **Only where one of the chips is always chosen**, which of the three sets
   * is the part of a day: `יום מלא` stands from the moment the picker opens, so
   * a border one shade firmer than its neighbour's is not a state anybody
   * reads — checked in the browser, where the two chips came out
   * indistinguishable. The kinds are chosen by being pressed and none of them
   * is ever the standing answer, so they keep the quieter treatment.
   */
  fill = false,
}: { selected?: boolean; disabled?: boolean; fill?: boolean } = {}): string {
  return [
    "flex items-center gap-2 rounded-full border px-3.25 py-1.75 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
    disabled
      ? "cursor-not-allowed border-line bg-surface text-ink-quiet opacity-60"
      : selected
        ? `border-line-hover text-ink ${fill ? "bg-chip" : "bg-surface"}`
        : "border-line bg-surface text-day-ink hover:border-line-hover hover:text-ink",
  ].join(" ");
}

/**
 * **A day taken in part, drawn as a day filled in part** (specs.md item 7).
 * Painted over whichever fill the kind already gave the cell rather than beside
 * it: the gradient is a `background-image` and `markClass` sets the
 * `background-color`, so the mark keeps its own colour in the lower half and
 * the upper half returns to the colour of an unmarked day. One class covers
 * every kind for that reason, and it needs no second palette entry.
 *
 * The split runs across the cell and not down it: a diagonal or a vertical half
 * would mean the opposite thing in a right-to-left month, and a horizontal one
 * means the same in both. Fixed at half because `dayParts` offers a whole day
 * and a half and nothing between them.
 */
const PART_DAY = "bg-[linear-gradient(to_top,transparent_50%,var(--color-day)_50%)]";

/**
 * A holiday, in the two weights item 9 asks for: **an outline for one she did
 * not work and a fill for one she did**, so the state that costs money is the
 * louder of the two. One colour, two weights — the same hue in both, because
 * they are two answers about one kind of day and not two kinds.
 */
const HOLIDAY_WORKED = "bg-holiday text-holiday-ink";
const HOLIDAY_NOT_WORKED = "bg-day text-holiday-ink border-2 border-holiday-outline";
/** Item 9's third weight: dashed, so it reads as a question rather than as
 * either answer. One colour throughout, because all three are answers about one
 * kind of day. */
const HOLIDAY_UNANSWERED =
  "bg-day text-holiday-ink border-2 border-dashed border-holiday-dot";

const HOLIDAY_FACE = {
  worked: HOLIDAY_WORKED,
  notWorked: HOLIDAY_NOT_WORKED,
  unanswered: HOLIDAY_UNANSWERED,
} as const;

/**
 * Which of item 9's three states a holiday is in, or `null` for a span that is
 * not a holiday.
 *
 * **Written once because the cell, its label and the legend all ask it**, and
 * because the question has three answers: a predicate returning a boolean is
 * exactly the shape that reads "nobody has said yet" as "she did not work it".
 */
function holidayStateOf(
  span: DaySpan,
): "worked" | "notWorked" | "unanswered" | null {
  if (span.kind !== "holiday") return null;
  const worked = (span as HolidaySpan).worked;
  if (worked === null) return "unanswered";
  return worked ? "worked" : "notWorked";
}

/**
 * Six entries. "יום עבודה" is a day she worked, which is every unmarked day
 * including an unmarked rest day — so there is no entry for the weekly rest day
 * and no separate fill for it. The holiday takes three, because its weights
 * are the whole of what the month records about one and a month read back later
 * has to be tellable apart at a glance (specs.md item 9). A holiday nobody has
 * answered for is its own state and not a quiet no.
 *
 * Built per render rather than held as a module constant, because one entry
 * names her own rest day (item 5).
 */
/**
 * How many days an arrow key moves the focus. The document is right-to-left, so
 * the earlier days of a week sit to the right: ArrowRight steps back in time and
 * ArrowLeft steps forward.
 */
const ARROW_STEP: Readonly<Record<string, number>> = {
  ArrowRight: -1,
  ArrowLeft: 1,
  ArrowUp: -WEEK_LENGTH,
  ArrowDown: WEEK_LENGTH,
};

function legendFor(
  restDay: RestDay,
): { label: string; swatch: string; icon: TwoToneName }[] {
  const marks = he.calendar.marks(restDay);
  return [
    { label: marks.vacation, swatch: "bg-vacation", icon: markIcon.vacation },
    { label: marks.sick, swatch: "bg-sick", icon: markIcon.sick },
    { label: he.calendar.holiday.worked, swatch: "bg-holiday", icon: "star" },
    // The outline, drawn as an outline: a ring of the same hue around a white
    // chip, which is what the cell does two sizes up.
    {
      label: he.calendar.holiday.notWorked,
      swatch: "bg-surface border-[1.5px] border-holiday-dot",
      icon: "star",
    },
    // The third state, drawn as the question it is (item 9).
    {
      label: he.calendar.holiday.unanswered,
      swatch: "bg-surface border-[1.5px] border-dashed border-holiday-dot",
      icon: "star",
    },
    { label: marks.freeRestDay, swatch: "bg-rest", icon: markIcon.freeRestDay },
  ];
}

export function MonthCalendar({
  month,
  spans,
  restDay,
  today,
  earliest,
  onMonthChange,
  onSelectRange,
  onClearRange,
  onSetHolidayWorked,
  selectedDay,
  onSelectDay,
  editRequest,
  className,
}: MonthCalendarProps) {
  const marks = he.calendar.marks(restDay);
  const cells = useMemo(() => monthGrid(month), [month]);
  const firstDay = isoOf(month, 1);

  /**
   * Which span covers each day. Where two spans cover the same day the first
   * wins here; refusing a paid holiday on a free rest day is a decision the
   * engine makes (specs.md Part 4), not a drawing order.
   */
  const coverage = useMemo(() => {
    // An open sick spell is drawn to the same day the engine counts it to —
    // the month's last day, or today where today falls inside the month
    // (specs.md item 8). Both read it from `clipEndOf`, which is what keeps the
    // calendar from colouring a day the sheet did not pay for.
    const openEnd = clipEndOf(month, today);
    const byDate = new Map<IsoDate, DaySpan>();
    for (const span of spans) {
      const { from, to } = orderDates(span.from, endOf(span, openEnd));
      for (let d = from; compareIsoDate(d, to) <= 0; d = addDays(d, 1)) {
        if (!byDate.has(d)) byDate.set(d, span);
      }
    }
    return byDate;
  }, [spans, month, today]);

  const [focusedDay, setFocused] = useState<IsoDate>(firstDay);
  const [anchor, setAnchor] = useState<IsoDate | null>(null);
  const [cursor, setCursor] = useState<IsoDate | null>(null);
  const [picking, setPicking] = useState(false);
  /** The holiday whose one question is open, if any. */
  const [asking, setAsking] = useState<HolidaySpan | null>(null);
  /**
   * The picker's second row, held until a kind chip commits it: how much of the
   * day was taken (specs.md item 7) and the note the action carries (item 5).
   * A whole day is the default, because it is what an ordinary mark is.
   */
  const [part, setPart] = useState<number>(1);
  const [note, setNote] = useState("");
  const firstChip = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // The picker's second row — part of a day and a note — starts folded, so the
  // decision the picker asks first is only the kind.
  const [moreOpen, setMoreOpen] = useState(false);

  // A new edit request opens the picker on its day. Adjusted while rendering,
  // against the last request seen, rather than in an effect that would draw the
  // grid once without the picker the user just asked for.
  const [seenEdit, setSeenEdit] = useState(editRequest?.seq);
  if (editRequest && editRequest.seq !== seenEdit) {
    setSeenEdit(editRequest.seq);
    setFocused(editRequest.date);
    setAsking(null);
    setAnchor(editRequest.date);
    setCursor(editRequest.date);
    setPicking(true);
    setPart(1);
    setNote("");
    setMoreOpen(false);
  }

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
    if (picking || asking) firstChip.current?.focus();
  }, [picking, asking]);

  function reset() {
    setAnchor(null);
    setCursor(null);
    setPicking(false);
    setAsking(null);
    // The second row belongs to the range that is open, so it goes with it: a
    // note left standing would attach itself to the next range the user drew.
    setPart(1);
    setNote("");
    setMoreOpen(false);
  }

  /** Escape closes whichever question is open, from the grid or from inside
   * the picker that took the focus, and hands the focus back to the day. */
  function handleEscape(event: React.KeyboardEvent) {
    if (event.key !== "Escape" || (anchor === null && asking === null)) return;
    event.preventDefault();
    reset();
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)
      ?.focus();
  }

  /**
   * The first click opens a range, the second closes it and asks what it is.
   * A click while the picker is open starts again from that day.
   *
   * **A holiday answers a single click instead**, because a holiday is not
   * marked — it is already there, and the one thing the month records about it
   * is whether she worked it (specs.md item 9). Asking that on the second click
   * of a range would be two clicks for a yes-or-no about a day the user did not
   * choose. The cost is that a holiday cannot be the day a sweep starts on;
   * every other day still can, and a sweep that *crosses* one is unaffected.
   */
  function pressDay(date: IsoDate) {
    setFocused(date);
    onSelectDay(date);
    const covering = coverage.get(date);
    if (covering?.kind === "holiday" && anchor === null) {
      setAsking(covering as HolidaySpan);
      return;
    }
    setAsking(null);
    if (anchor === null || picking) {
      setAnchor(date);
      setCursor(null);
      setPicking(false);
      setPart(1);
      setNote("");
      setMoreOpen(false);
      return;
    }
    setCursor(date);
    setPicking(true);
  }

  function answerHoliday(workedIt: boolean) {
    if (asking) onSetHolidayWorked(asking.id, workedIt);
    setAsking(null);
  }

  /** The range follows the pointer between the two clicks, so the days it will
   * cover are visible before the second click commits them. */
  function previewTo(date: IsoDate) {
    if (anchor !== null && !picking) setCursor(date);
  }

  function applyKind(kind: MarkKind) {
    if (selection) {
      const trimmed = note.trim();
      onSelectRange({
        kind,
        ...selection,
        ...(part === 1 ? {} : { fraction: part }),
        ...(trimmed === "" ? {} : { note: trimmed }),
      });
    }
    reset();
  }

  function clearSelection() {
    if (selection) onClearRange(selection.from, selection.to);
    reset();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    const step = ARROW_STEP[event.key] ?? 0;

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
  /**
   * Whether a part of a day is on offer at all, and which kinds can take the
   * one chosen — both asked of `partIsAllowed`, so the picker offers exactly
   * what the server will accept and the two cannot drift apart. With a whole
   * day chosen every kind answers yes, which is why the chips are only ever
   * disabled once חצי יום stands.
   */
  const partOffered =
    selection !== null &&
    partIsAllowed({ kind: "vacation", ...selection, fraction: 0.5 });
  const kindTakesPart = (kind: MarkKind) =>
    selection !== null && partIsAllowed({ kind, ...selection, fraction: part });

  return (
    <div
      className={["flex min-h-0 flex-col gap-2", className ?? ""].filter(Boolean).join(" ")}
      onKeyDown={handleEscape}
    >
      {/* v4 puts the controls first and the month beside them, so the drawing
          can take the far end of the band. The header is bled to the edges of a
          card padded `px-4.5 pt-3.5`. */}
      <CalendarBand className="-mx-4.5 -mt-3.5 mb-1">
        <MonthStepper
          month={month}
          today={today}
          earliest={earliest}
          onMonthChange={onMonthChange}
          // The month is the page's subject and the skip link lands here, so
          // its name is the page's `h1`.
          label={
            <h1 dir="auto" className="text-[24px] font-bold tracking-[-0.02em] whitespace-nowrap">
              <Bidi>{monthLabel(month)}</Bidi>
            </h1>
          }
        />
      </CalendarBand>

      <div className="grid flex-none grid-cols-7 gap-1 sm:gap-1.75">
        {he.calendar.dayNames.map((name) => (
          <span
            key={name}
            dir="auto"
            className="truncate pb-0.5 text-center text-[12px] font-medium text-ink-quiet sm:text-[14px]"
          >
            {name}
          </span>
        ))}
      </div>

      {/* The keyboard handler belongs to the grid rather than to each day: a
          roving tabindex keeps the whole month to one tab stop, and the arrow
          keys move between days inside it. */}
      <div
        className="grid min-h-64 flex-1 auto-rows-[minmax(48px,1fr)] grid-cols-7 gap-1 sm:auto-rows-[minmax(58px,1fr)] sm:gap-1.75"
        ref={gridRef}
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
          // A holiday is a state and not a mark, so its cell is not looked up in
          // `markClass` at all: the two weights say which answer the month
          // holds, and the words say it to a reader who cannot see them.
          const holidayState = span === undefined ? null : holidayStateOf(span);
          const holiday = holidayState !== null;
          // Half a day is a fill in the cell and words in the label, because a
          // reader who cannot see the fill is told nothing by it.
          const partly = span !== undefined && (span.fraction ?? 1) < 1;
          let stateName: string | undefined;
          let fill = "border border-day-line bg-day font-normal text-day-ink";
          if (holidayState !== null) {
            stateName = he.calendar.holiday[holidayState];
            fill = `font-semibold ${HOLIDAY_FACE[holidayState]}`;
          } else if (span) {
            const kind = span.kind as MarkKind;
            stateName = partly
              ? `${marks[kind]}, ${he.calendar.picker.part.half}`
              : marks[kind];
            fill = `font-semibold ${markClass[kind]}`;
          }
          const label = `${dayNumber} ${monthLabel(month)}${
            stateName ? `, ${stateName}` : ""
          }`;
          const face = [
            "flex min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[10px] text-[15px] transition-colors sm:rounded-day sm:text-[17px]",
            fill,
            partly ? PART_DAY : "",
            date === selectedDay && !inSelection
              ? "shadow-[inset_0_0_0_2px_var(--color-selected-day)]"
              : "",
          ].filter(Boolean);
          const content = (
            <>
              <Bidi noTranslate className="leading-[1.1]">
                {String(dayNumber)}
              </Bidi>
              {span ? (
                <span className="flex items-center gap-1 leading-none">
                  <TwoToneIcon
                    name={holiday ? markIcon.holiday : markIcon[span.kind as MarkKind]}
                  />
                  {/* The word goes on a phone, where the cell is too narrow to
                      hold it; the icon and the cell's label still say it. */}
                  <span
                    dir="auto"
                    className="hidden text-[11px] leading-[1.1] font-medium sm:inline"
                  >
                    {holiday ? marks.holiday : marks[span.kind as MarkKind]}
                  </span>
                </span>
              ) : null}
            </>
          );

          return (
            <button
              key={date}
              type="button"
              data-date={date}
              tabIndex={date === focused ? 0 : -1}
              aria-label={label}
              onClick={() => pressDay(date)}
              onMouseEnter={() => previewTo(date)}
              onFocus={() => setFocused(date)}
              className={[
                ...face,
                inSelection
                  ? "outline-2 -outline-offset-2 outline-forest"
                  : "hover:outline hover:-outline-offset-1 hover:outline-line-hover",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest",
              ].join(" ")}
            >
              {content}
            </button>
          );
        })}
      </div>

      {/* The range's second press is otherwise learned by accident. Polite, so
          a screen reader hears it after the day's own label. */}
      <span aria-live="polite" className="contents">
        {anchor !== null && !picking && asking === null ? (
          <span dir="auto" className="flex-none text-[14px] font-medium text-ink-warm">
            {he.calendar.secondClick}
          </span>
        ) : null}
      </span>

      {/* The holiday's one question, asked where the range picker would be and
          in the same shape, so the two do not read as two different mechanisms.
          It offers no "clear": the date is the year's and not this month's to
          remove (specs.md items 9 and 10). */}
      {asking ? (
        <div className="flex flex-none flex-wrap items-center gap-3.5 rounded-card-sm border border-line-strong bg-ground px-3.5 py-3">
          <div className="flex min-w-0 flex-col gap-px">
            <span className="text-[15px] font-semibold">
              <Bidi noTranslate>{dayLabel(asking.from)}</Bidi>
            </span>
            <span dir="auto" className="text-[13px] font-light text-ink-quiet">
              <span>{marks.holiday}</span>
              <span> · </span>
              <span>{he.calendar.holiday.question}</span>
            </span>
          </div>
          <div className="flex flex-auto flex-wrap items-center gap-2">
            {[
              { worked: true, label: he.calendar.holiday.yes, swatch: "bg-holiday" },
              {
                worked: false,
                label: he.calendar.holiday.no,
                swatch: "bg-day border-2 border-holiday-dot",
              },
            ].map((answer, index) => (
              <button
                key={answer.label}
                type="button"
                ref={index === 0 ? firstChip : undefined}
                aria-pressed={asking.worked === answer.worked}
                onClick={() => answerHoliday(answer.worked)}
                className={chipClass({ selected: asking.worked === answer.worked })}
              >
                <span
                  aria-hidden="true"
                  className={`size-2.75 flex-none rounded-full ${answer.swatch}`}
                />
                <span dir="auto">{answer.label}</span>
              </button>
            ))}
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

      {/* What the range means, asked once the range exists. Nothing on the
          screen is displaced by it: with no range open there is no picker. */}
      {picking && selection ? (
        <div className="flex flex-none flex-col gap-2.75 rounded-card-sm border border-line-strong bg-ground px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-3.5">
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
            {pickerKinds.map((kind, index) => {
              // A kind that cannot be taken in part is not offered while a part
              // stands (specs.md item 7), and the sentence under the row says
              // why rather than leaving a dead control to be puzzled over.
              const refused = !kindTakesPart(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  ref={index === 0 ? firstChip : undefined}
                  disabled={refused}
                  onClick={() => applyKind(kind)}
                  className={chipClass({ disabled: refused })}
                >
                  <TwoToneIcon name={markIcon[kind]} className="size-3.75" />
                  <span dir="auto">{marks[kind]}</span>
                </button>
              );
            })}
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

          {/* The second row: how much of the day was taken (specs.md item 7)
              and the note every action can carry (item 5). Both are chosen
              before a kind chip commits the mark, because the kind chip is what
              commits it — so they sit under the kinds and not beside them. */}
          {moreOpen ? (
          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-2.75">
            {partOffered ? (
              <span className="flex flex-wrap items-center gap-2">
                <span dir="auto" className="text-[14px] font-light text-ink-mute">
                  {he.calendar.picker.part.label}
                </span>
                {dayParts.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={part === value}
                    onClick={() => setPart(value)}
                    className={chipClass({ selected: part === value, fill: true })}
                  >
                    <span dir="auto">
                      {value === 1
                        ? he.calendar.picker.part.whole
                        : he.calendar.picker.part.half}
                    </span>
                  </button>
                ))}
              </span>
            ) : null}
            <label className="flex min-w-60 flex-auto items-center gap-2">
              <span
                dir="auto"
                className="flex-none text-[14px] font-light text-ink-mute"
              >
                {he.calendar.picker.note.label}
              </span>
              <input
                type="text"
                dir="auto"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={he.calendar.picker.note.placeholder}
                className="min-w-0 flex-auto rounded-tab border border-line-strong bg-surface px-3 py-1.75 text-[14px] text-ink transition-colors placeholder:text-ink-quiet hover:border-line-hover focus-visible:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest"
              />
            </label>
          </div>
          ) : (
            <button
              type="button"
              aria-expanded={false}
              onClick={() => setMoreOpen(true)}
              className="flex items-center gap-1.5 self-start border-t border-line pt-2 text-[14px] text-ink-quiet transition-colors hover:text-ink"
            >
              <span aria-hidden="true">+</span>
              <span dir="auto">
                {partOffered ? he.calendar.picker.more.withPart : he.calendar.picker.more.noteOnly}
              </span>
            </button>
          )}

          {/* Why sickness went grey, said only once a half day is what made it. */}
          {moreOpen && partOffered && part < 1 ? (
            <span dir="auto" className="text-[13px] font-light text-ink-quiet text-pretty">
              {he.calendar.picker.part.rule(restDay)}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
        {legendFor(restDay).map((entry) => (
          <span
            key={entry.label}
            className="flex items-center gap-1.75 text-[14px] font-light text-ink-mute"
          >
            <span
              aria-hidden="true"
              className={`flex size-5.25 flex-none items-center justify-center rounded-[7px] ${entry.swatch}`}
            >
              <TwoToneIcon name={entry.icon} />
            </span>
            <span dir="auto">{entry.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
