import ExcelJS from "exceljs";
import { prepareForExcel } from "@/lib/export/workbook";
import type { MonthInSeries } from "@/lib/engine/series";
import type { BalanceKind, BalanceLine } from "@/lib/types";

/**
 * The year's balances on their own — specs.md item 23.
 *
 * "A row per month with the accrual, what was used, and the closing balance,
 * kept separate for vacation and for sick days — so whoever turns the sheet
 * into a payslip can check the figures. It is a separate file, produced on
 * request, and leaves the monthly export untouched."
 *
 * **The template's bytes are injected and nothing here reads a file**, the same
 * idiom `monthSheet.ts` uses and for the same reason: the suite fills the real
 * `template_balances_yearly.xlsx` and never depends on where it sits.
 *
 * **Nothing is stored and nothing is summed twice.** Every figure comes off the
 * replay's own `BalanceLine`, which the engine already derived by walking the
 * worker's months from the opening position (item 13). A file that added its
 * own arithmetic over the top would be a second calculation path, and it would
 * disagree with the screen the day either was corrected.
 */

/** The two blocks the template draws, read out of
 * `data/templates/template_balances_yearly.xlsx` -> `יתרות` cell by cell on
 * 2026-09-10. Each has a heading, a header row, and twelve rows beneath it —
 * one per month of the year, which is what the sheet is for. */
const BLOCKS: ReadonlyArray<{ kind: BalanceKind; firstRow: number }> = [
  // `B1`: "חופשת מחלה- צבירה וניצול", header at row 3.
  { kind: "sick", firstRow: 4 },
  // `B18`: "חופשה שנתית - צבירה וניצול", header at row 20.
  { kind: "vacation", firstRow: 21 },
];

/** Twelve, and the template designs exactly twelve rows under each header. A
 * year that somehow held more would run into the block below it, so it is
 * clipped rather than allowed to overwrite the vacation heading. */
const ROWS_PER_BLOCK = 12;

export interface BalancesSheetInput {
  year: number;
  /**
   * That year's months, in date order, taken off the replay.
   *
   * **Only the months the worker actually has**, not a fixed twelve. A month
   * with no record accrued nothing and used nothing, and a row of zeroes
   * against its name would say the opposite — that the month was recorded and
   * was empty. The blank row is the honest one, and it is the same choice the
   * month tab makes for a line the month does not draw.
   */
  months: MonthInSeries[];
  /** How each month is named in column A — "אוגוסט", loose text, as every date
   * on these sheets is (Part 5). Formatted by the caller, for the reason
   * `monthSheet.ts` gives: the wording belongs to `dateLabels.ts`. */
  monthLabels: string[];
}

function balanceOf(
  month: MonthInSeries,
  kind: BalanceKind,
): BalanceLine | undefined {
  return month.result.balances.find((line) => line.kind === kind);
}

/**
 * Days reach the sheet at full precision and are never pre-rounded.
 *
 * Part 5: the family's own workbook writes the monthly vacation accrual as 1.17
 * in some months and as fourteen twelfths in others, and rounding here is what
 * makes a balance drift a hundredth of a day a year. The cell's own format is
 * what the reader sees; the value under it stays exact.
 */
function days(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value;
}

export async function fillBalancesSheet(
  template: ArrayBuffer,
  input: BalancesSheetInput,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template);
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error("The balances template has no sheet");

  for (const { kind, firstRow } of BLOCKS) {
    // Column E is the year's running total of what was used, which is the one
    // figure on this sheet the engine does not carry: a `BalanceLine` knows its
    // own month. It is accumulated across the block rather than summed with a
    // formula, so a year that starts mid-way — a worker employed in June — adds
    // up from her first recorded month and not from an empty January.
    let usedThisYear = 0;

    input.months.slice(0, ROWS_PER_BLOCK).forEach((month, index) => {
      const line = balanceOf(month, kind);
      if (line === undefined) return;
      const row = firstRow + index;

      usedThisYear += line.used ?? 0;

      sheet.getCell(`A${row}`).value = input.monthLabels[index] ?? null;
      sheet.getCell(`B${row}`).value = days(line.opening);
      sheet.getCell(`C${row}`).value = days(line.accrued);
      sheet.getCell(`D${row}`).value = days(line.used);
      sheet.getCell(`E${row}`).value = usedThisYear;
      sheet.getCell(`F${row}`).value = days(line.closing);
    });
  }

  // Part 5: a sheet that opens left-to-right reads as a foreign document to the
  // family. Filling a template preserves it, and this asserts rather than sets
  // it so a template that lost the setting fails here instead of quietly
  // shipping.
  if (sheet.views[0]?.rightToLeft !== true) {
    throw new Error("The balances template is not right-to-left");
  }

  // See `workbook.ts`: without it Excel refuses the worksheet outright.
  prepareForExcel(workbook);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
