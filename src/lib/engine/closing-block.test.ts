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
