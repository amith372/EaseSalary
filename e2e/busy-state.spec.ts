import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  openPaymentSections,
  openSettingsForTestWorker,
  openSettingsGroups,
  switchToTestWorker,
  useHousehold,
} from "./household";
import { he } from "../src/lib/i18n/he";

/**
 * **The busy state sits on the control that was pressed, and on nothing else**
 * (`DESIGN.md`, run 7's R7.14).
 *
 * Until 2026-09-25 a save dimmed a whole region: `/payments` put `opacity-60`
 * and `pointer-events-none` on the card holding all six sections, and
 * `/settings` on the card holding all four groups, so writing one note greyed
 * every other row and, on a slow answer, read as the page failing rather than
 * as one field being saved.
 *
 * **These tests need the answer to be slow**, because the defect is only
 * visible while the round trip is in flight — a fast local write is over before
 * a screen can be read. The server action is therefore held at the network for
 * a moment, and the screen is measured inside that window.
 *
 * **What they measure is the browser's `opacity`, not a class name.** A class
 * asserted by name would pass against any rewrite that dimmed the region some
 * other way, which is the thing being caught. `opacity` is not inherited as a
 * computed value either — a child of a dimmed region still computes 1 while
 * rendering grey — so it is the *region* that has to be measured, and that is
 * what the assertion below addresses.
 */

/** Long enough to read the screen inside it, short enough not to cost the
 * suite: the specs assert while it is in flight and then let it through. */
const HELD_MS = 2500;

/**
 * Holds every server action at the network for `HELD_MS`.
 *
 * A server action is a POST carrying `Next-Action`; navigations and data
 * fetches are left alone, so only the write under test is slowed.
 */
async function holdActions(page: Page): Promise<() => Promise<void>> {
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      await new Promise((resolve) => setTimeout(resolve, HELD_MS));
    }
    await route.continue();
  });
  return () => page.unroute("**/*");
}

async function opacityOf(locator: Locator): Promise<string> {
  return locator.evaluate((node) => getComputedStyle(node).opacity);
}

test("the pressed save says it is working and the card around it does not", async ({
  page,
}) => {
  // The failure this catches: the busy state drawn on the region instead of on
  // the control. With the region dimmed, `data-busy` is nowhere and the wrapper
  // measures 0.6 — both halves were checked against the restored code.
  await useHousehold(page, "busy-state", "payments");
  await page.goto("/payments");
  await switchToTestWorker(page);
  await openPaymentSections(page);

  // Scoped to its own section and not addressed by its word: `לשמור` names a
  // save in six of them (F53), so a bare locator would be ambiguous.
  const words = he.month.actions.hospitalOvertime;
  const section = page.locator('[data-group="hospitalOvertime"]');
  await section.getByLabel(words.amount).fill("120");
  const save = section.getByRole("button", { name: words.save, exact: true });

  const release = await holdActions(page);
  await save.click();

  // The control that was pressed, and only it.
  await expect(page.locator("[data-busy]")).toHaveCount(1);
  await expect(save).toHaveAttribute("data-busy", "");
  expect(await opacityOf(save)).toBe("0.6");

  // The card holding all six sections still says a write is in flight — that is
  // what `aria-busy` is for — and is not repainted for it.
  const region = page.locator('div[aria-busy="true"]');
  await expect(region).toHaveCount(1);
  expect(await opacityOf(region)).toBe("1");

  await release();
  await expect(page.locator("[data-busy]")).toHaveCount(0, { timeout: 15000 });
});

test("the pressed rest-day chip says it is working and its neighbours do not", async ({
  page,
}) => {
  // `/settings` had the same region dim, and its controls are chips rather than
  // a form's save — so this is the same rule measured through the other idiom.
  await useHousehold(page, "busy-state", "settings");
  await openSettingsForTestWorker(page);
  await openSettingsGroups(page);

  const words = he.workers.profile.terms.restDay;
  const days = page.locator('[data-terms="restDay"] button');
  const friday = days.filter({ hasText: words.day(5) });

  const release = await holdActions(page);
  await friday.click();

  await expect(page.locator("[data-busy]")).toHaveCount(1);
  await expect(friday).toHaveAttribute("data-busy", "");
  expect(await opacityOf(friday)).toBe("0.6");

  const region = page.locator('div[aria-busy="true"]');
  await expect(region).toHaveCount(1);
  expect(await opacityOf(region)).toBe("1");

  await release();
  await expect(page.locator("[data-busy]")).toHaveCount(0, { timeout: 15000 });
});
