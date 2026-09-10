import { dayLabel, fullDayLabel, monthLabel } from "@/lib/dateLabels";
import { holidayDaysOf } from "@/lib/engine/leave";
import type { MonthInSeries } from "@/lib/engine/series";
import { closeMonth } from "@/lib/engine/types";
import type { WorkerTerms } from "@/lib/engine/types";
import { fillMonthSheet } from "@/lib/export/monthSheet";
import type { MonthSheetInput } from "@/lib/export/monthSheet";
import { notesOf } from "@/lib/export/notes";
import { MONTH_TEMPLATE, readTemplate } from "@/lib/export/template";
import { he } from "@/lib/i18n/he";
import type { Worker } from "@/lib/types";

/**
 * One month's file, assembled out of the store's own answer.
 *
 * **The engine result is the one this month was already calculated with**, taken
 * off the replay rather than recomputed here: `calculateSeries` opens each month
 * with the closing balances of the month before it, so a month calculated on its
 * own would carry the wrong opening position and the file would disagree with
 * the screen about the balances while agreeing about the money (Part 3).
 *
 * This is also the seam the agreement test uses: the preview and the file are
 * given the same `MonthInSeries`, so they cannot word the month differently.
 */

export interface MonthFileRequest {
  worker: Worker;
  /** The profile, for when the employment began. The month's *terms* are read
   * off the month and never off here (Part 3); this is the employment itself,
   * which is not a term of one month. */
  employment: Pick<WorkerTerms, "employedSince">;
  month: MonthInSeries;
  showNotes: boolean;
}

export function monthSheetInputOf(request: MonthFileRequest): MonthSheetInput {
  const { facts, result } = request.month;
  return {
    result,
    identity: {
      monthYear: monthLabel(facts.month),
      workerName: request.worker.name,
      workerRole: he.sheet.workerRole,
      employmentStart: fullDayLabel(request.employment.employedSince),
    },
    // The same count the replay draws the year's entitlement against, from the
    // same function: `closeMonth` is pure and idempotent, so resolving an open
    // spell again here cannot disagree with the resolution the engine made.
    holidayDaysUsed: holidayDaysOf(
      closeMonth(facts).spans,
      facts.terms.restDay,
    ),
    // The weekly rest days she had off, in the wording the calendar uses for a
    // single day, so the sheet and the screen name the same day alike.
    freeRestDays: facts.spans
      .filter((span) => span.kind === "freeRestDay")
      .map((span) => dayLabel(span.from)),
    notes: notesOf(facts),
    showNotes: request.showNotes,
  };
}

export async function monthFileOf(
  request: MonthFileRequest,
): Promise<{ bytes: Buffer; filename: string }> {
  const template = await readTemplate(MONTH_TEMPLATE);
  const bytes = await fillMonthSheet(template, monthSheetInputOf(request));
  return { bytes, filename: filenameOf(request) };
}

/**
 * What the file is called when it lands in the family's downloads.
 *
 * Hebrew, because everything the user reads is, and the month and the worker in
 * that order so a year of files sorts by worker and then reads by month. The
 * version with the notes says so in its own name: two files with one name, one
 * of which quietly carries the household's notes, is the one way this pair can
 * go wrong after it leaves the application.
 */
function filenameOf(request: MonthFileRequest): string {
  const words = he.sheet.file;
  const parts = [
    words.month,
    request.worker.name,
    monthLabel(request.month.facts.month),
  ];
  if (request.showNotes) parts.push(words.withNotes);
  return `${parts.join(" - ")}.xlsx`;
}
