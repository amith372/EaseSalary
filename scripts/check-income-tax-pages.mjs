// The half no fixture can prove: that the two income-tax pages still say what
// the parsers were written against, today, at the live addresses.
//
// The suite reads saved copies and never the network (specs.md Part 4), which
// is what keeps it fast and honest — and it is also why it goes on passing
// after a page has moved. This is the check that catches that, run by hand for
// the reason the wage's is: a scrape whose verification is itself a network
// call would put the site's uptime back in front of a commit.
//
// Run it from the repository root: node scripts/check-income-tax-pages.mjs
//
// **The selectors below are a second copy, kept in step by hand**, as
// `check-minimum-wage-page.mjs` already keeps one. The module they mirror
// imports through the `@/` alias, which plain node does not resolve — and this
// file has to run with plain node, without a build step, or it stops being a
// check anybody runs.

import { parse } from "node-html-parser";

const BRACKETS_URL =
  "https://www.kolzchut.org.il/he/" + encodeURIComponent("מדרגות_מס_הכנסה");
const POINTS_URL =
  "https://www.kolzchut.org.il/he/" + encodeURIComponent("נקודות_זיכוי_ממס_הכנסה");

const EARNED_INCOME_HEADING = "מדרגות_המס_להכנסה_מיגיעה_אישית";
const TAX_YEAR_HEADING = /שיעורי מדרגות המס לשנת (\d{4})/;
const BRACKET_RATE = /(\d+(?:\.\d+)?)\s*%/;
const CREDIT_POINT_VALUE =
  /נכון ל-(\d{4})[^\d]*?([\d,]+(?:\.\d+)?)\s*₪\s*לחודש[^\d]*?([\d,]+(?:\.\d+)?)\s*₪\s*לשנה/;

let failures = 0;
function check(passed, what) {
  console.log(`${passed ? "ok  " : "FAIL"} ${what}`);
  if (!passed) failures += 1;
}

async function page(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return { error: `status ${response.status}` };
    return { html: await response.text() };
  } catch (error) {
    return { error: error.message };
  }
}

const brackets = await page(BRACKETS_URL);
if (brackets.error) {
  check(false, `the brackets page is unreachable: ${brackets.error}`);
} else {
  const year = TAX_YEAR_HEADING.exec(parse(brackets.html).textContent);
  check(year !== null, "the brackets page still names the tax year in a heading");
  if (year !== null) console.log(`     it is publishing ${year[1]}`);

  const headingAt = brackets.html.indexOf(`id="${EARNED_INCOME_HEADING}"`);
  check(
    headingAt !== -1,
    "the earned-income heading is still the handle the table is found by",
  );

  if (headingAt !== -1) {
    const table = parse(brackets.html.slice(headingAt)).querySelector(
      "table.wikitable",
    );
    check(table !== null, "and a table still follows it");

    const rows = (table?.querySelectorAll("tr") ?? [])
      .map((row) => row.querySelectorAll("td").map((cell) => cell.textContent))
      .filter((cells) => cells.length >= 3);
    check(rows.length >= 2, `with ${rows.length} bracket row(s) in it`);

    // The one figure worth naming: a salary's first shekel is taxed at 10% and
    // never at the 31% the *other* table on this page opens with. If that ever
    // flips, the parser is reading the wrong table and every caregiver's tax is
    // three times what it should be.
    const first = rows.length > 0 ? BRACKET_RATE.exec(rows[0][2]) : null;
    check(
      first !== null && Number(first[1]) === 10,
      `the lowest bracket is still 10%${first === null ? "" : `, and reads ${first[1]}%`}`,
    );
  }
}

const points = await page(POINTS_URL);
if (points.error) {
  check(false, `the credit-point page is unreachable: ${points.error}`);
} else {
  const found = CREDIT_POINT_VALUE.exec(parse(points.html).textContent);
  check(
    found !== null,
    "the credit-point page still states a point's monthly and yearly value for a named year",
  );
  if (found !== null) {
    const [, year, monthly, annual] = found;
    console.log(`     ${year}: ${monthly} ₪ a month, ${annual} ₪ a year`);
    const asNumber = (text) => Number(text.replace(/,/g, ""));
    check(
      Math.abs(asNumber(annual) - asNumber(monthly) * 12) < 0.01,
      "and the yearly figure is still twelve times the monthly one",
    );
  }
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
// **`process.exitCode` and not `process.exit()`**, which is not a style
// preference here. On Windows, tearing the process down while `fetch`'s sockets
// are still closing trips a libuv assertion --
// `!(handle->flags & UV_HANDLE_CLOSING)` -- which prints *after* the report and
// after the exit code is already decided. Nothing is wrong when it appears and
// the report above it is complete, and that is exactly what makes it worth
// removing: a crash-shaped line under a passing run is one somebody has to
// investigate every time they see it. Setting the code and letting node close
// its own handles ends the process the same way, with the same status, and
// without the noise.
process.exitCode = failures === 0 ? 0 : 1;
