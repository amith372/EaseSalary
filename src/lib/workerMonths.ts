import { compareMonth } from "@/lib/dates";
import { markedHandledOf } from "@/lib/engine/alerts";
import type { ActionEntry } from "@/lib/engine/actionList";
import { bulkConfirmFigures, bulkConfirmVerdict } from "@/lib/engine/bulkConfirm";
import {
  monthsBeforeToday,
  monthsFollowingProfile,
  monthsReachedBySalaryChange,
} from "@/lib/engine/profile";
import { openMonthRecord, recordOf, wageToCarry } from "@/lib/engine/repository";
import type { SalaryRepository, WorkerProfile } from "@/lib/engine/repository";
import type { MonthFacts } from "@/lib/engine/types";
import { confirmMonthRecord } from "@/lib/monthConfirmation";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * A worker's months as the store holds them: opening one, and carrying a change
 * to their profile into the ones that follow it (specs.md items 6 and 21,
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
 * The months a worker entered after the fact is given, each created and
 * confirmed (specs.md item 6).
 *
 * **A family taking the application on mid-year must not have to mark every
 * month back to the day they started**, so the months from their first to the
 * one before today's are created and confirmed at the figures the rates table
 * already holds for each — the same figures, read by the same two functions,
 * that the tick on the worker's list confirms a filed month at. They are
 * ordinary months afterwards: a correction to one moves every later month's
 * balances, because the replay is the only thing that produces them (item 13).
 *
 * **A month that cannot be confirmed is not created either.** The verdict is
 * asked of the record *before* it is saved — `openMonthRecord` builds one
 * without writing it — because a draft whose month has ended is a blockage
 * (item 27), and a family would otherwise be handed a list of warnings in
 * exchange for a convenience. In practice this is a month the rates table
 * begins after.
 *
 * **Each is marked as handled for "not yet exported"**, which is the existing
 * answer to a month nobody will ever produce a file from: the same record
 * `/alerts` writes when the family presses it, and the same argument
 * `dismissalOf` already makes for a national-insurance quarter paid before the
 * application existed. Nothing is stamped as exported, because nothing was.
 *
 * It returns the months it created, so the caller can say how many.
 */
export async function createMonthsBeforeToday(
  repository: SalaryRepository,
  profile: WorkerProfile,
  when: { today: IsoDate; now: string },
): Promise<YearMonth[]> {
  const rates = await repository.listRates();
  const created: YearMonth[] = [];

  for (const month of monthsBeforeToday(profile.firstMonth, when.today)) {
    // Read inside the loop: a month with no row of its own carries the wage of
    // the nearest month before it, and the months created a moment ago are
    // exactly those (`wageToCarry`).
    const wage = wageToCarry(
      await repository.listMonths(profile.id),
      month,
      profile,
      rates,
    );
    if (wage === null) continue;

    const facts: MonthFacts = { ...openMonthRecord(profile, month, wage), spans: [] };
    if (bulkConfirmVerdict(facts, profile, rates, when.today) !== "ok") continue;
    const figures = bulkConfirmFigures(facts, profile, rates);
    if (figures === null) continue;

    await repository.saveMonth(profile.id, recordOf(facts));
    await confirmMonthRecord(repository, profile, facts, figures, when);
    await repository.deferWarning(
      markedHandledOf(profile.id, monthNotExportedOf(month)),
    );
    created.push(month);
  }

  return created;
}

/**
 * The warning a created month would raise, written here exactly as the action
 * list writes it.
 *
 * **A fingerprint is the entry's JSON** (`fingerprintOf`), so the field order
 * is part of it and a second spelling would mark as handled a warning nobody
 * raises. `workerMonths.test.ts` holds this against what `actionList` itself
 * produces, which is the only thing that keeps the two spellings one.
 */
function monthNotExportedOf(month: YearMonth): ActionEntry {
  return { list: "warning", key: "monthNotExported", month };
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
