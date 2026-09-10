import ExcelJS from "exceljs";
import { expect, test, type Download, type Page } from "@playwright/test";
import { he } from "../src/lib/i18n/he";
import { formatAgorot } from "../src/lib/money";

/**
 * The `דוחות` screen and the four files it offers — stage 2's step 3, and
 * `CLAUDE.md` rules 9 to 12.
 *
 * **What this checks that no unit test can.** The report builders' own suite
 * hands them a series and reads the rows back; nothing there proves that the
 * screen offers a link, that the link produces a file, or that the file says
 * what the screen said. Those are three pieces of wiring and each is where this
 * breaks — and one of them did: on 2026-09-10 the hero's green button pointed
 * at September 2026, a month that has not ended, and the route answered 409.
 * The screen and the route disagreed about which months have a file, and no
 * type, lint or unit test could reach it.
 *
 * **Every expected figure comes from outside the code under test.** ₪2,709.00
 * for six days of recuperation in July 2026 is item 15's ladder — a second
 * completed employment year pays six days — at the ₪451.50 the user confirms,
 * and it is the figure `build_plan.md` already records from the family's own
 * confirmation screen. The salary totals are read off the screen as text and
 * compared with the workbook's own cells, which is rule 11's agreement asserted
 * at the figure the user actually reads.
 */

const RUN = Date.now().toString(36);

/** July 2026 is the demo's recuperation month, and the second completed
 * employment year pays six days at ₪451.50 (specs.md item 15). */
const RECUPERATION_MONTH = "יולי 2026";
const RECUPERATION_DAYS = 6;
const RECUPERATION_AGOROT = 270900;

/** The last month of the demo that has ended, given a `today` in September —
 * the same figure `month-export.spec.ts` names, and the month the hero must
 * therefore offer rather than September. */
const ENDED_MONTH = "אוגוסט 2026";

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

/** A cell read the way the screen says it, so the two are compared at the
 * figure the user reads and never at a float. */
function said(sheet: ExcelJS.Worksheet, address: string): string | null {
  const value = sheet.getCell(address).value;
  return typeof value === "number" ? formatAgorot(Math.round(value * 100)) : null;
}

test.describe("the reports screen (item 23, item 29)", () => {
  test("reaches /reports from the nav rather than 404ing", async ({ page }) => {
    await useHousehold(page, "nav");
    await page.goto("/");
    await page.getByRole("link", { name: he.nav.reports, exact: true }).click();
    await expect(page).toHaveURL(/\/reports$/);
    await expect(
      page.getByRole("heading", { name: he.reports.title, level: 1 }),
    ).toBeVisible();
  });

  test("offers the latest month that has ended, and not the one still running", async ({
    page,
  }) => {
    await useHousehold(page, "hero");
    await page.goto("/reports");

    // The defect this exists for: the hero pointed at September 2026 and its
    // button returned 409, because the month had not ended (item 21).
    await expect(
      page.getByRole("heading", { level: 2 }).first(),
    ).toContainText(ENDED_MONTH);

    // And the row for the month still running says why it has no file, rather
    // than offering a link that fails.
    const september = page.locator('[data-report-month="2026-9"]');
    await expect(september).toContainText(
      he.reports.previousMonths.blocked.monthNotEnded,
    );
    await expect(
      september.getByRole("link", { name: he.reports.previousMonths.excel }),
    ).toHaveCount(0);
  });

  test("shows a figure only where it says something the others do not", async ({
    page,
  }) => {
    await useHousehold(page, "figures");
    await page.goto("/reports");

    const figures = async (month: string) =>
      page
        .locator(`[data-report-month="${month}"] [data-figure]`)
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-figure")),
        );

    // **`נטו` is always drawn and the other two only when they differ.** August
    // withholds income tax and also carries a line below the total, so all
    // three figures say something different and all three appear.
    expect(await figures("2026-8")).toEqual([
      "gross",
      "afterWithholding",
      "net",
    ]);

    // April withholds nothing and repays an advance: no `ברוטו`, because with
    // nothing withheld it is the same number as the `נטו`.
    expect(await figures("2026-4")).toEqual(["afterWithholding", "net"]);

    // January does neither, so one figure. A row that printed all three here
    // would print one number three times under three headings — the defect
    // this test exists for, and one that reads as an error the family then
    // goes looking for.
    expect(await figures("2026-1")).toEqual(["afterWithholding"]);
  });

  test("says the same yearly figures in the file as the screen shows", async ({
    page,
  }) => {
    await useHousehold(page, "yearly");
    await page.goto("/reports");

    // Read off the rendered page first, so the comparison is against what the
    // user sees and not against another call into the engine (rule 11).
    const august = page.locator('[data-report-month="2026-8"]');
    const onScreen = (await august.innerText()).replace(/\s+/g, " ");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('[data-report="yearlySalary"]').click(),
    ]);
    const sheet = await openDownload(download);

    // Row 3 heads the columns, so August 2026 is the eighth month's row.
    expect(sheet.getCell("A11").text).toBe(ENDED_MONTH);
    const gross = said(sheet, "B11");
    const net = said(sheet, "C11");
    expect(gross).not.toBeNull();
    expect(onScreen).toContain(gross ?? "");
    expect(onScreen).toContain(net ?? "");
  });

  test("writes the recuperation the family's own screen confirmed", async ({
    page,
  }) => {
    await useHousehold(page, "recuperation");
    await page.goto("/reports");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('[data-report="recuperation"]').click(),
    ]);
    const sheet = await openDownload(download);

    expect(sheet.getCell("A4").text).toBe(RECUPERATION_MONTH);
    // Two completed employment years, six days, ₪2,709.00 — item 15's ladder
    // and the confirmed day rate, neither read back from the engine.
    expect(sheet.getCell("B4").value).toBe(2);
    expect(sheet.getCell("C4").value).toBe(RECUPERATION_DAYS);
    expect(said(sheet, "D4")).toBe(formatAgorot(RECUPERATION_AGOROT));
  });

  test("keeps the balances template's two blocks and its own words", async ({
    page,
  }) => {
    await useHousehold(page, "balances");
    await page.goto("/reports");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('[data-report="balances"]').click(),
    ]);
    const sheet = await openDownload(download);

    // Item 23: vacation and sickness kept separate, a row per month. The two
    // headings are the template's own, so a file that lost them is a file the
    // payslip preparer cannot read.
    expect(sheet.getCell("B1").text).toBe("חופשת מחלה- צבירה וניצול");
    expect(sheet.getCell("B18").text).toBe("חופשה שנתית - צבירה וניצול");
    expect(sheet.getCell("A4").text).toBe("ינואר 2026");
    expect(sheet.getCell("A21").text).toBe("ינואר 2026");
    // The two blocks must not hold the same figures: sick accrues 1.5 a month
    // and vacation fourteen twelfths, so a file that filled one block twice
    // would print 1.5 in both (items 7, 8).
    expect(sheet.getCell("C4").value).toBeCloseTo(1.5, 10);
    expect(sheet.getCell("C21").value).toBeCloseTo(14 / 12, 10);
    // Part 5: the fraction is carried and never pre-rounded to the workbook's
    // own 1.17, which is what makes a balance drift a hundredth of a day a year.
    expect(sheet.getCell("C21").value).not.toBe(1.17);
    expect(sheet.views[0]?.rightToLeft).toBe(true);
  });

  test("produces a national-insurance file with the quarter it covered", async ({
    page,
  }) => {
    await useHousehold(page, "insurance");
    await page.goto("/reports");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('[data-report="nationalInsurance"]').click(),
    ]);
    const sheet = await openDownload(download);

    // It is paid in arrears, so the months it covers are behind the month it
    // left the account (item 19) — never the same month, and never ahead of it.
    expect(sheet.getCell("A3").text).toBe(he.reports.nationalInsurance.paidIn);
    const paidIn = sheet.getCell("A4").text;
    const covers = sheet.getCell("B4").text;
    expect(paidIn).not.toBe("");
    expect(covers).not.toContain(paidIn);
  });
});
