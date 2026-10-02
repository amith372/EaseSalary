import { describe, expect, it } from "vitest";
import { FRIDAY, SATURDAY } from "@/lib/dates";
import type { MonthSpan } from "@/lib/engine/types";
import { vacationMarkedAhead } from "./markedAhead";

/**
 * Vacation marked in a month after the current one (specs.md item 21).
 *
 * **Every figure here is counted off a calendar by hand and none is read back
 * from the function** (working rule 11). The two months the cases sit in run:
 *
 * ```
 * October  2026   Thu 1 · Fri 2 · Sat 3 … Wed 28 · Thu 29 · Fri 30 · Sat 31
 * November 2026   Sun 1 · Mon 2 · Tue 3 … Fri 13 · Sat 14 · Sun 15 …
 * ```
 *
 * Vacation counts its non-rest-days (item 7), so each expectation below is the
 * span's days less the rest days inside it, and less every day falling in the
 * current month or before it.
 */

const SEPTEMBER = { year: 2026, month: 9 };
const OCTOBER = { year: 2026, month: 10 };

/** A vacation span, which is always closed: only sickness may be open (item 8). */
function vacation(from: string, to: string, fraction?: number): MonthSpan {
  return {
    id: `vacation-${from}-${to}`,
    kind: "vacation",
    from,
    to,
    ...(fraction === undefined ? {} : { fraction }),
  };
}

describe("vacation marked in a month after the current one", () => {
  it("counts three whole days in a clear week", () => {
    // 2–4 November 2026 are Monday to Wednesday: no rest day falls inside, so
    // all three days count.
    expect(
      vacationMarkedAhead([vacation("2026-11-02", "2026-11-04")], SEPTEMBER, SATURDAY),
    ).toBe(3);
  });

  it("leaves the rest day inside a span out", () => {
    // 9–15 November 2026 is Monday to Sunday — seven days, of which Saturday
    // the 14th is the rest day. Six count.
    expect(
      vacationMarkedAhead([vacation("2026-11-09", "2026-11-15")], SEPTEMBER, SATURDAY),
    ).toBe(6);
  });

  it("counts a half day as half a day", () => {
    expect(
      vacationMarkedAhead([vacation("2026-11-09", "2026-11-09", 0.5)], SEPTEMBER, SATURDAY),
    ).toBe(0.5);
  });

  it("counts only the days a span crossing the boundary leaves ahead", () => {
    // The current month is October, and the span runs 29 October to 2 November:
    // Thursday 29 and Friday 30 fall in the current month and are already in the
    // balance, Saturday 31 is the rest day, and Sunday 1 and Monday 2 are ahead.
    // Two of the five count.
    expect(
      vacationMarkedAhead([vacation("2026-10-29", "2026-11-02")], OCTOBER, SATURDAY),
    ).toBe(2);
    // The same boundary one day wider in each direction: 28, 29 and 30 October
    // are the current month's, the 31st is the rest day, and 1, 2 and 3 November
    // are ahead — three.
    expect(
      vacationMarkedAhead([vacation("2026-10-28", "2026-11-03")], OCTOBER, SATURDAY),
    ).toBe(3);
  });

  it("counts by the rest day it is given, and not by Saturday", () => {
    // Friday 6 November 2026 alone. It is an ordinary working day for a worker
    // who rests on Saturday and the rest day itself for one who rests on Friday
    // (item 5), so the same mark counts one day or none.
    const friday = [vacation("2026-11-06", "2026-11-06")];
    expect(vacationMarkedAhead(friday, SEPTEMBER, SATURDAY)).toBe(1);
    expect(vacationMarkedAhead(friday, SEPTEMBER, FRIDAY)).toBe(0);
  });

  it("counts nothing in the current month or before it", () => {
    // Days marked later in the current month are valued by that month and are
    // already in its balance, so counting them here would state them twice.
    expect(
      vacationMarkedAhead(
        [vacation("2026-09-21", "2026-09-23"), vacation("2026-08-10", "2026-08-12")],
        SEPTEMBER,
        SATURDAY,
      ),
    ).toBe(0);
  });

  it("counts vacation only", () => {
    // Sickness is settled with the user as out of scope here, and a free rest
    // day is not an entitlement and draws from no balance (item 5).
    const spans: MonthSpan[] = [
      { id: "sick-ahead", kind: "sick", from: "2026-11-02", to: "2026-11-04" },
      { id: "free-ahead", kind: "freeRestDay", from: "2026-11-07", to: "2026-11-07" },
      { id: "holiday-ahead", kind: "holiday", from: "2026-11-10", to: "2026-11-10", worked: false },
    ];
    expect(vacationMarkedAhead(spans, SEPTEMBER, SATURDAY)).toBe(0);
  });

  it("sums every span ahead, and is nothing at all where there are none", () => {
    expect(vacationMarkedAhead([], SEPTEMBER, SATURDAY)).toBe(0);
    // Three days in the first week of November and six across the second, as the
    // two cases above counted them: nine.
    expect(
      vacationMarkedAhead(
        [vacation("2026-11-02", "2026-11-04"), vacation("2026-11-09", "2026-11-15")],
        SEPTEMBER,
        SATURDAY,
      ),
    ).toBe(9);
  });

  it("counts a span the store holds backwards the same way", () => {
    // A leftward drag in a right-to-left calendar moves forward in time (Part 5),
    // so a reversed range is a shape the engine's interior has to survive: 2–4
    // November stored as 4 to 2 is still the same three days.
    expect(
      vacationMarkedAhead([vacation("2026-11-04", "2026-11-02")], SEPTEMBER, SATURDAY),
    ).toBe(3);
  });
});
