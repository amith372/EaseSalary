import { describe, expect, it } from "vitest";

import { createInMemoryRepository } from "@/lib/engine/repository";
import type { SalaryRepository } from "@/lib/engine/repository";
import { refreshIncomeTaxIfStale } from "@/lib/incomeTaxRefresh";
import { refreshMinimumWage } from "@/lib/minimumWageRefresh";
import {
  bracketsPage,
  creditPointPage,
} from "@/lib/scrape/income-tax-pages.fixture";
import {
  CREDIT_POINT_SOURCE_URL,
  TAX_BRACKETS_SOURCE_URL,
} from "@/lib/scrape/incomeTax";
import {
  emptyBody,
  markupMoved,
  sourcePage,
} from "@/lib/scrape/minimum-wage-page.fixture";
import { MINIMUM_WAGE_SOURCE_URL } from "@/lib/scrape/minimumWage";
import { sectionAt, sectionUrl } from "@/lib/scrape/pageSections";

/**
 * The corpus: the text of a fetched page, kept beside the figure taken from it
 * (specs.md Part 3).
 *
 * Every expected string is read off a saved source page or off the constants in
 * `incomeTax.ts` and `minimumWage.ts`, never off what the store returned. The
 * page's own title — "שכר מינימום" — is in
 * `src/lib/scrape/fixtures/kolzchut-minimum-wage.html`, and
 * `גובה_שכר_המינימום_לעובד_מגיל_18_ואילך` is the id that page gives the heading
 * the dated statement sits under.
 *
 * What these would catch: the three refreshes going back to dropping the text,
 * which is the state this was written against; a failed fetch recording an
 * empty page over a good one; a re-fetch appending instead of replacing, which
 * would leave a question answerable out of a page as it read last year; a
 * refused write taking a rate refresh down with it; and a section that survives
 * storage without the anchor a reference link addresses it by, which is the one
 * thing that makes the segmenting worth doing at all.
 */

const ANY_DAY = new Date("2026-09-24T09:00:00Z");

/** The heading the wage page publishes the dated statement under. */
const WAGE_STATEMENT_ANCHOR = "גובה_שכר_המינימום_לעובד_מגיל_18_ואילך";

function serving(body: () => string): typeof fetch {
  return (async (url: string) => {
    void url;
    return new Response(body(), { status: 200 });
  }) as typeof fetch;
}

/** The two tax pages, each answered with its own saved page. */
function servingTaxPages(): typeof fetch {
  return (async (url: string) =>
    new Response(
      url === TAX_BRACKETS_SOURCE_URL ? bracketsPage() : creditPointPage(),
      { status: 200 },
    )) as typeof fetch;
}

async function storedAt(repository: SalaryRepository, url: string) {
  return (await repository.listCachedPages()).find((page) => page.url === url) ?? null;
}

describe("a fetch keeps the page it read", () => {
  it("stores the wage page's title and the section the figure came from", async () => {
    const repository = createInMemoryRepository();
    await refreshMinimumWage(repository, serving(sourcePage));

    const page = await storedAt(repository, MINIMUM_WAGE_SOURCE_URL);
    expect(page?.title).toBe("שכר מינימום");
    const section = sectionAt(page!, WAGE_STATEMENT_ANCHOR);
    // ₪6,443.85 from 01.04.2026 — the figure the scrape read out of this very
    // page, so the corpus and the rate came out of one request.
    expect(section?.text).toContain("6,443.85");
  });

  it("keeps the text of a page whose figure could not be read", async () => {
    // The class the statement sits in has been renamed, so the wage scrape
    // fails `notFound` while the article body is untouched. A page whose
    // statement this parser cannot find is still a page the help screen answers
    // out of, so a failed *reading* must not discard the corpus.
    const repository = createInMemoryRepository();
    const { failure } = await refreshMinimumWage(repository, serving(markupMoved));

    expect(failure).toBe("notFound");
    expect(await storedAt(repository, MINIMUM_WAGE_SOURCE_URL)).not.toBeNull();
  });

  it("stores nothing when the page never arrived", async () => {
    const repository = createInMemoryRepository();
    const { failure } = await refreshMinimumWage(repository, serving(emptyBody));

    expect(failure).toBe("unreachable");
    expect(await repository.listCachedPages()).toEqual([]);
  });

  it("replaces a page rather than storing it twice", async () => {
    const repository = createInMemoryRepository();
    await refreshMinimumWage(repository, serving(sourcePage));
    await refreshMinimumWage(repository, serving(sourcePage));

    const pages = await repository.listCachedPages();
    expect(pages.map((page) => page.url)).toEqual([MINIMUM_WAGE_SOURCE_URL]);
  });

  it("keeps the two tax pages beside the wage page rather than displacing it", async () => {
    const repository = createInMemoryRepository();
    await refreshMinimumWage(repository, serving(sourcePage));
    await refreshIncomeTaxIfStale(repository, ANY_DAY, servingTaxPages());

    const stored = (await repository.listCachedPages()).map((page) => page.url);
    expect(stored).toContain(MINIMUM_WAGE_SOURCE_URL);
    expect(stored).toContain(TAX_BRACKETS_SOURCE_URL);
    expect(stored).toContain(CREDIT_POINT_SOURCE_URL);
  });

  it("does not fail a refresh when the store refuses the text", async () => {
    // The figure is the load-bearing half of a fetch and the corpus is not: a
    // month is valued and exported without a page ever having been stored,
    // while a rate that was read and then lost costs the user a manual entry.
    const repository = createInMemoryRepository();
    const refusing: SalaryRepository = {
      ...repository,
      async saveCachedPage() {
        throw new Error("the corpus is full of bees");
      },
    };

    const { failure, rates } = await refreshMinimumWage(refusing, serving(sourcePage));
    expect(failure).toBeNull();
    expect(
      rates.some(
        (rate) => rate.key === "minimumWage" && rate.effectiveFrom === "2026-04-01",
      ),
    ).toBe(true);
  });
});

describe("a stored section is addressed the way a reference link addresses it", () => {
  /**
   * The unit has to survive storage, not only segmenting. `links.ts` has no
   * fragment on the wage page — every fragment it keeps points at the
   * caregiver-terms page, which nothing fetches yet — so the agreement asserted
   * here is between the stored page and the address form itself: a section
   * still resolves from its anchor, and still names the URL a link would write.
   */
  it("resolves a stored section from its anchor, and back to its address", async () => {
    const repository = createInMemoryRepository();
    await refreshMinimumWage(repository, serving(sourcePage));

    const page = await storedAt(repository, MINIMUM_WAGE_SOURCE_URL);
    const section = sectionAt(page!, WAGE_STATEMENT_ANCHOR);
    expect(section).not.toBeNull();
    expect(sectionUrl(page!, section!)).toBe(
      `${MINIMUM_WAGE_SOURCE_URL}#${WAGE_STATEMENT_ANCHOR}`,
    );
  });
});
