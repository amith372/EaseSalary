import { describe, expect, it } from "vitest";
import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { SATURDAY } from "@/lib/dates";
import type { ActionEntry } from "@/lib/engine/actionList";
import {
  deferralOf,
  dismissalOf,
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
