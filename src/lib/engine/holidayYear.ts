import { compareIsoDate, eachDate, fromIsoDate, isRestDay } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import type { MonthSpan } from "@/lib/engine/types";
import type { Holiday } from "@/lib/holidayLists";
import { dayParts, touchesRange } from "@/lib/spans";
import type { IsoDate } from "@/lib/types";

/**
 * One worker's holiday year as the picker shows it: the candidate dates, the
 * ones they have chosen, what the entitlement leaves, and whether one more may be
 * chosen (specs.md item 10).
 *
 * **It is a calculation and not a screen**, which is why it is here rather than
 * in the component: the quota it counts against is the same nine days
 * `validateMonth` refuses a tenth holiday against, and a picker that counted
 * its own would be a second arithmetic that agrees until the day one of them is
 * corrected. The screen draws what this returns and adds nothing to it.
 *
 * **The candidate list and the chosen dates are two different things.** The
 * candidates are what a source published — a country's or a religion's page for
 * that year — and the choice is the worker's: a date may be chosen that no
 * candidate names, because a date can be edited and because a fetch that failed
 * leaves the user typing the dates themselves (items 10 and 12). Such a date is a
 * row of its own with no published name beside it, and never a chosen date this
 * screen quietly forgets.
 */

/** The chosen day, as the store holds it — which span it belongs to, so the
 * screen can address it, and how much of the day it is. */
interface HolidayChoice {
  spanId: string;
  fraction: number;
}

/** One date the picker offers, chosen or not. */
export interface HolidayRow {
  date: IsoDate;
  /**
   * Exactly the name the source published, or `null` for a date the user
   * chose themselves. A null name is not a missing one: nobody published that
   * date, so there is nothing to show but the date.
   */
  name: string | null;
  chosen: HolidayChoice | null;
  /**
   * The entitlement is spent and this row cannot take another day (item 10).
   * Only ever set on a row that is not already chosen: unchoosing is what
   * makes room, so a chosen row is never blocked.
   */
  blocked: boolean;
  /**
   * The date is their weekly rest day (item 9).
   *
   * **It can still be chosen and is explained rather than refused.** A holiday
   * there is drawn on the calendar as a holiday and treated as one for nothing
   * else: the day is paid as the rest day it is, and it spends nothing from the
   * nine. A family choosing it without being told would read the quota not
   * moving as a mistake, so the row says why.
   */
  onRestDay: boolean;
}

export interface HolidayYear {
  /** Nine for a full year, less for a year only partly worked (item 10). */
  allowance: number;
  /** What has been chosen, a part day counting as its fraction. */
  chosenDays: number;
  remaining: number;
  /**
   * There is still something to choose, which is what "an incomplete selection
   * is visible at a glance" means (item 10).
   *
   * It is measured against the smallest part a day can be taken in rather than
   * against a whole day: an entitlement of 6.75 that has 6.5 chosen has a
   * quarter left that nothing can spend, and a screen that went on saying
   * "not all the days are chosen" over a remainder no gesture can reach would
   * be asking the user for something the application will not accept.
   */
  incomplete: boolean;
  /** Ordered by date, which is the order a year is read in. */
  rows: HolidayRow[];
  /** Their weekly rest day, carried so the screen can name it where it explains a
   * holiday that falls on it (item 5: it is a term of the employment, never
   * assumed to be Saturday). */
  restDay: RestDay;
}

/** The smallest a day can be taken in (`dayParts`), and therefore the smallest
 * remainder anything can still be chosen against. */
const SMALLEST_PART = Math.min(...dayParts);

/**
 * How much of a day the next choice takes: a whole one, or a half where only a
 * half is left.
 *
 * **The tick chooses the largest part that fits**, rather than always taking a
 * whole day and refusing the last half of a partly worked year's entitlement.
 * The alternative is a remainder the user can see and cannot spend, and working
 * out that they must first halve some other day to reach it is exactly the kind
 * of knowledge this application exists to hold for them (`CLAUDE.md`).
 */
export function partThatFits(remaining: number): number {
  return remaining >= 1 ? 1 : SMALLEST_PART;
}

/** Every holiday day the worker has chosen in that calendar year, a day of a
 * multi-day span counted as its own day — the entitlement counts days, not
 * spans (item 10). */
function chosenDaysOf(
  spans: MonthSpan[],
  year: number,
): Map<IsoDate, HolidayChoice> {
  const chosen = new Map<IsoDate, HolidayChoice>();
  for (const span of spans) {
    if (span.kind !== "holiday") continue;
    for (const date of eachDate(span.from, span.to)) {
      if (fromIsoDate(date).getUTCFullYear() !== year) continue;
      chosen.set(date, { spanId: span.id, fraction: span.fraction ?? 1 });
    }
  }
  return chosen;
}

export function holidayYear(
  candidates: Holiday[],
  spans: MonthSpan[],
  allowance: number,
  year: number,
  restDay: RestDay,
): HolidayYear {
  const chosen = chosenDaysOf(spans, year);
  // A chosen date on their weekly rest day spends nothing from the nine (item
  // 9), so it is left out of what has been spent — otherwise the quota would
  // fill with dates that can never be paid as holidays, and the family would be
  // refused a ninth they are still entitled to.
  const chosenDays = [...chosen.entries()]
    .filter(([date]) => !isRestDay(date, restDay))
    .reduce((total, [, choice]) => total + choice.fraction, 0);
  const remaining = Math.max(0, allowance - chosenDays);
  const full = remaining < SMALLEST_PART;

  const names = new Map<IsoDate, string>();
  for (const candidate of candidates) {
    if (fromIsoDate(candidate.date).getUTCFullYear() !== year) continue;
    names.set(candidate.date, candidate.name);
  }

  const dates = [...new Set([...names.keys(), ...chosen.keys()])].sort(
    compareIsoDate,
  );

  return {
    allowance,
    chosenDays,
    remaining,
    restDay,
    incomplete: !full,
    rows: dates.map((date) => {
      const choice = chosen.get(date) ?? null;
      return {
        date,
        name: names.get(date) ?? null,
        chosen: choice,
        // Never blocked on the rest day: choosing it spends nothing, so a full
        // quota is no reason to refuse it.
        blocked: choice === null && full && !isRestDay(date, restDay),
        onRestDay: isRestDay(date, restDay),
      };
    }),
  };
}

/**
 * Why a date could not be chosen, moved or taken in part. A refusal carries the
 * reason it was refused (specs.md item 25), so these are the keys of sentences
 * and never codes the user meets.
 */
export type HolidayRefusal =
  /** The entitlement for the year is spent (item 10). */
  | "holidayLimit"
  /** The date already carries a mark, and a day carrying two entries is what
   * `validateMonth` refuses as `dayRecordedTwice` — refused here instead, at
   * the gesture that would create it, so the user is told while they are looking
   * at the date rather than when a month later fails to calculate. */
  | "alreadyMarked"
  /** A typed date that is not a date, or one outside the year on screen — which
   * would be drawn from another year's entitlement without saying so. */
  | "date"
  /** A part of a day that is not one of the two the application offers. It can
   * only arrive from a crafted request, since the screen offers two chips — the
   * same reason `partIsAllowed` is checked on the server as well as drawn. */
  | "part";

type HolidayReview =
  | { ok: true; fraction: number }
  | { ok: false; reason: HolidayRefusal };

/**
 * Whether some span already covers the date. An open spell is closed at the
 * date itself, which is the window this question is asked in (`touchesRange`).
 *
 * **On their weekly rest day only another holiday counts** (item 9). A holiday
 * there is treated as a holiday for nothing, so a free rest day or a sick day
 * already recorded on that Saturday is not a second entry beside it — the day
 * is the rest day either way. Two holidays on one date are still two, because
 * the calendar would draw both.
 */
function alreadyCovered(
  spans: MonthSpan[],
  date: IsoDate,
  restDay: RestDay,
  exceptSpanId?: string,
): boolean {
  const onRestDay = isRestDay(date, restDay);
  return spans.some(
    (span) =>
      span.id !== exceptSpanId &&
      (!onRestDay || span.kind === "holiday") &&
      touchesRange(span, date, date),
  );
}

/** A date of this year. Text that is not a date at all answers `NaN` here and
 * is refused by the same comparison, which is why there is no second check for
 * it: the field is a date input and a crafted request is the only other way in. */
function inYear(date: IsoDate, year: number): boolean {
  return fromIsoDate(date).getUTCFullYear() === year;
}

/**
 * A date about to be chosen as a paid holiday, and how much of the day the
 * choice takes.
 *
 * The three checks are the three things that can be wrong with a date, in the
 * order the user would meet them: it is not a date of this year, something is
 * already recorded on it, or the year's entitlement is spent.
 */
export function reviewHolidayDate(
  date: IsoDate,
  year: number,
  spans: MonthSpan[],
  state: HolidayYear,
  restDay: RestDay,
): HolidayReview {
  if (!inYear(date, year)) return { ok: false, reason: "date" };
  if (alreadyCovered(spans, date, restDay)) {
    return { ok: false, reason: "alreadyMarked" };
  }
  // A date on their rest day spends nothing (item 9), so a full quota is no
  // reason to refuse it, and it is taken whole: there is no entitlement to take
  // a part of.
  if (isRestDay(date, restDay)) return { ok: true, fraction: 1 };
  if (state.remaining < SMALLEST_PART) {
    return { ok: false, reason: "holidayLimit" };
  }
  return { ok: true, fraction: partThatFits(state.remaining) };
}

/**
 * A chosen holiday moved to another date (specs.md item 10).
 *
 * Its own span is excluded from the collision check: a date is not already
 * marked by the very holiday being moved off it, which is what a move of one
 * day onto itself would otherwise report.
 */
export function reviewHolidayMove(
  date: IsoDate,
  year: number,
  spans: MonthSpan[],
  spanId: string,
  restDay: RestDay,
): { ok: true } | { ok: false; reason: HolidayRefusal } {
  if (!inYear(date, year)) return { ok: false, reason: "date" };
  if (alreadyCovered(spans, date, restDay, spanId)) {
    return { ok: false, reason: "alreadyMarked" };
  }
  // The quota is untouched by a move: the same fraction of the same one day is
  // drawn, on another date.
  return { ok: true };
}

/**
 * A chosen holiday taken in part, or restored to a whole day (item 10).
 *
 * Only the **increase** is checked against what is left, because the day is
 * already drawn at its current fraction: halving a day always fits, and
 * restoring one to a whole day fits only if the half it adds does.
 */
export function reviewHolidayPart(
  fraction: number,
  current: HolidayChoice,
  state: HolidayYear,
): { ok: true } | { ok: false; reason: HolidayRefusal } {
  if (!(dayParts as readonly number[]).includes(fraction)) {
    return { ok: false, reason: "part" };
  }
  const added = fraction - current.fraction;
  if (added > state.remaining) return { ok: false, reason: "holidayLimit" };
  return { ok: true };
}
