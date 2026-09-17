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
    // The blockages are named, so an advance looked for here is explained.
    await expect(dialog.locator('[data-role="always-shown"]')).toHaveText(
      he.alerts.reminders.alwaysShown,
    );

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

  test("with more than four warnings the bell lists four and counts the rest, and follows a dismissal", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "bell");
    await page.goto("/alerts");
    const bell = page.locator('[data-role="bell"]');
    const count = bell.locator('[data-row="warnings"]');
    const warnings = page.locator('[data-role="alert"][data-list="warning"]');
    await expect(unexported(page, JANUARY)).toHaveCount(1);

    // Warnings only: a blockage is the opening screen's, not the bell's.
    const before = await warnings.count();
    expect(before).toBeGreaterThan(5);
    await expect(count).toHaveText(String(before));

    // The bar is the layout's, which a server action refreshes with the page.
    await unexported(page, JANUARY).getByRole("button", { name: he.alerts.markHandled }).click();
    await expect(unexported(page, JANUARY)).toHaveCount(0);
    await expect(count).toHaveText(String(before - 1));

    // The same figure on another screen. The panel lists the page's first
    // four warnings and counts the rest (item 27).
    const titles = await page
      .locator('[data-role="alert"][data-list="warning"] [data-role="alert-title"]')
      .allInnerTexts();
    await page.goto("/");
    await expect(count).toHaveText(String(before - 1));
    await bell.click();
    const panel = page.locator('[data-role="bell-panel"]');
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect(await panel.locator('[data-role="bell-entry"]').allInnerTexts()).toEqual(
      titles.slice(0, 4).map((title) => expect.stringContaining(title)),
    );
    await expect(panel.locator('[data-role="bell-more"]')).toHaveText(
      he.alerts.more(before - 1 - 4).map((part) => (typeof part === "string" ? part : part.value)).join(""),
    );
    await page.screenshot({ path: "test-results/alerts-bell-panel-more.png" });
    await panel.getByRole("link", { name: he.header.bell.showAll }).click();
    await expect(page).toHaveURL(/\/alerts$/);
  });

  test("with four warnings or fewer the bell opens a panel listing them", async ({ page }) => {
    await useHousehold(page, SPEC, "panel");
    await page.goto("/alerts");
    const bell = page.locator('[data-role="bell"]');
    const panel = page.locator('[data-role="bell-panel"]');
    const reminders = page.getByRole("dialog", { name: he.alerts.reminders.title });

    // Every unexported month is what puts the demo over four; without them
    // what is left is the few the seed's dates raise.
    await page.getByRole("button", { name: he.alerts.settingsLink }).click();
    await reminders
      .getByRole("checkbox", { name: he.alerts.reminders.kinds.monthNotExported })
      .uncheck();
    await reminders.getByRole("button", { name: he.alerts.reminders.close }).click();
    await expect(page.locator('[data-role="alert"]').filter({ hasText: "טרם יוצא" })).toHaveCount(0);
    const titles = await page
      .locator('[data-role="alert"][data-list="warning"] [data-role="alert-title"]')
      .allInnerTexts();
    expect(titles.length).toBeLessThanOrEqual(4);
    await expect(bell.locator('[data-row="warnings"]')).toHaveText(String(titles.length));

    // Opened from another screen, it lists what the page lists, and stays there.
    await page.goto("/");
    await bell.click();
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    const entries = panel.locator('[data-role="bell-entry"]');
    await expect(entries).toHaveCount(titles.length);
    // Four or fewer: nothing is left to count.
    await expect(panel.locator('[data-role="bell-more"]')).toHaveCount(0);
    for (const title of titles) await expect(entries.filter({ hasText: title })).toHaveCount(1);
    await page.screenshot({ path: "test-results/alerts-bell-panel.png" });

    // Esc and a press outside close it.
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await bell.click();
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await expect(panel).toHaveCount(0);

    // Its reminders link opens the same pop-up over the screen. Switching every
    // kind off empties the bell, and the panel says so.
    await bell.click();
    await panel.getByRole("button", { name: he.alerts.settingsLink }).click();
    await expect(reminders).toBeVisible();
    const boxes = reminders.getByRole("checkbox");
    for (let i = 0; i < 4; i += 1) await boxes.nth(i).uncheck();
    await expect(bell.locator('[data-row="warnings"]')).toHaveText("0");
    await reminders.getByRole("button", { name: he.alerts.reminders.close }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(panel).toContainText(he.header.bell.nothing);
    await expect(entries).toHaveCount(0);

    // 'Show all' leads to the page.
    await panel.getByRole("link", { name: he.header.bell.showAll }).click();
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(panel).toHaveCount(0);
  });
});

test.describe("the opening screen's blocker strip (specs.md item 27)", () => {
  test("leads with the first four blockages /alerts lists, counts the rest, and no warning", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "strip");

    await page.goto("/alerts");
    const listed = await page
      .locator('[data-role="alert"][data-list="blockage"] [data-role="alert-title"]')
      .allInnerTexts();
    // The seed records national insurance for January–March 2026 only
    // (`seed.ts`, month 4), so from July 2026 the test worker's second quarter
    // is owed — and it is listed after the first worker's four or more.
    const quarter = `${he.calendar.monthNames[3]} 2026 – ${he.calendar.monthNames[5]} 2026`;
    const words = he.alerts.entry.nationalInsurance(quarter);
    const owed = page
      .locator('[data-role="alert"][data-list="blockage"]')
      .filter({ hasText: words.title.join("") })
      .filter({ hasText: he.placeholder.name })
      .filter({ hasText: quarter });
    await expect(owed).toHaveCount(1);
    expect(listed.length).toBeGreaterThan(4);

    await page.goto("/");
    const strip = page.locator('[data-role="blocker"]');
    await expect(strip.first()).toBeVisible();
    expect(await strip.locator('[data-role="blocker-title"]').allInnerTexts()).toEqual(
      listed.slice(0, 4),
    );
    // A month not yet exported is the bell's, not the strip's.
    await expect(strip.filter({ hasText: "טרם יוצא" })).toHaveCount(0);
    await expect(page.locator('[data-role="blockers-more"]')).toContainText(
      String(listed.length - 4),
    );
    await page.screenshot({ path: "test-results/home-blocker-strip.png" });

    // A card leads where its entry on the page does.
    const first = strip.first().getByRole("link").first();
    const href = await first.getAttribute("href");
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));

    // "Show all" leads to the page, where the rest are.
    await page.goto("/");
    await page
      .locator('[data-role="blockers-more"]')
      .getByRole("link", { name: he.header.bell.showAll })
      .click();
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(owed).toHaveCount(1);
  });
});
