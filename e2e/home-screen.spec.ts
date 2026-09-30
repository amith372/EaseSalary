import { expect, test, type Page } from "@playwright/test";
import { TEST_WORKER_NAME, useHousehold, switchToTestWorker, openPaymentSections, TODAY } from "./household";
import { he } from "../src/lib/i18n/he";
import { monthLabel } from "../src/lib/dateLabels";
import { monthOf, SATURDAY } from "../src/lib/dates";
import { formatAgorot, formatDays } from "../src/lib/money";

/**
 * The opening screen, through the browser: how it is laid out, the month that
 * has not ended yet (specs.md item 21), the month the store had no record of,
 * and the known case of Part 4 entered as a user enters it.
 *
 * **Why all of that is one file.** It is one screen and one calculation path.
 * Until 2026-09-16 the second half of this lived in `month-screen.spec.ts`,
 * against a `/month` that drew the same calendar one link further in while this
 * screen was a fixture of it; the wiring moved here and that screen went, so the
 * two specs became one. Rule 10 is explicit that a flow assembled out of unit
 * tests that each pass is a flow nobody has performed. The engine's answer to
 * August 2025 is already checked to the agora in `august-2025.test.ts`; what is
 * checked here is everything between a click and that answer — the calendar's
 * marking, the holiday's one question, the payments screen's advance panel, the
 * server action, the store, the replay, and the figures then drawn.
 *
 * **What only a browser can check.** `specs.md` Part 5 is explicit that
 * right-to-left failures are quiet: a browser reorders mixed runs of Hebrew and
 * Latin text, and the calendar is reversed twice over — the week begins on
 * Sunday *and* Sunday sits on the right, so a component built for a
 * left-to-right week shifts every day by one and looks entirely plausible. No
 * unit test sees any of that, because none of it happens until a browser lays
 * the page out.
 *
 * **Every expected figure comes from `specs.md` and none from the engine.** The
 * four totals below are quoted from Part 4 in agorot and rendered for comparison
 * by `formatAgorot`, which is the same function the screen uses — the *figure*
 * is the spec's and only its punctuation is shared. ₪8,879.40 is the opening
 * figure derived on paper in `august-2025.fixture.ts`.
 *
 * **Hebrew comes from `he.ts` and is never typed here.** Every user-facing
 * string lives in one translations file (`CLAUDE.md`), so a spec that hardcoded
 * one would be a second copy of it — and would break on a wording change that
 * broke nothing.
 *
 * **Each test gets its own store.** The dev repository is a module singleton
 * keyed by the `household` cookie, and a name no seed has opened re-seeds
 * (`src/lib/store.ts`) — so a spec that sweeps a range and opens a month leaves
 * nothing behind in the household anybody else is looking at, and can assert the
 * *before* state on its second run as truthfully as on its first.
 */

/** Part 4's four totals, in agorot, quoted and not computed. */
const PART_4 = {
  columnE: 674765, // ₪6,747.65 — base plus the rest-eve supplement
  columnF: 255810, // ₪2,558.10 — four rest days and two holidays
  gross: 930575, // ₪9,305.75
  net: 730575, // ₪7,305.75
  instalment: 200000, // ₪2,000 a month against a ₪10,000 advance
};

/** ₪8,879.40 — August 2025 with an empty calendar, derived on paper in
 * `august-2025.fixture.ts` and therefore an independent figure here too. */
const PLAIN_GROSS = 887940;

/** The three figures Part 4 states that the rows above are built from: the
 * minimum wage August 2025 is valued at, the ₪500 across five rest-eves worked,
 * and the ₪426.35 a rest day and a worked holiday are each paid at. */
const BASE = 624765;

/** The minimum wage in force from 1.4.2026, sourced to the family's own 2026
 * workbook in `datedRates.ts`. A month opened after that date takes it. */
const IN_FORCE_2026 = 644385;
const REST_EVE_TOTAL = 50000;
const REST_DAY_RATE = 42635;

/** The value drawn on one row, by the row's own key rather than by the Hebrew
 * beside it. */
function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

/** The "days used this month" hint on a balance row in the rail, which is where
 * a mark's effect on the balance is legible as a whole number rather than as a
 * running fraction. */
function daysUsed(count: number): string {
  return `${he.sheet.reporting.daysUsed}: ${formatDays(count)}`;
}

/** The illustrated band over the calendar. `data-season` is the whole mechanism
 * that sets its scene, so the attribute is what a test reads (`CalendarBand`). */
function band(page: Page) {
  return page.locator("[data-season]");
}

/** Steps the calendar back until it is showing a given month, by the month's own
 * name and never by a count of clicks — a count is right only for one `today`. */
async function stepBackTo(page: Page, month: { year: number; month: number }): Promise<void> {
  const back = page.getByRole("button", { name: he.calendar.previousMonth });
  // **Inside the band, where the stepper draws it**, and never anywhere on the
  // page: the blocker strip above the calendar names the months it is waiting
  // on, so a page-wide match on "אפריל 2026" is satisfied by an alert while the
  // calendar is still showing September — and the walk then never takes a step.
  const showing = band(page).getByText(monthLabel(month)).first();
  // Bounded, so a step that stops working fails here rather than spinning: the
  // demo's earliest month is May 2025 and the furthest walk below is ten steps.
  for (let step = 0; step < 24 && !(await showing.isVisible()); step += 1) {
    await back.click();
  }
  await expect(showing).toBeVisible();
}

/** Unfold the picker's second row — part of a day and a note. */
async function openSecondRow(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: new RegExp(`^${he.calendar.picker.more.noteOnly}`) })
    .click();
}

/** Sweep a range on the calendar and answer the picker: click the first day,
 * click the last, choose what the range means. Both ends are ISO dates, because
 * a range is ordered by date and never by screen position (`CLAUDE.md`). */
async function sweep(
  page: Page,
  from: string,
  to: string,
  kind: "vacation" | "sick" | "freeRestDay",
  // The picker's second row, chosen before the kind chip commits the mark
  // (specs.md items 5, 7). Omitted is a whole day with no note, which is what
  // an ordinary sweep is.
  second?: { half?: boolean; note?: string },
): Promise<void> {
  await page.locator(`[data-date="${from}"]`).click();
  await page.locator(`[data-date="${to}"]`).click();
  // The second row starts folded behind one button, and is opened only when
  // the sweep chooses something on it.
  if (second !== undefined) await openSecondRow(page);
  if (second?.half) {
    await page
      .getByRole("button", { name: he.calendar.picker.part.half, exact: true })
      .click();
  }
  if (second?.note !== undefined) {
    await page.getByLabel(he.calendar.picker.note.label, { exact: true }).fill(second.note);
  }
  const marks = he.calendar.marks(SATURDAY);
  await page.getByRole("button", { name: marks[kind], exact: true }).click();
}

test.describe("the opening screen", () => {
  // **A seeded household of this file's own**, as every other spec here opens
  // one. Since the Postgres repository landed, a request with no `household`
  // cookie reads the signed-in account's real household — which holds no
  // worker, so the screen this file is about is correctly not drawn at all
  // (`src/lib/store.ts`).
  test.beforeEach(async ({ page }) => {
    await useHousehold(page, "demo", "the-opening-screen");
  });

  test("renders right-to-left, in Hebrew, with the calendar's week starting on Sunday", async ({
    page,
  }) => {
    await page.goto("/");

    // The document's own direction. A page that lost this reads as a foreign
    // document to the family, and every logical property in the stylesheet
    // resolves the wrong way at once.
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");

    // Sunday sits on the right. Checked by geometry rather than by DOM order,
    // because the two can disagree — a grid laid out left-to-right inside an
    // rtl document puts Sunday's *element* first and paints it on the left,
    // which is exactly the failure Part 5 names and the one a snapshot of the
    // markup would miss.
    const sunday = page.getByText(he.calendar.dayNames[0], { exact: true }).first();
    const saturday = page.getByText(he.calendar.dayNames[6], { exact: true }).first();
    const sundayBox = await sunday.boundingBox();
    const saturdayBox = await saturday.boundingBox();
    expect(sundayBox, "the weekday header row should be visible").not.toBeNull();
    expect(saturdayBox).not.toBeNull();
    expect(sundayBox!.x).toBeGreaterThan(saturdayBox!.x);
  });

  test("opens the calendar on the month today falls in", async ({ page }) => {
    await page.goto("/");
    // Today is worked out here from the clock and not read off the screen, so a
    // calendar pinned to a fixed month — which it was, to August 2026 — fails
    // on every day outside that month. The demo household has a record of the
    // current month, which is what `openingMonthOf` opens on.
    const today = TODAY;
    await expect(page.locator(`[data-date="${today}"]`)).toBeVisible();
    await expect(page.getByText(monthLabel(monthOf(today))).first()).toBeVisible();
  });

  /**
   * **The band's season is the shown month's and never today's.**
   *
   * The scene is set by `data-season` on the band and nothing else
   * (`CalendarBand`), so the attribute is the whole wiring and is what this
   * reads. The four expected values come from `DESIGN.md`'s own rule — Israel's
   * seasons, where summer runs June to September and autumn is October and
   * November — and not from `seasonOf`, which is pinned separately in
   * `src/lib/season.test.ts`. What is unproven without this is the wiring
   * between them.
   *
   * **What it would catch**: a band that took its season from the clock instead
   * of from the month on screen. Every assertion below is made on the same day —
   * the suite's pinned 2026-09-18 — so a clock-reading band answers "summer"
   * three times over while the calendar plainly shows April, December and
   * November. That is `CLAUDE.md`'s "nothing reads the clock during a render",
   * and on the built screen it would be invisible until a family correcting
   * March in July was shown a summer band.
   */
  test("draws the band in the season of the month being shown", async ({
    page,
  }) => {
    await page.goto("/");

    // The month today falls in. September is summer here by any thermometer,
    // which is the one place Israel's seasons and the astronomical ones part.
    await expect(band(page)).toHaveAttribute("data-season", "summer");

    // Stepped back only, so the walk is one direction and each month is reached
    // from the one before it.
    const months = [
      { year: 2026, month: 4, season: "spring" },
      { year: 2025, month: 12, season: "winter" },
      { year: 2025, month: 11, season: "autumn" },
    ];

    for (const month of months) {
      await stepBackTo(page, month);
      await expect(band(page)).toHaveAttribute("data-season", month.season);
    }
  });

  test("never lets the page scroll sideways", async ({ page }) => {
    await page.goto("/");
    // A horizontal scrollbar on an rtl page is how a mixed-script run that
    // escaped its container announces itself. It is invisible in a screenshot
    // taken at a wider viewport, so it is measured rather than looked at.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("shows the month's figures with the digits in the right order", async ({
    page,
  }) => {
    await page.goto("/");
    // Amounts carry `translate="no"` and sit inside their own element, so a
    // translated identifier cannot become a wrong identifier (`CLAUDE.md`).
    // What is asserted is the rendered text: an amount whose thousands
    // separator or minus sign has been reordered by the bidi algorithm fails
    // here and nowhere else.
    const amounts = page.locator('[translate="no"]');
    await expect(amounts.first()).toBeVisible();
    for (const text of await amounts.allInnerTexts()) {
      if (!/\d/.test(text)) continue;
      expect(text, `"${text}" should not have a stray directional mark`).not.toMatch(
        /[‪-‮]/,
      );
    }
  });

  test("shows shekels rather than the canvas's placeholders", async ({ page }) => {
    // **The whole point of the port of 2026-09-16.** This screen drew
    // `homeFixtures`, whose every amount was `null`, so the money card said
    // "[סכום]" on every row and looked finished. The assertion is that the
    // placeholder is gone from the card *and* that a real figure stands there:
    // either half alone would pass on an empty card.
    await page.goto("/");
    await switchToTestWorker(page);
    const card = page.locator('[data-row="net"]');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(he.placeholder.amount);
    await expect(card).toContainText("₪");
  });
});

test.describe("a month that has not ended yet (specs.md item 21)", () => {
  test("takes the facts, and raises no warning for it", async ({ page }) => {
    // The demo household's months run through September 2026, so the screen
    // opens on the month still running. Item 21: it can be filled in and it
    // is exported with a warning — the warning is the export's, and this
    // screen does not repeat it, since a running month is its ordinary state
    // (the user, 2026-09-16).
    await useHousehold(page, "demo", "item21");
    await page.goto("/");
    await switchToTestWorker(page);

    await expect(page.locator("#warning-monthNotEnded")).toHaveCount(0);

    // The half a warning could quietly have replaced: the month is still
    // calculated. A figure is drawn, and marking a day changes it.
    await expect(row(page, "net")).toBeVisible();
    await expect(row(page, "worker-2-vacation-balance")).toContainText(daysUsed(0));
    // 14.9.2026 is a Monday and 16.9.2026 a Wednesday — neither the rest day nor
    // the rest-eve, so three whole days come off the balance (item 7).
    await sweep(page, "2026-09-14", "2026-09-16", "vacation");
    await expect(row(page, "worker-2-vacation-balance")).toContainText(daysUsed(3));
  });
});

test.describe("a month after the current one", () => {
  test("keeps its marks and is not valued until it begins", async ({
    page,
  }) => {
    // October 2026 is after the current month, so it is not valued at all
    // (specs.md item 21): the money card says so in one sentence rather than
    // showing a month of zeroes — before a mark and after one alike.
    await useHousehold(page, "demo", "future");
    await page.goto("/");
    await switchToTestWorker(page);
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();

    await expect(page.getByText(he.month.future)).toBeVisible();
    await expect(row(page, "net")).toHaveCount(0);

    // Marking ahead is allowed (item 21). 5.10.2026 is a Monday and 8.10.2026 a
    // Thursday, so no rest day falls inside and all four days take the mark.
    await sweep(page, "2026-10-05", "2026-10-08", "vacation");

    const vacation = he.calendar.marks(SATURDAY).vacation;
    for (const date of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]) {
      await expect(page.locator(`[data-date="${date}"]`)).toHaveAccessibleName(
        new RegExp(`, ${vacation}$`),
      );
    }
    await expect(page.getByText(he.month.future)).toBeVisible();
    await expect(row(page, "net")).toHaveCount(0);

    // **No rate is ever hardcoded** (`CLAUDE.md`): September is valued at the
    // minimum wage in force during it — ₪6,443.85, the row dated 1.4.2026 and
    // sourced to the family's own 2026 workbook. Read off the payslip, because
    // the opening screen summarises and the sheet itemises (item 5).
    await page.goto("/month/payslip?month=2026-09");
    await switchToTestWorker(page);
    await expect(row(page, "base")).toContainText(formatAgorot(IN_FORCE_2026));
  });
});

test.describe("a mark goes to the store", () => {
  test("survives a reload", async ({ page }) => {
    // The failure this catches is a mark held in the browser and never saved:
    // the screen would look right until the page was reloaded, which is the one
    // thing no unit test does.
    //
    // The current month, which the screen opens on. 7.9.2026 is a Monday and
    // 10.9.2026 a Thursday, so no rest day and no rest-eve falls inside and
    // four whole days come off the balance (item 7).
    await useHousehold(page, "demo", "reload");
    await page.goto("/");
    await switchToTestWorker(page);
    await sweep(page, "2026-09-07", "2026-09-10", "vacation");
    await expect(row(page, "worker-2-vacation-balance")).toContainText(daysUsed(4));

    await page.reload();
    // **The worker survives the reload as well** (`build_plan.md` stage 3):
    // the switcher's choice is a cookie the layout reads, so the page comes
    // back on them without being chosen again. Asserted and not stepped to —
    // stepping here would pass whether or not the choice survived.
    await expect(
      page.getByRole("group", { name: he.header.workerSwitcher.showing }),
    ).toContainText(TEST_WORKER_NAME);
    await expect(row(page, "worker-2-vacation-balance")).toContainText(daysUsed(4));
  });
});

/**
 * The home and payments screens open on the current month, and the known case's only month is
 * August 2025 — the worker's first month (specs.md item 6). Stepping back until
 * the arrow refuses lands on it, whatever today is.
 */
async function backToFirstMonth(page: Page): Promise<void> {
  const back = page.getByRole("button", { name: he.calendar.previousMonth });
  while (await back.isEnabled()) await back.click();
  await expect(page.getByText(monthLabel({ year: 2025, month: 8 })).first()).toBeVisible();
}

test.describe("the known case of Part 4, entered through the screen", () => {
  test("reaches ₪9,305.75 and ₪7,305.75 from three gestures", async ({
    page,
  }) => {
    await useHousehold(page, "known", "part4");
    await page.goto("/");
    await backToFirstMonth(page);

    // **The starting figure, before anything is entered.** August 2025 with an
    // empty calendar is ₪8,879.40 — five rest days all worked and five
    // rest-eves. Asserting it first is what makes the three figures below moves
    // rather than coincidences.
    // **The bottom row, not a "gross" row.** A month that withholds nothing and
    // transfers nothing closes on one figure rather than three identical ones
    // (specs.md Part 5), so before the advance is entered the month's total is
    // drawn as סך הכל and there is no ברוטו row above it.
    await expect(row(page, "net")).toContainText(formatAgorot(PLAIN_GROSS));
    await expect(row(page, "gross")).toHaveCount(0);
    await page.screenshot({
      path: "test-results/known-case-before.png",
      fullPage: true,
    });

    // Gesture one: the free Saturday of the 16th (Part 4).
    await sweep(page, "2025-08-16", "2025-08-16", "freeRestDay");

    // Gestures two and three: the two holidays, each answered "they worked it".
    // The dates are the year's and arrive drawn; whether they worked one is the
    // single fact a month records about it (item 9).
    for (const date of ["2025-08-19", "2025-08-21"]) {
      await page.locator(`[data-date="${date}"]`).click();
      await page
        .getByRole("button", {
          name: he.calendar.holiday.yes("female"),
          exact: true,
        })
        .click();
    }

    // Part 4's third total, on the screen the three gestures were made on.
    await expect(row(page, "net")).toContainText(formatAgorot(PART_4.gross));

    await page.screenshot({
      path: "test-results/known-case-marked.png",
      fullPage: true,
    });

    // **Part 4's figures, row by row, to the agora and with no tolerance** —
    // read off the payslip, because the opening screen summarises and the sheet
    // itemises (item 5). Column E is the base plus the supplement: ₪6,247.65 +
    // ₪500 = ₪6,747.65. Column F is Part 4's own "two holidays and four
    // Saturdays at ₪426.35": four rest days at that rate and two holidays at it,
    // ₪1,705.40 + ₪852.70 = ₪2,558.10. Every one of those numbers is quoted from
    // Part 4 and the only arithmetic here is its own multiplication, written out
    // so it can be checked by eye.
    //
    // **The two screens agreeing is itself the assertion** (`CLAUDE.md` rule
    // 12): the ₪9,305.75 above and the lines below are one engine result shown
    // twice, and a summary that drifted from its own itemisation would fail here.
    await page.goto("/month/payslip?month=2025-08");
    await expect(row(page, "base")).toContainText(formatAgorot(BASE));
    await expect(row(page, "restEveSupplement")).toContainText(
      formatAgorot(REST_EVE_TOTAL),
    );
    expect(BASE + REST_EVE_TOTAL).toBe(PART_4.columnE);

    await expect(row(page, "restDays")).toContainText(
      formatAgorot(4 * REST_DAY_RATE),
    );
    await expect(row(page, "holidaysWorked")).toContainText(
      formatAgorot(2 * REST_DAY_RATE),
    );
    expect(4 * REST_DAY_RATE + 2 * REST_DAY_RATE).toBe(PART_4.columnF);

    await expect(row(page, "net")).toContainText(formatAgorot(PART_4.gross));

    // The fourth total needs the advance instalment, which is recorded where
    // everything that *records* a payment is recorded (item 5).
    await page.goto("/payments");
    await backToFirstMonth(page);
    await openPaymentSections(page);
    await page
      .getByRole("button", { name: he.month.actions.advances.repayLabel(1) })
      .click();
    // By role, because "סכום" is also the word in every override button's label
    // and a label lookup alone matches five things.
    await page
      // `exact`, because the income-tax card beside this one is labelled
      // "סכום אחר, אם חושב אחרת" and an accessible name matches by
      // substring: without it this resolves to two fields.
      .getByRole("textbox", {
        name: he.month.actions.advances.amount,
        exact: true,
      })
      .fill(String(PART_4.instalment / 100));
    await page
      .getByRole("button", {
        name: he.month.actions.advances.submitRepay,
        exact: true,
      })
      .click();

    // **Now three levels are drawn and not one**, because the instalment changes
    // what is transferred: the month's total stands above the advance and the
    // transfer below it (Part 5). Both of Part 4's last two figures are on the
    // screen at once, which is what makes ₪7,305.75 readable as ₪9,305.75 less
    // ₪2,000 rather than as a number the application produced.
    await page.goto("/");
    await backToFirstMonth(page);
    await expect(row(page, "afterWithholding")).toContainText(
      formatAgorot(PART_4.gross),
    );
    await expect(row(page, "net")).toContainText(formatAgorot(PART_4.net));
    await page.screenshot({
      path: "test-results/known-case-after.png",
      fullPage: true,
    });
  });

  test("refuses the deliberately invalid case rather than paying twice", async ({
    page,
  }) => {
    // Part 4's invalid case: the 16th recorded as a Saturday they had off, then
    // the same date marked again. Left unrefused it would pay both the rest-day
    // rate and a second mark's for one day, and the sheet would look ordinary.
    await useHousehold(page, "known", "invalid");
    await page.goto("/");
    await backToFirstMonth(page);
    // ₪8,453.05 — the plain August less one rest day at ₪426.35: ₪6,247.65 plus
    // ₪500 in column E, and four rest days rather than five in column F. Every
    // figure in that sentence is Part 4's, and it is written out so that the
    // number the refusal has to leave untouched is one that can be checked by
    // hand rather than one read off the screen a moment earlier.
    const ONE_REST_DAY_OFF = BASE + REST_EVE_TOTAL + 4 * REST_DAY_RATE;
    expect(ONE_REST_DAY_OFF).toBe(845305);

    await sweep(page, "2025-08-16", "2025-08-16", "freeRestDay");
    await expect(row(page, "net")).toContainText(formatAgorot(ONE_REST_DAY_OFF));

    await sweep(page, "2025-08-16", "2025-08-16", "sick");

    // The refusal is shown in words where it happened, and the figure does not
    // move: a day already carrying a mark takes no second one.
    await expect(
      page.getByText(he.calendar.skipped(SATURDAY).alreadyMarked),
    ).toBeVisible();
    await expect(row(page, "net")).toContainText(formatAgorot(ONE_REST_DAY_OFF));
  });
});

test.describe("half a day of vacation (specs.md items 5, 7)", () => {
  /**
   * September 2026, counted by hand and not read off the screen. The month has
   * 30 days and its Saturdays are the 5th, 12th, 19th and 26th — four of them,
   * because 1 September 2026 is a Tuesday. The standard count is the month's
   * days less its rest days, so 30 − 4 = 26, and nothing the worker takes
   * reduces it (item 5).
   */
  const STANDARD = 26;
  /** A Tuesday, so neither the rest day nor anything that refuses the mark. */
  const HALF_DAY = "2026-09-15";

  test("leaves half a day of the actual count and half a day of the balance", async ({
    page,
  }) => {
    // **The two halves of item 5's own sentence, in one gesture.** "A day taken
    // in part leaves the actual count in that same proportion, so half a
    // vacation day leaves half a day", and item 7 draws it from the balance in
    // the same proportion. A fraction written to the store but read by only one
    // of the two would pass every unit test in the suite and still charge the
    // worker a whole day on the screen they are looking at.
    await useHousehold(page, "demo", "halfday");
    await page.goto("/");
    await switchToTestWorker(page);

    const marks = he.calendar.marks(SATURDAY);

    // The before state, so the figures below are moves and not coincidences.
    await expect(row(page, "workDays")).toContainText(
      `${formatDays(STANDARD)} / ${formatDays(STANDARD)}`,
    );
    await expect(row(page, "worker-2-vacation-balance")).toContainText(daysUsed(0));

    await sweep(page, HALF_DAY, HALF_DAY, "vacation", {
      half: true,
      note: "חצי יום אצל הרופא",
    });

    // The actual count is the standard count less the days not worked, and half
    // a day was not worked: 26 − 0.5 = 25.5. The standard count does not move,
    // which is the half a wrong implementation is likeliest to get wrong — a
    // vacation day that shrank the base would show up here first.
    await expect(row(page, "workDays")).toContainText(
      `${formatDays(STANDARD - 0.5)} / ${formatDays(STANDARD)}`,
    );
    await expect(row(page, "worker-2-vacation-balance")).toContainText(daysUsed(0.5));

    // And the day says so where the user is looking. The cell is filled to half
    // its height and its name carries the words, so the month read back a week
    // later tells a whole vacation day and a half one apart — which the fill
    // alone would do for only some of the people reading it.
    await expect(page.locator(`[data-date="${HALF_DAY}"]`)).toHaveAccessibleName(
      new RegExp(`${marks.vacation}, ${he.calendar.picker.part.half}$`),
    );

    await page.screenshot({
      path: "test-results/half-vacation-day.png",
      fullPage: true,
    });

    // And it went to the store rather than to the browser: the mark a reload
    // forgets is the one failure no unit test can see.
    await page.reload();
    // The chosen worker does not survive a reload, so they are chosen again. What
    // is being checked is the mark, and the mark does.
    await switchToTestWorker(page);
    await expect(row(page, "workDays")).toContainText(
      `${formatDays(STANDARD - 0.5)} / ${formatDays(STANDARD)}`,
    );
    await expect(row(page, "worker-2-vacation-balance")).toContainText(daysUsed(0.5));
  });

  test("is not offered for sickness, for a free rest day, or for a range", async ({
    page,
  }) => {
    // Item 7 gives the part-day to vacation alone among the three marks, and
    // `DaySpan.fraction` is set only on a single-day span. The picker offers no
    // combination the server would refuse, so what this asserts is that the
    // impossible ones are never reachable — a live chip here would store half a
    // sick day, which the tiers count from the spell's own first day (item 8).
    await useHousehold(page, "demo", "halfrefused");
    await page.goto("/");
    await switchToTestWorker(page);

    const marks = he.calendar.marks(SATURDAY);
    const half = page.getByRole("button", {
      name: he.calendar.picker.part.half,
      exact: true,
    });

    // A range of more than one day: the part row is not drawn at all, because
    // half of a three-day range is not a thing the stored shape can say.
    await page.locator(`[data-date="2026-09-14"]`).click();
    await page.locator(`[data-date="2026-09-16"]`).click();
    await expect(half).toHaveCount(0);
    await page.keyboard.press("Escape");

    // One day: the part row is drawn, and choosing half closes the two kinds
    // that are whole days. The rule says so in words beside them.
    await page.locator(`[data-date="${HALF_DAY}"]`).click();
    await page.locator(`[data-date="${HALF_DAY}"]`).click();
    await openSecondRow(page);
    await expect(half).toBeVisible();
    await expect(
      page.getByRole("button", { name: marks.vacation, exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: marks.sick, exact: true }),
    ).toBeEnabled();

    await half.click();
    await expect(
      page.getByText(he.calendar.picker.part.rule(SATURDAY)),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: marks.vacation, exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: marks.sick, exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: marks.freeRestDay, exact: true }),
    ).toBeDisabled();
  });
});

/**
 * The opening screen's outline starts at its own `h1`.
 *
 * **The screen opens straight onto the calendar with no heading of its own**
 * (`DESIGN.md`), so the level goes to whatever leads rather than a heading
 * being added: the blocker strip where it is drawn, then a refused month's
 * card, then the month. Until 2026-09-24 the strip was an `h2` and the month
 * an `h1`, so the outline opened at `צריך לטפל` and reached the `h1` second.
 *
 * **The refused household leads with the strip too**, and that is the whole of
 * what the refusal being one worker's changed: the strip is the household's and
 * the other worker still has things to do, so it is drawn and takes the level,
 * and the card under it is the `h2` it is on every screen that has a strip
 * above it. The card led only while a refusal emptied the strip for everybody.
 *
 * What it catches: a heading added above the calendar without taking the level
 * with it, and two `h1`s on one screen.
 */
test.describe("the opening screen's outline", () => {
  for (const seed of ["demo", "refused"] as const) {
    test(`starts at the h1 on a ${seed} household`, async ({ page }) => {
      await useHousehold(page, seed, "outline");
      await page.goto("/");
      await switchToTestWorker(page);

      const headings = page.locator("h1, h2, h3");
      await expect(headings.first()).toHaveRole("heading", { timeout: 10_000 });
      // The first heading a reader meets is the one that names the screen.
      await expect(page.locator("h1")).toHaveCount(1);
      const first = headings.first();
      await expect(first).toContainText(he.status.needsAttention);
      expect(await first.evaluate((el) => el.tagName)).toBe("H1");
      if (seed === "refused") {
        // Drawn, and one level below the strip that leads.
        const card = page.locator('[data-role="refusal-month"]');
        await expect(card).toBeVisible();
        expect(await card.evaluate((el) => el.tagName)).toBe("H2");
      }
    });
  }
});

/**
 * A day keeps its shape however tall the window is.
 *
 * The grid's rows are `1fr` inside a screen-height column, so until 2026-09-24
 * the day took whatever the window had left: 91×99 at 1440×900 and 91×177 at
 * 1440×1440, the number floating in the middle of an empty rectangle. The cap
 * is on the grid rather than on the row, because a row whose max is a length
 * sizes to its content and would draw a 58px day at every height.
 *
 * What it catches: the cap removed, and a cap put on the row instead — the
 * second of which looks right in the source and is wrong on screen.
 */
test("a day keeps its proportion however tall the window is", async ({
  page,
}) => {
  await useHousehold(page, "demo", "cell-height");
  await page.goto("/");
  await switchToTestWorker(page);

  const day = page.locator("[data-date]").first();
  await expect(day).toBeVisible();

  async function cell(width: number, height: number) {
    await page.setViewportSize({ width, height });
    // The grid re-lays out on a size change and the assertion reads a box.
    await page.waitForTimeout(250);
    const box = await day.boundingBox();
    expect(box).not.toBeNull();
    return { w: Math.round(box!.width), h: Math.round(box!.height) };
  }

  const reference = await cell(1440, 900);
  // Near-square, as the artboard draws it, and not a tall rectangle.
  expect(reference.h).toBeLessThanOrEqual(reference.w + 12);
  for (const height of [800, 1080, 1280, 1440]) {
    const measured = await cell(1440, height);
    expect(measured.w).toBe(reference.w);
    // Within a step of the height it has where the grid has no slack.
    expect(Math.abs(measured.h - reference.h)).toBeLessThanOrEqual(2);
  }
});

/**
 * Back puts the screen where it was.
 *
 * `<main>` is the scroller from `md` up, which is what keeps the bar on screen
 * and is why the browser's own restoration — which acts on the document — had
 * nothing to restore: until 2026-09-24, following a blocker from the foot of
 * this screen and coming back landed at the top of it.
 *
 * What it catches: the restoration removed, and a restoration that fires on a
 * fresh navigation too, which would undo an address naming an anchor.
 */
test("Back returns to the place the screen was left at", async ({ page }) => {
  await useHousehold(page, "demo", "scroll-back");
  await page.goto("/");
  await switchToTestWorker(page);
  await page.setViewportSize({ width: 1280, height: 720 });

  const main = page.locator("#main");
  await main.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const left = await main.evaluate((el) => el.scrollTop);
  // The screen has to be tall enough for the question to mean anything.
  expect(left).toBeGreaterThan(100);

  // **A link at the foot and not the blocker strip at the top**: Playwright
  // scrolls a target into view before it presses it, so pressing the strip
  // would scroll this screen back to the top and the question would answer
  // itself.
  await page.locator('a[href="/month/payslip"]').first().click();
  await expect(page).toHaveURL(/month\/payslip/);

  await page.goBack();
  await expect(main).toBeVisible();
  await expect
    .poll(async () => main.evaluate((el) => el.scrollTop), { timeout: 5000 })
    .toBeGreaterThan(left - 40);
});
