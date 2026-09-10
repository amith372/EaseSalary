import ExcelJS from "exceljs";
import { monthLabel } from "@/lib/dateLabels";
import { daysInMonth, isoOf } from "@/lib/dates";
import { lineKeys } from "@/lib/engine/month";
import { employmentYearsCompletedBy } from "@/lib/engine/recuperation";
import type { MonthInSeries } from "@/lib/engine/series";
import { thirdPartyLineKey } from "@/lib/engine/thirdParty";
import { he } from "@/lib/i18n/he";
import type { MonthLine } from "@/lib/types";

/**
 * The three reports the `דוחות` artboard draws that no template covers —
 * the yearly salary summary (specs.md item 29), the recuperation payments
 * (item 15) and the national insurance by quarter (items 16, 19).
 *
 * **Built from scratch rather than filled, because there is no committed
 * template for them.** Only the month tab and the yearly balances have one, and
 * inventing a fourth `.xlsx` to commit would be a second thing to keep in step
 * with a layout nobody has asked for. What a built sheet must not lose is the
 * reading direction: Part 5 says a sheet built from scratch opens
 * left-to-right and reads as a foreign document to the family, so
 * `buildReport` sets it and every report goes through `buildReport`.
 *
 * **Every figure comes off the replay and none is recomputed here.** The
 * balances, the totals and the lines were all derived by `calculateSeries`
 * walking the worker's months from her opening position (item 13); a report
 * that added arithmetic of its own would be a second calculation path and would
 * disagree with the screen the day either was corrected.
 *
 * **Which four reports exist was settled with the user on 2026-09-10.** The
 * artboard draws four cards and the build plan's step 3 named three; she chose
 * all four, so the national-insurance report is built here on the strength of
 * that decision and of the card's own words rather than of a numbered
 * criterion, which it does not have.
 */

/** Money reaches a sheet in shekels, which is what the family reads — the same
 * conversion `monthSheet.ts` makes, and the same reason: the engine's agorot
 * are integers, so this is exact and never a rounding. */
function shekels(agorot: number | null | undefined): number | null {
  return agorot === null || agorot === undefined ? null : agorot / 100;
}

export interface ReportSheet {
  /** Names the tab and heads the sheet, so a file opened months later says what
   * it is without the filename. */
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
}

export async function buildReport(report: ReportSheet): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  // Part 5, and the one thing a built sheet loses that a filled one keeps.
  const sheet = workbook.addWorksheet(report.title, {
    views: [{ rightToLeft: true }],
  });

  sheet.addRow([report.title]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([]);
  sheet.addRow(report.columns);
  sheet.getRow(3).font = { bold: true };
  for (const row of report.rows) sheet.addRow(row);

  // Wide enough for a Hebrew heading and a five-figure sum, so nothing arrives
  // as `#####` — which reads as a broken file rather than a narrow column.
  report.columns.forEach((_, index) => {
    sheet.getColumn(index + 1).width = index === 0 ? 18 : 22;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function lineOf(month: MonthInSeries, key: string): MonthLine | undefined {
  return month.result.lines.find((line) => line.key === key);
}

function inYear(series: MonthInSeries[], year: number): MonthInSeries[] {
  return series.filter((month) => month.facts.month.year === year);
}

/**
 * Item 29 — one worker, one year, that year's months with their totals.
 *
 * **It carries no passport number and no bank account number** (items 22, 29):
 * those are shown on the screen that needs them and are never written into a
 * file that leaves the application. Nothing here reads them, which is the point
 * of assembling the file from the result rather than from the profile.
 *
 * The two totals are the month's own — the sheet's `ד` and the sum transferred,
 * which are the code's `gross` and `net`. No yearly total row is written: item
 * 29 asks for "that year's months with their totals" and a figure the criterion
 * does not name is one nobody has checked.
 */
export function yearlySalaryReport(
  series: MonthInSeries[],
  year: number,
): ReportSheet {
  const words = he.reports.yearlySalary;
  return {
    title: `${words.title} ${year}`,
    columns: [words.month, words.gross, words.net],
    rows: inYear(series, year).map((month) => [
      monthLabel(month.facts.month),
      shekels(month.result.gross),
      shekels(month.result.net),
    ]),
  };
}

/**
 * Item 15 — the recuperation payments, by the seniority they were paid for.
 *
 * The card on the artboard says "מה שולם ומתי, לפי שנות הותק", and seniority is
 * what this payment is measured in: recuperation keeps its own clock, running
 * from one employment anniversary to the next while vacation runs by the
 * calendar year, and item 15 says in so many words that the disagreement is
 * correct rather than an oversight. So the years completed are counted at the
 * month's own last day, which is the same instant `recuperationDaysFor` counts
 * them at — a second reckoning here would be a second answer.
 *
 * **Every year at once and not one year at a time**, unlike item 29's summary:
 * a ladder that steps once a year says nothing inside a single year, and the
 * whole of it is a handful of rows.
 */
export function recuperationReport(
  series: MonthInSeries[],
  employedSince: string,
): ReportSheet {
  const words = he.reports.recuperation;
  return {
    title: words.title,
    columns: [words.month, words.yearsCompleted, words.days, words.amount],
    rows: series
      .map((month) => ({ month, line: lineOf(month, lineKeys.recuperation) }))
      .filter((entry) => entry.line !== undefined)
      .map(({ month, line }) => [
        monthLabel(month.facts.month),
        employmentYearsCompletedBy(
          employedSince,
          isoOf(month.facts.month, daysInMonth(month.facts.month)),
        ),
        line?.units ?? null,
        shekels(line?.amount),
      ]),
  };
}

/**
 * Items 16 and 19 — the national insurance actually paid, and the quarter each
 * payment covered.
 *
 * **This is the money that left the account and never the monthly estimate.**
 * `MonthResult.nationalInsuranceEstimate` is 3.6% of the month's cost and is an
 * estimate to be confirmed, which the sum billed has differed from; a payment
 * appears once, in the month it was paid, as a column H line of its own. A
 * report that listed the estimates instead would be a reporting file full of
 * figures nobody ever paid, which is the worst kind of wrong here because every
 * one of them looks plausible.
 *
 * The covered months travel with the line rather than being recomputed: the
 * quarter is offered when the payment is recorded and stops following the kind
 * the moment the user touches it, so a family that paid a quarter late has
 * chosen the quarter it was for and this file must say what she chose.
 */
export function nationalInsuranceReport(series: MonthInSeries[]): ReportSheet {
  const words = he.reports.nationalInsurance;
  const key = thirdPartyLineKey("nationalInsurance");
  return {
    title: words.title,
    columns: [words.paidIn, words.covers, words.amount],
    rows: series
      .map((month) => ({ month, line: lineOf(month, key) }))
      .filter((entry) => entry.line !== undefined)
      .map(({ month, line }) => [
        monthLabel(month.facts.month),
        (line?.coversMonths ?? []).map(monthLabel).join(", ") || null,
        shekels(line?.amount),
      ]),
  };
}
