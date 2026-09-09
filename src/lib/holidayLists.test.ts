import { describe, expect, it } from "vitest";

import {
  SEEDED_HOLIDAY_LISTS,
  addressForYear,
  byDate,
  holidayListFor,
  nearestStoredYear,
  withFetchedList,
} from "@/lib/holidayLists";
import type { HolidayList } from "@/lib/holidayLists";

/**
 * Every figure below comes from the shipped `data/holidays/*.json` files or
 * from the source pages saved under `src/lib/scrape/fixtures/`, and never from
 * what this module returned.
 */

const PH = { kind: "country", code: "PH" } as const;
const UA = { kind: "country", code: "UA" } as const;
const CHRISTIAN = { kind: "religion", religion: "christian" } as const;
const MUSLIM = { kind: "religion", religion: "muslim" } as const;

function listOf(
  source: HolidayList["source"],
  year: number,
  count: number,
): HolidayList {
  return {
    source,
    year,
    sourceUrl: `https://example.test/holidays/x/${year}`,
    nameHe: "בדיקה",
    holidays: Array.from({ length: count }, (_, i) => ({
      date: `${year}-01-${String(i + 1).padStart(2, "0")}`,
      name: `holiday ${i}`,
    })),
  };
}

describe("the shipped seed lists", () => {
  it("loads all six countries with the counts their files hold", () => {
    // data/holidays/*.json, counted in the files themselves.
    const counts = SEEDED_HOLIDAY_LISTS.map((list) => [
      list.source.kind === "country" ? list.source.code : "",
      list.holidays.length,
    ]);
    expect(counts).toEqual([
      ["IN", 50],
      ["LK", 26],
      ["NP", 11],
      ["PH", 24],
      ["UA", 12],
      ["UZ", 18],
    ]);
  });

  it("carries no empty list, because an empty one is a failed fetch", () => {
    // The mistake this catches is the one the repository actually shipped:
    // UA-2026.json was committed empty, with its address pointing at country
    // code UK, and it read as a country that publishes no holidays.
    for (const list of SEEDED_HOLIDAY_LISTS) {
      expect(list.holidays.length).toBeGreaterThan(0);
    }
  });

  it("files Ukraine's list under the address it was actually fetched from", () => {
    const ua = holidayListFor(SEEDED_HOLIDAY_LISTS, UA, 2026);
    expect(ua?.sourceUrl).toBe("https://www.isavta.co.il/he/holidays/UA/2026");
  });
});

describe("the address for a year with no list", () => {
  it("changes the year in the stored address", () => {
    expect(
      addressForYear("https://www.isavta.co.il/he/holidays/UA/2026", 2026, 2027),
    ).toBe("https://www.isavta.co.il/he/holidays/UA/2027");
  });

  it("keeps a path the code alone would not reproduce", () => {
    // NP-2026.json is filed under the English path while every other shipped
    // file is under the Hebrew one. An address rebuilt from the country code
    // would quietly change the path as well as the year.
    const np = SEEDED_HOLIDAY_LISTS.find(
      (list) => list.source.kind === "country" && list.source.code === "NP",
    );
    expect(np?.sourceUrl).toContain("/en/");
    expect(addressForYear(np!.sourceUrl, 2026, 2027)).toBe(
      "https://www.isavta.co.il/en/holidays/NP/2027",
    );
  });

  it("refuses an address whose last segment is not the stored year", () => {
    expect(addressForYear("https://www.isavta.co.il/he/holidays/UA", 2026, 2027)).toBe(
      null,
    );
  });

  it("leaves a year-like number earlier in the address alone", () => {
    // A parser replacing the first match rather than the last would move the
    // 2026 out of the path and leave the year segment as it was, producing an
    // address that fetches the year already stored.
    expect(
      addressForYear("https://example.test/2026/holidays/UA/2026", 2026, 2027),
    ).toBe("https://example.test/2026/holidays/UA/2027");
  });
});

describe("the year a fetch is judged against", () => {
  it("is the nearest stored year and not the latest", () => {
    const lists = [
      listOf(PH, 2020, 20),
      listOf(PH, 2028, 40),
    ];
    // 2021 is one year from 2020 and seven from 2028. A lookup taking the
    // latest row would judge a 2021 fetch against 2028's forty holidays.
    expect(nearestStoredYear(lists, PH, 2021)?.year).toBe(2020);
  });

  it("never answers with the year being fetched", () => {
    const lists = [listOf(PH, 2026, 24), listOf(PH, 2027, 25)];
    expect(nearestStoredYear(lists, PH, 2026)?.year).toBe(2027);
  });

  it("does not read one source's years for another", () => {
    const lists = [listOf(PH, 2026, 24), listOf(CHRISTIAN, 2026, 16)];
    expect(nearestStoredYear(lists, UA, 2027)).toBe(null);
    expect(nearestStoredYear(lists, CHRISTIAN, 2027)?.holidays.length).toBe(16);
  });

  it("does not read one religion's years for another", () => {
    // Four religions share one shape and differ only in the field that names
    // them. A comparison matching on the kind alone would judge the Muslim
    // page's nine dates against the Christian page's sixteen.
    const lists = [listOf(CHRISTIAN, 2026, 16), listOf(MUSLIM, 2026, 9)];
    expect(nearestStoredYear(lists, MUSLIM, 2027)?.holidays.length).toBe(9);
    expect(holidayListFor(lists, MUSLIM, 2026)?.holidays.length).toBe(9);
  });
});

describe("writing a fetched list into the table", () => {
  it("replaces the list for that source and year rather than appending", () => {
    const lists = [listOf(PH, 2026, 24)];
    const merged = withFetchedList(lists, listOf(PH, 2026, 25));
    expect(merged.length).toBe(1);
    expect(merged[0].holidays.length).toBe(25);
  });

  it("leaves another source's list for the same year standing", () => {
    const lists = [listOf(PH, 2026, 24), listOf(UA, 2026, 12)];
    const merged = withFetchedList(lists, listOf(PH, 2026, 25));
    expect(holidayListFor(merged, UA, 2026)?.holidays.length).toBe(12);
  });

  it("tells a country from a religion", () => {
    const lists = [listOf(PH, 2026, 24)];
    const merged = withFetchedList(lists, listOf(CHRISTIAN, 2026, 16));
    expect(merged.length).toBe(2);
  });
});

describe("ordering", () => {
  it("puts a year's holidays in date order", () => {
    const dates = byDate([
      { date: "2026-12-25", name: "b" },
      { date: "2026-01-01", name: "a" },
    ]).map((holiday) => holiday.date);
    expect(dates).toEqual(["2026-01-01", "2026-12-25"]);
  });
});
