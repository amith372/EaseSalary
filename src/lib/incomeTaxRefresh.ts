import type { DatedRate } from "@/lib/datedRates";
import type { SalaryRepository } from "@/lib/engine/repository";
import {
  CREDIT_POINT_SOURCE_URL,
  fetchCreditPointValue,
  fetchTaxBrackets,
} from "@/lib/scrape/incomeTax";
import type { TaxYearBrackets } from "@/lib/taxBrackets";

/**
 * The two figures the income tax is worked out from, read from their sources
 * and saved (specs.md Part 1 item 17: "the brackets and the value of a credit
 * point are fetched per year and cached like the minimum wage").
 *
 * **Both are yearly figures, so both are read on a day's staleness** — the same
 * interval `minimumWageRefresh.ts` uses and for the same reason: the statute
 * restates them about once a year and the source publishes the change within
 * days of it.
 *
 * **Nothing here is load-bearing.** A fetched figure is written and a failed
 * one is not, so a broken source leaves the seeded tables standing and the
 * month is taxed by what the application already knew. Where a year has no
 * table at all the month's line stays at zero and `taxBracketsMissing` says so
 * (item 17), which is why no failure is returned for a screen to draw — unlike
 * the minimum wage, there is nothing here for the user to type instead.
 */

/** How long a fetched table is trusted before its page is read again. */
const A_DAY_MS = 24 * 60 * 60 * 1000;

function isStale(lastFetched: string | null, now: Date): boolean {
  if (lastFetched === null) return true;
  return now.getTime() - Date.parse(lastFetched) >= A_DAY_MS;
}

/**
 * The income tax's tables as they now stand, after reading whichever of the
 * two pages is due.
 *
 * **The two are due independently**, because they are two pages: a credit-point
 * page that has been rewritten must not stop the brackets being read, and the
 * stamp each carries is its own. The rates come back as well as the brackets,
 * so a caller that is about to value a month does it against the credit point
 * this call may just have learned rather than against the row it read first.
 */
export async function refreshIncomeTaxIfStale(
  repository: SalaryRepository,
  now: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<{ rates: DatedRate[]; taxBrackets: TaxYearBrackets[] }> {
  const [lastBrackets, lastPoint] = await Promise.all([
    repository.lastFetchedBrackets(),
    repository.lastFetched("creditPointValue", CREDIT_POINT_SOURCE_URL),
  ]);

  if (isStale(lastBrackets, now)) {
    const fetched = await fetchTaxBrackets(fetchImpl);
    if (fetched.brackets.ok) {
      await repository.saveTaxBrackets(fetched.brackets.value);
    }
  }

  if (isStale(lastPoint, now)) {
    // The stored rows are read again rather than reused from above: the
    // plausibility check is "a point's value has never fallen", and it is the
    // table as it stands that the new figure has to clear.
    const fetched = await fetchCreditPointValue(
      await repository.listRates(),
      fetchImpl,
    );
    if (fetched.rate.ok) await repository.saveRate(fetched.rate.value);
  }

  const [rates, taxBrackets] = await Promise.all([
    repository.listRates(),
    repository.listTaxBrackets(),
  ]);
  return { rates, taxBrackets };
}
