import type { NextRequest } from "next/server";
import { getRepository } from "@/lib/dev/store";
import { calculateSeries } from "@/lib/engine/series";
import { balancesFileOf } from "@/lib/export/balancesExport";
import {
  buildReport,
  nationalInsuranceReport,
  recuperationReport,
  yearlySalaryReport,
} from "@/lib/export/reports";
import { todayInIsrael } from "@/lib/today";

/**
 * The four files the `דוחות` screen offers — stage 2's step 3.
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
 * Stage 3 adds the household check beside the worker lookup; today the store is
 * per-cookie and there is nothing else to be reached.
 */

const SPREADSHEET =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The four reports, by the name the screen's links carry. */
type ReportKind =
  | "balances"
  | "yearlySalary"
  | "recuperation"
  | "nationalInsurance";

function isReportKind(value: string | null): value is ReportKind {
  return (
    value === "balances" ||
    value === "yearlySalary" ||
    value === "recuperation" ||
    value === "nationalInsurance"
  );
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const workerId = query.get("worker");
  const report = query.get("report");
  const year = Number(query.get("year"));

  if (workerId === null || !isReportKind(report)) {
    return new Response("A worker and a report are required", { status: 400 });
  }
  // The two yearly reports need a year and the other two do not, so it is
  // checked where it is used rather than for every report.
  const needsYear = report === "balances" || report === "yearlySalary";
  if (needsYear && !Number.isInteger(year)) {
    return new Response("A year is required", { status: 400 });
  }

  const repository = await getRepository();
  const worker = await repository.getWorker(workerId);
  if (worker === null) return new Response("No such worker", { status: 404 });

  const months = await repository.listMonths(workerId);
  const series = calculateSeries(months, worker, todayInIsrael());

  let bytes: Buffer;
  let filename: string;

  if (report === "balances") {
    // The one report with a committed template, which is why it goes through a
    // filler and the other three are built.
    ({ bytes, filename } = await balancesFileOf({
      worker: { id: worker.id, name: worker.name },
      series,
      year,
    }));
  } else {
    const sheet =
      report === "yearlySalary"
        ? yearlySalaryReport(series, year)
        : report === "recuperation"
          ? recuperationReport(series, worker.employedSince)
          : nationalInsuranceReport(series);
    bytes = await buildReport(sheet);
    // The worker's name in the filename and never in the sheet: item 29 keeps
    // identifying numbers out of a file that leaves the application, and a name
    // is not one of them — it is what tells two workers' files apart on a
    // shelf, which is the same order `monthExport.ts` chose.
    filename = `${sheet.title} - ${worker.name}.xlsx`;
  }

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
