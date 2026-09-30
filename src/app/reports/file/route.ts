import type { NextRequest } from "next/server";
import { downloadSentTo, workerInSeries } from "@/lib/householdSeries";
import { balancesFileOf } from "@/lib/export/balancesExport";
import {
  buildReport,
  nationalInsuranceReport,
  recuperationReport,
  yearlySalaryReport,
  type ReportSheet,
} from "@/lib/export/reports";
import type { WorkerProfile } from "@/lib/engine/repository";
import type { MonthInSeries } from "@/lib/engine/series";

/**
 * The four files the `דוחות` screen offers.
 *
 * **A route handler and not a server action, for the reason
 * `/month/export/file` gives**: this hands back a file, so the browser
 * downloads it the way it downloads anything and every report is a link.
 *
 * **All four are produced from one replay.** A worker's balances are derived by
 * walking their months from the opening position and are never stored (item 13),
 * so every report here opens from the same walk. Filtering to a year before the
 * walk is the defect this guards against: a 2026 file built from 2026's months
 * alone would open that January from zero.
 *
 * The worker lookup is the household check: the repository reads under the
 * signed-in person's session, so row-level security returns no worker from
 * another household.
 */

const SPREADSHEET =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type ReportInput = {
  series: MonthInSeries[];
  year: number;
  worker: WorkerProfile;
};

/** A built sheet as a file. The worker's name goes in the filename and never in
 * the sheet: item 29 keeps identifying numbers out of a file that leaves the
 * application, and a name is not one of them — it is what tells two workers'
 * files apart on a shelf, which is the same order `monthExport.ts` chose. */
async function builtFile(sheet: ReportSheet, worker: WorkerProfile) {
  return {
    bytes: await buildReport(sheet),
    filename: `${sheet.title} - ${worker.name}.xlsx`,
  };
}

/**
 * The four reports, by the name the screen's links carry. The two yearly ones
 * need a year and the other two do not, so the year is checked only where a
 * report says it uses one.
 */
const REPORTS = {
  // The one report with a committed template, which is why it goes through a
  // filler and the other three are built.
  balances: {
    needsYear: true,
    file: ({ series, year, worker }: ReportInput) =>
      balancesFileOf({ worker: { id: worker.id, name: worker.name }, series, year }),
  },
  yearlySalary: {
    needsYear: true,
    file: ({ series, year, worker }: ReportInput) =>
      builtFile(yearlySalaryReport(series, year), worker),
  },
  recuperation: {
    needsYear: false,
    file: ({ series, worker }: ReportInput) =>
      builtFile(recuperationReport(series, worker.employedSince), worker),
  },
  nationalInsurance: {
    needsYear: false,
    file: ({ series, worker }: ReportInput) =>
      builtFile(nationalInsuranceReport(series), worker),
  },
};

type ReportKind = keyof typeof REPORTS;

function isReportKind(value: string | null): value is ReportKind {
  return value !== null && Object.hasOwn(REPORTS, value);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const workerId = query.get("worker");
  const report = query.get("report");
  // **Absent is not zero.** `Number(null)` and `Number("")` are both `0`, and
  // `0` is an integer — so the check below passed for an address with no year
  // at all and the two yearly reports were built for the year zero, which
  // walks their whole history and files it under a year that does not exist.
  const askedYear = query.get("year")?.trim();
  const year =
    askedYear === undefined || askedYear === "" ? Number.NaN : Number(askedYear);

  // **No failure here answers with a body**, for the reason
  // `month/export/file` gives: this address hands back a workbook, so a text
  // body is a bare page in English. Every report is offered as a built link
  // from `/דוחות`, so each of these was crafted, and each goes back to a screen
  // that works (`downloadSentTo`).
  if (workerId === null || !isReportKind(report)) {
    return downloadSentTo(request, "/", null);
  }
  if (REPORTS[report].needsYear && !Number.isInteger(year)) {
    return downloadSentTo(request, "/", workerId);
  }

  const replayed = await workerInSeries(workerId);
  // Unknown, or another household's: one answer for both, or the difference
  // would say whose id is real.
  if (replayed === null) return downloadSentTo(request, "/", null);
  // All four reports are built from the replay, so a refused one has nothing to
  // build from — and this address cannot word a refusal. The opening screen
  // draws the card (`specs.md` item 25).
  if (replayed.refusal !== null) return downloadSentTo(request, "/", workerId);
  const { profile: worker, months: series } = replayed;

  const { bytes, filename } = await REPORTS[report].file({ series, year, worker });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": SPREADSHEET,
      // Hebrew, so the name travels encoded and never bare: a `filename=` with
      // non-ASCII bytes arrives as mojibake or as the URL's last segment.
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      // A past month stays correctable (item 13), so a cached report would be a
      // stale one the day it is corrected.
      "Cache-Control": "no-store",
    },
  });
}
