import { expect, test, type Page } from "@playwright/test";
import { THROWN_MESSAGE } from "../src/app/dev/throw/page";
import { he } from "../src/lib/i18n/he";
import { useHousehold } from "./household";

/**
 * A render that threw says so in Hebrew, and says nothing else.
 *
 * **The defect this exists to catch.** With no `error.tsx` and no
 * `global-error.tsx` anywhere under `src/app/`, an uncaught throw drew Next's
 * own screen: `Application error: a client-side exception has occurred` in
 * production and, in development, the error overlay with the message and the
 * stack in it. English either way, and the second of those prints whatever the
 * throw was carrying onto the family's screen.
 *
 * **This file is about a render that threw, and only that.** An action that
 * cannot answer says so at the control it was pressed from and leaves the screen
 * standing, which is `fault.spec.ts`'s subject and not a boundary at all.
 *
 * **Two boundaries, two causes, and they are not interchangeable.** `error.tsx`
 * catches a *page* and leaves the shell standing; `global-error.tsx` catches
 * the *root layout* and replaces the whole document, `<html>` included. A
 * repository that answered a page's throw with the global screen — or worse,
 * the other way round — would look right in a screenshot, so each test asserts
 * which of the two it got by whether the nav is still there.
 *
 * **The wording is written out rather than read off `he.fault`**: a test that
 * imports the string it checks passes whatever that string later silently
 * becomes. It is compared to `he.fault` as well, and that comparison is the
 * whole point of the test named "says exactly what he.fault says".
 */
const FAULT = "משהו השתבש, כדאי לנסות שוב או לחזור לדף הבית";
const WAY_HOME = "לדף הבית";

const message = (page: Page) =>
  page.locator('[data-role="fault-screen-message"]');

/** The bar the root layout draws. Present means the layout rendered and only a
 * page failed; absent means the layout is what failed. */
const nav = (page: Page) =>
  page.getByRole("navigation", { name: he.nav.landmark });

test.describe("a page whose render threw", () => {
  test("draws the Hebrew fault screen inside the shell, and prints nothing of the error", async ({
    page,
  }) => {
    await useHousehold(page, "error-boundary", "page-threw");

    const response = await page.goto("/dev/throw");

    // A screen that failed answers 500 and not 200. Invisible to every
    // assertion about the DOM, and it is what a monitor reads.
    expect(response?.status()).toBe(500);

    await expect(message(page)).toHaveText(FAULT);

    // **Nothing of the throw reaches the screen.** The page throws a message
    // shaped like a real one — a worker id and a string that must not travel —
    // because a real Error here can carry a worker id, a Postgres message or
    // ciphertext. Both halves are forbidden separately: a screen printing only
    // the id would satisfy a test that looked for the whole sentence.
    const body = page.locator("body");
    await expect(body).not.toContainText(THROWN_MESSAGE);
    await expect(body).not.toContainText("leaked-message-must-not-be-shown");
    await expect(body).not.toContainText("11111111-2222-3333-4444-555555555555");

    // Hebrew to the last character inside the card. The shell around it keeps
    // the EaseSalary wordmark, which is a name and stays Latin.
    const card = page.locator('[data-role="fault-screen"]');
    expect(await card.innerText()).not.toMatch(/[A-Za-z]/);

    // It is the *page* boundary: the bar is still drawn, so the reader has
    // every other screen to go to. This is what separates it from the global
    // one, and without it both tests would pass on either file.
    await expect(nav(page)).toBeVisible();
  });

  test("the way home lands on a screen that works", async ({ page }) => {
    await useHousehold(page, "error-boundary", "page-way-home");
    await page.goto("/dev/throw");

    const home = page.locator('[data-role="fault-screen-way-home"]');
    await expect(home).toHaveText(WAY_HOME);
    await home.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("[data-date]").first()).toBeVisible();
    await expect(message(page)).toHaveCount(0);
  });
});

/**
 * The root layout's own failure, reached without rigging anything.
 *
 * `layout.tsx` reads the household on every request, and that read calls
 * `readToday()`; `todayFor` refuses a `today` cookie that is not a date rather
 * than falling back to the clock (`src/lib/today.ts`, and deliberately so). So
 * a cookie is enough to take the layout down — and the message it throws with
 * carries **the cookie's own value**, which makes "no error message on the
 * screen" something this test can actually check rather than assert about a
 * string nobody supplied.
 */
test.describe("the root layout itself threw", () => {
  const BAD_DAY = "not-a-date-leaked-cookie-value";

  async function breakTheLayout(page: Page): Promise<void> {
    await page.context().addCookies([
      { name: "today", value: BAD_DAY, url: "http://localhost:3000" },
    ]);
  }

  test("draws its own Hebrew document, right-to-left, with no shell", async ({
    page,
  }) => {
    await useHousehold(page, "error-boundary", "layout-threw");
    await breakTheLayout(page);

    const response = await page.goto("/");
    expect(response?.status()).toBe(500);

    await expect(message(page)).toHaveText(FAULT);

    // **The trap this test exists for.** `global-error.tsx` replaces the root
    // layout, so it inherits neither `lang` nor `dir`: a file that left them
    // out renders the one screen shown when everything else has failed from
    // left to right, and the failure survives a screenshot because the words
    // are still legible — they are simply against the wrong edge.
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // It is the *global* boundary and not the page one: the root layout is
    // gone, so its bar is gone with it.
    await expect(nav(page)).toHaveCount(0);

    // The cookie's value is in the thrown message, and must be nowhere here.
    await expect(page.locator("body")).not.toContainText(BAD_DAY);

    // Nothing Latin at all on this one — there is no shell to carry the
    // wordmark, so the whole document is under test.
    expect(await page.locator("body").innerText()).not.toMatch(/[A-Za-z]/);
  });

  /**
   * **The duplication is deliberate and has to be kept in step.**
   * `global-error.tsx` spells its Hebrew out instead of importing `he.ts`,
   * because a fallback for a layout that could not render must not depend on
   * the modules that layout depends on. Nothing but this makes the two agree,
   * and a wording changed in one place would otherwise leave the application
   * saying two different things about one failure — the second of them only
   * where nobody is looking.
   */
  test("says exactly what `he.fault` says, though it cannot import it", async ({
    page,
  }) => {
    await useHousehold(page, "error-boundary", "one-wording");
    await breakTheLayout(page);
    await page.goto("/");

    await expect(message(page)).toHaveText(he.fault);
    await expect(
      page.locator('[data-role="fault-screen-way-home"]'),
    ).toHaveText(he.wayHome);
  });

  test("the way home is a fresh load of the opening screen", async ({
    page,
  }) => {
    await useHousehold(page, "error-boundary", "layout-way-home");
    await breakTheLayout(page);
    await page.goto("/");

    const home = page.locator('[data-role="fault-screen-way-home"]');
    // A plain anchor: the router went with the tree this screen replaced, so
    // the way out has to be a document load.
    await expect(home).toHaveAttribute("href", "/");

    // With the cause gone, that load is the working screen — so the link leads
    // somewhere, rather than round to the same failure.
    await page.context().clearCookies({ name: "today" });
    // **Clicked on the element rather than at a point, because of `next dev`
    // and not because of the screen.** With the root layout replaced there is
    // nothing between this link and Next's own development overlay, whose
    // `<nextjs-portal>` covers the viewport and takes the press — a pointer
    // click lands on the overlay and a forced one lands there too, since the
    // point is still covered. The overlay is not built into production, so the
    // obstruction belongs to the test environment and not to anything the
    // family meets. It is still this link that is pressed, and what it does is
    // still read off where the page ends up.
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/"),
      home.evaluate((link: HTMLAnchorElement) => link.click()),
    ]);

    await expect(page.locator("[data-date]").first()).toBeVisible();
    await expect(message(page)).toHaveCount(0);
  });
});
