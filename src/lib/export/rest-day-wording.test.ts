import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { FRIDAY } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { calculateSeries } from "@/lib/engine/series";
import {
  plainAugustFacts,
  plainWorker,
} from "@/lib/engine/august-2025.fixture";
import { snapshotTerms } from "@/lib/engine/types";
import { monthSheetInputOf } from "@/lib/export/monthExport";
import { fillMonthSheet } from "@/lib/export/monthSheet";
import { MONTH_TEMPLATE, readTemplate } from "@/lib/export/template";

/**
 * The nine labels that name the weekly rest day, filled from the month's own
 * stored day — stage 2's step 2.
 *
 * **The rest day is a term of the employment and not a constant** (specs.md
 * item 5), and Part 3 requires every label that names it to become a
 * placeholder, "so a worker whose rest day is Friday receives a sheet that says
 * Friday throughout and counts her Fridays, and Hanna's sheet is unchanged word
 * for word".
 *
 * **Both expectations below come from outside the code under test.** The
 * Saturday column is `data/templates/template_month_standard.xlsx` -> `sheet1`
 * read cell by cell on 2026-09-10, *before* the nine were made placeholders —
 * so this half is the regression test for the second promise, and it fails the
 * moment a token is filled with a word the family's own template did not use.
 * The Friday column is that same wording with the Hebrew names of the days
 * substituted by hand: her rest day is Friday and her rest-eve is therefore
 * Thursday, the working day immediately before it (item 14).
 *
 * The whole path is driven, from the replay through `monthSheetInputOf` to the
 * filled bytes, because the defect this guards against is a wiring one: the
 * words read off the profile rather than off the month would relabel every
 * earlier sheet the day a family moved the rest day (Part 3).
 */

/** Cell -> [the label for a Saturday-resting worker, and for a Friday-resting
 * one]. Nine cells, which is the count Part 3 names. */
const LABELS: Record<string, [string, string]> = {
  E1: [
    "ימי עבודה בחודש זה (לא כולל שבתות )",
    "ימי עבודה בחודש זה (לא כולל ימי שישי )",
  ],
  G1: ["שבתות שעבדה בחודש זה", "ימי שישי שעבדה בחודש זה"],
  F5: [
    'תשלום בגין עבודה ביום חג או שבת בש"ח',
    'תשלום בגין עבודה ביום חג או יום שישי בש"ח',
  ],
  B7: [
    "תוספת שבועית בגין ימי שישי - בהתאם לכמות ימי השישי שעבדה באותו חודש",
    "תוספת שבועית בגין ימי חמישי - בהתאם לכמות ימי החמישי שעבדה באותו חודש",
  ],
  B9: [
    "עבודה בשבת (בהתאם לכמות השבתות שעבדה באותו חודש)",
    "עבודה ביום שישי (בהתאם לכמות ימי השישי שעבדה באותו חודש)",
  ],
  B24: [
    'ב. סה"כ  תשלום  עבור  שבתות וחגים',
    'ב. סה"כ  תשלום  עבור  ימי שישי וחגים',
  ],
  A26: [
    'ד=א+ב+ג - סה"כ  משכורת בסיסית + תוספת ימי שישי + דמי מחלה+ תשלום עבור שבתות וחגים + ימי חופשה שנוצלו + דמי הבראה +שעות עבודה נוספות בגין אישפוז',
    'ד=א+ב+ג - סה"כ  משכורת בסיסית + תוספת ימי חמישי + דמי מחלה+ תשלום עבור ימי שישי וחגים + ימי חופשה שנוצלו + דמי הבראה +שעות עבודה נוספות בגין אישפוז',
  ],
  B33: ["ימי עבודה - תקן (ללא שבתות)", "ימי עבודה - תקן (ללא ימי שישי)"],
  B34: ["ימי עבודה בפועל (ללא שבתות)", "ימי עבודה בפועל (ללא ימי שישי)"],
};

let template: ArrayBuffer;

beforeAll(async () => {
  template = await readTemplate(MONTH_TEMPLATE);
});

async function sheetFor(restDay: RestDay): Promise<ExcelJS.Worksheet> {
  const worker = { ...plainWorker(), restDay };
  const facts = { ...plainAugustFacts(worker), terms: snapshotTerms(worker) };
  const month = calculateSeries([facts], worker)[0];
  if (month === undefined) throw new Error("no month");

  const bytes = await fillMonthSheet(
    template,
    monthSheetInputOf({
      worker: { id: "w", name: "חנה", firstName: "חנה" },
      employment: { employedSince: worker.employedSince },
      month,
      showNotes: false,
    }),
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  );
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error("no sheet");
  return sheet;
}

describe("the nine labels that name the rest day (Part 3)", () => {
  it("leaves Hanna's sheet unchanged word for word", async () => {
    const sheet = await sheetFor(plainWorker().restDay);
    for (const [ref, [saturday]] of Object.entries(LABELS)) {
      expect(sheet.getCell(ref).text, ref).toBe(saturday);
    }
  });

  it("says Friday throughout for a worker who rests on Friday", async () => {
    const sheet = await sheetFor(FRIDAY);
    for (const [ref, [, friday]] of Object.entries(LABELS)) {
      expect(sheet.getCell(ref).text, ref).toBe(friday);
    }
  });

  it("names her rest-eve and not Friday in the supplement's own labels", async () => {
    // The one distinction a sheet that merely swapped "Saturday" for "Friday"
    // everywhere would get wrong: `B7` and the `א` half of `A26` price the
    // rest-eve, which for a Friday-resting worker is Thursday (item 14). This
    // is what makes the two words two placeholders rather than one.
    const sheet = await sheetFor(FRIDAY);
    expect(sheet.getCell("B7").text).toContain("ימי חמישי");
    expect(sheet.getCell("B7").text).not.toContain("ימי שישי");
    expect(sheet.getCell("A26").text).toContain("תוספת ימי חמישי");
  });

  it("still counts her Fridays in the cells those labels head", async () => {
    // Part 3 asks for a sheet that "says Friday throughout and counts her
    // Fridays" — a label alone proves half of it. August 2025 holds five
    // Fridays and four Thursdays, counted off a calendar and not off the
    // engine: 1, 8, 15, 22 and 29 August are Fridays; 7, 14, 21 and 28 are
    // Thursdays. `G2` is the rest days she worked and `F2` the rest-eves.
    const sheet = await sheetFor(FRIDAY);
    expect(sheet.getCell("G2").value).toBe(5);
    expect(sheet.getCell("F2").value).toBe(4);
  });
});
