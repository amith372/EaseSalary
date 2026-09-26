"use client";

/**
 * The opening position and the standing lines — two rows of `הגדרות` that are
 * each a small form rather than a choice, and together half of
 * `WorkerTerms.tsx`'s length.
 *
 * **They sit beside the terms and not inside them** for that reason alone: the
 * rows they draw, the refusals they show and the way they save are the file
 * next door's, and both are imported from it so there is one `TermRow` and one
 * `Refusal` on the screen.
 */

import { useState } from "react";
import {
  addOpeningAdvance,
  addStandingLine,
  removeOpeningAdvance,
  removeStandingLine,
  setOpeningDays,
  updateStandingLine,
} from "@/app/workers/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import {
  AmountField,
  busyAttrs,
  buttonClass,
  Field,
  NoteField,
  inputClass,
  touchTargetClass,
} from "@/components/Field";
import { MoneyValue } from "@/components/MoneyValue";
import { MonthSelect } from "@/components/MonthSelect";
import { useAction } from "@/components/useAction";
import { useUserLineForm } from "@/components/useUserLineForm";
import {
  Empty,
  quietButtonClass,
  Refusal,
  TermRow,
  type Submit,
} from "@/components/WorkerTerms";
import {
  userLineDirections,
  userLinePlacements,
} from "@/lib/engine/types";
import type { UserLine } from "@/lib/engine/types";
import { compareMonth, yearMonthText } from "@/lib/dates";
import { monthLabel } from "@/lib/dateLabels";
import type { YearMonth } from "@/lib/types";
import type { WorkerProfile } from "@/lib/engine/repository";
import { he } from "@/lib/i18n/he";
import { formatDays } from "@/lib/money";

/**
 * The lines set once on the profile that appear in every month afterwards
 * (specs.md item 20).
 *
 * **This is the one case that makes the override/edit division necessary
 * rather than tidy.** A standing line's amount came from the profile, so a
 * month that paid something else says so with an override — `overridable:
 * prefix === "standing"` — while a line typed into a month is corrected where
 * it was typed. Until a standing line could be set, that flag had one reachable
 * value.
 *
 * The panel is the one `/payments` uses for a one-off line, and deliberately:
 * the three choices are the line's and not the month's, so a second panel would
 * be a second place for the placement rule to drift. What it adds is the one
 * thing only a standing line has — **a lifetime**, a first month and an optional
 * last one (item 20) — held here rather than in the shared hook, since a one-off
 * line belongs to the month it was typed into and has no range to name.
 *
 * **Two endings, two gestures.** `להסיר` deletes the line, which is what a line
 * added by mistake needs; a line that is *meant* to stop is ended by its last
 * month, stays listed under the quieter heading below, and is started again by
 * clearing that month (the user, 2026-09-26). A month already confirmed keeps
 * whichever snapshot it was confirmed with, either way.
 */
/**
 * The names a control is known by while it waits, built rather than typed at
 * both ends (run 8's R8.10): a key the press spells one way and the control
 * another leaves a button that never says it is working, and both halves look
 * right on their own.
 */
const busyKey = {
  standingLine: (id: string) => `remove:${id}`,
  advance: (number: number) => `remove:${number}`,
};

/**
 * How far a standing line's lifetime may reach, in months either side of this
 * one.
 *
 * A lifetime is set looking forward — a deduction agreed for the next few months
 * — so the forward reach is the long one: four years covers the employment
 * permit's own cycle, the slowest clock the application knows (item 28). Two
 * years back is for an employment the application took over part-way, whose
 * earlier months are still unconfirmed drafts.
 */
const LIFETIME_MONTHS_BACK = 2 * 12;
const LIFETIME_MONTHS_FORWARD = 4 * 12;

export function StandingLinesControl({
  workerId,
  standingLines,
  month,
  onSubmit,
}: {
  workerId: string;
  standingLines: UserLine[];
  /** This month, passed in because nothing reads a clock during a render — and
   * the months the lifetime offers are counted from it. */
  month: YearMonth;
  onSubmit: Submit;
}) {
  const words = he.workers.profile.terms.standing;
  const lineWords = he.month.actions.lines;
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
    run,
    busyAt,
    clear,
    reset,
    openEdit,
    submit,
  } = useUserLineForm({
    send: onSubmit,
    save: (open, draft) =>
      open === "new"
        ? addStandingLine(workerId, { ...draft, from, until })
        : updateStandingLine(workerId, open, { ...draft, from, until }),
  });

  // The lifetime is held here and not in the shared hook: a one-off line has no
  // range to name. Empty is the answer "no end on this side", so a panel opened
  // fresh writes a line that applies to every month — exactly what a standing
  // line meant before the lifetime existed.
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");

  /** Every way into the panel clears or fills these two, because the hook's own
   * reset cannot reach them: a month left over from the last line would be a
   * lifetime nobody typed. */
  function openFor(line: UserLine | null) {
    if (line === null) {
      clear();
      setFrom("");
      setUntil("");
      setOpen("new");
      return;
    }
    openEdit(line);
    setFrom(line.from === undefined ? "" : yearMonthText(line.from));
    setUntil(line.until === undefined ? "" : yearMonthText(line.until));
  }

  function cancel() {
    reset();
    setFrom("");
    setUntil("");
  }

  /** A line whose last month has already passed. It reaches no later month, and
   * it is listed under its own quieter heading rather than dropped: the edit
   * that would start it again is on its row (item 20). */
  const hasEnded = (line: UserLine) =>
    line.until !== undefined && compareMonth(line.until, month) < 0;
  const live = standingLines.filter((line) => !hasEnded(line));
  const ended = standingLines.filter(hasEnded);

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

      <AmountField
        label={lineWords.amount}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="text-start"
      />

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

      <div className="flex flex-col gap-1">
        <span dir="auto" className="text-[13px] font-medium text-ink-warm">
          {words.lifetime.title}
        </span>
        <div className="flex flex-wrap gap-2">
          <MonthSelect
            label={words.lifetime.from}
            month={month}
            value={from}
            onChange={setFrom}
            emptyLabel={words.lifetime.fromNone}
            back={LIFETIME_MONTHS_BACK}
            forward={LIFETIME_MONTHS_FORWARD}
          />
          <MonthSelect
            label={words.lifetime.until}
            month={month}
            value={until}
            onChange={setUntil}
            emptyLabel={words.lifetime.untilNone}
            back={LIFETIME_MONTHS_BACK}
            forward={LIFETIME_MONTHS_FORWARD}
          />
        </div>
        <span
          dir="auto"
          className="text-[12px] leading-[1.5] font-light text-ink-quiet text-pretty"
        >
          {words.lifetime.hint}
        </span>
      </div>

      <NoteField
        label={lineWords.note}
        hint={lineWords.noteHint}
        value={note}
        onChange={setNote}
      />

      {refusal ? <Refusal reason={refusal} /> : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          {...busyAttrs(open !== null && busyAt(open), buttonClass)}
        >
          <span dir="auto">
            {open === "new" ? lineWords.submit : lineWords.save}
          </span>
        </button>
        <button type="button" onClick={cancel} className={quietButtonClass}>
          <span dir="auto">{he.workers.profile.terms.cancel}</span>
        </button>
      </div>
    </Card>
  );

  /** One line's row. Written once because the ended lines below are the same
   * rows under a quieter heading, and two copies would be two rows that could
   * come to offer different gestures. */
  const rowFor = (line: UserLine) => (
    <li key={line.id} className="flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-medium">
            <Bidi>{line.label}</Bidi>
          </span>
          <Lifetime line={line} month={month} />
        </span>
        <span className="flex items-baseline gap-3">
          <MoneyValue
            agorot={line.direction === "addition" ? line.agorot : -line.agorot}
          />
          <button
            type="button"
            onClick={() => openFor(line)}
            aria-label={words.editLabel(line.label)}
            className={quietButtonClass}
          >
            <span dir="auto">{words.edit}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              run(
                () => removeStandingLine(workerId, line.id),
                undefined,
                busyKey.standingLine(line.id),
              )
            }
            aria-label={words.removeLabel(line.label)}
            {...busyAttrs(busyAt(busyKey.standingLine(line.id)), quietButtonClass)}
          >
            <span dir="auto">{words.remove}</span>
          </button>
        </span>
      </div>
      {open === line.id ? panel : null}
    </li>
  );

  return (
    <TermRow label={words.title} hint={words.hint}>
      <div data-terms="standing" className="flex flex-col gap-2">
        {standingLines.length === 0 ? (
          <Empty>{words.empty}</Empty>
        ) : null}

        {live.length === 0 ? null : (
          <ul className="flex flex-col gap-1.5">{live.map(rowFor)}</ul>
        )}

        {ended.length === 0 ? null : (
          <div data-terms="standing-ended" className="flex flex-col gap-1.5">
            <span
              dir="auto"
              className="mt-1 text-[13px] font-medium text-ink-quiet"
            >
              {words.ended}
            </span>
            <span
              dir="auto"
              className="text-[12px] leading-[1.5] font-light text-ink-quiet text-pretty"
            >
              {words.endedHint}
            </span>
            <ul className="flex flex-col gap-1.5 text-ink-mute">
              {ended.map(rowFor)}
            </ul>
          </div>
        )}

        {open === "new" ? (
          panel
        ) : (
          <button
            type="button"
            onClick={() => openFor(null)}
            className={`${touchTargetClass} self-start text-[14px] font-medium text-forest hover:underline hover:underline-offset-4`}
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
 * The months a standing line reaches, under its own row (specs.md item 20).
 *
 * Built in markup rather than as a string for `CoveredMonths`' reason: each end
 * is a mixed run of digits and Hebrew and needs its own isolate (`CLAUDE.md`).
 * A line with no lifetime draws nothing at all — it applies to every month, which
 * is the plain case and says itself.
 */
function Lifetime({ line, month }: { line: UserLine; month: YearMonth }) {
  const words = he.workers.profile.terms.standing.lifetime;
  if (line.from === undefined && line.until === undefined) return null;
  const notYet = line.from !== undefined && compareMonth(line.from, month) > 0;
  return (
    <span dir="auto" className="text-[13px] font-light text-ink-quiet">
      {line.from === undefined ? null : (
        <>
          <span>{words.shownFrom}</span>
          <Bidi noTranslate>{monthLabel(line.from)}</Bidi>
        </>
      )}
      {line.until === undefined ? null : (
        <>
          <span>{line.from === undefined ? "" : " "}</span>
          <span>{words.shownUntil} </span>
          <Bidi noTranslate>{monthLabel(line.until)}</Bidi>
        </>
      )}
      {notYet ? <span> · {words.notYet}</span> : null}
    </span>
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
  const { refusal, run, clear, busyAt } = useAction(onSubmit);

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
                undefined,
                "days",
              )
            }
            {...busyAttrs(busyAt("days"), buttonClass)}
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
                      run(
                        () => removeOpeningAdvance(workerId, advance.number),
                        undefined,
                        busyKey.advance(advance.number),
                      )
                    }
                    aria-label={words.removeLabel(advance.number)}
                    {...busyAttrs(
                      busyAt(busyKey.advance(advance.number)),
                      quietButtonClass,
                    )}
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
            <AmountField
              label={words.principal}
              value={principal}
              onChange={(event) => setPrincipal(event.target.value)}
              className="text-start"
            />
            <AmountField
              label={words.repaid}
              hint={words.repaidHint}
              value={repaid}
              onChange={(event) => setRepaid(event.target.value)}
              className="text-start"
            />
            <NoteField
              label={words.note}
              value={note}
              onChange={setNote}
            />
            {refusal ? <Refusal reason={refusal} /> : null}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  run(
                    () =>
                      addOpeningAdvance(workerId, { principal, repaid, note }),
                    closeAdd,
                    "add",
                  )
                }
                {...busyAttrs(busyAt("add"), buttonClass)}
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
            className={`${touchTargetClass} self-start text-[14px] font-medium text-forest hover:underline hover:underline-offset-4`}
          >
            <span dir="auto">{words.addAdvance}</span>
          </button>
        )}

        {!adding && refusal ? <Refusal reason={refusal} /> : null}
      </div>
    </TermRow>
  );
}
