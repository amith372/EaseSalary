"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  addAdvance,
  addThirdPartyPayment,
  addUserLine,
  clearOverride,
  removeAdvance,
  removeThirdPartyPayment,
  removeUserLine,
  setIncomeTax,
  setOverride,
  updateThirdPartyPayment,
  updateUserLine,
  type MonthActionRefusal,
  type MonthActionResult,
} from "@/app/month/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { CoveredMonths } from "@/components/CoveredMonths";
import { MoneyValue } from "@/components/MoneyValue";
import { addMonths, yearMonthText } from "@/lib/dates";
import { monthLabel } from "@/lib/dateLabels";
import { whyRepaymentIsRefused } from "@/lib/engine/advances";
import type { AdvanceStanding } from "@/lib/engine/advances";
import type { OrphanedOverride } from "@/lib/engine/overrides";
import {
  reviewTaxPercentage,
  taxCorrectionUnits,
  taxFromPercentage,
} from "@/lib/engine/incomeTax";
import type { TaxCorrectionUnit } from "@/lib/engine/incomeTax";
import type { MonthIncomeTax } from "@/lib/engine/types";
import { offeredPeriodFor } from "@/lib/engine/thirdParty";
import {
  defaultPlacementFor,
  placementOf,
  thirdPartyKinds,
  userLineDirections,
  userLinePlacements,
} from "@/lib/engine/types";
import type {
  Advance,
  AdvanceKind,
  ThirdPartyKind,
  ThirdPartyPayment,
  UserLine,
  UserLineDirection,
  UserLinePlacement,
} from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import { legalLink } from "@/lib/links";
import { formatAgorot, parseShekels } from "@/lib/money";
import type { OverrideCandidate, YearMonth } from "@/lib/types";

/**
 * The additional-payments group, on the payments screen (specs.md item 5).
 *
 * **It is not beside the calendar and that is the point.** The month screen
 * answers what the month came to; every group that *records* something is the
 * payments screen's, and this is the first of them. The preview still shows the
 * user's own lines summarised into a row apiece (item 20), and that summary is
 * what sends her here.
 *
 * **All four of the criterion's contents are here.** The income-tax line, which
 * is never calculated and whose figure has no other way in (item 17); the lines
 * the user adds, with all three of item 20's choices on each; the advances,
 * given and repaid; and the manual overrides, which arrived last and are the
 * reason the card was named for the group rather than for what was in it.
 *
 * **The last of them is why this screen sees a calculation at all.** An override
 * replaces a figure the *application worked out*, so the group holding it has to
 * be shown one — every other thing on the card is an amount somebody typed. The
 * lines arrive already calculated from the route and nothing here totals them
 * (`PaymentsScreen`).
 *
 * **The division between overriding and editing is drawn once, in the engine,
 * and this file only reads it.** A row that carries an amount this month
 * recorded is corrected where it was entered — the panels on the user's own
 * lines and on the third-party payments below — and a row carrying a figure the
 * application derived is replaced in the overrides section. `MonthLine
 * .overridable` is what says which is which, and no section here tests a key.
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
  /** The month's tax, assembled on the server from the engine's own row: the
   * amount, whether it was typed by hand, the setting behind it and the share
   * of the ברוטו it came to (item 17). */
  incomeTax: MonthIncomeTax;
  /** This month's own lines. The standing ones are terms of the employment and
   * live on the profile, which stage 4's step 9 is the screen for — so they are
   * not listed here and are not corrected here: a month that paid something
   * else than a standing line says replaces its amount in the overrides
   * section below (item 20). */
  userLines: UserLine[];
  /** Every advance the worker has and what is still owed on each, walked on the
   * server: the debt spans months and this one cannot see it (item 20). */
  ledger: AdvanceStanding[];
  /** What this month itself records about them — the itemisation the group owes
   * beside the preview's summary. */
  monthAdvances: Advance[];
  /** What this month paid to somebody other than the worker (specs.md item 16).
   * One row per kind, which is what makes a payment addressable by its kind
   * alone. */
  thirdPartyPayments: ThirdPartyPayment[];
  /**
   * The month's own lines, as the engine drew them. **The only derived thing on
   * this screen**, and here for one reason: an override may replace a figure the
   * application worked out and nothing else (specs.md item 17), and the engine's
   * own `overridable` is what says which rows those are.
   */
  lines: OverrideCandidate[];
  /** Amounts typed over rows this month is not drawing now. An override
   * outlives the row it addresses, so these are listed rather than kept out of
   * sight (item 17). */
  orphanedOverrides: OrphanedOverride[];
  /** Runs the change inside the screen's own transition, so the preview dims
   * while the round trip is in flight and the figures are never left looking
   * settled while they are stale. */
  onSubmit: (
    action: () => Promise<MonthActionResult>,
    onResult: (result: MonthActionResult) => void,
  ) => void;
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
  incomeTax,
  userLines,
  ledger,
  monthAdvances,
  thirdPartyPayments,
  lines,
  orphanedOverrides,
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
        incomeTax={incomeTax}
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

      {/* The three sections above are money that reaches the worker or is
          withheld from what reaches her, and this one never touches her total in
          either direction (item 16). Reading down the card the user meets
          everything about her pay before anything about somebody else's. */}
      <ThirdPartyControl
        workerId={workerId}
        month={month}
        thirdPartyPayments={thirdPartyPayments}
        onSubmit={onSubmit}
      />

      {/* Last, and deliberately: everything above it *records* something and
          this one corrects what the application made of the records. A user who
          met it first would be asked to replace figures she has not yet given
          the facts for. */}
      <OverridesControl
        workerId={workerId}
        month={month}
        lines={lines}
        orphanedOverrides={orphanedOverrides}
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
 * The income tax, calculated and correctable (specs.md item 17).
 *
 * **It used to be the whole of how the figure got in, and since 2026-09-10 it
 * is the way it is corrected.** The engine works the tax out from the month's
 * gross, the year's brackets and the credit points the worker's gender gives
 * her; this control shows that figure and stores an override over it. It is the
 * tax's only control, which is why the row answers `false` to the generic
 * override control's question — the reason sits beside the row in `month.ts`.
 *
 * **An empty field clears the correction and does not mean zero.** Clearing
 * says the application's own figure stands; typing a zero says this month
 * withholds nothing and stores that by hand. They produce the same number and
 * mean opposite things, which is the distinction `clearOverride` already draws.
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
  incomeTax,
  onSubmit,
}: Pick<MonthActionsProps, "workerId" | "month" | "incomeTax" | "onSubmit">) {
  const words = he.month.actions.incomeTax;
  const { agorot: incomeTaxAgorot, manual: incomeTaxManual } = incomeTax;
  // The field holds only what the *user* put there. A calculated figure is
  // shown above, beside the heading, and leaving the field empty is how she
  // says it stands — so an empty field is never an amount waiting to be saved.
  const [text, setText] = useState(
    incomeTaxManual ? formatAgorot(incomeTaxAgorot) : "",
  );
  const { refusal, run } = useMonthAction(onSubmit);
  const link = legalLink("incomeTax");

  // **What produced the amount above**, said in the card rather than left to be
  // inferred from a field that may be empty: a manual figure first, because it
  // wins over everything, and otherwise whichever of the profile's three
  // choices this month was calculated under (item 17).
  const sourceWords = incomeTaxManual
    ? words.from.manual
    : incomeTax.setting.mode === "percentage"
      ? words.from.percentage(
          String(Number(((incomeTax.setting.percentage ?? 0) * 100).toFixed(4))),
        )
      : words.from[incomeTax.setting.mode];

  // **The rule under the card is the rule that actually produced the figure.**
  // The credit-point paragraph is the automatic mode's, and printing it beside
  // a flat-rate month would be a sentence that is untrue of the amount above it
  // — which is the worst kind of help, because it is the kind a family acts on.
  const ruleWords =
    incomeTax.setting.mode === "none"
      ? words.ruleNone
      : incomeTax.setting.mode === "percentage"
        ? words.rulePercentage(
            String(Number(((incomeTax.setting.percentage ?? 0) * 100).toFixed(4))),
          )
        : words.rule;

  // **Which unit the correction is typed in** (asked for on 2026-09-11). It is
  // the field's own state and never the worker's setting: a month on the
  // automatic mode may still be corrected by a share, and a month on a flat
  // rate may still be corrected by a sum. The stored value is an amount either
  // way, so switching the unit changes how she says it and not what is kept.
  const [unit, setUnit] = useState<TaxCorrectionUnit>("amount");
  const percentage = unit === "percentage" ? reviewTaxPercentage(text) : null;
  const gross = incomeTax.grossAgorot;

  // The same arithmetic the server will do, shown before she commits to it —
  // and shown *only* as a preview: what is saved is what the server works out
  // against the gross it reads again, so a screen left open while the month
  // moved cannot write an amount against a gross that has gone.
  const converted =
    percentage === null || gross === null || gross <= 0
      ? null
      : taxFromPercentage(percentage, gross);

  const cleared = text.trim() === "";
  const parsed = cleared
    ? null
    : unit === "percentage"
      ? converted
      : parseShekels(text);
  // Empty is a *change* only where something is stored to clear, and a typed
  // figure only where it differs from what the month already shows — which is
  // how the button says "this is saved" without a message a user could miss.
  const changed = cleared
    ? incomeTaxManual
    : parsed !== null && parsed !== incomeTaxAgorot;
  const shownRefusal: MonthActionRefusal | null =
    !cleared && parsed === null ? "amount" : refusal;

  function save() {
    run(() => setIncomeTax(workerId, month, text, unit));
  }

  /** Switching unit empties the field rather than carrying the digits across.
   * "208.83" read as a percentage is a figure that withholds twice the salary,
   * and it would look like an ordinary number the whole way. */
  function chooseUnit(next: TaxCorrectionUnit) {
    if (next === unit) return;
    setUnit(next);
    setText("");
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

      {/* **Where the figure came from, and what share of the month it is.**
          The share is the automatic mode's answer to "what percent is that",
          which is a different number every month because the brackets are
          progressive and the credit is a fixed sum — so it is stated here, on
          a real month, rather than beside the profile's toggle, which has no
          month in front of it. A month that withholds nothing has no share to
          state. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span dir="auto" className="text-[13px] font-light text-ink-quiet">
          {sourceWords}
        </span>
        {incomeTax.sharePercent !== null && incomeTaxAgorot > 0 ? (
          <span dir="auto" className="text-[13px] font-light text-ink-quiet">
            <bdi>{words.share(incomeTax.sharePercent)}</bdi>
          </span>
        ) : null}
      </div>

      {/* Sum or share, chosen before the field is read. Two chips rather than a
          suffix that changes under the cursor: the unit decides what the digits
          mean, and that is not something to communicate with a symbol at the
          end of a box. */}
      <div className="flex flex-wrap gap-2">
        {taxCorrectionUnits.map((candidate) => (
          <Chip
            key={candidate}
            selected={unit === candidate}
            onClick={() => chooseUnit(candidate)}
          >
            <span dir="auto">{words.unit[candidate]}</span>
          </Chip>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        className="flex items-end gap-2"
      >
        <div className="min-w-0 flex-1">
          <Field
            label={unit === "percentage" ? words.fieldPercentage : words.field}
          >
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                unit === "percentage"
                  ? he.placeholder.percentInput
                  : he.placeholder.amountInput
              }
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

      {/* The arithmetic, written out, so a share is never a figure she has to
          take on trust — and so the sum that is actually stored is the one she
          agreed to. */}
      {unit === "percentage" && percentage !== null ? (
        <span dir="auto" className="text-[13px] font-light text-ink-warm">
          {converted === null || gross === null ? (
            words.noGross
          ) : (
            <bdi>
              {words.worksOutTo(
                String(Number((percentage * 100).toFixed(4))),
                formatAgorot(gross),
                formatAgorot(converted),
              )}
            </bdi>
          )}
        </span>
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
          {ruleWords}
        </span>
        {/* The reminder the user asked for on 2026-09-11, said on this screen
            as well as beside the profile's toggle: a family that only ever
            opens the payments screen still meets the rule. */}
        <span
          dir="auto"
          className="text-[13px] leading-[1.55] font-medium text-ink text-pretty"
        >
          {words.reminder}
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
 * The lines the user adds, listed, added and corrected (specs.md item 20).
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
 *
 * **A line is edited in place and never removed and re-added** (item 20). All
 * four of the things it records may change — the words, the amount, the
 * direction and the placement — and the id does not: removing and adding again
 * would lose the note and mint a new id, and the id is what the line's own key
 * is built from (item 17), so a reader looking for the line she corrected would
 * find one that had never existed before.
 *
 * **Its amount is edited and never overridden**, which is the division item 17
 * draws: what is written on a one-off line is the figure itself, and nothing
 * under it was derived. One panel does both, because adding and correcting ask
 * the same question — what should this line say — and a second panel would be a
 * second place for the placement rule to drift.
 *
 * **No artboard draws it.** `EaseSalary - תשלומים` carries no user lines at all;
 * `docs/design-pass-jobs-1-2.md` lists them among job 3's missing screens, so
 * this is built in the idiom the calendar's picker established and that is
 * written down here rather than left to be inferred.
 */
function UserLinesControl({
  workerId,
  month,
  userLines,
  onSubmit,
}: Pick<MonthActionsProps, "workerId" | "month" | "userLines" | "onSubmit">) {
  const words = he.month.actions.lines;
  /** `null` when nothing is open, `"new"` for a line being added, and a line's
   * id when that line is being corrected — one panel at a time, so two
   * half-filled forms cannot both be on screen claiming the same month. It is
   * `AdvancesControl`'s own shape, and for the same reason. */
  const [open, setOpen] = useState<"new" | string | null>(null);
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
   * both by a successful save and by the cancel button, and a refusal left
   * standing after the panel that produced it has gone would be an error about
   * a field the user can no longer see.
   */
  function reset() {
    setOpen(null);
    setLabel("");
    setAmount("");
    setNote("");
    setDirection("addition");
    setChosen(null);
    clear();
  }

  /**
   * The panel reopened over a line that already exists, with what it holds
   * already in the fields (item 20).
   *
   * **The placement is set rather than left to follow the direction.** What is
   * stored is what she chose, so a panel that let the default take it again
   * would silently move a line she had deliberately placed, the moment she
   * reopened it to correct a typo in its words.
   */
  function openEdit(line: UserLine) {
    clear();
    setOpen(line.id);
    setLabel(line.label);
    setAmount(formatAgorot(line.agorot));
    setNote(line.note ?? "");
    setDirection(line.direction);
    setChosen(placementOf(line));
  }

  /** One call for both gestures: the id is what tells them apart, and the
   * server keeps it rather than minting a new one. */
  function submit() {
    if (open === null) return;
    const draft = { label, amount, direction, placement, note };
    run(
      () =>
        open === "new"
          ? addUserLine(workerId, month, draft)
          : updateUserLine(workerId, month, open, draft),
      reset,
    );
  }

  function remove(lineId: string) {
    run(() => removeUserLine(workerId, month, lineId));
  }

  const panel = (
    <Card
      tone="inset"
      radius="panel"
      as="form"
      className="mt-1 flex flex-col gap-2.5 px-3.5 py-3"
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
            submit();
          }}
          className="rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span dir="auto">{open === "new" ? words.submit : words.save}</span>
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
    /* `data-group` is the browser suite's handle on this section, for the reason
       `data-row` exists on a preview row (`CLAUDE.md` rule 9): the word "סכום"
       labels a field in four of this card's five sections, so a lookup by label
       alone matches several and the section has to say which one is meant. */
    <div
      data-group="userLines"
      className="flex flex-col gap-2 border-t border-line pt-2.5"
    >
      <div className="flex flex-col gap-0.5">
        <h3 dir="auto" className="text-[15px] font-semibold">
          {he.month.preview.userLines}
        </h3>
        {/* **What this card can and cannot do, before she uses it.** A line
            made here belongs to this month alone; the recurring kind is a term
            of the employment and is set on the worker's page. Saying it here is
            what keeps a family from recording the same deduction twelve times,
            or from concluding the application cannot do it at all. */}
        <p dir="auto" className="text-[13px] leading-[1.5] font-light text-ink-quiet text-pretty">
          {words.oneOffOnly}{" "}
          <Link href={`/workers/${workerId}#terms`} className="font-medium">
            <span dir="auto">{words.standing}</span>
          </Link>
        </p>
      </div>

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
                  onClick={() => openEdit(line)}
                  aria-label={words.editLabel(line.label)}
                  className="ms-auto text-[13px] font-medium text-ink-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  <span dir="auto">{words.edit}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(line.id)}
                  aria-label={words.removeLabel(line.label)}
                  className="text-[13px] text-ink-mute transition-colors hover:text-clay-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
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
              {/* Opened under the line it corrects, so the words in the fields
                  and the row they belong to are read together. */}
              {open === line.id ? panel : null}
            </li>
          ))}
        </ul>
      )}

      {open === "new" ? panel : null}

      {open === null ? (
        <button
          type="button"
          onClick={() => setOpen("new")}
          className="self-start rounded-full border border-line bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span dir="auto">{words.add}</span>
        </button>
      ) : null}

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
    <div
      data-group="advances"
      className="flex flex-col gap-2 border-t border-line pt-2.5"
    >
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
            // **Asked of the engine and never decided here.** Nothing left
            // owed, a repayment already recorded this month, or a month before
            // the one the advance was given in — three sentences the server
            // refuses on, and a control that answers a click with a refusal is
            // a control that should not have been drawn. Restating them here
            // would be a second copy that agrees today and drifts the first
            // time either is corrected, which is what it was until this call
            // replaced it.
            const canRepay =
              whyRepaymentIsRefused(standing, month, monthAdvances) === null;

            return (
              <li
                key={standing.number}
                /* The browser suite's handle on one advance, for the reason
                   `data-row` exists on a preview row (`CLAUDE.md` rule 9): what
                   is still owed has to be *asserted*, and a selector built out
                   of the Hebrew beside the figure breaks on a wording change
                   that broke nothing. */
                data-advance={standing.number}
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

/**
 * The payments that go to a third party rather than to the worker (specs.md
 * item 16).
 *
 * **It is on this card and outside the worker's total at the same time, and the
 * lead is what carries that.** Everything else in the group either reaches her
 * or is withheld from what reaches her; this money is neither added to her
 * salary nor taken out of it, and a user who has just typed an income tax has
 * every reason to expect otherwise. The month screen draws the same payments in
 * a card of their own, outside her total, where their subtotal is the one
 * column total the preview prints (item 5).
 *
 * **A kind already recorded this month is not offered.** The sheet holds one row
 * per kind, so the refusal is what would answer the click, and a control that
 * answers a click with a refusal is a control that should not have been drawn —
 * the same rule `AdvancesControl` follows for a repayment it would be refused.
 * The server refuses it again regardless, because what the screen offers is
 * never the rule (Part 3).
 *
 * **The covered period follows the kind until she touches it**, which is
 * `offeredPeriodFor` read forwards rather than a second copy of it — the same
 * shape as the placement chips above. Only the national insurance has an offer,
 * because only it is paid on a clock the application can read backwards
 * (item 19).
 *
 * **A recorded payment is edited in place and every one of its four things may
 * change, the kind included** (item 16). Correcting it by removing it and
 * recording it again is the same two refusals read twice and loses the note in
 * between. The kind it is changed *to* is checked like any other — one row per
 * kind — which is why the chips offer the kinds this month has not recorded
 * **plus the one being corrected**: a payment refused as a second of its own
 * kind would be a control refusing to leave a field where it found it.
 *
 * **Its amount is edited and never overridden**, for the reason item 17 gives:
 * the figure is what left the account, and there is nothing under it for an
 * override to replace.
 *
 * **No artboard draws this section.** `EaseSalary - תשלומים` draws two sections
 * for third-party payments and both are a *reminder* view — what is due and what
 * is coming — resting on item 15's yearly clock and item 28's document expiry
 * dates, neither of which any type holds. It draws no recording surface at all,
 * exactly as it draws no income-tax field and no user lines. So this is built in
 * the idiom the calendar's picker established, and it is written down here so
 * nobody later reads it as having been checked against a drawing.
 */
function ThirdPartyControl({
  workerId,
  month,
  thirdPartyPayments,
  onSubmit,
}: Pick<
  MonthActionsProps,
  "workerId" | "month" | "thirdPartyPayments" | "onSubmit"
>) {
  const words = he.month.actions.thirdParty;
  /** `null` when nothing is open, `"new"` for a payment being recorded, and the
   * kind of the payment being corrected — one panel at a time, which is the
   * shape the other sections of this card use. */
  const [open, setOpen] = useState<"new" | ThirdPartyKind | null>(null);
  const [kind, setKind] = useState<ThirdPartyKind | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  /** `null` until she chooses, which is what lets the period follow the kind and
   * then stop following it. */
  const [chosenPeriod, setChosenPeriod] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const { refusal, run, clear } = useMonthAction(onSubmit);

  const recorded = new Set(thirdPartyPayments.map((payment) => payment.kind));
  // The kinds still open this month, **and the one being corrected**: a panel
  // that hid the kind it was opened over would show the user a chip row with
  // her own payment missing from it.
  const available = thirdPartyKinds.filter(
    (candidate) => !recorded.has(candidate) || candidate === open,
  );

  const offered = kind === null ? null : offeredPeriodFor(kind, month);
  const period = chosenPeriod ?? {
    from: offered === null ? "" : yearMonthText(offered.from),
    to: offered === null ? "" : yearMonthText(offered.to),
  };

  function reset() {
    setOpen(null);
    setKind(null);
    setAmount("");
    setNote("");
    setChosenPeriod(null);
    clear();
  }

  /**
   * The panel reopened over a payment already recorded, with its four things in
   * the fields (item 16).
   *
   * **The period is set rather than left to follow the kind.** A stored period
   * is contiguous by construction, so its two ends are its first and last
   * months; a payment recorded with no period keeps two empty fields, which is
   * what "covers the month it was paid in" reads as. Letting the offer take it
   * again would put last quarter into a payment the family had deliberately
   * left unqualified.
   */
  function openEdit(payment: ThirdPartyPayment) {
    clear();
    setOpen(payment.kind);
    setKind(payment.kind);
    setAmount(formatAgorot(payment.agorot));
    setNote(payment.note ?? "");
    const covers = payment.coversMonths ?? [];
    setChosenPeriod(
      covers.length === 0
        ? { from: "", to: "" }
        : {
            from: yearMonthText(covers[0]),
            to: yearMonthText(covers[covers.length - 1]),
          },
    );
  }

  /** One call for both gestures, and the kind the panel was *opened* with is
   * what addresses the payment being corrected — not the kind now in the chips,
   * which is the thing she may be changing. */
  function submit() {
    if (kind === null || open === null) return;
    const draft = {
      kind,
      amount,
      coversFrom: period.from,
      coversTo: period.to,
      note,
    };
    run(
      () =>
        open === "new"
          ? addThirdPartyPayment(workerId, month, draft)
          : updateThirdPartyPayment(workerId, month, open, draft),
      reset,
    );
  }

  function remove(paid: ThirdPartyKind) {
    run(() => removeThirdPartyPayment(workerId, month, paid));
  }

  const panel = (
    <Card
      tone="inset"
      radius="panel"
      as="form"
      className="mt-1 flex flex-col gap-2.5 px-3.5 py-3"
    >
      <div className="flex flex-col gap-1">
        <span dir="auto" className="text-[13px] font-medium text-ink-warm">
          {words.kind}
        </span>
        <div className="flex flex-wrap gap-2">
          {available.map((candidate) => (
            <Chip
              key={candidate}
              selected={kind === candidate}
              onClick={() => {
                setKind(candidate);
                // The offer follows the kind again whenever the kind changes,
                // which is the only moment it can: once she edits a month field
                // her choice stands for the rest of the entry.
                setChosenPeriod(null);
              }}
            >
              <span dir="auto">{he.sheet.thirdParty[candidate]}</span>
            </Chip>
          ))}
        </div>
      </div>

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

      <div className="flex flex-col gap-1">
        <span dir="auto" className="text-[13px] font-medium text-ink-warm">
          {words.period}
        </span>
        <div className="flex flex-wrap gap-2">
          <MonthSelect
            label={words.periodFrom}
            month={month}
            value={period.from}
            onChange={(value) =>
              setChosenPeriod({ from: value, to: period.to })
            }
          />
          <MonthSelect
            label={words.periodTo}
            month={month}
            value={period.to}
            onChange={(value) =>
              setChosenPeriod({ from: period.from, to: value })
            }
          />
        </div>
        <span
          dir="auto"
          className="text-[12px] leading-[1.5] font-light text-ink-quiet text-pretty"
        >
          {words.periodHint}
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
          disabled={kind === null}
          onClick={(event) => {
            event.preventDefault();
            submit();
          }}
          className="rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover disabled:cursor-not-allowed disabled:border-line disabled:text-ink-quiet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span dir="auto">{open === "new" ? words.submit : words.save}</span>
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
    <div
      data-group="thirdParty"
      className="flex flex-col gap-2 border-t border-line pt-2.5"
    >
      <h3 dir="auto" className="text-[15px] font-semibold">
        {words.title}
      </h3>
      <p
        dir="auto"
        className="text-[13px] leading-[1.5] font-light text-ink-mute text-pretty"
      >
        {words.lead}
      </p>

      {thirdPartyPayments.length === 0 ? (
        <p dir="auto" className="text-[14px] font-light text-ink-quiet">
          {words.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {thirdPartyPayments.map((payment) => (
            <li
              key={payment.kind}
              className="flex flex-col gap-1 rounded-card-sm border border-line px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <span dir="auto" className="min-w-0 text-[15px] font-medium">
                  {he.sheet.thirdParty[payment.kind]}
                </span>
                {/* Drawn positive. It is money that left the account, but it
                    leaves nobody's total on this screen — a minus here would
                    read as a deduction from her pay, which is the one thing
                    item 16 says it is not. */}
                <MoneyValue agorot={payment.agorot} />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-light text-ink-quiet">
                {/* The same component `/month` draws beside the sheet's own row.
                    One period, one spelling — see `CoveredMonths`. */}
                {payment.coversMonths ? (
                  <span>
                    <CoveredMonths months={payment.coversMonths} />
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => openEdit(payment)}
                  aria-label={words.editLabel(
                    he.sheet.thirdParty[payment.kind],
                  )}
                  className="ms-auto text-[13px] font-medium text-ink-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  <span dir="auto">{words.edit}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(payment.kind)}
                  aria-label={words.removeLabel(
                    he.sheet.thirdParty[payment.kind],
                  )}
                  className="text-[13px] text-ink-mute transition-colors hover:text-clay-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  <span dir="auto">{words.remove}</span>
                </button>
              </div>
              {payment.note ? (
                <span
                  dir="auto"
                  className="text-[13px] leading-[1.5] font-light text-ink-warm text-pretty"
                >
                  <Bidi>{payment.note}</Bidi>
                </span>
              ) : null}
              {/* Opened under the payment it corrects, so the fields and the row
                  they belong to are read together. */}
              {open === payment.kind ? panel : null}
            </li>
          ))}
        </ul>
      )}

      {open === "new" ? (
        panel
      ) : open === null && available.length === 0 ? (
        /* Not a refusal — nothing was refused, there is simply nothing left to
           record — so it stands where the button was rather than under it. */
        <p dir="auto" className="text-[14px] font-light text-ink-quiet">
          {words.allRecorded}
        </p>
      ) : open === null ? (
        <button
          type="button"
          onClick={() => setOpen("new")}
          className="self-start rounded-full border border-line bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span dir="auto">{words.add}</span>
        </button>
      ) : null}

      {refusal ? <Refusal reason={refusal} /> : null}
    </div>
  );
}

/**
 * The amounts the application worked out, and the user's own figure over one of
 * them (specs.md item 17).
 *
 * **The list is the engine's answer and this component asks it nothing.** Which
 * rows may be replaced is `MonthLine.overridable`, declared where each draft is
 * made (`lines.ts`), so no key is tested here and no list of names is kept — the
 * failure a whitelist produces is that the next row the engine grows falls
 * silently into whichever answer the `else` gives.
 *
 * **This is the one section of the card that is shown a calculation.** Every
 * other one records an amount somebody typed; an override by definition
 * addresses a figure that was derived, so the route runs the engine and hands
 * the lines down (`PaymentsScreen`). Nothing here totals them.
 *
 * **A row already replaced still says what it would otherwise have been.**
 * `calculatedAmount` comes from the engine beside the manual figure, so the two
 * are read together and the replacement can be checked without anybody
 * recalculating it by hand (items 17, 24).
 *
 * **Clearing is its own button and the field is never prefilled with the
 * calculated figure.** The two produce the same number and mean opposite
 * things: clearing leaves the row derived, while typing that number in stores
 * it by hand for ever, so a later correction to the wage would move every
 * figure on the sheet except that one. A panel opened over a derived row
 * therefore opens **empty** — it is asking what should stand instead — and one
 * opened over a row already replaced opens with the figure standing there.
 *
 * **An override outlives the row it addresses**, so the overrides this month is
 * holding for rows it is not drawing are listed under the rest and offered to
 * be cleared. An amount that is stored, will reappear, and cannot be seen is
 * the one failure in this criterion that looks like nothing went wrong.
 *
 * **No artboard draws any of this.** `EaseSalary - תשלומים` has no override
 * surface at all, as it has no income-tax field and no user lines;
 * `docs/design-pass-jobs-1-2.md` lists the manual-override state among job 3's
 * missing screens. So it is built in the idiom the calendar's picker
 * established — a panel that opens where it is needed and closes when it is
 * answered — and that is written here so nobody later reads it as having been
 * checked against a drawing.
 */
function OverridesControl({
  workerId,
  month,
  lines,
  orphanedOverrides,
  onSubmit,
}: Pick<
  MonthActionsProps,
  "workerId" | "month" | "lines" | "orphanedOverrides" | "onSubmit"
>) {
  const words = he.month.actions.overrides;
  /** The key of the row whose panel is open, or `null`. One at a time, which is
   * the shape the rest of this card uses. */
  const [open, setOpen] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { refusal, run, clear } = useMonthAction(onSubmit);

  const overridable = lines.filter((line) => line.overridable);

  function reset() {
    setOpen(null);
    setAmount("");
    setNote("");
    clear();
  }

  /** Opened empty over a derived row and filled over one already replaced —
   * never with the calculated figure, for the reason the docblock gives. */
  function openPanel(line: OverrideCandidate) {
    clear();
    setOpen(line.key);
    setAmount(
      line.manual && line.amount !== null ? formatAgorot(Math.abs(line.amount)) : "",
    );
    setNote("");
  }

  function save(key: string) {
    run(() => setOverride(workerId, month, { key, amount, note }), reset);
  }

  function restore(key: string) {
    run(() => clearOverride(workerId, month, key));
  }

  const panel = (key: string) => (
    <Card
      tone="inset"
      radius="panel"
      as="form"
      className="mt-1 flex flex-col gap-2.5 px-3.5 py-3"
    >
      <span dir="auto" className="text-[13px] font-medium text-ink-warm">
        {words.panelTitle}
      </span>
      <Field label={words.amount} hint={words.amountHint}>
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
            save(key);
          }}
          className="rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span dir="auto">{words.save}</span>
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
    <div
      data-group="overrides"
      className="flex flex-col gap-2 border-t border-line pt-2.5"
    >
      <h3 dir="auto" className="text-[15px] font-semibold">
        {words.title}
      </h3>
      <p
        dir="auto"
        className="text-[13px] leading-[1.5] font-light text-ink-mute text-pretty"
      >
        {words.lead}
      </p>

      {overridable.length === 0 ? (
        <p dir="auto" className="text-[14px] font-light text-ink-quiet">
          {words.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {overridable.map((line) => (
            <li
              key={line.key}
              className="flex flex-col gap-1 rounded-card-sm border border-line px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-[15px] font-medium">
                  {/* The engine's own label, which names her rest day where the
                      row does (item 5) — never a second copy kept beside this
                      control. */}
                  <Bidi>{line.label}</Bidi>
                </span>
                <MoneyValue agorot={line.amount} manual={line.manual} />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-light text-ink-quiet">
                {/* What the row would otherwise have said, beside what it says
                    — the whole of why an override is checkable (item 24). */}
                {line.manual && line.calculatedAmount !== undefined ? (
                  <span>
                    <span dir="auto">{words.calculated}</span>
                    <span> </span>
                    <Bidi noTranslate>
                      {formatAgorot(line.calculatedAmount)}
                    </Bidi>
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => openPanel(line)}
                  aria-label={words.changeLabel(line.label)}
                  className="ms-auto text-[13px] font-medium text-ink-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  <span dir="auto">{words.change}</span>
                </button>
                {line.manual ? (
                  <button
                    type="button"
                    onClick={() => restore(line.key)}
                    aria-label={words.clearLabel(line.label)}
                    className="text-[13px] text-ink-mute transition-colors hover:text-clay-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    <span dir="auto">{words.clear}</span>
                  </button>
                ) : null}
              </div>
              {open === line.key ? panel(line.key) : null}
            </li>
          ))}
        </ul>
      )}

      {orphanedOverrides.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-line pt-2">
          <span dir="auto" className="text-[14px] font-medium text-ink-warm">
            {words.orphaned}
          </span>
          <p
            dir="auto"
            className="text-[12px] leading-[1.5] font-light text-ink-quiet text-pretty"
          >
            {words.orphanedHint}
          </p>
          <ul className="flex flex-col gap-2">
            {orphanedOverrides.map(({ key, override }) => (
              <li
                key={key}
                className="flex flex-col gap-1 rounded-card-sm border border-line px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    dir="auto"
                    className="min-w-0 text-[15px] font-medium text-ink-warm"
                  >
                    {/* The name the row carried when the figure was typed. There
                        is no row left to read one off, and a month stored before
                        the name was kept has none at all — the amount and the
                        reason are then what it is known by. */}
                    {override.label === undefined ? (
                      words.unnamed
                    ) : (
                      <Bidi>{override.label}</Bidi>
                    )}
                  </span>
                  <MoneyValue agorot={override.agorot} manual />
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-light text-ink-quiet">
                  {override.note ? <Bidi>{override.note}</Bidi> : null}
                  <button
                    type="button"
                    onClick={() => restore(key)}
                    aria-label={words.clearLabel(
                      override.label ?? words.unnamed,
                    )}
                    className="ms-auto text-[13px] text-ink-mute transition-colors hover:text-clay-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    <span dir="auto">{words.clear}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {refusal ? <Refusal reason={refusal} /> : null}
    </div>
  );
}

/**
 * One end of a covered period, as a select over months rather than a typed date.
 *
 * **A `<input type="month">` is not used, and that is deliberate.** Its picker
 * is the browser's own and is laid out and worded by the browser's locale, not
 * the page's — so on a Hebrew right-to-left page it can arrive left-to-right and
 * in another language entirely, which is exactly the mixed-direction failure
 * Part 5 warns about, in a control the application cannot style or isolate. A
 * select holds labels the application wrote.
 *
 * **The range reaches both ways, because the two kinds of payment look opposite
 * ways.** The national insurance is paid in arrears and covers months already
 * lived through (item 19), while a yearly fee covers the year running *forward*
 * from one employment anniversary to the next (item 15) — so a visa fee paid in
 * March is for March through next February, and a control offering only past
 * months could not record it at all. Four years back is the employment permit's
 * own cycle, the slowest clock the application knows (item 28); a year forward
 * is the longest any payment reaches ahead.
 *
 * Each option carries the month's own label, and the value is `YYYY-MM`, which
 * is what `parseYearMonth` reads on the server.
 */
function MonthSelect({
  label,
  month,
  value,
  onChange,
}: {
  label: string;
  month: YearMonth;
  value: string;
  onChange: (value: string) => void;
}) {
  const words = he.month.actions.thirdParty;
  // Newest first, so the months a quarterly payment wants are at the top of the
  // list and the forward year is reached by scrolling past them: the arrears
  // case is the common one.
  const MONTHS_BACK = 4 * 12;
  const MONTHS_FORWARD = 12;
  const options = Array.from(
    { length: MONTHS_BACK + MONTHS_FORWARD + 1 },
    (_, index) => addMonths(month, MONTHS_FORWARD - index),
  );

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span dir="auto" className="text-[12px] font-light text-ink-quiet">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        <option value="">{words.periodNone}</option>
        {options.map((candidate) => (
          <option key={yearMonthText(candidate)} value={yearMonthText(candidate)}>
            {monthLabel(candidate)}
          </option>
        ))}
      </select>
    </label>
  );
}
