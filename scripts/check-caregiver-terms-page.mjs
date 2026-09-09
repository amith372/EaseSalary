// The half no fixture can prove: that the caregiver-terms page still carries
// the headings the reference links point at, today, at the live address.
//
// The suite reads a saved copy and never the network (specs.md Part 4), so it
// goes on passing after a heading has been renamed at the source — and a
// renamed heading is a link that opens the top of the page instead of the
// section that answers the user's question, which is a failure nothing in the
// application would report. This is the check that catches it, and it is meant
// to be run by hand: a scrape whose verification is a network call would put
// the site's uptime in front of a commit.
//
// Run it from the repository root: node scripts/check-caregiver-terms-page.mjs

import { parse } from "node-html-parser";

// Kept in step with src/lib/links.ts and src/lib/scrape/pageSections.ts by
// hand. It is a second copy on purpose: this file must be runnable with plain
// node, without a TypeScript step, or it stops being a check somebody runs.
const PAGE =
  "https://www.kolzchut.org.il/he/" +
  encodeURIComponent("תנאי_העסקה_של_עובד_זר_בסיעוד_המועסק_בבית_המטופל");

/** Every fragment `legalLinks` points at, and the key that points at it. */
const LINKED_SECTIONS = {
  minimumWage: "שכר_מינימום",
  restDayWork: "גמול_עבור_העסקה_במנוחה_השבועית",
  sickPay: "דמי_מחלה",
  recuperation: "דמי_הבראה",
  medicalInsurance: "ביטוח_רפואי",
  incomeTax: "ניכויים_משכר_העובד",
};

let response;
try {
  response = await fetch(PAGE);
} catch (error) {
  console.log("UNREACHABLE", error.message);
  process.exit(1);
}
if (!response.ok) {
  console.log("UNREACHABLE status", response.status);
  process.exit(1);
}

const article = parse(await response.text()).querySelector(".mw-parser-output");
if (article === null) {
  console.log("NOT FOUND — the page arrived and the article body is not in it.");
  console.log("The markup has moved; the saved fixture and the segmenter are stale.");
  process.exit(1);
}

const anchors = article
  .querySelectorAll(".mw-headline")
  .map((headline) => headline.getAttribute("id"));

console.log(`${anchors.length} headings on the live page.`);

let failed = false;
for (const [key, anchor] of Object.entries(LINKED_SECTIONS)) {
  const present = anchors.includes(anchor);
  if (!present) failed = true;
  console.log(`${present ? "ok        " : "NOT FOUND "} ${key} → #${anchor}`);
}

if (failed) {
  console.log("");
  console.log("A link points at a heading the page no longer has. It would open");
  console.log("the top of the page, and no cached section would match it.");
  process.exit(1);
}
