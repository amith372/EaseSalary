import { describe, expect, it } from "vitest";
import {
  advanceKey,
  advanceLedger,
  duplicateAdvanceMovements,
  nextAdvanceNumber,
  reviewAdvance,
  whyRemovalIsRefused,
  withoutAdvance,
} from "@/lib/engine/advances";
import type { AdvanceDraft, AdvanceStanding } from "@/lib/engine/advances";
import type { Advance, MonthFacts, OpeningPosition } from "@/lib/engine/types";
import type { YearMonth } from "@/lib/types";

/**
 * Advances, given and repaid (specs.md item 20).
 *
 * **Every figure below is stated by hand and none is read back from the
 * module.** They are round sums of the kind item 6 says a family states once,
 * and each expectation is what the criterion says should follow from them: a
 * debt is the principal less every repayment recorded against it in any month,
 * a number is minted one past the highest the worker carries, and the three
 * refusals are the three the criterion names.
 */

/** ₪2,000 given before the application existed, ₪500 of it already repaid — so
 * ₪1,500 is still owed on it (specs.md item 6: the family states this once). */
const OPENING_PRINCIPAL = 200000;
const OPENING_REPAID = 50000;
const OPENING_OUTSTANDING = 150000;

const february: YearMonth = { year: 2026, month: 2 };
const march: YearMonth = { year: 2026, month: 3 };
const april: YearMonth = { year: 2026, month: 4 };

const opening = (advances: OpeningPosition["advances"] = []): OpeningPosition => ({
  vacationDays: 0,
  sickDays: 0,
  advances,
});

const monthOf = (month: YearMonth, advances: Advance[]) => ({ month, advances });

const granted = (number: number, agorot: number, note?: string): Advance => ({
  number,
  kind: "granted",
  agorot,
  ...(note === undefined ? {} : { note }),
});

const repaid = (number: number, agorot: number): Advance => ({
  number,
  kind: "repaid",
  agorot,
});

const draft = (over: Partial<AdvanceDraft> = {}): AdvanceDraft =>
  ({ kind: "granted", amount: "3000", note: "", ...over }) as AdvanceDraft;

describe("what is still owed on an advance", () => {
  /**
   * The opening position is where an employment already running joins the
   * application (item 6), and an advance in it was given before there was a
   * month to record it in — so nothing granted it and no month is too early to
   * repay it in.
   */
  it("starts from the opening position, which no month granted", () => {
    const ledger = advanceLedger(
      opening([
        {
          number: 1,
          principalAgorot: OPENING_PRINCIPAL,
          repaidAgorot: OPENING_REPAID,
        },
      ]),
      [],
    );

    expect(ledger).toEqual([
      {
        number: 1,
        principalAgorot: OPENING_PRINCIPAL,
        repaidAgorot: OPENING_REPAID,
        outstandingAgorot: OPENING_OUTSTANDING,
        grantedIn: null,
      },
    ]);
  });

  /**
   * ₪3,000 given in February and ₪1,000 repaid in each of March and April
   * leaves ₪1,000 owed. The figure cannot be read off any one of those three
   * months, which is the whole reason the walk exists.
   */
  it("is the principal less every repayment, whichever month recorded it", () => {
    const ledger = advanceLedger(opening(), [
      monthOf(february, [granted(1, 300000)]),
      monthOf(march, [repaid(1, 100000)]),
      monthOf(april, [repaid(1, 100000)]),
    ]);

    expect(ledger).toEqual([
      {
        number: 1,
        principalAgorot: 300000,
        repaidAgorot: 200000,
        outstandingAgorot: 100000,
        grantedIn: february,
      },
    ]);
  });

  /**
   * The months are sorted here rather than trusted from the caller: an unsorted
   * array does not fail, it merely names the wrong month as the one the advance
   * was granted in — and a repayment before the grant would then be accepted.
   *
   * **It takes two grants on one number to test that at all**, which is why
   * this reads as an odd month pair. With a single grant the answer is the same
   * whatever order the months arrive in, so the first version of this test
   * passed with the sort deleted: it asserted the property without exercising
   * it. Two grants cannot arise from this application — a number is minted past
   * the highest the worker carries — and that is exactly why the sort is here,
   * as the same defence against an assembled array that `calculateSeries` keeps
   * for the balances.
   */
  it("names the earliest month that granted an advance, in any order", () => {
    const [standing] = advanceLedger(opening(), [
      monthOf(april, [granted(1, 100000)]),
      monthOf(february, [granted(1, 300000)]),
    ]);

    expect(standing.grantedIn).toEqual(february);
    expect(standing.principalAgorot).toBe(400000);
  });

  it("keeps each numbered advance apart and reports them in order", () => {
    const ledger = advanceLedger(
      opening([{ number: 1, principalAgorot: 200000, repaidAgorot: 0 }]),
      [
        monthOf(march, [granted(2, 500000)]),
        monthOf(april, [repaid(2, 120000), repaid(1, 50000)]),
      ],
    );

    expect(ledger.map((standing) => standing.number)).toEqual([1, 2]);
    expect(ledger[0].outstandingAgorot).toBe(150000);
    expect(ledger[1].outstandingAgorot).toBe(380000);
  });
});

describe("the number an advance gets", () => {
  it("is 1 for a worker who has none", () => {
    expect(nextAdvanceNumber([])).toBe(1);
  });

  /**
   * One past the highest and never into a gap. The number addresses the closing
   * block's rows and any override typed over one (item 17), so reusing the
   * number of an advance that was removed would point a stored figure at a debt
   * it was never typed against.
   */
  it("counts past the highest the worker carries and never fills a gap", () => {
    const ledger: AdvanceStanding[] = [1, 4].map((number) => ({
      number,
      principalAgorot: 100000,
      repaidAgorot: 0,
      outstandingAgorot: 100000,
      grantedIn: null,
    }));

    expect(nextAdvanceNumber(ledger)).toBe(5);
  });
});

describe("giving an advance", () => {
  const context = {
    ledger: advanceLedger(opening(), [monthOf(february, [granted(1, 300000)])]),
    monthAdvances: [],
    month: march,
  };

  it("mints the number and holds the amount positive", () => {
    const reviewed = reviewAdvance(draft({ amount: "2,500.50" }), context);
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(reviewed.advance).toEqual({
      number: 2,
      kind: "granted",
      agorot: 250050,
    });
  });

  it("carries the reason where she gave one, and no key where she did not", () => {
    const withNote = reviewAdvance(draft({ note: " סוכם בעל פה " }), context);
    expect(withNote.ok && withNote.advance.note).toBe("סוכם בעל פה");

    const without = reviewAdvance(draft({ note: "   " }), context);
    expect(without.ok && "note" in without.advance).toBe(false);
  });

  /**
   * A grant's number is minted past everything the ledger carries, and the
   * ledger counts this month — so a grant cannot collide with a movement the
   * month already records, whatever else is in it. This is the assertion that
   * says why `reviewAdvance` has no duplicate check on the granting side.
   */
  it("gives a grant a number no movement of this month already holds", () => {
    const alreadyHere = [granted(2, 100000), repaid(1, 50000)];
    const reviewed = reviewAdvance(draft({ amount: "800" }), {
      ledger: advanceLedger(opening(), [
        monthOf(february, [granted(1, 300000)]),
        monthOf(april, alreadyHere),
      ]),
      monthAdvances: alreadyHere,
      month: april,
    });
    expect(reviewed.ok && reviewed.advance.number).toBe(3);
  });

  /** The user never types a minus: the direction of a movement is its `kind`,
   * so a typed sign could only disagree with the label beside it (item 20). */
  it("refuses an amount that is not one, a minus, and zero", () => {
    for (const amount of ["", "  ", "לא סכום", "-500", "0", "0.00"]) {
      expect(reviewAdvance(draft({ amount }), context)).toEqual({
        ok: false,
        reason: "amount",
      });
    }
  });
});

describe("repaying an advance", () => {
  /** ₪3,000 given in February, ₪1,000 of it repaid in March: ₪2,000 is owed. */
  const ledger = advanceLedger(opening(), [
    monthOf(february, [granted(1, 300000)]),
    monthOf(march, [repaid(1, 100000)]),
  ]);

  const repay = (over: Partial<Extract<AdvanceDraft, { kind: "repaid" }>> = {}) =>
    reviewAdvance(
      { kind: "repaid", number: 1, amount: "1000", note: "", ...over },
      { ledger, monthAdvances: [], month: april },
    );

  it("takes an instalment the user chose for this month alone", () => {
    const reviewed = repay({ amount: "750" });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(reviewed.advance).toEqual({ number: 1, kind: "repaid", agorot: 75000 });
  });

  /** ₪2,000 is what is left, so ₪2,000 settles it and ₪2,000.01 is more than
   * the debt. Money withheld beyond the debt is not an advance at all — it is a
   * deduction, which item 20's own lines already express. */
  it("takes exactly what is left and refuses one agora more", () => {
    expect(repay({ amount: "2000" }).ok).toBe(true);
    expect(repay({ amount: "2000.01" })).toEqual({
      ok: false,
      reason: "advanceOverRepaid",
    });
  });

  it("refuses an advance the worker does not have", () => {
    expect(repay({ number: 7 })).toEqual({
      ok: false,
      reason: "advanceUnknown",
    });
  });

  /** The month it was granted in is the first month it can be repaid in — and
   * that month itself is allowed, because a family may hand over an advance and
   * take the first instalment back in the same month. */
  it("refuses a month before the advance was given, and takes the month itself", () => {
    const inMonth = (month: YearMonth) =>
      reviewAdvance(
        { kind: "repaid", number: 1, amount: "500", note: "" },
        { ledger, monthAdvances: [], month },
      );

    expect(inMonth({ year: 2026, month: 1 })).toEqual({
      ok: false,
      reason: "advanceNotYetGiven",
    });
    expect(inMonth(february).ok).toBe(true);
  });

  /** An advance carried in from the opening position was given before the
   * application existed, so there is no month it is too early to repay it in
   * (item 6). */
  it("takes a repayment of an opening-position advance in any month", () => {
    const fromOpening = advanceLedger(
      opening([
        {
          number: 1,
          principalAgorot: OPENING_PRINCIPAL,
          repaidAgorot: OPENING_REPAID,
        },
      ]),
      [],
    );

    const reviewed = reviewAdvance(
      { kind: "repaid", number: 1, amount: "1500", note: "" },
      { ledger: fromOpening, monthAdvances: [], month: { year: 2026, month: 1 } },
    );
    expect(reviewed.ok).toBe(true);
  });

  /**
   * Two repayments of one advance in one month share a key, so neither could be
   * overridden or explained apart from the other (items 17, 24). The refusal
   * comes before the amount is read, because the sentence the user needs is
   * that the month already records one — not that her figure is wrong.
   */
  it("refuses a second repayment in the same month, before reading the amount", () => {
    const second = reviewAdvance(
      { kind: "repaid", number: 1, amount: "לא סכום", note: "" },
      { ledger, monthAdvances: [repaid(1, 50000)], month: april },
    );
    expect(second).toEqual({ ok: false, reason: "advanceRecordedTwice" });
  });

  /** A month may grant one advance and repay another, and may even repay the
   * one it granted: what the key forbids is two movements of the *same* kind. */
  it("takes a repayment in a month that already records a grant", () => {
    const alsoGranted = reviewAdvance(
      { kind: "repaid", number: 1, amount: "500", note: "" },
      { ledger, monthAdvances: [granted(2, 100000)], month: april },
    );
    expect(alsoGranted.ok).toBe(true);
  });
});

/** The key is a **stored** value: `MonthFacts.overrides` is keyed by it
 * (item 17), so it is pinned here rather than left to be discovered when an
 * override silently stops reaching its row. */
describe("how a movement is addressed", () => {
  it("names the advance and the movement", () => {
    expect(advanceKey(3, "repaid")).toBe("advance.3.repaid");
    expect(advanceKey(3, "granted")).toBe("advance.3.granted");
  });
});

describe("removing a movement", () => {
  const month = {
    advances: [granted(1, 300000), repaid(1, 100000), repaid(2, 50000)],
    overrides: {
      [advanceKey(1, "repaid")]: { agorot: 90000 },
      [advanceKey(1, "granted")]: { agorot: 300000 },
      base: { agorot: 624765 },
    },
  } satisfies Pick<MonthFacts, "advances" | "overrides">;

  it("takes that movement and no other", () => {
    const after = withoutAdvance(month, 1, "repaid");
    expect(after.advances).toEqual([granted(1, 300000), repaid(2, 50000)]);
  });

  /** An override is addressed by the row's own key, so one left behind is an
   * amount waiting to reattach itself to a row that never asked for it
   * (items 17, 20). */
  it("takes the amount the user typed over it, and leaves every other one", () => {
    const after = withoutAdvance(month, 1, "repaid");
    expect(after.overrides).toEqual({
      [advanceKey(1, "granted")]: { agorot: 300000 },
      base: { agorot: 624765 },
    });
  });

  it("leaves the month it was given the same object never mutated", () => {
    withoutAdvance(month, 1, "repaid");
    expect(month.advances).toHaveLength(3);
    expect(Object.keys(month.overrides)).toHaveLength(3);
  });
});

describe("two movements of one kind on one advance", () => {
  it("are reported once each, and a grant beside a repayment is not one", () => {
    expect(
      duplicateAdvanceMovements([granted(1, 300000), repaid(1, 100000)]),
    ).toEqual([]);

    expect(
      duplicateAdvanceMovements([
        repaid(1, 100000),
        repaid(1, 50000),
        repaid(1, 25000),
        repaid(2, 10000),
      ]),
    ).toEqual([[1, "repaid"]]);
  });
});

/**
 * **A grant is what makes the debt, so it cannot be taken away from under a
 * repayment** (specs.md item 20). It is the way into a negative balance that is
 * easy to miss, because it makes the debt smaller rather than the repayment
 * bigger — and the criterion refuses the state and not only the one direction
 * that reaches it.
 */
describe("removing a grant", () => {
  /** ₪3,000 given in February, ₪1,000 repaid in each of March and April: the
   * grant cannot go while ₪2,000 of repayments stand against it. */
  const ledger = advanceLedger(opening(), [
    monthOf(february, [granted(1, 300000)]),
    monthOf(march, [repaid(1, 100000)]),
    monthOf(april, [repaid(1, 100000)]),
  ]);

  const standing = ledger[0];

  it("is refused while a later month still repays it", () => {
    expect(whyRemovalIsRefused(standing, granted(1, 300000))).toBe(
      "advanceRepaidAlready",
    );
  });

  /** ₪3,000 given twice over — ₪2,000 in February and ₪1,000 in March, say —
   * still covers ₪2,000 of repayments once the smaller grant goes. What is
   * refused is the state, not the gesture. */
  it("is allowed while what is left still covers what was repaid", () => {
    const twoGrants = advanceLedger(opening(), [
      monthOf(february, [granted(1, 200000)]),
      monthOf(march, [granted(1, 100000), repaid(1, 100000)]),
      monthOf(april, [repaid(1, 100000)]),
    ]);

    expect(whyRemovalIsRefused(twoGrants[0], granted(1, 100000))).toBeNull();
  });

  /** Taking a repayment off only ever makes the debt larger, which is a
   * position the application can name. */
  it("never refuses a repayment", () => {
    expect(whyRemovalIsRefused(standing, repaid(1, 100000))).toBeNull();
  });

  /** A stale page can ask to remove a movement another gesture has already
   * taken off, and the answer to that is nothing rather than an error. */
  it("says nothing about a movement that is not there", () => {
    expect(whyRemovalIsRefused(standing, undefined)).toBeNull();
    expect(whyRemovalIsRefused(undefined, granted(1, 300000))).toBeNull();
  });

  it("is allowed once the repayments have gone", () => {
    const unrepaid = advanceLedger(opening(), [
      monthOf(february, [granted(1, 300000)]),
    ]);
    expect(whyRemovalIsRefused(unrepaid[0], granted(1, 300000))).toBeNull();
  });
});

/** The reason travels with the standing and not only with the movement,
 * because a later month is exactly the reader item 20 says it is for. */
describe("the reason an advance was given", () => {
  it("is carried forward from the month that gave it", () => {
    const [standing] = advanceLedger(opening(), [
      monthOf(february, [granted(1, 300000, "לטיסה הביתה")]),
      monthOf(april, [repaid(1, 100000)]),
    ]);
    expect(standing.note).toBe("לטיסה הביתה");
  });

  it("comes from the opening position where that is where the advance came from", () => {
    const [standing] = advanceLedger(
      opening([
        {
          number: 1,
          principalAgorot: OPENING_PRINCIPAL,
          repaidAgorot: OPENING_REPAID,
          note: "מלפני המעבר ליישום",
        },
      ]),
      [],
    );
    expect(standing.note).toBe("מלפני המעבר ליישום");
  });
});
