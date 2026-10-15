import { describe, expect, it } from "vitest";
import {
  AUGUST_2025,
  PLAIN_GROSS,
  plainAugustFacts,
  plainWorker,
} from "@/lib/engine/august-2025.fixture";
import { calculateMonth } from "@/lib/engine/month";
import { calculateSeries } from "@/lib/engine/series";
import { AS_SHIPPED } from "@/lib/engine/types";
import type { Advance, UserLine, WorkerTerms } from "@/lib/engine/types";

/**
 * **Which wage the national-insurance estimate is taken on** (specs.md item
 * 19).
 *
 * Item 19 has two bases. The one the application ships with is the wage the
 * contribution is taken on, which is the month's full cost; a household may
 * instead have the estimate follow what the month actually paid the worker —
 * that cost, plus a grant handed over during the month, less an instalment
 * repaid out of it. It is one setting for the whole household, it is off unless
 * the household turns it on, and no month stores it.
 *
 * **Every figure here is derived on paper and none is read back from the
 * engine.** The subject is the fixture's plain August — ₪8,880, derived in its
 * own docblock from Part 4's ₪6,748 and the rest-day rate Part 4's ₪2,559 is
 * built from — and the rate is the 3.6% `datedRates.ts` holds from January 2025
 * with the Kol Zchut page as its source. Each line is that multiplication, taken
 * up to the whole shekel once where it becomes money (item 3):
 *
 *   the wage alone            888,000 × 0.036 = 31,968 -> ₪320   (32,000)
 *   less a ₪2,000 instalment  688,000 × 0.036 = 24,768 -> ₪248   (24,800)
 *   plus a ₪1,000 grant       988,000 × 0.036 = 35,568 -> ₪356   (35,600)
 *   both movements in a month 788,000 × 0.036 = 28,368 -> ₪284   (28,400)
 *
 * **What these would catch.** A base that followed the net would fail the income
 * tax case and the after-total line case, because the net is short of both and
 * neither reduces the wage the contribution is taken on. A base that summed the
 * transfer block instead of naming the two advance sources would fail the
 * after-total line case alone — which is the one a reader is most likely to
 * think interchangeable, and the one item 20 settles. And a setting that leaked
 * into the default would fail the three default cases, which is the failure that
 * would overcharge every household that never asked for this.
 */

const INSTALMENT = 200000;
const GRANT = 100000;

/** The wage the contribution is taken on, 3.6% of ₪8,880 taken up to the
 * shekel. The figure every case below moves from. */
const ON_THE_WAGE = 32000;

const ON_THE_WAGE_LESS_INSTALMENT = 24800;
const ON_THE_WAGE_PLUS_GRANT = 35600;
const ON_THE_WAGE_WITH_BOTH = 28400;

/** The household that files on what it handed over. Everything else is the
 * table the application ships with, so the one thing each case varies is the
 * base. */
const FILES_ON_WHAT_WAS_PAID = {
  ...AS_SHIPPED,
  nationalInsuranceOnWhatWasPaid: true,
} as const;

const granted: Advance = {
  number: 2,
  kind: "granted",
  agorot: GRANT,
  givenOn: "2025-08-10",
};

/** Repaid against an advance the worker already carried, which is why the
 * opening position below holds one: a month may repay an advance it did not
 * grant, and the ordinary case is exactly that. */
const repaid: Advance = { number: 1, kind: "repaid", agorot: INSTALMENT };

/** The plain worker, carrying one advance from before their first month. */
function workerCarryingAnAdvance(standingLines: UserLine[] = []): WorkerTerms {
  const worker = plainWorker(standingLines);
  return {
    ...worker,
    openingPosition: {
      ...worker.openingPosition,
      advances: [{ number: 1, principalAgorot: 500000, repaidAgorot: 0 }],
    },
  };
}

function estimateWith(
  advances: Advance[],
  context: typeof AS_SHIPPED | typeof FILES_ON_WHAT_WAS_PAID,
  over: Partial<Parameters<typeof calculateMonth>[0]> = {},
): number | null {
  const worker = workerCarryingAnAdvance();
  const facts = { ...plainAugustFacts(worker), advances, ...over };
  return calculateMonth(facts, worker, context).nationalInsuranceEstimate;
}

describe("the base the application ships with (specs.md item 19)", () => {
  it("takes the contribution on the wage, where the household has said nothing", () => {
    expect(estimateWith([], AS_SHIPPED)).toBe(ON_THE_WAGE);
  });

  it("leaves the wage alone when an instalment was repaid", () => {
    // The default is the law's base, so the ₪2,000 moves the sum handed over
    // and not the wage the contribution is taken on. This is the assertion that
    // a household which never touches the setting sees no change at all.
    expect(estimateWith([repaid], AS_SHIPPED)).toBe(ON_THE_WAGE);
  });

  it("leaves the wage alone when a grant was handed over", () => {
    expect(estimateWith([granted], AS_SHIPPED)).toBe(ON_THE_WAGE);
  });
});

describe("the household that files on what it handed over (item 19)", () => {
  it("lowers the base by an instalment repaid out of the month", () => {
    expect(estimateWith([repaid], FILES_ON_WHAT_WAS_PAID)).toBe(
      ON_THE_WAGE_LESS_INSTALMENT,
    );
  });

  it("raises the base by a grant handed over during the month", () => {
    expect(estimateWith([granted], FILES_ON_WHAT_WAS_PAID)).toBe(
      ON_THE_WAGE_PLUS_GRANT,
    );
  });

  it("nets a month that did both, rather than correcting it twice", () => {
    // ₪1,000 out and ₪2,000 back is ₪1,000 less than the wage, once — not a
    // base raised and then lowered to somewhere else.
    expect(estimateWith([granted, repaid], FILES_ON_WHAT_WAS_PAID)).toBe(
      ON_THE_WAGE_WITH_BOTH,
    );
  });

  it("is the wage again in a month with neither", () => {
    // Which is also the whole of success criterion 2 read from the other side:
    // the setting changes a month that moved an advance and no other month.
    expect(estimateWith([], FILES_ON_WHAT_WAS_PAID)).toBe(ON_THE_WAGE);
  });

  it("leaves income tax out of the base", () => {
    // Income tax and the contribution are two deductions computed from one
    // wage, neither from the other: a withheld ₪450 does not reduce the wage
    // the contribution is taken on (item 19). Were the base the net, this would
    // read 3.6% of ₪8,430 instead.
    expect(
      estimateWith([], FILES_ON_WHAT_WAS_PAID, { incomeTaxAgorot: 45000 }),
    ).toBe(ON_THE_WAGE);
  });

  it("leaves a line placed after the month's total out of the base", () => {
    // Item 20: a line placed after the total "changes only what is transferred
    // at the end" and reaches neither the month's cost nor this estimate. It
    // sits in the same block as the advances, which is why the base names the
    // two advance sources rather than summing that block.
    const afterTheTotal: UserLine = {
      id: "gift",
      label: "מתנה לחג",
      direction: "addition",
      placement: "afterGross",
      agorot: 50000,
    };
    expect(
      estimateWith([], FILES_ON_WHAT_WAS_PAID, { userLines: [afterTheTotal] }),
    ).toBe(ON_THE_WAGE);
  });
});

describe("an advance moves its own month's estimate and no other", () => {
  /**
   * The claim is about one month out of a replay, so it is asserted as a
   * difference between two replays that differ in one thing: whether August
   * handed over the grant. September's figure cannot be written down on paper
   * here — it is a month nobody opened, valued from the profile, and its cost is
   * not the fixture's — so what is asserted about it is that it did not move,
   * which is the actual claim.
   *
   * **What it would catch**: a base that reached across months — a replay that
   * carried the advance movement forward, or applied the household's whole
   * ledger to every month — which no single-month test can see at all.
   */
  const worker = workerCarryingAnAdvance();
  const august = plainAugustFacts(worker);
  const through = "2025-09-30";

  const withTheGrant = calculateSeries(
    [{ ...august, advances: [granted] }],
    worker,
    through,
    undefined,
    undefined,
    FILES_ON_WHAT_WAS_PAID,
  );
  const without = calculateSeries(
    [august],
    worker,
    through,
    undefined,
    undefined,
    FILES_ON_WHAT_WAS_PAID,
  );

  it("walks both months", () => {
    // Or the two assertions below would be comparing nothing with nothing.
    expect(withTheGrant.map((each) => each.result.month)).toEqual([
      AUGUST_2025,
      { year: 2025, month: 9 },
    ]);
    expect(without).toHaveLength(2);
  });

  it("raises the month the grant was handed over in", () => {
    expect(withTheGrant[0].result.nationalInsuranceEstimate).toBe(
      ON_THE_WAGE_PLUS_GRANT,
    );
    expect(without[0].result.nationalInsuranceEstimate).toBe(ON_THE_WAGE);
  });

  it("leaves the month after it exactly where it was", () => {
    expect(withTheGrant[1].result.nationalInsuranceEstimate).toBe(
      without[1].result.nationalInsuranceEstimate,
    );
  });
});

describe("the wage the figures above rest on", () => {
  it("is the ₪8,880 the fixture derives, so the arithmetic above is checkable", () => {
    // Not a second assertion of the engine but the hinge of every figure in
    // this file: were the plain month's cost something else, each expected
    // figure above would be 3.6% of the wrong number and the suite would still
    // agree with itself.
    const worker = workerCarryingAnAdvance();
    expect(calculateMonth(plainAugustFacts(worker), worker).gross).toBe(
      PLAIN_GROSS,
    );
  });
});
