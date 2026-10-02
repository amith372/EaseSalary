import { describe, expect, it } from "vitest";
import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { createInMemoryRepository } from "@/lib/engine/repository";
import {
  minimumWageIsStale,
  refreshMinimumWageIfStale,
} from "@/lib/minimumWageRefresh";
import { he } from "@/lib/i18n/he";
import { refreshMinimumWage } from "@/lib/minimumWageRefresh";
import {
  challengePage,
  emptyBody,
  sourcePage,
} from "@/lib/scrape/minimum-wage-page.fixture";
import { MINIMUM_WAGE_SOURCE_URL } from "@/lib/scrape/minimumWage";

/**
 * The home screen's daily read of the minimum wage (specs.md item 4).
 *
 * The expected figure is the saved page's own: ₪6,443.85 from 1.4.2026, which
 * `שכר_חודשי_להאנה2026.xlsx` -> `חודש  4.26` -> D6 also holds. The table starts
 * without it — only the 2025 row — so finding it proves the page was read and
 * saved. What these would catch: a read on every visit, a read that never
 * happens again, a failed read that stops the next one, and a figure the user
 * typed being taken for a read of the page.
 */

const DAY = 24 * 60 * 60 * 1000;
const APRIL_2026 = { year: 2026, month: 4 };

function beforeTheRise() {
  return SEEDED_RATES.filter(
    (rate) => !(rate.key === "minimumWage" && rate.effectiveFrom >= "2026-04-01"),
  );
}

function countedFetch(body: () => string, status = 200) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    return new Response(body(), { status });
  }) as typeof fetch;
  return { calls, impl };
}

describe("whether the minimum wage is due to be read", () => {
  const now = new Date("2026-09-17T12:00:00Z");
  it("is due when it was never read", () => {
    expect(minimumWageIsStale(null, now)).toBe(true);
  });
  it("is not due within a day", () => {
    expect(minimumWageIsStale("2026-09-16T12:00:01Z", now)).toBe(false);
  });
  it("is due at a day", () => {
    expect(minimumWageIsStale("2026-09-16T12:00:00Z", now)).toBe(true);
  });
});

describe("the daily read", () => {
  it("reads the page once, saves the figure with its date, and not again that day", async () => {
    const repository = createInMemoryRepository({ rates: beforeTheRise() });
    expect(rateInForce(await repository.listRates(), "minimumWage", APRIL_2026)?.value).toBe(624765);

    const page = countedFetch(sourcePage);
    await refreshMinimumWageIfStale(repository, new Date(), page.impl);
    const april = rateInForce(await repository.listRates(), "minimumWage", APRIL_2026);
    expect(april).toMatchObject({ value: 644385, effectiveFrom: "2026-04-01" });
    // March is still valued at the rate in force during it.
    expect(
      rateInForce(await repository.listRates(), "minimumWage", { year: 2026, month: 3 })?.value,
    ).toBe(624765);

    await refreshMinimumWageIfStale(repository, new Date(), page.impl);
    expect(page.calls).toEqual([MINIMUM_WAGE_SOURCE_URL]);

    await refreshMinimumWageIfStale(repository, new Date(Date.now() + DAY), page.impl);
    expect(page.calls).toHaveLength(2);
  });

  it("saves nothing when the read fails, and tries again on the next visit", async () => {
    const repository = createInMemoryRepository({ rates: beforeTheRise() });
    const broken = countedFetch(emptyBody);
    await refreshMinimumWageIfStale(repository, new Date(), broken.impl);
    expect(rateInForce(await repository.listRates(), "minimumWage", APRIL_2026)?.value).toBe(624765);

    await refreshMinimumWageIfStale(repository, new Date(), broken.impl);
    expect(broken.calls).toHaveLength(2);
  });

  it("does not take a figure the user confirmed for a read of the page", async () => {
    const repository = createInMemoryRepository({ rates: beforeTheRise() });
    await repository.saveRate({
      key: "minimumWage",
      value: 644385,
      effectiveFrom: "2026-04-01",
      source: "userConfirmed",
    });
    const page = countedFetch(sourcePage);
    await refreshMinimumWageIfStale(repository, new Date(), page.impl);
    expect(page.calls).toHaveLength(1);
  });
});


/**
 * **The source behind a bot challenge, read end to end** (found 2026-10-01,
 * when kolzchut.org.il began answering this application with Cloudflare's
 * "Just a moment…" page under a 403).
 *
 * This is the degradation Part 3 designed for, held against the whole chain
 * rather than against `fetchPage` alone: the refresh is what the pre-export
 * screen calls, and its two answers — the table and the failure kind — are the
 * screen's only inputs. `minimumWage.test.ts` proves the scrape calls the
 * challenge `unreachable`; this proves what the family is left holding.
 *
 * **Where the expectations come from.** ₪6,247.65 is the wage in force in March
 * 2026, read off `שכר_חודשי_להאנה2025.xlsx` -> `חודש  4.25` -> D6, and
 * not off the table under test. The failure kind is `failure.ts`'s contract for
 * an error status.
 */
describe("the pre-export read when the source is behind a bot challenge", () => {
  const challenged = (async () =>
    new Response(challengePage(), { status: 403 })) as typeof fetch;

  it("hands the screen the table it already had, so a month can still be valued", async () => {
    const repository = createInMemoryRepository({ rates: SEEDED_RATES });
    const { rates, failure } = await refreshMinimumWage(repository, challenged);
    expect(failure).toBe("unreachable");
    // The figure the user is shown and asked to confirm. A refresh that handed
    // back an empty table on a failed fetch would leave the screen with no wage
    // at all, which is the one thing that stops a family filing.
    expect(rateInForce(rates, "minimumWage", { year: 2026, month: 3 })?.value).toBe(
      624765,
    );
  });

  it("writes no rate, so a dead source cannot move a month's value", async () => {
    const repository = createInMemoryRepository({ rates: SEEDED_RATES });
    const before = await repository.listRates();
    await refreshMinimumWage(repository, challenged);
    expect(await repository.listRates()).toEqual(before);
  });

  it("keeps none of the challenge's text, which the help screen would otherwise quote", async () => {
    // The refresh keeps a fetched page's text even when the figure could not be
    // read, because a page that arrived is still the corpus the help screen
    // answers out of. A challenge did not arrive, and the difference matters:
    // kept, the help screen would answer a question about the minimum wage with
    // Cloudflare's English.
    const repository = createInMemoryRepository({ rates: SEEDED_RATES });
    await refreshMinimumWage(repository, challenged);
    expect(await repository.listCachedPages()).toEqual([]);
  });

  it("answers in a kind the screen has a Hebrew sentence for", () => {
    // The agreement rule (CLAUDE.md rule 13): the refresh returns a kind and
    // `MonthConfirmation` indexes `he.beforeExport.wage.failed` with it. Neither
    // side's test would catch a kind added on one side only, and the user would
    // meet `undefined` where the explanation belongs.
    for (const kind of ["unreachable", "notFound", "implausible"] as const) {
      expect(he.beforeExport.wage.failed[kind]).toBeTruthy();
    }
  });
});
