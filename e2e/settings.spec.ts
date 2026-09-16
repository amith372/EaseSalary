import { expect, test } from "@playwright/test";
import {
  TEST_WORKER_NAME,
  openSettingsForTestWorker,
  switchToFirstWorker,
  switchToTestWorker,
  useHousehold,
} from "./household";
import { he } from "../src/lib/i18n/he";
import { fullDayLabel } from "../src/lib/dateLabels";
import { formatAgorot, formatDays } from "../src/lib/money";
import { addMonths, monthOf, yearMonthText } from "../src/lib/dates";
import { todayInIsrael } from "../src/lib/today";
import type { YearMonth } from "../src/lib/types";

/**
 * `/settings` — `EaseSalary - הגדרות`, the one screen a worker's terms are
 * changed on since 2026-09-13.
 *
 * The controls themselves are exercised where their consequence is: the rest
 * day in `worker-profile` and `payslip`, the tax in `income-tax`, the
 * recuperation month in `recuperation`. What this spec owns is the screen:
 * that it is about the worker the switcher holds, that the worker's page sends
 * her there, and that the rows the law settles show the law's figures.
 *
 * **The rates are read at today's month**, which is the real clock, as every
 * spec that opens on "the current month" is. From 2026-04-01 the seeded minimum
 * wage is ₪6,443.85 — `חודש  4.26` of the family's 2026 workbook — and the
 * national-insurance contribution is 3.6% (specs.md item 19).
 */

const MINIMUM_WAGE_2026 = 644385;
/** A raise this spec invents, above every minimum wage the table holds. */
const RAISED_TO = 700000;

/**
 * One month's payslip, showing the worker this spec works on.
 *
 * **A term's effect is read off the sheet and not off the opening screen**
 * (specs.md item 5): the base and the rest-eve supplement are lines behind the
 * ‏ברוטו‎, and the card beside the calendar summarises rather than itemising.
 * Addressed rather than stepped to, because this sheet carries no stepper.
 */
async function openPayslip(
  page: import("@playwright/test").Page,
  month: YearMonth,
): Promise<void> {
  const label = `${month.year}-${String(month.month).padStart(2, "0")}`;
  await page.goto(`/month/payslip?month=${label}`);
  await switchToTestWorker(page);
}

test.describe("the settings screen", () => {
  /**
   * What it catches: a screen that renders the first worker whatever the
   * switcher says — the failure `/workers/[id]` still has — or a control that
   * keeps the first worker's draft after the switch because it was not keyed
   * by worker.
   */
  test("is about the worker the switcher holds", async ({ page }) => {
    await useHousehold(page, "settings", "switch");
    await page.goto("/settings");

    const employment = page.locator('[data-group="employment"]');
    await expect(employment).not.toContainText(TEST_WORKER_NAME);

    // A draft typed into the first worker's insurer field, left unsaved.
    const insurer = page.locator('[data-terms="insurer"] input');
    await insurer.fill("טיוטה שלא נשמרה");

    await switchToTestWorker(page);
    await expect(employment).toContainText(TEST_WORKER_NAME);
    await expect(insurer).not.toHaveValue("טיוטה שלא נשמרה");
  });

  /**
   * What it catches: the "תנאי ההעסקה" link on the second worker's page landing
   * on the first worker's settings, where a family would change the wrong
   * person's terms without anything looking wrong.
   */
  test("opens on the worker whose page linked to it", async ({ page }) => {
    await useHousehold(page, "settings", "from-profile");
    await page.goto("/workers");
    await page
      .getByRole("link", { name: he.workers.toProfile(he.placeholder.name) })
      .last()
      .click();
    await expect(
      page.getByRole("heading", { name: TEST_WORKER_NAME }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: he.workers.profile.terms.title })
      .click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('[data-group="employment"]')).toContainText(
      TEST_WORKER_NAME,
    );
  });

  /**
   * The rows marked "מחושב לפי החוק", against figures that come from outside
   * the code: the seeded worker was employed from 1.4.2024, so 2026 is her
   * third calendar year and the ladder gives fourteen days (item 7); sick days
   * accrue 1.5 a month, eighteen a year (item 8).
   *
   * What it catches: a vacation row reading the anniversary instead of the
   * calendar year, a rate shown at the table's earliest row instead of the one
   * in force, or the fraction printed as 0.036.
   */
  test("shows the figures the law settles, with the date each took effect", async ({
    page,
  }) => {
    await useHousehold(page, "settings", "derived");
    await openSettingsForTestWorker(page);

    await expect(page.locator('[data-setting="vacation-per-year"]')).toContainText(
      formatDays(14),
    );
    await expect(page.locator('[data-setting="sick-per-year"]')).toContainText(
      formatDays(18),
    );

    const wage = page.locator('[data-setting="minimum-wage"]');
    await expect(wage).toContainText(formatAgorot(MINIMUM_WAGE_2026));
    await expect(wage).toContainText(fullDayLabel("2026-04-01"));
    await expect(wage).toContainText(he.settings.derived);

    await expect(
      page.locator('[data-setting="national-insurance"]'),
    ).toContainText("3.6%");

    await page.screenshot({
      path: "test-results/settings.png",
      fullPage: true,
    });
  });
});

/**
 * A change of salary holds from the month the family names, and the months
 * before it keep the salary they were calculated with (specs.md item 3, decided
 * with the user on 2026-09-13).
 *
 * The raise is recorded from the month the calendar opens on, so the month
 * before it is the one before today's. What the earlier month showed is read
 * before the change and held against what it shows after: this test is not
 * checking what that month came to, only that the raise did not reach it.
 *
 * **The base is read off the payslip** (specs.md item 5): it is one of the lines
 * behind the ‏ברוטו‎, and the screen beside the calendar summarises rather than
 * itemising. Both were on `/month` until 2026-09-16.
 *
 * What it catches: a raise written onto every month the worker has — which is
 * what "every month not yet confirmed" did to the other terms — restating months
 * already paid; and a raise saved on the profile that no month reads.
 */
test.describe("a change of salary (specs.md item 3)", () => {
  test("holds from its month and leaves the month before it", async ({ page }) => {
    await useHousehold(page, "settings", "raise");
    const today = todayInIsrael();

    await openPayslip(page, addMonths(monthOf(today), -1));
    const before = (await page.locator('[data-row="base"]').textContent()) ?? "";
    expect(before).not.toContain(formatAgorot(RAISED_TO));

    await openSettingsForTestWorker(page);
    const salary = page.locator('[data-terms="salary"]');
    await salary
      .getByRole("button", { name: he.workers.profile.terms.salary.change })
      .click();
    await salary
      .getByRole("textbox", { name: he.workers.profile.terms.salary.amount })
      .fill(String(RAISED_TO / 100));
    await salary
      .getByRole("textbox", { name: he.workers.profile.terms.salary.from })
      .fill(yearMonthText(monthOf(today)));
    await salary
      .getByRole("button", { name: he.workers.profile.terms.salary.save })
      .click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    // Recorded, and in force this month.
    await expect(salary).toContainText(formatAgorot(RAISED_TO));
    await page.screenshot({
      path: "test-results/settings-raise.png",
      fullPage: true,
    });

    await openPayslip(page, monthOf(today));
    await expect(page.locator('[data-row="base"]')).toContainText(
      formatAgorot(RAISED_TO),
    );

    await openPayslip(page, addMonths(monthOf(today), -1));
    await expect(page.locator('[data-row="base"]')).toHaveText(before);
  });

  /** Item 3's floor, said as the refusal sentence and not a silent no-op. */
  test("refuses a salary below the minimum wage of its month", async ({ page }) => {
    await useHousehold(page, "settings", "below");
    await openSettingsForTestWorker(page);
    const salary = page.locator('[data-terms="salary"]');
    await salary
      .getByRole("button", { name: he.workers.profile.terms.salary.change })
      .click();
    // An agora under the 1.4.2026 minimum, from a month it was in force.
    await salary
      .getByRole("textbox", { name: he.workers.profile.terms.salary.amount })
      .fill("6443.84");
    await salary
      .getByRole("textbox", { name: he.workers.profile.terms.salary.from })
      .fill("2026-05");
    await salary
      .getByRole("button", { name: he.workers.profile.terms.salary.save })
      .click();
    await expect(
      page.getByText(he.workers.profile.terms.refused.belowMinimum),
    ).toBeVisible();
  });
});

/**
 * The rest-eve supplement is an agreed term the family changes whenever the
 * agreement does (specs.md item 14), and it is paid for every rest-eve of the
 * month.
 *
 * The expected figure is counted here by hand: the test worker rests on
 * Saturday, so her rest-eves are the Fridays of the month the calendar opens on,
 * each paid the ₪150 this test sets.
 *
 * What it catches: a supplement saved on the profile that no month reads —
 * the term is snapshotted onto a month, and a save that skipped the snapshot
 * would leave the month paying the old ₪100 with nothing on screen to say so.
 */
test.describe("the rest-eve supplement (specs.md item 14)", () => {
  test("moves the month's supplement when it is changed", async ({ page }) => {
    await useHousehold(page, "settings", "supplement");
    const month = monthOf(todayInIsrael());
    let fridays = 0;
    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(Date.UTC(month.year, month.month - 1, day));
      if (date.getUTCMonth() !== month.month - 1) break;
      if (date.getUTCDay() === 5) fridays += 1;
    }

    await openSettingsForTestWorker(page);
    const supplement = page.locator('[data-terms="restEveSupplement"]');
    await supplement.locator("input").fill("150");
    await supplement
      .getByRole("button", { name: he.workers.profile.terms.restEveSupplement.save })
      .click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(supplement).toContainText(formatAgorot(15000));

    await openPayslip(page, month);
    await expect(page.locator('[data-row="restEveSupplement"]')).toContainText(
      formatAgorot(fridays * 15000),
    );
  });
});

/**
 * The four identifying numbers (specs.md items 22 and 28), set where they are
 * shown.
 *
 * What it catches: a number that is typed and never sealed or never opened
 * again, and — the one specific to item 28 — an employment permit stored per
 * worker when it is the employer's, so that a household with two workers would
 * hold two different permit numbers for one permit.
 */
test.describe("the identifying numbers (specs.md items 22, 28)", () => {
  test("keeps each number, and one permit number for the household", async ({ page }) => {
    await useHousehold(page, "settings", "numbers");
    await openSettingsForTestWorker(page);

    const typed = {
      bankAccount: "12-345-678901",
      workVisa: "V0000000",
      employmentPermit: "H0000000",
    } as const;
    for (const [name, value] of Object.entries(typed)) {
      const row = page.locator(`[data-terms="${name}Number"]`);
      await row.locator("input").fill(value);
      await row.getByRole("button").click();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    }

    // Opened afresh, so what is shown was read back out of the store and not
    // left in the field.
    await openSettingsForTestWorker(page);
    for (const [name, value] of Object.entries(typed)) {
      await expect(page.locator(`[data-terms="${name}Number"]`)).toContainText(value);
    }

    // The first worker: her own visa and bank account are not the test
    // worker's, and the permit is the household's and is.
    await page.goto("/settings");
    await switchToFirstWorker(page);
    await expect(page.locator('[data-terms="employmentPermitNumber"]')).toContainText(
      typed.employmentPermit,
    );
    await expect(page.locator('[data-terms="workVisaNumber"]')).not.toContainText(
      typed.workVisa,
    );
    await expect(page.locator('[data-terms="bankAccountNumber"]')).not.toContainText(
      typed.bankAccount,
    );
  });
});

/**
 * The switcher on a worker's own page (`build_plan.md` stage 3). That page takes
 * its worker from the address, so switching there has to change the address.
 *
 * What it catches: the bar renaming itself to the other worker while her
 * profile stays on screen — a page showing one person's months under another
 * person's name, which is what the switcher did until 2026-09-13.
 */
test.describe("the switcher on a worker's page", () => {
  test("goes to the other worker's page", async ({ page }) => {
    await useHousehold(page, "settings", "profile-switch");
    await page.goto("/workers/worker-1");
    await expect(
      page.getByRole("heading", { name: TEST_WORKER_NAME }),
    ).toHaveCount(0);

    await switchToTestWorker(page);
    await expect(page).toHaveURL(/\/workers\/worker-2$/);
    await expect(
      page.getByRole("heading", { name: TEST_WORKER_NAME }),
    ).toBeVisible();
  });
});

/**
 * The start of the employment, corrected (the `הגדרות` artboard's "תחילת
 * העסקה"). Seniority is counted from it and nothing counted from it is stored,
 * so the rows that read it move at once.
 *
 * The figure is item 7's ladder: moved from 1.4.2024 to 1.1.2020, 2026 becomes
 * her seventh calendar year, and year seven is twenty-one days — up from the
 * fourteen of her third. That holds while the real clock is in 2026, which is
 * true of every spec here that reads "this year".
 *
 * What it catches: a date saved on the profile while the vacation figure keeps
 * reading the old one, and a nonexistent date rolled into the next month
 * instead of refused.
 */
test.describe("the start of the employment", () => {
  test("moves the seniority every figure is counted from", async ({ page }) => {
    await useHousehold(page, "settings", "employed-since");
    await openSettingsForTestWorker(page);
    const vacation = page.locator('[data-setting="vacation-per-year"]');
    await expect(vacation).toContainText(formatDays(14));

    const since = page.locator('[data-terms="employedSince"]');
    await since.locator("input").fill("2026-02-30");
    await since
      .getByRole("button", { name: he.workers.profile.terms.employedSince.save })
      .click();
    await expect(page.getByText(he.workers.profile.terms.refused.date)).toBeVisible();

    await since.locator("input").fill("2020-01-01");
    await since
      .getByRole("button", { name: he.workers.profile.terms.employedSince.save })
      .click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(vacation).toContainText(formatDays(21));
  });
});
