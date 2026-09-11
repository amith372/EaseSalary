import type ExcelJS from "exceljs";

/**
 * The one repair every filled template needs before it is written back.
 *
 * **exceljs writes `<sheetPr>`'s children in the wrong order and Excel refuses
 * the whole worksheet for it** — found on 2026-09-11 by opening a downloaded
 * month in Excel, which reported
 * `Replaced Part: /xl/worksheets/sheet1.xml part with XML error` and handed
 * back an empty sheet. ECMA-376 declares `CT_SheetPr` as a *sequence* —
 * `tabColor`, then `outlinePr`, then `pageSetUpPr` — and a sequence is ordered,
 * so a document that carries the last two the other way round is invalid even
 * though it parses. Our templates are written by Excel and hold them correctly;
 * `sheet-properties-xform.js` renders `pageSetUpPr` before `outlinePr` and
 * inverts them on the way out.
 *
 * **This is why every export was broken and no test saw it.** The suite reads
 * a filled workbook back with exceljs, and exceljs's own parser takes the
 * children in any order — so the library agreed with itself about a file Excel
 * would not open. Nothing short of opening the file in Excel could have caught
 * it, which is rule 9's point stated by a file rather than by a screen.
 *
 * **The fix drops `outlinePr` rather than reordering it**, because exceljs
 * offers no way to reorder and because the element is pure default here: both
 * templates carry `summaryBelow="1" summaryRight="1"`, which is what the schema
 * says an absent `outlinePr` means. So the written file says exactly what the
 * template said. `assertOutlineIsDefault` is what keeps that true — a template
 * re-exported one day with a real outline setting fails the suite here instead
 * of silently losing it.
 *
 * The property is set to `undefined` rather than deleted: exceljs renders
 * nothing when `model.properties.outlineProperties` is absent, and a template
 * without an `<outlinePr>` already arrives here holding exactly that. The
 * shipped typings declare it non-optional and the runtime does not, which is
 * the whole of why the two casts below exist.
 */

/** What the schema means by an absent `outlinePr` (ECMA-376, CT_OutlinePr:
 * both attributes default to `true`). */
const DEFAULT_OUTLINE = { summaryBelow: true, summaryRight: true };

type Outline = ExcelJS.Worksheet["properties"]["outlineProperties"];

export function prepareForExcel(workbook: ExcelJS.Workbook): void {
  /**
   * **Excel is told to work the formulas out when it opens the file.**
   *
   * The totals this application writes are live formulas on purpose (Part 3),
   * and a formula exceljs writes carries no cached result — there is nothing to
   * cache, since the value has never been computed. A template's `calcPr`
   * carries the calculation id of the Excel that last saved it, and on that
   * evidence Excel may decide the file is already up to date and print nothing
   * where each total belongs. That is what the user saw on 2026-09-11: the file
   * opened, the rows were all there, and the four total lines and the figure
   * actually transferred were blank.
   *
   * The totals also carry the engine's own figure as their cached result
   * (`writeTotals`), so a reader that computes nothing still sees them. This
   * flag is the other half: Excel recomputes and agrees, rather than trusting a
   * number this application put there.
   */
  workbook.calcProperties.fullCalcOnLoad = true;
  for (const sheet of workbook.worksheets) repairSheetProperties(sheet);
}

function repairSheetProperties(sheet: ExcelJS.Worksheet): void {
  const outline: Outline | undefined = sheet.properties.outlineProperties;
  if (outline === undefined) return;
  if (
    outline.summaryBelow !== DEFAULT_OUTLINE.summaryBelow ||
    outline.summaryRight !== DEFAULT_OUTLINE.summaryRight
  ) {
    throw new Error(
      "The template sets outline properties this export would drop: " +
        JSON.stringify(outline),
    );
  }
  sheet.properties.outlineProperties = undefined as unknown as Outline;
}
