import { describe, expect, it } from "vitest";
import { devSeed } from "@/lib/dev/seed";
import { createInMemoryRepository } from "@/lib/engine/repository";
import { calculateSeries } from "@/lib/engine/series";
import { WORKBOOK_MONTHS } from "@/lib/engine/workbook.fixture";

/**
 * **The demo household, held against the family's own workbooks** — asked for
 * by the user on 2026-09-11, so that what the application shows on screen can
 * be compared tab by tab with `שכר_חודשי_להאנה2025.xlsx` and `…2026.xlsx`.
 *
 * **This is not another test of the engine.** `workbook-totals.test.ts` and its
 * neighbours already hold the engine against those tabs. What this holds is the
 * **seed**: that the household a person actually opens is the one the workbooks
 * describe, and that it has not drifted from them. The distinction matters
 * because the engine was right and every screen still showed the wrong month —
 * that is exactly how the income-tax zero of 2026-09-11 survived a green suite.
 *
 * Every expected figure is `WORKBOOK_MONTHS`, which carries `E26` and `E29` of
 * each tab with the cell named beside it (`CLAUDE.md` rule 6, rule 10). Nothing
 * here reads a figure back out of the seed.
 *
 * **What it would catch**: a seeded month whose advance, wage or marked days
 * were edited for some other purpose, so the demo quietly stopped being the
 * thing it is offered as; a month added to or dropped from the range; and the
 * second worker's invented cases leaking back onto the first.
 */
describe("the demo household is the workbooks", () => {
  async function hanna() {
    const repository = createInMemoryRepository(devSeed);
    const worker = (await repository.getWorker("worker-1"))!;
    return calculateSeries(
      await repository.listMonths("worker-1"),
      worker,
      "2026-09-11",
    );
  }

  it("reaches every tab's own ברוטו and its own transfer", async () => {
    const series = await hanna();
    expect(series.length).toBeGreaterThan(0);

    for (const one of series) {
      const tab = WORKBOOK_MONTHS.find(
        (m) =>
          m.month.year === one.facts.month.year &&
          m.month.month === one.facts.month.month,
      );
      expect(tab, `${one.facts.month.year}-${one.facts.month.month}`).toBeDefined();
      // `E26` and `E29` of that tab. Both, because a gross that matches over a
      // transfer that does not is an advance the demo moved and the family did
      // not — and the transfer is the figure the family actually hands over.
      expect(one.result.gross, tab!.tab).toBe(tab!.gross);
      expect(one.result.net, tab!.tab).toBe(tab!.net);
    }
  });

  it("covers May 2025 to July 2026, the months the tabs allow", async () => {
    // Fourteen: the fifteen tabs `WORKBOOK_MONTHS` records, less `חודש 4.25`.
    // April is dropped because the 2025 tabs pay ten holidays against the
    // nine-day entitlement of item 10 and the engine refuses the tenth —
    // correctly. A change that reinstated it would take the whole demo down
    // with an `InvalidMonthError`, so the count is asserted rather than left to
    // be discovered by a blank screen.
    const series = await hanna();
    expect(series.length).toBe(14);
    expect(series[0]!.facts.month).toEqual({ year: 2025, month: 5 });
    expect(series.at(-1)!.facts.month).toEqual({ year: 2026, month: 7 });
  });

  it("withholds nothing, because the workbooks withhold nothing", async () => {
    // `E20` is empty in every tab of both files. The family decided that once,
    // so the profile says `none` and no month carries a confirmed zero — and a
    // month that withheld anything would put the app's transfer below the one
    // the family filed while the ברוטו still agreed.
    const repository = createInMemoryRepository(devSeed);
    const worker = (await repository.getWorker("worker-1"))!;
    expect(worker.incomeTax).toEqual({ mode: "none" });

    for (const one of await hanna()) {
      expect(one.result.gross).toBe(one.result.afterWithholding);
    }
  });

  it("starts from the balances the workbook's own tab carries", async () => {
    // `חישוב ימי מחלה וחופשה` of the 2025 file, at 1 May 2025: `B25` is
    // 4.676666… vacation days and `B8` is 19.5 sick days (item 6). The first
    // seeded month opens on those and not on zero, which is what lets the
    // balances the application draws be read against column `F` of that tab.
    const repository = createInMemoryRepository(devSeed);
    const worker = (await repository.getWorker("worker-1"))!;
    expect(worker.openingPosition.vacationDays).toBeCloseTo(4.676666666666667, 10);
    expect(worker.openingPosition.sickDays).toBe(19.5);

    // One month on, the workbook's `F8` reads 21 sick days: 19.5 + 1.5 accrued,
    // nothing used.
    const may = (await hanna())[0]!;
    const sick = may.result.balances.find((one) => one.kind === "sick");
    expect(sick?.closing).toBe(21);
  });
});
