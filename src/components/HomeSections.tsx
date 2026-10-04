"use client";

/**
 * Two sections of the opening screen that say nothing about the month being
 * edited: what stops a correct salary (item 27), and the balances rail beside
 * the calendar (criterion 2).
 *
 * **They are here because they are whole sections and not fragments of one**:
 * each takes what it draws and holds no state, which is what lets the screen
 * next door stay the calendar, the day and the money.
 */

import Link from "next/link";
import { AlertTitle, LawLink, Sentence } from "@/components/AlertsScreen";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { Chevron, RailIcon } from "@/components/icons";
import { WhyButton, WhyPanel } from "@/components/WhyDisclosure";
import type { WorkerMonths } from "@/components/HomeScreen";
import { railLink, workerDot } from "@/components/HomeScreen";
import { sameMonth } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { touchTargetClass } from "@/components/Field";
import type { FirstOf } from "@/lib/alertsView";
import { he } from "@/lib/i18n/he";
import { formatDays } from "@/lib/money";
import { returningTo } from "@/lib/pickerReturn";
import type { YearMonth } from "@/lib/types";

/** What stops the month being calculated correctly, first (specs.md item 27).
 *
 * `heading` is the level, not a style: the strip leads the home screen, so its
 * name is that screen's `h1` and the month below it an `h2`. The home screen
 * decides, because only it knows whether the strip is drawn at all. */
export function Blockers({
  blockages,
  heading: Heading = "h2",
}: {
  blockages: FirstOf;
  heading?: "h1" | "h2";
}) {
  if (blockages.shown.length === 0) return null;
  return (
      <section aria-labelledby="home-blockers" className="flex flex-none flex-col gap-1.5">
        <Heading id="home-blockers" dir="auto" className="text-[15px] font-semibold text-ink-warm">
          {he.status.needsAttention}
        </Heading>
        <ul className="grid items-start gap-2.5 sm:grid-cols-2">
          {blockages.shown.map((card: FirstOf["shown"][number]) => (
            <li key={card.id} className="min-w-0">
              <Card
                radius="sm"
                data-role="blocker"
                className="flex min-w-0 flex-col gap-0.5 px-3.5 py-2.25"
              >
                {/* Title and action on one line and the note under them: the
                    strip leads the screen, so it spends as little height as
                    it can. */}
                <div className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden="true" className="size-2 flex-none rounded-full bg-clay" />
                  <span data-role="blocker-title" className="min-w-0 flex-auto text-[15px] font-semibold">
                    <AlertTitle card={card} />
                  </span>
                  <Link
                    href={returningTo(card.action.href, "/")}
                    prefetch={false}
                    className={`${touchTargetClass} flex-none text-[14px] font-medium whitespace-nowrap hover:underline hover:underline-offset-4`}
                  >
                    <span dir="auto">{card.action.label}</span>
                  </Link>
                </div>
                <span className="ps-4.5 text-[14px] leading-[1.45] font-light text-ink-mute text-pretty">
                  <Sentence said={card.note} />
                </span>
                {card.law ? (
                  <LawLink law={card.law} className="ps-4.5 text-[13px]" />
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
        {blockages.more > 0 ? (
          <p data-role="blockers-more" className="flex items-center gap-2 text-[14px]">
            <Sentence said={he.alerts.more(blockages.more)} />
            <span aria-hidden="true" className="text-ink-faint">
              ·
            </span>
            <Link
              href="/alerts"
              prefetch={false}
              className={`${touchTargetClass} font-medium text-forest hover:underline hover:underline-offset-4`}
            >
              <span dir="auto">{he.header.bell.showAll}</span>
            </Link>
          </p>
        ) : null}
      </section>
  );
}

/**
 * The balances of every worker in the household for the month on screen, and
 * the way to the export.
 *
 * **Both workers, not the one the switcher shows**, because the rail answers
 * "where does the household stand" while the calendar answers "what happened
 * in this month to them".
 */
export function BalancesRail({
  workers,
  household,
  month,
  fallbackRestDay,
  openWhy,
  toggleWhy,
}: {
  workers: { id: string; name: string }[];
  household: WorkerMonths[];
  month: YearMonth;
  /** The rest day to name a worker's marks by where no month of theirs says. */
  fallbackRestDay: RestDay;
  openWhy: string | null;
  toggleWhy: (key: string) => void;
}) {
  // **A worker the engine refused is left out of the rail, and only them.** A
  // balance cannot be derived from a month the engine declined to value
  // (item 13), and their rows would otherwise draw the bracketed placeholder in
  // every figure — the same answer the money column gives. Their card above says
  // why they are missing. Where nobody is left the whole card goes, which is what
  // a one-worker household in a refused state sees.
  const stated = workers.filter(
    (each) =>
      household.find((candidate) => candidate.worker.id === each.id)?.refused ==
      null,
  );
  return (
    <aside
      className={`order-3 grid min-w-0 items-start gap-3 ${stated.length === 0 ? "" : "sm:grid-cols-2"} lg:col-span-2 lg:row-start-2 xl:col-span-1 xl:col-start-1 xl:row-start-1 xl:flex xl:flex-col xl:items-stretch`}
    >
      {stated.length === 0 ? null : (
        <Card data-role="balances" className="flex flex-col px-1.5 pt-1.5 pb-3">
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
          {stated.map((each) => {
            // Their own month, and the balances it closed with. A worker with no
            // record of this month has no balance to state, and the rows say
            // so with the same placeholder the calendar's own figures use —
            // the same rule the calendar follows when it draws them nothing.
            const hers = household.find((candidate) => candidate.worker.id === each.id);
            const herMonth = hers?.months.find((inSeries) =>
              sameMonth(inSeries.facts.month, month),
            );
            const herMarks = he.calendar.marks(
              herMonth?.facts.terms.restDay ?? hers?.restDay ?? fallbackRestDay,
            );
            // A fact about the worker and not about the month on screen: it was
            // counted on the server against the month today falls in (item 21),
            // so stepping the calendar never moves it.
            const markedAhead = hers?.vacationMarkedAhead ?? 0;
            return (
              <div key={each.id} className="mt-0.5 flex flex-col gap-1.5 border-t border-line px-2.75 pt-2.25">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className={`size-2 flex-none rounded-full ${workerDot}`} />
                  <span dir="auto" className="truncate text-[14px] font-semibold text-ink-warm">
                    {each.name}
                  </span>
                </span>
                {/* A worker with no record of this month has no balance to
                    state, so the two rows are drawn with the placeholder
                    rather than left out — a missing row reads as a worker who
                    has no vacation at all. There is no "?" beside them for
                    the same reason: nothing was calculated to explain. */}
                {herMonth === undefined
                  ? (["vacation", "sick"] as const).map((kind) => (
                      <div key={kind} className="flex items-center justify-between gap-2.5">
                        <span dir="auto" className="min-w-0 text-[15px] font-light text-ink-soft">
                          {herMarks[kind]}
                        </span>
                        <span className="flex-none text-[15px] font-semibold whitespace-nowrap">
                          <Bidi noTranslate>{he.placeholder.count}</Bidi>
                          <span> </span>
                          <span dir="auto" className="font-light text-ink-quiet">
                            {he.units.days}
                          </span>
                        </span>
                      </div>
                    ))
                  : null}
                {(herMonth?.result.balances ?? []).map((balance) => {
                  const key = `${each.id}-${balance.kind}-balance`;
                  return (
                    <div key={balance.kind} data-row={key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="flex min-w-0 flex-col gap-px">
                          <span className="flex min-w-0 items-center gap-1.75">
                            <span dir="auto" className="text-[15px] font-light text-ink-soft">
                              {herMarks[balance.kind]}
                            </span>
                            <WhyButton
                              controls={`why-${key}`}
                              open={openWhy === key}
                              onToggle={() => toggleWhy(key)}
                              label={he.why.balanceLabel}
                              subject={herMarks[balance.kind]}
                            />
                          </span>
                          {/* Criterion 2 asks for the days used beside the
                              balance: a balance with no days behind it cannot
                              be checked, and this month's are what the user
                              just changed by marking a day. v4 draws only the
                              balance — a departure recorded in `DESIGN.md`. */}
                          <span className="text-[13px] font-light text-ink-quiet">
                            <span dir="auto">{he.sheet.reporting.daysUsed}</span>
                            <span>: </span>
                            <Bidi noTranslate>{formatDays(balance.used ?? 0)}</Bidi>
                          </span>
                          {/* Vacation marked in a month after the current one,
                              said under the days used and outside the balance
                              (item 21). No month after this one is valued, so
                              nothing marked in one has come off the balance —
                              and a day the user recorded with nothing on screen
                              to acknowledge it reads as a day that was never
                              saved. Drawn only where there is something to say,
                              since a nil line would sit under every balance for
                              the whole of a year. v4 draws neither hint — a
                              departure recorded in `DESIGN.md`. */}
                          {balance.kind === "vacation" && markedAhead > 0 ? (
                            <span
                              data-row={`${each.id}-vacation-ahead`}
                              className="text-[13px] font-light text-ink-quiet"
                            >
                              <span dir="auto">{he.home.rail.markedAhead}</span>
                              <span>: </span>
                              <Bidi noTranslate>{formatDays(markedAhead)}</Bidi>
                            </span>
                          ) : null}
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
            );
          })}
        </Card>
      )}

      {/* Exporting is a screen rather than a bare download: the minimum wage
          is confirmed before every export (item 4), and that is where. One
          entry to it on this screen, not two. */}
      <Link href="/month/export" prefetch={false} className={`${railLink} rounded-card border border-line bg-surface px-3 py-2.75`}>
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
  );
}
