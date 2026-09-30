import { describe, expect, it } from "vitest";
import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { SATURDAY, eachMonth } from "@/lib/dates";
import { openMonthRecord, type WorkerProfile } from "@/lib/engine/repository";
import { calculateSeries } from "@/lib/engine/series";
import {
  DEFAULT_INCOME_TAX,
  type MonthFacts,
  type ThirdPartyPayment,
} from "@/lib/engine/types";
import { upcoming, type UpcomingEntry } from "@/lib/engine/upcoming";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * The payments screen's "לקראת החודשים הבאים" (specs.md item 15).
 *
 * **Where every expected entry comes from.** No workbook holds a reminder, so
 * each is worked out by hand from the rule the user approved on 2026-09-17: the
 * visa extension fee in the month the work visa expires, the licence fee in the
 * month the permit expires, the agency fee a year after the last one recorded,
 * recuperation in its month once owed with item 15's ladder for the days, all
 * within twelve months counted from this one, and the last amount paid per kind.
 */

// Employed from 10 March 2025: their first employment year completes on 10 March
// 2026, so July 2026 owes 5 days and July 2027, two years done, owes 6 (item 15).
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
  documents: {
    employmentPermitExpiry: "2027-06-01",
    workVisaExpiry: "2027-06-20",
    passportExpiry: "2029-06-01",
  },
};

function ym(year: number, month: number): YearMonth {
  return { year, month };
}

function payment(kind: ThirdPartyPayment["kind"], agorot: number, paidOn: IsoDate): ThirdPartyPayment {
  return { kind, agorot, paidOn };
}

/** Every month from January 2026 to today's, with the changes given per month. */
function listFor({
  today,
  changes = {},
  profile = PROFILE,
}: {
  today: IsoDate;
  changes?: Record<number, Partial<MonthFacts>>;
  profile?: WorkerProfile;
}): UpcomingEntry[] {
  const [year, month] = today.split("-").map(Number);
  const months = eachMonth(profile.firstMonth, ym(year, month)).map((one) => {
    const minimum = rateInForce(SEEDED_RATES, "minimumWage", one)!;
    const key = (one.year - 2026) * 12 + one.month;
    return {
      ...openMonthRecord(profile, one, {
        baseAgorot: minimum.value,
        minimumAgorot: minimum.value,
        effectiveFrom: minimum.effectiveFrom,
      }),
      spans: [],
      ...changes[key],
    };
  });
  return upcoming({
    profile,
    series: calculateSeries(months, profile, today, SEEDED_RATES),
    today,
  });
}

describe("what falls in the next twelve months", () => {
  it("is only recuperation when the documents are further off and no fee was paid", () => {
    // 20 January 2026: the window is January–December 2026. Both documents
    // expire in June 2027, outside it; nothing was paid to the agency.
    expect(listFor({ today: "2026-01-20" })).toEqual([
      { key: "recuperation", month: ym(2026, 7), days: 5 },
    ]);
  });

  it("orders the fees and recuperation by month, with the last amount paid per kind", () => {
    // 5 August 2026: the window is August 2026–July 2027. The agency was paid
    // twice, and the later payment (May 2026, ₪600) sets both the month (May
    // 2027) and the amount. The visa extension fee was paid once (₪200); the
    // licence fee never was. Same-month entries keep item 15's order: visa,
    // then licence.
    const entries = listFor({
      today: "2026-08-05",
      changes: {
        2: { thirdPartyPayments: [payment("agencyFee", 50000, "2026-02-15")] },
        3: { thirdPartyPayments: [payment("visaExtensionFee", 20000, "2026-03-03")] },
        5: { thirdPartyPayments: [payment("agencyFee", 60000, "2026-05-20")] },
      },
    });
    expect(entries).toEqual([
      { key: "fee", kind: "agencyFee", month: ym(2027, 5), lastPaidAgorot: 60000 },
      { key: "fee", kind: "visaExtensionFee", month: ym(2027, 6), lastPaidAgorot: 20000 },
      { key: "fee", kind: "licenceFee", month: ym(2027, 6), lastPaidAgorot: null },
      { key: "recuperation", month: ym(2027, 7), days: 6 },
    ]);
  });

  it("includes the twelfth month and not the thirteenth", () => {
    // 10 July 2026 reaches June 2027, the permit's and the visa's month;
    // 10 June 2026 stops at May 2027 and misses both.
    const july = listFor({ today: "2026-07-10" }).map((entry) => entry.key);
    expect(july).toEqual(["recuperation", "fee", "fee"]);
    expect(listFor({ today: "2026-06-10" })).toEqual([
      { key: "recuperation", month: ym(2026, 7), days: 5 },
    ]);
  });
});

describe("recuperation", () => {
  it("leaves this month once its day rate is confirmed", () => {
    // July 2026 is the recuperation month and its rate was confirmed, so what
    // was due is handled; July 2027 is past the window's end in June 2027.
    const entries = listFor({
      today: "2026-07-10",
      changes: { 7: { recuperationDayRateAgorot: 41800 } },
    });
    expect(entries.filter((entry) => entry.key === "recuperation")).toEqual([]);
  });

  it("is not listed before a full employment year is complete", () => {
    // Employed from 1 September 2025: by 31 July 2026 no year is complete, so
    // July 2026 owes nothing (item 15). The window from January stops before
    // July 2027.
    const newer = { ...PROFILE, employedSince: "2025-09-01" };
    expect(listFor({ today: "2026-01-20", profile: newer })).toEqual([]);
  });
});

describe("the documents", () => {
  it("say nothing when no expiry date was entered", () => {
    const blank = {
      ...PROFILE,
      documents: { employmentPermitExpiry: null, workVisaExpiry: null, passportExpiry: null },
    };
    expect(listFor({ today: "2026-08-05", profile: blank })).toEqual([
      { key: "recuperation", month: ym(2027, 7), days: 6 },
    ]);
  });
});
