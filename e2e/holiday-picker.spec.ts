import { expect, test, type Page } from "@playwright/test";
import { TEST_WORKER_ID, switchToTestWorker } from "./household";
import { SATURDAY } from "../src/lib/dates";
import { he } from "../src/lib/i18n/he";
import { weekdayDayLabel } from "../src/lib/dateLabels";
import { formatAgorot, formatDays } from "../src/lib/money";

/**
 * The year's holidays chosen in advance, through the browser — `בחירת חגים`
 * and `specs.md` item 10.
 *
 * **What this file checks that no unit test can.** The picker, the month's
 * calendar and the month's figures are three views of one set of spans, and the
 * wiring between them is where a year chosen in advance either arrives on the
 * calendar or does not. Every assertion below is about a *result*: a day drawn
 * on another screen, an amount that halved, a row that refused, a count on the
 * profile (`CLAUDE.md` rules 9 and 11).
 *
 * **Every expected figure comes from outside the code under test.**
 *
 * - Nine days for a full year is item 10's; the demo worker was employed from
 *   1.4.2024, so 2026 is a full calendar year and her entitlement is nine.
 * - ₪426.35 for a worked holiday is `specs.md` Part 4's own figure, and it is
 *   also what Part 5's formula gives for the seeded wage: a rest day is
 *   twenty-five hours, so the rate is (6,247.65 ÷ 25 + 6,247.65 ÷ 182) × 1.5 =
 *   ₪426.3506…, which rounds to ₪426.35.
 * - ₪213.18 is half of that rate rounded at the end — 21,317.53 agorot to the
 *   nearest agora — which is what "a holiday taken as part of a day is paid in
 *   the same proportion" means in money (item 10).
 * - Every candidate date is read off the shipped `data/holidays/PH-2026.json`,
 *   which is the list the demo worker's country is filed under.
 *
 * **Each test gets its own store**, for the reason the other specs give: the
 * dev repository is a module singleton keyed by the `household` cookie, so a
 * suffix after the seed name opens a fresh one and a "before" assertion is as
 * true on the second run as on the first.
 */

/** The demo worker's own three seeded holidays for 2026, and her entitlement. */
const SEEDED_CHOSEN = 3;
const FULL_YEAR = 9;

/**
 * ₪439.74 for one worked holiday, and half of it.
 *
 * Derived from the ₪6,443.85 in force from 1.4.2026 by item 3's own rule —
 * (6,443.85 ÷ 25 + 6,443.85 ÷ 182) × 1.5 — and **printed independently** at
 * `שכר_חודשי_להאנה2026.xlsx` → `חודש  8.26` → `D8`, so the figure has a source
 * outside this code. Half of 43,974 is 21,987 exactly.
 */
const HOLIDAY_RATE = 43974;
const HALF_HOLIDAY = 21987;

/**
 * **Dates read off `data/holidays/IN-2026.json`**, because the worker the suite
 * works on is from India (settled with the user on 2026-09-11: the worker from
 * the Philippines carries the family's workbooks and is not edited by tests).
 * They were Philippine dates until then, and every one of them is a different
 * day here — which is the point of the candidate list being per country.
 *
 * None of the dates below falls on a Saturday, which is her rest day: a paid
 * holiday there would be refused as the day being recorded twice (Part 4).
 */
const CANDIDATE_IN_JUNE = "2026-06-22";
/** A candidate the demo household's sick spell of 30.3–2.4 already covers.
 * Mahavir Jayanti, 31.3.2026, a Tuesday. */
const CANDIDATE_INSIDE_SICKNESS = "2026-03-31";
/** The worked holiday of the seed. India publishes Good Friday on that date, so
 * unlike the Philippine list this one names it. */
const WORKED_HOLIDAY = "2026-04-03";
/** The seed's other worked holiday, which India does not publish at all — so it
 * is the screen's own case of a date chosen that nobody published. */
const CHOSEN_WITH_NO_NAME = "2026-08-20";
/** Six more candidates, none of them covered by another mark and none on a
 * Saturday, which take her from three chosen days to the whole nine. */
const SIX_MORE = [
  "2026-01-13",
  "2026-01-14",
  "2026-01-19",
  "2026-01-26",
  "2026-02-26",
  "2026-03-03",
];
/** A date nobody published, typed by hand — item 12's own answer to a list that
 * could not be fetched. 27.7.2026 is a Monday, so it is neither her rest day
 * nor a day the seed already marks, and India publishes nothing on it. */
const TYPED_BY_HAND = "2026-07-27";

const RUN = Date.now().toString(36);

async function useHousehold(page: Page, label: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "household",
      value: `demo-e2e-${RUN}-${label}`,
      url: "http://localhost:3000",
    },
  ]);
}

/** Wait until the change reaching the store has come back. The picker dims and
 * says `aria-busy` while a server action is in flight, so this is the screen's
 * own signal and not a sleep. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

function holidayRow(page: Page, date: string) {
  return page.locator(`[data-holiday="${date}"]`);
}

/** Tick or untick one date, by the label the row carries rather than by
 * position. */
async function tick(page: Page, date: string): Promise<void> {
  await holidayRow(page, date).getByRole("checkbox").click();
  await settled(page);
}

function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

/** Step the month screen back to April 2026 from the month it opens on. */
async function backTo(page: Page, months: number): Promise<void> {
  for (let step = 0; step < months; step += 1) {
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
  }
}

test.describe("the year's holidays, chosen in advance (specs.md item 10)", () => {
  test("opens on the year the household holds, against the entitlement", async ({
    page,
  }) => {
    await useHousehold(page, "opens");
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);

    // Three chosen of nine: the seed's own holidays against a full calendar
    // year's entitlement.
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(SEEDED_CHOSEN),
    );
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(FULL_YEAR),
    );
    // An incomplete selection is visible at a glance (item 10).
    await expect(
      page.locator('[data-quota-state="incomplete"]'),
    ).toContainText(he.holidays.quota.incomplete);

    // The three the store holds are ticked and the rest are not.
    await expect(holidayRow(page, "2026-01-01")).toHaveAttribute(
      "data-chosen",
      "true",
    );
    await expect(holidayRow(page, CANDIDATE_IN_JUNE)).toHaveAttribute(
      "data-chosen",
      "false",
    );

    // A chosen date the source never published still has a row, with the date
    // and no name — otherwise a day she had moved a holiday onto would vanish
    // from the screen while still drawing on her quota.
    await expect(holidayRow(page, CHOSEN_WITH_NO_NAME)).toContainText(
      he.holidays.row.own,
    );

    // The candidate list is the Philippines', because that is her country, and
    // the faiths are offered beside the countries (item 10).
    await expect(page.locator('[data-source="IN"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator('[data-source="druze"]')).toBeVisible();

    // The picker is reached from `הגדרות`, so `הגדרות` is the tab that lights.
    await expect(
      page.getByRole("link", { name: he.nav.settings }),
    ).toHaveAttribute("aria-current", "page");

    await page.screenshot({
      path: "test-results/holidays-opened.png",
      fullPage: true,
    });
  });

  test("a date chosen here arrives on the month's calendar already drawn", async ({
    page,
  }) => {
    await useHousehold(page, "arrives");

    // Before: June's calendar carries no holiday on the 12th. The user never
    // marks a day as a holiday (item 9), so this is the only way one can appear.
    await page.goto("/month");
    await switchToTestWorker(page);
    await backTo(page, 3);
    await expect(page.locator(`[data-date="${CANDIDATE_IN_JUNE}"]`)).not.toContainText(
      he.calendar.marks(SATURDAY).holiday,
    );

    await page.goto("/settings/holidays");
    await switchToTestWorker(page);
    await tick(page, CANDIDATE_IN_JUNE);
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(SEEDED_CHOSEN + 1),
    );

    // After: the day is drawn on the month, and the profile's own row counts it.
    await page.goto("/month");
    await switchToTestWorker(page);
    await backTo(page, 3);
    await expect(page.locator(`[data-date="${CANDIDATE_IN_JUNE}"]`)).toContainText(
      he.calendar.marks(SATURDAY).holiday,
    );
    await page.screenshot({
      path: "test-results/holidays-drawn-on-june.png",
      fullPage: true,
    });

    await page.goto(`/workers/${TEST_WORKER_ID}`);
    await expect(page.locator("[data-holidays]")).toContainText(
      formatDays(SEEDED_CHOSEN + 1),
    );
  });

  test("a holiday taken as half a day is paid half (item 10)", async ({
    page,
  }) => {
    await useHousehold(page, "half");

    // Before: April's worked holiday is paid at the whole rest-day rate, which
    // is Part 4's ₪426.35.
    await page.goto("/month");
    await switchToTestWorker(page);
    await backTo(page, 5);
    await expect(page.locator(`[data-date="${WORKED_HOLIDAY}"]`)).toBeVisible();
    await expect(row(page, "holidaysWorked")).toContainText(
      formatAgorot(HOLIDAY_RATE),
    );

    await page.goto("/settings/holidays");
    await switchToTestWorker(page);
    await holidayRow(page, WORKED_HOLIDAY)
      .locator('[data-part="0.5"]')
      .click();
    await settled(page);

    // The quota falls by half a day, and it is displayed as the fraction it is
    // rather than rounded to a whole day (item 10).
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(SEEDED_CHOSEN - 0.5),
    );

    // **And the money follows.** Half a day of a worked holiday is half the
    // rate, rounded at the end. That is the failure this catches: a part-day
    // the picker records and the sheet still pays whole.
    await page.goto("/month");
    await switchToTestWorker(page);
    await backTo(page, 5);
    await expect(row(page, "holidaysWorked")).toContainText(
      formatAgorot(HALF_HOLIDAY),
    );
    await page.screenshot({
      path: "test-results/holidays-half-day-paid.png",
      fullPage: true,
    });
  });

  test("refuses a date another entry already covers", async ({ page }) => {
    await useHousehold(page, "clash");
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);

    // 2.4.2026 is the last day of the seeded spell of sickness. A day carrying
    // two entries is what `validateMonth` refuses as `dayRecordedTwice`, and
    // refusing it here says so while she is looking at the date.
    await tick(page, CANDIDATE_INSIDE_SICKNESS);

    await expect(holidayRow(page, CANDIDATE_INSIDE_SICKNESS)).toContainText(
      he.holidays.refused.alreadyMarked,
    );
    await expect(holidayRow(page, CANDIDATE_INSIDE_SICKNESS)).toHaveAttribute(
      "data-chosen",
      "false",
    );
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(SEEDED_CHOSEN),
    );
  });

  test("refuses a tenth day once the nine are chosen", async ({ page }) => {
    await useHousehold(page, "limit");
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);

    for (const date of SIX_MORE) await tick(page, date);

    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(FULL_YEAR),
    );
    await expect(page.locator('[data-quota-state="complete"]')).toContainText(
      he.holidays.quota.complete,
    );

    // A day beyond the entitlement is refused, and the reason is said on the
    // row rather than in a message somewhere else (item 25).
    const beyond = holidayRow(page, CANDIDATE_IN_JUNE);
    await expect(beyond).toContainText(he.holidays.row.blocked);
    await expect(beyond.getByRole("checkbox")).toBeDisabled();

    await page.screenshot({
      path: "test-results/holidays-quota-spent.png",
      fullPage: true,
    });
  });

  test("takes a date typed by hand, which is what a failed fetch leaves (item 12)", async ({
    page,
  }) => {
    await useHousehold(page, "manual");
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);

    await page
      .getByRole("button", { name: he.holidays.sources.manual })
      .click();
    await page.getByLabel(he.holidays.add.date, { exact: true }).fill(TYPED_BY_HAND);
    await page
      .getByRole("button", { name: he.holidays.add.submit, exact: true })
      .click();
    await settled(page);

    const added = holidayRow(page, TYPED_BY_HAND);
    await expect(added).toHaveAttribute("data-chosen", "true");
    await expect(added).toContainText(he.holidays.row.own);
    await expect(added).toContainText(weekdayDayLabel(TYPED_BY_HAND));
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(SEEDED_CHOSEN + 1),
    );

    // It reaches July's calendar like any other chosen date.
    await page.goto("/month");
    await switchToTestWorker(page);
    await backTo(page, 2);
    await expect(page.locator(`[data-date="${TYPED_BY_HAND}"]`)).toContainText(
      he.calendar.marks(SATURDAY).holiday,
    );
  });

  test("moves a chosen date to another day, keeping the day (item 10)", async ({
    page,
  }) => {
    await useHousehold(page, "move");
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);

    // The gesture a family makes when a holiday falls inside a spell of
    // sickness: the date moves and the day is kept, which is why item 10
    // resolves that case in favour of the sick balance.
    // By the label the row's own control carries, which names the date: a screen
    // of identical "להעביר תאריך" links would otherwise be a screen of controls
    // a reader cannot tell apart.
    await page
      .getByRole("button", {
        name: he.holidays.row.moveLabel(weekdayDayLabel(WORKED_HOLIDAY)),
      })
      .click();
    await page.getByLabel(he.holidays.add.date, { exact: true }).fill(TYPED_BY_HAND);
    await page
      .getByRole("button", { name: he.holidays.add.moveSubmit, exact: true })
      .click();
    await settled(page);

    await expect(holidayRow(page, WORKED_HOLIDAY)).toHaveAttribute(
      "data-chosen",
      "false",
    );
    await expect(holidayRow(page, TYPED_BY_HAND)).toHaveAttribute(
      "data-chosen",
      "true",
    );
    // The quota is untouched: the same one day, on another date.
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(SEEDED_CHOSEN),
    );

    // April no longer pays a worked holiday, and July's calendar carries one.
    await page.goto("/month");
    await switchToTestWorker(page);
    await backTo(page, 5);
    await expect(row(page, "holidaysWorked")).toHaveCount(0);
  });
});
