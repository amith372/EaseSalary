"use client";

import Link from "next/link";
import type { AnswerGiven, AnsweredWorker } from "@/app/help/actions";
import { Sentence } from "@/components/AlertsScreen";
import { Bidi } from "@/components/Bidi";
import { Chevron } from "@/components/icons";
import { RuleLink } from "@/components/WhyDisclosure";
import { coveredMonthsLabel, fullDayLabel, monthLabel } from "@/lib/dateLabels";
import {
  ANSWER_RULES,
  ANSWER_SCREENS,
  type Answer,
  type ThirdPartyDueReason,
  type ThirdPartyOwed,
} from "@/lib/help/answers";
import { routeOf, screenName } from "@/lib/help/screens";
import { he } from "@/lib/i18n/he";
import { formatAgorot } from "@/lib/money";

/**
 * An answer drawn out of the household's own months (specs.md item 24).
 *
 * **It writes nothing.** Every figure, month and date on it came back from the
 * server as data, every line's reasoning is that line's own `explanation`, and
 * the law is on the page the link opens — what is written here is the frame
 * (`he.help.answers`). An amount worked out in this file would be a second
 * calculation beside the engine's, which is exactly what item 24's "written in
 * one place" exists to prevent.
 *
 * **It names the worker and draws the figure**, which the closed list and the
 * screen list may not: this is the half of item 24 that is about the account,
 * and the panel's other offers stay account-blind so that they are still right
 * for a household with no worker in it and for one whose months were refused.
 *
 * **Every figure and date sits in its own isolate.** A sentence in Hebrew with
 * an amount or a date inside it is a mixed run the browser may reorder
 * (`docs/agents/rtl.md`), so each is a `<bdi>` — `Sentence` for the sentences
 * built in `he.ts`, `Bidi` for a figure standing on its own.
 */
export function HelpAnswer({
  given,
  compact,
}: {
  /** `null` while the server is still reading the account, `"failed"` where
   * that read did not come back. */
  given: AnswerGiven | "failed" | null;
  compact: boolean;
}) {
  const words = he.help.answers;

  if (given === null) return <Quiet role="help-answer-pending" text={words.asking} />;
  if (given === "failed") return <Quiet role="help-answer-failed" text={words.failed} />;

  const said = words[given.id];

  return (
    <div
      data-role="help-account-answer"
      data-answer={given.id}
      className={[
        "flex flex-col rounded-calendar border border-help-answer-line bg-help-answer",
        compact ? "gap-3 px-4 py-4" : "gap-4.5 px-6 py-6 sm:px-7.5",
      ].join(" ")}
    >
      <span
        dir="auto"
        className={[
          "self-start font-semibold tracking-[0.06em] text-help-eyebrow",
          compact ? "text-[11px]" : "text-[13px]",
        ].join(" ")}
      >
        {said.title}
      </span>

      {given.workers.length === 0 ? (
        <p dir="auto" className={bodyClass(compact)}>
          {words.noWorker}
        </p>
      ) : (
        given.workers.map((worker) => (
          <WorkerAnswer
            key={worker.workerId}
            worker={worker}
            named={given.several}
            compact={compact}
          />
        ))
      )}

      <Onward
        screen={given.workers.length === 0 ? "addWorker" : ANSWER_SCREENS[given.id]}
        rule={given.id}
        compact={compact}
      />
    </div>
  );
}

/** One worker's share of the answer, or the refusal that stopped their
 * replay. */
function WorkerAnswer({
  worker,
  named,
  compact,
}: {
  worker: AnsweredWorker;
  /** Whose answer this is, said only where the household holds two: a name
   * beside the only worker there is names nothing. */
  named: boolean;
  compact: boolean;
}) {
  return (
    <section
      data-row={`answer-worker-${worker.workerId}`}
      className="flex flex-col gap-2"
    >
      {named ? (
        <Bidi className={compact ? "text-[14px] font-bold" : "text-[16px] font-bold"}>
          {worker.name}
        </Bidi>
      ) : null}
      {worker.answer === null ? (
        <>
          <p dir="auto" data-role="answer-refused" className={bodyClass(compact)}>
            <Sentence said={he.help.answers.refused(worker.refusedMonth ?? "")} />
          </p>
          <p dir="auto" className={quietClass(compact)}>
            {he.help.answers.refusedWhere}
          </p>
        </>
      ) : (
        <AnswerBody answer={worker.answer} compact={compact} />
      )}
    </section>
  );
}

function AnswerBody({ answer, compact }: { answer: Answer; compact: boolean }) {
  switch (answer.id) {
    case "owedThisMonth":
      return <OwedThisMonth answer={answer} compact={compact} />;
    case "nationalInsuranceDue":
      return <NationalInsuranceDue answer={answer} compact={compact} />;
    case "visaFeeDue":
      return <VisaFeeDue answer={answer} compact={compact} />;
    case "thirdPartyDue":
      return <ThirdPartyDue answer={answer} compact={compact} />;
  }
}

/** What the month pays them, row by row, with each row's own reasoning under
 * it and the money that goes elsewhere named as going elsewhere (item 16). */
function OwedThisMonth({
  answer,
  compact,
}: {
  answer: Extract<Answer, { id: "owedThisMonth" }>;
  compact: boolean;
}) {
  const words = he.help.answers.owedThisMonth;
  if (answer.month === null) {
    return (
      <p dir="auto" className={bodyClass(compact)}>
        {words.noMonth}
      </p>
    );
  }
  return (
    <>
      <p dir="auto" className={bodyClass(compact)}>
        <Sentence said={words.forMonth(monthLabel(answer.month))} />
      </p>
      <ul className="flex flex-col gap-2.5">
        {answer.lines.map((line) => (
          <li
            key={line.key}
            data-row={`answer-line-${line.key}`}
            className="flex flex-col gap-0.5"
          >
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span dir="auto" className={compact ? "text-[14px] font-medium" : "text-[16px] font-medium"}>
                {line.label}
              </span>
              {line.agorot === null ? null : (
                <Bidi
                  noTranslate
                  className={compact ? "text-[14px] font-semibold" : "text-[16px] font-semibold"}
                >
                  {formatAgorot(line.agorot)}
                </Bidi>
              )}
            </span>
            <span dir="auto" className={quietClass(compact)}>
              {line.explanation}
            </span>
            {line.link === null ? null : (
              <RuleLink rule={line.link} className={compact ? "text-[13px]" : "text-[14px]"} />
            )}
          </li>
        ))}
      </ul>
      {answer.totalAgorot === null ? null : (
        <span
          data-row="answer-total"
          className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-help-answer-line pt-2.5"
        >
          <span dir="auto" className={compact ? "text-[14px] font-semibold" : "text-[16px] font-semibold"}>
            {he.payslip.total}
          </span>
          <Bidi
            noTranslate
            className={compact ? "text-[15px] font-bold" : "text-[18px] font-bold"}
          >
            {formatAgorot(answer.totalAgorot)}
          </Bidi>
        </span>
      )}
      {/* **Said on every answer, because the month is always the one running
          now**: the replay ends at today's month, so there is no case where
          this figure is a month already closed (`answers.ts`). */}
      <span dir="auto" className={quietClass(compact)}>
        {words.running}
      </span>
      <span dir="auto" className={quietClass(compact)}>
        {words.excludes}
      </span>
    </>
  );
}

/**
 * The quarters that have ended with nothing recorded against them, what each
 * of their months put aside, and when the quarter running now can be paid.
 *
 * **The sentence about an unpaid quarter is `/alerts`' own** and is not a
 * second wording of it: one quarter said two ways on two screens is two things
 * for a family to reconcile (`CLAUDE.md` rule 12).
 */
function NationalInsuranceDue({
  answer,
  compact,
}: {
  answer: Extract<Answer, { id: "nationalInsuranceDue" }>;
  compact: boolean;
}) {
  const words = he.help.answers.nationalInsuranceDue;
  return (
    <>
      {answer.unpaid.length === 0 ? (
        <p dir="auto" data-row="answer-all-paid" className={bodyClass(compact)}>
          {words.allPaid}
        </p>
      ) : (
        answer.unpaid.map((quarter) => (
          <div
            key={`${quarter.quarter.from.year}-${quarter.quarter.from.month}`}
            data-row={`answer-quarter-${quarter.quarter.from.year}-${quarter.quarter.from.month}`}
            className="flex flex-col gap-1.5"
          >
            <p dir="auto" className={bodyClass(compact)}>
              <Sentence
                said={
                  he.alerts.entry.nationalInsurance(
                    coveredMonthsLabel([quarter.quarter.from, quarter.quarter.to]),
                  ).note
                }
              />
            </p>
            {quarter.months.every((month) => month.estimateAgorot === null) ? null : (
              <>
                <span dir="auto" className={quietClass(compact)}>
                  {words.accrued}
                </span>
                <ul className="flex flex-col gap-1">
                  {quarter.months.map((month) =>
                    month.estimateAgorot === null ? null : (
                      <li
                        key={`${month.month.year}-${month.month.month}`}
                        data-row={`answer-accrued-${month.month.year}-${month.month.month}`}
                        className="flex flex-wrap items-baseline justify-between gap-x-3"
                      >
                        <Bidi className={compact ? "text-[14px]" : "text-[16px]"}>
                          {monthLabel(month.month)}
                        </Bidi>
                        <Bidi
                          noTranslate
                          className={compact ? "text-[14px] font-semibold" : "text-[16px] font-semibold"}
                        >
                          {formatAgorot(month.estimateAgorot)}
                        </Bidi>
                      </li>
                    ),
                  )}
                </ul>
                {quarter.totalAgorot === null ? null : (
                  <span
                    data-row="answer-quarter-total"
                    className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-help-answer-line pt-1.5"
                  >
                    <span
                      dir="auto"
                      className={compact ? "text-[14px] font-semibold" : "text-[16px] font-semibold"}
                    >
                      {words.accruedTotal}
                    </span>
                    <Bidi
                      noTranslate
                      className={compact ? "text-[15px] font-bold" : "text-[18px] font-bold"}
                    >
                      {formatAgorot(quarter.totalAgorot)}
                    </Bidi>
                  </span>
                )}
              </>
            )}
          </div>
        ))
      )}
      <span dir="auto" className={quietClass(compact)}>
        {words.estimateNote}
      </span>
      <p dir="auto" data-row="answer-next-quarter" className={bodyClass(compact)}>
        <Sentence
          said={words.next(
            coveredMonthsLabel([answer.next.quarter.from, answer.next.quarter.to]),
            monthLabel(answer.next.payableFrom),
          )}
        />
      </p>
    </>
  );
}

/** When the visa-extension fee falls due, or where to enter the date it is
 * worked out from. */
function VisaFeeDue({
  answer,
  compact,
}: {
  answer: Extract<Answer, { id: "visaFeeDue" }>;
  compact: boolean;
}) {
  const words = he.help.answers.visaFeeDue;
  if (answer.due === null) {
    return (
      <>
        <p dir="auto" data-row="answer-no-date" className={bodyClass(compact)}>
          {words.noDate}
        </p>
        <p dir="auto" className={quietClass(compact)}>
          {words.noDateWhere}
        </p>
      </>
    );
  }
  return (
    <>
      <p dir="auto" data-row="answer-fee-due" className={bodyClass(compact)}>
        <Sentence
          said={words.due(monthLabel(answer.due.month), fullDayLabel(answer.due.expiresOn))}
        />
      </p>
      {answer.due.lastPaidAgorot === null ? null : (
        <p dir="auto" className={quietClass(compact)}>
          <Sentence said={words.lastPaid(formatAgorot(answer.due.lastPaidAgorot))} />
        </p>
      )}
    </>
  );
}

/**
 * What is owed to somebody other than the worker, each row with the reason it
 * is owed and the rule behind its own kind.
 *
 * **Every reason is said in the words the screen about it already uses** — the
 * quarter in `/alerts`' wording, a lapsed or lapsing document in its own alert's
 * wording, a fee still ahead in `לקראת החודשים הבאים`' — so a payment reads the
 * same wherever the family meets it (`CLAUDE.md` rule 12). The only sentence
 * written for this answer is the one no screen has had to say: a payment made
 * once per worker that was never recorded.
 */
function ThirdPartyDue({
  answer,
  compact,
}: {
  answer: Extract<Answer, { id: "thirdPartyDue" }>;
  compact: boolean;
}) {
  const words = he.help.answers.thirdPartyDue;
  return (
    <>
      {answer.owed.length === 0 ? (
        <p dir="auto" data-row="answer-nothing-owed" className={bodyClass(compact)}>
          {words.nothing}
        </p>
      ) : (
        <>
          <span dir="auto" className={quietClass(compact)}>
            {words.lead}
          </span>
          <ul className="flex flex-col gap-2.5">
            {answer.owed.map((owed) => (
              <li
                key={rowKeyOf(owed)}
                data-row={`answer-owed-${rowKeyOf(owed)}`}
                className="flex flex-col gap-0.5"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span
                    dir="auto"
                    className={compact ? "text-[14px] font-medium" : "text-[16px] font-medium"}
                  >
                    {he.sheet.thirdParty[owed.kind]}
                  </span>
                  {amountOf(owed.reason) === null ? null : (
                    <Bidi
                      noTranslate
                      className={compact ? "text-[14px] font-semibold" : "text-[16px] font-semibold"}
                    >
                      {formatAgorot(amountOf(owed.reason) ?? 0)}
                    </Bidi>
                  )}
                </span>
                {/* The reason carries its own handle because the row also
                    carries an amount, and a test reading "the first figure in
                    this row" would read the money rather than the month
                    (`CLAUDE.md` rule 10). */}
                <span
                  dir="auto"
                  data-role="owed-why"
                  className={quietClass(compact)}
                >
                  <OwedReason reason={owed.reason} />
                </span>
                <RuleLink
                  rule={owed.link}
                  className={compact ? "text-[13px]" : "text-[14px]"}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {/* **An estimate is named as an estimate wherever it is drawn** (item 19):
          the quarter's figure here is the same accrual `nationalInsuranceDue`
          shows, the sum actually billed has differed from it, and a figure a
          family takes for the bill is one they will pay without checking. The
          sentence is that answer's own, so one accrual is not described two
          ways (`CLAUDE.md` rule 12). */}
      {answer.owed.some((one) => one.reason.why === "quarterEnded") ? (
        <span dir="auto" data-row="answer-owed-estimate" className={quietClass(compact)}>
          {he.help.answers.nationalInsuranceDue.estimateNote}
        </span>
      ) : null}
      {answer.undated.length === 0 ? null : (
        <span dir="auto" data-row="answer-undated" className={quietClass(compact)}>
          <Sentence
            said={words.undated(
              answer.undated.map((kind) => he.sheet.thirdParty[kind]).join(", "),
            )}
          />
        </span>
      )}
      <span dir="auto" className={quietClass(compact)}>
        {words.excludes}
      </span>
    </>
  );
}

/** The reason one payment is owed, in the words of the screen that already says
 * it. */
function OwedReason({ reason }: { reason: ThirdPartyDueReason }) {
  switch (reason.why) {
    case "quarterEnded":
      return (
        <Sentence
          said={
            he.alerts.entry.nationalInsurance(
              coveredMonthsLabel([reason.quarter.from, reason.quarter.to]),
            ).note
          }
        />
      );
    case "lapsed":
      return (
        <Sentence
          said={
            he.alerts.entry.documentExpired(
              reason.document,
              fullDayLabel(reason.expiresOn),
            ).note
          }
        />
      );
    case "ending":
      return (
        <Sentence
          said={
            he.alerts.entry.documentExpiring(
              reason.document,
              fullDayLabel(reason.expiresOn),
            ).note
          }
        />
      );
    case "ahead":
      return (
        <>
          {he.payments.upcoming.notes[reason.kind]}
          {" — "}
          <Bidi>{monthLabel(reason.month)}</Bidi>
        </>
      );
    case "neverRecorded":
      return <>{he.help.answers.thirdPartyDue.neverRecorded}</>;
  }
}

/**
 * The amount shown beside a kind, where the reason carries one that means
 * something.
 *
 * A quarter shows what its months put aside, and a fee or a renewal what was
 * paid for it the last time — the two figures `/alerts` and
 * `לקראת החודשים הבאים` already draw. A payment never recorded has neither, and
 * an invented one would be the application quoting a price.
 */
function amountOf(reason: ThirdPartyDueReason): number | null {
  switch (reason.why) {
    case "quarterEnded":
      return reason.accruedAgorot;
    case "lapsed":
    case "ending":
    case "ahead":
      return reason.lastPaidAgorot;
    case "neverRecorded":
      return null;
  }
}

/** One row's handle, which is its kind — except the national insurance, where a
 * household can owe two quarters at once and the kind alone would name both
 * rows the same (`CLAUDE.md` rule 10). */
function rowKeyOf(owed: ThirdPartyOwed): string {
  return owed.reason.why === "quarterEnded"
    ? `${owed.kind}-${owed.reason.quarter.from.year}-${owed.reason.quarter.from.month}`
    : owed.kind;
}

/** The way on from an answer: the screen it is acted on, and the rule behind
 * it — the topic card's own footer, so the two kinds of answer end the same
 * way. */
function Onward({
  screen,
  rule,
  compact,
}: {
  screen: Parameters<typeof routeOf>[0];
  rule: AnswerGiven["id"];
  compact: boolean;
}) {
  const words = he.help.answer;
  return (
    <div
      className={[
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-help-answer-line",
        compact ? "pt-3" : "pt-4",
      ].join(" ")}
    >
      <span className="flex flex-wrap items-center gap-2.5">
        <span dir="auto" className={quietClass(compact)}>
          {words.rule}
        </span>
        <RuleLink
          rule={ANSWER_RULES[rule]}
          className={compact ? "text-[14px]" : "text-[16px]"}
        />
      </span>
      <Link
        href={routeOf(screen)}
        data-role="help-go"
        className={[
          "flex flex-none items-center gap-2.5 rounded-tint bg-forest font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white",
          compact ? "px-4 py-2.5 text-[15px]" : "px-6 py-3.5 text-[17px]",
        ].join(" ")}
      >
        <span dir="auto">{words.goTo(screenName(screen))}</span>
        <Chevron towards="next" className="flex-none" />
      </Link>
    </div>
  );
}

/** The two states that are a sentence and nothing else: still reading the
 * account, and a read that did not come back. */
function Quiet({ role, text }: { role: string; text: string }) {
  return (
    <p
      dir="auto"
      data-role={role}
      className="rounded-card-sm border border-line bg-day px-4 py-3 text-[14px] font-light text-ink-mute"
    >
      {text}
    </p>
  );
}

function bodyClass(compact: boolean): string {
  return compact ? "text-[14px] text-ink-warm" : "text-[16px] text-ink-warm";
}

function quietClass(compact: boolean): string {
  return compact
    ? "text-[13px] font-light text-ink-mute"
    : "text-[15px] font-light text-ink-mute";
}
