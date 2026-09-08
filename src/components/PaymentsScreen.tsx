"use client";

import { useState, useTransition } from "react";
import type { MonthActionResult } from "@/app/month/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MonthActions } from "@/components/MonthActions";
import { MonthStepper, openingMonthOf } from "@/components/MonthStepper";
import { useWorkerScope } from "@/components/WorkerScope";
import { sameMonth } from "@/lib/dates";
import { monthLabel } from "@/lib/dateLabels";
import type { AdvanceStanding } from "@/lib/engine/advances";
import type { OrphanedOverride } from "@/lib/engine/overrides";
import type { MonthRecord } from "@/lib/engine/repository";
import { he } from "@/lib/i18n/he";
import type { IsoDate, MonthLine, Worker, YearMonth } from "@/lib/types";

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
   * The month's own lines, and the only derived thing on this screen. It is
   * here for one reason: an override may only replace a figure the application
   * worked out, and the engine's own `overridable` is what says which those are
   * (specs.md item 17). Nothing on this screen totals them.
   */
  lines: MonthLine[];
  /** Amounts typed over rows the month is not drawing now — listed rather than
   * kept out of sight, because a stored amount that will reappear and cannot be
   * seen is item 17's quietest failure. */
  orphanedOverrides: OrphanedOverride[];
}

/** One worker as this screen needs her: who she is, each of her months, and
 * what is still owed on each advance. */
export interface WorkerPayments {
  worker: Worker;
  /** Oldest first. */
  months: MonthPayments[];
  advances: AdvanceStanding[];
}

interface PaymentsScreenProps {
  household: WorkerPayments[];
  /** Today, read once on the server and handed down, so nothing here reads a
   * clock during a render (`CLAUDE.md`). */
  today: IsoDate;
}

export function PaymentsScreen({ household, today }: PaymentsScreenProps) {
  const { worker } = useWorkerScope();
  const [month, setMonth] = useState<YearMonth>(() =>
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
  const shown = entry.months.find(({ record }) =>
    sameMonth(record.month, month),
  );

  // A change reaches the store and the page re-renders from it, so nothing here
  // predicts what was saved. The card dims while the round trip is in flight,
  // for the reason the month screen's preview does: a stale figure that looks
  // settled is worse than one that says it is waiting.
  const [saving, startSaving] = useTransition();

  function handleAction(
    action: () => Promise<MonthActionResult>,
    onResult: (result: MonthActionResult) => void,
  ) {
    startSaving(async () => onResult(await action()));
  }

  return (
    /* One column, and the heading and the card share its width. The shell hands
       every screen 1320px to fill; this one takes the artboard's narrower
       measure, because what is on it is a form and a form read across 1320px is
       a line the eye loses on the way back. */
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-4">
      <div className="flex flex-none flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1
            dir="auto"
            className="text-[24px] leading-[1.2] font-bold tracking-[-0.02em]"
          >
            {he.payments.title}
          </h1>
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
          <MonthStepper month={month} today={today} onMonthChange={setMonth} />
        </div>
      </div>

      <div
        aria-busy={saving}
        className={[
          "flex min-w-0 flex-col gap-2.5 transition-opacity",
          saving ? "opacity-60" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {shown ? (
          <MonthActions
            /* Keyed on the worker and the month, so the fields a user was
               half-way through typing do not follow her to another month and
               offer themselves as that month's. */
            key={`${worker.id}-${month.year}-${month.month}`}
            workerId={worker.id}
            month={month}
            incomeTaxAgorot={shown.record.incomeTaxAgorot}
            userLines={shown.record.userLines}
            ledger={entry.advances}
            monthAdvances={shown.record.advances}
            thirdPartyPayments={shown.record.thirdPartyPayments}
            lines={shown.lines}
            orphanedOverrides={shown.orphanedOverrides}
            onSubmit={handleAction}
          />
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
    </div>
  );
}
