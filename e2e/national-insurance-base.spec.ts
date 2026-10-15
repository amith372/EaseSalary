import { expect, test, type Page } from "@playwright/test";
import {
  openSettingsForTestWorker,
  switchToFirstWorker,
  switchToTestWorker,
  useHousehold,
} from "./household";
import { he } from "../src/lib/i18n/he";

/**
 * **Which wage the household reckons the national-insurance contribution on**
 * (`specs.md` item 19).
 *
 * The estimate is 3.6% of the wage the contribution is taken on, which is what
 * every household is valued on unless it says otherwise. A family that files on
 * what they actually handed over turns one tick on, and from then every month's
 * estimate follows the month's own advance movements: a grant raises it, an
 * instalment lowers it.
 *
 * **The months are the demo's own** (`src/lib/dev/seed.ts`): the second worker
 * was handed a ₪3,000 advance in February 2026 and repaid the first ₪1,000 of it
 * in March. Those are the two months the two bases disagree about, and in
 * opposite directions, which is why both are read here — a test that watched one
 * figure rise would pass just as well on a base that added every advance it
 * could find.
 *
 * **The figure's movement is derived on paper and is not read back from the
 * screen.** 3.6% of ₪3,000 is ₪108 and of ₪1,000 is ₪36, and each of the two
 * figures is taken up to the whole shekel once (item 3) — so the step is that
 * figure give or take a shekel of rounding, and the assertion allows exactly
 * that and no more. Direction alone would pass on a base that moved by the wrong
 * amount, which is the mistake worth catching: it would be wrong by shekels on
 * every month and look entirely plausible.
 *
 * **What this would catch that the engine's own suite cannot**: a route that
 * reads the household's setting for one screen and not for another, a tick that
 * saves nothing and redraws from its own state, and a setting stored against the
 * worker instead of the household — which is the last test here, since the
 * demo's two workers must move together.
 */

const ESTIMATE = '[data-row="nationalInsuranceEstimate"]';
const TICK = '[data-setting="national-insurance-base"] input[type="checkbox"]';

/** February 2026, where the demo's second worker was handed ₪3,000. */
const GRANTED_IN = "2026-02";
/** March 2026, where the first ₪1,000 of it was repaid. */
const REPAID_IN = "2026-03";

/** 3.6% of the ₪3,000 handed over, in agorot, before either figure is rounded. */
const STEP_FOR_THE_GRANT = 10800;
/** 3.6% of the ₪1,000 repaid. */
const STEP_FOR_THE_INSTALMENT = 3600;

/**
 * The estimate the opening screen shows for one month of the test worker, in
 * agorot.
 *
 * Read off `data-money` rather than the drawn text: the attribute is the figure
 * and the text is the figure formatted, and a comparison between months should
 * not also be a comparison of thousands separators.
 */
async function estimateOn(page: Page, month: string): Promise<number> {
  await page.goto(`/?month=${month}`);
  await switchToTestWorker(page);
  const value = await page
    .locator(`${ESTIMATE} [data-money]`)
    .first()
    .getAttribute("data-money");
  expect(value).not.toBeNull();
  return Number(value);
}

/** The sentence the `?` beside the estimate opens, for whoever the switcher
 * holds. */
async function whyTheEstimateSays(page: Page): Promise<string> {
  const row = page.locator(ESTIMATE);
  await row.getByRole("button").first().click();
  return row.innerText();
}

/**
 * Turns the tick on or off, and does not come back until the store has it.
 *
 * **The second navigation is the point and is not a wait.** The box is drawn on
 * the server from the household's own setting, so a fresh render of the screen
 * coming back ticked is proof the action landed. Without it this returned as
 * soon as the box looked right in the browser — which is local state set before
 * the action was sent — and the first read of a figure after it raced the save:
 * on the first run of this spec the grant month's estimate came back exactly as
 * it was, which reads as a setting that changes nothing rather than as a read
 * taken too early.
 */
async function setTick(page: Page, on: boolean): Promise<void> {
  await openSettingsForTestWorker(page);
  const tick = page.locator(TICK);
  await expect(tick).toBeVisible();
  // Retried for the reason every press in this suite is: one sent before
  // hydration is dropped, and a dropped tick reads as a setting that saves
  // nothing.
  await expect(async () => {
    if ((await tick.isChecked()) !== on) await tick.click();
    await expect(tick).toBeChecked({ checked: on, timeout: 1500 });
  }).toPass({ timeout: 15000 });

  await openSettingsForTestWorker(page);
  await expect(tick).toBeChecked({ checked: on });
}

test.describe("the national-insurance base", () => {
  test("ships reckoning the contribution on the wage", async ({ page }) => {
    await useHousehold(page, "ni-base", "default");
    await openSettingsForTestWorker(page);
    // The default is the law's base, which is the whole of what makes this
    // change safe for a household that never asks for it.
    await expect(page.locator(TICK)).not.toBeChecked();

    await page.goto(`/?month=${GRANTED_IN}`);
    await switchToTestWorker(page);
    expect(await whyTheEstimateSays(page)).toContain(
      he.sheet.why.nationalInsuranceEstimate("wage"),
    );
  });

  test("follows what was handed over once the household says so", async ({
    page,
  }) => {
    await useHousehold(page, "ni-base", "moves");

    const onTheWage = await estimateOn(page, GRANTED_IN);
    const instalmentOnTheWage = await estimateOn(page, REPAID_IN);

    await setTick(page, true);

    // The month the ₪3,000 was handed over in: the base is that much larger, so
    // the estimate is 3.6% of ₪3,000 more — give or take the shekel each of the
    // two figures is rounded up by.
    const onWhatWasPaid = await estimateOn(page, GRANTED_IN);
    expect(onWhatWasPaid - onTheWage).toBeGreaterThanOrEqual(
      STEP_FOR_THE_GRANT - 100,
    );
    expect(onWhatWasPaid - onTheWage).toBeLessThanOrEqual(
      STEP_FOR_THE_GRANT + 100,
    );

    // And the month the ₪1,000 was repaid in moves the other way, which is what
    // makes this symmetric rather than a base that adds whatever it finds.
    const instalmentOnWhatWasPaid = await estimateOn(page, REPAID_IN);
    expect(instalmentOnTheWage - instalmentOnWhatWasPaid).toBeGreaterThanOrEqual(
      STEP_FOR_THE_INSTALMENT - 100,
    );
    expect(instalmentOnTheWage - instalmentOnWhatWasPaid).toBeLessThanOrEqual(
      STEP_FOR_THE_INSTALMENT + 100,
    );

    // The figure now says which rule produced it, or a family would be reading
    // an amount whose base they cannot see (item 19).
    expect(await whyTheEstimateSays(page)).toContain(
      he.sheet.why.nationalInsuranceEstimate("paid"),
    );
  });

  test("holds across a reload, and gives the wage back when it is turned off", async ({
    page,
  }) => {
    await useHousehold(page, "ni-base", "holds");

    const onTheWage = await estimateOn(page, GRANTED_IN);

    await setTick(page, true);
    const onWhatWasPaid = await estimateOn(page, GRANTED_IN);
    expect(onWhatWasPaid).not.toBe(onTheWage);

    // Reloaded rather than re-navigated: what is being asked is whether the
    // store holds it, not whether the component kept its own state.
    await page.reload();
    expect(await estimateOn(page, GRANTED_IN)).toBe(onWhatWasPaid);
    await openSettingsForTestWorker(page);
    await expect(page.locator(TICK)).toBeChecked();

    // Off again, and the figure is the one it always was — the figures of a
    // household that tries this and changes its mind are not left moved.
    await setTick(page, false);
    expect(await estimateOn(page, GRANTED_IN)).toBe(onTheWage);
  });

  test("moves both workers, because it is the household's", async ({ page }) => {
    await useHousehold(page, "ni-base", "household");

    await page.goto(`/?month=${GRANTED_IN}`);
    await switchToFirstWorker(page);
    expect(await whyTheEstimateSays(page)).toContain(
      he.sheet.why.nationalInsuranceEstimate("wage"),
    );

    await setTick(page, true);

    // The tick was reached through the test worker's own screen, and the first
    // worker's months follow it: a setting stored against a worker would leave
    // this one reading the law's base, and the household would be filing one
    // return on two rules.
    await page.goto(`/?month=${GRANTED_IN}`);
    await switchToFirstWorker(page);
    expect(await whyTheEstimateSays(page)).toContain(
      he.sheet.why.nationalInsuranceEstimate("paid"),
    );
  });
});
