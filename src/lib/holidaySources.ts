import {
  religions,
  type HolidayList,
  type HolidaySource,
} from "@/lib/holidayLists";
import { religiousSources } from "@/lib/scrape/religiousHolidays";

/**
 * The lists the picker can offer, and the name each is offered under
 * (specs.md item 10).
 *
 * **A country and a faith are one choice with two kinds of answer** (decided
 * with the user on 2026-09-09), so they are gathered here rather than left to
 * the screen to assemble: two lists built in the component would be two places
 * where a source could be offered that nothing can fetch.
 *
 * **A country is offered only where a list of some year is already stored for
 * it**, and that is not a limitation to work around: a year's list is fetched
 * at the address stored *with* that country's own list, with the year in it
 * changed, and never at an address rebuilt from the code (Part 5). A country
 * with no stored list has no address, so offering it would offer a chip that
 * cannot answer. The four faiths are the other way round — each is one page for
 * every year it knows, at an address the application holds — so all four are
 * always offered.
 */

export interface HolidaySourceChoice {
  source: HolidaySource;
  /** Hebrew, as the shipped list or the page itself names it. */
  nameHe: string;
  /**
   * Whether this is the list the worker's year is drawn from.
   *
   * **Decided here and not in the chip**, because the chip is in the browser
   * and this file reads `data/holidays/*.json`: a client component that asked
   * `sameSource` would pull all six shipped lists into the bundle, which is
   * exactly what Part 3 means by sending nothing to the browser beyond the
   * screen that needs it.
   */
  selected: boolean;
}

/** Her own country first, then the rest by name, then the four faiths — the
 * order item 10 states them in: her country's list, with another selectable
 * instead, and a religion's in place of a country's. */
export function holidaySourceChoices(
  lists: HolidayList[],
  ownCountry: string,
  chosen: HolidaySource,
): { countries: HolidaySourceChoice[]; religions: HolidaySourceChoice[] } {
  const named = new Map<string, string>();
  for (const list of lists) {
    if (list.source.kind === "country") named.set(list.source.code, list.nameHe);
  }
  // Her own country stands even where nothing is stored for it, because it is
  // the list her year is drawn from by default and a picker that dropped it
  // would show her a chosen source with no chip selected. The code is the whole
  // of what is known about such a country's name.
  if (!named.has(ownCountry)) named.set(ownCountry, ownCountry);

  const countries = [...named]
    .sort(([a, aName], [b, bName]) => {
      if (a === ownCountry) return -1;
      if (b === ownCountry) return 1;
      return aName.localeCompare(bName, "he");
    })
    .map(([code, nameHe]) => ({
      source: { kind: "country", code } as const,
      nameHe,
      selected: chosen.kind === "country" && chosen.code === code,
    }));

  return {
    countries,
    religions: religions.map((religion) => ({
      source: { kind: "religion", religion } as const,
      nameHe: religiousSources[religion].nameHe,
      selected: chosen.kind === "religion" && chosen.religion === religion,
    })),
  };
}

/**
 * Which list a worker's year is drawn from: the one she was moved to, or her
 * own country's (specs.md item 10).
 *
 * It is derived and not a stored default, so a worker whose country is
 * corrected follows it, and one deliberately moved to a faith's list or to
 * another country's stays where she was put.
 *
 * It takes the two fields it reads rather than a whole profile, which is what
 * keeps this file clear of the repository — and therefore importable from a
 * `"use server"` module, where only asynchronous functions may be exported.
 */
export function holidaySourceOf(worker: {
  country: string;
  holidaySource?: HolidaySource;
}): HolidaySource {
  return worker.holidaySource ?? { kind: "country", code: worker.country };
}
