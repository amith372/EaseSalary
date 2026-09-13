import { eachDate, isRestDay, orderDates } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import type { ClosedSpan } from "@/lib/engine/types";
import type { IsoDate } from "@/lib/types";

/**
 * Which dates actually count as holidays, asked once (specs.md items 9 and 10).
 *
 * **It is its own module because three of the engine's parts need the same
 * answer and one of them cannot import the others.** `leave.ts` already imports
 * `sick.ts` for the spells, so the rule cannot live in `leave.ts` without a
 * cycle; and restating it in each would be three rules that agree today. The
 * money, the day counts and the sick balance all turn on it, so a disagreement
 * between them is a month that pays for a day it also counted as missed.
 *
 * **A holiday on the weekly rest day is not a holiday** (item 9, settled with
 * the user on 2026-09-12). The day is her weekly rest day and is paid as one
 * whether she worked it or not, so it earns nothing extra as a holiday and
 * spends nothing from the yearly entitlement — another date may be chosen in
 * its place. It is still *drawn* as a holiday on the calendar, because the
 * clash is a fact about the year worth seeing and not a mistake to hide, and
 * that is a question for the screen rather than for the engine.
 */

/** Every date a holiday span covers, the rest-day ones included — which is what
 * the calendar draws, and the one caller that wants them. */
export function holidayDatesDrawn(spans: ClosedSpan[]): Set<IsoDate> {
  const dates = new Set<IsoDate>();
  for (const span of spans) {
    if (span.kind !== "holiday") continue;
    const { from, to } = orderDates(span.from, span.to);
    for (const date of eachDate(from, to)) dates.add(date);
  }
  return dates;
}

/**
 * The dates that count as holidays: every drawn one that is not her weekly rest
 * day.
 *
 * This is the set the money, the entitlement and the sick balance all read.
 */
export function holidayDatesCounted(
  spans: ClosedSpan[],
  restDay: RestDay,
): Set<IsoDate> {
  const counted = new Set<IsoDate>();
  for (const date of holidayDatesDrawn(spans)) {
    if (!isRestDay(date, restDay)) counted.add(date);
  }
  return counted;
}
