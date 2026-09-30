import { expect, test, type Page } from "@playwright/test";
import { useHousehold } from "./household";

/**
 * An address the application does not have draws a Hebrew screen with a way on.
 *
 * **The defect this exists to catch.** With no `not-found.tsx` anywhere under
 * `src/app/`, Next draws its own built-in screen: `This page could not be found`
 * — English, and inside the shell's right-to-left container the full stop is
 * reordered to the *front* of the sentence. So the one screen a mistyped
 * bookmark or a deleted worker reaches was the one screen written in a language
 * the family does not read. Deleting `src/app/not-found.tsx` puts that screen
 * back, which is what makes the negative assertion below a real one: the string
 * it forbids is Next's own default and not anything this repo writes (rule 11).
 *
 * **Two addresses, because there is one 404 for the whole application.** A
 * worker id that resolves to nobody — `notFound()` from `/workers/[id]` — and an
 * address that matches no route at all. A file placed under one section only
 * would pass the first and fail the second.
 *
 * **The wording is written out rather than read off `he.notFound`**: a test that
 * imports the string it checks passes whatever that string later silently
 * becomes.
 */
const TITLE = "הכתובת הזו לא נמצאה";
const BODY =
  "אולי הקישור השתנה, ואולי הכתובת הוקלדה אחרת. אין כאן תקלה — פשוט אין מסך בכתובת הזו.";
const WAY_HOME = "לדף הבית";

/** Next's own built-in 404, and the thing that must not be on the screen. */
const NEXTS_OWN = "This page could not be found";

/** A syntactically real uuid that belongs to nobody, which is what a deleted
 * worker's bookmark holds. */
const NOBODY = "00000000-0000-0000-0000-000000000000";

const card = (page: Page) => page.locator('[data-role="not-found"]');

async function itIsTheHebrewScreen(page: Page): Promise<void> {
  await expect(page.locator('[data-role="not-found-title"]')).toHaveText(TITLE);
  await expect(card(page)).toContainText(BODY);

  // Next's own screen, forbidden by its exact wording rather than by "no Latin
  // anywhere": the shell around this card carries the `EaseSalary` wordmark,
  // which is a name and stays Latin on purpose.
  await expect(page.locator("body")).not.toContainText(NEXTS_OWN);

  // The card itself, though, is Hebrew to the last character — the whole point
  // of the stage.
  expect(await card(page).innerText()).not.toMatch(/[A-Za-z]/);
}

test.describe("an address the application does not have", () => {
  test("a worker id that resolves to nobody draws the Hebrew 404", async ({
    page,
  }) => {
    await useHousehold(page, "not-found", "unknown-worker");

    const response = await page.goto(`/workers/${NOBODY}`);

    // The status and not only the screen. A 404 body served as 200 is a real
    // defect — it is what a bookmark, a crawler and the browser's own history
    // read — and it is invisible to every assertion about the DOM.
    expect(response?.status()).toBe(404);

    await itIsTheHebrewScreen(page);

    // **The id is not echoed back.** `workerInSeries` answers null both for
    // nonsense and for another household's real worker, so a screen that
    // repeated the id — or named a worker — would confirm that someone else's
    // id exists (the user, 2026-09-27).
    await expect(page.locator("body")).not.toContainText(NOBODY);
  });

  test("an address that matches no route at all draws the same screen", async ({
    page,
  }) => {
    await useHousehold(page, "not-found", "no-such-route");

    const response = await page.goto("/there-is-no-such-screen");
    expect(response?.status()).toBe(404);

    await itIsTheHebrewScreen(page);
  });

  test("the way home lands on the home screen", async ({ page }) => {
    await useHousehold(page, "not-found", "way-home");
    await page.goto(`/workers/${NOBODY}`);

    const home = page.locator('[data-role="not-found-way-home"]');
    await expect(home).toHaveText(WAY_HOME);
    await home.click();

    await expect(page).toHaveURL(/\/$/);
    // Arrived at a screen with something on it, and not at a second 404: the
    // home screen draws a calendar, and every day on it carries its date.
    await expect(page.locator("[data-date]").first()).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  /**
   * The negative control. Without it every assertion above is satisfied by a
   * `not-found.tsx` that renders on every address, which is the cheapest way to
   * pass them and the least useful.
   */
  test("a screen that does exist is not the 404", async ({ page }) => {
    await useHousehold(page, "not-found", "real-screen");

    const response = await page.goto("/workers");

    expect(response?.status()).toBe(200);
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(TITLE);
  });

  /**
   * Signed out the 404 is never reached, and that is correct rather than a gap:
   * the proxy sends every address but `/sign-in` to the sign-in screen before a
   * route is matched, so there is no address at which a signed-out person could
   * be shown an English sentence. Asserted rather than assumed, because the
   * stage's "done when" asks that no failure speaks Latin *signed out too* —
   * and this is how that clause is satisfied here.
   */
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("an address that does not exist redirects to sign-in", async ({
      page,
    }) => {
      await page.goto(`/workers/${NOBODY}`);

      await expect(page).toHaveURL(/\/sign-in/);
      await expect(page.locator("body")).not.toContainText(NEXTS_OWN);
    });
  });
});
