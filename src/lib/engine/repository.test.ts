import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth } from "@/lib/engine/month";
import {
  createInMemoryRepository,
  openMonthRecord,
  UnknownWorkerError,
  wageToCarry,
  type MonthRecord,
  type WorkerProfile,
} from "@/lib/engine/repository";
import { snapshotTerms} from "@/lib/engine/types";
import type { MonthSpan } from "@/lib/engine/types";
import { SEEDED_RATES } from "@/lib/datedRates";
import { SEEDED_HOLIDAY_LISTS } from "@/lib/holidayLists";
import type { YearMonth } from "@/lib/types";

/**
 * The store: facts in, facts out, and the spans assembled onto the months they
 * touch.
 *
 * **What this file is allowed to assert.** Nothing here checks an amount — the
 * store computes none, and a repository test that asserted a figure would be
 * asserting the engine twice. What it checks is the three properties a second
 * implementation over Postgres must also have: what went in comes back out
 * unchanged, a span reaches every month it overlaps, and what a caller does to
 * what it read does not reach the store. The third is the one that cannot fail
 * against a database and would therefore surface only after stage 3 replaced
 * this implementation.
 */

const JANUARY: YearMonth = { year: 2026, month: 1 };
const FEBRUARY: YearMonth = { year: 2026, month: 2 };
const MARCH: YearMonth = { year: 2026, month: 3 };

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
  standingLines: [
    { id: "transport", label: "נסיעות", direction: "addition", agorot: 5000 },
  ],
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

function record(month: YearMonth, extra: Partial<MonthRecord> = {}): MonthRecord {
  return {
    month,
    confirmedWage: {
      baseAgorot: 624765,
      minimumAgorot: 624765,
      effectiveFrom: "2025-04-01",
    },
    terms: snapshotTerms(HANNA),
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
    ...extra,
  };
}

function store() {
  return createInMemoryRepository({ workers: [HANNA] });
}

describe("a worker's facts written and read back", () => {
  it("returns the profile it was given", async () => {
    expect(await store().getWorker("hanna")).toEqual(HANNA);
  });

  it("returns a month with everything the month carries", async () => {
    // The three shapes steps 7a-7d added are the ones worth naming: the terms
    // snapshot with its standing lines, the month's own one-off lines, and an
    // override keyed by a line key. A round trip that quietly dropped any of
    // them would leave a month calculable and wrong.
    const repository = store();
    const january = record(JANUARY, {
      userLines: [
        {
          id: "shortfall",
          label: "השלמה מחודש קודם",
          direction: "addition",
          agorot: 12500,
          note: "יולי",
        },
      ],
      advances: [{ number: 1, kind: "granted", agorot: 100000 }],
      thirdPartyPayments: [{ kind: "agencyFee", agorot: 30000 }],
      incomeTaxAgorot: 4200,
      overrides: { restEveSupplement: { agorot: 40000, note: "סוכם" } },
    });
    await repository.saveMonth("hanna", january);

    expect(await repository.getMonth("hanna", JANUARY)).toEqual({
      ...january,
      spans: [],
    });
  });

  it("has no month before one is written, and no such month is an error", async () => {
    expect(await store().getMonth("hanna", JANUARY)).toBeNull();
  });

  it("refuses a worker it does not hold", async () => {
    const repository = store();
    await expect(repository.getMonth("nobody", JANUARY)).rejects.toThrow(
      UnknownWorkerError,
    );
    await expect(repository.listMonths("nobody")).rejects.toThrow(
      UnknownWorkerError,
    );
    // Absent worker, present question: `getWorker` answers rather than throws,
    // because "is there such a worker" is a thing a caller may legitimately ask.
    expect(await repository.getWorker("nobody")).toBeNull();
  });

  it("keeps a worker's months and spans when her profile is replaced", async () => {
    // Raising the salary must not empty her history. The profile is one row and
    // is replaced wholesale; the months hang off her id and are untouched.
    const repository = store();
    await repository.saveMonth("hanna", record(JANUARY));
    await repository.saveSpan("hanna", {
      id: "v1",
      kind: "vacation",
      from: "2026-01-14",
      to: "2026-01-14",
    });

    await repository.saveWorker({ ...HANNA, baseMonthlySalaryAgorot: 700000 });

    expect((await repository.getWorker("hanna"))?.baseMonthlySalaryAgorot).toBe(
      700000,
    );
    expect(await repository.listMonths("hanna")).toHaveLength(1);
    expect(await repository.listSpans("hanna")).toHaveLength(1);
  });
});

describe("months come back oldest first", () => {
  it("orders by date and not by when they were written", async () => {
    // A corrected month is written last and must not therefore replay last:
    // the whole of criterion 13 rests on the chain being in date order.
    const repository = store();
    await repository.saveMonth("hanna", record(MARCH));
    await repository.saveMonth("hanna", record(JANUARY));
    await repository.saveMonth("hanna", record(FEBRUARY));
    await repository.saveMonth("hanna", record(JANUARY, { incomeTaxAgorot: 100 }));

    expect((await repository.listMonths("hanna")).map((m) => m.month)).toEqual([
      JANUARY,
      FEBRUARY,
      MARCH,
    ]);
  });

  it("orders across a year boundary", async () => {
    // "2026-12" against "2027-01" as strings is the arrangement that gets this
    // wrong if the key is not zero-padded and year-first.
    const repository = store();
    await repository.saveMonth("hanna", record({ year: 2027, month: 1 }));
    await repository.saveMonth("hanna", record({ year: 2026, month: 12 }));
    await repository.saveMonth("hanna", record({ year: 2026, month: 9 }));

    expect((await repository.listMonths("hanna")).map((m) => m.month)).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
  });
});

describe("a span belongs to the worker and reaches every month it overlaps", () => {
  const crossing: MonthSpan = {
    id: "spell",
    kind: "sick",
    from: "2026-01-29",
    to: "2026-02-03",
  };

  it("hands the crossing spell whole to both months", async () => {
    // Whole, not clipped: the tiers are counted from the spell's own first day,
    // so February has to see the 29th of January to know that the 3rd of
    // February is the sixth day of the spell (specs.md item 8). The clipping
    // that belongs to the balance happens in the engine, not here.
    const repository = store();
    await repository.saveSpan("hanna", crossing);
    await repository.saveMonth("hanna", record(JANUARY));
    await repository.saveMonth("hanna", record(FEBRUARY));

    expect((await repository.getMonth("hanna", JANUARY))?.spans).toEqual([
      crossing,
    ]);
    expect((await repository.getMonth("hanna", FEBRUARY))?.spans).toEqual([
      crossing,
    ]);
  });

  it("keeps it out of the months it does not touch", async () => {
    const repository = store();
    await repository.saveSpan("hanna", crossing);
    await repository.saveMonth("hanna", record(MARCH));

    expect((await repository.getMonth("hanna", MARCH))?.spans).toEqual([]);
  });

  it("is stored once, so closing it closes it everywhere", async () => {
    // The same id saved again is the same span corrected. Two copies filed
    // under two months would leave one of them still open here.
    const repository = store();
    await repository.saveSpan("hanna", { ...crossing, to: null });
    await repository.saveSpan("hanna", crossing);

    expect(await repository.listSpans("hanna")).toEqual([crossing]);
  });

  it("carries an open spell into every later month until it is closed", async () => {
    // An unclosed spell has no last day, so there is no month it stops at
    // (specs.md item 8, Part 3). That is what an unclosed spell means, and the
    // month goes on drawing sick days until the worker's return is recorded.
    const repository = store();
    await repository.saveSpan("hanna", { ...crossing, to: null });
    for (const month of [JANUARY, FEBRUARY, MARCH]) {
      await repository.saveMonth("hanna", record(month));
    }

    expect(
      (await repository.listMonths("hanna")).map((m) => m.spans.length),
    ).toEqual([1, 1, 1]);

    await repository.saveSpan("hanna", crossing);

    expect(
      (await repository.listMonths("hanna")).map((m) => m.spans.length),
    ).toEqual([1, 1, 0]);
  });

  it("does not lose a span whose dates arrived the wrong way round", async () => {
    // In a right-to-left calendar a leftward drag moves forward in time, so a
    // reversed range is the plausible mistake (specs.md Part 5). It must land
    // in the months it covers rather than vanish from them: a mark the user
    // made and cannot see is worse than a mark drawn oddly.
    //
    // It is written as a *crossing* range on purpose. A backwards range inside
    // one month overlaps that month whichever end is compared, so a test using
    // one passes without the ordering and proves nothing; here the unordered
    // comparison asks whether the 3rd of February is before the 31st of January
    // and drops the span from January altogether.
    const repository = store();
    await repository.saveSpan("hanna", {
      id: "backwards",
      kind: "sick",
      from: "2026-02-03",
      to: "2026-01-29",
    });
    await repository.saveMonth("hanna", record(JANUARY));
    await repository.saveMonth("hanna", record(FEBRUARY));

    expect(
      (await repository.listMonths("hanna")).map((m) => m.spans.length),
    ).toEqual([1, 1]);
  });

  it("forgets a deleted span in every month at once", async () => {
    const repository = store();
    await repository.saveSpan("hanna", crossing);
    await repository.saveMonth("hanna", record(JANUARY));
    await repository.saveMonth("hanna", record(FEBRUARY));

    await repository.deleteSpan("hanna", "spell");

    expect(
      (await repository.listMonths("hanna")).map((m) => m.spans.length),
    ).toEqual([0, 0]);
  });
});

describe("what a caller does to what it read does not reach the store", () => {
  it("does not let a mutated result mutate the store", async () => {
    const repository = store();
    await repository.saveMonth("hanna", record(JANUARY));

    const first = await repository.getMonth("hanna", JANUARY);
    first!.incomeTaxAgorot = 999999;
    first!.userLines.push({
      id: "ghost",
      label: "לא נשמר",
      direction: "deduction",
      agorot: 1,
    });

    const second = await repository.getMonth("hanna", JANUARY);
    expect(second?.incomeTaxAgorot).toBe(0);
    expect(second?.userLines).toEqual([]);
  });

  it("does not let the object that was saved go on changing the store", async () => {
    // The mistake in the other direction, and the likelier one: a screen holds
    // the object it saved and edits it in place before saving again.
    const repository = store();
    const january = record(JANUARY);
    await repository.saveMonth("hanna", january);
    january.incomeTaxAgorot = 999999;

    expect((await repository.getMonth("hanna", JANUARY))?.incomeTaxAgorot).toBe(0);
  });

  it("does not let a mutated span list mutate the store", async () => {
    const repository = store();
    const span: MonthSpan = {
      id: "v1",
      kind: "vacation",
      from: "2026-01-14",
      to: "2026-01-14",
    };
    await repository.saveSpan("hanna", span);

    (await repository.listSpans("hanna")).pop();
    span.from = "2026-01-01";

    expect(await repository.listSpans("hanna")).toEqual([
      { id: "v1", kind: "vacation", from: "2026-01-14", to: "2026-01-14" },
    ]);
  });

  it("does not let a mutated profile mutate the store", async () => {
    const repository = store();
    const read = await repository.getWorker("hanna");
    read!.standingLines[0].agorot = 999999;

    expect((await repository.getWorker("hanna"))?.standingLines[0].agorot).toBe(
      5000,
    );
  });
});

describe("a month is reproducible from its facts alone", () => {
  it("gives the same result every time it is read and calculated", async () => {
    // No clock, no random source, nothing accumulated between calls — which is
    // also what makes the August 2025 snapshot stable. A store that handed back
    // a shared object would pass this and fail the mutation tests above; a
    // store that recomputed something would fail this and pass those.
    const repository = store();
    await repository.saveSpan("hanna", {
      id: "spell",
      kind: "sick",
      from: "2026-01-29",
      to: "2026-02-03",
    });
    await repository.saveMonth("hanna", record(JANUARY));

    const once = calculateMonth(
      (await repository.getMonth("hanna", JANUARY))!,
      HANNA,
    );
    const twice = calculateMonth(
      (await repository.getMonth("hanna", JANUARY))!,
      HANNA,
    );

    expect(once).toEqual(twice);
  });
});

describe("opening a month the store has no record of (specs.md item 21)", () => {
  const APRIL: YearMonth = { year: 2026, month: 4 };
  const DECEMBER_2025: YearMonth = { year: 2025, month: 12 };

  /** Two wage positions the application could carry, told apart by their
   * figures so a test can say which one it got. The rise from 5,880 to 6,247.65
   * on 1.4.2025 is the one `august-2025.test.ts` reads off the workbook. */
  const OLD_WAGE = {
    baseAgorot: 588000,
    minimumAgorot: 588000,
    effectiveFrom: "2024-04-01",
  };
  const NEW_WAGE = {
    baseAgorot: 624765,
    minimumAgorot: 624765,
    effectiveFrom: "2025-04-01",
  };

  const history = [
    { ...record(JANUARY), confirmedWage: OLD_WAGE },
    { ...record(FEBRUARY), confirmedWage: NEW_WAGE },
  ].map((each) => ({ ...each, spans: [] }));

  /**
   * **The dated-rates table answers, and the neighbouring month does not.**
   *
   * `SEEDED_RATES` holds the minimum wage at 6,247.65 from 1.4.2025 and at
   * 6,443.85 from 1.4.2026, both sourced to the family's own workbooks. April
   * 2026 is on the second, so a month opened there is worth 6,443.85 however
   * much the month before it was confirmed at.
   *
   * What it catches: the behaviour this repository actually had until
   * 2026-09-11 — a July 2026 opened by a mark and valued at the wage of April
   * 2025, below the minimum in force during it, with nothing saying so. The old
   * test asserted that behaviour and passed, because the code and the test made
   * the same assumption about where a wage comes from.
   */
  it("values a month at the minimum wage in force during it", async () => {
    const opened = wageToCarry(history, APRIL, HANNA, SEEDED_RATES);
    expect(opened).toEqual({
      baseAgorot: 644385,
      minimumAgorot: 644385,
      effectiveFrom: "2026-04-01",
    });
  });

  /**
   * **A family paying above the minimum keeps their figure** (item 3): the
   * floor settles only that a month cannot go below the law, and how far above
   * it this worker is paid is theirs to decide.
   */
  it("keeps a salary that already sits above the minimum", async () => {
    const generous = { ...HANNA, baseMonthlySalaryAgorot: 700000 };
    expect(wageToCarry(history, APRIL, generous, SEEDED_RATES)).toEqual({
      baseAgorot: 700000,
      minimumAgorot: 644385,
      effectiveFrom: "2026-04-01",
    });
  });

  /**
   * **A month the table cannot answer falls back to the nearest confirmed
   * position**, which is the old behaviour kept for the case it was right for.
   * Item 4 is explicit that a month earlier than every row gets no guess, so
   * there is nothing to read but what the worker already has.
   */
  it("carries the wage from the latest month before it where no rate is in force", async () => {
    expect(wageToCarry(history, APRIL, HANNA, [])).toEqual(NEW_WAGE);
  });

  it("carries the earliest month's wage to a month behind the whole history", async () => {
    // A family correcting a month from before they started using the
    // application. January's is the closest figure that exists; the user
    // confirms the real one before the export (item 4).
    expect(wageToCarry(history, DECEMBER_2025, HANNA, [])).toEqual(OLD_WAGE);
  });

  it("invents nothing for a worker with no months and no rate in force", async () => {
    // There is no figure to carry and no rate may be hardcoded (`CLAUDE.md`),
    // so the answer is that there is no answer.
    expect(wageToCarry([], APRIL, HANNA, [])).toBeNull();
  });

  it("does not depend on the order the months arrive in", async () => {
    // The store promises date order and an unsorted array does not fail — it
    // merely carries the wrong wage, which is the class of mistake that looks
    // entirely ordinary afterwards.
    expect(wageToCarry([...history].reverse(), APRIL, HANNA, [])).toEqual(
      NEW_WAGE,
    );
  });

  it("opens a month holding nothing but the position it opens from", async () => {
    // Part 5: a month that only holds facts is a draft, and a draft opened by a
    // mark has no advance, no third-party payment, no line of the user's own,
    // no override, and income tax at zero (item 17).
    const opened = openMonthRecord(HANNA, APRIL, NEW_WAGE);
    expect(opened).toEqual({
      month: APRIL,
      confirmedWage: NEW_WAGE,
      terms: snapshotTerms(HANNA),
      advances: [],
      thirdPartyPayments: [],
      userLines: [],
      incomeTaxAgorot: 0,
      overrides: {},
    });
  });

  it("snapshots the terms so the month keeps what it was calculated with", async () => {
    // Part 3: a family that moves the rest day later must not thereby restate
    // this month. The profile's standing lines travel with the snapshot, which
    // is what makes the copy a copy and not a reference.
    const opened = openMonthRecord(HANNA, APRIL, NEW_WAGE);
    expect(opened.terms.restDay).toBe(SATURDAY);
    expect(opened.terms.standingLines).toEqual(HANNA.standingLines);
  });

  it("is a month the store then takes and the engine then calculates", async () => {
    // The round trip the calendar's first mark makes: nothing recorded for
    // April, a span saved into it, the month opened, and April is a month with
    // figures instead of an empty screen.
    const repository = store();
    for (const each of history) await repository.saveMonth("hanna", each);
    expect(await repository.getMonth("hanna", APRIL)).toBeNull();

    await repository.saveSpan("hanna", {
      id: "april-vacation",
      kind: "vacation",
      // A Wednesday, so it is neither the rest day nor the rest-eve.
      from: "2026-04-15",
      to: "2026-04-15",
    });
    const wage = wageToCarry(
      await repository.listMonths("hanna"),
      APRIL,
      HANNA,
      await repository.listRates(),
    );
    await repository.saveMonth("hanna", openMonthRecord(HANNA, APRIL, wage!));

    const april = await repository.getMonth("hanna", APRIL);
    expect(april?.spans.map((span) => span.id)).toEqual(["april-vacation"]);
    expect(calculateMonth(april!, HANNA).gross).toBeGreaterThan(0);
  });
});

describe("the household's holiday lists", () => {
  /** A household starts from what the application ships knowing, so the picker
   * has something to show before any fetch has run (specs.md item 12). */
  it("open seeded with the shipped lists", async () => {
    const lists = await store().listHolidayLists();
    expect(lists).toEqual(SEEDED_HOLIDAY_LISTS);
  });

  /** Replaced and not appended, for the reason `withFetchedList` gives: two
   * lists under one source and one year make every lookup answer with whichever
   * the array order left first. */
  it("replace the list held for the same source and year", async () => {
    const repository = store();
    const fetched = {
      source: { kind: "country", code: "PH" } as const,
      year: 2026,
      sourceUrl: "https://www.isavta.co.il/he/holidays/PH/2026",
      nameHe: "הפיליפינים",
      holidays: [{ date: "2026-01-01", name: "New Year's Day" }],
    };
    await repository.saveHolidayList(fetched);

    const lists = await repository.listHolidayLists();
    expect(
      lists.filter(
        (list) => list.source.kind === "country" && list.source.code === "PH",
      ),
    ).toEqual([fetched]);
    expect(lists).toHaveLength(SEEDED_HOLIDAY_LISTS.length);
  });

  /** A faith's list has no shipped file, so the first one stored is an
   * addition rather than a replacement (`build_plan.md` stage 5, step 3). */
  it("take a faith's list beside the countries", async () => {
    const repository = store();
    await repository.saveHolidayList({
      source: { kind: "religion", religion: "druze" },
      year: 2026,
      sourceUrl: "https://www.kolzchut.org.il/he/חגים_דרוזיים",
      nameHe: "חגים דרוזיים",
      holidays: [{ date: "2026-04-30", name: "זיארת אל-נבי שועייב" }],
    });

    expect(await repository.listHolidayLists()).toHaveLength(
      SEEDED_HOLIDAY_LISTS.length + 1,
    );
  });

  /** It copies on the way out, as every other read does: a caller that pushed
   * onto what it read would be writing into the store. */
  it("hand back a copy", async () => {
    const repository = store();
    (await repository.listHolidayLists()).pop();
    expect(await repository.listHolidayLists()).toHaveLength(
      SEEDED_HOLIDAY_LISTS.length,
    );
  });
});

/**
 * The dated-rates table as the household holds it (specs.md item 4). The
 * methods arrived with the screen that has to show a fetched figure, which is
 * the pre-export confirmation — `datedRates.ts` said so before either existed.
 */
describe("the household's dated rates", () => {
  /** Seeded, so a month is valued before any fetch has ever run. */
  it("open seeded with what the application ships knowing", async () => {
    expect(await store().listRates()).toEqual(SEEDED_RATES);
  });

  /**
   * Replaced and not appended, for the reason `withFetchedRate` gives: two rows
   * claiming one key and one effective date make `rateInForce` answer with
   * whichever the sort left last, which is a coin toss dressed as a lookup.
   */
  it("replace the row held for the same key and effective date", async () => {
    const repository = store();
    const corrected = {
      key: "minimumWage" as const,
      value: 650000,
      effectiveFrom: "2026-04-01" as const,
      source: "אושר על ידי המשתמש/ת",
    };
    await repository.saveRate(corrected);

    const rates = await repository.listRates();
    expect(
      rates.filter(
        (rate) =>
          rate.key === "minimumWage" && rate.effectiveFrom === "2026-04-01",
      ),
    ).toEqual([corrected]);
    expect(rates).toHaveLength(SEEDED_RATES.length);
  });

  /** A figure for a date the table does not hold is a new row, which is what a
   * wage that rose again looks like. */
  it("take a row for a date the table does not hold", async () => {
    const repository = store();
    await repository.saveRate({
      key: "minimumWage",
      value: 660000,
      effectiveFrom: "2027-04-01",
      source: "https://www.kolzchut.org.il/he/שכר_מינימום",
    });
    expect(await repository.listRates()).toHaveLength(SEEDED_RATES.length + 1);
  });

  /** It copies on the way out, as every other read does. */
  it("hand back a copy", async () => {
    const repository = store();
    (await repository.listRates()).pop();
    expect(await repository.listRates()).toHaveLength(SEEDED_RATES.length);
  });
});
