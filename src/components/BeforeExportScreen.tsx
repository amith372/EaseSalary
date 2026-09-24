"use client";

import { useState } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MonthConfirmation } from "@/components/MonthConfirmation";
import { MonthStepper, notBefore, openingMonthOf } from "@/components/MonthStepper";
import { useWorkerScope } from "@/components/WorkerScope";
import type { DatedRate } from "@/lib/datedRates";
import {
  compareMonth,
  monthHasEnded,
  monthOf,
  sameMonth,
} from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { monthLabel } from "@/lib/dateLabels";
import type {
  ExportBlockKey,
  ExportQuestion,
} from "@/lib/engine/beforeExport";
import type { ConfirmedWage } from "@/lib/engine/types";
import type { TaxToConfirm } from "@/lib/engine/taxConfirmation";
import { he } from "@/lib/i18n/he";
import {
} from "@/lib/money";
import type { ScrapeFailureKind } from "@/lib/scrape/failure";
import type { IsoDate, Worker, YearMonth } from "@/lib/types";

/**
 * The questions that open an export, and the two confirmations that go with
 * them — `EaseSalary - לפני הייצוא` (specs.md items 18, 4 and 15).
 *
 * **Nothing here is a calculation.** Every figure on the screen was worked out
 * on the server: what the month already knows, what blocks it, and what the
 * dated-rates table offers for the month being confirmed. This screen asks, and
 * hands the answers back.
 *
 * **The questions live in the browser and are never stored.** Item 18 says
 * exporting *begins* with them, so they are asked again before every export;
 * what reaches the server is the confirmations they lead to. A question
 * answered against what the month recorded raises a warning and never a
 * refusal: she is the one who knows what
 * happened, and what item 18 buys is that she was asked.
 *
 * **Two things do block, and each says so in `specs.md` itself.** A month that
 * has not begun cannot be exported (item 21), and a month is not exported over
 * an open spell of sickness (item 18). The current month before its last day is
 * a warning (item 21), not a block. The open spell is answered here, because
 * the question item 18 names — has she returned, and on what day — is this
 * screen's own.
 */

/** One month as this screen needs it: what it knows, what stops it, and the two
 * figures it has to have confirmed. */
export interface MonthBeforeExport {
  month: YearMonth;
  confirmedWage: ConfirmedWage;
  /** Her salary in force during *this* month (`salaryFor`). The screen says so
   * when the confirmed minimum is above it, because the month is then confirmed
   * at the minimum instead (specs.md item 3). */
  baseMonthlySalaryAgorot: number;
  questions: ExportQuestion[];
  blocks: ExportBlockKey[];
  /** The current month before its last day (`monthStillRunning`): exported
   * with a warning, not refused (specs.md item 21). */
  stillRunning: boolean;
  openSpell: { spanId: string; from: IsoDate } | null;
  /** `null` in a month that owes no recuperation, which is eleven months of
   * twelve (specs.md item 15). */
  recuperation: {
    days: number;
    offeredAgorot: number | null;
    storedAgorot?: number;
  } | null;
  /** The minimum wage in force during *this* month, which is not the latest row
   * the table holds (item 4). `null` where the table begins after it. */
  offeredWage: DatedRate | null;
  /**
   * The income tax this month would be confirmed with, which item 17 has
   * confirmed before every export as the minimum wage is. `null` for a month
   * the engine does not value, which this screen never draws a card for.
   */
  incomeTax: TaxToConfirm | null;
}

export interface WorkerBeforeExport {
  worker: Worker;
  restDay: RestDay;
  /** Where the month arrows stop (specs.md item 6). */
  firstMonth: YearMonth;
  /** Oldest first: every month from her first to the current one. */
  months: MonthBeforeExport[];
}

interface BeforeExportScreenProps {
  household: WorkerBeforeExport[];
  /** Today, read once on the server and handed down, so nothing here reads a
   * clock during a render (`CLAUDE.md`). */
  today: IsoDate;
  /** Which of the three ways the wage fetch ended without an answer, or `null`
   * where it answered (specs.md Part 4). */
  failure: ScrapeFailureKind | null;
  /** The page the figure is read from, shown beside it (item 4: where it came
   * from is part of what the user is confirming). */
  sourceUrl: string;
  /**
   * The month to open on, where the address named one — the payslip and
   * `/דוחות` link here month by month for a month nobody has confirmed yet.
   *
   * **Read on the server and handed down**, rather than pulled off the URL
   * here: the screen is one the suite drives through several months in a row,
   * and a subtree that resolves after hydration replaces the questions under
   * the user's cursor.
   */
  namedMonth: YearMonth | null;
}

/**
 * The month the screen opens on: the latest one that has ended.
 *
 * **Not the current month**, which is what every other screen opens on: the
 * screen is usually asked for when a month is finished, and the finished one is
 * the one it opens on. The current month is one step away, for a family paying
 * before its last day (item 21).
 */
function openingExportMonth(
  months: readonly YearMonth[],
  today: IsoDate,
): YearMonth {
  const ended = months.filter((month) => monthHasEnded(month, today));
  return ended.length > 0
    ? ended[ended.length - 1]
    : openingMonthOf(months, today);
}

export function BeforeExportScreen({
  household,
  today,
  failure,
  sourceUrl,
  namedMonth,
}: BeforeExportScreenProps) {
  const { worker } = useWorkerScope();
  // The month the address named, and otherwise the one this screen opens on by
  // itself.
  const [chosenMonth, setMonth] = useState<YearMonth>(
    () =>
      namedMonth ??
      openingExportMonth(
        household.flatMap((entry) => entry.months.map((each) => each.month)),
        today,
      ),
  );

  const entry =
    household.find((candidate) => candidate.worker.id === worker.id) ??
    household[0];
  // Never a month before hers (specs.md item 6), as on the opening screen.
  const month = notBefore(chosenMonth, entry.firstMonth);
  const future = compareMonth(month, monthOf(today)) > 0;
  const shown = entry.months.find((each) => sameMonth(each.month, month));

  return (
    <section className="mx-auto flex w-full max-w-[760px] min-w-0 flex-col gap-5.5 pb-6">
      <header className="flex flex-col gap-1.5">
        <span
          dir="auto"
          className="text-[14px] font-semibold tracking-[0.06em] text-clay-deep"
        >
          {he.beforeExport.eyebrow}
        </span>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="min-w-0 text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] text-balance break-words sm:text-[32px]">
            <Bidi>{monthLabel(month)}</Bidi>
            <span> </span>
            <span dir="auto">{he.beforeExport.of}</span>
            <span> </span>
            <Bidi>{entry.worker.name}</Bidi>
          </h1>
          <MonthStepper
            month={month}
            earliest={entry.firstMonth}
            onMonthChange={setMonth}
          />
        </div>
        <p
          dir="auto"
          className="max-w-[62ch] text-[17px] leading-[1.5] font-light text-ink-mute text-pretty sm:text-[18px]"
        >
          {he.beforeExport.lead}
        </p>
      </header>

      {shown ? (
        <MonthConfirmation
          key={`${entry.worker.id}-${month.year}-${month.month}`}
          workerId={entry.worker.id}
          restDay={entry.restDay}
          shown={shown}
          failure={failure}
          sourceUrl={sourceUrl}
        />
      ) : future ? (
        <Card className="flex flex-col px-4.5 py-3">
          <p dir="auto" className="text-[17px] leading-[1.5] font-semibold">
            {he.month.future}
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-1.5 px-4.5 py-3">
          <span dir="auto" className="text-[17px] font-semibold">
            {he.month.empty.title}
          </span>
          <p dir="auto" className="text-[15px] leading-[1.5] font-light text-ink-mute">
            {he.month.empty.body}
          </p>
        </Card>
      )}
    </section>
  );
}
