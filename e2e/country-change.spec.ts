import { expect, test, type Page } from "@playwright/test";
import {
  openSettingsGroups,
  switchToTestWorker,
  useHousehold,
} from "./household";
import { he } from "../src/lib/i18n/he";

/**
 * The worker's country of origin, corrected after the wizard (`specs.md` item
 * 10, `build_plan.md` stage 8⅞).
 *
 * **What this catches.** Until this stage `profile.country` was written once by
 * the wizard and by nothing since — no row on `/settings`, no action — so a
 * family that chose the wrong country in the wizard held a profile permanently
 * wrong about where she is from, and printed it on `/workers` and on her own
 * page. A unit test does not see that: every function involved was correct, and
 * what was missing was a way in.
 *
 * **The two halves of the correction are asserted apart**, because they pull
 * against each other. The country is the *default* her holiday list is drawn
 * from (`holidaySourceOf`), so a worker never moved off it follows the
 * correction — and a worker deliberately moved to another list must not, or a
 * family fixing a typo would silently undo the list they had chosen for her.
 *
 * The second worker is seeded from India and the first from the Philippines
 * (`seed.ts`), and neither carries a stored `holidaySource`, so the second
 * worker starts on India's list by default and both names are read off the
 * shipped `data/holidays/*.json` files.
 */

const SPEC = "country";

/** As `data/holidays/IN-2026.json` and `PH-2026.json` publish them. */
const INDIA = "הודו";
const PHILIPPINES = "הפיליפינים";

/** The country row's chips, addressed by the row rather than by the Hebrew
 * beside them. */
function countryChip(page: Page, name: string) {
  return page.locator('[data-terms="country"] button', { hasText: name });
}

/** The line her own page prints her country on — the label the list card and
 * her page share, with the name after it. */
function countryLine(page: Page) {
  return page.locator("p", { hasText: he.workers.country });
}

async function openSettings(page: Page): Promise<void> {
  await page.goto("/settings");
  await switchToTestWorker(page);
  await openSettingsGroups(page);
}

test.describe("the country of origin is correctable", () => {
  /**
   * What it catches: a correction that reaches the profile and nothing else —
   * a `/workers` card or a worker's page still printing the country the wizard
   * stored, or a holiday picker still offering the old country's list as the
   * one she is on.
   */
  test("reaches every screen that names it, and the list drawn from it", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "corrected");

    await openSettings(page);
    // Before: seeded from India, and the row says so.
    await expect(countryChip(page, INDIA)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(countryChip(page, PHILIPPINES)).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await countryChip(page, PHILIPPINES).click();
    await expect(countryChip(page, PHILIPPINES)).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 15000 },
    );
    await expect(countryChip(page, INDIA)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.screenshot({
      path: "test-results/country-corrected.png",
      fullPage: true,
    });

    // The list screen, which names her country as a fact about her. Her card
    // and not the other worker's: the second worker is `worker-2` in the demo
    // seed, and the first is from the Philippines already — so a card asserted
    // by name alone would pass on the wrong one.
    await page.goto("/workers");
    const card = page.locator("#worker-worker-2");
    await expect(card).toContainText(`${he.workers.country} ${PHILIPPINES}`);
    await expect(card).not.toContainText(INDIA);

    // Her own page, reached as a user reaches it.
    await card.getByRole("link", { name: he.workers.toProfile("") }).click();
    await expect(page).toHaveURL(/\/workers\/worker-2$/);
    const line = countryLine(page).first();
    await expect(line).toContainText(PHILIPPINES);
    await expect(line).not.toContainText(INDIA);

    // And the default her holiday list is drawn from, which she was never
    // moved off: the Philippines' list is the one she is on now.
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);
    await expect(page.locator('[data-source="PH"]')).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 15000 },
    );
    await expect(page.locator('[data-source="IN"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  /**
   * What it catches: a `setCountry` that wrote the holiday source as well as
   * the country — the obvious way to make the first test pass — which would
   * throw away a list the family chose on purpose, and say nothing about it.
   */
  test("leaves a worker moved to another list where she was put", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "moved");

    // Moved on purpose, through the picker, before the country is touched.
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);
    await page.locator('[data-source="NP"]').click();
    await expect(page.locator('[data-source="NP"]')).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 15000 },
    );

    await openSettings(page);
    await countryChip(page, PHILIPPINES).click();
    await expect(countryChip(page, PHILIPPINES)).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 15000 },
    );

    // The correction moved the default and not her list.
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);
    await expect(page.locator('[data-source="NP"]')).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 15000 },
    );
    await expect(page.locator('[data-source="PH"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  /**
   * What it catches: a country that reached the month. `MonthTerms` does not
   * carry it, so a correction must move no figure — and a month already
   * confirmed least of all.
   */
  test("moves no figure on the month it is corrected in", async ({ page }) => {
    await useHousehold(page, SPEC, "figures");

    await page.goto("/");
    await switchToTestWorker(page);
    const card = page.locator('[data-row="net"]');
    await expect(card).toBeVisible();
    // The amount alone, and not the row's whole text: the row carries its
    // label and its "why" button beside the figure, and it is the figure that
    // must not move.
    const before = (await card.innerText()).match(/[\d,]+\.\d\d/)?.[0];
    expect(before).toBeDefined();

    await openSettings(page);
    await countryChip(page, PHILIPPINES).click();
    await expect(countryChip(page, PHILIPPINES)).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 15000 },
    );

    await page.goto("/");
    await switchToTestWorker(page);
    await expect(card).toContainText(before as string);
  });
});
