import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { plainAugustFacts, plainWorker } from "@/lib/engine/august-2025.fixture";
import { calculateSeries } from "@/lib/engine/series";
import { monthSheetInputOf } from "@/lib/export/monthExport";
import { fillMonthSheet } from "@/lib/export/monthSheet";
import { MONTH_TEMPLATE, readTemplate } from "@/lib/export/template";

/**
 * Her passport and bank account numbers on the month sheet (specs.md item 22:
 * the real numbers appear on her own screen and in the export).
 *
 * The cells are the template's own: `A4` holds `{{passport_line}}` and `C3`
 * reads "מס'  חשבון:  {{account_number}}" in both month templates. The numbers
 * are invented here and look like nobody's.
 *
 * What it would catch: a number opened on the server and never reaching the
 * file, a token left standing on the sheet of a worker whose family entered
 * none, and a number written into the wrong line.
 */

async function sheetWith(numbers?: { passport?: string; bankAccount?: string }) {
  const worker = plainWorker();
  const month = calculateSeries([plainAugustFacts(worker)], worker)[0];
  if (month === undefined) throw new Error("no month");

  const input = monthSheetInputOf({
    worker: { id: "w", name: "עובדת לדוגמה", firstName: "עובדת" },
    insurer: "",
    employment: { employedSince: worker.employedSince },
    month,
    showNotes: false,
    numbers,
  });
  const bytes = await fillMonthSheet(await readTemplate(MONTH_TEMPLATE), input);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error("no sheet");
  return sheet;
}

describe("the sheet's identity lines", () => {
  it("writes the passport number into the identity line and the account number beside its label", async () => {
    const sheet = await sheetWith({ passport: "P0000000A", bankAccount: "12-345-678901" });

    expect(sheet.getCell("A4").text).toContain("P0000000A");
    expect(sheet.getCell("C3").text).toContain("12-345-678901");
    // The label the template already carries stays; the number follows it.
    expect(sheet.getCell("C3").text).toContain("חשבון");
    // Neither number lands in the other's cell.
    expect(sheet.getCell("A4").text).not.toContain("12-345-678901");
    expect(sheet.getCell("C3").text).not.toContain("P0000000A");
  });

  it("leaves both blank, and no token standing, where the family entered none", async () => {
    const sheet = await sheetWith();

    expect(sheet.getCell("A4").text).not.toContain("{{");
    expect(sheet.getCell("C3").text).not.toContain("{{");
    expect(sheet.getCell("A4").text.trim()).toBe("");
  });
});
