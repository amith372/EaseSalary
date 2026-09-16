"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { Chevron, RailIcon, TwoToneIcon, type TwoToneName } from "@/components/icons";
import { MonthCalendar } from "@/components/MonthCalendar";
import { MoneyValue } from "@/components/MoneyValue";
import { SpanOverflowNotes } from "@/components/SpanOverflow";
import { useWorkerScope } from "@/components/WorkerScope";
import { WhyButton, WhyPanel } from "@/components/WhyDisclosure";
import { homeFixtures } from "@/lib/fixtures/home";
import { dayLabel } from "@/lib/dateLabels";
import { addDays, compareIsoDate, fromIsoDate, isoOf, monthOf, sameMonth } from "@/lib/dates";
import { clipEndOf } from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import { formatDays } from "@/lib/money";
import {
  applyMark,
  endOf,
  touchesRange,
  type SkippedDay,
  type SkipReason,
} from "@/lib/spans";
import type { DaySpan, HolidaySpan, IsoDate, MarkKind, YearMonth } from "@/lib/types";
import type { SpanIntent } from "@/components/MonthCalendar";

/**
 * The opening screen, built as `EaseSalary - דף הבית v4` draws it: a rail of the
 * household's workers and their balances, the month's calendar under its
 * illustrated band, and beside it the day last pressed and what the month paid.
 * The month is marked where the application opens, rather than one screen
 * further in (specs.md item 27).
 *
 * **What blocks a correct salary still leads the screen.** v4 draws no such
 * list; item 27 says the opening screen leads with it, so a strip of those
 * cards sits above the columns whenever there is one, and is not drawn at all
 * when there is none (the user, 2026-09-15).
 *
 * It is the one screen that computes nothing: every amount and count arrives in
 * the calculation engine's own types with a fixture standing in, so the contract
 * is fixed now and stage 6 fills it in without this file changing. What it does
 * own is the marking of days — the merge of a chosen range into what is already
 * stored. The entitlement rules behind that merge live in `src/lib/spans.ts`,
 * because which days inside a range take the mark is calculation rather than
 * interaction. Marks are client state only.
 *
 * **The calendar opens on the month `today` falls in**, and `today` is handed
 * down by the route rather than read here, so server and browser agree on it.
 */

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

/** The dot beside each worker's name in the balances. Neutral on purpose: a
 * pink or blue dot there read as the sick or rest-day colour of the legend. */
const workerDot = "bg-chevron-soft";

/** "19.08.2026", the date as the day panel heads itself. */
function numericDate(iso: IsoDate): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

const railLink =
  "flex items-center gap-2.75 rounded-card-sm px-2.75 py-2.5 text-ink transition-colors hover:bg-row-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest";

export function HomeScreen({ today }: { today: IsoDate }) {
  const { worker, workers } = useWorkerScope();
  const [month, setMonth] = useState<YearMonth>(() => monthOf(today));
  const [selected, setSelected] = useState<IsoDate>(today);
  const [editRequest, setEditRequest] = useState<{ date: IsoDate; seq: number }>();
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  // A refusal belongs to the gesture that produced it, and that gesture was made
  // against one worker: it is stamped with whose it was rather than cleared by
  // an effect watching the switcher, which would run a render late.
  const [skipped, setSkipped] = useState<{ workerId: string; days: SkippedDay[] } | null>(null);
  const [spansByWorker, setSpansByWorker] = useState<Record<string, DaySpan[]>>(() =>
    Object.fromEntries(homeFixtures.map((f) => [f.worker.id, f.spans])),
  );

  const fixtureOf = (id: string) => homeFixtures.find((f) => f.worker.id === id) ?? homeFixtures[0];
  const fixture = fixtureOf(worker.id);
  const { result, alerts } = fixture;
  /**
   * **A worker the fixtures do not name falls back with the fixture she fell
   * back to.** Without it the screen crashed for every worker created through
   * `הוספת עובד`, whose id the store assigns (`workers/actions.ts`). The screen
   * is still drawn from fixtures, which is stage 6's to replace.
   */
  const spans = spansByWorker[worker.id] ?? fixture.spans;

  // The panel follows the month: browsing away from the selected day's month
  // shows that month's first day rather than a day the grid no longer draws.
  const shownDay = sameMonth(monthOf(selected), month) ? selected : isoOf(month, 1);

  const toggleWhy = (key: string) =>
    setOpenWhy((current) => (current === key ? null : key));

  function showDay(date: IsoDate) {
    setSelected(date);
    if (!sameMonth(monthOf(date), month)) setMonth(monthOf(date));
  }

  function handleSelectRange(intent: SpanIntent) {
    const { spans: added, skipped: refused } = applyMark(intent, fixture.restDay, spans);
    setSpansByWorker((current) => ({
      ...current,
      [worker.id]: [...(current[worker.id] ?? fixture.spans), ...added],
    }));
    setSkipped({ workerId: worker.id, days: refused });
  }

  /** A span is one thing: a range that touches it clears the whole of it rather
   * than punching a hole, which for a sick spell would change what it pays
   * (specs.md item 8). */
  function handleClearRange(from: IsoDate, to: IsoDate) {
    setSpansByWorker((current) => ({
      ...current,
      [worker.id]: (current[worker.id] ?? []).filter((span) => !touchesRange(span, from, to)),
    }));
    setSkipped(null);
  }

  /** Grouped by reason, so a week swept across five taken days reads as one
   * sentence rather than five. */
  const refusals = useMemo(() => {
    if (!skipped || skipped.workerId !== worker.id) return [];
    const byReason = new Map<SkipReason, IsoDate[]>();
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

  const marks = he.calendar.marks(fixture.restDay);
  const faceKey: keyof typeof dayFace | undefined =
    daySpan === undefined
      ? undefined
      : daySpan.kind === "holiday"
        ? (daySpan as HolidaySpan).worked === null
          ? "holidayUnanswered"
          : (daySpan as HolidaySpan).worked
            ? "holidayWorked"
            : "holidayNotWorked"
        : (daySpan.kind as MarkKind);
  const kindLabel =
    faceKey === undefined
      ? ""
      : faceKey === "holidayWorked"
        ? he.calendar.holiday.worked
        : faceKey === "holidayNotWorked"
          ? he.calendar.holiday.notWorked
          : faceKey === "holidayUnanswered"
            ? he.calendar.holiday.unanswered
            : marks[faceKey];
  const weekday = he.calendar.dayNames[fromIsoDate(shownDay).getUTCDay()];
  const details = [
    ...(daySpan !== undefined && (daySpan.fraction ?? 1) < 1
      ? [{ label: he.home.day.part, value: he.calendar.picker.part.half }]
      : []),
    ...(daySpan?.note ? [{ label: he.home.day.note, value: daySpan.note }] : []),
  ];

  return (
    <>
      {/* What stops the month being calculated correctly, first (item 27). */}
      {alerts.length > 0 ? (
        <section aria-labelledby="home-blockers" className="flex flex-none flex-col gap-1.5">
          <h2 id="home-blockers" dir="auto" className="text-[15px] font-semibold text-ink-warm">
            {he.status.needsAttention}
          </h2>
          <div className="grid items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert) => (
              <Card key={alert.key} radius="sm" className="flex min-w-0 flex-col gap-0.5 px-3.5 py-2.25">
                {/* Title, action and "?" on one line and the note under them:
                    the strip leads the screen, so it spends as little height as
                    two lines can. */}
                <div className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden="true" className="size-2 flex-none rounded-full bg-clay" />
                  <span dir="auto" className="min-w-0 flex-auto text-[15px] font-semibold">
                    {alert.title}
                  </span>
                  <Link
                    href="/alerts"
                    className="flex-none text-[14px] font-medium whitespace-nowrap hover:underline hover:underline-offset-4"
                  >
                    <span dir="auto">{alert.action}</span>
                  </Link>
                  <WhyButton
                    controls={`why-${alert.key}`}
                    open={openWhy === alert.key}
                    onToggle={() => toggleWhy(alert.key)}
                    label={he.home.alerts.whatTheLawSays}
                  />
                </div>
                <span dir="auto" className="ps-4.5 text-[14px] leading-[1.45] font-light text-ink-mute text-pretty">
                  {alert.note}
                </span>
                <WhyPanel
                  id={`why-${alert.key}`}
                  open={openWhy === alert.key}
                  explanation={alert.explanation}
                />
              </Card>
            ))}
          </div>
        </section>
      ) : null}

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
            restDay={fixture.restDay}
            today={today}
            onMonthChange={setMonth}
            onSelectRange={handleSelectRange}
            onClearRange={handleClearRange}
            selectedDay={shownDay}
            onSelectDay={setSelected}
            editRequest={editRequest}
            decorated
            /* The month in the band is this page's subject, so it is the
               page's `h1`. v3 had a hero card to head the screen and v4 cut
               it, which left the home screen starting at `h2` — the only
               screen in the application with no level-one heading, and the
               one the skip link lands on. */
            asPageHeading
            className="flex-1"
          />

          <SpanOverflowNotes spans={spans} month={month} restDay={fixture.restDay} className="mt-2.5" />

          {refusals.length > 0 ? (
            <Card tone="inset" radius="panel" className="mt-2.5 flex flex-none flex-col gap-1.5 px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span dir="auto" className="text-[14px] font-semibold text-ink-warm">
                  {he.calendar.skipped(fixture.restDay).title}
                </span>
                <button
                  type="button"
                  onClick={() => setSkipped(null)}
                  className="text-[13px] font-medium text-ink-quiet transition-colors hover:text-ink"
                >
                  <span dir="auto">{he.calendar.skipped(fixture.restDay).dismiss}</span>
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
                    <span>{he.calendar.skipped(fixture.restDay)[reason]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </Card>

        <div className="order-2 flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-1 xl:col-start-3">
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
                card is drawn only for a day that departs from one (the user,
                2026-09-15). */}
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
                only when the day is part of one or carries a note (the user,
                2026-09-15). */}
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

          <Card className="flex flex-col gap-2 px-3.75 py-3.25">
            {/* One way further in, at the bottom: a "לחישוב" link here said
                the same (the user, 2026-09-15). */}
            <h2 dir="auto" className="text-[16px] font-semibold">
              {he.home.paid.title}
            </h2>

            {result.lines.map((line) => (
              <div key={line.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2.5">
                  <span className="flex min-w-0 items-center gap-1.75">
                    <span dir="auto" className="text-[15px] font-light text-ink-soft">
                      {line.label}
                    </span>
                    <WhyButton
                      controls={`why-${line.key}`}
                      open={openWhy === line.key}
                      onToggle={() => toggleWhy(line.key)}
                    />
                  </span>
                  <MoneyValue agorot={line.amount} chip="warm" manual={line.manual} className="flex-none" />
                </div>
                <WhyPanel id={`why-${line.key}`} open={openWhy === line.key} explanation={line.explanation} />
              </div>
            ))}

            <Card tone="tint" radius="tint" className="mt-0.5 flex flex-col gap-2 px-3 py-2.25">
              <div className="flex items-center justify-between gap-2.5">
                <span className="flex min-w-0 items-center gap-1.75">
                  <span dir="auto" className="text-[16px] font-semibold text-balance">
                    {he.home.paid.total}
                  </span>
                  <WhyButton controls="why-total" open={openWhy === "total"} onToggle={() => toggleWhy("total")} />
                </span>
                <MoneyValue agorot={result.net} size="lg" chip="plain" className="flex-none" />
              </div>
              <WhyPanel
                id="why-total"
                open={openWhy === "total"}
                explanation={{ text: he.home.paid.totalExplanation }}
                within="tint"
              />
            </Card>

            <Link
              href="/month/payslip"
              className="flex items-center justify-center gap-2 pt-0.5 text-[14px] text-ink-mute transition-colors hover:text-forest"
            >
              <span dir="auto">{he.home.paid.fullSheet}</span>
              <Chevron towards="next" />
            </Link>
          </Card>
        </div>

        {/* v4's workers card is left out: the top bar's switcher and its
            עובדים/ות tab already reach both workers, and the balances name them
            (the user, 2026-09-15). */}
        <aside className="order-3 grid min-w-0 items-start gap-3 sm:grid-cols-2 lg:col-span-2 lg:row-start-2 xl:col-span-1 xl:col-start-1 xl:row-start-1 xl:flex xl:flex-col xl:items-stretch">
          <Card className="flex flex-col px-1.5 pt-1.5 pb-3">
            <div className="flex items-center gap-2.75 px-2.75 pt-2.5 pb-2">
              <span className="flex size-8.5 flex-none items-center justify-center rounded-tab bg-tile-sage text-icon-sage">
                <RailIcon name="calendar" />
              </span>
              <span className="flex min-w-0 flex-col gap-px">
                <h2 dir="auto" className="text-[16px] font-semibold">
                  {he.home.rail.balances}
                </h2>
                <span dir="auto" className="text-[13px] font-light text-ink-quiet">
                  {he.home.rail.balancesNote}
                </span>
              </span>
            </div>
            {workers.map((each) => (
              <div key={each.id} className="mt-0.5 flex flex-col gap-1.5 border-t border-line px-2.75 pt-2.25">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className={`size-2 flex-none rounded-full ${workerDot}`} />
                  <span dir="auto" className="truncate text-[14px] font-semibold text-ink-warm">
                    {each.name}
                  </span>
                </span>
                {fixtureOf(each.id).result.balances.map((balance) => {
                  const key = `${each.id}-${balance.kind}-balance`;
                  return (
                    <div key={balance.kind} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="flex min-w-0 items-center gap-1.75">
                          <span dir="auto" className="text-[15px] font-light text-ink-soft">
                            {marks[balance.kind]}
                          </span>
                          <WhyButton
                            controls={`why-${key}`}
                            open={openWhy === key}
                            onToggle={() => toggleWhy(key)}
                            label={he.why.balanceLabel}
                          />
                        </span>
                        <span className="flex-none text-[15px] font-semibold whitespace-nowrap">
                          <Bidi noTranslate>
                            {balance.closing === null ? he.placeholder.count : formatDays(balance.closing)}
                          </Bidi>
                          <span> </span>
                          <span dir="auto" className="font-light text-ink-quiet">
                            {he.units.days}
                          </span>
                        </span>
                      </div>
                      <WhyPanel id={`why-${key}`} open={openWhy === key} explanation={balance.explanation} />
                    </div>
                  );
                })}
              </div>
            ))}
          </Card>

          {/* Exporting is a screen rather than a bare download: the minimum wage
              is confirmed before every export (item 4), and that is where. One
              entry to it on this screen, not two (the user, 2026-09-15). */}
          <Link href="/month/export" className={`${railLink} rounded-card border border-line bg-surface px-3 py-2.75`}>
            <span className="flex size-8.5 flex-none items-center justify-center rounded-tab bg-tile-sage text-icon-sage">
              <RailIcon name="sheet" className="size-4" />
            </span>
            <span className="flex min-w-0 flex-auto flex-col gap-px">
              <span dir="auto" className="text-[16px] font-semibold">
                {he.home.paid.exportToExcel}
              </span>
              <span dir="auto" className="text-[13px] font-light text-ink-quiet">
                {he.home.rail.exportNote}
              </span>
            </span>
            <Chevron towards="next" className="text-chevron-soft" />
          </Link>
        </aside>

        {/* v4's row of action cards is left out: the tabs, the money card's
            link and the blockers already lead to each of them (the user,
            2026-09-15). */}
      </div>
    </>
  );
}
