"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import {
  chooseHoliday,
  moveHoliday,
  setHolidayPart,
  setHolidaySource,
  unchooseHoliday,
  type HolidayActionResult,
} from "@/app/settings/holidays/actions";
import { Bidi } from "@/components/Bidi";
import { Chip } from "@/components/Chip";
import { Card } from "@/components/Card";
import { Chevron } from "@/components/icons";
import { useWorkerScope } from "@/components/WorkerScope";
import { WhyPanel } from "@/components/WhyDisclosure";
import { weekdayDayLabel } from "@/lib/dateLabels";
import type { HolidayRow, HolidayYear } from "@/lib/engine/holidayYear";
import type { HolidaySourceChoice } from "@/lib/holidaySources";
import { he } from "@/lib/i18n/he";
import { formatDays } from "@/lib/money";
import type { ScrapeFailureKind } from "@/lib/scrape/failure";
import { dayParts } from "@/lib/spans";
import type { IsoDate, Worker } from "@/lib/types";

/**
 * The year's holidays, chosen in advance — `EaseSalary - בחירת חגים`
 * (specs.md item 10).
 *
 * **It holds no arithmetic.** The quota, what is left of it and whether one
 * more day may be chosen are `holidayYear.ts`'s answers, worked out on the
 * server against the same entitlement `validateMonth` refuses a tenth holiday
 * against; every gesture goes to a server action and the page re-renders from
 * what was saved. A screen that counted for itself would be a second quota,
 * agreeing with the first until one of them was corrected.
 *
 * **Three places depart from the artboard on purpose** (`CLAUDE.md`), and each
 * is a decision taken after it was drawn:
 *
 * 1. The chips offer **the four faiths beside the countries**. The artboard
 *    draws countries alone because item 10 said a candidate list was a
 *    country's; the user settled on 2026-09-09 that it is a country's *or* a
 *    faith's, and that the two are one choice with two kinds of answer.
 * 2. **Nothing is saved by a button.** Each tick, part and move writes on its
 *    own, as the calendar and the profile already do, so "לשמור את הבחירה" is a
 *    way back rather than a save — settled with the user on 2026-09-09.
 * 3. The quota bar has **as many slots as the entitlement has days**, not nine.
 *    Nine is the full year's; a worker employed from April has 6.75, and nine
 *    slots would draw her a quota she does not have.
 */

/** One worker's year as the screen shows it. */
export interface WorkerHolidayYear {
  worker: Worker;
  countries: HolidaySourceChoice[];
  religions: HolidaySourceChoice[];
  /** Which of the three ways the fetch failed, where it did (item 12). The
   * candidate list is then empty and the dates are typed by hand. */
  failure: ScrapeFailureKind | null;
  year: HolidayYear;
}

interface HolidayPickerScreenProps {
  household: WorkerHolidayYear[];
  /** The calendar year on screen. It is in the address, because moving to a
   * year with no list is what makes the application fetch one (item 12). */
  year: number;
}

/** Which panel is open. One at a time, as every other screen does it: a row
 * being moved, the date being added, or the quota's reasoning. */
type Open =
  | { kind: "move"; spanId: string }
  | { kind: "add" }
  | { kind: "quota" }
  | null;

export function HolidayPickerScreen({
  household,
  year,
}: HolidayPickerScreenProps) {
  const words = he.holidays;
  const { worker } = useWorkerScope();
  const entry =
    household.find((candidate) => candidate.worker.id === worker.id) ??
    household[0];

  const [saving, startSaving] = useTransition();
  const [open, setOpen] = useState<Open>(null);
  // A refusal belongs to the gesture that produced it, so it is keyed by the
  // row it happened on rather than shown once at the top of a list of thirty
  // dates (specs.md item 25).
  const [refusal, setRefusal] = useState<{
    at: string;
    reason: keyof typeof words.refused;
  } | null>(null);

  function act(at: string, action: () => Promise<HolidayActionResult>) {
    setRefusal(null);
    startSaving(async () => {
      const result = await action();
      if (!result.ok) setRefusal({ at, reason: result.reason });
      else setOpen(null);
    });
  }

  const { year: state } = entry;

  return (
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[24px] leading-[1.2] font-bold tracking-[-0.02em]">
            <span dir="auto">{words.title} </span>
            <Bidi noTranslate>{String(year)}</Bidi>
          </h1>
          <p className="max-w-[62ch] text-[15px] font-light text-ink-mute text-pretty">
            <span dir="auto">{words.forWorker} </span>
            <Bidi>{entry.worker.name}</Bidi>
            <span aria-hidden="true"> · </span>
            <span dir="auto">{words.lead}</span>
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <YearStep to={year - 1} label={words.previousYear} towards="previous" />
          <Bidi noTranslate className="px-1.5 text-[17px] font-semibold">
            {String(year)}
          </Bidi>
          <YearStep to={year + 1} label={words.nextYear} towards="next" />
        </div>
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
        <Card
          tone="tint"
          radius="tint"
          className="flex min-w-0 flex-col gap-3 px-4.5 py-3.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
            <span
              data-quota
              className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
            >
              <span dir="auto" className="text-[15px] font-light text-ink-warm">
                {words.quota.chosen}
              </span>
              <Bidi
                noTranslate
                className="text-[24px] font-bold tracking-[-0.02em]"
              >
                {formatDays(state.chosenDays)}
              </Bidi>
              <span dir="auto" className="text-[15px] font-light text-ink-warm">
                {words.quota.of}
              </span>
              <Bidi noTranslate className="text-[18px] font-semibold">
                {formatDays(state.allowance)}
              </Bidi>
              <span dir="auto" className="text-[15px] font-light text-ink-warm">
                {words.quota.days}
              </span>
            </span>
            <button
              type="button"
              aria-expanded={open?.kind === "quota"}
              aria-controls="holiday-quota-why"
              onClick={() =>
                setOpen((current) =>
                  current?.kind === "quota" ? null : { kind: "quota" },
                )
              }
              className="text-[15px] font-medium text-forest transition-colors hover:underline hover:underline-offset-[3px]"
            >
              <span dir="auto">{words.quota.why}</span>
            </button>
          </div>

          <QuotaBar allowance={state.allowance} chosen={state.chosenDays} />

          <p
            data-quota-state={state.incomplete ? "incomplete" : "complete"}
            dir="auto"
            className={[
              "text-[15px] leading-[1.5] text-pretty",
              state.incomplete
                ? "font-medium text-clay-deep"
                : "font-light text-ink-warm",
            ].join(" ")}
          >
            {state.incomplete ? words.quota.incomplete : words.quota.complete}
          </p>

          <WhyPanel
            id="holiday-quota-why"
            open={open?.kind === "quota"}
            within="tint"
            explanation={{ text: words.quota.rule, link: "holidayWork" }}
          >
            <span className="text-[13px] leading-[1.6] font-light text-ink-quiet text-pretty">
              <span dir="auto">{words.quota.exampleBefore} </span>
              <Bidi noTranslate>{words.quota.exampleFigure}</Bidi>
              <span dir="auto"> {words.quota.exampleAfter}</span>
            </span>
          </WhyPanel>
        </Card>

        <Card className="flex min-w-0 flex-col gap-2.5 px-4.5 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
              <span dir="auto" className="text-[15px] font-light text-ink-mute">
                {words.sources.label}
              </span>
              {entry.countries.map((choice) => (
                <SourceChip
                  key={`country-${choice.source.kind === "country" ? choice.source.code : ""}`}
                  choice={choice}
                  onPick={() =>
                    act("source", () =>
                      setHolidaySource(entry.worker.id, choice.source),
                    )
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setOpen((current) =>
                  current?.kind === "add" ? null : { kind: "add" },
                )
              }
              className="text-[15px] font-medium text-forest transition-colors hover:underline hover:underline-offset-[3px]"
            >
              <span dir="auto">{words.sources.manual}</span>
            </button>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
            <span dir="auto" className="text-[15px] font-light text-ink-mute">
              {words.sources.religions}
            </span>
            {entry.religions.map((choice) => (
              <SourceChip
                key={`religion-${choice.source.kind === "religion" ? choice.source.religion : ""}`}
                choice={choice}
                onPick={() =>
                  act("source", () =>
                    setHolidaySource(entry.worker.id, choice.source),
                  )
                }
              />
            ))}
          </div>

          {open?.kind === "add" ? (
            <DateForm
              legend={words.add.title}
              hint={words.add.hint}
              year={year}
              submit={words.add.submit}
              onCancel={() => setOpen(null)}
              onSubmit={(date) =>
                act("add", () => chooseHoliday(entry.worker.id, date, year))
              }
            />
          ) : null}
          {refusal?.at === "add" || refusal?.at === "source" ? (
            <Refusal reason={refusal.reason} />
          ) : null}
        </Card>

        {entry.failure !== null ? (
          <Card
            tone="inset"
            radius="panel"
            className="flex flex-col gap-1 px-4 py-3.5"
          >
            <span
              data-fetch-failed={entry.failure}
              dir="auto"
              className="text-[16px] font-semibold text-clay-deep"
            >
              {words.failure.title}
            </span>
            <span
              dir="auto"
              className="text-[15px] leading-[1.55] font-light text-ink-warm text-pretty"
            >
              {words.failure[entry.failure]}
            </span>
          </Card>
        ) : null}

        <Card className="flex min-w-0 flex-col px-1.5 py-1">
          {state.rows.length === 0 ? (
            <p
              dir="auto"
              className="px-3 py-3 text-[14px] font-light text-ink-quiet"
            >
              {words.row.empty}
            </p>
          ) : (
            <ul className="flex flex-col">
              {state.rows.map((row) => (
                <li
                  key={row.date}
                  data-holiday={row.date}
                  data-chosen={row.chosen !== null}
                  className="flex min-w-0 flex-col gap-1.5 border-t border-line px-3 py-2.5 first:border-t-0"
                >
                  <HolidayRowView
                    row={row}
                    year={year}
                    workerId={entry.worker.id}
                    moving={
                      open?.kind === "move" &&
                      open.spanId === row.chosen?.spanId
                    }
                    onMove={() =>
                      setOpen(
                        row.chosen === null
                          ? null
                          : { kind: "move", spanId: row.chosen.spanId },
                      )
                    }
                    onCancelMove={() => setOpen(null)}
                    act={act}
                  />
                  {refusal?.at === row.date ? (
                    <Refusal reason={refusal.reason} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p
            dir="auto"
            className="max-w-[62ch] px-3 py-2 text-[13px] leading-[1.5] font-light text-ink-quiet text-pretty"
          >
            {words.row.part.rule}
          </p>
        </Card>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-2">
          <Link
            href={`/workers/${entry.worker.id}`}
            className="rounded-card-sm bg-forest px-5 py-2.5 text-[16px] font-semibold text-surface transition-colors hover:bg-forest-deep hover:text-surface"
          >
            <span dir="auto">
              {he.workers.toProfile(entry.worker.firstName)}
            </span>
          </Link>
          <span
            dir="auto"
            className="text-[15px] font-light text-ink-quiet text-pretty"
          >
            {words.note}
          </span>
        </div>
      </div>
    </div>
  );
}

/** A year forward or back. A link and not a button: the year is in the address,
 * so stepping it is navigation and the browser's own back works on it. */
function YearStep({
  to,
  label,
  towards,
}: {
  to: number;
  label: string;
  towards: "previous" | "next";
}) {
  return (
    <Link
      href={`/settings/holidays?year=${to}`}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-tab border border-line text-ink-quiet transition-colors hover:bg-hover hover:text-ink"
    >
      <Chevron towards={towards} />
    </Link>
  );
}

/**
 * The entitlement drawn as the days it holds.
 *
 * One slot per whole day and one more for a part of a day, because an
 * entitlement of 6.75 is what a year begun in April actually gives (item 10) —
 * a fixed nine would draw her a quota she does not have. A slot filled by a
 * part day is drawn lighter than a whole one, so half a day taken does not read
 * as a whole one spent.
 */
function QuotaBar({ allowance, chosen }: { allowance: number; chosen: number }) {
  const slots = Math.ceil(allowance);
  return (
    <div aria-hidden="true" className="flex gap-1.25">
      {Array.from({ length: slots }, (_, index) => {
        const filled = chosen >= index + 1;
        const partly = !filled && chosen > index;
        return (
          <span
            key={index}
            className={[
              "h-2.25 flex-1 rounded-full",
              filled
                ? "bg-holiday"
                : partly
                  ? "bg-holiday/50"
                  : "border border-line-strong bg-surface",
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}

/** One list to choose the year's candidates from — a country's or a faith's
 * (item 10). */
function SourceChip({
  choice,
  onPick,
}: {
  choice: HolidaySourceChoice;
  onPick: () => void;
}) {
  return (
    <Chip
      selected={choice.selected}
      onClick={onPick}
      data-source={
        choice.source.kind === "country"
          ? choice.source.code
          : choice.source.religion
      }
    >
      <Bidi>{choice.nameHe}</Bidi>
    </Chip>
  );
}

/** One candidate date: the tick, what it is, and — once chosen — how much of
 * the day it is and where it can be moved to. */
function HolidayRowView({
  row,
  year,
  workerId,
  moving,
  onMove,
  onCancelMove,
  act,
}: {
  row: HolidayRow;
  year: number;
  workerId: string;
  moving: boolean;
  onMove: () => void;
  onCancelMove: () => void;
  act: (at: string, action: () => Promise<HolidayActionResult>) => void;
}) {
  const words = he.holidays.row;
  const chosen = row.chosen;
  const label = weekdayDayLabel(row.date);

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={chosen !== null}
          aria-label={chosen === null ? words.choose(label) : words.unchoose(label)}
          disabled={row.blocked}
          onClick={() =>
            act(row.date, () =>
              chosen === null
                ? chooseHoliday(workerId, row.date, year)
                : unchooseHoliday(workerId, chosen.spanId),
            )
          }
          className={[
            "flex size-6 flex-none items-center justify-center rounded-chip border-[1.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
            chosen !== null
              ? "border-holiday bg-holiday"
              : row.blocked
                ? "border-line bg-ground"
                : "border-line-strong bg-surface hover:border-line-hover",
          ].join(" ")}
        >
          {chosen !== null ? <Tick /> : null}
        </button>

        <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
          <span
            dir="auto"
            className={[
              "text-[16px]",
              chosen !== null ? "font-semibold" : "font-normal",
            ].join(" ")}
          >
            {row.name === null ? (
              <span dir="auto">{words.own}</span>
            ) : (
              <Bidi>{row.name}</Bidi>
            )}
          </span>
          <Bidi className="text-[14px] font-light text-ink-quiet">{label}</Bidi>
        </span>

        {chosen !== null ? (
          <span className="flex flex-none flex-wrap items-center gap-2">
            {dayParts.map((part) => (
              <button
                key={part}
                type="button"
                data-part={part}
                aria-pressed={chosen.fraction === part}
                onClick={() =>
                  act(row.date, () =>
                    setHolidayPart(workerId, chosen.spanId, part, year),
                  )
                }
                className={[
                  "rounded-full border bg-surface px-3.25 py-1.5 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
                  chosen.fraction === part
                    ? "border-line-hover font-semibold text-ink"
                    : "border-line font-medium text-day-ink hover:border-line-hover hover:text-ink",
                ].join(" ")}
              >
                <span dir="auto">
                  {part === 1 ? words.part.whole : words.part.half}
                </span>
              </button>
            ))}
            <button
              type="button"
              aria-label={words.moveLabel(label)}
              onClick={onMove}
              className="ps-1.5 text-[14px] font-medium text-forest whitespace-nowrap transition-colors hover:underline hover:underline-offset-[3px]"
            >
              <span dir="auto">{words.move}</span>
            </button>
          </span>
        ) : null}

        {row.blocked ? (
          <span
            dir="auto"
            className="flex-none rounded-full bg-chip px-3.25 py-1.5 text-[14px] font-medium text-clay-deep"
          >
            {words.blocked}
          </span>
        ) : null}
      </div>

      {moving && chosen !== null ? (
        <DateForm
          legend={he.holidays.add.move}
          year={year}
          submit={he.holidays.add.moveSubmit}
          initial={row.date}
          onCancel={onCancelMove}
          onSubmit={(date) =>
            act(row.date, () =>
              moveHoliday(workerId, chosen.spanId, date, year),
            )
          }
        />
      ) : null}
    </>
  );
}

function Tick() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 12 9"
      fill="none"
      className="size-3"
    >
      <path
        d="M1 4.6 4.3 7.9 11 1.2"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-day-ink"
      />
    </svg>
  );
}

/**
 * A date typed by hand — item 12's own answer to a fetch that failed, and item
 * 10's to a date that has to move.
 *
 * The field is bounded to the year on screen so the ordinary mistake cannot be
 * made, and the server refuses one outside it anyway: the bound is a
 * convenience and never the check.
 */
function DateForm({
  legend,
  hint,
  year,
  submit,
  initial,
  onCancel,
  onSubmit,
}: {
  legend: string;
  hint?: string;
  year: number;
  submit: string;
  initial?: IsoDate;
  onCancel: () => void;
  onSubmit: (date: IsoDate) => void;
}) {
  const [date, setDate] = useState<string>(initial ?? "");

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-card-sm border border-line bg-ground px-3.5 py-3">
      <div className="flex flex-col gap-0.5">
        <span dir="auto" className="text-[14px] font-semibold">
          {legend}
        </span>
        {hint ? (
          <span
            dir="auto"
            className="max-w-[62ch] text-[13px] leading-[1.5] font-light text-ink-quiet text-pretty"
          >
            {hint}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-0 flex-col gap-1">
          <span dir="auto" className="text-[13px] font-medium text-ink-warm">
            {he.holidays.add.date}
          </span>
          <input
            type="date"
            dir="ltr"
            value={date}
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-card-sm border border-line bg-surface px-3 py-2 text-[15px] text-ink transition-colors hover:border-line-hover focus-visible:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest"
          />
        </label>
        <button
          type="button"
          disabled={date === ""}
          onClick={() => onSubmit(date as IsoDate)}
          className="rounded-card-sm bg-forest px-3.5 py-2 text-[14px] font-semibold text-surface transition-colors hover:bg-forest-deep disabled:opacity-50"
        >
          <span dir="auto">{submit}</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="py-2 text-[14px] font-medium text-ink-mute transition-colors hover:text-ink"
        >
          <span dir="auto">{he.holidays.add.cancel}</span>
        </button>
      </div>
    </div>
  );
}

/** What the refusal was, as a sentence. Never a code: a refusal carries the
 * reason it was refused (specs.md item 25). */
function Refusal({ reason }: { reason: keyof typeof he.holidays.refused }): ReactNode {
  return (
    <p
      aria-live="polite"
      dir="auto"
      className="text-[13px] leading-[1.5] font-light text-clay-deep text-pretty"
    >
      {he.holidays.refused[reason]}
    </p>
  );
}
