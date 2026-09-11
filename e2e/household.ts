import { expect, type Page } from "@playwright/test";
import { he } from "../src/lib/i18n/he";

/**
 * The two things every spec in this directory does before it asserts anything.
 *
 * **A household of the run's own.** The dev repository is a module singleton
 * keyed by the `household` cookie, and a value no seed name has opened re-seeds
 * — so a spec that shares a cookie with another meets the marks that one left
 * behind. Each spec passes its own label and each test its own, which is why
 * the same run can hold a dozen independent stores.
 *
 * **The worker the suite works on.** Since 2026-09-11 the first worker is Hanna,
 * seeded from the family's own workbooks so the demo can be held against them
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
 * Steps to the worker the tests are written against, and waits until the screen
 * is showing her.
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
 */
export async function switchToTestWorker(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: he.header.workerSwitcher.next })
    .click();
  await expect(
    page.getByRole("group", { name: he.header.workerSwitcher.showing }),
  ).toContainText(TEST_WORKER_NAME);
}

/** As `seed.ts` names her. */
export const TEST_WORKER_NAME = "[שם העובד/ת השני/ה]";

/** Her id, for the routes that take one in the address. */
export const TEST_WORKER_ID = "worker-2";
