import { describe, expect, it } from "vitest";
import { FRIDAY, SATURDAY, SUNDAY } from "@/lib/dates";
import { countMonth } from "@/lib/engine/counts";
import { calculateMonth } from "@/lib/engine/month";
import { InvalidMonthError, validateMonth } from "@/lib/engine/validate";
import { snapshotTerms } from "@/lib/engine/types";
import type { ClosedMonthFacts, ClosedSpan, WorkerTerms } from "@/lib/engine/types";
import type { MonthResult, YearMonth } from "@/lib/types";

/**
 * The weekly rest day generalised: a Friday-resting and a Sunday-resting worker
 * (specs.md items 5, 8 and 14).
 *
 * **Every figure here is derived on paper before the code was written, and none
 * is read back from the engine.** No workbook covers these two workers — the
 * family's own sheet is Hanna's, and Hanna rests on Saturday — so
 * `august-2025.snap.md` proves nothing whatever about them: every non-Saturday
 * path is unreachable from it by construction. That is the condition under
 * which `CLAUDE.md` forbids reading an expected figure out of the engine, and
 * it is why this file exists as its own case rather than as more assertions
 * beside the known one.
 *
 * **Two months, and the reason is the point of the file.** No single month
 * tells all three workers apart, so a suite built on one month would pass while
 * the rest day stayed a constant:
 *
 *   August 2025   31 days from a Friday   Fri 5  Sat 5  Sun 5  Thu 4
 *   March 2026    31 days from a Sunday   Fri 4  Sat 4  Sun 5  Thu 4
 *
 * In August the Saturday- and Sunday-resting workers have five rest days each
 * and five rest-eves each, so their counts and their money agree to the agora;
 * only the Friday-resting worker stands out, on her four Thursdays. In March it
 * reverses: Friday and Saturday both give four rest days and four rest-eves,
 * and the Sunday-resting worker is the one that stands out, on her five
 * Sundays. **Each worker is therefore checked in the month that can see her.**
 * This was found by mutation — forcing the rest day back to Saturday left every
 * Sunday-resting case in August passing — and it is written down because a
 * later reader tidying these two into one month would quietly undo them.
 *
 * **The rates, derived from item 3 and Part 5 and checked against Part 4.** The
 * salary is Part 4's ₪6,247.65, so 624,765 agorot.
 *
 *   daily      624765 / 25   = 24,990.6 agorot
 *   hourly     624765 / 182  = 3,432.774725274…
 *   rest day   (24990.6 + 3432.774725274…) × 1.5 = 42,635.062087912… agorot
 *
 * That last figure is the arithmetic's own check: six of them — Part 4's four
 * Saturdays worked plus two holidays — come to 255,810.37…, which rounds to the
 * ₪2,558.10 Part 4 states outright. The method that reproduces the known case
 * to the agora is the method used below on the two that have no known case.
 *
 * **The Friday-resting worker, August 2025, nothing marked.** Her rest days are
 * the five Fridays, so the standard count is 31 − 5 = 26 — the same 26 as
 * Hanna's, and for a different reason. Her rest-eve is the working day
 * immediately before her rest day (item 14), which is Thursday, and August
 * holds only four of those:
 *
 *   column E   624,765 + 4 × 10,000                 = 664,765   ₪6,647.65
 *   column F   5 × 42,635.062087912… = 213,175.31…  = 213,175   ₪2,131.75
 *   gross                                            = 877,940   ₪8,779.40
 *
 * Hanna's own August is ₪6,747.65 and ₪9,305.75, so no figure above can be
 * reached by a run that never left her calendar.
 *
 * **The Sunday-resting worker, March 2026, nothing marked.** Her rest days are
 * the five Sundays — 1, 8, 15, 22, 29 — so the standard count is 31 − 5 = 26,
 * where a Saturday-resting worker's March is 31 − 4 = 27. Her rest-eve is
 * Saturday, and March holds four:
 *
 *   column E   624,765 + 4 × 10,000                 = 664,765   ₪6,647.65
 *   column F   5 × 42,635.062087912… = 213,175.31…  = 213,175   ₪2,131.75
 *   gross                                            = 877,940   ₪8,779.40
 *
 * A Saturday-resting worker's March pays four rest days — 4 × 42,635.062087912…
 * = 170,540.24…, so ₪1,705.40 — over 27 standard days, and the last case below
 * asserts that half too, so the two are held apart rather than assumed apart.
 */

const AUGUST_2025: YearMonth = { year: 2025, month: 8 };
const MARCH_2026: YearMonth = { year: 2026, month: 3 };
const SALARY = 624765;
const SUPPLEMENT = 10000;

function terms(overrides: Partial<WorkerTerms> = {}): WorkerTerms {
  return {
    employedSince: "2024-04-01",
    baseMonthlySalaryAgorot: SALARY,
    restDay: SATURDAY,
    restEveSupplementAgorot: SUPPLEMENT,
    recuperationMonth: 7,
    standingLines: [],
    country: "PH",
    openingPosition: { vacationDays: 0, sickDays: 0, advances: [] },
    ...overrides,
  };
}

function facts(
  worker: WorkerTerms,
  month: YearMonth,
  spans: ClosedSpan[] = [],
): ClosedMonthFacts {
  return {
    month,
    terms: snapshotTerms(worker),
    confirmedWage: {
      baseAgorot: SALARY,
      minimumAgorot: SALARY,
      effectiveFrom: "2025-04-01",
    },
    spans,
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

function columnTotal(result: MonthResult, column: string): number {
  return result.lines
    .filter((line) => line.column === column)
    .reduce((total, line) => total + (line.amount ?? 0), 0);
}

describe("a Friday-resting worker, August 2025 (specs.md items 5, 14)", () => {
  const worker = terms({ restDay: FRIDAY });
  const result = calculateMonth(facts(worker, AUGUST_2025), worker);

  it("counts her five Fridays as rest days and her four Thursdays as rest-eves", () => {
    // **The rest-eve count is what tells her from Hanna**: August holds five
    // Fridays but only four Thursdays — 7, 14, 21, 28 — so a run that still
    // answers five here never left Hanna's calendar. The standard count cannot
    // catch it, since 31 − 5 is 26 either way, which is why it is not asserted
    // on its own.
    const counts = countMonth(facts(worker, AUGUST_2025));
    expect(counts.restDays).toBe(5);
    expect(counts.standardDays).toBe(26);
    expect(counts.restEves).toBe(4);
    expect(counts.restEvesWorked).toBe(4);
  });

  it("pays ₪6,647.65 in column E — the base plus four rest-eves", () => {
    // 624,765 + 4 × 10,000. Four and not five, because the supplement follows
    // the rest-eve and not the Friday (item 14). Hanna's column E is ₪6,747.65,
    // so that figure appearing here is the supplement being paid on days that
    // earn it for somebody else.
    expect(columnTotal(result, "E")).toBe(664765);
  });

  it("pays ₪2,131.75 in column F — her five Fridays worked", () => {
    // 5 × 42,635.062087912… = 213,175.31…, rounded once at the end.
    expect(columnTotal(result, "F")).toBe(213175);
  });

  it("gives a gross of ₪8,779.40", () => {
    expect(result.gross).toBe(877940);
  });
});

describe("a Sunday-resting worker, March 2026 (specs.md items 5, 14)", () => {
  const worker = terms({ restDay: SUNDAY });
  const result = calculateMonth(facts(worker, MARCH_2026), worker);

  it("counts her five Sundays as rest days, against a Saturday-rester's four", () => {
    // March 2026 begins on a Sunday, so it holds five Sundays — 1, 8, 15, 22,
    // 29 — and four Saturdays. **August could not have caught this**: there she
    // and Hanna hold five rest days and five rest-eves each and agree on every
    // figure to the agora.
    const counts = countMonth(facts(worker, MARCH_2026));
    expect(counts.restDays).toBe(5);
    expect(counts.standardDays).toBe(26);
    expect(counts.restEves).toBe(4);
  });

  it("pays ₪6,647.65 in column E — the base plus four rest-eves", () => {
    // 624,765 + 4 × 10,000; March holds four Saturdays, which are her
    // rest-eves.
    expect(columnTotal(result, "E")).toBe(664765);
  });

  it("pays ₪2,131.75 in column F — her five Sundays worked", () => {
    // 5 × 42,635.062087912… = 213,175.31….
    expect(columnTotal(result, "F")).toBe(213175);
  });

  it("gives a gross of ₪8,779.40", () => {
    expect(result.gross).toBe(877940);
  });

  it("leaves a Saturday-resting worker's own March at four rest days and 27", () => {
    // The other half of the pair, so the two are held apart rather than assumed
    // apart: 4 × 42,635.062087912… = 170,540.24…, over 31 − 4 = 27 standard
    // days. If this case and the ones above ever agree, the rest day has
    // stopped being read.
    const hanna = terms({ restDay: SATURDAY });
    const march = calculateMonth(facts(hanna, MARCH_2026), hanna);
    expect(march.standardDays).toBe(27);
    expect(columnTotal(march, "F")).toBe(170540);
    expect(march.gross).toBe(835305);
  });
});


/**
 * A rest day inside a spell of sickness advances the tier without being paid
 * and without being deducted for (item 8), so **which** day of the spell is her
 * rest day changes what the month deducts.
 *
 * The spell 13–17 August 2025, read twice. Counting from its own first day:
 *
 *   Wed 13  day 1   nothing paid          1 day unpaid
 *   Thu 14  day 2   half paid           0.5 day unpaid
 *   Fri 15  day 3   half paid           0.5 day unpaid
 *   Sat 16  day 4   paid in full            0 unpaid
 *   Sun 17  day 5   paid in full            0 unpaid
 *
 * A Saturday-resting worker's rest day is the 16th, which was costing nothing
 * anyway, so she deducts 1 + 0.5 + 0.5 = 2 days. A Friday-resting worker's rest
 * day is the 15th, which was carrying half a day, and a rest day is deducted
 * for nothing — the standard count left it out, so the salary never paid for it
 * and there is nothing to take back. She deducts 1.5 days.
 *
 *   Friday-resting    1.5 × 24,990.6 = 37,485.9   →  −₪374.86
 *   Saturday-resting  2.0 × 24,990.6 = 49,981.2   →  −₪499.81
 */
describe("a rest day inside a spell is not deducted for (specs.md item 8)", () => {
  const spell: ClosedSpan[] = [
    { id: "sick-13-17", kind: "sick", from: "2025-08-13", to: "2025-08-17" },
  ];
  const opening = { vacationDays: 0, sickDays: 30, advances: [] };

  function deduction(worker: WorkerTerms): { units: number; amount: number } {
    const line = calculateMonth(
      facts(worker, AUGUST_2025, spell),
      worker,
    ).lines.find((l) => l.key === "sickDeduction");
    return { units: line?.units ?? 0, amount: line?.amount ?? 0 };
  }

  it("deducts 1.5 days from a Friday-resting worker, whose rest day is day three", () => {
    const worker = terms({ restDay: FRIDAY, openingPosition: opening });
    expect(deduction(worker)).toEqual({ units: -1.5, amount: -37486 });
  });

  it("deducts 2 days from a Saturday-resting worker, whose rest day is day four", () => {
    // Her rest day falls where the tiers already pay in full, so it takes
    // nothing off — the same spell costs her half a day more.
    const worker = terms({ restDay: SATURDAY, openingPosition: opening });
    expect(deduction(worker)).toEqual({ units: -2, amount: -49981 });
  });
});

/**
 * The refusal is this worker's and not everyone's (item 5). A free rest day is
 * recorded on her own rest day, so the same date is a valid entry for one
 * worker and an impossible one for the next.
 */
describe("a free rest day is refused per worker (specs.md item 5)", () => {
  const free = (date: string): ClosedSpan => ({
    id: `free-${date}`,
    kind: "freeRestDay",
    from: date,
    to: date,
  });

  it("accepts a Friday-resting worker's free Friday and pays four rest days", () => {
    // Friday the 15th is hers. Four of her five Fridays are then worked:
    // 4 × 42,635.062087912… = 170,540.24…, over an unchanged column E.
    const worker = terms({ restDay: FRIDAY });
    const result = calculateMonth(
      facts(worker, AUGUST_2025, [free("2025-08-15")]),
      worker,
    );
    expect(columnTotal(result, "F")).toBe(170540);
    expect(result.gross).toBe(835305);
  });

  it("refuses her free Saturday, which is not her rest day", () => {
    const worker = terms({ restDay: FRIDAY });
    const month = facts(worker, AUGUST_2025, [free("2025-08-16")]);
    // Refused with the reason, not merely refused: a month that cannot be
    // calculated correctly is never calculated wrongly in silence, and the code
    // is what the interface shows her.
    expect(validateMonth(month, worker).map((r) => r.code)).toEqual([
      "freeRestDayNotRestDay",
    ]);
    expect(() => calculateMonth(month, worker)).toThrow(InvalidMonthError);
  });

  it("refuses a free Friday for Hanna, whose rest day is Saturday", () => {
    // The exact reverse of the two cases above on the same two dates, which is
    // what makes the refusal per-worker rather than per-date. Friday the 15th
    // is a valid free rest day for one of these workers and an impossible entry
    // for the other.
    const worker = terms({ restDay: SATURDAY });
    const month = facts(worker, AUGUST_2025, [free("2025-08-15")]);
    const [refusal] = validateMonth(month, worker);
    expect(refusal.code).toBe("freeRestDayNotRestDay");
    expect(refusal.dates).toEqual(["2025-08-15"]);
    expect(() => calculateMonth(month, worker)).toThrow(InvalidMonthError);
  });

  it("leaves the Friday-resting worker's own free Friday unrefused", () => {
    // The same check read the other way, so "accepted" is asserted and not just
    // implied by the absence of a throw above.
    const worker = terms({ restDay: FRIDAY });
    expect(
      validateMonth(facts(worker, AUGUST_2025, [free("2025-08-15")]), worker),
    ).toEqual([]);
  });
});

/**
 * The sheet names her own day (specs.md item 5).
 *
 * Every string below is written out here from the Hebrew, not read back from
 * `he.ts`: the point of the assertion is that the wording the engine produces
 * is the wording a reader of this file expects, and comparing the engine to
 * itself would prove only that it is consistent.
 *
 * **Gender is what makes this worth testing.** שבת is feminine and both יום שישי
 * and יום ראשון are masculine, so a sentence that reads correctly for Hanna
 * reads as broken Hebrew for exactly the workers this step exists to serve.
 * Hanna's own wording is held byte-identical by `august-2025.snap.md`, which is
 * the other half of the check: the derivation has to move for these two and not
 * move at all for her.
 */
describe("the sheet names her own rest day (specs.md item 5)", () => {
  function labels(worker: WorkerTerms, month: YearMonth) {
    const result = calculateMonth(facts(worker, month), worker);
    return {
      restDays: result.lines.find((l) => l.key === "restDays")?.label,
      supplement: result.lines.find((l) => l.key === "restEveSupplement")?.label,
      columnF: result.subtotals.find((s) => s.column === "F")?.label,
    };
  }

  it("says עבודה ביום שישי and תוספת ימי חמישי for a Friday-resting worker", () => {
    // Her rest day is Friday and her rest-eve is Thursday, so the pay line
    // names one and the supplement line the other.
    expect(labels(terms({ restDay: FRIDAY }), AUGUST_2025)).toEqual({
      restDays: "עבודה ביום שישי",
      supplement: "תוספת ימי חמישי",
      columnF: "סך ימי שישי וחגים",
    });
  });

  it("says עבודה ביום ראשון and תוספת שבתות for a Sunday-resting worker", () => {
    // Her rest-eve is Saturday, whose plural is שבתות and not ימי שבת — the
    // reason the words are a table and not a format string.
    expect(labels(terms({ restDay: SUNDAY }), MARCH_2026)).toEqual({
      restDays: "עבודה ביום ראשון",
      supplement: "תוספת שבתות",
      columnF: "סך ימי ראשון וחגים",
    });
  });

  it("leaves Hanna's own wording exactly where it was", () => {
    // The same three labels for a Saturday-resting worker, unchanged word for
    // word. `august-2025.snap.md` asserts the paragraphs; these are the labels.
    expect(labels(terms({ restDay: SATURDAY }), AUGUST_2025)).toEqual({
      restDays: "עבודה בשבת",
      supplement: "תוספת ימי שישי",
      columnF: "סך שבתות וחגים",
    });
  });

  it("agrees in gender in the refusal, which is where it would break first", () => {
    // נרשם for a masculine day and נרשמה for שבת. A refusal is the one sentence
    // a user meets at her least forgiving moment, and it is assembled from more
    // inflected words than any other.
    const free = (date: string): ClosedSpan => ({
      id: `free-${date}`,
      kind: "freeRestDay",
      from: date,
      to: date,
    });

    const friday = terms({ restDay: FRIDAY });
    const [herRefusal] = validateMonth(
      facts(friday, AUGUST_2025, [free("2025-08-16")]),
      friday,
    );
    expect(herRefusal.message).toBe(
      "יום שישי חופשי נרשם על יום שאינו יום שישי. יום המנוחה השבועית של העובד/ת הוא יום שישי, ולכן הרישום הזה לא יכול להיות נכון.",
    );

    const hanna = terms({ restDay: SATURDAY });
    const [hersRefusal] = validateMonth(
      facts(hanna, AUGUST_2025, [free("2025-08-15")]),
      hanna,
    );
    expect(hersRefusal.message).toBe(
      "שבת חופשית נרשמה על יום שאינו שבת. יום המנוחה השבועית של העובד/ת הוא שבת, ולכן הרישום הזה לא יכול להיות נכון.",
    );
  });
});
