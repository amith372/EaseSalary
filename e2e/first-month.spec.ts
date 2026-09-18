import ExcelJS from "exceljs";
import { expect, test, type Download, type Page } from "@playwright/test";
import { useHousehold, TODAY } from "./household";
import { he } from "../src/lib/i18n/he";
import { addMonths, monthOf, yearMonthText } from "../src/lib/dates";
import { monthLabel } from "../src/lib/dateLabels";
import { formatAgorot } from "../src/lib/money";
import type { YearMonth } from "../src/lib/types";

/**
 * A worker added in the middle of her employment — `specs.md` items 6 and 15,
 * through the wizard, the opening screen and the export (`CLAUDE.md` rules 10–13).
 *
 * **The scenario.** She is added this month with last month as her first
 * month, so the first month is one nobody ever opened: no mark, no figure and
 * no record of it exists until it is confirmed for export. Her employment
 * began 28 months before the first month, and her recuperation month is the
 * month before the first — so the payment for the employment year running at
 * the first month fell before the application saw her, and the wizard asks
 * whether it was paid.
 *
 * **Every expected figure is worked by hand** (rule 11):
 *
 * - The employment year running at the first month began 24 months after she
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
