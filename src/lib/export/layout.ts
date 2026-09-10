import { lineKeys } from "@/lib/engine/month";
import { thirdPartyLineKey } from "@/lib/engine/thirdParty";

/**
 * Where each of the engine's lines lands on the month tab, and where the rows
 * the template does not hold in advance go.
 *
 * **The filler owns this map and there is no sheet model between it and the
 * template** (`build_plan.md` stage 2): a third representation would be a third
 * thing to keep in step, and the property that matters — the preview and the
 * file saying the same thing — is carried by their sharing one engine result
 * rather than by a shape they both convert into.
 *
 * Read out of `data/templates/template_month_standard.xlsx` -> `תבנית` cell by
 * cell on 2026-09-10. Every row number here is that template's, and the whole
 * point of naming them in one file is that a template whose rows move is a
 * change to this file and to nothing else.
 */

/** The first and last of the template's seventeen numbered rows. */
export const FIRST_LINE_ROW = 6;
export const LAST_LINE_ROW = 22;

/**
 * The vacation row — **units only, and its money cells left empty** (specs.md
 * item 7, and `build_plan.md`'s reading of the family's own file).
 *
 * The same workbook fills this row three different ways and two of them reduce
 * the base and pay the day back; this application never reduces the base, so
 * only the first style is consistent with it and the other two taken without
 * their reduction are item 7's double payment. `D17` and `G17` are therefore
 * written by nothing at all.
 */
export const VACATION_UNITS_ROW = 17;

/**
 * The numbered rows the template designs, by the engine's own line key.
 *
 * Rows 11 (severance and pension) and 22 (hospital overtime) and 15
 * (`ויזת עובד זר`, until a month can record one) are absent on purpose: the row
 * exists in the sheet and nothing writes it, which is what item 2's "same rows"
 * asks for. Row 20 is the income tax and is reached through `TAX_ROW` below,
 * because it is a row of the *closing* block on the engine's side and a
 * numbered row on the sheet's.
 */
export const TEMPLATE_ROWS: Readonly<Record<string, number>> = {
  [lineKeys.base]: 6,
  [lineKeys.restEveSupplement]: 7,
  [lineKeys.holidaysWorked]: 8,
  [lineKeys.restDays]: 9,
  [thirdPartyLineKey("medicalInsurance")]: 10,
  [thirdPartyLineKey("placementFee")]: 12,
  [thirdPartyLineKey("agencyFee")]: 13,
  [thirdPartyLineKey("visaExtensionFee")]: 14,
  [thirdPartyLineKey("workerVisa")]: 15,
  [thirdPartyLineKey("licenceFee")]: 16,
  [lineKeys.recuperation]: 18,
  [lineKeys.sickDeduction]: 19,
  [thirdPartyLineKey("nationalInsurance")]: 21,
};

/**
 * The income tax's own row — settled with the user on 2026-09-10.
 *
 * Part 5 says the tax "sits in the closing block and not in column E", which is
 * a statement about `MonthResult.closing` and not about a cell: on the sheet the
 * figure goes in the row the family's workbook already labels `מס הכנסה`, which
 * their own sheets show present and empty because they chose not to withhold.
 * **What keeps it out of the ברוטו is the range and not the column** — `א`
 * stops one row short of it, which is why `subtotalE` below is two ranges and
 * not one.
 */
export const TAX_ROW = 20;

/** The template's own rows below the numbered block, before anything is
 * inserted. `BLOCK_ROW` is the `ה` row — the one row the template designs for
 * the block, and the row a repaid advance is written on. */
const SUBTOTAL_E_ROW = 23;
const SPACER_ROW = 27;
export const BLOCK_ROW = 28;

/** The first of the six reporting rows, beside the labels the template puts in
 * B33–B38 (specs.md item 2: both day counts, the days used and the balances
 * left, for vacation and for sickness). */
const REPORT_ROW = 33;

/**
 * The rows of one filled sheet, after the month's own rows have been counted.
 *
 * **Every range below is derived from these numbers and never written as a
 * constant.** Part 3 requires the sheet's totals to stay live formulas whose
 * ranges expand over what was inserted, and the trap it names is that a range
 * one row short prints a total wrong by exactly one line and looks entirely
 * ordinary. Deriving the range and the row from one layout is what makes the
 * two impossible to disagree.
 */
export interface SheetLayout {
  /** How many rows were added to the numbered block for lines the user placed
   * before the month's total (specs.md item 20). */
  addedLines: number;
  /** How many rows the block below `ד` holds. Zero leaves the template's `ה`
   * row labelled and empty, exactly as rows 11 and 20 are left. */
  blockRows: number;
  /** The first row a line the user added is written on, and the numbers to put
   * in column A continuing the template's own 1–17. */
  firstAddedRow: number;
  subtotalERow: number;
  subtotalFRow: number;
  subtotalGRow: number;
  grossRow: number;
  taxRow: number;
  /** The first and last row of the block below `ד`. Equal when the block holds
   * one row, and both the `ה` row when it holds none. */
  blockFirstRow: number;
  blockLastRow: number;
  netRow: number;
  reportFirstRow: number;
  /** The last numbered row, after the added lines. */
  lastLineRow: number;
}

export function layoutOf(addedLines: number, blockRows: number): SheetLayout {
  // The lines the user added go at the foot of the numbered block, which is
  // where a row the template does not hold in advance belongs: they continue
  // the template's own numbering rather than interleaving with a catalogue of
  // rows the workbook fixed.
  const lastLineRow = LAST_LINE_ROW + addedLines;
  const subtotalERow = SUBTOTAL_E_ROW + addedLines;
  const blockFirstRow = BLOCK_ROW + addedLines;
  return {
    addedLines,
    blockRows,
    firstAddedRow: LAST_LINE_ROW + 1,
    subtotalERow,
    subtotalFRow: subtotalERow + 1,
    subtotalGRow: subtotalERow + 2,
    grossRow: subtotalERow + 3,
    taxRow: TAX_ROW,
    blockFirstRow,
    blockLastRow: blockFirstRow + Math.max(blockRows, 1) - 1,
    netRow: blockFirstRow + Math.max(blockRows, 1),
    reportFirstRow:
      REPORT_ROW + addedLines + Math.max(blockRows, 1) - 1,
    lastLineRow,
  };
}

/**
 * `א` — the monthly salary items, and **two ranges rather than one** because
 * the tax row sits inside the block they cover and is deliberately excluded
 * (see `TAX_ROW`). The second range starts after it and runs to the last
 * numbered row, so a line the user added at the foot is inside it.
 */
export function subtotalEFormula(layout: SheetLayout): string {
  return `SUM(E${FIRST_LINE_ROW}:E${TAX_ROW - 1})+SUM(E${TAX_ROW + 1}:E${layout.lastLineRow})`;
}

export function subtotalFormula(
  column: "F" | "G",
  layout: SheetLayout,
): string {
  return `SUM(${column}${FIRST_LINE_ROW}:${column}${layout.lastLineRow})`;
}

/** `ד=א+ב+ג`, as the label says, and never a second sum over the same cells:
 * the sheet's own arithmetic is what the family reads down the page. */
export function grossFormula(layout: SheetLayout): string {
  return `E${layout.subtotalERow}+F${layout.subtotalFRow}+G${layout.subtotalGRow}`;
}

/**
 * What is actually paid — `ד`, less the tax withheld from it, less what the
 * block below changes about the transfer (specs.md Part 5's three figures).
 *
 * The tax is added rather than subtracted because the engine already signs it:
 * a withheld amount is negative on the line, so the sheet adds what the row
 * says and can never disagree with the label beside it.
 */
export function netFormula(layout: SheetLayout): string {
  return `E${layout.grossRow}+E${layout.taxRow}+SUM(E${layout.blockFirstRow}:E${layout.blockLastRow})`;
}

/** The spacer between `ד` and the block, kept where the template put it. */
export function spacerRow(layout: SheetLayout): number {
  return SPACER_ROW + layout.addedLines;
}
