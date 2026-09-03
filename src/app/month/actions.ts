"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/dev/store";
import type { MonthSpan } from "@/lib/engine/types";
import { applyMark, endOf, type MarkIntent, type SkippedDay } from "@/lib/spans";
import { compareIsoDate, orderDates } from "@/lib/dates";
import type { DaySpan, IsoDate } from "@/lib/types";

/**
 * The three things the month screen can change, and the only way it changes
 * anything.
 *
 * **The browser collects the gesture and the server decides what it means**
 * (`specs.md` Part 3). The calendar hands up a range and a kind; which days
 * inside that range may actually take the mark is an entitlement question — a
 * vacation span skips its rest days and a sick span keeps them (items 5 and 8) —
 * and it is answered here, against the worker's stored rest day, by the same
 * `spans.ts` the suite tests. A client that decided it for itself would be a
 * second rule to keep in step with the first, and the one the user could reach
 * by hand.
 *
 * Each action revalidates the route, so the page re-renders from the store and
 * the preview beside the calendar is the engine's answer to what was just saved
 * rather than a figure the browser guessed while waiting.
 */

/** Asked to change a worker the store does not have. Actions are reachable by a
 * crafted request, so the id is checked rather than assumed — stage 3 adds the
 * household check beside this one. */
async function profileOf(workerId: string) {
  const profile = await getRepository().getWorker(workerId);
  if (profile === null) throw new Error(`No worker with id ${workerId}`);
  return profile;
}

export async function markRange(
  workerId: string,
  intent: MarkIntent,
): Promise<{ skipped: SkippedDay[] }> {
  const repository = getRepository();
  const profile = await profileOf(workerId);
  const existing = await repository.listSpans(workerId);

  // Her own rest day, read from the profile because this is a new mark and not
  // the recalculation of a month already confirmed — a month's stored terms are
  // what its *figures* are read against (Part 3), and those are the engine's.
  const { spans, skipped } = applyMark(intent, profile.restDay, existing);
  for (const span of spans) {
    await repository.saveSpan(workerId, span satisfies MonthSpan);
  }

  revalidatePath("/month");
  // The days that could not take the mark and why, shown to the user rather
  // than absorbed silently (items 5, 8).
  return { skipped };
}

/** Whether a span has any day inside the range, the open case included. */
function touches(span: DaySpan, from: IsoDate, to: IsoDate): boolean {
  const ordered = orderDates(span.from, endOf(span, to));
  return (
    compareIsoDate(ordered.from, to) <= 0 && compareIsoDate(ordered.to, from) >= 0
  );
}

/**
 * Clearing takes a range the way marking does, and **a span is one thing**: a
 * range that touches a span clears the whole of it rather than punching a hole,
 * which for a spell of sickness would change what it pays by moving the day its
 * tiers are counted from (item 8).
 *
 * A holiday is not cleared by it. The date belongs to the year and not to the
 * month, and removing one is the yearly picker's (items 9, 10) — a sweep that
 * happened to cross one would otherwise delete a day the user never chose to
 * touch.
 */
export async function clearRange(
  workerId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<void> {
  const repository = getRepository();
  await profileOf(workerId);
  const ordered = orderDates(from, to);

  for (const span of await repository.listSpans(workerId)) {
    if (span.kind === "holiday") continue;
    if (touches(span, ordered.from, ordered.to)) {
      await repository.deleteSpan(workerId, span.id);
    }
  }

  revalidatePath("/month");
}

/**
 * The one fact a month records about a holiday: whether she worked it (item 9).
 *
 * The span is saved again with the answer changed, which is all a holiday's
 * record is — the date is not touched, because it came from the year's chosen
 * list and moving it is the yearly picker's job (item 10).
 */
export async function setHolidayWorked(
  workerId: string,
  spanId: string,
  worked: boolean,
): Promise<void> {
  const repository = getRepository();
  await profileOf(workerId);

  const span = (await repository.listSpans(workerId)).find(
    (candidate) => candidate.id === spanId,
  );
  // Not an error: a stale page can ask about a holiday the year no longer has,
  // and the answer to "did she work a day that is not a holiday" is nothing.
  if (span === undefined || span.kind !== "holiday") return;

  await repository.saveSpan(workerId, { ...span, worked });
  revalidatePath("/month");
}
