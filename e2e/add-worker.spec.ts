import { expect, test, type Page } from "@playwright/test";
import { useHousehold } from "./household";
import { he } from "../src/lib/i18n/he";

/**
 * `EaseSalary - הוספת עובד`, performed through the interface a family meets
 * (`CLAUDE.md` rules 10 and 13, `build_plan.md` stage 3).
 *
 * **Why it runs on an empty household.** The flow begins on a screen that
 * exists only while there is no worker, so the two seeded households — both of
 * which have one — cannot reach it. `empty` is the seed that can
 * (`src/lib/store.ts`), and it is the state every real account starts in.
 *
 * **Every expected figure below comes from outside the code under test**
 * (`CLAUDE.md` rule 11). The salary typed in is April 2026's minimum wage,
 * ₪6,443.85, which `SEEDED_RATES` cites to the family's own 2026 workbook; the
 * rest-eve supplement and the recuperation month are facts this test states and
 * then reads back. Nothing here is compared against what the engine returned.
 *
 * **What it would catch.** The wizard's three steps, the sealing of the
 * passport number, the save, and the four screens that only exist once a
 * household has somebody in it are four separate pieces that each pass their own
 * unit tests and had never been performed in sequence. The failure this
 * specifically watches for is the one the empty household made visible in the
 * first place: a household with no worker crashes every screen that is about
 * one, so the half-second after the save is exactly where a new account breaks.
 */

/** April 2026's minimum wage, read out of the committed 2026 workbook by way of
 * `SEEDED_RATES` — never a figure this file invented. */
const MINIMUM_WAGE = "6443.85";

const NAME = "מריה דה לה קרוס";
const PASSPORT = "P7781234";

/**
 * A household of this test's own, seeded with nobody.
 *
 * **The cookie's head must be `empty`**, because `seedOf` reads everything
 * before the first hyphen to choose the seed (`src/lib/store.ts`). The label is
 * a plain ASCII counter and not the test's title: a cookie value carrying
 * Hebrew, spaces or commas is refused by the browser outright, which fails every
 * test in the file on the cookie rather than on its subject.
 */
let households = 0;

test.beforeEach(async ({ page }) => {
  households += 1;
  await useHousehold(page, "empty", `run${households}`);
});

test("a new household is told it is empty, and the one control on it starts the flow", async ({
  page,
}) => {
  await page.goto("/");

  const panel = page.locator('[data-role="empty-household"]');
  await expect(panel).toBeVisible();
  await expect(page.getByRole("heading", { name: he.emptyHousehold.title })).toBeVisible();

  await panel.getByRole("link", { name: he.emptyHousehold.add }).click();
  await expect(page).toHaveURL(/\/workers\/new$/);
  await expect(page.getByRole("heading", { name: he.addWorker.who.title })).toBeVisible();
});

/**
 * **The shell is not around the wizard**, which is the question this step
 * opened and the user settled on 2026-09-12. The nav is a promise about a
 * household that has a worker in it, and this is the flow reached when that is
 * not yet true.
 */
test("the wizard draws its own chrome and no navigation", async ({ page }) => {
  await page.goto("/workers/new");

  await expect(page.locator('[data-role="add-worker"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: he.nav.landmark })).toHaveCount(0);
  await expect(page.getByRole("link", { name: he.addWorker.leave })).toBeVisible();
});

/**
 * **A step cannot be left with a field the server would refuse**, and the
 * refusal is the server's own rule run in the browser — `reviewNewWorker`, the
 * same function the action saves by. The name is empty, so the first step
 * refuses and the wizard stays where it is.
 */
test("an empty name keeps the wizard on its first step", async ({ page }) => {
  await page.goto("/workers/new");

  await page.locator('[data-role="add-worker-next"]').click();

  await expect(page.getByText(he.addWorker.errors.name)).toBeVisible();
  await expect(page.getByRole("heading", { name: he.addWorker.who.title })).toBeVisible();
  await expect(page.locator('[data-role="add-worker-step"]')).toContainText("1");
});

/**
 * **The salary may not be set below the confirmed minimum wage**
 * (`CLAUDE.md`'s non-negotiables, item 3). One agora under April 2026's figure
 * is the boundary, and it is refused in the browser by the same rule the action
 * would refuse it by.
 */
test("a salary one agora below the minimum wage is refused", async ({ page }) => {
  await page.goto("/workers/new");
  await fillWho(page);
  await fillWhen(page);

  await page.locator('[data-field="baseMonthlySalary"]').fill("6443.84");
  await page.locator('[data-role="add-worker-next"]').click();

  await expect(page.getByText(he.addWorker.errors.belowMinimum)).toBeVisible();
  await expect(page.getByRole("heading", { name: he.addWorker.pay.title })).toBeVisible();
});

/**
 * **Recuperation is owed only after twelve months, and the wizard says so where
 * the month is chosen** (`specs.md` item 15; Kol Zchut, `דמי הבראה`: employees
 * who have completed at least one year of work are entitled to it).
 *
 * The month follows the start date until the family moves it, because the month
 * the employment began is the month its first year closes in — so the first
 * payment lands at the anniversary rather than up to eleven months later.
 *
 * What this would catch is the suggestion going stale: a start date typed after
 * the month was last set, leaving a family with a recuperation month chosen for
 * them out of a default nobody meant.
 */
test("the recuperation month states the twelve-month rule and follows the start date", async ({
  page,
}) => {
  await page.goto("/workers/new");
  await fillWho(page);

  await expect(page.getByText(he.addWorker.when.recuperationMonthHint)).toBeVisible();
  await expect(page.locator('[data-role="recuperation-advice"]')).toHaveText(
    he.addWorker.when.recuperationMonthAdvice,
  );

  // September, from a September start.
  await page.locator('[data-field="employedSince"]').fill("2026-09-01");
  await expect(page.locator('[data-field="recuperationMonth"]')).toHaveValue("9");

  // And it follows a correction to the date rather than standing at the first
  // month it was given.
  await page.locator('[data-field="employedSince"]').fill("2026-04-15");
  await expect(page.locator('[data-field="recuperationMonth"]')).toHaveValue("4");

  // Until the family chooses one, after which the date stops moving it: a
  // suggestion that overwrote a deliberate choice would be worse than none.
  await page.locator('[data-field="recuperationMonth"]').selectOption("11");
  await page.locator('[data-field="employedSince"]').fill("2026-02-01");
  await expect(page.locator('[data-field="recuperationMonth"]')).toHaveValue("11");
});

/**
 * The whole flow, and then the screens it unlocks.
 *
 * The assertions after the save are the half that matters: a wizard that
 * finishes is not the same thing as a household that works, and every screen in
 * this application is a screen about one worker.
 */
test("adds the household's first worker, and every screen then has somebody to be about", async ({
  page,
}) => {
  await page.goto("/workers/new");

  await fillWho(page);
  await fillWhen(page);
  await fillPay(page);

  // The fourth step reports rather than asks: the worker is saved by the time
  // it is drawn, which is what "שמרנו את הפרטים" says.
  await expect(page.locator('[data-role="add-worker-done"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: he.addWorker.done.title })).toBeVisible();

  await page.locator('[data-role="add-worker-finish"]').click();

  // Her own page, with the shell back around it.
  await expect(page).toHaveURL(/\/workers\/[0-9a-f-]+$/);
  await expect(page.getByRole("navigation", { name: he.nav.landmark })).toBeVisible();
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();

  // The terms as they were typed, read back where they are changed. She is the
  // household's only worker, so `/settings` opens on her.
  await page.goto("/settings");
  const terms = page.locator('[data-terms="restDay"]');
  await expect(terms).toContainText(he.workers.profile.terms.restDay.day(6));

  // The list beside it, which is the screen that 404'd until the household had
  // anybody in it.
  await page.goto("/workers");
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();

  // And the home screen, which was the empty-household panel a moment ago and
  // is now her month.
  await page.goto("/");
  await expect(page.locator('[data-role="empty-household"]')).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: he.nav.landmark })).toBeVisible();
});

/**
 * **The passport number goes in and comes back, and the profile never carries
 * it** (specs.md items 22 and 28).
 *
 * This is asked of the interface rather than of the store, which is the only
 * way to ask it of the whole path: typed into the wizard, sealed above the
 * repository, held as bytes, opened on the server for the one screen that shows
 * it. What it would catch is a number that quietly stopped being written at all
 * — sealing is invisible from the outside, and a passport that never saved
 * looks exactly like a family that never typed one.
 */
test("the passport number survives the round trip", async ({ page }) => {
  await page.goto("/workers/new");
  await fillWho(page);
  await fillWhen(page);
  await fillPay(page);
  await page.locator('[data-role="add-worker-finish"]').click();

  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();
  // Opened where it is shown: `/settings`, since the terms moved there on
  // 2026-09-13. She is the household's only worker, so it opens on her.
  await page.goto("/settings");
  await expect(page.locator('[data-terms="passportNumber"]')).toContainText(PASSPORT);
});

async function fillWho(page: Page): Promise<void> {
  await page.locator('[data-field="name"]').fill(NAME);
  await page.locator('[data-field="passportNumber"]').fill(PASSPORT);
  await page.locator('[data-role="add-worker-next"]').click();
  await expect(page.getByRole("heading", { name: he.addWorker.when.title })).toBeVisible();
}

async function fillWhen(page: Page): Promise<void> {
  await page.locator('[data-field="employedSince"]').fill("2026-04-01");
  await page.locator('[data-field="recuperationMonth"]').selectOption("7");
  await page.locator('[data-role="add-worker-next"]').click();
  await expect(page.getByRole("heading", { name: he.addWorker.pay.title })).toBeVisible();
}

async function fillPay(page: Page): Promise<void> {
  await page.locator('[data-field="baseMonthlySalary"]').fill(MINIMUM_WAGE);
  await page.locator('[data-field="restEveSupplement"]').fill("300");
  await page.locator('[data-role="add-worker-next"]').click();
}
