import { describe, expect, it } from "vitest";
import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { SATURDAY, isoOf } from "@/lib/dates";
import { actionList, type ActionEntry } from "@/lib/engine/actionList";
import { openMonthRecord, type WorkerProfile } from "@/lib/engine/repository";
import { calculateSeries } from "@/lib/engine/series";
import {
  DEFAULT_INCOME_TAX,
  type MonthFacts,
  type MonthSpan,
} from "@/lib/engine/types";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * The action list of specs.md item 27.
 *
 * **Where every expected entry comes from.** No workbook holds a reminder, so
 * each one is worked out by hand from the rule that raises it and written
 * beside the assertion: item 19's quarter in arrears, item 28's eighteen
 * months, item 15's first completed year, item 7's seven days in December, item
 * 10's nine holidays, and the lead times and lists the user chose on 2026-09-17
 * (sixty days for the permit, the visa and the policy; the month before for
 * recuperation and seniority). None is read back from what the function
 * returned.
 */

// Employed from 10 March 2025 and calculated from January 2026: her first
// employment year completes on 10 March 2026, so July 2026, her recuperation
// month, is the first that owes anything (item 15).
const PROFILE: WorkerProfile = {
  id: "w",
  insurer: "",
  name: "מריה",
  firstName: "מריה",
  employedSince: "2025-03-10",
  firstMonth: { year: 2026, month: 1 },
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
  // Far enough ahead to say nothing on any date these tests use before 2027.
  documents: {
    employmentPermitExpiry: "2027-06-01",
    workVisaExpiry: "2027-06-01",
    passportExpiry: "2029-06-01",
  },
};

// Nine Mondays of 2026 — none on her Saturday rest day, so all nine count
// towards the year's nine (items 9, 10).
const NINE_HOLIDAYS: MonthSpan[] = [
  "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02",
  "2026-02-09", "2026-02-16", "2026-02-23", "2026-03-02",
].map((date, i) => ({ id: `h${i}`, kind: "holiday", from: date, to: date, worked: true }));

function ym(year: number, month: number): YearMonth {
  return { year, month };
}

/** A stored month at the minimum wage in force during it (item 4). */
function monthOf(
  month: YearMonth,
  changes: Partial<MonthFacts> = {},
  profile: WorkerProfile = PROFILE,
): MonthFacts {
  const minimum = rateInForce(SEEDED_RATES, "minimumWage", month)!;
  return {
    ...openMonthRecord(profile, month, {
      baseAgorot: minimum.value,
      minimumAgorot: minimum.value,
      effectiveFrom: minimum.effectiveFrom,
    }),
    spans: [],
    ...changes,
  };
}

function listFor({
  today,
  months = [],
  spans = NINE_HOLIDAYS,
  profile = PROFILE,
}: {
  today: IsoDate;
  months?: MonthFacts[];
  spans?: MonthSpan[];
  profile?: WorkerProfile;
}): ActionEntry[] {
  // A stored month carries the spans that fall in it, as the store assembles it.
  const withSpans = months.map((facts) => ({
    ...facts,
    spans: spans.filter(
      (span) =>
        span.from <= isoOf(facts.month, 31) && (span.to ?? span.from) >= isoOf(facts.month, 1),
    ),
  }));
  return actionList({
    profile,
    series: calculateSeries(withSpans, profile, today, SEEDED_RATES),
    spans,
    rates: SEEDED_RATES,
    today,
  });
}

function only<K extends ActionEntry["key"]>(entries: ActionEntry[], key: K) {
  return entries.filter((entry) => entry.key === key);
}

describe("nothing outstanding", () => {
  // Item 27's done-when. 20 January 2026: no quarter has ended since January
  // (the last ended in December, before her first month); January itself has not
  // ended; all nine holidays are chosen; every document is more than sixty days
  // (and the passport more than eighteen months) off; no advance; recuperation
  // is July and the anniversary March, neither of them next month.
  it("is an empty list", () => {
    expect(listFor({ today: "2026-01-20" })).toEqual([]);
  });
});

describe("the national-insurance quarter (item 19)", () => {
  it("is due the month after the quarter ends", () => {
    // April: January–March has ended and nothing covers it.
    expect(only(listFor({ today: "2026-04-15" }), "nationalInsurance")).toEqual([
      { list: "blockage", key: "nationalInsurance", quarter: { from: ym(2026, 1), to: ym(2026, 3) } },
    ]);
  });

  it("is gone once a payment covers the quarter", () => {
    const april = monthOf(ym(2026, 4), {
      thirdPartyPayments: [
        {
          kind: "nationalInsurance",
          agorot: 60000,
          paidOn: "2026-04-12",
          coversMonths: [ym(2026, 1), ym(2026, 2), ym(2026, 3)],
        },
      ],
    });
    expect(only(listFor({ today: "2026-04-15", months: [april] }), "nationalInsurance")).toEqual([]);
  });

  it("stays until it is paid, so two unpaid quarters are two entries", () => {
    // 2 July: January–March and April–June have both ended.
    expect(only(listFor({ today: "2026-07-02" }), "nationalInsurance")).toEqual([
      { list: "blockage", key: "nationalInsurance", quarter: { from: ym(2026, 1), to: ym(2026, 3) } },
      { list: "blockage", key: "nationalInsurance", quarter: { from: ym(2026, 4), to: ym(2026, 6) } },
    ]);
  });

  it("reads a payment naming no period as covering the month it was filed under", () => {
    // Item 16: most payments cover the month they were made in and say nothing.
    const march = monthOf(ym(2026, 3), {
      thirdPartyPayments: [{ kind: "nationalInsurance", agorot: 60000, paidOn: "2026-03-30" }],
    });
    expect(only(listFor({ today: "2026-04-15", months: [march] }), "nationalInsurance")).toEqual([]);
  });
});

describe("the documents and the policy (items 27, 28)", () => {
  function withDocuments(documents: Partial<WorkerProfile["documents"]>): WorkerProfile {
    return { ...PROFILE, documents: { ...PROFILE.documents, ...documents } };
  }

  it("warns sixty days ahead, counting the sixtieth day", () => {
    // 20 January + 60 days = 21 March (11 left in January, 28 in February, 21).
    const entries = listFor({
      today: "2026-01-20",
      profile: withDocuments({ employmentPermitExpiry: "2026-03-21", workVisaExpiry: "2026-03-22" }),
    });
    expect(only(entries, "documentExpiring")).toEqual([
      { list: "warning", key: "documentExpiring", document: "employmentPermit", expiresOn: "2026-03-21" },
    ]);
  });

  it("puts a lapsed document on the opening screen, and one expiring today is still valid", () => {
    const entries = listFor({
      today: "2026-01-20",
      profile: withDocuments({ employmentPermitExpiry: "2026-01-19", workVisaExpiry: "2026-01-20" }),
    });
    expect(only(entries, "documentExpired")).toEqual([
      { list: "blockage", key: "documentExpired", document: "employmentPermit", expiresOn: "2026-01-19" },
    ]);
    expect(only(entries, "documentExpiring")).toEqual([
      { list: "warning", key: "documentExpiring", document: "workVisa", expiresOn: "2026-01-20" },
    ]);
  });

  it("warns of the passport with fewer than eighteen months left, not at exactly eighteen", () => {
    // 20 January 2026 + 18 months = 20 July 2027.
    const exactly = listFor({ today: "2026-01-20", profile: withDocuments({ passportExpiry: "2027-07-20" }) });
    expect(only(exactly, "documentExpiring")).toEqual([]);
    const fewer = listFor({ today: "2026-01-20", profile: withDocuments({ passportExpiry: "2027-07-19" }) });
    expect(only(fewer, "documentExpiring")).toEqual([
      { list: "warning", key: "documentExpiring", document: "passport", expiresOn: "2027-07-19" },
    ]);
  });

  it("reads the policy's end off the payment, a year after it was paid unless it says otherwise", () => {
    // Paid 5 January 2026, so covered through 5 January 2027 (item 16). On 10
    // November, 60 days reach 9 January, so it warns; on 6 January it has lapsed.
    const january = monthOf(ym(2026, 1), {
      thirdPartyPayments: [{ kind: "medicalInsurance", agorot: 300000, paidOn: "2026-01-05" }],
    });
    expect(only(listFor({ today: "2026-11-10", months: [january] }), "documentExpiring")).toEqual([
      { list: "warning", key: "documentExpiring", document: "medicalInsurance", expiresOn: "2027-01-05" },
    ]);
    expect(only(listFor({ today: "2027-01-06", months: [january] }), "documentExpired")).toEqual([
      { list: "blockage", key: "documentExpired", document: "medicalInsurance", expiresOn: "2027-01-05" },
    ]);
  });

  it("uses a cover end the family stated instead", () => {
    const january = monthOf(ym(2026, 1), {
      thirdPartyPayments: [
        { kind: "medicalInsurance", agorot: 300000, paidOn: "2026-01-05", expiresOn: "2026-02-01" },
      ],
    });
    expect(only(listFor({ today: "2026-02-02", months: [january] }), "documentExpired")).toEqual([
      { list: "blockage", key: "documentExpired", document: "medicalInsurance", expiresOn: "2026-02-01" },
    ]);
  });
});

describe("an advance still being repaid (item 20)", () => {
  it("lists what is still owed on each numbered advance", () => {
    // Opening: ₪1,000 given, ₪400 repaid, so ₪600 left. February grants a second
    // of ₪500, none of it repaid yet.
    const profile: WorkerProfile = {
      ...PROFILE,
      openingPosition: {
        ...PROFILE.openingPosition,
        advances: [{ number: 1, principalAgorot: 100000, repaidAgorot: 40000 }],
      },
    };
    const february = monthOf(
      ym(2026, 2),
      { advances: [{ number: 2, kind: "granted", agorot: 50000 }] },
      profile,
    );
    expect(only(listFor({ today: "2026-02-10", months: [february], profile }), "advanceOutstanding")).toEqual([
      { list: "blockage", key: "advanceOutstanding", number: 1, outstandingAgorot: 60000 },
      { list: "blockage", key: "advanceOutstanding", number: 2, outstandingAgorot: 50000 },
    ]);
  });

  it("says nothing of an advance repaid in full", () => {
    const profile: WorkerProfile = {
      ...PROFILE,
      openingPosition: {
        ...PROFILE.openingPosition,
        advances: [{ number: 1, principalAgorot: 100000, repaidAgorot: 100000 }],
      },
    };
    expect(only(listFor({ today: "2026-01-20", profile }), "advanceOutstanding")).toEqual([]);
  });
});

describe("holidays not all chosen (item 10)", () => {
  it("counts what is chosen against the nine", () => {
    const eight = NINE_HOLIDAYS.slice(0, 8);
    expect(only(listFor({ today: "2026-01-20", spans: eight }), "holidaysUnchosen")).toEqual([
      { list: "blockage", key: "holidaysUnchosen", year: 2026, chosenDays: 8, allowance: 9 },
    ]);
  });

  it("does not count a holiday on her rest day", () => {
    // 2026-03-07 is a Saturday: chosen, and it spends nothing from the nine (item 9).
    const spans: MonthSpan[] = [
      ...NINE_HOLIDAYS.slice(0, 8),
      { id: "sat", kind: "holiday", from: "2026-03-07", to: "2026-03-07", worked: true },
    ];
    expect(only(listFor({ today: "2026-01-20", spans }), "holidaysUnchosen")).toEqual([
      { list: "blockage", key: "holidaysUnchosen", year: 2026, chosenDays: 8, allowance: 9 },
    ]);
  });

  it("measures the year she started against its share of the nine", () => {
    // Started 1 July 2026: six months of twelve, so 9 × 6 / 12 = 4.5 (item 10).
    const profile: WorkerProfile = {
      ...PROFILE,
      employedSince: "2026-07-01",
      firstMonth: ym(2026, 7),
    };
    expect(only(listFor({ today: "2026-07-15", spans: [], profile }), "holidaysUnchosen")).toEqual([
      { list: "blockage", key: "holidaysUnchosen", year: 2026, chosenDays: 0, allowance: 4.5 },
    ]);
  });
});

describe("recuperation (item 15)", () => {
  it("warns in the month before the recuperation month", () => {
    expect(only(listFor({ today: "2026-06-10" }), "recuperationApproaching")).toEqual([
      { list: "warning", key: "recuperationApproaching", month: ym(2026, 7) },
    ]);
  });

  it("is due in the recuperation month until its day rate is confirmed", () => {
    expect(only(listFor({ today: "2026-07-10" }), "recuperationDue")).toEqual([
      { list: "blockage", key: "recuperationDue", month: ym(2026, 7) },
    ]);
    const july = monthOf(ym(2026, 7), { recuperationDayRateAgorot: 45150 });
    expect(only(listFor({ today: "2026-07-10", months: [july] }), "recuperationDue")).toEqual([]);
  });

  it("says nothing before her first year is complete", () => {
    // Employed 10 August 2025: on 31 July 2026 no year is complete, so July owes
    // nothing and neither June nor July says anything.
    const profile: WorkerProfile = { ...PROFILE, employedSince: "2025-08-10" };
    expect(only(listFor({ today: "2026-06-10", profile }), "recuperationApproaching")).toEqual([]);
    expect(only(listFor({ today: "2026-07-10", profile }), "recuperationDue")).toEqual([]);
  });
});

describe("a year with fewer than seven vacation days (item 7)", () => {
  // 10–16 March 2026, Tuesday to Monday, with Saturday the 14th her rest day:
  // six working days. To the 17th: seven.
  const sixDays: MonthSpan = { id: "v", kind: "vacation", from: "2026-03-10", to: "2026-03-16" };
  const sevenDays: MonthSpan = { ...sixDays, to: "2026-03-17" };

  it("is raised in December with the days taken", () => {
    const march = monthOf(ym(2026, 3));
    expect(
      only(listFor({ today: "2026-12-05", months: [march], spans: [...NINE_HOLIDAYS, sixDays] }), "vacationUnderSeven"),
    ).toEqual([{ list: "blockage", key: "vacationUnderSeven", year: 2026, days: 6, required: 7 }]);
  });

  it("is not raised at seven", () => {
    const march = monthOf(ym(2026, 3));
    expect(
      only(listFor({ today: "2026-12-05", months: [march], spans: [...NINE_HOLIDAYS, sevenDays] }), "vacationUnderSeven"),
    ).toEqual([]);
  });

  it("counts the days taken before her first month", () => {
    const profile: WorkerProfile = {
      ...PROFILE,
      openingPosition: { ...PROFILE.openingPosition, vacationUsedThisYear: 7 },
    };
    expect(only(listFor({ today: "2026-12-05", profile }), "vacationUnderSeven")).toEqual([]);
  });

  it("asks a partial year for what it accrued (14 × 3 ÷ 12 = 3.5)", () => {
    const profile: WorkerProfile = {
      ...PROFILE,
      employedSince: "2026-10-01",
      firstMonth: { year: 2026, month: 10 },
    };
    expect(only(listFor({ today: "2026-12-05", profile }), "vacationUnderSeven")).toEqual([
      { list: "blockage", key: "vacationUnderSeven", year: 2026, days: 0, required: 3.5 },
    ]);
  });

  it("is not raised for a worker employed only from next year", () => {
    const profile: WorkerProfile = {
      ...PROFILE,
      employedSince: "2027-01-01",
      firstMonth: { year: 2027, month: 1 },
    };
    expect(only(listFor({ today: "2026-12-05", profile }), "vacationUnderSeven")).toEqual([]);
  });

  it("is not raised before December", () => {
    expect(only(listFor({ today: "2026-11-30" }), "vacationUnderSeven")).toEqual([]);
  });
});

describe("a finished month not exported (Part 5)", () => {
  it("lists each ended month no file was produced from, in the bell", () => {
    // 5 March: January exported, February not, March still running.
    const january = monthOf(ym(2026, 1), { exportedAt: "2026-02-01T08:00:00Z" });
    expect(only(listFor({ today: "2026-03-05", months: [january] }), "monthNotExported")).toEqual([
      { list: "warning", key: "monthNotExported", month: ym(2026, 2) },
    ]);
  });
});

describe("a minimum wage that changed since the last export (items 4, 27)", () => {
  it("is raised when the wage in force differs from the last exported month's", () => {
    // March 2026 was confirmed at ₪6,247.65; from 1 April 2026 it is ₪6,443.85
    // (the seeded table, read from the family's 2026 workbook).
    const march = monthOf(ym(2026, 3), { exportedAt: "2026-04-02T08:00:00Z" });
    expect(only(listFor({ today: "2026-04-10", months: [march] }), "minimumWageChanged")).toEqual([
      {
        list: "blockage",
        key: "minimumWageChanged",
        exportedAtAgorot: 624765,
        nowAgorot: 644385,
        effectiveFrom: "2026-04-01",
      },
    ]);
  });

  it("is quiet when nothing changed, and before anything was exported", () => {
    const february = monthOf(ym(2026, 2), { exportedAt: "2026-03-02T08:00:00Z" });
    expect(only(listFor({ today: "2026-03-10", months: [february] }), "minimumWageChanged")).toEqual([]);
    expect(only(listFor({ today: "2026-04-10" }), "minimumWageChanged")).toEqual([]);
  });

  it("measures against the month exported last, not the latest month", () => {
    // April was exported first, then March re-exported after a correction: the
    // last file produced was at March's wage.
    const march = monthOf(ym(2026, 3), { exportedAt: "2026-05-03T08:00:00Z" });
    const april = monthOf(ym(2026, 4), { exportedAt: "2026-05-01T08:00:00Z" });
    expect(only(listFor({ today: "2026-05-10", months: [march, april] }), "minimumWageChanged")).toEqual([
      {
        list: "blockage",
        key: "minimumWageChanged",
        exportedAtAgorot: 624765,
        nowAgorot: 644385,
        effectiveFrom: "2026-04-01",
      },
    ]);
  });
});

describe("a new year of seniority (item 27)", () => {
  it("warns in the month before the anniversary", () => {
    // Employed 10 March 2025: her second year begins 10 March 2026.
    expect(only(listFor({ today: "2026-02-10" }), "seniorityYearTurning")).toEqual([
      { list: "warning", key: "seniorityYearTurning", years: 1, on: "2026-03-10" },
    ]);
  });

  it("is quiet in the anniversary month itself", () => {
    expect(only(listFor({ today: "2026-03-10" }), "seniorityYearTurning")).toEqual([]);
  });
});
