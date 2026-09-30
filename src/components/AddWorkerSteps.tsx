"use client";

/**
 * The four steps of `הוספת עובד/ת`, and the fields they are built from.
 *
 * **The screen next door holds the draft and decides what is refused**; these
 * take a value and a `change` and draw it, which is what keeps the state
 * machine readable beside them.
 */

import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { Bidi } from "@/components/Bidi";
import { Chip } from "@/components/Chip";
import type { Country } from "@/lib/holidaySources";
import { RuleLink as SharedRuleLink } from "@/components/WhyDisclosure";
import {
  addMonths,
  compareMonth,
  eachMonth,
  isIsoDate,
  monthOf,
  parseYearMonth,
  sameMonth,
  yearMonthText,
} from "@/lib/dates";
import { monthLabel } from "@/lib/dateLabels";
import type { IsoDate, YearMonth } from "@/lib/types";
import {
  asksOpeningPosition,
  asksRecuperationPaid,
  firstMonthChoices,
  isAllowedGender,
  restDayChoices,
  reviewEmployedSince,
  type NewWorkerDraft,
  type NewWorkerRefusal,
  type OpeningDraft,
} from "@/lib/engine/profile";
import { paymentMonthBeforeFirstMonth } from "@/lib/engine/recuperation";
import { genders, incomeTaxModes } from "@/lib/engine/types";
import type { Gender } from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import type { LegalLinkKey } from "@/lib/links";
import { formatAgorot } from "@/lib/money";

/**
 * `EaseSalary - הוספת עובד` — the flow that gives a household its first worker.
 *
 * **It draws its own chrome and is outside `AppShell`**, as the artboard draws
 * it: the wordmark, a way out, and nothing else. The nav is a promise about a
 * household that has a worker in it, and this is the flow reached precisely
 * when that is not yet true — five tabs beside it would lead a family half-way
 * through adding somebody into five screens about nobody. `AppShell` names the
 * exception and says the same thing there.
 *
 * **Nothing is written until the last button**, which is what "לצאת בלי לשמור"
 * promises on every step. Three steps collect and the fourth reports, so a
 * family that closes the tab leaves neither a worker nor half of one.
 *
 * **The rule the wizard marks a field by is the rule the server saves by.**
 * `reviewNewWorker` is a pure function over the draft and runs in both places —
 * here so a field can be marked before a step is left, and again in the action,
 * because a server action is reachable by a crafted request and what a form
 * offered is never the rule (Part 3). One rule read twice, rather than two that
 * agree today.
 *
 * **Three departures from the artboard, each because the drawing asks for
 * something the spec does not.** The artboard marks the country optional and it
 * cannot be — it is where their holiday list comes from, and a worker without one
 * would be offered no list at all. Its step 2 offers calculating "from this
 * month" or "from the start of the employment"; item 6 offers this month or the
 * month before, never earlier than the employment, and asks for the opening
 * position in the same step when the employment began before the first month.
 * And its step 3 asks for a medical insurance *premium*, which is not a term of
 * the employment anywhere in the spec; item 16's `insurer` — who the premium is
 * paid *through* — is, and is what the sheet actually prints.
 */

/** Four bars and "שלב 2 מתוך 4". The two numbers are separate elements, so
 * neither is a bare string beside another node and neither is translated. */
export function Progress({ step }: { step: number }) {
  const words = he.addWorker;
  return (
    <section className="flex flex-col gap-3.5">
      <div aria-hidden="true" className="flex items-center gap-2">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1 flex-auto rounded-full ${
              index <= step ? "bg-forest" : "bg-line"
            }`}
          />
        ))}
      </div>
      <p className="text-[15px] font-light text-ink-quiet" data-role="add-worker-step">
        <span dir="auto">{words.stepOf.before}</span>
        <Bidi noTranslate>{String(step + 1)}</Bidi>
        <span dir="auto">{words.stepOf.between}</span>
        <Bidi noTranslate>{words.stepOf.total}</Bidi>
      </p>
    </section>
  );
}

type HeadingRef = RefObject<HTMLHeadingElement | null>;

/** `tabIndex={-1}` so the wizard can move focus here. `outline-none` because
 * the browser's own ring still drew round the title on arrival, where it read
 * as an error; the title is not a control, so nothing is lost. */
function Heading({
  title,
  lead,
  headingRef,
}: {
  title: string;
  lead: string;
  headingRef: HeadingRef;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h1
        ref={headingRef}
        tabIndex={-1}
        dir="auto"
        className="text-[32px] leading-[1.25] font-semibold tracking-[-0.02em] text-balance outline-none"
      >
        {title}
      </h1>
      <p dir="auto" className="max-w-[50ch] text-[18px] font-light text-pretty text-ink-mute">
        {lead}
      </p>
    </section>
  );
}

const INPUT =
  "w-full rounded-tint border border-line-field bg-ground px-4.5 py-3.75 text-[18px] text-ink transition-colors focus:border-forest focus:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

/**
 * One labelled field: the label, an optional marker, the hint under it, the
 * control, and the refusal beneath.
 *
 * The refusal sits with the field rather than at the foot of the form, because
 * `reviewNewWorker` names the field it refused and a sentence far from the
 * field it is about is a sentence the user has to hunt for.
 */
/** A refusal in the wizard's own voice. `Field.tsx` exports `RefusalLine` for
 * the same sentence elsewhere, but at 13px against the wizard's 14px, and the
 * two scales are kept apart on purpose — so this is the wizard's copy and not a
 * caller of that one.
 *
 * A `<span>` rather than a `<p>`, because one of the three sits inside a
 * `<label>`, whose content model takes phrasing content only. In a flex column
 * it lays out as the paragraph did. `role="alert"` rather than `aria-live`: the
 * element is mounted with its sentence already in it, and a live region is only
 * announced reliably when its content changes after it exists. */
function WizardRefusal({ children }: { children: ReactNode }) {
  return (
    <span dir="auto" role="alert" className="text-[14px] text-clay-deep">
      {children}
    </span>
  );
}

function Field({
  label,
  hint,
  optional,
  refusal,
  children,
}: {
  label: string;
  hint?: ReactNode;
  optional?: boolean;
  refusal: string | null;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-[17px] font-semibold">
        <span dir="auto">{label}</span>
        {optional ? (
          <span dir="auto" className="text-[14px] font-light text-ink-quiet">
            {he.addWorker.optional}
          </span>
        ) : null}
      </span>
      {hint ? (
        <span dir="auto" className="text-[15px] font-light text-pretty text-ink-soft">
          {hint}
        </span>
      ) : null}
      {children}
      {refusal ? <WizardRefusal>{refusal}</WizardRefusal> : null}
    </label>
  );
}

/** A group of choices that is not a text field, so it carries a legend rather
 * than a label: a `<label>` wrapping several controls names none of them. */
function ChoiceGroup({
  label,
  hint,
  refusal,
  children,
  ...rest
}: {
  label: string;
  hint?: string;
  refusal: string | null;
  children: ReactNode;
  "data-choice"?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" {...rest}>
      <legend dir="auto" className="text-[17px] font-semibold">
        {label}
      </legend>
      {hint ? (
        <p dir="auto" className="text-[15px] font-light text-pretty text-ink-soft">
          {hint}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-2">{children}</div>
      {refusal ? <WizardRefusal>{refusal}</WizardRefusal> : null}
    </fieldset>
  );
}

type Change = (over: Partial<NewWorkerDraft>) => void;
type RefusalFor = (...fields: NewWorkerRefusal[]) => string | null;

export function WhoStep({
  headingRef,
  draft,
  countries,
  change,
  refusalFor,
}: {
  headingRef: HeadingRef;
  draft: NewWorkerDraft;
  countries: Country[];
  change: Change;
  refusalFor: RefusalFor;
}) {
  const words = he.addWorker.who;
  const profile = he.workers.profile.terms;

  return (
    <>
      <Heading title={words.title} lead={words.lead} headingRef={headingRef} />
      <section className="flex flex-col gap-5.5">
        <Field label={words.name} hint={words.nameHint} refusal={refusalFor("name")}>
          <input
            type="text"
            value={draft.name}
            placeholder={words.namePlaceholder}
            onChange={(event) => change({ name: event.target.value })}
            className={INPUT}
            aria-invalid={refusalFor("name") !== null}
            data-field="name"
          />
        </Field>

        <ChoiceGroup
          label={words.gender}
          hint={words.genderHint}
          refusal={refusalFor("gender")}
          data-choice="gender"
        >
          {genders.map((choice) => (
            <Chip
              key={choice}
              selected={choice === draft.gender}
              onClick={() => change({ gender: choice })}
            >
              <Bidi>{profile.gender[choice]}</Bidi>
            </Chip>
          ))}
        </ChoiceGroup>

        {/*
          Optional, where the artboard leaves it unmarked. A family adding a
          worker in the middle of an employment may not have the passport to
          hand, and refusing the whole profile over it would send them away to
          find a document in order to record a salary. It is sealed before it
          reaches any store (`src/lib/identifyingNumbers.ts`).

          `dir="ltr"` inside, like every other identifier field: a passport
          number is Latin and digits, and it is never translated.
        */}
        <Field
          label={words.passport}
          hint={words.passportHint}
          optional
          refusal={null}
        >
          <input
            type="text"
            dir="ltr"
            translate="no"
            autoComplete="off"
            value={draft.passportNumber}
            placeholder={words.passportPlaceholder}
            onChange={(event) => change({ passportNumber: event.target.value })}
            className={`${INPUT} text-start`}
            data-field="passportNumber"
          />
        </Field>

        <Field label={words.country} hint={words.countryHint} refusal={refusalFor("country")}>
          <select
            value={draft.country}
            onChange={(event) => change({ country: event.target.value })}
            className={INPUT}
            aria-invalid={refusalFor("country") !== null}
            data-field="country"
          >
            {/* The select opens on nothing, so the country is chosen. It is
                what their holiday list comes from, and the first of six is an
                answer they never gave. */}
            <option value="">{words.countryPlaceholder}</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.nameHe}
              </option>
            ))}
          </select>
        </Field>
      </section>
    </>
  );
}

/**
 * What step 2 asks beyond its three fields, worked out from the draft: the
 * first months the start date allows and the one chosen, whether the opening
 * position is asked, and whether the recuperation question is. `null` until
 * the start date is a date the wizard accepts.
 */
interface WizardPlan {
  choices: YearMonth[];
  firstMonth: YearMonth;
  asksOpening: boolean;
  asksUsed: boolean;
  asksRecuperation: boolean;
  /** The month the payment fell due, when it fell before the first month. */
  paymentMonth: YearMonth | null;
  /** The months a payment could have been made in, newest first. */
  paidInChoices: YearMonth[];
}

export function wizardPlan(draft: NewWorkerDraft, today: IsoDate): WizardPlan | null {
  const employedSince = reviewEmployedSince(draft.employedSince, today);
  if (employedSince === "invalid" || employedSince === "range" || employedSince === "afterFirstMonth") {
    return null;
  }
  const choices = firstMonthChoices(employedSince, today);
  const typed = parseYearMonth(draft.firstMonth);
  const firstMonth =
    (typed && choices.find((choice) => sameMonth(choice, typed))) ?? choices[0];
  const recuperationMonth = Number(draft.recuperationMonth);
  const asksOpening = asksOpeningPosition(employedSince, firstMonth);
  const asksRecuperation =
    asksOpening && asksRecuperationPaid(employedSince, recuperationMonth, firstMonth);
  // The year before the first month, and never before the employment: the
  // payment asked about is the running employment year's.
  const earliest = addMonths(firstMonth, -12);
  const hired = monthOf(employedSince);
  return {
    choices,
    firstMonth,
    asksOpening,
    asksUsed: asksOpening && firstMonth.month > 1,
    asksRecuperation,
    paymentMonth: asksRecuperation
      ? paymentMonthBeforeFirstMonth(employedSince, recuperationMonth, firstMonth)
      : null,
    paidInChoices: eachMonth(
      compareMonth(hired, earliest) > 0 ? hired : earliest,
      addMonths(firstMonth, -1),
    ).reverse(),
  };
}

/** The rule a question asks about (item 26), a size up to match the wizard. */
function RuleLink({ rule }: { rule: LegalLinkKey }) {
  return <SharedRuleLink rule={rule} className="text-[14px] text-forest" />;
}

export function WhenStep({
  headingRef,
  draft,
  plan,
  change,
  chooseMonth,
  refusalFor,
}: {
  headingRef: HeadingRef;
  draft: NewWorkerDraft;
  plan: WizardPlan | null;
  change: Change;
  /** Said when the family picks a month themselves, after which the suggestion
   * stops following the start date. */
  chooseMonth: () => void;
  refusalFor: RefusalFor;
}) {
  const words = he.addWorker.when;
  const profile = he.workers.profile.terms;

  return (
    <>
      <Heading title={words.title} lead={words.lead} headingRef={headingRef} />
      <section className="flex flex-col gap-5.5">
        {/*
          A date control rather than three boxes, so what leaves it is already
          `2026-04-01` and nothing here parses a typed date. The artboard draws
          "יום / חודש / שנה"; the browser draws the order the reader's own
          locale uses, which is the same information and one fewer thing to get
          wrong (Part 5 is full of dates read the wrong way round).
        */}
        <Field
          label={words.employedSince}
          hint={words.employedSinceHint}
          refusal={refusalFor("employedSince", "employedSinceRange")}
        >
          <input
            type="date"
            dir="ltr"
            value={draft.employedSince}
            onChange={(event) => change({ employedSince: event.target.value })}
            className={`${INPUT} text-start`}
            aria-invalid={refusalFor("employedSince", "employedSinceRange") !== null}
            data-field="employedSince"
          />
        </Field>

        <ChoiceGroup
          label={words.restDay}
          hint={words.restDayHint}
          refusal={refusalFor("restDay")}
          data-choice="restDay"
        >
          {restDayChoices.map((day) => (
            <Chip
              key={day}
              selected={day === draft.restDay}
              onClick={() => change({ restDay: day })}
            >
              <Bidi>{profile.restDay.day(day)}</Bidi>
            </Chip>
          ))}
        </ChoiceGroup>

        <Field
          label={words.recuperationMonth}
          hint={words.recuperationMonthHint}
          refusal={refusalFor("recuperationMonth")}
        >
          <select
            value={draft.recuperationMonth}
            onChange={(event) => {
              chooseMonth();
              change({ recuperationMonth: event.target.value });
            }}
            className={INPUT}
            aria-invalid={refusalFor("recuperationMonth") !== null}
            data-field="recuperationMonth"
          >
            {he.calendar.monthNames.map((name, index) => (
              <option key={name} value={String(index + 1)}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <p
          dir="auto"
          data-role="recuperation-advice"
          className="-mt-3 text-[15px] font-light text-pretty text-ink-soft"
        >
          {words.recuperationMonthAdvice}
        </p>

        {plan && plan.choices.length > 1 ? (
          <ChoiceGroup
            label={words.firstMonth}
            hint={words.firstMonthHint}
            refusal={refusalFor("firstMonth")}
            data-choice="firstMonth"
          >
            {plan.choices.map((choice) => (
              <Chip
                key={yearMonthText(choice)}
                selected={sameMonth(choice, plan.firstMonth)}
                onClick={() => change({ firstMonth: yearMonthText(choice) })}
              >
                <Bidi>{monthLabel(choice)}</Bidi>
              </Chip>
            ))}
          </ChoiceGroup>
        ) : null}
      </section>

      {plan?.asksOpening ? (
        <OpeningQuestions
          opening={draft.opening}
          gender={draftGender(draft.gender)}
          plan={plan}
          change={(over) => change({ opening: { ...draft.opening, ...over } })}
          refusalFor={refusalFor}
        />
      ) : null}
    </>
  );
}

/**
 * The opening position (specs.md item 6), asked in the same step when the
 * employment began before the first month. Each question links to its rule.
 */
function OpeningQuestions({
  opening,
  gender,
  plan,
  change,
  refusalFor,
}: {
  opening: OpeningDraft;
  /** The step before this one asked, so these sentences can say "שלו" or
   * "שלה" rather than choosing one for them (`he.workerWords`). */
  gender: Gender;
  plan: WizardPlan;
  change: (over: Partial<OpeningDraft>) => void;
  refusalFor: RefusalFor;
}) {
  const words = he.addWorker.when.opening;
  const advanceWords = he.workers.profile.terms.opening;
  const daysInput = (value: string, onChange: (text: string) => void, field: string, refused: boolean) => (
    <input
      type="text"
      inputMode="decimal"
      dir="ltr"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${INPUT} text-start`}
      aria-invalid={refused}
      data-field={field}
    />
  );
  const setAdvance = (
    index: number,
    over: Partial<OpeningDraft["advances"][number]>,
  ) =>
    change({
      advances: opening.advances.map((each, at) =>
        at === index ? { ...each, ...over } : each,
      ),
    });
  const daysRefusal = refusalFor("openingDays");
  const usedRefusal = refusalFor("openingUsed");

  return (
    <section
      className="flex flex-col gap-5.5 border-t border-line pt-7"
      data-role="opening-position"
    >
      <div className="flex flex-col gap-1.5">
        <h2 dir="auto" className="text-[22px] font-semibold">
          {words.title}
        </h2>
        <p dir="auto" className="text-[16px] font-light text-pretty text-ink-mute">
          {words.lead(gender)}
        </p>
      </div>

      <Field label={words.vacationDays} hint={words.balanceHint} refusal={daysRefusal}>
        {daysInput(opening.vacationDays, (text) => change({ vacationDays: text }), "openingVacationDays", daysRefusal !== null)}
      </Field>
      <RuleLink rule="annualLeave" />

      <Field label={words.sickDays} hint={words.balanceHint} refusal={daysRefusal}>
        {daysInput(opening.sickDays, (text) => change({ sickDays: text }), "openingSickDays", daysRefusal !== null)}
      </Field>
      <RuleLink rule="sickPay" />

      {plan.asksUsed ? (
        <>
          <Field label={words.vacationUsed} hint={words.usedHint} refusal={usedRefusal}>
            {daysInput(opening.vacationUsedThisYear, (text) => change({ vacationUsedThisYear: text }), "openingVacationUsed", usedRefusal !== null)}
          </Field>
          <RuleLink rule="annualLeave" />

          <Field label={words.holidayUsed} hint={words.usedHint} refusal={usedRefusal}>
            {daysInput(opening.holidayUsedThisYear, (text) => change({ holidayUsedThisYear: text }), "openingHolidayUsed", usedRefusal !== null)}
          </Field>
          <RuleLink rule="holidayWork" />
        </>
      ) : null}

      {plan.asksRecuperation ? (
        <>
          <ChoiceGroup
            label={words.recuperationPaid}
            hint={words.recuperationPaidHint}
            refusal={refusalFor("recuperationPaid")}
            data-choice="recuperationPaid"
          >
            {([true, false] as const).map((answer) => (
              <Chip
                key={String(answer)}
                selected={opening.recuperationPaid === answer}
                onClick={() => change({ recuperationPaid: answer })}
              >
                <span dir="auto">{answer ? words.yes : words.no}</span>
              </Chip>
            ))}
          </ChoiceGroup>
          {opening.recuperationPaid === true ? (
            <Field label={words.recuperationPaidIn} refusal={refusalFor("recuperationPaidIn")}>
              <select
                value={opening.recuperationPaidIn}
                onChange={(event) => change({ recuperationPaidIn: event.target.value })}
                className={INPUT}
                data-field="recuperationPaidIn"
              >
                {plan.paidInChoices.map((choice) => (
                  <option key={yearMonthText(choice)} value={yearMonthText(choice)}>
                    {monthLabel(choice)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <RuleLink rule="recuperation" />
        </>
      ) : null}

      <fieldset className="flex flex-col gap-2" data-choice="openingAdvances">
        <legend dir="auto" className="text-[17px] font-semibold">
          {words.advances}
        </legend>
        <p dir="auto" className="text-[15px] font-light text-pretty text-ink-soft">
          {words.advancesHint(gender)}
        </p>
        {opening.advances.map((advance, index) => (
          <div
            key={index}
            data-opening-advance={index + 1}
            className="mt-1 flex flex-col gap-3 rounded-card-sm border border-line px-4 py-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <span dir="auto" className="text-[16px] font-medium">
                {words.advanceName(index + 1)}
              </span>
              <button
                type="button"
                onClick={() =>
                  change({ advances: opening.advances.filter((_, at) => at !== index) })
                }
                className="text-[14px] font-medium text-ink-mute transition-colors hover:text-clay-deep"
              >
                <span dir="auto">{advanceWords.remove}</span>
              </button>
            </div>
            <Field label={advanceWords.principal} refusal={null}>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={advance.principal}
                placeholder={he.placeholder.amountInput}
                onChange={(event) =>
                  setAdvance(index, { principal: event.target.value })
                }
                className={`${INPUT} text-start`}
                data-field="openingAdvancePrincipal"
              />
            </Field>
            <Field label={advanceWords.repaid} hint={advanceWords.repaidHint} refusal={null}>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={advance.repaid}
                placeholder={he.placeholder.amountInput}
                onChange={(event) =>
                  setAdvance(index, { repaid: event.target.value })
                }
                className={`${INPUT} text-start`}
                data-field="openingAdvanceRepaid"
              />
            </Field>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            change({ advances: [...opening.advances, { principal: "", repaid: "", note: "" }] })
          }
          className="mt-1 self-start text-[15px] font-medium text-forest hover:underline hover:underline-offset-4"
        >
          <span dir="auto">{advanceWords.addAdvance}</span>
        </button>
        {refusalFor("openingAdvance") ? (
          <WizardRefusal>{refusalFor("openingAdvance")}</WizardRefusal>
        ) : null}
        <RuleLink rule="wageDeductions" />
      </fieldset>
    </section>
  );
}

export function PayStep({
  headingRef,
  draft,
  change,
  refusalFor,
  minimumWageAgorot,
}: {
  headingRef: HeadingRef;
  draft: NewWorkerDraft;
  change: Change;
  refusalFor: RefusalFor;
  minimumWageAgorot: number;
}) {
  const words = he.addWorker.pay;
  const profile = he.workers.profile.terms;

  return (
    <>
      <Heading title={words.title} lead={words.lead} headingRef={headingRef} />
      <section className="flex flex-col gap-5.5">
        {/*
          The floor is shown and not merely enforced. A family that meets item
          3's rule by breaking it has been told after the fact; the figure the
          field opens at is that same minimum wage, so the ordinary case needs
          no typing at all.
        */}
        <Field
          label={words.salary}
          hint={
            <>
              <span>{words.salaryHint.before}</span>
              <Bidi noTranslate>{formatAgorot(minimumWageAgorot)}</Bidi>
              <span>{words.salaryHint.after}</span>
            </>
          }
          refusal={refusalFor("salary", "belowMinimum")}
        >
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={draft.baseMonthlySalary}
            onChange={(event) => change({ baseMonthlySalary: event.target.value })}
            className={`${INPUT} text-start`}
            aria-invalid={refusalFor("salary", "belowMinimum") !== null}
            data-field="baseMonthlySalary"
          />
        </Field>

        <Field
          label={words.restEveSupplement}
          hint={words.restEveSupplementHint}
          optional
          refusal={refusalFor("supplement")}
        >
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={draft.restEveSupplement}
            onChange={(event) => change({ restEveSupplement: event.target.value })}
            className={`${INPUT} text-start`}
            aria-invalid={refusalFor("supplement") !== null}
            data-field="restEveSupplement"
          />
        </Field>

        <Field label={words.insurer} hint={words.insurerHint} optional refusal={null}>
          <input
            type="text"
            value={draft.insurer}
            placeholder={words.insurerPlaceholder}
            onChange={(event) => change({ insurer: event.target.value })}
            className={INPUT}
            data-field="insurer"
          />
        </Field>

        <ChoiceGroup
          label={words.incomeTax}
          hint={words.incomeTaxHint}
          refusal={refusalFor("incomeTaxMode", "incomeTaxRate")}
          data-choice="incomeTax"
        >
          {incomeTaxModes.map((mode) => (
            <Chip
              key={mode}
              selected={mode === draft.incomeTaxMode}
              onClick={() => change({ incomeTaxMode: mode })}
            >
              <Bidi>{profile.incomeTax[mode]}</Bidi>
            </Chip>
          ))}
        </ChoiceGroup>

        <p dir="auto" className="-mt-2.5 text-[15px] font-light text-pretty text-ink-soft">
          {noteFor(draft.incomeTaxMode, draftGender(draft.gender))}
        </p>

        {draft.incomeTaxMode === "percentage" ? (
          <Field
            label={profile.incomeTax.rate}
            hint={profile.incomeTax.rateHint}
            refusal={null}
          >
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={draft.incomeTaxPercentage}
              onChange={(event) => change({ incomeTaxPercentage: event.target.value })}
              className={`${INPUT} text-start`}
              data-field="incomeTaxPercentage"
            />
          </Field>
        ) : null}

        {/* The law requires the tax, so the choice is made with the rule in
            sight rather than around it (item 17). */}
        <p dir="auto" className="text-[14px] text-ink-quiet">
          {profile.incomeTax.reminder}
        </p>
      </section>
    </>
  );
}

/** The month a start date falls in, 1-12, or `null` for a field that is not yet
 * a date. Read off the ISO text the date control produces rather than built
 * through a `Date`, which would shift across a time zone (`CLAUDE.md`). */
export function monthNumberOf(iso: string): number | null {
  const trimmed = iso.trim();
  return isIsoDate(trimmed) ? monthOf(trimmed).month : null;
}

/**
 * The draft's gender, narrowed for the sentences that agree with it.
 *
 * `NewWorkerDraft.gender` is `unknown` on purpose — a radio reaches the server
 * as data, and a union cannot check data. On screen it has always been one of
 * the two: the draft opens on one and only the radio writes it, so this
 * narrows rather than decides, and the fallback is unreachable.
 */
export function draftGender(value: unknown): Gender {
  return isAllowedGender(value) ? value : genders[0];
}

function noteFor(mode: unknown, gender: Gender): string {
  const words = he.addWorker.pay;
  const notes = {
    automatic: words.automaticNote(gender),
    none: words.noneNote,
    percentage: words.percentageNote,
  };
  return notes[incomeTaxModes.find((known) => known === mode) ?? "automatic"];
}

/**
 * The fourth step, which reports rather than asks: the worker is saved by the
 * time it is drawn.
 *
 * **Its three sentences each name something the application actually does.**
 * The artboard's own third line promises a reminder before a national-insurance
 * payment and before a permit expires, which is item 27's alert list and not
 * something this flow does — promising it here would be a feature invented on
 * a confirmation screen (`CLAUDE.md` rule 4).
 */
export function DoneStep({
  workerId,
  gender,
  headingRef,
}: {
  workerId: string | null;
  /** Every sentence on this step names them, so every one of them agrees with
   * the answer the first step collected (`he.workerWords`). */
  gender: Gender;
  headingRef: HeadingRef;
}) {
  const words = he.addWorker.done;

  return (
    <>
      <Heading
        title={words.title}
        lead={words.lead(gender)}
        headingRef={headingRef}
      />
      <section
        className="flex flex-col gap-3.5 rounded-card border border-chip-line bg-chip px-7 py-6.5"
        data-role="add-worker-done"
      >
        <span dir="auto" className="text-[17px] font-semibold">
          {words.whatNow}
        </span>
        {words.steps(gender).map((sentence) => (
          <span key={sentence} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-2 size-1.75 flex-none rounded-full bg-clay"
            />
            <span
              dir="auto"
              className="text-[16px] leading-[1.5] font-light text-pretty text-ink-soft"
            >
              {sentence}
            </span>
          </span>
        ))}
      </section>

      <div className="flex justify-end border-t border-line pt-6.5">
        <Link
          href={workerId === null ? "/workers" : `/workers/${workerId}`}
          data-role="add-worker-finish"
          className="rounded-[15px] bg-forest px-9 py-3.75 text-[19px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white"
        >
          <span dir="auto">{words.toWorker(gender)}</span>
        </Link>
      </div>
    </>
  );
}
