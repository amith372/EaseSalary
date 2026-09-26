import { AS_SHIPPED } from "@/lib/engine/types";
import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { lineKeys } from "@/lib/engine/lines";
import { calculateMonth } from "@/lib/engine/month";
import {
  createInMemoryRepository,
  type MonthRecord,
  type WorkerProfile,
} from "@/lib/engine/repository";
import {
  calculateSeries,
  DuplicateMonthError,
  MonthBeforeFirstMonthError,
  type MonthInSeries,
} from "@/lib/engine/series";
import { snapshotTerms} from "@/lib/engine/types";
import type { MonthFacts, MonthSpan } from "@/lib/engine/types";
import { InvalidMonthError } from "@/lib/engine/validate";
import type { BalanceKind, MonthResult, YearMonth } from "@/lib/types";

/**
 * The replay: a worker's months walked from the opening position, which is the
 * only place a balance comes from (`specs.md` Part 3).
 *
 * **Where every expected figure here comes from.** No workbook covers a chain of
 * months — August 2025 is one month of one family's sheet — so each figure is
 * derived from a rule in `specs.md` and the arithmetic is written out beside the
 * assertion rather than reduced to a decimal that could have come from anywhere:
 * item 7's fourteen days a year through seniority year four, item 8's day and a
 * half a month, item 10's nine holidays a year. Not one is read back from what
 * the engine returned, which is the condition `CLAUDE.md` names for exactly this
 * situation.
 *
 * Vacation figures are asserted to ten decimal places and never exactly. A
 * twelfth has no exact form in binary floating point, and `balances.ts` carries
 * the fraction on purpose rather than snapping it each month — snapping would
 * bias the carry-forward and rebuild the drift the fraction exists to avoid.
 * Sick figures are asserted exactly, because a day and a half is exact.
 */

// Employed from the first day of 2026, so 2026 is seniority year one and the
// vacation accrual is fourteen twelfths a month all year (item 7).
const HANNA: WorkerProfile = {
  id: "hanna",
  insurer: "",
  name: "האנה",
  firstName: "האנה",
  employedSince: "2026-01-01",
  firstMonth: { year: 2026, month: 1 },
  gender: "female",
  baseMonthlySalaryAgorot: 624765,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  incomeTax: DEFAULT_INCOME_TAX,
  standingLines: [],
  country: "PH",
  openingPosition: { vacationDays: 5, sickDays: 10, vacationUsedThisYear: 0, holidayUsedThisYear: 0, recuperationPaidIn: null, advances: [] },
  // Three empty dates: these fixtures check the store and the replay, and item
  // 28's documents reach neither.
  documents: {
    employmentPermitExpiry: null,
    workVisaExpiry: null,
    passportExpiry: null,
  },
};

const VACATION_A_MONTH = 14 / 12;
const SICK_A_MONTH = 1.5;

function month(year: number, monthNumber: number): YearMonth {
  return { year, month: monthNumber };
}


/**
 * The confirmed wage position a month of these fixtures stands on: the minimum
 * wage in force during that month, from the same seeded table the application
 * reads (specs.md item 4). A fixture that stamped one figure on every month was
 * below the minimum from April 2026 onward.
 */
function wageInForce(ym: YearMonth) {
  // A month earlier than every row takes the earliest one. That is a fixture's
  // convenience and not the engine's rule — the engine guesses nothing there
  // (item 4), and `belowMinimumWageWarning` is silent for exactly that reason,
  // so which figure such a month carries cannot change what is asserted.
  const rate =
    rateInForce(SEEDED_RATES, "minimumWage", ym) ??
    SEEDED_RATES.filter((one) => one.key === "minimumWage").sort((a, b) =>
      a.effectiveFrom < b.effectiveFrom ? -1 : 1,
    )[0]!;
  return {
    baseAgorot: rate.value,
    minimumAgorot: rate.value,
    effectiveFrom: rate.effectiveFrom,
  };
}

/** The month as the store holds it — no spans, because spans belong to the
 * worker and the store assembles them onto the months they touch. */
function record(ym: YearMonth): MonthRecord {
  return {
    month: ym,
    // The wage in force during the month itself, and not one figure stamped on
    // every month a fixture happens to cover (specs.md item 4). Stamping one
    // put these fixtures below the minimum wage from April 2026 onward, which
    // is the defect a family found on 2026-09-11.
    confirmedWage: wageInForce(ym),
    terms: snapshotTerms(HANNA, ym),
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

/** The same month as the engine reads it, with the spans already assembled —
 * which is what the store hands back and what most of these tests build by
 * hand, since only one of them needs the store to do the assembling. */
function facts(ym: YearMonth, spans: MonthSpan[] = []): MonthFacts {
  return { ...record(ym), spans };
}

function balance(entry: MonthInSeries, kind: BalanceKind) {
  const line = entry.result.balances.find((each) => each.kind === kind)!;
  return { opening: line.opening!, closing: line.closing!, used: line.used! };
}

describe("the balances carry from month to month", () => {
  const series = calculateSeries(
    [facts(month(2026, 1)), facts(month(2026, 2)), facts(month(2026, 3))],
    HANNA,
  );

  it("opens the first month from the opening position", () => {
    // Item 6: a worker created mid-employment starts from a position given once.
    expect(balance(series[0], "vacation").opening).toBe(5);
    expect(balance(series[0], "sick").opening).toBe(10);
  });

  it("opens each later month with the one before it", () => {
    // Item 7 in one sentence: month N+1 opens with the previous balance plus the
    // accrual minus what was used. Nothing is used here, so each opening is the
    // one before it plus one month's accrual.
    expect(balance(series[1], "vacation").opening).toBeCloseTo(
      5 + VACATION_A_MONTH,
      10,
    );
    expect(balance(series[2], "vacation").opening).toBeCloseTo(
      5 + 2 * VACATION_A_MONTH,
      10,
    );
    expect(balance(series[1], "sick").opening).toBe(10 + SICK_A_MONTH);
    expect(balance(series[2], "sick").opening).toBe(10 + 2 * SICK_A_MONTH);
  });

  it("closes three months at five days plus three and a half", () => {
    // Three months of fourteen twelfths is three and a half days exactly, so
    // this one figure can be written as a decimal and checked by eye: 8.5.
    expect(balance(series[2], "vacation").closing).toBeCloseTo(8.5, 10);
    expect(balance(series[2], "sick").closing).toBe(14.5);
  });

  it("chains a month that stands alone to nothing", () => {
    // A single month is the worker's and the year's first, so the walk over one
    // month has to agree with the month calculated by itself (Part 3). If it
    // did not, the preview of a first month would differ from the same month
    // once a second existed.
    const alone = facts(month(2026, 1));
    expect(calculateSeries([alone], HANNA)[0].result).toEqual(
      calculateMonth(alone, HANNA),
    );
  });

  it("walks the months nobody opened as ordinary months", () => {
    // A gap is a month nobody opened, and a month nobody opened is an ordinary
    // month that accrues like any other (Part 3). March therefore opens with two
    // months' accrual on top of the opening position.
    const gapped = calculateSeries(
      [facts(month(2026, 1)), facts(month(2026, 3))],
      HANNA,
    );
    expect(gapped.map((each) => each.facts.month)).toEqual([
      month(2026, 1),
      month(2026, 2),
      month(2026, 3),
    ]);
    expect(balance(gapped[2], "vacation").opening).toBeCloseTo(
      5 + 2 * VACATION_A_MONTH,
      10,
    );
    expect(balance(gapped[2], "sick").opening).toBe(10 + 2 * SICK_A_MONTH);
  });
});

describe("a correction to a past month moves every later month (criterion 13)", () => {
  // 14.1.2026 is a Wednesday, so it is neither the rest day nor the rest-eve,
  // and a vacation day draws exactly one day from the balance (item 7).
  const vacation: MonthSpan = {
    id: "v",
    kind: "vacation",
    from: "2026-01-14",
    to: "2026-01-14",
  };

  const before = calculateSeries(
    [facts(month(2026, 1)), facts(month(2026, 2)), facts(month(2026, 3))],
    HANNA,
  );
  const after = calculateSeries(
    [
      facts(month(2026, 1), [vacation]),
      facts(month(2026, 2)),
      facts(month(2026, 3)),
    ],
    HANNA,
  );

  it("draws the day from the month it fell in", () => {
    expect(balance(after[0], "vacation").used).toBe(1);
    expect(balance(before[0], "vacation").used).toBe(0);
  });

  it("moves March by exactly that one day, two months later", () => {
    // 8.5 becomes 7.5. Nothing was invalidated and nothing was told: March's
    // balance was never anything but this walk.
    expect(balance(before[2], "vacation").closing).toBeCloseTo(8.5, 10);
    expect(balance(after[2], "vacation").closing).toBeCloseTo(7.5, 10);
  });

  it("leaves the sick balance and the months' money where they were", () => {
    // A vacation day never changes the month's total (item 7): the base is
    // computed from the standard count, which vacation does not touch.
    expect(before.map((each) => each.result.gross)).toEqual(
      after.map((each) => each.result.gross),
    );
    expect(balance(after[2], "sick").closing).toBe(14.5);
  });
});

describe("the calendar year's own totals carry, and reset at January", () => {
  // Item 7 asks for at least seven vacation days in a year, and says so in the
  // December that closes it. One month cannot see the rest of its own year.
  const generous: MonthSpan = {
    // 5.1.2026 is a Monday and 12.1.2026 the Monday after it: eight days
    // holding one rest day, Saturday the 10th, which vacation does not count.
    // Seven days drawn, exactly the number the law asks for.
    id: "week",
    kind: "vacation",
    from: "2026-01-05",
    to: "2026-01-12",
  };
  const thin: MonthSpan = {
    id: "one",
    kind: "vacation",
    from: "2026-01-14",
    to: "2026-01-14",
  };

  function december(januarySpans: MonthSpan[]) {
    const series = calculateSeries(
      [facts(month(2026, 1), januarySpans), facts(month(2026, 12))],
      { ...HANNA, openingPosition: { vacationDays: 20, sickDays: 10, vacationUsedThisYear: 0, holidayUsedThisYear: 0, recuperationPaidIn: null, advances: [] } },
    );
    return series.at(-1)!.result.warnings.map((warning) => warning.key);
  }

  it("counts the seven days January drew when December asks", () => {
    expect(balance(
      calculateSeries([facts(month(2026, 1), [generous])], HANNA)[0],
      "vacation",
    ).used).toBe(7);
    expect(december([generous])).toEqual([]);
  });

  it("warns in December when the year drew fewer than seven", () => {
    expect(december([thin])).toEqual(["vacationUnderSeven"]);
  });

  it("starts the count again in January", () => {
    // The seven days of 2026 say nothing about 2027, so the December that
    // closes 2027 warns even though the December before it did not.
    const series = calculateSeries(
      [
        facts(month(2026, 1), [generous]),
        facts(month(2026, 12)),
        facts(month(2027, 12)),
      ],
      { ...HANNA, openingPosition: { vacationDays: 20, sickDays: 10, vacationUsedThisYear: 0, holidayUsedThisYear: 0, recuperationPaidIn: null, advances: [] } },
    );
    // December 2026 is the twelfth month of the walk, December 2027 the last.
    expect(series[11].result.warnings).toEqual([]);
    expect(series.at(-1)!.result.warnings.map((w) => w.key)).toEqual([
      "vacationUnderSeven",
    ]);
  });
});

describe("the holiday entitlement is a year's and not a month's", () => {
  // Nine days for a full year (item 10), and 2026 is a full year for a worker
  // employed from its first day.
  function holidays(id: string, from: string, to: string): MonthSpan {
    return { id, kind: "holiday", from, to, worked: false };
  }

  // Three runs of three weekdays: 5-7, 12-14 and 19-21 January 2026, all
  // Monday to Wednesday. Nine days, which is the whole year's entitlement.
  const nineInJanuary = [
    holidays("h1", "2026-01-05", "2026-01-07"),
    holidays("h2", "2026-01-12", "2026-01-14"),
    holidays("h3", "2026-01-19", "2026-01-21"),
  ];

  it("allows exactly the nine", () => {
    const series = calculateSeries(
      [facts(month(2026, 1), nineInJanuary)],
      HANNA,
    );
    expect(series[0].result.month).toEqual(month(2026, 1));
  });

  it("refuses a tenth day in a later month of the same year", () => {
    // February sees only its own one day. The walk is what tells it about the
    // nine that came before, and without that the tenth holiday is paid.
    let refused: InvalidMonthError | null = null;
    try {
      calculateSeries(
        [
          facts(month(2026, 1), nineInJanuary),
          facts(month(2026, 2), [holidays("h4", "2026-02-02", "2026-02-02")]),
        ],
        HANNA,
      );
    } catch (error) {
      refused = error as InvalidMonthError;
    }

    expect(refused).toBeInstanceOf(InvalidMonthError);
    expect(refused!.refusals.map((each) => each.code)).toEqual(["holidayLimit"]);
    // The month is on the error, which is what lets a screen say *where* rather
    // than only what.
    expect(refused!.month).toEqual(month(2026, 2));
  });

  it("allows the same days again in the next year", () => {
    expect(() =>
      calculateSeries(
        [
          facts(month(2026, 1), nineInJanuary),
          facts(month(2027, 1), [holidays("h5", "2027-01-04", "2027-01-06")]),
        ],
        HANNA,
      ),
    ).not.toThrow();
  });
});

describe("a spell crossing a month boundary, stored once and replayed", () => {
  // The two halves of step 8 meeting: the store hands the same spell to both
  // months whole, and the walk draws from each the days that fell in it.
  const spell: MonthSpan = {
    id: "spell",
    kind: "sick",
    from: "2026-01-29",
    to: "2026-02-03",
  };

  async function replayed(
    span: MonthSpan,
    months: YearMonth[] = [month(2026, 1), month(2026, 2)],
  ) {
    const repository = createInMemoryRepository({ workers: [HANNA] });
    await repository.saveSpan("hanna", span);
    for (const each of months) await repository.saveMonth("hanna", record(each));
    return calculateSeries(await repository.listMonths("hanna"), HANNA);
  }

  it("draws three days from January and three from February", () => {
    // Sickness counts every day it ran across, rest days included (item 8):
    // 29, 30 and 31 January, then 1, 2 and 3 February. Six days for a six-day
    // spell, and no day drawn twice.
    return replayed(spell).then((series) => {
      expect(balance(series[0], "sick").used).toBe(3);
      expect(balance(series[1], "sick").used).toBe(3);
    });
  });

  it("carries the balance through both", () => {
    // January: 10 + 1.5 - 3 = 8.5. February: 8.5 + 1.5 - 3 = 7.
    return replayed(spell).then((series) => {
      expect(balance(series[0], "sick").closing).toBe(8.5);
      expect(balance(series[1], "sick").opening).toBe(8.5);
      expect(balance(series[1], "sick").closing).toBe(7);
    });
  });

  it("costs January the same whether the spell is closed or still open", () => {
    // An open spell is clipped at the month's own last day, so January cannot
    // tell the two apart: the same three days, the same money (item 8). Only
    // February can, because only February is where the two differ.
    // January alone, because February is where the two differ and an open
    // spell that reaches it exhausts the balance — which the test below is
    // about and this one is not.
    const only = [month(2026, 1)];
    return Promise.all([
      replayed(spell, only),
      replayed({ ...spell, to: null, id: "spell" }, only),
    ]).then(([closed, open]) => {
      expect(balance(open[0], "sick").used).toBe(
        balance(closed[0], "sick").used,
      );
      expect(open[0].result.gross).toBe(closed[0].result.gross);
    });
  });

  it("refuses February rather than drawing a spell nobody closed past the floor", () => {
    // Left open, the spell runs to the end of every month it reaches: all
    // twenty-eight days of February, against a balance of ten. The sick balance
    // is a floor and never goes below zero (item 8), so the month is refused
    // with a reason and named — which is what an unclosed spell costs, and why
    // it is worth saying out loud rather than deducting in silence.
    //
    // This is the consequence of the open shape and not a fault in it: what
    // ends a spell is the worker coming back, and until that is recorded the
    // application has no honest figure to show.
    return replayed({ ...spell, to: null, id: "spell" }).then(
      () => {
        throw new Error("February should have been refused");
      },
      (error: InvalidMonthError) => {
        expect(error).toBeInstanceOf(InvalidMonthError);
        expect(error.refusals.map((each) => each.code)).toEqual([
          "sickBalanceExhausted",
        ]);
        expect(error.month).toEqual(month(2026, 2));
      },
    );
  });
});

/**
 * **A spell is one spell however many ranges it was entered as** (`specs.md`
 * item 8: the tiers are counted from the spell's own first day through to its
 * last, across a month boundary). The family that marks the August days in
 * August and the September days in September has recorded one illness, and it
 * must cost what the same illness swept in one gesture costs.
 *
 * **Where every expected figure comes from.** Item 8's tiers, at the seeded
 * minimum wage in force from April 2026 — there is no workbook month with a
 * spell split across a boundary in it, which is the condition `CLAUDE.md` names
 * for deriving on paper first.
 *
 *   S = ₪6,443.85 = 644,385 agorot      `datedRates.ts`, from 1.4.2026
 *   a sick day = S / 25 = 25,775.4      item 8
 *
 * 28.8.2026 is a Friday and 29.8 the Saturday after it, so the spell runs:
 *
 *   Fri 28 Aug  day 1  nothing paid      -> a whole day taken back
 *   Sat 29 Aug  day 2  her rest day      -> nothing taken back, position advances
 *   Sun 30 Aug  day 3  half paid         -> half a day taken back
 *   Mon 31 Aug  day 4  paid in full      -> nothing taken back
 *   Tue 1 – Thu 3 Sep  days 5 to 7       -> nothing taken back
 *
 *   August    1 + 0 + 0.5 = 1.5 days -> 1.5 × 25,775.4 = 38,663.1 -> 38,663
 *   September 0 days                 -> no deduction line at all
 *
 * **What it catches.** Handing September only the spans that overlap it: its
 * three days are then read as a spell of their own and priced 1 + 0.5 + 0.5 =
 * 2 days -> 2 × 25,775.4 = 51,550.8 -> ₪515.51 taken off a month that owes
 * nothing, for no reason but where the family put the second mark.
 */
/**
 * **The household's own tables reach every month of the walk.**
 *
 * `specs.md` item 4: no rate is hardcoded, the minimum wage is the household's
 * confirmed or fetched figure, and a month is measured against the one in force
 * during *it*. A walk that valued its months against the table the application
 * shipped with would show a household that had already corrected a figure the
 * figure it corrected — and nothing on the screen would look wrong.
 *
 * **Where the expected answer comes from.** Item 4 alone: ₪6,247.65 is less than
 * ₪7,000, so a February 2026 month standing at the first, in a household whose
 * table says the second from January, is below the minimum wage and says so.
 * No figure here is read back from the engine.
 *
 * **What it catches.** The walk building each month's context without the
 * tables it was handed, which is how the household's rates stopped reaching
 * the minimum-wage warning, an unconfirmed month's recuperation rate, the
 * national-insurance estimate and the credit point at once.
 */
describe("the household's own rates reach every month of the walk", () => {
  const CONFIRMED_SEVEN_THOUSAND: DatedRate[] = [
    {
      key: "minimumWage",
      value: 700000,
      effectiveFrom: "2026-01-01",
      source: "userConfirmed",
    },
  ];

  /** February standing at the seeded figure, which this household has moved on
   * from. Its own `confirmedWage` is what the month was opened at; the table is
   * what it is measured against, and the two are allowed to differ — that gap
   * is exactly what the warning is for. */
  const february: MonthFacts = {
    ...facts(month(2026, 2)),
    confirmedWage: {
      baseAgorot: 624765,
      minimumAgorot: 624765,
      effectiveFrom: "2025-04-01",
    },
  };

  function warningsOfFebruary(rates: DatedRate[]) {
    const series = calculateSeries(
      [facts(month(2026, 1)), february],
      HANNA,
      undefined,
      rates,
    );
    return series
      .find((entry) => entry.facts.month.month === 2)!
      .result.warnings.map((warning) => warning.key);
  }

  it("warns that February is below the wage the household confirmed", () => {
    expect(warningsOfFebruary(CONFIRMED_SEVEN_THOUSAND)).toContain(
      "belowMinimumWage",
    );
  });

  it("says the same thing the month calculated alone against that table says", () => {
    // One engine, one answer, however it is reached (Part 3). Before the tables
    // were passed down, these two disagreed over the same household.
    const alone = calculateMonth(february, HANNA, {
      ...AS_SHIPPED,
      rates: CONFIRMED_SEVEN_THOUSAND,
    });
    expect(warningsOfFebruary(CONFIRMED_SEVEN_THOUSAND)).toEqual(
      alone.warnings.map((warning) => warning.key),
    );
  });

  it("is silent where the household's table is the one the month stands at", () => {
    // Not a warning that fires on every February: against the seeded table the
    // same month is exactly at the minimum and says nothing.
    expect(warningsOfFebruary(SEEDED_RATES)).not.toContain("belowMinimumWage");
  });
});

describe("a spell entered as two spans is one spell across the boundary", () => {
  const AUGUST = month(2026, 8);
  const SEPTEMBER = month(2026, 9);

  const sick = (id: string, from: string, to: string): MonthSpan => ({
    id,
    kind: "sick",
    from,
    to,
  });

  /** The store hands a span to every month it touches, so the swept spell
   * reaches both months and each half of the split one reaches its own. */
  const split = [
    facts(AUGUST, [sick("aug", "2026-08-28", "2026-08-31")]),
    facts(SEPTEMBER, [sick("sep", "2026-09-01", "2026-09-03")]),
  ];
  const swept = [
    facts(AUGUST, [sick("both", "2026-08-28", "2026-09-03")]),
    facts(SEPTEMBER, [sick("both", "2026-08-28", "2026-09-03")]),
  ];

  function deductions(months: MonthFacts[]) {
    return calculateSeries(months, HANNA)
      .slice(-2)
      .map(
        (entry) =>
          entry.result.lines.find((line) => line.key === lineKeys.sickDeduction)
            ?.amount ?? null,
      );
  }

  it("prices the September days as days five to seven and takes nothing back", () => {
    expect(deductions(split)).toEqual([-38663, null]);
  });

  it("costs exactly what the same seven days swept in one gesture cost", () => {
    // The property the rule exists for: what she was paid stops depending on
    // how the days happened to be entered.
    expect(deductions(split)).toEqual(deductions(swept));
  });

  it("draws the same days from the balance either way", () => {
    // Four days in August and three in September, and no day drawn twice —
    // the balance was already right before the fix, which is what makes the
    // deduction above the whole of the error.
    const [august, september] = calculateSeries(split, HANNA).slice(-2);
    expect(balance(august, "sick").used).toBe(4);
    expect(balance(september, "sick").used).toBe(3);
  });

  it("still restarts the tiers over a working day nobody reported", () => {
    // Friday 4 September is a day she owed attendance on, so it ends the spell
    // and Monday the 7th begins a new one: day 1, a whole day taken back.
    // 1 × 25,775.4 = 25,775.4 -> 25,775. Without this the fix would be reading
    // any two spans as one, which is the mistake in the other direction.
    const separate = [
      facts(AUGUST, [sick("aug", "2026-08-28", "2026-08-31")]),
      facts(SEPTEMBER, [sick("sep", "2026-09-07", "2026-09-07")]),
    ];
    expect(deductions(separate)).toEqual([-38663, -25775]);
  });
});

describe("the walk does not depend on the order or the count of what it is given", () => {
  it("sorts the months before replaying them", () => {
    // The store promises date order, but an unsorted array does not fail — it
    // produces balances that are merely wrong.
    const inOrder = [facts(month(2026, 1)), facts(month(2026, 2)), facts(month(2026, 3))];
    const shuffled = [inOrder[2], inOrder[0], inOrder[1]];
    expect(calculateSeries(shuffled, HANNA).map((each) => each.result)).toEqual(
      calculateSeries(inOrder, HANNA).map((each) => each.result),
    );
  });

  it("sorts across a year boundary", () => {
    const series = calculateSeries(
      [facts(month(2027, 1)), facts(month(2026, 12))],
      HANNA,
    );
    expect(series.slice(-2).map((each) => each.facts.month)).toEqual([
      month(2026, 12),
      month(2027, 1),
    ]);
  });

  it("refuses the same month twice", () => {
    // Two records of one month would accrue it twice and draw its vacation
    // twice, and the balance that came out would look entirely ordinary.
    expect(() =>
      calculateSeries([facts(month(2026, 1)), facts(month(2026, 1))], HANNA),
    ).toThrow(DuplicateMonthError);
  });

  it("does not reorder the array it was handed", () => {
    const given = [facts(month(2026, 3)), facts(month(2026, 1))];
    calculateSeries(given, HANNA);
    expect(given.map((each) => each.month)).toEqual([
      month(2026, 3),
      month(2026, 1),
    ]);
  });
});

describe("nothing in the walk reads a clock", () => {
  it("gives a finished month the same figures whatever today is", () => {
    // `today` reaches every month and is safe there, because a month clips at
    // the earlier of it and its own last day (item 8). A finished month is
    // therefore settled whenever it is looked at.
    const months = [facts(month(2026, 1)), facts(month(2026, 2))];
    // **Every figure, and not the warnings.** Criterion 21's warning is the one
    // thing in a result that *is* about the date it is read on — a month that
    // has not ended yet cannot be exported — and 14.2.2026 below is a day on
    // which February had not. It changes no amount, which is what this test is
    // about, so it is dropped here rather than the date being dropped: the
    // three todays are what would catch a clock reaching an amount.
    const figures = (entries: { result: MonthResult }[]) =>
      entries.map(({ result }) => {
        const { warnings, ...rest } = result;
        void warnings;
        return rest;
      });
    // Only January and February are compared: a later today walks further,
    // and the months it adds are not the ones this test is about.
    const withoutToday = calculateSeries(months, HANNA);
    for (const today of ["2026-03-15", "2030-01-01", "2026-02-14"]) {
      expect(
        figures(calculateSeries(months, HANNA, today).slice(0, 2)),
      ).toEqual(figures(withoutToday));
    }
  });

  it("clips only the month still running", () => {
    // She fell ill on the 26th of February and has not returned. Asked on the
    // 28th, February has counted three days; asked on the 2nd of March, the
    // month is over and has counted three all the same — 26, 27 and 28.
    const open: MonthSpan = {
      id: "spell",
      kind: "sick",
      from: "2026-02-26",
      to: null,
    };
    const months = [facts(month(2026, 2), [open])];
    // February first, so the walk's first entry is the month asked about.
    const FROM_FEBRUARY = { ...HANNA, firstMonth: month(2026, 2) };
    expect(
      balance(calculateSeries(months, FROM_FEBRUARY, "2026-02-28")[0], "sick").used,
    ).toBe(3);
    expect(
      balance(calculateSeries(months, FROM_FEBRUARY, "2026-03-02")[0], "sick").used,
    ).toBe(3);
    // Asked on the 27th it has counted two, which is the same rule and the
    // reason the clock is the caller's to pass.
    expect(
      balance(calculateSeries(months, FROM_FEBRUARY, "2026-02-27")[0], "sick").used,
    ).toBe(2);
  });
});

describe("the walk runs from the first month (specs.md item 6, Part 3)", () => {
  it("gives a month nobody opened the profile's terms and the wage in force", () => {
    // February 2026 falls before the April 2026 rise, so its minimum wage is
    // the April 2025 row: ₪6,247.65 (`datedRates.ts`, read from the 2025
    // workbook's April tab). No marks, no advances, no lines of her own.
    const [, february] = calculateSeries(
      [facts(month(2026, 1)), facts(month(2026, 3))],
      HANNA,
    );
    expect(february.facts.terms).toEqual(snapshotTerms(HANNA, month(2026, 2)));
    expect(february.facts.confirmedWage.minimumAgorot).toBe(624765);
    expect(february.facts.spans).toEqual([]);
    expect(february.facts.advances).toEqual([]);
    expect(february.facts.userLines).toEqual([]);
  });

  it("walks to today's month and values it at its own wage", () => {
    // April 2026 is the month the minimum wage rose to ₪6,443.85 (the 2026
    // workbook's April tab), so the month the walk makes up carries that
    // figure and not January's.
    const series = calculateSeries([facts(month(2026, 1))], HANNA, "2026-04-10");
    expect(series.map((each) => each.facts.month)).toEqual([
      month(2026, 1),
      month(2026, 2),
      month(2026, 3),
      month(2026, 4),
    ]);
    expect(series[3].facts.confirmedWage.minimumAgorot).toBe(644385);
  });

  it("does not value a month after the current one", () => {
    // Part 3: "A month after the current one is not valued", even when marks
    // were already recorded in it (item 21).
    const series = calculateSeries(
      [facts(month(2026, 1)), facts(month(2026, 6))],
      HANNA,
      "2026-03-05",
    );
    expect(series.map((each) => each.facts.month)).toEqual([
      month(2026, 1),
      month(2026, 2),
      month(2026, 3),
    ]);
  });

  it("walks nothing when the first month has not come yet", () => {
    expect(
      calculateSeries([], { ...HANNA, firstMonth: month(2026, 5) }, "2026-04-10"),
    ).toEqual([]);
  });

  it("refuses a month before the first month", () => {
    // No month before the first can be opened (item 6); one handed in anyway
    // has no opening position to start from.
    expect(() =>
      calculateSeries([facts(month(2026, 1))], {
        ...HANNA,
        firstMonth: month(2026, 2),
      }),
    ).toThrow(MonthBeforeFirstMonthError);
  });

  it("carries a sick spell nobody closed into the month nobody opened", () => {
    // She fell ill on 29 January and has not returned; asked on 2 February.
    // January draws 29, 30, 31 — three days, 10 + 1.5 - 3 = 8.5. February draws
    // the 1st and the 2nd, every day counted (item 8): 8.5 + 1.5 - 2 = 8.
    const open: MonthSpan = {
      id: "spell",
      kind: "sick",
      from: "2026-01-29",
      to: null,
    };
    const series = calculateSeries(
      [facts(month(2026, 1), [open])],
      HANNA,
      "2026-02-02",
    );
    expect(balance(series[0], "sick").closing).toBe(8.5);
    expect(balance(series[1], "sick").used).toBe(2);
    expect(balance(series[1], "sick").closing).toBe(8);
  });

  it("stops the sick balance at ninety across a month nobody opened", () => {
    // Opening at 88: January 88 + 1.5 = 89.5, February accrues only the half a
    // day left to ninety, and March, opening at ninety, accrues nothing
    // (item 8).
    const series = calculateSeries(
      [facts(month(2026, 1)), facts(month(2026, 3))],
      { ...HANNA, openingPosition: { ...HANNA.openingPosition, sickDays: 88 } },
    );
    expect(balance(series[1], "sick").closing).toBe(90);
    expect(balance(series[2], "sick").opening).toBe(90);
    expect(balance(series[2], "sick").closing).toBe(90);
  });
});

describe("the opening position's year counts (specs.md item 6)", () => {
  // 14 and 15 December 2026 are a Monday and a Tuesday: two vacation days.
  const twoDays: MonthSpan = {
    id: "dec",
    kind: "vacation",
    from: "2026-12-14",
    to: "2026-12-15",
  };

  function december(usedBefore: number) {
    const series = calculateSeries([facts(month(2026, 12), [twoDays])], {
      ...HANNA,
      firstMonth: month(2026, 12),
      openingPosition: {
        ...HANNA.openingPosition,
        vacationDays: 20,
        vacationUsedThisYear: usedBefore,
      },
    });
    return series[0].result.warnings.map((warning) => warning.key);
  }

  it("counts the vacation used before the first month toward the seven", () => {
    // 5 before + 2 in December = 7, which is what item 7 asks for; 4 + 2 is
    // one short.
    expect(december(5)).toEqual([]);
    expect(december(4)).toEqual(["vacationUnderSeven"]);
  });

  it("leaves that count in the first month's year", () => {
    // Seven used in 2026 say nothing about 2027 (item 7): December 2027, with
    // nothing drawn in it, warns.
    const series = calculateSeries([facts(month(2027, 12))], {
      ...HANNA,
      firstMonth: month(2026, 12),
      openingPosition: {
        ...HANNA.openingPosition,
        vacationDays: 20,
        vacationUsedThisYear: 7,
      },
    });
    expect(series[0].result.warnings).toEqual([]);
    expect(series.at(-1)!.result.warnings.map((w) => w.key)).toEqual([
      "vacationUnderSeven",
    ]);
  });

  it("counts the holidays used before the first month toward the nine", () => {
    // 2026 is a full year of employment, so nine holidays (item 10). With nine
    // already used, a holiday on Monday 2 February is the tenth and refused.
    const holiday: MonthSpan = {
      id: "h",
      kind: "holiday",
      from: "2026-02-02",
      to: "2026-02-02",
      worked: false,
    };
    const worker = (used: number): WorkerProfile => ({
      ...HANNA,
      firstMonth: month(2026, 2),
      openingPosition: { ...HANNA.openingPosition, holidayUsedThisYear: used },
    });
    expect(() =>
      calculateSeries([facts(month(2026, 2), [holiday])], worker(8)),
    ).not.toThrow();
    let refused: InvalidMonthError | null = null;
    try {
      calculateSeries([facts(month(2026, 2), [holiday])], worker(9));
    } catch (error) {
      refused = error as InvalidMonthError;
    }
    expect(refused).toBeInstanceOf(InvalidMonthError);
    expect(refused!.refusals.map((each) => each.code)).toEqual(["holidayLimit"]);
  });
});
