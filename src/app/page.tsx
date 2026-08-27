"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { Chevron, SheetBadge } from "@/components/icons";
import { MarkToolPicker } from "@/components/MarkToolPicker";
import { MonthCalendar, type SpanIntent } from "@/components/MonthCalendar";
import { MoneyValue } from "@/components/MoneyValue";
import { StatusPill } from "@/components/StatusPill";
import { WhyButton, WhyPanel } from "@/components/WhyDisclosure";
import { compareIsoDate, daysInMonth, fromIsoDate, isoOf, orderDates } from "@/lib/dates";
import { fixtureMonth, fixtureToday, homeFixtures } from "@/lib/fixtures/home";
import { he } from "@/lib/i18n/he";
import { legalLink } from "@/lib/links";
import { formatDays } from "@/lib/money";
import { applyMark, spanOverflow, type SkippedDay, type SkipReason } from "@/lib/spans";
import type { DaySpan, IsoDate, MarkKind, YearMonth } from "@/lib/types";

/**
 * The opening screen, built as `EaseSalary - דף הבית v2` draws it.
 *
 * It is the one screen that computes nothing: every amount and count arrives in
 * the calculation engine's own types with a fixture standing in, so the contract
 * is fixed now and stage 1 fills it in without this file changing. What it does
 * own is the marking of days — the tool picker, and the merge of a swept range
 * into what is already stored. The entitlement rules behind that merge live in
 * `src/lib/spans.ts`, because which days inside a range take the mark is
 * calculation rather than interaction.
 *
 * Marks are client state only. Nothing is stored until stage 3, and the screen
 * keeps them for as long as the page is open and no longer.
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

export default function Home() {
  const [workerIndex, setWorkerIndex] = useState(0);
  const [month, setMonth] = useState<YearMonth>(fixtureMonth);
  const [tool, setTool] = useState<MarkKind | null>("vacation");
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<SkippedDay[]>([]);
  const [spansByWorker, setSpansByWorker] = useState<Record<string, DaySpan[]>>(() =>
    Object.fromEntries(homeFixtures.map((f) => [f.worker.id, f.spans])),
  );

  const fixture = homeFixtures[workerIndex];
  const { worker, result, alerts } = fixture;
  const spans = spansByWorker[worker.id];

  const toggleWhy = (key: string) =>
    setOpenWhy((current) => (current === key ? null : key));

  function stepWorker(by: number) {
    setWorkerIndex((index) => (index + by + homeFixtures.length) % homeFixtures.length);
    // A refusal belongs to the gesture that produced it, and that gesture was
    // made against the worker being left behind.
    setSkipped([]);
  }

  function handleSelectRange(intent: SpanIntent) {
    const { spans: added, skipped: refused } = applyMark(intent, spans);
    setSpansByWorker((current) => ({
      ...current,
      [worker.id]: [...current[worker.id], ...added],
    }));
    setSkipped(refused);
  }

  function handleClearSpan(spanId: string) {
    setSpansByWorker((current) => ({
      ...current,
      [worker.id]: current[worker.id].filter((span) => span.id !== spanId),
    }));
    setSkipped([]);
  }

  /** Grouped by reason, so a week swept across five taken days reads as one
   * sentence rather than five. */
  const refusals = useMemo(() => {
    const byReason = new Map<SkipReason, IsoDate[]>();
    for (const day of skipped) {
      const dates = byReason.get(day.reason);
      if (dates) dates.push(day.date);
      else byReason.set(day.reason, [day.date]);
    }
    return [...byReason.entries()];
  }, [skipped]);

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
      <section className="flex flex-wrap items-end justify-between gap-7">
        <div className="flex flex-col gap-1.5">
          <h1 dir="auto" className="text-[34px] font-semibold tracking-[-0.02em] text-balance">
            <span>{he.home.greeting}</span>
            <span> </span>
            <Bidi>{he.header.yourName}</Bidi>
          </h1>
          <p dir="auto" className="text-[18px] font-light text-ink-soft">
            <span>{he.home.monthOf}</span>
            <span> </span>
            <Bidi>{worker.name}</Bidi>
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface p-2">
          <button
            type="button"
            aria-label={he.home.workerSwitcher.previous}
            onClick={() => stepWorker(-1)}
            className="flex size-8.5 items-center justify-center rounded-xs text-ink-mute transition-colors hover:bg-sand-hover hover:text-ink"
          >
            <Chevron towards="previous" />
          </button>
          <div className="flex min-w-33 flex-col items-center gap-px px-2.5">
            <span dir="auto" className="text-[13px] font-light text-ink-faint">
              {he.home.workerSwitcher.showing}
            </span>
            <Bidi className="text-[18px] font-semibold">{worker.name}</Bidi>
          </div>
          <button
            type="button"
            aria-label={he.home.workerSwitcher.next}
            onClick={() => stepWorker(1)}
            className="flex size-8.5 items-center justify-center rounded-xs text-ink-mute transition-colors hover:bg-sand-hover hover:text-ink"
          >
            <Chevron towards="next" />
          </button>
        </div>
      </section>

      {/* The hero names the month that needs attention, which is not the month
          the calendar happens to be showing: browsing to September does not make
          September the month that is due. */}
      <Card
        as="section"
        elevated
        className="flex flex-wrap items-center justify-between gap-6.5 px-8 py-7"
      >
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
          <StatusPill size="sm" className="self-start">
            {he.status.needsAttention}
          </StatusPill>
          <h2
            dir="auto"
            className="mt-1.5 text-[32px] leading-[1.2] font-bold tracking-[-0.03em] text-balance"
          >
            <Bidi>{monthLabel(fixtureMonth)}</Bidi>
            <span> </span>
            <span>{he.home.hero.readyToCalculate}</span>
          </h2>
          <p dir="auto" className="max-w-[52ch] text-[17px] font-light text-ink-soft text-pretty">
            {he.home.hero.body}
          </p>
        </div>
        <Link
          href="/month"
          className="rounded-sm bg-forest px-8.5 py-3.75 text-[19px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white"
        >
          <span dir="auto">{he.home.hero.action}</span>
        </Link>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="flex min-w-0 flex-col gap-5 px-7 pt-6.5 pb-5.5">
          <div className="flex flex-col gap-2">
            <MarkToolPicker value={tool} onChange={setTool} />
            <span dir="auto" className="text-[14px] font-light text-ink-faint">
              {he.calendar.tools.hint}
            </span>
          </div>

          <MonthCalendar
            month={month}
            spans={spans}
            tool={tool}
            today={fixtureToday}
            onMonthChange={setMonth}
            onSelectRange={handleSelectRange}
            onClearSpan={handleClearSpan}
          />

          {/* A span running past the month on screen is stored whole and drawn
              clipped, so the overflow is said in words rather than looking like
              a span that simply ended on the last of the month (item 8). */}
          {overflowing.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {overflowing.map(({ span, before }) => (
                <li key={span.id} className="text-[15px] font-light text-ink-soft">
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
            <Card tone="inset" className="flex flex-col gap-2 rounded-xs px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span dir="auto" className="text-[15px] font-semibold text-ink-warm">
                  {he.calendar.skipped.title}
                </span>
                <button
                  type="button"
                  onClick={() => setSkipped([])}
                  className="text-[14px] font-medium text-ink-faint transition-colors hover:text-ink"
                >
                  <span dir="auto">{he.calendar.skipped.dismiss}</span>
                </button>
              </div>
              <ul aria-live="polite" className="flex flex-col gap-1.5">
                {refusals.map(([reason, dates]) => (
                  <li
                    key={reason}
                    className="text-[15px] leading-[1.55] font-light text-ink-warm text-pretty"
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
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card tone="sand" eyebrow={he.home.paid.title} className="min-w-0 px-6.5 py-6">
            <div className="flex flex-col gap-4">
              {result.lines.map((line) => (
                <div key={line.key} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3.5">
                    <span dir="auto" className="text-[17px] font-light text-ink-warm">
                      {line.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <MoneyValue agorot={line.amount} manual={line.manual} />
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
                    within="sand"
                  />
                </div>
              ))}

              <div className="flex flex-col gap-2 border-t border-sand-line pt-4">
                <div className="flex items-baseline justify-between gap-3.5">
                  <span dir="auto" className="text-[18px] font-semibold">
                    {he.home.paid.total}
                  </span>
                  <span className="flex items-center gap-2">
                    <MoneyValue agorot={result.totalToWorker} size="xl" />
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
                  within="sand"
                />
              </div>

              {/* Exporting is a screen rather than a bare download: the minimum
                  wage is confirmed before every export (item 4), and that
                  confirmation is built in stage 5. */}
              <Link
                href="/month/export"
                className="flex items-center justify-center gap-2.5 rounded-sm bg-forest px-4.5 py-3.25 text-[17px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white"
              >
                <SheetBadge />
                <span dir="auto">{he.home.paid.exportToExcel}</span>
              </Link>
              <Link
                href="/sheet"
                className="text-center text-[16px] font-medium hover:underline hover:underline-offset-4"
              >
                <span dir="auto">{he.home.paid.fullSheet}</span>
              </Link>
            </div>
          </Card>

          <Card eyebrow={he.home.balances.title} className="min-w-0 px-6.5 py-6">
            <div className="flex flex-col gap-3.5">
              {result.balances.map((balance) => (
                <div key={balance.kind} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3.5">
                    <span className="flex items-center gap-2.5 text-[17px] font-light text-ink-warm">
                      <span
                        aria-hidden="true"
                        className={[
                          "size-2 flex-none rounded-full",
                          balance.kind === "vacation" ? "bg-vacation" : "bg-sick",
                        ].join(" ")}
                      />
                      <span dir="auto">{he.home.balances[balance.kind]}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[17px] font-semibold">
                        <Bidi>
                          {balance.closing === null
                            ? he.placeholder.count
                            : formatDays(balance.closing)}
                        </Bidi>
                        <span> </span>
                        <span>{he.units.days}</span>
                      </span>
                      <WhyButton
                        controls={`why-${balance.kind}-balance`}
                        open={openWhy === `${balance.kind}-balance`}
                        onToggle={() => toggleWhy(`${balance.kind}-balance`)}
                        label={he.why.balanceLabel}
                      />
                    </span>
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
        </div>
      </section>

      <section className="flex flex-col gap-0.5">
        <h3
          dir="auto"
          className="mb-2 text-[14px] font-semibold tracking-[0.08em] text-ink-faint"
        >
          {he.home.alerts.title}
        </h3>
        {alerts.map((alert) => {
          const link = alert.link ? legalLink(alert.link) : undefined;
          return (
            <div
              key={alert.key}
              className="flex flex-wrap items-center gap-4.5 border-t border-hairline px-1 py-5"
            >
              <span aria-hidden="true" className="size-2 flex-none rounded-full bg-holiday" />
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.75">
                <span dir="auto" className="text-[19px] font-semibold">
                  {alert.title}
                </span>
                <span dir="auto" className="text-[16px] font-light text-ink-soft text-pretty">
                  {alert.note}
                </span>
              </div>
              {link ? (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[15px] font-normal whitespace-nowrap text-ink-faint transition-colors hover:text-forest hover:underline hover:underline-offset-[3px]"
                >
                  <span dir="auto">{he.home.alerts.whatTheLawSays}</span>
                </a>
              ) : null}
              <Link
                href="/alerts"
                className="text-[16px] font-medium whitespace-nowrap hover:underline hover:underline-offset-4"
              >
                <span dir="auto">{alert.action}</span>
              </Link>
            </div>
          );
        })}
      </section>
    </>
  );
}
