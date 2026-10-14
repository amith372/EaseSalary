import { describe, expect, it } from "vitest";
import { SEEDED_RATES, rateInForce } from "@/lib/datedRates";
import { SATURDAY, isoOf } from "@/lib/dates";
import { actionList } from "@/lib/engine/actionList";
import { openMonthRecord, type WorkerProfile } from "@/lib/engine/repository";
import { calculateSeries, type MonthInSeries } from "@/lib/engine/series";
import { DEFAULT_INCOME_TAX, type MonthFacts } from "@/lib/engine/types";
import { upcoming } from "@/lib/engine/upcoming";
import { answerFor, type Answer } from "@/lib/help/answers";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * What the panel answers out of the household's own months (specs.md item 24).
 *
 * **Where every expected figure comes from** (`CLAUDE.md` rule 11). The months
 * and quarters are worked out on paper from the calendar and from item 19's
 * rule that the insurance is paid once a quarter and in arrears; the one amount
 * asserted as a figure is derived here in the open — the 2026 minimum wage of
 * ₪6,443.85, paid as a whole shekel (item 3) and so ₪6,444, at the 3.6% in
 * force from January 2025, which is ₪231.98 and so ₪232. None of them is read
 * back from what a resolver returned.
 *
 * **What is asserted against the engine's own output is the *quoting***, which
 * is the claim these resolvers exist to make: an answer may add nothing to the
 * replay and may take nothing away from it. A figure that agreed with a
 * separate sum computed here would prove the opposite of what is wanted.
 */

const PROFILE: WorkerProfile = {
  id: "w",
  insurer: "",
  name: "מריה",
  firstName: "מריה",
  employedSince: "2025-01-01",
  firstMonth: { year: 2026, month: 1 },
  gender: "female",
  baseMonthlySalaryAgorot: 624765,
  restDay: SATURDAY,
  // Nothing beside the base salary, so the month's gross is the base alone and
  // the estimate below can be derived on paper from one figure.
  restEveSupplementAgorot: 0,
  // December, so no month of 2026 under test carries recuperation (item 15).
  recuperationMonth: 12,
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
    // Far enough ahead to say nothing on any date these tests use, except
    // where a test replaces it.
    employmentPermitExpiry: "2028-06-01",
    workVisaExpiry: "2028-06-01",
    passportExpiry: "2029-06-01",
  },
};

function ym(year: number, month: number): YearMonth {
  return { year, month };
}

/** A stored month at the minimum wage in force during it (item 4), with
 * nothing marked on it. */
function storedMonth(month: YearMonth, changes: Partial<MonthFacts> = {}): MonthFacts {
  const minimum = rateInForce(SEEDED_RATES, "minimumWage", month);
  if (minimum === null) throw new Error("no minimum wage for the month");
  return {
    ...openMonthRecord(PROFILE, month, {
      baseAgorot: minimum.value,
      minimumAgorot: minimum.value,
      effectiveFrom: minimum.effectiveFrom,
    }),
    spans: [],
    ...changes,
  };
}

function seriesOf(months: MonthFacts[], today: IsoDate, profile = PROFILE): MonthInSeries[] {
  return calculateSeries(months, profile, today, SEEDED_RATES);
}

function answer(
  id: Parameters<typeof answerFor>[0],
  {
    months,
    today,
    profile = PROFILE,
  }: { months: MonthFacts[]; today: IsoDate; profile?: WorkerProfile },
): Answer {
  const series = seriesOf(months, today, profile);
  return answerFor(id, {
    profile,
    series,
    actions: actionList({ profile, series, spans: [], rates: SEEDED_RATES, today }),
    ahead: upcoming({ profile, series, today }),
    today,
  });
}

/** January to July 2026, which is every month that has begun by the dates used
 * below. */
const MONTHS_2026 = [1, 2, 3, 4, 5, 6, 7, 8].map((month) =>
  storedMonth(ym(2026, month)),
);

/**
 * Every Saturday of the first quarter of 2026, by the calendar: 1 January 2026
 * is a Thursday, so the Saturdays are the 3rd and each seventh day after it.
 */
const SATURDAYS: Record<number, number[]> = {
  1: [3, 10, 17, 24, 31],
  2: [7, 14, 21, 28],
  3: [7, 14, 21, 28],
};

/**
 * A month in which they rested every week, which is the ordinary month and the
 * one whose gross is the base salary and nothing else.
 *
 * A rest day they *worked* is paid on top (item 5), so a month with none marked
 * free carries four or five extra lines-worth of pay — true of the engine and
 * beside the point of the figure asserted below.
 */
function restingMonth(month: YearMonth): MonthFacts {
  return storedMonth(month, {
    spans: (SATURDAYS[month.month] ?? []).map((day, index) => ({
      id: `rest-${month.month}-${index}`,
      kind: "freeRestDay" as const,
      from: isoOf(month, day),
      to: isoOf(month, day),
    })),
  });
}

/** The first quarter of 2026 with every rest day free, and the months after it
 * as they come. */
const RESTED_2026 = MONTHS_2026.map((month) =>
  month.month.month <= 3 ? restingMonth(month.month) : month,
);

describe("when the national insurance falls due", () => {
  /**
   * Scenario: their first month is January 2026, nothing has been recorded as
   * paid, and today is 10 August 2026.
   *
   * On paper, from item 19: a quarter appears once it has ended and stays until
   * a payment covers it. January–March ended on 31 March and April–June on 30
   * June; July–September has not ended at all. So two quarters are owed and the
   * third is the one running.
   */
  it("names every quarter that has ended with nothing recorded against it", () => {
    const given = answer("nationalInsuranceDue", {
      months: MONTHS_2026,
      today: "2026-08-10",
    });
    if (given.id !== "nationalInsuranceDue") throw new Error("wrong answer");
    expect(given.unpaid.map((one) => one.quarter)).toEqual([
      { from: ym(2026, 1), to: ym(2026, 3) },
      { from: ym(2026, 4), to: ym(2026, 6) },
    ]);
  });

  /**
   * The quarter running now, and when it can first be recorded.
   *
   * On paper: 10 August falls in July–September, which is paid in arrears — so
   * the soonest it can be recorded is October 2026, the month after it closes.
   */
  it("says when the quarter running now can be paid", () => {
    const given = answer("nationalInsuranceDue", {
      months: MONTHS_2026,
      today: "2026-08-10",
    });
    if (given.id !== "nationalInsuranceDue") throw new Error("wrong answer");
    expect(given.next).toEqual({
      quarter: { from: ym(2026, 7), to: ym(2026, 9) },
      payableFrom: ym(2026, 10),
    });
  });

  /**
   * The amount beside each month of an owed quarter.
   *
   * Derived here rather than read back, and the month's own date decides every
   * figure in it (item 4): the minimum wage in force through the first quarter
   * of 2026 is ₪6,247.65 — the 2026 rise takes effect on 1 April — the line is
   * paid as a whole shekel and so ₪6,248 (item 3), every rest day of these
   * three months is free so the gross is that base and nothing else, and the
   * national-insurance percentage in force is 3.6%. ₪224.91, which is ₪225 once
   * it is taken up to the shekel like every other amount.
   *
   * What it would catch: an answer that summed the quarter instead of quoting
   * its months, one that took the percentage on the net rather than the gross,
   * and one that reached for today's rate rather than the one in force in the
   * month — the April 2026 wage applied to a January 2026 month reads as an
   * entirely ordinary figure.
   */
  it("quotes each month's own estimate and sums nothing", () => {
    const given = answer("nationalInsuranceDue", {
      months: RESTED_2026,
      today: "2026-08-10",
    });
    if (given.id !== "nationalInsuranceDue") throw new Error("wrong answer");
    const first = given.unpaid[0];
    expect(first?.months).toEqual([
      { month: ym(2026, 1), estimateAgorot: 22500 },
      { month: ym(2026, 2), estimateAgorot: 22500 },
      { month: ym(2026, 3), estimateAgorot: 22500 },
    ]);
  });

  /**
   * The three months of an owed quarter, added up (the user, 2026-10-10).
   *
   * On paper: each of the three is ₪225, derived above from the wage in force
   * and the percentage in force, so the quarter is ₪675. Nothing is rounded a
   * second time — the months are already whole shekels and a total is the sum
   * of its rounded parts (item 3).
   *
   * What it would catch: a total taken as 3.6% of the quarter's own gross,
   * which rounds differently from three rounded months and would disagree with
   * the three figures printed directly above it.
   */
  it("adds the quarter's months into one figure", () => {
    const given = answer("nationalInsuranceDue", {
      months: RESTED_2026,
      today: "2026-08-10",
    });
    if (given.id !== "nationalInsuranceDue") throw new Error("wrong answer");
    expect(given.unpaid[0]?.totalAgorot).toBe(67500);
  });

  /**
   * **The panel and `/alerts` name the same quarters** (`CLAUDE.md` rule 12).
   *
   * One `actionList` result produces the cards on the opening screen and this
   * answer, so what is asserted is that the answer carries that list's own
   * entries: nothing added, nothing dropped, nothing worked out again.
   *
   * What it would catch: a resolver that recomputed the unpaid quarters from
   * the months — which is where the two would part the day item 19's rule or
   * its lead time changed in one place only.
   */
  it("carries the quarters the action list raised, and no others", () => {
    const today: IsoDate = "2026-08-10";
    const series = seriesOf(MONTHS_2026, today);
    const actions = actionList({
      profile: PROFILE,
      series,
      spans: [],
      rates: SEEDED_RATES,
      today,
    });
    const given = answerFor("nationalInsuranceDue", {
      profile: PROFILE,
      series,
      actions,
      ahead: upcoming({ profile: PROFILE, series, today }),
      today,
    });
    if (given.id !== "nationalInsuranceDue") throw new Error("wrong answer");
    expect(given.unpaid.map((one) => one.quarter)).toEqual(
      actions
        .filter((entry) => entry.key === "nationalInsurance")
        .map((entry) => entry.quarter),
    );
  });

  /** A quarter settled by a payment is not owed, which is the other half of
   * item 19: the payment appears in the month it left the account and carries
   * the months it covers. */
  it("leaves out a quarter a payment covers", () => {
    const paid = MONTHS_2026.map((month) =>
      month.month.month === 4
        ? {
            ...month,
            thirdPartyPayments: [
              {
                kind: "nationalInsurance" as const,
                agorot: 69600,
                paidOn: "2026-04-15" as IsoDate,
                coversMonths: [ym(2026, 1), ym(2026, 2), ym(2026, 3)],
              },
            ],
          }
        : month,
    );
    const given = answer("nationalInsuranceDue", { months: paid, today: "2026-08-10" });
    if (given.id !== "nationalInsuranceDue") throw new Error("wrong answer");
    expect(given.unpaid.map((one) => one.quarter)).toEqual([
      { from: ym(2026, 4), to: ym(2026, 6) },
    ]);
  });
});

describe("when the visa fee falls due", () => {
  /**
   * Scenario: the work visa is in force until 15 October 2026 and today is 10
   * August 2026.
   *
   * On paper, from item 28 and item 15's twelve-month window: the fee is dated
   * off the visa's own expiry, which falls inside the next twelve months, so it
   * is October 2026.
   */
  it("names the month the visa's own expiry falls in", () => {
    const profile = {
      ...PROFILE,
      documents: { ...PROFILE.documents, workVisaExpiry: "2026-10-15" as IsoDate },
    };
    const given = answer("visaFeeDue", {
      months: MONTHS_2026,
      today: "2026-08-10",
      profile,
    });
    if (given.id !== "visaFeeDue") throw new Error("wrong answer");
    expect(given.due).toEqual({
      month: ym(2026, 10),
      expiresOn: "2026-10-15",
      lastPaidAgorot: null,
    });
  });

  /**
   * No expiry stored, which is the ordinary state of a profile whose documents
   * nobody has filled in.
   *
   * What it would catch: an answer that dated the fee off something else — a
   * year from the employment, the permit's expiry, today — all of which would
   * look like a perfectly ordinary answer and none of which the family could
   * check.
   */
  it("says nothing where no expiry is stored", () => {
    const profile = {
      ...PROFILE,
      documents: { ...PROFILE.documents, workVisaExpiry: null },
    };
    const given = answer("visaFeeDue", {
      months: MONTHS_2026,
      today: "2026-08-10",
      profile,
    });
    if (given.id !== "visaFeeDue") throw new Error("wrong answer");
    expect(given.due).toBeNull();
  });
});

describe("what the month pays the worker", () => {
  /**
   * The lines are the engine's own, in its order, and the third-party column is
   * not among them (item 16): money paid to a third party is not part of what
   * reaches the worker, and a family reading it inside their salary would be
   * reading a figure that was never theirs.
   *
   * What it would catch: column H folded into the answer, which is the one
   * mistake here that adds up to a plausible-looking wrong total.
   */
  it("quotes the month's own lines and leaves column H out", () => {
    const months = MONTHS_2026.map((month) =>
      month.month.month === 8
        ? {
            ...month,
            thirdPartyPayments: [
              {
                kind: "medicalInsurance" as const,
                agorot: 15000,
                paidOn: "2026-08-03" as IsoDate,
              },
            ],
          }
        : month,
    );
    const today: IsoDate = "2026-08-20";
    const series = seriesOf(months, today);
    const august = series.at(-1);
    expect(august?.facts.month).toEqual(ym(2026, 8));
    // The engine does draw the payment as a line of its own, which is what
    // makes the exclusion worth asserting.
    expect(august?.result.lines.some((line) => line.column === "H")).toBe(true);

    const given = answerFor("owedThisMonth", {
      profile: PROFILE,
      series,
      actions: [],
      ahead: [],
      today,
    });
    if (given.id !== "owedThisMonth") throw new Error("wrong answer");
    expect(given.month).toEqual(ym(2026, 8));
    expect(given.lines.map((line) => line.key)).toEqual(
      (august?.result.lines ?? [])
        .filter((line) => line.column !== "H")
        .map((line) => line.key),
    );
    expect(given.totalAgorot).toBe(august?.result.net ?? null);
  });

  /**
   * Every line carries the sentence the engine wrote onto it, which is what
   * keeps the answer free of an explanation of its own (item 24).
   *
   * What it would catch: an answer that worded a row itself — the second place
   * an explanation would then live, and the one that would go stale when the
   * engine's own sentence was corrected.
   */
  it("carries each line's own explanation rather than one of its own", () => {
    const today: IsoDate = "2026-08-20";
    const series = seriesOf(MONTHS_2026, today);
    const given = answerFor("owedThisMonth", {
      profile: PROFILE,
      series,
      actions: [],
      ahead: [],
      today,
    });
    if (given.id !== "owedThisMonth") throw new Error("wrong answer");
    const lines = series.at(-1)?.result.lines ?? [];
    for (const line of given.lines) {
      const engine = lines.find((one) => one.key === line.key);
      expect(line.explanation).toBe(engine?.explanation.text);
      expect(line.link).toBe(engine?.explanation.link ?? null);
    }
    expect(given.lines.length).toBeGreaterThan(0);
  });

  /** A worker whose first month has not begun has no month in the replay at
   * all, which is said rather than drawn as an empty salary. */
  it("says there is no month where the replay reached none", () => {
    const given = answer("owedThisMonth", { months: [], today: "2025-12-10" });
    if (given.id !== "owedThisMonth") throw new Error("wrong answer");
    expect(given.month).toBeNull();
    expect(given.lines).toEqual([]);
  });
});

/**
 * What is owed to somebody other than the worker (specs.md item 16).
 *
 * **Where every expected figure comes from** (`CLAUDE.md` rule 11). The
 * quarters are the calendar's, read against item 19's rule that the insurance
 * is paid once a quarter and in arrears. The accrued figure is the one derived
 * at the head of this file — the 2026 minimum wage of ₪6,443.85 paid as ₪6,444
 * (item 3), at the 3.6% in force from January 2025, so ₪232 a month and ₪696 a
 * quarter. The due months are each document's own stored expiry, by item 28.
 * Nothing is read back from what the resolver returned.
 *
 * **What is asserted against the engine's own lists is that they are quoted**:
 * this answer exists to gather `actionList` and `upcoming`, so a quarter or a
 * month it named that those lists did not would be the defect, and a figure
 * recomputed here would prove the opposite of what is wanted (rule 12).
 */
describe("what is owed to a third party", () => {
  /** Jan–Mar and Apr–Jun 2026 have both ended by 10 August; Jul–Sep has not. */
  const Q1 = { from: ym(2026, 1), to: ym(2026, 3) };
  /** ₪225 a month × 3, the figure derived on paper above for the resting
   * months of the first quarter. A month with no rest day marked free is paid
   * for working it (item 5), so its estimate is higher — which is why the one
   * test that asserts this figure is the one built on `RESTED_2026`. */
  const QUARTER_ACCRUED = 67500;

  function owedBy(args: {
    months: MonthFacts[];
    today: IsoDate;
    profile?: WorkerProfile;
  }): Extract<Answer, { id: "thirdPartyDue" }> {
    const given = answer("thirdPartyDue", args);
    if (given.id !== "thirdPartyDue") throw new Error("wrong answer");
    return given;
  }

  /**
   * Scenario: a household that has recorded no third-party payment at all, on
   * 10 April 2026, with every document stored far enough ahead to say nothing
   * and every rest day of the first quarter marked free.
   *
   * On paper: one quarter has ended unrecorded and has put aside ₪675, and the
   * placement fee — paid once for this worker — has never been entered.
   * Nothing else has a date, so nothing else is owed.
   *
   * What it would catch: an answer listing the catalogue of seven kinds rather
   * than what is left to pay, which is the whole of the user's decision of
   * 2026-10-11 and would look entirely reasonable on screen.
   */
  it("names what is left to pay and not the kinds that exist", () => {
    const given = owedBy({ months: RESTED_2026, today: "2026-04-10" });
    expect(given.owed).toEqual([
      {
        kind: "placementFee",
        reason: { why: "neverRecorded" },
        link: "employmentGuide",
      },
      {
        kind: "nationalInsurance",
        reason: { why: "quarterEnded", quarter: Q1, accruedAgorot: QUARTER_ACCRUED },
        link: "nationalInsurance",
      },
    ]);
  });

  /**
   * Scenario: the same household on 10 August 2026, asked what it owes.
   *
   * On paper: every kind the answer can owe now falls on a date the
   * application works out, so the foot of the answer names none. Item 24's
   * rule still stands and is simply satisfied — it is the list that is empty
   * and not the rule that is gone.
   *
   * What it would catch: a kind added to the sheet and left out of
   * `upcoming()`, which would silently stop being named anywhere.
   */
  it("holds a date for every kind it can owe", () => {
    expect(owedBy({ months: MONTHS_2026, today: "2026-08-10" }).undated).toEqual([]);
  });

  /**
   * Scenario: the permit expires 1 June 2027 and the household is asked on
   * 10 August 2026 what it owes.
   *
   * On paper: the permit carries two fees and both fall in its own month
   * (item 15), so the answer owes both for June 2027 — neither summed into the
   * other, and neither dated off the visa, which expires in June 2028 here.
   *
   * What it would catch: the request fee reaching the answer with the visa's
   * month instead of the permit's, which is what item 16 used to say it was and
   * would read as perfectly sensible on screen.
   */
  it("owes both of the permit's fees in the permit's own month", () => {
    const profile = {
      ...PROFILE,
      documents: { ...PROFILE.documents, employmentPermitExpiry: "2027-06-01" as IsoDate },
    };
    const given = owedBy({ months: MONTHS_2026, today: "2026-08-10", profile });
    expect(
      given.owed
        .filter((one) => one.kind === "workerVisa" || one.kind === "licenceFee")
        .map((one) => [one.kind, one.reason]),
    ).toEqual([
      ["workerVisa", { why: "ahead", kind: "workerVisa", month: ym(2027, 6), lastPaidAgorot: null }],
      ["licenceFee", { why: "ahead", kind: "licenceFee", month: ym(2027, 6), lastPaidAgorot: null }],
    ]);
  });

  /** The rows read down a month tab in the template's own order (item 16), so
   * the answer can be held against the sheet without a lookup. */
  it("lists the kinds in the sheet's order", () => {
    const given = owedBy({ months: MONTHS_2026, today: "2026-08-10" });
    expect(given.owed.map((one) => one.kind)).toEqual([
      "placementFee",
      "nationalInsurance",
      "nationalInsurance",
    ]);
  });

  /**
   * Scenario: the work visa expired on 20 May 2026 and today is 10 August 2026.
   *
   * On paper: the fee for extending it is owed now, and `upcoming()` looks
   * forward from this month so it has no entry for a May expiry at all. The
   * lapse is `/alerts`' own entry and is where the answer has to find it.
   *
   * What it would catch: an answer built from `upcoming()` alone, which would
   * quietly stop naming a fee at the moment it became overdue — the one moment
   * the family most needs to be told.
   */
  it("owes the fee for a document that has already lapsed", () => {
    const profile = {
      ...PROFILE,
      documents: { ...PROFILE.documents, workVisaExpiry: "2026-05-20" as IsoDate },
    };
    const today: IsoDate = "2026-08-10";
    const series = seriesOf(MONTHS_2026, today, profile);
    expect(
      upcoming({ profile, series, today }).filter((one) => one.key === "fee"),
    ).toEqual([]);
    expect(
      owedBy({ months: MONTHS_2026, today, profile }).owed.find(
        (one) => one.kind === "visaExtensionFee",
      ),
    ).toEqual({
      kind: "visaExtensionFee",
      reason: {
        why: "lapsed",
        document: "workVisa",
        expiresOn: "2026-05-20",
        lastPaidAgorot: null,
      },
      link: "employmentGuide",
    });
  });

  /**
   * Scenario: the work visa expires on 25 August 2026 and today is 10 August.
   *
   * On paper: that is inside both lists at once — `actionList` warns because it
   * is within sixty days, and `upcoming()` carries it because the month is this
   * one. One kind, so one row.
   *
   * What it would catch: the same fee drawn twice, which a family would read as
   * two payments and which no screen they could check it against shows.
   */
  it("draws one row where both lists speak of one kind", () => {
    const profile = {
      ...PROFILE,
      documents: { ...PROFILE.documents, workVisaExpiry: "2026-08-25" as IsoDate },
    };
    const given = owedBy({ months: MONTHS_2026, today: "2026-08-10", profile });
    const visa = given.owed.filter((one) => one.kind === "visaExtensionFee");
    expect(visa).toHaveLength(1);
    expect(visa[0]?.reason).toEqual({
      why: "ending",
      document: "workVisa",
      expiresOn: "2026-08-25",
      lastPaidAgorot: null,
    });
  });

  /**
   * Scenario: the work visa is in force until 15 October 2026, today is 10
   * August 2026.
   *
   * On paper: October is beyond the sixty-day warning and inside the twelve
   * months ahead, so the fee is still ahead and the month is the visa's own.
   */
  it("carries a fee still ahead in the month the upcoming list gives it", () => {
    const profile = {
      ...PROFILE,
      documents: { ...PROFILE.documents, workVisaExpiry: "2026-10-15" as IsoDate },
    };
    const today: IsoDate = "2026-08-10";
    const series = seriesOf(MONTHS_2026, today, profile);
    const ahead = upcoming({ profile, series, today }).filter(
      (one) => one.key === "fee" && one.kind === "visaExtensionFee",
    );
    const owed = owedBy({ months: MONTHS_2026, today, profile }).owed.find(
      (one) => one.kind === "visaExtensionFee",
    );
    expect(owed?.reason).toEqual({
      why: "ahead",
      kind: "visaExtensionFee",
      month: ym(2026, 10),
      lastPaidAgorot: null,
    });
    // The month is the list's own and not a second reading of the expiry.
    expect(ahead[0]?.key === "fee" ? ahead[0].month : null).toEqual(ym(2026, 10));
  });

  /**
   * Scenario: the medical cover a payment bought ran out on 1 June 2026 and
   * today is 10 August 2026.
   *
   * On paper: the policy has lapsed, and what it cost last time is the
   * ₪3,481.63 the family's own 2026 workbook records for it
   * (`שכר_חודשי_להאנה2026.xlsx` -> `תלוש משכורת חודשי` -> B10) — carried as the
   * figure beside the row so the family knows what the renewal is likely to be.
   */
  it("owes the renewal of cover that has run out, at what it last cost", () => {
    const months = MONTHS_2026.map((month) =>
      month.month.month === 1
        ? {
            ...month,
            thirdPartyPayments: [
              {
                kind: "medicalInsurance" as const,
                agorot: 348163,
                paidOn: "2026-01-05" as IsoDate,
                expiresOn: "2026-06-01" as IsoDate,
              },
            ],
          }
        : month,
    );
    expect(
      owedBy({ months, today: "2026-08-10" }).owed.find(
        (one) => one.kind === "medicalInsurance",
      ),
    ).toEqual({
      kind: "medicalInsurance",
      reason: {
        why: "lapsed",
        document: "medicalInsurance",
        expiresOn: "2026-06-01",
        lastPaidAgorot: 348163,
      },
      link: "medicalInsurance",
    });
  });

  /** A payment made once per worker drops off the moment one is recorded, which
   * is the whole of its rule: the bureau charges it for placing this worker and
   * not again while that employment lasts. */
  it("drops a once-per-worker payment once it is recorded", () => {
    const months = MONTHS_2026.map((month) =>
      month.month.month === 1
        ? {
            ...month,
            thirdPartyPayments: [
              {
                kind: "placementFee" as const,
                agorot: 200000,
                paidOn: "2026-01-09" as IsoDate,
              },
            ],
          }
        : month,
    );
    expect(
      owedBy({ months, today: "2026-08-10" }).owed.map((one) => one.kind),
    ).not.toContain("placementFee");
  });

  /**
   * Scenario: a household in order — both ended quarters recorded, the
   * placement fee entered, cover bought to June 2027, every document far ahead.
   *
   * What it would catch: an answer that always had something to say, which is
   * the failure a list of the seven kinds would produce and which no amount of
   * reading the screen would reveal as wrong.
   */
  it("owes nothing where everything due has been recorded", () => {
    const paid: Record<number, MonthFacts["thirdPartyPayments"]> = {
      1: [
        { kind: "placementFee", agorot: 200000, paidOn: "2026-01-09" },
        {
          kind: "medicalInsurance",
          agorot: 348163,
          paidOn: "2026-01-05",
          expiresOn: "2027-06-01",
        },
      ],
      4: [
        {
          kind: "nationalInsurance",
          agorot: QUARTER_ACCRUED,
          paidOn: "2026-04-15",
          coversMonths: [ym(2026, 1), ym(2026, 2), ym(2026, 3)],
        },
      ],
      7: [
        {
          kind: "nationalInsurance",
          agorot: QUARTER_ACCRUED,
          paidOn: "2026-07-15",
          coversMonths: [ym(2026, 4), ym(2026, 5), ym(2026, 6)],
        },
      ],
    };
    const months = MONTHS_2026.map((month) =>
      paid[month.month.month] === undefined
        ? month
        : { ...month, thirdPartyPayments: paid[month.month.month] ?? [] },
    );
    expect(owedBy({ months, today: "2026-08-10" }).owed).toEqual([]);
  });

  /** The passport is the one document of item 28 whose lapse costs nothing:
   * the employer must see it stays valid, and there is no payment to make when
   * it does not. */
  it("owes nothing for a lapsed passport", () => {
    const profile = {
      ...PROFILE,
      documents: { ...PROFILE.documents, passportExpiry: "2026-03-01" as IsoDate },
    };
    const given = owedBy({ months: MONTHS_2026, today: "2026-08-10", profile });
    expect(given.owed.map((one) => one.kind)).toEqual([
      "placementFee",
      "nationalInsurance",
      "nationalInsurance",
    ]);
  });

  /**
   * The quarters and the months are the engine's own and not a second reading
   * of them (`CLAUDE.md` rule 12): `/alerts` is drawn from `actionList` and
   * `לקראת החודשים הבאים` from `upcoming`, and this answer may only gather what
   * they already say.
   */
  it("quotes the action list and the upcoming list rather than walking again", () => {
    const profile = {
      ...PROFILE,
      documents: { ...PROFILE.documents, workVisaExpiry: "2026-12-10" as IsoDate },
    };
    const today: IsoDate = "2026-08-10";
    const series = seriesOf(MONTHS_2026, today, profile);
    const actions = actionList({
      profile,
      series,
      spans: [],
      rates: SEEDED_RATES,
      today,
    });
    const ahead = upcoming({ profile, series, today });
    const given = answerFor("thirdPartyDue", { profile, series, actions, ahead, today });
    if (given.id !== "thirdPartyDue") throw new Error("wrong answer");

    expect(
      given.owed.flatMap((one) =>
        one.reason.why === "quarterEnded" ? [one.reason.quarter] : [],
      ),
    ).toEqual(
      actions.flatMap((entry) =>
        entry.key === "nationalInsurance" ? [entry.quarter] : [],
      ),
    );
    expect(
      given.owed.flatMap((one) => (one.reason.why === "ahead" ? [one.reason.month] : [])),
    ).toEqual(ahead.flatMap((entry) => (entry.key === "fee" ? [entry.month] : [])));
  });
});
