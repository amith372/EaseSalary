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
  /**
   * How much of the day was taken, where the sweep is one day of vacation
   * (specs.md item 7). Absent is a whole day, and so is `1`.
   */
  fraction?: number;
  /** The user's own words about the mark (specs.md item 5). Trimmed here, and
   * an empty one is no note at all. */
  note?: string;
}

/**
 * The two parts the picker offers, in the order it draws them.
 *
 * **Two and not a typed figure**, because item 7 says a day may be taken in
 * part and the family's workbook records halves; a field taking any proportion
 * would ask the user for a number where the question is which of two things
 * happened, and 0.37 of a vacation day is not a thing anyone means.
 */
export const dayParts = [1, 0.5] as const;

/**
 * Whether the part on an intent is one that intent may carry.
 *
 * **Only vacation, and only one day.** Item 7 gives the part-day to vacation
 * and item 10 to a holiday, which is not a mark at all — so of the three kinds
 * a sweep can produce, vacation is the only one, and sickness and a free rest
 * day are whole days. And `DaySpan.fraction` is set only where `from` and `to`
 * are equal (`types.ts`): half of a five-day range is not a thing the stored
 * shape can say.
 *
 * One rule read by all three of its readers rather than three that must agree:
 * the picker offers no kind this refuses, `applyMark` writes no fraction it
 * refuses, and the server action refuses the request outright — a server action
 * is reachable by a crafted request, which is the only way the combination can
 * arrive.
 */
export function partIsAllowed(intent: MarkIntent): boolean {
  const fraction = intent.fraction ?? 1;
  if (fraction === 1) return true;
  return (
    (dayParts as readonly number[]).includes(fraction) &&
    intent.kind === "vacation" &&
    intent.from === intent.to
  );
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
   * layered. **A day carrying a holiday is one of them**: the year's holidays
   * arrive drawn and the month records only whether she worked one (specs.md
   * item 9), so a mark swept over one is refused here rather than layered.
   *
   * There is no `restDayHoliday` beside it any more, and its absence is the
   * decision. A paid holiday landing on a free rest day is still refused — by
   * `validate.ts`, where the rule belongs now that the holiday can only arrive
   * from the year's chosen dates. It cannot arrive from a sweep, because
   * `MarkIntent.kind` is a `MarkKind` and a holiday is not one. */
  | "alreadyMarked";

export interface SkippedDay {
  date: IsoDate;
  reason: SkipReason;
}

/**
 * A span a sweep produced. **Never a holiday**, because the user does not mark
 * one (specs.md item 9) and `MarkIntent.kind` cannot say so — narrowing the
 * kind here is what lets the store take one of these without asking whether it
 * needs a `worked` beside it.
 */
export type MarkedSpan = ClosedDaySpan & { kind: MarkKind };

export interface MarkResult {
  /**
   * The spans to add. A range broken by a skipped day yields one span per
   * surviving run, so what is stored is exactly what is marked.
   *
   * Always closed: a swept range has both ends by definition. An open spell is
   * recorded by a different gesture — "she fell ill today", with no return date
   * asked for (specs.md item 8) — which the month screen builds in stage 4.
   */
  spans: MarkedSpan[];
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

/**
 * Whether a span has any day inside a range, the open case included.
 *
 * **Written once because it was written twice.** The home screen used it to
 * decide which spans a sweep clears and `month/actions.ts` to decide which the
 * store deletes, in four identical lines under two names — and the two answer
 * the same question about the same shape, so a correction to either was a
 * correction to half the application. It belongs here with `endOf`, which is
 * the part of it that is not obvious: an open spell has no `to`, and the range's
 * own end is what stands in for one.
 */
export function touchesRange(
  span: DaySpan,
  from: IsoDate,
  to: IsoDate,
): boolean {
  const ordered = orderDates(span.from, endOf(span, to));
  return (
    compareIsoDate(ordered.from, to) <= 0 && compareIsoDate(ordered.to, from) >= 0
  );
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
    if (coveringSpan(existing, date, date)) {
      skipped.push({ date, reason: "alreadyMarked" });
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
  // A part the intent may not carry falls back to a whole day rather than being
  // written: the picker never offers the combination and the server action
  // refuses it, so this is the floor under both and not the answer the user
  // gets. The note carries whatever the kind, because every action can carry
  // one (specs.md item 5).
  const fraction = partIsAllowed(intent) ? (intent.fraction ?? 1) : 1;
  const note = intent.note?.trim() ?? "";
  const spans = runsOf(taken).map<MarkedSpan>((run) => ({
    id: `${intent.kind}-${run.from}-${run.to}`,
    kind: intent.kind,
    from: run.from,
    to: run.to,
    ...(fraction === 1 ? {} : { fraction }),
    ...(note === "" ? {} : { note }),
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
