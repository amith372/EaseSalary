import { describe, expect, it } from "vitest";
import { calculateMonth } from "@/lib/engine/month";
import {
  WORKBOOK_MONTHS,
  workbookFacts,
  workbookWorker,
} from "@/lib/engine/workbook.fixture";
import type { MonthResult } from "@/lib/types";

/**
 * The four figures of criterion 1, checked against fifteen months instead of
 * one.
 *
 * Part 4 states August 2025 outright, and `august-2025.test.ts` holds it. What
 * this file adds is the rest of the family's own arithmetic: every month below
 * has its column E, its column F, its ברוטו and its transfer taken from the
 * tab's own cells, so a change that happened to keep August right and broke
 * everything else fails here.
 *
 * **What would pass August and fail this file.** A rest-day count fixed at four
 * (`חודש  5.26` has five); a rest-eve count read from the rest-day count (they
 * differ in nine of the fifteen); a holiday line emitted unconditionally
 * (`חודש  7.26` and `חודש  10.25` have none); an advance whose sign is taken
 * from its amount rather than its kind (three months grant one, and the
 * transfer then comes out below the ברוטו instead of above it); and a wage read
 * from the calendar year rather than from the month (`חודש  1.26` to
 * `חודש  3.26` are still at the 2025 wage).
 */

function columnTotal(result: MonthResult, column: string): number {
  return result.lines
    .filter((line) => line.column === column)
    .reduce((total, line) => total + (line.amount ?? 0), 0);
}

describe("the family's own months, to the agora", () => {
  for (const m of WORKBOOK_MONTHS) {
    describe(m.tab, () => {
      const result = calculateMonth(workbookFacts(m), workbookWorker(m.salaryAgorot));

      it("pays the tab's column E", () => {
        expect(columnTotal(result, "E")).toBe(m.subtotalE);
      });

      it("pays the tab's column F", () => {
        expect(columnTotal(result, "F")).toBe(m.subtotalF);
      });

      it("reaches the tab's ברוטו", () => {
        expect(result.gross).toBe(m.gross);
      });

      it("reaches the tab's transfer", () => {
        expect(result.net).toBe(m.net);
      });

      it("makes the ברוטו the sum of the columns that reach her", () => {
        // Part 5: the month's total is columns E, F and G alone. Column H is
        // money to somebody else and is outside it — reading H as salary would
        // overpay her.
        expect(result.gross).toBe(
          columnTotal(result, "E") +
            columnTotal(result, "F") +
            columnTotal(result, "G"),
        );
      });
    });
  }
});
