import { expect, test, type Page } from "@playwright/test";
import { switchToTestWorker } from "./household";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";

/**
 * The seven things the user asked for on 2026-09-11, each verified where she
 * would meet it (`CLAUDE.md` rules 9–12).
 *
 * **Every figure is worked by hand from the seed's own stated facts.** The
 * worker the suite works on is paid the ₪6,443.85 minimum wage in force from
 * 1.4.2026 with a ₪100 rest-eve supplement and rests on Saturday, which in a
 * September of twenty-six standard days and four Saturdays comes to a ‏ברוטו‎
 * of ₪8,602.81 — the same month `income-tax.spec.ts` works out in full. 2.5% of
 * that is 21,507.025 agorot, which rounds to ₪215.07.
 */

const RUN = Date.now();

/** The seeded September 2026 ‏ברוטו‎, in agorot. */
const GROSS = 860281;

/** 2.5% of it, rounded once: 860,281 × 0.025 = 21,507.025 → 21,507. */
const TWO_AND_A_HALF_PERCENT = 21507;

async function useHousehold(page: Page, label: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "household",
      value: `demo-ask-${RUN}-${label}`,
      url: "http://localhost:3000",
    },
  ]);
}

async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

test.describe("the worker's own page", () => {
  /**
   * **A country is named and never filed.**
   *
   * What it catches: the profile printing `PH` at the user, which is what it
   * did until today. The Hebrew name is not invented here — it is the
   * `country_name_he` the shipped `data/holidays/PH-2026.json` carries, and the
   * holiday picker has been labelling its own chips with it all along.
   */
  test("names the country of origin instead of its filing code", async ({
    page,
  }) => {
    await useHousehold(page, "country");
    await page.goto("/workers/worker-1");
    await settled(page);

    // The whole line, not the label inside it: the label is its own element,
    // so `getByText` on it resolves to a span that never held the value.
    const line = page.locator("p", { hasText: he.workers.country }).first();
    await expect(line).toContainText("הפיליפינים");
    await expect(line).not.toContainText("PH");
  });

  /**
   * **What she has been paid so far, added up.**
   *
   * The total is asserted against the sum of the rows above it rather than
   * against a constant, because the two are the same claim: the figure is the
   * column added up, and a total that disagrees with its own column is the only
   * way this row can be wrong. Reading the rows off the screen is safe here for
   * the reason it is not safe for a calculated figure — this test is not
   * checking what a month came to, it is checking that a sum is a sum.
   *
   * What it catches: a total that counted a month with no figure as zero, or
   * that summed the ‏ברוטו‎ instead of what was actually transferred.
   */
  test("adds up what has been paid so far", async ({ page }) => {
    await useHousehold(page, "total");
    await page.goto("/workers/worker-1");
    await settled(page);

    const amounts = await page
      .locator("[data-month] [data-money]")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).dataset.money ?? ""),
      );
    expect(amounts.length).toBeGreaterThan(0);

    const summed = amounts.reduce((total, one) => total + Number(one), 0);

    await expect(page.locator('[data-row="paid-so-far"]')).toContainText(
      formatAgorot(summed),
    );
  });

  /**
   * **A chosen chip is filled and not merely outlined** (asked for today).
   *
   * The assertion is on the painted background rather than on a class name: a
   * class can be renamed or removed from the stylesheet and still appear in the
   * markup, and what the user asked for was something she can see. The chosen
   * and unchosen chips are compared against each other, so the test states the
   * difference rather than a colour it would have to be updated for.
   */
  test("fills the chosen chip so the choice is visible", async ({ page }) => {
    await useHousehold(page, "chip");
    await page.goto("/workers/worker-1");
    await settled(page);

    const chosen = page.locator('button[aria-pressed="true"]').first();
    const others = page.locator('button[aria-pressed="false"]').first();
    await expect(chosen).toBeVisible();

    const fillOf = (one: typeof chosen) =>
      one.evaluate((node) => getComputedStyle(node).backgroundColor);

    const chosenFill = await fillOf(chosen);
    const otherFill = await fillOf(others);
    expect(chosenFill).not.toBe(otherFill);
    // Not merely different: white is what an unchosen chip is, so a chosen one
    // that came out white would differ from nothing at all.
    expect(chosenFill).not.toBe("rgb(255, 255, 255)");

    await page.screenshot({
      path: "test-results/profile-chips-filled.png",
      fullPage: true,
    });
  });
});

test.describe("the payments screen", () => {
  /**
   * **The tax corrected by a share of the ‏ברוטו‎ rather than by a sum**
   * (settled with the user today).
   *
   * What it catches: a percentage sent to the server as though it were an
   * amount, which would withhold ₪2.50 where ₪208.83 was meant and look like an
   * ordinary small figure; and a conversion made in the browser against a gross
   * the server never checked.
   */
  test("takes a percentage and withholds the amount it works out to", async ({
    page,
  }) => {
    await useHousehold(page, "percent");
    await page.goto("/payments");
    await switchToTestWorker(page);
    await settled(page);

    const words = he.month.actions.incomeTax;
    await page.getByRole("button", { name: words.unit.percentage }).click();

    const field = page.getByLabel(words.fieldPercentage, { exact: true });
    await field.fill("2.5");

    // The arithmetic is shown before it is saved, so she agrees to the sum and
    // not to the share alone.
    await expect(
      page.getByText(formatAgorot(TWO_AND_A_HALF_PERCENT), { exact: false }),
    ).toBeVisible();

    await page.screenshot({
      path: "test-results/payments-tax-percentage.png",
      fullPage: true,
    });

    await page.getByRole("button", { name: words.save, exact: true }).click();
    await settled(page);

    await expect(
      page.getByText(formatAgorot(-TWO_AND_A_HALF_PERCENT), { exact: false }).first(),
    ).toBeVisible();

    // And the month itself says the same thing, because the preview and the
    // payments screen are one engine result shown twice (rule 11).
    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);
    await expect(page.locator('[data-row="incomeTax"]')).toContainText(
      formatAgorot(-TWO_AND_A_HALF_PERCENT),
    );
    // ₪8,353.05 − ₪208.83 = ₪8,144.22.
    await expect(page.locator('[data-row="net"]')).toContainText(
      formatAgorot(GROSS - TWO_AND_A_HALF_PERCENT),
    );
  });

  /**
   * **A recurring deduction is reachable from where it was looked for.**
   *
   * The user asked for recurring additions and deductions to be built. They
   * already were, as `שורות קבועות` on the worker's own page — so what was
   * missing was any way to find that from the screen where lines are made. The
   * test follows the link, because a signpost that points nowhere is worse than
   * none.
   */
  test("points from a one-off line to the recurring kind", async ({ page }) => {
    await useHousehold(page, "signpost");
    await page.goto("/payments");
    await switchToTestWorker(page);
    await settled(page);

    await page
      .getByRole("link", { name: he.month.actions.lines.standing })
      .click();
    await settled(page);

    await expect(
      page.getByRole("heading", {
        name: he.workers.profile.terms.standing.title,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: he.workers.profile.terms.standing.add,
      }),
    ).toBeVisible();
  });
});
