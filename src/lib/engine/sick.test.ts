import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth, lineKeys } from "@/lib/engine/month";
import {
  paidFractionOfSpellDay,
  sickDaysIn,
  sickDeductionDays,
  spellsOf,
} from "@/lib/engine/sick";
import { snapshotTerms } from "@/lib/engine/types";
import type { ClosedMonthFacts, ClosedSpan, WorkerTerms } from "@/lib/engine/types";
import type { MonthResult, YearMonth } from "@/lib/types";

/**
 * Sick pay: the statutory tiers, the deduction that carries them onto a sheet
 * whose base never shrinks, and the spell that crosses a month boundary.
 *
 * **Where each expected figure comes from.** Every one below is item 8's own
 * wording turned into agorot at `S / 25`, and the arithmetic is shown in the
 * open beside the assertion. None is read back from what the engine returned.
 *
 *   S = ₪6,247.65 = 624,765 agorot     the August 2025 wage (specs.md Part 4)
 *   a sick day = S / 25 = 24,990.6     item 8, "the monthly salary over 25"
 *
 *   one day deducted    1   × 24,990.6 = 24,990.6  -> 24,991 agorot
 *   two days deducted   2   × 24,990.6 = 49,981.2  -> 49,981 agorot
 *   one and a half      1.5 × 24,990.6 = 37,485.9  -> 37,486 agorot
 *
 * The rounding is `Math.round` once at the end and never between steps
 * (item 3), which is why the two-day figure is 49,981 and not twice 24,991.
 */

const SALARY = 624765;
const REST_EVE_SUPPLEMENT = 10000;

const AUGUST_2025: YearMonth = { year: 2025, month: 8 };
const SEPTEMBER_2025: YearMonth = { year: 2025, month: 9 };

/**
 * August 2025, read off the calendar and not from memory:
 *
 *     Fri 1  Sat 2  Sun 3  Mon 4  Tue 5  Wed 6  Thu 7  Fri 8  Sat 9  Sun 10
 *     Mon 11 ... Sat 16 ... Sat 23 ... Fri 29  Sat 30  Sun 31
 *
 * Five Fridays — 1, 8, 15, 22, 29 — and five Saturdays, so 26 standard days,
 * which is Part 4's "a 31-day month with 26 working days".
 */
const sick = (from: string, to: string): ClosedSpan => ({
  id: `sick-${from}-${to}`,
  kind: "sick",
  from,
  to,
});

/**
 * The opening sick balance. 43.5 days against a ceiling of ninety is the
 * family's own standing position, recorded in `docs/plan-calculation-engine.md`
 * Step 4. It is here so the balance floor of item 8 never fires in a test about
 * the tiers — a refusal would hide the figure the test is checking — and the
 * floor has its own tests in `balances.test.ts`.
 */
const OPENING_SICK_DAYS = 43.5;

function terms(overrides: Partial<WorkerTerms> = {}): WorkerTerms {
  return {
    employedSince: "2024-04-01",
    baseMonthlySalaryAgorot: SALARY,
    restDay: SATURDAY,
    restEveSupplementAgorot: REST_EVE_SUPPLEMENT,
    recuperationMonth: 7,
    standingLines: [],
    country: "PH",
    openingPosition: {
      vacationDays: 0,
      sickDays: OPENING_SICK_DAYS,
      advances: [],
    },
    ...overrides,
  };
}

function facts(
  month: YearMonth,
  spans: ClosedSpan[],
  worker: WorkerTerms = terms(),
): ClosedMonthFacts {
  return {
    month,
    terms: snapshotTerms(worker),
    confirmedWage: {
      baseAgorot: SALARY,
      minimumAgorot: SALARY,
      effectiveFrom: "2025-04-01",
    },
    spans,
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

function deductionLine(result: MonthResult) {
  return result.lines.find((line) => line.key === lineKeys.sickDeduction);
}

function deduct(month: YearMonth, spans: ClosedSpan[], workerTerms = terms()) {
  return deductionLine(calculateMonth(facts(month, spans), workerTerms));
}

describe("the tiers, counted from the spell's own first day (specs.md item 8)", () => {
  it("pays nothing for the first day, half for the second and third, all from the fourth", () => {
    // Item 8 in its own words, and the four numbers it names.
    expect(paidFractionOfSpellDay(1)).toBe(0);
    expect(paidFractionOfSpellDay(2)).toBe(0.5);
    expect(paidFractionOfSpellDay(3)).toBe(0.5);
    expect(paidFractionOfSpellDay(4)).toBe(1);
    expect(paidFractionOfSpellDay(17)).toBe(1);
  });

  it("deducts a whole day for a one-day spell and pays it nothing", () => {
    // Sunday 3 August, one day. Tier day 1, so the whole day is unfunded:
    // 1 × 24,990.6 = 24,990.6 -> 24,991 agorot, and it subtracts.
    const line = deduct(AUGUST_2025, [sick("2025-08-03", "2025-08-03")]);
    expect(line?.amount).toBe(-24991);
    expect(line?.units).toBe(-1);
    expect(line?.rate).toBe(SALARY / 25); // item 8: the monthly salary over 25
  });

  it("deducts two days' worth for a three-day spell", () => {
    // Sunday 3 to Tuesday 5 August: tier days 1, 2, 3 -> 1 + 0.5 + 0.5 = 2 days.
    // 2 × 24,990.6 = 49,981.2 -> 49,981 agorot.
    const line = deduct(AUGUST_2025, [sick("2025-08-03", "2025-08-05")]);
    expect(line?.units).toBe(-2);
    expect(line?.amount).toBe(-49981);
  });

  it("deducts the same two and no more for a four-day spell", () => {
    // Sunday 3 to Wednesday 6 August. The fourth day is paid in full, so it adds
    // nothing to the deduction: a difference between the two means the tiers are
    // off by one.
    const three = deduct(AUGUST_2025, [sick("2025-08-03", "2025-08-05")]);
    const four = deduct(AUGUST_2025, [sick("2025-08-03", "2025-08-06")]);
    expect(four?.amount).toBe(-49981);
    expect(four?.amount).toBe(three?.amount);
  });

  it("still deducts only those two after a fortnight of sickness", () => {
    // Sunday 3 to Saturday 16 August. Everything from the fourth day on is paid
    // in full, so a long spell costs the worker exactly what a three-day one
    // does: the tiers are a fixed price at the start of an illness and not a
    // rate that runs with it.
    const line = deduct(AUGUST_2025, [sick("2025-08-03", "2025-08-16")]);
    expect(line?.amount).toBe(-49981);
  });
});

describe("a spell across a month boundary is one spell (specs.md item 8)", () => {
  // 29 August 2025 is a Friday, 30 August a Saturday and 31 August a Sunday. The
  // spell runs on into Monday 1, Tuesday 2 and Wednesday 3 September.
  const spans = [sick("2025-08-29", "2025-09-03")];

  it("puts tier days one to three in August and four to six in September", () => {
    expect(sickDaysIn(spans, AUGUST_2025, SATURDAY).map((day) => day.dayOfSpell)).toEqual([
      1, 2, 3,
    ]);
    expect(
      sickDaysIn(spans, SEPTEMBER_2025, SATURDAY).map((day) => day.dayOfSpell),
    ).toEqual([4, 5, 6]);
  });

  it("deducts one and a half days in August, the Saturday inside it not being paid", () => {
    // Friday 29 is tier day 1   -> a whole day unfunded                 = 1
    // Saturday 30 is tier day 2 -> not paid, so nothing to take back    = 0
    // Sunday 31 is tier day 3   -> half a day unfunded                  = 0.5
    // 1.5 × 24,990.6 = 37,485.9 -> 37,486 agorot.
    const line = deduct(AUGUST_2025, spans);
    expect(line?.units).toBe(-1.5);
    expect(line?.amount).toBe(-37486);
  });

  it("deducts nothing at all in September", () => {
    // Days four onward are paid in full, so September carries no such row —
    // not a row reading zero. If September deducted as though the spell began
    // there it would take two more days off her, and she would be underpaid
    // twice over for one illness.
    const september = calculateMonth(facts(SEPTEMBER_2025, spans), terms());
    expect(deductionLine(september)).toBeUndefined();
    expect(sickDeductionDays(spans, SEPTEMBER_2025, SATURDAY)).toBe(0);
  });

  it("draws the days from the balance in the month each day fell in", () => {
    // The tiers belong to the spell; the balance belongs to the month. Three
    // days in August and three in September, Saturdays included (item 8).
    const august = calculateMonth(facts(AUGUST_2025, spans), terms());
    const september = calculateMonth(facts(SEPTEMBER_2025, spans), terms());
    expect(august.balances.find((line) => line.kind === "sick")?.used).toBe(3);
    expect(september.balances.find((line) => line.kind === "sick")?.used).toBe(3);
  });
});

describe("the four things a Saturday inside a spell does (specs.md item 8)", () => {
  // It is not paid; nothing is deducted from the money for it; it is drawn from
  // the sick balance all the same, because a balance counts days and not money;
  // and it advances the position in the spell. The three tests below assert all
  // four, and collapsing any two of them is how this goes wrong.
  //
  // Friday 8 to Monday 11 August: Fri 8, Sat 9, Sun 10, Mon 11 — tier days
  // 1, 2, 3 and 4.
  const spans = [sick("2025-08-08", "2025-08-11")];

  it("advances the tier, and comes off the balance even so", () => {
    const result = calculateMonth(facts(AUGUST_2025, spans), terms());
    expect(result.balances.find((line) => line.kind === "sick")?.used).toBe(4);
    expect(sickDaysIn(spans, AUGUST_2025, SATURDAY).map((day) => day.dayOfSpell)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("does not deduct for them, because they were never paid for", () => {
    // Friday 8 is tier day 1   -> 1
    // Saturday 9 is tier day 2 -> 0. A Saturday stands outside the standard
    //   count, so the base never paid for it, and item 8 says the rest days in
    //   a spell are not paid. Taking money back for one would charge her for a
    //   day she was not paid. It still advances the tier, which is what makes
    //   the Sunday the third day and not the second.
    // Sunday 10 is tier day 3  -> 0.5
    // Monday 11 is tier day 4  -> 0
    // 1.5 × 24,990.6 = 37,485.9 -> 37,486 agorot.
    expect(sickDeductionDays(spans, AUGUST_2025, SATURDAY)).toBe(1.5);
    expect(deduct(AUGUST_2025, spans)?.amount).toBe(-37486);
  });

  it("does not let a Saturday inside a spell be paid as a Saturday worked", () => {
    // The other half of "not paid". August has five Saturdays and a day
    // carrying no mark is a day she worked, so an ordinary August pays five at
    // the rest-day rate; Saturday 9 falls inside the spell and drops to four.
    // Part 4 gives that rate as ₪426.35, so 4 × 42,635 = 170,540 agorot.
    const result = calculateMonth(facts(AUGUST_2025, spans), terms());
    const restDays = result.lines.find(
      (line) => line.key === lineKeys.restDays,
    );
    expect(restDays?.units).toBe(4);
    expect(restDays?.amount).toBe(170540);

    const ordinary = calculateMonth(facts(AUGUST_2025, []), terms());
    expect(
      ordinary.lines.find((line) => line.key === lineKeys.restDays)?.units,
    ).toBe(5);
  });
});

describe("where the deduction sits on the sheet (specs.md item 8, Part 5)", () => {
  const spans = [sick("2025-08-03", "2025-08-05")];

  it("sits in column E, inside the same subtotal as the base and the supplement", () => {
    // Item 8: "inside the same subtotal as the base and the rest-eve supplement,
    // and never among the one-off payments: a deduction is not a payment."
    const result = calculateMonth(facts(AUGUST_2025, spans), terms());
    expect(deductionLine(result)?.column).toBe("E");
    // The base ₪6,247.65, plus five Fridays at ₪100 = ₪500, less two days at
    // ₪249.906 = ₪499.81: 624,765 + 50,000 - 49,981 agorot.
    const e = result.subtotals.find((subtotal) => subtotal.column === "E");
    expect(e?.amount).toBe(624765 + 50000 - 49981);
    expect(result.subtotals.some((subtotal) => subtotal.column === "G")).toBe(
      false,
    );
  });

  it("never reduces the base and never moves the standard count", () => {
    // The salary is calculated from the standard count, so sickness leaves the
    // actual count and not the standard one (items 5, 8). Three days off 26
    // leaves 23.
    const result = calculateMonth(facts(AUGUST_2025, spans), terms());
    expect(result.lines.find((line) => line.key === lineKeys.base)?.amount).toBe(
      624765,
    );
    expect(result.standardDays).toBe(26);
    expect(result.actualDays).toBe(23);
  });

  it("reaches the month's total, because column E does", () => {
    // Gross is E + F + G. Nothing was marked on a Saturday, so all five of
    // August's are worked and column F is 5 × ₪426.35 = 213,175 agorot — Part
    // 4's own rate. The deduction is in E and therefore in the gross.
    const result = calculateMonth(facts(AUGUST_2025, spans), terms());
    expect(result.gross).toBe(624765 + 50000 - 49981 + 213175);
    expect(result.net).toBe(result.gross);
  });
});


describe("what counts as one spell (specs.md item 8)", () => {
  it("reads two spans meeting end to end as the one illness they are", () => {
    // 3-5 August and 6-7 August, with no day between them. The tiers are not
    // restarted: it is a day that refuses the mark that leaves two spells where
    // one was intended, not the act of entering a range twice.
    // A spell ends on the first day no sickness was reported, and there is no
    // other way to end one — so an illness that ran unbroken is read as one
    // however many ranges it was entered as. Where that folds two genuinely
    // separate illnesses together, the fourth day is paid in full instead of
    // starting again at nothing, which leans in the worker's favour; item 8
    // settles that case with the manual override of item 17.
    const spans = [
      sick("2025-08-03", "2025-08-05"),
      sick("2025-08-06", "2025-08-07"),
    ];
    expect(spellsOf(spans, SATURDAY)).toEqual([{ from: "2025-08-03", to: "2025-08-07" }]);
    // Tier days 1 to 5 -> 1 + 0.5 + 0.5 = 2 days, the three-day figure again.
    expect(sickDeductionDays(spans, AUGUST_2025, SATURDAY)).toBe(2);
    expect(deduct(AUGUST_2025, spans)?.amount).toBe(-49981);
  });

  it("ends a spell on the first working day no sickness was reported", () => {
    // 3-5 August and 7-9 August, with the 6th not marked. Wednesday the 6th is
    // an ordinary working day she owed attendance on, so it is what ends the
    // first spell and the tiers restart on the 7th. Two spells:
    //   Sun 3, Mon 4, Tue 5  -> 1 + 0.5 + 0.5           = 2
    //   Thu 7, Fri 8, Sat 9  -> 1 + 0.5 + 0 (Saturday)  = 1.5
    // 3.5 × 24,990.6 = 87,467.1 -> 87,467 agorot, against 49,981 had the six
    // days been one spell. Item 8 is explicit that the break changes the money,
    // which is why the skipped day and its reason are shown to the user rather
    // than absorbed silently.
    const spans = [
      sick("2025-08-03", "2025-08-05"),
      sick("2025-08-07", "2025-08-09"),
    ];
    expect(spellsOf(spans, SATURDAY)).toHaveLength(2);
    expect(sickDeductionDays(spans, AUGUST_2025, SATURDAY)).toBe(3.5);
    expect(deduct(AUGUST_2025, spans)?.amount).toBe(-87467);
  });

  it("orders a span by date before reading it, never by how it was entered", () => {
    // A leftward drag in a right-to-left calendar moves forward in time
    // (Part 5), so a span may arrive with its two ends the other way round.
    const reversed: ClosedSpan = {
      id: "sick-reversed",
      kind: "sick",
      from: "2025-08-05",
      to: "2025-08-03",
    };
    expect(spellsOf([reversed], SATURDAY)).toEqual([
      { from: "2025-08-03", to: "2025-08-05" },
    ]);
    expect(sickDeductionDays([reversed], AUGUST_2025, SATURDAY)).toBe(2);
  });
});

describe("a month with no sickness in it", () => {
  it("carries no such row rather than a row reading zero", () => {
    const result = calculateMonth(facts(AUGUST_2025, []), terms());
    expect(deductionLine(result)).toBeUndefined();
    // The base, five Fridays at ₪100, and five Saturdays at Part 4's ₪426.35.
    expect(result.gross).toBe(624765 + 50000 + 213175);
  });
});
