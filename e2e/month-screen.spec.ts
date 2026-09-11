import { expect, test, type Page } from "@playwright/test";
import { switchToTestWorker } from "./household";
import { he } from "../src/lib/i18n/he";
import { formatAgorot, formatDays } from "../src/lib/money";
import { SATURDAY } from "../src/lib/dates";

/**
 * The month screen through the browser: the month that has not ended yet
 * (specs.md item 21), the month the store had no record of, and the known case
 * of Part 4 entered as a user enters it.
 *
 * **Why these three are one file.** They are one screen and one calculation
 * path, and rule 9 is explicit that a flow assembled out of unit tests that each
 * pass is a flow nobody has performed. The engine's answer to August 2025 is
 * already checked to the agora in `august-2025.test.ts`; what is checked here is
 * everything between a click and that answer — the calendar's marking, the
 * holiday's one question, the payments screen's advance panel, the server
 * action, the store, the replay, and the figures the preview then draws.
 *
 * **Every expected figure comes from `specs.md` and none from the engine.** The
 * four totals below are quoted from Part 4 in agorot and rendered for comparison
 * by `formatAgorot`, which is the same function the screen uses — the *figure*
 * is the spec's and only its punctuation is shared. ₪8,879.40 is the opening
 * figure derived on paper in `august-2025.fixture.ts`.
 *
 * **Each test gets its own store.** The dev repository is a module singleton
 * keyed by the `household` cookie, and a suffix after the seed name opens a
 * fresh one (`src/lib/dev/store.ts`) — so a spec that sweeps a range and opens a
 * month leaves nothing behind in the household anybody else is looking at, and
 * can assert the *before* state on its second run as truthfully as on its first.
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

/**
 * The run's own id, so a household name is never reused.
 *
 * **The store outlives the test run and not the server.** It is a module
 * singleton keyed by the cookie's value (`src/lib/dev/store.ts`), so a fixed
 * name would hand the second run of this file the marks the first run made —
 * and the "before" assertions would then be asserting the previous run. The
 * dev server sheds every one of these on restart, which is the whole of their
 * lifetime.
 */
const RUN = Date.now().toString(36);

/** A store of this test's own: the seed is the part before the first hyphen and
 * everything after it merely makes the name unique. */
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

/** The value drawn on one preview row, by the row's own key rather than by the
 * Hebrew beside it. */
function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

/** The "days used this month" hint on a balance row, which is where a mark's
 * effect on the balance is legible as a whole number rather than as a running
 * fraction. */
function daysUsed(count: number): string {
  return `${he.sheet.reporting.daysUsed}: ${formatDays(count)}`;
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
  if (second?.half) {
    await page
      .getByRole("button", { name: he.calendar.picker.part.half, exact: true })
      .click();
  }
  if (second?.note !== undefined) {
    await page.getByLabel(he.calendar.picker.note.label).fill(second.note);
  }
  const marks = he.calendar.marks(SATURDAY);
  await page.getByRole("button", { name: marks[kind], exact: true }).click();
}

test.describe("a month that has not ended yet (specs.md item 21)", () => {
  test("says so, and takes the facts anyway", async ({ page }) => {
    // The demo household's months run through September 2026, so the screen
    // opens on the month still running. Item 21: it can be filled in and it
    // cannot be exported.
    await useHousehold(page, "demo", "item21");
    await page.goto("/month");
    await switchToTestWorker(page);

    const warning = page.locator("#warning-monthNotEnded");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(he.sheet.warnings.monthNotEnded);

    // The other half of item 21, and the half a warning could quietly have
    // replaced: the month is still calculated. A figure is drawn, and marking a
    // day changes it.
    await expect(row(page, "net")).toBeVisible();
    await expect(row(page, "balance-vacation")).toContainText(daysUsed(0));
    // 14.9.2026 is a Monday and 16.9.2026 a Wednesday — neither the rest day nor
    // the rest-eve, so three whole days come off the balance (item 7).
    await sweep(page, "2026-09-14", "2026-09-16", "vacation");
    await expect(row(page, "balance-vacation")).toContainText(daysUsed(3));

    // And the warning is still there afterwards: filling the month in is not
    // what makes it exportable.
    await expect(page.locator("#warning-monthNotEnded")).toBeVisible();
  });

  test("says nothing about a month that has ended", async ({ page }) => {
    // The same screen stepped back to August 2026, which is over. A warning
    // that appeared on every month is one nobody reads (`types.ts`), so its
    // absence here is the assertion.
    await useHousehold(page, "demo", "ended");
    await page.goto("/month");
    await switchToTestWorker(page);
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
    await expect(row(page, "net")).toBeVisible();
    await expect(page.locator("#warning-monthNotEnded")).toHaveCount(0);
  });
});

test.describe("a month the store has no record of", () => {
  test("is empty until a mark opens it, and then it calculates", async ({
    page,
  }) => {
    // October 2026 is past the demo household's last seeded month, so the store
    // has no record of it at all: the screen says so rather than showing a month
    // of zeroes.
    await useHousehold(page, "demo", "open");
    await page.goto("/month");
    await switchToTestWorker(page);
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();

    await expect(page.getByText(he.month.empty.title)).toBeVisible();
    await expect(row(page, "net")).toHaveCount(0);

    // The gesture item 21 names — the calendar — and nothing else. 5.10.2026 is
    // a Monday and 8.10.2026 a Thursday, so four whole days come off the
    // balance: no rest day and no rest-eve falls inside the range (item 5).
    await sweep(page, "2026-10-05", "2026-10-08", "vacation");

    // The month now exists, is calculated, and says it cannot be exported yet.
    await expect(page.getByText(he.month.empty.title)).toHaveCount(0);
    await expect(row(page, "net")).toBeVisible();
    await expect(row(page, "balance-vacation")).toContainText(daysUsed(4));
    await expect(page.locator("#warning-monthNotEnded")).toBeVisible();

    // **The wage the opened month carries is what this would catch.** No rate is
    // ever hardcoded (`CLAUDE.md`), so a month opened with an invented base
    // would draw a plausible salary from nowhere. October 2026 takes the
    // minimum wage **in force during it** — ₪6,443.85, the row dated 1.4.2026
    // and sourced to the family's own 2026 workbook — and not the position the
    // month before it was confirmed at.
    //
    // **This assertion was the other way round until 2026-09-11**, and it
    // passed: a month opened by a mark carried its neighbour's wage, so an
    // October 2026 was valued at the wage of April 2025 and paid under the legal
    // minimum. `wageToCarry`'s own comment said it worked that way only until
    // the dated-rates table landed, and the table had landed. The test asserted
    // the behaviour rather than the rule, which is how it kept the defect.
    await expect(row(page, "base")).toContainText(formatAgorot(IN_FORCE_2026));

    // And September, which the seed itself values at the same figure — since
    // 2026-09-11 a seeded month carries the wage in force during it rather than
    // one figure stamped across the year (`seed.ts`), so the month opened by a
    // mark and the month beside it agree instead of differing by a rise.
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
    await expect(row(page, "base")).toContainText(formatAgorot(IN_FORCE_2026));
  });

  test("survives a reload, because the mark went to the store", async ({
    page,
  }) => {
    // The failure this catches is a mark held in the browser and never saved:
    // the screen would look right until the page was reloaded, which is the one
    // thing no unit test does.
    await useHousehold(page, "demo", "reload");
    await page.goto("/month");
    await switchToTestWorker(page);
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();
    await sweep(page, "2026-10-05", "2026-10-08", "vacation");
    await expect(row(page, "balance-vacation")).toContainText(daysUsed(4));

    await page.reload();
    // The reload also forgets which worker was on screen — the switcher holds
    // that in the page and not in the store — so it is chosen again before the
    // month is. The mark is what has to survive here, and it does.
    await switchToTestWorker(page);
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();
    await expect(row(page, "balance-vacation")).toContainText(daysUsed(4));
  });
});

test.describe("the known case of Part 4, entered through the screen", () => {
  test("reaches ₪9,305.75 and ₪7,305.75 from three gestures", async ({
    page,
  }) => {
    await useHousehold(page, "known", "part4");
    await page.goto("/month");

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

    // Gestures two and three: the two holidays, each answered "she worked it".
    // The dates are the year's and arrive drawn; whether she worked one is the
    // single fact a month records about it (item 9).
    for (const date of ["2025-08-19", "2025-08-21"]) {
      await page.locator(`[data-date="${date}"]`).click();
      await page
        .getByRole("button", { name: he.calendar.holiday.yes, exact: true })
        .click();
    }

    // **Part 4's figures, row by row, to the agora and with no tolerance.**
    // Column E is the base plus the supplement: ₪6,247.65 + ₪500 = ₪6,747.65.
    // Column F is Part 4's own "two holidays and four Saturdays at ₪426.35":
    // four rest days at that rate and two holidays at it, ₪1,705.40 + ₪852.70 =
    // ₪2,558.10. Every one of those numbers is quoted from Part 4 and the only
    // arithmetic here is its own multiplication, written out so it can be
    // checked by eye.
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

    await page.screenshot({
      path: "test-results/known-case-marked.png",
      fullPage: true,
    });

    // The fourth total needs the advance instalment, which is recorded where
    // everything that *records* a payment is recorded (item 5).
    await page.goto("/payments");
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
    await page.goto("/month");
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
    // Part 4's invalid case: the 16th recorded as a Saturday she had off, then
    // the same date marked again. Left unrefused it would pay both the rest-day
    // rate and a second mark's for one day, and the sheet would look ordinary.
    await useHousehold(page, "known", "invalid");
    await page.goto("/month");
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
    // worker a whole day on the screen she is looking at.
    await useHousehold(page, "demo", "halfday");
    await page.goto("/month");
    await switchToTestWorker(page);

    const marks = he.calendar.marks(SATURDAY);

    // The before state, so the figures below are moves and not coincidences.
    await expect(row(page, "workDays")).toContainText(
      `${formatDays(STANDARD)} / ${formatDays(STANDARD)}`,
    );
    await expect(row(page, "balance-vacation")).toContainText(daysUsed(0));

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
    await expect(row(page, "balance-vacation")).toContainText(daysUsed(0.5));

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
    // The chosen worker does not survive a reload, so she is chosen again. What
    // is being checked is the mark, and the mark does.
    await switchToTestWorker(page);
    await expect(row(page, "workDays")).toContainText(
      `${formatDays(STANDARD - 0.5)} / ${formatDays(STANDARD)}`,
    );
    await expect(row(page, "balance-vacation")).toContainText(daysUsed(0.5));
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
    await page.goto("/month");
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
