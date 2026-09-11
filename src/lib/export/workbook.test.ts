import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { devSeed } from "@/lib/dev/seed";
import { createInMemoryRepository } from "@/lib/engine/repository";
import { calculateSeries } from "@/lib/engine/series";
import { balancesFileOf } from "@/lib/export/balancesExport";
import { monthFileOf } from "@/lib/export/monthExport";

/**
 * The two files this application produces, checked against the *schema* rather
 * than against exceljs's own reader.
 *
 * **Reading a filled workbook back with exceljs proves nothing about whether
 * Excel will open it**, which is how the broken export of 2026-09-11 passed
 * every test in this directory: the library's parser accepts `<sheetPr>`'s
 * children in any order and its writer emits them in the wrong one, so the
 * suite watched the library agree with itself while Excel replaced the
 * worksheet with an empty one. These assertions read the bytes.
 */

/** Every worksheet part in the produced file, as XML text. */
async function worksheetsOf(bytes: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(bytes);
  const parts = Object.keys(zip.files).filter((name) =>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
  );
  expect(parts.length).toBeGreaterThan(0);
  return Promise.all(parts.map((name) => zip.file(name)!.async("string")));
}

/**
 * ECMA-376 declares `CT_SheetPr` as an ordered sequence: `tabColor`, then
 * `outlinePr`, then `pageSetUpPr`. A file carrying two of them the other way
 * round parses as XML and is still rejected by Excel, part and all.
 */
const SHEET_PR_ORDER = ["tabColor", "outlinePr", "pageSetUpPr"];

function sheetPrChildrenOf(worksheet: string): string[] {
  const block = worksheet.match(/<sheetPr[^>]*>([\s\S]*?)<\/sheetPr>/);
  if (block === null) return [];
  return [...block[1].matchAll(/<([A-Za-z0-9]+)[\s/>]/g)].map(
    (found) => found[1],
  );
}

function isInSchemaOrder(children: string[]): boolean {
  const ranks = children.map((child) => SHEET_PR_ORDER.indexOf(child));
  expect(ranks).not.toContain(-1);
  return ranks.every((rank, index) => index === 0 || ranks[index - 1] < rank);
}

/**
 * The characters XML has no way to carry. A cell holding one of them breaks the
 * worksheet part exactly as the ordering did, from the opposite direction, and
 * a family who pastes a note out of another document is how one would arrive.
 */
function holdsUnwritableCharacter(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0)!;
    if (code < 0x20 && code !== 9 && code !== 10 && code !== 13) return true;
  }
  return false;
}

/**
 * **The second demo worker, because she is the fullest month this repository
 * holds**: an override on the tax, an advance, two lines the user wrote
 * herself, a holiday on her own rest day and a sick spell across a month
 * boundary all reach the sheet from her.
 *
 * She became that worker on 2026-09-11, when the first was reseeded from the
 * family's own workbooks and everything invented moved across to her
 * (`seed.ts`). A file assembled from the plainest possible month would exercise
 * none of the rows this test is about.
 */
const TODAY = "2026-09-11";

async function filesOf() {
  const repository = createInMemoryRepository(devSeed);
  const worker = (await repository.getWorker("worker-2"))!;
  const series = calculateSeries(
    await repository.listMonths(worker.id),
    worker,
    TODAY,
  );
  const month = series.find(
    (one) => one.facts.month.year === 2026 && one.facts.month.month === 8,
  )!;
  return {
    month: (
      await monthFileOf({
        worker: {
          id: worker.id,
          name: worker.name,
          firstName: worker.firstName,
        },
        employment: { employedSince: worker.employedSince },
        month,
        showNotes: false,
      })
    ).bytes,
    balances: (
      await balancesFileOf({
        worker: { id: worker.id, name: worker.name },
        series,
        year: 2026,
      })
    ).bytes,
  };
}

describe("the files Excel is asked to open", () => {
  it("orders every sheetPr as the schema sequences it", async () => {
    for (const [which, bytes] of Object.entries(await filesOf())) {
      for (const worksheet of await worksheetsOf(bytes)) {
        const children = sheetPrChildrenOf(worksheet);
        expect(
          isInSchemaOrder(children),
          `${which}: <sheetPr> holds ${children.join(", ")}`,
        ).toBe(true);
      }
    }
  });

  /**
   * The repair drops `<outlinePr>` because exceljs cannot be told to move it,
   * and that is lossless only while the templates hold the schema's own
   * defaults. This fails the day a template is re-exported carrying a real
   * outline setting, instead of the setting disappearing from the family's file
   * unnoticed.
   */
  it("drops nothing when it drops outlinePr", async () => {
    for (const bytes of Object.values(await filesOf())) {
      for (const worksheet of await worksheetsOf(bytes)) {
        expect(sheetPrChildrenOf(worksheet)).not.toContain("outlinePr");
      }
    }
  });

  it("writes no part holding something a parser would refuse", async () => {
    for (const [which, bytes] of Object.entries(await filesOf())) {
      const zip = await JSZip.loadAsync(bytes);
      for (const name of Object.keys(zip.files)) {
        if (!/\.(xml|rels)$/.test(name)) continue;
        const text = await zip.file(name)!.async("string");
        expect(holdsUnwritableCharacter(text), `${which}/${name}`).toBe(false);
        // A cell whose number arrived as `NaN` writes a figure Excel cannot
        // read and that no assertion about the *value* would notice, because
        // exceljs reads its own `NaN` back as a number.
        expect(text, `${which}/${name}`).not.toMatch(
          /<v>(NaN|Infinity|-Infinity|undefined)<\/v>/,
        );
      }
    }
  });
});
