import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { calculateSeries } from "@/lib/engine/series";
import { plainAugustFacts, plainWorker } from "@/lib/engine/august-2025.fixture";
import type { MonthFacts } from "@/lib/engine/types";
import {
  buildReport,
  nationalInsuranceReport,
  recuperationReport,
  yearlySalaryReport,
} from "@/lib/export/reports";

/**
 * The three reports no template covers — stage 2's step 3.
 *
 * **Every expected figure is derived on paper or comes from a criterion, never
 * from what the report returned.** Hanna was employed on 1.4.2024 and her
 * recuperation month is July, so by 31.7.2025 she has completed exactly one
 * employment year: item 15's ladder pays five days for a first completed year,
 * and six for the second and third. At ₪451.50 a day that is ₪2,257.50 in 2025
 * and ₪2,709.00 in 2026 — the second of which the build plan already records
 * from the family's own confirmation screen.
 */

/** ₪451.50 — the recuperation day rate the user confirms and the month stores
 * (item 15). It is not derived from the salary: nothing in the salary implies
 * it, which is exactly why it is a stored fact and is written here as one. */
const DAY_RATE = 45150;

const worker = plainWorker();

function monthOf(year: number, month: number): MonthFacts {
  const facts: MonthFacts = { ...plainAugustFacts(worker), month: { year, month } };
  // Only the recuperation month carries the rate, which is what the field's own
  // "absent in almost every month" means.
  return month === worker.recuperationMonth
    ? { ...facts, recuperationDayRateAgorot: DAY_RATE }
    : facts;
}

/** July 2025 and July 2026 are the two recuperation months; June 2025 is an
 * ordinary month, present so the reports have something to leave out. */
const SERIES = calculateSeries(
  [monthOf(2025, 6), monthOf(2025, 7), monthOf(2026, 7)],
  worker,
);

async function sheetOf(report: Parameters<typeof buildReport>[0]) {
  const bytes = await buildReport(report);
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

describe("the yearly salary summary (item 29)", () => {
  it("holds that year's months and no other year's", () => {
    const report = yearlySalaryReport(SERIES, 2025);
    // Two of the three months are 2025's. A report that ignored the year would
    // print July 2026 into the 2025 file, which item 29 forbids in so many
    // words: it is downloaded a year at a time and never every year at once.
    expect(report.rows.map((row) => row[0])).toEqual([
      "יוני 2025",
      "יולי 2025",
    ]);
  });

  it("writes each month's two totals in shekels", () => {
    const report = yearlySalaryReport(SERIES, 2025);
    const june = SERIES[0];
    if (june === undefined) throw new Error("no June");
    // The engine's agorot are integers, so the conversion is exact. This is the
    // one figure taken off the result rather than derived, and it is taken as a
    // *unit* check — that the sheet says shekels where the engine says agorot —
    // which is what a report written in agorot would fail by a factor of 100.
    expect(report.rows[0]?.[1]).toBe((june.result.gross ?? 0) / 100);
    expect(report.rows[0]?.[2]).toBe((june.result.net ?? 0) / 100);
    expect(typeof report.rows[0]?.[1]).toBe("number");
  });

  it("carries no passport number and no bank account number (items 22, 29)", async () => {
    const sheet = await sheetOf(yearlySalaryReport(SERIES, 2025));
    const words: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => words.push(cell.text));
    });
    const text = words.join(" ");
    expect(text).not.toContain("דרכון");
    expect(text).not.toContain("חשבון");
  });
});

describe("the recuperation report (item 15)", () => {
  it("lists only the months that paid it, with the years they covered", () => {
    const report = recuperationReport(SERIES, worker.employedSince);
    // June is left out because it paid none. The ladder is item 15's: five days
    // for the first completed year, six for the second.
    expect(report.rows).toEqual([
      ["יולי 2025", 1, 5, 2257.5],
      ["יולי 2026", 2, 6, 2709],
    ]);
  });

  it("counts seniority at the month's own last day and not at today", () => {
    // The years must not move because of when the report is run — the same rule
    // that keeps a finished month's figures settled. Running it twice with the
    // same series gives the same ladder.
    const first = recuperationReport(SERIES, worker.employedSince);
    const second = recuperationReport(SERIES, worker.employedSince);
    expect(first.rows).toEqual(second.rows);
    expect(first.rows[0]?.[1]).toBe(1);
  });
});

describe("the national insurance report (items 16, 19)", () => {
  it("is empty when nothing was paid, rather than listing the estimates", () => {
    // Every month carries a `nationalInsuranceEstimate`, and none of these
    // months recorded a payment. A report built off the estimate would print
    // three plausible figures nobody ever paid, which is the defect this
    // asserts against.
    expect(nationalInsuranceReport(SERIES).rows).toEqual([]);
  });

  it("lists a payment in the month it left the account, with its quarter", () => {
    const paid: MonthFacts = {
      ...monthOf(2025, 7),
      thirdPartyPayments: [
        {
          kind: "nationalInsurance",
          agorot: 95000,
          coversMonths: [
            { year: 2025, month: 4 },
            { year: 2025, month: 5 },
            { year: 2025, month: 6 },
          ],
        },
      ],
    };
    const series = calculateSeries([paid], worker);
    expect(nationalInsuranceReport(series).rows).toEqual([
      ["יולי 2025", "אפריל 2025, מאי 2025, יוני 2025", 950],
    ]);
  });
});

describe("every built sheet, which has no template to inherit from", () => {
  it("opens right-to-left (Part 5)", async () => {
    // The one thing a built sheet loses that a filled one keeps: a
    // left-to-right sheet reads as a foreign document to the family.
    for (const report of [
      yearlySalaryReport(SERIES, 2025),
      recuperationReport(SERIES, worker.employedSince),
      nationalInsuranceReport(SERIES),
    ]) {
      const sheet = await sheetOf(report);
      expect(sheet.views[0]?.rightToLeft, report.title).toBe(true);
    }
  });

  it("heads the sheet with its own title and its column names", async () => {
    const report = recuperationReport(SERIES, worker.employedSince);
    const sheet = await sheetOf(report);
    expect(sheet.getCell("A1").text).toBe("דמי הבראה");
    expect(sheet.getCell("A3").text).toBe("חודש");
    expect(sheet.getCell("B3").text).toBe("שנות ותק שהושלמו");
    expect(sheet.getCell("A4").text).toBe("יולי 2025");
  });
});
