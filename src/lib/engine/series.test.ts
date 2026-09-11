import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth } from "@/lib/engine/month";
import {
  createInMemoryRepository,
  type MonthRecord,
  type WorkerProfile,
} from "@/lib/engine/repository";
import {
  calculateSeries,
  DuplicateMonthError,
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
  name: "האנה",
  firstName: "האנה",
  employedSince: "2026-01-01",
  gender: "female",
  baseMonthlySalaryAgorot: 624765,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  incomeTax: DEFAULT_INCOME_TAX,
  standingLines: [],
  country: "PH",
  openingPosition: { vacationDays: 5, sickDays: 10, advances: [] },
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
    terms: snapshotTerms(HANNA),
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

  it("walks the months it holds and invents none", () => {
    // A gap is a month that was never recorded, and a month that never happened
    // accrued nothing. March therefore opens with January's closing figure and
    // not with two months' accrual (Part 3).
    const gapped = calculateSeries(
      [facts(month(2026, 1)), facts(month(2026, 3))],
      HANNA,
    );
    expect(balance(gapped[1], "vacation").opening).toBeCloseTo(
      5 + VACATION_A_MONTH,
      10,
    );
    expect(balance(gapped[1], "sick").opening).toBe(10 + SICK_A_MONTH);
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
      { ...HANNA, openingPosition: { vacationDays: 20, sickDays: 10, advances: [] } },
    );
    return series[1].result.warnings.map((warning) => warning.key);
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
      { ...HANNA, openingPosition: { vacationDays: 20, sickDays: 10, advances: [] } },
    );
    expect(series[1].result.warnings).toEqual([]);
    expect(series[2].result.warnings.map((w) => w.key)).toEqual([
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
    expect(series.map((each) => each.facts.month)).toEqual([
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
    const withoutToday = calculateSeries(months, HANNA);
    for (const today of ["2026-03-15", "2030-01-01", "2026-02-14"]) {
      expect(figures(calculateSeries(months, HANNA, today))).toEqual(
        figures(withoutToday),
      );
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
    expect(
      balance(calculateSeries(months, HANNA, "2026-02-28")[0], "sick").used,
    ).toBe(3);
    expect(
      balance(calculateSeries(months, HANNA, "2026-03-02")[0], "sick").used,
    ).toBe(3);
    // Asked on the 27th it has counted two, which is the same rule and the
    // reason the clock is the caller's to pass.
    expect(
      balance(calculateSeries(months, HANNA, "2026-02-27")[0], "sick").used,
    ).toBe(2);
  });
});
