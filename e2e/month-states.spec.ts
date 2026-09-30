import { expect, test, type Page } from "@playwright/test";
import { useHousehold, switchToTestWorker, TODAY } from "./household";
import { SATURDAY, addMonths, monthOf } from "../src/lib/dates";
import { monthLabel } from "../src/lib/dateLabels";
import { he } from "../src/lib/i18n/he";

/**
 * Part 5's four states of a month, driven through the interface end to end —
 * `דף העובד`'s badges, and the chip on `העובדות`.
 *
 * **The states are not assertable from the engine alone**, which is why this is
 * a browser spec and not a unit test: `monthState` is checked against Part 5's
 * sentences in `src/lib/engine/monthState.test.ts`, and the store's stamping
 * rule in `repository.test.ts`, but neither can show that *confirming* a month
 * through the pre-export screen and *pressing the download button* move it
 * through those states while editing it afterwards sends it back. That wiring —
 * three screens and a store — is where it breaks.
 *
 * **What this would catch**, and each has a way of looking entirely plausible:
 * a month that reads as corrected the moment it is filed, because the
 * confirmation and the store's own stamp come off two clocks a millisecond
 * apart; a download counted as an edit, which would report every exported month
 * as corrected; and a correction to an exported month that goes on reporting
 * itself as exported, which is criterion 13's chain left standing on a file
 * nobody would know to produce again.
 *
 * The worker is named and never taken as whichever comes first
 * (`build_plan.md`): `worker-2` carries the ordinary terms.
 */

const WORKER = "worker-2";

/** The last month that has ended, which is the only one that can be confirmed
 * (criterion 21). Read off the clock, so the spec is not pinned to a month. */
function endedMonth() {
  return addMonths(monthOf(TODAY), -1);
}

function param(month: { year: number; month: number }): string {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}

/** The badge on that month's row of their page, by the month it belongs to. */
function badge(page: Page, month: { year: number; month: number }) {
  return page.locator(`[data-month="${param(month)}"] [data-state]`);
}

/** Answer every pre-export question with "no", which is what the demo's ended
 * month is true of except the holiday it records as worked. */
async function answerEverything(page: Page): Promise<void> {
  const questions = page.locator("[data-question]");
  const count = await questions.count();
  for (let index = 0; index < count; index += 1) {
    const row = questions.nth(index);
    const key = await row.getAttribute("data-question");
    await row
      .getByRole("button", {
        name:
          key === "holidaysWorked"
            ? he.beforeExport.questions.yes
            : he.beforeExport.questions.no,
        exact: true,
      })
      .click();
  }
}

test.describe("a month moves through its four states (specs.md Part 5)", () => {
  test("is a draft, becomes exported, and says so again after a correction", async ({
    page,
  }) => {
    await useHousehold(page, "states", "lifecycle");
    const month = endedMonth();

    // **Draft.** The seed records facts and confirms nothing, which is what a
    // month the user has not yet taken through the export conversation is.
    await page.goto(`/workers/${WORKER}`);
    await expect(badge(page, month)).toHaveAttribute("data-state", "draft");
    await expect(badge(page, month)).toHaveText(
      he.workers.profile.months.state.draft,
    );

    // **The gesture: the month is confirmed and a file is produced from it.**
    // The whole conversation as the user meets it — no store call, no direct
    // hit on the export address.
    await page.goto("/month/export");
    await switchToTestWorker(page);
    await answerEverything(page);
    const finish = page.locator("[data-finish]");
    await expect(finish).toBeEnabled();
    const download = page.waitForEvent("download");
    await finish.click();
    await download;

    // **Exported**, and *not* corrected: producing a file is not an edit to the
    // month, and confirming it is not a correction of itself.
    await page.goto(`/workers/${WORKER}`);
    await expect(badge(page, month)).toHaveAttribute("data-state", "exported");
    await expect(badge(page, month)).toHaveText(
      he.workers.profile.months.state.exported,
    );
    await page.screenshot({
      path: "test-results/month-states-exported.png",
      fullPage: true,
    });

    // **The gesture: a day of that month is marked afterwards.** The opening
    // screen opens on the current month, so the stepper goes back one — the
    // same click a user makes to correct a month they have already filed.
    await page.goto("/");
    await switchToTestWorker(page);
    await page
      .getByRole("button", { name: he.calendar.previousMonth })
      .click();
    const day = `${param(month)}-14`;
    await page.locator(`[data-date="${day}"]`).click();
    await page.locator(`[data-date="${day}"]`).click();
    await page
      .getByRole("button", {
        name: he.calendar.marks(SATURDAY).vacation,
        exact: true,
      })
      .click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    // **Corrected**, and not still exported. The file already produced no
    // longer matches the month, which is the whole reason the state exists.
    await page.goto(`/workers/${WORKER}`);
    await expect(badge(page, month)).toHaveAttribute("data-state", "corrected");
    await expect(badge(page, month)).toHaveText(
      he.workers.profile.months.state.corrected,
    );
    await page.screenshot({
      path: "test-results/month-states-corrected.png",
      fullPage: true,
    });

    // And the row now says the day that was marked, beside the figure: the
    // count on the row is the month's own and moves with it.
    await expect(page.locator(`[data-month="${param(month)}"]`)).toContainText(
      he.workers.profile.months.days.vacation("1"),
    );
  });
});

test.describe("the chip on a worker's card names where to start", () => {
  test("names the earliest month still waiting, not the latest", async ({
    page,
  }) => {
    // **The earliest, because that is where the user has to start**: balances
    // replay forward (item 13), so confirming August over an unfiled January
    // would be confirming a month whose opening position is still moving.
    //
    // January 2026 is the demo worker's first month (`seed.ts`), and the seed
    // confirms none of them — so the chip's month is a fact about the fixture
    // and not a figure read off the screen. What this would catch is a chip
    // that names the last month instead, which looks entirely right on a
    // household whose months are all filed but one.
    await useHousehold(page, "states", "chip");
    await page.goto("/workers");

    const chip = page.locator(`#worker-${WORKER} [data-row="worker-status"]`);
    await expect(chip).toHaveAttribute("data-waiting", "yes");
    await expect(chip).toHaveText(
      he.workers.status.waiting(monthLabel({ year: 2026, month: 1 })),
    );
  });
});

test.describe("a month row leads to that month's payslip", () => {
  test("opens the month it names and not whichever the screen opened on", async ({
    page,
  }) => {
    await useHousehold(page, "states", "row-link");
    const month = endedMonth();

    await page.goto(`/workers/${WORKER}`);
    await page.locator(`[data-month="${param(month)}"] a`).click();

    // The payslip takes the month off the address, so the heading is the month
    // that was clicked — the failure this catches is a row that links to the
    // payslip and lands on the current month, which looks like a working link.
    await expect(page).toHaveURL(new RegExp(`month=${param(month)}$`));
    await expect(page.locator("h1")).toContainText(
      he.calendar.monthNames[month.month - 1],
    );
  });
});
