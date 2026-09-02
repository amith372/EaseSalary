import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth } from "@/lib/engine/month";
import {
  createInMemoryRepository,
  UnknownWorkerError,
  type MonthRecord,
  type WorkerProfile,
} from "@/lib/engine/repository";
import { snapshotTerms } from "@/lib/engine/types";
import type { MonthSpan } from "@/lib/engine/types";
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
  baseMonthlySalaryAgorot: 624765,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  standingLines: [
    { id: "transport", label: "נסיעות", direction: "addition", agorot: 5000 },
  ],
  country: "PH",
  openingPosition: { vacationDays: 5, sickDays: 10, advances: [] },
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
