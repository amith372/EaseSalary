import { describe, expect, it } from "vitest";

import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { monthlyIncomeTax } from "@/lib/engine/incomeTax";
import { createInMemoryRepository } from "@/lib/engine/repository";
import { refreshIncomeTaxIfStale } from "@/lib/incomeTaxRefresh";
import { emptyBody } from "@/lib/scrape/minimum-wage-page.fixture";
import {
  bracketsPage,
  creditPointPage,
} from "@/lib/scrape/income-tax-pages.fixture";
import {
  CREDIT_POINT_SOURCE_URL,
  TAX_BRACKETS_SOURCE_URL,
} from "@/lib/scrape/incomeTax";
import { SEEDED_TAX_BRACKETS, bracketsForYear } from "@/lib/taxBrackets";

/**
 * The daily read of the income tax's two figures, and a month taxed by what it
 * returned (specs.md Part 1 item 17: fetched per year and cached like the
 * minimum wage).
 *
 * **Every expected figure here was worked on paper before the code was run**,
 * from the published 2026 table and the statute's credit points — never from
 * what the engine returned (`CLAUDE.md` rule 11). At a ברוטו of ₪10,000:
 *
 *   annual income        ₪120,000
 *   10% to ₪84,120       ₪8,412.00
 *   14% on ₪35,880       ₪5,023.20
 *   annual tax           ₪13,435.20   → ₪1,119.60 a month
 *   2.25 points × ₪2,904 ₪6,534.00    → ₪544.50 a month
 *   a man's tax                         ₪575.10
 *   2.75 points × ₪2,904 ₪7,986.00    → ₪665.50 a month
 *   a woman's tax                       ₪454.10
 *
 * The household starts holding **no** 2026 table and **no** credit-point row,
 * so a month in 2026 has no tax the application can honestly work out until
 * the pages are read. That is what makes the figures above proof the read
 * happened and reached the calculation, rather than proof the seed is still
 * there — the saved page publishes the same 2026 table the seed already holds,
 * so a household seeded with it could not tell the two apart.
 *
 * What these would catch: a fetch that never happens, one that happens on every
 * request, a failed fetch that stores a table anyway or that stops the next
 * read, a table stored under the wrong year, and a fetched table that never
 * reaches the month it should tax.
 */

const DAY = 24 * 60 * 60 * 1000;
const MAY_2026 = { year: 2026, month: 5 };
const TEN_THOUSAND_A_MONTH = 1_000_000;

/** A household that has never fetched either page: the 2026 brackets are not
 * held, and the credit point has no dated value at all. */
function beforeAnyFetch() {
  return {
    rates: SEEDED_RATES.filter((rate) => rate.key !== "creditPointValue"),
    taxBrackets: SEEDED_TAX_BRACKETS.filter((table) => table.year !== 2026),
  };
}

/** Answers each page with its own saved copy and counts what was asked for. */
function savedPages(status = 200) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    const body =
      url === TAX_BRACKETS_SOURCE_URL ? bracketsPage() : creditPointPage();
    return new Response(body, { status });
  }) as typeof fetch;
  return { calls, impl };
}

function brokenPages() {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    return new Response(emptyBody(), { status: 200 });
  }) as typeof fetch;
  return { calls, impl };
}

describe("the daily read of the income tax's figures", () => {
  it("fetches the year's brackets and the credit point, caches them, and taxes a month with them", async () => {
    const repository = createInMemoryRepository(beforeAnyFetch());

    // Before the read there is no honest figure: no 2026 table, no credit point.
    expect(
      monthlyIncomeTax(
        TEN_THOUSAND_A_MONTH,
        MAY_2026,
        "female",
        await repository.listRates(),
        await repository.listTaxBrackets(),
      ),
    ).toBeNull();

    const pages = savedPages();
    const read = await refreshIncomeTaxIfStale(repository, new Date(), pages.impl);
    expect(pages.calls).toHaveLength(2);

    // Cached, and not merely returned: a second repository read finds them.
    const cached = bracketsForYear(await repository.listTaxBrackets(), 2026);
    expect(cached?.source).toBe(TAX_BRACKETS_SOURCE_URL);
    expect(cached?.brackets[0]).toEqual({ upToAnnualAgorot: 8412000, rate: 0.1 });
    expect(
      rateInForce(await repository.listRates(), "creditPointValue", MAY_2026),
    ).toMatchObject({ value: 290400, effectiveFrom: "2026-01-01" });

    // And read by a month's tax, at the figures worked out above.
    expect(
      monthlyIncomeTax(
        TEN_THOUSAND_A_MONTH,
        MAY_2026,
        "female",
        read.rates,
        read.taxBrackets,
      ),
    ).toBe(45410);
    expect(
      monthlyIncomeTax(
        TEN_THOUSAND_A_MONTH,
        MAY_2026,
        "male",
        read.rates,
        read.taxBrackets,
      ),
    ).toBe(57510);
  });

  it("stores the table under the year the page names and not under this one", async () => {
    // The saved page is the 2026 table. A refresh that stamped it with the
    // year it ran in would tax every month of the following January at last
    // year's brackets while looking entirely up to date.
    const repository = createInMemoryRepository(beforeAnyFetch());
    await refreshIncomeTaxIfStale(
      repository,
      new Date("2027-03-01T00:00:00Z"),
      savedPages().impl,
    );
    const held = await repository.listTaxBrackets();
    expect(held.map((table) => table.year)).toEqual([2025, 2026]);
  });

  it("reads each page once a day and not again within it", async () => {
    const repository = createInMemoryRepository(beforeAnyFetch());
    const pages = savedPages();
    // The real clock, because the stamp a save writes is the real instant of
    // that save — the same reason `minimumWageRefresh.test.ts` measures from
    // `Date.now()` rather than from a pinned day.
    await refreshIncomeTaxIfStale(repository, new Date(), pages.impl);
    expect(pages.calls).toHaveLength(2);

    await refreshIncomeTaxIfStale(repository, new Date(), pages.impl);
    expect(pages.calls).toHaveLength(2);

    await refreshIncomeTaxIfStale(repository, new Date(Date.now() + DAY), pages.impl);
    expect(pages.calls).toHaveLength(4);
  });

  it("stores nothing when a read fails, leaves the seed standing, and tries again", async () => {
    // Seeded whole this time: a broken source must degrade to what the
    // application already knew rather than to nothing.
    const repository = createInMemoryRepository();
    const broken = brokenPages();

    await refreshIncomeTaxIfStale(repository, new Date(), broken.impl);
    expect(bracketsForYear(await repository.listTaxBrackets(), 2026)?.brackets).toEqual(
      bracketsForYear(SEEDED_TAX_BRACKETS, 2026)?.brackets,
    );
    expect(
      rateInForce(await repository.listRates(), "creditPointValue", MAY_2026)
        ?.effectiveFrom,
    ).toBe("2024-01-01");

    await refreshIncomeTaxIfStale(repository, new Date(), broken.impl);
    expect(broken.calls).toHaveLength(4);
  });

  it("does not let one broken page stop the other being read", async () => {
    const repository = createInMemoryRepository(beforeAnyFetch());
    const calls: string[] = [];
    const impl = (async (url: string) => {
      calls.push(url);
      if (url === CREDIT_POINT_SOURCE_URL) return new Response(emptyBody());
      return new Response(bracketsPage());
    }) as typeof fetch;

    await refreshIncomeTaxIfStale(repository, new Date(), impl);
    expect(bracketsForYear(await repository.listTaxBrackets(), 2026)).not.toBeNull();
    expect(
      rateInForce(await repository.listRates(), "creditPointValue", MAY_2026),
    ).toBeNull();
  });
});
