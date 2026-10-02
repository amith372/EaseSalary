"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import {
  addAdvance,
  addThirdPartyPayment,
  addUserLine,
  clearOverride,
  removeAdvance,
  removeThirdPartyPayment,
  removeUserLine,
  setHospitalOvertime,
  setIncomeTax,
  setOverride,
  splitAdvance,
  updateAdvance,
  updateThirdPartyPayment,
  updateUserLine,
  type MonthActionRefusal,
} from "@/app/month/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Confirm } from "@/components/Confirm";
import { CoveredMonths } from "@/components/CoveredMonths";
import {
  AmountField,
  busyAttrs,
  FaultLine,
  Field,
  inputClass,
  NoteField,
  outlineButtonClass,
  RefusalLine,
} from "@/components/Field";
import { useAction, type Send } from "@/components/useAction";
import { useUserLineForm } from "@/components/useUserLineForm";
import { RuleLink } from "@/components/WhyDisclosure";
import { FoldSection, type Fold } from "@/components/FoldSection";
import { MoneyValue } from "@/components/MoneyValue";
import { MonthSelect } from "@/components/MonthSelect";
import { yearMonthText } from "@/lib/dates";
import { fullDayLabel, monthLabel } from "@/lib/dateLabels";
import {
  blockingConfirmedMonth,
  splitInstalments,
  splitSpan,
  SPLIT_MONTHS_LIMIT,
  whyRemovalIsRefused,
  whyRepaymentIsRefused,
} from "@/lib/engine/advances";
import type { AdvanceStanding } from "@/lib/engine/advances";
import type { OrphanedOverride } from "@/lib/engine/overrides";
import {
  reviewTaxPercentage,
  taxCorrectionUnits,
  taxFromPercentage,
} from "@/lib/engine/incomeTax";
import type { TaxCorrectionUnit } from "@/lib/engine/incomeTax";
import type { MonthIncomeTax } from "@/lib/engine/types";
import type { Gender } from "@/lib/engine/types";
import { offeredPeriodFor } from "@/lib/engine/thirdParty";
import {
  placementOf,
  thirdPartyKinds,
  userLineDirections,
  userLinePlacements,
} from "@/lib/engine/types";
import type {
  Advance,
  AdvanceKind,
  HospitalOvertime,
  ThirdPartyKind,
  ThirdPartyPayment,
  UserLine,
} from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import {
  amountFieldValue,
  formatAgorot,
  formatPercent,
  parseShekels,
} from "@/lib/money";
import type { OverrideCandidate, YearMonth } from "@/lib/types";

/**
 * How far the covered period a payment names may reach, in months.
 *
 * **It reaches both ways, because the two kinds of payment look opposite ways.**
 * The national insurance is paid in arrears and covers months already lived
 * through (item 19), while a yearly fee covers the year running *forward* from
 * one employment anniversary to the next (item 15) — so a visa fee paid in March
 * is for March through next February, and a control offering only past months
 * could not record it at all. Four years back is the employment permit's own
 * cycle, the slowest clock the application knows (item 28); a year forward is
 * the longest any payment reaches ahead.
 */
const PERIOD_MONTHS_BACK = 4 * 12;
const PERIOD_MONTHS_FORWARD = 12;

/**
 * The additional-payments group, on the payments screen (specs.md item 5).
 *
 * **It is not beside the calendar and that is the point.** The month screen
 * answers what the month came to; every group that *records* something is the
 * payments screen's, and this is the first of them. The preview still shows the
 * user's own lines summarised into a row apiece (item 20), and that summary is
 * what sends them here.
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
 * **The `תשלומים` artboard draws all five sections in this order**, each under
 * its own heading and divided by a rule. Every section starts folded, which the
 * artboard does not draw (`DESIGN.md`).
 *
 * **It holds no arithmetic and decides nothing.** Every change goes to a server
 * action, which parses the amount, checks the choices and writes through the
 * store; the figures beside the calendar are then the engine's answer to what
 * was saved (Part 3). The one thing read here is `parseShekels`, and it is read
 * only to tell the user them field is not a number before they press anything —
 * the same function the server runs, not a second rule agreeing with it.
 */

interface MonthActionsProps {
  workerId: string;
  /** Two of the notes on this screen name their page and their profile, so they
   * agree with them rather than picking a gender (`he.workerWords`). */
  gender: Gender;
  month: YearMonth;
  /** The month's tax, assembled on the server from the engine's own row: the
   * amount, whether it was typed by hand, the setting behind it and the share
   * of the ברוטו it came to (item 17). */
  incomeTax: MonthIncomeTax;
  /** This month's own lines. The standing ones are terms of the employment and
   * are changed on `/settings` — so they are
   * not listed here and are not corrected here: a month that paid something
   * else than a standing line says replaces its amount in the overrides
   * section below (item 20). */
  userLines: UserLine[];
  /** What the family typed for hours in hospital this month, if anything
   * (specs.md item 20). */
  hospitalOvertime?: HospitalOvertime;
  /** Every advance the worker has and what is still owed on each, walked on the
   * server: the debt spans months and this one cannot see it (item 20). */
  ledger: AdvanceStanding[];
  /** What this month itself records about them — the itemisation the group owes
   * beside the preview's summary. */
  monthAdvances: Advance[];
  /**
   * The months this worker has confirmed, which is what a split is held against
   * (specs.md item 20).
   *
   * **The whole worker's and not this month's**, because a split reaches months
   * the screen is not showing: a confirmed month anywhere in the span refuses the
   * whole split, and the form names the month rather than letting the press
   * answer with a refusal. The rule itself is the engine's
   * (`blockingConfirmedMonth`) and the server refuses on it again.
   */
  confirmedMonths: YearMonth[];
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
  onSubmit: Send<MonthActionRefusal>;
  /** The sections the user has unfolded. Held by the screen rather than here,
   * because this card is keyed on the month and stepping to another month
   * would otherwise fold everything they had just opened. */
  openSections: ReadonlySet<MonthSection>;
  onToggleSection: (section: MonthSection) => void;
}

export type MonthSection =
  | "incomeTax"
  | "userLines"
  | "hospitalOvertime"
  | "advances"
  | "thirdParty"
  | "overrides";

type FoldProps = { fold: Fold };

/** A section of the card, divided from the one above it by a hairline. */
function MonthFold(props: Omit<Parameters<typeof FoldSection>[0], "className"> & {
  group: MonthSection;
}) {
  return (
    <FoldSection
      {...props}
      className="flex flex-col gap-2.5 border-t border-line-soft py-4 first:border-t-0"
    />
  );
}

/**
 * What a folded section says it holds: the names of what is inside, or a
 * sentence for holding nothing (F56, finished by run 8's R8.6).
 *
 * **Names and not a count.** Each of the three sections that draw it holds
 * things the user named or chose themselves — their own lines, the payments they
 * recorded, the figures they typed over — so a name answers "what is in there"
 * where a number only says how much opening it would cost. A name may be the
 * user's own words in another script, so each is its own `<bdi>` and the
 * wrapper carries no `dir="auto"`: over a lone `<bdi>` that resolves
 * left-to-right and hangs the line off the wrong edge (`CLAUDE.md`).
 */
function FoldedNames({ names, empty }: { names: string[]; empty: string }) {
  const className = "min-w-0 truncate text-[13px] font-light text-ink-quiet";
  if (names.length === 0) {
    return (
      <span dir="auto" className={className}>
        {empty}
      </span>
    );
  }
  return (
    <span className={className}>
      {names.map((name, at) => (
        <Fragment key={`${at}-${name}`}>
          {at > 0 ? <span>, </span> : null}
          <Bidi>{name}</Bidi>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * The names a control is known by while it waits.
 *
 * **Built and never typed at both ends** (run 8's R8.10): the press sends a
 * name and the control asks for the same one, and a key spelled differently in
 * the two places yields a control that never says it is working — a defect
 * nothing fails on, because both halves are correct on their own.
 */
const busyKey = {
  userLine: (id: string) => `remove:${id}`,
  advance: (number: number, kind: string) => `remove:${number}:${kind}`,
  thirdParty: (kind: ThirdPartyKind) => `remove:${kind}`,
  override: (key: string) => `clear:${key}`,
};

/** A bare text action inside a row. The padding widens what a finger can hit to
 * about 44px and the negative margin gives the space back, so the row is laid
 * out as if the button were its text alone. */
const rowActionClass =
  "-mx-1 -my-3 px-1 py-3 text-[13px] text-ink-mute transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

/** Closes a panel without saving; padded to a finger's height like the row
 * actions, without growing the button row. */
const cancelClass =
  "-my-1 px-2 py-3 text-[14px] text-ink-quiet transition-colors hover:text-ink";

/** The pair a panel ends with: the button that writes what was typed, and the
 * one that shuts the panel without writing it. Four panels draw it, and what
 * differs between them is the submit button's wording and, in one, whether it
 * can be pressed at all — never the markup. The submit is `type="submit"` so
 * Enter inside the panel works, and its own handler stops the form's default
 * because the panel writes through an action rather than a POST. */
function PanelButtons({
  submitLabel,
  onSubmit,
  cancelLabel,
  onCancel,
  disabled,
  busy = false,
}: {
  submitLabel: string;
  onSubmit: () => void;
  cancelLabel: string;
  onCancel: () => void;
  disabled?: boolean;
  /** This panel's write is on its way to the store, so this button is what
   * says so rather than the card around it (`busyAttrs` in `Field.tsx`). */
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="submit"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        {...busyAttrs(busy, outlineButtonClass)}
      >
        <span dir="auto">{submitLabel}</span>
      </button>
      <button type="button" onClick={onCancel} className={cancelClass}>
        <span dir="auto">{cancelLabel}</span>
      </button>
    </div>
  );
}

export function MonthActions({
  workerId,
  gender,
  month,
  incomeTax,
  userLines,
  hospitalOvertime,
  ledger,
  monthAdvances,
  confirmedMonths,
  thirdPartyPayments,
  lines,
  orphanedOverrides,
  onSubmit,
  openSections,
  onToggleSection,
}: MonthActionsProps) {
  const fold = (section: MonthSection) => ({
    open: openSections.has(section),
    onToggle: () => onToggleSection(section),
  });

  return (
    <Card radius="lg" className="flex min-w-0 flex-col px-6.5 py-1.5">

      <IncomeTaxControl
        fold={fold("incomeTax")}
        workerId={workerId}
        gender={gender}
        month={month}
        incomeTax={incomeTax}
        onSubmit={onSubmit}
      />

      <UserLinesControl
        fold={fold("userLines")}
        workerId={workerId}
        gender={gender}
        month={month}
        userLines={userLines}
        onSubmit={onSubmit}
      />

      <HospitalOvertimeControl
        fold={fold("hospitalOvertime")}
        workerId={workerId}
        month={month}
        hospitalOvertime={hospitalOvertime}
        onSubmit={onSubmit}
      />

      <AdvancesControl
        fold={fold("advances")}
        confirmedMonths={confirmedMonths}
        workerId={workerId}
        month={month}
        ledger={ledger}
        monthAdvances={monthAdvances}
        onSubmit={onSubmit}
      />

      {/* The three sections above are money that reaches the worker or is
          withheld from what reaches them, and this one never touches their total in
          either direction (item 16). Reading down the card the user meets
          everything about their pay before anything about somebody else's. */}
      <ThirdPartyControl
        fold={fold("thirdParty")}
        workerId={workerId}
        month={month}
        thirdPartyPayments={thirdPartyPayments}
        onSubmit={onSubmit}
      />

      {/* Last, and deliberately: everything above it *records* something and
          this one corrects what the application made of the records. A user who
          met it first would be asked to replace figures they have not yet given
          the facts for. */}
      <OverridesControl
        fold={fold("overrides")}
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
 * of them that the figure they are allowed to type is not allowed.
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
  return <RefusalLine>{text}</RefusalLine>;
}

/**
 * Hospital overtime: an amount the family types, never one worked out
 * (specs.md item 20). An empty amount removes it, and the note goes with it.
 */
function HospitalOvertimeControl({
  fold,
  workerId,
  month,
  hospitalOvertime,
  onSubmit,
}: FoldProps &
  Pick<MonthActionsProps, "workerId" | "month" | "hospitalOvertime" | "onSubmit">) {
  const words = he.month.actions.hospitalOvertime;
  const [amount, setAmount] = useState(
    hospitalOvertime ? formatAgorot(hospitalOvertime.agorot) : "",
  );
  const [note, setNote] = useState(hospitalOvertime?.note ?? "");
  const { refusal, fault, run, saving } = useAction(onSubmit);

  const cleared = amount.trim() === "";
  const parsed = cleared ? null : parseShekels(amount);
  const invalid = !cleared && (parsed === null || parsed <= 0);
  const changed = cleared
    ? hospitalOvertime !== undefined
    : !invalid &&
      (parsed !== hospitalOvertime?.agorot ||
        note.trim() !== (hospitalOvertime?.note ?? ""));
  const shownRefusal: MonthActionRefusal | null = invalid ? "amount" : refusal;

  return (
    <MonthFold
      group="hospitalOvertime"
      title={words.title}
      fold={fold}
      aside={
        hospitalOvertime ? (
          <MoneyValue agorot={hospitalOvertime.agorot} />
        ) : (
          <span dir="auto" className="text-[13px] font-light text-ink-quiet">
            {words.none}
          </span>
        )
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(() => setHospitalOvertime(workerId, month, amount, note));
        }}
        className="flex flex-col gap-2.5"
      >
        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
          <AmountField
            label={words.amount}
            hint={words.amountHint}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <NoteField
            label={words.note}
            value={note}
            onChange={setNote}
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={!changed}
            {...busyAttrs(saving, outlineButtonClass)}
          >
            <span dir="auto">{words.save}</span>
          </button>
        </div>
      </form>

      {shownRefusal ? (
        <Refusal reason={shownRefusal} />
      ) : fault ? (
        <FaultLine />
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
        <RuleLink rule="hospitalOvertime" />
      </Card>
    </MonthFold>
  );
}

/**
 * The income tax, calculated and correctable (specs.md item 17).
 *
 * **It corrects the figure and does not enter it.** The engine works the tax
 * out from the month's gross, the year's brackets and the credit points the
 * worker's gender gives them; this control shows that figure and stores an override over it. It is the
 * tax's only control, which is why the row answers `false` to the generic
 * override control's question — the reason sits beside the row in `month.ts`.
 *
 * **An empty field clears the correction and does not mean zero.** Clearing
 * says the application's own figure stands; typing a zero says this month
 * withholds nothing and stores that by hand. They produce the same number and
 * mean opposite things, which is the distinction `clearOverride` already draws.
 *
 * **The rule stands under the field in words rather than behind the "?".** It
 * is what the user has to know before they type — a foreign caregiver in home
 * care has 2.25 credit points, more than a foreign worker in another sector,
 * and someone who does not know that deducts too much — so it is not put where
 * only the user who already suspects there is something to find will look. The
 * link beside it is item 26's.
 *
 * The button is disabled while the field says what is already stored, which is
 * how the control says "this is saved" without a transient message that a user
 * looking away would miss. Zero is an ordinary entry and not an empty field: it
 * is what every month holds until they say otherwise, and typing it back is how
 * a tax entered by mistake comes off.
 */
function IncomeTaxControl({
  fold,
  workerId,
  gender,
  month,
  incomeTax,
  onSubmit,
}: FoldProps &
  Pick<
    MonthActionsProps,
    "workerId" | "gender" | "month" | "incomeTax" | "onSubmit"
  >) {
  const words = he.month.actions.incomeTax;
  const { agorot: incomeTaxAgorot, manual: incomeTaxManual } = incomeTax;
  // The field holds only what the *user* put there. A calculated figure is
  // shown above, beside the heading, and leaving the field empty is how they
  // says it stands — so an empty field is never an amount waiting to be saved.
  const [text, setText] = useState(
    incomeTaxManual ? formatAgorot(incomeTaxAgorot) : "",
  );
  const { refusal, fault, run, saving } = useAction(onSubmit);

  // **What produced the amount above**, said in the card rather than left to be
  // inferred from a field that may be empty: a manual figure first, because it
  // wins over everything, and otherwise whichever of the profile's three
  // choices this month was calculated under (item 17).
  const rate = formatPercent(incomeTax.setting.percentage ?? 0);
  let sourceWords: string;
  if (incomeTaxManual) sourceWords = words.from.manual;
  else if (incomeTax.setting.mode === "percentage") {
    sourceWords = words.from.percentage(rate);
  }
  else sourceWords = words.from[incomeTax.setting.mode];

  // **The rule under the card is the rule that actually produced the figure.**
  // The credit-point paragraph is the automatic mode's, and printing it beside
  // a flat-rate month would be a sentence that is untrue of the amount above it
  // — which is the worst kind of help, because it is the kind a family acts on.
  let ruleWords: string = words.rule;
  if (incomeTax.setting.mode === "none") ruleWords = words.ruleNone(gender);
  else if (incomeTax.setting.mode === "percentage") {
    ruleWords = words.rulePercentage(rate, gender);
  }

  // **Which unit the correction is typed in**. It is
  // the field's own state and never the worker's setting: a month on the
  // automatic mode may still be corrected by a share, and a month on a flat
  // rate may still be corrected by a sum. The stored value is an amount either
  // way, so switching the unit changes how they say it and not what is kept.
  const [unit, setUnit] = useState<TaxCorrectionUnit>("amount");
  const percentage = unit === "percentage" ? reviewTaxPercentage(text) : null;
  const gross = incomeTax.grossAgorot;

  // The same arithmetic the server will do, shown before they commit to it —
  // and shown *only* as a preview: what is saved is what the server works out
  // against the gross it reads again, so a screen left open while the month
  // moved cannot write an amount against a gross that has gone.
  const converted =
    percentage === null || gross === null || gross <= 0
      ? null
      : taxFromPercentage(percentage, gross);

  const cleared = text.trim() === "";
  let parsed: number | null = null;
  if (!cleared) parsed = unit === "percentage" ? converted : parseShekels(text);
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
    <MonthFold
      group="incomeTax"
      title={words.title}
      fold={fold}
      aside={
        incomeTaxAgorot === 0 ? (
          <span dir="auto" className="text-[13px] font-light text-ink-quiet">
            {words.none}
          </span>
        ) : (
          <MoneyValue agorot={-incomeTaxAgorot} />
        )
      }
    >

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
          <span className="text-[13px] font-light text-ink-quiet">
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
          {...busyAttrs(saving, `flex-none ${outlineButtonClass}`)}
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
      ) : fault ? (
        <FaultLine />
      ) : null}

      {/* The arithmetic, written out, so a share is never a figure they have to
          take on trust — and so the sum that is actually stored is the one they
          agreed to. */}
      {unit === "percentage" && percentage !== null ? (
        <span className="text-[13px] font-light text-ink-warm">
          {converted === null || gross === null ? (
            <span dir="auto">{words.noGross}</span>
          ) : (
            // A formula of three figures: translated, it would be three wrong
            // figures.
            <bdi translate="no">
              {words.worksOutTo(
                formatPercent(percentage),
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
        {/* The reminder is said on this screen as well as beside the
            profile's toggle: a family that only ever
            opens the payments screen still meets the rule. */}
        <span
          dir="auto"
          className="text-[13px] leading-[1.55] font-medium text-ink text-pretty"
        >
          {words.reminder}
        </span>
        <RuleLink rule="incomeTax" />
      </Card>
    </MonthFold>
  );
}

/**
 * The lines the user adds, listed, added and corrected (specs.md item 20).
 *
 * **The list is here and the summary is in the preview, and the two are not in
 * conflict**: the preview answers "what did this month come to", which nine
 * rows answer worse than one, while this is where the lines are made — and a
 * control surface that hides what it has already recorded cannot be used, since
 * a user who cannot see the line they just added adds it a second time.
 *
 * **The placement chips follow the direction until they touch them.** That is
 * `defaultPlacementFor` read forwards rather than a second copy of it: an
 * addition defaults to part of the month and a deduction to the transfer alone,
 * and the moment they choose, their choice stops moving.
 *
 * **A line is edited in place and never removed and re-added** (item 20). All
 * four of the things it records may change — the words, the amount, the
 * direction and the placement — and the id does not: removing and adding again
 * would lose the note and mint a new id, and the id is what the line's own key
 * is built from (item 17), so a reader looking for the line they corrected would
 * find one that had never existed before.
 *
 * **Its amount is edited and never overridden**, which is the division item 17
 * draws: what is written on a one-off line is the figure itself, and nothing
 * under it was derived. One panel does both, because adding and correcting ask
 * the same question — what should this line say — and a second panel would be a
 * second place for the placement rule to drift.

 */
function UserLinesControl({
  fold,
  workerId,
  gender,
  month,
  userLines,
  onSubmit,
}: FoldProps &
  Pick<
    MonthActionsProps,
    "workerId" | "gender" | "month" | "userLines" | "onSubmit"
  >) {
  const words = he.month.actions.lines;
  const {
    open,
    setOpen,
    label,
    setLabel,
    amount,
    setAmount,
    note,
    setNote,
    direction,
    setDirection,
    placement,
    setChosen,
    refusal,
    fault,
    run,
    busyAt,
    reset,
    openEdit,
    submit,
  } = useUserLineForm({
    send: onSubmit,
    save: (open, draft) =>
      open === "new"
        ? addUserLine(workerId, month, draft)
        : updateUserLine(workerId, month, open, draft),
  });

  function remove(lineId: string) {
    run(() => removeUserLine(workerId, month, lineId), undefined, busyKey.userLine(lineId));
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

      <AmountField
        label={words.amount}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />

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

      <NoteField
        label={words.note}
        hint={words.noteHint}
        value={note}
        onChange={setNote}
      />

      <PanelButtons
        submitLabel={open === "new" ? words.submit : words.save}
        onSubmit={submit}
        busy={open !== null && busyAt(open)}
        cancelLabel={words.cancel}
        onCancel={reset}
      />
    </Card>
  );

  return (
    <MonthFold
      group="userLines"
      title={he.month.preview.userLines}
      fold={fold}
      summary={
        <FoldedNames names={userLines.map((line) => line.label)} empty={words.empty} />
      }
    >
      <div className="flex flex-col gap-0.5">
        {/* **What this card can and cannot do, before they use it.** A line
            made here belongs to this month alone; the recurring kind is a term
            of the employment and is set on `/settings`, which shows the worker
            this screen does. Saying it here is
            what keeps a family from recording the same deduction twelve times,
            or from concluding the application cannot do it at all. */}
        <p dir="auto" className="text-[13px] leading-[1.5] font-light text-ink-quiet text-pretty">
          <span>{`${words.oneOffOnly} `}</span>
          <Link href="/settings" className="font-medium">
            <span dir="auto">{words.standing(gender)}</span>
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
                  className={`ms-auto font-medium hover:text-ink ${rowActionClass}`}
                >
                  <span dir="auto">{words.edit}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(line.id)}
                  aria-label={words.removeLabel(line.label)}
                  {...busyAttrs(
                    busyAt(busyKey.userLine(line.id)),
                    `hover:text-clay-deep ${rowActionClass}`,
                  )}
                >
                  <span dir="auto">{words.remove}</span>
                </button>
              </div>
              {line.note ? (
                <span
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
          className={`self-start ${outlineButtonClass}`}
        >
          <span dir="auto">{words.add}</span>
        </button>
      ) : null}

      {/* Drawn once, below whichever of the two is showing. Rendered inside
          each branch instead, it was the same element written twice and two
          places for its wording to drift. */}
      {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
    </MonthFold>
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
/**
 * Which of the three panels is open, if any: a new advance, a repayment of the
 * advance named, or a movement the month already records, corrected in place
 * (specs.md item 20).
 *
 * **A correction is addressed by the number and the kind together**, because a
 * month may grant one advance and repay another, and a month that granted and
 * repaid the same advance draws two rows the panel has to be able to tell
 * apart — which is the pair `advanceKey` is built from for the same reason.
 */
type OpenAdvancePanel =
  | { gesture: "grant" }
  | { gesture: "repay"; number: number }
  | { gesture: "edit"; number: number; kind: AdvanceKind };

/**
 * How many months a typed count splits a grant across, or `null` where it splits
 * it across none (specs.md item 20).
 *
 * **Empty means a grant on its own** — the gesture that existed before the split
 * did, and the one a family who agreed no repayment yet still needs. Anything
 * else that is not a whole number inside the engine's own limit is neither: it is
 * said in the form and the button is not offered, because writing the grant alone
 * would be answering a request for a hundred months with silence.
 */
function splitCountOf(typed: string): number | null {
  const text = typed.trim();
  if (!/^[0-9]+$/.test(text)) return null;
  const count = Number(text);
  return count >= 1 && count <= SPLIT_MONTHS_LIMIT ? count : null;
}

/** The open panel's own name, so the busy state sits on its button and not on
 * a row's action beside it. */
function panelKey(open: OpenAdvancePanel) {
  return open.gesture === "grant"
    ? "grant"
    : `${open.gesture}:${open.number}${open.gesture === "edit" ? `:${open.kind}` : ""}`;
}

function AdvancesControl({
  fold,
  workerId,
  month,
  ledger,
  monthAdvances,
  confirmedMonths,
  onSubmit,
}: FoldProps &
  Pick<
  MonthActionsProps,
  | "workerId"
  | "month"
  | "ledger"
  | "monthAdvances"
  | "confirmedMonths"
  | "onSubmit"
>) {
  const words = he.month.actions.advances;
  const splitWords = words.split;
  /** `null` when nothing is open — one panel at a time, so two half-filled
   * forms cannot both be on screen claiming the same month. */
  const [open, setOpen] = useState<OpenAdvancePanel | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  /** The day the money was handed over — a grant's own field (item 20). */
  const [givenOn, setGivenOn] = useState("");
  /** How many months to split the grant across, as typed. Empty is a grant on
   * its own, which is the gesture that existed before the split did. */
  const [splitMonths, setSplitMonths] = useState("");
  /**
   * The instalments the user has typed over the proposal, by their place in the
   * span.
   *
   * **Only the ones they touched are held.** The rest are proposed from the
   * amount and the count as those change — so correcting ₪5,000 to ₪6,000
   * re-divides the months nobody has edited and leaves the ones they set alone,
   * which a stored array of every field could not do without deciding for them
   * which of the two the correction meant.
   */
  const [edited, setEdited] = useState<Record<number, string>>({});
  /**
   * The movement a question is open about, or `null` with nothing asked
   * (`Confirm`).
   *
   * **A removal is asked about and the other three gestures are not**, because
   * only this one destroys something the screen is not showing: the debt every
   * later repayment was measured against, and any amount the user typed over
   * the row (specs.md item 20). One question at a time, like the panels.
   */
  const [asking, setAsking] = useState<{
    number: number;
    kind: AdvanceKind;
  } | null>(null);
  const { refusal, fault, run, clear, busyAt } = useAction(onSubmit);

  function reset() {
    setOpen(null);
    setAmount("");
    setNote("");
    setGivenOn("");
    setSplitMonths("");
    setEdited({});
    setAsking(null);
    clear();
  }

  /** The panel reopened over a movement the month already records, with what it
   * holds already in the fields (item 20). */
  function openEdit(advance: Advance) {
    clear();
    setAsking(null);
    setOpen({ gesture: "edit", number: advance.number, kind: advance.kind });
    setAmount(amountFieldValue(advance.agorot));
    setNote(advance.note ?? "");
    // The split is the grant panel's and a correction is not a grant: left
    // standing, a count typed and abandoned would ride along with the next
    // thing saved from the same panel.
    setSplitMonths("");
    setEdited({});
  }

  /**
   * The split as the form has it (specs.md item 20).
   *
   * **Nothing of it is stored and nothing of it is a rule of its own.** The
   * instalments are proposed by the engine's own division and the blocking month
   * is the engine's own answer, so what the form offers and what the server
   * writes cannot drift — the two read one function each. An empty count is a
   * grant on its own and leaves every one of these empty.
   */
  const splitCount = splitCountOf(splitMonths);
  const principalAgorot = parseShekels(amount);
  const span = splitCount === null ? [] : splitSpan(month, splitCount);
  const proposed =
    splitCount === null || principalAgorot === null
      ? []
      : splitInstalments(principalAgorot, splitCount);
  /** What each month's field holds: what the user typed over it, or the even
   * division of what they have typed as the amount. */
  const instalments = span.map((_, at) => {
    const typed = edited[at];
    if (typed !== undefined) return typed;
    const share = proposed[at];
    return share === undefined ? "" : amountFieldValue(share);
  });
  const plannedAgorot = instalments.reduce((sum, typed) => {
    const agorot = parseShekels(typed);
    return agorot === null ? sum : sum + agorot;
  }, 0);
  /** The confirmed month inside the span, which refuses the whole split — asked
   * of the engine, so the button is not offered for a press the server would
   * answer with a refusal. */
  const blocked =
    splitCount === null ? null : blockingConfirmedMonth(span, confirmedMonths);

  /** One call for all three gestures, and for the one that splits a grant as it
   * gives it: what is open is what tells them apart, and a correction keeps the
   * number and the kind it was opened on. */
  function submit() {
    if (open === null) return;
    run(
      () =>
        open.gesture === "edit"
          ? updateAdvance(workerId, month, open.number, open.kind, {
              amount,
              note,
            })
          : open.gesture === "grant" && splitCount !== null
            ? splitAdvance(workerId, month, {
                amount,
                note,
                givenOn,
                instalments,
              })
            : addAdvance(
                workerId,
                month,
                open.gesture === "grant"
                  ? { kind: "granted", amount, note, givenOn }
                  : { kind: "repaid", number: open.number, amount, note },
              ),
      reset,
      panelKey(open),
    );
  }

  function remove(advanceNumber: number, kind: AdvanceKind) {
    run(
      () => removeAdvance(workerId, month, advanceNumber, kind),
      undefined,
      busyKey.advance(advanceNumber, kind),
    );
  }

  /**
   * The press that asks, rather than the press that removes (the user,
   * 2026-10-01).
   *
   * **A removal the server would refuse is sent and never asked about.** The
   * refusal is the server's, as it is today — a grant with repayments standing
   * against it — and a question in front of it would ask the user to confirm
   * something that is not going to happen. Asked of the engine and never
   * restated here, for the reason `canRepay` gives below.
   */
  function askToRemove(standing: AdvanceStanding, advance: Advance) {
    if (whyRemovalIsRefused(standing, advance) !== null) {
      remove(advance.number, advance.kind);
      return;
    }
    clear();
    setOpen(null);
    setAsking({ number: advance.number, kind: advance.kind });
  }

  const granting = open?.gesture === "grant";
  /** A count typed that is not a span: said here, and the button withheld while
   * it stands (`splitCountOf`). */
  const splitRefused = splitMonths.trim() !== "" && splitCount === null;

  /**
   * The repayments a grant is being split into, under the grant's own fields
   * (specs.md item 20).
   *
   * **The application proposes and the user presses.** Every month's field opens
   * holding the engine's own even division, with the last absorbing the
   * remainder, and the user overtypes whichever of them the family actually
   * agreed. The sum beside them is what makes a plan for less than the whole debt
   * visible — that is allowed and leaves the rest owed, so the figure is shown
   * rather than refused.
   */
  const splitFields = (
    <div className="flex flex-col gap-2.5 border-t border-line-soft pt-2.5">
      <span dir="auto" className="text-[13px] font-medium text-ink-warm">
        {splitWords.title}
      </span>
      <Field
        label={splitWords.months}
        hint={splitWords.monthsHint}
        className="max-w-[11rem]"
      >
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={splitMonths}
          onChange={(event) => {
            setSplitMonths(event.target.value);
            // The span changed, so the amounts the user typed into it no longer
            // address the months they were typed for.
            setEdited({});
          }}
          className={`${inputClass} text-start`}
        />
      </Field>
      {splitRefused ? (
        <RefusalLine>{splitWords.monthsRefused(SPLIT_MONTHS_LIMIT)}</RefusalLine>
      ) : null}
      {span.length > 0 ? (
        <>
          <ul className="flex flex-col gap-2">
            {span.map((spanMonth, at) => (
              <li
                key={yearMonthText(spanMonth)}
                className="flex items-center gap-3"
              >
                {/* The month beside the field rather than inside its label: it
                    is a mixed run and needs its own isolate, which a label
                    passed as a string could not carry (`CLAUDE.md`). The
                    sentence a screen reader hears is the input's own. */}
                <span className="w-26 flex-none text-[13px] font-medium text-ink-warm">
                  <Bidi>{monthLabel(spanMonth)}</Bidi>
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  aria-label={splitWords.perMonth(monthLabel(spanMonth))}
                  /* The browser suite's handle on one instalment, by the month
                     it belongs to rather than by the Hebrew beside it. */
                  data-instalment={yearMonthText(spanMonth)}
                  value={instalments[at] ?? ""}
                  onChange={(event) =>
                    setEdited((current) => ({
                      ...current,
                      [at]: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </li>
            ))}
          </ul>
          <span className="text-[12px] font-light text-ink-quiet">
            <span dir="auto">{splitWords.sum} </span>
            <Bidi noTranslate>{formatAgorot(plannedAgorot)}</Bidi>
            <span dir="auto"> {splitWords.of} </span>
            <Bidi noTranslate>{formatAgorot(principalAgorot ?? 0)}</Bidi>
          </span>
          {blocked === null ? null : (
            <RefusalLine>
              {splitWords.confirmedMonth(monthLabel(blocked))}
            </RefusalLine>
          )}
          <span
            dir="auto"
            className="text-[12px] leading-[1.5] font-light text-ink-quiet text-pretty"
          >
            {splitWords.note}
          </span>
        </>
      ) : null}
    </div>
  );

  const panel = (
    <Card
      tone="inset"
      radius="panel"
      as="form"
      className="mt-1 flex flex-col gap-2.5 px-3.5 py-3"
    >
      <AmountField
        label={words.amount}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      {/* The day the money was handed over — a grant's alone, and a repayment is
          dated by the month it is entered for (item 20). A correction does not
          ask for it again: the movement carries it through
          (`reviewAdvanceEdit`). */}
      {granting ? (
        <Field
          label={words.givenOn}
          hint={words.givenOnHint(monthLabel(month))}
        >
          <input
            type="date"
            dir="ltr"
            value={givenOn}
            onChange={(event) => setGivenOn(event.target.value)}
            className={`${inputClass} text-start`}
          />
        </Field>
      ) : null}
      <NoteField
        label={words.note}
        hint={words.noteHint}
        value={note}
        onChange={setNote}
      />
      {granting ? splitFields : null}
      <PanelButtons
        submitLabel={
          open?.gesture === "edit"
            ? words.save
            : granting
              ? splitCount === null
                ? words.submitGrant
                : splitWords.submit
              : words.submitRepay
        }
        /* Withheld while the form already knows the server would refuse: a
           count that is not a span, or a confirmed month inside one. A control
           that answers a press with a refusal is a control that should not have
           been pressable (item 20). */
        disabled={granting && (splitRefused || blocked !== null)}
        onSubmit={submit}
        busy={open !== null && busyAt(panelKey(open))}
        cancelLabel={words.cancel}
        onCancel={reset}
      />
    </Card>
  );

  // How many advances are still being repaid. Nought is said as nought and not
  // as "none recorded": an advance repaid in full is a fact about the month,
  // and the two read alike only to whoever wrote the condition.
  const stillOwed = ledger.filter(
    (standing) => standing.outstandingAgorot !== 0,
  ).length;

  return (
    <MonthFold
      group="advances"
      title={words.title}
      fold={fold}
      // Folded, the section says how many advances are still being repaid, in
      // the aside's place. A summary there and never a control: a control could
      // only be drawn open, and five advances behind a bare heading are five
      // things nobody can see.
      summary={
        <span dir="auto" className="text-[13px] font-light text-ink-quiet">
          {ledger.length === 0 ? (
            words.empty
          ) : (
            <>
              <span>{words.outstanding} </span>
              <Bidi noTranslate>{String(stillOwed)}</Bidi>
            </>
          )}
        </span>
      }
      aside={
        open === null ? (
          <button
            type="button"
            onClick={() => {
              setAsking(null);
              setOpen({ gesture: "grant" });
            }}
            className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <span dir="auto">{words.grant}</span>
          </button>
        ) : null
      }
    >

      {open?.gesture === "grant" ? panel : null}

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
            // time either is corrected.
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
                  {/* The day the money was handed over, carried on the standing
                      so it reads from every month and not only from the one that
                      granted it (item 20). An advance from the opening position
                      has none. */}
                  {standing.givenOn === undefined ? null : (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        <span dir="auto">{words.givenOnShown}</span>
                        <Bidi noTranslate>{fullDayLabel(standing.givenOn)}</Bidi>
                      </span>
                    </>
                  )}
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
                      onClick={() => {
                        setAsking(null);
                        setOpen({ gesture: "repay", number: standing.number });
                      }}
                      aria-label={words.repayLabel(standing.number)}
                      className={`ms-auto font-medium hover:text-ink ${rowActionClass}`}
                    >
                      <span dir="auto">{words.repay}</span>
                    </button>
                  ) : null}
                </div>

                {open?.gesture === "repay" && open.number === standing.number
                  ? panel
                  : null}

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
                            onClick={() => openEdit(advance)}
                            aria-label={words.editLabel(
                              standing.number,
                              advance.kind,
                            )}
                            className={`ms-auto font-medium hover:text-ink ${rowActionClass}`}
                          >
                            <span dir="auto">{words.edit}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => askToRemove(standing, advance)}
                            aria-label={words.removeLabel(
                              standing.number,
                              advance.kind,
                            )}
                            {...busyAttrs(
                              busyAt(busyKey.advance(standing.number, advance.kind)),
                              `hover:text-clay-deep ${rowActionClass}`,
                            )}
                          >
                            <span dir="auto">{words.remove}</span>
                          </button>
                        </div>
                        {/* Asked under the movement it is about, so the row and
                            the question are read together (`Confirm`). */}
                        {asking !== null &&
                        asking.number === standing.number &&
                        asking.kind === advance.kind ? (
                          <Confirm
                            name={`advance:${standing.number}:${advance.kind}`}
                            question={words.confirmRemove[advance.kind]}
                            confirmLabel={words.confirmRemove.yes}
                            busy={busyAt(
                              busyKey.advance(standing.number, advance.kind),
                            )}
                            onConfirm={() =>
                              remove(standing.number, advance.kind)
                            }
                            onCancel={() => setAsking(null)}
                          />
                        ) : null}
                        {advance.note ? (
                          <span
                            className="text-[13px] leading-[1.5] font-light text-ink-warm text-pretty"
                          >
                            <Bidi>{advance.note}</Bidi>
                          </span>
                        ) : null}
                        {/* Opened under the movement it corrects, so the fields
                            and the row they belong to are read together. */}
                        {open?.gesture === "edit" &&
                        open.number === standing.number &&
                        open.kind === advance.kind
                          ? panel
                          : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
    </MonthFold>
  );
}

/**
 * The payments that go to a third party rather than to the worker (specs.md
 * item 16).
 *
 * **It is on this card and outside the worker's total at the same time, and the
 * lead is what carries that.** Everything else in the group either reaches them
 * or is withheld from what reaches them; this money is neither added to them
 * salary nor taken out of it, and a user who has just typed an income tax has
 * every reason to expect otherwise. The month screen draws the same payments in
 * a card of their own, outside their total, where their subtotal is the one
 * column total the preview prints (item 5).
 *
 * **A kind already recorded this month is not offered.** The sheet holds one row
 * per kind, so the refusal is what would answer the click, and a control that
 * answers a click with a refusal is a control that should not have been drawn —
 * the same rule `AdvancesControl` follows for a repayment it would be refused.
 * The server refuses it again regardless, because what the screen offers is
 * never the rule (Part 3).
 *
 * **The covered period follows the kind until they touch it**, which is
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

 */
function ThirdPartyControl({
  fold,
  workerId,
  month,
  thirdPartyPayments,
  onSubmit,
}: FoldProps &
  Pick<
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
  const [paidOn, setPaidOn] = useState("");
  // Empty takes the default `coverExpiryOf` gives the kind — a year for the
  // medical insurance and nothing for anything else. The family types over it
  // only where their own policy ran to some other day.
  const [expiresOn, setExpiresOn] = useState("");
  /** `null` until they choose, which is what lets the period follow the kind and
   * then stop following it. */
  const [chosenPeriod, setChosenPeriod] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const { refusal, fault, run, clear, busyAt } = useAction(onSubmit);

  const recorded = new Set(thirdPartyPayments.map((payment) => payment.kind));
  // The kinds still open this month, **and the one being corrected**: a panel
  // that hid the kind it was opened over would show the user a chip row with
  // their own payment missing from it.
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
    setPaidOn("");
    setExpiresOn("");
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
    setPaidOn(payment.paidOn);
    // Put back as stored and never re-derived: a policy the family dated
    // themselves must not spring back to a year on the next correction.
    setExpiresOn(payment.expiresOn ?? "");
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
   * which is the thing they may be changing. */
  function submit() {
    if (kind === null || open === null) return;
    const draft = {
      kind,
      amount,
      coversFrom: period.from,
      coversTo: period.to,
      paidOn,
      expiresOn,
      note,
    };
    run(
      () =>
        open === "new"
          ? addThirdPartyPayment(workerId, month, draft)
          : updateThirdPartyPayment(workerId, month, open, draft),
      reset,
      open,
    );
  }

  function remove(paid: ThirdPartyKind) {
    run(
      () => removeThirdPartyPayment(workerId, month, paid),
      undefined,
      busyKey.thirdParty(paid),
    );
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
                // which is the only moment it can: once they edit a month field
                // their choice stands for the rest of the entry.
                setChosenPeriod(null);
              }}
            >
              <span dir="auto">{he.sheet.thirdParty[candidate]}</span>
            </Chip>
          ))}
        </div>
      </div>

      <AmountField
        label={words.amount}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />

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
            emptyLabel={words.periodNone}
            back={PERIOD_MONTHS_BACK}
            forward={PERIOD_MONTHS_FORWARD}
          />
          <MonthSelect
            label={words.periodTo}
            month={month}
            value={period.to}
            onChange={(value) =>
              setChosenPeriod({ from: period.from, to: value })
            }
            emptyLabel={words.periodNone}
            back={PERIOD_MONTHS_BACK}
            forward={PERIOD_MONTHS_FORWARD}
          />
        </div>
        <span
          dir="auto"
          className="text-[12px] leading-[1.5] font-light text-ink-quiet text-pretty"
        >
          {words.periodHint}
        </span>
      </div>

      <Field label={words.paidOn} hint={words.paidOnHint}>
        <input
          type="date"
          dir="ltr"
          value={paidOn}
          onChange={(event) => setPaidOn(event.target.value)}
          className={`${inputClass} text-start`}
        />
      </Field>

      {/* Only a kind that buys a period has one to run out. The medical
          insurance is the one the family named, and item 27's reminder is what
          reads the date (specs.md item 16). */}
      {kind === "medicalInsurance" ? (
        <Field label={words.expiresOn} hint={words.expiresOnHint}>
          <input
            type="date"
            dir="ltr"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
            className={`${inputClass} text-start`}
          />
        </Field>
      ) : null}

      <NoteField
        label={words.note}
        hint={words.noteHint}
        value={note}
        onChange={setNote}
      />

      <PanelButtons
        submitLabel={open === "new" ? words.submit : words.save}
        onSubmit={submit}
        busy={open !== null && busyAt(open)}
        cancelLabel={words.cancel}
        onCancel={reset}
        disabled={kind === null}
      />
    </Card>
  );

  return (
    <MonthFold
      group="thirdParty"
      title={words.title}
      fold={fold}
      summary={
        <FoldedNames
          names={thirdPartyPayments.map((payment) => he.sheet.thirdParty[payment.kind])}
          empty={words.empty}
        />
      }
    >
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
                    read as a deduction from their pay, which is the one thing
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
                  className={`ms-auto font-medium hover:text-ink ${rowActionClass}`}
                >
                  <span dir="auto">{words.edit}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(payment.kind)}
                  aria-label={words.removeLabel(
                    he.sheet.thirdParty[payment.kind],
                  )}
                  {...busyAttrs(
                    busyAt(busyKey.thirdParty(payment.kind)),
                    `hover:text-clay-deep ${rowActionClass}`,
                  )}
                >
                  <span dir="auto">{words.remove}</span>
                </button>
              </div>
              {payment.note ? (
                <span
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

      {open === "new" ? panel : null}
      {open === null && available.length === 0 ? (
        /* Not a refusal — nothing was refused, there is simply nothing left to
           record — so it stands where the button was rather than under it. */
        <p dir="auto" className="text-[14px] font-light text-ink-quiet">
          {words.allRecorded}
        </p>
      ) : null}
      {open === null && available.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen("new")}
          className={`self-start ${outlineButtonClass}`}
        >
          <span dir="auto">{words.add}</span>
        </button>
      ) : null}

      {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
    </MonthFold>
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

 */
function OverridesControl({
  fold,
  workerId,
  month,
  lines,
  orphanedOverrides,
  onSubmit,
}: FoldProps &
  Pick<
  MonthActionsProps,
  "workerId" | "month" | "lines" | "orphanedOverrides" | "onSubmit"
>) {
  const words = he.month.actions.overrides;
  /** The key of the row whose panel is open, or `null`. One at a time, which is
   * the shape the rest of this card uses. */
  const [open, setOpen] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { refusal, fault, run, clear, busyAt } = useAction(onSubmit);

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
    run(() => setOverride(workerId, month, { key, amount, note }), reset, key);
  }

  function restore(key: string) {
    run(() => clearOverride(workerId, month, key), undefined, busyKey.override(key));
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
      <AmountField
        label={words.amount}
        hint={words.amountHint}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <NoteField
        label={words.note}
        hint={words.noteHint}
        value={note}
        onChange={setNote}
      />
      <PanelButtons
        submitLabel={words.save}
        onSubmit={() => save(key)}
        busy={busyAt(key)}
        cancelLabel={words.cancel}
        onCancel={reset}
      />
    </Card>
  );

  return (
    <MonthFold
      group="overrides"
      title={words.title}
      fold={fold}
      // **The rows they replaced, and not every row that could be.** Almost
      // every line of the sheet is overridable, so naming those would say the
      // same long thing every month; what has been typed over is what the
      // section is for.
      summary={
        <FoldedNames
          names={overridable.filter((line) => line.manual).map((line) => line.label)}
          empty={overridable.length === 0 ? words.empty : words.noneChanged}
        />
      }
    >
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
                  {/* The engine's own label, which names their rest day where the
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
                  className={`ms-auto font-medium hover:text-ink ${rowActionClass}`}
                >
                  <span dir="auto">{words.change}</span>
                </button>
                {line.manual ? (
                  <button
                    type="button"
                    onClick={() => restore(line.key)}
                    aria-label={words.clearLabel(line.label)}
                    {...busyAttrs(
                      busyAt(busyKey.override(line.key)),
                      `hover:text-clay-deep ${rowActionClass}`,
                    )}
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
                    {...busyAttrs(
                      busyAt(busyKey.override(key)),
                      `ms-auto hover:text-clay-deep ${rowActionClass}`,
                    )}
                  >
                    <span dir="auto">{words.clear}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
    </MonthFold>
  );
}
