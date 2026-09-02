import {
  addDays,
  compareIsoDate,
  eachDate,
  isRestDay,
  orderDates,
} from "@/lib/dates";
import type { DaySpan, IsoDate, MarkKind } from "@/lib/types";

/**
 * Which days inside a swept range actually take the mark.
 *
 * The calendar hands up the range the user drew and decides nothing about it:
 * what a range means depends on the entitlement behind the mark, and that is
 * calculation rather than interaction. A vacation span skips its rest days and
 * a sick span keeps them (specs.md items 5 and 8) — the asymmetry is the reason
 * this module exists and the reason it is tested.
 *
 * A range that covers a day which refuses the mark applies to the days it
 * legally can and reports the rest, rather than refusing the whole sweep over
 * one bad day: making the user find the offending day herself is the option
 * that requires her to know more (specs.md Part 1).
 */

export interface MarkIntent {
  kind: MarkKind;
  from: IsoDate;
  to: IsoDate;
}

/**
 * Why a day inside the range did not take the mark. Each is shown to the user
 * in words, so a refusal explains itself where it happened.
 */
export type SkipReason =
  /** The day is already the weekly rest day, so a vacation day drawn for it
   * would charge the worker twice (specs.md item 5). */
  | "weeklyRest"
  /** Only the worker's own rest day can be the rest day she had off. */
  | "notRestDay"
  /** The day already carries a mark, and a span is replaced rather than
   * layered. */
  | "alreadyMarked"
  /** A paid holiday landing on a free rest day: the day is paid once, not at
   * both the rest-day rate and the holiday rate (specs.md Part 4). */
  | "restDayHoliday";

export interface SkippedDay {
  date: IsoDate;
  reason: SkipReason;
}

export interface MarkResult {
  /** The spans to add. A range broken by a skipped day yields one span per
   * surviving run, so what is stored is exactly what is marked. */
  spans: DaySpan[];
  skipped: SkippedDay[];
}

/**
 * Which day a rest-day rule refuses, before any conflict with an existing span
 * is considered: the entitlement rule is the more informative answer, and it
 * holds whether or not the day is already marked.
 *
 * `isRestDay` still answers Saturday for every worker until step 7c, so both
 * refusals below are still the Saturday rule wearing the rest day's name. The
 * day arrives from the month's own terms in that step, and nothing here changes
 * when it does.
 */
function refusedByKind(kind: MarkKind, date: IsoDate): SkipReason | null {
  if (kind === "vacation" && isRestDay(date)) return "weeklyRest";
  if (kind === "freeRestDay" && !isRestDay(date)) return "notRestDay";
  return null;
}

function coveringSpan(spans: DaySpan[], date: IsoDate): DaySpan | undefined {
  return spans.find((span) => {
    const { from, to } = orderDates(span.from, span.to);
    return compareIsoDate(date, from) >= 0 && compareIsoDate(date, to) <= 0;
  });
}

/**
 * The days of the range that take the mark, and the days that do not with the
 * reason each was refused. Dates are ordered before anything else is decided:
 * in a right-to-left calendar a leftward drag moves forward in time, so a range
 * that trusted the order it arrived in would invert (specs.md Part 5).
 */
export function markableDays(intent: MarkIntent, existing: DaySpan[] = []) {
  const { from, to } = orderDates(intent.from, intent.to);
  const taken: IsoDate[] = [];
  const skipped: SkippedDay[] = [];

  for (const date of eachDate(from, to)) {
    const refused = refusedByKind(intent.kind, date);
    if (refused) {
      skipped.push({ date, reason: refused });
      continue;
    }
    const covering = coveringSpan(existing, date);
    if (covering) {
      skipped.push({
        date,
        reason:
          intent.kind === "holiday" && covering.kind === "freeRestDay"
            ? "restDayHoliday"
            : "alreadyMarked",
      });
      continue;
    }
    taken.push(date);
  }

  return { taken, skipped };
}

/** The surviving days as runs of consecutive dates. */
function runsOf(dates: IsoDate[]): { from: IsoDate; to: IsoDate }[] {
  const runs: { from: IsoDate; to: IsoDate }[] = [];
  for (const date of dates) {
    const last = runs[runs.length - 1];
    if (last && addDays(last.to, 1) === date) last.to = date;
    else runs.push({ from: date, to: date });
  }
  return runs;
}

/**
 * A swept range turned into the spans it produces.
 *
 * The id is derived from the span itself rather than generated, so the same
 * gesture yields the same id in a test as in the browser and nothing reads a
 * clock or a random source during an update.
 *
 * A spell of sickness broken by a day that refuses the mark is stored as more
 * than one span, and the statutory tiers are counted from a spell's own first
 * day (specs.md item 8) — so the days it was broken around are reported to the
 * user rather than absorbed silently.
 */
export function applyMark(
  intent: MarkIntent,
  existing: DaySpan[] = [],
): MarkResult {
  const { taken, skipped } = markableDays(intent, existing);
  const spans = runsOf(taken).map<DaySpan>((run) => ({
    id: `${intent.kind}-${run.from}-${run.to}`,
    kind: intent.kind,
    from: run.from,
    to: run.to,
  }));
  return { spans, skipped };
}

/**
 * How many days a span draws from its balance.
 *
 * Vacation counts its non-rest-days, sickness counts every day it ran across —
 * the rest days inside a spell are drawn from the balance though they are not
 * paid (specs.md item 8). A free rest day draws nothing: it is not an
 * entitlement (item 5). A part-day is a single-day span and is drawn in its own
 * proportion (items 7, 10).
 */
export function balanceDaysOf(span: DaySpan): number {
  if (span.kind === "freeRestDay") return 0;
  const { from, to } = orderDates(span.from, span.to);
  const days = eachDate(from, to);
  const counted =
    span.kind === "vacation" ? days.filter((d) => !isRestDay(d)) : days;
  return counted.length * (span.fraction ?? 1);
}

/** Whether a span runs past the month on screen, in either direction. The
 * calendar shows one month and clips it; the overflow is said in words rather
 * than truncated silently (specs.md item 8, Part 3). */
export function spanOverflow(
  span: DaySpan,
  monthStart: IsoDate,
  monthEnd: IsoDate,
) {
  const { from, to } = orderDates(span.from, span.to);
  return {
    before: compareIsoDate(from, monthStart) < 0,
    after: compareIsoDate(to, monthEnd) > 0,
  };
}
