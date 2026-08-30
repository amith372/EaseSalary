"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { Chevron, SheetBadge, Sprout } from "@/components/icons";
import { MonthCalendar } from "@/components/MonthCalendar";
import { MoneyValue } from "@/components/MoneyValue";
import { ValueChip } from "@/components/ValueChip";
import { useWorkerScope } from "@/components/WorkerScope";
import { WhyButton, WhyPanel } from "@/components/WhyDisclosure";
import { compareIsoDate, daysInMonth, fromIsoDate, isoOf, orderDates } from "@/lib/dates";
import { fixtureMonth, fixtureToday, homeFixtures } from "@/lib/fixtures/home";
import { he } from "@/lib/i18n/he";
import { formatDays } from "@/lib/money";
import { applyMark, spanOverflow, type SkippedDay, type SkipReason } from "@/lib/spans";
import type { DaySpan, IsoDate, YearMonth } from "@/lib/types";
import type { SpanIntent } from "@/components/MonthCalendar";

/**
 * The opening screen, built as `EaseSalary - דף הבית v3 לוח במרכז` draws it: the
 * calendar takes the middle of the screen and the month is marked where the
 * application opens, rather than one screen further in (specs.md item 27).
 *
 * It is the one screen that computes nothing: every amount and count arrives in
 * the calculation engine's own types with a fixture standing in, so the contract
 * is fixed now and Stage 1 fills it in without this file changing. What it does
 * own is the marking of days — the merge of a chosen range into what is already
 * stored. The entitlement rules behind that merge live in `src/lib/spans.ts`,
 * because which days inside a range take the mark is calculation rather than
 * interaction.
 *
 * Marks are client state only. Nothing is stored until Stage 3, and the screen
 * keeps them for as long as the page is open and no longer.
 *
 * The greeting and the worker switcher v3 draws in a row above the calendar are
 * in the top bar instead, so the screen opens straight onto the month. Which
 * worker is shown is therefore read from the shell rather than held here.
 */

function monthLabel(ym: YearMonth): string {
  return `${he.calendar.monthNames[ym.month - 1]} ${ym.year}`;
}

function dayLabel(iso: IsoDate): string {
  const date = fromIsoDate(iso);
  return `${date.getUTCDate()} ${he.calendar.monthNames[date.getUTCMonth()]}`;
}

function overlapsMonth(span: DaySpan, monthStart: IsoDate, monthEnd: IsoDate): boolean {
  const { from, to } = orderDates(span.from, span.to);
  return compareIsoDate(from, monthEnd) <= 0 && compareIsoDate(to, monthStart) >= 0;
}

function overlapsRange(span: DaySpan, from: IsoDate, to: IsoDate): boolean {
  const ordered = orderDates(span.from, span.to);
  return compareIsoDate(ordered.from, to) <= 0 && compareIsoDate(ordered.to, from) >= 0;
}

export default function Home() {
  const { worker } = useWorkerScope();
  const [month, setMonth] = useState<YearMonth>(fixtureMonth);
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  // A refusal belongs to the gesture that produced it, and that gesture was made
  // against one worker: it is stamped with whose it was rather than cleared by
  // an effect watching the switcher, which would run a render late.
  const [skipped, setSkipped] = useState<{ workerId: string; days: SkippedDay[] } | null>(null);
  const [spansByWorker, setSpansByWorker] = useState<Record<string, DaySpan[]>>(() =>
    Object.fromEntries(homeFixtures.map((f) => [f.worker.id, f.spans])),
  );

  const fixture = homeFixtures.find((f) => f.worker.id === worker.id) ?? homeFixtures[0];
  const { result, alerts } = fixture;
  const spans = spansByWorker[worker.id];

  const toggleWhy = (key: string) =>
    setOpenWhy((current) => (current === key ? null : key));

  function handleSelectRange(intent: SpanIntent) {
    const { spans: added, skipped: refused } = applyMark(intent, spans);
    setSpansByWorker((current) => ({
      ...current,
      [worker.id]: [...current[worker.id], ...added],
    }));
    setSkipped({ workerId: worker.id, days: refused });
  }

  /** A span is one thing: a range that touches it clears the whole of it rather
   * than punching a hole, which for a sick spell would change what it pays
   * (specs.md item 8). */
  function handleClearRange(from: IsoDate, to: IsoDate) {
    setSpansByWorker((current) => ({
      ...current,
      [worker.id]: current[worker.id].filter((span) => !overlapsRange(span, from, to)),
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

  const overflowing = useMemo(() => {
    const monthStart = isoOf(month, 1);
    const monthEnd = isoOf(month, daysInMonth(month));
    return spans
      .filter((span) => overlapsMonth(span, monthStart, monthEnd))
      .map((span) => ({ span, ...spanOverflow(span, monthStart, monthEnd) }))
      .filter(({ before, after }) => before || after);
  }, [spans, month]);

  return (
    <>
      {/* `flex-1` lets the calendar take the surplus when the screen has room to
          spare, and nothing here is given `min-h-0`: a flex child that may not
          shrink below its own content is what keeps this section from being
          sized shorter than the cards inside it and painting over the alerts
          below. When the content genuinely does not fit, the page scrolls. */}
      <section className="grid flex-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card radius="lg" className="flex min-h-72 min-w-0 flex-col px-5 pt-3.5 pb-3">
          <MonthCalendar
            month={month}
            spans={spans}
            today={fixtureToday}
            onMonthChange={setMonth}
            onSelectRange={handleSelectRange}
            onClearRange={handleClearRange}
            className="flex-1"
          />

          {/* A span running past the month on screen is stored whole and drawn
              clipped, so the overflow is said in words rather than looking like
              a span that simply ended on the last of the month (item 8). */}
          {overflowing.length > 0 ? (
            <ul className="mt-2.5 flex flex-none flex-col gap-1">
              {overflowing.map(({ span, before }) => (
                <li key={span.id} className="text-[14px] font-light text-ink-mute">
                  <span>{he.calendar.marks[span.kind]}</span>
                  <span> · </span>
                  <Bidi>{dayLabel(span.from)}</Bidi>
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
                </li>
              ))}
            </ul>
          ) : null}

          {refusals.length > 0 ? (
            <Card tone="inset" radius="panel" className="mt-2.5 flex flex-none flex-col gap-1.5 px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span dir="auto" className="text-[14px] font-semibold text-ink-warm">
                  {he.calendar.skipped.title}
                </span>
                <button
                  type="button"
                  onClick={() => setSkipped(null)}
                  className="text-[13px] font-medium text-ink-quiet transition-colors hover:text-ink"
                >
                  <span dir="auto">{he.calendar.skipped.dismiss}</span>
                </button>
              </div>
              <ul aria-live="polite" className="flex flex-col gap-1">
                {refusals.map(([reason, dates]) => (
                  <li
                    key={reason}
                    className="text-[14px] leading-[1.5] font-light text-ink-warm text-pretty"
                  >
                    {dates.map((date, index) => (
                      <span key={date}>
                        {index > 0 ? <span>, </span> : null}
                        <Bidi>{dayLabel(date)}</Bidi>
                      </span>
                    ))}
                    <span> — </span>
                    <span>{he.calendar.skipped[reason]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* The balances sit under the calendar rather than in a card of their
              own on the right: they are a count of the days marked above them,
              and as a third card they were what pushed the screen past the fold
              — the whole right column had to be as tall as all three. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-2.5">
            <span dir="auto" className="text-[15px] font-light text-ink-quiet">
              {he.home.balances.title}
            </span>
            {result.balances.map((balance) => (
              <div key={balance.kind} className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center gap-2.25">
                  <span className="flex items-center gap-2.5 text-[16px] font-light text-ink-warm">
                    <span
                      aria-hidden="true"
                      className={[
                        "size-2.5 flex-none rounded-full",
                        balance.kind === "vacation" ? "bg-vacation-dot" : "bg-sick-dot",
                      ].join(" ")}
                    />
                    <span dir="auto">{he.home.balances[balance.kind]}</span>
                  </span>
                  <ValueChip className="text-[16px] font-semibold">
                    <Bidi noTranslate>
                      {balance.closing === null
                        ? he.placeholder.count
                        : formatDays(balance.closing)}
                    </Bidi>
                    <span> </span>
                    <span dir="auto">{he.units.days}</span>
                  </ValueChip>
                  <WhyButton
                    controls={`why-${balance.kind}-balance`}
                    open={openWhy === `${balance.kind}-balance`}
                    onToggle={() => toggleWhy(`${balance.kind}-balance`)}
                    label={he.why.balanceLabel}
                  />
                </div>
                <WhyPanel
                  id={`why-${balance.kind}-balance`}
                  open={openWhy === `${balance.kind}-balance`}
                  explanation={balance.explanation}
                />
              </div>
            ))}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-2.5">
          {/* The card names the month that needs attention, which is not the
              month the calendar happens to be showing: browsing to September
              does not make September the month that is due. */}
          <Card className="flex flex-none flex-col gap-1.5 px-4.5 py-3">
            <div className="flex items-start justify-between gap-3.5">
              <span dir="auto" className="text-[15px] text-ink-quiet">
                {he.status.needsAttention}
              </span>
              <Sprout />
            </div>
            {/* The page's heading, now that the greeting row is in the bar: it
                names the month the screen is about. */}
            <h1
              dir="auto"
              className="text-[20px] leading-[1.25] font-bold tracking-[-0.02em] text-balance"
            >
              <Bidi>{monthLabel(fixtureMonth)}</Bidi>
              <span> </span>
              <span>{he.home.hero.readyToCalculate}</span>
            </h1>
            <p dir="auto" className="text-[15px] leading-[1.5] font-light text-ink-mute text-pretty">
              {he.home.hero.body}
            </p>
            <Link
              href="/month"
              className="mt-0.5 flex items-center justify-center gap-2.5 rounded-day bg-sage px-4.5 py-2.5 text-[16px] font-semibold text-sage-ink transition-colors hover:bg-sage-hover hover:text-sage-ink-hover"
            >
              <span dir="auto">{he.home.hero.action}</span>
              <Chevron towards="next" />
            </Link>
          </Card>

          <Card className="flex flex-none flex-col gap-1.5 px-4.5 py-3">
            <span dir="auto" className="text-[17px] font-semibold">
              {he.home.paid.title}
            </span>

            {result.lines.map((line) => (
              <div key={line.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span dir="auto" className="text-[16px] font-light text-ink-warm">
                    {line.label}
                  </span>
                  <span className="flex items-center gap-2.25">
                    <MoneyValue agorot={line.amount} chip="warm" manual={line.manual} />
                    <WhyButton
                      controls={`why-${line.key}`}
                      open={openWhy === line.key}
                      onToggle={() => toggleWhy(line.key)}
                    />
                  </span>
                </div>
                <WhyPanel
                  id={`why-${line.key}`}
                  open={openWhy === line.key}
                  explanation={line.explanation}
                />
              </div>
            ))}

            <Card tone="tint" radius="tint" className="mt-0.5 flex flex-col gap-2 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span dir="auto" className="text-[17px] font-semibold">
                  {he.home.paid.total}
                </span>
                <span className="flex items-center gap-2.25">
                  <MoneyValue agorot={result.net} size="lg" chip="plain" />
                  <WhyButton
                    controls="why-total"
                    open={openWhy === "total"}
                    onToggle={() => toggleWhy("total")}
                  />
                </span>
              </div>
              <WhyPanel
                id="why-total"
                open={openWhy === "total"}
                explanation={{ text: he.home.paid.totalExplanation }}
                within="tint"
              />
            </Card>

            {/* Exporting is a screen rather than a bare download: the minimum
                wage is confirmed before every export (item 4), and that
                confirmation is built in Stage 5. */}
            <Link
              href="/month/export"
              className="mt-0.5 flex items-center justify-center gap-2.5 rounded-day bg-sage-soft px-4 py-2.25 text-[15px] font-semibold text-sage-ink transition-colors hover:bg-sage-soft-hover hover:text-sage-ink-hover"
            >
              <SheetBadge />
              <span dir="auto">{he.home.paid.exportToExcel}</span>
            </Link>
            <Link
              href="/sheet"
              className="flex items-center justify-center gap-2.25 text-[15px] font-normal text-ink-mute transition-colors hover:text-forest"
            >
              <span dir="auto">{he.home.paid.fullSheet}</span>
              <Chevron towards="next" />
            </Link>
          </Card>

        </div>
      </section>

      <section className="flex flex-none flex-col gap-1">
        <h3
          dir="auto"
          className="text-[13px] font-semibold tracking-[0.08em] text-ink-quiet"
        >
          {he.home.alerts.title}
        </h3>
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {alerts.map((alert) => (
            <Card
              key={alert.key}
              radius="sm"
              className="flex min-w-0 flex-col gap-0.75 px-3.5 py-2.25"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden="true" className="size-2 flex-none rounded-full bg-clay-soft" />
                <span dir="auto" className="min-w-0 text-[16px] font-semibold">
                  {alert.title}
                </span>
              </div>
              <span
                dir="auto"
                className="text-[14px] leading-[1.45] font-light text-ink-mute text-pretty"
              >
                {alert.note}
              </span>
              <div className="mt-0.5 flex items-center justify-between gap-2.5">
                <Link
                  href="/alerts"
                  className="text-[15px] font-medium whitespace-nowrap hover:underline hover:underline-offset-4"
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
              <div className="mt-1 empty:mt-0">
                <WhyPanel
                  id={`why-${alert.key}`}
                  open={openWhy === alert.key}
                  explanation={alert.explanation}
                />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
