import { expect, test } from "@playwright/test";
import {
  TEST_WORKER_NAME,
  openSettingsForTestWorker,
  openSettingsGroups,
  switchToFirstWorker,
  switchToTestWorker,
  useHousehold,
  TODAY,
} from "./household";
import { he } from "../src/lib/i18n/he";
import { fullDayLabel } from "../src/lib/dateLabels";
import { formatAgorot, formatDays } from "../src/lib/money";
import { addMonths, monthOf, yearMonthText } from "../src/lib/dates";
import type { YearMonth } from "../src/lib/types";

/**
 * `/settings` — `EaseSalary - הגדרות`, the one screen a worker's terms are
 * changed on since 2026-09-13.
 *
 * The controls themselves are exercised where their consequence is: the rest
 * day in `worker-profile` and `payslip`, the tax in `income-tax`, the
 * recuperation month in `recuperation`. What this spec owns is the screen:
 * that it is about the worker the switcher holds, that the worker's page sends
 * them there, and that the rows the law settles show the law's figures.
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
    await openSettingsGroups(page);

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
    // The URL first: the list draws their name as a heading too, and its cards
    // carry their own "פרטים והגדרות" links.
    await expect(page).toHaveURL(/\/workers\/[^/]+$/);
    await expect(
      page.getByRole("heading", { level: 1, name: TEST_WORKER_NAME }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: he.workers.toSettings })
      .click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('[data-group="employment"]')).toContainText(
      TEST_WORKER_NAME,
    );
  });

  /**
   * The rows marked "מחושב לפי החוק", against figures that come from outside
   * the code: the seeded worker was employed from 1.4.2024, so 2026 is them
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
    const today = TODAY;

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
 * Saturday, so their rest-eves are the Fridays of the month the calendar opens on,
 * each paid the ₪150 this test sets.
 *
 * What it catches: a supplement saved on the profile that no month reads —
 * the term is snapshotted onto a month, and a save that skipped the snapshot
 * would leave the month paying the old ₪100 with nothing on screen to say so.
 */
test.describe("the rest-eve supplement (specs.md item 14)", () => {
  test("moves the month's supplement when it is changed", async ({ page }) => {
    await useHousehold(page, "settings", "supplement");
    const month = monthOf(TODAY);
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

  /**
   * The other half of the same term: a month already confirmed does not move
   * with it (`specs.md` Part 5 — confirming is "the moment its figures stop
   * moving with the profile"; item 2 — a payslip is never a restatement of
   * months already paid).
   *
   * **On the `filed` household**, which is the demo with the second worker's
   * January to April 2026 confirmed and not exported (`seed.ts`). The interface
   * cannot reach that state on its own: confirming and downloading are one
   * gesture, so a month is confirmed-and-unexported only when the download never
   * arrived.
   *
   * **The two figures are worked out on a calendar.** 2026-01-01 is a Thursday,
   * so 2026-03-01 is a Sunday and March's Fridays are the 6th, 13th, 20th and
   * 27th — four of them. 2026-05-01 is a Friday, so May's are the 1st, 8th,
   * 15th, 22nd and 29th — five. They are seeded at ₪100 a rest-eve, which is
   * ₪400 in March and ₪500 in May; raised to ₪200, March stays at ₪400 and May
   * becomes ₪1,000.
   *
   * **What this catches** is the bug it was written for: until this commit
   * `saveProfile` re-snapshotted the terms of *every* month the worker had, so
   * a supplement changed in September rewrote a sheet filed in April — and
   * re-exporting that month afterwards would have produced a different file
   * from the one the family had already filed.
   */
  test("leaves a month already confirmed at the figure it was filed with", async ({
    page,
  }) => {
    await useHousehold(page, "filed", "confirmed-supplement");
    const FILED = { year: 2026, month: 3 };
    const DRAFT = { year: 2026, month: 5 };
    const SEEDED_PER_EVE = 10000;
    const RAISED_PER_EVE = 20000;
    const FRIDAYS_IN_MARCH = 4;
    const FRIDAYS_IN_MAY = 5;
    const supplementRow = page.locator('[data-row="restEveSupplement"]');

    // Both months stand at the seeded figure before anything is changed.
    await openPayslip(page, FILED);
    await expect(supplementRow).toContainText(
      formatAgorot(FRIDAYS_IN_MARCH * SEEDED_PER_EVE),
    );
    await openPayslip(page, DRAFT);
    await expect(supplementRow).toContainText(
      formatAgorot(FRIDAYS_IN_MAY * SEEDED_PER_EVE),
    );

    await openSettingsForTestWorker(page);
    const supplement = page.locator('[data-terms="restEveSupplement"]');
    await supplement.locator("input").fill("200");
    await supplement
      .getByRole("button", {
        name: he.workers.profile.terms.restEveSupplement.save,
      })
      .click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    // March was filed, so it is untouched.
    await openPayslip(page, FILED);
    await expect(supplementRow).toContainText(
      formatAgorot(FRIDAYS_IN_MARCH * SEEDED_PER_EVE),
    );
    // May is still a draft, so it follows the profile.
    await openPayslip(page, DRAFT);
    await expect(supplementRow).toContainText(
      formatAgorot(FRIDAYS_IN_MAY * RAISED_PER_EVE),
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

    // The first worker: their own visa and bank account are not the test
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
 * Every field on the screen is announced by the row it sits in.
 *
 * A term draws its name once, as the row's heading, and the control under it is
 * a bare input — so until 2026-09-24 seven fields had no accessible name at
 * all, four of them the identifying numbers. A screen reader read four
 * different boxes alike, and the one holding the passport was told apart from
 * the one holding the bank account only by counting.
 *
 * What it catches: a new term whose control is dropped under a `TermRow`
 * without taking its heading's id, and the four numbers collapsing onto one
 * name again. The name is Playwright's own accessible-name computation and not
 * a reading of the markup, which is the whole point — the markup looked fine.
 */
test.describe("every field is announced by its own row", () => {
  test("no input on the settings screen is left unnamed", async ({ page }) => {
    await useHousehold(page, "settings", "names");
    await openSettingsForTestWorker(page);

    const words = he.workers.profile.terms;
    const boxes = page.getByRole("textbox");
    await expect(boxes).not.toHaveCount(0);
    // `/\S/` matches any non-empty accessible name, so the two counts agree
    // only when every field has one.
    await expect(page.getByRole("textbox", { name: /\S/ })).toHaveCount(
      await boxes.count(),
    );

    // And the four numbers are four names rather than one repeated.
    const numbers = [
      words.passportNumber.label,
      words.workVisaNumber.label,
      words.employmentPermitNumber.label,
      words.bankAccountNumber.label,
    ];
    expect(new Set(numbers).size).toBe(4);
    for (const label of numbers) {
      await expect(
        page.getByRole("textbox", { name: label, exact: true }),
      ).toHaveCount(1);
    }
  });
});

/**
 * The switcher on a worker's own page (`build_plan.md` stage 3). That page takes
 * its worker from the address, so switching there has to change the address.
 *
 * What it catches: the bar renaming itself to the other worker while them
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
 * them seventh calendar year, and year seven is twenty-one days — up from the
 * fourteen of their third. That holds while the real clock is in 2026, which is
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

  /**
   * **A start moved past the first month the application holds is refused**
   * (specs.md item 6).
   *
   * Scenario: the demo worker's months run from January 2026 (`seed.ts`). The
   * start of employment is set to 1 June 2026 — a date inside the range the
   * field accepts, and after months that already carry their marks and figures.
   *
   * Expected: the refusal, naming January 2026 as the month it must not pass;
   * the field still holding the date the seed gave; and the vacation quota
   * unmoved, since seniority is what a start date changes.
   *
   * **Why it is refused rather than accepted.** Balances are replayed from the
   * opening position through every month they have (item 6), so a start *after*
   * a month that already exists asks the replay to value months from before
   * the employment began — which is not a wrong figure but an incoherent one.
   * The refusal is the only alternative to letting the family produce it.
   *
   * **What it would catch**: the `firstMonth` check dropped, which accepts the
   * date and restates five months of balances from a start that contradicts
   * them; the refusal raised but its own sentence not drawn, which this term
   * renders by hand rather than through the shared `Refusal` — so a change to
   * that branch silently leaves the family with a save that does nothing; and
   * the date saved anyway behind a refusal that is merely displayed.
   */
  test("refuses a start after the first month the worker already has", async ({
    page,
  }) => {
    await useHousehold(page, "settings", "employed-since-after");
    await openSettingsForTestWorker(page);

    const words = he.workers.profile.terms.employedSince;
    const vacation = page.locator('[data-setting="vacation-per-year"]');
    const before = await vacation.textContent();

    const since = page.locator('[data-terms="employedSince"]');
    await since.locator("input").fill("2026-06-01");
    await since.getByRole("button", { name: words.save }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    // The sentence names the month it may not pass, which is the only thing
    // that tells the family what to type instead.
    await expect(since).toContainText(words.afterFirstMonth.before);
    await expect(since).toContainText(words.afterFirstMonth.after("female"));
    await page.screenshot({
      path: "test-results/settings-employed-since-after-first-month.png",
      fullPage: true,
    });

    // **Nothing was saved behind it.** Reopened from the store rather than read
    // off the field that still holds what was typed.
    await openSettingsForTestWorker(page);
    await expect(
      page.locator('[data-terms="employedSince"] input'),
    ).not.toHaveValue("2026-06-01");
    await expect(page.locator('[data-setting="vacation-per-year"]')).toHaveText(
      before ?? "",
    );
  });
});

/**
 * A group's heading and what it opens are one card.
 *
 * Until 2026-09-24 the four headings sat on the page ground above four separate
 * cards, so a heading was not visibly attached to what it opened. They take
 * `/payments`' arrangement now: one card, the folds divided by a hairline.
 *
 * What it catches: a group given a card of its own again, which separates it
 * from its heading without any test noticing.
 */
test("a group's heading sits inside the card it opens", async ({ page }) => {
  await useHousehold(page, "settings", "one-card");
  await openSettingsForTestWorker(page);

  const groups = page.locator("[data-group]");
  await expect(groups).toHaveCount(4);
  // Every group, heading and rows alike, is inside one card — so the number of
  // cards holding a group is one.
  const holders = await page.evaluate(() => {
    const parents = new Set<Element | null>();
    for (const group of Array.from(document.querySelectorAll("[data-group]"))) {
      parents.add(group.parentElement);
    }
    // One holder, and it is a card: white, against the page's warm ground.
    const only = [...parents][0];
    return {
      count: parents.size,
      background:
        only === null || only === undefined
          ? ""
          : getComputedStyle(only).backgroundColor,
    };
  });
  expect(holders.count).toBe(1);
  expect(holders.background).toBe("rgb(255, 255, 255)");
});
