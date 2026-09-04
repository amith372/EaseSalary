import { describe, expect, it } from "vitest";
import { previousQuarter, eachMonth, parseYearMonth } from "@/lib/dates";
import {
  offeredPeriodFor,
  reviewThirdPartyPayment,
  thirdPartyLineKey,
  withoutThirdPartyPayment,
} from "@/lib/engine/thirdParty";
import type { ThirdPartyDraft } from "@/lib/engine/thirdParty";
import type { ThirdPartyPayment } from "@/lib/engine/types";

/**
 * The rules for recording a payment to a third party (specs.md item 16), which
 * is the half of that criterion the application had no way to reach: until this
 * step a payment could only be seeded.
 *
 * Every figure asserted here comes from `specs.md`, from item 19's own quarterly
 * rule, or from the arithmetic of a decimal — never from what the function
 * returned (`CLAUDE.md`).
 */

const draft = (over: Partial<ThirdPartyDraft> = {}): ThirdPartyDraft => ({
  kind: "medicalInsurance",
  amount: "500",
  coversFrom: "",
  coversTo: "",
  note: "",
  ...over,
});

describe("a draft becomes a payment, or says why not (specs.md item 16)", () => {
  it("takes the kind, the amount and the note, and stores no empty note", () => {
    const reviewed = reviewThirdPartyPayment(
      draft({ amount: "500", note: "  הפוליסה השנתית  " }),
      [],
    );
    expect(reviewed).toEqual({
      ok: true,
      payment: {
        kind: "medicalInsurance",
        agorot: 50000,
        note: "הפוליסה השנתית",
      },
    });

    // No note at all rather than an empty string: an absent reason and a reason
    // that is the empty string are the same fact, and storing two shapes for it
    // means every reader has to know both.
    const bare = reviewThirdPartyPayment(draft({ note: "   " }), []);
    expect(bare).toEqual({
      ok: true,
      payment: { kind: "medicalInsurance", agorot: 50000 },
    });
  });

  it("reads the amount as digits and never through a float", () => {
    // The nearest agora to 1.005 shekels is 101. `Math.round(Number("1.005") *
    // 100)` is 100, because 1.005 is not representable — so this is the test
    // that catches the whole path being routed back through a float, and the
    // decimal is the only place it shows.
    const reviewed = reviewThirdPartyPayment(draft({ amount: "1.005" }), []);
    expect(reviewed).toEqual({
      ok: true,
      payment: { kind: "medicalInsurance", agorot: 101 },
    });
  });

  it("refuses an amount that is not one, and refuses zero", () => {
    // Zero is refused here as it is for a line the user adds (item 20) and
    // unlike the income tax (item 17): a payment that moved no money is not a
    // payment, and it would print in the export as a payment of nothing.
    for (const amount of ["", "  ", "abc", "-500", "0", "0.00"]) {
      expect(reviewThirdPartyPayment(draft({ amount }), [])).toEqual({
        ok: false,
        reason: "amount",
      });
    }
  });

  it("refuses a kind outside the union, which only a crafted request sends", () => {
    // The chips offer nothing but the seven, so this is the server refusing what
    // the form cannot produce (Part 3). A stored kind outside the union would
    // reach `he.sheet.thirdParty[kind]` and come back undefined — a row on the
    // sheet with no label on it.
    for (const kind of ["visaFee", "", "pension", "__proto__"]) {
      expect(reviewThirdPartyPayment(draft({ kind }), [])).toEqual({
        ok: false,
        reason: "shape",
      });
    }
  });

  it("refuses a second payment of a kind the month already has", () => {
    // The sheet holds one row per kind, and two rows under one key can be
    // neither overridden nor explained apart (items 16, 17, 24).
    const existing: ThirdPartyPayment[] = [
      { kind: "medicalInsurance", agorot: 50000 },
    ];
    expect(
      reviewThirdPartyPayment(draft({ kind: "medicalInsurance" }), existing),
    ).toEqual({ ok: false, reason: "thirdPartyPaidTwice" });

    // A different kind in the same month is ordinary: a month may settle a
    // quarter and renew a policy at once.
    expect(
      reviewThirdPartyPayment(draft({ kind: "agencyFee" }), existing).ok,
    ).toBe(true);
  });

  it("lets one month hold both of the sheet's two visa rows", () => {
    // The reason B15 has a member of its own (items 16, 28). While one
    // `visaFee` covered both template rows, this pair was two payments of one
    // kind and the month was refused outright.
    const existing: ThirdPartyPayment[] = [
      { kind: "visaExtensionFee", agorot: 19500 },
    ];
    expect(
      reviewThirdPartyPayment(draft({ kind: "workerVisa" }), existing).ok,
    ).toBe(true);
  });
});

describe("the covered period is a run of months or nothing (item 16)", () => {
  it("stores no period when neither end is given", () => {
    const reviewed = reviewThirdPartyPayment(draft(), []);
    expect(reviewed.ok && reviewed.payment.coversMonths).toBeUndefined();
  });

  it("stores every month from the first to the last, inclusive", () => {
    // Item 19's own quarter: the ₪936 paid on 20.7.25 covers 4-6/25, three
    // months, which `שכר_חודשי_להאנה2025.xlsx` -> `חודש  7.25` -> B21 names.
    const reviewed = reviewThirdPartyPayment(
      draft({ coversFrom: "2025-04", coversTo: "2025-06" }),
      [],
    );
    expect(reviewed.ok && reviewed.payment.coversMonths).toEqual([
      { year: 2025, month: 4 },
      { year: 2025, month: 5 },
      { year: 2025, month: 6 },
    ]);
  });

  it("refuses half a period rather than guessing the other end", () => {
    // A first month with no last one names nothing, and completing it would put
    // months on the sheet's row that the user never chose.
    expect(
      reviewThirdPartyPayment(draft({ coversFrom: "2025-04" }), []),
    ).toEqual({ ok: false, reason: "periodIncomplete" });
    expect(reviewThirdPartyPayment(draft({ coversTo: "2025-06" }), [])).toEqual({
      ok: false,
      reason: "periodIncomplete",
    });
  });

  it("refuses a backwards period and never quietly reorders it", () => {
    // Which way round she meant it is not the application's to decide, and a
    // period silently flipped is one she will not check (item 16). This is the
    // mutation `orderDates` would invite if it were reached for here.
    expect(
      reviewThirdPartyPayment(
        draft({ coversFrom: "2025-06", coversTo: "2025-04" }),
        [],
      ),
    ).toEqual({ ok: false, reason: "periodBackwards" });
  });

  it("takes a single month as a period of one", () => {
    const reviewed = reviewThirdPartyPayment(
      draft({ coversFrom: "2025-04", coversTo: "2025-04" }),
      [],
    );
    expect(reviewed.ok && reviewed.payment.coversMonths).toEqual([
      { year: 2025, month: 4 },
    ]);
  });

  it("refuses a period longer than the permit's four-year cycle", () => {
    // A bound on a crafted request and not a rule the user can meet — every
    // period the screen offers is inside it (items 16, 28). Forty-eight months
    // stands and forty-nine does not.
    const fortyEight = reviewThirdPartyPayment(
      draft({ coversFrom: "2022-01", coversTo: "2025-12" }),
      [],
    );
    expect(fortyEight.ok && fortyEight.payment.coversMonths).toHaveLength(48);

    expect(
      reviewThirdPartyPayment(
        draft({ coversFrom: "2021-12", coversTo: "2025-12" }),
        [],
      ),
    ).toEqual({ ok: false, reason: "shape" });
  });
});

describe("a month written as YYYY-MM, read strictly", () => {
  it("reads a padded month and refuses everything else", () => {
    expect(parseYearMonth("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(parseYearMonth("  2026-09  ")).toEqual({ year: 2026, month: 9 });

    // Unpadded is refused rather than accepted, so one month has one spelling:
    // a stored month that round-trips to a different string is one the sheet's
    // own row label cannot be compared against.
    expect(parseYearMonth("2026-9")).toBeNull();
    // Month 0 and month 13 are refused rather than carried into the
    // neighbouring year, which is what `addMonths` would happily do.
    expect(parseYearMonth("2026-00")).toBeNull();
    expect(parseYearMonth("2026-13")).toBeNull();
    for (const text of ["", "2026", "26-09", "2026-09-01", "abcd-ef"]) {
      expect(parseYearMonth(text)).toBeNull();
    }
  });

  it("walks a run of months across a year boundary", () => {
    expect(eachMonth({ year: 2025, month: 11 }, { year: 2026, month: 2 })).toEqual(
      [
        { year: 2025, month: 11 },
        { year: 2025, month: 12 },
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
      ],
    );
    // Empty rather than reversed when the pair is the wrong way round, which is
    // what lets the caller refuse instead of silently correcting.
    expect(eachMonth({ year: 2026, month: 2 }, { year: 2025, month: 11 })).toEqual(
      [],
    );
  });
});

describe("the quarter a national-insurance payment is offered (item 19)", () => {
  it("offers the last calendar quarter to have closed", () => {
    // Paid once a quarter and in arrears. A payment recorded in April 2026 is
    // for January–March 2026, which is exactly what the seeded month does.
    expect(previousQuarter({ year: 2026, month: 4 })).toEqual({
      from: { year: 2026, month: 1 },
      to: { year: 2026, month: 3 },
    });
  });

  it("stays on the closed quarter when the family paid late", () => {
    // The whole difference between "the last quarter to have closed" and "the
    // three preceding months". In May the three preceding months are
    // February–April, which is no quarter anybody is billed for; the last
    // quarter to have closed is still January–March.
    expect(previousQuarter({ year: 2026, month: 5 })).toEqual({
      from: { year: 2026, month: 1 },
      to: { year: 2026, month: 3 },
    });
    expect(previousQuarter({ year: 2026, month: 6 })).toEqual({
      from: { year: 2026, month: 1 },
      to: { year: 2026, month: 3 },
    });
    // July opens the next one: April–June has now closed.
    expect(previousQuarter({ year: 2026, month: 7 })).toEqual({
      from: { year: 2026, month: 4 },
      to: { year: 2026, month: 6 },
    });
    // September, which is the month the seeded store opens on and the month
    // step 7's check is written against: it sits inside July–September, which
    // has not closed, so the answer is still April–June.
    expect(previousQuarter({ year: 2026, month: 9 })).toEqual({
      from: { year: 2026, month: 4 },
      to: { year: 2026, month: 6 },
    });
  });

  it("reaches back into the previous year in the first quarter", () => {
    for (const month of [1, 2, 3]) {
      expect(previousQuarter({ year: 2026, month })).toEqual({
        from: { year: 2025, month: 10 },
        to: { year: 2025, month: 12 },
      });
    }
  });

  it("offers a period for the national insurance and for nothing else", () => {
    // Only it is paid on a clock the application can read backwards. The yearly
    // fees run *forward* from an employment anniversary (item 15), so one rule
    // cannot serve both and guessing would be worse than leaving it blank.
    expect(offeredPeriodFor("nationalInsurance", { year: 2026, month: 4 })).toEqual(
      { from: { year: 2026, month: 1 }, to: { year: 2026, month: 3 } },
    );
    for (const kind of [
      "medicalInsurance",
      "placementFee",
      "agencyFee",
      "visaExtensionFee",
      "workerVisa",
      "licenceFee",
    ] as const) {
      expect(offeredPeriodFor(kind, { year: 2026, month: 4 })).toBeNull();
    }
  });
});

describe("removing a payment takes its override with it (items 16, 17)", () => {
  const month = {
    thirdPartyPayments: [
      { kind: "medicalInsurance", agorot: 50000 },
      { kind: "agencyFee", agorot: 30000 },
    ] satisfies ThirdPartyPayment[],
    overrides: {
      [thirdPartyLineKey("medicalInsurance")]: { agorot: 34816 },
      [thirdPartyLineKey("agencyFee")]: { agorot: 29900 },
    },
  };

  it("removes the payment and the amount typed over it, and nothing else", () => {
    const after = withoutThirdPartyPayment(month, "medicalInsurance");

    expect(after.thirdPartyPayments).toEqual([
      { kind: "agencyFee", agorot: 30000 },
    ]);
    // The orphan is the whole point: an override is addressed by the row's own
    // key, so one left behind is an amount waiting to reattach itself to a row
    // that never asked for it — and it would show as manual, with nothing on
    // screen to say where it came from.
    expect(after.overrides).toEqual({
      [thirdPartyLineKey("agencyFee")]: { agorot: 29900 },
    });
  });

  it("leaves the month alone when the kind was never recorded", () => {
    const after = withoutThirdPartyPayment(month, "workerVisa");
    expect(after.thirdPartyPayments).toEqual(month.thirdPartyPayments);
    expect(after.overrides).toEqual(month.overrides);
  });

  it("does not mutate the month it was given", () => {
    withoutThirdPartyPayment(month, "medicalInsurance");
    expect(month.thirdPartyPayments).toHaveLength(2);
    expect(Object.keys(month.overrides)).toHaveLength(2);
  });
});
