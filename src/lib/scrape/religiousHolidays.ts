import { parse } from "node-html-parser";

import { addDays, compareIsoDate } from "@/lib/dates";
import { byDate } from "@/lib/holidayLists";
import type { Holiday, HolidayList, Religion } from "@/lib/holidayLists";
import { checkListPlausible } from "@/lib/scrape/countryHolidays";
import { fetchPage, scrapeFailed } from "@/lib/scrape/failure";
import type { Scraped } from "@/lib/scrape/failure";
import {
  asOfYear,
  datesIn,
  isRange,
  isoOfDayMonth,
} from "@/lib/scrape/holidayDates";
import type { IsoDate } from "@/lib/types";

/**
 * The holidays of a religion, as a second kind of candidate list beside a
 * country's (item 10, decided with the user on 2026-09-09).
 *
 * **One page per religion and not one per year.** A country's list is published
 * a year at a time and its address carries the year; these four pages carry
 * every year they know, so the year is a filter over what the page says rather
 * than part of the address — which is the whole of the difference between this
 * scrape and the country one, and the reason they are two files.
 *
 * **A date printed with no year applies to every year, and one printed with a
 * year applies to that year alone.** The Christian and Druze pages write most
 * of their holidays as a day and a month, because those do not move; the ones
 * that do move carry either a full date or the words `(נכון ל-2026)` beside
 * them. Reading the two the same way would hand a caller asking for 2027 the
 * 2026 date of Easter, restamped, which is a wrong answer that looks like an
 * ordinary one.
 *
 * **The rite is kept in the name.** The Christian page publishes each holiday
 * twice, in a Catholic column and an Orthodox one, and the two are weeks apart.
 * Both are offered — the user picks the nine days she pays — and the column's
 * own heading is appended to the name, so nothing is merged and nothing is
 * silently dropped.
 */

const KOL_ZCHUT = "https://www.kolzchut.org.il/he";

/** The four pages, and the Hebrew name of each for the picker. */
export const religiousSources: Record<
  Religion,
  { url: string; nameHe: string }
> = {
  jewish: { url: `${KOL_ZCHUT}/חגים_יהודיים`, nameHe: "חגים יהודיים" },
  muslim: { url: `${KOL_ZCHUT}/חגים_מוסלמיים`, nameHe: "חגים מוסלמיים" },
  christian: { url: `${KOL_ZCHUT}/חגים_נוצריים`, nameHe: "חגים נוצריים" },
  druze: { url: `${KOL_ZCHUT}/חגים_דרוזיים`, nameHe: "חגים דרוזיים" },
};

/**
 * Kol Zchut's own table class, which every one of the four pages uses. The
 * first row is headings, the first cell of every other row is the holiday's
 * name, and every cell after it holds dates.
 */
const TABLE = "table.wikitable";

/** A run of days is at most this long before the cell is read as two dates
 * rather than as a range — the longest the four pages publish is four days,
 * and a range longer than a fortnight is a `עד` this parser has misread. */
const LONGEST_RANGE = 14;

function expand(from: IsoDate, to: IsoDate): IsoDate[] | null {
  if (compareIsoDate(from, to) > 0) return null;
  const days: IsoDate[] = [];
  for (let at = from; compareIsoDate(at, to) <= 0; at = addDays(at, 1)) {
    days.push(at);
    if (days.length > LONGEST_RANGE) return null;
  }
  return days;
}

/**
 * The dates one cell contributes to one year, or `null` if the cell holds none
 * for that year.
 *
 * A cell is one holiday's dates in one column, so the three shapes it can take
 * are all read here: a run of days written `X עד Y`, one or more separate
 * dates, and a date qualified by the year it holds for.
 */
function datesForYear(text: string, year: number): IsoDate[] {
  const asOf = asOfYear(text);
  if (asOf !== null && asOf !== year) return [];

  // A `(נכון ל-2026)` carries a four-digit number of its own, which the date
  // reader would otherwise offer as a date's year, so the qualifier is removed
  // before the cell is read.
  const dates = datesIn(text.replace(/\(נכון ל-\d{4}\)/g, ""))
    .filter((date) => date.year === null || date.year === year)
    .map((date) => isoOfDayMonth(date.day, date.month, date.year ?? year))
    .filter((iso): iso is IsoDate => iso !== null);

  if (dates.length === 2 && isRange(text)) {
    return expand(dates[0], dates[1]) ?? dates;
  }
  return dates;
}

/**
 * The whole of the reading, over a string, so the suite never touches the
 * network (Part 4).
 *
 * **A year the page does not cover comes back empty, and empty is a failure**
 * — the same rule a country's list follows, and for the same reason: the
 * Jewish page publishes two years at a time, so asking it for a third answers
 * nothing, and storing that would record "this religion has no holidays in
 * 2029" rather than "this page does not go that far yet".
 */
export function parseReligiousHolidaysPage(
  html: string,
  year: number,
): Scraped<Holiday[]> {
  if (html.trim() === "") return scrapeFailed("unreachable", "empty body");

  const table = parse(html).querySelector(TABLE);
  if (table === null) {
    return scrapeFailed("notFound", "the page carries no wikitable");
  }

  const rows = table.querySelectorAll("tr");
  const headings = (rows[0]?.querySelectorAll("th, td") ?? []).map((cell) =>
    cell.textContent.replace(/\s+/g, " ").trim(),
  );
  if (headings.length < 2) {
    return scrapeFailed("notFound", "the table has no columns of dates");
  }

  const holidays: Holiday[] = [];
  for (const row of rows.slice(1)) {
    const cells = row.querySelectorAll("th, td");
    const name = cells[0]?.textContent.replace(/\s+/g, " ").trim() ?? "";
    if (name === "") continue;
    for (let column = 1; column < cells.length; column += 1) {
      const text = cells[column].textContent.replace(/\s+/g, " ").trim();
      for (const date of datesForYear(text, year)) {
        holidays.push({ date, name: nameWithColumn(name, headings, column, cells.length) });
      }
    }
  }

  if (holidays.length === 0) {
    return scrapeFailed(
      "notFound",
      `the page carries no dates in ${year}`,
    );
  }
  return { ok: true, value: byDate(holidays) };
}

/**
 * The column's heading appended to the name, but only where the table has more
 * than one column of dates.
 *
 * The Christian page's two columns are two rites of the same holiday and the
 * user has to be able to tell them apart; the Jewish page's two columns are two
 * Hebrew years whose dates already say which year they are, and appending
 * `בשנת תשפ"ו (2026-2025)` to every name would be noise. The rule is therefore
 * the shape of the table and not a list of pages.
 */
function nameWithColumn(
  name: string,
  headings: string[],
  column: number,
  columns: number,
): string {
  if (columns <= 2) return name;
  const heading = headings[column];
  if (heading === undefined || heading === "") return name;
  if (/\d{4}/.test(heading)) return name;
  return `${name} — ${heading}`;
}

/**
 * Fetch one religion's list for one year.
 *
 * `stored` is handed in for the same reason the country scrape takes it: the
 * length of what came back is judged against the nearest year already stored
 * for the same source, and a religion nobody has fetched before has none, so it
 * is believed if it is not empty.
 */
export async function fetchReligiousHolidays(
  stored: HolidayList[],
  religion: Religion,
  year: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Scraped<HolidayList>> {
  const source = { kind: "religion", religion } as const;
  const { url, nameHe } = religiousSources[religion];

  const page = await fetchPage(url, fetchImpl);
  if (!page.ok) return page;

  const parsed = parseReligiousHolidaysPage(page.value, year);
  if (!parsed.ok) return parsed;

  const implausible = checkListPlausible(parsed.value, stored, { source, year });
  if (implausible !== null) return { ok: false, failure: implausible };

  return {
    ok: true,
    value: { source, year, sourceUrl: url, nameHe, holidays: parsed.value },
  };
}
