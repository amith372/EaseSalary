import { NodeType, parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";

import { fetchPage, scrapeFailed } from "@/lib/scrape/failure";
import type { Scraped } from "@/lib/scrape/failure";

/**
 * The text of a fetched page, kept beside what was taken from it and segmented
 * by the page's own headings (specs.md Part 3).
 *
 * **It is segmented at the moment of the fetch and not later**, because the
 * reference links of item 26 already point at *sections* of a page rather than
 * at whole pages — several keys in `links.ts` share the caregiver-terms page on
 * purpose — so a question, a legal link and a stored section resolve to the same
 * unit only if that unit is a section. Segmenting in Stage 7 instead would mean
 * inventing the unit against text scraped two stages earlier, which is the
 * scrape-it-twice outcome this file exists to avoid.
 *
 * **The corpus is the article pages and not every page fetched.** Kol Zchut
 * articles are prose under their own headings, which is what a question can be
 * answered out of; the holiday sources are tables of dates, where a heading
 * segments nothing and the dates are already stored as a list. So the wage page
 * and the caregiver-terms page are cached and the holiday pages are not, and
 * that is a decision rather than an omission.
 *
 * **This runs on the server**, like every other scrape here: the browser must
 * never reach the source.
 */

/**
 * One heading and the text under it, down to the next heading.
 *
 * `anchor` is the page's own heading id — the fragment a link ends in — and it
 * is what makes a section addressable: `links.ts` names it, and Stage 7 matches
 * a question to it. The lead paragraphs above the first heading are a section
 * too, with an empty anchor, because a page's opening is where an article
 * usually says what it is about.
 */
export interface PageSection {
  anchor: string;
  heading: string;
  /** 2 for a top-level heading, 3 for one nested under it, 1 for the lead. */
  level: number;
  /** The section's text, whitespace collapsed, with no markup left in it. */
  text: string;
}

/** A fetched page as it is kept: the address, the title, and the sections. */
export interface CachedPage {
  url: string;
  title: string;
  sections: PageSection[];
}

/**
 * The address a single section is reached at, which is the form a reference
 * link takes and therefore the form the two are compared in.
 */
export function sectionUrl(page: CachedPage, section: PageSection): string {
  return section.anchor === "" ? page.url : `${page.url}#${section.anchor}`;
}

/** The section a link's fragment names, or `null` if the page has no such heading. */
export function sectionAt(page: CachedPage, anchor: string): PageSection | null {
  return page.sections.find((section) => section.anchor === anchor) ?? null;
}

/**
 * The article's own body. Everything outside it — the site's navigation, the
 * accessibility toolbar, the footer — carries headings of its own, and a
 * segmenter that read the whole document would file "תפריט נגישות" as a section
 * of the article.
 */
const ARTICLE_SELECTOR = ".mw-parser-output";
const TITLE_SELECTOR = "#firstHeading .mw-page-title-main";

/**
 * The heading's own text sits in this span; the `h2` around it also contains an
 * empty anchor span the site keeps for old links, so the id is read from the
 * headline and not from the heading element.
 */
const HEADLINE_SELECTOR = ".mw-headline";

/**
 * Dropped rather than segmented. The table of contents is the list of headings
 * over again, so keeping it would put every heading's words into the lead
 * section and match a question there instead of in the section that answers it.
 * `mw-editsection` is the "עריכה" link the site prints beside a heading.
 */
const NOISE_SELECTORS = [".toc-box", ".mw-editsection", "script", "style"];

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Whether a section boundary is buried somewhere inside this element. */
function wrapsAHeading(node: HTMLElement): boolean {
  return node
    .querySelectorAll("h2, h3")
    .some((heading) => heading.querySelector(HEADLINE_SELECTOR) !== null);
}

function headlineOf(node: HTMLElement): HTMLElement | null {
  const tag = node.rawTagName?.toLowerCase() ?? "";
  if (tag !== "h2" && tag !== "h3") return null;
  return node.querySelector(HEADLINE_SELECTOR);
}

/**
 * The whole of the reading, over a string, so the suite never touches the
 * network (Part 4) and the fetch below has nothing in it but the request.
 *
 * **The headings and the text are siblings**, which is what this source's
 * markup gives us: an `h2` is followed by the paragraphs and lists that belong
 * to it, until the next heading. So a section is a run of siblings and not a
 * subtree, and reading it as a subtree would return every section empty.
 *
 * **A heading inside a wrapper is still a heading**, which is why the walk
 * descends rather than reading the article's direct children only. The saved
 * caregiver-terms page has one — `מוקדים_ממשלתיים` sits inside a `div` the site
 * wraps its help boxes in — and a flat walk loses that section and files its
 * text under the heading above it, which is one wrong answer per question about
 * it. Anything with no heading inside it is taken whole and not descended into.
 *
 * **A nested `h3` opens a section of its own** rather than being folded into
 * the `h2` above it. Its level is kept, so a caller that wants the enclosing
 * section can still find it, but the addressable unit is the heading — which is
 * what a link's fragment names.
 */
export function segmentArticle(html: string, url: string): Scraped<CachedPage> {
  if (html.trim() === "") {
    return scrapeFailed<CachedPage>("unreachable", "empty body");
  }

  const root = parse(html);
  const article = root.querySelector(ARTICLE_SELECTOR);
  if (article === null) {
    return scrapeFailed<CachedPage>(
      "notFound",
      `no article body at "${ARTICLE_SELECTOR}"`,
    );
  }
  for (const selector of NOISE_SELECTORS) {
    for (const node of article.querySelectorAll(selector)) node.remove();
  }

  const title = collapse(root.querySelector(TITLE_SELECTOR)?.textContent ?? "");
  const sections: PageSection[] = [];
  let current: PageSection = { anchor: "", heading: title, level: 1, text: "" };
  let parts: string[] = [];

  const close = () => {
    current.text = collapse(parts.join(" "));
    if (current.anchor !== "" || current.text !== "") sections.push(current);
    parts = [];
  };

  const walk = (node: HTMLElement) => {
    for (const child of node.childNodes) {
      // `nodeType` and not `rawTagName`: a comment node answers the second
      // and has none of an element's methods, which is a crash rather than a
      // wrong answer and therefore easy to get wrong once and never again.
      if (child.nodeType !== NodeType.ELEMENT_NODE) {
        parts.push(child.textContent);
        continue;
      }
      const element = child as HTMLElement;
      const headline = headlineOf(element);
      if (headline !== null) {
        close();
        current = {
          anchor: headline.getAttribute("id") ?? "",
          heading: collapse(headline.textContent),
          level: element.rawTagName.toLowerCase() === "h3" ? 3 : 2,
          text: "",
        };
        continue;
      }
      if (wrapsAHeading(element)) walk(element);
      else parts.push(element.textContent);
    }
  };
  walk(article);
  close();

  if (sections.length === 0) {
    return scrapeFailed<CachedPage>(
      "notFound",
      "the article body arrived with no headings and no text",
    );
  }

  return { ok: true, value: { url, title, sections } };
}

/**
 * The request, and nothing else — everything that can be got wrong is in
 * `segmentArticle` above, where a saved page can be handed to it. `fetchImpl`
 * is injected so the suite never reaches the network (Part 4).
 */
export async function fetchArticleSections(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Scraped<CachedPage>> {
  const page = await fetchPage(url, fetchImpl);
  if (!page.ok) return page;
  return segmentArticle(page.value, url);
}
