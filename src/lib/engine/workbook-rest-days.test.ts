import { describe, expect, it } from "vitest";
import { calculateMonth } from "@/lib/engine/month";
import {
  REST_EVE_SUPPLEMENT,
  WORKBOOK_MONTHS,
  workbookFacts,
  workbookWorker,
} from "@/lib/engine/workbook.fixture";

/**
 * The rest days and the rest-eve supplement, against `F2` and `G2` of fifteen
 * tabs.
 *
 * These two counts are the ones `specs.md` Part 5 says a quiet, systematic error
 * hides in: a month beginning on a Saturday holds five of them and the same
 * length beginning on a Sunday holds four, both still pay a whole salary, and
 * the mistake stays invisible until a month with an absence in it. The family
 * counted them by hand, month after month, which makes their columns an
 * independent answer to the engine's calendar walk.
 */

const byTab = (tab: string) => {
  const m = WORKBOOK_MONTHS.find((candidate) => candidate.tab === tab);
  if (!m) throw new Error(`no fixture for ${tab}`);
  return m;
};

describe("the rest days the calendar yields, against what the family counted", () => {
  for (const m of WORKBOOK_MONTHS) {
    it(`${m.tab}: ${m.restDaysWorked} rest days worked and ${m.restEvesWorked} rest-eves`, () => {
      const result = calculateMonth(
        workbookFacts(m),
        workbookWorker(m.salaryAgorot),
      );
      const supplement = result.lines.find(
        (line) => line.key === "restEveSupplement",
      );
      const restDays = result.lines.find((line) => line.key === "restDays");

      // `G2`: the rest days she worked. The engine derives it as the month's
      // rest days less the ones marked free, so a fixed count of four fails on
      // `חודש  5.26` and a free day counted twice fails on `חודש  8.25`.
      expect(restDays?.units ?? 0).toBe(m.restDaysWorked);

      // `F2`: the rest-eves. Every one of these fifteen months has her working
      // all of them, so the family's "Fridays worked" and item 14's "every
      // rest-eve of the month" agree throughout, and the count is a clean check
      // on the calendar rather than on the rule.
      expect(supplement?.units ?? 0).toBe(m.restEvesWorked);
    });
  }
});

describe("the two counts are not the same count", () => {
  it("differs in nine of the fifteen months", () => {
    // The assertion that keeps the test above honest. If the engine derived the
    // rest-eves from the rest-day count — or the other way round — every month
    // where the two agree would still pass, so what proves they are computed
    // apart is that the fixture contains months where they do not.
    const differing = WORKBOOK_MONTHS.filter(
      (m) => m.restEvesWorked !== m.restDaysWorked,
    );
    expect(differing.length).toBe(9);
  });

  it("`חודש  7.26` has five rest-eves and three rest days", () => {
    // July 2026 begins on a Wednesday: five Fridays, four Saturdays, one of
    // them taken free on the 11th. The widest gap in the fixture.
    const m = byTab("חודש  7.26");
    expect(m.restEvesWorked).toBe(5);
    expect(m.restDaysWorked).toBe(3);
  });
});

describe("the supplement is ₪100 a rest-eve, and the pay is the rest-day rate", () => {
  it("pays ₪500 across five rest-eves in `חודש  5.26`", () => {
    // `E23` of that tab is ₪6,943.85, which is the ₪6,443.85 salary plus ₪500.
    const m = byTab("חודש  5.26");
    const result = calculateMonth(
      workbookFacts(m),
      workbookWorker(m.salaryAgorot),
    );
    const supplement = result.lines.find(
      (line) => line.key === "restEveSupplement",
    );
    expect(supplement?.rate).toBe(REST_EVE_SUPPLEMENT);
    expect(supplement?.amount).toBe(50000);
    expect(m.subtotalE).toBe(m.salaryAgorot + 50000);
  });

  it("leaves the supplement out of the rest-day column", () => {
    // Part 5: column E carries the monthly salary items and F the pay for rest
    // days and holidays. The supplement is agreed weekly money and belongs with
    // the salary — putting it in F would keep the ברוטו right and both
    // subtotals wrong, which is the failure no total catches.
    const m = byTab("חודש  8.25");
    const result = calculateMonth(
      workbookFacts(m),
      workbookWorker(m.salaryAgorot),
    );
    const supplement = result.lines.find(
      (line) => line.key === "restEveSupplement",
    );
    const restDays = result.lines.find((line) => line.key === "restDays");
    expect(supplement?.column).toBe("E");
    expect(restDays?.column).toBe("F");
  });

  it("draws no rest-day line at all in a month with none left to work", () => {
    // There is no such month in the fixture — she worked at least three in
    // every one — so this states the boundary the fixture cannot: a month whose
    // rest days are all free prints no row rather than a row of zero.
    const m = byTab("חודש  6.26");
    const allFree = {
      ...m,
      freeRestDays: ["2026-06-06", "2026-06-13", "2026-06-20", "2026-06-27"],
      holidaysWorked: [],
    };
    const result = calculateMonth(
      workbookFacts(allFree),
      workbookWorker(m.salaryAgorot),
    );
    expect(result.lines.some((line) => line.key === "restDays")).toBe(false);
    // The salary is untouched by it: a free rest day stands outside the
    // standard count, so it costs her nothing (item 5).
    expect(result.gross).toBe(m.salaryAgorot + 40000);
  });
});
