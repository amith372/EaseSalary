import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The two income-tax source pages, saved, and the spoiled versions of each that
 * Part 4 requires: markup that moved, an empty response, and a value outside
 * the plausible range. The suite reads these and never the network.
 *
 * **The saved pages are the real ones, fetched on 2026-09-10 and committed
 * whole**, for the reason the wage fixture gives: a page trimmed to the
 * interesting table is a page that has already been parsed once, and it would
 * stop catching the failure that matters most here — a selector that matches
 * the *other* bracket table on the same page.
 *
 * **Every transform asserts that it changed something**, so a spoiled version
 * that quietly stopped spoiling anything fails loudly instead of handing the
 * parser an unspoiled page and passing for the opposite of its reason.
 */

/** Resolved from the working directory, as `minimum-wage-page.fixture.ts`
 * explains: the suite's jsdom environment hands `import.meta.url` back as an
 * `http:` address that `readFileSync` refuses. */
function saved(name: string): string {
  return readFileSync(join(process.cwd(), "src/lib/scrape/fixtures", name), "utf8");
}

/** מדרגות מס הכנסה, exactly as the source served it on 2026-09-10. */
export function bracketsPage(): string {
  return saved("kolzchut-tax-brackets.html");
}

/** נקודות זיכוי ממס הכנסה, same day. */
export function creditPointPage(): string {
  return saved("kolzchut-credit-points.html");
}

function spoil(html: string, from: string, to: string): string {
  if (!html.includes(from)) {
    throw new Error(
      `the saved page no longer contains "${from}", so this spoiled version spoils nothing`,
    );
  }
  return html.replaceAll(from, to);
}

/** An empty body: a 200 that carried nothing, which is what a site behind a
 * broken cache or a stripping proxy returns. */
export function emptyBody(): string {
  return "";
}

/**
 * The heading the earned-income table is found by has been renamed, as a site's
 * own restructuring would do.
 *
 * **This is the hard case and the reason the fixture is the whole page**: both
 * tables are still there, both still carry `wikitable`, and a parser that took
 * the first table it found would carry on returning a table — the wrong one,
 * whose first bracket is 31%. Refusing is the only correct answer, and only a
 * parser that looks for the heading can give it.
 */
export function headingMoved(): string {
  return spoil(
    bracketsPage(),
    "מדרגות_המס_להכנסה_מיגיעה_אישית",
    "מדרגות_המס_להכנסה_מעבודה",
  );
}

/** The heading that names the tax year has been reworded, so nothing on the
 * page says which year the table is for. A table stored under a guessed year
 * would tax every month of it at another year's brackets. */
export function yearMissing(): string {
  return spoil(bracketsPage(), "שיעורי מדרגות המס לשנת", "שיעורי מדרגות המס בשנה זו");
}

/**
 * The bracket rates have been put in descending order, which is what reading
 * the table bottom-up produces.
 *
 * A regressive table is not a table anyone published: it is a parser that has
 * walked the rows the wrong way, and the figure it produces on a caregiver's
 * salary — 50% of her first shekel — is wrong by a factor of five while looking
 * like an ordinary percentage.
 */
export function ratesOutOfOrder(): string {
  return spoil(
    bracketsPage(),
    "<td>עד 84,120 ₪</td>\n<td>עד 7,010 ₪</td>\n<td>10%",
    "<td>עד 84,120 ₪</td>\n<td>עד 7,010 ₪</td>\n<td>60%",
  );
}

/**
 * The credit point's yearly figure no longer agrees with its monthly one: ₪242
 * a month against ₪290 a year, which is what a decimal point moved in one of
 * the two produces.
 *
 * It is the check this source makes possible and the wage's does not — the page
 * writes the same fact twice, so the parser can hold the two against each other
 * instead of against a range written into the code.
 */
export function pointValuesDisagree(): string {
  return spoil(creditPointPage(), "2,904 ₪ לשנה", "290 ₪ לשנה");
}

/** The sentence that carries the value has been rewritten so it no longer names
 * the year it is correct for. A value stored under a guessed year would be
 * applied to months it was never in force for. */
export function pointSentenceMoved(): string {
  return spoil(creditPointPage(), "נכון ל-2026", "כיום");
}

/**
 * The two headings swapped, so that the earned-income heading now sits above
 * the table for income that is **not** from a person's own work.
 *
 * **It is the only spoiled page here that the parser is expected to read
 * successfully**, and that is the whole point of it: it proves the table is
 * chosen by the heading above it rather than by being first on the page. A
 * parser taking the first table would return a 10% first bracket from this and
 * be indistinguishable from a correct one, so without this fixture the
 * positional rule is a comment rather than a behaviour. The table it must
 * return here opens at 31%, which is the figure a caregiver must never be
 * taxed at.
 */
export function headingsSwapped(): string {
  const earned = "מדרגות_המס_להכנסה_מיגיעה_אישית";
  const unearned = "מדרגות_המס_להכנסה_שאינה_מיגיעה_אישית";
  const placeholder = "מדרגות_המס_להכנסה_זמני";
  return spoil(
    spoil(spoil(bracketsPage(), unearned, placeholder), earned, unearned),
    placeholder,
    earned,
  );
}
