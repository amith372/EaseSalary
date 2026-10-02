import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The source page, saved, and the three spoiled versions of it Part 4 requires:
 * markup that moved, an empty or failing response, and a figure outside the
 * plausible range. The suite reads these and never the network, so it neither
 * depends on the site being up nor waits for one.
 *
 * **The saved page is the real one, fetched on 2026-09-09 and committed
 * whole.** It is not trimmed to the part the parser reads: a fixture cut down
 * to the interesting div is a page that has already been parsed once, and it
 * would stop catching the failure that matters most — a selector that matches
 * something else on a page full of other things.
 *
 * **The three spoiled versions are transforms of that page rather than three
 * more saved copies**, and the reason is that a transform says what was
 * spoiled. Four near-identical hundred-kilobyte files would differ from each
 * other in one line nobody could find in a diff, and each would rot on its own
 * the next time the real page was re-saved.
 *
 * **Every transform asserts that it changed something**, which is the risk this
 * shape carries and the answer to it. A transform that quietly matched nothing
 * would hand the parser an unspoiled page, and the test would pass for the
 * opposite of its reason — the same silent no-op a stale saved copy would
 * produce, except that here it can be caught.
 */

/**
 * Resolved from the working directory: Vitest runs from the repository root, and
 * so does every other tool here.
 */
const SAVED_PAGE = join(
  process.cwd(),
  "src/lib/scrape/fixtures/kolzchut-minimum-wage.html",
);

/** The page exactly as the source served it on 2026-09-09. */
export function sourcePage(): string {
  return readFileSync(SAVED_PAGE, "utf8");
}

function spoil(html: string, from: string, to: string): string {
  if (!html.includes(from)) {
    throw new Error(
      `the saved page no longer contains "${from}", so this spoiled version spoils nothing`,
    );
  }
  return html.replaceAll(from, to);
}

/**
 * The markup moved: the class the statement sits in has been renamed, as a
 * site's theme rename would do. The sentence is still in the page, in the same
 * words — which is what makes this the hard case, since a parser that searched
 * the whole document for the words would still find it and would be finding it
 * by luck.
 */
export function markupMoved(): string {
  return spoil(sourcePage(), "emphasis-item-text", "summary-item-body");
}

/** An empty body: a 200 that carried nothing, which is what a site behind a
 * broken cache or a stripping proxy returns. */
export function emptyBody(): string {
  return "";
}

/**
 * **The source behind a bot challenge, which is what it actually serves today.**
 * Saved from the live site on 2026-10-01, when kolzchut.org.il began answering
 * every request from this application with Cloudflare's "Just a moment…" page.
 *
 * It is a saved copy and not a transform, because it is not this page spoiled —
 * it is a different page entirely, served under the same address. There is
 * nothing of the source in it to spoil.
 *
 * **It is paired with a 403 and never with a 200**, which is the status the
 * challenge really carries. A challenge served as a 200 would be a different
 * test, and inventing one would be inventing a behaviour nobody has seen.
 *
 * What it is here to catch: a scrape that reads the body before it judges the
 * status. This page is well-formed HTML of the right size with no wage in it, so
 * such a scrape would call it `notFound` — markup that moved, a defect in this
 * application — instead of `unreachable`, which is a source to retry. Worse, the
 * caller caches the text of a page that arrived, so Cloudflare's English would
 * land in Postgres and reach the help screen as the statute.
 */
export function challengePage(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/scrape/fixtures/kolzchut-cloudflare-challenge.html"),
    "utf8",
  );
}

/**
 * A figure outside the plausible range, and a realistic one: the **hourly**
 * rate published in the same sentence has taken the monthly rate's place, which
 * is what a column swapped at the source looks like. ₪35.40 is a real figure
 * off the same page, so nothing about it reads as corrupt — only the
 * plausibility check can tell, which is the point of having one.
 */
export function implausibleFigure(): string {
  return spoil(sourcePage(), "6,443.85 ₪ לחודש", "35.40 ₪ לחודש");
}
