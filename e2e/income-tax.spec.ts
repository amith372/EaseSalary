import { expect, test, type Page } from "@playwright/test";
import { TEST_WORKER_ID, switchToTestWorker } from "./household";
import { SATURDAY } from "../src/lib/dates";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";

/**
 * The income tax, through the browser (`CLAUDE.md` rules 9–12, `build_plan.md`
 * stage 3).
 *
 * **It is here because a unit test could not have caught what this found.** The
 * engine, its own suite and the export agreement all passed while every screen
 * in the application showed a tax of zero — the demo seed wrote
 * `incomeTaxAgorot: 0` onto every month, which used to mean "nothing typed yet"
 * and now means "confirmed to withhold nothing", so the calculation never ran
 * anywhere a user could see it. Nothing about that is visible from inside the
 * engine, and the seed is not test data: it is the running application.
 *
 * **Every expected figure is worked by hand from the statute and from the
 * seed's own stated facts**, and never read back from what the screen printed.
 * The arithmetic is written out at each assertion.
 *
 * ## The month
 *
 * September 2026, **the second demo worker** — the one the browser suite works
 * on since 2026-09-11, when the first was reseeded from the family's own
 * workbooks (`seed.ts`). `seed.ts` pays her the ₪6,443.85 minimum wage in force
 * from 1.4.2026 and a ₪100 rest-eve supplement, and rests her on Saturday.
 * September 2026 has thirty days and four Saturdays — the 5th, 12th, 19th and
 * 26th — so twenty-six are standard days, and four Fridays fall before those
 * Saturdays. Nothing is marked in September, so all four Saturdays are worked:
 *
 *    base                             ₪6,443.85
 *    4 rest-eves × ₪100.00        =     ₪400.00
 *    4 Saturdays × ₪439.74        =   ₪1,758.96
 *                                    ----------
 *    ברוטו                           ₪8,602.81
 *
 * ₪439.74 is the rest-day rate item 3 derives from that wage —
 * (6,443.85 ÷ 25 + 6,443.85 ÷ 182) × 1.5 — and it is **also printed in the
 * family's own workbook**, at `שכר_חודשי_להאנה2026.xlsx` → `חודש  8.26` → `D8`,
 * so the figure here has a source outside this code as Part 4's ₪426.35 does.
 *
 * ## The tax on it
 *
 * ₪8,602.81 a month is ₪103,233.72 a year — 10,323,372 agorot. Against the 2026
 * table:
 *
 *    8,412,000 × 10%              =    841,200
 *    1,911,372 × 14%              =    267,592.08
 *                                    ------------
 *                                    1,108,792.08 a year, = 92,399.34 a month
 *
 * A woman's 2.75 credit points are worth 2.75 × ₪2,904 ÷ 12 = ₪665.50 a month,
 * so she is taxed 92,399.34 − 66,550 = 25,849.34, which rounds to **₪258.49**.
 * A man's 2.25 points are worth ₪544.50, so he is taxed 92,399.34 − 54,450 =
 * 37,949.34, which rounds to **₪379.49**. The two differ by ₪121.00, which is
 * half a credit point a month and is the check that the pair is consistent.
 */

const RUN = Date.now();

const GROSS = 860281;
const TAX_FEMALE = 25849;
const TAX_MALE = 37949;

/** A household of this run's own, so nothing here meets marks another spec
 * left behind: the dev repository is a module singleton keyed by the
 * `household` cookie, and a value the seed name does not open re-seeds. */
async function useHousehold(page: Page, label: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "household",
      value: `demo-tax-${RUN}-${label}`,
      url: "http://localhost:3000",
    },
  ]);
}

async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** One row of the month screen's calculation, by the key the engine gives it. */
function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

test.describe("the tax the application works out (specs.md item 17)", () => {
  /**
   * **The figure itself, on the screen that shows the month.**
   *
   * What it catches: a calculation that never runs on a real month. Before the
   * seed was corrected this row said 0.00 ₪ with every unit test green, and the
   * ‏נטו‎ equalled the ‏ברוטו‎ — a salary sheet that withholds nothing from a
   * worker who owes ₪223.53, which is a figure the family would have to
   * discover from the tax authority rather than from this application.
   */
  test("withholds ₪258.49 from a ₪8,602.81 month and lowers the נטו by it", async ({
    page,
  }) => {
    await useHousehold(page, "figure");
    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);

    // The ברוטו first, because the tax is a function of it: a wrong tax over a
    // wrong gross would still look self-consistent.
    await expect(row(page, "gross")).toContainText(formatAgorot(GROSS));
    await expect(row(page, "incomeTax")).toContainText(
      formatAgorot(-TAX_FEMALE),
    );
    // ₪8,353.05 − ₪223.53 = ₪8,129.52.
    await expect(row(page, "net")).toContainText(formatAgorot(GROSS - TAX_FEMALE));

    await page.screenshot({
      path: `test-results/income-tax-calculated.png`,
      fullPage: true,
    });
  });

  /**
   * **The preview and the payments screen say one thing**, which is the rule
   * that two screens driven by one engine result have to hold (`CLAUDE.md`
   * rule 11). The payments card is where the figure is corrected, so a stale
   * one there is a user typing a correction to a number nobody is using.
   */
  test("says the same figure on the payments screen", async ({ page }) => {
    await useHousehold(page, "agree");
    await page.goto("/payments");
    await switchToTestWorker(page);
    await settled(page);

    await expect(
      page.getByText(formatAgorot(-TAX_FEMALE), { exact: false }).first(),
    ).toBeVisible();
  });

  /**
   * **The gender on the profile reaches the sheet.**
   *
   * What it catches: credit points hardcoded at a woman's 2.75, which is the
   * shortcut that makes every figure in the demo correct and every male
   * caregiver's sheet under-withhold by ₪121 a month. Changing one chip on the
   * profile is the whole gesture, and the number on the month screen has to
   * move by exactly half a credit point — ₪2,904 ÷ 2 ÷ 12 = ₪121.00.
   */
  test("moves the figure by half a credit point when the gender changes", async ({
    page,
  }) => {
    await useHousehold(page, "gender");
    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);
    await expect(row(page, "incomeTax")).toContainText(
      formatAgorot(-TAX_FEMALE),
    );

    // Her own page, named rather than taken as whichever link comes first: the
    // list's first worker is Hanna, whose months come from the workbooks and
    // whose terms no test may edit (`household.ts`).
    await page.goto(`/workers/${TEST_WORKER_ID}`);
    await settled(page);
    await page
      .locator('[data-terms="gender"]')
      .getByRole("button", { name: he.workers.profile.terms.gender.male })
      .click();
    await settled(page);

    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);
    await expect(row(page, "incomeTax")).toContainText(formatAgorot(-TAX_MALE));
    // Half a credit point, to the agora: ₪344.53 − ₪223.53 = ₪121.00.
    expect(TAX_MALE - TAX_FEMALE).toBe(12100);

    await page.screenshot({
      path: `test-results/income-tax-male.png`,
      fullPage: true,
    });
  });

  /**
   * **Zero at the minimum wage, which is the ordinary month and not an edge
   * case** (`build_plan.md` stage 3).
   *
   * Marking the four Saturdays as free rest days takes the ₪1,758.96 of
   * rest-day work out of the month, leaving ₪6,443.85 + ₪400.00 = ₪6,843.85.
   * A year of that is 8,212,620 agorot, still inside the 10% bracket: 821,262 a
   * year, or ₪684.39 a month, against a woman's ₪665.50 credit. She is taxed
   * the ₪18.89 between them.
   *
   * **This month used to withhold nothing, and the wage rise is why it no
   * longer does.** At the ₪6,247.65 of 1.4.2025 the same month came to
   * ₪6,647.65 and the credit covered the tax with ₪0.74 to spare; at the
   * ₪6,443.85 of 1.4.2026 it does not. The credit point is ₪2,904 a year and
   * has not moved with the wage, so the threshold it covers — a ‏ברוטו‎ of
   * ₪6,655.00 a month, which is 10% of a year of it against 2.75 points — is
   * now **below** the minimum wage plus four rest-eves. A caregiver on the
   * minimum wage has started owing income tax, and that is a fact about the
   * statute rather than about this application.
   *
   * What it catches: a credit allowed to run negative, which would show a
   * payment on the withholding row; a tax floored somewhere other than at zero;
   * and a credit point quietly indexed to the wage, which would keep answering
   * zero here for ever and hide the change above.
   */
  test("withholds ₪18.89 once the month falls back to the minimum wage", async ({
    page,
  }) => {
    await useHousehold(page, "zero");
    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);

    const marks = he.calendar.marks(SATURDAY);
    for (const date of ["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26"]) {
      await page.locator(`[data-date="${date}"]`).click();
      await page.locator(`[data-date="${date}"]`).click();
      await page
        .getByRole("button", { name: marks.freeRestDay, exact: true })
        .click();
      await settled(page);
    }

    // ₪6,443.85 + ₪400.00, the rest-day work having gone, and ₪18.89 withheld
    // from it. All three rows are drawn, because something below each of them
    // changes the figure (Part 5).
    await expect(row(page, "gross")).toContainText(formatAgorot(684385));
    await expect(row(page, "incomeTax")).toContainText(formatAgorot(-1889));
    // ₪6,843.85 − ₪18.89 = ₪6,824.96.
    await expect(row(page, "net")).toContainText(formatAgorot(684385 - 1889));

    // And the payments card reports the share it came to: ₪18.89 of ₪6,843.85
    // is 0.28%, which is the figure a family would otherwise have to work out
    // to compare against an accountant's advice.
    await page.goto("/payments");
    await switchToTestWorker(page);
    await settled(page);
    await expect(
      page.getByText(he.month.actions.incomeTax.share("0.28")),
    ).toBeVisible();

    await page.screenshot({
      path: `test-results/income-tax-zero.png`,
      fullPage: true,
    });
  });

  /**
   * **An amount typed over the calculated one, and the empty field that hands
   * the row back** (specs.md item 17).
   *
   * What it catches: an empty field read as a zero, which is what it used to
   * mean. A user who clears the box to undo her correction would then be
   * storing "withhold nothing" by hand for ever — the same number the
   * application would have produced in an ordinary month, and a silently wrong
   * one in every other.
   */
  test("takes an override and gives the row back when the field is cleared", async ({
    page,
  }) => {
    await useHousehold(page, "override");
    await page.goto("/payments");
    await switchToTestWorker(page);
    await settled(page);

    const field = page.getByLabel(he.month.actions.incomeTax.field);
    await field.fill("500");
    await page
      .getByRole("button", { name: he.month.actions.incomeTax.save })
      .click();
    await settled(page);

    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);
    await expect(row(page, "incomeTax")).toContainText(formatAgorot(-50000));

    await page.goto("/payments");
    await switchToTestWorker(page);
    await settled(page);
    await page.getByLabel(he.month.actions.incomeTax.field).fill("");
    await page
      .getByRole("button", { name: he.month.actions.incomeTax.save })
      .click();
    await settled(page);

    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);
    await expect(row(page, "incomeTax")).toContainText(
      formatAgorot(-TAX_FEMALE),
    );
  });
});

/**
 * The three ways a worker's tax can be arrived at (specs.md item 17, settled
 * with the user on 2026-09-11).
 *
 * **The choice lives on the profile and is snapshotted onto each month.** A
 * family that stops withholding in June must not thereby restate January
 * through May as months that withheld nothing, because those months were filed.
 *
 * The figures again come from the September 2026 month described above: a
 * ‏ברוטו‎ of ₪8,353.05, whose automatic answer is ₪223.53.
 */
test.describe("the three ways a tax is arrived at (specs.md item 17)", () => {
  async function openProfile(page: Page): Promise<void> {
    // Her own page, named rather than taken as whichever link comes first: the
    // list's first worker is Hanna, whose months come from the workbooks and
    // whose terms no test may edit (`household.ts`).
    await page.goto(`/workers/${TEST_WORKER_ID}`);
    await settled(page);
  }

  function modeChip(page: Page, name: string) {
    return page
      .locator('[data-terms="incomeTax"]')
      .getByRole("button", { name, exact: true });
  }

  /**
   * **`לא מנוכה מס` is one gesture and it holds for every month**, which is
   * the whole reason it is a mode rather than a zero typed into each month.
   *
   * What it catches: a mode stored but never read, which would leave the
   * calculated ₪223.53 standing while the profile said the opposite — the one
   * failure here that looks like nothing went wrong, because both screens are
   * individually plausible.
   */
  test("withholds nothing in every month once the worker is set to none", async ({
    page,
  }) => {
    await useHousehold(page, "mode-none");
    await openProfile(page);
    await modeChip(page, he.workers.profile.terms.incomeTax.none).click();
    // **Waiting on the note and not on `settled`.** A server action's round
    // trip has not started when the click returns, so an `aria-busy` count of
    // zero is true before anything has been saved — the screen changing is the
    // only honest signal that it has.
    await expect(
      page.getByText(he.workers.profile.terms.incomeTax.noneNote),
    ).toBeVisible();
    await settled(page);

    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);
    await expect(row(page, "incomeTax")).toHaveCount(0);
    // Nothing withheld and nothing transferred, so the month closes on one
    // figure, and that figure is the untaxed ברוטו.
    await expect(row(page, "net")).toContainText(formatAgorot(GROSS));

    // **And an earlier month, which was never touched**: the setting is the
    // worker's and not one month's, which is the whole reason it is not typed
    // into each month separately.
    //
    // Three steps back to June and not one to August. August is the seeded
    // month carrying a hand-typed tax, and a correction rightly survives a
    // change of mode — so asserting on it would prove the opposite of what this
    // line is for. It is the kind of month a test picks by counting rather than
    // by reading, and the assertion still looks reasonable when it fails.
    for (let step = 0; step < 3; step += 1) {
      await page.getByRole("button", { name: he.calendar.previousMonth }).click();
      await settled(page);
    }
    await expect(row(page, "incomeTax")).toHaveCount(0);

    await page.goto("/payments");
    await switchToTestWorker(page);
    await settled(page);
    await expect(page.getByText(he.month.actions.incomeTax.none)).toBeVisible();
    // The card says where the figure came from, and the credit-point paragraph
    // is gone: it is the automatic mode's rule and is untrue of this month.
    await expect(
      page.getByText(he.month.actions.incomeTax.from.none),
    ).toBeVisible();
    await expect(page.getByText(he.month.actions.incomeTax.rule)).toHaveCount(0);

    await page.screenshot({
      path: `test-results/income-tax-mode-none.png`,
      fullPage: true,
    });
  });

  /**
   * **A flat share of the ‏ברוטו‎**, which is what an accountant hands a family as
   * one number. 2.5% of ₪8,602.81 is ₪215.07, worked by hand: 860,281 × 0.025 =
   * 21,507.025 agorot, which rounds to 21,507.
   *
   * What it catches: a percentage silently falling back to the calculation.
   * ₪215.07 and ₪258.49 are close enough that a screenshot would not tell them
   * apart, and only the figure does.
   */
  test("takes a flat percentage of the gross when one is set", async ({
    page,
  }) => {
    await useHousehold(page, "mode-percent");
    await openProfile(page);
    await modeChip(page, he.workers.profile.terms.incomeTax.percentage).click();
    await page
      .getByLabel(he.workers.profile.terms.incomeTax.rate)
      .fill("2.5");
    await page
      .locator('[data-terms="incomeTax"]')
      .locator("xpath=..")
      .getByRole("button", { name: he.workers.profile.terms.incomeTax.save })
      .click();
    await settled(page);

    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);
    await expect(row(page, "incomeTax")).toContainText(formatAgorot(-21507));
    await expect(row(page, "net")).toContainText(formatAgorot(GROSS - 21507));

    await page.goto("/payments");
    await switchToTestWorker(page);
    await settled(page);
    // The share the card reports is the rate itself, to the hundredth, because
    // a flat rate is the one mode whose percentage does not move.
    await expect(
      page.getByText(he.month.actions.incomeTax.share("2.50")),
    ).toBeVisible();

    await page.screenshot({
      path: `test-results/income-tax-mode-percentage.png`,
      fullPage: true,
    });
  });

  /**
   * **A rate the profile must not store**, refused by the server rather than by
   * the field (Part 3). Zero is the one worth asserting: it is the amount a
   * family reaches for when they mean "do not withhold", and accepting it would
   * store a worker whose tax is a share of nothing — which reads on every
   * screen exactly like a worker nobody has set up.
   */
  test("refuses a rate of zero and says which choice means it", async ({
    page,
  }) => {
    await useHousehold(page, "mode-zero");
    await openProfile(page);
    await modeChip(page, he.workers.profile.terms.incomeTax.percentage).click();
    await page.getByLabel(he.workers.profile.terms.incomeTax.rate).fill("0");
    await page
      .locator('[data-terms="incomeTax"]')
      .locator("xpath=..")
      .getByRole("button", { name: he.workers.profile.terms.incomeTax.save })
      .click();
    await settled(page);

    await expect(
      page.getByText(he.workers.profile.terms.refused.incomeTaxRate),
    ).toBeVisible();

    // And nothing was stored: the month is still taxed by the brackets.
    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);
    await expect(row(page, "incomeTax")).toContainText(
      formatAgorot(-TAX_FEMALE),
    );
  });

  /**
   * **A single month still departs from the worker's setting**, which is the
   * other half of item 17 and the user's own requirement on 2026-09-11: a past
   * month is corrected by hand whatever the profile says.
   *
   * What it catches: a mode that overwrites a correction. A family that sets
   * `לא מנוכה מס` after having corrected one month by hand would otherwise
   * lose the correction silently, and the month it belonged to is the one month
   * nobody looks at again.
   */
  test("keeps a hand-corrected month when the worker's setting changes", async ({
    page,
  }) => {
    await useHousehold(page, "mode-and-override");
    await page.goto("/payments");
    await switchToTestWorker(page);
    await settled(page);
    await page.getByLabel(he.month.actions.incomeTax.field).fill("300");
    await page
      .getByRole("button", { name: he.month.actions.incomeTax.save })
      .click();
    await settled(page);

    await openProfile(page);
    await modeChip(page, he.workers.profile.terms.incomeTax.none).click();
    // **Waiting on the note and not on `settled`.** A server action's round
    // trip has not started when the click returns, so an `aria-busy` count of
    // zero is true before anything has been saved — the screen changing is the
    // only honest signal that it has.
    await expect(
      page.getByText(he.workers.profile.terms.incomeTax.noneNote),
    ).toBeVisible();
    await settled(page);

    await page.goto("/month");
    await switchToTestWorker(page);
    await settled(page);
    // The correction stands, and it is still marked as the user's own.
    await expect(row(page, "incomeTax")).toContainText(formatAgorot(-30000));

    await page.goto("/payments");
    await switchToTestWorker(page);
    await settled(page);
    await expect(
      page.getByText(he.month.actions.incomeTax.from.manual),
    ).toBeVisible();
  });
});
