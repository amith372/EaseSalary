import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { calculateSeries } from "@/lib/engine/series";
import { isUserLineKey, lineKeys } from "@/lib/engine/month";
import type { MonthFacts, UserLine, WorkerTerms } from "@/lib/engine/types";
import {
  plainAugustFacts,
  plainWorker,
} from "@/lib/engine/august-2025.fixture";
import {
  NATIONAL_INSURANCE_ROW,
  TAX_ROW,
  TEMPLATE_ROWS,
  layoutOf,
} from "@/lib/export/layout";
import { monthSheetInputOf } from "@/lib/export/monthExport";
import { fillMonthSheet } from "@/lib/export/monthSheet";
import { MONTH_TEMPLATE, readTemplate } from "@/lib/export/template";
import { monthLabel } from "@/lib/dateLabels";
import { formatAgorot } from "@/lib/money";
import { sameMonth } from "@/lib/dates";
import { createInMemoryRepository } from "@/lib/engine/repository";
import { openMonthIfMissing } from "@/lib/openMonth";

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
      vacationUsedThisYear: 0,
      holidayUsedThisYear: 0,
      recuperationPaidIn: null,
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
    thirdPartyPayments: [{ kind: "agencyFee", agorot: 12000, paidOn: "2025-08-15" }],
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

async function filled(showNotes: boolean, over: Partial<MonthFacts> = {}) {
  const { worker, facts: base } = busyMonth();
  const facts = { ...base, ...over };
  // The replay, exactly as every screen and the route both take it: a month
  // calculated on its own would open from the wrong balances (item 13).
  const series = calculateSeries([facts], worker);
  const month = series[0];
  if (month === undefined) throw new Error("no month");

  const input = monthSheetInputOf({
    worker: { id: "w", name: "חנה", firstName: "חנה" },
    insurer: "סוכנות ביטוח לדוגמה",
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
    // The month carries a confirmed figure, which is reproduced rather than
    // recalculated (item 17, Part 3).
    expect(tax?.amount).toBe(-45000);
    expect(said(sheet, `E${TAX_ROW}`)).toBe(formatAgorot(tax?.amount ?? 0));
  });

  /**
   * **The same row when the engine worked the figure out for itself** (item 17,
   * approved 2026-09-10).
   *
   * The confirmed case above cannot catch a calculated tax that reaches the
   * screen and not the sheet: the figure it checks was stored on the month, so
   * a sheet filled from the stored record instead of from the engine would pass
   * it. Clearing the confirmation is what makes the two paths distinguishable.
   *
   * The expectation is the **agreement** and not the amount, which is what an
   * agreement test asserts (`CLAUDE.md`); the amount is checked to be non-zero
   * so that two empty cells cannot agree their way past this.
   */
  it("says a calculated income tax the same way in both", async () => {
    const { sheet, result } = await filled(false, {
      incomeTaxAgorot: undefined,
    });
    const tax = result.closing.find((row) => row.key === lineKeys.incomeTax);

    expect(tax?.amount).toBeLessThan(0);
    expect(tax?.amount).not.toBe(-45000);
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

  /**
   * **A formula with no value in it is a blank cell to everything but Excel.**
   *
   * An `.xlsx` formula cell holds the formula and the value it last evaluated
   * to, and exceljs writes only the first. On 2026-09-11 a family opened a month
   * whose seventeen rows were all present and whose four totals and transferred
   * figure were empty, which is what a formula with nothing cached looks like
   * anywhere that does not recalculate — a preview pane, a print, a viewer.
   *
   * **What it would catch**: every total losing its figure again the next time
   * this file is touched, and a cached figure drifting from the formula beside
   * it — the second being the risk the cache introduces, which is why the
   * assertion is that the two say the same thing rather than that a number is
   * present.
   */
  it("writes a figure into every total and not only a formula", async () => {
    const { sheet, result } = await filled(false);
    const layout = layoutOf(2, 3);
    const subtotal = (column: string) =>
      result.subtotals.find((one) => one.column === column)?.amount ?? 0;

    const totals: [string, number][] = [
      [`E${layout.subtotalERow}`, subtotal("E")],
      [`F${layout.subtotalFRow}`, subtotal("F")],
      [`G${layout.subtotalGRow}`, subtotal("G")],
      [`E${layout.grossRow}`, result.gross ?? 0],
      [`E${layout.netRow}`, result.net ?? 0],
    ];

    for (const [address, expected] of totals) {
      const value = sheet.getCell(address).value;
      expect(value, address).toMatchObject({ formula: expect.any(String) });
      const cached = (value as { result?: number }).result;
      expect(cached, address).toEqual(expect.any(Number));
      expect(formatAgorot(Math.round((cached ?? 0) * 100)), address).toBe(
        formatAgorot(expected),
      );
    }
  });

  /**
   * **The national-insurance estimate reaches the sheet, and the quarter's
   * money does not stand in for it** (specs.md item 19).
   *
   * The estimate is 3.6% of columns E, F and G together and belongs in the
   * unit-price cell of row 21, every month, whether or not that month settled a
   * quarter. The row was empty in every file this application ever produced
   * until a family looked at one on 2026-09-11.
   *
   * **What it would catch**: the row going empty again, and — the subtler half —
   * a month that *did* pay a quarter writing the payment into the estimate's
   * cell. A third-party payment is a line whose rate is its whole amount, so the
   * generic writer puts it in `D`; on this one row that would report the
   * quarter's money as the month's accrual, and the two are different figures.
   */
  it("reports the national-insurance estimate beside the payment, not instead of it", async () => {
    const paid = 93600;
    const { sheet, result } = await filled(false, {
      thirdPartyPayments: [
        { kind: "agencyFee", agorot: 12000, paidOn: "2025-08-15" },
        {
          kind: "nationalInsurance",
          paidOn: "2025-07-15",
          agorot: paid,
          coversMonths: [
            { year: 2025, month: 4 },
            { year: 2025, month: 5 },
            { year: 2025, month: 6 },
          ],
        },
      ],
    });

    // The estimate the month screen prints, in the cell the workbook keeps it.
    expect(said(sheet, `D${NATIONAL_INSURANCE_ROW}`)).toBe(
      formatAgorot(result.nationalInsuranceEstimate ?? 0),
    );
    // And the quarter's money, in its own column, undisturbed.
    expect(said(sheet, `H${NATIONAL_INSURANCE_ROW}`)).toBe(formatAgorot(paid));
    expect(result.nationalInsuranceEstimate).not.toBe(paid);
  });

  /**
   * **The months the quarter was for, named beside the money** (specs.md item
   * 19: the payment appears "with the months it covers named beside it", and
   * "the export carries the amount that was due, that tick, and the months the
   * payment covers").
   *
   * The row's label is a sentence with a blank in it — the family types the
   * quarter into "הפרשות בגין חודשים ____" by hand — so the blank is the
   * template's `{{ni_months}}` and the export fills it. A figure alone in `H`
   * says a quarter was settled and not *which* quarter, and a payment made in
   * arrears is unreadable without that.
   *
   * **What it would catch**: the token left standing, which prints the literal
   * "{{ni_months}}" onto a family's sheet; the months dropped, which is the
   * blank the application exists to stop the user filling in herself; and the
   * sheet naming a different run from the screen, which draws the same two ends
   * through `CoveredMonths`. The ends are asserted through `monthLabel` for
   * that last reason — it is the function the screen words each end with.
   */
  it("names the months the quarter's payment covers", async () => {
    const covers = [
      { year: 2025, month: 4 },
      { year: 2025, month: 5 },
      { year: 2025, month: 6 },
    ];
    const { sheet } = await filled(false, {
      thirdPartyPayments: [
        { kind: "nationalInsurance", agorot: 93600, paidOn: "2025-07-15", coversMonths: covers },
      ],
    });
    const label = sheet.getCell(`B${NATIONAL_INSURANCE_ROW}`).text;

    // Written out rather than built from the code under test: April to June
    // 2025 is the quarter the fixture pays for, and this is how the family
    // reads it.
    expect(label).toContain("אפריל 2025 – יוני 2025");
    // And the second blank of the same label: the day the money left the
    // account. A quarter paid in arrears appears in a month that is neither
    // the months it covers nor the day it was paid, so a row naming only one
    // of the three cannot be reconciled against a bank statement.
    expect(label).toContain("15 ביולי 2025");
    // The same two ends the screen draws, worded by the same function.
    expect(label).toContain(monthLabel(covers[0]!));
    expect(label).toContain(monthLabel(covers[covers.length - 1]!));
    expect(label).not.toContain("{{");
  });

  /**
   * **The medical-insurance row names the family's own insurer and no
   * template's** (specs.md item 16, Part 3: a template may never carry one
   * family's data into another's sheet).
   *
   * Until 2026-09-12 cell `B10` read "שולם באמצעות סוכנות ביטוח הילית
   * בחברת הראל - קופ\"ח כללית" — one household's agency, insurer and health
   * fund, written into the committed binary where no diff could show them.
   *
   * **What it would catch**: the names coming back into the template, which is
   * the whole defect and is invisible to every other check in this repository;
   * and the token left standing, which prints "{{insurer}}" onto the sheet.
   */
  it("names the family's own insurer on the medical-insurance row", async () => {
    const { sheet } = await filled(false);
    const label = sheet.getCell("B10").text;

    expect(label).toContain("סוכנות ביטוח לדוגמה");
    expect(label).not.toContain("{{");
    // The two names the template carried. Written out rather than imported,
    // because there is nowhere left to import them from — which is the point.
    expect(label).not.toContain("הילית");
    expect(label).not.toContain("הראל");
  });

  /**
   * **A month that settled no quarter leaves the sentence as the workbook
   * prints it.** Most months settle nothing (item 19: it is paid once a
   * quarter), so the ordinary sheet must not carry a half-filled sentence.
   *
   * **What it would catch**: the token surviving into every ordinary month's
   * file, which is the failure mode of a placeholder nobody fills when the
   * fact behind it is absent.
   */
  it("leaves the months blank in a month that settled no quarter", async () => {
    const { sheet } = await filled(false);
    const label = sheet.getCell(`B${NATIONAL_INSURANCE_ROW}`).text;

    expect(label).not.toContain("{{");
    expect(label).toContain("ביטוח לאומי");
    // No payment, so the third-party column is empty too — the two go together,
    // and a named quarter over an empty cell would be the real defect.
    expect(sheet.getCell(`H${NATIONAL_INSURANCE_ROW}`).text).toBe("");
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

/**
 * **A month nobody opened, previewed and then opened** (specs.md Part 3, item
 * 21): opening a month records it without changing what it was, so the figures
 * the preview drew before the first fact was recorded are the figures the
 * month holds after it was opened — the one the export then fills from.
 *
 * What it would catch: a month opened with a zero income tax, another wage, or
 * other terms than the replay valued it with, which moves every figure the
 * moment the user confirms it.
 */
describe("a month nobody opened keeps its figures when it is opened", () => {
  it("draws the same result before and after", async () => {
    // Her first month is July 2025 and nothing was recorded in August; asked on
    // 20 August, the walk values August as an ordinary month.
    const worker = {
      ...plainWorker(),
      id: "w",
      name: "חנה",
      firstName: "חנה",
      insurer: "",
      firstMonth: { year: 2025, month: 7 },
      documents: {
        employmentPermitExpiry: null,
        workVisaExpiry: null,
        passportExpiry: null,
      },
    };
    const july = { ...plainAugustFacts(worker), month: { year: 2025, month: 7 } };
    const repository = createInMemoryRepository({ workers: [worker] });
    const { spans, ...julyRecord } = july;
    void spans;
    await repository.saveMonth("w", julyRecord);
    const today = "2025-08-20";
    const august = { year: 2025, month: 8 };

    const before = calculateSeries(
      await repository.listMonths("w"),
      worker,
      today,
      await repository.listRates(),
    ).find((one) => sameMonth(one.facts.month, august));
    expect(await repository.getMonth("w", august)).toBeNull();

    expect(await openMonthIfMissing(repository, worker, august)).toBe(true);
    const after = calculateSeries(
      await repository.listMonths("w"),
      worker,
      today,
      await repository.listRates(),
    ).find((one) => sameMonth(one.facts.month, august));

    expect(before).toBeDefined();
    expect(after!.result).toEqual(before!.result);
  });

  it("refuses to open a month before the first", async () => {
    const worker = {
      ...plainWorker(),
      id: "w",
      name: "חנה",
      firstName: "חנה",
      insurer: "",
      documents: {
        employmentPermitExpiry: null,
        workVisaExpiry: null,
        passportExpiry: null,
      },
    };
    const repository = createInMemoryRepository({ workers: [worker] });
    // The fixture's first month is August 2025.
    expect(
      await openMonthIfMissing(repository, worker, { year: 2025, month: 7 }),
    ).toBe(false);
    expect(await repository.getMonth("w", { year: 2025, month: 7 })).toBeNull();
  });
});
