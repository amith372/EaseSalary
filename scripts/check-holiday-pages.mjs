// The half no fixture can prove: that the five holiday source pages still say
// what the parsers were written against, today, at their live addresses.
//
// The suite reads saved copies and never the network (specs.md Part 4), which
// is what keeps it fast and honest — and it is also why it goes on passing
// after a page has moved. This is the check that catches that, and it is meant
// to be run by hand: a scrape whose verification is itself a network call would
// put someone else's uptime in front of a commit.
//
// Run it from the repository root: node scripts/check-holiday-pages.mjs

import { readdirSync, readFileSync } from "node:fs";
import { parse } from "node-html-parser";

// Kept in step with src/lib/scrape/*.ts by hand. It is a second copy on
// purpose: this file must be runnable with plain node, without a TypeScript
// step, or it stops being a check somebody actually runs.
const HOLIDAY_NAME = "strong[id^=holiday-day-]";
const WIKITABLE = "table.wikitable";
const RELIGIOUS = {
  "חגים יהודיים": "חגים_יהודיים",
  "חגים מוסלמיים": "חגים_מוסלמיים",
  "חגים נוצריים": "חגים_נוצריים",
  "חגים דרוזיים": "חגים_דרוזיים",
};

let failed = false;

function report(name, message) {
  console.log(`${name}: ${message}`);
}

async function pageAt(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return { error: `UNREACHABLE status ${response.status}` };
    return { html: await response.text() };
  } catch (error) {
    return { error: `UNREACHABLE ${error.message}` };
  }
}

// Every shipped list, at the address stored in its own file — which is how the
// application reaches a new year, and the only way to notice that an address
// has stopped answering.
for (const file of readdirSync("data/holidays").sort()) {
  const list = JSON.parse(readFileSync(`data/holidays/${file}`, "utf8"));
  const { html, error } = await pageAt(list.source_url);
  if (error !== undefined) {
    report(file, error);
    failed = true;
    continue;
  }
  const rows = parse(html).querySelectorAll(HOLIDAY_NAME).length;
  if (rows === 0) {
    report(file, "NOT FOUND — the page arrived with no holidays in it.");
    report(file, "Either the markup has moved or the stored address is wrong.");
    failed = true;
    continue;
  }
  report(file, `${rows} holidays (the shipped file holds ${list.holidays.length})`);
}

for (const [name, slug] of Object.entries(RELIGIOUS)) {
  const url = `https://www.kolzchut.org.il/he/${encodeURIComponent(slug)}`;
  const { html, error } = await pageAt(url);
  if (error !== undefined) {
    report(name, error);
    failed = true;
    continue;
  }
  const table = parse(html).querySelector(WIKITABLE);
  if (table === null) {
    report(name, "NOT FOUND — the page arrived and carries no wikitable.");
    failed = true;
    continue;
  }
  const rows = table.querySelectorAll("tr").length - 1;
  const years = [...html.matchAll(/\b\d{2}\.\d{2}\.(\d{4})\b/g)].map((m) => m[1]);
  report(name, `${rows} holidays, years published: ${[...new Set(years)].sort().join(", ") || "none (day and month only)"}`);
}

process.exit(failed ? 1 : 0);
