"use client";

import Link from "next/link";
import { useState } from "react";
import { performGesture, type NamedWorker, type Staging } from "@/app/help/actions";
import { Sentence } from "@/components/AlertsScreen";
import { Bidi } from "@/components/Bidi";
import { Chevron } from "@/components/icons";
import { monthLabel, rangeLabel, weekdayDayLabel } from "@/lib/dateLabels";
import type { GestureKind } from "@/lib/help/gesture";
import { routeOf, screenName } from "@/lib/help/screens";
import { he } from "@/lib/i18n/he";

/**
 * A sentence read as an instruction, drawn as a proposal (specs.md item 24).
 *
 * **Nothing here has happened yet.** The card lists the days a press would
 * change and the days it could not, and the press is the first thing on this
 * path that writes — which is the whole of why the panel may read an
 * instruction at all: a sentence misread costs a card the user dismisses, and
 * not a calendar they have to put right.
 *
 * **It decides nothing about which days those are.** The list came back from
 * `stageGesture`, which asks `spans.ts` — the same module the calendar's own
 * sweep passes through — so a day refused here is refused for the reason it is
 * refused there, in `he.calendar.skipped`'s own words (items 5 and 8).
 *
 * **The press sends the sentence and not the days.** What is performed is what
 * the server makes of the sentence when it arrives, so a day list edited on the
 * way back cannot become a marking (`performGesture`).
 */
export function HelpStaged({
  question,
  staging,
  compact,
  onChoose,
}: {
  /** The sentence as it was typed, which is what the press sends. */
  question: string;
  /** `null` while the server is working it out, `"failed"` where that did not
   * come back. */
  staging: Staging | "failed" | null;
  compact: boolean;
  /** Whose calendar it is, once the user has said — the turn asks again with
   * the worker named. */
  onChoose: (worker: NamedWorker) => void;
}) {
  const words = he.help.stage;
  const [marked, setMarked] = useState<number | "working" | "failed" | null>(null);

  if (staging === null) return <Quiet role="help-staged-pending" text={words.working} />;
  if (staging === "failed") return <Quiet role="help-staged-failed" text={words.failed} />;

  return (
    <div
      data-role="help-staged"
      data-state={staging.state}
      className={[
        "flex flex-col rounded-calendar border border-help-answer-line bg-help-answer",
        compact ? "gap-3 px-4 py-4" : "gap-4.5 px-6 py-6 sm:px-7.5",
      ].join(" ")}
    >
      <span
        dir="auto"
        className={[
          "self-start font-semibold tracking-[0.06em] text-help-eyebrow",
          compact ? "text-[11px]" : "text-[13px]",
        ].join(" ")}
      >
        {words.eyebrow}
      </span>

      {staging.state === "choose" ? (
        <Whose workers={staging.workers} compact={compact} onChoose={onChoose} />
      ) : null}

      {staging.state === "tooEarly" ? (
        <p dir="auto" data-role="staged-too-early" className={bodyClass(compact)}>
          <Sentence said={words.tooEarly(monthLabel(staging.firstMonth))} />
        </p>
      ) : null}

      {staging.state === "ready" ? (
        <Ready
          question={question}
          staging={staging}
          compact={compact}
          marked={marked}
          onMark={setMarked}
        />
      ) : null}
    </div>
  );
}

/**
 * The proposal itself: whose calendar, which days, which days not, and the
 * press.
 *
 * **The days are drawn in full and never summarised.** A range in words is how
 * the sentence was understood; the list under it is what the press does, and
 * the two differ exactly where a day was refused — which is the thing the user
 * has to see before pressing.
 */
function Ready({
  question,
  staging,
  compact,
  marked,
  onMark,
}: {
  question: string;
  staging: Extract<Staging, { state: "ready" }>;
  compact: boolean;
  marked: number | "working" | "failed" | null;
  onMark: (state: number | "working" | "failed") => void;
}) {
  const words = he.help.stage;
  const mark = he.calendar.marks(staging.restDay)[markNameOf(staging.kind)];
  const nothing = staging.days.length === 0;

  async function press() {
    onMark("working");
    try {
      const done = await performGesture(question, staging.worker.workerId);
      // A fault and a sentence the server no longer reads as an instruction are
      // one state to the user: the calendar did not change and the card says so
      // rather than claiming a marking it cannot show.
      onMark(done !== null && done.ok ? staging.days.length : "failed");
    } catch {
      onMark("failed");
    }
  }

  return (
    <>
      <span
        dir="auto"
        className={[
          "leading-[1.2] font-bold tracking-[-0.02em]",
          compact ? "text-[19px]" : "text-[24px] sm:text-[27px]",
        ].join(" ")}
      >
        <Sentence said={words.forWorker(mark, staging.worker.name)} />
      </span>
      <Bidi className={compact ? "text-[14px] text-ink-warm" : "text-[16px] text-ink-warm"}>
        {rangeLabel(staging.from, staging.to)}
      </Bidi>

      {nothing ? (
        <p dir="auto" data-role="staged-nothing" className={bodyClass(compact)}>
          {staging.kind === "holidayWorked" ? words.noHoliday : words.none}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {staging.days.map((date) => (
            <li key={date} data-row={`staged-day-${date}`}>
              <Bidi className={compact ? "text-[14px] font-medium" : "text-[16px] font-medium"}>
                {weekdayDayLabel(date)}
              </Bidi>
            </li>
          ))}
        </ul>
      )}

      {staging.kind === "holidayWorked" && !nothing ? (
        <span dir="auto" className={quietClass(compact)}>
          {words.holidayNote}
        </span>
      ) : null}

      <Refused staging={staging} compact={compact} />

      {marked === null || marked === "working" ? (
        nothing ? (
          <ToCalendar compact={compact} />
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-role="staged-mark"
              disabled={marked === "working"}
              aria-busy={marked === "working"}
              onClick={() => void press()}
              className={[
                "flex min-h-11 items-center rounded-tint bg-forest font-semibold text-white transition-colors hover:bg-forest-deep hover:text-white disabled:opacity-60",
                compact ? "px-4 text-[15px]" : "px-6 text-[17px]",
              ].join(" ")}
            >
              <span dir="auto">{`${words.mark} · ${words.dayCount(staging.days.length)}`}</span>
            </button>
            <button
              type="button"
              data-role="staged-dismiss"
              /* Dismissing is the same state as a press that has landed: the
                 proposal is gone either way, and what is left is the way to the
                 calendar. Nothing is undone, because nothing was done. */
              onClick={() => onMark(0)}
              className={[
                "flex min-h-11 items-center rounded-tint px-4 font-medium text-ink-quiet transition-colors hover:bg-hover hover:text-ink",
                compact ? "text-[15px]" : "text-[16px]",
              ].join(" ")}
            >
              <span dir="auto">{words.dismiss}</span>
            </button>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2.5">
          {marked === "failed" ? (
            <p dir="auto" data-role="staged-write-failed" className={bodyClass(compact)}>
              {words.failed}
            </p>
          ) : marked > 0 ? (
            <p dir="auto" data-role="staged-done" className={bodyClass(compact)}>
              {words.done(marked)}
            </p>
          ) : null}
          <ToCalendar compact={compact} />
        </div>
      )}
    </>
  );
}

/** The days inside the range that would not take the mark, each with the
 * calendar's own reason. */
function Refused({
  staging,
  compact,
}: {
  staging: Extract<Staging, { state: "ready" }>;
  compact: boolean;
}) {
  if (staging.skipped.length === 0) return null;
  const said = he.calendar.skipped(staging.restDay);

  return (
    <section data-role="staged-refused" className="flex flex-col gap-1.5 border-t border-help-answer-line pt-2.5">
      <span dir="auto" className={compact ? "text-[13px] font-semibold" : "text-[15px] font-semibold"}>
        {he.help.stage.refused}
      </span>
      <ul className="flex flex-col gap-1">
        {staging.skipped.map((day) => (
          <li key={day.date} data-row={`staged-skipped-${day.date}`} className="flex flex-col">
            <Bidi className={quietClass(compact)}>{weekdayDayLabel(day.date)}</Bidi>
            <span dir="auto" className={quietClass(compact)}>
              {said[day.reason]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Whose calendar the marking is for, where the household holds two and the
 * sentence named neither (item 24).
 *
 * The choice is two presses and not a list, because a household holds at most
 * two workers (`specs.md` Part 1) and a select for two options is a control
 * that hides one of them.
 */
function Whose({
  workers,
  compact,
  onChoose,
}: {
  workers: NamedWorker[];
  compact: boolean;
  onChoose: (worker: NamedWorker) => void;
}) {
  return (
    <section data-role="staged-whose" className="flex flex-col gap-2.5">
      <p dir="auto" className={bodyClass(compact)}>
        {he.help.stage.whose}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {workers.map((worker) => (
          <button
            key={worker.workerId}
            type="button"
            data-row={`staged-worker-${worker.workerId}`}
            onClick={() => onChoose(worker)}
            className={[
              "flex min-h-11 items-center rounded-tint border border-line-strong bg-surface px-4 font-semibold transition-colors hover:bg-hover",
              compact ? "text-[15px]" : "text-[16px]",
            ].join(" ")}
          >
            <Bidi>{worker.name}</Bidi>
          </button>
        ))}
      </div>
    </section>
  );
}

/** The way to the calendar, which is where everything a sentence cannot say is
 * said: a part of a day, a note, a correction. */
function ToCalendar({ compact }: { compact: boolean }) {
  return (
    <Link
      href={routeOf("home")}
      data-role="staged-to-calendar"
      className={[
        "flex items-center gap-2.5 self-start rounded-tint bg-chip font-semibold text-ink transition-colors hover:bg-hover",
        compact ? "px-4 py-2.5 text-[15px]" : "px-6 py-3 text-[16px]",
      ].join(" ")}
    >
      <span dir="auto">{`${he.help.stage.toCalendar} · ${screenName("home")}`}</span>
      <Chevron towards="next" className="flex-none" />
    </Link>
  );
}

/** The calendar's own name for the mark. A holiday is not a mark the user makes
 * — what changes is the answer recorded about one (item 9) — so it is named by
 * the holiday's own word. */
function markNameOf(kind: GestureKind): "vacation" | "sick" | "freeRestDay" | "holiday" {
  return kind === "holidayWorked" ? "holiday" : kind;
}

/** The two states that are a sentence and nothing else. */
function Quiet({ role, text }: { role: string; text: string }) {
  return (
    <p
      dir="auto"
      data-role={role}
      className="rounded-card-sm border border-line bg-day px-4 py-3 text-[14px] font-light text-ink-mute"
    >
      {text}
    </p>
  );
}

function bodyClass(compact: boolean): string {
  return compact ? "text-[14px] text-ink-warm" : "text-[16px] text-ink-warm";
}

function quietClass(compact: boolean): string {
  return compact
    ? "text-[13px] font-light text-ink-mute"
    : "text-[15px] font-light text-ink-mute";
}
