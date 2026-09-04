import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * Month arithmetic, built in UTC and nowhere else.
 *
 * Two traps from specs.md Part 5 are why this file exists rather than the code
 * calling `new Date(...)` where it needs one. A date constructed in local time
 * can shift by a whole day across a daylight-saving boundary and silently
 * change how many rest days a month has; and in JavaScript Saturday is six, not
 * five, so being one off there corrupts every month of the year rather than
 * announcing itself.
 */

/**
 * In JavaScript `getUTCDay()` counts Sunday as 0, so Saturday is 6.
 *
 * Three of these are the only days the law allows as the weekly rest day
 * (specs.md item 5), and Thursday is here because it is the rest-eve of one of
 * them — those four are every weekday the application ever has to name.
 */
export const SUNDAY = 0;
export const THURSDAY = 4;
export const FRIDAY = 5;
export const SATURDAY = 6;

/** The week begins on Sunday, and in a right-to-left calendar Sunday sits on
 * the right. The grid is built in this order and the layout reverses it. */
export const WEEK_LENGTH = 7;

/** `month` is 1-12. */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function toIsoDate(date: Date): IsoDate {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return utcDate(y, m, d);
}

export function isoOf(ym: YearMonth, day: number): IsoDate {
  return toIsoDate(utcDate(ym.year, ym.month, day));
}

export function monthOf(iso: IsoDate): YearMonth {
  const date = fromIsoDate(iso);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function sameMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Day 0 of the following month is the last day of this one. */
export function daysInMonth(ym: YearMonth): number {
  return new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();
}

/** 0 for Sunday through 6 for Saturday. */
export function weekdayOf(iso: IsoDate): number {
  return fromIsoDate(iso).getUTCDay();
}

export function weekdayOfFirst(ym: YearMonth): number {
  return utcDate(ym.year, ym.month, 1).getUTCDay();
}

/**
 * The weekly rest day of one employment.
 *
 * The law allows only these three, whichever the worker holds as her own — a
 * Catholic Filipina worker may ask for Sunday and a Muslim worker for Friday,
 * and it is her right, while for a Jewish worker it is always Saturday
 * (specs.md item 5). Written as a union of the three rather than as a number,
 * so a fourth day cannot be stored: item 5 says the profile refuses any other
 * day, and a type that cannot hold one is the cheapest way to keep that true.
 */
export type RestDay = typeof SUNDAY | typeof FRIDAY | typeof SATURDAY;

/** Saturday, which is the common choice rather than the legal one (item 5).
 * The default lives with the profile that applies it, not in the engine, which
 * always reads the day off the month. */
export const DEFAULT_REST_DAY: RestDay = SATURDAY;

/**
 * The working day immediately before the weekly rest day — where the rest-eve
 * supplement falls (specs.md item 14).
 *
 * Friday for the Saturday rest day of the common case, Saturday for a
 * Sunday-resting worker and Thursday for a Friday-resting one. It is called the
 * rest-eve and not the Friday because Friday is only where it lands for most
 * workers and not what it is.
 */
export function restEveOf(restDay: RestDay): number {
  return (restDay + WEEK_LENGTH - 1) % WEEK_LENGTH;
}

export function isRestDay(iso: IsoDate, restDay: RestDay): boolean {
  return weekdayOf(iso) === restDay;
}

export function isRestEve(iso: IsoDate, restDay: RestDay): boolean {
  return weekdayOf(iso) === restEveOf(restDay);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = fromIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function addMonths(ym: YearMonth, months: number): YearMonth {
  const zeroBased = ym.year * 12 + (ym.month - 1) + months;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/**
 * Negative when the month `a` falls before the month `b`.
 *
 * Written here beside `compareIsoDate` rather than in each caller, because two
 * modules ordering months separately is two chances for one of them to compare
 * the month before the year — which sorts December 2025 after January 2026 and
 * produces balances and ledgers that are merely wrong.
 */
export function compareMonth(a: YearMonth, b: YearMonth): number {
  return a.year - b.year || a.month - b.month;
}

/** Negative when `a` falls before `b`. ISO dates sort lexicographically, which
 * is the whole reason the application holds them as strings. */
export function compareIsoDate(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Ordered by date, never by screen position: in a right-to-left calendar a
 * leftward drag moves forward in time, so a span keyed off column index or
 * clientX inverts (specs.md Part 5). */
export function orderDates(a: IsoDate, b: IsoDate): { from: IsoDate; to: IsoDate } {
  return compareIsoDate(a, b) <= 0 ? { from: a, to: b } : { from: b, to: a };
}

/** Every date from `from` to `to` inclusive. */
export function eachDate(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let d = from; compareIsoDate(d, to) <= 0; d = addDays(d, 1)) dates.push(d);
  return dates;
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = fromIsoDate(to).getTime() - fromIsoDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function everyDayOf(ym: YearMonth): IsoDate[] {
  return eachDate(isoOf(ym, 1), isoOf(ym, daysInMonth(ym)));
}

export function restDaysOf(ym: YearMonth, restDay: RestDay): IsoDate[] {
  return everyDayOf(ym).filter((date) => isRestDay(date, restDay));
}

/**
 * The month laid out as whole Sunday-first weeks, with `null` for the cells
 * before the 1st and after the last day. The leading blanks are derived from
 * the weekday of the 1st and are never a constant: a 31-day month beginning on
 * a Saturday holds five Saturdays and 26 working days, while the same length
 * beginning on a Sunday holds four and 27 (specs.md Part 5). The same is true
 * of any other rest day; Saturday is only the case Part 5 writes out.
 */
export function monthGrid(ym: YearMonth): (IsoDate | null)[] {
  const leading = weekdayOfFirst(ym);
  const days = everyDayOf(ym);
  const cells: (IsoDate | null)[] = [...Array<null>(leading).fill(null), ...days];
  while (cells.length % WEEK_LENGTH !== 0) cells.push(null);
  return cells;
}
