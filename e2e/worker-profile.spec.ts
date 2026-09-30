import { expect, test, type Page } from "@playwright/test";
import { switchToTestWorker, openSettingsForTestWorker, openPaymentSections, openSettingsGroups, TODAY } from "./household";
import { FRIDAY, SATURDAY, addMonths, monthOf, yearMonthText } from "../src/lib/dates";
import { fullDayLabel } from "../src/lib/dateLabels";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";

/**
 * The worker's profile through the browser — the four things step 9 exists to
 * make settable, each checked by what it *moves* on another screen rather than
 * by the click that set it (`CLAUDE.md` rules 9 and 12).
 *
 * **Every expected figure comes from `specs.md` Part 4, from item 14, or from
 * arithmetic worked by hand on a calendar, and none from what the screen
 * printed.** ₪500 across five rest-eves is Part 4's own figure; ₪100 for one
 * rest-eve is that figure divided by the five Fridays item 14 calls weekly, and
 * it is what the known household is seeded with; four Thursdays in August 2025
 * is a fact about the calendar — 1 August 2025 is a Friday, so the Thursdays
 * are the 7th, the 14th, the 21st and the 28th.
 *
 * **Each test gets its own store**, for the reason `month-screen.spec.ts`
 * gives: the dev repository is a module singleton keyed by the `household`
 * cookie, and a fixed name would hand the second run the changes the first one
 * made — so the "before" assertions would be asserting the previous run.
 */

/** Part 4: ₪500 of rest-eve supplement across the five Fridays of August 2025,
 * five rest days and two holidays at ₪426.35, and a ₪10,000 advance. */
const REST_EVE_SUPPLEMENT = 10000; // ₪100 for one, which is ₪500 over five.
const AUGUST_2025_REST_EVES_AS_SATURDAY_RESTER = 5; // Fridays: 1, 8, 15, 22, 29.

/** The demo household's own opening advance, entered rather than seeded: ₪2,000
 * given with ₪500 of it already repaid, so ₪1,500 is still owed (specs.md item
 * 6 — the family states this once). The subtraction is written out so it can be
 * checked by eye. */
const OPENING_PRINCIPAL = 200000;
const OPENING_REPAID = 50000;
const OPENING_OUTSTANDING = OPENING_PRINCIPAL - OPENING_REPAID;

/** A standing line of ₪250 a month, which is a figure of this test's own: item
 * 20 gives no amount, because a line the user adds is the user's own. */
const STANDING_AGOROT = 25000;

const RUN = Date.now().toString(36);

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

function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

/**
 * One month's payslip, showing the worker the spec is on.
 *
 * **A term's effect is read off the sheet and not off the opening screen**
 * (specs.md item 5): the rest-eve supplement and a standing line are lines
 * behind the ‏ברוטו‎, and the card beside the calendar summarises rather than
 * itemising. Both were drawn on `/month` until 2026-09-16. `switch` is the
 * caller's, because the known household holds one worker and has nothing to
 * step to.
 */
async function openPayslip(
  page: Page,
  month: string,
  options: { switch?: boolean } = {},
): Promise<void> {
  await page.goto(`/month/payslip?month=${month}`);
  if (options.switch) await switchToTestWorker(page);
}

/** The same, for the demo household, which has two workers to step between. */
async function openPayslipForTestWorker(
  page: Page,
  month: string,
): Promise<void> {
  await openPayslip(page, month, { switch: true });
}

/** August 2025 — the month Part 4 states every figure of. */
const AUGUST_2025 = "2025-08";

/** The month the demo household opens on, as `YYYY-MM`. Read off the clock
 * rather than written here, so the spec does not pin itself to one month. */
function thisMonth(): string {
  const { year, month } = monthOf(TODAY);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** A month either side of this one, as the lifetime's own select values it. */
function monthShift(months: number): string {
  return yearMonthText(addMonths(monthOf(TODAY), months));
}

/** Every line the *profile's* standing lines put on the sheet. `userLineKey`
 * builds the key as `standing.<id>` and the id is minted by the store, so the
 * prefix is the whole of what a test can name. */
function standingLines(page: Page) {
  return page.locator('[data-row^="standing."]');
}

/**
 * Wait until the change reaching the store has come back.
 *
 * **This is not a sleep and it is not flake management.** The profile and the
 * payments screen both dim while a server action is in flight and say so with
 * `aria-busy` (`WorkerProfileScreen`, `PaymentsScreen`), and a spec that
 * navigated away in that window would be asking the next page about a write
 * that had not landed — which is a race the *test* invented and not one the
 * user can meet, since a user does not move faster than the screen tells them
 * it is saving. Every gesture below is followed by this before anything is
 * asserted or any page is opened.
 */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/**
 * One closing balance on the payslip, in days.
 *
 * Read off `data-closing`, which carries the number the row was drawn from, so a
 * difference is arithmetic rather than a match on a formatted string — and the
 * assertions that use it are all differences.
 */
async function balanceOf(page: Page, kind: "vacation" | "sick"): Promise<number> {
  const text = await page
    .locator(`[data-after="${kind}"]`)
    .first()
    .getAttribute("data-closing");
  expect(text).not.toBeNull();
  return Number(text);
}

test.describe("the workers' list", () => {
  test("shows the household's workers and the limit on them", async ({
    page,
  }) => {
    // The tab was a 404 until this step; the routes table calls a tab that 404s
    // worse than a tab that is not there.
    await useHousehold(page, "demo", "list");
    await page.goto("/workers");

    // An account holds no more than two workers (item 11), and the demo
    // household is seeded with exactly two.
    await expect(page.locator("#worker-worker-1")).toBeVisible();
    await expect(page.locator("#worker-worker-2")).toBeVisible();
    await expect(page.getByText(he.workers.limit)).toBeVisible();

    // The link the artboard draws, and it goes to a page that exists.
    await page
      .locator("#worker-worker-1")
      .getByRole("link", { name: he.workers.toProfile("") })
      .click();
    await expect(page).toHaveURL(/\/workers\/worker-1$/);
  });
});

test.describe("the weekly rest day is a term of the employment (specs.md item 5)", () => {
  test("moves the calendar's rest-eves and the month's supplement with it", async ({
    page,
  }) => {
    // The known household, because Part 4 states its rest-eve figure outright:
    // ₪500 across the five Fridays of August 2025.
    await useHousehold(page, "known", "restday");

    await openPayslip(page, AUGUST_2025);
    await expect(row(page, "restEveSupplement")).toContainText(
      formatAgorot(
        AUGUST_2025_REST_EVES_AS_SATURDAY_RESTER * REST_EVE_SUPPLEMENT,
      ),
    );
    // Their rest day is Saturday, so the calendar's own legend says so.
    await page.goto("/");
    await expect(
      page.getByText(he.calendar.marks(SATURDAY).freeRestDay, { exact: true }),
    ).toBeVisible();

    await page.goto("/settings");
    await openSettingsGroups(page);
    await page.screenshot({
      path: "test-results/profile-before.png",
      fullPage: true,
    });

    // The gesture: the rest day changed to Friday. Step 7c built the
    // generalisation and could not check it, because no screen could move the
    // value off its default.
    await page
      .locator('[data-terms="restDay"]')
      .getByRole("button", {
        name: he.workers.profile.terms.restDay.day(FRIDAY),
        exact: true,
      })
      .click();
    await settled(page);

    // **The calendar redraws.** A Friday-resting worker's free rest day is not
    // called "שבת חופשית", and the legend is where the wording is drawn from
    // their own day rather than from a constant (item 5).
    await page.goto("/");
    await expect(
      page.getByText(he.calendar.marks(FRIDAY).freeRestDay, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(he.calendar.marks(SATURDAY).freeRestDay, { exact: true }),
    ).toHaveCount(0);

    // **And the money moves with it, from the current month on.** Their rest-eve
    // is now Thursday, so the sheet's own row is named for Thursdays rather
    // than for Fridays. The row name is what is asserted because it is read off
    // the month's stored rest day and not off a count, so it separates the term
    // having moved from a month that happens to hold the same number of each.
    await openPayslip(page, thisMonth());
    await expect(row(page, "restEveSupplement")).toContainText(
      he.sheet.lines.restEveSupplement(FRIDAY),
    );

    // **And never a month before it** (item 5). August 2025 is the month Part 4
    // states: five Fridays at ₪100, ₪500 of supplement, counted against the
    // Saturday they rested on then. It keeps that day and that figure, because a
    // change of rest day "reaches the current month and the months after it,
    // and never a month before" — a month already lived through did not change
    // which day they rested on.
    await openPayslip(page, AUGUST_2025);
    await expect(row(page, "restEveSupplement")).toContainText(
      he.sheet.lines.restEveSupplement(SATURDAY),
    );
    await expect(row(page, "restEveSupplement")).toContainText(
      formatAgorot(
        AUGUST_2025_REST_EVES_AS_SATURDAY_RESTER * REST_EVE_SUPPLEMENT,
      ),
    );
    await page.screenshot({
      path: "test-results/profile-rest-day-friday.png",
      fullPage: true,
    });
  });
});

test.describe("a standing line, and the division it makes reachable (item 20)", () => {
  test("is overridden on a month while a one-off line is corrected", async ({
    page,
  }) => {
    await useHousehold(page, "demo", "standing");

    // Before: the month's sheet carries no standing line at all, because the
    // demo household's September holds none. Matched on the key's prefix, which
    // is how `userLineKey` addresses one — the id is the store's to give, so
    // the test cannot name it (`engine/month.ts`).
    await openPayslipForTestWorker(page, thisMonth());
    await expect(standingLines(page)).toHaveCount(0);

    await openSettingsForTestWorker(page);
    const standing = page.locator('[data-terms="standing"]');
    await expect(standing.getByText(he.workers.profile.terms.standing.empty)).toBeVisible();

    await standing
      .getByRole("button", { name: he.workers.profile.terms.standing.add })
      .click();
    await standing
      .getByRole("textbox", { name: he.month.actions.lines.label })
      .fill("דמי כיס");
    await standing
      .getByRole("textbox", { name: he.month.actions.lines.amount })
      .fill(String(STANDING_AGOROT / 100));
    await standing
      .getByRole("button", {
        name: he.month.actions.lines.submit,
        exact: true,
      })
      .click();
    await settled(page);

    // **It reaches the month, at the amount it was set at** (item 20: it
    // "appears in every month afterwards, at the same amount"). An addition
    // sits before the month's total by default, so it is a line of column E on
    // the sheet — where the payslip itemises what the opening screen sums into
    // the ‏ברוטו‎ (item 5).
    await openPayslipForTestWorker(page, thisMonth());
    await expect(standingLines(page)).toContainText(
      formatAgorot(STANDING_AGOROT),
    );

    // **And it is the one row the override control may replace**, which is what
    // `overridable: prefix === "standing"` says: the amount came from the
    // profile, so a month that paid something else says so with an override.
    await page.goto("/payments");
    await switchToTestWorker(page);
    await openPaymentSections(page);
    const overrides = page.getByRole("button", {
      name: he.month.actions.overrides.changeLabel("דמי כיס"),
    });
    await expect(overrides).toBeVisible();

    // A line typed into *this* month is corrected where it was typed, and is
    // offered no override at all. The two together are the division step 8
    // drew and could not check.
    const lines = page.locator('[data-group="userLines"]');
    await lines
      .getByRole("button", { name: he.month.actions.lines.add })
      .click();
    await lines
      .getByRole("textbox", { name: he.month.actions.lines.label })
      .fill("החזר נסיעה");
    await lines
      .getByRole("textbox", { name: he.month.actions.lines.amount })
      .fill("80");
    await lines
      .getByRole("button", { name: he.month.actions.lines.submit, exact: true })
      .click();
    await settled(page);

    await expect(
      page.getByRole("button", {
        name: he.month.actions.lines.editLabel("החזר נסיעה"),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: he.month.actions.overrides.changeLabel("החזר נסיעה"),
      }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "test-results/profile-standing-line.png",
      fullPage: true,
    });
  });

  /**
   * **A lifetime, set and corrected through the row that holds it** (specs.md
   * item 20).
   *
   * The months are read off the clock rather than written here, for the reason
   * `thisMonth` gives: the spec must not pin itself to one month. What is fixed
   * is the *relation* — a line that starts next month is not this month's, a line
   * whose range covers this month is, and a line whose last month has passed is
   * neither, and sits under its own heading instead.
   *
   * **What it would catch**: the filter applied to the profile but not to the
   * snapshot, so a line outside its range still reaches the sheet; a lifetime
   * saved and not read back into the panel, so correcting one end silently
   * clears the other; and an ended line dropped from the screen altogether,
   * which would leave the edit that restarts it on a row nobody can see.
   */
  test("runs only for the months its lifetime names", async ({ page }) => {
    await useHousehold(page, "demo", "standing-lifetime");
    await openSettingsForTestWorker(page);

    const words = he.workers.profile.terms.standing;
    const standing = page.locator('[data-terms="standing"]');
    const label = "השתתפות בטלפון";
    const lifetime = words.lifetime;

    async function fillLifetime(from: string, until: string): Promise<void> {
      await standing.getByLabel(lifetime.from).selectOption(from);
      await standing.getByLabel(lifetime.until).selectOption(until);
    }

    // A line that begins next month. Every field is filled in the panel it was
    // opened in, as a family fills it.
    await standing.getByRole("button", { name: words.add }).click();
    await standing
      .getByRole("textbox", { name: he.month.actions.lines.label })
      .fill(label);
    await standing
      .getByRole("textbox", { name: he.month.actions.lines.amount })
      .fill(String(STANDING_AGOROT / 100));
    await fillLifetime(monthShift(1), "");
    await standing
      .getByRole("button", { name: he.month.actions.lines.submit, exact: true })
      .click();
    await settled(page);

    // The row says when it begins, and says it has not begun.
    await expect(standing).toContainText(lifetime.notYet);
    // And this month's sheet does not carry it, because this month is outside it.
    await openPayslipForTestWorker(page, thisMonth());
    await expect(standingLines(page)).toHaveCount(0);

    // Corrected to begin this month and end this month: one month, and this one.
    await openSettingsForTestWorker(page);
    await standing.getByRole("button", { name: words.editLabel(label) }).click();
    await fillLifetime(thisMonth(), thisMonth());
    // The panel as the family meets it, with both ends of the lifetime on it.
    await standing.screenshot({ path: "test-results/profile-standing-lifetime-panel.png" });
    await standing
      .getByRole("button", { name: he.month.actions.lines.save, exact: true })
      .click();
    await settled(page);

    await openPayslipForTestWorker(page, thisMonth());
    await expect(standingLines(page)).toContainText(formatAgorot(STANDING_AGOROT));

    // Ended: its last month is the month before this one. It leaves the sheet
    // and moves to the quieter heading, where the edit that would restart it is.
    await openSettingsForTestWorker(page);
    await standing.getByRole("button", { name: words.editLabel(label) }).click();
    await fillLifetime(monthShift(-1), monthShift(-1));
    await standing
      .getByRole("button", { name: he.month.actions.lines.save, exact: true })
      .click();
    await settled(page);

    const ended = page.locator('[data-terms="standing-ended"]');
    await expect(ended.getByText(words.ended)).toBeVisible();
    await expect(ended).toContainText(label);
    await standing.screenshot({ path: "test-results/profile-standing-lifetime.png" });

    await openPayslipForTestWorker(page, thisMonth());
    await expect(standingLines(page)).toHaveCount(0);
  });

  test("is overridable on the other side of the total too", async ({ page }) => {
    // **A standing *deduction* lands after the month's total by default**
    // (item 20, `defaultPlacementFor`), which puts it in the closing block
    // rather than in a column. Its amount still came from the profile, so an
    // override is still the only way a month says it paid something else — and
    // this is the case that made `ClosingLine.overridable` reachable, which it
    // had not been while no standing line could exist.
    await useHousehold(page, "demo", "standing-after");
    await openSettingsForTestWorker(page);

    const standing = page.locator('[data-terms="standing"]');
    await standing
      .getByRole("button", { name: he.workers.profile.terms.standing.add })
      .click();
    await standing
      .getByRole("textbox", { name: he.month.actions.lines.label })
      .fill("השתתפות בטלפון");
    await standing
      .getByRole("textbox", { name: he.month.actions.lines.amount })
      .fill(String(STANDING_AGOROT / 100));
    await standing
      .getByRole("button", {
        name: he.month.actions.lines.direction.deduction,
        exact: true,
      })
      .click();
    await standing
      .getByRole("button", { name: he.month.actions.lines.submit, exact: true })
      .click();
    await settled(page);

    // It reaches the month below the total, and the override control offers it.
    await page.goto("/payments");
    await switchToTestWorker(page);
    await openPaymentSections(page);
    await expect(
      page.getByRole("button", {
        name: he.month.actions.overrides.changeLabel("השתתפות בטלפון"),
      }),
    ).toBeVisible();
  });
});

test.describe("the opening position (specs.md item 6)", () => {
  test("an advance entered on the profile is the debt the payments screen repays", async ({
    page,
  }) => {
    await useHousehold(page, "demo", "opening");

    // Before: the first worker's seeded advance is fully repaid across March,
    // April and May, so nothing is owed and no second advance exists.
    await page.goto("/payments");
    await switchToTestWorker(page);
    await openPaymentSections(page);
    await expect(page.locator('[data-advance="2"]')).toHaveCount(0);

    await openSettingsForTestWorker(page);
    const opening = page.locator('[data-terms="opening"]');
    await opening
      .getByRole("button", {
        name: he.workers.profile.terms.opening.addAdvance,
      })
      .click();
    await opening
      .getByRole("textbox", { name: he.workers.profile.terms.opening.principal })
      .fill(String(OPENING_PRINCIPAL / 100));
    await opening
      .getByRole("textbox", { name: he.workers.profile.terms.opening.repaid })
      .fill(String(OPENING_REPAID / 100));
    await opening
      .getByRole("button", {
        name: he.workers.profile.terms.opening.submit,
        exact: true,
      })
      .click();
    await settled(page);

    // **The debt the payments screen reads is the one that was entered**, and
    // its number is minted past every advance they already carry — the seeded
    // one is 1, so this is 2. ₪2,000 given less ₪500 repaid is ₪1,500 still
    // owed, which is arithmetic and not a figure the engine produced.
    await page.goto("/payments");
    await switchToTestWorker(page);
    await openPaymentSections(page);
    const advance = page.locator('[data-advance="2"]');
    await expect(advance).toBeVisible();
    await expect(advance).toContainText(formatAgorot(OPENING_OUTSTANDING));
    await page.screenshot({
      path: "test-results/profile-opening-advance.png",
      fullPage: true,
    });
  });

  /**
   * **The opening days are saved on the profile, and every month's balance
   * moves with them** (specs.md items 6 and 13).
   *
   * The wizard's copy of these two fields is driven in `first-month.spec.ts`;
   * the profile's own save was read back but never pressed, so a form that
   * held its value and never wrote it looked identical to one that worked.
   *
   * Scenario: the demo worker opens with nine vacation days and twenty-four
   * sick days (`seed.ts`). Five days are added to the vacation opening on the
   * profile — nine becomes fourteen — and nothing else is touched.
   *
   * Expected: this month's closing vacation balance is exactly five days
   * higher than it was, and the sick balance has not moved at all.
   *
   * **The five is the arithmetic and the baseline cancels.** What the balance
   * stands at is the replay's answer and is not asserted against itself; what
   * is asserted is that adding five days to the position every month is
   * replayed from moves that month's balance by five — which is item 13's
   * whole promise, that a correction to the opening carries forward for free.
   *
   * **What it would catch**: the save wired to nothing, which leaves the
   * balance where it was; the vacation field written into the sick one, which
   * this catches by asserting the sick balance did *not* move; and a balance
   * stored rather than replayed, which would leave the already-computed months
   * at their old figure while only the newest followed.
   */
  test("a correction to the opening days carries into the month's balance", async ({
    page,
  }) => {
    await useHousehold(page, "demo", "opening-days");
    const words = he.workers.profile.terms.opening;
    /** Nine, as `seed.ts` states their opening vacation. */
    const SEEDED_VACATION = 9;
    const ADDED = 5;

    await openPayslipForTestWorker(page, thisMonth());
    const vacationBefore = await balanceOf(page, "vacation");
    const sickBefore = await balanceOf(page, "sick");

    await openSettingsForTestWorker(page);
    const opening = page.locator('[data-terms="opening"]');
    // The field holds what the seed gave, which is what makes the new figure a
    // correction rather than a first entry.
    await expect(opening.getByRole("textbox", { name: words.vacation })).toHaveValue(
      String(SEEDED_VACATION),
    );
    await opening
      .getByRole("textbox", { name: words.vacation })
      .fill(String(SEEDED_VACATION + ADDED));
    await opening.getByRole("button", { name: words.save, exact: true }).click();
    await settled(page);

    // Read back out of the store, not off the field that still holds it.
    await openSettingsForTestWorker(page);
    await expect(
      page.locator('[data-terms="opening"]').getByRole("textbox", { name: words.vacation }),
    ).toHaveValue(String(SEEDED_VACATION + ADDED));

    // **And the month followed.** Five more days of vacation, and sickness
    // exactly where it was — the two fields save through one control, so a
    // value written into the wrong one is the mistake worth catching.
    await openPayslipForTestWorker(page, thisMonth());
    expect(await balanceOf(page, "vacation")).toBeCloseTo(vacationBefore + ADDED, 5);
    expect(await balanceOf(page, "sick")).toBeCloseTo(sickBefore, 5);
    await page.screenshot({
      path: "test-results/profile-opening-days.png",
      fullPage: true,
    });
  });
});

test.describe("the three documents and their expiry dates (specs.md item 28)", () => {
  /** The dates alone, which is what this section holds: they are stored in the
   * clear because item 27's warnings have to query them. The passport *number*
   * is sealed and sits in its own row above, with its own check. */
  test("holds three separate dates, apart from the sealed numbers", async ({ page }) => {
    await useHousehold(page, "known", "documents");
    await page.goto("/settings");
    await openSettingsGroups(page);

    const documents = page.locator('[data-terms="documents"]');
    const words = he.workers.profile.terms.documents;

    // Part 4 states no document dates, so Hanna's three arrive empty — which is
    // what a worker whose papers the family has not typed in looks like.
    await expect(documents.getByText(words.none)).toHaveCount(3);

    // Three separate documents with three separate dates: they are not one
    // thing under different names (item 28), so all three are filled with
    // different dates and all three are read back.
    await documents
      .getByRole("textbox", { name: words.employmentPermit })
      .fill("2026-11-30");
    await documents.getByRole("textbox", { name: words.workVisa }).fill("2027-03-31");
    await documents.getByRole("textbox", { name: words.passport }).fill("2029-06-30");
    await documents.getByRole("button", { name: words.save, exact: true }).click();
    await settled(page);

    await page.reload();
    // A reload folds the groups again.
    await openSettingsGroups(page);
    // Read back after a reload, because the failure this catches is a date held
    // in the browser and never saved.
    await expect(
      page.locator('[data-terms="documents"]').getByText(words.none),
    ).toHaveCount(0);
    // The dates read back three at a time, each on its own document, so a
    // panel that wrote one value into all three fields would fail here. The
    // written form beside each field is the same value in the words the rest of
    // the application uses — nobody should have to read an ISO date to know
    // what is stored.
    const saved = page.locator('[data-terms="documents"]');
    await expect(
      saved.getByRole("textbox", { name: words.employmentPermit }),
    ).toHaveValue("2026-11-30");
    await expect(
      saved.getByRole("textbox", { name: words.workVisa }),
    ).toHaveValue("2027-03-31");
    await expect(
      saved.getByRole("textbox", { name: words.passport }),
    ).toHaveValue("2029-06-30");
    await expect(saved).toContainText(fullDayLabel("2026-11-30"));
    await expect(saved).toContainText(fullDayLabel("2029-06-30"));

    // **A date that only looks like one is refused.** 2026 is not a leap year,
    // so 29 February is not a day: a `Date` built from it rolls forward to
    // 1 March, and a permit that silently expires on the wrong day is exactly
    // the mistake Part 5 warns about.
    await page
      .locator('[data-terms="documents"]')
      .getByRole("textbox", { name: words.workVisa })
      .fill("2026-02-29");
    await page
      .locator('[data-terms="documents"]')
      .getByRole("button", { name: words.save, exact: true })
      .click();
    await settled(page);
    await expect(
      page.getByText(he.workers.profile.terms.refused.date),
    ).toBeVisible();
  });
});
