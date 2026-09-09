// The half no fixture can prove: that the source page still says what the
// parser was written against, today, at the live address.
//
// The suite reads a saved copy and never the network (specs.md Part 4), which
// is what keeps it fast and honest — and it is also why it goes on passing
// after the page has moved. This is the check that catches that, and it is
// meant to be run by hand rather than by anything automatic: a scrape whose
// verification is itself a network call would put the site's uptime back in
// front of a commit, which is the thing Part 4 removed.
//
// Run it from the repository root: node scripts/check-minimum-wage-page.mjs

import { parse } from "node-html-parser";

// Kept in step with src/lib/scrape/minimumWage.ts by hand. It is a second copy
// on purpose: this file must be runnable with plain node, without a TypeScript
// step, or it stops being a check somebody actually runs.
const URL_ = "https://www.kolzchut.org.il/he/" + encodeURIComponent("שכר_מינימום");
const SELECTOR = ".emphasis-item-text";
const EFFECTIVE_FROM = /החל מיום (\d{2})\.(\d{2})\.(\d{4})/;
const MONTHLY_FIGURE = /([\d,]+(?:\.\d+)?)\s*₪\s*לחודש/;

let response;
try {
  response = await fetch(URL_);
} catch (error) {
  console.log("UNREACHABLE", error.message);
  process.exit(1);
}
if (!response.ok) {
  console.log("UNREACHABLE status", response.status);
  process.exit(1);
}

const statement = parse(await response.text())
  .querySelectorAll(SELECTOR)
  .map((node) => node.textContent)
  .find((text) => EFFECTIVE_FROM.test(text) && MONTHLY_FIGURE.test(text));

if (statement === undefined) {
  console.log("NOT FOUND — the page arrived and the statement is not in it.");
  console.log("The markup has moved; the saved fixture and the parser are stale.");
  process.exit(1);
}

console.log(statement);
