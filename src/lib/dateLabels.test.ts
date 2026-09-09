import { describe, expect, it } from "vitest";
import { dayLabel, fullDayLabel, monthLabel, rangeLabel } from "@/lib/dateLabels";

/**
 * Every expected string is written out here in Hebrew rather than assembled from
 * `he.ts` the way the code assembles it. A test that built the answer the same
 * way the function does would agree with it whatever it did — including the
 * month-boundary case below, which is the one that was wrong.
 *
 * August 2026 begins on a Saturday; 30 September 2026 is a Wednesday and 4
 * October a Sunday, which is the shape a sick spell takes when it runs over a
 * month end (specs.md item 8).
 */

describe("a range inside one month", () => {
  it("writes one day as the day and the month", () => {
    expect(rangeLabel("2026-08-20", "2026-08-20")).toBe("20 באוגוסט");
  });

  it("writes a run as two day numbers against one month", () => {
    expect(rangeLabel("2026-08-16", "2026-08-20")).toBe("16–20 באוגוסט");
  });
});

describe("a range that crosses a month (specs.md item 8)", () => {
  it("names both months, because one of them cannot stand for the pair", () => {
    // **This is the case that was wrong.** The label took its month from the
    // last day alone, so 30 September to 4 October read "30–4 באוקטובר" — a
    // sentence that is not merely unclear but false about the first date.
    expect(rangeLabel("2026-09-30", "2026-10-04")).toBe(
      "30 בספטמבר – 4 באוקטובר",
    );
  });

  it("carries the years when the range crosses one", () => {
    // December and January say nothing about which of the two years is meant,
    // and a spell running over the new year is ordinary rather than an edge.
    expect(rangeLabel("2026-12-30", "2027-01-02")).toBe(
      "30 בדצמבר 2026 – 2 בינואר 2027",
    );
  });

  it("leaves the years off when the range stays inside one", () => {
    // The year is carried only where it settles something, so the common case
    // is not made longer by the rare one.
    expect(rangeLabel("2026-09-30", "2026-10-04")).not.toContain("2026");
  });
});

describe("the labels the rest of the screen uses", () => {
  it("writes the calendar's heading", () => {
    expect(monthLabel({ year: 2026, month: 8 })).toBe("אוגוסט 2026");
  });

  it("writes a single day for the overflow list", () => {
    // With the preposition, which is the correct Hebrew and the wording
    // `rangeLabel` already used. The bare "26 אוגוסט" stood here until the user
    // settled it.
    expect(dayLabel("2026-08-26")).toBe("26 באוגוסט");
  });

  it("words one day exactly as a range of that one day", () => {
    // The two functions are why this was worth changing: the overflow list and
    // the selection summary sit on the same screen, and a day worded one way in
    // one and another way in the other is a difference with no reason behind it.
    expect(dayLabel("2026-08-26")).toBe(rangeLabel("2026-08-26", "2026-08-26"));
  });
});

describe("a date outside the month on screen", () => {
  it("carries its year, which is the whole of what makes it readable", () => {
    // When the employment began and when a document expires are years away from
    // anything on the page (specs.md items 6, 28), so the year is not optional
    // decoration — "31 במרץ" says nothing about which March is meant.
    expect(fullDayLabel("2024-04-01")).toBe("1 באפריל 2024");
    expect(fullDayLabel("2027-03-31")).toBe("31 במרץ 2027");
  });

  it("says the same day the year-less form says", () => {
    // One date worded two ways on one screen is a difference with no reason
    // behind it, which is the argument `dayLabel` and `rangeLabel` already
    // settled above.
    expect(fullDayLabel("2026-08-26").startsWith(dayLabel("2026-08-26"))).toBe(
      true,
    );
  });
});
