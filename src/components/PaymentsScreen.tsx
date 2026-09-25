"use client";

import { useRef, useState, useTransition } from "react";
import type { MonthActionResult } from "@/app/month/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { TwoToneIcon } from "@/components/icons";
import { MonthActions, type MonthSection } from "@/components/MonthActions";
import { MonthStepper, notBefore, openingMonthOf } from "@/components/MonthStepper";
import { useWorkerScope } from "@/components/WorkerScope";
import { compareMonth, monthOf, sameMonth } from "@/lib/dates";
import { monthLabel } from "@/lib/dateLabels";
import type { AdvanceStanding } from "@/lib/engine/advances";
import type { OrphanedOverride } from "@/lib/engine/overrides";
import type { MonthRecord } from "@/lib/engine/repository";
import { he } from "@/lib/i18n/he";
import type { MonthIncomeTax } from "@/lib/engine/types";
import type { UpcomingEntry } from "@/lib/engine/upcoming";
import { formatAgorot, formatDays } from "@/lib/money";
import type { IsoDate, OverrideCandidate, Worker, YearMonth } from "@/lib/types";

/**
 * The payments screen — where everything that *records* a payment lives
 * (specs.md item 5).
 *
 * **It is the other half of the month screen and not a second one.** The month
 * screen answers "what did this month come to" and summarises the user's own
 * lines into a row apiece (item 20); this is where those lines are made, where
 * the income tax is typed, and where an advance is given and repaid. The
 * division is what keeps the calendar answerable at a glance: a calendar with
 * four control surfaces around it asks the user to find the right one before she
 * can answer the question she arrived with.
 *
 * **It holds no calculation and it is handed one.** Nothing here is totalled:
 * the amounts are the ones the user typed, and the one walked figure — what is
 * still owed on an advance — is a sum of typed amounts rather than a rate
 * applied to anything. The exception is the overrides, which by definition
 * address figures the *application worked out* (item 17), so the route runs
 * `calculateSeries` and hands this screen the month's lines to list. What the
 * month came to is still the month screen's answer, from that same calculation
 * path, and nothing on this screen adds anything up.
 *
 * **It is scoped to one worker and one month.** The worker comes from the
 * shell's switcher, as everywhere; the month is this screen's own state and
 * carries the same stepper the calendar does, because two of the things
 * recorded here are facts about a month rather than dated payments — what tax
 * was withheld, and a line the user added — and a screen that could not say
 * which month could not record them at all.
 */

/** One month as this screen needs it: the facts it holds, the lines the engine
 * drew for it, and the overrides it is holding for rows it is not drawing. */
export interface MonthPayments {
  /** Without the spans, which belong to the worker rather than to a month. */
  record: MonthRecord;
  /**
   * The month's own rows — its columns and its closing block together — and
   * the only derived thing on this screen. They are here for one reason: an
   * override may only replace a figure the application worked out, and the
   * engine's own `overridable` is what says which those are (specs.md item 17).
   * Nothing on this screen totals them.
   */
  lines: OverrideCandidate[];
  /** Amounts typed over rows the month is not drawing now — listed rather than
   * kept out of sight, because a stored amount that will reappear and cannot be
   * seen is item 17's quietest failure. */
  orphanedOverrides: OrphanedOverride[];
  /**
   * The month's income tax as the card has to say it (specs.md item 17).
   *
   * **Assembled on the server from the one engine result** that drew the rows
   * above, so the amount, the share of the ‏ברוטו‎ it came to and the badge
   * cannot disagree with the sheet (`CLAUDE.md` rule 11). The client is handed
   * figures and never a calculation.
   */
  incomeTax: MonthIncomeTax;
}


/** One worker as this screen needs her: who she is, each of her months, and
 * what is still owed on each advance. */
export interface WorkerPayments {
  worker: Worker;
  /** Where the month arrows stop (specs.md item 6). */
  firstMonth: YearMonth;
  /** Oldest first: every month from her first to the current one. */
  months: MonthPayments[];
  advances: AdvanceStanding[];
  /** What falls due in the next twelve months (specs.md item 15). */
  upcoming: UpcomingEntry[];
}

interface PaymentsScreenProps {
  household: WorkerPayments[];
  /** Today, read once on the server and handed down, so nothing here reads a
   * clock during a render (`CLAUDE.md`). */
  today: IsoDate;
}

export function PaymentsScreen({ household, today }: PaymentsScreenProps) {
  const { worker } = useWorkerScope();
  const [chosenMonth, setMonth] = useState<YearMonth>(() =>
    openingMonthOf(
      household.flatMap((entry) =>
        entry.months.map(({ record }) => record.month),
      ),
      today,
    ),
  );

  // The switcher moves between workers and the screen stays on the month it was
  // showing — the month is a fact about the screen and the worker is a fact
  // about the shell, exactly as on the month screen.
  const entry =
    household.find((candidate) => candidate.worker.id === worker.id) ??
    household[0];
  // Never a month before hers (specs.md item 6), as on the opening screen.
  const month = notBefore(chosenMonth, entry.firstMonth);
  // A month ahead is not valued, and nothing can be entered in it yet.
  const future = compareMonth(month, monthOf(today)) > 0;
  const shown = entry.months.find(({ record }) =>
    sameMonth(record.month, month),
  );

  // A change reaches the store and the page re-renders from it, so nothing here
  // predicts what was saved. The card says so with `aria-busy` alone: the dim
  // that used to come with it is on the control that was pressed instead
  // (`busyAttrs` in `Field.tsx`), because greying the calendar and every other
  // row to save one note reads as the page failing.
  const [saving, startSaving] = useTransition();

  // Every section starts folded, and what she unfolds
  // stays unfolded while she steps between months.
  const [openSections, setOpenSections] = useState<ReadonlySet<MonthSection>>(
    () => new Set(),
  );
  function toggleSection(section: MonthSection) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (!next.delete(section)) next.add(section);
      return next;
    });
  }

  // One change at a time. A second press while the first is on its way would
  // send it again — two identical lines, where the user meant one — so it is
  // dropped. A ref rather than `saving`, which a second keypress in the same
  // tick would still read as false.
  // Screen-wide and not per control: every section writes the same month
  // record, read-modify-write, so two sections saving at once would lose one of
  // the two changes. It answers `false` when it drops one, which is what stops
  // the dropped control waiting for a result that is not coming.
  const inFlight = useRef(false);

  function handleAction(
    action: () => Promise<MonthActionResult>,
    onResult: (result: MonthActionResult) => void,
  ) {
    if (inFlight.current) return false;
    inFlight.current = true;
    startSaving(async () => {
      try {
        onResult(await action());
      } finally {
        inFlight.current = false;
      }
    });
    return true;
  }

  return (
    /* One column, and the heading and the card share its width. The shell hands
       every screen 1320px to fill; this one takes the artboard's narrower
       measure, because what is on it is a form and a form read across 1320px is
       a line the eye loses on the way back. */
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-4">
      <div className="flex flex-none flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* The tab's own icon, repeated on the screen it leads to. It sits
              beside the heading and not inside it: an svg as the first child of
              a `dir="auto"` element leaves it with no strong character to read
              and silently resolves it left-to-right. */}
          <div className="flex items-center gap-2">
            <TwoToneIcon name="coin" className="size-5.5" />
            <h1
              dir="auto"
              className="text-[24px] leading-[1.2] font-bold tracking-[-0.02em]"
            >
              {he.payments.title}
            </h1>
          </div>
          <p
            dir="auto"
            className="max-w-[62ch] text-[15px] leading-[1.55] font-light text-ink-mute text-pretty"
          >
            {he.payments.lead}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-baseline gap-2">
            <span dir="auto" className="text-[14px] font-light text-ink-quiet">
              {he.payments.forMonth}
            </span>
            <span className="text-[17px] font-semibold">
              <Bidi>{monthLabel(month)}</Bidi>
            </span>
          </span>
          <MonthStepper
            month={month}
            today={today}
            earliest={entry.firstMonth}
            onMonthChange={setMonth}
          />
        </div>
      </div>

      <div
        aria-busy={saving}
        className="flex min-w-0 flex-col gap-2.5"
      >
        {shown ? (
          <MonthActions
            /* Keyed on the worker and the month, so the fields a user was
               half-way through typing do not follow her to another month and
               offer themselves as that month's. */
            key={`${worker.id}-${month.year}-${month.month}`}
            workerId={worker.id}
            month={month}
            /* **Assembled on the server from the engine's own row** (item
               17): the amount the month settled on, whether it was typed by
               hand, the setting it was calculated under and the share of the
               ברוטו it came to. One engine result shown twice rather than a
               second path that could disagree (`CLAUDE.md` rule 11). */
            incomeTax={shown.incomeTax}
            userLines={shown.record.userLines}
            hospitalOvertime={shown.record.hospitalOvertime}
            ledger={entry.advances}
            monthAdvances={shown.record.advances}
            thirdPartyPayments={shown.record.thirdPartyPayments}
            lines={shown.lines}
            orphanedOverrides={shown.orphanedOverrides}
            onSubmit={handleAction}
            openSections={openSections}
            onToggleSection={toggleSection}
          />
        ) : future ? (
          <Card className="flex flex-none flex-col px-4.5 py-3">
            <p dir="auto" className="text-[17px] leading-[1.5] font-semibold">
              {he.month.future}
            </p>
          </Card>
        ) : (
          <Card className="flex flex-none flex-col gap-1.5 px-4.5 py-3">
            <span dir="auto" className="text-[17px] font-semibold">
              {he.month.empty.title}
            </span>
            <p
              dir="auto"
              className="text-[15px] leading-[1.5] font-light text-ink-mute"
            >
              {he.month.empty.body}
            </p>
          </Card>
        )}
      </div>

      <UpcomingSection entries={entry.upcoming} />
    </div>
  );
}

/**
 * "לקראת החודשים הבאים", as the `תשלומים` artboard draws it under the card: a
 * reminder of what falls due in the next twelve months, which records nothing
 * (specs.md item 15). It follows today and not the month stepped to.
 */
function UpcomingSection({ entries }: { entries: UpcomingEntry[] }) {
  const words = he.payments.upcoming;
  return (
    <section aria-labelledby="payments-upcoming" className="mt-4 flex flex-col">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="payments-upcoming" dir="auto" className="text-[20px] font-semibold">
          {words.title}
        </h2>
        <span dir="auto" className="text-[15px] font-light text-ink-quiet">
          {words.lead}
        </span>
      </div>
      {entries.length === 0 ? (
        <p dir="auto" className="border-t border-line px-1.5 py-4 text-[15px] text-ink-mute">
          {words.empty}
        </p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => {
            const title =
              entry.key === "fee" ? he.sheet.thirdParty[entry.kind] : words.recuperation;
            const note = entry.key === "fee" ? words.notes[entry.kind] : words.recuperationNote;
            return (
              <li
                key={entry.key === "fee" ? entry.kind : `recuperation-${entry.month.year}`}
                data-role="upcoming"
                className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line px-1.5 py-4"
              >
                <span className="w-23 flex-none text-[15px] font-medium text-ink-soft">
                  <Bidi>{monthLabel(entry.month)}</Bidi>
                </span>
                <span className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
                  <span dir="auto" className="text-[17px] font-semibold">
                    {title}
                  </span>
                  <span dir="auto" className="text-[15px] font-light text-ink-mute text-pretty">
                    {note}
                  </span>
                </span>
                {entry.key === "recuperation" ? (
                  <span className="text-[17px] font-semibold text-ink-soft">
                    <Bidi noTranslate>{formatDays(entry.days)}</Bidi>
                    <span> </span>
                    <span dir="auto" className="font-light">
                      {he.units.days}
                    </span>
                  </span>
                ) : entry.lastPaidAgorot !== null ? (
                  <span className="flex flex-col items-end gap-px">
                    <Bidi noTranslate className="text-[17px] font-semibold text-ink-soft">
                      {formatAgorot(entry.lastPaidAgorot)}
                    </Bidi>
                    <span dir="auto" className="text-[13px] font-light text-ink-quiet">
                      {words.lastPaid}
                    </span>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
