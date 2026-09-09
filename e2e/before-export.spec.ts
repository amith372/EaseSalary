import { expect, test, type Page } from "@playwright/test";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";

/**
 * The questions that open an export, through the browser — `specs.md` items 18,
 * 4 and 15.
 *
 * **What this file checks that no unit test can.** The screen is a
 * conversation: six questions have to be answered before the export is offered
 * at all, a month that has not ended refuses whatever is answered, and
 * confirming writes a wage onto the month that the month screen then draws
 * from. Every assertion below is about a *result* — a button's state, a
 * sentence that appeared, a figure on another screen (`CLAUDE.md` rules 9
 * and 11).
 *
 * **Every expected figure comes from outside the code under test.**
 *
 * - ₪6,443.85 from 1.4.2026 is the minimum wage in force during a month of
 *   2026, read out of `שכר_חודשי_להאנה2026.xlsx` → `חודש  4.26` → D6.
 *   The seed pays her ₪6,247.65, the 1.4.2025 figure, so the demo household is
 *   exactly the case item 3 describes: a salary that has fallen below the
 *   minimum and is raised to it when the month is confirmed.
 * - August 2026 records one holiday worked, on the 20th, and nothing else
 *   (`seed.ts`). That is what the six questions are answered against.
 * - September 2026 is the month the demo runs to and `today` sits inside it, so
 *   it is the month item 21 refuses; August 2026 is the last one that ended.
 * - July 2026 is the first worker's recuperation month (`seed.ts`), and six
 *   days at ₪451.50 is ₪2,709.00 — the figure `recuperation.spec.ts` carries
 *   from the statute.
 *
 * **Each test gets its own store**, for the reason the other specs give: the
 * dev repository is a module singleton keyed by the `household` cookie, so a
 * suffix after the seed name opens a fresh one. It matters more here than
 * anywhere else, because confirming a month writes to it.
 */

const RUN = Date.now().toString(36);

/** The wage in force during a month of 2026, and the salary the seed pays. */
const WAGE_IN_FORCE = 644385;
const SEEDED_SALARY = 624765;
/** The last month of the demo that has ended, given a `today` in September. */
const ENDED_MONTH = 8;
/** The month the demo runs to, which `today` sits inside. */
const CURRENT_MONTH = 9;
/** The first worker's recuperation month, and what six days come to. */
const RECUPERATION_MONTH = 7;
const RECUPERATION_PAYMENT = 270900;

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

/** Step the screen back from the month it opens on, which is August. */
async function backTo(page: Page, month: number): Promise<void> {
  for (let step = 0; step < ENDED_MONTH - month; step += 1) {
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
  }
}

/** Answer every one of item 18's questions, so the export is reachable. */
async function answerEverything(page: Page, yes: string[] = []): Promise<void> {
  const questions = page.locator("[data-question]");
  const count = await questions.count();
  for (let index = 0; index < count; index += 1) {
    const row = questions.nth(index);
    const key = await row.getAttribute("data-question");
    const answer =
      key !== null && yes.includes(key)
        ? he.beforeExport.questions.yes
        : he.beforeExport.questions.no;
    await row.getByRole("button", { name: answer, exact: true }).click();
  }
}

/** August 2026 as `seed.ts` writes it: one holiday worked on the 20th, no
 * advance, no sickness, no free rest day and no payment to anybody else. These
 * are the answers that agree with the month. */
const AUGUST_AGREES = ["holidaysWorked"];

test.describe("the questions that open an export (specs.md item 18)", () => {
  /**
   * The gate itself. A month is not exported by silence: the button is offered
   * only once every question has an answer, which is the whole of item 18.
   */
  test("offers the export only after every question is answered", async ({
    page,
  }) => {
    await useHousehold(page, "gate");
    await page.goto("/month/export");

    // It opens on the last month that ended, and not on the current one — a
    // month that has not ended could never be exported (item 21).
    await expect(page.locator("h1")).toContainText(
      he.calendar.monthNames[ENDED_MONTH - 1],
    );

    const exportButton = page.locator("[data-finish]");
    await expect(exportButton).toBeDisabled();
    await expect(page.getByText(he.beforeExport.finish.unanswered)).toBeVisible();

    // Six questions, each arriving with what the month already knows.
    await expect(page.locator("[data-question]")).toHaveCount(6);
    await expect(page.locator('[data-question="advanceGranted"]')).toContainText(
      he.beforeExport.questions.advanceGranted.from(null),
    );

    await answerEverything(page, AUGUST_AGREES);
    await expect(exportButton).toBeEnabled();

    await page.screenshot({
      path: "test-results/before-export-answered.png",
      fullPage: true,
    });
  });

  /**
   * Item 21, drawn here as a block where the month screen draws it as a
   * warning: filling a month in ahead of time is allowed and exporting it is
   * not. Answering every question must not make the block go away.
   */
  test("refuses a month that has not ended, however it is answered", async ({
    page,
  }) => {
    await useHousehold(page, "notended");
    await page.goto("/month/export");
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();

    await expect(page.locator("h1")).toContainText(
      he.calendar.monthNames[CURRENT_MONTH - 1],
    );
    await expect(page.locator('[data-block="monthNotEnded"]')).toBeVisible();

    await answerEverything(page);
    await expect(page.locator("[data-finish]")).toBeDisabled();
    await expect(page.getByText(he.beforeExport.finish.blocked)).toBeVisible();
  });

  /**
   * An answer that disagrees with what the month recorded is a warning and
   * never a refusal (settled with the user on 2026-09-09). What it must not do
   * is pass in silence: the sentence says where the missing fact is recorded.
   */
  test("warns about an answer that disagrees, and still allows the export", async ({
    page,
  }) => {
    await useHousehold(page, "mismatch");
    await page.goto("/month/export");
    await answerEverything(page, AUGUST_AGREES);
    await expect(page.locator("[data-mismatch]")).toHaveCount(0);

    // August records no advance, so "yes" is the disagreement.
    await page
      .locator('[data-question="advanceGranted"]')
      .getByRole("button", { name: he.beforeExport.questions.yes, exact: true })
      .click();

    await expect(page.locator("[data-mismatch]")).toContainText(
      he.beforeExport.questions.advanceGranted.mismatch,
    );
    await expect(page.locator("[data-finish]")).toBeEnabled();
  });
});

test.describe("the confirmations that go with them (items 4 and 15)", () => {
  /**
   * Item 4: the figure, the date it took effect, where it was read from, and a
   * way to correct it — all four in front of the user before every export.
   */
  test("shows the minimum wage with its date and lets it be corrected", async ({
    page,
  }) => {
    await useHousehold(page, "wage");
    await page.goto("/month/export");

    const wage = page.locator("[data-wage]");
    await expect(wage).toContainText(formatAgorot(WAGE_IN_FORCE));
    await expect(wage).toContainText(he.beforeExport.wage.inForceFrom);

    await wage.getByRole("button", { name: he.beforeExport.wage.correct }).click();
    await expect(page.locator("[data-wage-input]")).toBeVisible();
    await page.locator("[data-wage-input]").fill("6300.00");
    await expect(page.locator("[data-wage-input]")).toHaveValue("6300.00");

    await page.screenshot({
      path: "test-results/before-export-wage.png",
      fullPage: true,
    });
  });

  /**
   * Item 3: a salary may never sit below the minimum wage. The demo pays her
   * the 1.4.2025 figure and August 2026 is valued at the 1.4.2026 one, so the
   * screen says the month will be confirmed at the higher figure — before she
   * presses, and not after. What this catches is a month written that pays
   * under its own confirmed minimum, which would look ordinary on the sheet.
   */
  test("says the salary is raised to the minimum wage in force", async ({
    page,
  }) => {
    await useHousehold(page, "raised");
    await page.goto("/month/export");

    await expect(page.locator("[data-raised]")).toContainText(
      he.beforeExport.wage.raised(SEEDED_SALARY, WAGE_IN_FORCE),
    );
    await answerEverything(page, AUGUST_AGREES);
    await page.locator("[data-finish]").click();
    await settled(page);
    await expect(page.locator("[data-confirmed]")).toBeVisible();
  });

  /**
   * Item 15: the recuperation day rate is confirmed the way the minimum wage
   * is, in the month the payment falls in and in no other. The days are
   * reported and only the rate is asked.
   */
  test("asks for the recuperation rate in the recuperation month alone", async ({
    page,
  }) => {
    await useHousehold(page, "recuperation");
    await page.goto("/month/export");
    // August is not the recuperation month.
    await expect(page.locator("[data-recuperation-rate]")).toHaveCount(0);

    await backTo(page, RECUPERATION_MONTH);
    const panel = page.locator("[data-recuperation-rate]");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(he.beforeExport.recuperation.days);
    // Six days at ₪451.50, offered from the dated-rates table.
    await expect(page.locator("[data-recuperation-input]")).toHaveValue("451.50");
  });

  /**
   * The whole flow, ending where it has to end: the month is confirmed, and the
   * money it was confirmed at is what the month screen draws. This is the wire
   * no unit test can see — a confirmation that wrote nothing would leave every
   * screen looking exactly as it does now.
   */
  test("confirms the month, and the month screen agrees with what was confirmed", async ({
    page,
  }) => {
    await useHousehold(page, "confirm");
    await page.goto("/month/export");
    // July, and every question answered as July records it: nothing at all.
    await backTo(page, RECUPERATION_MONTH);
    await answerEverything(page);

    await page.locator("[data-finish]").click();
    await settled(page);
    await expect(page.locator("[data-confirmed]")).toContainText(
      he.beforeExport.finish.done,
    );
    await page.screenshot({
      path: "test-results/before-export-confirmed.png",
      fullPage: true,
    });

    // And July still pays the recuperation it was confirmed at, from the rate
    // the confirmation stored on the month rather than from the table.
    await page.goto("/month");
    for (let step = 0; step < CURRENT_MONTH - RECUPERATION_MONTH; step += 1) {
      await page.getByRole("button", { name: he.calendar.previousMonth }).click();
    }
    await expect(page.locator('[data-row="recuperation"]')).toContainText(
      formatAgorot(RECUPERATION_PAYMENT),
    );
  });
});
