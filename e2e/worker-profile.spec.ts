import { expect, test, type Page } from "@playwright/test";
import { TEST_WORKER_ID, switchToTestWorker } from "./household";
import { FRIDAY, SATURDAY } from "../src/lib/dates";
import { fullDayLabel } from "../src/lib/dateLabels";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";

/**
 * The worker's profile through the browser — the four things step 9 exists to
 * make settable, each checked by what it *moves* on another screen rather than
 * by the click that set it (`CLAUDE.md` rules 9 and 12).
 *
 * **Every expected figure comes from `specs.md` Part 4, from item 14, or from
 * arithmetic worked by hand on a calendar, and none from what the screen
 * printed.** ₪500 across five rest-eves is Part 4's own figure; ₪100 for one
 * rest-eve is that figure divided by the five Fridays item 14 calls weekly, and
 * it is what the known household is seeded with; four Thursdays in August 2025
 * is a fact about the calendar — 1 August 2025 is a Friday, so the Thursdays
 * are the 7th, the 14th, the 21st and the 28th.
 *
 * **Each test gets its own store**, for the reason `month-screen.spec.ts`
 * gives: the dev repository is a module singleton keyed by the `household`
 * cookie, and a fixed name would hand the second run the changes the first one
 * made — so the "before" assertions would be asserting the previous run.
 */

/** Part 4: ₪500 of rest-eve supplement across the five Fridays of August 2025,
 * five rest days and two holidays at ₪426.35, and a ₪10,000 advance. */
const REST_EVE_SUPPLEMENT = 10000; // ₪100 for one, which is ₪500 over five.
const AUGUST_2025_REST_EVES_AS_SATURDAY_RESTER = 5; // Fridays: 1, 8, 15, 22, 29.
const AUGUST_2025_REST_EVES_AS_FRIDAY_RESTER = 4; // Thursdays: 7, 14, 21, 28.

/** The demo household's own opening advance, entered rather than seeded: ₪2,000
 * given with ₪500 of it already repaid, so ₪1,500 is still owed (specs.md item
 * 6 — the family states this once). The subtraction is written out so it can be
 * checked by eye. */
const OPENING_PRINCIPAL = 200000;
const OPENING_REPAID = 50000;
const OPENING_OUTSTANDING = OPENING_PRINCIPAL - OPENING_REPAID;

/** A standing line of ₪250 a month, which is a figure of this test's own: item
 * 20 gives no amount, because a line the user adds is the user's own. */
const STANDING_AGOROT = 25000;

const RUN = Date.now().toString(36);

async function useHousehold(
  page: Page,
  seed: "demo" | "known",
  label: string,
): Promise<void> {
  await page.context().addCookies([
    {
      name: "household",
      value: `${seed}-e2e-${RUN}-${label}`,
      url: "http://localhost:3000",
    },
  ]);
}

function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

/**
 * Wait until the change reaching the store has come back.
 *
 * **This is not a sleep and it is not flake management.** The profile and the
 * payments screen both dim while a server action is in flight and say so with
 * `aria-busy` (`WorkerProfileScreen`, `PaymentsScreen`), and a spec that
 * navigated away in that window would be asking the next page about a write
 * that had not landed — which is a race the *test* invented and not one the
 * user can meet, since a user does not move faster than the screen tells her
 * it is saving. Every gesture below is followed by this before anything is
 * asserted or any page is opened.
 */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

test.describe("the workers' list", () => {
  test("shows the household's workers and the limit on them", async ({
    page,
  }) => {
    // The tab was a 404 until this step; the routes table calls a tab that 404s
    // worse than a tab that is not there.
    await useHousehold(page, "demo", "list");
    await page.goto("/workers");

    // An account holds no more than two workers (item 11), and the demo
    // household is seeded with exactly two.
    await expect(page.locator("#worker-worker-1")).toBeVisible();
    await expect(page.locator("#worker-worker-2")).toBeVisible();
    await expect(page.getByText(he.workers.limit)).toBeVisible();

    // The link the artboard draws, and it goes to a page that exists.
    await page.locator("#worker-worker-1").getByRole("link").click();
    await expect(page).toHaveURL(/\/workers\/worker-1$/);
  });
});

test.describe("the weekly rest day is a term of the employment (specs.md item 5)", () => {
  test("moves the calendar's rest-eves and the month's supplement with it", async ({
    page,
  }) => {
    // The known household, because Part 4 states its rest-eve figure outright:
    // ₪500 across the five Fridays of August 2025.
    await useHousehold(page, "known", "restday");
    await page.goto("/month");

    await expect(row(page, "restEveSupplement")).toContainText(
      formatAgorot(
        AUGUST_2025_REST_EVES_AS_SATURDAY_RESTER * REST_EVE_SUPPLEMENT,
      ),
    );
    // Her rest day is Saturday, so the calendar's own legend says so.
    await expect(
      page.getByText(he.calendar.marks(SATURDAY).freeRestDay, { exact: true }),
    ).toBeVisible();

    await page.goto("/workers/hanna");
    await page.screenshot({
      path: "test-results/profile-before.png",
      fullPage: true,
    });

    // The gesture: the rest day changed to Friday. Step 7c built the
    // generalisation and could not check it, because no screen could move the
    // value off its default.
    await page
      .locator('[data-terms="restDay"]')
      .getByRole("button", {
        name: he.workers.profile.terms.restDay.day(FRIDAY),
        exact: true,
      })
      .click();
    await settled(page);

    // **The calendar redraws.** A Friday-resting worker's free rest day is not
    // called "שבת חופשית", and the legend is where the wording is drawn from
    // her own day rather than from a constant (item 5).
    await page.goto("/month");
    await expect(
      page.getByText(he.calendar.marks(FRIDAY).freeRestDay, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(he.calendar.marks(SATURDAY).freeRestDay, { exact: true }),
    ).toHaveCount(0);

    // **And the money moves with it.** Her rest-eve is now Thursday, and August
    // 2025 has four Thursdays against five Fridays — so the supplement falls
    // from ₪500 to ₪400 while nothing else about the month changed. That is the
    // failure this catches: a rest day the profile stores and the calendar
    // draws, with the figures still counted against Saturday.
    await expect(row(page, "restEveSupplement")).toContainText(
      formatAgorot(AUGUST_2025_REST_EVES_AS_FRIDAY_RESTER * REST_EVE_SUPPLEMENT),
    );
    await page.screenshot({
      path: "test-results/profile-rest-day-friday.png",
      fullPage: true,
    });
  });
});

test.describe("a standing line, and the division it makes reachable (item 20)", () => {
  test("is overridden on a month while a one-off line is corrected", async ({
    page,
  }) => {
    await useHousehold(page, "demo", "standing");

    // Before: the month draws no summarised user-lines row at all, because the
    // demo household's September holds none.
    await page.goto("/month");
    await switchToTestWorker(page);
    await expect(row(page, "userLines-beforeGross")).toHaveCount(0);

    await page.goto(`/workers/${TEST_WORKER_ID}`);
    const standing = page.locator('[data-terms="standing"]');
    await expect(standing.getByText(he.workers.profile.terms.standing.empty)).toBeVisible();

    await standing
      .getByRole("button", { name: he.workers.profile.terms.standing.add })
      .click();
    await standing
      .getByRole("textbox", { name: he.month.actions.lines.label })
      .fill("דמי כיס");
    await standing
      .getByRole("textbox", { name: he.month.actions.lines.amount })
      .fill(String(STANDING_AGOROT / 100));
    await standing
      .getByRole("button", {
        name: he.month.actions.lines.submit,
        exact: true,
      })
      .click();
    await settled(page);

    // **It reaches the month, at the amount it was set at** (item 20: it
    // "appears in every month afterwards, at the same amount"). An addition
    // sits before the month's total by default, which is where the summarised
    // row is drawn.
    await page.goto("/month");
    await switchToTestWorker(page);
    await expect(row(page, "userLines-beforeGross")).toContainText(
      formatAgorot(STANDING_AGOROT),
    );

    // **And it is the one row the override control may replace**, which is what
    // `overridable: prefix === "standing"` says: the amount came from the
    // profile, so a month that paid something else says so with an override.
    await page.goto("/payments");
    await switchToTestWorker(page);
    const overrides = page.getByRole("button", {
      name: he.month.actions.overrides.changeLabel("דמי כיס"),
    });
    await expect(overrides).toBeVisible();

    // A line typed into *this* month is corrected where it was typed, and is
    // offered no override at all. The two together are the division step 8
    // drew and could not check.
    const lines = page.locator('[data-group="userLines"]');
    await lines
      .getByRole("button", { name: he.month.actions.lines.add })
      .click();
    await lines
      .getByRole("textbox", { name: he.month.actions.lines.label })
      .fill("החזר נסיעה");
    await lines
      .getByRole("textbox", { name: he.month.actions.lines.amount })
      .fill("80");
    await lines
      .getByRole("button", { name: he.month.actions.lines.submit, exact: true })
      .click();
    await settled(page);

    await expect(
      page.getByRole("button", {
        name: he.month.actions.lines.editLabel("החזר נסיעה"),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: he.month.actions.overrides.changeLabel("החזר נסיעה"),
      }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "test-results/profile-standing-line.png",
      fullPage: true,
    });
  });

  test("is overridable on the other side of the total too", async ({ page }) => {
    // **A standing *deduction* lands after the month's total by default**
    // (item 20, `defaultPlacementFor`), which puts it in the closing block
    // rather than in a column. Its amount still came from the profile, so an
    // override is still the only way a month says it paid something else — and
    // this is the case that made `ClosingLine.overridable` reachable, which it
    // had not been while no standing line could exist.
    await useHousehold(page, "demo", "standing-after");
    await page.goto(`/workers/${TEST_WORKER_ID}`);

    const standing = page.locator('[data-terms="standing"]');
    await standing
      .getByRole("button", { name: he.workers.profile.terms.standing.add })
      .click();
    await standing
      .getByRole("textbox", { name: he.month.actions.lines.label })
      .fill("השתתפות בטלפון");
    await standing
      .getByRole("textbox", { name: he.month.actions.lines.amount })
      .fill(String(STANDING_AGOROT / 100));
    await standing
      .getByRole("button", {
        name: he.month.actions.lines.direction.deduction,
        exact: true,
      })
      .click();
    await standing
      .getByRole("button", { name: he.month.actions.lines.submit, exact: true })
      .click();
    await settled(page);

    // It reaches the month below the total, and the override control offers it.
    await page.goto("/payments");
    await switchToTestWorker(page);
    await expect(
      page.getByRole("button", {
        name: he.month.actions.overrides.changeLabel("השתתפות בטלפון"),
      }),
    ).toBeVisible();
  });
});

test.describe("the opening position (specs.md item 6)", () => {
  test("an advance entered on the profile is the debt the payments screen repays", async ({
    page,
  }) => {
    await useHousehold(page, "demo", "opening");

    // Before: the first worker's seeded advance is fully repaid across March,
    // April and May, so nothing is owed and no second advance exists.
    await page.goto("/payments");
    await switchToTestWorker(page);
    await expect(page.locator('[data-advance="2"]')).toHaveCount(0);

    await page.goto(`/workers/${TEST_WORKER_ID}`);
    const opening = page.locator('[data-terms="opening"]');
    await opening
      .getByRole("button", {
        name: he.workers.profile.terms.opening.addAdvance,
      })
      .click();
    await opening
      .getByRole("textbox", { name: he.workers.profile.terms.opening.principal })
      .fill(String(OPENING_PRINCIPAL / 100));
    await opening
      .getByRole("textbox", { name: he.workers.profile.terms.opening.repaid })
      .fill(String(OPENING_REPAID / 100));
    await opening
      .getByRole("button", {
        name: he.workers.profile.terms.opening.submit,
        exact: true,
      })
      .click();
    await settled(page);

    // **The debt the payments screen reads is the one that was entered**, and
    // its number is minted past every advance she already carries — the seeded
    // one is 1, so this is 2. ₪2,000 given less ₪500 repaid is ₪1,500 still
    // owed, which is arithmetic and not a figure the engine produced.
    await page.goto("/payments");
    await switchToTestWorker(page);
    const advance = page.locator('[data-advance="2"]');
    await expect(advance).toBeVisible();
    await expect(advance).toContainText(formatAgorot(OPENING_OUTSTANDING));
    await page.screenshot({
      path: "test-results/profile-opening-advance.png",
      fullPage: true,
    });
  });
});

test.describe("the three documents and their expiry dates (specs.md item 28)", () => {
  test("holds three separate dates and asks for no number", async ({ page }) => {
    await useHousehold(page, "known", "documents");
    await page.goto("/workers/hanna");

    const documents = page.locator('[data-terms="documents"]');
    const words = he.workers.profile.terms.documents;

    // Part 4 states no document dates, so Hanna's three arrive empty — which is
    // what a worker whose papers the family has not typed in looks like.
    await expect(documents.getByText(words.none)).toHaveCount(3);

    // Three separate documents with three separate dates: they are not one
    // thing under different names (item 28), so all three are filled with
    // different dates and all three are read back.
    await documents
      .getByRole("textbox", { name: words.employmentPermit })
      .fill("2026-11-30");
    await documents.getByRole("textbox", { name: words.workVisa }).fill("2027-03-31");
    await documents.getByRole("textbox", { name: words.passport }).fill("2029-06-30");
    await documents.getByRole("button", { name: words.save, exact: true }).click();
    await settled(page);

    await page.reload();
    // Read back after a reload, because the failure this catches is a date held
    // in the browser and never saved.
    await expect(
      page.locator('[data-terms="documents"]').getByText(words.none),
    ).toHaveCount(0);
    // The dates read back three at a time, each on its own document, so a
    // panel that wrote one value into all three fields would fail here. The
    // written form beside each field is the same value in the words the rest of
    // the application uses — nobody should have to read an ISO date to know
    // what is stored.
    const saved = page.locator('[data-terms="documents"]');
    await expect(
      saved.getByRole("textbox", { name: words.employmentPermit }),
    ).toHaveValue("2026-11-30");
    await expect(
      saved.getByRole("textbox", { name: words.workVisa }),
    ).toHaveValue("2027-03-31");
    await expect(
      saved.getByRole("textbox", { name: words.passport }),
    ).toHaveValue("2029-06-30");
    await expect(saved).toContainText(fullDayLabel("2026-11-30"));
    await expect(saved).toContainText(fullDayLabel("2029-06-30"));

    // **A date that only looks like one is refused.** 2026 is not a leap year,
    // so 29 February is not a day: a `Date` built from it rolls forward to
    // 1 March, and a permit that silently expires on the wrong day is exactly
    // the mistake Part 5 warns about.
    await page
      .locator('[data-terms="documents"]')
      .getByRole("textbox", { name: words.workVisa })
      .fill("2026-02-29");
    await page
      .locator('[data-terms="documents"]')
      .getByRole("button", { name: words.save, exact: true })
      .click();
    await settled(page);
    await expect(
      page.getByText(he.workers.profile.terms.refused.date),
    ).toBeVisible();
  });
});
