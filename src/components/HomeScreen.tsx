"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { clearRange, markRange, setHolidayWorked, setMonthNote } from "@/app/month/actions";
import type { Done } from "@/lib/actionFault";
import { FaultLine, inputClass, outlineButtonClass } from "@/components/Field";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { BalancesRail, Blockers } from "@/components/HomeSections";
import { Chevron, RailIcon, TwoToneIcon, type TwoToneName } from "@/components/icons";
import { MonthCalendar } from "@/components/MonthCalendar";
import { MoneyValue } from "@/components/MoneyValue";
import { RefusalCard } from "@/components/RefusalCard";
import { notBefore, openingMonthOf } from "@/components/MonthStepper";
import { SpanOverflowNotes } from "@/components/SpanOverflow";
import { ValueChip } from "@/components/ValueChip";
import { useWorkerScope } from "@/components/WorkerScope";
import { WhyButton, WhyPanel } from "@/components/WhyDisclosure";
import type { FirstOf } from "@/lib/alertsView";
import { dayLabel } from "@/lib/dateLabels";
import {
  addDays,
  compareIsoDate,
  compareMonth,
  fromIsoDate,
  isoOf,
  monthOf,
  sameMonth,
} from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { monthLevels } from "@/lib/engine/month";
import type { MonthInSeries } from "@/lib/engine/series";
import { clipEndOf } from "@/lib/engine/types";
import type { ClosingLine } from "@/lib/types";
import type { MonthSpan } from "@/lib/engine/types";
import { bottomFigure, he } from "@/lib/i18n/he";
import { formatDays } from "@/lib/money";
import type { RefusedMonth } from "@/lib/refusalView";
import {
  endOf,
  holidayStateOf,
  overlapsMonth,
  type HolidayState,
  type MarkIntent,
  type SkippedDay,
  type SkipReason,
} from "@/lib/spans";
import type {
  Explanation,
  IsoDate,
  MarkKind,
  MonthResult,
  Worker,
  YearMonth,
} from "@/lib/types";

/**
 * The opening screen, built as `EaseSalary - דף הבית v4` draws it: a rail of the
 * household's workers and their balances, the month's calendar under its
 * illustrated band, and beside it the day last pressed and what the month came
 * to. The month is marked and calculated where the application opens, rather
 * than one screen further in (specs.md item 27).
 *
 * **Everything on it arrives already worked out.** The engine ran on the server
 * (Part 3) over the whole of the worker's history, because a month's opening
 * balances are the previous month's closing ones and the only way to know them
 * is to walk the months before it (item 13). So this screen holds no calculation
 * at all: it chooses which of the months it was handed to show, and draws it.
 * The preview and the export are the same engine's output shown twice, and this
 * is one of the two.
 *
 * **Marking writes through the store** — `markRange`, `clearRange` and
 * `setHolidayWorked` in `app/month/actions.ts`, which decide on the server which
 * days inside a swept range may take the mark (items 5, 8) and revalidate this
 * route so the figures beside the calendar are the answer to what was saved.
 *
 * **What blocks a correct salary still leads the screen.** v4 draws no such
 * list; item 27 says the opening screen leads with it, so a strip of those
 * cards sits above the columns whenever there is one, and is not drawn at all
 * when there is none. They are the first four blockages
 * `/alerts` lists, phrased once on the server, each leading where its card
 * there does; the rest are counted beside a link to the page.
 *
 * **Nothing reads a clock**: `today` is handed down by the route, so server and
 * browser agree on it.
 */

/** One worker as this screen needs them: who they are, the day they rest, and
 * every month they have, oldest first. */
export interface WorkerMonths {
  worker: Worker;
  /** Their weekly rest day *as the profile currently holds it* — the calendar's
   * shading and its labels. A month's own figures were calculated against the
   * rest day stored on that month, which may differ for a family that moved it
   * (specs.md Part 3), and that one is read off `facts.terms` below. */
  restDay: RestDay;
  /** Where the month arrows stop (specs.md item 6). */
  firstMonth: YearMonth;
  months: MonthInSeries[];
  /** The month their replay refused, where it refused one (`specs.md` item 25).
   * They have no figures then — one refused month stops the replay of every month
   * after it — and the card above their columns says which month and why. The
   * other worker's figures are untouched: the replay refuses per worker. */
  refused: RefusedMonth | null;
  /** Every mark they have. Read only for a month after the current one, which
   * the replay does not value and so does not hand over (item 21), and whose
   * calendar still shows what was marked on it. */
  spans: MonthSpan[];
  /** Vacation days they have marked in a month **after** the current one,
   * counted off those same spans by the engine on the server (item 21). It is
   * stated apart from the balance and is not in it: no month after the current
   * one is valued, so nothing marked in one can have come off a balance. The
   * figure is a fact about the worker and not about the month on screen, which
   * is why it arrives beside their months rather than inside one. */
  vacationMarkedAhead: number;
}

/** What the day panel says about one day, in the day's own colours. */
const dayFace: Record<
  MarkKind | "holidayWorked" | "holidayNotWorked" | "holidayUnanswered",
  { tint: string; ink: string; icon: TwoToneName }
> = {
  vacation: { tint: "bg-vacation", ink: "text-vacation-ink", icon: "sun" },
  sick: { tint: "bg-sick", ink: "text-sick-ink", icon: "cross" },
  freeRestDay: { tint: "bg-rest", ink: "text-rest-ink", icon: "home" },
  holidayWorked: { tint: "bg-holiday", ink: "text-holiday-ink", icon: "star" },
  holidayNotWorked: { tint: "bg-holiday", ink: "text-holiday-ink", icon: "star" },
  holidayUnanswered: { tint: "bg-holiday", ink: "text-holiday-ink", icon: "star" },
};

const holidayFaceKey: Record<HolidayState, keyof typeof dayFace> = {
  worked: "holidayWorked",
  notWorked: "holidayNotWorked",
  unanswered: "holidayUnanswered",
};

/** The dot beside each worker's name in the balances. Neutral on purpose: a
 * pink or blue dot there read as the sick or rest-day colour of the legend. */
export const workerDot = "bg-chevron-soft";

/** "19.08.2026", the date as the day panel heads itself. */
function numericDate(iso: IsoDate): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

export const railLink =
  "flex items-center gap-2.75 rounded-card-sm px-2.75 py-2.5 text-ink transition-colors hover:bg-row-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest";

export function HomeScreen({
  household,
  blockages,
  today,
  askedMonth = null,
}: {
  household: WorkerMonths[];
  /** A month the address named, which the screen opens on instead. */
  askedMonth?: YearMonth | null;
  /** What stops a correct salary, for the whole household (`blockagesOf`). */
  blockages: FirstOf;
  /** Today, read once on the server and handed down, so nothing here reads a
   * clock during a render (`CLAUDE.md`). */
  today: IsoDate;
}) {
  const { worker, workers } = useWorkerScope();
  // The switcher moves between workers and the calendar stays on the month it
  // was showing: the month is a fact about the screen and the worker is a fact
  // about the shell, so switching does not send the user back to August.
  const entry =
    household.find((candidate) => candidate.worker.id === worker.id) ?? household[0];
  // The current month where anybody has a record of it, and otherwise the last
  // month anybody has — `openingMonthOf` says why, and the payments screen asks
  // the same question so the two never open on different months. A worker whose
  // replay refused opens on the refused month instead, and ahead of the
  // address: the mark to correct is on that month and no month of theirs can be
  // valued, so the month the address asked for is no more drawable than any
  // other.
  const [chosenMonth, setMonth] = useState<YearMonth>(
    () =>
      entry.refused?.month ??
      askedMonth ??
      openingMonthOf(
        household.flatMap((one) => one.months.map((m) => m.facts.month)),
        today,
      ),
  );
  // Whose the chosen month is. Switching to a worker the engine refused moves
  // the calendar to their refused month, because the card names that month and
  // the day to correct is on it — a calendar left where the other worker was
  // cannot show it. Adjusted during render, which is React's own pattern for
  // state that follows a prop: an effect would paint the wrong month first.
  const [monthOwner, setMonthOwner] = useState<string>(worker.id);
  if (monthOwner !== worker.id) {
    setMonthOwner(worker.id);
    if (entry.refused !== null) setMonth(entry.refused.month);
  }
  const [selected, setSelected] = useState<IsoDate>(today);
  const [editRequest, setEditRequest] = useState<{ date: IsoDate; seq: number }>();
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  // A refusal belongs to the gesture that produced it, and that gesture was made
  // against one worker: it is stamped with whose it was rather than cleared by
  // an effect watching the switcher, which would run a render late.
  const [skipped, setSkipped] = useState<{ workerId: string; days: SkippedDay[] } | null>(null);
  // A gesture reaches the store and the page re-renders from it, so nothing here
  // predicts what the engine will say — the figures beside the calendar are the
  // answer to what was actually saved.
  const [saving, startSaving] = useTransition();
  // Whether the last gesture failed to answer at all (specs.md item 30). None of
  // the three has a refusal of its own, so not-ok is a fault and nothing else.
  //
  // **A flag and a transition, and deliberately not `useAction`.** That hook
  // drops a second press while the first is in flight, which is right for a
  // control that writes one field twice and wrong here: these are three
  // different marks, and a sweep dropped in silence is a day the user marked
  // that the sheet never pays.
  const [fault, setFault] = useState(false);

  /** The two gestures whose whole answer is "done", or a fault. */
  function sendMark(gesture: () => Promise<Done>) {
    setFault(false);
    startSaving(async () => {
      try {
        if (!(await gesture()).ok) setFault(true);
      } catch {
        // The action never reached the server — offline, an aborted POST — so
        // there is no return to carry a fault and the control says it here
        // rather than waiting for ever (`actionFault.ts`).
        setFault(true);
      }
    });
  }

  // Never a month before theirs: the arrows stop at their first month, and a month
  // chosen while another worker was on screen is shown from their first instead.
  const month = notBefore(chosenMonth, entry.firstMonth);
  const future = compareMonth(month, monthOf(today)) > 0;
  const shown = entry.months.find((inSeries) => sameMonth(inSeries.facts.month, month));
  // The month's own rest day where there is a month, so a calendar over a
  // corrected past month shades the column that month was calculated against
  // (specs.md Part 3).
  const shownRestDay = shown?.facts.terms.restDay ?? entry.restDay;
  // The marks of the month on screen. Where there is a valued month they are
  // the ones it was valued from; where there is none — a month ahead, which the
  // replay does not value (item 21), or a month the engine refused — they come
  // off their spans directly, which is what keeps the calendar drawn when nothing
  // else on the screen can be.
  const spans =
    shown?.facts.spans ??
    entry.spans.filter((span) => overlapsMonth(span, month));

  // The panel follows the month: browsing away from the selected day's month
  // shows that month's first day rather than a day the grid no longer draws.
  const shownDay = sameMonth(monthOf(selected), month) ? selected : isoOf(month, 1);

  const toggleWhy = (key: string) =>
    setOpenWhy((current) => (current === key ? null : key));

  function showDay(date: IsoDate) {
    setSelected(date);
    if (!sameMonth(monthOf(date), month)) setMonth(monthOf(date));
  }

  function handleSelectRange(intent: MarkIntent) {
    const workerId = worker.id;
    // The strip below describes the *previous* sweep, so it goes before this one
    // is sent rather than being left to contradict whatever this one answers.
    setSkipped(null);
    setFault(false);
    startSaving(async () => {
      try {
        const answer = await markRange(workerId, intent);
        // The days that could not take the mark travel on the success: the sweep
        // was saved and these are what it skipped (items 5, 8).
        if (answer.ok) setSkipped({ workerId, days: answer.skipped });
        else setFault(true);
      } catch {
        setFault(true);
      }
    });
  }

  /** A span is one thing: a range that touches it clears the whole of it rather
   * than punching a hole, which for a sick spell would change what it pays
   * (specs.md item 8). The rule itself is the server's. */
  function handleClearRange(from: IsoDate, to: IsoDate) {
    const workerId = worker.id;
    setSkipped(null);
    sendMark(() => clearRange(workerId, from, to));
  }

  function handleSetHolidayWorked(spanId: string, workedIt: boolean) {
    const workerId = worker.id;
    setSkipped(null);
    sendMark(() => setHolidayWorked(workerId, spanId, workedIt));
  }

  /** Grouped by reason, so a week swept across five taken days reads as one
   * sentence rather than five. */
  const refusals = useMemo(() => {
    if (!skipped || skipped.workerId !== worker.id) return [];
    const byReason = new Map<SkipReason, string[]>();
    for (const day of skipped.days) {
      const dates = byReason.get(day.reason);
      if (dates) dates.push(day.date);
      else byReason.set(day.reason, [day.date]);
    }
    return [...byReason.entries()];
  }, [skipped, worker.id]);

  /** The span covering the shown day, read to the same end the calendar draws
   * an open sick spell to (`clipEndOf`), so the panel and the grid agree. */
  const openEnd = clipEndOf(month, today);
  const daySpan = spans.find(
    (span) =>
      compareIsoDate(shownDay, span.from) >= 0 &&
      compareIsoDate(shownDay, endOf(span, openEnd)) <= 0,
  );

  const marks = he.calendar.marks(shownRestDay);
  function faceKeyOf(span: typeof daySpan): keyof typeof dayFace | undefined {
    if (span === undefined) return undefined;
    if (span.kind !== "holiday") return span.kind;
    return holidayFaceKey[holidayStateOf(span.worked)];
  }
  const faceKey = faceKeyOf(daySpan);
  function kindLabelOf(key: typeof faceKey): string {
    if (key === undefined) return "";
    if (key === "holidayWorked") return he.calendar.holiday.worked;
    if (key === "holidayNotWorked") return he.calendar.holiday.notWorked;
    if (key === "holidayUnanswered") return he.calendar.holiday.unanswered;
    return marks[key];
  }
  const kindLabel = kindLabelOf(faceKey);
  const weekday = he.calendar.dayNames[fromIsoDate(shownDay).getUTCDay()];
  const details = [
    ...(daySpan !== undefined && (daySpan.fraction ?? 1) < 1
      ? [{ label: he.home.day.part, value: he.calendar.picker.part.half }]
      : []),
    ...(daySpan?.note ? [{ label: he.home.day.note, value: daySpan.note }] : []),
  ];

  // Whatever a reader meets first is this screen's `h1`, and the screen opens
  // on the calendar with no heading of its own (`DESIGN.md`), so the level goes
  // to whichever of the three leads rather than a heading being added. The
  // strip leads where it is drawn — `specs.md` item 27 puts what blocks a
  // correct salary first — then a refused month's card, then the month.
  const leads =
    blockages.shown.length > 0
      ? "blockers"
      : entry.refused !== null
        ? "refusal"
        : "month";

  return (
    <>
      <Blockers blockages={blockages} heading={leads === "blockers" ? "h1" : "h2"} />

      {/* Above the month's content and not inside the money column: it is the
          state of everything this screen says about them and not of one figure,
          and the calendar beneath it is where the mark that caused it is
          corrected. It is the shown worker's alone — the other worker's figures
          are on the screen beside it. */}
      {entry.refused === null ? null : (
        <RefusalCard refused={entry.refused} heading={leads === "refusal" ? "h1" : "h2"} />
      )}

      {/* One column on a phone, in the order a phone reads it: the calendar,
          the day and the money, then the rail. Two columns from `lg`, where
          the rail runs as a row beneath; three from `xl`, as the artboard. In a
          right-to-left grid the first column is the right-hand one. */}
      <div className="grid flex-1 grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,19rem)] xl:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <Card
          radius="lg"
          className="order-1 flex min-w-0 flex-col self-stretch overflow-hidden px-4.5 pt-3.5 pb-3.5 lg:col-start-1 lg:row-start-1 xl:col-start-2"
        >
          <MonthCalendar
            month={month}
            spans={spans}
            restDay={shownRestDay}
            gender={worker.gender}
            today={today}
            earliest={entry.firstMonth}
            onMonthChange={setMonth}
            onSelectRange={handleSelectRange}
            onClearRange={handleClearRange}
            onSetHolidayWorked={handleSetHolidayWorked}
            selectedDay={shownDay}
            onSelectDay={setSelected}
            editRequest={editRequest}
            heading={leads === "month" ? "h1" : "h2"}
            className="flex-1"
          />

          <SpanOverflowNotes spans={spans} month={month} restDay={shownRestDay} className="mt-2.5" />

          {/* A sweep that could not be saved says so under the calendar it was
              swept on, which is where the user is looking and where the skipped
              days already appear (specs.md item 30). The grid above it is
              untouched, so the gesture can be made again. Never drawn beside the
              skipped strip: `run` clears the fault before it sends, and a sweep
              that faulted saved nothing to skip days of. */}
          {fault ? <div className="mt-2.5"><FaultLine /></div> : null}

          {refusals.length > 0 ? (
            <Card tone="inset" radius="panel" className="mt-2.5 flex flex-none flex-col gap-1.5 px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span dir="auto" className="text-[14px] font-semibold text-ink-warm">
                  {he.calendar.skipped(shownRestDay).title}
                </span>
                <button
                  type="button"
                  onClick={() => setSkipped(null)}
                  className="text-[13px] font-medium text-ink-quiet transition-colors hover:text-ink"
                >
                  <span dir="auto">{he.calendar.skipped(shownRestDay).dismiss}</span>
                </button>
              </div>
              <ul aria-live="polite" className="flex flex-col gap-1">
                {refusals.map(([reason, dates]) => (
                  <li key={reason} className="text-[14px] leading-[1.5] font-light text-ink-warm text-pretty">
                    {dates.map((date, index) => (
                      <span key={date}>
                        {index > 0 ? <span>, </span> : null}
                        <Bidi>{dayLabel(date)}</Bidi>
                      </span>
                    ))}
                    <span> — </span>
                    <span>{he.calendar.skipped(shownRestDay)[reason]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </Card>

        {/* `aria-busy` while a gesture is on its way to the store and back:
            the figures here are the engine's answer to what was saved, so
            between the click and the answer they are the *previous* month's.
            The dim that says it is on the control that was pressed
            (`busyAttrs` in `Field.tsx`) — a column greying itself
            because a day was marked on the calendar beside it reads as the
            page failing rather than as one mark being written. */}
        <div
          aria-busy={saving}
          className="order-2 flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-1 xl:col-start-3"
        >
          <Card className="flex flex-col gap-2.5 px-3.75 py-3">
            <div className="flex items-center justify-between gap-2.5">
              <button
                type="button"
                aria-label={he.home.day.previous}
                onClick={() => showDay(addDays(shownDay, -1))}
                className="flex size-8 items-center justify-center rounded-tab text-ink-quiet transition-colors hover:bg-hover hover:text-ink"
              >
                <Chevron towards="previous" />
              </button>
              {/* Announced as it changes, so stepping through days with the
                  arrows says which day the panel now shows. */}
              <span aria-live="polite" className="flex min-w-0 flex-col items-center gap-px">
                <Bidi noTranslate className="text-[19px] font-bold tracking-[-0.01em]">
                  {numericDate(shownDay)}
                </Bidi>
                <span dir="auto" className="text-[14px] font-light text-ink-quiet">
                  {`${he.calendar.selection.weekdayPrefix}${weekday}`}
                </span>
              </span>
              <button
                type="button"
                aria-label={he.home.day.next}
                onClick={() => showDay(addDays(shownDay, 1))}
                className="flex size-8 items-center justify-center rounded-tab text-ink-quiet transition-colors hover:bg-hover hover:text-ink"
              >
                <Chevron towards="next" />
              </button>
            </div>

            {/* An ordinary work day has nothing to say about itself, so the
                card is drawn only for a day that departs from one. */}
            {faceKey === undefined ? null : (
            <div className={`flex items-center gap-2.75 rounded-tint px-3.25 py-2.25 ${dayFace[faceKey].tint}`}>
              <span className="flex size-7 flex-none items-center justify-center rounded-[9px] bg-surface">
                <TwoToneIcon name={dayFace[faceKey].icon} className="size-4.25" />
              </span>
              <span className="flex min-w-0 flex-col gap-px">
                <span dir="auto" className={`text-[16px] font-semibold ${dayFace[faceKey].ink}`}>
                  {kindLabel}
                </span>
                <span dir="auto" className="text-[13px] font-light text-ink-mute">
                  {he.home.day.notes[faceKey]}
                </span>
              </span>
            </div>
            )}

            {/* Only what the coloured card above does not already say: the kind
                is its title and the worker is the switcher's, so a row appears
                only when the day is part of one or carries a note. */}
            {details.length > 0 ? (
              <dl className="flex flex-col">
                {details.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 border-t border-line py-1.5">
                    <dt dir="auto" className="text-[15px] font-light text-ink-mute">
                      {row.label}
                    </dt>
                    <dd dir="auto" className="min-w-0 text-[15px] font-medium [unicode-bidi:isolate]">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <button
              type="button"
              onClick={() =>
                setEditRequest((current) => ({ date: shownDay, seq: (current?.seq ?? 0) + 1 }))
              }
              className="flex items-center justify-center gap-2.25 rounded-day bg-sage-soft px-3.5 py-2.25 text-[15px] font-semibold text-sage-ink transition-colors hover:bg-sage-soft-hover hover:text-sage-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              <RailIcon name="pencil" className="size-3.75" />
              <span dir="auto">{he.home.day.edit}</span>
            </button>
          </Card>

          {shown ? (
            <MoneyCard
              result={shown.result}
              restDay={shown.facts.terms.restDay}
              openWhy={openWhy}
              onToggleWhy={toggleWhy}
            />
          ) : future ? (
            <Card className="flex flex-none flex-col px-3.75 py-3.25">
              <p dir="auto" className="text-[16px] leading-[1.5] font-semibold">
                {he.month.future}
              </p>
            </Card>
          ) : entry.refused !== null ? (
            // The card above already says why there are no figures, and a
            // second card saying the month is empty would contradict it.
            null
          ) : (
            <Card className="flex flex-none flex-col gap-1.5 px-3.75 py-3.25">
              <h2 dir="auto" className="text-[16px] font-semibold">
                {he.month.empty.title}
              </h2>
              <p dir="auto" className="text-[15px] leading-[1.5] font-light text-ink-mute">
                {he.month.empty.body}
              </p>
            </Card>
          )}

          {/*
            Further in, from this month to the sheet that lays a month out row
            by row. It belongs to the column and not to the money card, because
            it is a way through rather than a figure — and a month with nothing
            in it yet is exactly when someone wants to look at the last one that
            had, so it is drawn whether or not there is a month above it. It
            wears the export card's shape: a muted line under the cards was
            missed.
          */}
          <Link
            href="/month/payslip"
            prefetch={false}
            className={`${railLink} flex-none rounded-card border border-line bg-surface px-3 py-2.75`}
          >
            <span className="flex size-8.5 flex-none items-center justify-center rounded-tab bg-tile-sage text-icon-sage">
              <RailIcon name="payslip" className="size-4" />
            </span>
            <span dir="auto" className="min-w-0 flex-auto text-[16px] font-semibold">
              {he.home.paid.fullSheet}
            </span>
            <Chevron towards="next" className="text-chevron-soft" />
          </Link>

          {shown ? (
            <MonthNote
              key={`${entry.worker.id} ${shown.facts.month.year}-${shown.facts.month.month} ${shown.facts.note ?? ""}`}
              workerId={entry.worker.id}
              month={shown.facts.month}
              note={shown.facts.note ?? ""}
            />
          ) : null}

          {/* Worth knowing about this month, and it is drawn nowhere else: the
              payslip lays the figures out and says nothing about what they
              imply. It sits under the link to the payslip, which is read
              first. */}
          {shown && shown.result.warnings.length > 0 ? (
            <Card className="flex min-w-0 flex-none flex-col gap-1.5 px-3.75 py-3.25">
              <h2 dir="auto" className="text-[16px] font-semibold">
                {he.month.preview.warnings}
              </h2>
              {shown.result.warnings.map((warning) => (
                <WhyPanel
                  key={warning.key}
                  id={`warning-${warning.key}`}
                  open
                  explanation={{ text: warning.message, link: warning.link }}
                />
              ))}
            </Card>
          ) : null}
        </div>

        {/* v4's workers card is left out: the top bar's switcher and its
            עובדים/ות tab already reach both workers, and the balances name
            them. */}
        <BalancesRail
          workers={workers}
          household={household}
          month={month}
          fallbackRestDay={entry.restDay}
          openWhy={openWhy}
          toggleWhy={toggleWhy}
        />

        {/* v4's row of action cards is left out: the tabs, the money card's
            link and the blockers already lead to each of them. */}
      </div>
    </>
  );
}

/** One figure of the month, with the "?" that says where it came from. The card
 * is compact by design — v4 draws five rows and a total, and the itemisation
 * behind each of them is the payslip's (specs.md item 5). */
function MoneyRow({
  label,
  value,
  whyKey,
  explanation,
  strong,
  openWhy,
  onToggleWhy,
}: {
  label: string;
  /** Drawn rather than formatted here, because one of these rows is a pair of
   * day counts and the rest are money. */
  value: ReactNode;
  whyKey: string;
  explanation: Explanation;
  strong?: boolean;
  openWhy: string | null;
  onToggleWhy: (key: string) => void;
}) {
  return (
    // `data-row` is the browser suite's handle on one row (`CLAUDE.md` rule 10)
    // — the same attribute `SummaryRow` carries on the payslip, so a figure can
    // be read by what it is rather than by the Hebrew beside it.
    <div data-row={whyKey} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2.5">
        <span className="flex min-w-0 items-center gap-1.75">
          <span
            dir="auto"
            className={
              strong
                ? "text-[15px] font-semibold text-ink"
                : "text-[15px] font-light text-ink-soft"
            }
          >
            {label}
          </span>
          <WhyButton
            controls={`why-${whyKey}`}
            open={openWhy === whyKey}
            onToggle={() => onToggleWhy(whyKey)}
            subject={label}
          />
        </span>
        <span className="flex-none">{value}</span>
      </div>
      <WhyPanel id={`why-${whyKey}`} open={openWhy === whyKey} explanation={explanation} />
    </div>
  );
}

/**
 * The month's own note (specs.md item 5), written here and shown on the
 * payslip. No artboard draws it on this screen; the payslip's
 * `להוסיף הערה לחודש` opens here at `#month-note`. It is keyed by the stored
 * note, so a save that lands resets the field to what was stored.
 */
function MonthNote({
  workerId,
  month,
  note,
}: {
  workerId: string;
  month: YearMonth;
  note: string;
}) {
  const words = he.home.note;
  const [text, setText] = useState(note);
  const [saving, startSaving] = useTransition();
  const changed = text.trim() !== note;
  return (
    <Card id="month-note" className="flex flex-none scroll-mt-4 flex-col gap-2 px-3.75 py-3.25">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          startSaving(async () => {
            await setMonthNote(workerId, month, text);
          });
        }}
        className="flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1.5">
          <span dir="auto" className="text-[16px] font-semibold">
            {words.title}
          </span>
          <textarea
            dir="auto"
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            data-field="month-note"
            className={`${inputClass} resize-y`}
          />
        </label>
        <p dir="auto" className="text-[13px] font-light text-ink-mute">
          {words.hint}
        </p>
        <div>
          <button
            type="submit"
            disabled={!changed || saving}
            className={outlineButtonClass}
          >
            <span dir="auto">{words.save}</span>
          </button>
        </div>
      </form>
    </Card>
  );
}

/**
 * What the month came to, as `דף הבית v4` draws it: ‏ברוטו‎, what was withheld
 * from it, ‏נטו‎, what was transferred out of that, and the total.
 *
 * **Which of those rows are drawn is the engine's answer and not this card's.**
 * `monthLevels` owns the rule — a level is only real when something below it
 * changes the figure, or two identical figures appear under two headings and
 * read as an error (specs.md Part 5). The artboard was drawn against the same
 * two flags, so nothing here departs from it.
 *
 * **It summarises and does not itemise** (item 5). The lines behind the ‏ברוטו‎
 * are the payslip's and the export's, and the lines the user added are one row
 * however many of them there are (item 20).
 *
 * **The two rows below the total are below it on purpose.** Money paid to a
 * third party never reaches the worker's own total (item 16) and the
 * national-insurance figure is an estimate the family still owes (item 19) —
 * either of them drawn above `סך הכל תשלום לעובד/ת` would read as part of it,
 * which is a sum the family would act on. v4 draws the third-party row among
 * the others; this is a departure recorded in `DESIGN.md`.
 */
function MoneyCard({
  result,
  restDay,
  openWhy,
  onToggleWhy,
}: {
  result: MonthResult;
  /** The month's own rest day, because the work-day count's explanation names
   * their days (specs.md items 5, 14). */
  restDay: RestDay;
  openWhy: string | null;
  onToggleWhy: (key: string) => void;
}) {
  const why = { openWhy, onToggleWhy };
  const { withholdingRows, transferRows, userAfter, withholds, transfers } =
    monthLevels(result);
  /** The withholding lines and the transfer lines are the same row drawn from
   * the same shape; only which list it is drawn from differs. */
  const rowsOf = (lines: ClosingLine[]) =>
    lines.map((line) => (
      <MoneyRow
        {...why}
        key={line.key}
        label={line.label}
        value={
          <MoneyValue agorot={line.amount} chip="warm" manual={line.manual} />
        }
        whyKey={line.key}
        explanation={line.explanation}
      />
    ));
  const thirdPartySubtotal = result.subtotals.find(
    (subtotal) => subtotal.column === "H",
  );

  return (
    <Card className="flex flex-none flex-col gap-2 px-3.75 py-3.25">
      <h2 dir="auto" className="text-[16px] font-semibold">
        {he.home.paid.title}
      </h2>

      {/* **Both counts, which is what the Wage Protection Act asks of the
          payslip made from this month** (specs.md items 2, 5). v4 draws no such
          row and the payslip has one — but the payslip opens on the last month
          that ended, so without this the running month's counts are readable
          nowhere, and a vacation day wrongly shrinking the standard count would
          show on no screen at all. A departure recorded in `DESIGN.md`. */}
      <MoneyRow
        {...why}
        label={he.sheet.reporting.workDays}
        whyKey="workDays"
        explanation={{ text: he.sheet.why.workDays(restDay) }}
        value={
          <ValueChip>
            <Bidi noTranslate>
              {`${formatDays(result.actualDays ?? 0)} / ${formatDays(result.standardDays ?? 0)}`}
            </Bidi>
          </ValueChip>
        }
      />

      {withholds ? (
        <>
          <MoneyRow
            {...why}
            label={he.month.preview.gross}
            value={<MoneyValue agorot={result.gross} chip="warm" />}
            whyKey="gross"
            explanation={{ text: he.sheet.why.gross }}
            strong
          />
          {rowsOf(withholdingRows)}
        </>
      ) : null}

      {transfers ? (
        <>
          <MoneyRow
            {...why}
            label={he.month.preview.afterWithholding}
            value={<MoneyValue agorot={result.afterWithholding} chip="warm" />}
            whyKey="afterWithholding"
            explanation={{ text: he.sheet.why.afterWithholding }}
            strong
          />
          {/* However many lines the user placed below the total, one row —
              the itemisation is the payments screen's and the export's
              (item 20). */}
          {userAfter.length > 0 ? (
            <MoneyRow
              {...why}
              label={he.month.preview.userLines}
              value={
                <MoneyValue
                  agorot={userAfter.reduce((total, row) => total + (row.amount ?? 0), 0)}
                  chip="warm"
                  manual={userAfter.some((row) => row.manual)}
                />
              }
              whyKey="userLines-afterGross"
              explanation={{ text: he.month.preview.userLinesWhy }}
            />
          ) : null}
          {rowsOf(transferRows)}
        </>
      ) : null}

      <Card
        tone="tint"
        radius="tint"
        data-row="net"
        className="mt-0.5 flex flex-col gap-2 px-3 py-2.25"
      >
        <div className="flex items-center justify-between gap-2.5">
          <span className="flex min-w-0 items-center gap-1.75">
            <span dir="auto" className="text-[16px] font-semibold text-balance">
              {bottomFigure(transfers).label}
            </span>
            <WhyButton
              controls="why-total"
              open={openWhy === "total"}
              onToggle={() => onToggleWhy("total")}
              subject={bottomFigure(transfers).label}
            />
          </span>
          <MoneyValue agorot={result.net} size="lg" chip="plain" className="flex-none" />
        </div>
        <WhyPanel
          id="why-total"
          open={openWhy === "total"}
          explanation={bottomFigure(transfers).explanation}
          within="tint"
        />
      </Card>

      <div className="mt-0.5 flex flex-col gap-2 border-t border-line pt-2.5">
        {thirdPartySubtotal ? (
          <MoneyRow
            {...why}
            label={thirdPartySubtotal.label}
            value={<MoneyValue agorot={thirdPartySubtotal.amount} chip="warm" />}
            whyKey="subtotal-H"
            explanation={thirdPartySubtotal.explanation}
          />
        ) : null}
        <MoneyRow
          {...why}
          label={he.sheet.reporting.nationalInsuranceEstimate}
          value={<MoneyValue agorot={result.nationalInsuranceEstimate} chip="warm" />}
          whyKey="nationalInsuranceEstimate"
          explanation={{
            text: he.sheet.why.nationalInsuranceEstimate,
            link: "nationalInsurance",
          }}
        />
      </div>
    </Card>
  );
}
