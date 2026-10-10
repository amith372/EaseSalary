"use client";

import Link from "next/link";
import { useState } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { busyAttrs } from "@/components/Field";
import { MoneyValue } from "@/components/MoneyValue";
import { useOneAtATime } from "@/components/useAction";
import { confirmMonths } from "@/app/workers/[id]/actions";
import { monthOf, sameMonth } from "@/lib/dates";
import { monthLabel } from "@/lib/dateLabels";
import type { BulkConfirmVerdict } from "@/lib/engine/bulkConfirm";
import type { MonthState } from "@/lib/engine/monthState";
import { he } from "@/lib/i18n/he";
import type { ConfirmedFigures } from "@/lib/monthConfirmation";
import { formatAgorot, formatDays, formatRate } from "@/lib/money";
import type { Gender } from "@/lib/engine/types";
import type { YearMonth } from "@/lib/types";

/**
 * The worker's own list of months — the artboard's `החודשים` — and the ticks
 * that confirm the finished drafts among them without an export (specs.md item
 * 18's last paragraph).
 *
 * **Nothing here decides anything.** Whether a month may be confirmed is the
 * server's verdict, worked out on the page and handed down per row; the action
 * asks the same rule again, so a row whose tick was crafted past the screen
 * meets the same refusal. What the browser holds is which rows are ticked.
 *
 * **The reason a month has no tick is drawn on its own row**, where the month it
 * is about is, rather than gathered into one sentence above the list that would
 * name months the eye then has to find.
 */

/** One month as the list draws it: what it held, what it paid, the state it is
 * in and whether it may be confirmed from here. */
export interface ProfileMonth {
  month: YearMonth;
  netAgorot: number | null;
  grossAgorot: number | null;
  /** Part 5's four states, derived from the store's own instants. */
  state: MonthState;
  /**
   * Whether a tick may confirm this month, and why not where it may not
   * (`bulkConfirmVerdict`).
   */
  confirmable: BulkConfirmVerdict;
  /**
   * The figures a tick would confirm it at, or `null` where none would — the
   * same figures the write uses (`bulkConfirmFigures`), so the wage shown above
   * the button is the wage that is stored and not a second reading of the table.
   */
  confirmAt: ConfirmedFigures | null;
  /**
   * The days behind the figure — the days actually worked, and each kind drawn
   * from a balance. They are the pre-export questions' own counts, which is
   * what the payslip lists a month's days from, so no month is counted twice
   * two ways.
   */
  days: {
    worked: number | null;
    vacation: number;
    sick: number;
    holidays: number;
  };
}

/** Which months a tick may reach. */
function tickable(months: ProfileMonth[]): ProfileMonth[] {
  return months.filter((one) => one.confirmable === "ok");
}

/**
 * Why this month has no tick, or `null` where the row says nothing about it.
 *
 * **A month that is simply already confirmed says nothing**: its badge says so
 * two columns over, and a sentence repeating it on every exported month is a
 * column of noise to read past. The reasons that *are* drawn are the ones a
 * finished draft can carry, which are the ones the user can act on.
 */
function cannotBecause(
  one: ProfileMonth,
): Exclude<BulkConfirmVerdict, "ok" | "alreadyConfirmed"> | null {
  return one.confirmable === "ok" || one.confirmable === "alreadyConfirmed"
    ? null
    : one.confirmable;
}

export function MonthsSection({
  workerId,
  gender,
  months,
}: {
  workerId: string;
  gender: Gender;
  months: ProfileMonth[];
}) {
  const page = he.workers.profile.months;
  const words = page.confirm;
  const [picked, setPicked] = useState<YearMonth[]>([]);
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const [fault, setFault] = useState(false);
  // One change at a time, by the rule every other control here uses: a second
  // press while the first is on its way would confirm the same months twice.
  const { saving, send } = useOneAtATime<never>();

  const canTick = tickable(months);
  const isPicked = (month: YearMonth) =>
    picked.some((one) => sameMonth(one, month));

  function toggle(month: YearMonth) {
    setConfirmed(null);
    setPicked((before) =>
      before.some((one) => sameMonth(one, month))
        ? before.filter((one) => !sameMonth(one, month))
        : [...before, month],
    );
  }

  // What they have actually been paid, added up from the same `net` each row
  // shows — one figure reached one way (Part 3). **Only the months that have a
  // figure are counted**: a month still open has no net, and counting it as
  // zero would report a total that quietly grows the day it closes without
  // anything about the worker having changed.
  const paid = months.filter((one) => one.netAgorot !== null);
  const paidSoFar = paid.reduce((total, one) => total + (one.netAgorot ?? 0), 0);

  // The wage each ticked month will be confirmed at, one line per distinct
  // effective date, so a run crossing a rate change says so before it is
  // pressed (item 4) rather than reporting one wage for months valued at two.
  const rateLines = picked
    .map((month) => months.find((one) => sameMonth(one.month, month))?.confirmAt)
    .filter((figures): figures is ConfirmedFigures => figures != null)
    .reduce<ConfirmedFigures[]>(
      (lines, figures) =>
        lines.some((line) => line.effectiveFrom === figures.effectiveFrom)
          ? lines
          : [...lines, figures],
      [],
    )
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  function press() {
    let took = 0;
    send(
      async () => {
        const result = await confirmMonths(workerId, picked);
        if ("fault" in result) return result;
        took = result.outcomes.filter((one) => one.verdict === "ok").length;
        return { ok: true };
      },
      (result) => {
        if (!result.ok) return;
        setConfirmed(took);
        setPicked([]);
      },
      () => setFault(true),
    );
  }

  return (
    <section
      id="months"
      aria-labelledby="months-title"
      className="flex min-w-0 scroll-mt-24 flex-col gap-3.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h2 id="months-title" dir="auto" className="text-[20px] font-semibold sm:text-[22px]">
          {page.title}
        </h2>
        {/* Said once above the column rather than on every row. */}
        <span dir="auto" className="text-[14px] font-light text-ink-quiet">
          {page.total}
        </span>
      </div>
      <Card radius="sm" className="flex min-w-0 flex-col overflow-hidden">
        {months.length === 0 ? (
          <div className="px-4.5 py-4 sm:px-6">
            <p dir="auto" className="text-[15px] font-light text-ink-quiet">
              {page.empty}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {months.map((one) => {
              const id = `month-${monthParam(one.month)}`;
              const why = cannotBecause(one);
              return (
                <li
                  key={monthParam(one.month)}
                  data-month={monthParam(one.month)}
                  className="border-t border-line-soft first:border-t-0"
                >
                  {/* **The tick sits beside the link and not inside it.** The
                      artboard draws the whole row as one link to the payslip; a
                      checkbox nested in an anchor is not a control the browser
                      lets anybody press, so the row splits and the link keeps
                      the rest of it (`DESIGN.md`). */}
                  <div className="flex min-w-0 items-center gap-2 pe-4.5 sm:pe-6">
                    {one.confirmable === "ok" ? (
                      <input
                        type="checkbox"
                        data-confirmable=""
                        aria-labelledby={id}
                        checked={isPicked(one.month)}
                        disabled={saving}
                        onChange={() => toggle(one.month)}
                        // Drawn at 18 and hit at 34: a checkbox cannot be
                        // padded out without shrinking the box it draws, so the
                        // hit area is a pseudo-element, as the holiday tick and
                        // the `?` disclosure already do it (WCAG 2.2 AA 2.5.8).
                        className="relative ms-4.5 size-4.5 flex-none accent-forest after:absolute after:-inset-2 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:ms-6"
                      />
                    ) : (
                      // A spacer, so the month names still line up down the
                      // column where some rows have no tick.
                      <span aria-hidden="true" className="ms-4.5 size-4.5 flex-none sm:ms-6" />
                    )}
                    <Link
                      href={`/month/payslip?month=${monthParam(one.month)}`}
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4.5 gap-y-2 py-3 transition-colors hover:bg-tint sm:py-3.5"
                    >
                      <span
                        id={id}
                        className="flex-none text-[16px] font-semibold sm:w-[8.5rem] sm:text-[18px]"
                      >
                        <Bidi>{monthLabel(one.month)}</Bidi>
                      </span>
                      <span
                        dir="auto"
                        className="min-w-0 flex-[1_1_9rem] text-[14px] font-light text-ink-mute sm:text-[16px]"
                      >
                        {detailOf(one)}
                      </span>
                      <span className="flex flex-col items-end">
                        <MoneyValue agorot={one.netAgorot} size="fact" />
                        <span className="text-[13px] font-light text-ink-soft">
                          <span dir="auto">{he.month.preview.gross} </span>
                          <Bidi noTranslate>
                            {one.grossAgorot === null
                              ? he.placeholder.amount
                              : formatAgorot(one.grossAgorot)}
                          </Bidi>
                        </span>
                      </span>
                      <StateBadge state={one.state} />
                    </Link>
                  </div>
                  {why === null ? null : (
                    <p
                      data-cannot-confirm={why}
                      dir="auto"
                      className="pb-3 ps-[3.25rem] pe-4.5 text-[13px] leading-[1.5] font-light text-ink-quiet sm:ps-[3.75rem] sm:pe-6"
                    >
                      {sentenceFor(why, gender)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {paid.length === 0 ? null : (
          <div
            data-row="paid-so-far"
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t-2 border-line bg-tint px-4.5 py-3.5 sm:px-6"
          >
            <div className="flex min-w-0 flex-col">
              <span dir="auto" className="text-[16px] font-semibold sm:text-[17px]">
                {page.soFar}
              </span>
              {paid.length === months.length ? null : (
                <span dir="auto" className="text-[13px] font-light text-ink-quiet">
                  {page.soFarPartial(paid.length, months.length)}
                </span>
              )}
            </div>
            <MoneyValue agorot={paidSoFar} size="lg" className="sm:text-[20px]" />
          </div>
        )}
      </Card>

      {/* **The block is absent where no month can be confirmed from here**,
          which is the ordinary state of a household that exports as it goes: a
          panel whose button can never be pressed is a panel in the way of the
          list. */}
      {canTick.length === 0 ? null : (
        <Card data-confirm-block="" className="flex flex-col gap-3 px-4.5 py-4 sm:px-6">
          <div className="flex flex-col gap-1">
            <h3 dir="auto" className="text-[17px] font-semibold sm:text-[18px]">
              {words.title}
            </h3>
            <p
              dir="auto"
              className="max-w-[62ch] text-[14px] leading-[1.5] font-light text-ink-mute text-pretty"
            >
              {words.lead(gender)}
            </p>
          </div>

          {rateLines.length === 0 ? null : (
            <div className="flex flex-col gap-1 border-t border-line-soft pt-3">
              <span dir="auto" className="text-[14px] font-semibold">
                {words.rates.title}
              </span>
              <ul className="flex flex-col gap-0.5">
                {rateLines.map((line) => (
                  <li
                    key={line.effectiveFrom}
                    data-confirm-rate={line.effectiveFrom}
                    className="text-[14px] font-light text-ink-mute"
                  >
                    <Bidi noTranslate>{formatRate(line.minimumAgorot)}</Bidi>
                    <span> </span>
                    <span dir="auto">{words.rates.from}</span>
                    <Bidi>{monthLabel(monthOf(line.effectiveFrom))}</Bidi>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              data-confirm-months=""
              disabled={picked.length === 0 || saving}
              onClick={press}
              {...busyAttrs(
                saving,
                "rounded-tint bg-forest px-5.5 py-2.75 text-[16px] font-semibold text-surface transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-45",
              )}
            >
              <span dir="auto">{words.action(picked.length)}</span>
            </button>
            {picked.length === 0 ? (
              <span dir="auto" className="text-[14px] font-light text-ink-quiet">
                {words.none}
              </span>
            ) : null}
          </div>

          {confirmed === null ? null : (
            <p
              aria-live="polite"
              data-confirmed-months=""
              dir="auto"
              className="text-[15px] font-medium text-forest"
            >
              {words.done(confirmed)}
            </p>
          )}
          {fault ? (
            <p
              aria-live="polite"
              data-role="fault"
              dir="auto"
              className="text-[14px] leading-[1.5] font-light text-clay-deep text-pretty"
            >
              {he.fault}
            </p>
          ) : null}
        </Card>
      )}
    </section>
  );
}

/** The sentence for a month that cannot be confirmed from here. Two of the
 * reasons are about the worker and inflect; the rest are about the month. */
function sentenceFor(
  why: Exclude<BulkConfirmVerdict, "ok" | "alreadyConfirmed">,
  gender: Gender,
): string {
  const words = he.workers.profile.months.confirm.cannot;
  return why === "openSickSpell" ? words.openSickSpell(gender) : words[why];
}

/** A month as both this screen and `/reports` spell it in an address: `YYYY-MM`
 * sorts as the date does and the two cannot spell it two ways. */
function monthParam(month: YearMonth): string {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}

/**
 * What the month held, in one line: the days actually worked, then each kind of
 * day drawn from a balance that the month in fact has.
 *
 * A kind with no days is left out rather than drawn as a zero — nine rows each
 * ending "0 ימי מחלה" is a column of noise to read past, and the absence says
 * the same thing. A month with no figures yet says it is waiting instead.
 */
function detailOf(one: ProfileMonth): string {
  if (one.days.worked === null) return he.workers.profile.months.awaiting;
  const words = he.workers.profile.months.days;
  return [
    words.worked(formatDays(one.days.worked)),
    ...(one.days.vacation > 0 ? [words.vacation(formatDays(one.days.vacation))] : []),
    ...(one.days.sick > 0 ? [words.sick(formatDays(one.days.sick))] : []),
    ...(one.days.holidays > 0 ? [words.holidays(formatDays(one.days.holidays))] : []),
  ].join(" · ");
}

/** Which of Part 5's four states the month is in. The exported one is the calm
 * colour and the other three are the attention colour, because exported is the
 * only one of the four that asks nothing of the user. */
function StateBadge({ state }: { state: MonthState }) {
  return (
    <span
      dir="auto"
      data-state={state}
      className={[
        "flex-none rounded-full px-3 py-1.5 text-[14px] font-semibold whitespace-nowrap",
        state === "exported" ? "bg-chip text-ink-warm" : "bg-band-sun text-clay-ink",
      ].join(" ")}
    >
      {he.workers.profile.months.state[state]}
    </span>
  );
}
