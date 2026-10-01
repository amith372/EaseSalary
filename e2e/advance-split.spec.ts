import { expect, test, type Page } from "@playwright/test";
import { openPaymentSections, switchToTestWorker } from "./household";
import { he } from "../src/lib/i18n/he";
import { monthLabel } from "../src/lib/dateLabels";
import { formatAgorot } from "../src/lib/money";

/**
 * A grant split across months as it is given, and the day it was given
 * (`specs.md` item 20, `build_plan.md` stage 10).
 *
 * **Every figure here is the user's own decision written out by hand.** ₪5,000
 * over three months is 1,666.66 / 1,666.66 / 1,666.68 — the even floor for as
 * long as possible and the odd figure once, at the end — and the three sum to
 * ₪5,000 exactly, which is why the advance closes. Nothing below is read back
 * from what the screen printed and then asserted against itself.
 *
 * **It reads the three months' figures and never the three presses.** One
 * gesture writes three months, so what has to be shown is that each month
 * afterwards holds its own ordinary repayment — a split that wrote the month on
 * screen and nothing else would pass a test that only checked the press was
 * accepted. The debt closing to nothing is the one assertion that covers the
 * exact-sum rule, since an agora lost anywhere in the division would leave it
 * owed.
 *
 * **What this would catch**: a split that wrote only the month in front of the
 * user; instalments that divided evenly and dropped the remainder, leaving a
 * debt no repayment can close; a grant written into every month of the span
 * rather than into its own; a date that reached the store and not the screen;
 * and a span crossing a confirmed month, which must write nothing and say which
 * month stopped it.
 */

/** The second worker — the ordinary one every browser test acts on
 * (`household.ts`) — already carries advance 1 from the seed, so the one given
 * here is numbered by the application as 2. */
const ADVANCE = 2;
const PRINCIPAL = 500000;
const EVEN_THIRD = 166666;
const LAST_THIRD = 166668;

/** The grant is recorded in July 2026 — two months back from the month the demo
 * runs in, and a month nothing in the demo has confirmed, so the span July,
 * August, September is clear. The date is a day of that month, which is the only
 * thing the application refuses about it. */
const AUGUST = { year: 2026, month: 8 };
const GIVEN_ON = "2026-07-10";

/** August 2026 as `seed.ts` writes it: one holiday worked on the 20th and
 * nothing else — the answers that agree with the month, which is what the
 * confirmation below has to give before it can confirm it. */
const AUGUST_AGREES = ["holidaysWorked"];

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

/** Wait until a change has reached the store and come back: the card says so
 * with `aria-busy`, and an assertion made inside that window races a write the
 * user never races. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

async function stepBack(page: Page, months: number): Promise<void> {
  for (let step = 0; step < months; step += 1) {
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
  }
}

async function stepForward(page: Page, months: number): Promise<void> {
  for (let step = 0; step < months; step += 1) {
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();
  }
}

/** The advances group, and one advance inside it. */
function advances(page: Page) {
  return page.locator('[data-group="advances"]');
}

/**
 * The payments screen on the ordinary worker, stepped back to July 2026 with the
 * advances group open.
 */
async function openJuly(page: Page): Promise<void> {
  await page.goto("/payments");
  await switchToTestWorker(page);
  await openPaymentSections(page);
  // The screen opens on the month still running, September.
  await stepBack(page, 2);
}

/** Fills the grant panel: the amount, the day it was handed over, and how many
 * months to split it across. */
async function fillGrant(page: Page, months: string): Promise<void> {
  const words = he.month.actions.advances;
  const group = advances(page);
  await group.getByRole("button", { name: words.grant }).click();
  await group.getByLabel(words.amount, { exact: true }).fill("5000");
  await group.getByLabel(words.givenOn).fill(GIVEN_ON);
  await group.getByLabel(words.split.months).fill(months);
}

test.describe("an advance repaid over several months (item 20)", () => {
  test("writes one ordinary repayment per month, summing to the grant exactly", async ({
    page,
  }) => {
    const words = he.month.actions.advances;
    await useHousehold(page, "split");
    await openJuly(page);
    await fillGrant(page, "3");

    const group = advances(page);
    // **The application proposes the division and the user presses.** The three
    // fields open holding the even floor twice and the remainder once, which is
    // the figure a family would otherwise have to work out from ₪5,000 ÷ 3.
    await expect(group.locator('[data-instalment="2026-07"]')).toHaveValue(
      "1666.66",
    );
    await expect(group.locator('[data-instalment="2026-08"]')).toHaveValue(
      "1666.66",
    );
    await expect(group.locator('[data-instalment="2026-09"]')).toHaveValue(
      "1666.68",
    );

    await group.getByRole("button", { name: words.split.submit }).click();
    await settled(page);

    // **The debt closes.** ₪5,000 given and ₪5,000 repaid across the three
    // months, so nothing is left owed — which the row says in words rather than
    // printing a zero. An agora lost in the division would leave it open here.
    const advance = group.locator(`[data-advance="${ADVANCE}"]`);
    await expect(advance).toContainText(formatAgorot(PRINCIPAL));
    await expect(advance).toContainText(words.settled);

    // July: the grant, its date, and July's own instalment beside it.
    await expect(advance).toContainText(words.movement.granted);
    await expect(advance).toContainText(formatAgorot(-EVEN_THIRD));

    // **Each month afterwards holds its own ordinary repayment**, read in the
    // month itself — the figures the one press wrote into months the user was
    // not looking at.
    await stepForward(page, 1);
    await expect(advance).toContainText(words.movement.repaid);
    await expect(advance).toContainText(formatAgorot(-EVEN_THIRD));
    await expect(advance).not.toContainText(words.movement.granted);

    await stepForward(page, 1);
    await expect(advance).toContainText(formatAgorot(-LAST_THIRD));
    await expect(advance).not.toContainText(words.movement.granted);

    // **And the month's own preview says the same figure** — one calculation
    // path shown twice (`CLAUDE.md` rule 12). September's closing block carries
    // the last instalment, by the row's own key rather than by the Hebrew
    // beside it.
    await page.goto("/");
    await switchToTestWorker(page);
    await expect(
      page.locator(`[data-row="advance.${ADVANCE}.repaid"]`),
    ).toContainText(formatAgorot(-LAST_THIRD));
  });

  /**
   * The day the money was handed over survives the round trip and is shown from
   * every month, not only from the one that granted it (item 20).
   *
   * It is a separate test because it is a separate claim: the figures above would
   * all pass with the date dropped on its way into the store.
   */
  test("keeps the day the advance was given, and shows it from a later month", async ({
    page,
  }) => {
    await useHousehold(page, "splitdate");
    await openJuly(page);
    await fillGrant(page, "3");
    await advances(page)
      .getByRole("button", { name: he.month.actions.advances.split.submit })
      .click();
    await settled(page);

    const advance = advances(page).locator(`[data-advance="${ADVANCE}"]`);
    // The day as the application writes a date with its year, which is what a
    // date read from another month needs. Written out rather than formatted, so
    // a date that reached the screen as `2026-07-10` would fail this.
    const said = "10 ביולי 2026";
    await expect(advance).toContainText(he.month.actions.advances.givenOnShown);
    await expect(advance).toContainText(said);

    // From September, two months after the grant: the standing carries the date
    // because from a later month the advance is otherwise a number and an
    // amount.
    await stepForward(page, 2);
    await expect(advance).toContainText(said);
  });

  /**
   * **A confirmed month anywhere in the span refuses the whole split, and the
   * month is named** (item 20) — the rule a holiday move already follows: a
   * filed month is never rewritten by an action taken elsewhere.
   *
   * August is confirmed through the screen that confirms a month, so the state
   * is one a family reaches rather than one a seed asserts. The span July to
   * September then crosses it.
   */
  test("refuses a span that crosses a confirmed month, naming it", async ({
    page,
  }) => {
    await useHousehold(page, "splitblocked");

    // Confirm August 2026 — the month `/month/export` opens on, being the last
    // that ended (item 21).
    await page.goto("/month/export");
    await switchToTestWorker(page);
    const questions = page.locator("[data-question]");
    const count = await questions.count();
    for (let index = 0; index < count; index += 1) {
      const row = questions.nth(index);
      const key = await row.getAttribute("data-question");
      const answer =
        key !== null && AUGUST_AGREES.includes(key)
          ? he.beforeExport.questions.yes
          : he.beforeExport.questions.no;
      await row.getByRole("button", { name: answer, exact: true }).click();
    }
    await page.locator("[data-finish]").click();
    // The press confirms the month *and* hands over the file, so the browser is
    // in a download while the card is still busy. What says the confirmation
    // landed is the card saying so, and never the absence of a busy state.
    await expect(page.locator("[data-confirmed]")).toBeVisible({
      timeout: 20_000,
    });

    await openJuly(page);
    await fillGrant(page, "3");

    const group = advances(page);
    // The month is named where the split is made, before the press: a control
    // that answers a click with a refusal is a control that should not have been
    // pressable.
    await expect(group).toContainText(
      he.month.actions.advances.split.confirmedMonth(monthLabel(AUGUST)),
    );
    await expect(
      group.getByRole("button", { name: he.month.actions.advances.split.submit }),
    ).toBeDisabled();

    // Nothing was written: the worker still has only the seeded advance.
    await expect(group.locator(`[data-advance="${ADVANCE}"]`)).toHaveCount(0);

    // Shortened to end before the confirmed month, the same split is offered —
    // which is what makes the sentence above advice rather than a dead end.
    await group.getByLabel(he.month.actions.advances.split.months).fill("1");
    await expect(
      group.getByRole("button", { name: he.month.actions.advances.split.submit }),
    ).toBeEnabled();
    await expect(group).not.toContainText(
      he.month.actions.advances.split.confirmedMonth(monthLabel(AUGUST)),
    );
    // And September, after the confirmed month, is refused for the same reason
    // the month in the middle was: the span starts where the grant is.
    await group.getByLabel(he.month.actions.advances.split.months).fill("3");
    await expect(group).toContainText(
      he.month.actions.advances.split.confirmedMonth(monthLabel(AUGUST)),
    );
  });
});
