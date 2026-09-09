import { describe, expect, it } from "vitest";

import {
  holidayYear,
  partThatFits,
  reviewHolidayDate,
  reviewHolidayMove,
  reviewHolidayPart,
} from "@/lib/engine/holidayYear";
import { holidayAllowanceFor } from "@/lib/engine/leave";
import type { MonthSpan } from "@/lib/engine/types";
import { SEEDED_HOLIDAY_LISTS, holidayListFor } from "@/lib/holidayLists";
import type { Holiday } from "@/lib/holidayLists";

/**
 * The year's holidays as the picker offers them (specs.md item 10).
 *
 * **Every expected figure here comes from outside the code under test**: the
 * nine days and the 6.75 of a year begun in April are item 10's and the
 * family's own workbook's (`שכר_חודשי_להאנה2024.xlsx` → `חודש  12.24` → C9,
 * with the reasoning in I9), and every candidate date and name is read off the
 * shipped `data/holidays/PH-2026.json`. Nothing is read off what the picker
 * returned.
 */

const PH = { kind: "country", code: "PH" } as const;

/** The shipped list: the Philippines' twenty-four holidays for 2026. */
const SHIPPED = holidayListFor(SEEDED_HOLIDAY_LISTS, PH, 2026)!;

/** Its first three dates, which is all most of these cases need. */
const CANDIDATES: Holiday[] = SHIPPED.holidays.slice(0, 3);

/** Nine days: a full calendar year of employment (item 10). */
const FULL_YEAR = holidayAllowanceFor("2024-04-01", 2026);

/** 6.75: employed from 1.4.2024, so nine of that year's twelve months. The
 * figure is the workbook's, cell C9. */
const PART_YEAR = holidayAllowanceFor("2024-04-01", 2024);

function holiday(
  id: string,
  date: string,
  fraction?: number,
): MonthSpan {
  return {
    id,
    kind: "holiday",
    from: date,
    to: date,
    worked: false,
    ...(fraction === undefined ? {} : { fraction }),
  };
}

describe("the entitlement the picker counts against", () => {
  it("is nine days for a full year and 6.75 for one begun in April", () => {
    expect(FULL_YEAR).toBe(9);
    expect(PART_YEAR).toBe(6.75);
  });
});

describe("the year's rows", () => {
  it("are the source's own dates and names, ordered by date", () => {
    const year = holidayYear(CANDIDATES, [], FULL_YEAR, 2026);

    expect(year.rows.map((row) => row.date)).toEqual([
      "2026-01-01",
      "2026-02-17",
      "2026-02-25",
    ]);
    expect(year.rows.map((row) => row.name)).toEqual([
      "New Year's Day",
      "Chinese Lunar New Year's Day",
      "People Power Anniversary",
    ]);
    expect(year.rows.every((row) => row.chosen === null)).toBe(true);
  });

  it("carries the span and the part of a day on a chosen date", () => {
    const year = holidayYear(
      CANDIDATES,
      [holiday("a", "2026-02-17", 0.5)],
      FULL_YEAR,
      2026,
    );

    expect(year.rows[1].chosen).toEqual({ spanId: "a", fraction: 0.5 });
    expect(year.rows[0].chosen).toBeNull();
  });

  /**
   * A date can be edited and a fetch can fail, so a chosen date need not be one
   * the source published (items 10 and 12). Catches a picker that drew the
   * candidate list alone: the day she moved a holiday to would vanish from the
   * screen while still drawing on her quota.
   */
  it("include a chosen date the source never published, with no name", () => {
    const year = holidayYear(
      CANDIDATES,
      [holiday("a", "2026-06-12")],
      FULL_YEAR,
      2026,
    );

    const added = year.rows.find((row) => row.date === "2026-06-12");
    expect(added?.name).toBeNull();
    expect(added?.chosen?.spanId).toBe("a");
    expect(year.rows.map((row) => row.date)).toEqual([
      "2026-01-01",
      "2026-02-17",
      "2026-02-25",
      "2026-06-12",
    ]);
  });

  /** The year is the calendar year (item 10), so a candidate or a choice from
   * another one is not this year's business. Catches a filter left off the
   * chosen spans, which would draw last year's holidays against this year's
   * nine days. */
  it("leave out a candidate and a choice from another year", () => {
    const year = holidayYear(
      [...CANDIDATES, { date: "2027-01-01", name: "New Year's Day" }],
      [holiday("a", "2025-12-25"), holiday("b", "2026-01-01")],
      FULL_YEAR,
      2026,
    );

    expect(year.rows.map((row) => row.date)).toEqual([
      "2026-01-01",
      "2026-02-17",
      "2026-02-25",
    ]);
    expect(year.chosenDays).toBe(1);
  });
});

describe("what the year has left", () => {
  /** Catches a count of spans rather than of days — the two differ the moment a
   * day is taken in part, and the difference is what she is paid. */
  it("counts a part day as its fraction", () => {
    const year = holidayYear(
      CANDIDATES,
      [
        holiday("a", "2026-01-01"),
        holiday("b", "2026-02-17", 0.5),
        holiday("c", "2026-03-20", 0.5),
      ],
      FULL_YEAR,
      2026,
    );

    expect(year.chosenDays).toBe(2);
    expect(year.remaining).toBe(7);
  });

  /** A span of more than one day is more than one day of the entitlement
   * (item 10). Catches a row-per-span reading, which would let a five-day
   * holiday span draw a single day. */
  it("counts every day of a span that covers several", () => {
    const year = holidayYear(
      [],
      [{ id: "a", kind: "holiday", from: "2026-05-01", to: "2026-05-03", worked: false }],
      FULL_YEAR,
      2026,
    );

    expect(year.chosenDays).toBe(3);
    expect(year.rows.map((row) => row.date)).toEqual([
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
    ]);
  });

  it("never falls below zero, because the month is what refuses a tenth day", () => {
    const spans = Array.from({ length: 10 }, (_, index) =>
      holiday(`h${index}`, `2026-01-0${index + 1}`.replace("-010", "-10")),
    );
    const year = holidayYear([], spans, FULL_YEAR, 2026);

    expect(year.chosenDays).toBe(10);
    expect(year.remaining).toBe(0);
  });
});

describe("whether another day can be chosen", () => {
  /** Catches a picker that blocked a row already chosen: unchoosing is what
   * makes room, so a full year would become a year nothing could be undone in. */
  it("blocks every unchosen row once the entitlement is spent, and no chosen one", () => {
    const spans = SHIPPED.holidays
      .slice(0, 9)
      .map((candidate, index) => holiday(`h${index}`, candidate.date));
    const year = holidayYear(SHIPPED.holidays, spans, FULL_YEAR, 2026);

    expect(year.remaining).toBe(0);
    expect(year.rows.filter((row) => row.chosen !== null)).toHaveLength(9);
    expect(year.rows.every((row) => row.blocked === (row.chosen === null))).toBe(
      true,
    );
  });

  /** Half a day still fits in half a day left, and the tick is what takes it —
   * so the row is not blocked. Catches "blocked when less than a whole day
   * remains", which would leave the last half of an entitlement unspendable. */
  it("leaves a row open while half a day is left", () => {
    const spans = SHIPPED.holidays
      .slice(0, 8)
      .map((candidate, index) => holiday(`h${index}`, candidate.date));
    spans.push(holiday("half", "2026-06-12", 0.5));
    const year = holidayYear(SHIPPED.holidays, spans, FULL_YEAR, 2026);

    expect(year.remaining).toBe(0.5);
    expect(year.rows.find((row) => row.chosen === null)?.blocked).toBe(false);
  });
});

describe("the part the next choice takes", () => {
  /**
   * The tick takes the largest part that fits, so a year of 6.75 can be spent
   * down to a quarter rather than stopping at six. Catches a tick that always
   * took a whole day: the seventh tick would then be refused with 0.75 of an
   * entitlement still showing.
   */
  it("is a whole day where one fits and a half where only a half does", () => {
    expect(partThatFits(9)).toBe(1);
    expect(partThatFits(1)).toBe(1);
    expect(partThatFits(0.75)).toBe(0.5);
    expect(partThatFits(0.5)).toBe(0.5);
  });
});

describe("choosing a date", () => {
  const state = (spans: MonthSpan[], allowance = FULL_YEAR) =>
    holidayYear(CANDIDATES, spans, allowance, 2026);

  it("takes a whole day where the year has room", () => {
    const reviewed = reviewHolidayDate("2026-01-01", 2026, [], state([]));
    expect(reviewed).toEqual({ ok: true, fraction: 1 });
  });

  /** A year begun in April with six whole days chosen has 0.75 left, and the
   * choice is the half that fits it. */
  it("takes a half day where only a part of one is left", () => {
    const spans = SHIPPED.holidays
      .slice(0, 6)
      .map((candidate, index) => holiday(`h${index}`, candidate.date));
    const reviewed = reviewHolidayDate(
      "2026-06-12",
      2026,
      spans,
      holidayYear(SHIPPED.holidays, spans, PART_YEAR, 2026),
    );

    expect(reviewed).toEqual({ ok: true, fraction: 0.5 });
  });

  it("refuses a date outside the year on screen", () => {
    expect(reviewHolidayDate("2027-01-01", 2026, [], state([]))).toEqual({
      ok: false,
      reason: "date",
    });
    expect(reviewHolidayDate("not a date", 2026, [], state([]))).toEqual({
      ok: false,
      reason: "date",
    });
  });

  /**
   * A day carrying two entries is what `validateMonth` refuses as
   * `dayRecordedTwice`, and refusing it here is the same rule said at the
   * gesture. Catches a picker that only looked at the holidays: a holiday
   * ticked onto a day already recorded as sickness would be accepted and the
   * month would then refuse to calculate, with nothing on this screen to say
   * why.
   */
  it("refuses a date some other span already covers", () => {
    const sick: MonthSpan = {
      id: "s",
      kind: "sick",
      from: "2026-02-16",
      to: "2026-02-18",
    };
    expect(reviewHolidayDate("2026-02-17", 2026, [sick], state([sick]))).toEqual(
      { ok: false, reason: "alreadyMarked" },
    );
  });

  /** An open spell has no end, and a date inside it is still inside it. */
  it("refuses a date inside a spell that has not ended", () => {
    const open: MonthSpan = { id: "s", kind: "sick", from: "2026-02-16", to: null };
    expect(reviewHolidayDate("2026-02-17", 2026, [open], state([open]))).toEqual(
      { ok: false, reason: "alreadyMarked" },
    );
  });

  it("refuses a tenth day when the nine are spent", () => {
    const spans = SHIPPED.holidays
      .slice(0, 9)
      .map((candidate, index) => holiday(`h${index}`, candidate.date));
    const reviewed = reviewHolidayDate(
      "2026-06-12",
      2026,
      spans,
      holidayYear(SHIPPED.holidays, spans, FULL_YEAR, 2026),
    );

    expect(reviewed).toEqual({ ok: false, reason: "holidayLimit" });
  });
});

describe("moving a chosen date", () => {
  const spans = [holiday("a", "2026-01-01"), holiday("b", "2026-02-17")];

  it("is allowed onto a free date, and draws nothing more from the year", () => {
    expect(reviewHolidayMove("2026-06-12", 2026, spans, "a")).toEqual({ ok: true });
  });

  /** Catches a collision check that did not exclude the span being moved: a
   * holiday could then never be moved onto its own date, and a date form opened
   * with the date already in it would refuse the first press. */
  it("is allowed onto the date it already holds", () => {
    expect(reviewHolidayMove("2026-01-01", 2026, spans, "a")).toEqual({ ok: true });
  });

  it("is refused onto a date another entry already covers", () => {
    expect(reviewHolidayMove("2026-02-17", 2026, spans, "a")).toEqual({
      ok: false,
      reason: "alreadyMarked",
    });
  });

  it("is refused onto another year", () => {
    expect(reviewHolidayMove("2025-12-25", 2026, spans, "a")).toEqual({
      ok: false,
      reason: "date",
    });
  });
});

describe("taking a chosen day in part", () => {
  /** Nine whole days chosen leaves nothing, and halving one of them still
   * fits: only the increase is judged. Catches a check against the whole
   * fraction, which would refuse the very gesture that makes room. */
  it("allows halving a day even with nothing left", () => {
    const spans = SHIPPED.holidays
      .slice(0, 9)
      .map((candidate, index) => holiday(`h${index}`, candidate.date));
    const year = holidayYear(SHIPPED.holidays, spans, FULL_YEAR, 2026);

    expect(
      reviewHolidayPart(0.5, { spanId: "h0", fraction: 1 }, year),
    ).toEqual({ ok: true });
  });

  /** Six whole days and a half of a 6.75 entitlement leave a quarter, and
   * restoring the half to a whole day would take another half. */
  it("refuses restoring a half day to a whole one when only a quarter is left", () => {
    const spans = SHIPPED.holidays
      .slice(0, 6)
      .map((candidate, index) => holiday(`h${index}`, candidate.date));
    spans.push(holiday("half", "2026-06-12", 0.5));
    const year = holidayYear(SHIPPED.holidays, spans, PART_YEAR, 2026);

    expect(year.remaining).toBe(0.25);
    expect(
      reviewHolidayPart(1, { spanId: "half", fraction: 0.5 }, year),
    ).toEqual({ ok: false, reason: "holidayLimit" });
  });

  it("refuses a part the application does not offer", () => {
    const year = holidayYear(CANDIDATES, [], FULL_YEAR, 2026);
    expect(
      reviewHolidayPart(0.37, { spanId: "a", fraction: 1 }, year),
    ).toEqual({ ok: false, reason: "part" });
  });
});

describe("whether the selection is incomplete", () => {
  /** Item 10 asks that an incomplete selection be visible at a glance. */
  it("is true while a day can still be chosen", () => {
    expect(holidayYear([], [], FULL_YEAR, 2026).incomplete).toBe(true);
  });

  it("is false once the entitlement is spent", () => {
    const spans = SHIPPED.holidays
      .slice(0, 9)
      .map((candidate, index) => holiday(`h${index}`, candidate.date));
    expect(holidayYear(SHIPPED.holidays, spans, FULL_YEAR, 2026).incomplete).toBe(
      false,
    );
  });

  /**
   * A year of 6.75 spent down to a quarter has a remainder nothing can take,
   * and going on saying "not all the days are chosen" would be asking for a day
   * the application would refuse. Catches "incomplete while anything at all
   * remains".
   */
  it("is false once what is left is smaller than half a day", () => {
    const spans = SHIPPED.holidays
      .slice(0, 6)
      .map((candidate, index) => holiday(`h${index}`, candidate.date));
    spans.push(holiday("half", "2026-06-12", 0.5));
    const year = holidayYear(SHIPPED.holidays, spans, PART_YEAR, 2026);

    expect(year.chosenDays).toBe(6.5);
    expect(year.remaining).toBe(0.25);
    expect(year.incomplete).toBe(false);
  });
});
