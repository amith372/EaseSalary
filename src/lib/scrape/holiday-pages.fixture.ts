import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The two saved holiday source pages, and the three spoiled versions of each
 * that Part 4 requires: markup that moved, an empty or failing response, and a
 * result outside the plausible range.
 *
 * The saved pages are the real ones, fetched on 2026-09-09 and committed whole
 * rather than trimmed, and the spoiled versions are transforms of them — the
 * two decisions `minimum-wage-page.fixture.ts` explains at length and that hold
 * here for the same reasons. **Every transform asserts that it changed
 * something**, so a transform that quietly matched nothing cannot hand a parser
 * an unspoiled page and let the test pass for the opposite of its reason.
 *
 * Resolved from the working directory rather than from `import.meta.url`, which
 * the suite's jsdom environment hands back as an `http:` address that
 * `readFileSync` refuses.
 */

const FIXTURES = join(process.cwd(), "src/lib/scrape/fixtures");

function saved(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

function spoil(html: string, from: string | RegExp, to: string): string {
  const pattern = typeof from === "string" ? from : from;
  const changed =
    typeof pattern === "string"
      ? html.replaceAll(pattern, to)
      : html.replace(pattern, to);
  if (changed === html) {
    throw new Error(
      `the saved page no longer contains ${String(from)}, so this spoiled version spoils nothing`,
    );
  }
  return changed;
}

/**
 * The Philippines' 2026 list, exactly as the source served it on 2026-09-09.
 * Twenty-four holidays, which is what the shipped `PH-2026.json` also holds.
 */
export function countryPage(): string {
  return saved("isavta-holidays-PH-2026.html");
}

/**
 * The markup moved: the id prefix each holiday's name carries has been renamed,
 * as a template rename would do. Every date and every name is still in the
 * page, word for word, which is what makes this the hard case.
 */
export function countryMarkupMoved(): string {
  return spoil(countryPage(), 'id="holiday-day-', 'id="festival-');
}

/**
 * The page the source returns for an address it does not know: a 200 carrying
 * the furniture, the heading `חגים לאומיים - - 2026` with no country name in
 * it, and no holidays underneath. This is the real `.../holidays/UK/2026`
 * answer reproduced from the page that works, and it is the shape a mistyped
 * country code takes — the mistake the shipped `UA-2026.json` was committed
 * with, which read as a country that publishes no holidays.
 */
export function countryWithNoHolidays(): string {
  const withoutRows = spoil(countryPage(), /<hr>[\s\S]*<hr>/, "<hr>");
  // Every occurrence, not the first: the country's name appears in the
  // breadcrumb before it appears in the heading, and replacing only the first
  // would leave the heading naming a country over a page with no rows — which
  // is the *other* failure, and the fixture would test the wrong one.
  return spoil(withoutRows, "הפיליפינים", "");
}

/**
 * A list of implausible length: all but the first two holidays are gone, which
 * is what a page truncated by a proxy or a parser that stopped early produces.
 * Two of twenty-four reads as an ordinary short list to everything but the
 * check against the stored year.
 */
export function countryTruncated(): string {
  const page = countryPage();
  const rows = [...page.matchAll(/<hr>/g)];
  const cut = rows[3]?.index;
  if (cut === undefined) throw new Error("the saved page has too few rows to truncate");
  return page.slice(0, cut) + page.slice(page.lastIndexOf("<hr>"));
}

/** An empty body: a 200 that carried nothing, which is what a site behind a
 * broken cache or a stripping proxy returns. */
export function emptyBody(): string {
  return "";
}

/**
 * The Christian holidays page, saved on 2026-09-09. It is the one of the four
 * religious pages that exercises every shape the others have between them: two
 * columns of dates for two rites, dates written without a year, and dates
 * qualified by the year they hold for.
 */
export function religiousPage(): string {
  return saved("kolzchut-christian-holidays.html");
}

export function jewishPage(): string {
  return saved("kolzchut-jewish-holidays.html");
}

export function muslimPage(): string {
  return saved("kolzchut-muslim-holidays.html");
}

export function druzePage(): string {
  return saved("kolzchut-druze-holidays.html");
}

/**
 * The markup moved: the table's own class has been renamed, as a wiki template
 * change would do. Every date is still in the page.
 */
export function religiousMarkupMoved(): string {
  return spoil(religiousPage(), 'class="wikitable"', 'class="holidaytable"');
}

/**
 * A list of implausible length: every row but the first has gone from the
 * table, leaving three dates where sixteen stood.
 */
export function religiousTruncated(): string {
  const page = religiousPage();
  const table = /<table class="wikitable">[\s\S]*?<\/table>/.exec(page);
  if (table === null) throw new Error("the saved page carries no wikitable");
  const rows = [...table[0].matchAll(/<tr>/g)];
  if (rows.length < 3) throw new Error("the saved table has too few rows to truncate");
  // The `tbody` is closed as well as the table: node-html-parser drops a table
  // whose `tbody` never closes, and the fixture would then be testing a page
  // with no table rather than a page with a short one.
  const kept = table[0].slice(0, rows[2].index) + "</tbody></table>";
  return page.replace(table[0], kept);
}

/**
 * One holiday dated to the year before, with the page's own heading left
 * naming the year that was asked for.
 *
 * A source that lists an adjacent year's observance beside its own is the
 * realistic version of this, and the heading cannot catch it: the page really
 * is the right year's page, and one row in it is not. Reported rather than
 * kept, because a row that lands outside the year is a row the picker would
 * offer against the wrong year's entitlement.
 */
export function countryWithAStrayYear(): string {
  return spoil(countryPage(), "01.01.2026", "01.01.2025");
}

/**
 * One holiday's date removed, with its name left in place.
 *
 * A row the source published without a date is a row the parser cannot place,
 * and it is reported rather than dropped: a year quietly one holiday short
 * looks exactly like a year that is one holiday short.
 */
export function countryWithADateMissing(): string {
  return spoil(
    countryPage(),
    /<small class="text-muted mx-3">\s*17\.02\.2026\s*<\/small>/,
    "",
  );
}
