import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  compareIsoDate,
  daysBetween,
  daysInMonth,
  eachDate,
  isRestEve,
  isRestDay,
  monthGrid,
  orderDates,
  SATURDAY,
  restDaysOf,
  toIsoDate,
  utcDate,
  weekdayOfFirst,
  WEEK_LENGTH,
} from "@/lib/dates";
import type { YearMonth } from "@/lib/types";

const august2026: YearMonth = { year: 2026, month: 8 };

describe("the weekday numbering", () => {
  it("counts Saturday as six, not five", () => {
    expect(SATURDAY).toBe(6);
    expect(utcDate(2026, 8, 1).getUTCDay()).toBe(SATURDAY);
  });

  it("separates Friday from Saturday", () => {
    expect(isRestEve("2026-08-07")).toBe(true);
    expect(isRestDay("2026-08-07")).toBe(false);
    expect(isRestDay("2026-08-08")).toBe(true);
  });
});

describe("August 2026", () => {
  it("begins on a Saturday, so the grid opens with six blank cells", () => {
    expect(weekdayOfFirst(august2026)).toBe(SATURDAY);
    const cells = monthGrid(august2026);
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toBe("2026-08-01");
  });

  it("has 31 days and five rest days", () => {
    expect(daysInMonth(august2026)).toBe(31);
    expect(restDaysOf(august2026)).toEqual([
      "2026-08-01",
      "2026-08-08",
      "2026-08-15",
      "2026-08-22",
      "2026-08-29",
    ]);
  });

  it("fills whole weeks", () => {
    const cells = monthGrid(august2026);
    expect(cells.length % WEEK_LENGTH).toBe(0);
    expect(cells.length).toBe(42);
    expect(cells.filter((cell) => cell !== null)).toHaveLength(31);
  });
});

describe("the leading blanks are derived, never assumed", () => {
  it("shifts with the weekday of the 1st", () => {
    // A 31-day month beginning on a Sunday holds four Saturdays where the same
    // length beginning on a Saturday holds five (specs.md Part 5).
    const march2026: YearMonth = { year: 2026, month: 3 };
    expect(weekdayOfFirst(march2026)).toBe(0);
    expect(monthGrid(march2026)[0]).toBe("2026-03-01");
    expect(restDaysOf(march2026)).toHaveLength(4);
    expect(restDaysOf(august2026)).toHaveLength(5);
  });
});

describe("dates are built outside any local time zone", () => {
  it("counts the same rest days across a daylight-saving boundary", () => {
    // Israel moves its clocks in late March and late October. A date built in
    // local time can shift by a whole day across either, which would change the
    // rest-day count of the month without announcing itself.
    for (const month of [3, 10]) {
      const ym: YearMonth = { year: 2026, month };
      const restDays = restDaysOf(ym);
      expect(restDays.every(isRestDay)).toBe(true);
      expect(restDays).toHaveLength(month === 3 ? 4 : 5);
    }
  });

  it("keeps the day when a date survives a round trip", () => {
    expect(toIsoDate(utcDate(2026, 3, 27))).toBe("2026-03-27");
    expect(addDays("2026-03-27", 1)).toBe("2026-03-28");
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
  });
});

describe("spans are ordered by date, not by screen position", () => {
  it("normalises a range swept in either direction to the same span", () => {
    const forwards = orderDates("2026-08-16", "2026-08-22");
    const backwards = orderDates("2026-08-22", "2026-08-16");
    expect(forwards).toEqual({ from: "2026-08-16", to: "2026-08-22" });
    expect(backwards).toEqual(forwards);
  });

  it("counts a span inclusively of both ends", () => {
    expect(daysBetween("2026-08-16", "2026-08-22") + 1).toBe(7);
    expect(eachDate("2026-08-16", "2026-08-22")).toHaveLength(7);
  });

  it("lets a span cross a month boundary", () => {
    const dates = eachDate("2026-08-29", "2026-09-02");
    expect(dates).toEqual([
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("sorts ISO dates lexicographically", () => {
    expect(compareIsoDate("2026-08-09", "2026-08-10")).toBeLessThan(0);
    expect(compareIsoDate("2026-09-01", "2026-08-31")).toBeGreaterThan(0);
    expect(compareIsoDate("2026-08-01", "2026-08-01")).toBe(0);
  });
});

describe("month arithmetic", () => {
  it("rolls over a year boundary in both directions", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths(august2026, 0)).toEqual(august2026);
  });

  it("knows February in a leap year", () => {
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
  });
});
