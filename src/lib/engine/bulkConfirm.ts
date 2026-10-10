import { monthHasEnded } from "../dates";
import { rateInForce, type DatedRate } from "../datedRates";
import { blocksExport, recuperationToConfirm } from "./beforeExport";
import { monthState } from "./monthState";
import type { ConfirmedFigures } from "../monthConfirmation";
import type { Employment, MonthFacts } from "./types";
import type { IsoDate } from "../types";

/**
 * Which months may be confirmed from the worker's own list of months, several
 * at once, without an export (specs.md item 18).
 *
 * **It claims less than an export does, so it may only confirm what needs no
 * answer.** Item 18's questions are a confirmation of what happened inside a
 * month and are answered by somebody walking it; what this path confirms is the
 * figures the month is valued at. So the one rule here is that **every figure
 * the confirmation writes already exists** — in the dated rates table, or on
 * the profile — and a month that would need something typed is left to the
 * export screen, which is where a figure is entered by hand.
 */

/**
 * Why a month cannot be confirmed from the list, or `"ok"` where it can.
 *
 * Each reason is a sentence on the screen (`he.workers.profile.months.cannot`),
 * so the set is closed and the screen is exhaustive over it: a reason with no
 * sentence is a row that says nothing about why it has no tick.
 */
export type BulkConfirmVerdict =
  | "ok"
  | "alreadyConfirmed"
  | "notEnded"
  | "openSickSpell"
  | "unansweredHoliday"
  | "noWageForMonth"
  | "noRecuperationRate";

/**
 * Whether this month may be confirmed from the list, and why not where it may
 * not.
 *
 * **The two blocks are item 18's own and are not restated here**: `blocksExport`
 * is asked, because a month carrying an unanswered holiday or a spell of
 * sickness still open is a month whose total the application knows is wrong,
 * and a wrong balance is the thing confirming in bulk exists to avoid. A second
 * copy of those rules would agree today and drift the first time either was
 * corrected.
 *
 * **A month that has not ended is refused rather than warned.** The export
 * screen exports the running month with a warning (item 21), because the person
 * there is looking at it; a run of ticks down a list is not that, and a month
 * confirmed by a gesture that said nothing about it is the one case where the
 * warning has nobody to warn.
 */
export function bulkConfirmVerdict(
  facts: MonthFacts,
  employment: Employment,
  rates: DatedRate[],
  today: IsoDate,
): BulkConfirmVerdict {
  if (monthState(facts) !== "draft") return "alreadyConfirmed";
  if (!monthHasEnded(facts.month, today)) return "notEnded";

  // Asked before the figures, because a month that may not be confirmed at all
  // need not be asked what it would be confirmed at.
  const blocks = blocksExport(facts, today);
  if (blocks.includes("openSickSpell")) return "openSickSpell";
  if (blocks.includes("unansweredHoliday")) return "unansweredHoliday";

  // Item 4: the month is valued at the rate in force *during* it, so a run of
  // months crossing a rate change reads a different row for the months either
  // side of it. A month the table begins after has no row at all, and the
  // figure is then one the user types.
  if (rateInForce(rates, "minimumWage", facts.month) === null) {
    return "noWageForMonth";
  }

  // Item 15: the recuperation day rate is confirmed the way the wage is and is
  // asked only where days are owed. `offeredAgorot` is `null` for a month the
  // table says nothing about, which is the same typed figure by another name.
  const owed = recuperationToConfirm(facts, employment, rates);
  if (owed !== null && owed.offeredAgorot === null) {
    return "noRecuperationRate";
  }

  return "ok";
}

/**
 * The figures a ticked month is confirmed at, or `null` for a month that may
 * not be confirmed this way.
 *
 * **They are the very figures the export screen offers for that month**, read
 * from the same two sources it reads — `rateInForce` for the minimum wage and
 * `recuperationToConfirm` for the day rate — so the two paths confirm a month
 * at one set of figures and not at two that agree today. The export screen
 * offers them in fields the user may type over; a tick has no field, so what it
 * writes is the offer unchanged.
 */
export function bulkConfirmFigures(
  facts: MonthFacts,
  employment: Employment,
  rates: DatedRate[],
): ConfirmedFigures | null {
  const wage = rateInForce(rates, "minimumWage", facts.month);
  if (wage === null) return null;
  const owed = recuperationToConfirm(facts, employment, rates);
  if (owed !== null && owed.offeredAgorot === null) return null;
  return {
    minimumAgorot: wage.value,
    effectiveFrom: wage.effectiveFrom,
    ...(owed === null || owed.offeredAgorot === null
      ? {}
      : { recuperationDayRateAgorot: owed.offeredAgorot }),
  };
}
