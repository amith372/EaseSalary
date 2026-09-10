import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { calculateMonth } from "@/lib/engine/month";
import type {
  ClosedMonthFacts,
  ClosedSpan,
  MonthFacts,
  UserLine,
  WorkerTerms,
} from "@/lib/engine/types";
import {
  AUGUST_2025,
  SALARY,
  plainAugustFacts,
  plainWorker,
} from "@/lib/engine/august-2025.fixture";
import { fillMonthSheet } from "@/lib/export/monthSheet";
import type { MonthSheetInput } from "@/lib/export/monthSheet";
import { MONTH_TEMPLATE, readTemplate } from "@/lib/export/template";
import type { MonthResult } from "@/lib/types";

/**
 * The filled month tab, read back cell by cell.
 *
 * **Every expected figure below comes from Part 4, from the template, or from
 * arithmetic worked in the open here — never from what the filler produced.**
 * Part 4 gives August 2025 as ₪6,247.65 base, ₪500 across five rest-eves,
 * ₪426.35 a rest day, and totals of 6,747.65 / 2,558.10 / 9,305.75 / 7,305.75.
 * The cell each of those belongs in comes from the template, read cell by cell
 * on 2026-09-10 and recorded in `layout.ts`.
 *
 * **What these tests would catch.** A row map pointing one row off — the base
 * salary written into the rest-eve row — which produces a sheet whose four
 * totals are all still right, because the ranges cover both rows. A `SUM` range
 * that failed to grow over an inserted line, which prints a total wrong by
 * exactly one line and looks entirely ordinary. A total written as a figure
 * instead of a formula, which makes the sheet dead the moment the family edits
 * a cell. The `ד` label's merge left on the row it was on before the sheet grew.
 * And the two versions of the file drifting apart in a figure.
 */

const INSTALMENT = 200000;
const REST_DAY_RATE_SHEKELS = 426.35062;

/** Part 4's own case: employed since 1.4.2024, one free rest day on the 16th,
 * two worked holidays, a ₪10,000 advance repaid at ₪2,000 a month. */
function knownWorker(): WorkerTerms {
  return {
    ...plainWorker(),
    openingPosition: {
      vacationDays: 0,
      sickDays: 0,
      advances: [{ number: 1, principalAgorot: 1000000, repaidAgorot: 0 }],
    },
  };
}

const knownSpans: ClosedSpan[] = [
  { id: "free-16", kind: "freeRestDay", from: "2025-08-16", to: "2025-08-16" },
  { id: "hol-19", kind: "holiday", from: "2025-08-19", to: "2025-08-19", worked: true },
  { id: "hol-21", kind: "holiday", from: "2025-08-21", to: "2025-08-21", worked: true },
];

function knownFacts(worker: WorkerTerms): ClosedMonthFacts {
  return {
    ...plainAugustFacts(worker),
    spans: knownSpans,
    advances: [{ number: 1, kind: "repaid", agorot: INSTALMENT }],
  } as ClosedMonthFacts;
}

function inputFor(
  result: MonthResult,
  over: Partial<MonthSheetInput> = {},
): MonthSheetInput {
  return {
    result,
    identity: {
      monthYear: "אוגוסט 2025",
      workerName: "חנה",
      workerRole: "עובד/ת",
      employmentStart: "1 באפריל 2024",
    },
    // Part 4's two holidays, which is what the year's entitlement is drawn
    // against whether or not she worked them (item 10).
    holidayDaysUsed: 2,
    freeRestDays: ["16 באוגוסט"],
    notes: {},
    showNotes: false,
    ...over,
  };
}

let template: ArrayBuffer;

beforeAll(async () => {
  // Resolved from `process.cwd()`, which is what a fixture reading a saved file
  // in this repository does.
  template = await readTemplate(MONTH_TEMPLATE);
});

async function sheetOf(input: MonthSheetInput): Promise<ExcelJS.Worksheet> {
  const bytes = await fillMonthSheet(template, input);
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

function numberAt(sheet: ExcelJS.Worksheet, address: string): number | null {
  const value = sheet.getCell(address).value;
  return typeof value === "number" ? value : null;
}

function formulaAt(sheet: ExcelJS.Worksheet, address: string): string | null {
  const value = sheet.getCell(address).value;
  return value !== null &&
    typeof value === "object" &&
    "formula" in value &&
    typeof value.formula === "string"
    ? value.formula
    : null;
}

/**
 * The sheet's own formula, evaluated over the sheet's own cells.
 *
 * **This is the check Part 3 asks for, and it is the range that is being
 * checked and not the arithmetic.** `exceljs` writes a formula without
 * evaluating it, so a `result` read back out of a file this application wrote
 * would be a figure this application put there. Summing the cells the formula's
 * ranges actually name is what catches a range one row short — the whole
 * failure mode, since such a range still prints a plausible total.
 *
 * It understands only the two shapes `layout.ts` generates: `SUM(C1:C2)` terms
 * and bare cell references, added together. Anything else throws rather than
 * being silently read as zero.
 */
function evaluate(sheet: ExcelJS.Worksheet, formula: string): number {
  return formula.split("+").reduce((total, term) => {
    const range = /^SUM\(([A-Z])(\d+):([A-Z])(\d+)\)$/.exec(term);
    if (range !== null) {
      const [, column, first, , last] = range;
      let sum = 0;
      for (let row = Number(first); row <= Number(last); row += 1) {
        sum += valueOf(sheet, `${column}${row}`);
      }
      return total + sum;
    }
    if (/^[A-Z]\d+$/.exec(term) === null) {
      throw new Error(`Cannot evaluate the term "${term}"`);
    }
    return total + valueOf(sheet, term);
  }, 0);
}

/** One cell's value, which for `ד` and the נטו is another formula: those two
 * are sums of the sheet's own subtotal cells, exactly as the labels beside them
 * say, so evaluating them means evaluating what they point at. An empty cell is
 * zero, which is what the spreadsheet does with one. */
function valueOf(sheet: ExcelJS.Worksheet, address: string): number {
  const number = numberAt(sheet, address);
  if (number !== null) return number;
  const formula = formulaAt(sheet, address);
  return formula === null ? 0 : evaluate(sheet, formula);
}

describe("the August 2025 month tab, filled (specs.md Part 4, criterion 1)", () => {
  const worker = knownWorker();
  const result = calculateMonth(knownFacts(worker), worker);

  it("writes each of Part 4's figures into the row the template keeps for it", async () => {
    const sheet = await sheetOf(inputFor(result));
    // B6 `משכורת בסיסית`, B7 the rest-eve supplement, B8 the holidays, B9 the
    // rest days — the template's own numbered rows 1 to 4.
    expect(numberAt(sheet, "E6")).toBeCloseTo(6247.65, 2); // Part 4
    expect(numberAt(sheet, "E7")).toBeCloseTo(500, 2); // Part 4
    expect(numberAt(sheet, "F8")).toBeCloseTo(852.7, 2); // 2 × ₪426.35
    expect(numberAt(sheet, "F9")).toBeCloseTo(1705.4, 2); // 4 × ₪426.35
  });

  it("writes the units and the unit price beside each amount (item 2)", async () => {
    const sheet = await sheetOf(inputFor(result));
    expect(numberAt(sheet, "C6")).toBe(1); // one month at the monthly rate
    expect(numberAt(sheet, "D6")).toBeCloseTo(6247.65, 2);
    expect(numberAt(sheet, "C9")).toBe(4); // Part 4: four rest days
    // Carried at full precision and never rounded, because it is a rate
    // (item 3): the salary over 25 plus the salary over 182, times 1.5.
    expect(numberAt(sheet, "D9")).toBeCloseTo(REST_DAY_RATE_SHEKELS, 5);
  });

  it("draws the entitlement against the holidays taken off, not the ones worked", async () => {
    // The distinction the template's own two headings make: G1 counts what she
    // worked and H1 counts what the entitlement was drawn against, and the two
    // are different counts — a part day draws its own proportion, and a holiday
    // inside a spell of sickness draws nothing at all.
    const sheet = await sheetOf(inputFor(result, { holidayDaysUsed: 1.5 }));
    expect(numberAt(sheet, "H2")).toBe(1.5);
  });

  it("writes the counts across the top under the template's own headings", async () => {
    const sheet = await sheetOf(inputFor(result));
    expect(numberAt(sheet, "D2")).toBe(31); // August has 31 days
    expect(numberAt(sheet, "E2")).toBe(26); // Part 4: 26 standard days
    expect(numberAt(sheet, "F2")).toBe(5); // five rest-eves worked
    expect(numberAt(sheet, "G2")).toBe(4); // Part 4: four rest days worked
    // `ניצול יום חג` is what the yearly entitlement was drawn against, which is
    // every holiday the month records (item 10) — Part 4's two, both of them
    // worked. Their *payment* is a separate figure, ₪852.70 in F8 above.
    expect(numberAt(sheet, "H2")).toBe(2);
    expect(sheet.getCell("G3").value).toBe("16 באוגוסט");
  });

  it("gives all four total lines as live formulas and none as a figure", async () => {
    const sheet = await sheetOf(inputFor(result));
    for (const address of ["E23", "F24", "G25", "E26", "E29"]) {
      expect(formulaAt(sheet, address), address).not.toBeNull();
    }
  });

  it("evaluates its own formulas to Part 4's four totals", async () => {
    const sheet = await sheetOf(inputFor(result));
    // 6,747.65 / 2,558.10 / 9,305.75 / 7,305.75 — Part 4, and criterion 1.
    expect(evaluate(sheet, formulaAt(sheet, "E23") ?? "")).toBeCloseTo(6747.65, 2);
    expect(evaluate(sheet, formulaAt(sheet, "F24") ?? "")).toBeCloseTo(2558.1, 2);
    expect(evaluate(sheet, formulaAt(sheet, "E26") ?? "")).toBeCloseTo(9305.75, 2);
    expect(evaluate(sheet, formulaAt(sheet, "E29") ?? "")).toBeCloseTo(7305.75, 2);
  });

  it("keeps the tax row out of א, so a withheld figure never reduces the ברוטו", async () => {
    // Part 5: the tax reduces the נטו and never the ברוטו. What keeps it out is
    // the range, so the range is what is asserted.
    const sheet = await sheetOf(inputFor(result));
    expect(formulaAt(sheet, "E23")).toBe("SUM(E6:E19)+SUM(E21:E22)");
  });

  it("leaves the tax row labelled and empty in a month that withheld nothing", async () => {
    const sheet = await sheetOf(inputFor(result));
    expect(sheet.getCell("B20").value).toContain("מס הכנסה"); // the template's
    expect(sheet.getCell("E20").value).toBeNull();
  });

  it("writes the repaid advance on the template's own ה row and keeps its words", async () => {
    const sheet = await sheetOf(inputFor(result));
    expect(sheet.getCell("B28").value).toContain("הפחתה מקדמה"); // the template's
    expect(numberAt(sheet, "E28")).toBeCloseTo(-2000, 2); // Part 4's instalment
  });

  it("writes the vacation row's units and leaves its money empty (item 7)", async () => {
    const sheet = await sheetOf(inputFor(result));
    expect(numberAt(sheet, "C17")).toBe(0); // no vacation taken in August 2025
    expect(sheet.getCell("D17").value).toBeNull();
    expect(sheet.getCell("G17").value).toBeNull();
  });

  it("writes the six reporting figures the payslip needs (item 2)", async () => {
    const sheet = await sheetOf(inputFor(result));
    expect(numberAt(sheet, "C33")).toBe(26); // standard days, Part 4
    expect(numberAt(sheet, "C34")).toBe(26); // actual days, Part 4
    expect(numberAt(sheet, "C35")).toBe(0); // vacation used
    // Item 7: the monthly accrual is the yearly quota over twelve, and her
    // second year's quota is fourteen days. Never 1.17 — Part 5 says the
    // workbook's rounding here is not to be copied.
    expect(numberAt(sheet, "C36")).toBeCloseTo(14 / 12, 10);
    expect(numberAt(sheet, "C37")).toBe(0); // sick used
    expect(numberAt(sheet, "C38")).toBeCloseTo(1.5, 10); // item 8: 1.5 a month
  });

  it("keeps the sheet right-to-left, which filling a template preserves", async () => {
    // Part 5: a sheet built from scratch opens left-to-right and reads as a
    // foreign document to the family.
    const sheet = await sheetOf(inputFor(result));
    expect(sheet.views[0]?.rightToLeft).toBe(true);
  });

  it("leaves no placeholder token anywhere in the sheet (Part 3)", async () => {
    const sheet = await sheetOf(inputFor(result));
    const found: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (typeof cell.value === "string" && cell.value.includes("{{")) {
          found.push(cell.address);
        }
      });
    });
    expect(found).toEqual([]);
  });

  it("fills the worker's name where it sits inside a sentence", async () => {
    const sheet = await sheetOf(inputFor(result));
    expect(String(sheet.getCell("C1").value)).toBe("אוגוסט 2025");
    expect(String(sheet.getCell("A3").value)).toBe("חנה");
    expect(String(sheet.getCell("F28").value)).toContain("שולם לחנה");
    expect(String(sheet.getCell("B10").value)).toContain("ביטוח רפואי לעובד/ת");
  });
});

describe("the two versions, which differ in one thing only (item 2)", () => {
  const worker = knownWorker();
  const result = calculateMonth(knownFacts(worker), worker);
  const notes = { restDays: "עבדה בשבת לבקשתנו" };

  it("hides the helper column in the plain version and shows it in the other", async () => {
    const plain = await sheetOf(inputFor(result, { notes, showNotes: false }));
    const withNotes = await sheetOf(inputFor(result, { notes, showNotes: true }));
    expect(plain.getColumn(9).hidden).toBe(true);
    expect(withNotes.getColumn(9).hidden).toBe(false);
  });

  it("writes the notes into both, because hidden is not removed", async () => {
    const plain = await sheetOf(inputFor(result, { notes, showNotes: false }));
    const withNotes = await sheetOf(inputFor(result, { notes, showNotes: true }));
    // The rest-day line is row 9, so its note is I9.
    expect(plain.getCell("I9").value).toBe("עבדה בשבת לבקשתנו");
    expect(withNotes.getCell("I9").value).toBe("עבדה בשבת לבקשתנו");
  });

  it("carries identical figures, which is the whole reason for one file", async () => {
    const plain = await sheetOf(inputFor(result, { notes, showNotes: false }));
    const withNotes = await sheetOf(inputFor(result, { notes, showNotes: true }));
    const figures = (sheet: ExcelJS.Worksheet) => {
      const out: string[] = [];
      sheet.eachRow({ includeEmpty: false }, (row, number) => {
        row.eachCell({ includeEmpty: false }, (cell, column) => {
          if (typeof cell.value === "number") {
            out.push(`${number}:${column}=${cell.value}`);
          }
        });
      });
      return out;
    };
    expect(figures(plain)).toEqual(figures(withNotes));
  });
});

describe("the rows the user added, and the sums that grow over them (item 20)", () => {
  const standing: UserLine = {
    id: "phone",
    label: "השתתפות בטלפון",
    direction: "deduction",
    placement: "beforeGross",
    agorot: 5000,
  };
  const oneOff: UserLine = {
    id: "market",
    label: "בונוס חג",
    direction: "addition",
    placement: "beforeGross",
    agorot: 20000,
  };

  const worker = { ...knownWorker(), standingLines: [standing] };
  const facts: MonthFacts = {
    ...knownFacts(worker),
    terms: { ...knownFacts(worker).terms, standingLines: [standing] },
    userLines: [oneOff],
  };
  const result = calculateMonth(facts, worker);

  it("puts each added line at the foot of the numbered block, in its own column", async () => {
    const sheet = await sheetOf(inputFor(result));
    // Two lines added, so rows 23 and 24, continuing the template's 1–17 in
    // column A. A standing line placed before the total takes column E and a
    // one-off takes G (item 20).
    expect(sheet.getCell("A23").value).toBe(18);
    expect(sheet.getCell("B23").value).toBe("השתתפות בטלפון");
    expect(numberAt(sheet, "E23")).toBeCloseTo(-50, 2);
    expect(sheet.getCell("A24").value).toBe(19);
    expect(sheet.getCell("B24").value).toBe("בונוס חג");
    expect(numberAt(sheet, "G24")).toBeCloseTo(200, 2);
  });

  it("grows every range to cover exactly the rows written", async () => {
    const sheet = await sheetOf(inputFor(result));
    // The totals moved down by two, and each range now reaches row 24.
    expect(formulaAt(sheet, "E25")).toBe("SUM(E6:E19)+SUM(E21:E24)");
    expect(formulaAt(sheet, "F26")).toBe("SUM(F6:F24)");
    expect(formulaAt(sheet, "G27")).toBe("SUM(G6:G24)");
    expect(formulaAt(sheet, "E28")).toBe("E25+F26+G27");
  });

  it("agrees with the engine on all four totals after the sheet grew", async () => {
    const sheet = await sheetOf(inputFor(result));
    // The engine's own figures, so this is the agreement Part 3 asks for driven
    // one layer further down: the amount the engine computed and the amount the
    // spreadsheet's own formula produces, on a month with lines added.
    const subtotal = (column: string) =>
      (result.subtotals.find((one) => one.column === column)?.amount ?? 0) / 100;
    expect(evaluate(sheet, formulaAt(sheet, "E25") ?? "")).toBeCloseTo(subtotal("E"), 2);
    expect(evaluate(sheet, formulaAt(sheet, "F26") ?? "")).toBeCloseTo(subtotal("F"), 2);
    expect(evaluate(sheet, formulaAt(sheet, "G27") ?? "")).toBeCloseTo(subtotal("G"), 2);
    expect(evaluate(sheet, formulaAt(sheet, "E28") ?? "")).toBeCloseTo(
      (result.gross ?? 0) / 100,
      2,
    );
    expect(evaluate(sheet, formulaAt(sheet, "E31") ?? "")).toBeCloseTo(
      (result.net ?? 0) / 100,
      2,
    );
  });

  it("moves the ד label's merge onto the row the label ended up on", async () => {
    // `duplicateRow` does not move a merge with the rows it shifts, so a sheet
    // that grew would otherwise carry the merge four cells wide on the wrong
    // row and read as damaged.
    const sheet = await sheetOf(inputFor(result));
    expect(sheet.model.merges).toEqual(["A28:D28"]);
  });
});

describe("a month whose block below ד is empty", () => {
  const worker = plainWorker();
  const result = calculateMonth(plainAugustFacts(worker), worker);

  it("leaves the ה row labelled and empty, as rows 11 and 20 are left", async () => {
    const sheet = await sheetOf(inputFor(result));
    expect(sheet.getCell("B28").value).toContain("הפחתה מקדמה");
    expect(sheet.getCell("E28").value).toBeNull();
  });

  it("still reaches the month's own ברוטו as its נטו", async () => {
    const sheet = await sheetOf(inputFor(result));
    // ₪8,879.40 — the fixture's own docblock derives it, and nothing was
    // withheld or transferred, so the two figures are the same.
    expect(evaluate(sheet, formulaAt(sheet, "E29") ?? "")).toBeCloseTo(8879.4, 2);
    expect(numberAt(sheet, "C36")).not.toBeNull();
    expect(AUGUST_2025.month).toBe(8);
    expect(SALARY).toBe(624765);
  });
});
