"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { clearRange, markRange, setHolidayWorked } from "@/app/month/actions";
import { Bidi } from "@/components/Bidi";
import { CoveredMonths } from "@/components/CoveredMonths";
import { Card } from "@/components/Card";
import { MonthCalendar } from "@/components/MonthCalendar";
import { openingMonthOf } from "@/components/MonthStepper";
import { MoneyValue } from "@/components/MoneyValue";
import { SpanOverflowNotes } from "@/components/SpanOverflow";
import { ValueChip } from "@/components/ValueChip";
import { useWorkerScope } from "@/components/WorkerScope";
import { WhyButton, WhyPanel } from "@/components/WhyDisclosure";
import { sameMonth } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { dayLabel, monthLabel } from "@/lib/dateLabels";
import { isUserLineKey, lineKeys } from "@/lib/engine/month";
import type { SpanIntent } from "@/components/MonthCalendar";
import type { MonthInSeries } from "@/lib/engine/series";
import type { UserLinePlacement } from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import { formatAgorot, formatDays } from "@/lib/money";
import type { SkippedDay, SkipReason } from "@/lib/spans";
import type {
  BalanceLine,
  ClosingLine,
  Explanation,
  IsoDate,
  MonthLine,
  MonthResult,
  Worker,
  YearMonth,
} from "@/lib/types";

/**
 * One worker's month, calculated, and the calendar it was calculated from.
 *
 * **Everything on it arrives already worked out.** The engine ran on the server
 * (specs.md Part 3) over the whole of the worker's history, because a month's
 * opening balances are the previous month's closing ones and the only way to
 * know them is to walk the months before it (item 13). So this screen holds no
 * calculation at all: it chooses which of the months it was handed to show, and
 * draws it. The preview and the export are the same engine's output shown
 * twice, and this is one of the two.
 *
 * **The calendar draws and does not yet mark.** Marking writes through the
 * store, and the store cannot take a holiday until the holiday stops being a
 * mark and becomes a state — the swap `build_plan.md` requires to happen in one
 * step, since removing `חג` from the picker before the drawn state exists would
 * leave a holiday impossible to record at all. That step is the next one; until
 * it lands a day is not a button, so nothing here answers a click with silence.
 */

/** One worker as this screen needs her: who she is, the day she rests, and
 * every month she has, oldest first. */
export interface WorkerMonths {
  worker: Worker;
  /** Her weekly rest day *as the profile currently holds it* — the calendar's
   * shading and its labels. A month's own figures were calculated against the
   * rest day stored on that month, which may differ for a family that moved it
   * (specs.md Part 3), and that one is read off `facts.terms` below. */
  restDay: RestDay;
  months: MonthInSeries[];
}

interface MonthScreenProps {
  household: WorkerMonths[];
  /** Today, read once on the server and handed down, so nothing here reads a
   * clock during a render (`CLAUDE.md`). */
  today: IsoDate;
}

export function MonthScreen({ household, today }: MonthScreenProps) {
  const { worker } = useWorkerScope();
  const [month, setMonth] = useState<YearMonth>(() =>
    openingMonthOf(
      household.flatMap((entry) => entry.months.map((m) => m.facts.month)),
      today,
    ),
  );
  const [openWhy, setOpenWhy] = useState<string | null>(null);

  // The switcher moves between workers and the calendar stays on the month it
  // was showing: the month is a fact about the screen and the worker is a fact
  // about the shell, so switching does not send the user back to August.
  const entry =
    household.find((candidate) => candidate.worker.id === worker.id) ??
    household[0];
  const shown = entry.months.find((inSeries) =>
    sameMonth(inSeries.facts.month, month),
  );
  // The month's own rest day where there is a month, so a calendar over a
  // corrected past month shades the column that month was calculated against
  // (specs.md Part 3).
  const shownRestDay = shown?.facts.terms.restDay ?? entry.restDay;

  // A gesture reaches the store and the page re-renders from it, so nothing here
  // predicts what the engine will say — the figures beside the calendar are the
  // answer to what was actually saved.
  const [saving, startSaving] = useTransition();
  // A refusal belongs to the gesture that produced it, and that gesture was made
  // against one worker: it is stamped with whose it was rather than cleared by
  // an effect watching the switcher, which would run a render late.
  const [skipped, setSkipped] = useState<{
    workerId: string;
    days: SkippedDay[];
  } | null>(null);

  const toggleWhy = (key: string) =>
    setOpenWhy((current) => (current === key ? null : key));

  function handleSelectRange(intent: SpanIntent) {
    const workerId = worker.id;
    startSaving(async () => {
      const { skipped: refused } = await markRange(workerId, intent);
      setSkipped({ workerId, days: refused });
    });
  }

  function handleClearRange(from: string, to: string) {
    const workerId = worker.id;
    setSkipped(null);
    startSaving(() => clearRange(workerId, from, to));
  }

  function handleSetHolidayWorked(spanId: string, workedIt: boolean) {
    const workerId = worker.id;
    setSkipped(null);
    startSaving(() => setHolidayWorked(workerId, spanId, workedIt));
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

  return (
    <>
      <h1
        dir="auto"
        className="flex-none text-[24px] leading-[1.2] font-bold tracking-[-0.02em]"
      >
        <Bidi>{monthLabel(month)}</Bidi>
      </h1>

      <section className="grid flex-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card radius="lg" className="flex min-h-72 min-w-0 flex-col px-5 pt-3.5 pb-3">
          <MonthCalendar
            month={month}
            spans={shown?.facts.spans ?? []}
            restDay={shownRestDay}
            today={today}
            onMonthChange={setMonth}
            onSelectRange={handleSelectRange}
            onClearRange={handleClearRange}
            onSetHolidayWorked={handleSetHolidayWorked}
            className="flex-1"
          />

          {refusals.length > 0 ? (
            <Card
              tone="inset"
              radius="panel"
              className="mt-2.5 flex flex-none flex-col gap-1.5 px-3.5 py-3"
            >
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
                    <span>{he.calendar.skipped(shownRestDay)[reason]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <SpanOverflowNotes
            spans={shown?.facts.spans ?? []}
            month={month}
            restDay={shownRestDay}
            className="mt-2.5"
          />
        </Card>

        {/* Dimmed while a gesture is on its way to the store and back. The
            figures here are the engine's answer to what was saved, so between
            the click and the answer they are the *previous* month's — saying so
            is better than letting a stale number look settled. */}
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
            <MonthPreview
              result={shown.result}
              restDay={shown.facts.terms.restDay}
              openWhy={openWhy}
              onToggleWhy={toggleWhy}
            />
          ) : (
            <Card className="flex flex-none flex-col gap-1.5 px-4.5 py-3">
              <span dir="auto" className="text-[17px] font-semibold">
                {he.month.empty.title}
              </span>
              <p dir="auto" className="text-[15px] leading-[1.5] font-light text-ink-mute">
                {he.month.empty.body}
              </p>
            </Card>
          )}
        </div>
      </section>
    </>
  );
}

/** A label, a figure and the "?" that explains it — every row of the preview,
 * and the only place the three are put together. */
function Row({
  label,
  value,
  whyKey,
  explanation,
  openWhy,
  onToggleWhy,
  hint,
  strong,
  within,
}: {
  label: string;
  value: ReactNode;
  whyKey: string;
  explanation: Explanation;
  openWhy: string | null;
  onToggleWhy: (key: string) => void;
  hint?: ReactNode;
  strong?: boolean;
  within?: "surface" | "tint";
}) {
  const open = openWhy === whyKey;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-px">
          <span
            dir="auto"
            className={
              strong
                ? "text-[17px] font-semibold"
                : "text-[16px] font-light text-ink-warm"
            }
          >
            {label}
          </span>
          {hint ? (
            <span className="text-[13px] font-light text-ink-quiet">{hint}</span>
          ) : null}
        </span>
        <span className="flex flex-none items-center gap-2.25">
          {value}
          <WhyButton
            controls={`why-${whyKey}`}
            open={open}
            onToggle={() => onToggleWhy(whyKey)}
          />
        </span>
      </div>
      <WhyPanel
        id={`why-${whyKey}`}
        open={open}
        explanation={explanation}
        within={within}
      />
    </div>
  );
}

/** What a line was priced from — its units and its unit price, which is what
 * lets the figure beside it be checked by hand (specs.md item 2). */
function unitsHint(line: MonthLine): ReactNode {
  const { units, rate } = line;
  if (units === undefined || units === null || rate === undefined || rate === null) {
    return undefined;
  }
  return (
    <Bidi noTranslate>
      {`${formatDays(units)} × ${formatAgorot(rate)}`}
    </Bidi>
  );
}

/** The months a payment covers, drawn by the one component both screens read —
 * `CoveredMonths` says why it is not written twice (specs.md item 19). */
function coversHint(line: MonthLine): ReactNode {
  if (!line.coversMonths || line.coversMonths.length === 0) return undefined;
  return <CoveredMonths months={line.coversMonths} />;
}

/**
 * The two groups the preview reads the month's lines into. **The preview groups
 * by kind and the sheet groups by column** — specs.md item 5 says why, and says
 * it once.
 */
const SALARY_KEYS: string[] = [lineKeys.base, lineKeys.sickDeduction];

const DAY_KEYS: string[] = [
  lineKeys.restEveSupplement,
  lineKeys.restDays,
  lineKeys.holidaysWorked,
];

/** Enough of a line to summarise it: what it came to, and whether the user set
 * it by hand. Both `MonthLine` and `ClosingLine` satisfy it, which is the point
 * — the two summary rows are built from one of each. */
type SummarisableLine = Pick<MonthLine, "amount" | "manual">;

function sumOf(rows: Pick<MonthLine, "amount">[]): number {
  return rows.reduce((total, row) => total + (row.amount ?? 0), 0);
}

function MonthPreview({
  result,
  restDay,
  openWhy,
  onToggleWhy,
}: {
  result: MonthResult;
  restDay: RestDay;
  openWhy: string | null;
  onToggleWhy: (key: string) => void;
}) {
  const why = { openWhy, onToggleWhy };
  const thirdPartyLines = result.lines.filter((line) => line.column === "H");
  const thirdPartySubtotal = result.subtotals.find(
    (subtotal) => subtotal.column === "H",
  );

  const salaryLines = result.lines.filter((line) => SALARY_KEYS.includes(line.key));
  const dayLines = result.lines.filter((line) => DAY_KEYS.includes(line.key));
  // However many lines the user added, the month screen shows one row for the
  // ones placed before the total and one for the ones placed after it (item
  // 20). The itemisation is the payments screen's and the export's.
  const userBefore = result.lines.filter((line) => isUserLineKey(line.key));
  const userAfter = result.closing.filter((row) => isUserLineKey(row.key));
  // **The block below the columns has two halves and the נטו stands between
  // them** (specs.md Part 5). Which half a row is in is the engine's answer and
  // not a list of keys kept here: a screen that sorted them itself would put
  // the next row the block grows into whichever half the `else` happened to be.
  const closingRows = result.closing.filter((row) => !isUserLineKey(row.key));
  const withholdingRows = closingRows.filter((row) => row.block === "withholding");
  const transferRows = closingRows.filter((row) => row.block === "transfer");
  // **A level is drawn only when something below it changes the figure**, which
  // is one rule over both boundaries rather than a special case at each. With
  // nothing withheld the נטו *is* the ברוטו, and with nothing transferred the
  // סך הכל *is* the נטו — and two identical figures under two headings read
  // as an error the user then goes looking for. So a month with no income tax
  // and no advance closes on one figure, a month with an advance shows the נטו
  // above it, and only a month that withholds something shows all three.
  //
  // Settled with the user on 2026-09-03: the collapse itself, and that the
  // surviving upper row is the נטו rather than the ברוטו. The bottom row is
  // always drawn, because it is the screen's answer.
  const changesTheFigure = (rows: ClosingLine[]) =>
    rows.some((row) => (row.amount ?? 0) !== 0);
  const withholds = changesTheFigure(withholdingRows);
  const transfers = changesTheFigure(transferRows) || changesTheFigure(userAfter);
  // **Everything the engine emitted that the three groups above did not claim.**
  // The groups are keyed whitelists, so a line the engine grows later — the
  // recuperation payment is the next one (item 15) — would otherwise count in
  // the month's total and appear nowhere, which is a figure gone missing with
  // nothing on screen to say so. This is the catch-all that makes the grouping
  // exhaustive by construction rather than by whoever adds the next line
  // remembering to come here.
  const claimed = new Set(
    [...salaryLines, ...dayLines, ...userBefore].map((line) => line.key),
  );
  const otherLines = result.lines.filter(
    (line) => line.column !== "H" && !claimed.has(line.key),
  );
  const userLineRow = (rows: SummarisableLine[], placement: UserLinePlacement) => (
    <Row
      {...why}
      label={he.month.preview.userLines}
      whyKey={`userLines-${placement}`}
      explanation={{ text: he.month.preview.userLinesWhy }}
      value={
        <MoneyValue
          agorot={sumOf(rows)}
          manual={rows.some((row) => row.manual)}
        />
      }
    />
  );

  return (
    <>
      <Card className="flex min-w-0 flex-col gap-2.5 px-4.5 py-3">
        <h2 dir="auto" className="text-[17px] font-semibold">
          {he.month.preview.title}
        </h2>

        {/* Both counts, which is what the Wage Protection Act asks of the
            payslip made from this month (specs.md items 2, 5). */}
        <Row
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

        <div className="flex flex-col gap-2 border-t border-line pt-2.5">
          {salaryLines.map((line) => (
            <Row
              {...why}
              key={line.key}
              label={line.label}
              whyKey={line.key}
              explanation={line.explanation}
              hint={unitsHint(line)}
              value={<MoneyValue agorot={line.amount} manual={line.manual} />}
            />
          ))}
        </div>

        {dayLines.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-line pt-2.5">
            <h3
              dir="auto"
              className="text-[13px] font-semibold tracking-[0.06em] text-ink-quiet"
            >
              {he.month.preview.dayAdditions(restDay)}
            </h3>
            {dayLines.map((line) => (
              <Row
                {...why}
                key={line.key}
                label={line.label}
                whyKey={line.key}
                explanation={line.explanation}
                hint={unitsHint(line)}
                value={<MoneyValue agorot={line.amount} manual={line.manual} />}
              />
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-line pt-2.5">
          {otherLines.map((line) => (
            <Row
              {...why}
              key={line.key}
              label={line.label}
              whyKey={line.key}
              explanation={line.explanation}
              hint={unitsHint(line)}
              value={<MoneyValue agorot={line.amount} manual={line.manual} />}
            />
          ))}
          {userBefore.length > 0 ? userLineRow(userBefore, "beforeGross") : null}
          {withholds ? (
            <>
              <Row
                {...why}
                label={he.month.preview.gross}
                whyKey="gross"
                explanation={{ text: he.sheet.why.gross }}
                value={<MoneyValue agorot={result.gross} chip="warm" />}
                strong
              />
              {withholdingRows.map((line) => (
                <Row
                  {...why}
                  key={line.key}
                  label={line.label}
                  whyKey={line.key}
                  explanation={line.explanation}
                  value={<MoneyValue agorot={line.amount} manual={line.manual} />}
                />
              ))}
            </>
          ) : null}
          {transfers ? (
            <>
              <Row
                {...why}
                label={he.month.preview.afterWithholding}
                whyKey="afterWithholding"
                explanation={{ text: he.sheet.why.afterWithholding }}
                value={<MoneyValue agorot={result.afterWithholding} chip="warm" />}
                strong
              />
              {userAfter.length > 0 ? userLineRow(userAfter, "afterGross") : null}
              {transferRows.map((line) => (
                <Row
                  {...why}
                  key={line.key}
                  label={line.label}
                  whyKey={line.key}
                  explanation={line.explanation}
                  value={<MoneyValue agorot={line.amount} manual={line.manual} />}
                />
              ))}
            </>
          ) : null}
        </div>

        <Card tone="tint" radius="tint" className="flex flex-col gap-2 px-3.5 py-2.5">
          <Row
            {...why}
            label={he.month.preview.net}
            whyKey="net"
            explanation={{ text: he.sheet.why.net }}
            value={<MoneyValue agorot={result.net} size="lg" chip="plain" />}
            strong
            within="tint"
          />
        </Card>
      </Card>

      {/* Outside the card above, and that is the point: this money went to a
          third party and never reaches the worker's own total (item 16). */}
      {thirdPartyLines.length > 0 ? (
        <Card className="flex min-w-0 flex-col gap-2.5 px-4.5 py-3">
          <h2 dir="auto" className="text-[17px] font-semibold">
            {he.month.preview.thirdParty}
          </h2>
          {thirdPartyLines.map((line) => (
            <Row
              {...why}
              key={line.key}
              label={line.label}
              whyKey={line.key}
              explanation={line.explanation}
              hint={coversHint(line)}
              value={<MoneyValue agorot={line.amount} manual={line.manual} />}
            />
          ))}
          {thirdPartySubtotal ? (
            <div className="border-t border-line pt-2.5">
              <Row
                {...why}
                label={thirdPartySubtotal.label}
                whyKey="subtotal-H"
                explanation={thirdPartySubtotal.explanation}
                value={<MoneyValue agorot={thirdPartySubtotal.amount} chip="warm" />}
                strong
              />
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="flex min-w-0 flex-col gap-2.5 px-4.5 py-3">
        <h2 dir="auto" className="text-[17px] font-semibold">
          {he.month.preview.balances}
        </h2>
        {result.balances.map((balance) => (
          <BalanceRow
            key={balance.kind}
            balance={balance}
            restDay={restDay}
            {...why}
          />
        ))}
        <div className="border-t border-line pt-2.5">
          <Row
            {...why}
            label={he.sheet.reporting.nationalInsuranceEstimate}
            whyKey="nationalInsuranceEstimate"
            explanation={{
              text: he.sheet.why.nationalInsuranceEstimate,
              link: "nationalInsurance",
            }}
            value={<MoneyValue agorot={result.nationalInsuranceEstimate} />}
          />
        </div>
      </Card>

      {result.warnings.length > 0 ? (
        <Card className="flex min-w-0 flex-col gap-1.5 px-4.5 py-3">
          <h2 dir="auto" className="text-[17px] font-semibold">
            {he.month.preview.warnings}
          </h2>
          {result.warnings.map((warning) => (
            <WhyPanel
              key={warning.key}
              id={`warning-${warning.key}`}
              open
              explanation={{ text: warning.message, link: warning.link }}
            />
          ))}
        </Card>
      ) : null}
    </>
  );
}

/**
 * A balance, with the days the month drew beside the days it left.
 *
 * Criterion 2 asks for both and the payslip has to carry both: a balance on its
 * own says where the worker stands and not what this month cost her.
 */
function BalanceRow({
  balance,
  restDay,
  openWhy,
  onToggleWhy,
}: {
  balance: BalanceLine;
  restDay: RestDay;
  openWhy: string | null;
  onToggleWhy: (key: string) => void;
}) {
  const marks = he.calendar.marks(restDay);
  return (
    <Row
      openWhy={openWhy}
      onToggleWhy={onToggleWhy}
      label={balance.kind === "vacation" ? marks.vacation : marks.sick}
      whyKey={`balance-${balance.kind}`}
      explanation={balance.explanation}
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
  );
}
