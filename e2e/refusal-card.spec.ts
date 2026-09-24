import { expect, test } from "@playwright/test";
import { switchToTestWorker, useHousehold } from "./household";
import { SATURDAY } from "../src/lib/dates";
import { fullDayLabel } from "../src/lib/dateLabels";
import { he } from "../src/lib/i18n/he";
import { legalLinks } from "../src/lib/links";

/**
 * A month the engine refused, said as a card (`specs.md` item 25, Part 4,
 * `build_plan.md` stage 8¾).
 *
 * **What this catches.** `InvalidMonthError` carries a Hebrew sentence per
 * refusal, the dates it names and the rule behind it, and until this stage
 * nothing drew any of it: `calculateMonth` threw, `calculateSeries` propagated,
 * and the four screens that replay all failed — so a sentence written for the
 * user arrived as a stack trace and the household had no way back in. It would
 * also catch the half-fix, which is a screen that catches the refusal and draws
 * a blank: the calendar has to survive it, because the mark to correct is on it.
 *
 * **The household is seeded into the refused state and not clicked into it.**
 * Every gesture that could produce one is guarded — the calendar refuses a
 * second mark on a day, the picker withholds a kind no selected day can take,
 * and the rest-day panel answers a stranded mark before saving — so the state
 * the engine refuses is by construction one that arrived another way
 * (`src/lib/dev/seed.ts`).
 *
 * **August 2026 and not September**, which is the run's own month: the seed
 * puts the two marks on 2026-08-20, one month before today (2026-09-18), so
 * every assertion below also proves the card names the month at fault rather
 * than the month the screen was asked for.
 */

const REFUSED_MONTH = "אוגוסט 2026";
const REFUSED_DAY = "2026-08-20";

test.describe("a refused month says so", () => {
  test("draws the card on the opening screen, with the calendar still under it", async ({
    page,
  }) => {
    await useHousehold(page, "refused", "home");
    await page.goto("/");
    await switchToTestWorker(page);

    const card = page.locator('[data-role="refusal"]');
    await expect(card).toBeVisible();
    // The month at fault, which is not the month the screen would have opened
    // on: one refused month stops the replay of every month after it.
    await expect(card.locator('[data-role="refusal-month"]')).toContainText(
      REFUSED_MONTH,
    );
    // One reason, because the seed's one day carries one refusal — and the
    // engine's own sentence, not a sentence this screen wrote.
    await expect(card.locator('[data-role="refusal-reason"]')).toHaveCount(1);
    await expect(card).toContainText(he.sheet.refusals.dayRecordedTwice);
    // The date beside the sentence rather than inside it, isolated.
    await expect(card.locator('[data-role="refusal-date"]')).toHaveText(
      fullDayLabel(REFUSED_DAY),
    );
    // The rule the refused action rests on (item 25) — the rule of the mark
    // that collided, which for a day holding two of them is one of the two.
    const law = card.getByRole("link");
    await expect(law).toHaveCount(1);
    expect([legalLinks.sickPay.url, legalLinks.holidayWork.url]).toContain(
      await law.getAttribute("href"),
    );

    // The figures are gone, and the calendar is not. **The mark is what is
    // asserted and not the grid**: an empty August would draw every day cell
    // just the same, so what proves the calendar survived the refusal is that
    // it still names what is on the day the user has to correct — which it can
    // only do by reading her spans, since there is no valued month to read.
    await expect(page.locator('[data-row="net"]')).toHaveCount(0);
    await expect(page.locator(`[data-date="${REFUSED_DAY}"]`)).toContainText(
      he.calendar.marks(SATURDAY).holiday,
    );

    await page.screenshot({
      path: "test-results/refusal-card-home.png",
      fullPage: true,
    });
  });

  test("says the same thing on the payslip, the payments screen and the reports", async ({
    page,
  }) => {
    await useHousehold(page, "refused", "other-screens");
    for (const route of ["/month/payslip", "/payments", "/reports"]) {
      await page.goto(route);
      const card = page.locator('[data-role="refusal"]');
      await expect(card).toBeVisible();
      await expect(card.locator('[data-role="refusal-month"]')).toContainText(
        REFUSED_MONTH,
      );
      await expect(card).toContainText(he.sheet.refusals.dayRecordedTwice);
    }
  });

  test("clearing the day brings the figures back", async ({ page }) => {
    await useHousehold(page, "refused", "corrected");
    await page.goto("/");
    await switchToTestWorker(page);
    await expect(page.locator('[data-role="refusal"]')).toBeVisible();

    // The gesture a user makes: sweep over the day and clear what is on it.
    // The screen has already opened on August, because the card's month is the
    // month it opens on. The sweep starts on the day before, because a first
    // click on a holiday asks whether it was worked rather than anchoring a
    // range (`MonthCalendar.tsx`) — and the 19th carries no mark of its own.
    await page.locator('[data-date="2026-08-19"]').click();
    await page.locator(`[data-date="${REFUSED_DAY}"]`).click();
    await page
      .getByRole("button", { name: he.calendar.picker.clear, exact: true })
      .click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    // The card is gone and the month is valued again — and so is every month
    // after it, which the refusal had been stopping.
    await expect(page.locator('[data-role="refusal"]')).toHaveCount(0);
    await expect(page.locator('[data-row="net"]')).toBeVisible();
    await page.goto("/month/payslip?month=2026-09");
    await expect(page.locator('[data-role="refusal"]')).toHaveCount(0);

    await page.screenshot({
      path: "test-results/refusal-card-corrected.png",
      fullPage: true,
    });
  });
});
