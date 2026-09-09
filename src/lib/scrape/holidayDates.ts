import { toIsoDate, utcDate } from "@/lib/dates";
import type { IsoDate } from "@/lib/types";

/**
 * Reading the dates a holiday page prints.
 *
 * Both sources write a date the same way — `25.12`, `01.01.2026` — and both
 * carry more than one in a cell, so the reading is here rather than copied into
 * each parser.
 *
 * **A date is built in UTC and checked by reading it back.** `31.02` is a
 * string a page can print and is not a day, and a `Date` built from it rolls
 * silently into March; reading the parts back is what turns that into a
 * reported failure instead of a holiday on the wrong date (CLAUDE.md: dates are
 * built outside a local time zone).
 */
export function isoOfDayMonth(
  day: string,
  month: string,
  year: number,
): IsoDate | null {
  const date = utcDate(year, Number(month), Number(day));
  const iso = toIsoDate(date);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return iso;
}

/**
 * A date in a cell, as the Kol Zchut tables write one: with a year when the
 * date moves from year to year, and without when it does not.
 *
 * `hasYear` is what the caller needs to know, because a date printed without
 * one keeps the same day and month every year — which the user confirmed on
 * 2026-09-09 is exactly what the absence of a year on those pages means.
 */
export interface PrintedDate {
  day: string;
  month: string;
  year: number | null;
}

const DATE_IN_TEXT = /\b(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\b/g;

/** Every date printed in one cell, in the order the cell printed them. */
export function datesIn(text: string): PrintedDate[] {
  return [...text.matchAll(DATE_IN_TEXT)].map((match) => ({
    day: match[1],
    month: match[2],
    year: match[3] === undefined ? null : Number(match[3]),
  }));
}

/**
 * `עד` between two dates makes them the ends of a run and not two separate
 * holidays — `27.05.2026 עד 30.05.2026` is four days off, which is four
 * candidate dates and not two.
 */
export function isRange(text: string): boolean {
  return / עד /.test(text);
}

/**
 * `(נכון ל-2026)` beside a date with no year of its own.
 *
 * It is the source saying this particular date holds for that year only, which
 * is how the Christian and Druze pages mark the holidays that move — Easter and
 * everything counted from it. A cell carrying it is read for that year and for
 * no other, so asking for 2027 does not receive 2026's Easter under a 2027
 * date, which is a wrong answer that looks entirely ordinary.
 */
const AS_OF = /\(נכון ל-(\d{4})\)/;

export function asOfYear(text: string): number | null {
  const match = AS_OF.exec(text);
  return match === null ? null : Number(match[1]);
}
