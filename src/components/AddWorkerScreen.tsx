"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import { createWorker } from "@/app/workers/actions";
import { Bidi } from "@/components/Bidi";
import { Chip } from "@/components/Chip";
import { LogoMark } from "@/components/icons";
import {
  addMonths,
  compareMonth,
  eachMonth,
  monthOf,
  parseYearMonth,
  sameMonth,
  yearMonthText,
} from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { monthLabel } from "@/lib/dateLabels";
import type { IsoDate, YearMonth } from "@/lib/types";
import {
  asksOpeningPosition,
  asksRecuperationPaid,
  firstMonthChoices,
  restDayChoices,
  reviewEmployedSince,
  reviewNewWorker,
  type NewWorkerDraft,
  type NewWorkerRefusal,
  type OpeningDraft,
} from "@/lib/engine/profile";
import { paymentMonthBeforeFirstMonth } from "@/lib/engine/recuperation";
import { legalLink, type LegalLinkKey } from "@/lib/links";
import { genders, incomeTaxModes } from "@/lib/engine/types";
import type { Gender, IncomeTaxMode } from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import { formatAgorot } from "@/lib/money";

/**
 * `EaseSalary - הוספת עובד` — the flow that gives a household its first worker
 * (`build_plan.md` stage 3).
 *
 * **It draws its own chrome and is outside `AppShell`**, as the artboard draws
 * it: the wordmark, a way out, and nothing else. The nav is a promise about a
 * household that has a worker in it, and this is the flow reached precisely
 * when that is not yet true — five tabs beside it would lead a family half-way
 * through adding somebody into five screens about nobody. `AppShell` names the
 * exception and says the same thing there; settled with the user on 2026-09-12,
 * against the open question `build_plan.md` carried about this artboard.
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
 * cannot be — it is where her holiday list comes from, and a worker without one
 * would be offered no list at all. Its step 2 offers calculating "from this
 * month" or "from the start of the employment"; item 6 offers this month or the
 * month before, never earlier than the employment, and asks for the opening
 * position in the same step when the employment began before the first month.
 * And its step 3 asks for a medical insurance *premium*, which is not a term of
 * the employment anywhere in the spec; item 16's `insurer` — who the premium is
 * paid *through* — is, and is what the sheet actually prints.
 */

/** How many steps there are, and which field belongs to which. A refusal names
 * a field, and the wizard has to know whether that field is behind the user or
 * ahead of her: at step 1 an empty salary is not yet a mistake. */
const STEP_OF: Record<NewWorkerRefusal, number> = {
  name: 0,
  gender: 0,
  country: 0,
  employedSince: 1,
  employedSinceRange: 1,
  restDay: 1,
  recuperationMonth: 1,
  salary: 2,
  belowMinimum: 2,
  supplement: 2,
  incomeTaxMode: 2,
  incomeTaxRate: 2,
  firstMonth: 1,
  openingDays: 1,
  openingUsed: 1,
  recuperationPaid: 1,
  recuperationPaidIn: 1,
  openingAdvance: 1,
};

const LAST_STEP = 3;

export interface Country {
  code: string;
  nameHe: string;
}

interface AddWorkerScreenProps {
  /** The countries the household holds a holiday list for (item 12). Read on
   * the server from the store, so the wizard offers exactly what a year of
   * holidays can actually be drawn from. */
  countries: Country[];
  /** The minimum wage in force now, which the salary may not be set below and
   * which the field opens at (`CLAUDE.md`'s non-negotiables, item 3). */
  minimumWageAgorot: number;
  /** Today in Israel, read on the server: the start date may be at most a
   * year after it (specs.md item 6), and nothing reads a clock in a render. */
  today: IsoDate;
}

export function AddWorkerScreen({
  countries,
  minimumWageAgorot,
  today,
}: AddWorkerScreenProps) {
  const words = he.addWorker;
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  const [step, setStep] = useState(0);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [failedToSave, setFailedToSave] = useState(false);

  const [draft, setDraft] = useState<NewWorkerDraft>(() => ({
    name: "",
    gender: "female",
    passportNumber: "",
    country: countries[0]?.code ?? "",
    employedSince: "",
    restDay: restDayChoices.find((day) => day === 6) ?? restDayChoices[0],
    recuperationMonth: "7",
    // The salary opens at the minimum wage, which is what item 3 makes the
    // default rather than an empty field the family has to look a figure up
    // for. It may be raised and may not be lowered.
    baseMonthlySalary: (minimumWageAgorot / 100).toFixed(2),
    restEveSupplement: "",
    insurer: "",
    incomeTaxMode: "automatic",
    incomeTaxPercentage: "",
    firstMonth: "",
    // Zero opens every count, as on her page: a family with nothing accrued
    // needs to type nothing.
    opening: {
      vacationDays: "0",
      sickDays: "0",
      vacationUsedThisYear: "0",
      holidayUsedThisYear: "0",
      recuperationPaid: null,
      recuperationPaidIn: "",
      advances: [],
    },
  }));

  /**
   * **The recuperation month follows the start date until the family moves it.**
   *
   * Recuperation is owed only once a full working year is complete (`specs.md`
   * item 15), and the month the employment began is the month that year closes
   * in — so a family that takes the suggestion is paid at the anniversary
   * rather than waiting up to eleven months more for a month they picked for no
   * reason. It stops following the moment the family chooses one themselves,
   * because a control that overwrote a deliberate choice would be worse than no
   * suggestion at all.
   */
  const [monthChosen, setMonthChosen] = useState(false);

  const change = (over: Partial<NewWorkerDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...over };
      if (over.employedSince !== undefined && !monthChosen) {
        const started = monthNumberOf(over.employedSince);
        if (started !== null) next.recuperationMonth = String(started);
      }
      return next;
    });
    setShown(false);
    setFailedToSave(false);
  };

  /** A refusal is held back until the user tries to leave the step. Marking a
   * name as missing while it is still being typed would refuse every field the
   * moment it is touched. */
  const [shown, setShown] = useState(false);

  /**
   * **The first month the draft carries is always one the start date allows.**
   * A choice made before the date was corrected may no longer be offered, and
   * then the first of the new choices stands — the one a single choice would
   * have been — rather than a refusal about a control that is not drawn.
   */
  const plan = useMemo(() => wizardPlan(draft, today), [draft, today]);
  const effective = useMemo<NewWorkerDraft>(
    () => ({
      ...draft,
      firstMonth: plan ? yearMonthText(plan.firstMonth) : draft.firstMonth,
      opening: {
        ...draft.opening,
        // The payment month opens at the month it was due.
        recuperationPaidIn:
          draft.opening.recuperationPaidIn === "" && plan?.paymentMonth
            ? yearMonthText(plan.paymentMonth)
            : draft.opening.recuperationPaidIn,
      },
    }),
    [draft, plan],
  );

  const reviewed = useMemo(
    () => reviewNewWorker(effective, minimumWageAgorot, today),
    [effective, minimumWageAgorot, today],
  );

  /** The refusal this step is responsible for, or none. A refusal belonging to
   * a step further on is a field the user has not reached. */
  const blocking =
    reviewed.ok || STEP_OF[reviewed.reason] > step ? null : reviewed.reason;

  const refusalFor = (...fields: NewWorkerRefusal[]) =>
    shown && blocking !== null && fields.includes(blocking)
      ? words.errors[blocking]
      : null;

  /** The step's heading takes focus when the step changes, so a screen reader
   * hears the new question rather than nothing — the button pressed stays put
   * while everything around it is replaced. Not on the first draw, which is an
   * ordinary page load. */
  const heading = useRef<HTMLHeadingElement>(null);
  const firstDraw = useRef(true);
  useEffect(() => {
    if (firstDraw.current) {
      firstDraw.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  function forward() {
    if (blocking !== null) {
      setShown(true);
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      setShown(false);
      return;
    }

    // Step 2 to step 3 is the save. Everything is reviewed again on the server,
    // which is where the rule actually holds.
    startSaving(async () => {
      const saved = await createWorker(effective);
      if (!saved.ok) {
        setShown(true);
        setFailedToSave(true);
        setStep(STEP_OF[saved.reason]);
        return;
      }
      setWorkerId(saved.workerId);
      setStep(LAST_STEP);
    });
  }

  function backward() {
    if (step === 0) {
      router.push("/");
      return;
    }
    setStep(step - 1);
    setShown(false);
  }

  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col bg-surface text-ink"
      data-role="add-worker"
    >
      <header className="flex flex-none items-center justify-between gap-5 border-b border-line px-5 py-5 md:px-11">
        {/* The wordmark as the top bar draws it. */}
        <div className="flex items-center gap-2.25">
          <LogoMark />
          <span translate="no" className="text-[20px] font-bold tracking-[-0.02em]">
            {he.app.name}
          </span>
        </div>
        {/* Honest on every step but the last, because nothing is written until
            the last button. On the last step there is something to leave to,
            and the link says so instead. */}
        <Link
          href="/"
          className="text-[16px] font-medium text-ink-mute transition-colors hover:text-forest"
        >
          <span dir="auto">{step === LAST_STEP ? he.nav.home : words.leave}</span>
        </Link>
      </header>

      <main className="flex flex-1 justify-center px-5 pt-12 pb-24 md:px-10">
        <div className="flex w-full max-w-[620px] flex-col gap-9">
          <Progress step={step} />

          {step === 0 ? (
            <WhoStep
              headingRef={heading}
              draft={draft}
              countries={countries}
              change={change}
              refusalFor={refusalFor}
            />
          ) : null}
          {step === 1 ? (
            <WhenStep
              headingRef={heading}
              draft={effective}
              plan={plan}
              change={change}
              chooseMonth={() => setMonthChosen(true)}
              refusalFor={refusalFor}
            />
          ) : null}
          {step === 2 ? (
            <PayStep
              headingRef={heading}
              draft={draft}
              change={change}
              refusalFor={refusalFor}
              minimumWageAgorot={minimumWageAgorot}
            />
          ) : null}
          {step === LAST_STEP ? <DoneStep headingRef={heading} workerId={workerId} /> : null}

          {failedToSave ? (
            <p
              dir="auto"
              role="alert"
              data-role="add-worker-error"
              className="rounded-card-sm bg-chip px-3.5 py-2.5 text-[15px] text-clay-deep"
            >
              {words.errors.save}
            </p>
          ) : null}

          {step === LAST_STEP ? null : (
            <div className="flex flex-wrap items-center justify-between gap-5 border-t border-line pt-6.5">
              <button
                type="button"
                onClick={backward}
                className="text-[17px] font-medium text-ink-mute transition-colors hover:text-forest"
              >
                <span dir="auto">{step === 0 ? words.cancel : words.back}</span>
              </button>
              <button
                type="button"
                onClick={forward}
                disabled={saving}
                aria-busy={saving}
                data-role="add-worker-next"
                className="rounded-[15px] bg-forest px-9 py-3.75 text-[19px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span dir="auto">{words.next}</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/** Four bars and "שלב 2 מתוך 4". The two numbers are separate elements, so
 * neither is a bare string beside another node and neither is translated. */
function Progress({ step }: { step: number }) {
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
      {refusal ? (
        <span dir="auto" role="alert" className="text-[14px] text-clay-deep">
          {refusal}
        </span>
      ) : null}
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
      {refusal ? (
        <p dir="auto" role="alert" className="text-[14px] text-clay-deep">
          {refusal}
        </p>
      ) : null}
    </fieldset>
  );
}

type Change = (over: Partial<NewWorkerDraft>) => void;
type RefusalFor = (...fields: NewWorkerRefusal[]) => string | null;

function WhoStep({
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
              <Bidi>{profile.gender[choice as Gender]}</Bidi>
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

function wizardPlan(draft: NewWorkerDraft, today: IsoDate): WizardPlan | null {
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

/** "דמי הבראה — באתר כל זכות", the rule a question asks about (item 26). */
function RuleLink({ rule }: { rule: LegalLinkKey }) {
  const link = legalLink(rule);
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      dir="auto"
      className="text-[14px] font-medium text-forest hover:underline hover:underline-offset-[3px]"
    >
      <span>{link.label}</span>
      <span> — </span>
      <span>{he.why.linkSuffix}</span>
    </a>
  );
}

function WhenStep({
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
              <Bidi>{profile.restDay.day(day as RestDay)}</Bidi>
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
  plan,
  change,
  refusalFor,
}: {
  opening: OpeningDraft;
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
          {words.lead}
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
          {words.advancesHint}
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
                  change({
                    advances: opening.advances.map((each, at) =>
                      at === index ? { ...each, principal: event.target.value } : each,
                    ),
                  })
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
                  change({
                    advances: opening.advances.map((each, at) =>
                      at === index ? { ...each, repaid: event.target.value } : each,
                    ),
                  })
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
          <p dir="auto" role="alert" className="text-[14px] text-clay-deep">
            {refusalFor("openingAdvance")}
          </p>
        ) : null}
        <RuleLink rule="wageDeductions" />
      </fieldset>
    </section>
  );
}

function PayStep({
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
              <Bidi>{profile.incomeTax[mode as IncomeTaxMode]}</Bidi>
            </Chip>
          ))}
        </ChoiceGroup>

        <p dir="auto" className="-mt-2.5 text-[15px] font-light text-pretty text-ink-soft">
          {noteFor(draft.incomeTaxMode)}
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
function monthNumberOf(iso: string): number | null {
  const parts = /^\d{4}-(\d{2})-\d{2}$/.exec(iso.trim());
  return parts === null ? null : Number(parts[1]);
}

function noteFor(mode: unknown): string {
  const words = he.addWorker.pay;
  if (mode === "none") return words.noneNote;
  if (mode === "percentage") return words.percentageNote;
  return words.automaticNote;
}

/**
 * The fourth step, which reports rather than asks: the worker is saved by the
 * time it is drawn.
 *
 * **Its three sentences each name something the application actually does.**
 * The artboard's own third line promises a reminder before a national-insurance
 * payment and before a permit expires, which is item 27's alert list and is
 * stage 6's — promising it here would be a feature invented on a confirmation
 * screen (`CLAUDE.md` rule 4).
 */
function DoneStep({
  workerId,
  headingRef,
}: {
  workerId: string | null;
  headingRef: HeadingRef;
}) {
  const words = he.addWorker.done;

  return (
    <>
      <Heading title={words.title} lead={words.lead} headingRef={headingRef} />
      <section
        className="flex flex-col gap-3.5 rounded-card border border-chip-line bg-chip px-7 py-6.5"
        data-role="add-worker-done"
      >
        <span dir="auto" className="text-[17px] font-semibold">
          {words.whatNow}
        </span>
        {words.steps.map((sentence) => (
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
          <span dir="auto">{words.toWorker}</span>
        </Link>
      </div>
    </>
  );
}
