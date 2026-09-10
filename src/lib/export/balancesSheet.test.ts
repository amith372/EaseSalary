import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { calculateSeries } from "@/lib/engine/series";
import { plainAugustFacts, plainWorker } from "@/lib/engine/august-2025.fixture";
import type { ClosedSpan, MonthFacts } from "@/lib/engine/types";
import { balancesSheetInputOf } from "@/lib/export/balancesExport";
import { fillBalancesSheet } from "@/lib/export/balancesSheet";
import { BALANCES_TEMPLATE, readTemplate } from "@/lib/export/template";

/**
 * The year's balances file — specs.md item 23.
 *
 * **Every figure below is derived on paper from items 7 and 8 and never read
 * back from the engine.** Hanna was employed on 1.4.2024, so the whole of the
 * summer of 2025 sits in her second employment year, whose vacation quota is
 * fourteen days: the monthly accrual is therefore fourteen twelfths, and it is
 * carried as the fraction and never as 1.17 (Part 5 — the workbook's own
 * rounding here is what makes a balance drift a hundredth of a day a year).
 * Sick days accrue at 1.5 a month (item 8). She opens with nothing of either.
 *
 *          vacation                         sick
 *   Jun    0 + 14/12 − 0 = 14/12            0   + 1.5 − 0 = 1.5
 *   Jul    14/12 + 14/12 − 0 = 28/12        1.5 + 1.5 − 0 = 3.0
 *   Aug    28/12 + 14/12 − 1 = 2.5          3.0 + 1.5 − 2 = 2.5
 *
 * August's 2.5 is the same figure twice by coincidence and not by construction:
 * 42/12 is 3.5, less the one vacation day; and 4.5 less the two sick days.
 */

/** August's marks. Weekdays chosen on purpose: a spell that reached a Saturday
 * would keep its rest day inside it (item 8, criterion 8), which is a rule
 * about the engine and not about this file. 4 and 5 August 2025 are a Monday
 * and a Tuesday; 11 August is a Monday. */
const AUGUST_MARKS: ClosedSpan[] = [
  { id: "sick-1", kind: "sick", from: "2025-08-04", to: "2025-08-05" },
  { id: "vac-1", kind: "vacation", from: "2025-08-11", to: "2025-08-11" },
];

const worker = plainWorker();

function monthOf(month: number, spans: ClosedSpan[] = []): MonthFacts {
  return { ...plainAugustFacts(worker), month: { year: 2025, month }, spans };
}

let template: ArrayBuffer;

beforeAll(async () => {
  template = await readTemplate(BALANCES_TEMPLATE);
});

async function sheetOf(): Promise<ExcelJS.Worksheet> {
  const series = calculateSeries(
    [monthOf(6), monthOf(7), monthOf(8, AUGUST_MARKS)],
    worker,
  );
  const bytes = await fillBalancesSheet(
    template,
    balancesSheetInputOf({
      worker: { id: "w", name: "חנה" },
      series,
      year: 2025,
    }),
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  );
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error("no sheet");
  return sheet;
}

/** `B` opening, `C` accrued, `D` used, `E` used so far this year, `F` closing —
 * the template's own six columns, `A` being the month. */
function row(sheet: ExcelJS.Worksheet, ref: number): (number | null)[] {
  return ["B", "C", "D", "E", "F"].map((column) => {
    const value = sheet.getCell(`${column}${ref}`).value;
    return typeof value === "number" ? value : null;
  });
}

function expectRow(
  actual: (number | null)[],
  expected: number[],
  label: string,
) {
  expected.forEach((figure, index) => {
    expect(actual[index], `${label} column ${index}`).toBeCloseTo(figure, 10);
  });
}

describe("the year's balances on their own (item 23)", () => {
  it("keeps vacation and sickness in the template's two separate blocks", async () => {
    const sheet = await sheetOf();
    // The sick block's twelve rows start at 4, the vacation block's at 21 —
    // read out of the template on 2026-09-10. Getting these the wrong way round
    // is the defect this test exists for: both blocks carry six numeric columns
    // and a sheet with them swapped looks entirely ordinary.
    expectRow(row(sheet, 4), [0, 1.5, 0, 0, 1.5], "sick June");
    expectRow(row(sheet, 21), [0, 14 / 12, 0, 0, 14 / 12], "vacation June");
  });

  it("carries each month's opening balance from the month before it", async () => {
    const sheet = await sheetOf();
    expectRow(row(sheet, 5), [1.5, 1.5, 0, 0, 3], "sick July");
    expectRow(row(sheet, 22), [14 / 12, 14 / 12, 0, 0, 28 / 12], "vacation July");
  });

  it("subtracts what August used and leaves 2.5 of each", async () => {
    const sheet = await sheetOf();
    expectRow(row(sheet, 6), [3, 1.5, 2, 2, 2.5], "sick August");
    expectRow(row(sheet, 23), [28 / 12, 14 / 12, 1, 1, 2.5], "vacation August");
  });

  it("accumulates column E over the year rather than repeating the month", async () => {
    // The one column the engine does not carry: a `BalanceLine` knows its own
    // month, and `סהכ ניצול השנה` is the year's running total. Filling it from
    // `used` instead would print 2 against August and 0 against July, which
    // reads as a correct sheet until somebody adds the column up.
    const sheet = await sheetOf();
    expect(sheet.getCell("E4").value).toBe(0);
    expect(sheet.getCell("E5").value).toBe(0);
    expect(sheet.getCell("E6").value).toBe(2);
  });

  it("names each month in column A and leaves unrecorded months blank", async () => {
    const sheet = await sheetOf();
    expect(sheet.getCell("A4").text).toBe("יוני 2025");
    expect(sheet.getCell("A6").text).toBe("אוגוסט 2025");
    // Only three months are recorded, so the fourth row of each block stays
    // empty. A row of zeroes there would say the month was recorded and was
    // empty, which is the opposite of what is true.
    expect(sheet.getCell("A7").value).toBe(null);
    expect(sheet.getCell("F7").value).toBe(null);
    expect(sheet.getCell("A24").value).toBe(null);
  });

  it("keeps the template's own headings and its right-to-left reading", async () => {
    const sheet = await sheetOf();
    // Item 23 asks for a table whoever turns the sheet into a payslip can
    // check, which means the template's words survive the fill.
    expect(sheet.getCell("B1").text).toBe("חופשת מחלה- צבירה וניצול");
    expect(sheet.getCell("B18").text).toBe("חופשה שנתית - צבירה וניצול");
    expect(sheet.getCell("E3").text).toBe("סהכ ניצול ימי מחלה השנה");
    expect(sheet.getCell("E20").text).toBe("סהכ ניצול ימי חופשה השנה");
    expect(sheet.views[0]?.rightToLeft).toBe(true);
  });
});
