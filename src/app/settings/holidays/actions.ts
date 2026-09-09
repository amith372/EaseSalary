"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/dev/store";
import {
  holidayYear,
  reviewHolidayDate,
  reviewHolidayMove,
  reviewHolidayPart,
  type HolidayRefusal,
  type HolidayYear,
} from "@/lib/engine/holidayYear";
import { holidayAllowanceFor } from "@/lib/engine/leave";
import type { SalaryRepository, WorkerProfile } from "@/lib/engine/repository";
import type { MonthSpan } from "@/lib/engine/types";
import { holidayListFor, type HolidaySource } from "@/lib/holidayLists";
import { holidaySourceOf } from "@/lib/holidaySources";
import type { IsoDate } from "@/lib/types";

/**
 * **Only asynchronous functions may be exported from here**, which is what
 * `holidaySourceOf` lives in `src/lib/holidaySources.ts` for: a `"use server"`
 * module's every export is an address the browser can call, so a plain helper
 * beside them is a build error rather than a style question.
 *
 * Everything the holiday picker can change, and the only way it changes it
 * (`build_plan.md` stage 5, the holiday picker).
 *
 * **The browser collects the gesture and the server decides what it means**
 * (`specs.md` Part 3), exactly as `month/actions.ts` and `workers/actions.ts`
 * do it. A tick arrives as a date and comes back as a span or as a refusal: how
 * much of a day the tick takes, whether the year's entitlement can carry it and
 * whether the date is already spoken for are all answered here, by the same
 * `holidayYear.ts` the suite tests and against the same allowance
 * `validateMonth` refuses a tenth holiday against.
 *
 * **Nothing is held as a draft**, settled with the user on 2026-09-09: each
 * gesture writes, as the calendar and the profile already do. The artboard's
 * "לשמור את הבחירה" is therefore a way back rather than a save, and its own
 * closing sentence — "אפשר לחזור ולשנות כל עוד החודש לא יוצא" — is what the
 * screen now means literally.
 */

export type HolidayActionResult =
  | { ok: true }
  | { ok: false; reason: HolidayRefusal | "entryUnknown" };

/**
 * Every route a chosen holiday reaches.
 *
 * A date chosen here is a span on the worker, so it is drawn on the month's
 * calendar and counted in the month's figures the moment it is written — which
 * is the whole point of choosing the year in advance (item 9). The picker
 * itself is revalidated too, because the quota above the list is what the
 * gesture changed.
 */
function revalidateHolidays(): void {
  revalidatePath("/settings/holidays");
  revalidatePath("/workers", "layout");
  revalidatePath("/month");
}

/** Asked to change a worker the store does not have. Actions are reachable by a
 * crafted request, so the id is checked rather than assumed — stage 3 adds the
 * household check beside this one. */
async function profileOf(
  repository: SalaryRepository,
  workerId: string,
): Promise<WorkerProfile> {
  const profile = await repository.getWorker(workerId);
  if (profile === null) throw new Error(`No worker with id ${workerId}`);
  return profile;
}

/**
 * The state a gesture is judged against, read fresh rather than trusted from
 * the screen that sent it.
 *
 * The count, the entitlement and what is left are the store's own answer at the
 * moment of the write: a page held open in a second tab is exactly how a tenth
 * holiday would otherwise arrive against a quota the browser believed had room.
 */
async function stateOf(
  repository: SalaryRepository,
  profile: WorkerProfile,
  year: number,
): Promise<{ spans: MonthSpan[]; year: HolidayYear }> {
  const spans = await repository.listSpans(profile.id);
  const stored = holidayListFor(
    await repository.listHolidayLists(),
    holidaySourceOf(profile),
    year,
  );
  return {
    spans,
    year: holidayYear(
      stored?.holidays ?? [],
      spans,
      holidayAllowanceFor(profile.employedSince, year),
      year,
    ),
  };
}

/** The candidate list a worker's year is drawn from (specs.md item 10). */
export async function setHolidaySource(
  workerId: string,
  source: HolidaySource,
): Promise<HolidayActionResult> {
  const repository = await getRepository();
  const profile = await profileOf(repository, workerId);
  await repository.saveWorker({ ...profile, holidaySource: source });
  revalidateHolidays();
  return { ok: true };
}

/**
 * A date chosen as a paid holiday (specs.md items 9 and 10).
 *
 * `worked: false` is not a default and not an assumption about the month: it is
 * what an *unanswered* holiday looks like, and the pre-export questions are
 * what ask (item 18). The one fact a month records about a holiday is whether
 * she worked it, and it is clicked on the day.
 */
export async function chooseHoliday(
  workerId: string,
  date: IsoDate,
  year: number,
): Promise<HolidayActionResult> {
  const repository = await getRepository();
  const profile = await profileOf(repository, workerId);
  const state = await stateOf(repository, profile, year);

  const reviewed = reviewHolidayDate(date, year, state.spans, state.year);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  const span: MonthSpan = {
    id: randomUUID(),
    kind: "holiday",
    from: date,
    to: date,
    worked: false,
    ...(reviewed.fraction === 1 ? {} : { fraction: reviewed.fraction }),
  };
  await repository.saveSpan(profile.id, span);
  revalidateHolidays();
  return { ok: true };
}

/** A chosen date unchosen. The span is deleted rather than emptied: a date
 * nobody chose is not a holiday recorded as one she did not take. */
export async function unchooseHoliday(
  workerId: string,
  spanId: string,
): Promise<HolidayActionResult> {
  const repository = await getRepository();
  const profile = await profileOf(repository, workerId);
  await repository.deleteSpan(profile.id, spanId);
  revalidateHolidays();
  return { ok: true };
}

/**
 * A chosen holiday moved to another date (specs.md item 10).
 *
 * **It keeps its span id**, which is what makes it a move rather than a
 * deletion and a fresh choice: the fact of whether she worked it travels with
 * it, and so does the part of a day it was taken as.
 */
export async function moveHoliday(
  workerId: string,
  spanId: string,
  date: IsoDate,
  year: number,
): Promise<HolidayActionResult> {
  const repository = await getRepository();
  const profile = await profileOf(repository, workerId);
  const state = await stateOf(repository, profile, year);

  const span = state.spans.find((each) => each.id === spanId);
  if (span === undefined || span.kind !== "holiday") {
    return { ok: false, reason: "entryUnknown" };
  }

  const reviewed = reviewHolidayMove(date, year, state.spans, spanId);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  await repository.saveSpan(profile.id, { ...span, from: date, to: date });
  revalidateHolidays();
  return { ok: true };
}

/**
 * How much of the day a chosen holiday is (specs.md item 10): a whole day or a
 * half, paid in that proportion and drawn from the entitlement in the same one.
 *
 * Only the increase is judged against what the year has left, and
 * `reviewHolidayPart` is where that is said once.
 */
export async function setHolidayPart(
  workerId: string,
  spanId: string,
  fraction: number,
  year: number,
): Promise<HolidayActionResult> {
  const repository = await getRepository();
  const profile = await profileOf(repository, workerId);
  const state = await stateOf(repository, profile, year);

  const span = state.spans.find((each) => each.id === spanId);
  if (span === undefined || span.kind !== "holiday") {
    return { ok: false, reason: "entryUnknown" };
  }
  const chosen = state.year.rows.find(
    (row) => row.chosen?.spanId === spanId,
  )?.chosen;
  if (chosen === undefined || chosen === null) {
    return { ok: false, reason: "entryUnknown" };
  }

  const reviewed = reviewHolidayPart(fraction, chosen, state.year);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  const { fraction: replaced, ...rest } = span;
  void replaced;
  await repository.saveSpan(profile.id, {
    ...rest,
    ...(fraction === 1 ? {} : { fraction }),
  });
  revalidateHolidays();
  return { ok: true };
}
