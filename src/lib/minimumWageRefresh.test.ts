import { describe, expect, it } from "vitest";
import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { createInMemoryRepository } from "@/lib/engine/repository";
import {
  minimumWageIsStale,
  refreshMinimumWageIfStale,
} from "@/lib/minimumWageRefresh";
import { emptyBody, sourcePage } from "@/lib/scrape/minimum-wage-page.fixture";
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
      source: "אושר על ידי המשתמש/ת",
    });
    const page = countedFetch(sourcePage);
    await refreshMinimumWageIfStale(repository, new Date(), page.impl);
    expect(page.calls).toHaveLength(1);
  });
});
