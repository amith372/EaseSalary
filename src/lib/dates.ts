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
function weekdayOf(iso: IsoDate): number {
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

/**
 * A month written as `YYYY-MM`, or `null` when the text is not one.
 *
 * The two month selects on the payments screen hand their choice up as this,
 * and a server action is reachable by a crafted request — so the shape is
 * checked here rather than trusted from the form (specs.md Part 3). It is
 * deliberately strict about the padding: `2026-9` and `2026-09` would otherwise
 * be two spellings of one month, and a stored month that round-trips to a
 * different string is one the sheet's own row label cannot be compared against.
 *
 * Month 0 and month 13 are refused rather than normalised. `addMonths` would
 * happily carry either into the neighbouring year, and a period silently moved
 * into a year the user did not choose is the sort of mistake that reads as
 * plausible on the row it lands on.
 */
export function parseYearMonth(text: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(text.trim());
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** A month as `YYYY-MM` — what `parseYearMonth` reads, so a month written by
 * one and read by the other is the same month. */
export function yearMonthText(ym: YearMonth): string {
  return `${String(ym.year).padStart(4, "0")}-${String(ym.month).padStart(2, "0")}`;
}

/**
 * Every month from `from` to `to` inclusive, the way `eachDate` gives every
 * date. Empty when `to` falls before `from`, which lets a caller order the pair
 * itself and be refused rather than silently corrected: which way round the
 * user meant a period is not the application's to decide (specs.md item 16).
 */
export function eachMonth(from: YearMonth, to: YearMonth): YearMonth[] {
  const months: YearMonth[] = [];
  for (let m = from; compareMonth(m, to) <= 0; m = addMonths(m, 1)) months.push(m);
  return months;
}

/**
 * The last calendar quarter that had ended before `month` began.
 *
 * The national insurance is paid once a quarter and in arrears (specs.md item
 * 19), so this is the period a payment recorded in a given month is *offered* —
 * an offer and never a rule, since a family that paid late still chooses the
 * quarter it was actually for.
 *
 * **It is the last quarter to have ended and not the three months before**, and
 * the difference shows up exactly when a payment is late: recorded in April the
 * two agree on January–March, but recorded in May the three preceding months
 * are February–April, which is no quarter anyone is billed for. Quarters are
 * the calendar's, so a payment made in the middle of one is still for the last
 * one that closed.
 */
export function previousQuarter(month: YearMonth): {
  from: YearMonth;
  to: YearMonth;
} {
  const quarter = Math.floor((month.month - 1) / 3);
  const previous = quarter === 0 ? 3 : quarter - 1;
  const year = quarter === 0 ? month.year - 1 : month.year;
  return {
    from: { year, month: previous * 3 + 1 },
    to: { year, month: previous * 3 + 3 },
  };
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

/**
 * Whether the calendar month is over — its last day is behind `today`.
 *
 * **This is criterion 21's whole condition**, and it is named for what it tests
 * rather than for what the export will do with it: a month can be filled in
 * ahead of time and can only be exported once it has ended, so the export asks
 * this and the month screen's warning asks the same one. Naming it
 * `isExportable` would be a promise this function cannot keep — confirming the
 * minimum wage (item 4) and answering the pre-export questions (item 18) are
 * conditions of an export too, and they are not date arithmetic.
 *
 * **The month still running has not ended either.** The last day of the current
 * month is not behind today until it is, which is the same boundary a month
 * years ahead crosses, and one boundary is what keeps a month from becoming
 * exportable on its own final morning.
 */
export function monthHasEnded(ym: YearMonth, today: IsoDate): boolean {
  return compareIsoDate(isoOf(ym, daysInMonth(ym)), today) < 0;
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
