import { expect, test, type Page } from "@playwright/test";
import {
  openPaymentSections,
  openSettingsForTestWorker,
  switchToTestWorker,
  useHousehold,
} from "./household";
import { he } from "../src/lib/i18n/he";

/**
 * Every screen that names the worker agrees with the worker they are showing
 * (`specs.md` item 31).
 *
 * **What this catches, and what nothing else could.** The failure is a screen
 * that holds a gender of its own instead of the one it is drawing: a literal
 * `"female"` handed to a sentence, or the first worker's gender read where the
 * shown worker's was meant. Either produces a screen that renders, flows,
 * exports, and calls half the workers the application serves by the wrong
 * gender in the middle of an otherwise correct paragraph — and the family
 * cannot correct it. `src/lib/i18n/worker-wording.test.ts` already pins the
 * *wording* of every sentence read below in both genders; what a string test
 * cannot see is which of the two the screen asks for. That is only visible
 * from outside.
 *
 * **The gesture.** The demo worker the suite works on is seeded female
 * (`src/lib/dev/seed.ts`), so each test reads the sentence as seeded, flips the
 * one chip on `הגדרות` that records the gender, and reads the same sentence
 * again. **Both halves are asserted, because either alone passes a literal**: a
 * screen fixed to the feminine passes the first read and a screen fixed to the
 * masculine passes the second, and only the pair says the gender travelled.
 *
 * **The expected words come from Hebrew grammar and are written out by hand
 * here** (`CLAUDE.md` rule 11), never called off `he.ts`: a test that asks the
 * screen to agree with the same function that drew it agrees with itself and
 * passes on the day that function is wrong.
 *
 * **Why each assertion names the word that follows.** `העובד` is a prefix of
 * `העובדת` and `עבד` of `עבדה`, so a masculine `toContainText` matches the
 * feminine sentence and reports a pass on the exact defect being hunted. Each
 * masculine read therefore also asserts the paragraph holds no feminine form,
 * which is the assertion that cannot be satisfied by accident.
 */

const RUN = Date.now().toString(36);

/** The screen's own signal that a server action has come back, and not a
 * sleep: a control dims and says `aria-busy` while one is in flight. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Flips the one chip that records the gender, on the only screen that changes
 * a worker's terms since 2026-09-13 (`household.ts`). */
async function chooseGender(page: Page, choice: "male" | "female"): Promise<void> {
  await openSettingsForTestWorker(page);
  await settled(page);
  await page
    .locator('[data-terms="gender"]')
    .getByRole("button", { name: he.workers.profile.terms.gender[choice] })
    .click();
  await settled(page);
}

/**
 * **The profile's two term hints, and the two sentences of `תשלומים`.**
 *
 * Scenario: the demo household, on the second worker — the one with the
 * ordinary terms, which is the worker every browser test acts on
 * (`build_plan.md`'s fixture policy). Their income tax is set to `לא מנוכה מס`
 * first, because the sentence explaining that rule is only drawn under that
 * choice and would otherwise be a sentence no test reads. Four sentences are
 * then read as seeded, the gender chip is flipped to `גבר`, and the same four
 * are read again.
 *
 * Expected — from Hebrew grammar, not from the screen:
 *
 * | Sentence | as a woman | as a man |
 * |---|---|---|
 * | when the employment began | `של העובדת באפליקציה` | `של העובד באפליקציה` |
 * | the rest-eve supplement | `אם עבדה בו` | `אם עבד בו` |
 * | a line that recurs every month | `בדף העובדת` | `בדף העובד` |
 * | how the tax is arrived at | `בפרופיל של העובדת` | `בפרופיל של העובד` |
 *
 * What it would catch: `הגדרות` or `תשלומים` drawing the sentence from a fixed
 * gender rather than from the worker on the screen. It also catches the
 * narrower regression of one of the two screens being corrected and the other
 * left behind, since the four sentences are read across both.
 */
test("the profile and תשלומים name the worker in their own gender", async ({
  page,
}) => {
  await useHousehold(page, `gender-${RUN}`, "screens");

  // `לא מנוכה מס`, so the rule sentence on `תשלומים` exists to be read. The
  // choice itself is not what is under test — the sentence it draws is.
  await openSettingsForTestWorker(page);
  await settled(page);
  await page
    .locator('[data-terms="incomeTax"]')
    .getByRole("button", { name: he.workers.profile.terms.incomeTax.none })
    .click();
  await settled(page);

  // The hint paragraphs themselves, located by how each opens rather than by
  // position, so a reworded tail does not silently stop the test reading
  // anything.
  const employedSince = page.getByText(/^משפיע על ותק/);
  const restEve = page.getByText(/^הסכום שמשולם על כל ערב יום מנוחה/);

  await expect(employedSince).toContainText("של העובדת באפליקציה");
  await expect(restEve).toContainText("אם עבדה בו");

  await page.goto("/payments");
  await switchToTestWorker(page);
  await openPaymentSections(page);
  await settled(page);

  const standing = page.getByText(/^שורה שחוזרת בכל חודש/);
  const taxRule = page.getByText(/^לפי ההגדרה בפרופיל של/);

  await expect(standing).toContainText("בדף העובדת");
  await expect(taxRule).toContainText("בפרופיל של העובדת");

  await chooseGender(page, "male");

  await expect(employedSince).toContainText("של העובד באפליקציה");
  await expect(employedSince).not.toContainText("העובדת");
  await expect(restEve).toContainText("אם עבד בו");
  await expect(restEve).not.toContainText("עבדה");

  await page.goto("/payments");
  await switchToTestWorker(page);
  await openPaymentSections(page);
  await settled(page);

  await expect(standing).toContainText("בדף העובד");
  await expect(standing).not.toContainText("העובדת");
  await expect(taxRule).toContainText("בפרופיל של העובד");
  await expect(taxRule).not.toContainText("העובדת");

  await page.screenshot({
    path: "test-results/gender-payments-male.png",
    fullPage: true,
  });
});

/**
 * **The one question the calendar asks about a person** (item 9: whether they
 * worked the holiday is the single fact a month records about it).
 *
 * Scenario: the same household and the same worker, on April 2026 — five steps
 * back from the September the suite runs on (`household.ts`'s `TODAY`). The
 * seed marks 3.4.2026 as a holiday they worked, so the day is on the calendar
 * and pressing it opens the question with both answers beside it. The question
 * and its two answers are read as seeded, the gender is flipped, and the three
 * are read again.
 *
 * Expected — Hebrew grammar again: `עבדה בחג?` / `כן, עבדה` / `לא עבדה` for a
 * woman, and `עבד בחג?` / `כן, עבד` / `לא עבד` for a man.
 *
 * What it would catch: the month screen passing a fixed gender into the
 * calendar. This is the sentence where getting it wrong is most visible to the
 * family and least visible to a test, because it is three words on a popup
 * every month of the year goes through.
 */
test("the calendar asks about the holiday in the worker's gender", async ({
  page,
}) => {
  await useHousehold(page, `gender-${RUN}`, "calendar");

  /** Back to April 2026 from the September the suite runs on. */
  const backToApril = async () => {
    for (let step = 0; step < 5; step += 1) {
      await page
        .getByRole("button", { name: he.calendar.previousMonth })
        .click();
    }
  };

  /** The seed's own worked holiday for this worker — Good Friday on the Indian
   * list they are filed under (`holiday-picker.spec.ts` reads the same date off
   * `data/holidays/IN-2026.json`). */
  const HOLIDAY = "2026-04-03";

  await page.goto("/");
  await switchToTestWorker(page);
  await settled(page);
  await backToApril();
  await page.locator(`[data-date="${HOLIDAY}"]`).click();

  // `exact`, because `עבד` is a prefix of `עבדה`: without it the masculine
  // name matches the feminine button and the test passes on the defect.
  await expect(page.getByText("עבדה בחג?", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "כן, עבדה", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "לא עבדה", exact: true }),
  ).toBeVisible();

  await chooseGender(page, "male");

  await page.goto("/");
  await switchToTestWorker(page);
  await settled(page);
  await backToApril();
  await page.locator(`[data-date="${HOLIDAY}"]`).click();

  await expect(page.getByText("עבד בחג?", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "כן, עבד", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "לא עבד", exact: true }),
  ).toBeVisible();
  // Not one feminine form survives on the popup, which is the assertion the
  // prefix trap above cannot satisfy by accident.
  await expect(page.getByText("עבדה בחג?", { exact: true })).toHaveCount(0);

  await page.screenshot({
    path: "test-results/gender-calendar-male.png",
    fullPage: true,
  });
});
