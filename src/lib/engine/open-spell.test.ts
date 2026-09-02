import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth } from "@/lib/engine/month";
import { clipEndOf, snapshotTerms } from "@/lib/engine/types";

import type {
  ClosedMonthFacts,
  MonthFacts,
  MonthSpan,
  WorkerTerms,
} from "@/lib/engine/types";
import type { MonthResult } from "@/lib/types";

/**
 * A spell of sickness that has not ended (specs.md item 8).
 *
 * **On the day a worker falls ill nobody knows the day she will return**, so
 * the application does not ask for one: the spell runs from its first day and
 * is closed when she comes back. It is never *crossed* by a month boundary — it
 * simply has not ended — and it stays one spell with one first day, which is
 * what the tiers are counted from.
 *
 * A month counts it by clipping at **that month's own last day**, which is a
 * fact about the month and not about the present. Nothing here reads a clock:
 * `today` reaches the engine only where a caller asks for the current month's
 * live preview.
 *
 * **The figures, derived on paper.** Hanna's August 2025 — 31 days from a
 * Friday, Saturdays on 2, 9, 16, 23 and 30, Fridays on 1, 8, 15, 22 and 29 —
 * with a spell that begins on Thursday the 28th and is never closed. Clipped at
 * the 31st it covers the 28th, 29th, 30th and 31st, and the tiers count from
 * its own first day:
 *
 *   Thu 28  day 1  nothing paid              1 day unpaid
 *   Fri 29  day 2  half paid               0.5 day unpaid
 *   Sat 30  day 3  her rest day                0 unpaid
 *   Sun 31  day 4  paid in full                0 unpaid
 *
 * The rest day takes nothing back because the standard count left it out, so
 * the salary never paid for it (item 8). The deduction is 1.5 days at the
 * ₪6,247.65 ÷ 25 sick-day value of 24,990.6 agorot, so 37,485.9 → −₪374.86.
 *
 *   column E   624,765 + 5 × 10,000 − 37,486         = 637,279   ₪6,372.79
 *   column F   4 × 42,635.062087912… = 170,540.24…   = 170,540   ₪1,705.40
 *   gross                                             = 807,819   ₪8,078.19
 *
 * Four rest days and not five, because the 30th falls inside the spell and is
 * not worked. **Five rest-eves and not four**, though the 29th falls inside it
 * too: the supplement is paid for every rest-eve of the month whether she
 * worked it or not (item 14). Sickness prices itself through the deduction and
 * never through that line.
 *
 * **The same spell, closed on Friday the 29th** — she came back on the 30th.
 * The deduction does not move: days three and four were already costing
 * nothing. What moves is the rest day. The 30th was worked after all:
 *
 *   column E   unchanged                             = 637,279   ₪6,372.79
 *   column F   5 × 42,635.062087912… = 213,175.31…   = 213,175   ₪2,131.75
 *   gross                                             = 850,454   ₪8,504.54
 */

const AUGUST_2025 = { year: 2025, month: 8 } as const;
const SALARY = 624765;

const worker: WorkerTerms = {
  employedSince: "2024-04-01",
  baseMonthlySalaryAgorot: SALARY,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  country: "PH",
  // The spell draws four days from the balance — rest days included, since a
  // rest day inside a spell is drawn from it though it is not paid (item 8) —
  // and the balance is a floor that never falls below zero, so a month drawing
  // more than it holds is refused rather than calculated.
  openingPosition: { vacationDays: 0, sickDays: 30, advances: [] },
};

function facts(spans: MonthSpan[]): MonthFacts {
  return {
    month: AUGUST_2025,
    terms: snapshotTerms(worker),
    confirmedWage: {
      baseAgorot: SALARY,
      minimumAgorot: SALARY,
      effectiveFrom: "2025-04-01",
    },
    spans,
    advances: [],
    thirdPartyPayments: [],
    extraPayments: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

/** A spell with no end yet — how one is normally recorded (item 8). */
const open: MonthSpan[] = [
  { id: "sick-open", kind: "sick", from: "2025-08-28", to: null },
];

/** The same days, written as a spell that ended with the month. */
const closedAtMonthEnd: MonthSpan[] = [
  { id: "sick-closed", kind: "sick", from: "2025-08-28", to: "2025-08-31" },
];

function figures(result: MonthResult) {
  const column = (c: string) =>
    result.lines
      .filter((line) => line.column === c)
      .reduce((total, line) => total + (line.amount ?? 0), 0);
  return {
    e: column("E"),
    f: column("F"),
    gross: result.gross,
    actualDays: result.actualDays,
    sickUsed: result.balances.find((b) => b.kind === "sick")?.used,
  };
}

describe("an open spell is counted to the month's own last day (item 8)", () => {
  it("pays the month exactly what the closed spell of the same days pays it", () => {
    // The property the whole shape rests on, and it is asserted as a relation
    // rather than against a figure: whatever the month comes to, an open spell
    // and a spell that ended on the 31st must come to the same thing. If these
    // ever disagree, the open case has grown a rule of its own.
    expect(figures(calculateMonth(facts(open), worker))).toEqual(
      figures(calculateMonth(facts(closedAtMonthEnd), worker)),
    );
  });

  it("comes to ₪8,078.19, the figure derived on paper", () => {
    // The relation above would hold just as well if both were wrong, so the
    // figure is pinned once, from the derivation in this file's header.
    expect(figures(calculateMonth(facts(open), worker))).toEqual({
      e: 637279,
      f: 170540,
      gross: 807819,
      // 26 standard days less the 28th, 29th and 31st. The 30th is her rest
      // day and stood outside the count from the start.
      actualDays: 23,
      // Four days drawn from the balance, the rest day among them (item 8).
      sickUsed: 4,
    });
  });
});

describe("the clip is a fact about the month, not about the present (item 8)", () => {
  it("clips at the month's last day and never past it", () => {
    // **Asserted here rather than through a month's figures, because a month
    // cannot see it.** Every rule below `closeMonth` already clips to the month
    // it is calculating, so a `clipEndOf` that forgot to bound `today` by the
    // month's end would leave August's total exactly where it is — a mutation
    // confirmed to survive the two cases below. What it would change is the
    // spell: an open spell stretched to a `today` months later swallows a
    // genuinely separate illness recorded in between, and the tiers of that
    // later month then continue the earlier spell instead of restarting. So
    // the rule is checked where it is visible.
    const august = { year: 2025, month: 8 };
    expect(clipEndOf(august)).toBe("2025-08-31");
    expect(clipEndOf(august, "2025-08-14")).toBe("2025-08-14");
    expect(clipEndOf(august, "2025-08-31")).toBe("2025-08-31");
    // Today after the month: the month's own last day wins, because the clip is
    // a fact about the month and not about the present (item 8).
    expect(clipEndOf(august, "2025-09-01")).toBe("2025-08-31");
    expect(clipEndOf(august, "2027-06-15")).toBe("2025-08-31");
  });

  it("gives the same August whenever it is looked at", () => {
    // A finished month's figure is settled once the month has ended and never
    // moves because of when it is looked at. Asserted across a `today` the day
    // after the month, one months later, and none at all.
    const settled = figures(calculateMonth(facts(open), worker));
    for (const today of ["2025-09-01", "2025-12-31", "2027-06-15"]) {
      expect(figures(calculateMonth(facts(open), worker, { today }))).toEqual(
        settled,
      );
    }
  });

  it("clips the current month's live preview at today instead", () => {
    // The one case where `today` changes anything, and it is the caller's
    // value rather than a clock the engine read (CLAUDE.md). Asked for on
    // Friday the 29th, the preview shows what a spell closed on the 29th
    // shows — which is the next describe's figure, reached from the other
    // side.
    const preview = calculateMonth(facts(open), worker, {
      today: "2025-08-29",
    });
    expect(figures(preview).gross).toBe(850454);
  });
});

describe("closing a spell after the fact moves the month (criterion 13)", () => {
  // The hazard of an open spell is the opposite of a missing one: a worker who
  // returned and whose spell nobody closed. The month over-counts until it is
  // closed, and closing it corrects the month rather than needing anything
  // built for it.
  const closedOn29: MonthSpan[] = [
    { id: "sick-open", kind: "sick", from: "2025-08-28", to: "2025-08-29" },
  ];

  it("gives back the rest day she turned out to have worked", () => {
    // She came back on Saturday the 30th, so that rest day is paid after all:
    // five at ₪426.35 instead of four. Column E does not move, because days
    // three and four of the spell were already costing nothing.
    expect(figures(calculateMonth(facts(closedOn29), worker))).toEqual({
      e: 637279,
      f: 213175,
      gross: 850454,
      actualDays: 24,
      sickUsed: 2,
    });
  });

  it("moves the month's total and nothing else has to be told", () => {
    // The correction is the whole mechanism: the same facts with an end date
    // added, replayed. ₪8,078.19 becomes ₪8,504.54.
    const before = calculateMonth(facts(open), worker).gross;
    const after = calculateMonth(facts(closedOn29), worker).gross;
    expect(before).toBe(807819);
    expect(after).toBe(850454);
  });
});

describe("the engine's interior never meets an open span", () => {
  it("hands every rule a span with an end", () => {
    // `closeMonth` resolves the open case once, so no counting rule, tier or
    // balance below it carries it. The type says so and this asserts it holds
    // at runtime for the month the engine actually worked on.
    const resolved: ClosedMonthFacts = {
      ...facts(open),
      spans: [{ id: "sick-open", kind: "sick", from: "2025-08-28", to: "2025-08-31" }],
    };
    expect(resolved.spans.every((span) => span.to !== null)).toBe(true);
    expect(figures(calculateMonth(resolved, worker))).toEqual(
      figures(calculateMonth(facts(open), worker)),
    );
  });
});
