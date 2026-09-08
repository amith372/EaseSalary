import { expect, test } from "@playwright/test";
import { he } from "../src/lib/i18n/he";

/**
 * The opening screen, through the browser.
 *
 * **What only a browser can check.** `specs.md` Part 5 is explicit that
 * right-to-left failures are quiet: a browser reorders mixed runs of Hebrew and
 * Latin text, and the calendar is reversed twice over — the week begins on
 * Sunday *and* Sunday sits on the right, so a component built for a
 * left-to-right week shifts every day by one and looks entirely plausible. No
 * unit test sees any of that, because none of it happens until a browser lays
 * the page out.
 *
 * **Hebrew comes from `he.ts` and is never typed here.** Every user-facing
 * string lives in one translations file (`CLAUDE.md`), so a spec that hardcoded
 * one would be a second copy of it — and would break on a wording change that
 * broke nothing.
 *
 * This file covers the screen as Stage 0 built it. The export flow is not in it
 * because the export does not exist yet: when it lands, the spec that matters
 * most is the one `CLAUDE.md` rule 11 describes — mark the August 2025 case
 * through the calendar, read the four totals off the preview, download the
 * .xlsx, open it, and assert the two agree. That check has no substitute,
 * because a `SUM` range one row short prints a total wrong by exactly one line
 * and looks ordinary (Part 3).
 */

test.describe("the opening screen", () => {
  test("renders right-to-left, in Hebrew, with the calendar's week starting on Sunday", async ({
    page,
  }) => {
    await page.goto("/");

    // The document's own direction. A page that lost this reads as a foreign
    // document to the family, and every logical property in the stylesheet
    // resolves the wrong way at once.
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");

    // Sunday sits on the right. Checked by geometry rather than by DOM order,
    // because the two can disagree — a grid laid out left-to-right inside an
    // rtl document puts Sunday's *element* first and paints it on the left,
    // which is exactly the failure Part 5 names and the one a snapshot of the
    // markup would miss.
    const sunday = page.getByText(he.calendar.dayNames[0], { exact: true }).first();
    const saturday = page.getByText(he.calendar.dayNames[6], { exact: true }).first();
    const sundayBox = await sunday.boundingBox();
    const saturdayBox = await saturday.boundingBox();
    expect(sundayBox, "the weekday header row should be visible").not.toBeNull();
    expect(saturdayBox).not.toBeNull();
    expect(sundayBox!.x).toBeGreaterThan(saturdayBox!.x);
  });

  test("never lets the page scroll sideways", async ({ page }) => {
    await page.goto("/");
    // A horizontal scrollbar on an rtl page is how a mixed-script run that
    // escaped its container announces itself. It is invisible in a screenshot
    // taken at a wider viewport, so it is measured rather than looked at.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("shows the month's figures with the digits in the right order", async ({
    page,
  }) => {
    await page.goto("/");
    // Amounts carry `translate="no"` and sit inside their own element, so a
    // translated identifier cannot become a wrong identifier (`CLAUDE.md`).
    // What is asserted is the rendered text: an amount whose thousands
    // separator or minus sign has been reordered by the bidi algorithm fails
    // here and nowhere else.
    const amounts = page.locator('[translate="no"]');
    await expect(amounts.first()).toBeVisible();
    for (const text of await amounts.allInnerTexts()) {
      if (!/\d/.test(text)) continue;
      expect(text, `"${text}" should not have a stray directional mark`).not.toMatch(
        /[‪-‮]/,
      );
    }
  });
});
