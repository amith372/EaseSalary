import { expect, test, type Page } from "@playwright/test";
import { openPaymentSections, switchToTestWorker, useHousehold, useToday, TODAY } from "./household";
import { he, type Said } from "../src/lib/i18n/he";

/**
 * `/alerts` through the browser (specs.md item 27).
 *
 * **What every assertion rests on.** The `filed` seed is the demo with the
 * test worker's January to April 2026 confirmed and never exported
 * (`seed.ts`), so "January 2026 not yet exported" and the three months after it
 * are warnings on her list, while every later finished month is still a draft
 * and so a blockage (item 27). Nothing below depends on which other entries the
 * day raises: the blockages are counted before and after and compared with
 * themselves.
 */

const SPEC = "filed";
const AUGUST = `${he.calendar.monthNames[7]} 2026`;
const JANUARY = `${he.calendar.monthNames[0]} 2026`;
const FEBRUARY = `${he.calendar.monthNames[1]} 2026`;
const MARCH = `${he.calendar.monthNames[2]} 2026`;
const APRIL = `${he.calendar.monthNames[3]} 2026`;

/** A sentence from `he.ts` as the screen renders it, each part in its own
 * element. */
function text(said: Said): string {
  return said.map((part) => (typeof part === "string" ? part : part.value)).join("");
}

/**
 * The test worker's card for months confirmed and never exported — one card
 * whether it stands for one month or several, since entries of a kind that
 * differ only in the month they are about are drawn as one (item 27). The
 * singular "טרם יוצא" opens the plural "טרם יוצאו" as well, so it finds both.
 */
function notExported(page: Page) {
  return page
    .locator('[data-role="alert"][data-list="warning"]')
    .filter({ hasText: "טרם יוצא" })
    .filter({ hasText: he.placeholder.name });
}

test.describe("the alerts page (specs.md item 27)", () => {
  test("four months not yet exported are one card, and each is marked handled on its own", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "not-now");
    await page.goto("/alerts");
    await expect(page.locator("h1")).toHaveText(he.alerts.title);

    const blockages = page.locator('[data-role="alert"][data-list="blockage"]');
    const blockagesBefore = await blockages.count();
    // A blockage carries no 'not now' (item 27): it cannot be put off.
    for (let i = 0; i < blockagesBefore; i += 1) {
      await expect(
        blockages.nth(i).getByRole("button", { name: he.alerts.notNow }),
      ).toHaveCount(0);
    }

    // The seed's January to April are four months saying one sentence about a
    // different month, so they are one card naming them with one action on it
    // (item 27). Four cards here is the failure this catches.
    const months = notExported(page);
    await expect(months).toHaveCount(1);
    await expect(months.locator('[data-role="alert-title"]')).toContainText(
      text(he.alerts.entry.monthsNotExported(4).title),
    );
    // **One press per month and never one that answers all four**: the gesture
    // removes a month's warning for good (the user, 2026-09-25). Each button is
    // named for its own month, which is what a screen reader and this locator
    // both read.
    for (const month of [JANUARY, FEBRUARY, MARCH, APRIL]) {
      await expect(
        months.getByRole("button", { name: he.alerts.markHandledMonth(month) }),
      ).toHaveCount(1);
    }
    await expect(months.getByRole("button", { name: he.alerts.markHandled, exact: true })).toHaveCount(
      0,
    );
    await expect(months.getByRole("button", { name: he.alerts.notNow })).toHaveCount(0);
    await page.screenshot({ path: "test-results/alerts-before-not-now.png" });

    // January alone leaves, and the card stays over the three still owed.
    await months.getByRole("button", { name: he.alerts.markHandledMonth(JANUARY) }).click();
    await expect(months).toHaveCount(1);
    await expect(months.locator('[data-role="alert-title"]')).toContainText(
      text(he.alerts.entry.monthsNotExported(3).title),
    );
    await expect(
      months.getByRole("button", { name: he.alerts.markHandledMonth(JANUARY) }),
    ).toHaveCount(0);
    await expect(blockages).toHaveCount(blockagesBefore);

    // The last of them takes the card with it, and the one left before it is
    // the plain button a single month has always drawn.
    for (const month of [FEBRUARY, MARCH]) {
      await months.getByRole("button", { name: he.alerts.markHandledMonth(month) }).click();
      await expect(
        months.getByRole("button", { name: he.alerts.markHandledMonth(month) }),
      ).toHaveCount(0);
    }
    await expect(months.locator('[data-role="alert-title"]')).toContainText(
      `${APRIL} טרם יוצא`,
    );
    await months.getByRole("button", { name: he.alerts.markHandled, exact: true }).click();
    await expect(months).toHaveCount(0);
    await expect(blockages).toHaveCount(blockagesBefore);

    // It is remembered, not a state of the page, and records no export.
    await page.reload();
    await expect(notExported(page)).toHaveCount(0);
    for (const month of [JANUARY, FEBRUARY, MARCH, APRIL]) {
      await expect(page.locator('[data-role="handled"]').filter({ hasText: month })).toHaveCount(0);
    }
  });

  test("one such month is drawn as one month, in the singular", async ({ page }) => {
    // Ten days into February 2026: of the four the seed confirmed, January
    // alone has ended, so the card stands for one month and says what it always
    // said. It catches the grouping reaching a card that gathers nothing.
    await useHousehold(page, SPEC, "one-month");
    await useToday(page, "2026-02-10");
    await page.goto("/alerts");

    const month = notExported(page);
    await expect(month).toHaveCount(1);
    await expect(month.locator('[data-role="alert-title"]')).toContainText(
      `${JANUARY} טרם יוצא`,
    );
    await expect(month).not.toContainText(FEBRUARY);
    await expect(month).toContainText(text(he.alerts.entry.monthNotExported("").note));
  });

  test("a warning kind switched off in the pop-up is not listed", async ({ page }) => {
    await useHousehold(page, SPEC, "switch");
    await page.goto("/alerts");
    const blockages = page.locator('[data-role="alert"][data-list="blockage"]');
    const anyNotExported = page.locator('[data-role="alert"]').filter({ hasText: "טרם יוצא" });
    await expect(notExported(page)).toHaveCount(1);
    const blockagesBefore = await blockages.count();

    await page.getByRole("button", { name: he.alerts.settingsLink }).click();
    const dialog = page.getByRole("dialog", { name: he.alerts.reminders.title });
    await expect(dialog).toBeVisible();
    // The six kinds item 27 names and nothing else, every one on by default.
    const boxes = dialog.getByRole("checkbox");
    await expect(boxes).toHaveCount(6);
    for (let i = 0; i < 6; i += 1) await expect(boxes.nth(i)).toBeChecked();
    // The blockages are named, so one looked for here is explained.
    await expect(dialog.locator('[data-role="always-shown"]')).toHaveText(
      he.alerts.reminders.alwaysShown,
    );

    const box = dialog.getByRole("checkbox", { name: he.alerts.reminders.kinds.monthNotExported });
    await box.uncheck();
    await expect(box).not.toBeChecked();
    await page.screenshot({ path: "test-results/alerts-reminders-dialog.png" });
    await dialog.getByRole("button", { name: he.alerts.reminders.close }).click();
    await expect(dialog).toBeHidden();

    await expect(anyNotExported).toHaveCount(0);
    await expect(blockages).toHaveCount(blockagesBefore);

    // Saved, and not only drawn.
    await page.reload();
    await expect(anyNotExported).toHaveCount(0);
    await page.getByRole("button", { name: he.alerts.settingsLink }).click();
    await expect(
      page
        .getByRole("dialog", { name: he.alerts.reminders.title })
        .getByRole("checkbox", { name: he.alerts.reminders.kinds.monthNotExported }),
    ).not.toBeChecked();
  });

  test("a month exported from the reports is listed as handled, and leaves the list", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "handled");
    await page.goto("/alerts");
    const handled = page.locator('[data-role="handled"]').filter({ hasText: "יוצא" });
    const exportedBefore = await handled.count();
    const months = notExported(page);
    await expect(months).toContainText(JANUARY);

    await page.goto("/reports");
    await switchToTestWorker(page);
    const link = page
      .locator('[data-report-month="2026-1"]')
      .getByRole("link", { name: he.reports.previousMonths.excel });
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    await download.path();

    await page.goto("/alerts");
    await expect(handled).toHaveCount(exportedBefore + 1);
    await expect(handled.first()).toContainText(he.placeholder.name);
    // The card is one month shorter: January leaves it and the three behind it
    // stay, which is what a card standing for several months has to do.
    await expect(months).toHaveCount(1);
    await expect(months.locator('[data-role="alert-title"]')).toContainText(
      text(he.alerts.entry.monthsNotExported(3).title),
    );
    await expect(months).not.toContainText(JANUARY);
    await expect(months).toContainText(FEBRUARY);
    // Tall enough for the whole list: the page scrolls inside `<main>`, which a
    // full-page screenshot does not reach.
    await page.setViewportSize({ width: 1280, height: 2600 });
    await page.screenshot({ path: "test-results/alerts-after-export.png" });
  });

  test("with more than four warnings the bell lists four and counts the rest, and follows a dismissal", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "bell");
    await page.goto("/alerts");
    const bell = page.locator('[data-role="bell"]');
    const count = bell.locator('[data-row="warnings"]');
    const warnings = page.locator('[data-role="alert"][data-list="warning"]');
    await expect(notExported(page)).toHaveCount(1);

    // Warnings only: a blockage is the opening screen's, not the bell's.
    const before = await warnings.count();
    expect(before).toBeGreaterThan(5);
    await expect(count).toHaveText(String(before));

    // The bar is the layout's, which a server action refreshes with the page.
    // 'Not now' on the first warning that offers it — an advance — because the
    // gathered card puts its months off one at a time and a month leaving it
    // takes no card off the list.
    const putOff = warnings
      .filter({ has: page.getByRole("button", { name: he.alerts.notNow }) })
      .first();
    const putOffTitle = await putOff.locator('[data-role="alert-title"]').innerText();
    await putOff.getByRole("button", { name: he.alerts.notNow }).click();
    await expect(warnings.filter({ hasText: putOffTitle })).toHaveCount(0);
    await expect(count).toHaveText(String(before - 1));

    // The same figure on another screen. The panel lists the page's first
    // four warnings and counts the rest (item 27).
    const titles = await page
      .locator('[data-role="alert"][data-list="warning"] [data-role="alert-title"]')
      .allInnerTexts();
    await page.goto("/");
    await expect(count).toHaveText(String(before - 1));
    await bell.click();
    const panel = page.locator('[data-role="bell-panel"]');
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect(await panel.locator('[data-role="bell-entry"]').allInnerTexts()).toEqual(
      titles.slice(0, 4).map((title) => expect.stringContaining(title)),
    );
    await expect(panel.locator('[data-role="bell-more"]')).toHaveText(
      he.alerts.more(before - 1 - 4).map((part) => (typeof part === "string" ? part : part.value)).join(""),
    );
    await page.screenshot({ path: "test-results/alerts-bell-panel-more.png" });
    await panel.getByRole("link", { name: he.header.bell.showAll }).click();
    await expect(page).toHaveURL(/\/alerts$/);
  });

  test("with four warnings or fewer the bell opens a panel listing them", async ({ page }) => {
    await useHousehold(page, SPEC, "panel");
    await page.goto("/alerts");
    const bell = page.locator('[data-role="bell"]');
    const panel = page.locator('[data-role="bell-panel"]');
    const reminders = page.getByRole("dialog", { name: he.alerts.reminders.title });

    // Every unexported month and the seed's advances are what put the demo over
    // four; without them what is left is the few the seed's dates raise.
    await page.getByRole("button", { name: he.alerts.settingsLink }).click();
    for (const kind of ["monthNotExported", "advanceOutstanding"] as const) {
      await reminders
        .getByRole("checkbox", { name: he.alerts.reminders.kinds[kind] })
        .uncheck();
    }
    await reminders.getByRole("button", { name: he.alerts.reminders.close }).click();
    await expect(page.locator('[data-role="alert"]').filter({ hasText: "טרם יוצא" })).toHaveCount(0);
    const titles = await page
      .locator('[data-role="alert"][data-list="warning"] [data-role="alert-title"]')
      .allInnerTexts();
    expect(titles.length).toBeLessThanOrEqual(4);
    await expect(bell.locator('[data-row="warnings"]')).toHaveText(String(titles.length));

    // Opened from another screen, it lists what the page lists, and stays there.
    await page.goto("/");
    await bell.click();
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    const entries = panel.locator('[data-role="bell-entry"]');
    await expect(entries).toHaveCount(titles.length);
    // Four or fewer: nothing is left to count.
    await expect(panel.locator('[data-role="bell-more"]')).toHaveCount(0);
    for (const title of titles) await expect(entries.filter({ hasText: title })).toHaveCount(1);
    await page.screenshot({ path: "test-results/alerts-bell-panel.png" });

    // Esc and a press outside close it.
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await bell.click();
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await expect(panel).toHaveCount(0);

    // Its reminders link opens the same pop-up over the screen. Switching every
    // kind off empties the bell, and the panel says so.
    await bell.click();
    await panel.getByRole("button", { name: he.alerts.settingsLink }).click();
    await expect(reminders).toBeVisible();
    const boxes = reminders.getByRole("checkbox");
    for (let i = 0; i < 6; i += 1) await boxes.nth(i).uncheck();
    await expect(bell.locator('[data-row="warnings"]')).toHaveText("0");
    await reminders.getByRole("button", { name: he.alerts.reminders.close }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(panel).toContainText(he.header.bell.nothing);
    await expect(entries).toHaveCount(0);

    // 'Show all' leads to the page.
    await panel.getByRole("link", { name: he.header.bell.showAll }).click();
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(panel).toHaveCount(0);
  });
});

test.describe("the opening screen's blocker strip (specs.md item 27)", () => {
  test("leads with the first four blockages /alerts lists, counts the rest, and no warning", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "strip");

    await page.goto("/alerts");
    const listed = await page
      .locator('[data-role="alert"][data-list="blockage"] [data-role="alert-title"]')
      .allInnerTexts();
    // The seed records national insurance for January–March 2026 only
    // (`seed.ts`, month 4), so from July 2026 the test worker's second quarter
    // is owed — and it is listed after the first worker's four or more.
    const quarter = `${he.calendar.monthNames[3]} 2026 – ${he.calendar.monthNames[5]} 2026`;
    const words = he.alerts.entry.nationalInsurance(quarter);
    const owed = page
      .locator('[data-role="alert"][data-list="blockage"]')
      .filter({ hasText: words.title.join("") })
      .filter({ hasText: he.placeholder.name })
      .filter({ hasText: quarter });
    await expect(owed).toHaveCount(1);
    expect(listed.length).toBeGreaterThan(4);

    await page.goto("/");
    const strip = page.locator('[data-role="blocker"]');
    await expect(strip.first()).toBeVisible();
    expect(await strip.locator('[data-role="blocker-title"]').allInnerTexts()).toEqual(
      listed.slice(0, 4),
    );
    // A month not yet exported is the bell's, not the strip's.
    await expect(strip.filter({ hasText: "טרם יוצא" })).toHaveCount(0);
    await expect(page.locator('[data-role="blockers-more"]')).toContainText(
      String(listed.length - 4),
    );
    await page.screenshot({ path: "test-results/home-blocker-strip.png" });

    // A card leads where its entry on the page does.
    const first = strip.first().getByRole("link").first();
    const href = await first.getAttribute("href");
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));

    // "Show all" leads to the page, where the rest are.
    await page.goto("/");
    await page
      .locator('[data-role="blockers-more"]')
      .getByRole("link", { name: he.header.bell.showAll })
      .click();
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(owed).toHaveCount(1);
  });
});

test.describe("the national-insurance quarter, paid through the payments screen (specs.md items 19, 27)", () => {
  // The seed covers January–March 2026 and nothing after (`seed.ts`, month 4),
  // so April–June is owed from July 2026, the month after that quarter ended —
  // which the suite's September day is past.
  test("recording April–June takes that quarter off /alerts and the opening screen", async ({
    page,
  }) => {
    await useHousehold(page, SPEC, "quarter");
    const quarter = `${he.calendar.monthNames[3]} 2026 – ${he.calendar.monthNames[5]} 2026`;
    const blockages = page.locator('[data-role="alert"][data-list="blockage"]');
    const owed = blockages
      .filter({ hasText: he.alerts.entry.nationalInsurance(quarter).title.join("") })
      .filter({ hasText: he.placeholder.name })
      .filter({ hasText: quarter });

    await page.goto("/alerts");
    await expect(owed).toHaveCount(1);
    const before = await blockages.count();

    // Recorded in today's month with the quarter chosen by hand, so the test
    // does not rest on which quarter the form offers in that month.
    await page.goto("/payments");
    await switchToTestWorker(page);
    await openPaymentSections(page);
    const words = he.month.actions.thirdParty;
    const group = page.locator('[data-group="thirdParty"]');
    const kind = he.sheet.thirdParty.nationalInsurance;
    await group.getByRole("button", { name: words.add, exact: true }).click();
    await group.getByRole("button", { name: kind, exact: true }).click();
    await group.getByLabel(words.amount).fill("1200");
    await group.getByLabel(words.periodFrom).selectOption("2026-04");
    await group.getByLabel(words.periodTo).selectOption("2026-06");
    await group.getByLabel(words.paidOn).fill(TODAY);
    await group.getByRole("button", { name: words.submit, exact: true }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(group.getByText(kind, { exact: true }).first()).toBeVisible();

    // Off the page, and only that one entry.
    await page.goto("/alerts");
    await expect(owed).toHaveCount(0);
    await expect(blockages).toHaveCount(before - 1);
    const listed = await page
      .locator('[data-role="alert"][data-list="blockage"] [data-role="alert-title"]')
      .allInnerTexts();

    // The opening screen reads the same shorter list.
    await page.goto("/");
    const strip = page.locator('[data-role="blocker"]');
    await expect(strip.first()).toBeVisible();
    // The first worker owes the same quarter, so the card is found by both.
    await expect(
      strip.filter({ hasText: quarter }).filter({ hasText: he.placeholder.name }),
    ).toHaveCount(0);
    expect(await strip.locator('[data-role="blocker-title"]').allInnerTexts()).toEqual(
      listed.slice(0, 4),
    );
    if (listed.length > 4) {
      await expect(page.locator('[data-role="blockers-more"]')).toContainText(
        String(listed.length - 4),
      );
    } else {
      await expect(page.locator('[data-role="blockers-more"]')).toHaveCount(0);
    }
    await page.screenshot({ path: "test-results/home-after-quarter-paid.png" });
  });
});

test.describe("a finished month never confirmed (specs.md item 27)", () => {
  /**
   * **And `/דוחות` has no file to hand over for it** (specs.md items 4, 17).
   * Until 2026-09-24 it had one: the list linked straight to the file address,
   * which asked none of item 18's questions, and the blockage then stood beside
   * a month the family had already filed. The route refuses such a month now, so
   * the list offers the confirmation instead — and the blockage is what it was.
   *
   * **What it would catch**: the file link coming back for an unconfirmed month;
   * and a download of it clearing the alert, which was the older failure this
   * test was written for.
   */
  test("is a blockage, and the reports offer the confirmation rather than a file", async ({ page }) => {
    // The demo confirms none of its months (`seed.ts`), so August 2026 — ended
    // by the suite's day — is a draft.
    await useHousehold(page, "demo", "unconfirmed");
    // Every month of hers is a draft, so the blockage is one card naming them
    // all, August among them (item 27's grouping).
    const unconfirmed = page
      .locator('[data-role="alert"][data-list="blockage"]')
      .filter({ hasText: "טרם אושר" })
      .filter({ hasText: he.placeholder.name });

    await page.goto("/alerts");
    await expect(unconfirmed).toHaveCount(1);
    await expect(unconfirmed).toContainText(AUGUST);
    await expect(notExported(page)).toHaveCount(0);
    await expect(
      unconfirmed.getByRole("link", { name: he.alerts.entry.monthsUnconfirmed(0, "").action }),
    ).toHaveAttribute("href", "/month/export");

    await page.goto("/reports");
    await switchToTestWorker(page);
    const august = page.locator('[data-report-month="2026-8"]');
    await expect(
      august.getByRole("link", { name: he.reports.previousMonths.excel }),
    ).toHaveCount(0);
    await expect(august.locator("[data-confirm-month]")).toHaveAttribute(
      "href",
      "/month/export?month=2026-08",
    );

    await page.goto("/alerts");
    await expect(unconfirmed).toHaveCount(1);
    await expect(unconfirmed).toContainText(AUGUST);
    await expect(notExported(page)).toHaveCount(0);
    await page.screenshot({ path: "test-results/alerts-unconfirmed-no-file.png" });
  });
});

test.describe("an account with nothing outstanding (build_plan.md stage 6, done when)", () => {
  test("a worker added this month with her holidays chosen leaves the opening screen with no blockage", async ({
    page,
  }) => {
    // `empty` is the seed of a new account (`src/lib/store.ts`).
    await useHousehold(page, "empty", "nothing-owed");

    // Employed from the first of this month: no quarter has ended since, no
    // recuperation is owed in the first year, and nothing is exported yet. The
    // salary is April 2026's minimum wage, as in `add-worker.spec.ts`.
    await page.goto("/workers/new");
    await page.locator('[data-field="name"]').fill("מריה דה לה קרוס");
    // The step will not be left without a country: it decides her holiday list
    // and the select opens on nothing (`add-worker.spec.ts`).
    await page.locator('[data-field="country"]').selectOption("PH");
    await page.locator('[data-role="add-worker-next"]').click();
    await expect(page.getByRole("heading", { name: he.addWorker.when.title })).toBeVisible();
    await page.locator('[data-field="employedSince"]').fill(`${TODAY.slice(0, 7)}-01`);
    await page.locator('[data-role="add-worker-next"]').click();
    await expect(page.getByRole("heading", { name: he.addWorker.pay.title })).toBeVisible();
    await page.locator('[data-field="baseMonthlySalary"]').fill("6443.85");
    await page.locator('[data-role="add-worker-next"]').click();
    await page.locator('[data-role="add-worker-finish"]').click();
    await expect(page).toHaveURL(/\/workers\/[0-9a-f-]+$/);

    // The one blockage a new worker does carry: this year's holidays.
    await page.goto("/");
    await expect(
      page.locator('[data-role="blocker"]').filter({
        hasText: he.alerts.entry
          .holidaysUnchosen(Number(TODAY.slice(0, 4)), "", "")
          .title.map((part) => (typeof part === "string" ? part : part.value))
          .join(""),
      }),
    ).toHaveCount(1);

    // Chosen through the picker, one candidate at a time until the year is whole.
    await page.goto("/settings/holidays");
    const state = page.locator("[data-quota-state]");
    const unchosen = page.locator('[data-holiday][data-chosen="false"]');
    const candidates = await unchosen.evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-holiday")!),
    );
    for (const date of candidates) {
      if ((await state.getAttribute("data-quota-state")) === "complete") break;
      await page.locator(`[data-holiday="${date}"]`).getByRole("checkbox").click();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    }
    await expect(state).toHaveAttribute("data-quota-state", "complete");

    await page.goto("/");
    await expect(page.locator('[data-role="empty-household"]')).toHaveCount(0);
    await expect(page.locator('[data-role="blocker"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { name: he.status.needsAttention })).toHaveCount(0);

    // **The third household of F52's outline rule, asserted where it exists**
    // (run 8's R8.5). `home-screen.spec.ts` covers the two the seeds can draw
    // — a strip leading and a refusal leading — and this is the third: with
    // neither of those on screen the month itself is what a reader meets, so it
    // carries the `h1`. Rebuilding this household in that file to say so would
    // be this whole wizard again for two assertions.
    const headings = page.locator("h1, h2, h3");
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await headings.first().evaluate((el) => el.tagName)).toBe("H1");
    await page.screenshot({ path: "test-results/home-nothing-outstanding.png" });

    await page.goto("/alerts");
    await expect(page.locator("h1")).toHaveText(he.alerts.title);
    await expect(page.locator('[data-role="alert"][data-list="blockage"]')).toHaveCount(0);
  });
});

test.describe("the December that closes a year (specs.md item 7)", () => {
  // Expected by hand from item 7, not read off the screen: a worker employed
  // from 1 December 2026 is in her first calendar year, which accrues fourteen
  // days a year, so December alone accrues 14 ÷ 12 = 1.1667 days — fewer than
  // seven, so that is what the law asks her to have taken, and she took none.
  // It is a warning and never a blockage: item 7 says it without pressing the
  // point, and item 27 puts it in the bell.
  test("warns of the vacation a worker added that month has not taken", async ({ page }) => {
    await useHousehold(page, "empty", "december-vacation");
    await useToday(page, "2026-12-10");

    await page.goto("/workers/new");
    await page.locator('[data-field="name"]').fill("מריה דה לה קרוס");
    // The step will not be left without a country: it decides her holiday list
    // and the select opens on nothing (`add-worker.spec.ts`).
    await page.locator('[data-field="country"]').selectOption("PH");
    await page.locator('[data-role="add-worker-next"]').click();
    await expect(page.getByRole("heading", { name: he.addWorker.when.title })).toBeVisible();
    await page.locator('[data-field="employedSince"]').fill("2026-12-01");
    await page.locator('[data-role="add-worker-next"]').click();
    await expect(page.getByRole("heading", { name: he.addWorker.pay.title })).toBeVisible();
    await page.locator('[data-field="baseMonthlySalary"]').fill("6443.85");
    await page.locator('[data-role="add-worker-next"]').click();
    await page.locator('[data-role="add-worker-finish"]').click();
    await expect(page).toHaveURL(/\/workers\/[0-9a-f-]+$/);

    const title = he.alerts.entry
      .vacationUnderSeven(2026, "0", "1.17")
      .title.map((part) => (typeof part === "string" ? part : part.value))
      .join("");
    await page.goto("/alerts");
    await expect(
      page.locator('[data-role="alert"][data-list="warning"]').filter({ hasText: title }),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-role="alert"][data-list="blockage"]').filter({ hasText: title }),
    ).toHaveCount(0);
  });
});
