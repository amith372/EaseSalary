import ExcelJS from "exceljs";
import { daysInMonth } from "@/lib/dates";
import { isUserLineKey, lineKeys } from "@/lib/engine/month";
import {
  BLOCK_ROW,
  FIRST_LINE_ROW,
  LAST_LINE_ROW,
  TAX_ROW,
  TEMPLATE_ROWS,
  VACATION_UNITS_ROW,
  grossFormula,
  layoutOf,
  netFormula,
  subtotalEFormula,
  subtotalFormula,
  type SheetLayout,
} from "@/lib/export/layout";
import { VACATION_NOTES_KEY } from "@/lib/export/notes";
import type { MonthLine, MonthResult } from "@/lib/types";

/**
 * One month, as the family's own workbook writes it.
 *
 * **The template's bytes are injected and nothing here reads a file** — the
 * idiom the scrapers already use for HTML (specs.md Part 4), so the suite fills
 * a real template and never depends on where it sits. `src/lib/export/template.ts`
 * is the one place that reads it off disk.
 *
 * **The filler writes figures and never a label**, above the block. Rows 1–22
 * keep the template's own Hebrew, which is how item 2's "same Hebrew labels" is
 * satisfied without `he.ts` and the template ever having to agree about
 * anything. Only the rows the template cannot label in advance — a line the
 * user wrote in her own words, an advance the block grows for — carry a label
 * the engine gave them.
 *
 * **Nothing in the template is a default.** Its own two rates are from the year
 * they were typed and have both moved since (`build_plan.md`, finding 5), so a
 * filler that left one standing would ship a stale rate to every family. Every
 * money cell this file touches is written or is left empty.
 */

/** Money reaches the sheet in shekels, which is what the family reads. The
 * engine's agorot are already integers, so this is exact and never a rounding:
 * the one rounding in the calculation happened in `lines.ts`. */
function shekels(agorot: number | null | undefined): number | null {
  return agorot === null || agorot === undefined ? null : agorot / 100;
}

/** The identity block, and the two labels that name the worker inside a
 * sentence. Every one of these is a placeholder in the template, because no
 * worker's details may survive in it — including inside a sentence (Part 3). */
export interface MonthSheetIdentity {
  /** "אוגוסט 2025" — loose text, as the sheet writes every date (Part 5). */
  monthYear: string;
  workerName: string;
  /** How the sheet names the worker where a label needs a noun: "עובד/ת". */
  workerRole: string;
  /** When the employment began, as text. */
  employmentStart: string;
  /**
   * The employer of record, the passport line, the bank line and the account
   * number. **Each is empty until stage 3**, and empty is what is written: the
   * three identifying numbers are encrypted at rest with a key outside the
   * database and there is no database yet, and the employer of record is the
   * person being cared for and has no field. A cell left blank is one the
   * family fills, exactly as the template's own "בתאריך _________" is; a token
   * left standing would print `{{passport_line}}` onto her sheet.
   */
  employerLine?: string;
  passportLine?: string;
  bankLine?: string;
  accountNumber?: string;
}

export interface MonthSheetInput {
  /** One engine result serves the preview and the file, so this is the whole of
   * what the sheet's figures come from (Part 3). */
  result: MonthResult;
  identity: MonthSheetIdentity;
  /**
   * The weekly rest days she had off, already in words, for the template's own
   * `תאריך שבת חופשית`.
   *
   * Formatted by the caller and not here: the sheet writes every date as loose
   * text (Part 5) and the wording belongs to `dateLabels.ts`, so the filler
   * takes the sentence rather than learning to write one.
   */
  freeRestDays: string[];
  /**
   * The holiday days this month drew from the yearly entitlement — the
   * template's own `ניצול יום חג בחודש זה` (specs.md item 10).
   *
   * **It is not the holidays she worked**, which are a payment and not a
   * utilisation: a holiday she took off is the one drawn from the quota, and a
   * holiday she worked is a day of attendance. Computed by the caller through
   * `holidayDaysOf`, which is the same function `calculateSeries` counts the
   * year with, so the sheet and the replay can never disagree about it.
   */
  holidayDaysUsed: number;
  /** The user's notes on the month's actions, by the key of the line the action
   * produced (specs.md items 2, 5). Column I carries these and never the
   * application's own explanations — an explanation stays beside the figure it
   * explains (item 24). */
  notes: Readonly<Record<string, string>>;
  /**
   * Whether the workbook's helper column of notes is shown (item 2).
   *
   * **One file and one flag, never two files**, because the whole reason for one
   * is that the two versions' figures cannot drift apart. Hidden is not
   * removed: anyone who opens the plain version can unhide the column, which is
   * why item 2 says a note that must not travel is a note that is not written.
   */
  showNotes: boolean;
}

/** The helper column of notes — column I, which cell I1 itself instructs the
 * preparer to hide before printing. */
const NOTES_COLUMN = 9;

/** A line the user added, which is a row the template does not hold in advance
 * (specs.md item 20). */
function addedLinesOf(result: MonthResult): MonthLine[] {
  return result.lines.filter((line) => isUserLineKey(line.key));
}

/** The rows below `ד`: everything the block changes about the transfer. The
 * tax is not among them — it is withheld from the ברוטו and has its own row on
 * the sheet (`TAX_ROW`). */
function blockLinesOf(result: MonthResult) {
  return result.closing.filter((row) => row.block === "transfer");
}

/**
 * The row the `ה` sentence belongs to — the first repaid advance.
 *
 * Settled with the user on 2026-09-10 against the committed files: the template
 * designs exactly one row for this block and labels it `ה. הפחתה מקדמה`, and
 * `template_month_advance_given.xlsx` is the same layout with one extra row
 * carrying no letter, no label and no styling at all. So the template's row
 * keeps its sentence and holds the repaid advance, and every other row of the
 * block is an unlettered copy of it. A month with no repaid advance leaves the
 * row labelled and empty, which is what rows 11 and 20 already do.
 */
function letteredIndexOf(rows: ReturnType<typeof blockLinesOf>): number {
  // `advance.<number>.repaid`, which `advanceKey` builds and this reads rather
  // than testing the sign: a repaid advance is what the sentence describes, and
  // a granted one is negative in no month.
  return rows.findIndex((row) => row.key.endsWith(".repaid"));
}

export async function fillMonthSheet(
  template: ArrayBuffer,
  input: MonthSheetInput,
): Promise<Buffer> {
  const { result, identity } = input;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template);
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error("The month template has no sheet");

  const added = addedLinesOf(result);
  const block = blockLinesOf(result);
  const layout = layoutOf(added.length, block.length);

  // The one merge in the template is the `ד` label's, and `duplicateRow` does
  // not move a merge with the rows it shifts — checked against exceljs on
  // 2026-09-10. Unmerged before the sheet grows and merged again at the row the
  // label ended up on, or the label spans four cells of the wrong row and the
  // sheet reads as damaged.
  sheet.unMergeCells("A26:D26");

  // A row the code inserts is a copy of a row the template already designed
  // (Part 3): row 22 for the numbered block, the `ה` row for the block below.
  if (added.length > 0) {
    sheet.duplicateRow(LAST_LINE_ROW, added.length, true);
    clearRows(sheet, layout.firstAddedRow, added.length);
  }
  if (block.length > 1) {
    sheet.duplicateRow(BLOCK_ROW + added.length, block.length - 1, true);
    clearRows(sheet, layout.blockFirstRow + 1, block.length - 1);
  }

  sheet.mergeCells(layout.grossRow, 1, layout.grossRow, 4);

  writeHeader(sheet, input);
  writeLines(sheet, input, layout, added);
  writeBlock(sheet, input, layout, block);
  writeTotals(sheet, layout);
  writeReporting(sheet, result, layout);
  fillPlaceholders(sheet, identity);

  sheet.getColumn(NOTES_COLUMN).hidden = !input.showNotes;

  // `Buffer.from` rather than the ArrayBuffer exceljs returns, so the route
  // hands the browser bytes it can length-check.
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** A duplicated row carries the values it was copied from. The look is what was
 * wanted and the words were not, so every cell of it is emptied before anything
 * of this month is written into it. */
function clearRows(
  sheet: ExcelJS.Worksheet,
  first: number,
  count: number,
): void {
  for (let row = first; row < first + count; row += 1) {
    const line = sheet.getRow(row);
    for (let column = 1; column <= 10; column += 1) {
      line.getCell(column).value = null;
    }
  }
}

/**
 * Written where there is a figure, and left alone where there is none.
 *
 * **`null` is the only thing skipped and zero is written.** A balance of no days
 * left and a month of no vacation used are facts the payslip has to state, and
 * an empty cell where the figure is zero reads as a figure nobody worked out.
 * A row that should print nothing at all passes `null`, which is the caller
 * saying so rather than a rule guessing it from the value.
 */
function put(
  sheet: ExcelJS.Worksheet,
  address: string,
  value: number | string | null,
): void {
  if (value === null) return;
  sheet.getCell(address).value = value;
}

/**
 * The counts across the top of the sheet, each under the template's own
 * heading in row 1.
 *
 * **They are read off the engine's own lines and not counted again here.** The
 * rest days she worked are that line's units; a second count would be a second
 * calculation path, and Part 5's warning is that an off-by-one in counting a
 * month stays invisible until a month with an absence in it.
 */
function writeHeader(sheet: ExcelJS.Worksheet, input: MonthSheetInput): void {
  const { result } = input;
  const units = (key: string) =>
    result.lines.find((line) => line.key === key)?.units ?? null;

  put(sheet, "D2", daysInMonth(result.month));
  put(sheet, "E2", result.standardDays);
  put(sheet, "F2", units(lineKeys.restEveSupplement));
  put(sheet, "G2", units(lineKeys.restDays));
  // `ניצול יום חג בחודש זה` — what the yearly entitlement was drawn against,
  // which is the holidays she took off and not the ones she worked (item 10).
  put(sheet, "H2", input.holidayDaysUsed);
  put(sheet, "J2", usedOf(result, "sick"));

  // Loose text and never a date value, because that is how the sheet writes
  // every date and the family compares the page by eye (Part 5).
  put(sheet, "G3", input.freeRestDays.join(", ") || null);
}

function usedOf(result: MonthResult, kind: "vacation" | "sick"): number | null {
  return result.balances.find((line) => line.kind === kind)?.used ?? null;
}

function closingOf(
  result: MonthResult,
  kind: "vacation" | "sick",
): number | null {
  return result.balances.find((line) => line.kind === kind)?.closing ?? null;
}

function accruedOf(
  result: MonthResult,
  kind: "vacation" | "sick",
): number | null {
  return result.balances.find((line) => line.kind === kind)?.accrued ?? null;
}

/**
 * Each line into the row and the column the engine gave it.
 *
 * **A key the map does not know throws** rather than being skipped. A skipped
 * line is money missing from a sheet whose own totals still add up, which is
 * the one failure here that looks like nothing went wrong; the next row the
 * engine grows should stop the export until this file names its row.
 */
function writeLines(
  sheet: ExcelJS.Worksheet,
  input: MonthSheetInput,
  layout: SheetLayout,
  added: MonthLine[],
): void {
  const { result, notes } = input;

  for (const line of result.lines) {
    if (isUserLineKey(line.key)) continue;
    const row = TEMPLATE_ROWS[line.key];
    if (row === undefined) {
      throw new Error(
        `The month template has no row for the line "${line.key}"`,
      );
    }
    writeLineRow(sheet, row, line, notes[line.key]);
  }

  // The vacation row carries its units and no money at all (item 7). Written
  // here rather than as a line, because the engine has no vacation line and a
  // key for one would be the double payment item 7 exists to prevent.
  put(sheet, `C${VACATION_UNITS_ROW}`, usedOf(result, "vacation"));
  const vacationNote = notes[VACATION_NOTES_KEY];
  if (vacationNote !== undefined) {
    sheet.getCell(`I${VACATION_UNITS_ROW}`).value = vacationNote;
  }

  // The accruals, under the template's own `צבירת ימי חופשה / מחלה`.
  put(sheet, `J${VACATION_UNITS_ROW}`, accruedOf(result, "vacation"));
  put(sheet, `J${TEMPLATE_ROWS[lineKeys.sickDeduction]}`, accruedOf(result, "sick"));

  // The rows the template does not hold in advance, at the foot of the numbered
  // block and continuing its own 1–17 in column A.
  added.forEach((line, index) => {
    const row = layout.firstAddedRow + index;
    sheet.getCell(`A${row}`).value = LAST_LINE_ROW - FIRST_LINE_ROW + 2 + index;
    sheet.getCell(`B${row}`).value = line.label;
    writeLineRow(sheet, row, line, input.notes[line.key]);
  });
}

function writeLineRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  line: MonthLine,
  note: string | undefined,
): void {
  put(sheet, `C${row}`, line.units ?? null);
  put(sheet, `D${row}`, shekels(line.rate));
  put(sheet, `${line.column}${row}`, shekels(line.amount));
  if (note !== undefined) sheet.getCell(`I${row}`).value = note;
}

/**
 * The block below `ד`, one row per thing that changes the transfer, and the
 * income tax in the row the sheet keeps for it.
 */
function writeBlock(
  sheet: ExcelJS.Worksheet,
  input: MonthSheetInput,
  layout: SheetLayout,
  block: ReturnType<typeof blockLinesOf>,
): void {
  const tax = input.result.closing.find(
    (row) => row.key === lineKeys.incomeTax,
  );
  if (tax !== undefined) {
    // A month that withheld nothing leaves the row labelled and empty, which is
    // what the family's own sheets show: the line defaults to zero and is never
    // calculated, so a printed 0.00 would claim a figure somebody chose.
    put(sheet, `E${TAX_ROW}`, tax.amount === 0 ? null : shekels(tax.amount));
    const note = input.notes[tax.key];
    if (note !== undefined) sheet.getCell(`I${TAX_ROW}`).value = note;
  }

  const lettered = letteredIndexOf(block);
  block.forEach((row, index) => {
    const line = layout.blockFirstRow + index;
    // The lettered row keeps the sentence the template wrote for it; every
    // other row of the block carries the engine's own label, because the
    // template has none to give it.
    if (index !== lettered) sheet.getCell(`B${line}`).value = row.label;
    put(sheet, `E${line}`, shekels(row.amount));
    const note = input.notes[row.key];
    if (note !== undefined) sheet.getCell(`I${line}`).value = note;
  });
}

/**
 * The four total lines, as **live formulas over ranges** and never as figures
 * this application worked out (Part 3).
 *
 * A sheet whose numbers are right only because the engine wrote them becomes
 * wrong the moment somebody edits a cell, and the family's own workbook is a
 * live spreadsheet today — handing them a dead one would be a step back from
 * what they already have.
 */
function writeTotals(sheet: ExcelJS.Worksheet, layout: SheetLayout): void {
  sheet.getCell(`E${layout.subtotalERow}`).value = {
    formula: subtotalEFormula(layout),
  };
  sheet.getCell(`F${layout.subtotalFRow}`).value = {
    formula: subtotalFormula("F", layout),
  };
  sheet.getCell(`G${layout.subtotalGRow}`).value = {
    formula: subtotalFormula("G", layout),
  };
  sheet.getCell(`E${layout.grossRow}`).value = { formula: grossFormula(layout) };
  sheet.getCell(`E${layout.netRow}`).value = { formula: netFormula(layout) };
}

/**
 * The six reporting figures the Wage Protection Act wants on the payslip made
 * from this sheet: both day counts, the days used and the balances left, for
 * vacation and for sickness (specs.md item 2).
 *
 * **Column C is a choice and not a reading**: the template puts the labels in
 * B33–B38 with no formatted cell beside them, so `C` is picked as the only
 * neighbour and is written down here rather than left to be re-derived from an
 * empty cell.
 */
function writeReporting(
  sheet: ExcelJS.Worksheet,
  result: MonthResult,
  layout: SheetLayout,
): void {
  // In the order the template's own B33-B38 asks for them.
  const figures: (number | null)[] = [
    result.standardDays,
    result.actualDays,
    usedOf(result, "vacation"),
    closingOf(result, "vacation"),
    usedOf(result, "sick"),
    closingOf(result, "sick"),
  ];
  figures.forEach((figure, index) => {
    put(sheet, `C${layout.reportFirstRow + index}`, figure);
  });
}

/**
 * Every `{{token}}` in the sheet, replaced.
 *
 * Walked over every cell rather than addressed cell by cell, because a token
 * lives **inside a sentence** in four of them — `ביטוח רפואי ל{{worker_role}}`,
 * `שולם ל{{worker_name}} בהעברה בנקאית` — and Part 3's rule is that no worker's
 * details survive anywhere in a template, including inside a sentence. Run
 * after the rows have been inserted, so a token that moved is still found.
 */
function fillPlaceholders(
  sheet: ExcelJS.Worksheet,
  identity: MonthSheetIdentity,
): void {
  const values: Record<string, string> = {
    month_year: identity.monthYear,
    worker_name: identity.workerName,
    worker_role: identity.workerRole,
    employment_start: identity.employmentStart,
    employer_line: identity.employerLine ?? "",
    passport_line: identity.passportLine ?? "",
    bank_line: identity.bankLine ?? "",
    account_number: identity.accountNumber ?? "",
  };

  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (typeof cell.value !== "string") return;
      if (!cell.value.includes("{{")) return;
      cell.value = cell.value.replace(
        /\{\{(\w+)\}\}/g,
        (whole, token: string) => values[token] ?? whole,
      );
    });
  });
}
