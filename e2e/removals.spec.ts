import { expect, test, type Page } from "@playwright/test";
import {
  openPaymentSections,
  openSettingsForTestWorker,
  switchToTestWorker,
  TODAY,
} from "./household";
import { monthOf } from "../src/lib/dates";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";

/**
 * Removing a row — the five gestures that take one back out.
 *
 * Every *add* in this suite is driven and no *remove* was, which is the
 * asymmetry this file exists to close. All five share one shape: an id or a
 * number carried from a row to a delete, which is the argument most likely to
 * be wrong, and a wrong one takes the neighbouring row instead.
 *
 * **So every test here removes one of two rows and asserts the survivor by its
 * own name.** A single-row test passes against a delete that ignores its
 * argument entirely, which is precisely the defect: the screen looks right
 * either way, because the row that should have gone did go.
 *
 * **Where the expected figures come from.** The amounts typed in are this
 * file's own — item 20 gives none, because a line the user adds is the user's.
 * The assertions are therefore on *differences*: a removal returns the month to
 * the figure it stood at before the line was added, and the arithmetic between
 * the two is written out at each step. The baseline is read once and cancels
 * out of every assertion made against it, so nothing here asserts an absolute
 * the engine produced against itself (`CLAUDE.md` rule 11). Where an absolute
 * *is* asserted it is the seed's own stated fact — January's ₪1,300 of medical
 * insurance (`seed.ts`) — and it is named as such.
 */

/** The two one-off lines, in agorot. Both additions, which is what a line saved
 * without touching the direction is (`defaultPlacementFor`). */
const TRAVEL = 30000;
const POCKET_MONEY = 8000;

/** The first worker's seeded medical insurance: ₪1,300, paid in January 2026
 * and going to the insurer rather than to the worker (specs.md item 16). The
 * agency fee added beside it is this test's own. */
const MEDICAL_INSURANCE = 130000;
const AGENCY_FEE = 30000;

/** The first worker's seeded advance, as `seed.ts` states it: ₪3,000 given in
 * February 2026 and repaid at ₪1,000 in each of March, April and May, so
 * nothing is left owed. The second advance below is this test's own. */
const SEEDED_ADVANCE = 300000;
const SECOND_ADVANCE = 50000;

/** A standing line and an opening advance of this test's own (items 20, 6). */
const STANDING_A = 25000;
const STANDING_B = 11000;
const OPENING_PRINCIPAL = 200000;

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

/** Wait until the write has reached the store and come back. Both screens dim
 * and say so with `aria-busy`, and a spec that asserted inside that window
 * would be racing a write no user can race. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** The month the demo household opens on, as `YYYY-MM`. Read off the clock so
 * the spec does not pin itself to one month. */
function thisMonth(): string {
  const { year, month } = monthOf(TODAY);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * The month's ‏ברוטו‎ in agorot, off the payslip.
 *
 * `data-money` carries the integer the row was drawn from, so a delta is
 * arithmetic rather than a match on formatted digits — and the assertions below
 * are all deltas.
 */
async function grossOf(page: Page, month: string): Promise<number> {
  await page.goto(`/month/payslip?month=${month}`);
  await switchToTestWorker(page);
  const value = await page
    .locator('[data-row="gross"] [data-money]')
    .first()
    .getAttribute("data-money");
  expect(value).not.toBeNull();
  return Number(value);
}

/** The payments screen showing the test worker, with every section unfolded. */
async function openPayments(page: Page): Promise<void> {
  await page.goto("/payments");
  await switchToTestWorker(page);
  await openPaymentSections(page);
}

/** Step back through the months on whichever screen is showing. */
async function stepBack(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
  }
}

/** Add a one-off line to the month on screen, as a family adds one. */
async function addLine(
  page: Page,
  label: string,
  agorot: number,
): Promise<void> {
  const words = he.month.actions.lines;
  const lines = page.locator('[data-group="userLines"]');
  await lines.getByRole("button", { name: words.add }).click();
  await lines.getByRole("textbox", { name: words.label }).fill(label);
  await lines
    .getByRole("textbox", { name: words.amount })
    .fill(String(agorot / 100));
  await lines
    .getByRole("button", { name: words.submit, exact: true })
    .click();
  await settled(page);
}

test.describe("a line removed from a month (specs.md item 20)", () => {
  /**
   * Scenario: two one-off additions are typed into September 2026 — ₪300 of
   * travel and ₪80 of pocket money — and the **second** is removed first.
   *
   * Expected: the ‏ברוטו‎ rises by ₪380, falls to +₪300 when the ₪80 line goes,
   * and returns to where it started when the ₪300 line goes too. The ₪300 line
   * is still on the screen, under its own words, in between.
   *
   * **What it would catch**: a remove wired to the wrong id — which takes the
   * neighbour and leaves a screen that looks entirely correct, since a row did
   * disappear; a remove that leaves the store and only redraws the client,
   * which the payslip read afterwards would still show; and a line removed from
   * the list but left in the month's total, which is the one failure that
   * reaches a filed sheet.
   */
  test("takes the line it names and leaves the other, in the list and in the total", async ({
    page,
  }) => {
    await useHousehold(page, "line-removal");
    const words = he.month.actions.lines;
    const travel = "החזר נסיעה";
    const pocket = "דמי כיס";

    // The month before anything is typed into it. This is a baseline and not an
    // expected figure: every assertion below is a difference from it.
    const before = await grossOf(page, thisMonth());

    await openPayments(page);
    await addLine(page, travel, TRAVEL);
    await addLine(page, pocket, POCKET_MONEY);

    // ₪300 + ₪80 = ₪380 more than the month stood at.
    expect(await grossOf(page, thisMonth())).toBe(before + TRAVEL + POCKET_MONEY);

    // **The line removed is the one added *second*, and that is deliberate.**
    // Removing the first would be indistinguishable from an implementation that
    // always drops the first row it holds — the defect this test exists to
    // catch — because the right row would disappear either way.
    await openPayments(page);
    await page
      .locator('[data-group="userLines"]')
      .getByRole("button", { name: words.removeLabel(pocket) })
      .click();
    await settled(page);

    // **The other line is still there, and it is the other line.** Its edit
    // control is what names it, since a row carries the user's own sentence and
    // nothing else a test can address it by.
    const lines = page.locator('[data-group="userLines"]');
    await expect(
      lines.getByRole("button", { name: words.editLabel(travel) }),
    ).toBeVisible();
    await expect(
      lines.getByRole("button", { name: words.editLabel(pocket) }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "test-results/removal-one-line-left.png",
      fullPage: true,
    });

    // And the money followed: ₪300 above the baseline, not ₪380 and not ₪0.
    expect(await grossOf(page, thisMonth())).toBe(before + TRAVEL);

    // The remaining one goes the same way, and the month is where it began.
    await openPayments(page);
    await page
      .locator('[data-group="userLines"]')
      .getByRole("button", { name: words.removeLabel(travel) })
      .click();
    await settled(page);
    await expect(
      page.locator('[data-group="userLines"]').getByText(words.empty),
    ).toBeVisible();
    expect(await grossOf(page, thisMonth())).toBe(before);
  });
});

test.describe("a payment to a third party, removed (specs.md item 16)", () => {
  /**
   * Scenario: January 2026 carries the seed's ₪1,300 of medical insurance. An
   * agency fee of ₪300 is recorded beside it and then removed.
   *
   * Expected: the insurance is still there at ₪1,300 — the seed's own figure,
   * not one read off the screen — and column H's subtotal is ₪1,300 again,
   * because money paid to somebody else never enters the worker's own total
   * (item 16).
   *
   * **What it would catch**: a remove keyed on something other than the kind,
   * which here would take the insurance and leave the fee; and a payment
   * removed from the list while its amount stays in the H subtotal, which is a
   * sheet that does not add up.
   */
  test("takes the fee it names and leaves the insurance, in the list and in column H", async ({
    page,
  }) => {
    await useHousehold(page, "third-party-removal");
    const words = he.month.actions.thirdParty;
    const medical = he.sheet.thirdParty.medicalInsurance;
    const agency = he.sheet.thirdParty.agencyFee;

    await openPayments(page);
    await stepBack(page, 8); // September 2026 → January 2026

    const group = page.locator('[data-group="thirdParty"]');
    await group.getByRole("button", { name: words.add, exact: true }).click();
    await group.getByRole("button", { name: agency, exact: true }).click();
    await group.getByLabel(words.amount).fill(String(AGENCY_FEE / 100));
    await group.getByLabel(words.paidOn).fill("2026-01-19");
    await group.getByRole("button", { name: words.submit, exact: true }).click();
    await settled(page);

    // Both rows are on the month before anything is removed.
    await expect(group.getByText(agency, { exact: true }).first()).toBeVisible();
    await expect(group.getByText(medical, { exact: true }).first()).toBeVisible();

    await group.getByRole("button", { name: words.removeLabel(agency) }).click();
    await settled(page);

    // **The insurance survived and the fee did not.**
    await expect(group.getByText(medical, { exact: true }).first()).toBeVisible();
    await expect(
      group.getByRole("button", { name: words.editLabel(agency) }),
    ).toHaveCount(0);

    // And the sheet says the same: column H holds the seed's ₪1,300 alone.
    await page.goto("/month/payslip?month=2026-01");
    await switchToTestWorker(page);
    await expect(page.locator('[data-row="thirdParty.medicalInsurance"]')).toContainText(
      formatAgorot(MEDICAL_INSURANCE),
    );
    await expect(page.locator('[data-row="thirdParty.agencyFee"]')).toHaveCount(0);
    await expect(page.locator('[data-row="subtotal-H"]')).toContainText(
      formatAgorot(MEDICAL_INSURANCE),
    );
  });
});

test.describe("a movement removed from an advance (specs.md item 20)", () => {
  /**
   * Scenario: the seeded advance of ₪3,000 stands settled. A second advance of
   * ₪500 is granted this month and then its grant is removed.
   *
   * Expected: advance 2 leaves the screen entirely — a grant is its only
   * movement, so removing it removes the debt — while advance 1 is untouched
   * and still reads ₪3,000, settled.
   *
   * **What it would catch**: a remove keyed on the advance's number alone,
   * ignoring which movement was pressed, and a remove that takes the lowest
   * number rather than the one named — either of which would delete the seeded
   * ₪3,000 and leave the family a debt they had paid off reappearing or
   * vanishing without a record.
   */
  test("takes the grant it names and leaves the settled advance standing", async ({
    page,
  }) => {
    await useHousehold(page, "advance-removal");
    const words = he.month.actions.advances;

    await openPayments(page);
    const advances = page.locator('[data-group="advances"]');

    await advances
      .getByRole("button", { name: words.grant, exact: true })
      .click();
    await advances
      // `exact`, because the income-tax card beside this one is labelled
      // "סכום אחר, אם חושב אחרת" and an accessible name matches by substring.
      .getByRole("textbox", { name: words.amount, exact: true })
      .fill(String(SECOND_ADVANCE / 100));
    await advances
      .getByRole("button", { name: words.submitGrant, exact: true })
      .click();
    await settled(page);

    await expect(advances.locator('[data-advance="2"]')).toContainText(
      formatAgorot(SECOND_ADVANCE),
    );

    await advances
      .getByRole("button", { name: words.removeLabel(2, "granted") })
      .click();
    await settled(page);

    // **The second debt is gone and the first is exactly as the seed left it.**
    // ₪3,000 is `seed.ts`'s own figure and the three ₪1,000 instalments against
    // it are too, so "settled" is the seed's arithmetic and not the screen's.
    await expect(advances.locator('[data-advance="2"]')).toHaveCount(0);
    const first = advances.locator('[data-advance="1"]');
    await expect(first).toContainText(formatAgorot(SEEDED_ADVANCE));
    await expect(first).toContainText(words.settled);
  });
});

test.describe("a standing line removed from the profile (specs.md item 20)", () => {
  /**
   * Scenario: two standing lines are set on the profile — ₪250 and ₪110 — and
   * the ₪110 one, added second, is removed.
   *
   * Expected: this month's sheet carries ₪250 and no ₪110, and the profile
   * offers an edit for the survivor alone.
   *
   * **What it would catch**: a remove wired to the wrong id, which on the
   * profile is worse than on a month — a standing line runs in *every* month
   * from its first, so the wrong deletion silently restates every sheet the
   * line was on.
   */
  test("takes the line it names out of every month, and leaves the other", async ({
    page,
  }) => {
    await useHousehold(page, "standing-removal");
    const terms = he.workers.profile.terms.standing;
    const lines = he.month.actions.lines;
    const first = "השתתפות בטלפון";
    const second = "דמי כיס";

    await openSettingsForTestWorker(page);
    const standing = page.locator('[data-terms="standing"]');

    for (const [label, agorot] of [
      [first, STANDING_A],
      [second, STANDING_B],
    ] as const) {
      await standing.getByRole("button", { name: terms.add }).click();
      await standing.getByRole("textbox", { name: lines.label }).fill(label);
      await standing
        .getByRole("textbox", { name: lines.amount })
        .fill(String(agorot / 100));
      await standing
        .getByRole("button", { name: lines.submit, exact: true })
        .click();
      await settled(page);
    }

    // Both reach this month's sheet before either is removed.
    await page.goto(`/month/payslip?month=${thisMonth()}`);
    await switchToTestWorker(page);
    const onSheet = page.locator('[data-row^="standing."]');
    await expect(onSheet).toContainText([
      formatAgorot(STANDING_A),
      formatAgorot(STANDING_B),
    ]);

    // **The one added second is the one removed**, for the reason the one-off
    // test gives: removing the first would pass against an implementation that
    // drops whichever row it holds first, which is the defect itself.
    await openSettingsForTestWorker(page);
    await page
      .locator('[data-terms="standing"]')
      .getByRole("button", { name: terms.removeLabel(second) })
      .click();
    await settled(page);

    await expect(
      page
        .locator('[data-terms="standing"]')
        .getByRole("button", { name: terms.editLabel(first) }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-terms="standing"]')
        .getByRole("button", { name: terms.editLabel(second) }),
    ).toHaveCount(0);

    // **And the sheet follows.** One row, at the survivor's own amount.
    await page.goto(`/month/payslip?month=${thisMonth()}`);
    await switchToTestWorker(page);
    await expect(page.locator('[data-row^="standing."]')).toHaveCount(1);
    await expect(page.locator('[data-row^="standing."]')).toContainText(
      formatAgorot(STANDING_A),
    );
  });
});

test.describe("an opening advance removed from the profile (specs.md item 6)", () => {
  /**
   * Scenario: an opening advance of ₪2,000 is entered on the profile — the
   * mirror of the test that adds one — and then removed.
   *
   * Expected: the payments screen no longer carries it, and the first worker's
   * seeded ₪3,000 advance is untouched and still settled.
   *
   * **What it would catch**: the opening advance removed from the profile but
   * left in the position the replay starts from, which would leave a debt the
   * family can see being repaid and cannot find; and a removal that renumbers
   * the advances, which would move the seeded one under a number the months
   * already reference.
   */
  test("takes the entered debt off the payments screen, leaving the seeded one", async ({
    page,
  }) => {
    await useHousehold(page, "opening-removal");
    const words = he.workers.profile.terms.opening;

    await openSettingsForTestWorker(page);
    const opening = page.locator('[data-terms="opening"]');
    await opening.getByRole("button", { name: words.addAdvance }).click();
    await opening
      .getByRole("textbox", { name: words.principal })
      .fill(String(OPENING_PRINCIPAL / 100));
    await opening
      .getByRole("button", { name: words.submit, exact: true })
      .click();
    await settled(page);

    // It is the debt the payments screen repays, before it is taken back out.
    await openPayments(page);
    await expect(page.locator('[data-advance="2"]')).toContainText(
      formatAgorot(OPENING_PRINCIPAL),
    );

    await openSettingsForTestWorker(page);
    await page
      .locator('[data-terms="opening"]')
      .getByRole("button", { name: words.removeLabel(2) })
      .click();
    await settled(page);

    // **Gone, and the seeded advance is where it was.** ₪3,000 settled is
    // `seed.ts`'s own arithmetic: given in February, repaid at ₪1,000 in each
    // of March, April and May.
    await openPayments(page);
    await expect(page.locator('[data-advance="2"]')).toHaveCount(0);
    const seeded = page.locator('[data-advance="1"]');
    await expect(seeded).toContainText(formatAgorot(SEEDED_ADVANCE));
    await expect(seeded).toContainText(he.month.actions.advances.settled);
  });
});
