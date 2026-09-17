import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { openPaymentSections, switchToTestWorker } from "./household";
import { monthOf } from "../src/lib/dates";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";
import { todayInIsrael } from "../src/lib/today";

/**
 * Hospital overtime, typed on the payments screen (specs.md item 20).
 *
 * **Every expected figure is worked by hand.** September 2026 for the second
 * demo worker is `income-tax.spec.ts`'s month: a ברוטו of ₪8,602.81. With ₪350
 * typed it is ₪8,952.81, which is ₪107,433.72 a year:
 *
 *    8,412,000 × 10%              =    841,200
 *    2,331,372 × 14%              =    326,392.08
 *                                    ------------
 *                                    1,167,592.08 a year, = 97,299.34 a month
 *
 * less a woman's 2.75 credit points, ₪665.50 a month: 30,749.34, so a tax of
 * **₪307.49**, and a נטו of 8,952.81 − 307.49 = **₪8,645.32**.
 *
 * **What it would catch**: the field saving nothing, or saving to a month other
 * than the one on screen; the amount reaching the ברוטו but not the sheet, or
 * the sheet but not in row 22; and the sheet's ד disagreeing with the payslip.
 */

const RUN = Date.now().toString(36);
const TYPED = 35000;
const GROSS = 895281;
const TAX = 30749;
const ENDED_MONTH = 8;
/** The template's row for it, repeated rather than imported from `layout.ts`,
 * so a browser test cannot follow the map if the map moves. */
const HOSPITAL_ROW = 22;

async function useHousehold(page: Page, label: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "household",
      value: `demo-hospital-${RUN}-${label}`,
      url: "http://localhost:3000",
    },
  ]);
}

async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

/** Types the amount into the payments card for the month on screen. */
async function typeOvertime(page: Page, stepsBack: number): Promise<void> {
  await page.goto("/payments");
  await switchToTestWorker(page);
  for (let i = 0; i < stepsBack; i += 1) {
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
  }
  await openPaymentSections(page);
  const words = he.month.actions.hospitalOvertime;
  const section = page.locator('[data-group="hospitalOvertime"]');
  await section.getByLabel(words.amount).fill("350");
  await section.getByLabel(words.note).fill("שלושה לילות");
  await section.getByRole("button", { name: words.save }).click();
  await settled(page);
  await expect(section).toContainText(formatAgorot(TYPED));
}

function evaluate(sheet: ExcelJS.Worksheet, address: string): number {
  const value = sheet.getCell(address).value;
  if (typeof value === "number") return value;
  if (value === null || typeof value !== "object" || !("formula" in value)) {
    return 0;
  }
  return String(value.formula)
    .split("+")
    .reduce((total, term) => {
      const range = /^SUM\(([A-Z])(\d+):([A-Z])(\d+)\)$/.exec(term);
      if (range === null) return total + evaluate(sheet, term);
      let sum = 0;
      for (let r = Number(range[2]); r <= Number(range[4]); r += 1) {
        sum += evaluate(sheet, `${range[1]}${r}`);
      }
      return total + sum;
    }, 0);
}

test.describe("hospital overtime (specs.md item 20)", () => {
  test("adds the typed ₪350 to September's ברוטו, tax and נטו", async ({ page }) => {
    await useHousehold(page, "month");
    await typeOvertime(page, 0);

    await page.goto("/");
    await switchToTestWorker(page);
    await settled(page);
    await expect(row(page, "gross")).toContainText(formatAgorot(GROSS));
    await expect(row(page, "incomeTax")).toContainText(formatAgorot(-TAX));
    await expect(row(page, "net")).toContainText(formatAgorot(GROSS - TAX));

    await page.screenshot({
      path: "test-results/hospital-overtime-month.png",
      fullPage: true,
    });
  });

  test("puts it on row 22 of August's file, where the payslip lists it too", async ({
    page,
  }) => {
    await useHousehold(page, "export");
    await typeOvertime(page, 1);

    const { year } = monthOf(todayInIsrael());
    await page.goto(
      `/month/payslip?month=${year}-${String(ENDED_MONTH).padStart(2, "0")}`,
    );
    await switchToTestWorker(page);
    await expect(row(page, "hospitalOvertime")).toContainText(formatAgorot(TYPED));
    const grossOnScreen = await row(page, "gross").innerText();

    await page.goto("/month/export");
    await switchToTestWorker(page);
    const questions = page.locator("[data-question]");
    const count = await questions.count();
    for (let i = 0; i < count; i += 1) {
      const question = questions.nth(i);
      // August's one worked holiday is the seed's; everything else is a no.
      const answer =
        (await question.getAttribute("data-question")) === "holidaysWorked"
          ? he.beforeExport.questions.yes
          : he.beforeExport.questions.no;
      await question.getByRole("button", { name: answer, exact: true }).click();
    }
    const button = page.locator("[data-finish]");
    await expect(button).toBeEnabled();
    const download = page.waitForEvent("download");
    await button.click();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(await (await download).path());
    const sheet = workbook.worksheets[0];
    if (sheet === undefined) throw new Error("no sheet");

    expect(sheet.getCell(`B${HOSPITAL_ROW}`).value).toBe(
      'שעות עבודה נוספות במהלך אישפוז בבי"ח',
    );
    expect(sheet.getCell(`G${HOSPITAL_ROW}`).value).toBe(350);
    // The sheet's own ד, as the payslip says it.
    expect(grossOnScreen).toContain(
      formatAgorot(Math.round(evaluate(sheet, "E26") * 100)),
    );
  });
});
