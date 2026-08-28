import { describe, expect, it } from "vitest";
import { countMonth } from "@/lib/engine/counts";
import type { MonthFacts, MonthSpan, WorkerTerms } from "@/lib/engine/types";
import type { YearMonth } from "@/lib/types";

/**
 * Every figure below is quoted from `specs.md`, never read back from the
 * engine. Part 4 states August 2025's 31 days, its 26 working days, its five
 * Fridays and its four worked Saturdays outright; Part 5 states both halves of
 * the Saturday-start / Sunday-start pair, again as figures rather than as a
 * rule to apply. The remaining assertions are items 5 and 8 in words.
 */

function facts(month: YearMonth, spans: MonthSpan[] = []): MonthFacts {
  return {
    month,
    confirmedWage: {
      baseAgorot: 624765,
      minimumAgorot: 624765,
      effectiveFrom: "2025-04-01",
    },
    spans,
    advances: [],
    thirdPartyPayments: [],
    extraPayments: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

function terms(overrides: Partial<WorkerTerms> = {}): WorkerTerms {
  return {
    employedSince: "2024-04-01",
    baseMonthlySalaryAgorot: 624765,
    fridaySupplementAgorot: 10000,
    fridayIsPocketMoney: false,
    recuperationMonth: 7,
    country: "PH",
    openingPosition: { vacationDays: 0, sickDays: 0, advances: [] },
    ...overrides,
  };
}

const sick = (from: string, to: string): MonthSpan => ({
  id: `sick-${from}-${to}`,
  kind: "sick",
  from,
  to,
});

const vacation = (from: string, to: string): MonthSpan => ({
  id: `vac-${from}-${to}`,
  kind: "vacation",
  from,
  to,
});

const freeSaturday = (date: string): MonthSpan => ({
  id: `free-${date}`,
  kind: "freeSaturday",
  from: date,
  to: date,
});

const holiday = (date: string, worked: boolean): MonthSpan => ({
  id: `hol-${date}`,
  kind: "holiday",
  from: date,
  to: date,
  worked,
});

/** Part 4's known case: 31 days, a free Saturday on the 16th, paid holidays on
 * the 19th and the 21st both worked. */
const AUGUST_2025: YearMonth = { year: 2025, month: 8 };
const august2025Spans: MonthSpan[] = [
  freeSaturday("2025-08-16"),
  holiday("2025-08-19", true),
  holiday("2025-08-21", true),
];

describe("August 2025, the known case (specs.md Part 4)", () => {
  it("gives 26 standard days from 31 days less 5 Saturdays", () => {
    // Part 4: "a 31-day month with 26 working days". Anything else and the base
    // salary is wrong before a single rate is applied to it.
    const counts = countMonth(facts(AUGUST_2025, august2025Spans), terms());
    expect(counts.standardDays).toBe(26);
    expect(counts.saturdays).toBe(5);
  });

  it("gives five Fridays, all worked", () => {
    // Part 4: "five Fridays worked".
    const counts = countMonth(facts(AUGUST_2025, august2025Spans), terms());
    expect(counts.fridays).toBe(5);
    expect(counts.fridaysWorked).toBe(5);
    expect(counts.fridaysPaidSupplement).toBe(5);
  });

  it("gives four Saturdays worked after the free one on the 16th", () => {
    // Part 4: "four Saturdays worked, one free Saturday on the 16th".
    const counts = countMonth(facts(AUGUST_2025, august2025Spans), terms());
    expect(counts.saturdaysWorked).toBe(4);
  });

  it("counts two worked holidays as days worked", () => {
    // Item 9: a holiday she works is worked. Both fall on weekdays, so the
    // actual count still equals the standard count.
    const counts = countMonth(facts(AUGUST_2025, august2025Spans), terms());
    expect(counts.actualDays).toBe(26);
  });
});

describe("a free Saturday changes neither day count (specs.md item 5)", () => {
  it("leaves the standard and actual counts exactly as they were", () => {
    // Saturdays sit outside the standard count already, so marking one free
    // must move neither figure. This is the mistake that would silently shrink
    // the base salary.
    const without = countMonth(facts(AUGUST_2025, []), terms());
    const withFree = countMonth(
      facts(AUGUST_2025, [freeSaturday("2025-08-16")]),
      terms(),
    );

    expect(withFree.standardDays).toBe(without.standardDays);
    expect(withFree.actualDays).toBe(without.actualDays);
    expect(withFree.standardDays).toBe(26);
    expect(withFree.actualDays).toBe(26);
    // It moves only the count it should.
    expect(without.saturdaysWorked).toBe(5);
    expect(withFree.saturdaysWorked).toBe(4);
  });
});

describe("the Saturday-start and Sunday-start pair (specs.md Part 5)", () => {
  // Part 5 states both halves as figures: "A thirty-one-day month beginning on
  // a Saturday holds five Saturdays and twenty-six working days, while the same
  // length beginning on a Sunday holds four and twenty-seven."
  const augustSaturdayStart: YearMonth = { year: 2026, month: 8 };
  const marchSundayStart: YearMonth = { year: 2026, month: 3 };

  it("gives five Saturdays and 26 working days when the 1st is a Saturday", () => {
    const counts = countMonth(facts(augustSaturdayStart), terms());
    expect(counts.saturdays).toBe(5);
    expect(counts.standardDays).toBe(26);
  });

  it("gives four Saturdays and 27 working days when the 1st is a Sunday", () => {
    const counts = countMonth(facts(marchSundayStart), terms());
    expect(counts.saturdays).toBe(4);
    expect(counts.standardDays).toBe(27);
  });

  it("does not give two 31-day months the same counts", () => {
    // Two months of the same length agreeing is the off-by-one Part 5 warns
    // about, and it would stay invisible until a month with an absence in it.
    const saturdayStart = countMonth(facts(augustSaturdayStart), terms());
    const sundayStart = countMonth(facts(marchSundayStart), terms());
    expect(saturdayStart.saturdays).not.toBe(sundayStart.saturdays);
    expect(saturdayStart.standardDays).not.toBe(sundayStart.standardDays);
  });
});

describe("what leaves the actual count and what does not (specs.md items 5, 8)", () => {
  it("leaves the actual count for vacation while the standard count holds", () => {
    // Item 5: "nothing the worker takes reduces it — neither vacation nor
    // sickness. The actual count is that same figure less the days she did not
    // in fact work." 18-20 August 2025 is Monday to Wednesday.
    const counts = countMonth(
      facts(AUGUST_2025, [vacation("2025-08-18", "2025-08-20")]),
      terms(),
    );
    expect(counts.standardDays).toBe(26);
    expect(counts.actualDays).toBe(23);
  });

  it("leaves the actual count for sickness while the standard count holds", () => {
    const counts = countMonth(
      facts(AUGUST_2025, [sick("2025-08-18", "2025-08-20")]),
      terms(),
    );
    expect(counts.standardDays).toBe(26);
    expect(counts.actualDays).toBe(23);
  });

  it("does not let a Saturday inside a sick spell reduce the standard count", () => {
    // The spell runs Friday 15 to Sunday 17 August 2025 and swallows Saturday
    // the 16th. Saturdays are outside the standard count, so only the two
    // weekdays may leave the actual count.
    const counts = countMonth(
      facts(AUGUST_2025, [sick("2025-08-15", "2025-08-17")]),
      terms(),
    );
    expect(counts.standardDays).toBe(26);
    expect(counts.actualDays).toBe(24);
  });

  it("does not pay a Saturday inside a sick spell as a Saturday worked", () => {
    // Item 8: the Saturdays inside a spell count toward it and are drawn from
    // the balance, but are not paid. Paying one would be a Saturday she spent
    // sick charged at the rest-day rate.
    const counts = countMonth(
      facts(AUGUST_2025, [sick("2025-08-15", "2025-08-17")]),
      terms(),
    );
    expect(counts.saturdaysWorked).toBe(4);
  });

  it("counts a holiday she did not work as a day not worked (specs.md item 5)", () => {
    const counts = countMonth(
      facts(AUGUST_2025, [holiday("2025-08-19", false)]),
      terms(),
    );
    expect(counts.standardDays).toBe(26);
    expect(counts.actualDays).toBe(25);
  });

  it("leaves half a day for half a vacation day (specs.md item 5)", () => {
    // "A day taken in part leaves the actual count in that same proportion, so
    // half a vacation day leaves half a day." 19 August 2025 is a Tuesday.
    const counts = countMonth(
      facts(AUGUST_2025, [{ ...vacation("2025-08-19", "2025-08-19"), fraction: 0.5 }]),
      terms(),
    );
    expect(counts.standardDays).toBe(26);
    expect(counts.actualDays).toBe(25.5);
  });
});

describe("a holiday moves the count or the money, never both (specs.md item 5)", () => {
  // The sanity check item 5 records: a holiday she worked changes the money and
  // not the count; one she did not work changes the count and not the money. A
  // holiday that moves both, or neither, is a mistake. This file owns the count
  // half of that pair — Step 6 owns the money half.
  const worked = countMonth(facts(AUGUST_2025, [holiday("2025-08-19", true)]), terms());
  const notWorked = countMonth(
    facts(AUGUST_2025, [holiday("2025-08-19", false)]),
    terms(),
  );
  const neither = countMonth(facts(AUGUST_2025), terms());

  it("does not move the actual count for a holiday she worked", () => {
    expect(worked.actualDays).toBe(neither.actualDays);
    expect(worked.actualDays).toBe(26);
  });

  it("moves the actual count for a holiday she did not work", () => {
    expect(notWorked.actualDays).toBe(neither.actualDays - 1);
  });

  it("moves neither standard count, whichever the holiday was", () => {
    expect(worked.standardDays).toBe(26);
    expect(notWorked.standardDays).toBe(26);
  });
});

describe("the Friday supplement and the week lost to sickness (specs.md items 8, 14)", () => {
  // August 2025's Fridays are the 1st, 8th, 15th, 22nd and 29th. The week of
  // Friday the 22nd runs Sunday the 17th through Friday the 22nd.
  const pocketMoney = terms({ fridayIsPocketMoney: true });

  it("pays the supplement when sickness ran Sunday to Thursday and the Friday was worked", () => {
    // Item 8: one day worked in that week is enough for the supplement to be
    // paid. This is the case that fails if "the week" is computed as the seven
    // days before the Friday.
    const counts = countMonth(
      facts(AUGUST_2025, [sick("2025-08-17", "2025-08-21")]),
      pocketMoney,
    );
    expect(counts.fridaysPaidSupplement).toBe(5);
    expect(counts.fridaysWorked).toBe(5);
  });

  it("does not pay it when sickness ran Sunday through Friday", () => {
    // The whole of that week was lost, so that one Friday drops out and the
    // other four stand.
    const counts = countMonth(
      facts(AUGUST_2025, [sick("2025-08-17", "2025-08-22")]),
      pocketMoney,
    );
    expect(counts.fridaysPaidSupplement).toBe(4);
    expect(counts.fridaysWorked).toBe(4);
  });

  it("does not count Saturday as a working day of that week", () => {
    // Sunday the 17th through Friday the 22nd is the whole week even though
    // Saturday the 23rd was worked: Saturday is the weekly rest day and is not
    // counted (item 8).
    const counts = countMonth(
      facts(AUGUST_2025, [sick("2025-08-17", "2025-08-22")]),
      pocketMoney,
    );
    expect(counts.saturdaysWorked).toBe(5);
    expect(counts.fridaysPaidSupplement).toBe(4);
  });

  it("pays a Friday not worked only where the supplement is pocket money (specs.md item 14)", () => {
    // The same vacation Friday, read under both settings: pocket money pays it
    // all the same, and the supplement that follows the day does not.
    const onVacation = [vacation("2025-08-22", "2025-08-22")];
    expect(
      countMonth(facts(AUGUST_2025, onVacation), pocketMoney).fridaysPaidSupplement,
    ).toBe(5);
    expect(
      countMonth(facts(AUGUST_2025, onVacation), terms()).fridaysPaidSupplement,
    ).toBe(4);
  });
});
