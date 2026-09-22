import { expect, test, type Page } from "@playwright/test";
import {
  openSettingsGroups,
  switchToTestWorker,
  useHousehold,
} from "./household";
import { FRIDAY, SATURDAY } from "../src/lib/dates";
import { fullDayLabel } from "../src/lib/dateLabels";
import { he } from "../src/lib/i18n/he";
import { formatDays } from "../src/lib/money";

/**
 * A change of the weekly rest day, and the free rest days it would strand
 * (`specs.md` item 5, `build_plan.md` stage 8½).
 *
 * **What this catches.** Until this stage a change of rest day re-snapshotted
 * every month and left the mark on the old day, and the month then refused to
 * be calculated at all — so the home screen, the payslip and the bell in the bar
 * all threw, and `/settings` was the only screen left standing. That is not a
 * failure a unit test sees: the engine's refusal is correct, and what was wrong
 * was that nothing asked the question before saving.
 *
 * **Every date here is read off the 2026 calendar by hand.** 2026-01-01 is a
 * Thursday, so 2026-09-01 is a Tuesday: September's Saturdays are the 5th, 12th,
 * 19th and 26th, and its Fridays are the 4th, 11th, 18th and 25th. The run's
 * own day is 2026-09-18 (`household.ts`), so September is the current month and
 * August is the month before it.
 *
 * **The vacation balance is worked out on paper.** The second worker opens
 * January 2026 with 9 days (`seed.ts`), her employment began on 2024-04-01 so
 * 2026 is her third seniority year and accrues 14 days a year (item 7) — 14/12
 * a month, over the nine months January to September, which is 10.5 — and the
 * only vacation she has taken is 16–19 February, which is four days. 9 + 10.5 −
 * 4 = 15.5 days at the end of September, and a free rest day turned into a
 * vacation day takes it to 14.5.
 */

/** The free rest day every test here marks: a Saturday inside the current
 * month, which a change to Friday strands. */
const FREE_SATURDAY = "2026-09-12";

/** The nearest Friday before it and the nearest after it — the two moves item 5
 * offers, both inside September. */
const FRIDAY_BEFORE = "2026-09-11";
const FRIDAY_AFTER = "2026-09-18";

const SEPTEMBER = "2026-09";
/** The month before the current one, which a change of rest day never reaches. */
const AUGUST = "2026-08";

/** September's closing vacation balance before anything here converts a day,
 * and after. */
const VACATION_BEFORE = 15.5;
const VACATION_AFTER = 14.5;

/** Wait until the server action has come back — the screen says so with
 * `aria-busy`, so this is the screen's own signal and not a sleep. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Marks one Saturday as a free rest day, through the calendar, as a user
 * does. */
async function markFreeSaturday(page: Page): Promise<void> {
  await page.goto("/");
  await switchToTestWorker(page);
  await page.locator(`[data-date="${FREE_SATURDAY}"]`).click();
  await page.locator(`[data-date="${FREE_SATURDAY}"]`).click();
  await page
    .getByRole("button", {
      name: he.calendar.marks(SATURDAY).freeRestDay,
      exact: true,
    })
    .click();
  await settled(page);
}

/** Presses the Friday chip on `/settings` and waits for the panel the stranded
 * mark raises. */
async function askForFriday(page: Page) {
  await page.goto("/settings");
  await switchToTestWorker(page);
  await openSettingsGroups(page);
  await page
    .locator('[data-terms="restDay"]')
    .getByRole("button", {
      name: he.workers.profile.terms.restDay.day(FRIDAY),
      exact: true,
    })
    .click();
  const panel = page.locator('[data-terms="strandedFreeRestDays"]');
  await expect(panel).toBeVisible();
  return panel;
}

/** One mark's row inside the panel. */
function mark(panel: ReturnType<Page["locator"]>) {
  return panel.locator(`[data-stranded="${FREE_SATURDAY}"]`);
}

/** One day of the open calendar. A mark is read off the day's own label, which
 * is where the calendar names it — there is no attribute for it, and asserting
 * the label is the stronger reading anyway: it is what the user sees. */
function day(page: Page, date: string) {
  return page.locator(`[data-date="${date}"]`);
}

test.describe("a change of rest day asks about the marks it would strand (item 5)", () => {
  test("offers the three answers, with the two move dates it would write", async ({
    page,
  }) => {
    await useHousehold(page, "rest-day-change", "offers");
    await markFreeSaturday(page);
    const panel = await askForFriday(page);
    const row = mark(panel);

    // One row, for the one Saturday marked — named by its date, so the user
    // answers about a day and not about "the marks".
    await expect(panel.locator("[data-stranded]")).toHaveCount(1);
    await expect(row).toContainText(fullDayLabel(FREE_SATURDAY));

    // Delete is never refused: it needs no date and no balance.
    await expect(row.locator('[data-choice="delete"]')).toHaveAttribute(
      "data-offered",
      "yes",
    );

    // The two moves are the nearest Friday on each side — one day back and six
    // days forward — and both are inside September, so both are offered.
    const earlier = row.locator('[data-choice="moveEarlier"]');
    const later = row.locator('[data-choice="moveLater"]');
    await expect(earlier).toHaveAttribute("data-offered", "yes");
    await expect(earlier).toContainText(fullDayLabel(FRIDAY_BEFORE));
    await expect(later).toHaveAttribute("data-offered", "yes");
    await expect(later).toContainText(fullDayLabel(FRIDAY_AFTER));

    // 15.5 days covers one, so the conversion is offered too.
    await expect(row.locator('[data-choice="convert"]')).toHaveAttribute(
      "data-offered",
      "yes",
    );

    // And nothing has been saved: the chips still show Saturday, so cancelling
    // leaves the employment exactly as it was.
    await page
      .locator('[data-stranded-action="cancel"]')
      .click();
    await expect(panel).toHaveCount(0);
    await page.goto("/");
    await switchToTestWorker(page);
    await expect(day(page, FREE_SATURDAY)).toContainText(
      he.calendar.marks(SATURDAY).freeRestDay,
    );
    await page.screenshot({
      path: "test-results/rest-day-stranded-panel.png",
      fullPage: true,
    });
  });

  test("says why a move that would leave the month is not offered", async ({
    page,
  }) => {
    await useHousehold(page, "rest-day-change", "other-month");
    await page.goto("/");
    await switchToTestWorker(page);
    // The last Saturday of September. Moving forward from it reaches 2026-10-02,
    // which is October — item 5 does not offer a move into another month.
    await page.locator('[data-date="2026-09-26"]').click();
    await page.locator('[data-date="2026-09-26"]').click();
    await page
      .getByRole("button", {
        name: he.calendar.marks(SATURDAY).freeRestDay,
        exact: true,
      })
      .click();
    await settled(page);

    const panel = await askForFriday(page);
    const row = panel.locator('[data-stranded="2026-09-26"]');
    await expect(row.locator('[data-choice="moveEarlier"]')).toHaveAttribute(
      "data-offered",
      "yes",
    );
    const later = row.locator('[data-choice="moveLater"]');
    await expect(later).toHaveAttribute("data-offered", "no");
    await expect(later).toContainText(
      he.workers.profile.terms.restDay.stranded.reasons.otherMonth,
    );
  });

  test("moves the mark to the Friday the user picked, and the counts follow", async ({
    page,
  }) => {
    await useHousehold(page, "rest-day-change", "move");
    await markFreeSaturday(page);
    const panel = await askForFriday(page);
    await mark(panel)
      .locator('[data-choice="moveLater"] input')
      .check();
    await panel.locator('[data-stranded-action="save"]').click();
    await settled(page);

    // The calendar draws the mark on the Friday and no longer on the Saturday,
    // and names it as a Friday-resting worker's day.
    await page.goto("/");
    await switchToTestWorker(page);
    await expect(day(page, FRIDAY_AFTER)).toContainText(
      he.calendar.marks(FRIDAY).freeRestDay,
    );
    await expect(day(page, FREE_SATURDAY)).not.toContainText(
      he.calendar.marks(FRIDAY).freeRestDay,
    );

    // The payslip counts one free rest day, and the vacation balance is
    // untouched: a moved mark spends nothing.
    await page.goto(`/month/payslip?month=${SEPTEMBER}`);
    await expect(page.locator('[data-day-stat="freeRestDays"]')).toContainText(
      "1",
    );
    await expect(page.locator('[data-after="vacation"]')).toContainText(
      formatDays(VACATION_BEFORE),
    );
    await page.screenshot({
      path: "test-results/rest-day-moved.png",
      fullPage: true,
    });
  });

  test("turns the mark into a vacation day, and the balance falls by one", async ({
    page,
  }) => {
    await useHousehold(page, "rest-day-change", "convert");
    await markFreeSaturday(page);

    // The balance before, so the day the conversion spends is a difference and
    // not an absolute figure read once.
    await page.goto(`/month/payslip?month=${SEPTEMBER}`);
    await expect(page.locator('[data-after="vacation"]')).toContainText(
      formatDays(VACATION_BEFORE),
    );

    const panel = await askForFriday(page);
    await mark(panel).locator('[data-choice="convert"] input').check();
    await panel.locator('[data-stranded-action="save"]').click();
    await settled(page);

    await page.goto(`/month/payslip?month=${SEPTEMBER}`);
    await expect(page.locator('[data-after="vacation"]')).toContainText(
      formatDays(VACATION_AFTER),
    );
    // No free rest day is left, because the day is a vacation day now.
    await expect(page.locator('[data-day-stat="freeRestDays"]')).toContainText(
      "0",
    );
  });

  test("deletes the mark, and the month draws without it", async ({ page }) => {
    await useHousehold(page, "rest-day-change", "delete");
    await markFreeSaturday(page);
    const panel = await askForFriday(page);
    await mark(panel).locator('[data-choice="delete"] input').check();
    await panel.locator('[data-stranded-action="save"]').click();
    await settled(page);

    await page.goto("/");
    await switchToTestWorker(page);
    await expect(day(page, FREE_SATURDAY)).not.toContainText(
      he.calendar.marks(FRIDAY).freeRestDay,
    );
    await page.goto(`/month/payslip?month=${SEPTEMBER}`);
    await expect(page.locator('[data-day-stat="freeRestDays"]')).toContainText(
      "0",
    );
    // The balance is where it was: a deleted mark spends nothing either.
    await expect(page.locator('[data-after="vacation"]')).toContainText(
      formatDays(VACATION_BEFORE),
    );
  });

  test("leaves the month before the current one resting on Saturday", async ({
    page,
  }) => {
    await useHousehold(page, "rest-day-change", "before");
    await markFreeSaturday(page);
    const panel = await askForFriday(page);
    await mark(panel).locator('[data-choice="delete"] input').check();
    await panel.locator('[data-stranded-action="save"]').click();
    await settled(page);

    // August's sheet still names Fridays as her rest-eves, which is what a
    // Saturday-resting month does: item 5's change "reaches the current month
    // and the months after it, and never a month before".
    await page.goto(`/month/payslip?month=${AUGUST}`);
    await expect(page.locator('[data-row="restEveSupplement"]')).toContainText(
      he.sheet.lines.restEveSupplement(SATURDAY),
    );
    // September, which the change does reach, names Thursdays.
    await page.goto(`/month/payslip?month=${SEPTEMBER}`);
    await expect(page.locator('[data-row="restEveSupplement"]')).toContainText(
      he.sheet.lines.restEveSupplement(FRIDAY),
    );
  });
});

/**
 * A kind no day of the selection can take is not offered (`specs.md` items 5,
 * 8), which is the picker's side of the same rule the panel above answers for
 * marks already made.
 *
 * **What this catches.** The picker offered all three kinds on every day, so a
 * Friday-resting worker was shown "שישי חופשי" on a Saturday, pressed it, and
 * got nothing marked and a skipped-day sentence afterwards — a control offered
 * and then refused. It also catches the over-correction: a swept week holding
 * one Friday must still offer the kind, because item 8 marks the days that can
 * take it and reports the rest.
 */
test.describe("the picker withholds a kind no selected day can take (items 5, 8)", () => {
  /** Sets the rest day to Friday on a worker with nothing marked, so the
   * stranded panel has nothing to ask about and the change saves outright. */
  async function restOnFriday(page: Page): Promise<void> {
    await page.goto("/settings");
    await switchToTestWorker(page);
    await openSettingsGroups(page);
    await page
      .locator('[data-terms="restDay"]')
      .getByRole("button", {
        name: he.workers.profile.terms.restDay.day(FRIDAY),
        exact: true,
      })
      .click();
    await settled(page);
    await expect(
      page.locator('[data-terms="strandedFreeRestDays"]'),
    ).toHaveCount(0);
  }

  /** Opens the picker over one day, as two presses on it do. */
  async function pick(page: Page, date: string) {
    await page.locator(`[data-date="${date}"]`).click();
    await page.locator(`[data-date="${date}"]`).click();
    return page.getByRole("button", {
      name: he.calendar.marks(FRIDAY).freeRestDay,
      exact: true,
    });
  }

  test("greys it on a Saturday and says why, and offers it on her Friday", async ({
    page,
  }) => {
    await useHousehold(page, "rest-day-change", "picker");
    await restOnFriday(page);
    await page.goto("/");
    await switchToTestWorker(page);

    // A Saturday: she does not rest on it, so the chip is there and dead no
    // longer — it is greyed, with the sentence that says only Friday can be it.
    const onSaturday = await pick(page, FREE_SATURDAY);
    await expect(onSaturday).toBeDisabled();
    await expect(page.getByText(he.calendar.skipped(FRIDAY).notRestDay)).toBeVisible();
    await page.screenshot({
      path: "test-results/picker-withholds-free-rest-day.png",
      fullPage: true,
    });

    // Her own Friday: offered, and it marks.
    await page.keyboard.press("Escape");
    const onFriday = await pick(page, FRIDAY_AFTER);
    await expect(onFriday).toBeEnabled();
    await onFriday.click();
    await settled(page);
    await expect(day(page, FRIDAY_AFTER)).toContainText(
      he.calendar.marks(FRIDAY).freeRestDay,
    );
  });

  test("still offers it over a week that holds one Friday", async ({ page }) => {
    await useHousehold(page, "rest-day-change", "picker-week");
    await restOnFriday(page);
    await page.goto("/");
    await switchToTestWorker(page);

    // 12–18 September is Saturday to Friday: six days refuse the mark and the
    // 18th takes it, so the kind stays offered and the six are reported.
    await page.locator(`[data-date="${FREE_SATURDAY}"]`).click();
    await page.locator(`[data-date="${FRIDAY_AFTER}"]`).click();
    const chip = page.getByRole("button", {
      name: he.calendar.marks(FRIDAY).freeRestDay,
      exact: true,
    });
    await expect(chip).toBeEnabled();
    await chip.click();
    await settled(page);

    // The Friday alone carries it, and the Saturday does not.
    await expect(day(page, FRIDAY_AFTER)).toContainText(
      he.calendar.marks(FRIDAY).freeRestDay,
    );
    await expect(day(page, FREE_SATURDAY)).not.toContainText(
      he.calendar.marks(FRIDAY).freeRestDay,
    );
  });
});
