import { describe, expect, it } from "vitest";
import {
  buildBalances,
  monthlySickAccrual,
  monthlyVacationAccrual,
  seniorityYearOfCalendarYear,
  sickDaysAvailable,
  vacationDaysPerYear,
  vacationYearWarning,
} from "@/lib/engine/balances";
import { calculateMonth } from "@/lib/engine/month";
import { snapshotTerms } from "@/lib/engine/types";
import type {
  MonthContext,
  MonthFacts,
  MonthSpan,
  WorkerTerms,
} from "@/lib/engine/types";
import { InvalidMonthError, validateMonth } from "@/lib/engine/validate";
import type { BalanceKind, YearMonth } from "@/lib/types";

/**
 * The balances: the ladder, the accrual, the carry-forward, the ninety-day
 * ceiling, the floor that refuses rather than pays, and the seven-day warning.
 *
 * **Where each expected figure comes from.** Every one is named beside its
 * assertion: a tier or a rule from `specs.md` item 7 or 8, or arithmetic
 * between two of them shown in the open. Not one is read back from what the
 * engine returned — the accrual and the ceiling are exactly the figures
 * CLAUDE.md says to derive on paper first, because there is no family sheet to
 * check them against the way August 2025 has one.
 */

const AUGUST_2025: YearMonth = { year: 2025, month: 8 };

function terms(
  employedSince = "2024-04-01",
  opening: { vacationDays: number; sickDays: number } = {
    vacationDays: 0,
    sickDays: 0,
  },
): WorkerTerms {
  return {
    employedSince,
    baseMonthlySalaryAgorot: 624765,
    fridaySupplementAgorot: 10000,
    fridayIsPocketMoney: false,
    recuperationMonth: 7,
    country: "PH",
    openingPosition: { ...opening, advances: [] },
  };
}

function facts(month: YearMonth, spans: MonthSpan[] = []): MonthFacts {
  return {
    month,
    terms: snapshotTerms(terms()),
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

const span = (
  kind: "vacation" | "sick",
  from: string,
  to: string,
): MonthSpan => ({ id: `${kind}-${from}`, kind, from, to });

function balance(
  kind: BalanceKind,
  monthFacts: MonthFacts,
  workerTerms: WorkerTerms,
  opening?: { vacationDays: number; sickDays: number },
) {
  const line = buildBalances(monthFacts, workerTerms, opening).find(
    (candidate) => candidate.kind === kind,
  );
  if (!line) throw new Error(`no ${kind} balance line`);
  return line;
}

describe("the seniority ladder (specs.md item 7)", () => {
  it("gives fourteen days through year four, then sixteen, eighteen, twenty-one", () => {
    // Item 7, read straight off: fourteen a year through year four, sixteen in
    // year five, eighteen in year six, twenty-one in year seven.
    expect([1, 2, 3, 4].map(vacationDaysPerYear)).toEqual([14, 14, 14, 14]);
    expect(vacationDaysPerYear(5)).toBe(16);
    expect(vacationDaysPerYear(6)).toBe(18);
    expect(vacationDaysPerYear(7)).toBe(21);
  });

  it("adds one a year after the seventh and stops at twenty-eight", () => {
    // "one more each year to a ceiling of twenty-eight" (item 7): 21 in year
    // seven, so 22 in the eighth and 28 in the fourteenth — 21 + 7.
    expect(vacationDaysPerYear(8)).toBe(22);
    expect(vacationDaysPerYear(14)).toBe(28);
    // And it stops there rather than continuing to 29 and 30.
    expect(vacationDaysPerYear(15)).toBe(28);
    expect(vacationDaysPerYear(40)).toBe(28);
  });

  it("counts the year as a calendar year, not from the employment anniversary", () => {
    // Item 7: the year turns over on the 1st of January, and a worker who
    // started mid-year completes her first working year on the 31st of
    // December of that same year. Employed 1.4.2024, so 2024 is her first year
    // and 2028 her fifth — the figures item 7 states outright.
    const since = "2024-04-01";
    expect(seniorityYearOfCalendarYear(since, 2024)).toBe(1);
    expect(seniorityYearOfCalendarYear(since, 2025)).toBe(2);
    expect(seniorityYearOfCalendarYear(since, 2026)).toBe(3);
    expect(seniorityYearOfCalendarYear(since, 2027)).toBe(4);
    expect(seniorityYearOfCalendarYear(since, 2028)).toBe(5);
  });

  it("counts a first year of one day as a whole year on the ladder", () => {
    // Item 7 again, at its sharpest: a partial calendar year counts as a whole
    // year on the ladder. Employed on the last day of 2024, she is in her
    // second year on the 1st of January 2025.
    expect(seniorityYearOfCalendarYear("2024-12-31", 2024)).toBe(1);
    expect(seniorityYearOfCalendarYear("2024-12-31", 2025)).toBe(2);
  });

  it("steps on the 1st of January and nowhere inside a year", () => {
    // The check that catches an anniversary-based ladder. Employed 1.4.2024,
    // the step to sixteen days is 1.1.2028 (item 7). So April 2028 must not be
    // the boundary: every month of 2027 accrues at fourteen and every month of
    // 2028 at sixteen, the anniversary month included.
    const since = "2024-04-01";
    const months = Array.from({ length: 12 }, (_, index) => index + 1);
    for (const month of months) {
      expect(monthlyVacationAccrual(since, { year: 2027, month })).toBe(14 / 12);
      expect(monthlyVacationAccrual(since, { year: 2028, month })).toBe(16 / 12);
    }
  });
});

describe("the monthly accrual is a fraction, never a decimal (Part 5)", () => {
  it("is the year's entitlement over twelve, and not the workbook's 1.17", () => {
    // Part 5: שכר_חודשי_להאנה2026 → חישוב ימי מחלה וחופשה writes the monthly
    // vacation accrual as 1.17 in January to March and as fourteen twelfths
    // from April onward, in the same column. The fraction is what the engine
    // uses, and this is the assertion that says so directly.
    const monthly = monthlyVacationAccrual("2024-04-01", AUGUST_2025);
    expect(monthly).toBe(14 / 12);
    expect(monthly).not.toBe(1.17);
  });

  it("comes to fourteen over twelve months, where 1.17 a month comes to 14.04", () => {
    // Twelve months of 2025 carried forward month by month, nothing used.
    // Item 7 gives fourteen a year; the workbook's decimal gives 1.17 × 12 =
    // 14.04, shown here in the open, and that 0.04 a year is the drift Part 5
    // warns about.
    const worker = terms();
    let opening = { vacationDays: 0, sickDays: 0 };
    for (let month = 1; month <= 12; month += 1) {
      const line = balance("vacation", facts({ year: 2025, month }), worker, opening);
      opening = { vacationDays: line.closing ?? 0, sickDays: opening.sickDays };
    }

    expect(1.17 * 12).toBe(14.04);
    // Fourteen to a ten-billionth of a day. The residue is binary
    // representation and not rounding: a twelfth has no exact form in floating
    // point, so twelve additions of fourteen twelfths land 2e-15 short of
    // fourteen. That is thirteen orders of magnitude below the hundredth of a
    // day Part 5 is about, and a monthly figure rounded to 1.17 fails this by a
    // factor of a hundred million.
    expect(opening.vacationDays).toBeCloseTo(14, 10);
    expect(opening.vacationDays).not.toBeCloseTo(14.04, 3);
    expect(opening.vacationDays).not.toBeCloseTo(13.99, 3);
  });
});

describe("balances carry forward (specs.md item 7)", () => {
  it("opens month N+1 with the previous balance plus the accrual less what was used", () => {
    // Item 7, stated as a formula and asserted as one. Nothing used in August,
    // so September opens at exactly what August closed at.
    const worker = terms();
    const august = balance("vacation", facts(AUGUST_2025), worker, {
      vacationDays: 5,
      sickDays: 10,
    });
    expect(august.opening).toBe(5);
    expect(august.accrued).toBe(14 / 12);
    expect(august.closing).toBe(5 + 14 / 12);

    const september = balance(
      "vacation",
      facts({ year: 2025, month: 9 }),
      worker,
      { vacationDays: august.closing ?? 0, sickDays: 10 },
    );
    expect(september.opening).toBe(august.closing);
  });

  it("takes the days used off the month they fell in", () => {
    // Item 7: less what was used in month N. Three vacation days on the 1st to
    // the 3rd of December 2025 — a Monday to a Wednesday, no Saturday among
    // them, so `balanceDaysOf` counts three (item 5).
    const december = balance(
      "vacation",
      facts({ year: 2025, month: 12 }, [span("vacation", "2025-12-01", "2025-12-03")]),
      terms(),
      { vacationDays: 10, sickDays: 0 },
    );
    expect(december.used).toBe(3);
    expect(december.closing).toBe(10 + 14 / 12 - 3);
  });

  it("draws a spell that crosses a month boundary from the month each day fell in", () => {
    // Item 8: a spell is stored whole because its tiers count from its own
    // first day, but the balance it draws belongs to the month each day fell
    // in. The 28th of July to the 3rd of August 2025 is four days in July and
    // three in August, and sickness keeps its Saturdays (item 8) — there is
    // none inside this spell in either month.
    const spell = [span("sick", "2025-07-28", "2025-08-03")];
    const worker = terms();
    expect(
      balance("sick", facts({ year: 2025, month: 7 }, spell), worker, {
        vacationDays: 0,
        sickDays: 20,
      }).used,
    ).toBe(4);
    expect(
      balance("sick", facts(AUGUST_2025, spell), worker, {
        vacationDays: 0,
        sickDays: 20,
      }).used,
    ).toBe(3);
  });

  it("carries an unused balance across the end of December rather than deleting it", () => {
    // Item 7: an unused balance carries into the following years rather than
    // being paid out at the end of December, and the application never deletes
    // accrued days on its own. Twelve days standing at the year's end are
    // twelve days standing in January.
    const worker = terms();
    const january = balance(
      "vacation",
      facts({ year: 2026, month: 1 }),
      worker,
      { vacationDays: 12, sickDays: 30 },
    );
    expect(january.opening).toBe(12);
    // 2026 is her third year, still fourteen a year (item 7).
    expect(january.accrued).toBe(14 / 12);
    expect(january.closing).toBe(12 + 14 / 12);
  });
});

describe("the sick balance (specs.md items 7, 8)", () => {
  it("accrues 1.5 a month", () => {
    expect(monthlySickAccrual(0)).toBe(1.5);
    expect(monthlySickAccrual(40)).toBe(1.5);
  });

  it("stops at ninety and does not reset in January", () => {
    // Items 7 and 8: it stops at ninety days and never resets at a year
    // boundary. December opens at 89, so it accrues the one day that fits and
    // closes at 90; January opens at 90, accrues nothing, and stays there.
    const worker = terms();
    const december = balance(
      "sick",
      facts({ year: 2025, month: 12 }),
      worker,
      { vacationDays: 0, sickDays: 89 },
    );
    expect(december.accrued).toBe(1);
    expect(december.closing).toBe(90);

    const january = balance("sick", facts({ year: 2026, month: 1 }), worker, {
      vacationDays: 0,
      sickDays: december.closing ?? 0,
    });
    expect(january.opening).toBe(90);
    expect(january.accrued).toBe(0);
    expect(january.closing).toBe(90);
  });

  it("caps what the balance may reach, not what the month may accrue after use", () => {
    // The ceiling is on the balance (items 7, 8), so a month that opens full
    // accrues nothing and still spends: 90 less the four days of the 4th to the
    // 7th of August 2025 is 86, and the following month accrues its 1.5 again.
    const worker = terms();
    const august = balance(
      "sick",
      facts(AUGUST_2025, [span("sick", "2025-08-04", "2025-08-07")]),
      worker,
      { vacationDays: 0, sickDays: 90 },
    );
    expect(august.accrued).toBe(0);
    expect(august.used).toBe(4);
    expect(august.closing).toBe(86);
    expect(monthlySickAccrual(august.closing ?? 0)).toBe(1.5);
  });

  it("counts twelve months of accrual as eighteen days", () => {
    // 1.5 a month over twelve months (item 8). Carried forward month by month
    // rather than multiplied, so this is the carry-forward and the accrual
    // together.
    const worker = terms();
    let sickDays = 0;
    for (let month = 1; month <= 12; month += 1) {
      sickDays =
        balance("sick", facts({ year: 2025, month }), worker, {
          vacationDays: 0,
          sickDays,
        }).closing ?? 0;
    }
    expect(sickDays).toBe(18);
  });
});

describe("the sick balance is a floor and never goes negative (item 8)", () => {
  // Two days standing and 1.5 accrued in the month is three and a half
  // available — the plan's own case, and the figure the refusal is against.
  const worker = terms("2024-04-01", { vacationDays: 0, sickDays: 2 });
  const fiveDays = facts(AUGUST_2025, [span("sick", "2025-08-04", "2025-08-08")]);

  it("has three and a half days available against a two-day balance", () => {
    expect(sickDaysAvailable(worker)).toBe(3.5);
  });

  it("refuses a five-day spell with a reason, naming the days it is about", () => {
    const [refusal, ...rest] = validateMonth(fiveDays, worker);
    expect(rest).toHaveLength(0);
    expect(refusal.code).toBe("sickBalanceExhausted");
    expect(refusal.message.length).toBeGreaterThan(0);
    expect(refusal.dates).toEqual(["2025-08-04"]);
  });

  it("returns no month at all rather than a negative balance", () => {
    // The fence is a refusal and not an arithmetic case (item 8). A balance
    // coming back as -1.5, or five days quietly funded, is this having been
    // built the wrong way round.
    let result: unknown = "the engine returned a month";
    try {
      result = calculateMonth(fiveDays, worker);
    } catch (error) {
      result = error;
    }
    expect(result).toBeInstanceOf(InvalidMonthError);
    expect(() => calculateMonth(fiveDays, worker)).toThrow(InvalidMonthError);
  });

  it("allows a spell that exactly exhausts the balance, and closes it at zero", () => {
    // Two and a half standing plus the month's 1.5 is four available, and the
    // 4th to the 7th of August is four sick days. The balance may reach zero;
    // it may not pass it.
    const exact = terms("2024-04-01", { vacationDays: 0, sickDays: 2.5 });
    const fourDays = facts(AUGUST_2025, [span("sick", "2025-08-04", "2025-08-07")]);
    expect(sickDaysAvailable(exact)).toBe(4);
    expect(validateMonth(fourDays, exact)).toEqual([]);
    expect(balance("sick", fourDays, exact).closing).toBe(0);
  });

  it("counts only the days of the spell that fall in this month", () => {
    // The refusal is against the month's own draw, the same figure the balance
    // line prints. The July part of a spell crossing the boundary is July's
    // problem: three days reach August, and three is inside the three and a
    // half available.
    const crossing = facts(AUGUST_2025, [span("sick", "2025-07-28", "2025-08-03")]);
    expect(validateMonth(crossing, worker)).toEqual([]);
    expect(balance("sick", crossing, worker).closing).toBe(0.5);
  });
});

describe("the seven-day vacation warning (specs.md item 7)", () => {
  const december = { year: 2025, month: 12 };
  const worker = terms();

  it("is raised in the December that closes a year with fewer than seven days taken", () => {
    // Item 7: the law asks for at least seven vacation days a year. Three were
    // taken — the 1st to the 3rd of December, a Monday to a Wednesday.
    const warning = vacationYearWarning(
      facts(december, [span("vacation", "2025-12-01", "2025-12-03")]),
    );
    expect(warning?.key).toBe("vacationUnderSeven");
    expect(warning?.message.length).toBeGreaterThan(0);
    expect(warning?.link).toBe("annualLeave");
  });

  it("is not raised when seven were taken", () => {
    // The 1st to the 8th of December is eight calendar days, and the 6th is a
    // Saturday, which a vacation span skips (item 5) — so seven days are drawn,
    // which is exactly what the law asks for.
    const sevenTaken = facts(december, [span("vacation", "2025-12-01", "2025-12-08")]);
    expect(balance("vacation", sevenTaken, worker).used).toBe(7);
    expect(vacationYearWarning(sevenTaken)).toBeNull();
  });

  it("counts the days taken earlier in the same calendar year", () => {
    // One month cannot see the rest of its own year, so the earlier days are
    // handed in — five earlier plus two here is seven.
    const twoTaken = facts(december, [span("vacation", "2025-12-01", "2025-12-02")]);
    const context = (vacationDaysEarlierInYear: number): MonthContext => ({
      vacationDaysEarlierInYear,
    });
    expect(vacationYearWarning(twoTaken, context(5))).toBeNull();
    expect(vacationYearWarning(twoTaken, context(4))).not.toBeNull();
  });

  it("is not raised before the year has passed", () => {
    // Item 7 warns when a year *passed*, so a November with nothing taken is a
    // year still running and is left alone.
    expect(vacationYearWarning(facts({ year: 2025, month: 11 }))).toBeNull();
    expect(vacationYearWarning(facts({ year: 2025, month: 3 }))).toBeNull();
  });

  it("reaches the month's result without stopping anything", () => {
    // A warning is not a refusal: it changes no figure and blocks no export.
    const result = calculateMonth(facts(december), worker);
    expect(result.warnings.map((warning) => warning.key)).toEqual([
      "vacationUnderSeven",
    ]);
    expect(result.gross).toBeGreaterThan(0);
  });

  it("leaves an ordinary month with no warnings at all", () => {
    // The point of the list being usually empty: a warning that appears every
    // month is one nobody reads.
    expect(calculateMonth(facts(AUGUST_2025), worker).warnings).toEqual([]);
  });
});
