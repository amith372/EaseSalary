import { describe, expect, it } from "vitest";

import { CAREGIVER_TERMS, legalLinks } from "@/lib/links";
import {
  emptyBody,
  markupMoved,
  termsPage,
} from "@/lib/scrape/caregiver-terms-page.fixture";
import { sourcePage as wagePage } from "@/lib/scrape/minimum-wage-page.fixture";
import {
  fetchArticleSections,
  sectionAt,
  sectionUrl,
  segmentArticle,
} from "@/lib/scrape/pageSections";
import type { CachedPage } from "@/lib/scrape/pageSections";
import { MINIMUM_WAGE_SOURCE_URL } from "@/lib/scrape/minimumWage";

/**
 * Every expected string below is read off a saved source page, off `links.ts`,
 * or off `specs.md` — never off what the segmenter returned. The figures in the
 * sick-pay section are item 8's own (1.5 days a month, 18 a year, 90 accrued),
 * which is why that section is the one asserted on: if the text under a heading
 * were the wrong section's, those three figures would not be in it.
 */

function segmented(html: string, url = CAREGIVER_TERMS): CachedPage {
  const result = segmentArticle(html, url);
  if (!result.ok) throw new Error(`expected a segmented page: ${result.failure.detail}`);
  return result.value;
}

function failureOf(html: string): string {
  const result = segmentArticle(html, CAREGIVER_TERMS);
  return result.ok ? "ok" : result.failure.kind;
}

describe("segmenting the caregiver-terms page", () => {
  it("takes the page's title from its own heading", () => {
    expect(segmented(termsPage()).title).toBe(
      "תנאי העסקה של עובד זר בסיעוד המועסק בבית המטופל",
    );
  });

  it("segments it at every one of the article's own headings", () => {
    const page = segmented(termsPage());
    // The saved page carries thirty-five `mw-headline` ids; the count is read
    // off the fixture with grep, not off the parser. One of the thirty-five —
    // מוקדים_ממשלתיים — sits inside a wrapper div rather than beside its
    // siblings, so a walk that read the article's direct children only would
    // answer thirty-four here.
    const headings = page.sections.filter((section) => section.anchor !== "");
    expect(headings).toHaveLength(35);
    expect(sectionAt(page, "מוקדים_ממשלתיים")).not.toBeNull();
  });

  it("segments the article and not the site around it", () => {
    // "תפריט נגישות" is an h2 of the accessibility toolbar, outside the
    // article. A segmenter that walked the whole document would file it as a
    // section of the employment terms.
    const headings = segmented(termsPage()).sections.map((s) => s.heading);
    expect(headings).not.toContain("תפריט נגישות");
    expect(headings).toContain("דמי מחלה");
  });

  it("keeps a nested heading as a section of its own, at its own level", () => {
    const page = segmented(termsPage());
    // On the saved page "ניכויים משכר העובד" is an h2 and "דמי מחלה" is an h3
    // under "מרכיבי שכר" — which is itself the reason a nested heading is a
    // section here rather than a paragraph of the one above it, since most of
    // what this application pays out is one of those h3s.
    expect(sectionAt(page, "ניכויים_משכר_העובד")?.level).toBe(2);
    expect(sectionAt(page, "דמי_מחלה")?.level).toBe(3);
  });

  it("keeps an anchor exactly as the page wrote it", () => {
    // The question mark is part of the id, and a segmenter that tidied ids
    // would produce an anchor no link on the page resolves to.
    expect(sectionAt(segmented(termsPage()), "מי_זכאי?")).not.toBeNull();
  });

  it("puts item 8's sick-pay figures under the sick-pay heading", () => {
    const sick = sectionAt(segmented(termsPage()), "דמי_מחלה");
    expect(sick?.heading).toBe("דמי מחלה");
    expect(sick?.text).toContain("1.5 ימי מחלה");
    expect(sick?.text).toContain("18 ימים בשנה");
    expect(sick?.text).toContain("90 ימי מחלה");
  });

  it("stops a section at the next heading", () => {
    // "דמי הבראה" is the section after "דמי מחלה". A segmenter that ran to the
    // end of the page would carry the recuperation ladder into the sick-pay
    // section, and every question would match every section.
    const page = segmented(termsPage());
    expect(sectionAt(page, "דמי_מחלה")?.text).not.toContain("דמי הבראה");
    expect(sectionAt(page, "דמי_הבראה")?.text).toContain("הבראה");
  });

  it("drops the table of contents rather than filing it as text", () => {
    // The box lists every heading on the page. Kept, it would put "פדיון
    // חופשה" into the lead, and a question about redeeming leave would match
    // the opening paragraphs instead of the section that answers it.
    const lead = segmented(termsPage()).sections.find((s) => s.anchor === "");
    expect(lead?.text ?? "").not.toContain("פדיון חופשה");
  });
});

describe("a section and the link that points at it are one unit", () => {
  /**
   * The agreement item 26 and Part 3 together require: a reference link that
   * names a section of the terms page must name a section this page actually
   * has. It is asserted here rather than in `links.ts` because neither side
   * owns it — a heading renamed at the source breaks the link silently, and
   * this is the only place the two are held against each other.
   */
  it("resolves every terms-page link's fragment to a section of the page", () => {
    const page = segmented(termsPage());
    const fragments = Object.values(legalLinks)
      .map((link) => link.url)
      .filter((url) => url.startsWith(`${CAREGIVER_TERMS}#`))
      .map((url) => url.slice(`${CAREGIVER_TERMS}#`.length));

    expect(fragments.length).toBeGreaterThan(0);
    for (const fragment of fragments) {
      expect(sectionAt(page, fragment), fragment).not.toBeNull();
    }
  });

  it("addresses a section the way the link addresses it", () => {
    const page = segmented(termsPage());
    const sick = sectionAt(page, "דמי_מחלה");
    expect(sick).not.toBeNull();
    expect(sectionUrl(page, sick!)).toBe(legalLinks.sickPay.url);
  });

  it("addresses the lead as the page itself", () => {
    const page = segmented(termsPage());
    const lead = page.sections.find((section) => section.anchor === "");
    if (lead !== undefined) expect(sectionUrl(page, lead)).toBe(CAREGIVER_TERMS);
  });
});

describe("the minimum-wage page's text, kept beside its figure", () => {
  it("holds the dated statement in the section that publishes it", () => {
    const page = segmented(wagePage(), MINIMUM_WAGE_SOURCE_URL);
    const section = sectionAt(page, "גובה_שכר_המינימום_לעובד_מגיל_18_ואילך");
    expect(section).not.toBeNull();
    // ₪6,443.85 from 01.04.2026 — the figure the wage scrape reads and the
    // figure `SEEDED_RATES` carries from the 2026 workbook's D6.
    expect(section?.text).toContain("6,443.85");
  });

  it("carries the address it was fetched from", () => {
    expect(segmented(wagePage(), MINIMUM_WAGE_SOURCE_URL).url).toBe(
      MINIMUM_WAGE_SOURCE_URL,
    );
  });
});

describe("the spoiled pages Part 4 requires", () => {
  it("reports markup that moved as notFound", () => {
    expect(failureOf(markupMoved())).toBe("notFound");
  });

  it("reports an empty body as unreachable", () => {
    expect(failureOf(emptyBody())).toBe("unreachable");
  });

  it("reports a page whose article is empty as notFound", () => {
    expect(failureOf(`<html><body><div class="mw-parser-output"></div></body></html>`)).toBe(
      "notFound",
    );
  });
});

describe("fetching a page to segment it", () => {
  const responding = (body: string, status = 200): typeof fetch =>
    (async () => new Response(body, { status })) as unknown as typeof fetch;

  it("segments what the source served", async () => {
    const result = await fetchArticleSections(
      CAREGIVER_TERMS,
      responding(termsPage()),
    );
    expect(result.ok && result.value.sections.length).toBe(36);
  });

  it("reports an error status as unreachable without parsing", async () => {
    const result = await fetchArticleSections(CAREGIVER_TERMS, responding("", 500));
    expect(result.ok ? "ok" : result.failure.kind).toBe("unreachable");
  });

  it("reports a request that threw as unreachable", async () => {
    const throwing = (async () => {
      throw new Error("dns");
    }) as unknown as typeof fetch;
    const result = await fetchArticleSections(CAREGIVER_TERMS, throwing);
    expect(result.ok ? "ok" : result.failure.kind).toBe("unreachable");
  });
});
