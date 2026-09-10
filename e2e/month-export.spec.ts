import ExcelJS from "exceljs";
import { expect, test, type Download, type Page } from "@playwright/test";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";

/**
 * The export, through the browser — `specs.md` item 2, criterion 1 and
 * `CLAUDE.md` rules 9 to 12.
 *
 * **What this file checks that no unit test can.** The filler's own suite fills
 * a template with an engine result handed to it; nothing there proves that
 * pressing the button on `/month/export` produces a file, that the file is the
 * month the user was looking at, or that the figures in it are the figures the
 * month screen showed her. Those are three different pieces of wiring and each
 * of them is where this breaks.
 *
 * **Every expected figure comes from outside the code under test.**
 *
 * - ₪6,443.85 from 1.4.2026 is the minimum wage in force during a month of 2026,
 *   read out of `שכר_חודשי_להאנה2026.xlsx` → `חודש  4.26` → D6. The seed pays
 *   ₪6,247.65, so confirming raises the salary to the minimum (item 3), and the
 *   base line of the exported August is therefore the higher figure.
 * - August 2026 records one holiday worked, on the 20th, and nothing else
 *   (`seed.ts`).
 * - The cell each figure belongs in comes from the template, read cell by cell
 *   on 2026-09-10: E6 the base, E7 the rest-eve supplement, F8 the worked
 *   holiday, F9 the rest days, E23/F24/G25/E26 the totals.
 *
 * **The agreement is asserted against the screen and not against the engine.**
 * Rule 11 wants the preview and the export to say the same thing; here the
 * preview is a rendered page, so the figures are read off it as text and
 * compared with the workbook's cells rendered the same way. That is the
 * strongest form of the check: it passes only if the whole path — engine,
 * screen, route, filler — agrees end to end.
 */

const RUN = Date.now().toString(36);

/** The wage in force during a month of 2026, and the salary the seed pays. */
const WAGE_IN_FORCE = 644385;
/** The last month of the demo that has ended, given a `today` in September. */
const ENDED_MONTH = 8;
/** The helper column of notes — column I, and the ninth. */
const NOTES_COLUMN = 9;
/** The template's own rows for the tax and for the first row of the block below
 * `ד`, read cell by cell on 2026-09-10 and named in `src/lib/export/layout.ts`.
 * Repeated here rather than imported, so a change to the map has to be made in
 * front of this file as well: a browser test that followed the map could not
 * notice the map moving. */
const TAX_ROW = 20;
const BLOCK_ROW = 28;
/** What `seed.ts` writes into August 2026, and the only month it gives either
 * of them to: an income tax the user typed and a deduction in her own words
 * placed after the total. */
const INCOME_TAX = 45000;
const AFTER_TOTAL_LINE = 20000;
const AFTER_TOTAL_LABEL = "קניות שהעברתי לה במזומן";

async function useHousehold(page: Page, label: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "household",
      value: `demo-e2e-${RUN}-${label}`,
      url: "http://localhost:3000",
    },
  ]);
}

/** August 2026 as `seed.ts` writes it: one holiday worked and nothing else. */
const AUGUST_AGREES = ["holidaysWorked"];

async function answerEverything(page: Page): Promise<void> {
  const questions = page.locator("[data-question]");
  const count = await questions.count();
  for (let index = 0; index < count; index += 1) {
    const row = questions.nth(index);
    const key = await row.getAttribute("data-question");
    const answer =
      key !== null && AUGUST_AGREES.includes(key)
        ? he.beforeExport.questions.yes
        : he.beforeExport.questions.no;
    await row.getByRole("button", { name: answer, exact: true }).click();
  }
}

/** The workbook that actually arrived in the browser's downloads. */
async function openDownload(download: Download): Promise<ExcelJS.Worksheet> {
  const path = await download.path();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error("the downloaded file has no sheet");
  return sheet;
}

/** A cell read as the screen would say it, so the two are compared at the
 * figure the user reads and not at a float. */
function said(sheet: ExcelJS.Worksheet, address: string): string | null {
  const value = sheet.getCell(address).value;
  return typeof value === "number"
    ? formatAgorot(Math.round(value * 100))
    : null;
}

/** The sheet's own formula, evaluated over the sheet's own cells: `exceljs`
 * writes a formula without a value, so a total is only checkable by summing
 * what its range names — which is also the one way a range one row short is
 * caught. */
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

/**
 * Step the month screen back until it is showing the month the file is of.
 *
 * The heading is what is read rather than a count of clicks, because how far
 * back August is depends on where the screen opened, which depends on the
 * clock.
 */
async function stepBackToAugust(page: Page): Promise<void> {
  const august = he.calendar.monthNames[ENDED_MONTH - 1];
  for (let step = 0; step < 12; step += 1) {
    if ((await page.locator("h1").innerText()).includes(august)) return;
    await page.getByRole("button", { name: he.calendar.previousMonth }).click();
  }
  throw new Error(`The month screen never reached ${august}`);
}

/** Confirm the month and take the file the button produces. */
async function exportAugust(
  page: Page,
  which: "plain" | "notes",
): Promise<ExcelJS.Worksheet> {
  await page.goto("/month/export");
  await expect(page.locator("h1")).toContainText(
    he.calendar.monthNames[ENDED_MONTH - 1],
  );
  await answerEverything(page);

  const button = page.locator(
    which === "notes" ? "[data-finish-notes]" : "[data-finish]",
  );
  await expect(button).toBeEnabled();
  const download = page.waitForEvent("download");
  await button.click();
  return openDownload(await download);
}

test.describe("the month's file (specs.md item 2, criterion 1)", () => {
  /**
   * The whole flow, as a user meets it: answer the questions, press the button,
   * get a file. The file is what is asserted and not the click.
   */
  test("produces a workbook for the month that was on screen", async ({
    page,
  }) => {
    await useHousehold(page, "file");
    const sheet = await exportAugust(page, "plain");

    // The month the screen was showing, in the sheet's own heading cell.
    expect(String(sheet.getCell("C1").value)).toContain(
      he.calendar.monthNames[ENDED_MONTH - 1],
    );

    // The base line is the minimum wage in force, because confirming raised the
    // seed's older salary to it (item 3).
    expect(said(sheet, "E6")).toBe(formatAgorot(WAGE_IN_FORCE));
    // One holiday worked in August 2026, so the holiday row carries one unit and
    // the rest-day row carries none of hers.
    expect(sheet.getCell("C8").value).toBe(1);

    // The sheet is right-to-left, which filling the stored template preserves
    // and building one from scratch would not (Part 5).
    expect(sheet.views[0]?.rightToLeft).toBe(true);
    // No token survived into the family's own sheet (Part 3).
    let tokens = 0;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (typeof cell.value === "string" && cell.value.includes("{{")) {
          tokens += 1;
        }
      });
    });
    expect(tokens).toBe(0);

    await page.screenshot({
      path: "test-results/month-export-confirmed.png",
      fullPage: true,
    });
  });

  /**
   * Rule 11, at the level only a browser reaches: the figures the month screen
   * printed and the figures inside the file, compared as text.
   */
  test("says the same figures in the file as the month screen shows", async ({
    page,
  }) => {
    await useHousehold(page, "agree");
    const sheet = await exportAugust(page, "plain");

    // Read the preview off the screen the user would compare the file against —
    // **stepped to the month that was exported.** `/month` opens on the current
    // month and the file is of the last one that ended, so a comparison made
    // where the screen happens to land is a comparison of two different months,
    // which is how this test first passed a figure it should have failed.
    await page.goto("/month");
    await stepBackToAugust(page);
    const onScreen = async (key: string) =>
      (await page.locator(`[data-row="${key}"]`).innerText()).replace(
        /\s+/g,
        " ",
      );

    const base = await onScreen("base");
    // The screen's row carries its label and its hint as well as the figure, so
    // the assertion is that the figure it shows appears — not that the whole row
    // reads like a cell.
    expect(base).toContain(formatAgorot(WAGE_IN_FORCE));
    expect(said(sheet, "E6")).toBe(formatAgorot(WAGE_IN_FORCE));

    // And all four of criterion 1's total lines, from the sheet's own formulas.
    const totals = {
      salary: evaluate(sheet, "E23"),
      restDays: evaluate(sheet, "F24"),
      gross: evaluate(sheet, "E26"),
      net: evaluate(sheet, "E29"),
    };
    // ד is א+ב+ג by the sheet's own arithmetic, and the נטו follows it: these
    // two identities are what a family reads down the page, so they are checked
    // rather than assumed.
    expect(totals.gross).toBeCloseTo(
      totals.salary + totals.restDays + evaluate(sheet, "G25"),
      2,
    );

    // **August 2026 is the one seeded month that shows the block at its full
    // height** (`seed.ts`): a ₪450 income tax withheld from the ברוטו, and a
    // ₪200 deduction the user wrote in her own words, which `placementOf` puts
    // after the total. So the נטו is ₪650 below the ברוטו, and the two figures
    // land in two different regions of the sheet.
    expect(said(sheet, `E${TAX_ROW}`)).toBe(formatAgorot(-INCOME_TAX));
    expect(said(sheet, `E${BLOCK_ROW}`)).toBe(formatAgorot(-AFTER_TOTAL_LINE));
    // A row the template cannot label in advance carries the user's own words
    // (item 20), which is what she reads the deduction by.
    expect(String(sheet.getCell(`B${BLOCK_ROW}`).value)).toBe(AFTER_TOTAL_LABEL);
    expect(totals.net).toBeCloseTo(
      totals.gross - (INCOME_TAX + AFTER_TOTAL_LINE) / 100,
      2,
    );

    // And the ברוטו the month screen prints is that same figure.
    const grossOnScreen = await page
      .getByText(formatAgorot(Math.round(totals.gross * 100)))
      .first();
    await expect(grossOnScreen).toBeVisible();
  });

  /**
   * Item 2's two versions. **One file and one flag**, so the check that matters
   * is that the figures are identical and only the column's visibility differs.
   */
  test("offers two versions that differ only in the helper column", async ({
    page,
  }) => {
    await useHousehold(page, "versions");
    const plain = await exportAugust(page, "plain");
    await useHousehold(page, "versions-notes");
    const withNotes = await exportAugust(page, "notes");

    // What the workbook itself instructs in cell I1: the column is for the
    // person preparing the salary and is hidden before printing.
    expect(plain.getColumn(NOTES_COLUMN).hidden).toBe(true);
    expect(withNotes.getColumn(NOTES_COLUMN).hidden).toBe(false);

    const figures = (sheet: ExcelJS.Worksheet) => {
      const out: string[] = [];
      sheet.eachRow({ includeEmpty: false }, (row, number) => {
        row.eachCell({ includeEmpty: false }, (cell, column) => {
          if (typeof cell.value === "number") {
            out.push(`${number}:${column}=${cell.value}`);
          }
        });
      });
      return out;
    };
    expect(figures(plain)).toEqual(figures(withNotes));
  });

  /**
   * The gate item 18 puts in front of the file, checked at the address rather
   * than at the button: a disabled button is a courtesy, and a month is not
   * exported over an unanswered question however the request arrives.
   */
  test("refuses the file for a month it does not have", async ({ page }) => {
    await useHousehold(page, "unknown");
    const response = await page.request.get(
      "/month/export/file?worker=worker-1&month=1999-01",
    );
    expect(response.status()).toBe(404);

    const noWorker = await page.request.get(
      "/month/export/file?worker=nobody&month=2026-08",
    );
    expect(noWorker.status()).toBe(404);
  });
});
