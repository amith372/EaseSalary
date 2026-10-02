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
 * because the engine can be right while every screen still shows the wrong
 * month — which is how an income-tax zero survives a green suite.
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
    const seeded = await repository.listMonths("worker-1");
    // Only the months the seed opened have a tab to be measured against; the
    // walk also values the months after them, up to today's (Part 3).
    return calculateSeries(seeded, worker, "2026-09-11").filter((one) =>
      seeded.some((month) => month.month.year === one.facts.month.year && month.month.month === one.facts.month.month),
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

  /**
   * **The money that went to somebody other than the worker, tab by tab**
   * (specs.md item 16).
   *
   * Seven tabs in the seeded range carry one, and the day each was paid is in
   * the sentence in `I` beside it — the only place the workbook records it.
   * **The count is seven, and it is found by reading column `I` of all
   * thirty-six tabs and never column `H`.** Two of the seven are not in `H` at
   * all: the Q4/25 national insurance filed under `חודש  1.26`, and the 2025
   * medical-insurance premium of `חודש  6.25`, which the family typed into
   * `C10` instead of `H10`. Both are asserted below, so a scan down one column
   * cannot make the count five.
   *
   * **What it would catch**: the payments dropping out of the seed again, which
   * is a defect nothing else here would see — a third-party payment is column
   * `H` and never reaches the ברוטו or the transfer (item 16), so the totals
   * above stay correct with every one of these gone.
   */
  it("carries each tab's own third-party payment, with the day it was paid", async () => {
    const series = await hanna();
    const paid = (year: number, month: number) => {
      const one = series.find(
        (m) => m.facts.month.year === year && m.facts.month.month === month,
      );
      return one?.facts.thirdPartyPayments ?? [];
    };

    // `H21` of `חודש  7.25`, with `I21`: paid 20.7.25 for the months 4-6/25.
    expect(paid(2025, 7)).toEqual([
      {
        kind: "nationalInsurance",
        agorot: 93600,
        paidOn: "2025-07-20",
        coversMonths: [
          { year: 2025, month: 4 },
          { year: 2025, month: 5 },
          { year: 2025, month: 6 },
        ],
      },
    ]);

    // `H10` of `חודש  6.26`, with `I10`: an annual policy paid on 28.5.26.
    // The month it is filed under is not the month it was paid, which is the
    // whole reason the payment carries its own day.
    const june = paid(2026, 6);
    expect(june[0]?.kind).toBe("medicalInsurance");
    expect(june[0]?.agorot).toBe(348163);
    expect(june[0]?.paidOn).toBe("2026-05-28");
    expect(june[0]?.expiresOn).toBe("2027-05-28");

    // `H16` of `חודש  7.26`, with `I16`: 205 ₪ paid on 29.6.26.
    expect(paid(2026, 7)).toEqual([
      { kind: "licenceFee", agorot: 20500, paidOn: "2026-06-29" },
    ]);

    // `H21` of `חודש  1.26`, with `I21`: 918 ₪ paid 20.1.26 for 10-12/25 — the
    // quarter that sat between 10.25 and 4.26 and was absent while both of its
    // neighbours were present.
    expect(paid(2026, 1)).toEqual([
      {
        kind: "nationalInsurance",
        agorot: 91800,
        paidOn: "2026-01-20",
        coversMonths: [
          { year: 2025, month: 10 },
          { year: 2025, month: 11 },
          { year: 2025, month: 12 },
        ],
      },
    ]);

    // `C10` of `חודש  6.25` — not `H10`, which is empty — with `B10` and `I10`
    // both naming the day and the figure: an annual policy of ₪3,415.05 paid on
    // 15.6.25. The same policy a year before the one June 2026 records.
    const june25 = paid(2025, 6);
    expect(june25[0]?.kind).toBe("medicalInsurance");
    expect(june25[0]?.agorot).toBe(341505);
    expect(june25[0]?.paidOn).toBe("2025-06-15");
    expect(june25[0]?.expiresOn).toBe("2026-06-15");

    // And the ordinary month records none at all.
    expect(paid(2026, 2)).toEqual([]);
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
