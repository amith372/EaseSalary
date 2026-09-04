"use client";

import { useState, type ReactNode } from "react";
import {
  addUserLine,
  removeUserLine,
  setIncomeTax,
  type MonthActionRefusal,
  type MonthActionResult,
} from "@/app/month/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MoneyValue } from "@/components/MoneyValue";
import {
  defaultPlacementFor,
  placementOf,
  userLineDirections,
  userLinePlacements,
} from "@/lib/engine/types";
import type {
  UserLine,
  UserLineDirection,
  UserLinePlacement,
} from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import { legalLink } from "@/lib/links";
import { formatAgorot, parseShekels } from "@/lib/money";
import type { YearMonth } from "@/lib/types";

/**
 * The first of the three groups beside the calendar: additional payments
 * (specs.md item 5).
 *
 * **It holds the two controls stage 4 owed and nothing it does not yet have.**
 * The income-tax line, which is never calculated and whose figure has no other
 * way in (item 17); and the lines the user adds, with all three of item 20's
 * choices on each. The advances and the manual overrides belong to this group
 * too and arrive in their own steps, which is why the card is named for the
 * group rather than for what is in it today.
 *
 * **No artboard draws it.** The two slice artboards fold the month's additions
 * into a preview row and have no control surface at all, and the hand-over
 * (`docs/design-pass-jobs-1-2.md`) lists the missing screens as job 3. So this
 * is built in the idiom the calendar's own picker already established — a panel
 * of chips that opens where it is needed and closes when it is answered —
 * rather than against a drawing, and that is written down here so nobody later
 * reads it as having been checked against one.
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
