import { describe, expect, it } from "vitest";

import { SEEDED_HOLIDAY_LISTS, holidayListFor } from "@/lib/holidayLists";
import type { Holiday, HolidayList } from "@/lib/holidayLists";
import {
  fetchCountryHolidays,
  parseCountryHolidaysPage,
} from "@/lib/scrape/countryHolidays";
import type { Scraped } from "@/lib/scrape/failure";
import {
  countryMarkupMoved,
  countryPage,
  countryTruncated,
  countryWithADateMissing,
  countryWithAStrayYear,
  countryWithNoHolidays,
  emptyBody,
} from "@/lib/scrape/holiday-pages.fixture";

/**
 * Every expected value below comes from the saved page itself or from the
 * shipped `data/holidays/PH-2026.json`, never from what the parser returned.
 * The saved page is the Philippines' 2026 list as the source served it on
 * 2026-09-09; the shipped file was gathered from the same page earlier, so the
 * two agreeing is a real check and not a tautology.
 */

const PH = { kind: "country", code: "PH" } as const;
const UA = { kind: "country", code: "UA" } as const;

/** The shipped file: twenty-four holidays for the Philippines in 2026. */
const SHIPPED_PH = holidayListFor(SEEDED_HOLIDAY_LISTS, PH, 2026)!;

function ok(result: Scraped<Holiday[]>): Holiday[] {
  if (!result.ok) {
    throw new Error(`expected holidays, got ${result.failure.kind}: ${result.failure.detail}`);
  }
  return result.value;
}

function failed<T>(result: Scraped<T>): string {
  if (result.ok) throw new Error("expected a failure, got a list");
  return result.failure.kind;
}

/** A fetch that answers one page, and records what it was asked for. */
function serving(html: string): typeof fetch & { asked: string[] } {
  const asked: string[] = [];
  const impl = (async (url: string | URL | Request) => {
    asked.push(String(url));
    return new Response(html, { status: 200 });
  }) as typeof fetch & { asked: string[] };
  impl.asked = asked;
  return impl;
}

describe("the saved country page", () => {
  it("yields every date the shipped file holds, and the same count", () => {
    const holidays = ok(parseCountryHolidaysPage(countryPage(), 2026));
    expect(holidays.map((holiday) => holiday.date)).toEqual(
      SHIPPED_PH.holidays.map((holiday) => holiday.date),
    );
  });

  it("yields the shipped names, but for the one the source has since rewritten", () => {
    // The source now prints "all saint day eve" where the shipped file, which
    // was gathered from the same page earlier, has "All Saints' Day Eve". That
    // is an edit at the source and not a parser fault, and it is asserted
    // rather than smoothed over: a test that compared names loosely would stop
    // catching a parser that lower-cased or trimmed them itself.
    const holidays = ok(parseCountryHolidaysPage(countryPage(), 2026));
    const differing = holidays.filter(
      (holiday, i) => holiday.name !== SHIPPED_PH.holidays[i].name,
    );
    expect(differing).toEqual([
      { date: "2026-10-31", name: "all saint day eve" },
    ]);
  });

  it("reads the name without the empty badge the page leaves beside it", () => {
    // The page wraps a `span` inside each name and leaves it empty. Reading the
    // whole element's text would carry that whitespace into the stored name and
    // into the picker beside it.
    const holidays = ok(parseCountryHolidaysPage(countryPage(), 2026));
    expect(holidays[0]).toEqual({ date: "2026-01-01", name: "New Year's Day" });
    for (const holiday of holidays) {
      expect(holiday.name).toBe(holiday.name.trim());
    }
  });

  it("returns them in date order", () => {
    const dates = ok(parseCountryHolidaysPage(countryPage(), 2026)).map(
      (holiday) => holiday.date,
    );
    expect([...dates].sort()).toEqual(dates);
  });

  it("refuses the page when a different year was asked for", () => {
    // The year is a segment of the address, so a 2026 page answering a request
    // for 2027 means the year swap did not take effect — a fetch that would
    // otherwise store 2026's dates as 2027's.
    expect(failed(parseCountryHolidaysPage(countryPage(), 2027))).toBe("notFound");
  });
});

describe("the three spoiled pages", () => {
  it("reports moved markup as notFound, with the sentence still in the page", () => {
    // The hard case: every date and every name is still there in the same
    // words, so a parser searching the whole document's text would still find
    // them and would be finding them by luck.
    expect(failed(parseCountryHolidaysPage(countryMarkupMoved(), 2026))).toBe(
      "notFound",
    );
  });

  it("reports an empty body as unreachable", () => {
    expect(failed(parseCountryHolidaysPage(emptyBody(), 2026))).toBe("unreachable");
  });

  it("reports the source's answer for an unknown address as implausible", () => {
    // The real `.../holidays/UK/2026`: a 200 whose heading names no country and
    // which carries no rows. Believing it would store "this country publishes
    // no holidays", which is the mistake `UA-2026.json` was committed with.
    expect(failed(parseCountryHolidaysPage(countryWithNoHolidays(), 2026))).toBe(
      "implausible",
    );
  });

  it("refuses a page whose heading is right and one of whose rows is not", () => {
    // The heading check cannot catch this: the page really is 2026's page, and
    // one row in it is dated 2025. A parser trusting the heading alone would
    // file a 2025 date under 2026 and the picker would offer it against the
    // wrong year's entitlement.
    expect(failed(parseCountryHolidaysPage(countryWithAStrayYear(), 2026))).toBe(
      "notFound",
    );
  });

  it("refuses a row whose date is missing rather than borrowing the row above", () => {
    // A parser zipping the dates and the names by position pairs every later
    // name with the wrong date and still returns a full-looking list — the
    // whole year shifted by one, with nothing about it that looks wrong.
    expect(failed(parseCountryHolidaysPage(countryWithADateMissing(), 2026))).toBe(
      "notFound",
    );
  });

  it("tells moved markup apart from an address the source does not know", () => {
    // Both pages carry no rows. Collapsing them into one failure would send
    // whoever reads the log looking for a template change when the country code
    // is what is wrong, or the other way round.
    const moved = parseCountryHolidaysPage(countryMarkupMoved(), 2026);
    const unknown = parseCountryHolidaysPage(countryWithNoHolidays(), 2026);
    expect(moved.ok || unknown.ok).toBe(false);
    expect(failed(moved)).not.toBe(failed(unknown));
  });
});

describe("fetching a year", () => {
  it("asks the stored address with its year changed", async () => {
    const impl = serving(countryPage());
    await fetchCountryHolidays(SEEDED_HOLIDAY_LISTS, "PH", 2027, impl);
    expect(impl.asked).toEqual(["https://www.isavta.co.il/he/holidays/PH/2027"]);
  });

  it("uses the stored path and not one rebuilt from the country code", async () => {
    // Nepal's list is filed under the English path. An address assembled from
    // the code would ask for the Hebrew one, which is the failure Part 5
    // records: an address that looks right and returns nothing.
    const impl = serving(countryPage());
    await fetchCountryHolidays(SEEDED_HOLIDAY_LISTS, "NP", 2027, impl);
    expect(impl.asked).toEqual(["https://www.isavta.co.il/en/holidays/NP/2027"]);
  });

  it("refuses a country it holds no address for", async () => {
    const result = await fetchCountryHolidays(
      SEEDED_HOLIDAY_LISTS,
      "TH",
      2027,
      serving(countryPage()),
    );
    expect(failed(result)).toBe("notFound");
  });

  it("reports a request that threw as unreachable", async () => {
    const impl = (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch;
    const result = await fetchCountryHolidays(SEEDED_HOLIDAY_LISTS, "PH", 2027, impl);
    expect(failed(result)).toBe("unreachable");
  });

  it("reports an error status as unreachable", async () => {
    const impl = (async () =>
      new Response("", { status: 503 })) as unknown as typeof fetch;
    const result = await fetchCountryHolidays(SEEDED_HOLIDAY_LISTS, "PH", 2027, impl);
    expect(failed(result)).toBe("unreachable");
  });

  it("stores the address it actually fetched, so the next year follows from it", async () => {
    const page = countryPage().replaceAll("2026", "2027");
    const result = await fetchCountryHolidays(
      SEEDED_HOLIDAY_LISTS,
      "PH",
      2027,
      serving(page),
    );
    if (!result.ok) throw new Error(result.failure.detail);
    expect(result.value.sourceUrl).toBe(
      "https://www.isavta.co.il/he/holidays/PH/2027",
    );
    expect(result.value.nameHe).toBe("הפיליפינים");
    expect(result.value.year).toBe(2027);
  });
});

describe("the length a fetched list is judged by", () => {
  const truncated = () => countryTruncated().replaceAll("2026", "2027");

  it("refuses a list far shorter than the year already stored", async () => {
    // Three holidays against the twenty-four stored for 2026, which is what a
    // page cut short by a proxy produces and what nothing but this check would
    // notice.
    const result = await fetchCountryHolidays(
      SEEDED_HOLIDAY_LISTS,
      "PH",
      2027,
      serving(truncated()),
    );
    expect(failed(result)).toBe("implausible");
  });

  it("believes a country with no stored year at all", async () => {
    // Item 12: a year with no list fills itself. A country nobody has fetched
    // before has nothing to be judged against, so refusing it would leave the
    // user typing the dates by hand for no reason.
    const noHistory: HolidayList[] = [
      {
        ...SHIPPED_PH,
        source: { kind: "country", code: "TH" },
        sourceUrl: "https://www.isavta.co.il/he/holidays/TH/2026",
        holidays: [],
      },
    ];
    const result = await fetchCountryHolidays(
      noHistory,
      "TH",
      2027,
      serving(truncated()),
    );
    expect(result.ok).toBe(true);
  });

  it("believes a list that moved by one, which is what a source revision looks like", async () => {
    // Sri Lanka's 2026 list has gained one holiday since the shipped file was
    // gathered. A tighter bound would refuse an ordinary correction and cost
    // the user a manual entry.
    const page = countryPage().replaceAll("2026", "2027");
    const result = await fetchCountryHolidays(
      [{ ...SHIPPED_PH, holidays: SHIPPED_PH.holidays.slice(0, 23) }],
      "PH",
      2027,
      serving(page),
    );
    expect(result.ok).toBe(true);
  });

  it("does not judge one country's list against another's", async () => {
    // Ukraine stores twelve and the Philippines twenty-four. A check reading
    // the nearest year of *any* country would refuse the Philippines' next year
    // for being twice Ukraine's.
    const page = countryPage().replaceAll("2026", "2027");
    const ua = holidayListFor(SEEDED_HOLIDAY_LISTS, UA, 2026)!;
    const result = await fetchCountryHolidays([ua], "PH", 2027, serving(page));
    expect(failed(result)).toBe("notFound"); // no address stored for PH
  });
});
