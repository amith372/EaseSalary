import { expect, test, type Page } from "@playwright/test";
import { openPaymentSections, switchToTestWorker, useHousehold } from "./household";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";

/**
 * "לקראת החודשים הבאים" on the payments screen (specs.md item 15), for the test
 * worker of the demo seed.
 *
 * **Where the expected rows come from.** `seed.ts`: their work visa expires on
 * 15 October 2026 and their permit on 30 November 2026; they were employed from
 * 1 April 2024 with July as their recuperation month, so July 2027 completes them
 * third year and owes 6 days (item 15's ladder: 5, then 6 for years two and
 * three); no fee has been paid for them. Counted from September 2026, the
 * twelve months run to August 2027 and hold all three. September 2026 is the
 * suite's own day (`TODAY` in `household.ts`), not the machine's.
 */

const SPEC = "upcoming";
const month = (index: number, year: number) => `${he.calendar.monthNames[index]} ${year}`;

function upcomingRow(page: Page, title: string) {
  return page.locator('[data-role="upcoming"]').filter({ hasText: title });
}

test.describe("what falls due in the next twelve months (specs.md item 15)", () => {
  test("lists the fees and recuperation by month, and a recorded fee brings its amount", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "list");
    await page.goto("/payments");
    await switchToTestWorker(page);

    const words = he.payments.upcoming;
    const rows = page.locator('[data-role="upcoming"]');
    await expect(page.getByRole("heading", { name: words.title })).toBeVisible();

    const visa = he.sheet.thirdParty.visaExtensionFee;
    const licence = he.sheet.thirdParty.licenceFee;
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText(visa);
    await expect(rows.nth(0)).toContainText(month(9, 2026));
    await expect(rows.nth(1)).toContainText(licence);
    await expect(rows.nth(1)).toContainText(month(10, 2026));
    await expect(rows.nth(2)).toContainText(words.recuperation);
    await expect(rows.nth(2)).toContainText(month(6, 2027));
    await expect(rows.nth(2)).toContainText(`6 ${he.units.days}`);
    // Nothing was paid for either fee, so neither states an amount.
    await expect(page.getByText(words.lastPaid)).toHaveCount(0);

    // Record ₪350 of visa extension fee in September through the screen.
    await openPaymentSections(page);
    const actions = he.month.actions.thirdParty;
    const group = page.locator('[data-group="thirdParty"]');
    await group.getByRole("button", { name: actions.add, exact: true }).click();
    await group.getByRole("button", { name: visa, exact: true }).click();
    await group.getByLabel(actions.amount).fill("350");
    await group.getByLabel(actions.paidOn).fill("2026-09-10");
    await group.getByRole("button", { name: actions.submit, exact: true }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    // Its month is still the visa's own, and it now says what was paid last.
    await expect(upcomingRow(page, visa)).toContainText(month(9, 2026));
    await expect(upcomingRow(page, visa)).toContainText(formatAgorot(35000));
    await expect(upcomingRow(page, visa)).toContainText(words.lastPaid);
    await expect(upcomingRow(page, licence)).not.toContainText(words.lastPaid);
    await page.screenshot({ path: "test-results/payments-upcoming.png", fullPage: true });

    // A reminder, not a month: stepping the month back leaves it as it was.
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
    await expect(rows).toHaveCount(3);
  });
});
