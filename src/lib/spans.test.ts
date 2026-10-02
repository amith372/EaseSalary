import { describe, expect, it } from "vitest";
import { FRIDAY, SATURDAY } from "@/lib/dates";
import {
  applyMark,
  balanceDaysOf,
  kindRefusedThroughout,
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
 * `MarkKind`, which does not include one — so a swept holiday refused for
 * landing on a free rest day is a compile error rather than a runtime refusal
 * and cannot be written here at all.
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

/**
 * **A kind no day of the selection can take is not offered** (specs.md items 5,
 * 8). August 2026 as the rest of this file has it: the 1st is a Saturday, so
 * the Saturdays are 1, 8, 15, 22 and 29 and the Fridays are 7, 14, 21 and 28.
 * Every date below is read off that calendar and not off the function.
 *
 * **What this catches.** The picker offered all three kinds on every day, so a
 * Friday-resting worker was shown "שבת חופשית" on a Saturday, pressed it, and
 * got nothing marked and a skipped-day sentence after the fact. A predicate
 * that answered for the *first* day of a range, or for any day rather than
 * every day, would grey a swept week that does contain their rest day — which
 * item 8 requires to be marked and its other days reported.
 */
describe("a kind no day of the selection can take (items 5, 8)", () => {
  it("refuses a free rest day on a single Saturday when she rests on Friday", () => {
    expect(
      kindRefusedThroughout("freeRestDay", "2026-08-01", "2026-08-01", FRIDAY),
    ).toBe("notRestDay");
  });

  it("offers it on her own Friday", () => {
    expect(
      kindRefusedThroughout("freeRestDay", "2026-08-07", "2026-08-07", FRIDAY),
    ).toBeNull();
  });

  it("offers it over a week that holds one Friday, so the week's other days are reported rather than hidden", () => {
    // 1–7 August is Saturday to Friday: six days refuse it and the 7th takes it.
    expect(
      kindRefusedThroughout("freeRestDay", "2026-08-01", "2026-08-07", FRIDAY),
    ).toBeNull();
  });

  it("withholds it over a week that holds none", () => {
    // 8–13 August is Saturday to Thursday: no Friday in it at all.
    expect(
      kindRefusedThroughout("freeRestDay", "2026-08-08", "2026-08-13", FRIDAY),
    ).toBe("notRestDay");
  });

  it("is her own day and not everyone's: the same Friday is refused where she rests on Saturday", () => {
    expect(
      kindRefusedThroughout("freeRestDay", "2026-08-07", "2026-08-07", SATURDAY),
    ).toBe("notRestDay");
    expect(
      kindRefusedThroughout("freeRestDay", "2026-08-08", "2026-08-08", SATURDAY),
    ).toBeNull();
  });

  it("withholds a vacation day on the rest day alone, and offers it over a week", () => {
    expect(
      kindRefusedThroughout("vacation", "2026-08-01", "2026-08-01", SATURDAY),
    ).toBe("weeklyRest");
    expect(
      kindRefusedThroughout("vacation", "2026-08-01", "2026-08-05", SATURDAY),
    ).toBeNull();
  });

  it("never withholds sickness, which no day refuses by kind", () => {
    expect(
      kindRefusedThroughout("sick", "2026-08-01", "2026-08-01", SATURDAY),
    ).toBeNull();
  });

  it("answers the same for a range drawn backwards, as a leftward drag in a right-to-left calendar is", () => {
    expect(
      kindRefusedThroughout("freeRestDay", "2026-08-07", "2026-08-01", FRIDAY),
    ).toBeNull();
    expect(
      kindRefusedThroughout("freeRestDay", "2026-08-13", "2026-08-08", FRIDAY),
    ).toBe("notRestDay");
  });
});

/**
 * **No gesture in the application can leave a spell open**, and this is the
 * test that keeps it that way.
 *
 * The stored shape allows it: `DaySpan.to` is `IsoDate | null`, the Postgres
 * column is nullable, and the engine clips an open spell at the month's own
 * last day (`openSickSpellOf`, `clipEndOf`). `specs.md` item 8 settles why the
 * shape exists and no screen produces it — "There is no gesture for opening
 * one, and there is deliberately none": continuity is inferred from the days
 * marked, and a second gesture meaning "they are still ill" would be a second way
 * to say what marking the days already says.
 *
 * `applyMark` is the only path from a user's sweep to a stored span, so the
 * guarantee is a property of this one function and is asserted here rather than
 * argued in a comment. **What it would catch**: a change that starts writing
 * `to: null` from the calendar — which is a trap rather than a bug, because the
 * spell would go on drawing sick days from the balance for as long as nobody
 * closed it, and the only screen that closes one is reached from an export the
 * open spell itself blocks.
 */
describe("a sweep never leaves a spell open (specs.md item 8)", () => {
  const sweeps: { what: string; intent: Parameters<typeof applyMark>[0] }[] = [
    { what: "one sick day", intent: { kind: "sick", from: "2026-08-10", to: "2026-08-10" } },
    { what: "a sick range", intent: { kind: "sick", from: "2026-08-10", to: "2026-08-14" } },
    {
      what: "a sick range across a month boundary",
      intent: { kind: "sick", from: "2026-08-28", to: "2026-09-03" },
    },
    {
      what: "a sick range broken by a day that refuses the mark",
      intent: { kind: "sick", from: "2026-08-10", to: "2026-08-20" },
    },
    { what: "a vacation range", intent: { kind: "vacation", from: "2026-08-10", to: "2026-08-14" } },
    // The 22nd and not the 15th: the 15th carries the holiday below, so a
    // free rest day there is refused and the sweep writes nothing at all.
    { what: "a free rest day", intent: { kind: "freeRestDay", from: "2026-08-22", to: "2026-08-22" } },
  ];

  // A day already marked, so one sweep above is broken around it and yields two
  // spans: the run that is *split* is where an end could most plausibly go
  // missing.
  const existing: DaySpan[] = [
    { id: "holiday", kind: "holiday", from: "2026-08-15", to: "2026-08-15" },
  ];

  for (const { what, intent } of sweeps) {
    it(`closes every span it writes for ${what}`, () => {
      const { spans } = applyMark(intent, SATURDAY, existing);
      expect(spans.length).toBeGreaterThan(0);
      for (const span of spans) {
        // Not `toBeTruthy`: an empty string is falsy and would pass that while
        // being just as wrong as a null.
        expect(span.to).not.toBeNull();
        expect(span.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  }

  it("closes both spans when a sweep is broken in two", () => {
    const { spans } = applyMark(
      { kind: "sick", from: "2026-08-13", to: "2026-08-17" },
      SATURDAY,
      existing,
    );
    // 13–14 and 16–17: the 15th is the holiday above and the Saturday is kept
    // by sickness, so the break is the holiday's alone.
    expect(spans.length).toBeGreaterThan(1);
    expect(spans.every((span) => span.to !== null)).toBe(true);
  });
});
