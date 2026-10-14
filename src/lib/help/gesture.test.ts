import { describe, expect, it } from "vitest";
import { gestureIn, instructionIn, stage, type Gesture } from "@/lib/help/gesture";
import { SATURDAY, SUNDAY } from "@/lib/dates";
import type { MonthSpan } from "@/lib/engine/types";

/**
 * The grammar that reads an instruction out of a typed sentence, and what one
 * comes to against a worker's own calendar (specs.md item 24).
 *
 * **Every date here is read off a wall calendar and not off the parser.**
 * September 2026 begins on a Tuesday: the Sundays are the 6th, 13th, 20th and
 * 27th, the Fridays the 4th, 11th, 18th and 25th, and the Saturdays the 5th,
 * 12th, 19th and 26th — so the 28th is a Monday, the 29th a Tuesday and the
 * 30th a Wednesday. Those are the facts the expectations below are built from
 * (`CLAUDE.md` rule 11).
 *
 * **`today` is passed in everywhere**, so a sentence with no year in it says
 * the same thing in every session and the suite never depends on the day it is
 * run (`CLAUDE.md`).
 */

/** A day in the year the sentences below are written in, as every caller of
 * the grammar passes one. */
const TODAY = "2026-09-20";

/** A stored span, written as the fixtures below need it: a holiday of one day
 * unless another kind, another end or an answer is given. */
function spanOf(span: {
  id: string;
  from: string;
  to?: string;
  kind?: MonthSpan["kind"];
  worked?: boolean;
}): MonthSpan {
  return { to: span.from, kind: "holiday", ...span } as MonthSpan;
}

describe("gestureIn — what makes a sentence an instruction", () => {
  it("reads the kind and the range out of a marking sentence", () => {
    expect(gestureIn("סמן חופשה מ-28.9 עד 30.9", TODAY)).toEqual({
      kind: "vacation",
      from: "2026-09-28",
      to: "2026-09-30",
    } satisfies Gesture);
  });

  it("reads one date as one day", () => {
    expect(gestureIn("סמן מחלה ב-28.9", TODAY)).toEqual({
      kind: "sick",
      from: "2026-09-28",
      to: "2026-09-28",
    } satisfies Gesture);
  });

  it("takes the year from the sentence where it carries one", () => {
    expect(gestureIn("סמן חופשה 28.9.2025", TODAY)).toEqual({
      kind: "vacation",
      from: "2025-09-28",
      to: "2025-09-28",
    } satisfies Gesture);
  });

  it("reads a two-digit year as this century", () => {
    expect(gestureIn("סמן חופשה 1.10.27", TODAY)).toEqual({
      kind: "vacation",
      from: "2027-10-01",
      to: "2027-10-01",
    } satisfies Gesture);
  });

  it("orders a range typed backwards, because a sweep is drawn either way", () => {
    expect(gestureIn("סמן חופשה מ-30.9 עד 28.9", TODAY)).toEqual({
      kind: "vacation",
      from: "2026-09-28",
      to: "2026-09-30",
    } satisfies Gesture);
  });

  it("reads the kind under a prefix, the way the matcher reads every word", () => {
    expect(gestureIn("תסמני בחופשה את 28.9", TODAY)?.kind).toBe("vacation");
  });

  it.each([
    ["סמן חופשה מ-28.9 עד 30.9", "vacation"],
    ["רשום מחלה 28.9", "sick"],
    ["הוסף יום מנוחה 27.9", "freeRestDay"],
    ["סמן חג מ-28.9 עד 30.9", "holidayWorked"],
  ])("%s names its kind", (typed, kind) => {
    expect(gestureIn(typed, TODAY)?.kind).toBe(kind);
  });

  it.each([
    ["כמה ימי חופשה נשארו?", "a question carrying a kind and no verb"],
    ["סמן 28.9", "a verb and a date naming no kind"],
    ["סמן חופשה", "a verb and a kind naming no date"],
    ["איך מסמנים חופשה ב-28.9?", "a question about how, which carries both"],
    ["סמן חופשה או מחלה ב-28.9", "two kinds, so which was meant is a guess"],
    ["סמן חופשה 28.9 ו-29.9 ו-30.9", "three dates, which is no shape of range"],
    ["סמן חופשה ב-31.9", "a day September does not have"],
    ["", "nothing typed at all"],
  ])("refuses %s — %s", (typed) => {
    expect(gestureIn(typed, TODAY)).toBeNull();
  });

  it("refuses a range longer than the longest month", () => {
    // A sweep on the calendar lives inside one month's grid, so a year of
    // sickness is a gesture no screen offers and item 24 says the press does no
    // more than one that does. 1.1–31.12 is 365 days.
    expect(gestureIn("סמן מחלה מ-1.1 עד 31.12", TODAY)).toBeNull();
  });

  it("allows a range of the longest month's own length", () => {
    // 1–31 August is 31 days, which the August grid could be swept in one
    // drag — so the sentence may say it.
    expect(gestureIn("סמן מחלה מ-1.8 עד 31.8", TODAY)).toEqual({
      kind: "sick",
      from: "2026-08-01",
      to: "2026-08-31",
    } satisfies Gesture);
  });

  it("allows a spell running from one month into the next", () => {
    // 28.9–2.10 is five days across a boundary, which item 8 calls an ordinary
    // thing to record — the cap counts days and not months for this reason.
    expect(gestureIn("סמן מחלה מ-28.9 עד 2.10", TODAY)).toEqual({
      kind: "sick",
      from: "2026-09-28",
      to: "2026-10-02",
    } satisfies Gesture);
  });

  it("reads an instruction without being told what day it is", () => {
    // The browser decides a sentence is an instruction, and nothing there may
    // read a clock (`CLAUDE.md`) — so this half takes no `today` and the year
    // stays as the sentence left it.
    expect(instructionIn("סמן חופשה מ-28.9 עד 30.9")).toEqual({
      kind: "vacation",
      dates: [
        { day: 28, month: 9, year: null },
        { day: 30, month: 9, year: null },
      ],
    });
    expect(instructionIn("כמה ימי חופשה נשארו?")).toBeNull();
  });
});

describe("stage — what a proposal comes to against the worker's calendar", () => {
  const vacation = gestureIn("סמן חופשה מ-25.9 עד 28.9", TODAY);

  it("proposes the days the calendar's own rule allows, and says which it refused", () => {
    // 25–28.9.2026 is Friday to Monday. A Saturday-resting worker loses the
    // 26th, which is their weekly rest and is never drawn from the vacation
    // quota (specs.md item 5) — so three of the four days stand.
    expect(vacation).not.toBeNull();
    const staged = stage(vacation!, SATURDAY, []);
    expect(staged.days).toEqual(["2026-09-25", "2026-09-27", "2026-09-28"]);
    expect(staged.skipped).toEqual([
      { date: "2026-09-26", reason: "weeklyRest" },
    ]);
  });

  it("refuses a different day for a worker whose rest day is a different day", () => {
    // The same sentence, a Sunday-resting worker: the 27th goes instead of the
    // 26th. **Anything that once counted Saturdays counts rest days**
    // (`CLAUDE.md`, item 5).
    const staged = stage(vacation!, SUNDAY, []);
    expect(staged.days).toEqual(["2026-09-25", "2026-09-26", "2026-09-28"]);
    expect(staged.skipped).toEqual([
      { date: "2026-09-27", reason: "weeklyRest" },
    ]);
  });

  it("leaves a day that already carries a mark alone", () => {
    const staged = stage(vacation!, SATURDAY, [
      spanOf({ id: "s1", kind: "sick", from: "2026-09-27", to: "2026-09-27" }),
    ]);
    expect(staged.days).toEqual(["2026-09-25", "2026-09-28"]);
    expect(staged.skipped).toContainEqual({
      date: "2026-09-27",
      reason: "alreadyMarked",
    });
  });

  it("proposes nothing where no day of the range can take the mark", () => {
    // A free rest day is the one kind only the rest day itself can take
    // (item 5), and 28–30.9 holds no Saturday.
    const freeRest = gestureIn("סמן יום מנוחה מ-28.9 עד 30.9", TODAY);
    const staged = stage(freeRest!, SATURDAY, []);
    expect(staged.days).toEqual([]);
    expect(staged.skipped.map((day) => day.reason)).toEqual([
      "notRestDay",
      "notRestDay",
      "notRestDay",
    ]);
  });

  it("stages exactly the three days of a holiday instruction", () => {
    // `סמן חג מ-28.9 עד 30.9` against a year holding those three as holidays:
    // what changes is the one answer a month records about them (item 9).
    const holiday = gestureIn("סמן חג מ-28.9 עד 30.9", TODAY);
    const staged = stage(holiday!, SATURDAY, [
      spanOf({ id: "h1", from: "2026-09-28" }),
      spanOf({ id: "h2", from: "2026-09-29" }),
      spanOf({ id: "h3", from: "2026-09-30" }),
      spanOf({ id: "h4", from: "2026-10-02" }),
    ]);
    expect(staged.days).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
    expect(staged.holidaySpans).toEqual(["h1", "h2", "h3"]);
  });

  it("draws every day of a holiday span the range only touches", () => {
    // Naming one day of a three-day holiday changes the answer for all three,
    // because the answer belongs to the span. A proposal that drew one day
    // would understate what the press does.
    const holiday = gestureIn("סמן חג ב-29.9", TODAY);
    const staged = stage(holiday!, SATURDAY, [
      spanOf({ id: "h1", from: "2026-09-28", to: "2026-09-30" }),
    ]);
    expect(staged.days).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
    expect(staged.holidaySpans).toEqual(["h1"]);
  });

  it("passes over a holiday already answered, and over a day that is none", () => {
    const holiday = gestureIn("סמן חג מ-28.9 עד 30.9", TODAY);
    const staged = stage(holiday!, SATURDAY, [
      spanOf({ id: "h1", from: "2026-09-28", worked: true }),
      spanOf({ id: "s1", kind: "vacation", from: "2026-09-29" }),
      spanOf({ id: "h2", from: "2026-09-30" }),
    ]);
    expect(staged.days).toEqual(["2026-09-30"]);
    expect(staged.holidaySpans).toEqual(["h2"]);
  });
});
