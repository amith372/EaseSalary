import { compareMonth } from "@/lib/dates";
import { openMonthRecord, wageToCarry } from "@/lib/engine/repository";
import type { SalaryRepository, WorkerProfile } from "@/lib/engine/repository";
import type { YearMonth } from "@/lib/types";

/**
 * Opening a month the store has no record of (specs.md items 6 and 21, Part 3).
 *
 * **Here and not in an action file**, because both the month's actions and the
 * pre-export confirmation open months, and an export from a `"use server"`
 * module is itself a callable action.
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
