"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  closeSickSpell,
  confirmMonth,
  type BeforeExportRefusal,
  type BeforeExportResult,
} from "@/app/month/export/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MonthStepper, openingMonthOf } from "@/components/MonthStepper";
import { useWorkerScope } from "@/components/WorkerScope";
import type { DatedRate } from "@/lib/datedRates";
import { monthHasEnded, sameMonth, yearMonthText } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { dayLabel, fullDayLabel, monthLabel, rangeLabel } from "@/lib/dateLabels";
import type {
  ExportBlockKey,
  ExportQuestion,
  ExportQuestionDetail,
  ExportQuestionKey,
} from "@/lib/engine/beforeExport";
import { exportQuestionKeys } from "@/lib/engine/beforeExport";
import type { ConfirmedWage } from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import { formatAgorot, formatDays, parseShekels } from "@/lib/money";
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
 * refusal — settled with the user on 2026-09-09: she is the one who knows what
 * happened, and what item 18 buys is that she was asked.
 *
 * **Two things do block, and each says so in `specs.md` itself.** A month that
 * has not ended cannot be exported (item 21), and a month is not exported over
 * an open spell of sickness (item 18). The open spell is answered here, because
 * the question item 18 names — has she returned, and on what day — is this
 * screen's own.
 */

/** One month as this screen needs it: what it knows, what stops it, and the two
 * figures it has to have confirmed. */
export interface MonthBeforeExport {
  month: YearMonth;
  confirmedWage: ConfirmedWage;
  questions: ExportQuestion[];
  blocks: ExportBlockKey[];
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
}

export interface WorkerBeforeExport {
  worker: Worker;
  restDay: RestDay;
  /** Her salary as the profile holds it now. The screen says so when the
   * confirmed minimum is above it, because the month is then confirmed at the
   * minimum instead (specs.md item 3). */
  baseMonthlySalaryAgorot: number;
  /** Oldest first. */
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
}

/**
 * The month the screen opens on: the latest one that has ended.
 *
 * **Not the current month**, which is what every other screen opens on and what
 * would be wrong here: a month that has not ended cannot be exported, so
 * opening on it would greet every user with a block. The screen is asked for
 * when a month is finished, and the finished one is the one it opens on.
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

/** The figure a field opens with — the amount without its sign or grouping, so
 * what is shown is what `parseShekels` reads back. */
function amountFieldValue(agorot: number | null | undefined): string {
  return agorot === null || agorot === undefined
    ? ""
    : (agorot / 100).toFixed(2);
}

export function BeforeExportScreen({
  household,
  today,
  failure,
  sourceUrl,
}: BeforeExportScreenProps) {
  const { worker } = useWorkerScope();
  const [month, setMonth] = useState<YearMonth>(() =>
    openingExportMonth(
      household.flatMap((entry) => entry.months.map((each) => each.month)),
      today,
    ),
  );

  const entry =
    household.find((candidate) => candidate.worker.id === worker.id) ??
    household[0];
  const shown = entry.months.find((each) => sameMonth(each.month, month));

  return (
    <section className="mx-auto flex w-full max-w-[760px] flex-col gap-4 pb-6">
      <header className="flex flex-col gap-1.5">
        <span
          dir="auto"
          className="text-[14px] font-semibold tracking-[0.06em] text-clay-deep"
        >
          {he.beforeExport.eyebrow}
        </span>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">
            <Bidi>{monthLabel(month)}</Bidi>
            <span> </span>
            <span dir="auto">{he.beforeExport.of}</span>
            <span> </span>
            <Bidi>{entry.worker.name}</Bidi>
          </h1>
          <MonthStepper month={month} onMonthChange={setMonth} />
        </div>
        <p
          dir="auto"
          className="max-w-[62ch] text-[17px] leading-[1.5] font-light text-ink-mute text-pretty"
        >
          {he.beforeExport.lead}
        </p>
      </header>

      {shown ? (
        <MonthConfirmation
          key={`${entry.worker.id}-${month.year}-${month.month}`}
          workerId={entry.worker.id}
          restDay={entry.restDay}
          baseMonthlySalaryAgorot={entry.baseMonthlySalaryAgorot}
          shown={shown}
          failure={failure}
          sourceUrl={sourceUrl}
        />
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

/**
 * One month's confirmation, and every answer belongs to it.
 *
 * It is keyed by worker and month above, so stepping to another month starts
 * the conversation again rather than carrying answers across: an answer is
 * about the month it was given for, and item 18's questions are asked before
 * *every* export.
 */
function MonthConfirmation({
  workerId,
  restDay,
  baseMonthlySalaryAgorot,
  shown,
  failure,
  sourceUrl,
}: {
  workerId: string;
  restDay: RestDay;
  baseMonthlySalaryAgorot: number;
  shown: MonthBeforeExport;
  failure: ScrapeFailureKind | null;
  sourceUrl: string;
}) {
  const words = he.beforeExport;
  const [saving, startSaving] = useTransition();
  const [refusal, setRefusal] = useState<BeforeExportRefusal | null>(null);
  const [done, setDone] = useState(false);

  const [answers, setAnswers] = useState<
    Partial<Record<ExportQuestionKey, boolean>>
  >({});
  const [wageText, setWageText] = useState(() =>
    amountFieldValue(shown.offeredWage?.value ?? shown.confirmedWage.minimumAgorot),
  );
  const [editingWage, setEditingWage] = useState(false);
  const [rateText, setRateText] = useState(() =>
    amountFieldValue(
      shown.recuperation?.storedAgorot ?? shown.recuperation?.offeredAgorot,
    ),
  );

  // Read through the one reader every amount in the application goes through,
  // so the figure shown is the figure that would be stored and neither of them
  // ever passes through a float (`money.ts`).
  const typedWage = parseShekels(wageText);

  const effectiveFrom =
    shown.offeredWage?.effectiveFrom ?? shown.confirmedWage.effectiveFrom;

  function run(action: () => Promise<BeforeExportResult>, onDone?: () => void) {
    setRefusal(null);
    startSaving(async () => {
      const result = await action();
      if (result.ok) onDone?.();
      else setRefusal(result.reason);
    });
  }

  /** Answers that disagree with what the month recorded. A warning and never a
   * refusal, and it names where the missing fact is actually recorded. */
  const mismatches = useMemo(
    () =>
      shown.questions.filter(
        (question) =>
          answers[question.key] !== undefined &&
          answers[question.key] !== question.recorded,
      ),
    [answers, shown.questions],
  );

  const answered = exportQuestionKeys.every(
    (key) => answers[key] !== undefined,
  );
  const blocked = shown.blocks.length > 0;

  return (
    <div
      aria-busy={saving}
      className={[
        "flex flex-col gap-4 transition-opacity",
        saving ? "opacity-60" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Item 4, and all four things it asks for: the figure, the date it took
          effect, where it was read from, and a way to correct it. */}
      <Card
        tone="tint"
        radius="tint"
        data-wage=""
        className="flex flex-col gap-2.5 px-5 py-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <span className="flex min-w-0 flex-col gap-1">
            <span dir="auto" className="text-[17px] font-semibold">
              {words.wage.title}
            </span>
            <span className="text-[14px] font-light text-ink-mute">
              <span dir="auto">{words.wage.inForceFrom}</span>
              <Bidi noTranslate>{fullDayLabel(effectiveFrom)}</Bidi>
              <span> · </span>
              <span dir="auto">{words.wage.readFrom}</span>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-forest"
              >
                <span dir="auto">{words.wage.sourceName}</span>
              </a>
            </span>
          </span>
          {/* The figure stays in view while the field is open, so "לתקן" is a
              toggle and not a door that closes behind the user. */}
          <span className="flex flex-none items-center gap-3">
            <Bidi noTranslate className="text-[24px] font-bold tracking-[-0.02em]">
              {typedWage === null
                ? he.placeholder.amount
                : formatAgorot(typedWage)}
            </Bidi>
            <button
              type="button"
              aria-pressed={editingWage}
              onClick={() => setEditingWage((open) => !open)}
              className="text-[15px] font-medium text-forest transition-colors hover:underline hover:underline-offset-2"
            >
              <span dir="auto">
                {editingWage ? words.wage.cancel : words.wage.correct}
              </span>
            </button>
          </span>
        </div>

        {failure !== null ? (
          <p
            dir="auto"
            className="text-[14px] leading-[1.55] font-light text-clay-deep text-pretty"
          >
            {words.wage.failed[failure]}
          </p>
        ) : null}
        {shown.offeredWage === null ? (
          <p
            dir="auto"
            className="text-[14px] leading-[1.55] font-light text-clay-deep text-pretty"
          >
            {words.wage.unknown}
          </p>
        ) : null}

        {/* Item 3: a salary may never sit below the minimum wage, so a profile
            still holding last year's figure does not stop the export — the
            month is confirmed at the wage in force, and the user is told before
            she presses rather than after. */}
        {typedWage !== null && baseMonthlySalaryAgorot < typedWage ? (
          <p
            data-raised=""
            dir="auto"
            className="text-[14px] leading-[1.55] font-light text-clay-deep text-pretty"
          >
            {words.wage.raised(baseMonthlySalaryAgorot, typedWage)}
          </p>
        ) : null}

        {editingWage ? (
          <label className="flex max-w-[280px] flex-col gap-1">
            <span dir="auto" className="text-[13px] font-medium text-ink-warm">
              {words.wage.amountLabel}
            </span>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              data-wage-input=""
              value={wageText}
              onChange={(event) => setWageText(event.target.value)}
              placeholder={he.placeholder.amountInput}
              className="w-full rounded-card-sm border border-line bg-surface px-3 py-2 text-[15px] text-ink"
            />
          </label>
        ) : null}

        <p
          dir="auto"
          className="text-[14px] leading-[1.55] font-light text-ink-mute text-pretty"
        >
          {words.wage.note}
        </p>
      </Card>

      {shown.openSpell !== null ? (
        <OpenSpellBlock
          workerId={workerId}
          spell={shown.openSpell}
          onRun={run}
          refusal={refusal}
        />
      ) : null}

      {shown.blocks.includes("monthNotEnded") ? (
        <Card
          data-block="monthNotEnded"
          className="flex flex-col gap-1.5 border border-line-strong bg-tint px-5 py-4"
        >
          <span dir="auto" className="text-[17px] font-semibold text-clay-deep">
            {words.notEnded.title}
          </span>
          <p dir="auto" className="text-[15px] leading-[1.55] font-light text-ink-mute">
            {words.notEnded.note}
          </p>
        </Card>
      ) : null}

      {/* Item 15: the days come from her seniority and are reported; the day
          rate is the figure the application cannot derive, so it is confirmed
          here the way the minimum wage is. */}
      {shown.recuperation !== null ? (
        <Card
          data-recuperation-rate=""
          className="flex flex-col gap-2.5 px-5 py-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <span className="flex min-w-0 flex-col gap-1">
              <span dir="auto" className="text-[17px] font-semibold">
                {words.recuperation.title}
              </span>
              <span className="text-[14px] font-light text-ink-mute">
                <span dir="auto">{words.recuperation.days}</span>
                <span> </span>
                <Bidi noTranslate>{formatDays(shown.recuperation.days)}</Bidi>
                <span> </span>
                <span dir="auto">{he.units.days}</span>
              </span>
            </span>
            <label className="flex max-w-[220px] flex-none flex-col gap-1">
              <span dir="auto" className="text-[13px] font-medium text-ink-warm">
                {words.recuperation.amountLabel}
              </span>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                data-recuperation-input=""
                value={rateText}
                onChange={(event) => setRateText(event.target.value)}
                placeholder={he.placeholder.amountInput}
                className="w-full rounded-card-sm border border-line bg-surface px-3 py-2 text-[15px] text-ink"
              />
            </label>
          </div>
          {shown.recuperation.offeredAgorot === null ? (
            <p
              dir="auto"
              className="text-[14px] leading-[1.55] font-light text-clay-deep text-pretty"
            >
              {words.recuperation.unknown}
            </p>
          ) : null}
          <p
            dir="auto"
            className="text-[14px] leading-[1.55] font-light text-ink-mute text-pretty"
          >
            {words.recuperation.note}
          </p>
        </Card>
      ) : null}

      <Card className="flex flex-col overflow-hidden px-0 py-0">
        {shown.questions.map((question, index) => (
          <QuestionRow
            key={question.key}
            question={question}
            restDay={restDay}
            answer={answers[question.key]}
            first={index === 0}
            onAnswer={(value) =>
              setAnswers((current) => ({ ...current, [question.key]: value }))
            }
          />
        ))}
      </Card>

      {mismatches.length > 0 ? (
        <Card
          data-mismatch=""
          className="flex flex-col gap-1.5 border border-line-strong bg-tint px-5 py-4"
        >
          <span dir="auto" className="text-[17px] font-semibold text-clay-deep">
            {words.mismatch.title}
          </span>
          <ul className="flex flex-col gap-1">
            {mismatches.map((question) => (
              <li
                key={question.key}
                dir="auto"
                className="text-[15px] leading-[1.55] font-light text-ink-mute text-pretty"
              >
                {words.questions[question.key].mismatch}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Item 2's two versions, as two buttons of equal weight: neither
              artboard draws a chooser, and the difference between the files is
              one the user has to be able to see before she picks (settled
              2026-09-10). Both confirm the month first, which is what stage 5's
              step 7 settled the export button does. */}
          {[false, true].map((withNotes) => (
            <button
              key={withNotes ? "notes" : "plain"}
              type="button"
              {...(withNotes ? { "data-finish-notes": "" } : { "data-finish": "" })}
              disabled={blocked || !answered || saving}
              onClick={() =>
                run(
                  () =>
                    confirmMonth(workerId, shown.month, {
                      minimumText: wageText,
                      effectiveFrom,
                      ...(shown.recuperation === null
                        ? {}
                        : { recuperationRateText: rateText }),
                    }),
                  () => {
                    setDone(true);
                    download(workerId, shown.month, withNotes);
                  },
                )
              }
              className="rounded-card-sm bg-forest px-6 py-3 text-[17px] font-semibold text-surface transition-colors hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span dir="auto">
                {withNotes ? words.finish.actionWithNotes : words.finish.action}
              </span>
            </button>
          ))}
          <Link
            href="/month"
            className="text-[16px] text-ink-mute transition-colors hover:text-forest"
          >
            <span dir="auto">{words.finish.back}</span>
          </Link>
        </div>

        {blocked ? (
          <p dir="auto" className="text-[14px] font-light text-ink-quiet">
            {words.finish.blocked}
          </p>
        ) : !answered ? (
          <p dir="auto" className="text-[14px] font-light text-ink-quiet">
            {words.finish.unanswered}
          </p>
        ) : null}

        {/* After the reason the buttons cannot be pressed, never before it: a
            user who is blocked wants to know why, and an explanation of a
            choice she cannot yet make is in the way of the answer. */}
        <p dir="auto" className="text-[14px] font-light text-ink-quiet text-pretty">
          {words.finish.versions}
        </p>

        {refusal !== null ? (
          <p
            aria-live="polite"
            dir="auto"
            className="text-[14px] leading-[1.5] font-light text-clay-deep text-pretty"
          >
            {refusalText(refusal)}
          </p>
        ) : null}

        {done ? (
          <p
            aria-live="polite"
            data-confirmed=""
            dir="auto"
            className="text-[15px] font-medium text-forest"
          >
            {words.finish.done}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The file itself, asked for once the month is confirmed.
 *
 * **The confirmation is a server action and the file is an address**, so the two
 * are not one request: confirming writes the month, and the browser then fetches
 * the file. Doing it in that order is what item 4 asks for — the wage confirmed
 * *before* the export and never beside it.
 *
 * **An anchor clicked in code and not a navigation**, because this address
 * answers with a file rather than a page: `router.push` would try to route to
 * it and `location.href` would be a navigation the browser immediately cancels
 * for the download. An anchor is the primitive the download actually is, which
 * is also why the framework's rule against assigning `location` does not apply
 * here rather than being switched off.
 */
function download(workerId: string, month: YearMonth, withNotes: boolean): void {
  const query = new URLSearchParams({
    worker: workerId,
    month: yearMonthText(month),
    ...(withNotes ? { notes: "1" } : {}),
  });
  const link = document.createElement("a");
  link.href = `/month/export/file?${query.toString()}`;
  // The name comes from the response's own `Content-Disposition`, which is
  // where it belongs: a name written here as well would be a second copy to
  // disagree with it.
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

/** What the refusal was, as a sentence — never a code (specs.md item 25). The
 * two amount refusals share a wording because they are the same rule read
 * twice: a figure the user did not type. */
function refusalText(reason: BeforeExportRefusal): string {
  const words = he.beforeExport;
  if (reason === "beforeTheSpell") return words.openSpell.refused.beforeTheSpell;
  if (reason === "blocked") return words.finish.blocked;
  return words.wage.refused.amount;
}

/**
 * The open spell, and the one question item 18 words for us: has she returned,
 * and on what day.
 *
 * **It is a block and not a warning**, and the sentence beneath says why in the
 * item's own terms — a spell left open by mistake counts days for a worker who
 * was already back.
 */
function OpenSpellBlock({
  workerId,
  spell,
  onRun,
  refusal,
}: {
  workerId: string;
  spell: { spanId: string; from: IsoDate };
  onRun: (action: () => Promise<BeforeExportResult>) => void;
  refusal: BeforeExportRefusal | null;
}) {
  const words = he.beforeExport.openSpell;
  const [returnedOn, setReturnedOn] = useState("");

  return (
    <Card
      data-block="openSickSpell"
      className="flex flex-col gap-2.5 border border-line-strong bg-tint px-5 py-4"
    >
      <span dir="auto" className="text-[18px] font-semibold text-clay-deep">
        {words.title}
      </span>
      <p className="text-[16px] leading-[1.55] font-light text-ink-mute text-pretty">
        <span dir="auto">{words.since}</span>
        <Bidi noTranslate>{fullDayLabel(spell.from)}</Bidi>
        <span>. </span>
        <span dir="auto">{words.ask}</span>
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span dir="auto" className="text-[13px] font-medium text-ink-warm">
            {words.returnLabel}
          </span>
          <input
            type="date"
            dir="ltr"
            data-return-input=""
            value={returnedOn}
            onChange={(event) => setReturnedOn(event.target.value)}
            className="rounded-card-sm border border-line bg-surface px-3 py-2 text-[15px] text-ink"
          />
        </label>
        <button
          type="button"
          data-close-spell=""
          disabled={returnedOn === ""}
          onClick={() => onRun(() => closeSickSpell(workerId, spell.spanId, returnedOn))}
          className="rounded-card-sm border border-line bg-surface px-4 py-2 text-[15px] font-semibold text-ink transition-colors hover:border-line-hover disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span dir="auto">{words.save}</span>
        </button>
      </div>
      {refusal === "beforeTheSpell" ? (
        <p
          aria-live="polite"
          dir="auto"
          className="text-[14px] font-light text-clay-deep"
        >
          {words.refused.beforeTheSpell}
        </p>
      ) : null}
      <p
        dir="auto"
        className="text-[14px] leading-[1.55] font-light text-ink-mute text-pretty"
      >
        {words.note}
      </p>
    </Card>
  );
}

/**
 * One question, with what the month already knows under it (specs.md item 18).
 *
 * **The chips do not open pre-answered.** What the month knows is written
 * beneath the question in words, and the answer is the user's — a chip already
 * pressed would be answered by silence, which is the one thing this screen
 * exists to prevent.
 */
function QuestionRow({
  question,
  restDay,
  answer,
  first,
  onAnswer,
}: {
  question: ExportQuestion;
  restDay: RestDay;
  answer: boolean | undefined;
  first: boolean;
  onAnswer: (value: boolean) => void;
}) {
  const words = he.beforeExport.questions;
  const shown = shownDetailsOf(question);
  return (
    <div
      data-question={question.key}
      className={[
        "flex flex-wrap items-center gap-4 px-6 py-4",
        first ? "" : "border-t border-line",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="flex min-w-0 flex-1 basis-[300px] flex-col gap-0.5">
        <span dir="auto" className="text-[17px] font-medium">
          {askOf(question.key, restDay)}
        </span>
        <span dir="auto" className="text-[14px] font-light text-ink-quiet text-pretty">
          {knownOf(question, restDay)}
        </span>
        {shown.length > 0 ? (
          <span data-detail-list="" className="mt-1 flex flex-col gap-0.5">
            {shown.map((detail, index) => (
              <span
                // The list is derived whole from the month and holds no state
                // of its own, and two advances of the same amount are two
                // identical rows — so the position is the only honest key.
                key={index}
                data-detail=""
                className="text-[14px] font-normal text-ink-warm"
              >
                <Bidi noTranslate>{detailOf(detail)}</Bidi>
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <span className="flex flex-none items-center gap-2">
        <AnswerChip
          selected={answer === true}
          onClick={() => onAnswer(true)}
          label={words.yes}
        />
        <AnswerChip
          selected={answer === false}
          onClick={() => onAnswer(false)}
          label={words.no}
        />
      </span>
    </div>
  );
}

function AnswerChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "rounded-full border px-4.5 py-2 text-[15px] transition-colors",
        selected
          ? "border-line-hover bg-tint font-semibold text-ink"
          : "border-line bg-surface font-normal text-ink-mute hover:border-line-hover",
      ].join(" ")}
    >
      <span dir="auto">{label}</span>
    </button>
  );
}

/** The question itself. Only one of the six names a day of the week, and it
 * names *her* day (specs.md item 5). */
function askOf(key: ExportQuestionKey, restDay: RestDay): string {
  const words = he.beforeExport.questions;
  return key === "freeRestDays" ? words.freeRestDays.ask(restDay) : words[key].ask;
}

/** What the month already holds, in the words each question needs — the half of
 * item 18 that makes a question a confirmation rather than a memory test. */
function knownOf(question: ExportQuestion, restDay: RestDay): string {
  const words = he.beforeExport.questions;
  const { counts } = question;
  switch (question.key) {
    case "advanceGranted":
      return words.advanceGranted.from(
        question.recorded ? counts.agorot ?? 0 : null,
        counts.items ?? 0,
      );
    case "advanceRepaid":
      return words.advanceRepaid.from(
        question.recorded ? counts.agorot ?? 0 : null,
        counts.items ?? 0,
      );
    case "freeRestDays":
      return words.freeRestDays.from(restDay, counts.days ?? 0);
    case "holidaysWorked":
      return words.holidaysWorked.from(counts.items ?? 0, counts.of ?? 0);
    case "vacationDays":
      return words.vacationDays.from(counts.days ?? 0);
    case "sickDays":
      return words.sickDays.from(counts.days ?? 0);
    case "thirdParty":
      return words.thirdParty.from(counts.items ?? 0);
  }
}

/**
 * The items worth listing under the question, which is not always every item
 * the month holds.
 *
 * **A lone advance is not listed, because the sentence above it is already the
 * amount.** `נרשם פירעון של 1,000 ₪` with `1,000 ₪` printed underneath is the
 * same figure twice, and a screen that says a thing twice reads as a screen
 * that has counted it twice — seen on the built screen on 2026-09-10. Two
 * advances are listed: the sentence then carries their *sum*, and how it was
 * made up is what the list adds. A payment to a third party is always listed,
 * because its sentence carries neither the amount nor what it was for.
 */
function shownDetailsOf(question: ExportQuestion): ExportQuestionDetail[] {
  const only = question.details.length === 1 ? question.details[0] : null;
  const saidAlready =
    only !== null && only.shape === "money" && only.kind === undefined;
  return saidAlready ? [] : question.details;
}

/**
 * One recorded item in words — the dates off the calendar and the amounts off
 * the payments screen, which is what makes the question a confirmation of the
 * month rather than of a total (specs.md item 18, settled 2026-09-10).
 *
 * **The date is worded by `dateLabels`** and never here: a range inside a month
 * reads "16–20 באוגוסט" and a range across one names both months, and that is
 * already the calendar's own wording rather than a second one invented on this
 * screen.
 */
function detailOf(detail: ExportQuestionDetail): string {
  const words = he.beforeExport.questions.detail;
  switch (detail.shape) {
    case "days": {
      const dates = rangeLabel(detail.from, detail.to);
      const fraction = detail.fraction;
      if (fraction === undefined || fraction === 1) return dates;
      const part = fraction === 0.5 ? words.half : words.partOfDay(fraction);
      return `${dates}${words.separator}${part}`;
    }
    case "holiday": {
      const said = detail.worked ? words.worked : words.notWorked;
      return `${dayLabel(detail.on)}${words.separator}${said}`;
    }
    case "money": {
      const amount = formatAgorot(detail.agorot);
      return detail.kind === undefined
        ? amount
        : `${he.sheet.thirdParty[detail.kind]}${words.separator}${amount}`;
    }
  }
}
