import { describe, expect, it } from "vitest";

import { SEEDED_RATES, rateInForce, withFetchedRate } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import {
  MINIMUM_WAGE_SOURCE_URL,
  checkPlausible,
  fetchMinimumWage,
  parseMinimumWagePage,
} from "@/lib/scrape/minimumWage";
import {
  emptyBody,
  implausibleFigure,
  markupMoved,
  sourcePage,
} from "@/lib/scrape/minimum-wage-page.fixture";

/**
 * The minimum-wage scrape (specs.md Part 3, criterion 4, Part 4).
 *
 * **Where each expected figure comes from.** Not one is read back from what the
 * parser returned.
 *
 *   the wage the page states   ₪6,443.85   the committed workbook
 *                                          שכר_חודשי_להאנה2026.xlsx ->
 *                                          חודש  4.26 -> D6, which is the same
 *                                          figure the saved page publishes and
 *                                          the same one SEEDED_RATES holds
 *   when it took effect        1.4.2026    the same cell: the rise lands in
 *                                          April, and the saved page says
 *                                          "החל מיום 01.04.2026"
 *   the hourly rate            ₪35.40      the same sentence of the saved page,
 *                                          which is what the implausible
 *                                          fixture puts in the monthly slot
 *   the 2025 wage              ₪6,247.65   שכר_חודשי_להאנה2025.xlsx ->
 *                                          חודש  4.25 -> D6
 *
 * **What these tests would catch.**
 *
 * A parser that stamps the fetch with today's date instead of reading the
 * page's תאריך תחולה. Today is 2026-09-09 and the expected date is 2026-04-01,
 * so a today-stamping parser fails the first case rather than passing it for
 * five months of the year.
 *
 * A parser that takes the hourly rate. Both figures are in the one sentence,
 * ₪6,443.85 and ₪35.40, and either is a plausible thing for a loose regex to
 * reach; only one of them is a monthly wage.
 *
 * A parser that searches the whole document text rather than the statement's
 * own element. The markup-moved fixture leaves the sentence in the page word
 * for word and only renames the class around it, so a text-wide search still
 * finds a number and reports success — which is the failure Part 4 calls a
 * wrong answer presented as a result.
 *
 * A plausibility check that compares against the *latest* row rather than the
 * one in force on the fetched date, and one that accepts a figure below the
 * wage already standing — which is what reading the hourly rate produces and
 * what nothing else here can tell apart from a real number.
 *
 * A merge that appends rather than replaces, which puts two rows under one
 * effective date and makes `rateInForce` answer with whichever the sort left
 * last.
 */

// ₪6,443.85 and 1.4.2026, from שכר_חודשי_להאנה2026.xlsx -> חודש  4.26 -> D6.
const WAGE_2026 = 644385;
const EFFECTIVE_2026 = "2026-04-01";
// ₪6,247.65, from שכר_חודשי_להאנה2025.xlsx -> חודש  4.25 -> D6.
const WAGE_2025 = 624765;
// ₪35.40 an hour, published in the same sentence as the monthly figure.
const HOURLY_2026 = 3540;

function ok(result: ReturnType<typeof parseMinimumWagePage>): DatedRate {
  if (!result.ok) {
    throw new Error(`expected a figure, got ${result.failure.kind}: ${result.failure.detail}`);
  }
  return result.value;
}

function failureOf(result: ReturnType<typeof parseMinimumWagePage>): string {
  if (result.ok) {
    throw new Error(`expected a failure, got ${result.value.value}`);
  }
  return result.failure.kind;
}

describe("the saved source page", () => {
  it("yields the monthly wage and the date it took effect", () => {
    const rate = ok(parseMinimumWagePage(sourcePage(), SEEDED_RATES));

    expect(rate.key).toBe("minimumWage");
    expect(rate.value).toBe(WAGE_2026);
    expect(rate.effectiveFrom).toBe(EFFECTIVE_2026);
    expect(rate.source).toBe(MINIMUM_WAGE_SOURCE_URL);
  });

  it("does not read the hourly rate published beside it", () => {
    expect(ok(parseMinimumWagePage(sourcePage(), SEEDED_RATES)).value).not.toBe(
      HOURLY_2026,
    );
  });
});

/**
 * Part 4's three spoiled versions. Each must end with the application saying
 * *which* of the three happened, so each asserts the kind and not merely that
 * no figure came back — a scrape that answered "failed" to all three would tell
 * the user nothing about whether retrying is worth anything.
 */
describe("the three spoiled pages", () => {
  it("says the markup moved when the statement's element is renamed", () => {
    expect(failureOf(parseMinimumWagePage(markupMoved(), SEEDED_RATES))).toBe(
      "notFound",
    );
  });

  it("says the source was unreachable when the body is empty", () => {
    expect(failureOf(parseMinimumWagePage(emptyBody(), SEEDED_RATES))).toBe(
      "unreachable",
    );
  });

  it("says the figure is implausible when the hourly rate takes the monthly slot", () => {
    expect(
      failureOf(parseMinimumWagePage(implausibleFigure(), SEEDED_RATES)),
    ).toBe("implausible");
  });

  it("names the three differently, so the user is told which happened", () => {
    const kinds = [
      failureOf(parseMinimumWagePage(markupMoved(), SEEDED_RATES)),
      failureOf(parseMinimumWagePage(emptyBody(), SEEDED_RATES)),
      failureOf(parseMinimumWagePage(implausibleFigure(), SEEDED_RATES)),
    ];
    expect(new Set(kinds).size).toBe(3);
  });
});

describe("the plausibility check", () => {
  it("accepts a real rise: 2025's figure to 2026's, about three percent", () => {
    expect(checkPlausible(WAGE_2026, EFFECTIVE_2026, [SEEDED_RATES[0]])).toBeNull();
  });

  it("refuses a figure below the wage already in force", () => {
    // The hourly rate in the monthly slot, which is the concrete misread.
    expect(checkPlausible(HOURLY_2026, EFFECTIVE_2026, SEEDED_RATES)?.kind).toBe(
      "implausible",
    );
  });

  it("refuses a figure more than twice the wage in force", () => {
    // A lost decimal point: ₪64,438.50 where ₪6,443.85 was published.
    expect(
      checkPlausible(WAGE_2026 * 10, EFFECTIVE_2026, SEEDED_RATES)?.kind,
    ).toBe("implausible");
  });

  it("judges against the row in force on the fetched date, not the latest one", () => {
    // A figure dated April 2025 is judged against what stood then, not against
    // the 2026 row that sits later in the table. Compared with the latest row
    // it would be refused as a fall; compared with the row in force it is the
    // figure the 2025 workbook itself pays.
    expect(checkPlausible(WAGE_2025, "2025-04-01", SEEDED_RATES)).toBeNull();
  });

  it("refuses rather than guesses when no row is in force yet", () => {
    const future: DatedRate[] = [
      { key: "minimumWage", value: WAGE_2026, effectiveFrom: "2027-04-01", source: "x" },
    ];
    expect(checkPlausible(WAGE_2026, EFFECTIVE_2026, future)?.kind).toBe(
      "implausible",
    );
  });
});

describe("the fetch", () => {
  const respond = (body: string, status = 200) =>
    (async () =>
      new Response(body, { status })) as unknown as typeof fetch;

  it("reads the page the source returns", async () => {
    const fetched = await fetchMinimumWage(SEEDED_RATES, respond(sourcePage()));
    expect(ok(fetched.rate).value).toBe(WAGE_2026);
  });

  it("keeps the page's text beside the figure it took from it", async () => {
    // Part 3: the text of a fetched page is kept rather than discarded, and one
    // request carries both. A fetch that returned the figure alone would send
    // the help screen back to the source for the same page.
    const fetched = await fetchMinimumWage(SEEDED_RATES, respond(sourcePage()));
    expect(fetched.text?.ok).toBe(true);
    expect(fetched.text?.ok === true && fetched.text.value.sections.length)
      .toBeGreaterThan(1);
  });

  it("keeps the text even when the statement could not be read", async () => {
    const fetched = await fetchMinimumWage(SEEDED_RATES, respond(markupMoved()));
    expect(failureOf(fetched.rate)).toBe("notFound");
    expect(fetched.text?.ok).toBe(true);
  });

  it("reports an error status as unreachable", async () => {
    const fetched = await fetchMinimumWage(SEEDED_RATES, respond("", 500));
    expect(failureOf(fetched.rate)).toBe("unreachable");
    // No page arrived, so there is no text to keep — and `null` says that,
    // where a failed segmenting would say the page arrived and was unreadable.
    expect(fetched.text).toBeNull();
  });

  it("reports a request that threw as unreachable", async () => {
    const throwing = (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch;
    expect(failureOf((await fetchMinimumWage(SEEDED_RATES, throwing)).rate)).toBe(
      "unreachable",
    );
  });
});

describe("writing the fetched figure into the table", () => {
  const fetched: DatedRate = {
    key: "minimumWage",
    value: WAGE_2026,
    effectiveFrom: EFFECTIVE_2026,
    source: MINIMUM_WAGE_SOURCE_URL,
  };

  it("replaces the row of the same date rather than appending a second", () => {
    const merged = withFetchedRate(SEEDED_RATES, fetched);
    const forApril = merged.filter(
      (rate) => rate.key === "minimumWage" && rate.effectiveFrom === EFFECTIVE_2026,
    );
    expect(forApril).toHaveLength(1);
    expect(forApril[0].source).toBe(MINIMUM_WAGE_SOURCE_URL);
  });

  it("appends a date the table does not hold", () => {
    const next: DatedRate = { ...fetched, value: 670000, effectiveFrom: "2027-04-01" };
    const merged = withFetchedRate(SEEDED_RATES, next);
    expect(merged).toHaveLength(SEEDED_RATES.length + 1);
    expect(rateInForce(merged, "minimumWage", { year: 2027, month: 4 })?.value).toBe(
      670000,
    );
  });

  it("leaves the seeded table untouched", () => {
    const before = SEEDED_RATES.length;
    withFetchedRate(SEEDED_RATES, { ...fetched, effectiveFrom: "2028-04-01" });
    expect(SEEDED_RATES).toHaveLength(before);
  });

  it("does not move March 2026 off the 2025 wage", () => {
    // The whole reason the table is dated: a fetch that lands April's figure
    // must not revalue the month before it (item 4).
    const merged = withFetchedRate(SEEDED_RATES, fetched);
    expect(rateInForce(merged, "minimumWage", { year: 2026, month: 3 })?.value).toBe(
      WAGE_2025,
    );
  });
});
