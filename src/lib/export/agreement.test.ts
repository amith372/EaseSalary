import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { calculateSeries } from "@/lib/engine/series";
import { isUserLineKey, lineKeys } from "@/lib/engine/month";
import type { MonthFacts, UserLine, WorkerTerms } from "@/lib/engine/types";
import {
  plainAugustFacts,
  plainWorker,
} from "@/lib/engine/august-2025.fixture";
import { TAX_ROW, TEMPLATE_ROWS, layoutOf } from "@/lib/export/layout";
import { monthSheetInputOf } from "@/lib/export/monthExport";
import { fillMonthSheet } from "@/lib/export/monthSheet";
import { MONTH_TEMPLATE, readTemplate } from "@/lib/export/template";
import { formatAgorot } from "@/lib/money";

/**
 * **The preview and the file, driven from one engine result and asserted to say
 * the same thing.**
 *
 * This is the property stage 2 exists to protect, and it is the one a test
 * sitting beside only the engine or only the filler cannot see: each passes
 * happily while wording the month differently from the other. So the test lives
 * here, beside neither of them, and it takes a single `MonthInSeries` — the same
 * value `/month` renders and the same value the route fills — rather than
 * calculating the month twice.
 *
 * **The comparison is made in the screen's own words**, through `formatAgorot`,
 * because that is what the user actually reads. A file holding 6247.65 and a
 * screen showing "6,247.65 ₪" agree; a file holding 6247.6 and a screen showing
 * "6,247.65 ₪" do not, and only a comparison at the rendered figure catches the
 * agora a conversion lost on the way into the cell.
 *
 * **What it would catch**: a filler that rounded on its way into the sheet, so
 * the sheet is short by an agora on a line the screen shows correctly; a row map
 * pointing at the wrong row, so a figure the screen labels one way the sheet
 * labels another; and a total the sheet reaches by a different route from the
 * engine's.
 */

const standing: UserLine = {
  id: "phone",
  label: "השתתפות בטלפון",
  direction: "deduction",
  placement: "beforeGross",
  agorot: 5000,
};

const afterTotal: UserLine = {
  id: "loan",
  label: "החזר הלוואה פרטית",
  direction: "deduction",
  placement: "afterGross",
  agorot: 30000,
};

/**
 * A month that exercises every region the sheet can grow in: a rest day worked,
 * a worked holiday, sickness, an income tax the user entered, a payment to a
 * third party, a line before the total, a line after it, and two advances.
 *
 * One month rather than several, because the regions interact — an inserted line
 * moves the block, and the block moves the reporting figures — and a month that
 * grew in one place only would leave that untested.
 */
function busyMonth(): { worker: WorkerTerms; facts: MonthFacts } {
  const worker: WorkerTerms = {
    ...plainWorker([standing, afterTotal]),
    openingPosition: {
      vacationDays: 3,
      sickDays: 9,
      advances: [{ number: 1, principalAgorot: 1000000, repaidAgorot: 0 }],
    },
  };
  const facts: MonthFacts = {
    ...plainAugustFacts(worker),
    spans: [
      { id: "free", kind: "freeRestDay", from: "2025-08-16", to: "2025-08-16" },
      { id: "hol", kind: "holiday", from: "2025-08-19", to: "2025-08-19", worked: true },
      { id: "sick", kind: "sick", from: "2025-08-04", to: "2025-08-08" },
      { id: "vac", kind: "vacation", from: "2025-08-11", to: "2025-08-12" },
    ],
    advances: [
      { number: 1, kind: "repaid", agorot: 200000 },
      { number: 2, kind: "granted", agorot: 150000 },
    ],
    thirdPartyPayments: [{ kind: "agencyFee", agorot: 12000 }],
    userLines: [
      {
        id: "bonus",
        label: "בונוס חג",
        direction: "addition",
        placement: "beforeGross",
        agorot: 20000,
      },
    ],
    incomeTaxAgorot: 45000,
  };
  return { worker, facts };
}

async function filled(showNotes: boolean) {
  const { worker, facts } = busyMonth();
  // The replay, exactly as every screen and the route both take it: a month
  // calculated on its own would open from the wrong balances (item 13).
  const series = calculateSeries([facts], worker);
  const month = series[0];
  if (month === undefined) throw new Error("no month");

  const input = monthSheetInputOf({
    worker: { id: "w", name: "חנה", firstName: "חנה" },
    employment: { employedSince: worker.employedSince },
    month,
    showNotes,
  });
  const bytes = await fillMonthSheet(await readTemplate(MONTH_TEMPLATE), input);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  );
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error("no sheet");
  return { sheet, result: month.result };
}

/** What a cell says, read as the screen would say it. An empty cell is `null`
 * and is never silently a zero: a figure the screen shows and the sheet leaves
 * out is exactly the disagreement this file is looking for. */
function said(sheet: ExcelJS.Worksheet, address: string): string | null {
  const value = sheet.getCell(address).value;
  return typeof value === "number" ? formatAgorot(Math.round(value * 100)) : null;
}

describe("the preview and the file, from one engine result", () => {
  it("says every line's amount the same way in both", async () => {
    const { sheet, result } = await filled(false);
    const layout = layoutOf(
      result.lines.filter((line) => isUserLineKey(line.key)).length,
      result.closing.filter((row) => row.block === "transfer").length,
    );

    let added = 0;
    for (const line of result.lines) {
      const fixed = TEMPLATE_ROWS[line.key];
      const row = fixed ?? layout.firstAddedRow + added;
      if (fixed === undefined) added += 1;
      expect(
        said(sheet, `${line.column}${row}`),
        `${line.key} in ${line.column}${row}`,
      ).toBe(formatAgorot(line.amount ?? 0));
    }
  });

  it("says the income tax the same way in both, in the row the sheet keeps for it", async () => {
    const { sheet, result } = await filled(false);
    const tax = result.closing.find((row) => row.key === lineKeys.incomeTax);
    expect(tax?.amount).toBe(-45000); // entered, never calculated (item 17)
    expect(said(sheet, `E${TAX_ROW}`)).toBe(formatAgorot(tax?.amount ?? 0));
  });

  it("says every row of the block below ד the same way in both", async () => {
    const { sheet, result } = await filled(false);
    const block = result.closing.filter((row) => row.block === "transfer");
    const layout = layoutOf(2, block.length);
    block.forEach((row, index) => {
      expect(
        said(sheet, `E${layout.blockFirstRow + index}`),
        row.key,
      ).toBe(formatAgorot(row.amount ?? 0));
    });
  });

  it("says all four totals the same way in both", async () => {
    const { sheet, result } = await filled(false);
    const layout = layoutOf(2, 3);
    const evaluate = (address: string): number => {
      const value = sheet.getCell(address).value;
      if (typeof value === "number") return value;
      if (value === null || typeof value !== "object" || !("formula" in value)) {
        return 0;
      }
      return String(value.formula)
        .split("+")
        .reduce((total, term) => {
          const range = /^SUM\(([A-Z])(\d+):([A-Z])(\d+)\)$/.exec(term);
          if (range === null) return total + evaluate(term);
          let sum = 0;
          for (let row = Number(range[2]); row <= Number(range[4]); row += 1) {
            sum += evaluate(`${range[1]}${row}`);
          }
          return total + sum;
        }, 0);
    };

    const subtotal = (column: string) =>
      result.subtotals.find((one) => one.column === column)?.amount ?? 0;

    // The sheet's own formulas, evaluated over the sheet's own cells, against
    // the figures the screen prints beside the same labels.
    expect(formatAgorot(Math.round(evaluate(`E${layout.subtotalERow}`) * 100))).toBe(
      formatAgorot(subtotal("E")),
    );
    expect(formatAgorot(Math.round(evaluate(`F${layout.subtotalFRow}`) * 100))).toBe(
      formatAgorot(subtotal("F")),
    );
    expect(formatAgorot(Math.round(evaluate(`G${layout.subtotalGRow}`) * 100))).toBe(
      formatAgorot(subtotal("G")),
    );
    expect(formatAgorot(Math.round(evaluate(`E${layout.grossRow}`) * 100))).toBe(
      formatAgorot(result.gross ?? 0),
    );
    expect(formatAgorot(Math.round(evaluate(`E${layout.netRow}`) * 100))).toBe(
      formatAgorot(result.net ?? 0),
    );
  });

  it("says the balances the same way in both", async () => {
    const { sheet, result } = await filled(false);
    const layout = layoutOf(2, 3);
    const vacation = result.balances.find((one) => one.kind === "vacation");
    const sick = result.balances.find((one) => one.kind === "sick");
    const number = (address: string) => sheet.getCell(address).value;

    expect(number(`C${layout.reportFirstRow}`)).toBe(result.standardDays);
    expect(number(`C${layout.reportFirstRow + 1}`)).toBe(result.actualDays);
    expect(number(`C${layout.reportFirstRow + 2}`)).toBe(vacation?.used);
    expect(number(`C${layout.reportFirstRow + 3}`)).toBe(vacation?.closing);
    expect(number(`C${layout.reportFirstRow + 4}`)).toBe(sick?.used);
    expect(number(`C${layout.reportFirstRow + 5}`)).toBe(sick?.closing);
  });

  it("excludes column H from the month's total, in the file as on the screen", async () => {
    // Item 16: reading H as salary would overpay the worker. The agency fee is
    // on the sheet and is in neither total.
    const { sheet, result } = await filled(false);
    expect(said(sheet, `H${TEMPLATE_ROWS["thirdParty.agencyFee"]}`)).toBe(
      formatAgorot(12000),
    );
    const layout = layoutOf(2, 3);
    expect(sheet.getCell(`F${layout.subtotalFRow}`).value).not.toBeNull();
    const gross = result.gross ?? 0;
    const withoutH = result.lines
      .filter((line) => line.column !== "H")
      .reduce((total, line) => total + (line.amount ?? 0), 0);
    expect(gross).toBe(withoutH);
  });
});
