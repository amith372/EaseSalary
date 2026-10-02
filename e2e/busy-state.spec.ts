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
 * **A region is never dimmed for one field's save**, which is the defect these
 * tests exist to catch. `opacity-60` and `pointer-events-none` on the card
 * holding all six payment sections, or all four settings groups, greys every
 * other row while one note is written and, on a slow answer, reads as the page
 * failing rather than as one field being saved.
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

/**
 * The same rule on the one screen that is reached signed out.
 *
 * **The failure this catches is the button drawn `disabled` while the sign-in
 * is in flight**, which is how it stood until this test: `disabled` is the chip
 * grey and means the control cannot be pressed, and a disabled button carries
 * no `aria-busy`, so someone who cannot see the colour change was told nothing
 * at all for the length of a round trip to the Auth server. Both halves were
 * checked against the old code — `data-busy` was nowhere and the button
 * measured 0.45 and `not-allowed`.
 *
 * It runs signed out, which every other spec in the suite is not: the project's
 * `storageState` would send the listener in `SignInScreen` straight to `/`.
 */
test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the sign-in button says it is working and is not drawn disabled", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    // Held at the network rather than slowed by a real server: the defect is
    // only visible while the request is in flight, and an unknown address
    // answers in under half a second.
    await page.route("**/auth/v1/token**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, HELD_MS));
      await route.continue();
    });

    await page.locator('[data-field="email"]').fill("nobody@example.com");
    await page.locator('[data-field="password"]').fill("not-the-password");

    // **Addressed as the form's submit and not by its word**, which is the one
    // handle the busy state does not move: the button's accessible name is
    // `he.signIn.working` while the request is in flight, so a `getByRole` on
    // `he.signIn.submitSignIn` matches nothing until the wait is over — and
    // then passes against the very state it was written to measure.
    const submit = page.locator('form button[type="submit"]');
    await expect(submit).toHaveText(he.signIn.submitSignIn);
    await submit.click();

    await expect(page.locator("[data-busy]")).toHaveCount(1);
    await expect(submit).toHaveAttribute("data-busy", "");
    expect(await opacityOf(submit)).toBe("0.6");

    // **Read once and never with a retrying assertion**, for the reason the
    // month chips above are: the hold lets go, and a retrying `expect` would
    // find the button enabled afterwards and pass over the defect.
    expect(await submit.isDisabled()).toBe(false);
    expect(
      await submit.evaluate((node) => getComputedStyle(node).cursor),
    ).toBe("wait");

    // And the wait ends in the sentence it is supposed to end in.
    await expect(page.locator('[data-role="sign-in-error"]')).toHaveText(
      he.signIn.errors.badCredentials,
      { timeout: 15000 },
    );
    await expect(page.locator("[data-busy]")).toHaveCount(0);
  });
});
