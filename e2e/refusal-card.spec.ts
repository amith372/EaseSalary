import { expect, test, type Page } from "@playwright/test";
import {
  switchToFirstWorker,
  switchToTestWorker,
  useHousehold,
} from "./household";
import { SATURDAY } from "../src/lib/dates";
import { fullDayLabel } from "../src/lib/dateLabels";
import { he } from "../src/lib/i18n/he";
import { legalLinks } from "../src/lib/links";

/**
 * A month the engine refused, said as a card (`specs.md` item 25, Part 4,
 * `build_plan.md` stage 8¾ and its two debts).
 *
 * **What this catches.** `InvalidMonthError` carries a Hebrew sentence per
 * refusal, the dates it names and the rule behind it, and until stage 8¾
 * nothing drew any of it: `calculateMonth` threw, `calculateSeries` propagated,
 * and the four screens that replay all failed — so a sentence written for the
 * user arrived as a stack trace and the household had no way back in. It would
 * also catch the half-fix, which is a screen that catches the refusal and draws
 * a blank: the calendar has to survive it, because the mark to correct is on it.
 *
 * **And what the two debts added.** The refusal was caught around the whole
 * replay, so one worker's refused month took the *other* worker's figures off
 * the screen — a household of two lost both salaries over one stray mark. The
 * two addresses that hand back a workbook caught nothing at all and answered a
 * refused month with a 500. Both are asserted below, and both would go back to
 * failing if the catch moved out of `householdSeries` again.
 *
 * **The household is seeded into the refused state and not clicked into it.**
 * Every gesture that could produce one is guarded — the calendar refuses a
 * second mark on a day, the picker withholds a kind no selected day can take,
 * and the rest-day panel answers a stranded mark before saving — so the state
 * the engine refuses is by construction one that arrived another way
 * (`src/lib/dev/seed.ts`).
 *
 * **August 2026 and not September**, which is the run's own month: the seed
 * puts the two marks on 2026-08-20, one month before today (2026-09-18), so
 * every assertion below also proves the card names the month at fault rather
 * than the month the screen was asked for.
 *
 * **The seed refuses the second worker and never the first**, which is what
 * makes the first worker the control: the `refused` household is the `demo`
 * household plus one stray mark on the second worker, so every figure of the
 * first worker's must read the same in both. That is the expectation the
 * per-worker tests measure against, and it comes from the rule — a refusal in
 * one employment says nothing about the other — rather than from what the
 * screen happened to print (`CLAUDE.md` rule 11).
 */

const REFUSED_MONTH = "אוגוסט 2026";
const REFUSED_DAY = "2026-08-20";
/** The refused worker's id, which the two download addresses are built with.
 * It is the seed's own (`src/lib/dev/seed.ts`), since a stale link is exactly
 * the request these two addresses now have to answer. */
const REFUSED_WORKER = "worker-2";

/** The first worker's August, as the whole screen says it — the money the month
 * came to and the balance it closed with. Read from a household and compared
 * with the same household refused. */
async function firstWorkersAugust(page: Page) {
  return {
    net: await page.locator('[data-row="net"]').innerText(),
    vacation: await page
      .locator('[data-row="worker-1-vacation-balance"]')
      .innerText(),
  };
}

test.describe("a refused month says so", () => {
  test("draws the card on the opening screen, with the calendar still under it", async ({
    page,
  }) => {
    await useHousehold(page, "refused", "home");
    await page.goto("/");
    await switchToTestWorker(page);

    const card = page.locator('[data-role="refusal"]');
    await expect(card).toBeVisible();
    // The month at fault, which is not the month the screen would have opened
    // on: one refused month stops the replay of every month after it.
    await expect(card.locator('[data-role="refusal-month"]')).toContainText(
      REFUSED_MONTH,
    );
    // One reason, because the seed's one day carries one refusal — and the
    // engine's own sentence, not a sentence this screen wrote.
    await expect(card.locator('[data-role="refusal-reason"]')).toHaveCount(1);
    await expect(card).toContainText(he.sheet.refusals.dayRecordedTwice);
    // The date beside the sentence rather than inside it, isolated.
    await expect(card.locator('[data-role="refusal-date"]')).toHaveText(
      fullDayLabel(REFUSED_DAY),
    );
    // The rule the refused action rests on (item 25) — the rule of the mark
    // that collided, which for a day holding two of them is one of the two.
    const law = card.getByRole("link");
    await expect(law).toHaveCount(1);
    expect([legalLinks.sickPay.url, legalLinks.holidayWork.url]).toContain(
      await law.getAttribute("href"),
    );

    // Her figures are gone, and the calendar is not. **The mark is what is
    // asserted and not the grid**: an empty August would draw every day cell
    // just the same, so what proves the calendar survived the refusal is that
    // it still names what is on the day the user has to correct — which it can
    // only do by reading her spans, since there is no valued month to read.
    await expect(page.locator('[data-row="net"]')).toHaveCount(0);
    await expect(page.locator(`[data-date="${REFUSED_DAY}"]`)).toContainText(
      he.calendar.marks(SATURDAY).holiday,
    );

    // The rail keeps standing, because it is the household's and the other
    // worker's balances are hers. What it may not do is draw the refused
    // worker's: a balance is derived from the replay the engine refused
    // (item 13), and the rows drew `[מספר] ימים` four times — a bracketed
    // placeholder on screen, which is the thing `[השם שלך]` was cut for. So her
    // two rows are absent, the first worker's are there, and no placeholder is.
    const rail = page.locator('[data-role="balances"]');
    await expect(rail).toBeVisible();
    await expect(
      rail.locator('[data-row="worker-1-vacation-balance"]'),
    ).toBeVisible();
    await expect(
      rail.locator(`[data-row="${REFUSED_WORKER}-vacation-balance"]`),
    ).toHaveCount(0);
    await expect(page.getByText(he.placeholder.count)).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: he.home.paid.exportToExcel }),
    ).toBeVisible();

    await page.screenshot({
      path: "test-results/refusal-card-home.png",
      fullPage: true,
    });
  });

  test("leaves the other worker's month exactly as it was", async ({ page }) => {
    // The same household without the stray mark, which is where the expected
    // figures come from: the two seeds differ in one span on the second worker
    // and in nothing else, so the first worker's August must read the same in
    // both. Anything less is the refusal being charged to the wrong employment.
    await useHousehold(page, "demo", "control");
    await page.goto("/?month=2026-08");
    await expect(page.locator('[data-row="net"]')).toBeVisible();
    const expected = await firstWorkersAugust(page);

    await useHousehold(page, "refused", "other-worker");
    await page.goto("/?month=2026-08");
    // The screen opens on the first worker, whose replay stood: no card, and
    // her figures to the agora.
    await expect(page.locator('[data-role="refusal"]')).toHaveCount(0);
    expect(await firstWorkersAugust(page)).toEqual(expected);

    // And the card is one step of the switcher away, over the same month.
    await switchToTestWorker(page);
    await expect(page.locator('[data-role="refusal"]')).toBeVisible();
    await expect(page.locator('[data-row="net"]')).toHaveCount(0);
    // Stepping back restores her, which proves the card was never the
    // household's: a screen that had caught around the whole replay could not
    // come back to a figure at all.
    await switchToFirstWorker(page);
    await expect(page.locator('[data-role="refusal"]')).toHaveCount(0);
    expect(await firstWorkersAugust(page)).toEqual(expected);

    await page.screenshot({
      path: "test-results/refusal-other-worker.png",
      fullPage: true,
    });
  });

  test("says the same thing on the payslip, the payments screen and the reports — and only for her", async ({
    page,
  }) => {
    await useHousehold(page, "refused", "other-screens");
    const card = page.locator('[data-role="refusal"]');

    // The first worker first, because those three screens are the ones that
    // caught around the whole household: each drew the card in place of itself
    // and the worker who had done nothing lost her payslip, her payments and
    // her reports along with it. The heading is asserted beside the card's
    // absence, because a screen that failed to render at all would also have
    // no card on it.
    const drawn: Record<string, (on: Page) => ReturnType<Page["locator"]>> = {
      // The payslip heads itself with the month it is showing, so what says the
      // sheet is drawn is the label above it rather than a fixed title.
      "/month/payslip": (on) => on.getByText(he.payslip.eyebrow),
      "/payments": (on) =>
        on.getByRole("heading", { name: he.payments.title }),
      "/reports": (on) => on.getByRole("heading", { name: he.reports.title }),
    };
    for (const [route, marker] of Object.entries(drawn)) {
      await page.goto(route);
      await expect(marker(page).first()).toBeVisible();
      await expect(card).toHaveCount(0);
    }

    await switchToTestWorker(page);
    for (const route of Object.keys(drawn)) {
      await page.goto(route);
      await expect(card).toBeVisible();
      await expect(card.locator('[data-role="refusal-month"]')).toContainText(
        REFUSED_MONTH,
      );
      await expect(card).toContainText(he.sheet.refusals.dayRecordedTwice);
    }
  });

  test("a download over a refused month lands on the card and not on an error", async ({
    page,
  }) => {
    await useHousehold(page, "refused", "download");
    // The addresses behind the two download buttons, reached the way a stale
    // link or a bookmark reaches them — which is the only way they can be
    // reached now, since every screen that offers them draws the card instead.
    // They used to replay without a catch and answer with a 500.
    for (const address of [
      `/month/export/file?worker=${REFUSED_WORKER}&month=2026-08`,
      `/reports/file?worker=${REFUSED_WORKER}&report=recuperation`,
    ]) {
      await page.goto(address);
      // The opening screen, which is the one screen that draws the card *and*
      // carries the calendar the mark is corrected on.
      await expect(page).toHaveURL(/\/$/);
      const card = page.locator('[data-role="refusal"]');
      await expect(card).toBeVisible();
      await expect(card.locator('[data-role="refusal-month"]')).toContainText(
        REFUSED_MONTH,
      );
      // The refused worker's card and not the screen's default worker: the
      // download named her, so the redirect has to arrive showing her, or it
      // lands on a screen with nothing on it to explain the refusal.
      await expect(page.locator(`[data-date="${REFUSED_DAY}"]`)).toContainText(
        he.calendar.marks(SATURDAY).holiday,
      );
    }

    await page.screenshot({
      path: "test-results/refusal-download.png",
      fullPage: true,
    });
  });

  test("clearing the day brings the figures back", async ({ page }) => {
    await useHousehold(page, "refused", "corrected");
    await page.goto("/");
    await switchToTestWorker(page);
    await expect(page.locator('[data-role="refusal"]')).toBeVisible();

    // The gesture a user makes: sweep over the day and clear what is on it.
    // The screen has already opened on August, because switching to a worker
    // the engine refused moves the calendar to her refused month. The sweep
    // starts on the day before, because a first click on a holiday asks whether
    // it was worked rather than anchoring a range (`MonthCalendar.tsx`) — and
    // the 19th carries no mark of its own.
    await page.locator('[data-date="2026-08-19"]').click();
    await page.locator(`[data-date="${REFUSED_DAY}"]`).click();
    await page
      .getByRole("button", { name: he.calendar.picker.clear, exact: true })
      .click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    // The card is gone and the month is valued again — and so is every month
    // after it, which the refusal had been stopping.
    await expect(page.locator('[data-role="refusal"]')).toHaveCount(0);
    await expect(page.locator('[data-row="net"]')).toBeVisible();
    // And her rows come back to the rail beside the first worker's: the
    // correction is what gives the replay a month to derive a balance from.
    await expect(
      page.locator(`[data-row="${REFUSED_WORKER}-vacation-balance"]`),
    ).toBeVisible();
    await expect(page.getByText(he.placeholder.count)).toHaveCount(0);
    await page.goto("/month/payslip?month=2026-09");
    await expect(page.locator('[data-role="refusal"]')).toHaveCount(0);

    await page.screenshot({
      path: "test-results/refusal-card-corrected.png",
      fullPage: true,
    });
  });
});
