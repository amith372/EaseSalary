"use client";

/**
 * The terms of one worker's employment, each with the control that changes it —
 * the rows of `EaseSalary - הגדרות`.
 *
 * **They are drawn on `/settings` and nowhere else**, so a term is changed in
 * exactly one place.
 *
 * Every control holds the draft being typed as local state seeded from the
 * profile, so the screen that draws them keys them by worker: a switch to the
 * other worker must not leave the first one's draft in the fields.
 *
 * It holds no arithmetic. Every change goes to a server action which parses the
 * amount, checks the choices and writes through the store, and the page then
 * re-renders from what was saved (Part 3).
 */

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import {
  setCountry,
  setDocuments,
  setInsurer,
  setGender,
  setIdentifyingNumber,
  setRestEveSupplement,
  setEmployedSince,
  setIncomeTaxSetting,
  setRecuperationMonth,
  setRestDay,
  setSalaryChange,
  type ProfileActionRefusal,
  type RestDayAnswer,
  type RestDayAnswers,
} from "@/app/workers/actions";
import { Bidi } from "@/components/Bidi";
import { Chip } from "@/components/Chip";
import {
  busyAttrs,
  buttonClass,
  FaultLine,
  Field,
  inputClass,
  RefusalLine,
} from "@/components/Field";
import { useAction, type Send } from "@/components/useAction";
import { RuleLink } from "@/components/WhyDisclosure";
import { fullDayLabel, monthLabel } from "@/lib/dateLabels";
import { addMonths, compareMonth, yearMonthText } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import type { IsoDate, YearMonth } from "@/lib/types";
import { restDayChoices } from "@/lib/engine/profile";
import type { Country } from "@/lib/holidaySources";
import type {
  StrandedFreeRestDay,
  StrandedRefusal,
} from "@/lib/engine/profile";
import type { WorkerProfile } from "@/lib/engine/repository";
import {
  genders,
  incomeTaxModes,
} from "@/lib/engine/types";
import type {
  Gender,
  IncomeTaxMode,
  IncomeTaxSetting,
} from "@/lib/engine/types";
import { salaryFor } from "@/lib/engine/salary";
import { he } from "@/lib/i18n/he";
import type { IdentifyingNumbers } from "@/lib/identifyingNumbers";
import {
  amountFieldValue,
  formatAgorot,
  formatDays,
  formatPercent,
} from "@/lib/money";


/**
 * The way in to `בחירת חגים`.
 *
 * It is reached from `הגדרות`, as the artboard draws it; the alert that names
 * an incomplete selection is the other way in.
 *
 * It shows what is chosen against what they have, because "an incomplete
 * selection is visible at a glance" is item 10's, and a row that only said
 * "choose holidays" would hide exactly the thing worth glancing at.
 */
export function HolidaysRow({
  year,
  chosen,
  allowance,
}: {
  year: number;
  chosen: number;
  allowance: number;
}) {
  const words = he.workers.profile.terms.holidays;
  return (
    <TermRow label={words.label} hint={words.hint}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span data-holidays className="flex items-baseline gap-1.5 text-[15px]">
          <span dir="auto" className="font-light text-ink-mute">
            {words.chosen}
          </span>
          <Bidi noTranslate className="font-semibold">
            {formatDays(chosen)}
          </Bidi>
          <span dir="auto" className="font-light text-ink-mute">
            {words.of}
          </span>
          <Bidi noTranslate className="font-semibold">
            {formatDays(allowance)}
          </Bidi>
        </span>
        <Link
          href={`/settings/holidays?year=${year}`}
          className="rounded-full border border-line bg-surface px-3.25 py-1.75 text-[14px] font-medium text-forest transition-colors hover:border-line-hover"
        >
          <span dir="auto">{words.open}</span>
        </Link>
      </div>
    </TermRow>
  );
}


/**
 * One term, its heading, and the control that changes it.
 *
 * **The heading is the control's accessible name.** The row draws its name once,
 * as the `<h3>`, and the control under it is a bare field — so without this the
 * passport, the employment permit, the work visa and the bank account are four
 * boxes a screen reader announces alike. A `Field` label would draw the row's
 * name a second time under the heading and change the screen, so the heading's
 * id goes to the control instead: a row whose control needs a name takes
 * `children` as a function and passes the id on. A control already inside a
 * `Field` must not take it — `aria-labelledby` would override that label rather
 * than add to it.
 */
export function TermRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode | ((labelId: string) => ReactNode);
}) {
  const labelId = useId();
  return (
    <section className="flex min-w-0 flex-col gap-1.5 border-t border-line-soft py-4 first:border-t-0 sm:py-4.5">
      <div className="flex flex-col gap-0.5">
        <h3 id={labelId} dir="auto" className="text-[15px] font-semibold">
          {label}
        </h3>
        {hint ? (
          <p
            dir="auto"
            className="max-w-[62ch] text-[13px] leading-[1.5] font-light text-ink-quiet text-pretty"
          >
            {hint}
          </p>
        ) : null}
      </div>
      {typeof children === "function" ? children(labelId) : children}
    </section>
  );
}

/** A bare text action. The padding widens what a finger can hit to about 44px
 * and the negative margin gives the space back, so the row keeps its layout. */
export const quietButtonClass =
  "-mx-1 -my-3 px-1 py-3 text-[14px] font-medium text-ink-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

/** What the refusal was, as a sentence. Never a code: a refusal carries the
 * reason it was refused (specs.md item 25). */
export function Refusal({ reason }: { reason: ProfileActionRefusal }) {
  // A sentence that names the worker's first month is written by the one
  // control that holds it (`EmployedSinceControl`), and no other control is
  // refused for that reason.
  if (reason === "employedSinceAfterFirstMonth") return null;
  // Not a sentence either: a change that would strand a free rest day is
  // answered in `StrandedPanel`, which the control draws beside this line.
  if (reason === "stranded") return null;
  return <RefusalLine>{he.workers.profile.terms.refused[reason]}</RefusalLine>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p dir="auto" className="text-[14px] font-light text-ink-quiet">
      {children}
    </p>
  );
}

export type Submit = Send<ProfileActionRefusal>;

/**
 * The weekly rest day (specs.md item 5).
 *
 * Three chips and no fourth: the law allows Friday, Saturday and Sunday and the
 * profile refuses any other day, so what the control offers is the same
 * `restDayChoices` the server checks against — the offer is not the rule
 * (Part 3), and the two must not be able to drift.
 *
 * The rest-eve is named under them rather than set beside them, because it
 * follows from the choice: a Sunday-resting worker's supplement lands on
 * Saturday and a Friday-resting one's on Thursday (item 14). The user picks a
 * day, not a pair.
 */
export function RestDayControl({
  workerId,
  restDay,
  onSubmit,
}: {
  workerId: string;
  restDay: RestDay;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.restDay;
  const { refusal, fault, run, busyAt } = useAction(onSubmit);
  // The question the change raised, and the day it was going to be changed to.
  // Set on every attempt, so an answer cannot be sent against a day the user
  // has since moved away from.
  const [asking, setAsking] = useState<{
    day: RestDay;
    stranded: StrandedFreeRestDay[];
  } | null>(null);

  function change(day: RestDay, answers: RestDayAnswers = {}) {
    run(
      async () => {
        const result = await setRestDay(workerId, day, answers);
        // Narrowed on the marks themselves and not on the reason: "stranded" is
        // in the refusal union so that one hook can carry every term, so the
        // reason alone no longer says the payload is there.
        setAsking("stranded" in result ? { day, stranded: result.stranded } : null);
        return result;
      },
      undefined,
      // The chip they pressed, or — once the panel is up — the panel's own save.
      Object.keys(answers).length === 0 ? String(day) : "stranded",
    );
  }

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="restDay" className="flex flex-wrap gap-2">
        {restDayChoices.map((day) => (
          <Chip
            key={day}
            selected={day === restDay}
            busy={busyAt(String(day))}
            onClick={() => change(day)}
          >
            <Bidi>{words.day(day)}</Bidi>
          </Chip>
        ))}
      </div>
      <p dir="auto" className="text-[13px] font-light text-ink-quiet">
        {words.eveNote(restDay)}
      </p>
      {asking ? (
        <StrandedPanel
          from={restDay}
          to={asking.day}
          stranded={asking.stranded}
          onSave={(answers) => change(asking.day, answers)}
          busy={busyAt("stranded")}
          onCancel={() => setAsking(null)}
        />
      ) : null}
      {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
    </TermRow>
  );
}

/**
 * The free rest days a change of rest day would strand, one row each, with the
 * three answers item 5 allows and the reason beside any of them not offered.
 *
 * **It is on no artboard, and the departure is written in `DESIGN.md`.** The
 * canvas draws the rest day as three chips and says nothing about the question
 * behind them, so the panel is built in the idiom of the rows around it rather
 * than as a screen of its own: the question belongs where the change is made,
 * and a user sent elsewhere to answer it would have lost the change they were
 * making.
 *
 * **Nothing is saved until every mark has been answered**, because a partial
 * answer leaves the worker exactly where the change with no answers leaves them.
 * Cancelling saves nothing at all (`build_plan.md` stage 8.5).
 */
function StrandedPanel({
  from,
  to,
  stranded,
  onSave,
  busy,
  onCancel,
}: {
  from: RestDay;
  to: RestDay;
  stranded: StrandedFreeRestDay[];
  onSave: (answers: RestDayAnswers) => void;
  /** The answers are on their way to the store. */
  busy: boolean;
  onCancel: () => void;
}) {
  const words = he.workers.profile.terms.restDay.stranded;
  const [answers, setAnswers] = useState<RestDayAnswers>({});
  const answered = stranded.every((mark) => answers[mark.id] !== undefined);

  return (
    <div
      data-terms="strandedFreeRestDays"
      className="mt-3 rounded-card-sm border border-line bg-ground p-4"
    >
      <p dir="auto" className="text-[14px] font-medium text-ink">
        {words.title}
      </p>
      <p dir="auto" className="mt-1 text-[13px] font-light text-ink-quiet">
        {words.intro(from, to)}
      </p>
      <ul className="mt-3 space-y-3">
        {stranded.map((mark) => (
          <li key={mark.id} data-stranded={mark.date}>
            <p className="text-[14px] font-medium text-ink">
              <Bidi>{fullDayLabel(mark.date)}</Bidi>
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <StrandedChoiceRow
                markId={mark.id}
                answer="delete"
                label={words.delete}
                offered
                chosen={answers[mark.id] === "delete"}
                onChoose={setAnswers}
              />
              <StrandedChoiceRow
                markId={mark.id}
                answer="convert"
                label={words.convert}
                offered={mark.convert.offered}
                reason={mark.convert.reason}
                chosen={answers[mark.id] === "convert"}
                onChoose={setAnswers}
              />
              <StrandedChoiceRow
                markId={mark.id}
                answer="moveEarlier"
                label={words.moveEarlier}
                date={mark.moveEarlier.date}
                offered={mark.moveEarlier.offered}
                reason={mark.moveEarlier.reason}
                chosen={answers[mark.id] === "moveEarlier"}
                onChoose={setAnswers}
              />
              <StrandedChoiceRow
                markId={mark.id}
                answer="moveLater"
                label={words.moveLater}
                date={mark.moveLater.date}
                offered={mark.moveLater.offered}
                reason={mark.moveLater.reason}
                chosen={answers[mark.id] === "moveLater"}
                onChoose={setAnswers}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-stranded-action="save"
          disabled={!answered}
          {...busyAttrs(busy, `${buttonClass} disabled:opacity-40`)}
          onClick={() => onSave(answers)}
        >
          {words.save}
        </button>
        <button
          type="button"
          data-stranded-action="cancel"
          className={quietButtonClass}
          onClick={onCancel}
        >
          {words.cancel}
        </button>
      </div>
    </div>
  );
}

/** One answer for one mark. A choice not offered is drawn disabled with the
 * reason beside it rather than left out, so the user can see that the
 * application considered it and why it cannot be taken (item 25). */
function StrandedChoiceRow({
  markId,
  answer,
  label,
  date,
  offered,
  reason,
  chosen,
  onChoose,
}: {
  markId: string;
  answer: RestDayAnswer;
  label: string;
  date?: IsoDate;
  offered: boolean;
  reason?: StrandedRefusal;
  chosen: boolean;
  onChoose: (update: (answers: RestDayAnswers) => RestDayAnswers) => void;
}) {
  const words = he.workers.profile.terms.restDay.stranded;
  return (
    <label
      data-choice={answer}
      data-offered={offered ? "yes" : "no"}
      className={`flex flex-wrap items-baseline gap-2 text-[13px] ${
        offered ? "text-ink" : "text-ink-quiet"
      }`}
    >
      <input
        type="radio"
        name={`stranded-${markId}`}
        disabled={!offered}
        checked={chosen}
        onChange={() => onChoose((current) => ({ ...current, [markId]: answer }))}
      />
      <span dir="auto">{label}</span>
      {date ? <Bidi>{fullDayLabel(date)}</Bidi> : null}
      {reason ? (
        <span dir="auto" className="text-ink-quiet">
          {words.reasons[reason]}
        </span>
      ) : null}
    </label>
  );
}

/**
 * The worker's country of origin (specs.md item 10).
 *
 * **It is here because it is correctable, and it was not before**: the wizard
 * wrote it once and nothing since could change it, so a family that chose wrong
 * held a profile permanently wrong about where they are from — and the country is
 * printed as a fact about them on `/workers` and on their page.
 *
 * **Chips and not the wizard's select**, for the reason `RecuperationControl`
 * gives: every choice on this screen is a row of chips, and a dropdown would be
 * the only one on the page. The offer is exactly the countries a holiday list
 * is stored for, read on the server — the same offer the wizard makes — and the
 * server checks the code against it all the same, because the offer is never
 * the rule (Part 3).
 *
 * **Changing it moves the default and not a chosen list.** A worker moved to
 * another country's list or to a faith's keeps it (`holidaySourceOf`), which is
 * what the hint says; a worker never moved follows the correction.
 */
export function CountryControl({
  workerId,
  country,
  countries,
  onSubmit,
}: {
  workerId: string;
  country: string;
  countries: Country[];
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.country;
  const { refusal, fault, run, busyAt } = useAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="country" className="flex flex-wrap gap-2">
        {countries.map((choice) => (
          <Chip
            key={choice.code}
            selected={choice.code === country}
            busy={busyAt(choice.code)}
            onClick={() =>
              run(() => setCountry(workerId, choice.code), undefined, choice.code)
            }
          >
            <Bidi>{choice.nameHe}</Bidi>
          </Chip>
        ))}
      </div>
      {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
    </TermRow>
  );
}

/**
 * The worker's gender (specs.md item 17).
 *
 * **Two chips, in the idiom the rest day already uses**, and offering exactly
 * the `genders` the server checks against — the offer is not the rule (Part 3),
 * and the two must not be able to drift.
 *
 * **There is no unset state and no "prefer not to say".** The field decides how
 * many credit points the worker is given, and a profile that declined to answer
 * would have to be credited one way or the other anyway — silently, and by
 * whichever the code happened to default to. Item 3's rule holds here as much
 * as it does for a rate: the figure a month is calculated with is never a guess
 * nobody made.
 */
export function GenderControl({
  workerId,
  gender,
  onSubmit,
}: {
  workerId: string;
  gender: Gender;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.gender;
  const { refusal, fault, run, busyAt } = useAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="gender" className="flex flex-wrap gap-2">
        {genders.map((choice) => (
          <Chip
            key={choice}
            selected={choice === gender}
            busy={busyAt(choice)}
            onClick={() => run(() => setGender(workerId, choice), undefined, choice)}
          >
            <Bidi>{words[choice]}</Bidi>
          </Chip>
        ))}
      </div>
      {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
    </TermRow>
  );
}

/**
 * How this worker's income tax is arrived at (specs.md item 17).
 *
 * **Three named chips rather than one box whose emptiness meant something.**
 * The control this replaces held a single amount in which a typed zero meant
 * "withhold nothing" and an empty field meant "work it out" — a distinction
 * nothing on the screen stated, so a family that cleared the field to switch
 * the tax off silently got the calculated figure back. Naming the three states
 * is the whole of the fix, and it adds nothing to what is stored: automatic is
 * the default, `ללא ניכוי` is a settled zero, and the percentage is the one
 * mode that carries a number.
 *
 * **The rate field appears only under its own chip**, and the chip is not
 * committed until the rate is: choosing `אחוז קבוע` and leaving the box empty
 * would otherwise store a mode with no rate, which is a worker whose tax is a
 * percentage of nothing.
 *
 * **The reminder stands under all three** and not only under `ללא ניכוי`. A
 * rule that appears the moment you do the thing it warns against reads as an
 * accusation; one that always stands is a rule.
 */
export function IncomeTaxControl({
  workerId,
  setting,
  onSubmit,
}: {
  workerId: string;
  setting: IncomeTaxSetting;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.incomeTax;
  const { refusal, fault, run, busyAt } = useAction(onSubmit);
  const [mode, setMode] = useState<IncomeTaxMode>(setting.mode);
  // The stored fraction shown back as a percentage, which is the unit the user
  // types in: 0.025 is 2.5. The conversion happens here and on the server, and
  // nowhere between them.
  const [rate, setRate] = useState(
    setting.percentage === undefined
      ? ""
      : formatPercent(setting.percentage),
  );

  const notes = {
    automatic: words.automaticNote,
    none: words.noneNote,
    percentage: words.percentageNote,
  };

  function choose(next: IncomeTaxMode) {
    setMode(next);
    // A mode with nothing to say is saved at once; the percentage waits for its
    // own number, which is what the field below is for.
    if (next !== "percentage") {
      run(() => setIncomeTaxSetting(workerId, next, ""), undefined, next);
    }
  }

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="incomeTax" className="flex flex-wrap gap-2">
        {incomeTaxModes.map((choice) => (
          <Chip
            key={choice}
            selected={choice === mode}
            busy={busyAt(choice)}
            onClick={() => choose(choice)}
          >
            <Bidi>{words[choice]}</Bidi>
          </Chip>
        ))}
      </div>

      {mode === "percentage" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => setIncomeTaxSetting(workerId, "percentage", rate),
              undefined,
              "percentage:save",
            );
          }}
          className="flex items-end gap-2"
        >
          <div className="min-w-0 flex-1">
            <Field label={words.rate} hint={words.rateHint}>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                placeholder="0.0"
                className={inputClass}
              />
            </Field>
          </div>
          <button
            type="submit"
            {...busyAttrs(
              busyAt("percentage:save"),
              "flex-none rounded-full border border-line bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
            )}
          >
            <span dir="auto">{words.save}</span>
          </button>
        </form>
      ) : null}

      <p dir="auto" className="text-[13px] font-light text-ink-quiet">
        {notes[mode]}
      </p>
      <p dir="auto" className="text-[13px] font-medium text-ink">
        {words.reminder}
      </p>
      {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
    </TermRow>
  );
}

/**
 * The month the recuperation payment falls in, and the days it will pay
 * (specs.md item 15).
 *
 * **The user chooses the month and never the days.** The entitlement follows
 * from their seniority and is reported beside the choice rather than offered as
 * one: item 15 is explicit that the days are worked out, and a field for them
 * would be a number the family has to know — which is what this application
 * exists not to ask.
 *
 * **Twelve chips and not a select**, because the choice is one of twelve short
 * names and the row beside it already reads as a row of chips; a dropdown here
 * would be the only one on the page. The value is checked on the server all the
 * same, since the offer is never the rule (Part 3).
 *
 * The recuperation *rate* is not here. It is confirmed before an export, the
 * way the minimum wage is, and stored with the month it valued (item 15) — so
 * it is a fact about a month rather than a term of the employment, and the
 * screen that asks it is the pre-export one.
 */
export function RecuperationControl({
  workerId,
  recuperationMonth,
  days,
  onSubmit,
}: {
  workerId: string;
  recuperationMonth: number;
  days: number;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.recuperation;
  const { refusal, fault, run, busyAt } = useAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="recuperationMonth" className="flex flex-wrap gap-2">
        {he.calendar.monthNames.map((name, index) => (
          <Chip
            key={name}
            selected={index + 1 === recuperationMonth}
            busy={busyAt(name)}
            onClick={() =>
              run(() => setRecuperationMonth(workerId, index + 1), undefined, name)
            }
          >
            <Bidi>{name}</Bidi>
          </Chip>
        ))}
      </div>
      {days > 0 ? (
        <p
          data-recuperation
          className="flex items-baseline gap-1.5 text-[13px] font-light text-ink-quiet"
        >
          <span dir="auto">{words.thisYear}</span>
          <Bidi noTranslate className="font-semibold">
            {formatDays(days)}
          </Bidi>
          <span dir="auto">{words.days}</span>
        </p>
      ) : (
        <p
          data-recuperation
          dir="auto"
          className="text-[13px] font-light text-ink-quiet"
        >
          {words.notYet}
        </p>
      )}
      {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
    </TermRow>
  );
}


/**
 * Their base salary, and a change of it from a month the family names (specs.md
 * item 3).
 *
 * **It shows the salary in force this month**, which is not the profile's
 * opening figure once a raise is recorded, and lists every change beside the
 * month it holds from — a raise already agreed for next month is listed before
 * it takes effect, so nobody records it twice.
 *
 * The amount and the month are sent as typed. What counts as a month and where
 * the floor sits are the server's (`reviewSalaryChange`), so nothing here
 * compares against a minimum wage — **except to say so**: item 3 asks the
 * application to tell the user when the salary on the profile sits below the
 * minimum in force and to leave the decision to them, which is the sentence
 * under the figure and the control that fills the field with that minimum. It
 * fills and does not save: the month the raise holds from is theirs to name,
 * and the server reviews it as it reviews any other.
 */
export function SalaryControl({
  workerId,
  profile,
  month,
  minimumWageAgorot,
  onSubmit,
}: {
  workerId: string;
  profile: WorkerProfile;
  /** This month, passed in because nothing reads a clock during a render. */
  month: YearMonth;
  /** The minimum wage in force this month, or `null` where the table holds
   * none for it — then nothing is said, rather than a figure guessed. */
  minimumWageAgorot: number | null;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.salary;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("");
  const { refusal, fault, run, clear, saving } = useAction(onSubmit);
  const changes = profile.salaryChanges ?? [];
  const inForce = salaryFor(profile, month);
  const belowMinimum =
    minimumWageAgorot !== null && inForce < minimumWageAgorot;

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="salary" className="flex flex-col gap-2.5">
        <span className="flex flex-wrap items-baseline gap-1.5 text-[15px]">
          <span dir="auto" className="font-light text-ink-mute">
            {words.now}
          </span>
          <Bidi noTranslate className="font-semibold">
            {formatAgorot(inForce)}
          </Bidi>
        </span>

        {/* Item 3's statement, and the offer beside it. Not a refusal: nothing
            was refused, and the salary is theirs to leave where it is. */}
        {belowMinimum ? (
          <div
            data-salary-below-minimum=""
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <p
              dir="auto"
              className="text-[13px] leading-[1.5] font-light text-clay-deep text-pretty"
            >
              <span>{words.below.before}</span>
              <Bidi noTranslate>{formatAgorot(minimumWageAgorot)}</Bidi>
              <span>{words.below.after}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setAmount(amountFieldValue(minimumWageAgorot));
                clear();
              }}
              className={`${quietButtonClass} text-forest hover:text-forest-deep`}
            >
              <span dir="auto">{words.takeMinimum}</span>
            </button>
          </div>
        ) : null}

        {changes.length === 0 ? null : (
          <ul className="flex flex-col gap-1 text-[13px] font-light text-ink-quiet">
            {changes.map((change) => (
              <li
                key={`${change.from.year}-${change.from.month}`}
                data-salary-change={`${change.from.year}-${String(change.from.month).padStart(2, "0")}`}
                className={[
                  "flex flex-wrap items-baseline gap-1.5",
                  compareMonth(change.from, month) > 0 ? "text-ink-mute" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span dir="auto">{words.changedFrom}</span>
                <Bidi>{monthLabel(change.from)}</Bidi>
                <Bidi noTranslate className="font-medium">
                  {formatAgorot(change.agorot)}
                </Bidi>
              </li>
            ))}
          </ul>
        )}

        {open ? (
          /* One line and never wrapped: the two inputs and the two buttons are
             one gesture, and each field shrinks instead of dropping to a line of
             its own (`DESIGN.md`). The bottom padding is the room the month's
             floated hint no longer takes for itself. */
          <div className="flex min-w-0 items-end gap-2 pb-5 sm:gap-3">
            <Field label={words.amount} className="max-w-40 flex-1 basis-24">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  // The refusal was about the figure being corrected, so it goes
                  // the moment the figure does — or the user reads a sentence
                  // about an amount that is no longer on screen.
                  clear();
                }}
                dir="ltr"
                className={`${inputClass} text-start`}
              />
            </Field>
            <Field
              label={words.from}
              hint={words.fromHint}
              hintFloats
              className="max-w-32 flex-1 basis-20"
            >
              <input
                type="text"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  clear();
                }}
                placeholder={yearMonthText(addMonths(month, 1))}
                dir="ltr"
                className={`${inputClass} text-start`}
              />
            </Field>
            {/* The two buttons in a box of their own, centred on the line the
                inputs make: the quiet one's touch padding hangs below its own
                text, so aligned on the row itself its words sit 8px under the
                save beside it. */}
            <div className="flex flex-none items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  run(() => setSalaryChange(workerId, amount, from), () => {
                    setOpen(false);
                    setAmount("");
                    setFrom("");
                  })
                }
                {...busyAttrs(saving, buttonClass)}
              >
                <span dir="auto">{words.save}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  clear();
                }}
                className={quietButtonClass}
              >
                <span dir="auto">{words.cancel}</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${buttonClass} self-start`}
          >
            <span dir="auto">{words.change}</span>
          </button>
        )}
        {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
      </div>
    </TermRow>
  );
}

/**
 * Who the medical-insurance premium is paid through (specs.md item 16).
 *
 * **It is a field because a template may carry no family's details** (Part 3):
 * the sentence in cell `B10` of both month templates names the insurer through
 * this value.
 *
 * Saved on a press and not on every keystroke, like the documents beside it: a
 * name is typed in pieces, and a store written on each of them would record a
 * dozen half-written insurers for the one that was meant.
 */
export function InsurerControl({
  workerId,
  insurer,
  onSubmit,
}: {
  workerId: string;
  insurer: string;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.insurer;
  const [value, setValue] = useState(insurer);
  const { refusal, fault, run, saving } = useAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      {(labelId) => (
        <div data-terms="insurer" className="flex flex-col gap-2.5">
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={words.placeholder}
            aria-labelledby={labelId}
            dir="auto"
            className={inputClass}
          />
          {/* specs.md items 16 and 24: the help screen points at an answer and
              never writes one, so the only topic with no screen of its own is
              settled here, beside the field. */}
          <p
            dir="auto"
            data-role="insurer-deduction"
            className="max-w-prose text-[14px] font-light text-ink-mute text-pretty"
          >
            {words.deduction}
          </p>
          <RuleLink rule="medicalInsurance" className="self-start text-[14px]" />
          {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
          <button
            type="button"
            onClick={() => run(() => setInsurer(workerId, value))}
            disabled={value.trim() === insurer}
            {...busyAttrs(saving, `${buttonClass} self-start`)}
          >
            <span dir="auto">{words.save}</span>
          </button>
        </div>
      )}
    </TermRow>
  );
}

/**
 * The three documents and their expiry dates (specs.md item 28).
 *
 * **Three separate documents with three separate dates, and they are not one
 * thing under different names.** The employment permit belongs to the employer
 * and is renewed by the employer's own application; the work visa belongs to
 * the worker and is renewed through the agency against a fee; the passport is
 * the one the employer must check stays valid, and its threshold is eighteen
 * months remaining rather than expiry — which the hint says outright, because a
 * user reading only the date would act eighteen months late.
 *
 * **The dates are here and the numbers are not.** Each number has a row of its
 * own (`IdentifyingNumberControl`) and is encrypted at rest (item 22); the
 * dates stay plain because the warnings have to query them.
 */
export function DocumentsControl({
  workerId,
  documents,
  onSubmit,
}: {
  workerId: string;
  documents: WorkerProfile["documents"];
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.documents;
  const [permit, setPermit] = useState(documents.employmentPermitExpiry ?? "");
  const [visa, setVisa] = useState(documents.workVisaExpiry ?? "");
  const [passport, setPassport] = useState(documents.passportExpiry ?? "");
  const { refusal, fault, run, saving } = useAction(onSubmit);

  return (
    <TermRow label={words.title} hint={words.note}>
      <div data-terms="documents" className="flex flex-col gap-2.5">
        <DateField
          label={words.employmentPermit}
          hint={words.employmentPermitHint}
          value={permit}
          onChange={setPermit}
          stored={documents.employmentPermitExpiry}
        />
        <DateField
          label={words.workVisa}
          hint={words.workVisaHint}
          value={visa}
          onChange={setVisa}
          stored={documents.workVisaExpiry}
        />
        <DateField
          label={words.passport}
          hint={words.passportHint}
          value={passport}
          onChange={setPassport}
          stored={documents.passportExpiry}
        />
        {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
        <button
          type="button"
          onClick={() =>
            run(() =>
              setDocuments(workerId, {
                employmentPermitExpiry: permit,
                workVisaExpiry: visa,
                passportExpiry: passport,
              }),
            )
          }
          {...busyAttrs(saving, `${buttonClass} self-start`)}
        >
          <span dir="auto">{words.save}</span>
        </button>
      </div>
    </TermRow>
  );
}

/**
 * One of the four identifying numbers (specs.md items 22 and 28).
 *
 * **It is opened on the server and rendered as text**, which is the whole of
 * what item 22 permits: decrypted server-side for display and for the export,
 * and never logged. What reaches this component is the number itself, because
 * this is the screen that shows it; nothing else in the application receives
 * one, and `WorkerProfile` — the object the switcher, the engine and every
 * other screen pass around — carries none.
 *
 * **`translate="no"` and `dir="ltr"`, like every identifier here.** A
 * translated identifier is a wrong identifier, and a passport number is Latin
 * and digits inside a Hebrew line.
 *
 * **One control for all four** — the passport, the work visa, the employment
 * permit and the bank account — because they are one mechanism with four
 * labels: sealed on the way in, opened on the server for this screen, and never
 * carried on the profile.
 */
export function IdentifyingNumberControl({
  workerId,
  name,
  number,
  onSubmit,
}: {
  workerId: string;
  name: keyof IdentifyingNumbers;
  number: string | null;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms[numberWords[name]];
  const [typed, setTyped] = useState(number ?? "");
  const { refusal, fault, run, saving } = useAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      {(labelId) => (
        <div data-terms={`${name}Number`} className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            aria-labelledby={labelId}
            dir="ltr"
            translate="no"
            autoComplete="off"
            data-field={`${name}Number`}
            className={`${inputClass} max-w-48 text-start`}
          />
          <span className="text-[13px] font-light text-ink-quiet">
            {number === null ? (
              <span dir="auto">{words.none}</span>
            ) : (
              <Bidi noTranslate>{number}</Bidi>
            )}
          </span>
          <button
            type="button"
            onClick={() => run(() => setIdentifyingNumber(workerId, name, typed))}
            {...busyAttrs(saving, buttonClass)}
          >
            <span dir="auto">{words.save}</span>
          </button>
          {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
        </div>
      )}
    </TermRow>
  );
}

/**
 * When the employment began. Sent as typed in the shape the store holds, with
 * the stored date written out beside the field, as the documents' dates are.
 */
export function EmployedSinceControl({
  workerId,
  gender,
  employedSince,
  firstMonth,
  onSubmit,
}: {
  workerId: string;
  /** The hint and the refusal both name their first month in the application,
   * and agree with them (`he.workerWords`). */
  gender: Gender;
  employedSince: string;
  firstMonth: YearMonth;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.employedSince;
  const [typed, setTyped] = useState(employedSince);
  const { refusal, fault, run, saving } = useAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint(gender)}>
      {(labelId) => (
        <div data-terms="employedSince" className="flex flex-wrap items-center gap-2.5">
          <DateInput value={typed} onChange={setTyped} labelledBy={labelId} />
          <Bidi className="text-[13px] font-light text-ink-quiet">
            {fullDayLabel(employedSince)}
          </Bidi>
          <button
            type="button"
            onClick={() => run(() => setEmployedSince(workerId, typed))}
            disabled={typed.trim() === employedSince}
            {...busyAttrs(saving, buttonClass)}
          >
            <span dir="auto">{words.save}</span>
          </button>
          {refusal === "employedSinceAfterFirstMonth" ? (
            <RefusalLine>
              <span>{words.afterFirstMonth.before}</span>
              <bdi>{monthLabel(firstMonth)}</bdi>
              <span>{words.afterFirstMonth.after(gender)}</span>
            </RefusalLine>
          ) : refusal ? (
            <Refusal reason={refusal} />
          ) : fault ? (
            <FaultLine />
          ) : null}
        </div>
      )}
    </TermRow>
  );
}

/** Where each number's words are kept. */
const numberWords = {
  passport: "passportNumber",
  workVisa: "workVisaNumber",
  employmentPermit: "employmentPermitNumber",
  bankAccount: "bankAccountNumber",
} as const satisfies Record<keyof IdentifyingNumbers, string>;

/**
 * The weekly rest-eve supplement (specs.md item 14) — an agreed term the family
 * changes or stops when the agreement does. Sent as typed; an empty field is
 * zero, and what counts as an amount is the server's.
 */
export function RestEveSupplementControl({
  workerId,
  gender,
  agorot,
  onSubmit,
}: {
  workerId: string;
  /** The hint asks whether they worked that evening, and agrees with them
   * (`he.workerWords`). */
  gender: Gender;
  agorot: number;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.restEveSupplement;
  const stored = agorot === 0 ? "" : amountFieldValue(agorot);
  const [typed, setTyped] = useState(stored);
  const { refusal, fault, run, saving } = useAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint(gender)}>
      {(labelId) => (
        <div data-terms="restEveSupplement" className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            inputMode="decimal"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            aria-labelledby={labelId}
            dir="ltr"
            translate="no"
            className={`${inputClass} max-w-40 text-start`}
          />
          <Bidi noTranslate className="text-[13px] font-light text-ink-quiet">
            {formatAgorot(agorot)}
          </Bidi>
          <button
            type="button"
            onClick={() => run(() => setRestEveSupplement(workerId, typed))}
            disabled={typed.trim() === stored}
            {...busyAttrs(saving, buttonClass)}
          >
            <span dir="auto">{words.save}</span>
          </button>
          {refusal ? <Refusal reason={refusal} /> : fault ? <FaultLine /> : null}
        </div>
      )}
    </TermRow>
  );
}

/**
 * One document's expiry date, with the date it currently holds written out
 * beside the field.
 *
 * The field takes the ISO form because that is what the store holds and what
 * refuses 2026-02-30 without a parser guessing what the user meant; the written
 * date beside it is the same value in the words the rest of the application
 * uses, so nobody has to read an ISO date to know what is stored.
 */
/** A date typed in the profile's one format, left to right.
 *
 * `labelledBy` is passed only where the field stands alone under a `TermRow`
 * heading. Inside a `Field` the wrapping label already names it. */
function DateInput({
  value,
  onChange,
  labelledBy,
}: {
  value: string;
  onChange: (next: string) => void;
  labelledBy?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={he.workers.profile.terms.documents.format}
      aria-labelledby={labelledBy}
      dir="ltr"
      className={`${inputClass} max-w-44 text-start`}
    />
  );
}

function DateField({
  label,
  hint,
  value,
  onChange,
  stored,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
  stored: string | null;
}) {
  const words = he.workers.profile.terms.documents;
  return (
    <Field label={label} hint={hint}>
      <span className="flex flex-wrap items-center gap-2.5">
        <DateInput value={value} onChange={onChange} />
        <span className="text-[13px] font-light text-ink-quiet">
          {stored === null ? (
            <span dir="auto">{words.none}</span>
          ) : (
            <Bidi>{fullDayLabel(stored)}</Bidi>
          )}
        </span>
      </span>
    </Field>
  );
}
