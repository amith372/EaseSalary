import { describe, expect, it } from "vitest";

import {
  SEEDED_TAX_BRACKETS,
  bracketsForYear,
  withFetchedBrackets,
} from "@/lib/taxBrackets";

/**
 * The bracket table's own behaviour, as against reading one off a page.
 *
 * The seeded figures asserted here are the ones Kol Zchut publishes: 2026's
 * lowest bracket runs to ₪84,120 a year at 10%, and 2025's third bracket ends
 * at ₪193,800 where 2026's ends at ₪228,000 — which is the one difference
 * between the two tables that matters below ₪560,280.
 */

describe("bracketsForYear", () => {
  it("gives the table for the year asked for", () => {
    const table = bracketsForYear(SEEDED_TAX_BRACKETS, 2026);
    expect(table?.year).toBe(2026);
    expect(table?.brackets[0]).toEqual({ upToAnnualAgorot: 8_412_000, rate: 0.1 });
  });

  it("tells the two seeded years apart where they differ", () => {
    // Both open at ₪84,120 and 10%. They part company at the third bracket, and
    // a lookup that quietly fell back to the nearest year would return a table
    // that agrees on everything a caregiver earns and disagrees higher up —
    // which is the kind of wrong that surfaces years later.
    expect(bracketsForYear(SEEDED_TAX_BRACKETS, 2025)?.brackets[2]).toEqual({
      upToAnnualAgorot: 19_380_000,
      rate: 0.2,
    });
    expect(bracketsForYear(SEEDED_TAX_BRACKETS, 2026)?.brackets[2]).toEqual({
      upToAnnualAgorot: 22_800_000,
      rate: 0.2,
    });
  });

  it("answers null for a year it holds no table for, rather than the nearest", () => {
    // Brackets are restated every January, so the nearest year is precisely the
    // wrong one. `null` is what lets the month say it cannot work the tax out
    // instead of working it out from another year's statute.
    expect(bracketsForYear(SEEDED_TAX_BRACKETS, 2027)).toBeNull();
    expect(bracketsForYear(SEEDED_TAX_BRACKETS, 2020)).toBeNull();
  });
});

describe("withFetchedBrackets", () => {
  const fetched2027 = {
    year: 2027,
    source: "a fetch",
    brackets: [
      { upToAnnualAgorot: 9_000_000, rate: 0.1 },
      { upToAnnualAgorot: null, rate: 0.5 },
    ],
  };

  it("adds a year the table did not hold, and leaves it in year order", () => {
    const grown = withFetchedBrackets(SEEDED_TAX_BRACKETS, fetched2027);
    expect(grown.map((table) => table.year)).toEqual([2025, 2026, 2027]);
  });

  it("replaces a year already held rather than standing beside it", () => {
    // Two tables for one year would make "the brackets for 2026" depend on the
    // order rows came back in — which is a tax figure that changes without
    // anything about the month changing.
    const corrected = { ...fetched2027, year: 2026 };
    const grown = withFetchedBrackets(SEEDED_TAX_BRACKETS, corrected);
    expect(grown.filter((table) => table.year === 2026)).toHaveLength(1);
    expect(bracketsForYear(grown, 2026)?.source).toBe("a fetch");
  });

  it("leaves the table it was given alone", () => {
    // The seeded table is a module-level constant, so a function that pushed
    // into it would change what every later caller ships knowing.
    const before = SEEDED_TAX_BRACKETS.length;
    withFetchedBrackets(SEEDED_TAX_BRACKETS, fetched2027);
    expect(SEEDED_TAX_BRACKETS).toHaveLength(before);
  });
});
