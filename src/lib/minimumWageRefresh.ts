import type { DatedRate } from "@/lib/datedRates";
import type { SalaryRepository } from "@/lib/engine/repository";
import type { ScrapeFailureKind } from "@/lib/scrape/failure";
import { MINIMUM_WAGE_SOURCE_URL, fetchMinimumWage } from "@/lib/scrape/minimumWage";

/** How long a fetched minimum wage is trusted before the home screen reads the
 * page again. A day, because the figure changes about once a year and the
 * source updates within days of a change. */
const A_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the minimum wage is due to be read again: never read, or last read a
 * day or more before `now`.
 */
export function minimumWageIsStale(lastFetched: string | null, now: Date): boolean {
  if (lastFetched === null) return true;
  return now.getTime() - Date.parse(lastFetched) >= A_DAY_MS;
}

/**
 * Reads the minimum wage from its source and saves it (specs.md item 4, Part 3).
 *
 * **A fetched figure is written into the table and a failed fetch is not.** The
 * table is seeded and a fetch updates it, so the next reader starts from what
 * this one learned; a failure leaves the table standing, and the pre-export
 * screen then has the user type the figure (item 4's own degradation).
 *
 * The rates come back as they now stand, so the caller values the month with
 * the figure it just read.
 */
export async function refreshMinimumWage(
  repository: SalaryRepository,
  fetchImpl: typeof fetch = fetch,
): Promise<{ rates: DatedRate[]; failure: ScrapeFailureKind | null }> {
  const stored = await repository.listRates();
  const fetched = await fetchMinimumWage(stored, fetchImpl);
  if (!fetched.rate.ok) {
    return { rates: stored, failure: fetched.rate.failure.kind };
  }
  await repository.saveRate(fetched.rate.value);
  return { rates: await repository.listRates(), failure: null };
}

/** The home screen's daily check: the refresh, only when the last one is a day
 * old. */
export async function refreshMinimumWageIfStale(
  repository: SalaryRepository,
  now: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const last = await repository.lastFetched("minimumWage", MINIMUM_WAGE_SOURCE_URL);
  if (!minimumWageIsStale(last, now)) return;
  await refreshMinimumWage(repository, fetchImpl);
}
