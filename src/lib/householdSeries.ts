import { cache } from "react";
import { sameMonth } from "@/lib/dates";
import type { WorkerProfile } from "@/lib/engine/repository";
import { calculateSeries } from "@/lib/engine/series";
import type { MonthInSeries } from "@/lib/engine/series";
import { readToday } from "@/lib/requestToday";
import { getRepository } from "@/lib/store";
import type { YearMonth } from "@/lib/types";

/** One worker and her months as the replay came to them. */
export interface WorkerInSeries {
  profile: WorkerProfile;
  months: MonthInSeries[];
}

/**
 * The household replayed once for the request, and read by everything that
 * shows a figure.
 *
 * **Every screen was assembling this walk for itself** — the store, the months,
 * the rates and today, then `calculateSeries` — in twelve places, and a page
 * drawn inside the bar replayed the household twice over: once for itself and
 * once for the bell. The assembly is the part that can quietly differ, and a
 * screen reading a different table or a different `today` from the one beside
 * it is a disagreement no test of either screen would catch. So it is made in
 * one place and memoised for the request (`specs.md` Part 3: one engine, one
 * result, shown in as many places as the application likes).
 *
 * **The whole household and not the worker asked for**, because the bar draws
 * the bell on every page from every worker's months, so a page that replayed
 * one worker still paid for both. An account holds two workers at most
 * (item 11), which is what makes that the cheap option rather than the
 * thorough one.
 *
 * `cache()` is React's per-request memo and nothing survives the response —
 * there is no cache to invalidate when a mark is made, which is the same reason
 * balances are replayed rather than stored (item 13).
 */
export const householdSeries = cache(async (): Promise<WorkerInSeries[]> => {
  const repository = await getRepository();
  // One rates read for the household and not one per worker: the table is the
  // household's (item 4), so a second read could only return the same rows.
  const [workers, rates, today] = await Promise.all([
    repository.listWorkers(),
    repository.listRates(),
    readToday(),
  ]);
  return Promise.all(
    workers.map(async (profile) => ({
      profile,
      months: calculateSeries(
        await repository.listMonths(profile.id),
        profile,
        today,
        rates,
      ),
    })),
  );
});

/** One worker of the household, or `null` where the id names nobody in it — an
 * id in the address bar is an ordinary thing to mistype, and the caller decides
 * whether that is a 404 or a refusal. */
export async function workerInSeries(
  workerId: string,
): Promise<WorkerInSeries | null> {
  return (
    (await householdSeries()).find((worker) => worker.profile.id === workerId) ??
    null
  );
}

/**
 * One month of one worker's replay.
 *
 * A month nobody opened is in the walk like any other (`specs.md` item 6), so
 * `null` here means a month outside it altogether — before her first month, or
 * after the current one — and not a month with nothing recorded in it.
 */
export async function monthInSeries(
  workerId: string,
  month: YearMonth,
): Promise<MonthInSeries | null> {
  const worker = await workerInSeries(workerId);
  return (
    worker?.months.find((entry) => sameMonth(entry.facts.month, month)) ?? null
  );
}
