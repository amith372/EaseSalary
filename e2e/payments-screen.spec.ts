import { expect, test, type Page } from "@playwright/test";
import { switchToTestWorker } from "./household";
import { SATURDAY } from "../src/lib/dates";
import { he } from "../src/lib/i18n/he";
import { formatAgorot, formatDays } from "../src/lib/money";

/**
 * The rest of stage 4's browser verification (`build_plan.md` step 10, and
 * `CLAUDE.md` rules 9–12).
 *
 * Steps 4 to 8 built the payments screen and every one of them was checked by
 * the user by hand, once, and none of them is held by anything that runs again.
 * What is covered here is what those steps built — an advance walked across
 * months, a third-party payment corrected in place, and an override on a
 * derived row — plus the one property of the calendar's sweep that only a
 * browser can show: a range is ordered by date and never by screen position.
 *
 * **No behaviour changes.** These are the flows as they stand, so that stage 3
 * swapping the store underneath them and stage 5 putting a picker in front of
 * their holidays cannot break a gesture in silence.
 *
 * **Every expected figure comes from `specs.md`, from the demo seed's own
 * stated facts, or from arithmetic worked by hand.** The seed states what it
 * gives and repays and why (`src/lib/dev/seed.ts`); the subtraction is written
 * out at each assertion so it can be checked by eye. Nothing here is read back
 * from what the screen printed and then asserted against itself.
 */

/**
 * The first worker's seeded advance, stated in `seed.ts`: ₪3,000 given in
 * February 2026 and repaid at ₪1,000 a month across March, April and May
 * (specs.md item 20 — the amount is entered per month rather than fixed by a
 * schedule). ₪3,000 − 3 × ₪1,000 leaves nothing owed.
 *
 * **What is still owed is a fact about the whole employment and not about the
 * month on screen**, so the standing reads the same in February, in March and
 * in September: the debt does not grow back because the stepper moved to a
 * month before the instalments were paid. What *is* per-month is the movement
 * recorded in it, and the two are asserted apart below — a screen that showed
 * the debt as it stood in the month being viewed would pass one and fail the
 * other, and it is the failure that looks entirely reasonable.
 */
const ADVANCE_PRINCIPAL = 300000;
const ADVANCE_INSTALMENT = 100000;

/** The first worker's seeded medical insurance: ₪1,300, paid in January 2026
 * and going to the insurer rather than to the worker (specs.md item 16). */
const MEDICAL_INSURANCE = 130000;

/**
 * The row the override below replaces: the first worker's January 2026
 * rest-day work.
 *
 * **The derived figure is worked out here rather than read off the screen.**
 * ₪426.35 is Part 4's own rest-day rate for a worker on the ₪6,247.65 minimum
 * wage in a month of twenty-six standard days, and January 2026 is such a
 * month — it has thirty-one days and five Saturdays (the 3rd, 10th, 17th, 24th
 * and 31st), so 31 − 5 = 26 exactly as August 2025 does. All five are worked,
 * nothing being marked on them, so the row comes to 5 × ₪426.35 = ₪2,131.75.
 *
 * The replacement is this test's own choice: ₪1,234.56, which no rate in the
 * application can produce, so it cannot have been arrived at by accident.
 */
const REST_DAY_RATE = 42635;
const JANUARY_2026_REST_DAYS = 5;
const DERIVED_REST_DAY_PAY = JANUARY_2026_REST_DAYS * REST_DAY_RATE;
const OVERRIDE_AGOROT = 123456;

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

/** Wait until a change has reached the store and come back. Both screens dim
 * and say so with `aria-busy`, and a spec that asserted inside that window
 * would be racing a write the user never races. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

/** Step back through the months to the one wanted, on whichever screen is
 * showing. Both screens carry the same stepper (specs.md item 5). */
async function stepBack(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
  }
}

test.describe("a range is ordered by date and never by screen position", () => {
  test("sweeps the same days whichever end is clicked first", async ({
    page,
  }) => {
    // **The failure this catches looks entirely plausible on screen**
    // (`CLAUDE.md`): in a right-to-left calendar a leftward drag moves *forward*
    // in time, so anything keyed off column index or `clientX` inverts while
    // still producing a range. Sweeping 5–8 October and 8–5 October must reach
    // the same four days.
    //
    // 5.10.2026 is a Monday and 8.10.2026 a Thursday, so no rest day and no
    // rest-eve falls inside — four whole days come off the balance (item 7).
    await useHousehold(page, "order-forward");
    await page.goto("/month");
    await switchToTestWorker(page);
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();
    await page.locator('[data-date="2026-10-05"]').click();
    await page.locator('[data-date="2026-10-08"]').click();
    await page
      .getByRole("button", {
        name: he.calendar.marks(SATURDAY).vacation,
        exact: true,
      })
      .click();
    await expect(row(page, "balance-vacation")).toContainText(
      `${he.sheet.reporting.daysUsed}: ${formatDays(4)}`,
    );

    // The same range swept from its later end, in a store of its own so the
    // first sweep is not still there.
    await useHousehold(page, "order-backward");
    await page.goto("/month");
    await switchToTestWorker(page);
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();
    await page.locator('[data-date="2026-10-08"]').click();
    await page.locator('[data-date="2026-10-05"]').click();
    await page
      .getByRole("button", {
        name: he.calendar.marks(SATURDAY).vacation,
        exact: true,
      })
      .click();
    await expect(row(page, "balance-vacation")).toContainText(
      `${he.sheet.reporting.daysUsed}: ${formatDays(4)}`,
    );

    // And the days themselves, not only their count: each of the four carries
    // the mark and the day outside the range does not.
    for (const date of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]) {
      await expect(page.locator(`[data-date="${date}"]`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await expect(page.locator('[data-date="2026-10-09"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

test.describe("an advance given and repaid, walked across months (item 20)", () => {
  test("owes the same figure whichever month is on screen", async ({ page }) => {
    await useHousehold(page, "advance");
    await page.goto("/payments");
    await switchToTestWorker(page);

    // The demo household runs to September 2026 and the screen opens on the
    // month still running, so March is six steps back. The seed states the
    // grant and the three instalments; the subtraction below is this test's.
    const advances = page.locator('[data-group="advances"]');
    const advance = advances.locator('[data-advance="1"]');

    // September, the month still running: ₪3,000 given and ₪3,000 repaid, so
    // nothing is left owed — which the row says in words rather than printing a
    // zero.
    await expect(advance).toContainText(formatAgorot(ADVANCE_PRINCIPAL));
    await expect(advance).toContainText(formatAgorot(3 * ADVANCE_INSTALMENT));
    await expect(advance).toContainText(he.month.actions.advances.settled);

    await stepBack(page, 6); // September → March
    // **The same standing, and March's own instalment beside it.** The debt did
    // not grow back because the stepper moved to a month before April and May
    // were paid: it is walked across every month she has (item 20). The ₪1,000
    // below is what March itself recorded, drawn as a deduction.
    await expect(advance).toContainText(he.month.actions.advances.settled);
    await expect(advance).toContainText(formatAgorot(-ADVANCE_INSTALMENT));

    await stepBack(page, 1); // → February, the month it was granted in
    await expect(advance).toContainText(he.month.actions.advances.settled);
    // February granted it, so the movement here is the grant and not a
    // repayment.
    await expect(advance).toContainText(
      he.month.actions.advances.movement.granted,
    );

    // A fourth instalment is refused, because it would repay more than was ever
    // given: the control does not offer the button at all, and the server
    // refuses it again if a stale page sends one (item 20).
    await expect(
      advances.getByRole("button", {
        name: he.month.actions.advances.repayLabel(1),
      }),
    ).toHaveCount(0);

    // A new advance given this month is a second debt with a number of its own,
    // minted one past the highest she carries.
    await advances
      .getByRole("button", { name: he.month.actions.advances.grant, exact: true })
      .click();
    await advances
      // `exact`, because the income-tax card beside this one is labelled
      // "סכום אחר, אם חושב אחרת" and an accessible name matches by
      // substring: without it this resolves to two fields.
      .getByRole("textbox", {
        name: he.month.actions.advances.amount,
        exact: true,
      })
      .fill(String(ADVANCE_INSTALMENT / 100));
    await advances
      .getByRole("button", {
        name: he.month.actions.advances.submitGrant,
        exact: true,
      })
      .click();
    await settled(page);

    await expect(advances.locator('[data-advance="2"]')).toContainText(
      formatAgorot(ADVANCE_INSTALMENT),
    );

    // And it is owed from every later month too, which is the walk again.
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();
    await expect(
      page.locator('[data-group="advances"] [data-advance="2"]'),
    ).toContainText(formatAgorot(ADVANCE_INSTALMENT));
    await page.screenshot({
      path: "test-results/advance-walked.png",
      fullPage: true,
    });
  });
});

test.describe("a payment to a third party, corrected in place (item 16)", () => {
  test("renames rather than duplicating, and accepts an unchanged save", async ({
    page,
  }) => {
    await useHousehold(page, "thirdparty");
    await page.goto("/payments");
    await switchToTestWorker(page);
    await stepBack(page, 8); // September 2026 → January 2026

    const words = he.month.actions.thirdParty;
    const medical = he.sheet.thirdParty.medicalInsurance;
    const agency = he.sheet.thirdParty.agencyFee;

    // January's seeded payment: ₪1,300 of medical insurance, which the employer
    // of a caregiver owes and which goes to the insurer (item 16).
    const group = page.locator('[data-group="thirdParty"]');
    await expect(group.getByText(medical, { exact: true }).first()).toBeVisible();

    // **`לשמור` on an unchanged payment is accepted.** Reopening a panel and
    // saving what it already holds must not be refused as a second payment of
    // its own kind — the kind is checked against the month's *other* payments,
    // or a payment whose kind did not change would refuse itself.
    await group.getByRole("button", { name: words.editLabel(medical) }).click();
    await group.getByRole("button", { name: words.save, exact: true }).click();
    await settled(page);
    await expect(group.getByText(medical, { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(he.month.actions.refused.thirdPartyPaidTwice),
    ).toHaveCount(0);

    // **The edit renames rather than duplicating.** The same entry reopened and
    // given a different kind is one payment under a new name, not two — the
    // sheet holds one row per kind (item 16), so a duplicate would be a month
    // the export could not lay out.
    await group.getByRole("button", { name: words.editLabel(medical) }).click();
    await group.getByRole("button", { name: agency, exact: true }).click();
    await group.getByRole("button", { name: words.save, exact: true }).click();
    await settled(page);

    await expect(group.getByText(agency, { exact: true }).first()).toBeVisible();
    await expect(
      group.getByRole("button", { name: words.editLabel(medical) }),
    ).toHaveCount(0);

    // The amount travelled with the rename, which is what "corrected in place"
    // means: it is the same payment.
    await page.goto("/month");
    await switchToTestWorker(page);
    await stepBack(page, 8);
    await expect(row(page, "thirdParty.agencyFee")).toContainText(
      formatAgorot(MEDICAL_INSURANCE),
    );
    await expect(row(page, "thirdParty.medicalInsurance")).toHaveCount(0);

    // And it stays outside her own total: money paid to somebody else is column
    // H and is never added into what reaches the worker (item 16). The month's
    // subtotal for H is the payment and the worker's total does not contain it.
    await expect(row(page, "subtotal-H")).toContainText(
      formatAgorot(MEDICAL_INSURANCE),
    );
    await page.screenshot({
      path: "test-results/third-party-renamed.png",
      fullPage: true,
    });
  });
});

test.describe("an override on a derived row (specs.md item 17)", () => {
  test("marks the figure manual, says what it replaced, and takes zero", async ({
    page,
  }) => {
    await useHousehold(page, "override");
    const words = he.month.actions.overrides;
    const label = he.sheet.lines.restDays(SATURDAY);

    // January 2026 for the first worker, whose rest day is Saturday, so the row
    // is her rest-day work — a figure the application worked out from the wage
    // and therefore the kind of row an override may replace.
    await page.goto("/month");
    await switchToTestWorker(page);
    await stepBack(page, 8);
    // The derived figure, before anything is typed over it: five rest days at
    // Part 4's own rate. Worked out above and not read back off the screen.
    await expect(row(page, "restDays")).toContainText(
      formatAgorot(DERIVED_REST_DAY_PAY),
    );
    await expect(row(page, "restDays")).not.toContainText(he.money.manual);

    await page.goto("/payments");
    await switchToTestWorker(page);
    await stepBack(page, 8);
    const group = page.locator('[data-group="overrides"]');
    await group.getByRole("button", { name: words.changeLabel(label) }).click();
    // Anchored, because the note field's hint below it also contains the word
    // "סכום" and an accessible name is matched as a substring.
    await group
      .getByRole("textbox", { name: new RegExp(`^${words.amount}`) })
      .fill(String(OVERRIDE_AGOROT / 100));
    await group.getByRole("button", { name: words.save, exact: true }).click();
    await settled(page);

    // **The figure is the one typed, marked manual, with what it replaced
    // beside it** (items 17, 24). ₪1,234.56 is a figure no rate in the
    // application can produce, so it cannot have been arrived at by accident.
    await page.goto("/month");
    await switchToTestWorker(page);
    await stepBack(page, 8);
    await expect(row(page, "restDays")).toContainText(
      formatAgorot(OVERRIDE_AGOROT),
    );
    await expect(row(page, "restDays")).toContainText(he.money.manual);
    await page.screenshot({
      path: "test-results/override-manual.png",
      fullPage: true,
    });

    // **The row still says what it would otherwise have been**, beside what it
    // now says (items 17, 24) — which is the whole of why a replacement is
    // checkable without anybody recalculating it by hand. The figure quoted
    // there is the derived one worked out at the top of this file.
    await page.goto("/payments");
    await switchToTestWorker(page);
    await stepBack(page, 8);
    const replaced = page
      .locator('[data-group="overrides"] li')
      .filter({ hasText: label });
    await expect(replaced).toContainText(words.calculated);
    await expect(replaced).toContainText(formatAgorot(DERIVED_REST_DAY_PAY));

    // **Zero is an ordinary override and not a refusal** (item 17). It is the
    // only way to say that a derived row came to nothing this month — which is
    // where it differs from a line the user adds, where zero is refused
    // (item 20).
    await page.goto("/payments");
    await switchToTestWorker(page);
    await stepBack(page, 8);
    const again = page.locator('[data-group="overrides"]');
    await again.getByRole("button", { name: words.changeLabel(label) }).click();
    await again
      .getByRole("textbox", { name: new RegExp(`^${words.amount}`) })
      .fill("0");
    await again.getByRole("button", { name: words.save, exact: true }).click();
    await settled(page);
    await expect(
      page.getByText(he.month.actions.refused.amount),
    ).toHaveCount(0);

    await page.goto("/month");
    await switchToTestWorker(page);
    await stepBack(page, 8);
    await expect(row(page, "restDays")).toContainText(formatAgorot(0));
    await expect(row(page, "restDays")).toContainText(he.money.manual);

    // **Clearing is its own gesture and restores the derived figure.** Typing
    // the calculated number back would store it by hand for ever; clearing
    // leaves the row derived, so a later correction to the wage moves it again.
    await page.goto("/payments");
    await switchToTestWorker(page);
    await stepBack(page, 8);
    await page
      .locator('[data-group="overrides"]')
      .getByRole("button", { name: words.clearLabel(label) })
      .click();
    await settled(page);

    await page.goto("/month");
    await switchToTestWorker(page);
    await stepBack(page, 8);
    await expect(row(page, "restDays")).not.toContainText(he.money.manual);
    // And it is the derived figure again, worked out above rather than
    // remembered from earlier in this test: clearing leaves the row derived, so
    // it comes back to what five rest days at Part 4's rate actually come to.
    await expect(row(page, "restDays")).toContainText(
      formatAgorot(DERIVED_REST_DAY_PAY),
    );
  });
});
