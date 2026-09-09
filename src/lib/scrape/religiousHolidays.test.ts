import { describe, expect, it } from "vitest";

import type { Holiday, HolidayList } from "@/lib/holidayLists";
import type { Scraped } from "@/lib/scrape/failure";
import {
  druzePage,
  emptyBody,
  jewishPage,
  muslimPage,
  religiousMarkupMoved,
  religiousPage,
  religiousTruncated,
} from "@/lib/scrape/holiday-pages.fixture";
import {
  fetchReligiousHolidays,
  parseReligiousHolidaysPage,
} from "@/lib/scrape/religiousHolidays";

/**
 * Every expected date below is read off the saved pages, which are the four
 * Kol Zchut holiday tables as they stood on 2026-09-09, and never off what the
 * parser returned. The four tables in full:
 *
 * - Jewish: two Hebrew-year columns, each carrying full dates.
 * - Muslim: one column, full dates, two of them written as runs — `20.03.2026
 *   עד 22.03.2026` and `27.05.2026 עד 30.05.2026`.
 * - Christian: two rite columns, dates written as day and month, and the
 *   movable feasts marked `(נכון ל-2026)`.
 * - Druze: one column, day and month, one run of four days.
 */

const CHRISTIAN = { kind: "religion", religion: "christian" } as const;

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

function serving(html: string): typeof fetch & { asked: string[] } {
  const asked: string[] = [];
  const impl = (async (url: string | URL | Request) => {
    asked.push(String(url));
    return new Response(html, { status: 200 });
  }) as typeof fetch & { asked: string[] };
  impl.asked = asked;
  return impl;
}

function datesOf(holidays: Holiday[]): string[] {
  return holidays.map((holiday) => holiday.date);
}

describe("the Jewish page, whose columns are years", () => {
  it("reads the year that was asked for and not the column beside it", () => {
    // The table's two columns are תשפ"ו and תשפ"ז, and each holds full dates.
    // A parser reading the first column, or the last, would answer with a year
    // nobody asked for — and the dates would look entirely ordinary.
    expect(datesOf(ok(parseReligiousHolidaysPage(jewishPage(), 2026)))).toEqual([
      "2026-04-02",
      "2026-04-08",
      "2026-04-22",
      "2026-05-22",
      "2026-09-12",
      "2026-09-13",
      "2026-09-21",
      "2026-09-26",
      "2026-10-03",
    ]);
  });

  it("takes 2027's dates from wherever on the page they appear", () => {
    // The תשפ"ז column carries both 2026 and 2027 dates, because the Hebrew
    // year straddles them. Asking for 2027 must yield only the four that fall
    // in it, and asking for 2026 must have picked up the rest of that column.
    expect(datesOf(ok(parseReligiousHolidaysPage(jewishPage(), 2027)))).toEqual([
      "2027-04-22",
      "2027-04-28",
      "2027-05-12",
      "2027-06-11",
    ]);
  });

  it("keeps the holiday's own name and not the column heading", () => {
    const holidays = ok(parseReligiousHolidaysPage(jewishPage(), 2026));
    expect(holidays.find((holiday) => holiday.date === "2026-09-21")?.name).toBe(
      "יום כיפור",
    );
  });

  it("does not read the Hebrew-date column as dates", () => {
    // `א' בתשרי` is in a column of its own and carries no digits. A parser
    // reading every cell for numbers would have to be wrong about it.
    const holidays = ok(parseReligiousHolidaysPage(jewishPage(), 2026));
    expect(holidays.length).toBe(9);
  });
});

describe("a run of days written with עד", () => {
  it("becomes every day in the run and not its two ends", () => {
    // `20.03.2026 עד 22.03.2026` is three days off work. Reading it as two
    // dates would drop the middle day, and the worker would be one candidate
    // date short with nothing on screen to show it.
    const holidays = ok(parseReligiousHolidaysPage(muslimPage(), 2026));
    expect(datesOf(holidays)).toEqual([
      "2026-03-20",
      "2026-03-21",
      "2026-03-22",
      "2026-05-27",
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
      "2026-06-17",
      "2026-08-25",
    ]);
  });

  it("carries the same name across every day of the run", () => {
    const holidays = ok(parseReligiousHolidaysPage(muslimPage(), 2026));
    expect(holidays[0].name).toBe("עיד אל פיטר");
    expect(holidays[2].name).toBe("עיד אל פיטר");
  });

  it("expands a run written without a year against the year asked for", () => {
    // The Druze page writes `25.04 עד 28.04` with no year at all.
    expect(datesOf(ok(parseReligiousHolidaysPage(druzePage(), 2027)))).toEqual([
      "2027-01-25",
      "2027-04-25",
      "2027-04-26",
      "2027-04-27",
      "2027-04-28",
    ]);
  });
});

describe("a date printed without a year", () => {
  it("holds for every year, which is what its absence means", () => {
    // Christmas is `25.12` on the page and does not move. Asking for 2027 must
    // answer with 2027's, and a parser that required a year would answer with
    // nothing at all for three of the four pages.
    const holidays = ok(parseReligiousHolidaysPage(religiousPage(), 2027));
    expect(datesOf(holidays)).toContain("2027-12-25");
  });

  it("is left out of another year when the page says which year it holds for", () => {
    // The movable feasts carry `(נכון ל-2026)`. Restamping Easter's 2026 date
    // as 2027's is the wrong answer that looks most like a right one, because
    // nothing about `03.04` says it moved.
    const in2026 = datesOf(ok(parseReligiousHolidaysPage(religiousPage(), 2026)));
    const in2027 = datesOf(ok(parseReligiousHolidaysPage(religiousPage(), 2027)));
    expect(in2026).toContain("2026-04-03");
    expect(in2027).not.toContain("2027-04-03");
    expect(in2026.length).toBe(16);
    expect(in2027.length).toBe(8);
  });

  it("does not read the qualifier's own year as a date's", () => {
    // `(נכון ל-2026)` carries a four-digit number beside a date that has none.
    // A reader taking it as the date's year would file `03.04 (נכון ל-2026)`
    // correctly by luck and `25.12` in the same cell wrongly.
    const holidays = ok(parseReligiousHolidaysPage(religiousPage(), 2026));
    for (const holiday of holidays) {
      expect(holiday.date.startsWith("2026-")).toBe(true);
    }
  });
});

describe("the two rites on the Christian page", () => {
  it("offers both and names which is which", () => {
    const holidays = ok(parseReligiousHolidaysPage(religiousPage(), 2026));
    const christmas = holidays.filter((holiday) =>
      holiday.name.startsWith("חג המולד"),
    );
    // 25 and 26 December in the Catholic column, 7 and 8 January in the
    // Orthodox one — four dates for one holiday, which is why the rite has to
    // travel with the name.
    expect(datesOf(christmas)).toEqual([
      "2026-01-07",
      "2026-01-08",
      "2026-12-25",
      "2026-12-26",
    ]);
    expect(christmas[0].name).toContain("אורתודוקסית");
    expect(christmas[2].name).toContain("קתולית");
  });

  it("leaves a single-column page's names alone", () => {
    // The rule is the shape of the table and not a list of pages: the Muslim
    // page has one column of dates, so nothing is appended to its names.
    const holidays = ok(parseReligiousHolidaysPage(muslimPage(), 2026));
    for (const holiday of holidays) {
      expect(holiday.name).not.toContain("—");
    }
  });
});

describe("the three spoiled pages", () => {
  it("reports moved markup as notFound, with every date still in the page", () => {
    expect(failed(parseReligiousHolidaysPage(religiousMarkupMoved(), 2026))).toBe(
      "notFound",
    );
  });

  it("reports an empty body as unreachable", () => {
    expect(failed(parseReligiousHolidaysPage(emptyBody(), 2026))).toBe(
      "unreachable",
    );
  });

  it("refuses a truncated table against the year already stored", async () => {
    // Four dates where sixteen stood. With no stored year there is nothing to
    // judge against, so the check needs one — which is the case the next test
    // covers from the other side.
    const stored: HolidayList[] = [
      {
        source: CHRISTIAN,
        year: 2026,
        sourceUrl: "https://www.kolzchut.org.il/he/חגים_נוצריים",
        nameHe: "חגים נוצריים",
        holidays: Array.from({ length: 16 }, (_, i) => ({
          date: `2026-01-${String(i + 1).padStart(2, "0")}`,
          name: "x",
        })),
      },
    ];
    const result = await fetchReligiousHolidays(
      stored,
      "christian",
      2027,
      serving(religiousTruncated()),
    );
    expect(failed(result)).toBe("implausible");
  });

  it("believes a religion nobody has fetched before", async () => {
    // No shipped file exists for any of the four pages, so the first fetch has
    // no history. Refusing it would make the religious lists unreachable for
    // ever, since the only thing that could create the history is a fetch.
    const result = await fetchReligiousHolidays(
      [],
      "christian",
      2026,
      serving(religiousPage()),
    );
    if (!result.ok) throw new Error(result.failure.detail);
    expect(result.value.holidays.length).toBe(16);
    expect(result.value.nameHe).toBe("חגים נוצריים");
  });
});

describe("fetching a religion's year", () => {
  it("asks the religion's one page, with no year in the address", async () => {
    // A religion's page carries every year it knows, so the year is a filter
    // over what came back and never part of the address — which is the whole
    // of the difference from a country's list.
    const impl = serving(religiousPage());
    await fetchReligiousHolidays([], "christian", 2029, impl);
    expect(impl.asked).toEqual(["https://www.kolzchut.org.il/he/חגים_נוצריים"]);
  });

  it("refuses a year the page does not reach", async () => {
    // The Jewish page publishes two Hebrew years. Asking it for a third
    // answers nothing, and storing that would record "no holidays in 2030"
    // rather than "this page does not go that far".
    const result = await fetchReligiousHolidays(
      [],
      "jewish",
      2030,
      serving(jewishPage()),
    );
    expect(failed(result)).toBe("notFound");
  });

  it("reports a request that threw as unreachable", async () => {
    const impl = (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch;
    expect(failed(await fetchReligiousHolidays([], "druze", 2026, impl))).toBe(
      "unreachable",
    );
  });
});
