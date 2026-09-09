import { parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";

import {
  addressForYear,
  byDate,
  nearestStoredYear,
} from "@/lib/holidayLists";
import type { Holiday, HolidayList } from "@/lib/holidayLists";
import { fetchPage, scrapeFailed } from "@/lib/scrape/failure";
import type { ScrapeFailure, Scraped } from "@/lib/scrape/failure";
import { isoOfDayMonth } from "@/lib/scrape/holidayDates";

/**
 * A country's holiday list for one calendar year, read from the page that
 * publishes it (specs.md item 12, Part 3).
 *
 * **The address is the stored one with its year changed, and is never rebuilt
 * from the country code** (Part 5). That is why `fetchCountryHolidays` takes a
 * stored list rather than a country code: a code is not enough to reach a page,
 * and a function that took one would have to invent the rest of the address.
 *
 * **An empty list is a failed fetch and not a country that publishes no
 * holidays.** The source answers 200 with an empty page for an address it does
 * not know — `.../holidays/UK/2026` returns a heading reading
 * `חגים לאומיים - - 2026`, with no country name between the dashes and no rows
 * under it — and that is exactly what a mistyped code produces. Believing it
 * would store "this country has no holidays" and the mistake would surface half
 * a year later, the first time someone added a worker from that country.
 *
 * **This runs on the server**, as every scrape here does: the text is cached in
 * Postgres beside what was taken from it, and the browser never reaches the
 * source.
 */

/**
 * Each holiday is a `strong` carrying an id of its own, with the date in the
 * `small` immediately before it. The id prefix is the handle because it is the
 * page's own identifier for a holiday row and belongs to nothing else on the
 * page, where the two class names are a theme's and are shared with the
 * furniture around them.
 */
const HOLIDAY_NAME = "strong[id^=holiday-day-]";
const HOLIDAY_DATE = "small";

/** `01.01.2026`, as the page writes it. */
const FULL_DATE = /\b(\d{2})\.(\d{2})\.(\d{4})\b/;

/**
 * The page's own heading, `חגים לאומיים - הפיליפינים - 2026`, which is what
 * tells the two empty pages apart.
 *
 * **A page with no rows can mean two different things and the user is told
 * which.** An address the source does not know still answers 200, with this
 * heading and nothing between its dashes — `חגים לאומיים - - 2026` — which is
 * what a mistyped country code produces and is a failed fetch of a list that
 * exists elsewhere. A heading that names the country over a page with no rows
 * is the other thing entirely: the markup moved and this parser is stale. Both
 * are refusals, but only one of them is a defect here, and collapsing them
 * would send whoever reads the log looking in the wrong place.
 *
 * The year the heading carries is matched but not checked: every row's date is
 * checked against the year that was asked for, which is the stricter test of
 * the same thing and catches a page whose heading is right and one of whose
 * rows is not.
 */
const HEADING = /חגים לאומיים\s*-\s*(.*?)\s*-\s*\d{4}/;

/**
 * How far a year's count may sit from the nearest stored year's before the list
 * is disbelieved (Part 3: a holiday list of implausible length is a failed
 * fetch), decided with the user on 2026-09-09.
 *
 * **The range is the source's own history and not a pair of numbers written
 * here**, which is the same rule the wage check follows and for the same
 * reason: a bound invented in the code is a figure with nothing behind it. A
 * country with no other stored year is believed if it is not empty, because
 * item 12 requires a year with no list to fill itself and there is nothing yet
 * to compare it against — the wage refuses in that position only because its
 * table always ships seeded and a religion's or a new country's list does not.
 *
 * **Half to twice is wide on purpose.** The shipped years run from eleven
 * holidays to fifty, and a source that revises its own list moves it by one or
 * two — Sri Lanka's 2026 list has gained one since it was saved. What this
 * catches is the order-of-magnitude answer: a page that returned a fragment, or
 * a parser that matched something repeated across the furniture.
 */
const MIN_PLAUSIBLE_SHARE = 0.5;
const MAX_PLAUSIBLE_SHARE = 2;

/**
 * The nearest preceding sibling that carries the date.
 *
 * The page is a flat run of `hr`, `small`, `strong`, so each holiday's date is
 * the `small` before its name. Read that way rather than by pairing two lists
 * of equal length off their positions: both answer the same on this page, and
 * on a page that had gained a `small` anywhere the pairing would silently shift
 * every date by one while this reports the row it could not read.
 */
function dateBefore(name: HTMLElement): string | null {
  const siblings = name.parentNode?.childNodes ?? [];
  const index = siblings.indexOf(name);
  for (let i = index - 1; i >= 0; i -= 1) {
    const node = siblings[i] as HTMLElement;
    if (node.tagName === undefined) continue;
    if (node.tagName.toLowerCase() === HOLIDAY_DATE) return node.textContent;
    // Another holiday's name before a date of our own means the row this name
    // belongs to has no date in it.
    if (node.tagName.toLowerCase() === "strong") return null;
  }
  return null;
}

/**
 * Whether a fetched list is believable, judged against the nearest year already
 * stored for the same source.
 *
 * **The empty list is not judged here, because it never reaches here.** Both
 * parsers refuse a page they read no holidays out of, and each says which of
 * the two empty pages it saw — a template that moved, or an address the source
 * does not know. A second emptiness check in this function would be a branch no
 * page can reach and a third, vaguer answer to a question already answered.
 *
 * **A source with no other stored year is believed.** Item 12 requires a year
 * with no list to fill itself, and a country nobody has fetched before, or any
 * of the four religious pages, has nothing yet to compare against; the wage
 * check refuses in that position only because its table always ships seeded.
 */
export function checkListPlausible(
  holidays: Holiday[],
  stored: HolidayList[],
  fetched: Pick<HolidayList, "source" | "year">,
): ScrapeFailure | null {
  const baseline = nearestStoredYear(stored, fetched.source, fetched.year);
  if (baseline === null) return null;
  const known = baseline.holidays.length;
  if (known === 0) return null;
  if (
    holidays.length < known * MIN_PLAUSIBLE_SHARE ||
    holidays.length > known * MAX_PLAUSIBLE_SHARE
  ) {
    return {
      kind: "implausible",
      detail: `${holidays.length} holidays against the ${known} stored for ${baseline.year}`,
    };
  }
  return null;
}

/**
 * The whole of the reading, over a string, so the suite never touches the
 * network (Part 4) and the fetch below has nothing in it but the request.
 *
 * **Every date must fall inside the year that was asked for.** The year is a
 * segment of the address, so a row dated outside it means the page that came
 * back is not the page that was requested — a year swap that went wrong, or a
 * source that redirected — and reporting that is worth more than silently
 * keeping whichever rows happened to match.
 */
export function parseCountryHolidaysPage(
  html: string,
  year: number,
): Scraped<Holiday[]> {
  if (html.trim() === "") return scrapeFailed("unreachable", "empty body");

  const page = parse(html);

  const heading = page.querySelector("h1");
  const named = heading === null ? null : HEADING.exec(heading.textContent);
  if (named === null) {
    return scrapeFailed("notFound", "the page carries no holiday-list heading");
  }
  if (named[1] === "") {
    return scrapeFailed(
      "implausible",
      "the heading names no country, which is the answer the source gives for an address it does not know",
    );
  }

  const rows = page.querySelectorAll(HOLIDAY_NAME);
  const holidays: Holiday[] = [];
  for (const row of rows) {
    const dateText = dateBefore(row);
    if (dateText === null) {
      return scrapeFailed(
        "notFound",
        `the holiday "${row.textContent.trim()}" has no date beside it`,
      );
    }
    const match = FULL_DATE.exec(dateText);
    if (match === null) {
      return scrapeFailed("notFound", `unreadable date "${dateText.trim()}"`);
    }
    const [, day, month, published] = match;
    if (Number(published) !== year) {
      return scrapeFailed(
        "notFound",
        `the page answered for ${published} and ${year} was asked for`,
      );
    }
    const date = isoOfDayMonth(day, month, year);
    if (date === null) {
      return scrapeFailed("notFound", `impossible date "${dateText.trim()}"`);
    }
    // The name is the element's first text node and not the element's text.
    // The two read the same today, because the span the page nests inside each
    // name is empty; they stop reading the same the day the source puts a badge
    // in it, and then the badge would travel into the stored name.
    const name = row.childNodes[0]?.textContent.trim() ?? "";
    if (name === "") {
      return scrapeFailed("notFound", `a holiday on ${date} has no name`);
    }
    holidays.push({ date, name });
  }
  if (holidays.length === 0) {
    return scrapeFailed(
      "notFound",
      `the page is headed "${named[1]}" and carries no holidays, so the markup has moved`,
    );
  }
  return { ok: true, value: byDate(holidays) };
}

/**
 * Fetch one country's list for one year, from the address stored with that
 * country's own list.
 *
 * `stored` is the whole table and not one list, because both halves of the work
 * read it: the address comes from a list for this country in another year, and
 * so does the length the answer is judged against.
 */
export async function fetchCountryHolidays(
  stored: HolidayList[],
  code: string,
  year: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Scraped<HolidayList>> {
  const source = { kind: "country", code } as const;
  const known = nearestStoredYear(stored, source, year);
  if (known === null) {
    return scrapeFailed(
      "notFound",
      `no stored list for ${code} to take an address from`,
    );
  }
  const url = addressForYear(known.sourceUrl, known.year, year);
  if (url === null) {
    return scrapeFailed(
      "notFound",
      `the stored address ${known.sourceUrl} carries no ${known.year} to change`,
    );
  }

  const page = await fetchPage(url, fetchImpl);
  if (!page.ok) return page;

  const parsed = parseCountryHolidaysPage(page.value, year);
  if (!parsed.ok) return parsed;

  const implausible = checkListPlausible(parsed.value, stored, { source, year });
  if (implausible !== null) return { ok: false, failure: implausible };

  return {
    ok: true,
    value: {
      source,
      year,
      sourceUrl: url,
      nameHe: known.nameHe,
      holidays: parsed.value,
    },
  };
}
