import { expect, test, type Page } from "@playwright/test";
import { TEST_WORKER_ID, switchToTestWorker } from "./household";
import { he } from "../src/lib/i18n/he";
import { formatAgorot, formatDays } from "../src/lib/money";

/**
 * Recuperation through the browser — `specs.md` item 15.
 *
 * **What this file checks that no unit test can.** The month the family names
 * on the profile and the line the month screen draws are two ends of one wire,
 * and a change to the first has to move the second. Every assertion below is
 * about a *result*: a figure on the profile, a row on another screen, an amount
 * that moved because a chip was pressed (`CLAUDE.md` rules 9 and 11).
 *
 * **Every expected figure comes from outside the code under test.**
 *
 * - Six days is the statutory ladder's figure for a second completed employment
 *   year (https://www.kolzchut.org.il/he/דמי_הבראה), and the demo worker was
 *   employed from 1.4.2024, so her second year closes on 31.3.2026 and the
 *   payment falling in 2026 is her second.
 * - ₪451.50 is the same article's private-sector day rate from 1.7.2025.
 * - ₪2,709.00 is 6 × ₪451.50, worked by hand.
 * - The second worker was employed from 1.9.2025, so her first year is not out
 *   by the March 2026 the seed names — the statute's "nothing until a full
 *   working year has been completed".
 *
 * **Each test gets its own store**, for the reason the other specs give: the
 * dev repository is a module singleton keyed by the `household` cookie, so a
 * suffix after the seed name opens a fresh one.
 */

/** Six days at ₪451.50 = ₪2,709.00. Derived above, not read off the engine. */
const DAYS = 6;
const PAYMENT = 270900;

/** The seed pays the first worker in July and the demo holds January to
 * September of 2026, so July is reachable by stepping back from September. */
const SEEDED_MONTH = 7;
/** A month the demo also holds, to move the payment into. */
const MOVED_TO = 5;

const RUN = Date.now().toString(36);

async function useHousehold(page: Page, label: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "household",
      value: `demo-e2e-${RUN}-${label}`,
      url: "http://localhost:3000",
    },
  ]);
}

async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

/** Step the month screen back from the month it opens on. */
async function backTo(page: Page, months: number): Promise<void> {
  for (let step = 0; step < months; step += 1) {
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
  }
}

/** Press one of the twelve month chips on the profile's recuperation row. */
async function chooseMonth(page: Page, month: number): Promise<void> {
  await page
    .locator('[data-terms="recuperationMonth"]')
    .getByRole("button", { name: he.calendar.monthNames[month - 1], exact: true })
    .click();
  await settled(page);
}

test.describe("the recuperation payment (specs.md item 15)", () => {
  test("reports the entitlement on the profile and pays it in the month named", async ({
    page,
  }) => {
    await useHousehold(page, "pays");
    await page.goto(`/workers/${TEST_WORKER_ID}`);

    // The days come from her seniority and are reported, never offered.
    await expect(page.locator("[data-recuperation]")).toContainText(
      formatDays(DAYS),
    );
    await page.screenshot({
      path: "test-results/recuperation-profile.png",
      fullPage: true,
    });

    // And the month screen pays exactly them, at the article's day rate.
    await page.goto("/month");
    await switchToTestWorker(page);
    await backTo(page, 9 - SEEDED_MONTH);
    await expect(row(page, "recuperation")).toContainText(
      formatAgorot(PAYMENT),
    );
    await page.screenshot({
      path: "test-results/recuperation-month.png",
      fullPage: true,
    });
  });

  test("draws no recuperation line in an ordinary month", async ({ page }) => {
    await useHousehold(page, "ordinary");
    await page.goto("/month");
    await switchToTestWorker(page);
    // September is the month the demo opens on and is not the recuperation
    // month. A line drawn here would be a payment made twelve times a year.
    await expect(row(page, "recuperation")).toHaveCount(0);
  });

  /**
   * The wire this spec exists for. Nothing but a browser can show that the chip
   * on one screen moves the money on another: the profile writes a term, the
   * term is snapshotted onto every month that follows the profile, and the
   * month screen recalculates off it.
   */
  test("moves the payment when the family changes the month", async ({
    page,
  }) => {
    await useHousehold(page, "moves");
    await page.goto(`/workers/${TEST_WORKER_ID}`);
    await chooseMonth(page, MOVED_TO);

    await page.goto("/month");
    await switchToTestWorker(page);
    await backTo(page, 9 - MOVED_TO);
    await expect(row(page, "recuperation")).toContainText(
      formatAgorot(PAYMENT),
    );

    // And it has left the month it used to be paid in.
    await page.goto("/month");
    await switchToTestWorker(page);
    await backTo(page, 9 - SEEDED_MONTH);
    await expect(row(page, "recuperation")).toHaveCount(0);
  });

  /**
   * **A worker inside her first employment year is no longer in the demo, and
   * this file no longer checks that case through the browser.**
   *
   * It used to: the second worker began on 1.9.2025, so her recuperation month
   * fell three months before her first year was out and the profile said so by
   * simply being opened. She now begins on 1.4.2024, because every other test
   * here needs a completed year to have anything to pay, and a household holds
   * no more than two workers (item 11) — the other being Hanna, whose months
   * come from the family's own workbooks and whose terms no test may edit.
   *
   * The rule itself is checked against the statute in `recuperation.test.ts`
   * ("pays nothing in the recuperation month of the first employment year").
   * What is *not* checked anywhere is that the profile says it in words rather
   * than printing a bare zero — that is a real gap opened on 2026-09-11 and it
   * is written down here rather than left to be rediscovered. It closes when
   * the application can create a worker, which is stage 3's.
   */
});
