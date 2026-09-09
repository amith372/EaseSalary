import { describe, expect, it } from "vitest";

import { SEEDED_HOLIDAY_LISTS } from "@/lib/holidayLists";
import { countryPage, jewishPage } from "@/lib/scrape/holiday-pages.fixture";
import { fetchHolidayList } from "@/lib/scrape/holidayList";
import { religiousSources } from "@/lib/scrape/religiousHolidays";

/**
 * One call for both kinds of source (specs.md item 10).
 *
 * The pages are the ones saved on 2026-09-09 and the request is injected, so
 * the suite reads a file and never the network (Part 4).
 */

/** A fetch that answers one page and records the address it was asked for. */
function serving(html: string): typeof fetch & { asked: string[] } {
  const asked: string[] = [];
  const impl = (async (url: string | URL | Request) => {
    asked.push(String(url));
    return new Response(html, { status: 200 });
  }) as typeof fetch & { asked: string[] };
  impl.asked = asked;
  return impl;
}

describe("fetching one source's year", () => {
  /** The address is the stored one with its year changed, never rebuilt from
   * the code (Part 5) — which is the whole reason the dispatch takes the stored
   * table rather than a source alone. */
  it("asks a country's own stored address, with the year changed", async () => {
    const impl = serving(countryPage());
    await fetchHolidayList(
      SEEDED_HOLIDAY_LISTS,
      { kind: "country", code: "PH" },
      2027,
      impl,
    );

    expect(impl.asked).toEqual(["https://www.isavta.co.il/he/holidays/PH/2027"]);
  });

  /** The list itself comes back, not only the address. The saved page is
   * 2026's, so it is restamped to the year being asked for the way
   * `countryHolidays.test.ts` does it — the per-row year check is what makes an
   * unrestamped page answer `notFound`, and that is the parser being right. */
  it("answers a country's year with the page's own list", async () => {
    const impl = serving(countryPage().replaceAll("2026", "2027"));
    const result = await fetchHolidayList(
      SEEDED_HOLIDAY_LISTS,
      { kind: "country", code: "PH" },
      2027,
      impl,
    );

    if (!result.ok) throw new Error(`expected a list, got ${result.failure.kind}`);
    expect(result.value.source).toEqual({ kind: "country", code: "PH" });
    expect(result.value.holidays).toHaveLength(24);
  });

  /** A religion is one page for every year it knows, at an address the
   * application holds — so nothing about the year is in what is asked for. */
  it("asks a faith's one page, whatever year is wanted", async () => {
    const impl = serving(jewishPage());
    const result = await fetchHolidayList(
      SEEDED_HOLIDAY_LISTS,
      { kind: "religion", religion: "jewish" },
      2026,
      impl,
    );

    expect(impl.asked).toEqual([religiousSources.jewish.url]);
    if (!result.ok) throw new Error(`expected a list, got ${result.failure.kind}`);
    expect(result.value.source).toEqual({ kind: "religion", religion: "jewish" });
    expect(result.value.nameHe).toBe(religiousSources.jewish.nameHe);
    expect(result.value.year).toBe(2026);
  });

  /**
   * Catches a dispatch written the wrong way round. A religion sent to the
   * country fetch has no stored list to take an address from and answers
   * `notFound`, which reads exactly like a page whose markup moved — a failure
   * that would send someone looking at the parser.
   */
  it("does not send a faith through the country fetch", async () => {
    const impl = serving(jewishPage());
    await fetchHolidayList(
      SEEDED_HOLIDAY_LISTS,
      { kind: "religion", religion: "druze" },
      2026,
      impl,
    );

    expect(impl.asked).toEqual([religiousSources.druze.url]);
  });
});
