"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createWorker, type CreateWorkerRefusal } from "@/app/workers/actions";
import { LogoMark } from "@/components/icons";
import type { Country } from "@/lib/holidaySources";
import {
  DoneStep,
  draftGender,
  monthNumberOf,
  PayStep,
  Progress,
  WhenStep,
  WhoStep,
  wizardPlan,
} from "@/components/AddWorkerSteps";
import {
  yearMonthText,
} from "@/lib/dates";

import {
  restDayChoices,
  reviewNewWorker,
  type NewWorkerDraft,
  type NewWorkerRefusal,
} from "@/lib/engine/profile";
import type { IsoDate } from "@/lib/types";
import { he } from "@/lib/i18n/he";
import { amountFieldValue } from "@/lib/money";

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

/** How many steps there are, and which field belongs to which. A refusal names
 * a field, and the wizard has to know whether that field is behind the user or
 * ahead of them: at step 1 an empty salary is not yet a mistake. */
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
  /** Why the save was refused, or none. The reason is kept and not a flag,
   * because a full household is refused for something no field says. */
  const [saveRefusal, setSaveRefusal] = useState<CreateWorkerRefusal | null>(
    null,
  );

  const [draft, setDraft] = useState<NewWorkerDraft>(() => ({
    name: "",
    gender: "female",
    passportNumber: "",
    // **Empty, and not the first country on the list.** It is what their holiday
    // list is drawn from, so a country nobody chose would be saved as an
    // answer; `reviewNewWorker` refuses an empty one and the step says so.
    country: "",
    employedSince: "",
    restDay: restDayChoices.find((day) => day === 6) ?? restDayChoices[0],
    recuperationMonth: "7",
    // The salary opens at the minimum wage, which is what item 3 makes the
    // default rather than an empty field the family has to look a figure up
    // for. It may be raised and may not be lowered.
    baseMonthlySalary: amountFieldValue(minimumWageAgorot),
    restEveSupplement: "",
    insurer: "",
    incomeTaxMode: "automatic",
    incomeTaxPercentage: "",
    firstMonth: "",
    // Zero opens every count, as on their page: a family with nothing accrued
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
    setSaveRefusal(null);
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
        setSaveRefusal(saved.reason);
        // A full household belongs to no step: there is no field to go back to
        // and no edit that would help, so the wizard stays where it is and the
        // sentence below says why.
        if (saved.reason !== "householdFull") setStep(STEP_OF[saved.reason]);
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
          {step === LAST_STEP ? <DoneStep headingRef={heading} workerId={workerId} gender={draftGender(draft.gender)} /> : null}

          {saveRefusal !== null ? (
            <p
              dir="auto"
              role="alert"
              data-role="add-worker-error"
              className="rounded-card-sm bg-chip px-3.5 py-2.5 text-[15px] text-clay-deep"
            >
              {saveRefusal === "householdFull"
                ? words.errors.householdFull
                : words.errors.save}
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
