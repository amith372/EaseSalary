import { expect, test, type Page } from "@playwright/test";
import { openSettingsGroups, useHousehold } from "./household";
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

/** The Philippines, one of the six lists the repository ships in
 * `data/holidays/` — which is what the wizard's options are read from
 * (`workers/new/page.tsx`), so the code is the data's and not this file's. */
const COUNTRY = "PH";
const COUNTRY_NAME = "הפיליפינים";

/**
 * A household of this test's own, seeded with nobody.
 *
 * **The cookie must begin with `empty`**, because `seedOf` chooses the seed by
 * the longest seed name the value begins with (`src/lib/store.ts`). The label is
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
 * **`מדינת מקור` opens on nothing, and the step is not left until she chooses.**
 *
 * The country is what the worker's holiday list is drawn from (`specs.md`
 * item 12), so a select that opens on the first of six saves a country nobody
 * chose — and the family would never see the field at all, since a wizard step
 * whose fields all look answered is one they press past. The artboard marks it
 * optional and it cannot be.
 *
 * **What this would catch**: the select given a country as its initial value
 * again. The name is filled first, so the refusal the step reports is the
 * country's own and not the name's — `reviewNewWorker` reports one reason at a
 * time, in its own order.
 */
test("the country is chosen and not defaulted", async ({ page }) => {
  await page.goto("/workers/new");

  const country = page.locator('[data-field="country"]');
  await expect(country).toHaveValue("");
  await expect(country.locator("option").first()).toHaveText(
    he.addWorker.who.countryPlaceholder,
  );

  await page.locator('[data-field="name"]').fill(NAME);
  await page.locator('[data-role="add-worker-next"]').click();

  await expect(page.getByText(he.addWorker.errors.country)).toBeVisible();
  await expect(country).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('[data-role="add-worker-step"]')).toContainText("1");

  // Chosen, and the step is left.
  await country.selectOption(COUNTRY);
  await expect(country).toHaveValue(COUNTRY);
  await page.locator('[data-role="add-worker-next"]').click();
  await expect(page.getByRole("heading", { name: he.addWorker.when.title })).toBeVisible();
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
  await openSettingsGroups(page);
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
 * **The wizard's last step speaks to the worker who was actually described.**
 *
 * Scenario: the same empty household, taken through all four steps twice — once
 * choosing `גבר` on the first step and once `אישה` — and the fourth step read
 * in the browser both times. Everything else about the two runs is identical.
 *
 * Expected, and derived from Hebrew grammar rather than from what the screen
 * returned: the man's copy says `לדף שלו`, `החודש הראשון שלו` and
 * `לפי הוותק שלו`, and the woman's says `שלה` in all three. The masculine run
 * is additionally asserted to contain no `שלה` anywhere in the card, because
 * the defect is one word inside a correct paragraph and an assertion on one
 * sentence would pass a half-finished edit.
 *
 * **What it would catch**: the bug reported against this screen — the fourth
 * step written once in the feminine, which calls every man the application
 * serves a woman while rendering, flowing and passing every other test
 * perfectly. It also catches the narrower regression of the button alone being
 * fixed and the three bullets above it left behind, since all four sentences
 * are read.
 *
 * **Why through the browser and not from `he.ts`.** The unit suite already
 * pins the wording (`src/lib/i18n/worker-wording.test.ts`); what only the
 * browser can prove is that the answer given on step one reaches step four at
 * all. A correctly inflected string handed the wrong gender — or a default —
 * produces exactly the screen that was reported, and every string test in the
 * repository would still pass.
 */
/**
 * `שלה` standing alone, which is the feminine possessive of a person. The
 * lookahead is what keeps `שלהם` out of it: Hebrew has no word boundary a
 * `\b` can see, so the guard is "not followed by another Hebrew letter".
 */
const HER_OWN = /שלה(?![֐-׿])/;

test.describe("the fourth step agrees with the worker described", () => {
  for (const [choice, hers] of [
    ["male", "שלו"],
    ["female", "שלה"],
  ] as const) {
    test(`says ${hers} after ${choice} was chosen`, async ({ page }) => {
      await page.goto("/workers/new");

      await page.locator('[data-field="name"]').fill(NAME);
      await page.locator('[data-field="country"]').selectOption(COUNTRY);
      await page
        .locator('[data-choice="gender"]')
        .getByRole("button", { name: he.workers.profile.terms.gender[choice] })
        .click();
      await page.locator('[data-role="add-worker-next"]').click();
      await expect(
        page.getByRole("heading", { name: he.addWorker.when.title }),
      ).toBeVisible();

      await fillWhen(page);
      await fillPay(page);

      const card = page.locator('[data-role="add-worker-done"]');
      await expect(card).toBeVisible();
      await expect(card).toContainText(`החודש הראשון ${hers} כבר מחכה`);
      await expect(card).toContainText(`לפי הוותק ${hers}`);
      await expect(
        page.locator('[data-role="add-worker-finish"]'),
      ).toHaveText(`לדף ${hers}`);

      // The lead above the card names her page too, so the whole step is read
      // and not only the part that was reported.
      await expect(
        page.getByText(`שמרנו את הפרטים. אפשר לשנות כל דבר בדף ${hers}.`),
      ).toBeVisible();

      if (choice === "male") {
        // Not one feminine possessive survives anywhere on the step. The
        // report showed a card that looked entirely correct apart from a single
        // word, which is why this is asserted over the card's whole text rather
        // than sentence by sentence.
        //
        // **It must be `שלה` as a word and not as a substring.** The third
        // bullet says `התאריכים שלהם` of the documents — masculine, plural and
        // correct — and a plain `toContainText` fails on it, which is a test
        // that reports the one sentence in the card that was already right.
        await expect(card).not.toHaveText(HER_OWN, { useInnerText: true });
      }
    });
  }
});

/**
 * **An account that already holds two workers is told so, and is not bounced to
 * a step** (specs.md item 11: an account holds up to two).
 *
 * Scenario: the demo household, which the seed leaves with two workers, is sent
 * to `/workers/new` by address — the wizard has no guard of its own, and the
 * link that reaches it is drawn only while there is room, so this is the state
 * a stale tab or a typed address lands in. The three steps are filled and the
 * save is pressed.
 *
 * Expected: the fourth step is never drawn, and the refusal names the limit.
 *
 * **Why this refusal and not another.** Every other refusal in the wizard sends
 * the user back to the step that can fix it — `STEP_OF` maps each reason to its
 * own step — and this one is excluded from that map by hand, because no step
 * can fix it: the account is full however the form is filled. So it is the one
 * refusal whose *screen* behaviour nothing else in the file exercises.
 *
 * **What it would catch**: the exclusion dropped, which sends the family back
 * to a step to correct a field that was never wrong, in a loop with no exit;
 * the limit enforced only by hiding the link, which leaves a typed address able
 * to save a third worker; and the message not drawn at all, which is a save
 * that silently does nothing.
 */
test("an account already holding two workers is refused a third, and is told why", async ({
  page,
}) => {
  // Overrides the empty household this file's `beforeEach` set: the limit can
  // only be met where there is something to be at the limit of.
  await useHousehold(page, "demo", `full${households}`);
  await page.goto("/workers/new");

  await fillWho(page);
  await fillWhen(page);
  await fillPay(page);

  // The refusal, in the words the family reads, and no fourth step behind it.
  await expect(page.locator('[data-role="add-worker-error"]')).toContainText(
    he.addWorker.errors.householdFull,
  );
  await expect(page.locator('[data-role="add-worker-done"]')).toHaveCount(0);
  await page.screenshot({
    path: "test-results/add-worker-household-full.png",
    fullPage: true,
  });

  // **And it stayed on the step it was pressed from.** The third step is where
  // the save happens; being sent back to the first would be the `STEP_OF`
  // lookup finding this reason, which is the bug the exclusion prevents.
  await expect(
    page.getByRole("heading", { name: he.addWorker.pay.title }),
  ).toBeVisible();

  // The household still holds two, so nothing was half-saved behind the
  // refusal.
  await page.goto("/workers");
  await expect(page.getByRole("heading", { name: NAME })).toHaveCount(0);
  await expect(page.locator('[data-role="add-worker-link"]')).toHaveCount(0);
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
  // The country chosen in step 1 is the country saved: her profile names the
  // Philippines and not whichever list happens to sort first.
  await expect(page.getByText(COUNTRY_NAME)).toBeVisible();
  // Opened where it is shown: `/settings`, since the terms moved there on
  // 2026-09-13. She is the household's only worker, so it opens on her.
  await page.goto("/settings");
  await openSettingsGroups(page);
  await expect(page.locator('[data-terms="passportNumber"]')).toContainText(PASSPORT);
});

async function fillWho(page: Page): Promise<void> {
  await page.locator('[data-field="name"]').fill(NAME);
  await page.locator('[data-field="passportNumber"]').fill(PASSPORT);
  // Chosen, because the step will not be left without it. `PH` is one of the
  // six lists in `data/holidays/`, which is where the wizard's options come
  // from — never a code this file invented.
  await page.locator('[data-field="country"]').selectOption(COUNTRY);
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
