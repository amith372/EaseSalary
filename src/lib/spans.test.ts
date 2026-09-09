import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import {
  applyMark,
  balanceDaysOf,
  markableDays,
  partIsAllowed,
  spanOverflow,
} from "@/lib/spans";
import type { ClosedDaySpan, DaySpan } from "@/lib/types";

/**
 * August 2026 throughout: its 1st falls on a Saturday, so its Saturdays are
 * 1, 8, 15, 22 and 29 — the month the canvas draws and the case specs.md
 * Part 5 warns about.
 */

describe("a vacation span skips its rest days", () => {
  it("draws six days from 16 to 22 August, not seven", () => {
    const { spans, skipped } = applyMark({
      kind: "vacation",
      from: "2026-08-16",
      to: "2026-08-22",
    }, SATURDAY);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      kind: "vacation",
      from: "2026-08-16",
      to: "2026-08-21",
    });
    expect(balanceDaysOf(spans[0], SATURDAY)).toBe(6);
    expect(skipped).toEqual([{ date: "2026-08-22", reason: "weeklyRest" }]);
  });

  it("splits into two spans where a rest day falls inside the range", () => {
    const { spans, skipped } = applyMark({
      kind: "vacation",
      from: "2026-08-14",
      to: "2026-08-17",
    }, SATURDAY);

    expect(spans.map((s) => [s.from, s.to])).toEqual([
      ["2026-08-14", "2026-08-14"],
      ["2026-08-16", "2026-08-17"],
    ]);
    expect(skipped).toEqual([{ date: "2026-08-15", reason: "weeklyRest" }]);
    expect(spans.reduce((total, s) => total + balanceDaysOf(s, SATURDAY), 0)).toBe(3);
  });
});

describe("a sick span keeps its rest days", () => {
  it("stores 16 to 22 August whole and draws all seven days", () => {
    const { spans, skipped } = applyMark({
      kind: "sick",
      from: "2026-08-16",
      to: "2026-08-22",
    }, SATURDAY);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ from: "2026-08-16", to: "2026-08-22" });
    expect(balanceDaysOf(spans[0], SATURDAY)).toBe(7);
    expect(skipped).toEqual([]);
  });

  it("stores a spell running past the end of the month whole", () => {
    const { spans } = applyMark({
      kind: "sick",
      from: "2026-08-30",
      to: "2026-09-02",
    }, SATURDAY);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ from: "2026-08-30", to: "2026-09-02" });
    expect(spanOverflow(spans[0], "2026-08-01", "2026-08-31")).toEqual({
      before: false,
      after: true,
    });
  });
});

describe("a range is ordered by date, never by the direction it was drawn", () => {
  it("produces the identical span swept in either direction", () => {
    const forward = applyMark({
      kind: "vacation",
      from: "2026-08-16",
      to: "2026-08-21",
    }, SATURDAY);
    const backward = applyMark({
      kind: "vacation",
      from: "2026-08-21",
      to: "2026-08-16",
    }, SATURDAY);

    expect(backward.spans).toEqual(forward.spans);
  });
});

describe("only a rest day can be marked as the rest day the worker had off", () => {
  it("marks the rest days of a swept week and refuses the rest", () => {
    const { spans, skipped } = applyMark({
      kind: "freeRestDay",
      from: "2026-08-01",
      to: "2026-08-08",
    }, SATURDAY);

    expect(spans.map((s) => s.from)).toEqual(["2026-08-01", "2026-08-08"]);
    expect(skipped).toHaveLength(6);
    expect(skipped.every((s) => s.reason === "notRestDay")).toBe(true);
  });

  it("draws nothing from a balance, being no entitlement", () => {
    const { spans } = applyMark({
      kind: "freeRestDay",
      from: "2026-08-01",
      to: "2026-08-01",
    }, SATURDAY);

    expect(balanceDaysOf(spans[0], SATURDAY)).toBe(0);
  });
});

/**
 * **A holiday is no longer something a sweep can produce** (specs.md item 9).
 * The user never marks a day as a holiday: the year's dates are chosen in
 * advance and arrive on the calendar drawn, and `MarkIntent.kind` is a
 * `MarkKind`, which no longer includes one — so the case this block used to
 * assert, a swept holiday refused for landing on a free rest day, is a compile
 * error rather than a runtime refusal and cannot be written here at all.
 *
 * The refusal itself has not gone: a stored holiday on a free rest day is still
 * refused by `validate.ts`, which is where it belongs now that the only caller
 * able to place one is the year's chosen dates. What follows is the behaviour
 * that replaced the gesture — a mark swept over a day the holiday already
 * covers.
 */
describe("a day carrying a holiday refuses a mark like any other marked day", () => {
  const holiday: DaySpan[] = [
    { id: "hol", kind: "holiday", from: "2026-08-15", to: "2026-08-15" },
  ];

  it("marks around it and reports the day it skipped", () => {
    const { spans, skipped } = applyMark(
      { kind: "sick", from: "2026-08-14", to: "2026-08-16" },
      SATURDAY,
      holiday,
    );

    expect(spans.map((s) => [s.from, s.to])).toEqual([
      ["2026-08-14", "2026-08-14"],
      ["2026-08-16", "2026-08-16"],
    ]);
    expect(skipped).toEqual([{ date: "2026-08-15", reason: "alreadyMarked" }]);
  });
});

describe("a day that already carries a mark refuses another", () => {
  const existing: DaySpan[] = [
    { id: "sick", kind: "sick", from: "2026-08-19", to: "2026-08-20" },
  ];

  it("marks around the existing span and reports the overlap", () => {
    const { spans, skipped } = applyMark(
      { kind: "vacation", from: "2026-08-18", to: "2026-08-21" },
      SATURDAY,
      existing,
    );

    expect(spans.map((s) => [s.from, s.to])).toEqual([
      ["2026-08-18", "2026-08-18"],
      ["2026-08-21", "2026-08-21"],
    ]);
    expect(skipped).toEqual([
      { date: "2026-08-19", reason: "alreadyMarked" },
      { date: "2026-08-20", reason: "alreadyMarked" },
    ]);
  });

  it("refuses the whole range when every day of it is taken", () => {
    const { spans, skipped } = applyMark(
      { kind: "vacation", from: "2026-08-19", to: "2026-08-20" },
      SATURDAY,
      existing,
    );

    expect(spans).toEqual([]);
    expect(skipped).toHaveLength(2);
  });
});

describe("markableDays", () => {
  it("reports the surviving days and the refused days separately", () => {
    const { taken, skipped } = markableDays({
      kind: "vacation",
      from: "2026-08-15",
      to: "2026-08-16",
    }, SATURDAY);

    expect(taken).toEqual(["2026-08-16"]);
    expect(skipped).toEqual([{ date: "2026-08-15", reason: "weeklyRest" }]);
  });
});

describe("a sweep carries the part of a day and the note (items 5, 7)", () => {
  it("writes half a day onto the span the sweep produced", () => {
    // 17 August 2026 is a Monday, so nothing refuses the mark. The half is the
    // picker's own second row and the span is where it is stored.
    const { spans } = applyMark(
      {
        kind: "vacation",
        from: "2026-08-17",
        to: "2026-08-17",
        fraction: 0.5,
        note: "  חצי יום לרופא  ",
      },
      SATURDAY,
    );

    expect(spans).toEqual([
      {
        id: "vacation-2026-08-17-2026-08-17",
        kind: "vacation",
        from: "2026-08-17",
        to: "2026-08-17",
        fraction: 0.5,
        note: "חצי יום לרופא",
      },
    ]);
    // Half a day off the balance, which is item 7's own sentence and the half
    // this test exists to protect: a fraction written but never read would look
    // exactly like this span and cost a whole day.
    expect(balanceDaysOf(spans[0], SATURDAY)).toBe(0.5);
  });

  it("leaves a whole day whole, and writes neither field", () => {
    // An ordinary mark carries no `fraction` and no `note` at all rather than
    // carrying 1 and "": a stored 1 would make every span look like a decision
    // the user made about its length.
    const { spans } = applyMark(
      { kind: "vacation", from: "2026-08-17", to: "2026-08-17", note: "   " },
      SATURDAY,
    );

    expect(spans[0]).toEqual({
      id: "vacation-2026-08-17-2026-08-17",
      kind: "vacation",
      from: "2026-08-17",
      to: "2026-08-17",
    });
  });

  it("carries the note onto every span a broken sweep produced", () => {
    // 14 to 17 August 2026 crosses Saturday the 15th, which a vacation span
    // skips (item 5) — so the sweep yields two spans, and the words the user
    // wrote are about both of them.
    const { spans } = applyMark(
      {
        kind: "vacation",
        from: "2026-08-14",
        to: "2026-08-17",
        note: "טיסה הביתה",
      },
      SATURDAY,
    );

    expect(spans).toHaveLength(2);
    expect(spans.map((span) => span.note)).toEqual([
      "טיסה הביתה",
      "טיסה הביתה",
    ]);
  });
});

describe("only one day of vacation may be taken in part (items 7, 10)", () => {
  const day = { from: "2026-08-17", to: "2026-08-17" } as const;

  it("allows half a day of vacation", () => {
    expect(partIsAllowed({ kind: "vacation", ...day, fraction: 0.5 })).toBe(true);
  });

  it("refuses half a day of sickness or of a free rest day", () => {
    // Item 7 gives the part-day to vacation and item 10 to a holiday, which is
    // not a mark at all. Sickness is counted in whole days from the spell's own
    // first day (item 8), and a free rest day is not an entitlement (item 5).
    expect(partIsAllowed({ kind: "sick", ...day, fraction: 0.5 })).toBe(false);
    expect(partIsAllowed({ kind: "freeRestDay", from: "2026-08-15", to: "2026-08-15", fraction: 0.5 })).toBe(false);
  });

  it("refuses a part of a range of more than one day", () => {
    // `DaySpan.fraction` is set only where `from` and `to` are equal
    // (`types.ts`): half of a four-day range is not a thing the stored shape
    // can say, so it is refused rather than stored as something else.
    expect(
      partIsAllowed({ kind: "vacation", from: "2026-08-17", to: "2026-08-20", fraction: 0.5 }),
    ).toBe(false);
  });

  it("refuses a proportion the picker never offers", () => {
    // A server action is reachable by a crafted request, so the two parts the
    // picker draws are the two the rule allows and not a range of numbers.
    expect(partIsAllowed({ kind: "vacation", ...day, fraction: 0.37 })).toBe(false);
    expect(partIsAllowed({ kind: "vacation", ...day, fraction: 0 })).toBe(false);
  });

  it("allows a whole day of every kind, however it is written", () => {
    expect(partIsAllowed({ kind: "sick", ...day })).toBe(true);
    expect(partIsAllowed({ kind: "sick", ...day, fraction: 1 })).toBe(true);
  });

  it("falls back to a whole day rather than writing a part it refuses", () => {
    // The floor under the picker and the server action, and not the answer the
    // user gets: neither of those two can produce this call.
    const { spans } = applyMark(
      { kind: "sick", ...day, fraction: 0.5 },
      SATURDAY,
    );
    expect("fraction" in spans[0]).toBe(false);
  });
});

describe("a part-day is drawn from the balance in its own proportion", () => {
  it("halves a single day", () => {
    const half: ClosedDaySpan = {
      id: "half",
      kind: "vacation",
      from: "2026-08-17",
      to: "2026-08-17",
      fraction: 0.5,
    };

    expect(balanceDaysOf(half, SATURDAY)).toBe(0.5);
  });
});

describe("an open sick spell covers every day from its first onward (item 8)", () => {
  const openSpell: DaySpan[] = [
    { id: "sick-open", kind: "sick", from: "2026-08-20", to: null },
  ];

  it("refuses a mark on a day the spell has already reached", () => {
    const { spans, skipped } = applyMark(
      { kind: "vacation", from: "2026-08-24", to: "2026-08-24" },
      SATURDAY,
      openSpell,
    );
    expect(spans).toEqual([]);
    expect(skipped).toEqual([{ date: "2026-08-24", reason: "alreadyMarked" }]);
  });

  it("leaves a day before the spell began alone", () => {
    // The day is not covered, and saying so needs care: an open spell has no
    // end, so asking "does it reach the 10th?" against a window that closes on
    // the 10th produces the range 20th–10th, which `orderDates` puts the right
    // way round into 10th–20th — and the 10th is then inside it. The answer
    // comes back wrong and entirely plausible.
    const { spans, skipped } = applyMark(
      { kind: "vacation", from: "2026-08-10", to: "2026-08-10" },
      SATURDAY,
      openSpell,
    );
    expect(skipped).toEqual([]);
    expect(spans.map((s) => [s.from, s.to])).toEqual([
      ["2026-08-10", "2026-08-10"],
    ]);
  });
});
