import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addYears,
  compareIsoDate,
  daysBetween,
  daysInMonth,
  eachDate,
  everyDayOf,
  isIsoDate,
  isMonthNumber,
  isRestEve,
  isRestDay,
  monthGrid,
  orderDates,
  SATURDAY,
  toIsoDate,
  utcDate,
  weekdayOfFirst,
  WEEK_LENGTH,
  yearsBetween,
} from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import type { IsoDate, YearMonth } from "@/lib/types";

/** A month's rest days, composed as `countMonth` composes them. */
function restDaysOf(ym: YearMonth, restDay: RestDay): IsoDate[] {
  return everyDayOf(ym).filter((date) => isRestDay(date, restDay));
}

const august2026: YearMonth = { year: 2026, month: 8 };

describe("the weekday numbering", () => {
  it("counts Saturday as six, not five", () => {
    expect(SATURDAY).toBe(6);
    expect(utcDate(2026, 8, 1).getUTCDay()).toBe(SATURDAY);
  });

  it("separates Friday from Saturday", () => {
    expect(isRestEve("2026-08-07", SATURDAY)).toBe(true);
    expect(isRestDay("2026-08-07", SATURDAY)).toBe(false);
    expect(isRestDay("2026-08-08", SATURDAY)).toBe(true);
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
    expect(restDaysOf(august2026, SATURDAY)).toEqual([
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
    expect(restDaysOf(march2026, SATURDAY)).toHaveLength(4);
    expect(restDaysOf(august2026, SATURDAY)).toHaveLength(5);
  });
});

describe("dates are built outside any local time zone", () => {
  it("counts the same rest days across a daylight-saving boundary", () => {
    // Israel moves its clocks in late March and late October. A date built in
    // local time can shift by a whole day across either, which would change the
    // rest-day count of the month without announcing itself.
    for (const month of [3, 10]) {
      const ym: YearMonth = { year: 2026, month };
      const restDays = restDaysOf(ym, SATURDAY);
      expect(restDays.every((d) => isRestDay(d, SATURDAY))).toBe(true);
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

describe("the same day a year later", () => {
  it("keeps the day and the month, and moves the year", () => {
    // A medical-insurance policy bought on 15 June 2026 runs to 15 June 2027
    // (specs.md item 16). Written out rather than computed.
    expect(addYears("2026-06-15", 1)).toBe("2027-06-15");
  });

  it("clamps a leap day rather than rolling it into March", () => {
    // 29 February 2028 has no anniversary in 2029. `setUTCFullYear` alone
    // gives 1 March, so a policy bought on a leap day would expire a day after
    // the family believes it does — and nothing on screen would look wrong.
    expect(addYears("2028-02-29", 1)).toBe("2029-02-28");
  });

  it("lands on the leap day where the year has one", () => {
    expect(addYears("2027-02-28", 1)).toBe("2028-02-28");
  });

  it("crosses a daylight-saving boundary without moving a day", () => {
    // Israel puts the clocks forward in late March. Built in UTC, so the day
    // is the day (`CLAUDE.md`).
    expect(addYears("2026-03-27", 1)).toBe("2027-03-27");
  });
});

/**
 * `ותק` on `דף העובד`: how long the employment has run, in whole years.
 *
 * What these would catch: the division that looks equivalent — days over
 * 365 — which reports three years on the morning the fourth begins for any
 * employment that has crossed a leap day, and a negative count for a worker
 * whose first day is still ahead.
 */
describe("whole years from one date to another", () => {
  it("turns on the anniversary and not the day before it", () => {
    expect(yearsBetween("2024-03-01", "2025-02-28")).toBe(0);
    expect(yearsBetween("2024-03-01", "2025-03-01")).toBe(1);
  });

  it("counts four years across a leap day, where 365-day years count three", () => {
    // 1 March 2024 to 1 March 2028 is 1,461 days: four years, and 4.003 by
    // the division — but 28 February 2028 is 1,460 days and divides to 3.999,
    // so the day before the anniversary and the day of it both read as three.
    expect(daysBetween("2024-03-01", "2028-03-01")).toBe(1461);
    expect(yearsBetween("2024-03-01", "2028-03-01")).toBe(4);
    expect(yearsBetween("2024-03-01", "2028-02-29")).toBe(3);
  });

  it("is nought for an employment that has not started", () => {
    expect(yearsBetween("2027-01-01", "2026-09-18")).toBe(0);
  });
});

describe("isIsoDate", () => {
  it("accepts a real date, the 29th of February of a leap year included", () => {
    expect(isIsoDate("2026-09-19")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-12-31")).toBe(true);
  });

  it("refuses a date that would roll into the next month", () => {
    // February 2026 has 28 days and September 30: none of these exists.
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("2026-09-31")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
  });

  it("refuses anything not written YYYY-MM-DD", () => {
    expect(isIsoDate("2026-9-19")).toBe(false);
    expect(isIsoDate(" 2026-09-19")).toBe(false);
    expect(isIsoDate("19/09/2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("isMonthNumber", () => {
  it("accepts one to twelve and nothing else", () => {
    expect(isMonthNumber(1)).toBe(true);
    expect(isMonthNumber(7)).toBe(true);
    expect(isMonthNumber(12)).toBe(true);
    expect(isMonthNumber(0)).toBe(false);
    expect(isMonthNumber(13)).toBe(false);
    expect(isMonthNumber(6.5)).toBe(false);
    expect(isMonthNumber(Number.NaN)).toBe(false);
  });
});
