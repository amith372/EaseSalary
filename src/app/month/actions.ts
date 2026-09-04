"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/dev/store";
import { recordOf } from "@/lib/engine/repository";
import type { MonthRecord } from "@/lib/engine/repository";
import type { MonthSpan } from "@/lib/engine/types";
import { reviewUserLine, withoutOneOffUserLine } from "@/lib/engine/userLines";
import type { UserLineDraft, UserLineRefusal } from "@/lib/engine/userLines";
import { parseShekels } from "@/lib/money";
import { applyMark, endOf, type MarkIntent, type SkippedDay } from "@/lib/spans";
import { compareIsoDate, orderDates } from "@/lib/dates";
import type { DaySpan, IsoDate, YearMonth } from "@/lib/types";

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

/**
 * The additional-payments group's three actions (specs.md items 5, 17, 20).
 *
 * **Every one of them decides on the server**, for the reason the marking
 * actions already give: an action is reachable by a crafted request, and the
 * rule the browser applies while the user types has to be the same rule and not
 * a second one that agrees today. So the amount arrives as the user typed it
 * and `parseShekels` reads it here; the direction and the placement are checked
 * against their unions here; and the id a new line gets is minted here, because
 * an id is the store's to give and never the caller's (`repository.ts`).
 */

/** Why an action was refused, in the words the screen shows. `noMonth` is the
 * one the user cannot cause by typing: it is a page held open over a month the
 * store has no record of, which until the future-month step exists is any month
 * outside the seeded range. */
export type MonthActionRefusal = UserLineRefusal | "noMonth";

export type MonthActionResult =
  | { ok: true }
  | { ok: false; reason: MonthActionRefusal };

/**
 * Read the month, change it, save it back.
 *
 * The spans are dropped on the way in and never on the way out: a month's spans
 * belong to the worker and are assembled by the repository (`MonthRecord` is
 * `MonthFacts` without them), so writing them back here would be writing a
 * second copy of a spell that must stay one thing.
 */
async function changeMonth(
  workerId: string,
  month: YearMonth,
  change: (record: MonthRecord) => MonthRecord,
): Promise<MonthActionResult> {
  const repository = getRepository();
  await profileOf(workerId);

  const facts = await repository.getMonth(workerId, month);
  if (facts === null) return { ok: false, reason: "noMonth" };

  await repository.saveMonth(workerId, change(recordOf(facts)));

  revalidatePath("/month");
  return { ok: true };
}

/**
 * The income tax the user is withholding this month (specs.md item 17).
 *
 * It is never calculated and never will be: this action is the whole of how the
 * figure gets in. **Zero is an ordinary answer here and not a refusal**, which
 * is where this differs from a line the user adds — zero is what every month
 * holds until she says otherwise, so setting it back is how a tax entered by
 * mistake is taken off. It is stored positive and signed by the engine, so a
 * tax can never be entered in a direction that pays her.
 */
export async function setIncomeTax(
  workerId: string,
  month: YearMonth,
  amount: string,
): Promise<MonthActionResult> {
  const agorot = parseShekels(amount);
  if (agorot === null) return { ok: false, reason: "amount" };

  return changeMonth(workerId, month, (record) => ({
    ...record,
    incomeTaxAgorot: agorot,
  }));
}

/** A line of the user's own, added to this month alone (specs.md item 20). The
 * standing ones are terms of the employment and are set on the profile, which
 * is stage 3's screen. */
export async function addUserLine(
  workerId: string,
  month: YearMonth,
  draft: UserLineDraft,
): Promise<MonthActionResult> {
  const reviewed = reviewUserLine(draft, randomUUID());
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  return changeMonth(workerId, month, (record) => ({
    ...record,
    userLines: [...record.userLines, reviewed.line],
  }));
}

/**
 * A line removed, **and any amount the user typed over it removed with it**
 * (specs.md item 20). An override is addressed by the line's own key, so one
 * left behind is an amount waiting to reattach itself to a line that never
 * asked for it — and since it would then be the *stored* figure, the line it
 * landed on would show an amount nobody entered for it, marked as manual.
 */
export async function removeUserLine(
  workerId: string,
  month: YearMonth,
  lineId: string,
): Promise<MonthActionResult> {
  return changeMonth(workerId, month, (record) =>
    withoutOneOffUserLine(record, lineId),
  );
}
