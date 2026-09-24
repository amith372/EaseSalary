"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { CoveredMonths } from "@/components/CoveredMonths";
import { SheetBadge } from "@/components/icons";
import { MoneyValue } from "@/components/MoneyValue";
import { SummaryRow } from "@/components/SummaryRow";
import { ValueChip } from "@/components/ValueChip";
import { useWorkerScope } from "@/components/WorkerScope";
import { fullDayLabel, monthLabel } from "@/lib/dateLabels";
import type { RestDay } from "@/lib/dates";
import { monthLevels } from "@/lib/engine/month";
import type { ClosingLine } from "@/lib/types";
import { bottomFigure, he } from "@/lib/i18n/he";
import { formatAgorot, formatDays } from "@/lib/money";
import type {
  IsoDate,
  MonthLine,
  MonthResult,
  SheetColumn,
  YearMonth,
} from "@/lib/types";

/**
 * `דף המשכורת` — the payslip as the family reads it.
 *
 * **It is the exported sheet's own layout seen on screen, and that is what
 * makes it a third view rather than a second month screen.** Its lines are
 * grouped by the sheet's own columns and carry the sheet's own subtotal names;
 * the month screen groups the same lines by kind, and specs.md item 5 says why
 * the two differ. Criterion 1 checks four totals, and a screen that could show
 * only one ברוטו is a screen the file cannot be compared against.
 *
 * **It calculates nothing.** Every figure is one `calculateSeries` result, the
 * same one the month screen and the export read, so the three cannot word the
 * month differently (Part 3, rule 11).
 *
 * **`אושר ב[תאריך]` is the day the month was last confirmed before an export**,
 * stored with the month and absent for a month never confirmed, so no date is
 * ever invented. **The month's own note is shown here
 * and written on the opening screen** (specs.md item 5), which
 * `להוסיף הערה לחודש` opens on this month.
 */

/** One month, ready to read. The counts come from `exportQuestions`, which is
 * what the pre-export screen already counts them with — so the two screens
 * cannot disagree about how many holidays a month had. */
export interface PayslipMonth {
  month: YearMonth;
  restDay: RestDay;
  result: MonthResult;
  days: {
    vacation: number;
    sick: number;
    holidaysWorked: number;
    holidaysUnworked: number;
    freeRestDays: number;
  };
  /** What is still owed on every advance after this month, or `null` where the
   * worker owes nothing. The payments screen walks the same ledger. */
  advanceOwedAgorot: number | null;
  /** Whether the month has a file — `blocksExport`'s answer, so the button here
   * and the route behind it cannot disagree (the defect `/reports` had). */
  canExport: boolean;
  /** The current month before its last day: exported with a warning beside the
   * button, not refused (item 21). */
  stillRunning: boolean;
  /** The day the month was last confirmed before an export, in Israel, or
   * `null` for a month never confirmed. */
  confirmedOn: IsoDate | null;
  /** The month's own note, or `null` (specs.md item 5). */
  note: string | null;
}

export interface WorkerPayslip {
  workerId: string;
  workerName: string;
  months: PayslipMonth[];
}

interface PayslipScreenProps {
  household: WorkerPayslip[];
}

/** The three columns that reach the worker, in the order the sheet prints
 * them. `H` is drawn separately below, outside her total (item 16). */
const WORKER_COLUMNS: SheetColumn[] = ["E", "F", "G"];

function unitsHint(line: MonthLine) {
  const { units, rate } = line;
  if (units === undefined || units === null || rate === undefined || rate === null) {
    return undefined;
  }
  return <Bidi noTranslate>{`${formatDays(units)} × ${formatAgorot(rate)}`}</Bidi>;
}

function coversHint(line: MonthLine) {
  if (!line.coversMonths || line.coversMonths.length === 0) return undefined;
  return <CoveredMonths months={line.coversMonths} />;
}

export function PayslipScreen({ household }: PayslipScreenProps) {
  const { worker } = useWorkerScope();
  const params = useSearchParams();
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  const why = {
    openWhy,
    onToggleWhy: (key: string) =>
      setOpenWhy((current) => (current === key ? null : key)),
  };

  const mine =
    household.find((entry) => entry.workerId === worker?.id) ?? household[0];
  if (mine === undefined) return null;

  // The month comes off the URL where one was named — `/reports` links here
  // month by month — and otherwise the latest finished month that has a file.
  // The current one has a file too, with a warning (item 21), but it is not the
  // month a family opens the payslip to read.
  const wanted = params.get("month");
  const shown =
    mine.months.find(
      (entry) =>
        wanted ===
        `${entry.month.year}-${String(entry.month.month).padStart(2, "0")}`,
    ) ??
    [...mine.months]
      .reverse()
      .find((entry) => entry.canExport && !entry.stillRunning) ??
    mine.months[mine.months.length - 1];

  if (shown === undefined) {
    return (
      <div className="flex flex-1 justify-center pt-3 pb-7">
        <p className="text-[17px] font-light text-ink-soft">
          <Bidi>{he.payslip.none}</Bidi>
        </p>
      </div>
    );
  }

  const { result, restDay } = shown;
  // The *file* route is addressed by worker and month, because it is a route
  // handler with no shell around it. This screen's own address carries the
  // month alone: the worker is the shell's, as on every screen, and an address
  // that named one too would have two sources for one answer — with the URL's
  // silently losing, which is a link that lies about what it opens.
  const monthQuery = `worker=${encodeURIComponent(mine.workerId)}&month=${shown.month.year}-${String(shown.month.month).padStart(2, "0")}`;

  const thirdPartyLines = result.lines.filter((line) => line.column === "H");
  const thirdPartySubtotal = result.subtotals.find(
    (subtotal) => subtotal.column === "H",
  );

  // Which levels are real is the engine's answer and is asked in one place, so
  // this screen, the month screen and the row per month on `/reports` cannot
  // disagree about the same month (`monthLevels`).
  const { withholdingRows, transferRows, userAfter, withholds, transfers } =
    monthLevels(result);
  /** The withholding lines and the transfer lines are the same ruled row drawn
   * from the same shape; only which list it is drawn from differs. */
  const rowsOf = (lines: ClosingLine[]) =>
    lines.map((row) => (
      <div key={row.key} className="border-b border-line py-3.5">
        <SummaryRow
          {...why}
          size="sheet"
          label={row.label}
          whyKey={row.key}
          explanation={row.explanation}
          value={<MoneyValue agorot={row.amount} manual={row.manual} size="sheet" />}
        />
      </div>
    ));

  return (
    /* A `div` and not a `main`: the shell already provides the page's one main
       landmark, and a second nested inside it leaves a screen reader with two
       "main content" regions and the skip link pointing at the outer. */
    <div className="flex flex-1 justify-center pt-3 pb-7">
      <div className="flex w-full max-w-[820px] flex-col gap-6.5">
        <section className="flex flex-wrap items-end justify-between gap-6.5">
          <div className="flex flex-col gap-1">
            <span
              className="text-[14px] font-semibold tracking-[0.06em] text-clay-deep"
            >
              <Bidi>{he.payslip.eyebrow}</Bidi>
            </span>
            <h1 className="text-[32px] font-semibold tracking-tight">
              <Bidi>{monthLabel(shown.month)}</Bidi>
            </h1>
            <p className="text-[18px] font-light text-ink-soft">
              <span dir="auto">{he.payslip.forWorker}</span>{" "}
              <Bidi>{mine.workerName}</Bidi>
            </p>
            {shown.confirmedOn === null ? null : (
              <p data-confirmed-on className="text-[15px] font-light text-ink-quiet">
                <span dir="auto">{he.payslip.confirmedOn}</span>
                <Bidi>{fullDayLabel(shown.confirmedOn)}</Bidi>
              </p>
            )}
            {shown.canExport && shown.stillRunning ? (
              <p
                data-warning="monthNotEnded"
                className="max-w-[52ch] text-[15px] leading-[1.5] font-light text-clay-deep text-pretty"
              >
                <span dir="auto" className="font-semibold">
                  {he.beforeExport.notEnded.title}
                </span>
                <span>. </span>
                <span dir="auto">{he.beforeExport.notEnded.note}</span>
              </p>
            ) : null}
          </div>
          {/* **A month nobody confirmed has no file yet, so the link is to the
              screen that confirms it** (specs.md items 4, 17). The route
              refuses such a month, and a control that answers a click with a
              refusal is a control that should not have been drawn — but unlike
              a block, this is something she can do from here, so it is offered
              rather than withheld. */}
          {shown.canExport && shown.confirmedOn === null ? (
            <Link
              href={`/month/export?${monthQuery}`}
              data-payslip-confirm
              className="flex items-center gap-2.5 rounded-tint bg-forest px-6 py-3.5 text-[17px] font-semibold whitespace-nowrap text-white hover:bg-forest-deep hover:text-white"
            >
              <SheetBadge className="size-5 flex-none text-forest" />
              <Bidi>{he.beforeExport.confirmAndExport}</Bidi>
            </Link>
          ) : null}
          {shown.canExport && shown.confirmedOn !== null ? (
            <a
              href={`/month/export/file?${monthQuery}`}
              data-payslip-export
              className="flex items-center gap-2.5 rounded-tint bg-forest px-6 py-3.5 text-[17px] font-semibold whitespace-nowrap text-white hover:bg-forest-deep hover:text-white"
            >
              <SheetBadge className="size-5 flex-none text-forest" />
              <Bidi>{he.home.paid.exportToExcel}</Bidi>
            </a>
          ) : null}
        </section>

        <Card
          tone="tint"
          radius="lg"
          className="flex flex-wrap items-end gap-8.5 px-8 py-6.5"
          data-role="payslip-tint"
        >
          <div data-role="payslip-headline" className="flex flex-col gap-1">
            <span className="text-[17px] font-light text-ink-warm">
              <Bidi>{bottomFigure(transfers).label}</Bidi>
            </span>
            <span data-payslip-total>
              <MoneyValue agorot={result.net} size="xl" />
            </span>
          </div>
          {/* The same rule the composition card below obeys, and it was
              missed here: a level is drawn only where something below it
              changes the figure. The headline is the month's bottom figure, so
              the ברוטו beside it is worth drawing only when something was
              withheld or transferred, and the נטו only when both happened —
              otherwise the block prints one number twice under two headings,
              which reads as an error the family goes looking for. */}
          <div className="flex flex-col gap-1.5 pb-1.5">
            {withholds || transfers ? (
              <span className="flex items-baseline gap-2.5">
                <span className="text-[16px] font-light text-ink-mute">
                  <Bidi>{he.month.preview.gross}</Bidi>
                </span>
                <MoneyValue agorot={result.gross} />
              </span>
            ) : null}
            {withholds && transfers ? (
              <span className="flex items-baseline gap-2.5">
                <span className="text-[16px] font-light text-ink-mute">
                  <Bidi>{he.month.preview.afterWithholding}</Bidi>
                </span>
                <MoneyValue agorot={result.afterWithholding} />
              </span>
            ) : null}
          </div>
        </Card>

        <section className="flex flex-col gap-3.5">
          <h2 className="text-[22px] font-semibold">
            <Bidi>{he.payslip.composition}</Bidi>
          </h2>
          <Card radius="md" className="flex flex-col gap-0 px-6.5 pt-1.5 pb-5.5">
            {WORKER_COLUMNS.map((column) => {
              const lines = result.lines.filter(
                (line) => line.column === column,
              );
              if (lines.length === 0) return null;
              const subtotal = result.subtotals.find(
                (entry) => entry.column === column,
              );
              return (
                <div key={column} data-column={column} className="flex flex-col">
                  {lines.map((line) => (
                    <div
                      key={line.key}
                      className="border-b border-line py-4"
                    >
                      <SummaryRow
                        {...why}
                  size="sheet"
                        label={line.label}
                        whyKey={line.key}
                        explanation={line.explanation}
                        hint={unitsHint(line)}
                        value={
                          <MoneyValue agorot={line.amount} manual={line.manual} size="sheet" />
                        }
                      />
                    </div>
                  ))}
                  {subtotal ? (
                    <div className="py-3">
                      <SummaryRow
                        {...why}
                  size="sheet"
                        label={subtotal.label}
                        whyKey={`subtotal-${column}`}
                        explanation={subtotal.explanation}
                        value={<MoneyValue agorot={subtotal.amount} size="sheet" />}
                        strong
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="flex flex-col border-t-2 border-line-strong pt-1">
              {withholds ? (
                <div className="border-b border-line py-3.5">
                  <SummaryRow
                    {...why}
                  size="sheet"
                    label={he.month.preview.gross}
                    whyKey="gross"
                    explanation={{ text: he.sheet.why.gross }}
                    value={<MoneyValue agorot={result.gross} size="sheet" />}
                    strong
                  />
                </div>
              ) : null}
              {withholds
                ? rowsOf(withholdingRows)
                : null}
              {transfers ? (
                <div className="border-b border-line py-3.5">
                  <SummaryRow
                    {...why}
                  size="sheet"
                    label={he.month.preview.afterWithholding}
                    whyKey="afterWithholding"
                    explanation={{ text: he.sheet.why.afterWithholding }}
                    value={<MoneyValue agorot={result.afterWithholding} size="sheet" />}
                    strong
                  />
                </div>
              ) : null}
              {transfers
                ? rowsOf([...userAfter, ...transferRows])
                : null}
              <div className="pt-4.5">
                <SummaryRow
                  {...why}
                  size="sheet"
                  {...bottomFigure(transfers)}
                  whyKey="net"
                  value={<MoneyValue agorot={result.net} size="sheetTotal" />}
                  strong
                />
              </div>
            </div>
          </Card>
        </section>

        {/* Outside the card above, and that is the point: this money went to a
            third party and never reaches the worker's own total (item 16). */}
        {thirdPartyLines.length > 0 ? (
          <section className="flex flex-col gap-3.5">
            <h2 className="text-[22px] font-semibold">
              <Bidi>{he.payslip.thirdParty}</Bidi>
            </h2>
            <Card radius="md" className="flex flex-col px-6.5 pt-3.5 pb-5">
              <p
                className="text-[15px] font-light text-pretty text-ink-mute"
              >
                <Bidi>{he.payslip.thirdPartyNote}</Bidi>
              </p>
              {thirdPartyLines.map((line) => (
                <div key={line.key} className="border-b border-line py-3.5">
                  <SummaryRow
                    {...why}
                  size="sheet"
                    label={line.label}
                    whyKey={line.key}
                    explanation={line.explanation}
                    hint={coversHint(line)}
                    value={
                      <MoneyValue agorot={line.amount} manual={line.manual} size="sheet" />
                    }
                  />
                </div>
              ))}
              {thirdPartySubtotal ? (
                <div className="pt-4.5">
                  <SummaryRow
                    {...why}
                  size="sheet"
                    label={thirdPartySubtotal.label}
                    whyKey="subtotal-H"
                    explanation={thirdPartySubtotal.explanation}
                    value={<MoneyValue agorot={thirdPartySubtotal.amount} size="sheet" />}
                    strong
                  />
                </div>
              ) : null}
            </Card>
          </section>
        ) : null}

        <section className="flex flex-col gap-3.5">
          <h2 className="text-[22px] font-semibold">
            <Bidi>{he.payslip.days.title}</Bidi>
          </h2>
          <div className="grid overflow-hidden sm:grid-cols-2 rounded-card border border-line bg-surface">
            <DayStat
              name="workDays"
              dot="bg-workday-dot"
              label={he.sheet.reporting.workDays}
              value={`${formatDays(result.actualDays ?? 0)} / ${formatDays(result.standardDays ?? 0)}`}
            />
            <DayStat
              name="vacation"
              dot="bg-vacation"
              label={he.payslip.days.vacation}
              value={formatDays(shown.days.vacation)}
            />
            <DayStat
              name="sick"
              dot="bg-sick"
              label={he.payslip.days.sick}
              value={formatDays(shown.days.sick)}
            />
            <DayStat
              name="holidaysWorked"
              dot="bg-holiday"
              label={he.payslip.days.holidaysWorked}
              value={formatDays(shown.days.holidaysWorked)}
            />
            <DayStat
              name="holidaysUnworked"
              dot="border-[1.5px] border-holiday bg-ground"
              label={he.payslip.days.holidaysUnworked}
              value={formatDays(shown.days.holidaysUnworked)}
            />
            <DayStat
              name="freeRestDays"
              dot="bg-rest"
              label={he.payslip.days.freeRestDays(restDay)}
              value={formatDays(shown.days.freeRestDays)}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3.5">
          <h2 className="text-[22px] font-semibold">
            <Bidi>{he.payslip.after.title}</Bidi>
          </h2>
          <div className="flex flex-col">
            {result.balances.map((balance) => (
              <div
                key={balance.kind}
                data-after={balance.kind}
                className="border-t border-line py-3.5"
              >
                <SummaryRow
                  {...why}
                  size="sheet"
                  label={
                    balance.kind === "vacation"
                      ? he.home.balances.vacation
                      : he.home.balances.sick
                  }
                  whyKey={`balance-${balance.kind}`}
                  explanation={balance.explanation}
                  // Criterion 2 asks for the days used beside the balance: a
                  // balance with no days behind it cannot be checked.
                  hint={
                    <>
                      <span dir="auto">{he.sheet.reporting.daysUsed}</span>
                      <span>: </span>
                      <Bidi noTranslate>{formatDays(balance.used ?? 0)}</Bidi>
                    </>
                  }
                  value={
                    <ValueChip>
                      <Bidi noTranslate>
                        {balance.closing === null
                          ? he.placeholder.count
                          : formatDays(balance.closing)}
                      </Bidi>
                      <span> </span>
                      <span dir="auto">{he.units.days}</span>
                    </ValueChip>
                  }
                />
              </div>
            ))}
            {shown.advanceOwedAgorot !== null ? (
              <div
                data-after="advance"
                className="flex items-center justify-between gap-4 border-t border-line py-3.5"
              >
                <span className="text-[17px] font-light text-ink-warm">
                  <Bidi>{he.workers.facts.advance}</Bidi>
                </span>
                <MoneyValue agorot={shown.advanceOwedAgorot} size="sheet" />
              </div>
            ) : null}
          </div>
        </section>

        {shown.note !== null ? (
          <section data-role="month-note" className="flex flex-col gap-2">
            <h2 dir="auto" className="text-[22px] font-semibold">
              {he.payslip.note}
            </h2>
            <p dir="auto" className="text-[17px] font-light whitespace-pre-line text-ink-warm">
              {shown.note}
            </p>
          </section>
        ) : null}

        <section className="flex flex-wrap items-center gap-5.5 border-t border-line pt-6">
          {/* Back to the calendar and the figures, which are the opening
              screen's — this sheet is one link further in. */}
          <Link
            href="/"
            className="text-[17px] font-medium underline-offset-4 hover:underline"
          >
            <Bidi>{he.payslip.correct}</Bidi>
          </Link>
          <Link
            href={`/?month=${shown.month.year}-${String(shown.month.month).padStart(2, "0")}#month-note`}
            className="text-[17px] text-ink-soft hover:text-forest"
          >
            <Bidi>{shown.note === null ? he.payslip.addNote : he.payslip.editNote}</Bidi>
          </Link>
          <Link
            href="/reports"
            className="text-[17px] text-ink-soft hover:text-forest"
          >
            <Bidi>{he.payslip.allReports}</Bidi>
          </Link>
        </section>
      </div>
    </div>
  );
}

/** One cell of `הימים בחודש`: the calendar's own colour for the mark, so a
 * count and the days that produced it read as the same thing on every screen
 * (the fix job 3 made to `דף העובד`'s balance colours). */
function DayStat({
  name,
  dot,
  label,
  value,
}: {
  name: string;
  dot: string;
  label: string;
  value: string;
}) {
  return (
    <div
      data-day-stat={name}
      className="-mt-px -ms-px flex items-center gap-3 border-t border-s border-line px-5.5 py-4"
    >
      <span className={`size-2.75 flex-none rounded-full ${dot}`} />
      <span className="flex-1 text-[17px] font-light text-ink-warm">
        <Bidi>{label}</Bidi>
      </span>
      <span className="text-[18px] font-semibold whitespace-nowrap">
        <Bidi noTranslate>{value}</Bidi>
      </span>
    </div>
  );
}
