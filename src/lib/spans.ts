import {
  addDays,
  compareIsoDate,
  daysInMonth,
  eachDate,
  isoOf,
  isRestDay,
  orderDates,
} from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import type {
  ClosedDaySpan,
  DaySpan,
  IsoDate,
  MarkKind,
  YearMonth,
} from "@/lib/types";

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
  /**
   * The spans to add. A range broken by a skipped day yields one span per
   * surviving run, so what is stored is exactly what is marked.
   *
   * Always closed: a swept range has both ends by definition. An open spell is
   * recorded by a different gesture — "she fell ill today", with no return date
   * asked for (specs.md item 8) — which the month screen builds in stage 4.
   */
  spans: ClosedDaySpan[];
  skipped: SkippedDay[];
}

/** Which day a rest-day rule refuses, before any conflict with an existing span
 * is considered: the entitlement rule is the more informative answer, and it
 * holds whether or not the day is already marked. */
function refusedByKind(
  kind: MarkKind,
  date: IsoDate,
  restDay: RestDay,
): SkipReason | null {
  if (kind === "vacation" && isRestDay(date, restDay)) return "weeklyRest";
  if (kind === "freeRestDay" && !isRestDay(date, restDay)) return "notRestDay";
  return null;
}

/**
 * The last day a span covers where it is being read.
 *
 * An open sick spell has not ended, so on screen it runs to the end of whatever
 * window is being drawn and in a calculation to the last day that month counts
 * it to (specs.md item 8). The window is the caller's to name, which is what
 * keeps this free of a clock.
 */
export function endOf(span: DaySpan, openEnd: IsoDate): IsoDate {
  if (span.to !== null) return span.to;
  // **Never backwards.** A window that ends before the spell began contains
  // none of it, and returning that window's end would hand `orderDates` an
  // inverted range — which it silently puts the right way round, so a spell
  // starting on the 20th would come back covering the 10th. The failure is
  // invisible at the call site and entirely plausible in the output, which is
  // why it is closed here rather than at each of the four callers.
  return compareIsoDate(openEnd, span.from) < 0 ? span.from : openEnd;
}

function coveringSpan(
  spans: DaySpan[],
  date: IsoDate,
  openEnd: IsoDate,
): DaySpan | undefined {
  return spans.find((span) => {
    const { from, to } = orderDates(span.from, endOf(span, openEnd));
    return compareIsoDate(date, from) >= 0 && compareIsoDate(date, to) <= 0;
  });
}

/**
 * The days of the range that take the mark, and the days that do not with the
 * reason each was refused. Dates are ordered before anything else is decided:
 * in a right-to-left calendar a leftward drag moves forward in time, so a range
 * that trusted the order it arrived in would invert (specs.md Part 5).
 */
export function markableDays(
  intent: MarkIntent,
  restDay: RestDay,
  existing: DaySpan[] = [],
) {
  const { from, to } = orderDates(intent.from, intent.to);
  const taken: IsoDate[] = [];
  const skipped: SkippedDay[] = [];

  for (const date of eachDate(from, to)) {
    const refused = refusedByKind(intent.kind, date, restDay);
    if (refused) {
      skipped.push({ date, reason: refused });
      continue;
    }
    // An open spell already covers this day if it began before it, so a mark
    // swept over one is refused as `alreadyMarked` rather than layered on top.
    const covering = coveringSpan(existing, date, date);
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
  restDay: RestDay,
  existing: DaySpan[] = [],
): MarkResult {
  const { taken, skipped } = markableDays(intent, restDay, existing);
  const spans = runsOf(taken).map<ClosedDaySpan>((run) => ({
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
export function balanceDaysOf(span: ClosedDaySpan, restDay: RestDay): number {
  if (span.kind === "freeRestDay") return 0;
  const { from, to } = orderDates(span.from, span.to);
  const days = eachDate(from, to);
  const counted =
    span.kind === "vacation"
      ? days.filter((d) => !isRestDay(d, restDay))
      : days;
  return counted.length * (span.fraction ?? 1);
}

/**
 * Whether a span has any day inside the month.
 *
 * An open spell has no last day, so it overlaps every month from the one it
 * began in onward: a spell nobody closed goes on drawing sick days month after
 * month, which is what an unclosed spell means (`specs.md` item 8). The closed
 * case is ordered before it is compared, because a range that arrived backwards
 * would otherwise overlap nothing at all and simply vanish from the month — a
 * mark the user made and cannot see (Part 5).
 *
 * It lives here rather than in the repository, which was where it began: the
 * store is one caller of it and the two screens that draw a calendar are the
 * others, and a client component reaching into the repository for it would pull
 * a store into the browser to answer a question about dates.
 */
export function overlapsMonth(span: DaySpan, month: YearMonth): boolean {
  const monthStart = isoOf(month, 1);
  const monthEnd = isoOf(month, daysInMonth(month));
  if (span.to === null) return compareIsoDate(span.from, monthEnd) <= 0;
  const { from, to } = orderDates(span.from, span.to);
  return (
    compareIsoDate(from, monthEnd) <= 0 && compareIsoDate(to, monthStart) >= 0
  );
}

/** Whether a span runs past the month on screen, in either direction. The
 * calendar shows one month and clips it; the overflow is said in words rather
 * than truncated silently (specs.md item 8, Part 3). */
export function spanOverflow(
  span: DaySpan,
  monthStart: IsoDate,
  monthEnd: IsoDate,
) {
  const { from, to } = orderDates(span.from, endOf(span, monthEnd));
  return {
    before: compareIsoDate(from, monthStart) < 0,
    // An open spell has not ended, so it always runs past the month on screen —
    // there is no last day for it to stop at (item 8).
    after: span.to === null || compareIsoDate(to, monthEnd) > 0,
  };
}
