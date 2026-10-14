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
 * twelve months run to August 2027 and hold all four. September 2026 is the
 * suite's own day (`TODAY` in `household.ts`), not the machine's.
 *
 * **The permit's month holds two rows and not one.** Its request fee and its
 * licence fee both read the permit's own expiry (item 15), so November 2026
 * draws them one under the other in the sheet's order. They are the one pair in
 * this list that shares a month and a date, which is what makes an amount
 * reaching the wrong row invisible anywhere else.
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
    const request = he.sheet.thirdParty.workerVisa;
    const licence = he.sheet.thirdParty.licenceFee;
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText(visa);
    await expect(rows.nth(0)).toContainText(month(9, 2026));
    // The permit's two fees, in the sheet's order: its request fee above its
    // licence fee, both in the month the permit itself expires.
    await expect(rows.nth(1)).toContainText(request);
    await expect(rows.nth(1)).toContainText(month(10, 2026));
    await expect(rows.nth(2)).toContainText(licence);
    await expect(rows.nth(2)).toContainText(month(10, 2026));
    await expect(rows.nth(3)).toContainText(words.recuperation);
    await expect(rows.nth(3)).toContainText(month(6, 2027));
    await expect(rows.nth(3)).toContainText(`6 ${he.units.days}`);
    // Nothing was paid for any of the fees, so none states an amount.
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

    // ₪340 of the permit's request fee, the family's own figure for it
    // (`שכר_חודשי_להאנה2026.xlsx` -> `תלוש משכורת חודשי` -> D15). It must land on
    // the request fee's row and not on the licence fee's, which shares its month
    // and its date and is the only row it could be confused with.
    await group.getByRole("button", { name: actions.add, exact: true }).click();
    await group.getByRole("button", { name: request, exact: true }).click();
    await group.getByLabel(actions.amount).fill("340");
    await group.getByLabel(actions.paidOn).fill("2026-09-11");
    await group.getByRole("button", { name: actions.submit, exact: true }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    await expect(upcomingRow(page, request)).toContainText(month(10, 2026));
    await expect(upcomingRow(page, request)).toContainText(formatAgorot(34000));
    await expect(upcomingRow(page, licence)).not.toContainText(words.lastPaid);
    await page.screenshot({ path: "test-results/payments-upcoming.png", fullPage: true });

    // A reminder, not a month: stepping the month back leaves it as it was.
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
    await expect(rows).toHaveCount(4);
  });
});
