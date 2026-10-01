import { expect, test, type Page } from "@playwright/test";
import { switchToTestWorker, openSettingsForTestWorker, TODAY } from "./household";
import { addMonths, monthOf, SATURDAY } from "../src/lib/dates";
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
 *   1.4.2024, so 2026 is a full calendar year and their entitlement is nine.
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

/** The demo worker's own three seeded holidays for 2026, and their entitlement. */
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
 * None of the dates below falls on a Saturday, which is their rest day: a paid
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
 * Saturday, which take them from three chosen days to the whole nine. */
const SIX_MORE = [
  "2026-01-13",
  "2026-01-14",
  "2026-01-19",
  "2026-01-26",
  "2026-02-26",
  "2026-03-03",
];
/** A date nobody published, typed by hand — item 12's own answer to a list that
 * could not be fetched. 27.7.2026 is a Monday, so it is neither their rest day
 * nor a day the seed already marks, and India publishes nothing on it. */
const TYPED_BY_HAND = "2026-07-27";
/** Independence Day on their Indian list, a Saturday — their rest day. */
const SATURDAY_HOLIDAY = "2026-08-15";

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

/**
 * The right edge of one piece of a row's text, in page pixels.
 *
 * A Range over the element's contents hugs the glyphs; the element's own box is
 * a stretched flex item and would report the column's edge whichever way the
 * text inside it resolved, which is the failure this measures.
 */
async function textRightEdge(
  page: Page,
  date: string,
  part: string,
): Promise<number> {
  return holidayRow(page, date)
    .locator(`[data-role="${part}"]`)
    .evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect().right;
    });
}

function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

/** Step the calendar back to April 2026 from the month it opens on. */
async function backTo(page: Page, months: number): Promise<void> {
  for (let step = 0; step < months; step += 1) {
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
  }
}

/**
 * The payslip for the month `backTo` would have reached, showing this spec's
 * worker.
 *
 * **What a worked holiday pays is read off the sheet** (specs.md item 5): it is
 * a line of column F behind the ‏ברוטו‎, and the card beside the calendar
 * summarises rather than itemising. Both were drawn on `/month` until
 * 2026-09-16. The month is derived from today for the same reason `backTo`
 * counts from the month the screen opens on.
 */
async function openPayslipMonthsBack(page: Page, months: number): Promise<void> {
  const month = addMonths(monthOf(TODAY), -months);
  const label = `${month.year}-${String(month.month).padStart(2, "0")}`;
  await page.goto(`/month/payslip?month=${label}`);
  await switchToTestWorker(page);
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
    // and no name — otherwise a day they had moved a holiday onto would vanish
    // from the screen while still drawing on their quota.
    await expect(holidayRow(page, CHOSEN_WITH_NO_NAME)).toContainText(
      he.holidays.row.own,
    );

    // The candidate list is the Philippines', because that is their country, and
    // the faiths are offered beside the countries (item 10).
    await expect(page.locator('[data-source="IN"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator('[data-source="druze"]')).toBeVisible();

    // The picker is reached from `הגדרות`, so `הגדרות` is the tab that lights.
    await expect(
      page.getByRole("link", { name: he.screens.settings.name, exact: true }),
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
    await page.goto("/");
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
    await page.goto("/");
    await switchToTestWorker(page);
    await backTo(page, 3);
    await expect(page.locator(`[data-date="${CANDIDATE_IN_JUNE}"]`)).toContainText(
      he.calendar.marks(SATURDAY).holiday,
    );
    await page.screenshot({
      path: "test-results/holidays-drawn-on-june.png",
      fullPage: true,
    });

    await openSettingsForTestWorker(page);
    await expect(page.locator("[data-holidays]")).toContainText(
      formatDays(SEEDED_CHOSEN + 1),
    );
  });

  /**
   * **A chosen holiday arrives unanswered, and the month cannot be exported
   * until somebody says whether they worked it** (specs.md items 9 and 18,
   * settled with the user on 2026-09-12).
   *
   * Monday 22 June 2026 is chosen here, so it reaches the calendar with nobody
   * having answered for it. What this would catch is the one failure that
   * matters for the change: the export going through on the preview's lean.
   * The preview pays an unanswered holiday as worked so the figure never quietly
   * underpays them, and that lean is only safe because the export refuses to
   * proceed on it.
   */
  test("a chosen holiday arrives unanswered, and blocks the export until answered", async ({
    page,
  }) => {
    await useHousehold(page, "unanswered");

    await page.goto("/settings/holidays");
    await switchToTestWorker(page);
    await tick(page, CANDIDATE_IN_JUNE);

    // On the calendar it is the third state, named for the question nobody
    // answered rather than drawn as either answer.
    await page.goto("/");
    await switchToTestWorker(page);
    await backTo(page, 3);
    const cell = page.locator(`[data-date="${CANDIDATE_IN_JUNE}"]`);
    await expect(cell).toHaveAttribute(
      "aria-label",
      new RegExp(he.calendar.holiday.unanswered),
    );

    // Before export: held, with the finish button disabled.
    await page.goto("/month/export");
    await switchToTestWorker(page);
    await backTo(page, 2);
    await expect(page.locator("h1")).toContainText(he.calendar.monthNames[5]);
    await expect(page.locator('[data-block="unansweredHoliday"]')).toBeVisible();
    await expect(page.locator("[data-finish]")).toBeDisabled();
    await page.screenshot({
      path: "test-results/holiday-unanswered-blocks-export.png",
      fullPage: true,
    });

    // Answered on the calendar, where the one fact a month records about a
    // holiday is recorded (item 9).
    await page.goto("/");
    await switchToTestWorker(page);
    await backTo(page, 3);
    await page.locator(`[data-date="${CANDIDATE_IN_JUNE}"]`).click();
    await page
      .getByRole("button", { name: he.calendar.holiday.no("female"), exact: true })
      .click();
    await settled(page);

    // After: the block is gone. "They did not work it" clears it as well as
    // "they did" — what is required is an answer, not a particular one.
    await page.goto("/month/export");
    await switchToTestWorker(page);
    await backTo(page, 2);
    await expect(page.locator("h1")).toContainText(he.calendar.monthNames[5]);
    await expect(page.locator('[data-block="unansweredHoliday"]')).toHaveCount(0);
  });

  /**
   * **A holiday on their rest day is explained where it is chosen, and spends
   * nothing from the nine** (specs.md item 9, settled with the user on
   * 2026-09-12).
   *
   * Independence Day, Saturday 15 August 2026, is on their Indian list and them
   * rest day is Saturday. What this would catch is the family watching the
   * quota not move with no reason given, and reading it as a broken screen.
   */
  test("a row's name is drawn at the same edge as its own date", async ({
    page,
  }) => {
    await useHousehold(page, "nameedge");
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);

    // Both names are Latin inside a right-to-left row, which is the case a
    // left-to-right wrapper flips: the name goes to the far edge while its own
    // date stays at the near one. Measured on a chosen row as well as an
    // unchosen one, because the two disagreed — the name moved 250px sideways
    // when the row gained its controls.
    for (const [date, chosen] of [
      [CANDIDATE_IN_JUNE, false],
      [WORKED_HOLIDAY, true],
    ] as const) {
      await expect(holidayRow(page, date).getByRole("checkbox")).toHaveAttribute(
        "aria-checked",
        String(chosen),
      );
      const name = await textRightEdge(page, date, "holiday-name");
      const written = await textRightEdge(page, date, "holiday-date");
      expect(Math.abs(name - written)).toBeLessThan(1);
    }
  });

  test("a holiday on her rest day is explained, and the quota does not move", async ({
    page,
  }) => {
    await useHousehold(page, "restday");
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);

    const saturday = holidayRow(page, SATURDAY_HOLIDAY);
    await expect(saturday.locator('[data-role="holiday-on-rest-day"]')).toContainText(
      he.holidays.row.onRestDay(SATURDAY),
    );

    await tick(page, SATURDAY_HOLIDAY);
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(SEEDED_CHOSEN),
    );
    // Chosen, and still no more of the nine spent than before it.
    await expect(saturday.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("a holiday taken as half a day is paid half (item 10)", async ({
    page,
  }) => {
    await useHousehold(page, "half");

    // Before: April's worked holiday is paid at the whole rest-day rate, which
    // is Part 4's ₪426.35.
    await page.goto("/");
    await switchToTestWorker(page);
    await backTo(page, 5);
    await expect(page.locator(`[data-date="${WORKED_HOLIDAY}"]`)).toBeVisible();
    await openPayslipMonthsBack(page, 5);
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
    await openPayslipMonthsBack(page, 5);
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
    // refusing it here says so while they are looking at the date.
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

  /**
   * The gesture that undoes a choice — the other half of the tick, and the only
   * way a day taken by mistake is given back.
   *
   * Scenario: the demo worker holds the seed's three chosen days of them nine. A
   * fourth is chosen, taking them to four, and then unchosen again.
   *
   * Expected: the quota reads four while it is chosen and three again after,
   * the row goes back to `data-chosen="false"`, and June's calendar — which
   * drew the holiday the moment it was chosen — stops drawing it. Three and
   * four are the seed's own count against item 10's nine and are not read off
   * the screen.
   *
   * **What it would catch**: an unchoose that clears the row but leaves the
   * span, so the day is still drawn on the month and still spends one of the
   * nine while the picker shows it free — the quota and the calendar would then
   * disagree, and the family would lose a holiday they can no longer see; and
   * an unchoose that takes a different span than the one unticked, which the
   * calendar assertion catches because only this date was ever chosen here.
   */
  test("gives a chosen day back, in the quota and on the calendar (item 10)", async ({
    page,
  }) => {
    await useHousehold(page, "unchoose");
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);

    // Three of nine, as the seed leaves them.
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(SEEDED_CHOSEN),
    );

    await tick(page, CANDIDATE_IN_JUNE);
    await expect(holidayRow(page, CANDIDATE_IN_JUNE)).toHaveAttribute(
      "data-chosen",
      "true",
    );
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(SEEDED_CHOSEN + 1),
    );

    // Drawn on June's calendar, which is what being chosen means (item 9).
    await page.goto("/");
    await switchToTestWorker(page);
    await backTo(page, 3);
    await expect(
      page.locator(`[data-date="${CANDIDATE_IN_JUNE}"]`),
    ).toContainText(he.calendar.marks(SATURDAY).holiday);

    // And given back.
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);
    await tick(page, CANDIDATE_IN_JUNE);

    await expect(holidayRow(page, CANDIDATE_IN_JUNE)).toHaveAttribute(
      "data-chosen",
      "false",
    );
    await expect(page.locator("[data-quota]")).toContainText(
      formatDays(SEEDED_CHOSEN),
    );
    await expect(
      page.locator('[data-quota-state="incomplete"]'),
    ).toContainText(he.holidays.quota.incomplete);

    // **The calendar is the half that matters**: a day left drawn there is a
    // day the month still pays for, whatever the picker says.
    await page.goto("/");
    await switchToTestWorker(page);
    await backTo(page, 3);
    await expect(
      page.locator(`[data-date="${CANDIDATE_IN_JUNE}"]`),
    ).not.toContainText(he.calendar.marks(SATURDAY).holiday);
    await page.screenshot({
      path: "test-results/holidays-unchosen.png",
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
    await page.goto("/");
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
    await openPayslipMonthsBack(page, 5);
    await expect(row(page, "holidaysWorked")).toHaveCount(0);
  });
});

test.describe("a move once the year's list is in force (specs.md item 10)", () => {
  // The `filed` seed is the demo with the test worker's January to April 2026
  // confirmed (`seed.ts`), so 2026's list is in force and a move is an
  // amendment: it asks when it was agreed and why, refuses a confirmed month,
  // and is listed on their page. The dates and their order are read off item 10's
  // own sentence, not off the screen.
  const AGREED = "2026-07-01";
  const NOTE = "סוכם איתה לקראת הנסיעה";

  async function openMove(page: Page, date: string): Promise<void> {
    await page
      .getByRole("button", { name: he.holidays.row.moveLabel(weekdayDayLabel(date)) })
      .click();
  }

  async function submitMove(page: Page, to: string, agreed: string, note: string) {
    await page.getByLabel(he.holidays.add.date, { exact: true }).fill(to);
    await page.locator('[data-field="agreed-on"]').fill(agreed);
    await page.locator('[data-field="amendment-note"]').fill(note);
    await page.getByRole("button", { name: he.holidays.add.moveSubmit, exact: true }).click();
    await settled(page);
  }

  test("asks for the agreement, refuses a confirmed month, and is listed on her page", async ({
    page,
  }) => {
    await page.context().addCookies([
      { name: "household", value: `filed-e2e-${RUN}-amend`, url: "http://localhost:3000" },
    ]);
    await page.goto("/settings/holidays");
    await switchToTestWorker(page);

    // April is confirmed, so its worked holiday cannot leave it — what this
    // catches is a filed month rewritten by a move on another screen.
    await openMove(page, WORKED_HOLIDAY);
    await expect(page.locator('[data-field="agreed-on"]')).toBeVisible();
    // No agreement and no note: nothing to send.
    await page.getByLabel(he.holidays.add.date, { exact: true }).fill(TYPED_BY_HAND);
    await expect(
      page.getByRole("button", { name: he.holidays.add.moveSubmit, exact: true }),
    ).toBeDisabled();
    await submitMove(page, TYPED_BY_HAND, "2026-03-20", NOTE);
    await expect(page.locator("main").getByRole("alert")).toHaveText(he.holidays.refused.confirmedMonth);
    await expect(holidayRow(page, WORKED_HOLIDAY)).toHaveAttribute("data-chosen", "true");

    // August is a draft. Agreed after the day it would land on: refused.
    await page.getByRole("button", { name: he.holidays.add.cancel }).click();
    await openMove(page, CHOSEN_WITH_NO_NAME);
    await submitMove(page, TYPED_BY_HAND, "2026-08-01", NOTE);
    await expect(page.locator("main").getByRole("alert")).toHaveText(he.holidays.refused.agreedOn);

    // Agreed before both: the move is made.
    await submitMove(page, TYPED_BY_HAND, AGREED, NOTE);
    await expect(holidayRow(page, CHOSEN_WITH_NO_NAME)).toHaveCount(0);
    await expect(holidayRow(page, TYPED_BY_HAND)).toHaveAttribute("data-chosen", "true");

    // And kept, so the list as first agreed can be read back.
    await page.goto("/workers/worker-2");
    const listed = page.locator(`[data-amendment="${CHOSEN_WITH_NO_NAME}"]`);
    await expect(listed).toHaveCount(1);
    await expect(listed).toContainText(NOTE);
    await listed.scrollIntoViewIfNeeded();
    await listed.screenshot({ path: "test-results/worker-holiday-amendment.png" });
  });
});

/**
 * **A picker opened before the year's list was in force, used after it was.**
 *
 * The test above drives the amendment through a household where a month is
 * already confirmed, so the panel draws its two fields and the family fills
 * them. This is the other case, and it is not a crafted request: whether a move
 * is an amendment is decided on the *server*, when the page is rendered
 * (`amending`), and a picker rendered before any month of the year was
 * confirmed draws no agreement fields at all. Confirm a month after that, and
 * the panel still on screen sends a move with no amendment on it.
 *
 * Scenario, in one session and two tabs, which is how a family meets it — the
 * picker is a screen you leave open while you work through the month:
 *
 *  1. Tab A opens the picker on a household where nothing is confirmed. The
 *     move panel has no `agreed on` field, because no month is filed yet.
 *  2. Tab B walks the ordinary export flow and confirms July, which puts 2026's
 *     list in force.
 *  3. Tab A, untouched and unreloaded, moves a holiday.
 *
 * Expected: the move is refused, in words, and the holiday has not moved.
 *
 * **What it would catch**: the server-side check dropped in favour of the
 * disabled button, which is a client guard on a page that can go stale — the
 * move would then be written with no agreement behind it, which is exactly what
 * item 10 requires one for; and the refusal raised but not drawn, which leaves
 * the family pressing a button that silently does nothing.
 *
 * **Two tabs and not two accounts.** Nothing here races: tab B finishes before
 * tab A is touched. The staleness is the whole subject, and it is the ordinary
 * kind — a page that was correct when it was drawn.
 */
test.describe("a move from a picker drawn before the list was in force (item 10)", () => {
  test("is refused for want of the agreement, and the holiday stays put", async ({
    context,
  }) => {
    const label = `demo-e2e-${RUN}-stale-picker`;
    await context.addCookies([
      { name: "household", value: label, url: "http://localhost:3000" },
    ]);

    // --- Tab A: the picker, drawn while nothing is confirmed ----------------
    const picker = await context.newPage();
    await picker.goto("/settings/holidays");
    await switchToTestWorker(picker);
    await picker
      .getByRole("button", {
        name: he.holidays.row.moveLabel(weekdayDayLabel(WORKED_HOLIDAY)),
      })
      .click();
    // No month of 2026 is filed, so this is not an amendment yet and the panel
    // says so by drawing neither field.
    await expect(picker.locator('[data-field="agreed-on"]')).toHaveCount(0);
    await expect(picker.locator('[data-field="amendment-note"]')).toHaveCount(0);

    // --- Tab B: the ordinary export flow, which puts the list in force ------
    const exporting = await context.newPage();
    await exporting.goto("/month/export");
    await switchToTestWorker(exporting);
    // July, the recuperation month, as `before-export.spec.ts` confirms it.
    for (let step = 0; step < 2; step += 1) {
      await exporting
        .getByRole("button", { name: he.calendar.previousMonth })
        .click();
    }
    const questions = exporting.locator("[data-question]");
    const count = await questions.count();
    for (let index = 0; index < count; index += 1) {
      await questions
        .nth(index)
        .getByRole("button", { name: he.beforeExport.questions.no, exact: true })
        .click();
    }
    await exporting.locator("[data-finish]").click();
    await expect(exporting.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(exporting.locator("[data-confirmed]")).toContainText(
      he.beforeExport.finish.done,
    );
    await exporting.close();

    // --- Tab A again, untouched: the move it was about to make --------------
    await picker.getByLabel(he.holidays.add.date, { exact: true }).fill(TYPED_BY_HAND);
    await picker
      .getByRole("button", { name: he.holidays.add.moveSubmit, exact: true })
      .click();
    await expect(picker.locator('[aria-busy="true"]')).toHaveCount(0);

    await expect(picker.locator("main").getByRole("alert")).toHaveText(
      he.holidays.refused.amendmentNeeded,
    );
    await picker.screenshot({
      path: "test-results/holidays-amendment-needed.png",
      fullPage: true,
    });

    // **And nothing moved.** Read on a fresh load, so this is the store's
    // answer and not the stale page's.
    await picker.reload();
    await expect(holidayRow(picker, WORKED_HOLIDAY)).toHaveAttribute(
      "data-chosen",
      "true",
    );
    await expect(holidayRow(picker, TYPED_BY_HAND)).toHaveCount(0);
    await picker.close();
  });
});

test.describe("the picker's closing button goes back to the screen that opened it", () => {
  const picker = 'a[href^="/settings/holidays"]';
  const back = (at: Page) => at.locator('[data-role="picker-back"]');

  test("opened from the settings, it goes back to the settings, after stepping a year", async ({
    page,
  }) => {
    await useHousehold(page, "back-settings");
    await openSettingsForTestWorker(page);
    await page.locator("main").locator(picker).first().click();
    await expect(page).toHaveURL(/\/settings\/holidays\?/);

    // Stepping the year is a navigation of its own, and must not lose the way back.
    await page.getByRole("link", { name: he.holidays.previousYear }).click();
    await expect(page).toHaveURL(/year=\d{4}/);
    await expect(back(page)).toHaveText("חזרה להגדרות");
    await back(page).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("opened from an alert, it goes back to the alerts", async ({ page }) => {
    await useHousehold(page, "back-alerts");
    await page.goto("/alerts");
    // The test worker has three of nine chosen, which is a blockage here.
    await page.locator('[data-role="alert"]').locator(picker).first().click();
    await expect(page).toHaveURL(/from=%2Falerts/);
    await expect(back(page)).toHaveText("חזרה להתראות");
    await back(page).click();
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(page.locator("h1")).toHaveText(he.alerts.title);
  });

  test("an address naming anywhere else goes back to the settings", async ({ page }) => {
    await useHousehold(page, "back-elsewhere");
    await page.goto("/settings/holidays?from=https%3A%2F%2Fexample.com");
    await expect(back(page)).toHaveAttribute("href", "/settings");
    await expect(back(page)).toHaveText("חזרה להגדרות");
  });
});
