import { expect, test, type Page } from "@playwright/test";
import { switchToTestWorker, useHousehold } from "./household";
import { he } from "../src/lib/i18n/he";

/**
 * `/alerts` through the browser (specs.md item 27).
 *
 * **What every assertion rests on, whatever day the suite runs.** The demo
 * seed records no export on any month (`seed.ts`), and the test worker's first
 * month is January 2026, so from February 2026 onward "January 2026 not yet
 * exported" is a warning on her list, and "February 2026" one beside it from
 * March. Nothing below depends on which other entries today's date raises: the
 * blockages are counted before and after and compared with themselves.
 */

const SPEC = "alerts";
const JANUARY = `${he.calendar.monthNames[0]} 2026`;
const FEBRUARY = `${he.calendar.monthNames[1]} 2026`;

function unexported(page: Page, month: string) {
  return page
    .locator('[data-role="alert"][data-list="warning"]')
    .filter({ hasText: `${month} טרם יוצא` })
    .filter({ hasText: he.placeholder.name });
}

test.describe("the alerts page (specs.md item 27)", () => {
  test("'mark as handled' removes a month not yet exported and leaves the rest", async ({ page }) => {
    await useHousehold(page, SPEC, "not-now");
    await page.goto("/alerts");
    await expect(page.locator("h1")).toHaveText(he.alerts.title);

    const blockages = page.locator('[data-role="alert"][data-list="blockage"]');
    const blockagesBefore = await blockages.count();
    // A blockage carries no 'not now' (item 27): it cannot be put off.
    for (let i = 0; i < blockagesBefore; i += 1) {
      await expect(
        blockages.nth(i).getByRole("button", { name: he.alerts.notNow }),
      ).toHaveCount(0);
    }

    await expect(unexported(page, JANUARY)).toHaveCount(1);
    await expect(unexported(page, FEBRUARY)).toHaveCount(1);
    await page.screenshot({ path: "test-results/alerts-before-not-now.png" });

    // A month not yet exported offers 'mark as handled' and not 'not now'.
    await expect(
      unexported(page, JANUARY).getByRole("button", { name: he.alerts.notNow }),
    ).toHaveCount(0);
    await unexported(page, JANUARY).getByRole("button", { name: he.alerts.markHandled }).click();

    await expect(unexported(page, JANUARY)).toHaveCount(0);
    await expect(unexported(page, FEBRUARY)).toHaveCount(1);
    await expect(blockages).toHaveCount(blockagesBefore);

    // It is remembered, not a state of the page, and records no export.
    await page.reload();
    await expect(unexported(page, FEBRUARY)).toHaveCount(1);
    await expect(unexported(page, JANUARY)).toHaveCount(0);
    await expect(
      page.locator('[data-role="handled"]').filter({ hasText: JANUARY }),
    ).toHaveCount(0);
  });

  test("a warning kind switched off in the pop-up is not listed", async ({ page }) => {
    await useHousehold(page, SPEC, "switch");
    await page.goto("/alerts");
    const blockages = page.locator('[data-role="alert"][data-list="blockage"]');
    const notExported = page.locator('[data-role="alert"]').filter({ hasText: "טרם יוצא" });
    await expect(unexported(page, JANUARY)).toHaveCount(1);
    const blockagesBefore = await blockages.count();

    await page.getByRole("button", { name: he.alerts.settingsLink }).click();
    const dialog = page.getByRole("dialog", { name: he.alerts.reminders.title });
    await expect(dialog).toBeVisible();
    // The kinds and nothing else, every one on by default.
    const boxes = dialog.getByRole("checkbox");
    await expect(boxes).toHaveCount(4);
    for (let i = 0; i < 4; i += 1) await expect(boxes.nth(i)).toBeChecked();

    const box = dialog.getByRole("checkbox", { name: he.alerts.reminders.kinds.monthNotExported });
    await box.uncheck();
    await expect(box).not.toBeChecked();
    await page.screenshot({ path: "test-results/alerts-reminders-dialog.png" });
    await dialog.getByRole("button", { name: he.alerts.reminders.close }).click();
    await expect(dialog).toBeHidden();

    await expect(notExported).toHaveCount(0);
    await expect(blockages).toHaveCount(blockagesBefore);

    // Saved, and not only drawn.
    await page.reload();
    await expect(notExported).toHaveCount(0);
    await page.getByRole("button", { name: he.alerts.settingsLink }).click();
    await expect(
      page
        .getByRole("dialog", { name: he.alerts.reminders.title })
        .getByRole("checkbox", { name: he.alerts.reminders.kinds.monthNotExported }),
    ).not.toBeChecked();
  });

  test("a month exported from the reports is listed as handled, and leaves the list", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "handled");
    await page.goto("/alerts");
    const handled = page.locator('[data-role="handled"]').filter({ hasText: "יוצא" });
    const exportedBefore = await handled.count();
    const warningsBefore = await page
      .locator('[data-role="alert"]')
      .filter({ hasText: "טרם יוצא" })
      .count();

    await page.goto("/reports");
    await switchToTestWorker(page);
    const link = page.getByRole("link", { name: he.reports.previousMonths.excel }).first();
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    await download.path();

    await page.goto("/alerts");
    await expect(handled).toHaveCount(exportedBefore + 1);
    await expect(handled.first()).toContainText(he.placeholder.name);
    await expect(
      page.locator('[data-role="alert"]').filter({ hasText: "טרם יוצא" }),
    ).toHaveCount(warningsBefore - 1);
    // Tall enough for the whole list: the page scrolls inside `<main>`, which a
    // full-page screenshot does not reach.
    await page.setViewportSize({ width: 1280, height: 2600 });
    await page.screenshot({ path: "test-results/alerts-after-export.png" });
  });
});
