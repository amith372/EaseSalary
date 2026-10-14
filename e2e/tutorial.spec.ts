import { expect, test } from "@playwright/test";
import { useHousehold } from "./household";
import { he } from "../src/lib/i18n/he";

/**
 * The one card a family's first sign-in opens — `specs.md` item 32, through the
 * screen it opens over (`CLAUDE.md` rules 10–13).
 *
 * **The scenario.** The `fresh` household is what an account registered a
 * moment ago is: nothing in it, and the card still owed. Every other seed is a
 * household that has been running, so the card is already left in all of them —
 * which is itself asserted below, because the opposite default would put a card
 * over every screen the rest of this suite drives.
 *
 * **What it would catch**: a card that does not open itself on the first
 * screen; one that opens a second time, which is the whole of what "once"
 * means; one that opens over the wizard it has just sent the family to, the
 * defect that follows from recording only the skip; a row that cannot bring it
 * back; and a card appearing over a household that has months in it.
 *
 * **What no test here reaches.** A member who joins through an invitation is
 * never shown it, and that is written in the migration — `accept_household_
 * invitation` sets the column as it inserts the membership. The browser suite
 * runs against the in-memory store and never against Postgres, so nothing here
 * can drive it; it is the one half of item 32 proven by reading the SQL.
 */

test.describe("the card a first sign-in opens (specs.md item 32)", () => {
  const card = '[data-role="tutorial"]';

  test("opens itself over the first screen, and says what the month is", async ({
    page,
  }) => {
    await useHousehold(page, "fresh", "opens");
    await page.goto("/");

    // It opens by itself: nothing was pressed between the sign-in and this.
    await expect(page.locator(card)).toBeVisible();
    // **Inside the panel that holds the assistant** and not on a surface of
    // its own (item 32) — the handle is the panel's own, so a second dialog
    // built for this would fail here rather than pass by looking similar.
    await expect(page.locator('[data-role="help-panel"]')).toBeVisible();
    // It opened a card and did not navigate.
    await expect(page).toHaveURL(/\/$/);

    // The three things a month takes, in the order a month goes.
    for (const step of he.tutorial.steps) {
      await expect(page.locator(card)).toContainText(step);
    }
    // And the step it leads to, named as the empty household names it.
    await expect(page.locator('[data-role="tutorial-add"]')).toContainText(
      he.tutorial.add,
    );

    // The launcher stands down while the card is up: the way out is where the
    // way in was, and two controls in one corner would be one too many. It is
    // **transparent and not removed**, so the assertion is the opacity and not
    // the absence: closing a `<dialog>` hands focus back to whatever held it,
    // and a control taken out of the page cannot take it.
    await expect(page.locator('[data-role="help-launcher"]')).toHaveCSS("opacity", "0");
  });

  test("is shown once — leaving it is remembered across a reload", async ({ page }) => {
    await useHousehold(page, "fresh", "once");
    await page.goto("/");
    await expect(page.locator(card)).toBeVisible();

    await page.locator('[data-role="tutorial-skip"]').click();
    await expect(page.locator(card)).toBeHidden();
    await expect(page.locator('[data-role="help-launcher"]')).toBeVisible();

    // **The reload is the assertion.** The card is drawn from state the server
    // read, so a dismissal kept only in the browser would pass every check
    // above this line and fail here — which is the defect the column exists to
    // make impossible.
    await page.reload();
    await expect(page.locator('[data-role="help-launcher"]')).toBeVisible();
    await expect(page.locator(card)).toBeHidden();

    // A second screen, because the panel is drawn on every route: a flag held
    // by this page's own component would come back on the next one.
    await page.goto("/payments");
    await expect(page.locator(card)).toBeHidden();
  });

  test("the way into the wizard leaves it too, so it does not open over the step", async ({
    page,
  }) => {
    await useHousehold(page, "fresh", "wizard");
    await page.goto("/");
    await expect(page.locator(card)).toBeVisible();

    await page.locator('[data-role="tutorial-add"]').click();

    // It reached the step it exists to lead to.
    await expect(page).toHaveURL(/\/workers\/new$/);
    await expect(
      page.getByRole("heading", { name: he.addWorker.who.title }),
    ).toBeVisible();
    // **And the card is not over it.** This is the one the press has to get
    // right: recording the leaving only on `דילוג` leaves the card owed, and
    // the panel is drawn on this route too — so it would open itself over the
    // first field the family was sent here to fill.
    await expect(page.locator(card)).toBeHidden();

    // Nor on the screen they came from, which is where the record is read
    // again.
    await page.goto("/");
    await expect(page.locator(card)).toBeHidden();
  });

  test("can be reached again, from the head of the questions", async ({ page }) => {
    await useHousehold(page, "fresh", "again");
    await page.goto("/");
    await page.locator('[data-role="tutorial-skip"]').click();
    await expect(page.locator(card)).toBeHidden();

    await page.locator('[data-role="help-launcher"]').click();
    await page.locator('[data-tab="faq"]').click();
    const again = page.locator('[data-row="tutorial-again"]');
    await expect(again).toContainText(he.tutorial.again);
    await again.click();

    await expect(page.locator(card)).toBeVisible();
    // Re-opened on purpose and not re-owed: leaving it a second time changes
    // nothing, so the next screen is still without it.
    await page.locator('[data-role="tutorial-skip"]').click();
    await page.goto("/");
    await expect(page.locator(card)).toBeHidden();
  });

  test("never opens over a household that has been running", async ({ page }) => {
    await useHousehold(page, "demo", "tutorial-silent");
    await page.goto("/");

    // The demo has two workers and nine months, so there is no first sign-in
    // to introduce — and this is the assertion that keeps the rest of the
    // suite honest: a default the other way would draw this card over every
    // spec in `e2e/`.
    await expect(page.locator('[data-role="help-launcher"]')).toBeVisible();
    await expect(page.locator(card)).toBeHidden();
  });
});
