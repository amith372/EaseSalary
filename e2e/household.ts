import { expect, type Page } from "@playwright/test";
import { he } from "../src/lib/i18n/he";
import { TODAY_COOKIE } from "../src/lib/today";

/**
 * The two things every spec in this directory does before it asserts anything.
 *
 * **A household of the run's own.** The dev repository is a module singleton
 * keyed by the `household` cookie, and a value no seed name has opened re-seeds
 * — so a spec that shares a cookie with another meets the marks that one left
 * behind. Each spec passes its own label and each test its own, which is why
 * the same run can hold a dozen independent stores.
 *
 * **The worker the suite works on.** The first worker is Hanna, seeded from the
 * family's own workbooks so the demo can be held against them
 * tab by tab (`seed.ts`), and the *second* is the one to test on — that is the
 * division the user asked for. Every screen opens on the first worker, so a
 * spec that asserts a figure has to step across first. It is a click on the
 * switcher in the top bar and never a store call: the suite uses the interface
 * as a user meets it (`CLAUDE.md` rule 9).
 */

export async function useHousehold(
  page: Page,
  spec: string,
  label: string,
): Promise<void> {
  await page.context().addCookies([
    {
      name: "household",
      value: `${spec}-${Date.now()}-${label}`,
      url: "http://localhost:3000",
    },
  ]);
}

/**
 * **The day the whole suite runs on**, whatever the machine's clock says. The
 * demo seed and the specs are written against September 2026 — the month the
 * demo runs to, with the test worker's visa falling due in October — so on any
 * other day the calendar opens on another month and a spec either fails for no
 * defect or passes having tested nothing. `auth.setup.ts` sets it on the session
 * every spec starts from; the server honours it outside production only
 * (`src/lib/today.ts`).
 */
export const TODAY = "2026-09-18";

/** A different day for one test, for a rule that only speaks in one month. */
export async function useToday(page: Page, today: string): Promise<void> {
  await page.context().addCookies([
    { name: TODAY_COOKIE, value: today, url: "http://localhost:3000" },
  ]);
}

/**
 * Steps to the worker the tests are written against, and waits until the screen
 * is showing them.
 *
 * **Only the demo household.** The known case of `specs.md` Part 4 seeds one
 * worker and nothing to step to, so its tests are already on their subject and
 * calling this there waits thirty seconds for a switcher that is correctly
 * absent.
 *
 * The wait is the point. The switcher moves a React state and the figures below
 * it re-render from the household already in the page, so an assertion made in
 * the same tick reads the *first* worker's month and passes or fails for
 * reasons that have nothing to do with the test.
 *
 * **It steps only when they are not already showing.** The choice survives a
 * reload and a navigation (a cookie the layout reads), so a
 * second call in the same test would otherwise step past them and back to the
 * first worker.
 */
export async function switchToTestWorker(page: Page): Promise<void> {
  await stepUntilShowing(page, TEST_WORKER_NAME);
}

/** The reverse, for a test that has switched and now asks about the first
 * worker. Stepping "next" wraps, so with two workers it reaches them. */
export async function switchToFirstWorker(page: Page): Promise<void> {
  await stepUntilShowing(page, FIRST_WORKER_NAME);
}

async function stepUntilShowing(page: Page, name: string): Promise<void> {
  const group = page.getByRole("group", {
    name: he.header.workerSwitcher.showing,
  });
  await expect(group).toBeVisible();
  const next = page.getByRole("button", { name: he.header.workerSwitcher.next });
  // **Pressed until the switcher agrees, and only while it still shows someone
  // else.** A single press dropped before hydration left the assertion waiting
  // out its timeout on the *first* worker's name, which reads as stale data or
  // a dirty household rather than as a lost click — the flake that cost a rerun
  // on most full runs. The guard inside the retry is what keeps a press React
  // replays after hydration from stepping straight past them, since with two
  // workers "next" wraps.
  await expect(async () => {
    if (!(await group.innerText()).includes(name)) {
      await next.click();
    }
    await expect(group).toContainText(name, { timeout: 1500 });
  }).toPass({ timeout: 15000 });
}

/**
 * `/settings` showing the test worker — the only screen their terms are changed
 * on.
 *
 * **The address names no worker**: the screen shows whoever the switcher holds.
 * A spec on the one-worker known case just opens `/settings`; a spec in the
 * demo household that has switched and wants the first worker calls
 * `switchToFirstWorker`.
 */
export async function openSettingsForTestWorker(page: Page): Promise<void> {
  await page.goto("/settings");
  await switchToTestWorker(page);
  await openSettingsGroups(page);
}

/** As `seed.ts` names the first worker — Hanna, seeded from the workbooks. */
export const FIRST_WORKER_NAME = "האנה מונטנה Hanna Montana";

/** As `seed.ts` names them. */
export const TEST_WORKER_NAME = "[שם העובד/ת השני/ה]";

/**
 * Unfolds every folded section on the screen, which all start folded. Each is
 * retried until its heading says it is open, because a press before hydration
 * is dropped. The open set survives stepping months, not a worker switch or a
 * navigation.
 */
async function openFoldedSections(page: Page, count: number): Promise<void> {
  const toggles = page.locator("[data-group] h2 button[aria-expanded]");
  await expect(toggles).toHaveCount(count);
  for (let index = 0; index < count; index += 1) {
    const toggle = toggles.nth(index);
    // Pressed only while it still reads folded, so a press React replays after
    // hydration cannot be followed by a second one that folds it again.
    await expect(async () => {
      if ((await toggle.getAttribute("aria-expanded")) === "false") {
        await toggle.click();
      }
      await expect(toggle).toHaveAttribute("aria-expanded", "true", {
        timeout: 1500,
      });
    }).toPass({ timeout: 15000 });
  }
}

/** The payments card's six sections. */
export async function openPaymentSections(page: Page): Promise<void> {
  await openFoldedSections(page, 6);
}

/** The four groups of `/settings`; the account section below them does not fold. */
export async function openSettingsGroups(page: Page): Promise<void> {
  await openFoldedSections(page, 4);
}

/**
 * Waits until a change has reached the store and come back.
 *
 * The pressed control says it is working with `aria-busy`, and an assertion made
 * inside that window races a write no user can race: a navigation in the same
 * tick as a submit cancels the request the submit made, and the assertion then
 * fails on a row that is correctly absent rather than on a wrong figure.
 */
export async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Steps the calendar back by a count of months, on whichever screen is showing
 * — both carry the same stepper (specs.md item 5). A count is right only for a
 * fixed `today`, which `TODAY` is; a walk to a named month belongs in the spec
 * that needs one. */
export async function stepBack(page: Page, months: number): Promise<void> {
  for (let step = 0; step < months; step += 1) {
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
  }
}

/** Steps the calendar forward by a count of months. */
export async function stepForward(page: Page, months: number): Promise<void> {
  for (let step = 0; step < months; step += 1) {
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();
  }
}
