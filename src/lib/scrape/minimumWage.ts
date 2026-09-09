import { parse } from "node-html-parser";

import { monthOf } from "@/lib/dates";
import { rateInForce } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import { parseShekels } from "@/lib/money";
import { fetchPage, scrapeFailed } from "@/lib/scrape/failure";
import type { ScrapeFailure, Scraped } from "@/lib/scrape/failure";
import { segmentArticle } from "@/lib/scrape/pageSections";
import type { CachedPage } from "@/lib/scrape/pageSections";
import type { IsoDate } from "@/lib/types";

/**
 * The minimum wage, read from the page that publishes it (specs.md Part 3).
 *
 * **The page publishes both halves of what criterion 4 needs** — the figure and
 * the תאריך תחולה it takes effect from — in one sentence, which is why this
 * source was chosen over one that prints a number alone. A figure without its
 * date is the undated constant the dated-rates table exists to remove, so a
 * sentence carrying only one of the two is not a partial success here: it is a
 * failed fetch.
 *
 * **Nothing in this file is load-bearing** (Part 3). Every path out of it is
 * either a dated row or a named failure, and a failure leaves the seeded table
 * standing: the application already knows a wage before any fetch has run, so a
 * broken source degrades to the last confirmed figure plus manual entry and
 * never blocks an export.
 *
 * **This runs on the server.** It is the browser that must never reach the
 * source: a page fetched from a user's machine would be a cross-origin request
 * the site does not permit, and the text it returns is cached in Postgres
 * beside the figure rather than handed back.
 */

/**
 * The page the figure is read from — Part 3 names it, and it is the same
 * address `links.ts` keeps for the interface's reference links, written here
 * rather than imported because it is the *source of a figure* and not a link
 * shown to a user. The two are the same page today and need not stay so: a
 * scrape follows the markup it was written against, while a link follows what
 * the user should read.
 */
export const MINIMUM_WAGE_SOURCE_URL =
  "https://www.kolzchut.org.il/he/שכר_מינימום";

/**
 * The wage scrape's answer. `Scraped<DatedRate>` is the shape every scrape
 * answers in; this alias is kept because the callers written against it read
 * better for naming what came back.
 */
export type ScrapeResult = Scraped<DatedRate>;

export type { ScrapeFailure, ScrapeFailureKind } from "@/lib/scrape/failure";

/**
 * The most a fetched wage may exceed the one already in force before it is
 * disbelieved.
 *
 * **It is a ratio and not a figure, which is why it can sit in the code at all**
 * — criterion 4's rule is about rates, and this is not one: it never enters a
 * calculation, values no month, and appears on no sheet. The range it bounds is
 * the table's own history rather than a number written here.
 *
 * **Two is a wide net on purpose.** The largest single step the source page's
 * own history table records is about five percent — ₪5,300 to ₪5,571.75 — so
 * every real rise clears this by a wide margin, and what it catches is the
 * order-of-magnitude misread: a figure whose decimal point was lost, or whose
 * thousands separator was read as one. A tighter bound would start refusing
 * real rises, and a refusal costs the user a manual entry she should not have
 * had to make.
 */
const MAX_PLAUSIBLE_RISE = 2;

/**
 * The sentence carries the date as `01.04.2026` and the figure as
 * `6,443.85 ₪ לחודש`, with the hourly rate in the same sentence — which is why
 * the figure is matched by the words that follow it rather than by being the
 * first number in the line. Reading the hourly rate as the monthly one is the
 * realistic corruption here, and it is what the implausible fixture reproduces.
 */
const EFFECTIVE_FROM = /החל מיום (\d{2})\.(\d{2})\.(\d{4})/;
const MONTHLY_FIGURE = /([\d,]+(?:\.\d+)?)\s*₪\s*לחודש/;

/**
 * Where in the page the statement sits. The class is the article's own summary
 * box, not a wrapper the site's theme owns, so it is the most stable handle the
 * page offers.
 */
const STATEMENT_SELECTOR = ".emphasis-item-text";

/**
 * Whether a fetched figure is believable, judged against the table rather than
 * against a range written here (Part 3: anything scraped is checked for
 * plausibility before it is offered to the user).
 *
 * **The baseline is the row already in force on the fetched figure's own
 * effective date**, so the comparison is between two figures that stand in
 * sequence rather than between a fetched figure and today's. Re-fetching a row
 * the table already holds compares it with itself and passes, which is the
 * ordinary case: the check earns its keep the day the page changes and the
 * figure does not move the way a wage moves.
 *
 * **The lower bound is that a wage does not fall.** No step in the source
 * page's own history table goes down, and the failure it catches is the
 * concrete one: the hourly rate read in place of the monthly, which is off by a
 * factor of about 180 and would otherwise look like an ordinary number.
 *
 * **A table with no row in force yet cannot judge, and says so rather than
 * accepting.** The table always ships seeded (`SEEDED_RATES`), so this is
 * reached only by a figure dated earlier than everything known — which is a
 * page that has moved backwards, not a new fact.
 */
export function checkPlausible(
  valueAgorot: number,
  effectiveFrom: IsoDate,
  rates: DatedRate[],
): ScrapeFailure | null {
  const baseline = rateInForce(rates, "minimumWage", monthOf(effectiveFrom));
  if (baseline === null) {
    return {
      kind: "implausible",
      detail: `no minimum wage in force on ${effectiveFrom} to judge ${valueAgorot} against`,
    };
  }
  if (valueAgorot < baseline.value) {
    return {
      kind: "implausible",
      detail: `${valueAgorot} is below the ${baseline.value} in force from ${baseline.effectiveFrom}`,
    };
  }
  if (valueAgorot > baseline.value * MAX_PLAUSIBLE_RISE) {
    return {
      kind: "implausible",
      detail: `${valueAgorot} is more than ${MAX_PLAUSIBLE_RISE}× the ${baseline.value} in force from ${baseline.effectiveFrom}`,
    };
  }
  return null;
}

/**
 * The whole of the reading, over a string, so the suite never touches the
 * network (Part 4) and the fetch below has nothing in it but the request.
 *
 * **The statement is found by its shape and not by a keyword.** Three other
 * boxes on the page carry the same class and one of them contains the words
 * "שכר המינימום" as well, so the statement is the one that holds *both* a
 * date of application and a monthly figure — which is exactly the pair
 * criterion 4 requires and therefore the right thing to insist on.
 */
export function parseMinimumWagePage(
  html: string,
  rates: DatedRate[],
): ScrapeResult {
  if (html.trim() === "") {
    return scrapeFailed<DatedRate>("unreachable", "empty body");
  }

  const statements = parse(html)
    .querySelectorAll(STATEMENT_SELECTOR)
    .map((node) => node.textContent);

  const found = statements
    .map((text) => ({
      date: EFFECTIVE_FROM.exec(text),
      figure: MONTHLY_FIGURE.exec(text),
    }))
    .find((match) => match.date !== null && match.figure !== null);

  if (found === undefined || found.date === null || found.figure === null) {
    return scrapeFailed<DatedRate>(
      "notFound",
      `no statement of a dated monthly wage in ${statements.length} candidate(s)`,
    );
  }

  const [, day, month, year] = found.date;
  // Item 4: the stored date is the official תאריך תחולה, which is always a
  // first of month. A day other than the first is not a rate that took effect
  // mid-month — no rate does — it is a date this parser has misread, so it is
  // reported as markup that moved rather than stored as an impossible row.
  if (day !== "01") {
    return scrapeFailed<DatedRate>(
      "notFound",
      `effective date ${day}.${month}.${year} is not a first of month`,
    );
  }
  const effectiveFrom: IsoDate = `${year}-${month}-${day}`;

  const value = parseShekels(found.figure[1]);
  if (value === null || value <= 0) {
    return scrapeFailed<DatedRate>("notFound", `unreadable figure "${found.figure[1]}"`);
  }

  const implausible = checkPlausible(value, effectiveFrom, rates);
  if (implausible !== null) return { ok: false, failure: implausible };

  return {
    ok: true,
    value: {
      key: "minimumWage",
      value,
      effectiveFrom,
      source: MINIMUM_WAGE_SOURCE_URL,
    },
  };
}

/**
 * Both halves of one fetch: the dated row the page was read for, and the page's
 * own text segmented by its headings.
 *
 * **They travel together because Part 3 says the text is kept *beside* the
 * figure taken from it rather than thrown away**, and because there is only one
 * request: a caller that wanted both and got one would fetch the page a second
 * time to get the other, which is the outcome the caching rule exists to
 * prevent.
 *
 * `text` stands on its own — a page whose statement could not be read is still
 * a page the help screen can answer out of, so a failed reading does not
 * discard the corpus, and a page that never arrived leaves it `null`.
 */
export interface FetchedWage {
  rate: ScrapeResult;
  text: Scraped<CachedPage> | null;
}

/**
 * The request, and nothing else — everything that can be got wrong is in
 * `parseMinimumWagePage` and `segmentArticle`, where a saved page can be handed
 * to either. `fetchImpl` is injected so the suite never reaches the network
 * (Part 4).
 */
export async function fetchMinimumWage(
  rates: DatedRate[],
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedWage> {
  const page = await fetchPage(MINIMUM_WAGE_SOURCE_URL, fetchImpl);
  if (!page.ok) return { rate: page, text: null };
  return {
    rate: parseMinimumWagePage(page.value, rates),
    text: segmentArticle(page.value, MINIMUM_WAGE_SOURCE_URL),
  };
}
