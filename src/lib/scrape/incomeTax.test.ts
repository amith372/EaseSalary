import { describe, expect, it } from "vitest";

import { SEEDED_RATES } from "@/lib/datedRates";
import {
  bracketsPage,
  creditPointPage,
  emptyBody,
  headingMoved,
  headingsSwapped,
  pointSentenceMoved,
  pointValuesDisagree,
  ratesOutOfOrder,
  yearMissing,
} from "@/lib/scrape/income-tax-pages.fixture";
import {
  parseCreditPointPage,
  parseTaxBracketsPage,
} from "@/lib/scrape/incomeTax";

/**
 * Reading the two income-tax pages (build_plan.md stage 3).
 *
 * **Every expected figure below is off the published page or out of the
 * statute, and none of it comes from what the parser returned.** The 2026
 * brackets are the seven rows Kol Zchut prints under
 * `מדרגות המס להכנסה מיגיעה אישית`; the credit point's ₪2,904 a year and ₪242 a
 * month are the two figures its own portal page leads with. They were read by
 * hand on 2026-09-10 and written here before the parser was run against the
 * fixture.
 */

/** The 2026 table as the page prints it: annual bound in shekels, then the
 * rate. `null` is `721,561 ₪ ומעלה`, the bracket with no upper bound. */
const PUBLISHED_2026: [number | null, number][] = [
  [84_120, 0.1],
  [120_720, 0.14],
  [228_000, 0.2],
  [301_200, 0.31],
  [560_280, 0.35],
  [721_560, 0.47],
  [null, 0.5],
];

describe("the tax brackets page", () => {
  it("reads the seven brackets the page publishes, in order, as agorot", () => {
    const read = parseTaxBracketsPage(bracketsPage());
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    expect(read.value.brackets).toEqual(
      PUBLISHED_2026.map(([shekels, rate]) => ({
        upToAnnualAgorot: shekels === null ? null : shekels * 100,
        rate,
      })),
    );
  });

  it("takes the tax year from the page and not from a clock", () => {
    // The page names 2026 in its own heading. A parser that assumed the current
    // year would store January's fetch of last year's table under this year and
    // tax twelve months at the wrong brackets while looking up to date.
    const read = parseTaxBracketsPage(bracketsPage());
    expect(read.ok && read.value.year).toBe(2026);
  });

  it("refuses when the heading it finds the table by has moved", () => {
    // The failure this whole selector exists for. Both tables are still on the
    // page and both still carry `wikitable`, so a parser that took the first
    // one would return the table for income that is **not** from a person's own
    // work — first bracket 31% instead of 10%, which on a caregiver's salary is
    // three times the tax with nothing odd-looking about it.
    const read = parseTaxBracketsPage(headingMoved());
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.failure.kind).toBe("notFound");
  });

  it("follows the heading rather than the order the tables are in", () => {
    // The page carries two tables with the same class. Swapping the headings
    // puts the earned-income heading above the *other* one, whose first
    // bracket the page prints as 31% — so a parser that took the first table
    // on the page would still return 10% here and look right.
    //
    // This is the test that fails if the choice ever becomes positional by
    // accident. 31% and 10% are both read off the published page.
    const read = parseTaxBracketsPage(headingsSwapped());
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.brackets[0].rate).toBe(0.31);
  });

  it("refuses a page that does not say which year the table is for", () => {
    const read = parseTaxBracketsPage(yearMissing());
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.failure.kind).toBe("notFound");
  });

  it("disbelieves a table whose rates do not rise", () => {
    // A progressive table is what the statute makes it, so a rate that falls is
    // a parser that walked the rows backwards rather than a year the Knesset
    // inverted income tax. It is reported as implausible and not as not-found,
    // because the table was read: the page and this application disagree about
    // a number, which is a different thing to tell the user.
    const read = parseTaxBracketsPage(ratesOutOfOrder());
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.failure.kind).toBe("implausible");
  });

  it("treats an empty body as a source that could not be reached", () => {
    const read = parseTaxBracketsPage(emptyBody());
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.failure.kind).toBe("unreachable");
  });
});

describe("the credit point page", () => {
  it("reads ₪2,904 a year, dated to the January of the year it names", () => {
    const read = parseCreditPointPage(creditPointPage(), SEEDED_RATES);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    expect(read.value.key).toBe("creditPointValue");
    // The annual figure, in agorot, exactly as the page states it.
    expect(read.value.value).toBe(290_400);
    // A tax year begins in January, which is the whole of the rule here — the
    // wage steps in April and the recuperation rate in July.
    expect(read.value.effectiveFrom).toBe("2026-01-01");
  });

  it("stores the annual figure and not the monthly one", () => {
    // ₪242 a month is on the same page and in the same sentence. Storing it
    // would leave a row that is right by a factor of twelve and looks like an
    // ordinary amount of money.
    const read = parseCreditPointPage(creditPointPage(), SEEDED_RATES);
    expect(read.ok && read.value.value).not.toBe(24_200);
  });

  it("disbelieves a sentence whose two figures do not agree", () => {
    // The check this source makes possible and the wage's does not: the page
    // writes one fact twice, so twelve times the monthly figure must be the
    // annual one. It catches a decimal point moved in either, and it catches a
    // parser that paired the wrong two numbers on a page full of numbers.
    const read = parseCreditPointPage(pointValuesDisagree(), SEEDED_RATES);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.failure.kind).toBe("implausible");
  });

  it("refuses a sentence that no longer names the year it is correct for", () => {
    const read = parseCreditPointPage(pointSentenceMoved(), SEEDED_RATES);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.failure.kind).toBe("notFound");
  });

  it("disbelieves a value that has fallen below the one already in force", () => {
    // A credit point's value has never fallen — the source's own history table
    // runs ₪2,628, ₪2,616, ₪2,676, ₪2,820, ₪2,904 — so a lower figure is the
    // reading that is wrong and not the statute. Judged against the row in
    // force on the fetched figure's own date, which is how the wage is judged.
    const read = parseCreditPointPage(creditPointPage(), [
      ...SEEDED_RATES,
      {
        key: "creditPointValue",
        value: 400_000,
        effectiveFrom: "2025-01-01",
        source: "a figure invented by this test to stand above the fetched one",
      },
    ]);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.failure.kind).toBe("implausible");
  });

  it("treats an empty body as a source that could not be reached", () => {
    const read = parseCreditPointPage(emptyBody(), SEEDED_RATES);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.failure.kind).toBe("unreachable");
  });
});
