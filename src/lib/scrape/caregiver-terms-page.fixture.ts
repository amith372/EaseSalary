import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The caregiver-terms page, saved, and the spoiled versions of it Part 4
 * requires.
 *
 * **The saved page is the real one, fetched on 2026-09-09 and committed whole**
 * rather than trimmed to the sections the tests read — the decision
 * `minimum-wage-page.fixture.ts` explains at length, and it holds here with
 * more force than anywhere else: what this parser must get right is telling the
 * article's own headings from the site's navigation, the accessibility toolbar
 * and the footer, and a fixture cut down to the article has already made that
 * distinction for it.
 *
 * **The spoiled versions are transforms, and every transform asserts that it
 * changed something**, so a transform that quietly matched nothing cannot hand
 * the parser an unspoiled page and let a test pass for the opposite of its
 * reason.
 *
 * **There are two spoiled versions here and not three, and that is deliberate.**
 * Part 4's third is a figure outside the plausible range, and this page yields
 * no figure: nothing is read off it that could be judged against the
 * application's own history, because what is taken is the text itself. Its
 * nearest analogue — a page that arrived without its article — is markup that
 * moved, which is `markupMoved` below and is reported as `notFound`. Inventing
 * a plausibility rule for prose would be a rule with no figure behind it.
 *
 * Resolved from the working directory rather than from `import.meta.url`, which
 * the suite's jsdom environment hands back as an `http:` address that
 * `readFileSync` refuses.
 */

const SAVED_PAGE = join(
  process.cwd(),
  "src/lib/scrape/fixtures/kolzchut-caregiver-terms.html",
);

/** The page exactly as the source served it on 2026-09-09. */
export function termsPage(): string {
  return readFileSync(SAVED_PAGE, "utf8");
}

function spoil(html: string, from: string, to: string): string {
  const changed = html.replaceAll(from, to);
  if (changed === html) {
    throw new Error(
      `the saved page no longer contains "${from}", so this spoiled version spoils nothing`,
    );
  }
  return changed;
}

/**
 * The markup moved: the class the article body sits in has been renamed, as a
 * site's skin upgrade would do. Every heading and every paragraph is still in
 * the page, word for word — which is what makes this the hard case, since a
 * segmenter that walked the whole document instead of the article would still
 * find them, and would also file the accessibility toolbar as a section.
 */
export function markupMoved(): string {
  return spoil(termsPage(), "mw-parser-output", "kz-article-body");
}

/** An empty body: a 200 that carried nothing, which is what a site behind a
 * broken cache or a stripping proxy returns. */
export function emptyBody(): string {
  return "";
}
