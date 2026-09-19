"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getRepository, requireWorker } from "@/lib/store";
import {
  holidayYear,
  reviewHolidayDate,
  reviewHolidayMove,
  reviewHolidayPart,
  type HolidayRefusal,
  type HolidayYear,
} from "@/lib/engine/holidayYear";
import {
  listInForce,
  reviewHolidayAmendment,
  type AmendmentRefusal,
} from "@/lib/engine/holidayAmendments";
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
 * Everything the holiday picker can change, and the only way it changes it.
 *
 * **The browser collects the gesture and the server decides what it means**
 * (`specs.md` Part 3), exactly as `month/actions.ts` and `workers/actions.ts`
 * do it. A tick arrives as a date and comes back as a span or as a refusal: how
 * much of a day the tick takes, whether the year's entitlement can carry it and
 * whether the date is already spoken for are all answered here, by the same
 * `holidayYear.ts` the suite tests and against the same allowance
 * `validateMonth` refuses a tenth holiday against.
 *
 * **Nothing is held as a draft**: each
 * gesture writes, as the calendar and the profile already do. The artboard's
 * "לשמור את הבחירה" is therefore a way back rather than a save, and its own
 * closing sentence — "אפשר לחזור ולשנות כל עוד החודש לא יוצא" — is what the
 * screen now means literally.
 */

export type HolidayActionResult =
  | { ok: true }
  | { ok: false; reason: HolidayRefusal | AmendmentRefusal | "entryUnknown" };

type HolidayState = { spans: MonthSpan[]; year: HolidayYear };

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
): Promise<HolidayState> {
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
      profile.restDay,
    ),
  };
}

/**
 * A chosen holiday a gesture acts on, with the state it is judged against —
 * or `null` when the id names no holiday span of this worker, which the
 * picker is told as `entryUnknown`.
 */
async function openChosenHoliday(
  workerId: string,
  spanId: string,
  year: number,
): Promise<{
  repository: SalaryRepository;
  profile: WorkerProfile;
  state: HolidayState;
  span: MonthSpan;
} | null> {
  const repository = await getRepository();
  const profile = await requireWorker(workerId, repository);
  const state = await stateOf(repository, profile, year);
  const span = state.spans.find((each) => each.id === spanId);
  if (span === undefined || span.kind !== "holiday") return null;
  return { repository, profile, state, span };
}

/** The candidate list a worker's year is drawn from (specs.md item 10). */
export async function setHolidaySource(
  workerId: string,
  source: HolidaySource,
): Promise<HolidayActionResult> {
  const repository = await getRepository();
  const profile = await requireWorker(workerId, repository);
  await repository.saveWorker({ ...profile, holidaySource: source });
  // Every screen reads the same workers and months, so the whole tree is
  // revalidated: a list of routes kept by hand is a list that misses one.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * A date chosen as a paid holiday (specs.md items 9 and 10).
 *
 * **`worked: null` is the state and not a placeholder for one.** The one fact a
 * month records about a holiday is whether she worked it, and it is clicked on
 * the day — so a date chosen here has had nobody answer for it yet, which is a
 * third state and not a quiet no (item 9). `false` is what the engine pays
 * nothing for, so defaulting to it would take a family who never opened the
 * month to have said she did not work it. The preview reads `null` as worked
 * and pays, and the month cannot be exported until somebody says (item 18).
 */
export async function chooseHoliday(
  workerId: string,
  date: IsoDate,
  year: number,
): Promise<HolidayActionResult> {
  const repository = await getRepository();
  const profile = await requireWorker(workerId, repository);
  const state = await stateOf(repository, profile, year);

  const reviewed = reviewHolidayDate(
    date,
    year,
    state.spans,
    state.year,
    profile.restDay,
  );
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  const span: MonthSpan = {
    id: randomUUID(),
    kind: "holiday",
    from: date,
    to: date,
    worked: null,
    ...(reviewed.fraction === 1 ? {} : { fraction: reviewed.fraction }),
  };
  await repository.saveSpan(profile.id, span);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** A chosen date unchosen. The span is deleted rather than emptied: a date
 * nobody chose is not a holiday recorded as one she did not take. */
export async function unchooseHoliday(
  workerId: string,
  spanId: string,
): Promise<HolidayActionResult> {
  const repository = await getRepository();
  const profile = await requireWorker(workerId, repository);
  await repository.deleteSpan(profile.id, spanId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * A chosen holiday moved to another date (specs.md item 10).
 *
 * **It keeps its span id**, which is what makes it a move rather than a
 * deletion and a fresh choice: the fact of whether she worked it travels with
 * it, and so does the part of a day it was taken as.
 *
 * **Once any month of the year is confirmed the move is an amendment**, and
 * arrives with the day it was agreed and a note; it is refused without them,
 * and recorded beside the span when it is made.
 */
export async function moveHoliday(
  workerId: string,
  spanId: string,
  date: IsoDate,
  year: number,
  amendment?: { agreedOn: string; note: string },
): Promise<HolidayActionResult> {
  const opened = await openChosenHoliday(workerId, spanId, year);
  if (opened === null) return { ok: false, reason: "entryUnknown" };
  const { repository, profile, state, span } = opened;

  const reviewed = reviewHolidayMove(
    date,
    year,
    state.spans,
    spanId,
    profile.restDay,
  );
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  const months = await repository.listMonths(profile.id);
  const amending = listInForce(year, months);
  if (amending) {
    // Staying where it is moves nothing, and so amends nothing.
    if (date === span.from) return { ok: true };
    if (amendment === undefined) return { ok: false, reason: "amendmentNeeded" };
    const agreed = reviewHolidayAmendment(
      { from: span.from, to: date, agreedOn: amendment.agreedOn, note: amendment.note },
      months,
    );
    if (!agreed.ok) return { ok: false, reason: agreed.reason };
  }

  await repository.saveSpan(profile.id, { ...span, from: date, to: date });
  if (amending && amendment !== undefined) {
    await repository.saveHolidayAmendment(profile.id, {
      id: randomUUID(),
      agreedOn: amendment.agreedOn as IsoDate,
      from: span.from,
      to: date,
      note: amendment.note.trim(),
    });
  }
  revalidatePath("/", "layout");
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
  const opened = await openChosenHoliday(workerId, spanId, year);
  if (opened === null) return { ok: false, reason: "entryUnknown" };
  const { repository, profile, state, span } = opened;
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
  revalidatePath("/", "layout");
  return { ok: true };
}
