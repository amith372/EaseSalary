"use client";

/**
 * The card of `לפני הייצוא` — one month, its wage confirmation, its questions
 * and the button that writes the month and fetches the file.
 *
 * **The screen next door chooses the month and the worker**; everything below
 * is about the one month it handed over, which is why they are two files and
 * not one of nine hundred lines.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAction } from "@/components/useAction";
import {
  closeSickSpell,
  confirmMonth,
  type BeforeExportRefusal,
  type BeforeExportResult,
} from "@/app/month/export/actions";
import { Sentence } from "@/components/AlertsScreen";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { AmountField, busyAttrs, inputClass } from "@/components/Field";
import { SheetBadge } from "@/components/icons";
import { MoneyValue } from "@/components/MoneyValue";
import {
  yearMonthText,
} from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { dayLabel, fullDayLabel, rangeLabel } from "@/lib/dateLabels";
import type {
  ExportQuestion,
  ExportQuestionDetail,
  ExportQuestionKey,
} from "@/lib/engine/beforeExport";
import { exportQuestionKeys } from "@/lib/engine/beforeExport";
import type { IncomeTaxSetting } from "@/lib/engine/types";
import type { Gender } from "@/lib/engine/types";
import type { MonthBeforeExport } from "@/components/BeforeExportScreen";
import { he } from "@/lib/i18n/he";
import {
  amountFieldValue,
  formatAgorot,
  formatRate,
  formatDays,
  formatPercent,
  parseShekels,
} from "@/lib/money";
import type { ScrapeFailureKind } from "@/lib/scrape/failure";
import { holidayStateOf } from "@/lib/spans";
import type { IsoDate, YearMonth } from "@/lib/types";


/**
 * One month's confirmation, and every answer belongs to it.
 *
 * It is keyed by worker and month above, so stepping to another month starts
 * the conversation again rather than carrying answers across: an answer is
 * about the month it was given for, and item 18's questions are asked before
 * *every* export.
 */
export function MonthConfirmation({
  workerId,
  gender,
  restDay,
  shown,
  failure,
  sourceUrl,
}: {
  workerId: string;
  /** The raised-wage note and the open-spell question both name them, and agree
   * with them rather than with a default (`he.workerWords`). */
  gender: Gender;
  restDay: RestDay;
  shown: MonthBeforeExport;
  failure: ScrapeFailureKind | null;
  sourceUrl: string;
}) {
  const words = he.beforeExport;
  // `busyAt` names which of the two files was asked for, so the button that
  // was pressed is the one that says it is working — the same mechanism every
  // other list of controls uses, rather than a second one kept here.
  const { refusal, fault, run, saving, busyAt } = useAction<BeforeExportRefusal>();
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
  const baseMonthlySalaryAgorot = shown.baseMonthlySalaryAgorot;

  const effectiveFrom =
    shown.offeredWage?.effectiveFrom ?? shown.confirmedWage.effectiveFrom;

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

  const answeredCount = exportQuestionKeys.filter(
    (key) => answers[key] !== undefined,
  ).length;
  const answered = answeredCount === exportQuestionKeys.length;
  const blocked = shown.blocks.length > 0;

  /** The first question with no answer, which is where the count's control
   * jumps to. `undefined` once every one of them has been answered. */
  const firstUnanswered = exportQuestionKeys.find(
    (key) => answers[key] === undefined,
  );

  // Which row the jump last landed on. Held rather than derived, because the
  // mark says "this is the one you were sent to" and not "this one is
  // unanswered" — the other six are unanswered too and none of them is marked.
  const [jumpedTo, setJumpedTo] = useState<ExportQuestionKey | null>(null);

  // The mark goes the moment the row is answered, so it never outlives the
  // thing it was pointing at. Derived rather than cleared in the handler: an
  // answer given to a marked row by any route clears it.
  const marked =
    jumpedTo !== null && answers[jumpedTo] === undefined ? jumpedTo : null;

  /** Scroll the first unanswered question into view and put the cursor on its
   * first chip — a handler and not an `href`, because `DESIGN.md` records a
   * fragment link on this application scrolling nowhere. */
  const jumpToFirstUnanswered = (): void => {
    if (firstUnanswered === undefined) return;
    setJumpedTo(firstUnanswered);
    // Found in the document and not through a ref, because `Card` carries
    // `data-*` attributes and nothing else by design — and `data-question` is
    // already the handle the browser suite addresses a row by.
    const row = document.querySelector<HTMLElement>(
      `[data-question="${firstUnanswered}"]`,
    );
    if (row === null) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    // The row is where the eye goes and the chip is where the answer is given,
    // so the cursor lands on the chip rather than on the row around it.
    row.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  };

  return (
    <div
      aria-busy={saving}
      className="flex flex-col gap-5.5"
    >
      {/* Item 4, and all four things it asks for: the figure, the date it took
          effect, where it was read from, and a way to correct it. */}
      <Card
        tone="tint"
        data-wage=""
        className="flex flex-col gap-3 border border-line-strong px-5 py-5 sm:px-6.5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <span className="flex min-w-0 flex-col gap-1">
            <span dir="auto" className="text-[17px] font-semibold">
              {words.wage.title}
            </span>
            <span className="text-[15px] font-light text-ink-warm">
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
            <Bidi noTranslate className="text-[26px] font-bold tracking-[-0.02em]">
              {typedWage === null
                ? he.placeholder.amount
                : formatRate(typedWage)}
            </Bidi>
            <button
              type="button"
              aria-pressed={editingWage}
              onClick={() => setEditingWage((open) => !open)}
              className="-my-2 rounded-card-sm px-1 py-2 text-[15px] font-medium whitespace-nowrap text-forest transition-colors hover:underline hover:underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest"
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
            data-wage-failure={failure}
            className="text-[14px] leading-[1.55] font-light text-clay-deep text-pretty"
          >
            <span>{words.wage.failed[failure]} </span>
            <Link
              // The employment group, because that is where the wage row and its
              // source are drawn — the sentence promises a provenance and has to
              // land where it is.
              href="/settings#employment"
              className="font-medium underline underline-offset-2 hover:text-forest"
            >
              <span dir="auto">{words.wage.failedWhere}</span>
            </Link>
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
            they press rather than after. */}
        {typedWage !== null && baseMonthlySalaryAgorot < typedWage ? (
          <p
            data-raised=""
            dir="auto"
            className="text-[14px] leading-[1.55] font-light text-clay-deep text-pretty"
          >
            {words.wage.raised(baseMonthlySalaryAgorot, typedWage, gender)}
          </p>
        ) : null}

        {editingWage ? (
          <AmountField
            label={words.wage.amountLabel}
            fieldClassName="max-w-[280px]"
            data-wage-input=""
            value={wageText}
            onChange={(event) => setWageText(event.target.value)}
          />
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
          gender={gender}
          spell={shown.openSpell}
          onRun={run}
          refusal={refusal}
          fault={fault}
        />
      ) : null}

      {shown.stillRunning ? (
        <Card
          data-warning="monthNotEnded"
          className={blockClass}
        >
          <BlockTitle>{words.notEnded.title}</BlockTitle>
          <p dir="auto" className="text-[15px] leading-[1.55] font-light text-ink-mute">
            {words.notEnded.note}
          </p>
        </Card>
      ) : null}

      {shown.blocks.includes("unansweredHoliday") ? (
        <Card
          data-block="unansweredHoliday"
          className={blockClass}
        >
          <BlockTitle>{words.unansweredHoliday.title}</BlockTitle>
          <p dir="auto" className="text-[15px] leading-[1.55] font-light text-ink-mute">
            {words.unansweredHoliday.note}
          </p>
        </Card>
      ) : null}

      {/* Item 17: the tax is confirmed before an export and stored with the
          month like the minimum wage is. **It is shown and explained and not
          typed here** — a month departs from the worker's setting through the
          field on the payments screen, and a second field beside the button
          that files the month would be a second way to write the same
          override. */}
      {shown.incomeTax === null ? null : (
        <Card
          data-income-tax=""
          className="flex flex-col gap-3 px-5 py-5 sm:px-6.5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <span className="flex min-w-0 flex-col gap-1">
              <span dir="auto" className="text-[17px] font-semibold">
                {words.incomeTax.title}
              </span>
              {/* The same words the payments card says it with, so the two
                  screens cannot come to name the figure's source differently. */}
              <span dir="auto" className="text-[15px] font-light text-ink-warm">
                {shown.incomeTax.manualAgorot === null
                  ? taxSourceWords(shown.incomeTax.setting)
                  : he.month.actions.incomeTax.from.manual}
              </span>
            </span>
            {/* **The figure the sheet will print**, which is the amount they
                typed where they typed one: a card saying ₪0.00 in front of a file
                that prints ₪450 is the one thing a confirmation may not do. The
                figure underneath is still what is stored (item 17). */}
            <span data-income-tax-amount="">
              <MoneyValue
                agorot={shown.incomeTax.manualAgorot ?? shown.incomeTax.agorot}
              />
            </span>
          </div>
          {shown.incomeTax.missingTableYear === null ? null : (
            <p
              data-income-tax-missing=""
              dir="auto"
              className="text-[14px] leading-[1.55] font-light text-clay-deep text-pretty"
            >
              {he.sheet.warnings.taxBracketsMissing(
                shown.incomeTax.missingTableYear,
              )}
            </p>
          )}
          <p
            dir="auto"
            className="text-[14px] leading-[1.55] font-light text-ink-mute text-pretty"
          >
            {shown.incomeTax.manualAgorot === null
              ? words.incomeTax.note
              : words.incomeTax.manualNote}
          </p>
          <Link
            href="/payments"
            className="self-start text-[14px] font-medium hover:underline hover:underline-offset-4"
          >
            <span dir="auto">{words.incomeTax.correct}</span>
          </Link>
        </Card>
      )}

      {/* Item 15: the days come from their seniority and are reported; the day
          rate is the figure the application cannot derive, so it is confirmed
          here the way the minimum wage is. */}
      {shown.recuperation !== null ? (
        <Card
          data-recuperation-rate=""
          className="flex flex-col gap-3 px-5 py-5 sm:px-6.5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <span className="flex min-w-0 flex-col gap-1">
              <span dir="auto" className="text-[17px] font-semibold">
                {words.recuperation.title}
              </span>
              <span className="text-[15px] font-light text-ink-warm">
                <span dir="auto">{words.recuperation.days}</span>
                <span> </span>
                <Bidi noTranslate>{formatDays(shown.recuperation.days)}</Bidi>
                <span> </span>
                <span dir="auto">{he.units.days}</span>
              </span>
            </span>
            <AmountField
              label={words.recuperation.amountLabel}
              fieldClassName="max-w-[220px] flex-none"
              data-recuperation-input=""
              value={rateText}
              onChange={(event) => setRateText(event.target.value)}
            />
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

      <Card className="flex flex-col overflow-hidden">
        {shown.questions.map((question, index) => (
          <QuestionRow
            key={question.key}
            question={question}
            restDay={restDay}
            gender={gender}
            answer={answers[question.key]}
            first={index === 0}
            marked={marked === question.key}
            onAnswer={(value) =>
              setAnswers((current) => ({ ...current, [question.key]: value }))
            }
          />
        ))}
      </Card>

      {mismatches.length > 0 ? (
        <Card
          data-mismatch=""
          className={blockClass}
        >
          <BlockTitle>{words.mismatch.title}</BlockTitle>
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

      <div className="flex flex-col gap-2.5 border-t border-line pt-5.5">
        {/* Why the buttons are withheld, above them and not after them: read in
            order, two disabled buttons before the reason for them is the
            screen refusing to say what would release it.

            **The two gates stay two.** A block is not an unanswered question
            and no answer makes it go away, so the count is not shown beside
            one — a count reading seven of seven next to a button that still
            refuses teaches the user that the count lies. */}
        {blocked ? (
          <p dir="auto" className="text-[14px] font-light text-ink-quiet">
            {words.finish.blocked}
          </p>
        ) : !answered ? (
          <div
            data-answered-count=""
            aria-live="polite"
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] text-ink-warm"
          >
            <Sentence
              said={words.finish.counted(answeredCount, exportQuestionKeys.length)}
              valueClass="font-semibold text-ink"
            />
            <span aria-hidden="true" className="text-ink-faint">
              ·
            </span>
            <button
              type="button"
              data-to-unanswered=""
              onClick={jumpToFirstUnanswered}
              className="border-b-[1.5px] border-forest pb-px text-[15px] font-semibold text-forest-deep transition-colors hover:border-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              <span dir="auto">
                {words.finish.toFirstUnanswered(
                  exportQuestionKeys.length - answeredCount,
                )}
              </span>
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4.5 gap-y-3">
          {/* Item 2's two versions, as two buttons of equal weight: neither
              artboard draws a chooser, and the difference between the files is
              one the user has to be able to see before they pick. Both confirm
              the month first, as the export button does. */}
          {[false, true].map((withNotes) => {
            const which = withNotes ? "notes" : "plain";
            return (
            <button
              key={which}
              type="button"
              {...(withNotes ? { "data-finish-notes": "" } : { "data-finish": "" })}
              disabled={blocked || !answered}
              onClick={() => {
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
                  which,
                );
              }}
              {...busyAttrs(
                busyAt(which),
                "flex items-center gap-2.75 rounded-tint bg-forest px-6 py-3.5 text-[17px] font-semibold text-surface transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-45 sm:px-7.5 sm:text-[18px]",
              )}
            >
              <SheetBadge className="size-5 text-forest" />
              <span dir="auto">
                {withNotes ? words.finish.actionWithNotes : words.finish.action}
              </span>
            </button>
            );
          })}
          <Link
            href="/"
            className="py-2 text-[16px] text-ink-mute transition-colors hover:text-forest"
          >
            <span dir="auto">{words.finish.back}</span>
          </Link>
        </div>

        {/* After the reason the buttons cannot be pressed, never before it: a
            user who is blocked wants to know why, and an explanation of a
            choice they cannot yet make is in the way of the answer. */}
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
        ) : fault ? (
          <p
            aria-live="polite"
            dir="auto"
            data-role="fault"
            className="text-[14px] leading-[1.5] font-light text-clay-deep text-pretty"
          >
            {he.fault}
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
 * The open spell, and the one question item 18 words for us: have they returned,
 * and on what day.
 *
 * **It is a block and not a warning**, and the sentence beneath says why in the
 * item's own terms — a spell left open by mistake counts days for a worker who
 * was already back.
 */
function OpenSpellBlock({
  workerId,
  gender,
  spell,
  onRun,
  refusal,
  fault,
}: {
  workerId: string;
  gender: Gender;
  spell: { spanId: string; from: IsoDate };
  onRun: (action: () => Promise<BeforeExportResult>) => void;
  refusal: BeforeExportRefusal | null;
  /** The action never answered. Drawn in the same place as the refusal, because
   * the question that failed is the one they are looking at. */
  fault: boolean;
}) {
  const words = he.beforeExport.openSpell;
  const [returnedOn, setReturnedOn] = useState("");

  return (
    <Card
      data-block="openSickSpell"
      className={blockClass}
    >
      <BlockTitle>{words.title}</BlockTitle>
      <p className="text-[16px] leading-[1.55] font-light text-ink-mute text-pretty">
        <span dir="auto">{words.since}</span>
        <Bidi noTranslate>{fullDayLabel(spell.from)}</Bidi>
        <span>. </span>
        <span dir="auto">{words.ask(gender)}</span>
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
            className={inputClass}
          />
        </label>
        <button
          type="button"
          data-close-spell=""
          disabled={returnedOn === ""}
          onClick={() => onRun(() => closeSickSpell(workerId, spell.spanId, returnedOn))}
          className="rounded-card-sm border border-line-hover bg-surface px-4 py-2 text-[15px] font-semibold text-ink transition-colors hover:border-ask-line-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span dir="auto">{words.save}</span>
        </button>
      </div>
      {fault ? (
        <p
          aria-live="polite"
          dir="auto"
          data-role="fault"
          className="text-[14px] font-light text-clay-deep"
        >
          {he.fault}
        </p>
      ) : null}
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
        {words.note(gender)}
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
  gender,
  answer,
  first,
  marked,
  onAnswer,
}: {
  question: ExportQuestion;
  restDay: RestDay;
  gender: Gender;
  answer: boolean | undefined;
  first: boolean;
  /** The row the count's control sent the user to, held until it is answered.
   * Seven rows look alike, so arriving at one of them has to be visible: a
   * scroll that lands silently leaves the user looking for what moved. */
  marked: boolean;
  onAnswer: (value: boolean) => void;
}) {
  const words = he.beforeExport.questions;
  const shown = shownDetailsOf(question);
  return (
    <div
      data-question={question.key}
      {...(marked ? { "data-marked": "" } : {})}
      className={[
        "flex flex-wrap items-center gap-x-4.5 gap-y-3 px-5 py-4.25 sm:px-6",
        first ? "" : "border-t border-line-soft",
        marked ? "bg-hover inset-ring-1 inset-ring-clay-soft" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="flex min-w-0 flex-1 basis-[260px] flex-col gap-0.75">
        <span dir="auto" className="text-[17px] font-medium">
          {askOf(question.key, restDay, gender)}
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
        <Chip selected={answer === true} onClick={() => onAnswer(true)}>
          <span dir="auto">{words.yes}</span>
        </Chip>
        <Chip selected={answer === false} onClick={() => onAnswer(false)}>
          <span dir="auto">{words.no}</span>
        </Chip>
      </span>
    </div>
  );
}

/** The question itself. Two of the seven are worded about the employment rather
 * than in general: one names *their* day of the week (specs.md item 5) and one
 * asks about the worker in their own gender (item 31). */
function askOf(
  key: ExportQuestionKey,
  restDay: RestDay,
  gender: Gender,
): string {
  const words = he.beforeExport.questions;
  if (key === "freeRestDays") return words.freeRestDays.ask(restDay);
  if (key === "holidaysWorked") return words.holidaysWorked.ask(gender);
  return words[key].ask;
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
 * that has counted it twice. Two
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
 * month rather than of a total (specs.md item 18).
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
      // Three states and not two (item 9): `null` is the holiday nobody has
      // answered for, and it is the one that stops the export, so it is said in
      // its own words rather than folded into "לא נעבד".
      const said = words[holidayStateOf(detail.worked)];
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

/**
 * A card that stops the export or warns before it. The artboard draws the open
 * spell a step warmer than the wage card, with a clay dot before its title;
 * every card of that kind takes the same look, so a block is told from a
 * confirmation at a glance.
 */
const blockClass =
  "flex flex-col gap-2.5 border border-line-strong bg-chip px-5 py-5 sm:px-6.5";

/**
 * Which of the worker's three settings produced the figure the card shows
 * (specs.md item 17).
 *
 * **The words are the payments card's own** (`month.actions.incomeTax.from`),
 * because the two screens name one thing: a second wording here would be a
 * second place for "לפי ההגדרה בפרופיל" to be corrected alone. `manual` is not
 * among them: an override is what the sheet prints and not what is confirmed,
 * and this card is about the figure being stored under it.
 */
function taxSourceWords(setting: IncomeTaxSetting): string {
  const words = he.month.actions.incomeTax.from;
  if (setting.mode === "percentage") {
    return words.percentage(formatPercent(setting.percentage ?? 0));
  }
  return words[setting.mode];
}

function BlockTitle({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true" className="size-2 flex-none rounded-full bg-clay" />
      <span dir="auto" className="text-[18px] font-semibold text-clay-deep">
        {children}
      </span>
    </span>
  );
}
