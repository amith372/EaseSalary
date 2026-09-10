import ExcelJS from "exceljs";
import { expect, test, type Download, type Page } from "@playwright/test";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";

/**
 * `דף המשכורת` — stage 2's step 4, and `CLAUDE.md` rules 9 to 12.
 *
 * **The property this file exists for is rule 11: the payslip and the file are
 * one engine result shown twice.** The payslip is the exported sheet's own
 * layout seen on screen, so the check is not that it renders — it is that the
 * four totals it shows are the four totals the workbook holds, read out of the
 * template's own cells. A screen that agreed with the engine while the filler
 * wrote a different cell would pass every unit test in the repository.
 *
 * **The cells come from the template, not from the code under test.**
 * `E23` is `א`, `F24` is `ב`, `G25` is `ג` and `E26` is `ד`, read cell by cell
 * on 2026-09-10 and named in `src/lib/export/layout.ts`. They are written out
 * here rather than imported, so a change to the map has to be made in front of
 * this file too. The transferred total is **found by its label** instead: the
 * block below `ד` grows with the month's own advances and added lines, so its
 * row moves, and a hardcoded row would read a neighbouring figure on a month
 * with one more line — quietly, and plausibly.
 *
 * **`/sheet` was the address the home screen linked and nobody had chosen.** It
 * 404'd from stage 0 until this step, and the first test below is what stops it
 * coming back.
 */

const RUN = Date.now().toString(36);

/** The last month of the demo that has ended, given a `today` in September —
 * the same figure `month-export.spec.ts` names. */
const ENDED = "אוגוסט 2026";
const ENDED_QUERY = "2026-08";
/** September has not ended, so it has no file (item 21). */
const RUNNING_QUERY = "2026-09";

async function useHousehold(page: Page, label: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "household",
      value: `demo-e2e-${RUN}-${label}`,
      url: "http://localhost:3000",
    },
  ]);
}

async function openDownload(download: Download): Promise<ExcelJS.Worksheet> {
  const path = await download.path();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error("the downloaded file has no sheet");
  return sheet;
}

/** The sheet's own formula, evaluated over the sheet's own cells — `exceljs`
 * writes a formula without a value, so a total is only checkable by summing
 * what its range names, which is also the one way a range one row short is
 * caught. The same reader `month-export.spec.ts` uses. */
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
      for (let row = Number(range[2]); row <= Number(range[4]); row += 1) {
        sum += evaluate(sheet, `${range[1]}${row}`);
      }
      return total + sum;
    }, 0);
}

/** A cell said the way the screen says it, so the two are compared at the
 * figure the user reads and never at a float. */
function said(sheet: ExcelJS.Worksheet, address: string): string {
  return formatAgorot(Math.round(evaluate(sheet, address) * 100));
}

/** The transferred total, found by the sheet's own label rather than by a row
 * number that the block's growth moves. */
function transferred(sheet: ExcelJS.Worksheet): string {
  for (let row = 26; row <= 45; row += 1) {
    if (sheet.getCell(`B${row}`).text.includes("בניכוי מקדמה")) {
      return said(sheet, `E${row}`);
    }
  }
  throw new Error("the sheet has no transferred total");
}

/** One row of the payslip, by the engine key it carries. */
function row(page: Page, key: string) {
  return page.locator(`[data-row="${key}"]`);
}

test.describe("the payslip (specs.md item 2, criterion 1)", () => {
  test("is where the home screen's link has always pointed", async ({
    page,
  }) => {
    await useHousehold(page, "home");
    await page.goto("/");
    await page.getByRole("link", { name: he.home.paid.fullSheet }).click();
    // It pointed at `/sheet`, an address nobody had chosen, and 404'd.
    await expect(page).toHaveURL(/\/month\/payslip/);
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText(ENDED);
  });

  test("opens on the latest month that has ended, not the one still running", async ({
    page,
  }) => {
    await useHousehold(page, "default");
    await page.goto("/month/payslip");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(ENDED);
    await expect(page.locator("[data-payslip-export]")).toHaveCount(1);
  });

  test("offers no file for a month that has not ended (item 21)", async ({
    page,
  }) => {
    await useHousehold(page, "running");
    await page.goto(`/month/payslip?month=${RUNNING_QUERY}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "ספטמבר 2026",
    );
    // The route answers 409 for it, so a button here would produce an error
    // page — the defect `/reports` had before the screen read `blocksExport`.
    await expect(page.locator("[data-payslip-export]")).toHaveCount(0);
  });

  test("says the same four totals as the workbook it mirrors (rule 11)", async ({
    page,
  }) => {
    await useHousehold(page, "totals");
    await page.goto(`/month/payslip?month=${ENDED_QUERY}`);

    // Read the screen first, so the comparison is against what the user sees.
    const onScreen = {
      subtotalE: await row(page, "subtotal-E").innerText(),
      subtotalF: await row(page, "subtotal-F").innerText(),
      gross: await row(page, "gross").innerText(),
      net: await row(page, "net").innerText(),
    };

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("[data-payslip-export]").click(),
    ]);
    const sheet = await openDownload(download);

    // Criterion 1's four figures, in the template's own cells.
    expect(onScreen.subtotalE).toContain(said(sheet, "E23"));
    expect(onScreen.subtotalF).toContain(said(sheet, "F24"));
    expect(onScreen.gross).toContain(said(sheet, "E26"));
    expect(onScreen.net).toContain(transferred(sheet));
  });

  test("carries the sheet's own subtotal names, grouped by its columns", async ({
    page,
  }) => {
    await useHousehold(page, "groups");
    await page.goto(`/month/payslip?month=${ENDED_QUERY}`);

    // The month screen groups by kind and the payslip by column (item 5), so
    // the subtotal names here are `he.sheet.subtotals` and not the preview's.
    // A Saturday-resting worker's `F` reads "סך שבתות וחגים".
    await expect(page.locator('[data-column="E"]')).toContainText(
      "סך שכר החודש",
    );
    await expect(page.locator('[data-column="F"]')).toContainText(
      "סך שבתות וחגים",
    );
    // The salary line belongs to E and the rest-day work to F. A screen that
    // grouped them by kind would put the rest-eve supplement beside the rest
    // days, which is what the month screen does and this must not.
    await expect(page.locator('[data-column="E"]')).toContainText(
      "תוספת ימי שישי",
    );
    await expect(page.locator('[data-column="F"]')).toContainText(
      "עבודה בשבת",
    );
  });

  test("names her own rest day in the day counts (item 5)", async ({ page }) => {
    await useHousehold(page, "restday");
    await page.goto(`/month/payslip?month=${ENDED_QUERY}`);
    // Hanna rests on Saturday, so the free-rest-day count says Saturdays. The
    // second worker rests on Friday, and the same row must follow her.
    await expect(page.locator('[data-day-stat="freeRestDays"]')).toContainText(
      "שבתות חופשיות",
    );

    // Switched with the shell's own control, which is how a user changes
    // worker: the switcher is the one place that choice lives.
    await page
      .getByRole("button", { name: he.header.workerSwitcher.next })
      .click();
    await expect(page.locator('[data-day-stat="freeRestDays"]')).toContainText(
      "ימי שישי",
    );
  });

  test("draws a level only where something below it changes the figure", async ({
    page,
  }) => {
    await useHousehold(page, "levels");

    // August withholds income tax and also carries a line placed after the
    // total, so all three levels are real and all three are drawn.
    await page.goto(`/month/payslip?month=${ENDED_QUERY}`);
    await expect(row(page, "gross")).toHaveCount(1);
    await expect(row(page, "afterWithholding")).toHaveCount(1);
    await expect(row(page, "net")).toHaveCount(1);

    // April withholds nothing and repays an advance. **No ברוטו**: with nothing
    // withheld it equals the נטו, and two identical figures under two headings
    // read as an error the family then goes looking for.
    await page.goto("/month/payslip?month=2026-04");
    await expect(row(page, "gross")).toHaveCount(0);
    await expect(row(page, "afterWithholding")).toHaveCount(1);
    await expect(row(page, "net")).toHaveCount(1);

    // January withholds nothing and transfers nothing, so the month closes on
    // one figure.
    await page.goto("/month/payslip?month=2026-01");
    await expect(row(page, "gross")).toHaveCount(0);
    await expect(row(page, "afterWithholding")).toHaveCount(0);
    await expect(row(page, "net")).toHaveCount(1);
  });

  /**
   * **The bottom figure's own name, which is not always the same name** (the
   * user on 2026-09-10). `סך הכל תשלום לעובד/ת` is the name of a *difference* —
   * what is left after the advances and after a line placed below the total —
   * so a month with no such difference is not made to carry it and is called
   * `נטו`, which is what `/reports` has always called it.
   *
   * **What it catches:** the disagreement it replaces. The payslip labelled
   * every month's bottom figure `סך הכל תשלום לעובד/ת` unconditionally, so
   * January appeared under one name here and under `נטו` on `/reports` while
   * being one figure. A regression to the unconditional label fails on January;
   * naming every month `נטו` instead fails on August, where the two figures are
   * genuinely two.
   */
  test("names the bottom figure by whether anything was transferred", async ({
    page,
  }) => {
    await useHousehold(page, "bottom");

    // August transfers — it carries a line placed after the total — so both
    // names are real, each over its own figure.
    await page.goto(`/month/payslip?month=${ENDED_QUERY}`);
    await expect(row(page, "net")).toContainText(he.payslip.total);
    await expect(row(page, "afterWithholding")).toContainText(
      he.month.preview.afterWithholding,
    );

    // The tint block at the head of the screen answers the same way, and it
    // was the one place the levels rule had been missed: it drew a ברוטו on
    // every month, so January printed one number twice under two headings.
    const headline = page.locator("[data-payslip-total]").locator("xpath=..");
    await expect(headline).toContainText(he.payslip.total);
    const block = page.locator("[data-payslip-total]").locator("xpath=../..");
    await expect(block).toContainText(he.month.preview.gross);

    // April repays an advance, so it transfers too and keeps both names.
    await page.goto("/month/payslip?month=2026-04");
    await expect(row(page, "net")).toContainText(he.payslip.total);

    // January transfers nothing. One figure, and its name is `נטו`.
    await page.goto("/month/payslip?month=2026-01");
    await expect(row(page, "net")).toContainText(
      he.month.preview.afterWithholding,
    );
    await expect(row(page, "net")).not.toContainText(he.payslip.total);

    const january = page.locator("[data-payslip-total]").locator("xpath=..");
    await expect(january).toContainText(he.month.preview.afterWithholding);
    await expect(
      page.locator("[data-payslip-total]").locator("xpath=../.."),
    ).not.toContainText(he.month.preview.gross);
  });

  test("shows the balance and the days that produced it (criterion 2)", async ({
    page,
  }) => {
    await useHousehold(page, "balances");
    await page.goto(`/month/payslip?month=${ENDED_QUERY}`);
    // A balance with no days behind it cannot be checked, which is why the
    // criterion asks for both.
    const vacation = page.locator('[data-after="vacation"]');
    await expect(vacation).toContainText(he.home.balances.vacation);
    await expect(vacation).toContainText(he.sheet.reporting.daysUsed);
    await expect(page.locator('[data-after="sick"]')).toContainText(
      he.home.balances.sick,
    );
  });
});
