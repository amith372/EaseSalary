"use client";

/**
 * The terms of one worker's employment, each with the control that changes it —
 * the rows of `EaseSalary - הגדרות`.
 *
 * **They are drawn on `/settings` and nowhere else** (the user, 2026-09-13). They
 * were built on the worker's own page on 2026-09-09, while `/settings` did not
 * exist, and moved here when it did, so a term is changed in exactly one place.
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
import { useState, type ReactNode } from "react";
import {
  addOpeningAdvance,
  addStandingLine,
  removeOpeningAdvance,
  setDocuments,
  setInsurer,
  setOpeningDays,
  setGender,
  setIdentifyingNumber,
  setRestEveSupplement,
  setEmployedSince,
  setIncomeTaxSetting,
  setRecuperationMonth,
  setRestDay,
  setSalaryChange,
  stopStandingLine,
  updateStandingLine,
  type ProfileActionRefusal,
  type ProfileActionResult,
} from "@/app/workers/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Field, inputClass } from "@/components/Field";
import { MoneyValue } from "@/components/MoneyValue";
import { fullDayLabel, monthLabel } from "@/lib/dateLabels";
import { addMonths, compareMonth, yearMonthText } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import type { YearMonth } from "@/lib/types";
import { restDayChoices } from "@/lib/engine/profile";
import type { WorkerProfile } from "@/lib/engine/repository";
import {
  defaultPlacementFor,
  genders,
  incomeTaxModes,
  placementOf,
  userLineDirections,
  userLinePlacements,
} from "@/lib/engine/types";
import type {
  Gender,
  IncomeTaxMode,
  IncomeTaxSetting,
  UserLine,
  UserLineDirection,
  UserLinePlacement,
} from "@/lib/engine/types";
import { salaryFor } from "@/lib/engine/salary";
import { he } from "@/lib/i18n/he";
import type { IdentifyingNumbers } from "@/lib/identifyingNumbers";
import { formatAgorot, formatDays, formatPercent } from "@/lib/money";


/**
 * The way in to `בחירת חגים` (`build_plan.md` stage 5).
 *
 * It is reached from `הגדרות`, as the artboard draws it; the home screen's
 * alert, the other way in, is stage 6's.
 *
 * It shows what is chosen against what she has, because "an incomplete
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


export function TermRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5 border-t border-line-soft py-4 first:border-t-0 sm:py-4.5">
      <div className="flex flex-col gap-0.5">
        <h3 dir="auto" className="text-[15px] font-semibold">
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
      {children}
    </section>
  );
}

const buttonClass =
  "rounded-card-sm bg-forest px-3.5 py-2 text-[14px] font-semibold text-surface transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50";

/** A bare text action. The padding widens what a finger can hit to about 44px
 * and the negative margin gives the space back, so the row keeps its layout. */
const quietButtonClass =
  "-mx-1 -my-3 px-1 py-3 text-[14px] font-medium text-ink-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

/** What the refusal was, as a sentence. Never a code: a refusal carries the
 * reason it was refused (specs.md item 25). */
function Refusal({ reason }: { reason: ProfileActionRefusal }) {
  // A sentence that names the worker's first month is written by the one
  // control that holds it (`EmployedSinceControl`), and no other control is
  // refused for that reason.
  if (reason === "employedSinceAfterFirstMonth") return null;
  return <RefusalLine>{he.workers.profile.terms.refused[reason]}</RefusalLine>;
}

function RefusalLine({ children }: { children: ReactNode }) {
  return (
    /* `role="alert"` rather than `aria-live`: the paragraph is mounted with its
       sentence already in it, and a live region is only announced reliably
       when its content changes after it exists. */
    <p
      role="alert"
      dir="auto"
      className="text-[13px] leading-[1.5] font-light text-clay-deep text-pretty"
    >
      {children}
    </p>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p dir="auto" className="text-[14px] font-light text-ink-quiet">
      {children}
    </p>
  );
}

type Submit = (
  action: () => Promise<ProfileActionResult>,
  onResult: (result: ProfileActionResult) => void,
) => void;

/** A change on its way to the store and the refusal it may come back with —
 * `MonthActions`'s own shape, and it holds no rule for the same reason. */
function useProfileAction(onSubmit: Submit) {
  const [refusal, setRefusal] = useState<ProfileActionRefusal | null>(null);

  function run(action: () => Promise<ProfileActionResult>, onDone?: () => void) {
    setRefusal(null);
    onSubmit(action, (result) => {
      if (result.ok) onDone?.();
      else setRefusal(result.reason);
    });
  }

  return { refusal, run, clear: () => setRefusal(null) };
}

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
  const { refusal, run } = useProfileAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="restDay" className="flex flex-wrap gap-2">
        {restDayChoices.map((day) => (
          <Chip
            key={day}
            selected={day === restDay}
            onClick={() => run(() => setRestDay(workerId, day))}
          >
            <Bidi>{words.day(day)}</Bidi>
          </Chip>
        ))}
      </div>
      <p dir="auto" className="text-[13px] font-light text-ink-quiet">
        {words.eveNote(restDay)}
      </p>
      {refusal ? <Refusal reason={refusal} /> : null}
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
  const { refusal, run } = useProfileAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="gender" className="flex flex-wrap gap-2">
        {genders.map((choice) => (
          <Chip
            key={choice}
            selected={choice === gender}
            onClick={() => run(() => setGender(workerId, choice))}
          >
            <Bidi>{words[choice]}</Bidi>
          </Chip>
        ))}
      </div>
      {refusal ? <Refusal reason={refusal} /> : null}
    </TermRow>
  );
}

/**
 * How this worker's income tax is arrived at (specs.md item 17, settled with
 * the user on 2026-09-11).
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
  const { refusal, run } = useProfileAction(onSubmit);
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
      run(() => setIncomeTaxSetting(workerId, next, ""));
    }
  }

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="incomeTax" className="flex flex-wrap gap-2">
        {incomeTaxModes.map((choice) => (
          <Chip
            key={choice}
            selected={choice === mode}
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
            run(() => setIncomeTaxSetting(workerId, "percentage", rate));
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
            className="flex-none rounded-full border border-line bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
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
      {refusal ? <Refusal reason={refusal} /> : null}
    </TermRow>
  );
}

/**
 * The month the recuperation payment falls in, and the days it will pay
 * (specs.md item 15).
 *
 * **The user chooses the month and never the days.** The entitlement follows
 * from her seniority and is reported beside the choice rather than offered as
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
  const { refusal, run } = useProfileAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="recuperationMonth" className="flex flex-wrap gap-2">
        {he.calendar.monthNames.map((name, index) => (
          <Chip
            key={name}
            selected={index + 1 === recuperationMonth}
            onClick={() => run(() => setRecuperationMonth(workerId, index + 1))}
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
      {refusal ? <Refusal reason={refusal} /> : null}
    </TermRow>
  );
}

/**
 * The lines set once on the profile that appear in every month afterwards
 * (specs.md item 20).
 *
 * **This is the one case that makes step 8's override/edit division necessary
 * rather than tidy.** A standing line's amount came from the profile, so a
 * month that paid something else says so with an override — `overridable:
 * prefix === "standing"` — while a line typed into a month is corrected where
 * it was typed. Until a standing line could be set, that flag had one reachable
 * value.
 *
 * The panel is the one `/payments` uses for a one-off line, and deliberately:
 * the three choices are the line's and not the month's, so a second panel would
 * be a second place for the placement rule to drift. What differs is the verb —
 * a standing line is *stopped* rather than removed, because stopping it leaves
 * every month it already appeared in exactly as it was.
 */
export function StandingLinesControl({
  workerId,
  standingLines,
  onSubmit,
}: {
  workerId: string;
  standingLines: UserLine[];
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.standing;
  const lineWords = he.month.actions.lines;
  const [open, setOpen] = useState<"new" | string | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [direction, setDirection] = useState<UserLineDirection>("addition");
  const [chosen, setChosen] = useState<UserLinePlacement | null>(null);
  const { refusal, run, clear } = useProfileAction(onSubmit);

  const placement = chosen ?? defaultPlacementFor(direction);

  function reset() {
    setOpen(null);
    setLabel("");
    setAmount("");
    setNote("");
    setDirection("addition");
    setChosen(null);
    clear();
  }

  function openEdit(line: UserLine) {
    clear();
    setOpen(line.id);
    setLabel(line.label);
    setAmount(formatAgorot(line.agorot));
    setNote(line.note ?? "");
    setDirection(line.direction);
    // Set rather than left to follow the direction: what is stored is what she
    // chose, and a panel reopened to fix a typo must not move the line.
    setChosen(placementOf(line));
  }

  function submit() {
    if (open === null) return;
    const draft = { label, amount, direction, placement, note };
    run(
      () =>
        open === "new"
          ? addStandingLine(workerId, draft)
          : updateStandingLine(workerId, open, draft),
      reset,
    );
  }

  const panel = (
    <Card
      tone="inset"
      radius="panel"
      as="form"
      className="mt-1 flex flex-col gap-2.5 px-3.5 py-3"
    >
      <Field label={lineWords.label} hint={lineWords.labelHint}>
        <input
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          dir="auto"
          className={inputClass}
        />
      </Field>

      <Field label={lineWords.amount}>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={he.placeholder.amountInput}
          dir="ltr"
          className={`${inputClass} text-start`}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        {userLineDirections.map((value) => (
          <Chip
            key={value}
            selected={value === direction}
            onClick={() => setDirection(value)}
          >
            <Bidi>{lineWords.direction[value]}</Bidi>
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {userLinePlacements.map((value) => (
          <Chip
            key={value}
            selected={value === placement}
            onClick={() => setChosen(value)}
          >
            <Bidi>{lineWords.placement[value]}</Bidi>
          </Chip>
        ))}
      </div>

      <Field label={lineWords.note} hint={lineWords.noteHint}>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          dir="auto"
          className={inputClass}
        />
      </Field>

      {refusal ? <Refusal reason={refusal} /> : null}

      <div className="flex items-center gap-3">
        <button type="button" onClick={submit} className={buttonClass}>
          <span dir="auto">
            {open === "new" ? lineWords.submit : lineWords.save}
          </span>
        </button>
        <button type="button" onClick={reset} className={quietButtonClass}>
          <span dir="auto">{he.workers.profile.terms.cancel}</span>
        </button>
      </div>
    </Card>
  );

  return (
    <TermRow label={words.title} hint={words.hint}>
      <div data-terms="standing" className="flex flex-col gap-2">
        {standingLines.length === 0 ? (
          <Empty>{words.empty}</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {standingLines.map((line) => (
              <li key={line.id} className="flex flex-col">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-[15px] font-medium">
                    <Bidi>{line.label}</Bidi>
                  </span>
                  <span className="flex items-baseline gap-3">
                    <MoneyValue
                      agorot={
                        line.direction === "addition"
                          ? line.agorot
                          : -line.agorot
                      }
                    />
                    <button
                      type="button"
                      onClick={() => openEdit(line)}
                      aria-label={words.editLabel(line.label)}
                      className={quietButtonClass}
                    >
                      <span dir="auto">{words.edit}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => run(() => stopStandingLine(workerId, line.id))}
                      aria-label={words.stopLabel(line.label)}
                      className={quietButtonClass}
                    >
                      <span dir="auto">{words.stop}</span>
                    </button>
                  </span>
                </div>
                {open === line.id ? panel : null}
              </li>
            ))}
          </ul>
        )}

        {open === "new" ? (
          panel
        ) : (
          <button
            type="button"
            onClick={() => {
              clear();
              setOpen("new");
            }}
            className="self-start text-[14px] font-medium text-forest hover:underline hover:underline-offset-4"
          >
            <span dir="auto">{words.add}</span>
          </button>
        )}

        {open === null && refusal ? <Refusal reason={refusal} /> : null}
      </div>
    </TermRow>
  );
}

/**
 * The opening position — what was already accrued and what was already owed
 * when the application took over an employment already running (specs.md item
 * 6).
 *
 * **Changing it moves every month at once, and the hint says so before the
 * fact.** Balances are never stored: they are replayed from here (item 13), so
 * a corrected opening position moves every later month's balances by the same
 * mechanism that makes a corrected past month move them. That is the correct
 * behaviour rather than a hazard to guard against — what would be wrong is for
 * it to happen silently, which is why the sentence is beside the field and not
 * behind a "?".
 *
 * **An advance is refused a removal while a month still repays it**, which is
 * checked on the server against the whole ledger: taking the debt out from
 * under a repayment would leave repayments of a debt that never existed.
 */
export function OpeningPositionControl({
  workerId,
  profile,
  onSubmit,
}: {
  workerId: string;
  profile: WorkerProfile;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.opening;
  const opening = profile.openingPosition;
  // Shown to two places (Part 5: days are rounded only for display). A field
  // saved as shown sends the stored figure back, so the rounding never reaches
  // the balance.
  const shownVacation = formatDays(opening.vacationDays);
  const shownSick = formatDays(opening.sickDays);
  const [vacation, setVacation] = useState(shownVacation);
  const [sick, setSick] = useState(shownSick);
  const [adding, setAdding] = useState(false);
  const [principal, setPrincipal] = useState("");
  const [repaid, setRepaid] = useState("");
  const [note, setNote] = useState("");
  const { refusal, run, clear } = useProfileAction(onSubmit);

  function closeAdd() {
    setAdding(false);
    setPrincipal("");
    setRepaid("");
    setNote("");
    clear();
  }

  return (
    <TermRow label={words.title} hint={words.hint}>
      <div data-terms="opening" className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={words.vacation}>
            <input
              type="text"
              inputMode="decimal"
              value={vacation}
              onChange={(event) => setVacation(event.target.value)}
              dir="ltr"
              className={`${inputClass} text-start`}
            />
          </Field>
          <Field label={words.sick}>
            <input
              type="text"
              inputMode="decimal"
              value={sick}
              onChange={(event) => setSick(event.target.value)}
              dir="ltr"
              className={`${inputClass} text-start`}
            />
          </Field>
          <button
            type="button"
            onClick={() =>
              run(() =>
                setOpeningDays(workerId, {
                  vacationDays:
                    vacation === shownVacation ? String(opening.vacationDays) : vacation,
                  sickDays: sick === shownSick ? String(opening.sickDays) : sick,
                }),
              )
            }
            className={buttonClass}
          >
            <span dir="auto">{words.save}</span>
          </button>
        </div>

        {opening.advances.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {opening.advances.map((advance) => (
              <li
                key={advance.number}
                data-opening-advance={advance.number}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
              >
                <span className="text-[15px] font-medium">
                  <Bidi>{he.month.actions.advances.name(advance.number)}</Bidi>
                </span>
                <span className="flex items-baseline gap-3">
                  <MoneyValue agorot={advance.principalAgorot} />
                  <button
                    type="button"
                    onClick={() =>
                      run(() => removeOpeningAdvance(workerId, advance.number))
                    }
                    aria-label={words.removeLabel(advance.number)}
                    className={quietButtonClass}
                  >
                    <span dir="auto">{words.remove}</span>
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {adding ? (
          <Card
            tone="inset"
            radius="panel"
            as="form"
            className="flex flex-col gap-2.5 px-3.5 py-3"
          >
            <Field label={words.principal}>
              <input
                type="text"
                inputMode="decimal"
                value={principal}
                onChange={(event) => setPrincipal(event.target.value)}
                placeholder={he.placeholder.amountInput}
                dir="ltr"
                className={`${inputClass} text-start`}
              />
            </Field>
            <Field label={words.repaid} hint={words.repaidHint}>
              <input
                type="text"
                inputMode="decimal"
                value={repaid}
                onChange={(event) => setRepaid(event.target.value)}
                placeholder={he.placeholder.amountInput}
                dir="ltr"
                className={`${inputClass} text-start`}
              />
            </Field>
            <Field label={words.note}>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                dir="auto"
                className={inputClass}
              />
            </Field>
            {refusal ? <Refusal reason={refusal} /> : null}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  run(
                    () =>
                      addOpeningAdvance(workerId, { principal, repaid, note }),
                    closeAdd,
                  )
                }
                className={buttonClass}
              >
                <span dir="auto">{words.submit}</span>
              </button>
              <button type="button" onClick={closeAdd} className={quietButtonClass}>
                <span dir="auto">{he.workers.profile.terms.cancel}</span>
              </button>
            </div>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => {
              clear();
              setAdding(true);
            }}
            className="self-start text-[14px] font-medium text-forest hover:underline hover:underline-offset-4"
          >
            <span dir="auto">{words.addAdvance}</span>
          </button>
        )}

        {!adding && refusal ? <Refusal reason={refusal} /> : null}
      </div>
    </TermRow>
  );
}

/**
 * Her base salary, and a change of it from a month the family names (specs.md
 * item 3; the user, 2026-09-13).
 *
 * **It shows the salary in force this month**, which is not the profile's
 * opening figure once a raise is recorded, and lists every change beside the
 * month it holds from — a raise already agreed for next month is listed before
 * it takes effect, so nobody records it twice.
 *
 * The amount and the month are sent as typed. What counts as a month and where
 * the floor sits are the server's (`reviewSalaryChange`), so nothing here
 * compares against a minimum wage.
 */
export function SalaryControl({
  workerId,
  profile,
  month,
  onSubmit,
}: {
  workerId: string;
  profile: WorkerProfile;
  /** This month, passed in because nothing reads a clock during a render. */
  month: YearMonth;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.salary;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("");
  const { refusal, run, clear } = useProfileAction(onSubmit);
  const changes = profile.salaryChanges ?? [];

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="salary" className="flex flex-col gap-2.5">
        <span className="flex flex-wrap items-baseline gap-1.5 text-[15px]">
          <span dir="auto" className="font-light text-ink-mute">
            {words.now}
          </span>
          <Bidi noTranslate className="font-semibold">
            {formatAgorot(salaryFor(profile, month))}
          </Bidi>
        </span>

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
          <div className="flex flex-wrap items-end gap-3">
            <Field label={words.amount}>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                dir="ltr"
                className={`${inputClass} max-w-40 text-start`}
              />
            </Field>
            <Field label={words.from} hint={words.fromHint}>
              <input
                type="text"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                placeholder={yearMonthText(addMonths(month, 1))}
                dir="ltr"
                className={`${inputClass} max-w-32 text-start`}
              />
            </Field>
            <button
              type="button"
              onClick={() =>
                run(() => setSalaryChange(workerId, amount, from), () => {
                  setOpen(false);
                  setAmount("");
                  setFrom("");
                })
              }
              className={buttonClass}
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
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${buttonClass} self-start`}
          >
            <span dir="auto">{words.change}</span>
          </button>
        )}
        {refusal ? <Refusal reason={refusal} /> : null}
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
  const { refusal, run } = useProfileAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="insurer" className="flex flex-col gap-2.5">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={words.placeholder}
          dir="auto"
          className={inputClass}
        />
        {refusal ? <Refusal reason={refusal} /> : null}
        <button
          type="button"
          onClick={() => run(() => setInsurer(workerId, value))}
          disabled={value.trim() === insurer}
          className={`${buttonClass} self-start`}
        >
          <span dir="auto">{words.save}</span>
        </button>
      </div>
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
  const { refusal, run } = useProfileAction(onSubmit);

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
        {refusal ? <Refusal reason={refusal} /> : null}
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
          className={`${buttonClass} self-start`}
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
  const passportNumber = number;
  const [typed, setTyped] = useState(passportNumber ?? "");
  const { refusal, run } = useProfileAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms={`${name}Number`} className="flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          dir="ltr"
          translate="no"
          autoComplete="off"
          data-field={`${name}Number`}
          className={`${inputClass} max-w-48 text-start`}
        />
        <span className="text-[13px] font-light text-ink-quiet">
          {passportNumber === null ? (
            <span dir="auto">{words.none}</span>
          ) : (
            <Bidi noTranslate>{passportNumber}</Bidi>
          )}
        </span>
        <button
          type="button"
          onClick={() => run(() => setIdentifyingNumber(workerId, name, typed))}
          className={buttonClass}
        >
          <span dir="auto">{words.save}</span>
        </button>
        {refusal ? <Refusal reason={refusal} /> : null}
      </div>
    </TermRow>
  );
}

/**
 * When the employment began. Sent as typed in the shape the store holds, with
 * the stored date written out beside the field, as the documents' dates are.
 */
export function EmployedSinceControl({
  workerId,
  employedSince,
  firstMonth,
  onSubmit,
}: {
  workerId: string;
  employedSince: string;
  firstMonth: YearMonth;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.employedSince;
  const [typed, setTyped] = useState(employedSince);
  const { refusal, run } = useProfileAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="employedSince" className="flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={he.workers.profile.terms.documents.format}
          dir="ltr"
          className={`${inputClass} max-w-44 text-start`}
        />
        <Bidi className="text-[13px] font-light text-ink-quiet">
          {fullDayLabel(employedSince)}
        </Bidi>
        <button
          type="button"
          onClick={() => run(() => setEmployedSince(workerId, typed))}
          disabled={typed.trim() === employedSince}
          className={buttonClass}
        >
          <span dir="auto">{words.save}</span>
        </button>
        {refusal === "employedSinceAfterFirstMonth" ? (
          <RefusalLine>
            <span>{words.afterFirstMonth.before}</span>
            <bdi>{monthLabel(firstMonth)}</bdi>
            <span>{words.afterFirstMonth.after}</span>
          </RefusalLine>
        ) : refusal ? (
          <Refusal reason={refusal} />
        ) : null}
      </div>
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
  agorot,
  onSubmit,
}: {
  workerId: string;
  agorot: number;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.restEveSupplement;
  const stored = agorot === 0 ? "" : (agorot / 100).toFixed(2);
  const [typed, setTyped] = useState(stored);
  const { refusal, run } = useProfileAction(onSubmit);

  return (
    <TermRow label={words.label} hint={words.hint}>
      <div data-terms="restEveSupplement" className="flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          inputMode="decimal"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
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
          className={buttonClass}
        >
          <span dir="auto">{words.save}</span>
        </button>
        {refusal ? <Refusal reason={refusal} /> : null}
      </div>
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
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={words.format}
          dir="ltr"
          className={`${inputClass} max-w-44 text-start`}
        />
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
