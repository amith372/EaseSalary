import { parse } from "node-html-parser";

import { monthOf } from "@/lib/dates";
import { rateInForce } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import { parseShekels } from "@/lib/money";
import { fetchPage, scrapeFailed } from "@/lib/scrape/failure";
import type { Scraped } from "@/lib/scrape/failure";
import { segmentArticle } from "@/lib/scrape/pageSections";
import type { CachedPage } from "@/lib/scrape/pageSections";
import type { TaxYearBrackets } from "@/lib/taxBrackets";

/**
 * The two figures the income tax is worked out from, read from the pages that
 * publish them: the year's brackets, and what one credit point is worth
 * (build_plan.md stage 3, approved 2026-09-10).
 *
 * **In the idiom the other scrapes already use**: a pure function over an HTML
 * string with the request injected, so the suite reads saved pages and never
 * the network (Part 4). Nothing here is load-bearing — every path out is either
 * a value or a named failure, and a failure leaves the seeded tables standing,
 * so a broken source degrades to what the application already knew and never
 * blocks an export.
 *
 * **The count of credit points is not scraped and never will be.** It is 2.25
 * for a foreign worker in home care and half a point more for a woman, and the
 * only thing it turns on is the worker's gender, which is a profile field. A
 * scrape of a count that changes once a decade would be a network dependency
 * standing in front of a fact the application already holds; what changes every
 * year is the point's *value*, and that is what is fetched.
 */

export const TAX_BRACKETS_SOURCE_URL =
  "https://www.kolzchut.org.il/he/מדרגות_מס_הכנסה";

export const CREDIT_POINT_SOURCE_URL =
  "https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה";

/**
 * The heading the brackets table sits under, matched on the anchor the page
 * gives it rather than on its words.
 *
 * **The page carries two tables with the same class and the same three column
 * headings**, and taking the first one on the page would work today by
 * accident. The second is income that is **not** מיגיעה אישית — income from a
 * person's own work is the first — and its lowest bracket is 31% where the
 * first table's is 10%. Reading it would tax a caregiver at three times the
 * right rate on her first shekel and produce a figure with nothing odd about
 * it, which is the failure this selector exists to make impossible.
 */
const EARNED_INCOME_HEADING = "מדרגות_המס_להכנסה_מיגיעה_אישית";

/**
 * The heading that names the tax year — `שיעורי מדרגות המס לשנת 2026`.
 *
 * **The year is read off the page and never off a clock** (`CLAUDE.md`:
 * nothing reads the clock), and never assumed to be the current one: a page
 * fetched in January may still be publishing last year's table, and storing it
 * under this year would tax every month of the new year at the old brackets
 * while looking entirely up to date.
 */
const TAX_YEAR_HEADING = /שיעורי מדרגות המס לשנת (\d{4})/;

/** `10%` or `50% *` — the footnoted top bracket carries an asterisk. */
const BRACKET_RATE = /(\d+(?:\.\d+)?)\s*%/;

/** The lower bracket rows read `84,121- 120,720 ₪`, and the first and last read
 * `עד 84,120 ₪` and `721,561 ₪ ומעלה`. What every one of them has in common is
 * that its **last** figure is the bound, which is why the bound is taken from
 * the end of the cell rather than from a position. */
const LAST_FIGURE = /([\d,]+(?:\.\d+)?)\s*₪?\s*$/;

/** The top bracket says so in words rather than by carrying no bound. */
const UNBOUNDED = "ומעלה";

/**
 * The credit point's value, in the sentence that carries both halves:
 * `שווי נקודה, נכון ל-2026 הוא 242 ₪ לחודש, שהם 2,904 ₪ לשנה שלמה`.
 *
 * **The annual figure is what is taken**, for the reason `datedRates.ts` gives:
 * the statute states a year's worth and the monthly figure is a twelfth of it.
 * Both are in this one sentence, so the parser insists on the pair — a sentence
 * carrying only one of them is a page that has been rewritten, not a partial
 * success.
 */
const CREDIT_POINT_VALUE =
  /נכון ל-(\d{4})[^\d]*?([\d,]+(?:\.\d+)?)\s*₪\s*לחודש[^\d]*?([\d,]+(?:\.\d+)?)\s*₪\s*לשנה/;

/**
 * The widest the monthly and annual figures may disagree before the sentence is
 * disbelieved.
 *
 * **A ratio and not a rate**, which is why it may sit in the code at all
 * (criterion 4): it values no month and enters no calculation. One agora, which
 * is as loose as it can be — the two figures are the same fact written twice
 * and ₪2,904 is exactly twelve times ₪242, so anything wider than rounding
 * means the page is saying two different things and this parser has paired the
 * wrong two numbers.
 */
const MONTHLY_ANNUAL_TOLERANCE_AGOROT = 1;

/**
 * Read a bracket table out of a page that holds more than one.
 *
 * The rows are read from the **annual** column, which is the first, because the
 * statute's bounds are annual and the monthly column is marked
 * לצורך המחשה בלבד on the page itself.
 */
function bracketsUnder(
  html: string,
  headingId: string,
): Scraped<TaxYearBrackets["brackets"]> {
  // **The first table after the heading, and not the first table on the
  // page.** The two are the same table today, which is exactly why this is
  // written positionally: a parser that took the first table would be right by
  // accident, and the accident would end the day the page put the other table
  // first — with no failure, just a caregiver taxed at 31% on her first shekel.
  //
  // Cutting the source at the heading and parsing what follows says that in one
  // line. Walking siblings would need the heading's own ancestor, and the
  // heading is a `span` inside an `h3` that is a sibling of the table rather
  // than its parent, so there is no subtree to search either way.
  const headingAt = html.indexOf(`id="${headingId}"`);
  if (headingAt === -1) {
    return scrapeFailed(
      "notFound",
      `no heading "${headingId}" on the page, so the earned-income table cannot be told from the other one`,
    );
  }

  const table = parse(html.slice(headingAt)).querySelector("table.wikitable");
  if (table === null) {
    return scrapeFailed("notFound", "no table follows the earned-income heading");
  }

  const rows = table
    .querySelectorAll("tr")
    .map((row) => row.querySelectorAll("td").map((cell) => cell.textContent))
    // The header row has `th` and no `td`, so it drops out by having no cells
    // rather than by being skipped by index.
    .filter((cells) => cells.length >= 3);

  if (rows.length === 0) {
    return scrapeFailed("notFound", "the earned-income table has no data rows");
  }

  const brackets: TaxYearBrackets["brackets"] = [];
  for (const [annual, , rate] of rows) {
    const percent = BRACKET_RATE.exec(rate);
    if (percent === null) {
      return scrapeFailed("notFound", `unreadable tax rate "${rate.trim()}"`);
    }

    if (annual.includes(UNBOUNDED)) {
      brackets.push({ upToAnnualAgorot: null, rate: Number(percent[1]) / 100 });
      continue;
    }

    const bound = LAST_FIGURE.exec(annual.trim());
    const agorot = bound === null ? null : parseShekels(bound[1]);
    if (agorot === null || agorot <= 0) {
      return scrapeFailed("notFound", `unreadable bracket bound "${annual.trim()}"`);
    }
    brackets.push({ upToAnnualAgorot: agorot, rate: Number(percent[1]) / 100 });
  }

  return { ok: true, value: brackets };
}

/**
 * Whether a bracket table can be believed, judged against its own shape rather
 * than against a figure written here (Part 3: anything scraped is checked for
 * plausibility before it is offered to the user).
 *
 * **The check is that it is a progressive table**, which is what the statute
 * makes it and what the whole calculation rests on: the bounds rise, the rates
 * rise, exactly one bracket is unbounded and it is the last. A table that fails
 * any of those has been read out of order or read out of the wrong element —
 * both of which produce a tax figure that looks ordinary — and there is no
 * stored history to compare a new year's brackets against, because a new year's
 * brackets are precisely the thing that has never been seen before.
 */
export function checkBracketsPlausible(
  brackets: TaxYearBrackets["brackets"],
): Scraped<TaxYearBrackets["brackets"]> {
  if (brackets.length < 2) {
    return scrapeFailed("implausible", `${brackets.length} bracket(s) is not a table`);
  }

  const unbounded = brackets.filter((bracket) => bracket.upToAnnualAgorot === null);
  if (unbounded.length !== 1) {
    return scrapeFailed(
      "implausible",
      `${unbounded.length} unbounded bracket(s), and a table has exactly one`,
    );
  }
  if (brackets[brackets.length - 1].upToAnnualAgorot !== null) {
    return scrapeFailed("implausible", "the unbounded bracket is not the last");
  }

  for (let at = 1; at < brackets.length; at += 1) {
    const under = brackets[at - 1];
    const over = brackets[at];
    if (over.rate <= under.rate) {
      return scrapeFailed(
        "implausible",
        `rate ${over.rate} does not rise above ${under.rate}`,
      );
    }
    if (
      over.upToAnnualAgorot !== null &&
      under.upToAnnualAgorot !== null &&
      over.upToAnnualAgorot <= under.upToAnnualAgorot
    ) {
      return scrapeFailed(
        "implausible",
        `bound ${over.upToAnnualAgorot} does not rise above ${under.upToAnnualAgorot}`,
      );
    }
  }

  return { ok: true, value: brackets };
}

/**
 * The whole of the reading of the brackets page, over a string.
 */
export function parseTaxBracketsPage(html: string): Scraped<TaxYearBrackets> {
  if (html.trim() === "") {
    return scrapeFailed("unreachable", "empty body");
  }

  const article = parse(html);

  const year = TAX_YEAR_HEADING.exec(article.textContent);
  if (year === null) {
    return scrapeFailed(
      "notFound",
      "no heading naming the tax year the table is for",
    );
  }

  const read = bracketsUnder(html, EARNED_INCOME_HEADING);
  if (!read.ok) return read;

  const believable = checkBracketsPlausible(read.value);
  if (!believable.ok) return believable;

  return {
    ok: true,
    value: {
      year: Number(year[1]),
      brackets: believable.value,
      source: TAX_BRACKETS_SOURCE_URL,
    },
  };
}

/**
 * The whole of the reading of the credit-point page, over a string.
 *
 * **The plausibility check is the sentence against itself**, which this source
 * makes possible and the wage's does not: it prints the monthly figure and the
 * annual one together, so twelve times the first must be the second. A parser
 * that had paired the wrong two numbers out of a page full of numbers fails
 * that arithmetic, and a figure whose decimal point moved fails it too.
 *
 * The stored history is checked as well, the way `minimumWage.ts` checks it: a
 * point's value has never fallen, and one that appears to have is the reading
 * that is wrong rather than the statute.
 */
export function parseCreditPointPage(
  html: string,
  rates: DatedRate[],
): Scraped<DatedRate> {
  if (html.trim() === "") {
    return scrapeFailed("unreachable", "empty body");
  }

  const found = CREDIT_POINT_VALUE.exec(parse(html).textContent);
  if (found === null) {
    return scrapeFailed(
      "notFound",
      "no sentence giving a credit point's monthly and yearly value for a named year",
    );
  }

  const [, year, monthlyText, annualText] = found;
  const monthly = parseShekels(monthlyText);
  const annual = parseShekels(annualText);
  if (monthly === null || annual === null || monthly <= 0 || annual <= 0) {
    return scrapeFailed(
      "notFound",
      `unreadable credit point value "${monthlyText}" / "${annualText}"`,
    );
  }

  if (Math.abs(annual - monthly * 12) > MONTHLY_ANNUAL_TOLERANCE_AGOROT) {
    return scrapeFailed(
      "implausible",
      `${annual} a year is not twelve times ${monthly} a month`,
    );
  }

  // A tax year begins in January, which is what makes this date the whole of
  // the rule (criterion 4). The wage steps in April and the recuperation rate
  // in July; sharing one date between them is the mistake the dated table
  // exists to prevent.
  const effectiveFrom = `${year}-01-01`;

  const standing = rateInForce(rates, "creditPointValue", monthOf(effectiveFrom));
  if (standing !== null && annual < standing.value) {
    return scrapeFailed(
      "implausible",
      `${annual} is below the ${standing.value} in force from ${standing.effectiveFrom}`,
    );
  }

  return {
    ok: true,
    value: {
      key: "creditPointValue",
      value: annual,
      effectiveFrom,
      source: CREDIT_POINT_SOURCE_URL,
    },
  };
}

/**
 * Both halves of one fetch, as the wage scrape already returns them: the value
 * the page was read for, and the page's own text segmented by its headings.
 *
 * They travel together because Part 3 keeps the text beside the figure taken
 * from it rather than throwing it away, and because there is only one request.
 * A page whose statement could not be read is still a page the help screen can
 * answer out of, so a failed reading does not discard the corpus.
 */
export interface TaxBracketsFetch {
  brackets: Scraped<TaxYearBrackets>;
  text: Scraped<CachedPage> | null;
}

export interface CreditPointFetch {
  rate: Scraped<DatedRate>;
  text: Scraped<CachedPage> | null;
}

export async function fetchTaxBrackets(
  fetchImpl: typeof fetch = fetch,
): Promise<TaxBracketsFetch> {
  const page = await fetchPage(TAX_BRACKETS_SOURCE_URL, fetchImpl);
  if (!page.ok) return { brackets: page, text: null };
  return {
    brackets: parseTaxBracketsPage(page.value),
    text: segmentArticle(page.value, TAX_BRACKETS_SOURCE_URL),
  };
}

export async function fetchCreditPointValue(
  rates: DatedRate[],
  fetchImpl: typeof fetch = fetch,
): Promise<CreditPointFetch> {
  const page = await fetchPage(CREDIT_POINT_SOURCE_URL, fetchImpl);
  if (!page.ok) return { rate: page, text: null };
  return {
    rate: parseCreditPointPage(page.value, rates),
    text: segmentArticle(page.value, CREDIT_POINT_SOURCE_URL),
  };
}
