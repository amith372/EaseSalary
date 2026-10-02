import { expect, test, type Page } from "@playwright/test";
import {
  openSettingsForTestWorker,
  switchToTestWorker,
  useHousehold,
} from "./household";
import { he } from "../src/lib/i18n/he";
import { SATURDAY } from "../src/lib/dates";
import { formatDays } from "../src/lib/money";

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

/**
 * The same rule at the gesture the application is actually for: marking a month.
 *
 * **Why this is a second test and not a second assertion.** The rest-day chips
 * are one control writing one field, and the marking gestures are three controls
 * writing a month — three different actions, on the screen the user spends their
 * time on. A fault proven at one says nothing about the other: until
 * 2026-10-02 `markRange` answered `{ skipped }` with no fault arm at all, so a
 * sweep that could not be saved replaced the month, the calendar and the
 * figures with the page-level screen. **Measured against that state on
 * 2026-10-02**, this test fails on the `h1` reading the fault sentence where
 * the calendar should be — so what it catches is not an untranslated sentence
 * (`error.tsx` says it in Hebrew) but the screen being
 * lost to a gesture the user can repeat.
 *
 * **The defect a weaker version of this would miss.** Routing the three gestures
 * through one `useAction` draws the sentence correctly and *drops* a second
 * sweep made while the first is in flight — `home-screen.spec.ts`'s known case
 * caught that, one third of ₪9,305.75 short, and this file could not have. So
 * the two tests are both needed and neither is the other's duplicate.
 */

/** Sweep a range and say what it means. Both ends are ISO dates: a range is
 * ordered by date and never by screen position (`CLAUDE.md`). */
async function sweepVacation(page: Page, from: string, to: string): Promise<void> {
  await page.locator(`[data-date="${from}"]`).click();
  await page.locator(`[data-date="${to}"]`).click();
  await page
    .getByRole("button", { name: he.calendar.marks(SATURDAY).vacation, exact: true })
    .click();
}

/** The "days used this month" hint on the rail's balance row — where a mark's
 * effect is legible as a whole number. */
function vacationBalance(page: Page) {
  return page.locator('[data-row="worker-2-vacation-balance"]');
}

test.describe("a sweep whose action cannot answer", () => {
  test("says so under the calendar, and the month keeps its figures", async ({
    page,
  }) => {
    await useHousehold(page, "fault", "sweep");
    await page.goto("/");
    await switchToTestWorker(page);

    // Nothing marked yet, so the balance below is what an unsaved sweep must
    // leave it at.
    const used = `${he.sheet.reporting.daysUsed}: ${formatDays(0)}`;
    await expect(vacationBalance(page)).toContainText(used);
    await expect(page.locator('[data-role="fault"]')).toHaveCount(0);

    await loseTheWorker(page);

    // 14.9.2026 is a Monday and 16.9.2026 a Wednesday — neither the rest day nor
    // its eve — so all three days would take the mark had the action answered.
    await sweepVacation(page, "2026-09-14", "2026-09-16");

    // 1. The screen says what happened, under the calendar the sweep was made on.
    const fault = page.locator('[data-role="fault"]');
    await expect(fault).toBeVisible();
    await expect(fault).toHaveText(FAULT);

    // 2. Not one Latin character in it (specs.md item 30). Cheap, and it is
    //    the assertion that would notice a framework message reaching this
    //    slot.
    expect(await fault.innerText()).not.toMatch(/[A-Za-z]/);

    // 3. The screen is still the screen. **This is the assertion that failed
    //    against the old behaviour**: the calendar is drawn and the month's
    //    figures beside it are still there, so the sweep can be made again —
    //    a fault at a control, and not a page that fell over.
    await expect(page.locator('[data-date="2026-09-14"]')).toBeVisible();
    await expect(vacationBalance(page)).toBeVisible();

    // 4. Nothing is left waiting.
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    // 5. **Nothing was marked.** A screen that drew the three days optimistically
    //    and then said the save failed would pass 1–4 and tell the family they
    //    have three days of vacation they were never given: the balance is the
    //    figure that would be wrong, so it is the one asserted.
    await expect(vacationBalance(page)).toContainText(used);
    const vacation = he.calendar.marks(SATURDAY).vacation;
    for (const date of ["2026-09-14", "2026-09-15", "2026-09-16"]) {
      await expect(
        page.locator(`[data-date="${date}"]`),
      ).not.toHaveAccessibleName(new RegExp(`, ${vacation}$`));
    }
  });

  /**
   * The same sweep against the household that does hold the worker. Without it
   * the test above passes on a screen that draws the sentence unconditionally —
   * the cheapest way to satisfy it and the least useful — and on one that never
   * saves a sweep at all.
   */
  test("says nothing when the sweep does save", async ({ page }) => {
    await useHousehold(page, "fault", "sweep-ok");
    await page.goto("/");
    await switchToTestWorker(page);

    await sweepVacation(page, "2026-09-14", "2026-09-16");

    // Three whole days off the balance (specs.md item 7), and no sentence.
    await expect(vacationBalance(page)).toContainText(
      `${he.sheet.reporting.daysUsed}: ${formatDays(3)}`,
    );
    await expect(page.locator('[data-role="fault"]')).toHaveCount(0);
  });
});
