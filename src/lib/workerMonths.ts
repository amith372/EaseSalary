import { compareMonth } from "@/lib/dates";
import {
  monthsFollowingProfile,
  monthsReachedBySalaryChange,
} from "@/lib/engine/profile";
import { openMonthRecord, wageToCarry } from "@/lib/engine/repository";
import type { SalaryRepository, WorkerProfile } from "@/lib/engine/repository";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * A worker's months as the store holds them: opening one, and carrying a change
 * to her profile into the ones that follow it (specs.md items 6 and 21,
 * Part 3, Part 5).
 *
 * **Here and not in an action file**, because the callers are several — the
 * month's own actions, the profile's, and the pre-export confirmation, which is
 * an action file of its own — and each of them had assembled the same two steps
 * for itself: read every month the worker has, then write back the ones the
 * change reached. Two such loops sat in `workers/actions.ts` alone, differing
 * only in which engine function they called, and a rule added to one of them
 * would have been a rule missing from the other.
 *
 * **It decides nothing.** Which months a change reaches is the engine's
 * (`monthsFollowingProfile`, `monthsReachedBySalaryChange`, and the
 * `followsProfile` rule both read), so this module is the store side of it and
 * can hold no rule of its own to disagree with.
 */

/** A month the worker's first month comes after (specs.md item 6). */
export function isBeforeFirstMonth(
  profile: Pick<WorkerProfile, "firstMonth">,
  month: YearMonth,
): boolean {
  return compareMonth(month, profile.firstMonth) < 0;
}

/**
 * The month opened if the store has no record of it.
 *
 * **Nothing opens a month by being looked at** — a render that writes is a
 * store that grows every time somebody steps through the months. A month is
 * opened by the first fact recorded in it: a mark on its calendar, a figure on
 * `/payments`, or its confirmation before export.
 *
 * It returns whether a month is now there. `false` is a month before the
 * worker's first month, which cannot be opened (item 6), or a month
 * `wageToCarry` cannot answer. The record it writes is the one the replay
 * values an unopened month with (`openMonthRecord`), at the wage the same
 * stored table gives, so opening a month changes nothing about it (Part 3).
 */
export async function openMonthIfMissing(
  repository: SalaryRepository,
  profile: WorkerProfile,
  month: YearMonth,
): Promise<boolean> {
  if (isBeforeFirstMonth(profile, month)) return false;
  if ((await repository.getMonth(profile.id, month)) !== null) return true;

  const wage = wageToCarry(
    await repository.listMonths(profile.id),
    month,
    profile,
    await repository.listRates(),
  );
  if (wage === null) return false;

  await repository.saveMonth(profile.id, openMonthRecord(profile, month, wage));
  return true;
}

/**
 * Carry a change to the profile's terms into the months that follow it
 * (Part 5).
 *
 * `today` is passed in because the rest day is the one term that stops at the
 * current month (item 5), and nothing below the action reads a clock.
 */
export async function saveMonthsFollowingProfile(
  repository: SalaryRepository,
  profile: WorkerProfile,
  today: IsoDate,
): Promise<void> {
  const months = await repository.listMonths(profile.id);
  await repository.saveMonths(
    profile.id,
    monthsFollowingProfile(months, profile, today),
  );
}

/** Carry a change of salary into the months it holds from (item 3). */
export async function saveMonthsReachedBySalaryChange(
  repository: SalaryRepository,
  profile: WorkerProfile,
  from: YearMonth,
): Promise<void> {
  const months = await repository.listMonths(profile.id);
  await repository.saveMonths(
    profile.id,
    monthsReachedBySalaryChange(months, profile, from),
  );
}
