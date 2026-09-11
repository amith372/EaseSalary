import { describe, expect, it } from "vitest";
import {
  PLAIN_GROSS,
  plainAugustFacts,
  plainWorker,
} from "@/lib/engine/august-2025.fixture";
import { calculateMonth, lineKeys } from "@/lib/engine/month";
import type { Advance, MonthFacts, UserLine, WorkerTerms } from "@/lib/engine/types";
import type { ClosingBlock, MonthResult } from "@/lib/types";

/**
 * The block below the columns has two halves, and the ‏נטו‎ stands between them
 * (specs.md Part 5, items 17 and 20).
 *
 * **The figures are derived on paper**, in `august-2025.fixture.ts`: the month
 * with nothing marked comes to ₪8,879.40, and each case below withholds or
 * transfers exactly one thing from it.
 *
 *   income tax ₪200          נטו 867,940   סך הכל 867,940
 *   tax ₪200 + instalment ₪2,000            סך הכל 667,940
 *   a ₪150 deduction after the total, no tax
 *                            נטו 887,940   סך הכל 872,940
 *
 * The third is the one that carries the answer settled on 2026-09-03: a line the
 * user placed after the total moves the transfer and must leave the ‏נטו‎ exactly
 * where the ‏ברוטו‎ left it (item 20).
 */

function facts(w: WorkerTerms, over: Partial<MonthFacts> = {}): MonthFacts {
  return { ...plainAugustFacts(w), ...over };
}

const instalment: Advance = { number: 1, kind: "repaid", agorot: 200000 };

/** A deduction defaults to *after* the month's total (specs.md item 20), so
 * this line is placed by the default rather than by an explicit choice — which
 * is the case a user actually produces. */
const oneOffDeduction: UserLine = {
  id: "breakage",
  label: "השתתפות בנזק",
  direction: "deduction",
  agorot: 15000,
};

function sumOf(result: MonthResult, block: ClosingBlock): number {
  return result.closing
    .filter((row) => row.block === block)
    .reduce((total, row) => total + (row.amount ?? 0), 0);
}

describe("the income tax is withheld from the ברוטו (specs.md item 17)", () => {
  const w = plainWorker();
  const result = calculateMonth(facts(w, { incomeTaxAgorot: 20000 }), w);

  it("leaves the ברוטו alone and lowers the נטו by the tax", () => {
    expect(result.gross).toBe(PLAIN_GROSS);
    expect(result.afterWithholding).toBe(867940); // 887,940 − 20,000
  });

  it("carries the tax to the transfer, there being nothing else below it", () => {
    expect(result.net).toBe(867940);
  });

  it("marks the tax row as withheld rather than transferred", () => {
    const tax = result.closing.find((row) => row.key === lineKeys.incomeTax);
    expect(tax?.block).toBe("withholding");
  });

  /**
   * **A confirmed tax is not a manual amount** (specs.md item 17). The badge
   * means an amount the user put *over* a figure the application worked out,
   * and a figure settled in the pre-export conversation and stored with the
   * month is not one of those — it is how the month is settled, exactly as the
   * confirmed minimum wage is not a manual line. Only an override on this row
   * raises the badge, which the calculated cases below assert.
   */
  it("does not mark a confirmed tax as manual", () => {
    const tax = result.closing.find((row) => row.key === lineKeys.incomeTax);
    expect(tax?.amount).toBe(-20000);
    expect(tax?.manual).toBe(false);
  });
});

/**
 * The tax the engine works out for itself (specs.md item 17, approved
 * 2026-09-10).
 *
 * **The figures are derived on paper from the 2025 table**, which is the year
 * the plain August fixture falls in. Its ‏ברוטו‎ is ₪8,879.40, so a year of it is
 * ₪106,552.80 — 10,655,280 agorot:
 *
 *    8,412,000 × 10%           =   841,200
 *    2,243,280 × 14%           =   314,059.20
 *                                -----------
 *                                1,155,259.20 a year, = 96,271.60 a month
 *
 * A woman's 2.75 credit points are worth ₪665.50 a month, so she is taxed
 * 96,271.60 − 66,550 = 29,721.60, which rounds to **29,722 agorot (₪297.22)**.
 * A man's 2.25 points are worth ₪544.50, so he is taxed 96,271.60 − 54,450 =
 * 41,821.60, which rounds to **41,822 agorot (₪418.22)**.
 */
describe("the tax the engine works out (specs.md item 17)", () => {
  /** The fixture carries a confirmed zero, because the family's own August
   * sheet withheld nothing. Clearing it is what asks the engine. */
  const unconfirmed = { incomeTaxAgorot: undefined };

  it("withholds ₪297.22 from a woman and lowers the נטו by it", () => {
    const w = plainWorker();
    const result = calculateMonth(facts(w, unconfirmed), w);
    const tax = result.closing.find((row) => row.key === lineKeys.incomeTax);

    expect(tax?.amount).toBe(-29722);
    expect(result.gross).toBe(PLAIN_GROSS);
    expect(result.afterWithholding).toBe(PLAIN_GROSS - 29722);
    expect(result.net).toBe(PLAIN_GROSS - 29722);
  });

  /**
   * The same month for a man. It is what proves the gender on the profile
   * actually reaches the sheet: a calculation that hardcoded a woman's points
   * would answer ₪297.22 here too, and nothing on the sheet would say so.
   */
  it("withholds ₪418.22 from a man in the same month", () => {
    const w = { ...plainWorker(), gender: "male" as const };
    const result = calculateMonth(facts(w, unconfirmed), w);
    const tax = result.closing.find((row) => row.key === lineKeys.incomeTax);

    expect(tax?.amount).toBe(-41822);
  });

  /**
   * **A confirmed figure is reproduced and never recalculated** (Part 3). It is
   * the whole reason the month stores one: the family's August withheld
   * nothing, and re-exporting it must keep withholding nothing however the
   * brackets have moved since.
   */
  it("keeps a confirmed figure in place of the calculated one", () => {
    const w = plainWorker();
    const result = calculateMonth(facts(w, { incomeTaxAgorot: 0 }), w);
    const tax = result.closing.find((row) => row.key === lineKeys.incomeTax);

    expect(tax?.amount).toBe(0);
    expect(tax?.manual).toBe(false);
  });

  /** An amount typed over the calculated one wins over both, and is the only
   * one of the three that raises the badge (item 17). */
  it("lets an override replace the calculated figure and marks it manual", () => {
    const w = plainWorker();
    const result = calculateMonth(
      facts(w, {
        ...unconfirmed,
        overrides: { [lineKeys.incomeTax]: { agorot: 50000 } },
      }),
      w,
    );
    const tax = result.closing.find((row) => row.key === lineKeys.incomeTax);

    expect(tax?.amount).toBe(-50000);
    expect(tax?.manual).toBe(true);
  });

  /**
   * A year the application holds no bracket table for. The line stays at zero
   * and the month **says so**, rather than withholding a figure nobody can
   * cite: brackets are restated every January, so reaching for the nearest
   * year is precisely the wrong guess.
   */
  it("leaves the line at zero and warns where the year has no table", () => {
    const w = plainWorker();
    const result = calculateMonth(facts(w, unconfirmed), w, {
      taxBrackets: [],
    });
    const tax = result.closing.find((row) => row.key === lineKeys.incomeTax);

    expect(tax?.amount).toBe(0);
    expect(
      result.warnings.some((warning) => warning.key === "taxBracketsMissing"),
    ).toBe(true);
  });

  /** A calculated zero is an answer and raises nothing — which at the minimum
   * wage is the ordinary month rather than an edge case. */
  it("raises no warning for a month whose credit simply exceeds its tax", () => {
    const w = plainWorker();
    const result = calculateMonth(facts(w, unconfirmed), w);

    expect(
      result.warnings.some((warning) => warning.key === "taxBracketsMissing"),
    ).toBe(false);
  });
});

describe("an advance instalment sits below the נטו (specs.md item 17)", () => {
  const w = plainWorker();
  const result = calculateMonth(
    facts(w, { incomeTaxAgorot: 20000, advances: [instalment] }),
    w,
  );

  it("does not reach the נטו, which the tax alone decides", () => {
    expect(result.afterWithholding).toBe(867940); // 887,940 − 20,000
  });

  it("comes off the transfer", () => {
    expect(result.net).toBe(667940); // 867,940 − 200,000
  });

  it("is a transfer row", () => {
    const row = result.closing.find((r) => r.key === "advance.1.repaid");
    expect(row?.block).toBe("transfer");
  });
});

describe("a line placed after the total is not a withholding (specs.md item 20)", () => {
  const w = plainWorker();
  const result = calculateMonth(facts(w, { userLines: [oneOffDeduction] }), w);

  // The whole of the second question settled on 2026-09-03: item 20 says such
  // a line "changes only what is transferred at the end" and reaches neither
  // the month's cost nor item 19's estimate, which is what an advance does and
  // not what the income tax does.
  it("leaves the נטו where the ברוטו left it", () => {
    expect(result.gross).toBe(PLAIN_GROSS);
    expect(result.afterWithholding).toBe(PLAIN_GROSS);
  });

  it("comes off the transfer alone", () => {
    expect(result.net).toBe(872940); // 887,940 − 15,000
  });

  it("is a transfer row and not a withholding one", () => {
    const row = result.closing.find((r) => r.key === "extra.breakage");
    expect(row?.block).toBe("transfer");
  });
});

describe("with no income tax the נטו is the ברוטו (specs.md item 17)", () => {
  // Which is every month the family has ever had, August 2025 among them —
  // and the case the month screen draws as one row rather than two identical
  // ones.
  const w = plainWorker();
  const result = calculateMonth(facts(w, { advances: [instalment] }), w);

  it("withholds nothing", () => {
    expect(sumOf(result, "withholding")).toBe(0);
    expect(result.afterWithholding).toBe(PLAIN_GROSS);
  });

  it("still transfers the instalment", () => {
    expect(result.net).toBe(687940); // 887,940 − 200,000
  });
});

describe("the split loses no row (specs.md Part 5)", () => {
  // The invariant that makes the grouping exhaustive rather than trusting
  // whoever adds the next closing row to tag it: `net` is built as the ברוטו
  // plus one half plus the other, so a row tagged with anything else would
  // simply vanish from it. This is the assertion that would notice.
  const w = plainWorker();
  const result = calculateMonth(
    facts(w, {
      incomeTaxAgorot: 20000,
      advances: [instalment, { number: 2, kind: "granted", agorot: 50000 }],
      userLines: [oneOffDeduction],
    }),
    w,
  );

  it("sums to the same figure whether the rows are split or not", () => {
    const everyRow = result.closing.reduce(
      (total, row) => total + (row.amount ?? 0),
      0,
    );
    expect(result.net).toBe((result.gross ?? 0) + everyRow);
    expect(result.afterWithholding).toBe(
      (result.gross ?? 0) + sumOf(result, "withholding"),
    );
    expect(result.net).toBe(
      (result.afterWithholding ?? 0) + sumOf(result, "transfer"),
    );
  });

  it("comes to ₪7,029.40 by hand", () => {
    // 887,940 − 20,000 (tax) − 200,000 (instalment) + 50,000 (advance given)
    //   − 15,000 (the line placed after the total) = 702,940
    expect(result.afterWithholding).toBe(867940);
    expect(result.net).toBe(702940);
  });
});

/**
 * Which row of the block may be replaced by hand, and which is corrected where
 * it was entered (specs.md item 17).
 *
 * **The division is about who produced the amount and not about which row it
 * is.** The tax, an advance movement and a one-off line are all figures the
 * user typed into this month, so there is nothing under them to replace; a
 * *standing* line reached this month from the profile, so a month that paid
 * something else has no entry here to correct and says so with an override.
 *
 * It is checked here because a standing deduction lands on this side of the
 * total by default (item 20, `defaultPlacementFor`), which makes it the
 * ordinary case rather than a corner of one — and because the flag had one
 * reachable value until the profile screen could set a standing line.
 */
describe("only a standing line may be overridden in the block (item 17)", () => {
  const standing: UserLine = {
    id: "pocket",
    label: "דמי כיס",
    direction: "deduction",
    agorot: 20000,
  };

  it("offers the standing line and refuses every other row", () => {
    const worker: WorkerTerms = plainWorker([standing]);
    const result = calculateMonth(
      facts(worker, {
        incomeTaxAgorot: 20000,
        advances: [instalment],
        userLines: [oneOffDeduction],
      }),
      worker,
    );

    const overridable = result.closing
      .filter((row) => row.overridable)
      .map((row) => row.key);
    expect(overridable).toEqual([`standing.${standing.id}`]);

    // Named the other way round as well, so a change that made everything
    // overridable would fail here rather than merely widening the list above.
    const byKey = (key: string) =>
      result.closing.find((row) => row.key === key)?.overridable;
    expect(byKey(lineKeys.incomeTax)).toBe(false);
    expect(byKey(`extra.${oneOffDeduction.id}`)).toBe(false);
    expect(byKey("advance.1.repaid")).toBe(false);
  });

  it("says what the row would have been, beside what it says", () => {
    const worker: WorkerTerms = plainWorker([standing]);
    const key = `standing.${standing.id}`;
    const result = calculateMonth(
      facts(worker, { overrides: { [key]: { agorot: 5000 } } }),
      worker,
    );

    const row = result.closing.find((each) => each.key === key);
    // ₪200 was the standing amount and ₪50 is what this month paid instead;
    // both are deductions, so both are drawn negative — an override is a
    // magnitude and the row gives it its sign (item 17).
    expect(row?.manual).toBe(true);
    expect(row?.amount).toBe(-5000);
    expect(row?.calculatedAmount).toBe(-20000);
  });
});
