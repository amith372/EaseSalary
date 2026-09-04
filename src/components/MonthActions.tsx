"use client";

import { useState, type ReactNode } from "react";
import {
  addAdvance,
  addUserLine,
  removeAdvance,
  removeUserLine,
  setIncomeTax,
  type MonthActionRefusal,
  type MonthActionResult,
} from "@/app/month/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MoneyValue } from "@/components/MoneyValue";
import { compareMonth } from "@/lib/dates";
import type { AdvanceStanding } from "@/lib/engine/advances";
import {
  defaultPlacementFor,
  placementOf,
  userLineDirections,
  userLinePlacements,
} from "@/lib/engine/types";
import type {
  Advance,
  AdvanceKind,
  UserLine,
  UserLineDirection,
  UserLinePlacement,
} from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import { legalLink } from "@/lib/links";
import { formatAgorot, parseShekels } from "@/lib/money";
import type { YearMonth } from "@/lib/types";

/**
 * The additional-payments group, on the payments screen (specs.md item 5).
 *
 * **It is not beside the calendar and that is the point.** The month screen
 * answers what the month came to; every group that *records* something is the
 * payments screen's, and this is the first of them. The preview still shows the
 * user's own lines summarised into a row apiece (item 20), and that summary is
 * what sends her here.
 *
 * **Three of the criterion's four contents are here.** The income-tax line,
 * which is never calculated and whose figure has no other way in (item 17); the
 * lines the user adds, with all three of item 20's choices on each; and the
 * advances, given and repaid. The manual overrides belong to this group too and
 * arrive in their own step, which is why the card is named for the group rather
 * than for what is in it today.
 *
 * **The `תשלומים` artboard draws one of its three sections and not the other
 * two.** It has the advances — "לרשום מקדמה חדשה", "לעדכן פירעון", and what is
 * repaid out of what — beside the third-party payments, and no income-tax field
 * and no user lines; `docs/design-pass-jobs-1-2.md` lists those among job 3's
 * missing screens. So the sections it does not draw are built in the idiom the
 * calendar's own picker established — a panel of chips that opens where it is
 * needed and closes when it is answered — and that is written down here so
 * nobody later reads them as having been checked against a drawing.
 *
 * **It holds no arithmetic and decides nothing.** Every change goes to a server
 * action, which parses the amount, checks the choices and writes through the
 * store; the figures beside the calendar are then the engine's answer to what
 * was saved (Part 3). The one thing read here is `parseShekels`, and it is read
 * only to tell the user her field is not a number before she presses anything —
 * the same function the server runs, not a second rule agreeing with it.
 */

interface MonthActionsProps {
  workerId: string;
  month: YearMonth;
  /** As the month stores it: positive, and signed by the engine (item 17). */
  incomeTaxAgorot: number;
  /** This month's own lines. The standing ones are terms of the employment and
   * live on the profile, which no screen yet sets — see `build_plan.md` step 4
   * on why that debt is recorded as unowned rather than assigned (item 20). */
  userLines: UserLine[];
  /** Every advance the worker has and what is still owed on each, walked on the
   * server: the debt spans months and this one cannot see it (item 20). */
  ledger: AdvanceStanding[];
  /** What this month itself records about them — the itemisation the group owes
   * beside the preview's summary. */
  monthAdvances: Advance[];
  /** Runs the change inside the screen's own transition, so the preview dims
   * while the round trip is in flight and the figures are never left looking
   * settled while they are stale. */
  onSubmit: (
    action: () => Promise<MonthActionResult>,
    onResult: (result: MonthActionResult) => void,
  ) => void;
}

/** The chip these panels are built from — the calendar picker's own control, so
 * the two read as one mechanism (`MonthCalendar`). */
function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "rounded-full border bg-surface px-3.25 py-1.75 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
        selected
          ? "border-line-hover text-ink"
          : "border-line text-day-ink hover:border-line-hover hover:text-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** A labelled field. The input is `dir="ltr"` wherever it takes digits, so an
 * amount is typed left to right inside a right-to-left page (`CLAUDE.md`). */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span dir="auto" className="text-[13px] font-medium text-ink-warm">
        {label}
      </span>
      {children}
      {hint ? (
        <span dir="auto" className="text-[12px] font-light text-ink-quiet">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-card-sm border border-line bg-surface px-3 py-2 text-[15px] text-ink transition-colors placeholder:text-ink-quiet hover:border-line-hover focus-visible:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest";

export function MonthActions({
  workerId,
  month,
  incomeTaxAgorot,
  userLines,
  ledger,
  monthAdvances,
  onSubmit,
}: MonthActionsProps) {
  const words = he.month.actions;

  return (
    <Card className="flex min-w-0 flex-col gap-3 px-4.5 py-3">
      <h2 dir="auto" className="text-[17px] font-semibold">
        {words.title}
      </h2>

      <IncomeTaxControl
        workerId={workerId}
        month={month}
        incomeTaxAgorot={incomeTaxAgorot}
        onSubmit={onSubmit}
      />

      <UserLinesControl
        workerId={workerId}
        month={month}
        userLines={userLines}
        onSubmit={onSubmit}
      />

      <AdvancesControl
        workerId={workerId}
        month={month}
        ledger={ledger}
        monthAdvances={monthAdvances}
        onSubmit={onSubmit}
      />
    </Card>
  );
}

/**
 * What the refusal was, as a sentence. Never a code: a refusal carries the
 * reason it was refused (specs.md item 25).
 *
 * `amountText` is how the income-tax field says the amount rule in its own
 * words. **The two fields do not share that sentence**, because they do not
 * share the rule: zero is an ordinary entry for the tax (item 17) and a refusal
 * for a line the user adds (item 20), so one sentence would tell the user of one
 * of them that the figure she is allowed to type is not allowed.
 */
function Refusal({
  reason,
  amountText,
}: {
  reason: MonthActionRefusal;
  amountText?: string;
}) {
  const text =
    reason === "amount" && amountText !== undefined
      ? amountText
      : he.month.actions.refused[reason];
  return (
    <p
      aria-live="polite"
      dir="auto"
      className="text-[13px] leading-[1.5] font-light text-clay-deep text-pretty"
    >
      {text}
    </p>
  );
}

/**
 * A change on its way to the store, and the refusal it may come back with.
 *
 * The three controls in this file all did the same three things around a server
 * action — clear the last refusal, send, then either keep the new one or run
 * what follows a success — so they do it once here instead. It holds no rule:
 * every rule is on the server, and this is the shape of asking.
 */
function useMonthAction(onSubmit: MonthActionsProps["onSubmit"]) {
  const [refusal, setRefusal] = useState<MonthActionRefusal | null>(null);

  function run(action: () => Promise<MonthActionResult>, onDone?: () => void) {
    setRefusal(null);
    onSubmit(action, (result) => {
      if (result.ok) onDone?.();
      else setRefusal(result.reason);
    });
  }

  return { refusal, run, clear: () => setRefusal(null) };
}

/**
 * The income tax, entered and not calculated (specs.md item 17).
 *
 * **The rule stands under the field in words rather than behind the "?".** It
 * is what the user has to know before she types — a foreign caregiver in home
 * care has 2.25 credit points, more than a foreign worker in another sector,
 * and someone who does not know that deducts too much — so it is not put where
 * only the user who already suspects there is something to find will look. The
 * link beside it is item 26's.
 *
 * The button is disabled while the field says what is already stored, which is
 * how the control says "this is saved" without a transient message that a user
 * looking away would miss. Zero is an ordinary entry and not an empty field: it
 * is what every month holds until she says otherwise, and typing it back is how
 * a tax entered by mistake comes off.
 */
function IncomeTaxControl({
  workerId,
  month,
  incomeTaxAgorot,
  onSubmit,
}: Pick<
  MonthActionsProps,
  "workerId" | "month" | "incomeTaxAgorot" | "onSubmit"
>) {
  const words = he.month.actions.incomeTax;
  const [text, setText] = useState(
    incomeTaxAgorot === 0 ? "" : formatAgorot(incomeTaxAgorot),
  );
  const { refusal, run } = useMonthAction(onSubmit);
  const link = legalLink("incomeTax");

  // An empty field means zero, which is the figure a month holds until the user
  // says otherwise — so clearing the field is how a tax is taken back off.
  const parsed = text.trim() === "" ? 0 : parseShekels(text);
  const changed = parsed !== null && parsed !== incomeTaxAgorot;
  const shownRefusal: MonthActionRefusal | null =
    parsed === null ? "amount" : refusal;

  function save() {
    run(() => setIncomeTax(workerId, month, text.trim() === "" ? "0" : text));
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 dir="auto" className="text-[15px] font-semibold">
          {words.title}
        </h3>
        {incomeTaxAgorot === 0 ? (
          <span dir="auto" className="text-[13px] font-light text-ink-quiet">
            {words.none}
          </span>
        ) : (
          <MoneyValue agorot={-incomeTaxAgorot} />
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        className="flex items-end gap-2"
      >
        <div className="min-w-0 flex-1">
          <Field label={words.field}>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={he.placeholder.amountInput}
              className={inputClass}
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={!changed}
          className="flex-none rounded-full border border-line bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover disabled:cursor-not-allowed disabled:text-ink-quiet disabled:hover:border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span dir="auto">{words.save}</span>
        </button>
      </form>

      {/* One sentence at a time. The field's own check and a refusal from the
          store can both say "amount", and printing the same sentence twice
          reads as two different problems. The typed field wins, because it is
          the thing the user is looking at. */}
      {shownRefusal ? (
        <Refusal reason={shownRefusal} amountText={words.notANumber} />
      ) : null}

      <Card
        tone="inset"
        radius="panel"
        className="flex flex-col gap-1.75 px-3.5 py-3"
      >
        <span
          dir="auto"
          className="text-[13px] leading-[1.55] font-light text-ink-warm text-pretty"
        >
          {words.rule}
        </span>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          dir="auto"
          className="text-[13px] font-medium hover:underline hover:underline-offset-[3px]"
        >
          <span>{link.label}</span>
          <span> — </span>
          <span>{he.why.linkSuffix}</span>
        </a>
      </Card>
    </div>
  );
}

/**
 * The lines the user adds, listed and added (specs.md item 20).
 *
 * **The list is here and the summary is in the preview, and the two are not in
 * conflict**: the preview answers "what did this month come to", which nine
 * rows answer worse than one, while this is where the lines are made — and a
 * control surface that hides what it has already recorded cannot be used, since
 * a user who cannot see the line she just added adds it a second time.
 *
 * **The placement chips follow the direction until she touches them.** That is
 * `defaultPlacementFor` read forwards rather than a second copy of it: an
 * addition defaults to part of the month and a deduction to the transfer alone,
 * and the moment she chooses, her choice stops moving.
 */
function UserLinesControl({
  workerId,
  month,
  userLines,
  onSubmit,
}: Pick<MonthActionsProps, "workerId" | "month" | "userLines" | "onSubmit">) {
  const words = he.month.actions.lines;
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [direction, setDirection] = useState<UserLineDirection>("addition");
  // `null` until she chooses, which is what lets the chips follow the direction
  // and then stop following it.
  const [chosen, setChosen] = useState<UserLinePlacement | null>(null);
  const { refusal, run, clear } = useMonthAction(onSubmit);

  const placement = chosen ?? defaultPlacementFor(direction);

  /**
   * Closes the panel and empties it, the last refusal included. It is reached
   * both by a successful add and by the cancel button, and a refusal left
   * standing after the panel that produced it has gone would be an error about
   * a field the user can no longer see.
   */
  function reset() {
    setAdding(false);
    setLabel("");
    setAmount("");
    setNote("");
    setDirection("addition");
    setChosen(null);
    clear();
  }

  function add() {
    run(
      () =>
        addUserLine(workerId, month, {
          label,
          amount,
          direction,
          placement,
          note,
        }),
      reset,
    );
  }

  function remove(lineId: string) {
    run(() => removeUserLine(workerId, month, lineId));
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2.5">
      <h3 dir="auto" className="text-[15px] font-semibold">
        {he.month.preview.userLines}
      </h3>

      {userLines.length === 0 ? (
        <p dir="auto" className="text-[14px] font-light text-ink-quiet">
          {words.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {userLines.map((line) => (
            <li
              key={line.id}
              className="flex flex-col gap-1 rounded-card-sm border border-line px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-[15px] font-medium">
                  {/* The user's own sentence, isolated: it may be Hebrew,
                      Latin, or both, and it is never translated by us. */}
                  <Bidi>{line.label}</Bidi>
                </span>
                <MoneyValue
                  agorot={
                    line.direction === "addition" ? line.agorot : -line.agorot
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-light text-ink-quiet">
                <span dir="auto">{words.direction[line.direction]}</span>
                <span aria-hidden="true">·</span>
                <span dir="auto">{words.placement[placementOf(line)]}</span>
                <button
                  type="button"
                  onClick={() => remove(line.id)}
                  aria-label={words.removeLabel(line.label)}
                  className="ms-auto text-[13px] text-ink-mute transition-colors hover:text-clay-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  <span dir="auto">{words.remove}</span>
                </button>
              </div>
              {line.note ? (
                <span
                  dir="auto"
                  className="text-[13px] leading-[1.5] font-light text-ink-warm text-pretty"
                >
                  <Bidi>{line.note}</Bidi>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <Card
          tone="inset"
          radius="panel"
          as="form"
          className="flex flex-col gap-2.5 px-3.5 py-3"
        >
          <Field label={words.label} hint={words.labelHint}>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              dir="auto"
              className={inputClass}
            />
          </Field>

          <Field label={words.amount}>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={he.placeholder.amountInput}
              className={inputClass}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            {userLineDirections.map((candidate) => (
              <Chip
                key={candidate}
                selected={direction === candidate}
                onClick={() => setDirection(candidate)}
              >
                <span dir="auto">{words.direction[candidate]}</span>
              </Chip>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-2">
              {userLinePlacements.map((candidate) => (
                <Chip
                  key={candidate}
                  selected={placement === candidate}
                  onClick={() => setChosen(candidate)}
                >
                  <span dir="auto">{words.placement[candidate]}</span>
                </Chip>
              ))}
            </div>
            <span
              dir="auto"
              className="text-[12px] leading-[1.5] font-light text-ink-quiet text-pretty"
            >
              {placement === "beforeGross"
                ? words.placement.beforeGrossWhy
                : words.placement.afterGrossWhy}
            </span>
          </div>

          <Field label={words.note} hint={words.noteHint}>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              dir="auto"
              className={inputClass}
            />
          </Field>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              onClick={(event) => {
                event.preventDefault();
                add();
              }}
              className="rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              <span dir="auto">{words.submit}</span>
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-1 py-2 text-[14px] text-ink-quiet transition-colors hover:text-ink"
            >
              <span dir="auto">{words.cancel}</span>
            </button>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start rounded-full border border-line bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span dir="auto">{words.add}</span>
        </button>
      )}

      {/* Drawn once, below whichever of the two is showing. Rendered inside
          each branch instead, it was the same element written twice and two
          places for its wording to drift. */}
      {refusal ? <Refusal reason={refusal} /> : null}
    </div>
  );
}

/**
 * The advances, given and repaid (specs.md item 20).
 *
 * **The debt is not on this screen and never could be.** What is still owed on
 * an advance is the principal less every repayment recorded against it in any
 * month, so it is walked on the server from the worker's whole history and
 * arrives here already counted — this component reads `outstandingAgorot` and
 * computes nothing. What it does decide is what to *offer*: an advance that is
 * settled, one this month has already repaid, or one granted after this month
 * gets no repay button, because a control that answers a click with a refusal
 * is a control that should not have been there. The server refuses all three
 * again, since the offer is not the rule (Part 3).
 *
 * **The user never types a number.** A grant asks for an amount and a reason
 * and nothing else; a repayment is chosen by pressing the button on the advance
 * it belongs to, so the number is read and never remembered (item 20).
 */
function AdvancesControl({
  workerId,
  month,
  ledger,
  monthAdvances,
  onSubmit,
}: Pick<
  MonthActionsProps,
  "workerId" | "month" | "ledger" | "monthAdvances" | "onSubmit"
>) {
  const words = he.month.actions.advances;
  /** `null` when nothing is open, `"granted"` for a new advance, and a number
   * for a repayment of that advance — one panel at a time, so two half-filled
   * forms cannot both be on screen claiming the same month. */
  const [open, setOpen] = useState<"granted" | number | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { refusal, run, clear } = useMonthAction(onSubmit);

  function reset() {
    setOpen(null);
    setAmount("");
    setNote("");
    clear();
  }

  function submit() {
    if (open === null) return;
    run(
      () =>
        addAdvance(
          workerId,
          month,
          open === "granted"
            ? { kind: "granted", amount, note }
            : { kind: "repaid", number: open, amount, note },
        ),
      reset,
    );
  }

  function remove(advanceNumber: number, kind: AdvanceKind) {
    run(() => removeAdvance(workerId, month, advanceNumber, kind));
  }

  const panel = (
    <Card
      tone="inset"
      radius="panel"
      as="form"
      className="mt-1 flex flex-col gap-2.5 px-3.5 py-3"
    >
      <Field label={words.amount}>
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={he.placeholder.amountInput}
          className={inputClass}
        />
      </Field>
      <Field label={words.note} hint={words.noteHint}>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          dir="auto"
          className={inputClass}
        />
      </Field>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          onClick={(event) => {
            event.preventDefault();
            submit();
          }}
          className="rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span dir="auto">
            {open === "granted" ? words.submitGrant : words.submitRepay}
          </span>
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-1 py-2 text-[14px] text-ink-quiet transition-colors hover:text-ink"
        >
          <span dir="auto">{words.cancel}</span>
        </button>
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 dir="auto" className="text-[15px] font-semibold">
          {words.title}
        </h3>
        {open === null ? (
          <button
            type="button"
            onClick={() => setOpen("granted")}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <span dir="auto">{words.grant}</span>
          </button>
        ) : null}
      </div>

      {open === "granted" ? panel : null}

      {ledger.length === 0 ? (
        <p dir="auto" className="text-[14px] font-light text-ink-quiet">
          {words.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ledger.map((standing) => {
            // This month's own movements on this advance — what the group
            // itemises beside the preview's summarised row (item 20).
            const here = monthAdvances.filter(
              (advance) => advance.number === standing.number,
            );
            // Not offered where the server would refuse it: nothing left owed,
            // a repayment already recorded this month, or a month before the
            // one the advance was given in. An advance carried in from the
            // opening position has no granting month and so no month too early.
            const canRepay =
              standing.outstandingAgorot > 0 &&
              !here.some((advance) => advance.kind === "repaid") &&
              (standing.grantedIn === null ||
                compareMonth(month, standing.grantedIn) >= 0);

            return (
              <li
                key={standing.number}
                className="flex flex-col gap-1 rounded-card-sm border border-line px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-[15px] font-medium">
                    <Bidi>{words.name(standing.number)}</Bidi>
                  </span>
                  {standing.outstandingAgorot === 0 ? (
                    <span
                      dir="auto"
                      className="text-[13px] font-light text-ink-quiet"
                    >
                      {words.settled}
                    </span>
                  ) : (
                    <MoneyValue agorot={standing.outstandingAgorot} />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-light text-ink-quiet">
                  <span>
                    <span dir="auto">{words.given}</span>
                    <span> </span>
                    {/* `noTranslate` on every amount, as `MoneyValue` does it:
                        a translated figure is a wrong figure (`CLAUDE.md`).
                        These two are bare rather than `MoneyValue` because they
                        are a sentence's worth of context at the group's own
                        size, not the row's figure — which is the outstanding
                        amount above. */}
                    <Bidi noTranslate>{formatAgorot(standing.principalAgorot)}</Bidi>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    <span dir="auto">{words.repaid}</span>
                    <span> </span>
                    <Bidi noTranslate>{formatAgorot(standing.repaidAgorot)}</Bidi>
                  </span>
                  {standing.grantedIn === null ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span dir="auto">{words.fromOpening}</span>
                    </>
                  ) : null}
                  {standing.note ? (
                    <>
                      <span aria-hidden="true">·</span>
                      {/* The reason the advance was given, carried forward from
                          the month that gave it. It is the part the application
                          cannot derive and the part a later reader needs
                          (item 20) — and a later *month* is exactly such a
                          reader, which is the whole reason it is on the standing
                          and not only on the movement. */}
                      <Bidi>{standing.note}</Bidi>
                    </>
                  ) : null}
                  {canRepay ? (
                    <button
                      type="button"
                      onClick={() => setOpen(standing.number)}
                      aria-label={words.repayLabel(standing.number)}
                      className="ms-auto text-[13px] font-medium text-ink-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                    >
                      <span dir="auto">{words.repay}</span>
                    </button>
                  ) : null}
                </div>

                {open === standing.number ? panel : null}

                {here.length > 0 ? (
                  <ul className="flex flex-col gap-1.5 border-t border-line pt-1.5">
                    {here.map((advance) => (
                      <li key={advance.kind} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span dir="auto" className="text-[13px] text-ink-warm">
                            {words.movement[advance.kind]}
                          </span>
                          <MoneyValue
                            agorot={
                              advance.kind === "granted"
                                ? advance.agorot
                                : -advance.agorot
                            }
                          />
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-light text-ink-quiet">
                          <span dir="auto">{words.thisMonth}</span>
                          <button
                            type="button"
                            onClick={() => remove(standing.number, advance.kind)}
                            aria-label={words.removeLabel(
                              standing.number,
                              advance.kind,
                            )}
                            className="ms-auto text-[13px] text-ink-mute transition-colors hover:text-clay-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                          >
                            <span dir="auto">{words.remove}</span>
                          </button>
                        </div>
                        {advance.note ? (
                          <span
                            dir="auto"
                            className="text-[13px] leading-[1.5] font-light text-ink-warm text-pretty"
                          >
                            <Bidi>{advance.note}</Bidi>
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {refusal ? <Refusal reason={refusal} /> : null}
    </div>
  );
}
