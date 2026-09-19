import type { NextRequest } from "next/server";
import { getRepository } from "@/lib/store";
import { calculateSeries } from "@/lib/engine/series";
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
import { readToday } from "@/lib/requestToday";

/**
 * The four files the `דוחות` screen offers.
 *
 * **A route handler and not a server action, for the reason
 * `/month/export/file` gives**: this hands back a file, so the browser
 * downloads it the way it downloads anything and every report is a link.
 *
 * **All four are produced from one replay.** A worker's balances are derived by
 * walking her months from the opening position and are never stored (item 13),
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
  const year = Number(query.get("year"));

  if (workerId === null || !isReportKind(report)) {
    return new Response("A worker and a report are required", { status: 400 });
  }
  if (REPORTS[report].needsYear && !Number.isInteger(year)) {
    return new Response("A year is required", { status: 400 });
  }

  const repository = await getRepository();
  const worker = await repository.getWorker(workerId);
  if (worker === null) return new Response("No such worker", { status: 404 });

  const months = await repository.listMonths(workerId);
  const series = calculateSeries(months, worker, await readToday(), await repository.listRates());

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
