import ExcelJS from "exceljs";
import { expect, test, type Download, type Page } from "@playwright/test";
import { useHousehold, TODAY } from "./household";
import { he, type Said } from "../src/lib/i18n/he";
import { addMonths, monthOf, SATURDAY, yearMonthText } from "../src/lib/dates";
import { monthLabel } from "../src/lib/dateLabels";
import { formatAgorot } from "../src/lib/money";
import type { YearMonth } from "../src/lib/types";

/**
 * A worker added in the middle of their employment — `specs.md` items 6 and 15,
 * through the wizard, the opening screen and the export (`CLAUDE.md` rules 10–13).
 *
 * **The scenario.** They are added this month with last month as their first
 * month, so the first month is one nobody ever opened: no mark, no figure and
 * no record of it exists until it is confirmed for export. Their employment
 * began 28 months before the first month, and their recuperation month is the
 * month before the first — so the payment for the employment year running at
 * the first month fell before the application saw them, and the wizard asks
 * whether it was paid.
 *
 * **Every expected figure is worked by hand** (rule 11):
 *
 * - The employment year running at the first month began 24 months after they
 *   was hired, so two full years are complete by the payment month, and the
 *   statutory ladder gives six days for a second completed year
 *   (https://www.kolzchut.org.il/he/דמי_הבראה).
 * - ₪451.50 is the same article's private-sector day rate from 1.7.2025, the
 *   only row the seeded table holds. 6 × ₪451.50 = ₪2,709.00.
 * - ₪6,443.85 is the minimum wage from 1.4.2026, read out of the family's 2026
 *   workbook (`SEEDED_RATES`); the salary typed is exactly it. This holds while
 *   the first month is April 2026 or later.
 *
 * **What it would catch**: a first month the arrows can step past; an unopened
 * month the export route cannot find; a month opened at an invented wage; the
 * wizard's answer about recuperation not reaching the profile, so a payment
 * already made is paid twice, or one never made is lost.
 */

const MINIMUM_WAGE = 644385;
const RECUPERATION = 270900;
const BASE_ROW = 6;
const RECUPERATION_ROW = 18;

/** The first month: the month before today's. */
const FIRST: YearMonth = addMonths(monthOf(TODAY), -1);
const HIRED: YearMonth = addMonths(FIRST, -28);
const RECUPERATION_MONTH = addMonths(FIRST, -1).month;

let households = 0;

test.beforeEach(async ({ page }) => {
  households += 1;
  await useHousehold(page, "empty", `first${households}`);
});

async function addWorker(page: Page, recuperationPaid: boolean): Promise<void> {
  await page.goto("/workers/new");
  await page.locator('[data-field="name"]').fill("רוזה למפה");
  // Chosen, because the step will not be left without it: the country decides
  // their holiday list and the select opens on nothing. `PH` is one of the lists
  // in `data/holidays/`, which is where the wizard's options come from.
  await page.locator('[data-field="country"]').selectOption("PH");
  await page.locator('[data-role="add-worker-next"]').click();
  await expect(page.getByRole("heading", { name: he.addWorker.when.title })).toBeVisible();

  await page.locator('[data-field="employedSince"]').fill(`${yearMonthText(HIRED)}-01`);
  await page.locator('[data-field="recuperationMonth"]').selectOption(String(RECUPERATION_MONTH));
  await page
    .locator('[data-choice="firstMonth"]')
    .getByRole("button", { name: monthLabel(FIRST) })
    .click();

  const opening = page.locator('[data-role="opening-position"]');
  await expect(opening).toBeVisible();
  await page.locator('[data-field="openingVacationDays"]').fill("12");
  await page.locator('[data-field="openingSickDays"]').fill("30");
  await opening
    .locator('[data-choice="recuperationPaid"]')
    .getByRole("button", {
      name: recuperationPaid ? he.addWorker.when.opening.yes : he.addWorker.when.opening.no,
      exact: true,
    })
    .click();
  if (recuperationPaid) {
    // It opens at the month the payment was due.
    await expect(page.locator('[data-field="recuperationPaidIn"]')).toHaveValue(
      yearMonthText(addMonths(FIRST, -1)),
    );
  }
  await opening
    .getByRole("button", { name: he.workers.profile.terms.opening.addAdvance })
    .click();
  await page.locator('[data-field="openingAdvancePrincipal"]').fill("1000");
  await page.locator('[data-field="openingAdvanceRepaid"]').fill("400");
  await page.locator('[data-role="add-worker-next"]').click();

  await expect(page.getByRole("heading", { name: he.addWorker.pay.title })).toBeVisible();
  await page.locator('[data-field="baseMonthlySalary"]').fill("6443.85");
  await page
    .locator('[data-choice="incomeTax"]')
    .getByRole("button", { name: he.workers.profile.terms.incomeTax.none })
    .click();
  await page.locator('[data-role="add-worker-next"]').click();
  await expect(page.locator('[data-role="add-worker-done"]')).toBeVisible();
}

/** The workbook that arrived in the browser's downloads. */
async function openDownload(download: Download): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error("the downloaded file has no sheet");
  return sheet;
}

function said(sheet: ExcelJS.Worksheet, address: string): string | null {
  const value = sheet.getCell(address).value;
  return typeof value === "number" ? formatAgorot(Math.round(value * 100)) : null;
}

/** Confirm the first month and take its file. Nothing was marked, so every
 * question is answered no. */
async function exportFirstMonth(page: Page): Promise<ExcelJS.Worksheet> {
  await page.goto("/month/export");
  await expect(page.locator("h1")).toContainText(monthLabel(FIRST));
  const questions = page.locator("[data-question]");
  for (let index = 0; index < (await questions.count()); index += 1) {
    await questions
      .nth(index)
      .getByRole("button", { name: he.beforeExport.questions.no, exact: true })
      .click();
  }
  const button = page.locator("[data-finish]");
  await expect(button).toBeEnabled();
  const download = page.waitForEvent("download");
  await button.click();
  return openDownload(await download);
}

test("the arrows stop at her first month", async ({ page }) => {
  await addWorker(page, true);
  await page.goto("/");
  const back = page.getByRole("button", { name: he.calendar.previousMonth });
  await back.click();
  // Read between the arrows, since a blocker on the same screen may name the
  // month too.
  const stepper = page.locator("div", { has: back }).last();
  await expect(stepper.getByText(monthLabel(FIRST))).toBeVisible();
  await expect(back).toBeDisabled();
  // An ordinary month, calculated, although nobody opened it.
  await expect(page.locator('[data-row="net"]')).toBeVisible();
  await page.screenshot({ path: "test-results/first-month-home.png", fullPage: true });
});

test("a recuperation already paid is not paid again, and the opening position is kept", async ({
  page,
}) => {
  await addWorker(page, true);

  await page.goto("/settings");
  await expect(page.locator('[data-terms="opening"] input').first()).toHaveValue("12");
  await expect(page.locator('[data-opening-advance="1"]')).toContainText(formatAgorot(100000));

  const sheet = await exportFirstMonth(page);
  expect(String(sheet.getCell("C1").value)).toContain(he.calendar.monthNames[FIRST.month - 1]);
  expect(said(sheet, `E${BASE_ROW}`)).toBe(formatAgorot(MINIMUM_WAGE));
  expect(said(sheet, `G${RECUPERATION_ROW}`)).toBeNull();
});

test("a recuperation not yet paid is paid in her first month, in the file and on the payslip", async ({
  page,
}) => {
  await addWorker(page, false);

  await page.goto(`/month/payslip?month=${yearMonthText(FIRST)}`);
  await expect(page.locator('[data-row="recuperation"]')).toContainText(formatAgorot(RECUPERATION));

  await page.screenshot({ path: "test-results/first-month-before-export.png", fullPage: true });
  const sheet = await exportFirstMonth(page);
  expect(said(sheet, `E${BASE_ROW}`)).toBe(formatAgorot(MINIMUM_WAGE));
  expect(said(sheet, `G${RECUPERATION_ROW}`)).toBe(formatAgorot(RECUPERATION));
  await page.screenshot({ path: "test-results/first-month-after-export.png", fullPage: true });
});

/**
 * **A worker entered in the middle of a year they were already employed**
 * (item 6, the user's decision of 2026-10-11).
 *
 * **The scenario.** A family signs up on 18.9.2026 with a caregiver they have
 * employed since 1.6.2025, and takes the third choice on the wizard's "from
 * which month" step: מאז ינואר 2026. The two choices beside it are the ones
 * item 6 has always offered and create nothing.
 *
 * **Every expected figure is the rule applied to a calendar** (rule 11). The
 * rule settled on 2026-10-11 is January of the year they are added in, so the
 * months created run January through August 2026 — eight of them, the month
 * they are added in excluded because it has not ended. Three days marked in
 * one of them take three days off the vacation balance, which is item 7: a day
 * drawn from the balance is a day the worker would otherwise have attended.
 * 10–12 March 2026 are a Tuesday, a Wednesday and a Thursday (1.3.2026 is a
 * Sunday), so none of them is the weekly rest day and all three are drawn.
 *
 * **What it would catch.** The months not created at all, which is the state
 * before this; created as drafts, which would be eight blockages on a family's
 * first screen rather than a year caught up; created and then *not* editable,
 * which would make the whole choice a decoration — the three days are marked
 * through the ordinary calendar and the balance is read off the ordinary card.
 */
test("a worker employed since last year arrives with this year's months behind her", async ({
  page,
}) => {
  await page.goto("/workers/new");
  await page.locator('[data-field="name"]').fill("אנה ריאס");
  await page.locator('[data-field="country"]').selectOption("PH");
  await page.locator('[data-role="add-worker-next"]').click();
  await expect(page.getByRole("heading", { name: he.addWorker.when.title })).toBeVisible();

  await page.locator('[data-field="employedSince"]').fill("2025-06-01");
  await page.locator('[data-field="recuperationMonth"]').selectOption("6");

  // The third chip, which says what it does rather than naming a month like
  // the two beside it.
  const january: YearMonth = { year: 2026, month: 1 };
  await page
    .locator('[data-choice="firstMonth"]')
    .getByRole("button", {
      name: `${he.addWorker.when.firstMonthSince}${monthLabel(january)}`,
    })
    .click();

  // **The consequence is said at the control, before the press**: eight months,
  // what they will be confirmed at, and that they are empty.
  await expect(page.locator('[data-role="first-month-creates"]')).toContainText("8");

  // The opening position is still asked, because the employment began before
  // January — but nothing of this year came before it, so the days-used
  // question is not there (item 6).
  await page.locator('[data-field="openingVacationDays"]').fill("0");
  await page.locator('[data-field="openingSickDays"]').fill("0");
  await page.locator('[data-role="add-worker-next"]').click();

  await expect(page.getByRole("heading", { name: he.addWorker.pay.title })).toBeVisible();
  await page.locator('[data-field="baseMonthlySalary"]').fill("6443.85");
  await page
    .locator('[data-choice="incomeTax"]')
    .getByRole("button", { name: he.workers.profile.terms.incomeTax.none })
    .click();
  await page.locator('[data-role="add-worker-next"]').click();
  await expect(page.locator('[data-role="add-worker-done"]')).toBeVisible();
  await page.locator('[data-role="add-worker-finish"]').click();
  await expect(page).toHaveURL(/\/workers\/[0-9a-f-]+$/);
  const workerPage = page.url();

  // January through August created, and September drawn with them because the
  // list runs to the current month whether or not anything is recorded in it.
  const created = [
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
  ];
  const months = await page
    .locator("[data-month]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-month")));
  expect(months).toEqual([...created, "2026-09"]);

  // **The eight are confirmed and not drafts**, which is the whole of why they
  // are created this way: a draft whose month has ended is a blockage (item
  // 27), so eight drafts would be eight things wrong on a family's first
  // screen.
  for (const month of created) {
    await expect(
      page.locator(`[data-month="${month}"] [data-state]`),
    ).toHaveAttribute("data-state", "confirmed");
  }
  // September is the month they are in and is left alone: it has not ended,
  // and it is the one the family will actually fill in.
  await expect(
    page.locator('[data-month="2026-09"] [data-state]'),
  ).not.toHaveAttribute("data-state", "confirmed");

  // **And nothing is outstanding**: not the eight months unconfirmed, and not
  // the eight files never produced from them. Read as two counts rather than
  // as an empty page, because a brand-new worker has warnings of their own —
  // no document dates, for one — and this is about the months.
  await page.goto("/alerts");
  // Asserted by what the two entries say rather than by an empty page: a
  // brand-new worker raises warnings of their own, and this is about the eight.
  await expect(
    page.getByText(sentence(he.alerts.entry.monthsUnconfirmed(8, "").title)),
  ).toHaveCount(0);
  await expect(
    page.getByText(sentence(he.alerts.entry.monthsNotExported(8).title)),
  ).toHaveCount(0);
  for (const month of created) {
    const label = monthLabel({
      year: Number(month.slice(0, 4)),
      month: Number(month.slice(5)),
    });
    await expect(
      page.getByText(sentence(he.alerts.entry.monthUnconfirmed(label).title)),
    ).toHaveCount(0);
    await expect(
      page.getByText(sentence(he.alerts.entry.monthNotExported(label).title)),
    ).toHaveCount(0);
  }

  await page.goto(workerPage);
  const vacation = page.locator('[data-balance="vacation"]');
  const before = await vacation.textContent();

  // **A created month is an ordinary month.** Three days of March marked
  // through the calendar the family would use, and the balance moves by three.
  await page.goto("/?month=2026-03");
  await page.locator('[data-date="2026-03-10"]').click();
  await page.locator('[data-date="2026-03-12"]').click();
  await page
    .getByRole("button", { name: he.calendar.marks(SATURDAY).vacation, exact: true })
    .click();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

  await page.goto(workerPage);
  await expect(page.locator('[data-month="2026-03"] [data-state]')).toHaveAttribute(
    "data-state",
    "corrected",
  );
  const after = await vacation.textContent();
  expect(daysIn(after)).toBeCloseTo(daysIn(before) - 3, 2);

  await page.screenshot({ path: "test-results/first-month-caught-up.png", fullPage: true });
});

/** The number on a balance card, as a number: the card draws days and the
 * assertion is arithmetic on them. */
function daysIn(text: string | null): number {
  const digits = (text ?? "").match(/[\d.]+/);
  if (digits === null) throw new Error(`no figure in ${JSON.stringify(text)}`);
  return Number(digits[0]);
}

/** A sentence from `he.ts` as the screen reads it, each figure in its own
 * isolate on the page and all of it one run of text here. `said` above is this
 * file first use of the word, for a cell of the exported sheet. */
function sentence(parts: Said): string {
  return parts.map((part) => (typeof part === "string" ? part : part.value)).join("");
}
