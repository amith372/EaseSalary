import { fetchCountryHolidays } from "@/lib/scrape/countryHolidays";
import type { Scraped } from "@/lib/scrape/failure";
import { fetchReligiousHolidays } from "@/lib/scrape/religiousHolidays";
import type { HolidayList, HolidaySource } from "@/lib/holidayLists";

/**
 * One source's list for one year, whichever kind of source it is (specs.md
 * item 10, decided with the user on 2026-09-09).
 *
 * **The two kinds are one choice to the user and must be one call to a
 * caller.** A country's list is one page per year and a religion's is one page
 * for every year it knows, so the two fetches genuinely differ — but the screen
 * that asks has a `HolidaySource` and no business knowing which shape it is,
 * and a caller that branched would be a second place the pair could drift.
 *
 * `stored` is the whole table for the same reason both fetches take it: the
 * address a country's next year is fetched at comes from a list it already has,
 * and the length of what came back is judged against the same source's nearest
 * stored year (item 12).
 */
export function fetchHolidayList(
  stored: HolidayList[],
  source: HolidaySource,
  year: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Scraped<HolidayList>> {
  return source.kind === "country"
    ? fetchCountryHolidays(stored, source.code, year, fetchImpl)
    : fetchReligiousHolidays(stored, source.religion, year, fetchImpl);
}
