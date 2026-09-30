import { expect, test, type Page } from "@playwright/test";
import { openSettingsForTestWorker, useHousehold } from "./household";
import { he } from "../src/lib/i18n/he";

/**
 * A control whose action cannot answer says so, and the rest of the screen
 * keeps working.
 *
 * **The defect this exists to catch.** A server action that throws is rethrown
 * by React from its own dispatch, and the whole tree is replaced by Next's
 * English screen — `This page couldn't load. A server error occurred.` No
 * `catch` around the awaited call sees it, which is why the fault is *returned*
 * by the action instead (`src/lib/actionFault.ts`) and why the client half alone
 * would have changed nothing.
 *
 * **The scenario is one the PRD names as reachable**: the worker is gone from
 * under the screen. The chips are drawn for a worker who exists, the household
 * is then swapped for one that does not hold them, and the press lands on
 * `requireWorker`, which throws `UnknownWorkerError`. A cookie is how every spec
 * in this directory chooses its store, so nothing here reaches past the
 * interface to stage it.
 *
 * **The expected sentence is the user's own wording of 2026-09-27**, written out
 * rather than read off `he.fault`: a test that imports the string it checks
 * passes whatever that string later silently becomes.
 */
const FAULT = "משהו השתבש, כדאי לנסות שוב או לחזור לדף הבית";

const words = he.workers.profile.terms.restDay;

/** The chips, on the test worker's settings — the second worker, who carries the
 * ordinary terms, the first being seeded from the family's own sheets. */
function chips(page: Page) {
  return page.locator('[data-terms="restDay"]');
}

/** Puts the browser in a household that holds nobody, without touching the page
 * already drawn. `empty` is the seed a new account is in, so the worker the
 * chips were drawn for is not in it. */
async function loseTheWorker(page: Page): Promise<void> {
  await page.context().clearCookies({ name: "household" });
  await page.context().addCookies([
    {
      name: "household",
      value: `empty-lost-${Date.now()}`,
      url: "http://localhost:3000",
    },
  ]);
}

test.describe("a control whose action cannot answer", () => {
  test("says so in Hebrew, and the screen survives it", async ({ page }) => {
    await useHousehold(page, "fault", "rest-day");
    await openSettingsForTestWorker(page);

    // Nothing is in flight before the press, so a `data-busy` found afterwards
    // belongs to this press and is not the page still settling.
    await expect(page.locator("[data-busy]")).toHaveCount(0);

    await loseTheWorker(page);

    // Sunday: the seeded worker rests on Saturday, so this is a real change and
    // not a press the screen could answer without the server.
    await chips(page).getByRole("button", { name: words.day(0) }).click();

    // 1. The screen says what happened, where the press was.
    const fault = page.locator('[data-role="fault"]');
    await expect(fault).toBeVisible();
    await expect(fault).toHaveText(FAULT);

    // 2. Not one Latin character in it, which is the whole point of the stage.
    //    Next's own untranslated screen is what this would catch, and it is
    //    exactly what it caught before the action returned the fault.
    expect(await fault.innerText()).not.toMatch(/[A-Za-z]/);

    // 3. The screen is still the screen: the chips are there to press again, so
    //    this is a fault at a control and not a page that fell over.
    await expect(chips(page)).toBeVisible();

    // 4. Nothing is left waiting.
    await expect(page.locator("[data-busy]")).toHaveCount(0);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    // 5. It is a fault and not a refusal, so nothing was saved: Saturday is
    //    still the chosen day. A test that read only the sentence would pass on
    //    a screen that said "something went wrong" and saved anyway.
    await expect(
      chips(page).getByRole("button", { name: words.day(6) }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  /**
   * The same press against the household that does hold them. Without this the
   * test above passes on a screen that draws the fault sentence unconditionally
   * — the cheapest way to satisfy it and the least useful.
   */
  test("says nothing when the action does answer", async ({ page }) => {
    await useHousehold(page, "fault", "rest-day-ok");
    await openSettingsForTestWorker(page);

    await chips(page).getByRole("button", { name: words.day(0) }).click();

    await expect(
      chips(page).getByRole("button", { name: words.day(0) }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-role="fault"]')).toHaveCount(0);
  });
});
