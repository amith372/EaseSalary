import { isIsoDate, monthOf, sameMonth } from "@/lib/dates";
import type { MonthFacts } from "./types";
import type { IsoDate } from "@/lib/types";

/**
 * A chosen holiday moved once the year's list is in force (specs.md item 10).
 *
 * The regulator's position is that the list is set when the employment starts
 * and does not change month to month; the two sides may still agree to amend
 * it. So until any month of the year is confirmed a date moves freely — the
 * list is still being set — and after that a move is an amendment: it carries
 * the day it was agreed and a note, both dates fall after that day and outside
 * every confirmed month, and it is kept so the list as first agreed can always
 * be read back. The move itself is the span's; this is its record, and it values
 * nothing.
 */
export interface HolidayAmendment {
  id: string;
  agreedOn: IsoDate;
  from: IsoDate;
  to: IsoDate;
  note: string;
}

export type AmendmentRefusal =
  /** A move made once the list is in force, without an agreed date and note. */
  | "amendmentNeeded"
  /** The agreed date is not a date, or one of the two dates is not after it. */
  | "agreedOn"
  /** The holiday would leave, or land in, a month already confirmed. */
  | "confirmedMonth"
  /** An amendment records a note, and this one is blank. */
  | "note";

type MonthStamp = Pick<MonthFacts, "month" | "confirmedAt">;

function confirmed(months: readonly MonthStamp[]): MonthStamp[] {
  return months.filter((month) => month.confirmedAt !== undefined);
}

/** Whether a move in `year` is an amendment: any month of that year has been
 * confirmed. A corrected month counts, since it was confirmed once. */
export function listInForce(year: number, months: readonly MonthStamp[]): boolean {
  return confirmed(months).some((month) => month.month.year === year);
}

/** An amendment judged against the months as stored. */
export function reviewHolidayAmendment(
  move: { from: IsoDate; to: IsoDate; agreedOn: string; note: string },
  months: readonly MonthStamp[],
): { ok: true } | { ok: false; reason: AmendmentRefusal } {
  if (move.note.trim() === "") return { ok: false, reason: "note" };
  if (!isIsoDate(move.agreedOn)) return { ok: false, reason: "agreedOn" };
  if (move.from <= move.agreedOn || move.to <= move.agreedOn) {
    return { ok: false, reason: "agreedOn" };
  }
  const locked = confirmed(months);
  if (
    [move.from, move.to].some((date) =>
      locked.some((month) => sameMonth(month.month, monthOf(date))),
    )
  ) {
    return { ok: false, reason: "confirmedMonth" };
  }
  return { ok: true };
}
