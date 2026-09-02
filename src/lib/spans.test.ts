import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import {
  applyMark,
  balanceDaysOf,
  markableDays,
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

describe("a paid holiday cannot land on a free rest day", () => {
  const freeRestDay: DaySpan[] = [
    { id: "rest", kind: "freeRestDay", from: "2026-08-15", to: "2026-08-15" },
  ];

  it("refuses the day and says why, marking the days around it", () => {
    const { spans, skipped } = applyMark(
      { kind: "holiday", from: "2026-08-14", to: "2026-08-16" },
      SATURDAY,
      freeRestDay,
    );

    expect(spans.map((s) => [s.from, s.to])).toEqual([
      ["2026-08-14", "2026-08-14"],
      ["2026-08-16", "2026-08-16"],
    ]);
    expect(skipped).toEqual([{ date: "2026-08-15", reason: "restDayHoliday" }]);
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
