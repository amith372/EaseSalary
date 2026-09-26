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

/**
 * The same rule where a card holds several controls at once: a gathered alert
 * draws one chip per month (item 27), and pressing one must leave the rest
 * pressable.
 *
 * **The failure this catches is the one run 8 found as R8.1**: the chips were
 * drawn `disabled` while a press was in flight, so putting January off said
 * that February, March and April could not be touched — the region dim of R7.14
 * in another shape, on the one card that has four controls to grey.
 *
 * It runs on the `filed` seed — named as the *first* argument, which is what
 * picks the household (`store.ts`) — whose January to April are confirmed and
 * never exported, and so are one card with four chips (`alerts.spec.ts`).
 */
test("the pressed month chip says it is working and its neighbours stay pressable", async ({
  page,
}) => {
  await useHousehold(page, "filed", "busy-alerts");
  await page.goto("/alerts");

  const card = page
    .locator('[data-role="alert"][data-list="warning"]')
    .filter({ hasText: "טרם יוצא" })
    .filter({ hasText: he.placeholder.name });
  const monthOf = (month: number) =>
    card.getByRole("button", {
      name: he.alerts.markHandledMonth(`${he.calendar.monthNames[month]} 2026`),
    });
  const january = monthOf(0);
  const february = monthOf(1);
  await expect(january).toBeVisible();

  const release = await holdActions(page);
  await january.click();

  await expect(page.locator("[data-busy]")).toHaveCount(1);
  await expect(january).toHaveAttribute("data-busy", "");
  expect(await opacityOf(january)).toBe("0.6");
  // **The neighbour is read once and never with a retrying assertion.** The
  // hold lets go after `HELD_MS`, and `expect(locator)` retries until it
  // passes — so a neighbour drawn disabled *during* the write would be found
  // enabled a moment later and the defect would pass unseen. This is the one
  // assertion in the file that has to be a plain read.
  expect(await february.isDisabled()).toBe(false);
  expect(await february.getAttribute("data-busy")).toBeNull();
  expect(await opacityOf(february)).toBe("1");

  await release();
  await expect(page.locator("[data-busy]")).toHaveCount(0, { timeout: 15000 });
});
