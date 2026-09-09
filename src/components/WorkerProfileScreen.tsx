"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import {
  addOpeningAdvance,
  addStandingLine,
  removeOpeningAdvance,
  setDocuments,
  setOpeningDays,
  setRecuperationMonth,
  setRestDay,
  stopStandingLine,
  updateStandingLine,
  type ProfileActionRefusal,
  type ProfileActionResult,
} from "@/app/workers/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MoneyValue } from "@/components/MoneyValue";
import { fullDayLabel, monthLabel } from "@/lib/dateLabels";
import type { RestDay } from "@/lib/dates";
import type { AdvanceStanding } from "@/lib/engine/advances";
import { restDayChoices } from "@/lib/engine/profile";
import type { WorkerProfile } from "@/lib/engine/repository";
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
import { formatAgorot, formatDays } from "@/lib/money";
import type { YearMonth } from "@/lib/types";

/**
 * The worker's own page — `EaseSalary - דף העובד`, and the four things that
 * were waiting on it (`build_plan.md` stage 4, step 9).
 *
 * **Its lower half departs from the artboard on purpose, and the departure is
 * written down rather than the artboard silently obeyed** (`CLAUDE.md`). The
 * artboard reads the worker and sends "פרטים והגדרות" to `הגדרות`, whose route
 * the plan splits between stages 3 and 5; the four things this step exists to
 * make settable would then have no screen at all, which is precisely how the
 * profile stayed unowned for four stages. So the terms are edited here, in the
 * `הגדרות` artboard's own row vocabulary — a label, the hint under it, the
 * value, and a control that changes it — and the header's link scrolls to that
 * section instead of leaving the page. Settled with the user on 2026-09-09.
 *
 * **Three things the artboard draws are not here.** The "צריך לטפל" hero card
 * and the months list's status badges name the month's four states, which are
 * Part 5's and which nothing can yet set; "לשתף עם בן/בת משפחה" is item 11's
 * invitation and belongs to stage 3. Each is an absence rather than an
 * invention, which is the choice `CLAUDE.md` rule 4 asks for.
 *
 * **The five identifying numbers are not here either, and that is the whole
 * reason the documents section holds dates alone** (items 22, 28): they are
 * encrypted at rest with a key held outside the database, there is no database,
 * and a field for one now would put a plaintext identifier into an in-memory
 * store.
 *
 * It holds no arithmetic. Every change goes to a server action which parses the
 * amount, checks the choices and writes through the store, and the page then
 * re-renders from what was saved (Part 3).
 */

/** One month as this screen lists it: which month it was, and what it came to.
 * No status, for the reason given above. */
export interface ProfileMonth {
  month: YearMonth;
  netAgorot: number | null;
}

interface WorkerProfileScreenProps {
  profile: WorkerProfile;
  months: ProfileMonth[];
  /** The calendar year the holiday row reports on, passed in because nothing
   * reads a clock during a render (`CLAUDE.md`). */
  year: number;
  /** Her holiday days chosen for that year and the entitlement they are drawn
   * against — the picker's own two figures (item 10), worked out on the server
   * so the row and the picker cannot disagree. */
  holidayDaysChosen: number;
  holidayAllowance: number;
  /** The days the recuperation payment of that same year will pay, worked out
   * on the server from her seniority (item 15). Zero before her first
   * employment year is out. */
  recuperationDays: number;
  /** Her closing balances after the last month the store holds — the replay's
   * own figures and not a second count (items 7, 13). */
  vacationDays: number;
  sickDays: number;
  /** What is still owed on each advance, walked from the opening position
   * across every month (item 20). */
  ledger: AdvanceStanding[];
}

const TERMS_ID = "terms";

export function WorkerProfileScreen({
  profile,
  months,
  year,
  holidayDaysChosen,
  holidayAllowance,
  recuperationDays,
  vacationDays,
  sickDays,
  ledger,
}: WorkerProfileScreenProps) {
  const words = he.workers;
  const page = words.profile;

  // A change reaches the store and the page re-renders from it, so nothing here
  // predicts what was saved. The screen dims while the round trip is in flight,
  // for the reason `/payments` does it: a stale figure that looks settled is
  // worse than one that says it is waiting.
  const [saving, startSaving] = useTransition();

  function handleAction(
    action: () => Promise<ProfileActionResult>,
    onResult: (result: ProfileActionResult) => void,
  ) {
    startSaving(async () => onResult(await action()));
  }

  const outstanding = ledger.reduce(
    (total, standing) => total + standing.outstandingAgorot,
    0,
  );
  const open = ledger.filter((standing) => standing.outstandingAgorot > 0);

  return (
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1
            dir="auto"
            className="text-[24px] leading-[1.2] font-bold tracking-[-0.02em]"
          >
            <Bidi>{profile.name}</Bidi>
          </h1>
          <p className="text-[15px] font-light text-ink-mute">
            <span dir="auto">{words.employedSince} </span>
            <Bidi>{fullDayLabel(profile.employedSince)}</Bidi>
            <span aria-hidden="true"> · </span>
            <span dir="auto">{words.country} </span>
            <Bidi noTranslate>{profile.country}</Bidi>
          </p>
        </div>
        {/* The artboard's "פרטים והגדרות", pointed at the section below rather
            than at `/settings`. */}
        <a
          href={`#${TERMS_ID}`}
          className="rounded-tab border border-line px-3.5 py-2 text-[15px] font-medium text-forest transition-colors hover:border-line-hover"
        >
          <span dir="auto">{page.terms.title}</span>
        </a>
      </div>

      <div
        aria-busy={saving}
        className={[
          "flex min-w-0 flex-col gap-2.5 transition-opacity",
          saving ? "opacity-60" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Card className="grid grid-cols-1 gap-x-6 gap-y-2 px-4.5 py-3.5 sm:grid-cols-3">
          <Balance
            label={he.home.balances.vacation}
            value={formatDays(vacationDays)}
            rowKey="vacation"
          />
          <Balance
            label={he.home.balances.sick}
            value={formatDays(sickDays)}
            rowKey="sick"
          />
          <Balance
            label={words.facts.advance}
            value={formatAgorot(outstanding)}
            rowKey="advance"
          />
        </Card>

        <Card className="flex min-w-0 flex-col gap-2 px-4.5 py-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 dir="auto" className="text-[17px] font-semibold">
              {page.months.title}
            </h2>
            {/* Said once above the column rather than on every row. */}
            <span dir="auto" className="text-[13px] font-light text-ink-quiet">
              {page.months.total}
            </span>
          </div>
          {months.length === 0 ? (
            <Empty>{page.months.empty}</Empty>
          ) : (
            <ul className="flex flex-col">
              {months.map(({ month, netAgorot }) => (
                <li
                  key={`${month.year}-${month.month}`}
                  data-month={`${month.year}-${String(month.month).padStart(2, "0")}`}
                  className="flex items-baseline justify-between gap-4 border-t border-line py-2 first:border-t-0"
                >
                  <span className="text-[15px] font-medium">
                    <Bidi>{monthLabel(month)}</Bidi>
                  </span>
                  <MoneyValue agorot={netAgorot} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex min-w-0 flex-col gap-2 px-4.5 py-3.5">
          <h2 dir="auto" className="text-[17px] font-semibold">
            {page.advances.title}
          </h2>
          {open.length === 0 ? (
            <Empty>{page.advances.empty}</Empty>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {open.map((standing) => (
                <li
                  key={standing.number}
                  data-advance={standing.number}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                >
                  <span className="text-[15px] font-medium">
                    <Bidi>
                      {he.month.actions.advances.name(standing.number)}
                    </Bidi>
                  </span>
                  <span className="flex items-baseline gap-2 text-[13px] font-light text-ink-mute">
                    <span dir="auto">{page.advances.repaid} </span>
                    <Bidi noTranslate>
                      {formatAgorot(standing.repaidAgorot)}
                    </Bidi>
                    <span dir="auto">{page.advances.of} </span>
                    <Bidi noTranslate>
                      {formatAgorot(standing.principalAgorot)}
                    </Bidi>
                  </span>
                  <MoneyValue agorot={standing.outstandingAgorot} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/payments"
            className="self-start text-[14px] font-medium text-forest hover:underline hover:underline-offset-4"
          >
            <span dir="auto">{page.advances.record}</span>
          </Link>
        </Card>

        <Card
          id={TERMS_ID}
          className="flex min-w-0 scroll-mt-4 flex-col gap-3.5 px-4.5 py-3.5"
        >
          <div className="flex flex-col gap-1">
            <h2 dir="auto" className="text-[17px] font-semibold">
              {page.terms.title}
            </h2>
            <p
              dir="auto"
              className="max-w-[62ch] text-[13px] leading-[1.5] font-light text-ink-quiet text-pretty"
            >
              {page.terms.note}
            </p>
          </div>

          <RestDayControl
            workerId={profile.id}
            restDay={profile.restDay}
            onSubmit={handleAction}
          />

          <HolidaysRow year={year} chosen={holidayDaysChosen} allowance={holidayAllowance} />

          <RecuperationControl
            workerId={profile.id}
            recuperationMonth={profile.recuperationMonth}
            days={recuperationDays}
            onSubmit={handleAction}
          />

          <StandingLinesControl
            workerId={profile.id}
            standingLines={profile.standingLines}
            onSubmit={handleAction}
          />

          <OpeningPositionControl
            workerId={profile.id}
            profile={profile}
            onSubmit={handleAction}
          />

          <DocumentsControl
            workerId={profile.id}
            documents={profile.documents}
            onSubmit={handleAction}
          />
        </Card>
      </div>
    </div>
  );
}

/**
 * The way in to `בחירת חגים` (`build_plan.md` stage 5).
 *
 * **The artboard's own two ways in do not exist yet**: it is reached from
 * `הגדרות`, whose route is split between stages 3 and 5, and from the home
 * screen's alert, which is stage 6's. Settled with the user on 2026-09-09 that
 * the profile carries the link in the meantime — the picker keeps the
 * artboard's address, so `הגדרות` is still the tab that lights.
 *
 * It shows what is chosen against what she has, because "an incomplete
 * selection is visible at a glance" is item 10's, and a row that only said
 * "choose holidays" would hide exactly the thing worth glancing at.
 */
function HolidaysRow({
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

function Balance({
  label,
  value,
  rowKey,
}: {
  label: string;
  value: string;
  rowKey: string;
}) {
  return (
    <div
      data-balance={rowKey}
      className="flex min-w-0 flex-col gap-0.5"
    >
      <span dir="auto" className="text-[14px] font-light text-ink-mute">
        {label}
      </span>
      <Bidi noTranslate className="text-[19px] font-bold tracking-[-0.02em]">
        {value}
      </Bidi>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p dir="auto" className="text-[14px] font-light text-ink-quiet">
      {children}
    </p>
  );
}

/** One row of the terms section, in the `הגדרות` artboard's own shape: what it
 * is, the sentence under it, and the control that changes it. */
function TermRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5 border-t border-line pt-3 first:border-t-0 first:pt-0">
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

/** The chip these panels are built from — the calendar picker's own control, so
 * the profile and the month read as one mechanism (`MonthActions`). */
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

const buttonClass =
  "rounded-card-sm bg-forest px-3.5 py-2 text-[14px] font-semibold text-surface transition-colors hover:bg-forest-deep disabled:opacity-50";

const quietButtonClass =
  "text-[14px] font-medium text-ink-mute transition-colors hover:text-ink";

/** What the refusal was, as a sentence. Never a code: a refusal carries the
 * reason it was refused (specs.md item 25). */
function Refusal({ reason }: { reason: ProfileActionRefusal }) {
  return (
    <p
      aria-live="polite"
      dir="auto"
      className="text-[13px] leading-[1.5] font-light text-clay-deep text-pretty"
    >
      {he.workers.profile.terms.refused[reason]}
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
function RestDayControl({
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
function RecuperationControl({
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
function StandingLinesControl({
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
function OpeningPositionControl({
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
  const [vacation, setVacation] = useState(String(opening.vacationDays));
  const [sick, setSick] = useState(String(opening.sickDays));
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
                  vacationDays: vacation,
                  sickDays: sick,
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
 * **No number is asked for and none is stored**, and the note says so: the
 * three numbers are encrypted at rest with the passport and bank account
 * (item 22), and the key that protects them arrives in stage 3.
 */
function DocumentsControl({
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
