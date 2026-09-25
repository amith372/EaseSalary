import { describe, expect, it } from "vitest";
import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { SATURDAY } from "@/lib/dates";
import type { ActionEntry } from "@/lib/engine/actionList";
import {
  deferralOf,
  dismissalOf,
  groupedEntries,
  handledList,
  markedHandledOf,
  shownEntries,
  type Deferral,
} from "@/lib/engine/alerts";
import { openMonthRecord, type WorkerProfile } from "@/lib/engine/repository";
import { calculateSeries } from "@/lib/engine/series";
import { DEFAULT_INCOME_TAX, type MonthFacts } from "@/lib/engine/types";
import type { YearMonth } from "@/lib/types";

/**
 * The alerts page's own rules (specs.md item 27): a warning put off for seven
 * days or until what it says changes, a warning kind switched off, blockages
 * untouched by either, and the ninety days of what was handled. Every expected
 * date below is counted by hand from the rule, never read back.
 */

const BLOCKAGE: ActionEntry = {
  list: "blockage",
  key: "nationalInsurance",
  quarter: { from: { year: 2026, month: 4 }, to: { year: 2026, month: 6 } },
};
const VISA: ActionEntry = {
  list: "warning",
  key: "documentExpiring",
  document: "workVisa",
  expiresOn: "2026-10-01",
};
const UNEXPORTED: ActionEntry = {
  list: "warning",
  key: "monthNotExported",
  month: { year: 2026, month: 8 },
};

const ALL = [BLOCKAGE, VISA, UNEXPORTED];

function shown(deferrals: Deferral[], today: string, switchedOff = [] as never[]) {
  return shownEntries(ALL, { workerId: "w", switchedOff, deferrals, today });
}

describe("'not now'", () => {
  // Put off on 17 September: seven days later is 24 September, the first day
  // it shows again.
  const putOff = deferralOf("w", VISA, "2026-09-17");

  it("hides the warning through the sixth day after", () => {
    expect(putOff.until).toBe("2026-09-24");
    expect(shown([putOff], "2026-09-17")).toEqual([BLOCKAGE, UNEXPORTED]);
    expect(shown([putOff], "2026-09-23")).toEqual([BLOCKAGE, UNEXPORTED]);
  });

  it("shows it again on the seventh day", () => {
    expect(shown([putOff], "2026-09-24")).toEqual(ALL);
  });

  it("shows it again at once when a date it carries changes", () => {
    const renewedSoon: ActionEntry = { ...VISA, expiresOn: "2026-11-01" };
    expect(
      shownEntries([renewedSoon], {
        workerId: "w",
        switchedOff: [],
        deferrals: [putOff],
        today: "2026-09-18",
      }),
    ).toEqual([renewedSoon]);
  });

  it("hides nothing of another worker's", () => {
    expect(shown([deferralOf("other", VISA, "2026-09-17")], "2026-09-18")).toEqual(ALL);
  });

  it("never hides a blockage", () => {
    expect(shown([deferralOf("w", BLOCKAGE, "2026-09-17")], "2026-09-18")).toEqual(ALL);
  });
});

describe("'mark as handled' on a month not yet exported", () => {
  it("is what that month offers, and 'not now' is what other warnings offer", () => {
    expect(dismissalOf(UNEXPORTED)).toBe("markHandled");
    expect(dismissalOf(VISA)).toBe("notNow");
    expect(dismissalOf(BLOCKAGE)).toBeNull();
  });

  it("hides the month for good and leaves the others", () => {
    const marked = markedHandledOf("w", UNEXPORTED);
    // Years later, the August 2026 warning is still gone.
    expect(shown([marked], "2031-01-01")).toEqual([BLOCKAGE, VISA]);
    const september: ActionEntry = { ...UNEXPORTED, month: { year: 2026, month: 9 } };
    expect(
      shownEntries([september], { workerId: "w", switchedOff: [], deferrals: [marked], today: "2026-10-02" }),
    ).toEqual([september]);
  });
});

/**
 * Item 27: entries of one kind that differ only in the month they are about are
 * drawn as one entry naming those months, and count as one. Every group below
 * is written out by hand from that sentence; what the function returns decides
 * nothing.
 */
describe("months of one kind gathered into one entry", () => {
  const unconfirmed = (year: number, month: number): ActionEntry => ({
    list: "blockage",
    key: "monthUnconfirmed",
    month: { year, month },
  });
  const unexported = (year: number, month: number): ActionEntry => ({
    list: "warning",
    key: "monthNotExported",
    month: { year, month },
  });

  it("draws three unconfirmed months as one entry carrying all three", () => {
    const three = [unconfirmed(2026, 6), unconfirmed(2026, 7), unconfirmed(2026, 8)];
    expect(groupedEntries(three)).toEqual([
      { lead: three[0], entries: three },
    ]);
  });

  it("leaves a single month exactly as it was", () => {
    expect(groupedEntries([unconfirmed(2026, 8)])).toEqual([
      { lead: unconfirmed(2026, 8), entries: [unconfirmed(2026, 8)] },
    ]);
  });

  it("keeps the months it gathers in the order they came, gaps and all", () => {
    // July was confirmed between June and August, so the three months are not a
    // run: a card naming them by their two ends would claim a month that is not
    // on it.
    const gapped = [unconfirmed(2026, 5), unconfirmed(2026, 6), unconfirmed(2026, 8)];
    expect(groupedEntries(gapped)[0]?.entries).toEqual(gapped);
  });

  it("gathers by kind, so an unconfirmed month never joins an unexported one", () => {
    const mixed = [unconfirmed(2026, 6), unexported(2026, 4), unconfirmed(2026, 7)];
    expect(groupedEntries(mixed)).toEqual([
      { lead: mixed[0], entries: [mixed[0], mixed[2]] },
      { lead: mixed[1], entries: [mixed[1]] },
    ]);
  });

  it("gathers nothing else, and each quarter stays an entry of its own", () => {
    // Two national-insurance quarters and two documents: four entries, four
    // cards. Only the two kinds a replay raises month after month are gathered.
    const secondQuarter: ActionEntry = {
      list: "blockage",
      key: "nationalInsurance",
      quarter: { from: { year: 2026, month: 1 }, to: { year: 2026, month: 3 } },
    };
    const four = [BLOCKAGE, secondQuarter, VISA, { ...VISA, document: "passport" } as ActionEntry];
    expect(groupedEntries(four).map(({ entries }) => entries.length)).toEqual([1, 1, 1, 1]);
  });

  it("puts the entry where the first of its months stood", () => {
    // The order is item 27's, and gathering must not move a kind up the list:
    // the quarter came first and still does.
    const list = [BLOCKAGE, unconfirmed(2026, 6), VISA, unconfirmed(2026, 7)];
    expect(groupedEntries(list).map(({ lead }) => lead.key)).toEqual([
      "nationalInsurance",
      "monthUnconfirmed",
      "documentExpiring",
    ]);
  });

  it("counts as one, which is the number the bell and the opening screen give", () => {
    const twelve = Array.from({ length: 12 }, (_, index) => unexported(2026, index + 1));
    expect(groupedEntries(twelve)).toHaveLength(1);
    expect(groupedEntries(twelve)[0]?.entries).toHaveLength(12);
  });

  it("lets a month put off on its own leave without taking the rest", () => {
    // 'Mark as handled' on July: June and August are still one entry, and the
    // card that draws them names two months rather than three.
    const three = [unexported(2026, 6), unexported(2026, 7), unexported(2026, 8)];
    const marked = markedHandledOf("w", three[1]!);
    const left = shownEntries(three, {
      workerId: "w",
      switchedOff: [],
      deferrals: [marked],
      today: "2026-09-18",
    });
    expect(groupedEntries(left)).toEqual([
      { lead: three[0], entries: [three[0], three[2]] },
    ]);
  });
});

describe("a warning kind switched off", () => {
  it("is not shown, and a blockage still is", () => {
    expect(
      shownEntries(ALL, {
        workerId: "w",
        switchedOff: ["monthNotExported"],
        deferrals: [],
        today: "2026-09-18",
      }),
    ).toEqual([BLOCKAGE, VISA]);
  });
});

/**
 * Item 27: an advance still being repaid is a warning — put off with 'not now',
 * back once an instalment changes what is owed, and switched off by its kind.
 * Catches it drifting back to a blockage, which neither of these can touch.
 */
describe("an advance still being repaid", () => {
  const owed: ActionEntry = {
    list: "warning",
    key: "advanceOutstanding",
    number: 3,
    outstandingAgorot: 100000,
  };
  const on = (deferrals: Deferral[], switchedOff: "advanceOutstanding"[] = []) =>
    (entries: ActionEntry[]) =>
      shownEntries(entries, { workerId: "w", switchedOff, deferrals, today: "2026-09-18" });

  it("is put off with 'not now', and shows again once an instalment is recorded", () => {
    expect(dismissalOf(owed)).toBe("notNow");
    const putOff = deferralOf("w", owed, "2026-09-17");
    expect(on([putOff])([owed])).toEqual([]);
    // ₪1,000 owed, ₪200 repaid: ₪800 is a different entry.
    const afterInstalment: ActionEntry = { ...owed, outstandingAgorot: 80000 };
    expect(on([putOff])([afterInstalment])).toEqual([afterInstalment]);
  });

  it("is switched off by its kind", () => {
    expect(on([], ["advanceOutstanding"])([BLOCKAGE, owed])).toEqual([BLOCKAGE]);
  });
});

describe("what was already handled", () => {
  // Employed from 10 March 2025, recuperation in July: July 2026 is the first
  // recuperation month that owes days (item 15).
  const profile: WorkerProfile = {
    id: "w",
    insurer: "",
    name: "מריה",
    firstName: "מריה",
    employedSince: "2025-03-10",
    firstMonth: { year: 2026, month: 5 },
    gender: "female",
    baseMonthlySalaryAgorot: 624765,
    restDay: SATURDAY,
    restEveSupplementAgorot: 0,
    recuperationMonth: 7,
    incomeTax: DEFAULT_INCOME_TAX,
    standingLines: [],
    country: "PH",
    openingPosition: {
      vacationDays: 0,
      sickDays: 0,
      vacationUsedThisYear: 0,
      holidayUsedThisYear: 0,
      recuperationPaidIn: null,
      advances: [],
    },
    documents: { employmentPermitExpiry: null, workVisaExpiry: null, passportExpiry: null },
  };

  function month(ym: YearMonth, changes: Partial<MonthFacts>): MonthFacts {
    const minimum = rateInForce(SEEDED_RATES, "minimumWage", ym)!;
    return {
      ...openMonthRecord(profile, ym, {
        baseAgorot: minimum.value,
        minimumAgorot: minimum.value,
        effectiveFrom: minimum.effectiveFrom,
      }),
      spans: [],
      ...changes,
    };
  }

  const months = [
    // Exported 1 June: 108 days before 17 September, past the ninety.
    month({ year: 2026, month: 5 }, { exportedAt: "2026-06-01T08:00:00Z" }),
    // Confirmed in June, not a recuperation month: no recuperation entry.
    month({ year: 2026, month: 6 }, { confirmedAt: "2026-07-02T08:00:00Z" }),
    // July, the recuperation month, confirmed and exported on 3 August at
    // 22:30 UTC, which is 4 August in Israel. A visa fee paid 20 July.
    month(
      { year: 2026, month: 7 },
      {
        confirmedAt: "2026-08-03T22:30:00Z",
        exportedAt: "2026-08-03T22:30:00Z",
        thirdPartyPayments: [{ kind: "workerVisa", agorot: 50000, paidOn: "2026-07-20" }],
      },
    ),
    // National insurance for the second quarter paid 15 September.
    month(
      { year: 2026, month: 9 },
      {
        thirdPartyPayments: [
          { kind: "nationalInsurance", agorot: 90000, paidOn: "2026-09-15" },
        ],
      },
    ),
  ];

  it("lists the last ninety days, newest first, each dated in Israel", () => {
    const today = "2026-09-17";
    const series = calculateSeries(months, profile, today, SEEDED_RATES);
    // 17 September less ninety days is 19 June: the June export is outside.
    expect(handledList(profile, series, today)).toEqual([
      { key: "paymentRecorded", kind: "nationalInsurance", month: { year: 2026, month: 9 }, on: "2026-09-15" },
      { key: "monthExported", month: { year: 2026, month: 7 }, on: "2026-08-04" },
      { key: "recuperationConfirmed", month: { year: 2026, month: 7 }, on: "2026-08-04" },
      { key: "paymentRecorded", kind: "workerVisa", month: { year: 2026, month: 7 }, on: "2026-07-20" },
    ]);
  });
});
