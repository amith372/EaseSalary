import { describe, expect, it } from "vitest";

import { rateInForce, SEEDED_RATES } from "@/lib/datedRates";
import { recuperationToConfirm } from "@/lib/engine/beforeExport";
import {
  bulkConfirmFigures,
  bulkConfirmVerdict,
} from "@/lib/engine/bulkConfirm";
import { snapshotTerms } from "@/lib/engine/types";
import type { MonthFacts, MonthSpan } from "@/lib/engine/types";
import {
  WORKBOOK_MONTHS,
  workbookFacts,
  workbookWorker,
} from "@/lib/engine/workbook.fixture";
import type { YearMonth } from "@/lib/types";

/**
 * Which months may be confirmed from the worker's list of months, without an
 * export (specs.md item 18's last paragraph).
 *
 * **Every expected verdict here comes from outside the code under test**, and
 * none of them is a figure:
 *
 *  - `notEnded` is item 21 — a month after the current one is not valued, and
 *    item 18 adds that a month which has not ended is not confirmed this way.
 *  - `openSickSpell` and `unansweredHoliday` are item 18's own two blocks,
 *    which `beforeExport.test.ts` already holds against the same items; what is
 *    checked here is only that this path refuses them too.
 *  - `noWageForMonth` and `noRecuperationRate` are the dates `SEEDED_RATES`
 *    carries: the minimum wage begins 1.4.2025 and the recuperation day rate
 *    1.7.2025, so a month before each is a month whose figure would be typed.
 *  - `alreadyConfirmed` is Part 5's four states — only a *draft* has anything
 *    left to confirm.
 *
 * The dates are read off the calendar by hand: April 2026 ended before 1 May
 * 2026, and 14 April 2026 is a Tuesday, so a holiday on it is not on the
 * fixture's Saturday rest day and does count.
 */

/** Hanna as the workbook has them: employed 1.4.2024, resting on Saturday, and
 * paid their recuperation in March. */
const HANNA = "2024-04-01";

/** A month that has ended, holds nothing unusual, and sits inside both rate
 * tables — the case every refusal below is a single departure from. */
const APRIL_2026: YearMonth = { year: 2026, month: 4 };

/** The day after April 2026 ended. */
const AFTERWARDS = "2026-05-01";

function facts(
  month: YearMonth = APRIL_2026,
  overrides: Partial<MonthFacts> = {},
): MonthFacts {
  const latest = WORKBOOK_MONTHS[WORKBOOK_MONTHS.length - 1];
  const worker = workbookWorker(latest.salaryAgorot);
  return {
    ...workbookFacts({ ...latest, month, freeRestDays: [], advances: [] }, worker),
    terms: snapshotTerms(worker, month),
    spans: [],
    advances: [],
    thirdPartyPayments: [],
    ...overrides,
  };
}

const EMPLOYMENT = {
  employedSince: HANNA,
  firstMonth: { year: 2025, month: 4 },
  gender: "female",
  openingPosition: workbookWorker(0).openingPosition,
} as const;

function verdictFor(
  month: YearMonth,
  overrides: Partial<MonthFacts> = {},
  today = AFTERWARDS,
) {
  return bulkConfirmVerdict(facts(month, overrides), EMPLOYMENT, SEEDED_RATES, today);
}

describe("which months may be confirmed from the list", () => {
  /**
   * The case the whole stage exists for: a month that has ended, holds nothing
   * the application cannot value, and whose figures the rates table already
   * carries. If this were ever refused there would be nothing for the ticks to
   * confirm and the screen would be a list of reasons.
   */
  it("allows a finished draft whose figures the table already holds", () => {
    expect(verdictFor(APRIL_2026)).toBe("ok");
  });

  /**
   * Part 5: only a draft has anything left to confirm. Confirming a confirmed
   * month again would restamp `confirmed_at` and, with it, re-snapshot the base
   * salary off a profile that may have moved since — so a month already filed
   * would silently change what it paid.
   */
  it("refuses a month that is already confirmed", () => {
    expect(
      verdictFor(APRIL_2026, { confirmedAt: "2026-05-02T08:00:00.000Z" }),
    ).toBe("alreadyConfirmed");
  });

  /**
   * Item 21, and item 18's own sentence. The export screen exports the running
   * month with a warning, because the person there is looking at it; a tick
   * down a list is not that. A month confirmed before it ended would stop
   * moving with the days still to come in it.
   */
  it("refuses a month that has not ended, whether it is running or ahead", () => {
    // Today inside April: the month is the current one and still running.
    expect(verdictFor(APRIL_2026, {}, "2026-04-20")).toBe("notEnded");
    // And a month wholly ahead of today.
    expect(verdictFor({ year: 2026, month: 6 }, {}, AFTERWARDS)).toBe("notEnded");
  });

  /**
   * Item 18's first block. An open spell goes on drawing days from the sick
   * balance month after month, so a month confirmed over one files a figure the
   * application already knows may count days for a worker who was back.
   */
  it("refuses a month holding a spell of sickness with no end", () => {
    const open: MonthSpan = {
      id: "s",
      kind: "sick",
      from: "2026-04-20",
      to: null,
    };
    expect(verdictFor(APRIL_2026, { spans: [open] })).toBe("openSickSpell");
  });

  /**
   * Item 18's second block. An unanswered holiday is read by the preview as one
   * they worked and paid for, so the month's total is a lean and not a fact —
   * and these dates arrive from the year's chosen list rather than from
   * anything the family did, which is why nobody has necessarily looked at them.
   */
  it("refuses a month holding a holiday nobody has answered for", () => {
    const holiday = (worked: boolean | null): MonthSpan => ({
      id: "h",
      kind: "holiday",
      from: "2026-04-14",
      to: "2026-04-14",
      worked,
    });
    expect(verdictFor(APRIL_2026, { spans: [holiday(null)] })).toBe(
      "unansweredHoliday",
    );
    // Answered either way, the month is confirmable again: what item 18 wants
    // is an answer and not a particular one.
    expect(verdictFor(APRIL_2026, { spans: [holiday(true)] })).toBe("ok");
    expect(verdictFor(APRIL_2026, { spans: [holiday(false)] })).toBe("ok");
  });

  /**
   * Item 4: a month is valued at the wage in force during it, and `SEEDED_RATES`
   * says nothing before 1.4.2025. The honest answer for March 2025 is that the
   * figure is one the user types, which is the export screen's field and not a
   * tick — a tick that guessed would value a month at a wage nobody confirmed.
   */
  it("refuses a month the minimum-wage table begins after", () => {
    expect(verdictFor({ year: 2025, month: 3 }, {}, AFTERWARDS)).toBe(
      "noWageForMonth",
    );
  });

  /**
   * Item 15, and the same rule as the wage. Hanna's recuperation falls in
   * March, and the recuperation day rate table begins 1.7.2025 — so March 2025
   * owes recuperation days at a rate the table cannot offer.
   *
   * **It is refused for the recuperation rate and not for the wage**, although
   * that month is before both tables: the order in `bulkConfirmVerdict` puts
   * the wage first, so this case is built in a month the wage table *does*
   * cover. March 2026 is that month — within the wage table from 1.4.2025 and
   * within the recuperation table from 1.7.2025, which is why the figure is
   * offered there and the case needs a month the table is silent about.
   */
  it("refuses a recuperation month the day-rate table begins after", () => {
    // June 2025: inside the wage table, before the recuperation table. The
    // fixture's recuperation month is March, so the days are forced onto this
    // month by its own terms rather than by the profile.
    const june2025: YearMonth = { year: 2025, month: 6 };
    const terms = {
      ...snapshotTerms(workbookWorker(0), june2025),
      recuperationMonth: 6,
    };
    expect(verdictFor(june2025, { terms }, AFTERWARDS)).toBe(
      "noRecuperationRate",
    );
  });

  /**
   * The same recuperation month once the table reaches it. Without this the
   * test above would pass just as well if the rule refused every recuperation
   * month, which is the opposite of what item 15 asks.
   */
  it("allows a recuperation month the day-rate table does cover", () => {
    const june2026: YearMonth = { year: 2026, month: 6 };
    const terms = {
      ...snapshotTerms(workbookWorker(0), june2026),
      recuperationMonth: 6,
    };
    expect(verdictFor(june2026, { terms }, "2026-07-01")).toBe("ok");
  });
});

/**
 * Rule 12's shape, between two writers instead of between a preview and an
 * export: the export screen and the tick must confirm a month at one set of
 * figures, not at two that agree today.
 *
 * **The expected figures are not restated here.** They are read from the two
 * sources the export screen's own page reads — `rateInForce` for the minimum
 * wage and `recuperationToConfirm` for the day rate — so the test would fail if
 * either path started reading somewhere else, which is the only way the two can
 * drift. A figure written into this file by hand would instead pass while both
 * paths moved together to a third source.
 */
describe("the two confirmation paths agree on the figures", () => {
  it("writes the very figures the export screen offers for that month", () => {
    const month = APRIL_2026;
    const theMonth = facts(month);

    // What `src/app/month/export/page.tsx` hands the screen as `offeredWage`
    // and `recuperation`.
    const offeredWage = rateInForce(SEEDED_RATES, "minimumWage", month);
    const offeredRecuperation = recuperationToConfirm(
      theMonth,
      EMPLOYMENT,
      SEEDED_RATES,
    );

    // What the tick writes.
    const ticked = bulkConfirmFigures(theMonth, EMPLOYMENT, SEEDED_RATES);

    expect(ticked).not.toBeNull();
    expect(ticked?.minimumAgorot).toBe(offeredWage?.value);
    expect(ticked?.effectiveFrom).toBe(offeredWage?.effectiveFrom);
    expect(ticked?.recuperationDayRateAgorot).toBe(
      offeredRecuperation?.offeredAgorot ?? undefined,
    );
  });

  /**
   * And in a month that owes recuperation, which is the case where the two
   * paths have a second figure to disagree about. Eleven months of twelve owe
   * none, so a test on one of those would prove only that both wrote nothing.
   */
  it("agrees on the recuperation day rate in a month that owes one", () => {
    const june2026: YearMonth = { year: 2026, month: 6 };
    const terms = {
      ...snapshotTerms(workbookWorker(0), june2026),
      recuperationMonth: 6,
    };
    const theMonth = facts(june2026, { terms });

    const offered = recuperationToConfirm(theMonth, EMPLOYMENT, SEEDED_RATES);
    const ticked = bulkConfirmFigures(theMonth, EMPLOYMENT, SEEDED_RATES);

    // The case is only worth anything if the month really does owe days.
    expect(offered?.days).toBeGreaterThan(0);
    expect(offered?.offeredAgorot).not.toBeNull();
    expect(ticked?.recuperationDayRateAgorot).toBe(offered?.offeredAgorot);
  });
});
