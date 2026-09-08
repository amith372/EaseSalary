import { describe, expect, it } from "vitest";
import { calculateMonth } from "@/lib/engine/month";
import {
  WORKBOOK_MONTHS,
  workbookFacts,
  workbookWorker,
} from "@/lib/engine/workbook.fixture";

/**
 * The closing block, against the four months of the workbooks that move an
 * advance in an unusual direction.
 *
 * `specs.md` Part 5: the bottom of the month sheet is not a fixed layout. A
 * month in which an advance is given carries a row that adds it, a month in
 * which one is repaid carries a row that subtracts it, and a month may carry
 * several of both at once. The 2025 and 2026 workbooks contain every one of
 * those shapes, which is what makes them worth testing against rather than
 * inventing cases for.
 */

const byTab = (tab: string) => {
  const m = WORKBOOK_MONTHS.find((candidate) => candidate.tab === tab);
  if (!m) throw new Error(`no fixture for ${tab}`);
  return m;
};

const resultOf = (tab: string) => {
  const m = byTab(tab);
  return calculateMonth(workbookFacts(m), workbookWorker(m.salaryAgorot));
};

describe("an advance granted raises the transfer above the ברוטו", () => {
  it("`חודש  11.25`: ₪4,000 given, ₪8,779.40 becomes ₪12,779.40", () => {
    // `E27` = ₪4,000 above `E26` = ₪8,779.40, giving `E29` = ₪12,779.40. The
    // sign comes from the kind and never from the amount: a granted advance
    // entered as a positive number and subtracted anyway would give ₪4,779.40,
    // which is an entirely plausible-looking figure.
    const result = resultOf("חודש  11.25");
    expect(result.gross).toBe(877940);
    expect(result.net).toBe(1277940);
    expect(result.net! - result.gross!).toBe(400000);
  });

  it("`חודש  7.26`: ₪10,000 given, and it does not touch the ברוטו", () => {
    // Item 19: the advances are missing from the national-insurance base
    // because they are the same money moved in time. An advance that reached
    // the ברוטו would enlarge that base by ₪10,000.
    const m = byTab("חודש  7.26");
    const result = resultOf("חודש  7.26");
    expect(result.gross).toBe(826307);
    expect(result.net).toBe(1826307);
    // The ברוטו is columns E, F and G alone, and the advance is in none of them.
    expect(result.gross).toBe(m.subtotalE + m.subtotalF);
  });
});

describe("an advance repaid lowers the transfer below the ברוטו", () => {
  it("`חודש  12.25`: ₪1,000 taken off ₪9,205.75", () => {
    const result = resultOf("חודש  12.25");
    expect(result.gross).toBe(920575);
    expect(result.net).toBe(820575);
  });

  it("takes the instalment off the transfer and never off the ברוטו", () => {
    // Across every repaying month in the fixture: the ברוטו is what she earned
    // and the transfer is what she was handed (Part 5). A repayment reaching
    // the ברוটו would shrink the national-insurance base with it.
    const repaying = WORKBOOK_MONTHS.filter((m) =>
      m.advances.every((a) => a.kind === "repaid"),
    );
    expect(repaying.length).toBeGreaterThan(8);
    for (const m of repaying) {
      const result = calculateMonth(
        workbookFacts(m),
        workbookWorker(m.salaryAgorot),
      );
      const repaid = m.advances.reduce((total, a) => total + a.agorot, 0);
      expect(result.gross).toBe(m.subtotalE + m.subtotalF);
      expect(result.gross! - result.net!).toBe(repaid);
    }
  });
});

describe("a month may both grant one advance and repay another (item 20)", () => {
  const result = resultOf("חודש  2.26");

  it("`חודש  2.26`: ₪5,000 granted and ₪1,000 repaid over one ברוטו", () => {
    // `E27` adds ₪5,000 for advance 2 and `E30` takes ₪1,000 off for advance 1,
    // so ₪8,779.40 becomes ₪12,779.40.
    expect(result.gross).toBe(877940);
    expect(result.net).toBe(1277940);
    expect(result.net! - result.gross!).toBe(400000);
  });

  it("keeps them as two movements and never nets them into one", () => {
    // A single ₪4,000 movement reaches the same transfer and loses which
    // advance owes what — and with it the numbering the closing block's rows are
    // addressed by, which belongs to the worker for the life of the employment
    // (item 20). The two rows differ by their advance number, so a netted
    // version cannot say which of the two it belongs to.
    const m = byTab("חודש  2.26");
    expect(m.advances).toHaveLength(2);
    expect(m.advances.map((a) => a.number).sort()).toEqual([3, 4]);
    expect(m.advances.map((a) => a.kind).sort()).toEqual(["granted", "repaid"]);

    const movements = result.closing.filter((row) =>
      row.key.startsWith("advance"),
    );
    expect(movements).toHaveLength(2);
  });
});

describe("two repayments of two different advances in one month", () => {
  it("`חודש  3.26` closes advance 1 and opens advance 2's repayment", () => {
    // The tab carries both: `C29`/`D29` "קיזוז מקדמה 1 — קיזוז 4/4 - סיום קיזוז"
    // at ₪1,000, and `C30`/`D30` "קיזוז מקדמה 2 — קיזוז 1/4" at another ₪1,000.
    // `E26` = ₪10,861.05 becomes `E31` = ₪8,861.05.
    //
    // The month is not in the money fixture because its ברוטו includes a ₪2,508
    // recuperation payment the engine does not yet emit. What is checked here is
    // the block alone: two repayments of ₪1,000 take ₪2,000 off, and item 20's
    // "one movement of a kind per advance per month" is satisfied because they
    // are two different advances.
    const m = {
      ...byTab("חודש  2.26"),
      tab: "חודש  3.26",
      month: { year: 2026, month: 3 } as const,
      freeRestDays: [],
      holidaysWorked: [],
      advances: [
        { number: 3, kind: "repaid" as const, agorot: 100000 },
        { number: 4, kind: "repaid" as const, agorot: 100000 },
      ],
    };
    const result = calculateMonth(
      workbookFacts(m),
      workbookWorker(m.salaryAgorot),
    );
    expect(result.gross! - result.net!).toBe(200000);
    expect(
      result.closing.filter((row) => row.key.startsWith("advance")),
    ).toHaveLength(2);
  });
});
