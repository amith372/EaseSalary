import { monthLabel } from "@/lib/dateLabels";
import type { MonthInSeries } from "@/lib/engine/series";
import { fillBalancesSheet } from "@/lib/export/balancesSheet";
import type { BalancesSheetInput } from "@/lib/export/balancesSheet";
import { BALANCES_TEMPLATE, readTemplate } from "@/lib/export/template";
import { he } from "@/lib/i18n/he";
import type { Worker } from "@/lib/types";

/**
 * The year's balances file, assembled out of the replay — specs.md item 23.
 *
 * **The whole series is replayed and one year of it is written.** A year's
 * opening balance is the closing balance of the December before it, and no
 * balance is ever stored (item 13), so a file built from that year's months
 * alone would open every January from zero. That is the defect this seam
 * exists to prevent, and it is why the caller hands in the whole series rather
 * than a filtered year.
 */

export interface BalancesFileRequest {
  worker: Pick<Worker, "id" | "name">;
  /** The worker's whole history, in date order, as `calculateSeries` returns
   * it. Filtered to the year here and never before. */
  series: MonthInSeries[];
  year: number;
}

export function balancesSheetInputOf(
  request: BalancesFileRequest,
): BalancesSheetInput {
  const months = request.series.filter(
    (month) => month.facts.month.year === request.year,
  );
  return {
    year: request.year,
    months,
    monthLabels: months.map((month) => monthLabel(month.facts.month)),
  };
}

export async function balancesFileOf(
  request: BalancesFileRequest,
): Promise<{ bytes: Buffer; filename: string }> {
  const template = await readTemplate(BALANCES_TEMPLATE);
  const bytes = await fillBalancesSheet(template, balancesSheetInputOf(request));
  return { bytes, filename: filenameOf(request) };
}

/** Hebrew, and the worker before the year, so a shelf of these files sorts by
 * worker and then reads by year — the same order `monthExport.ts` chose. */
function filenameOf(request: BalancesFileRequest): string {
  return `${he.sheet.file.balances} - ${request.worker.name} - ${request.year}.xlsx`;
}
