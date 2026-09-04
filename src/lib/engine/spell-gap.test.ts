import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { daysUsedIn } from "@/lib/engine/balances";
import { holidayDaysOf } from "@/lib/engine/leave";
import { calculateMonth, lineKeys } from "@/lib/engine/month";
import { spellsOf } from "@/lib/engine/sick";
import { snapshotTerms } from "@/lib/engine/types";
import type {
  ClosedMonthFacts,
  ClosedSpan,
  WorkerTerms,
} from "@/lib/engine/types";
import type { YearMonth } from "@/lib/types";

/**
 * **A spell ends on the first *working* day no sickness was reported**
 * (`specs.md` item 8), so days she owed no attendance sit inside the period
 * rather than breaking it.
 *
 * **Where the rule comes from.** Kol Zchut's *חישוב דמי מחלה לעובד במשכורת
 * חודשית*: "עובד במשכורת חודשית תקופת מחלתו הינה כל ימי מחלתו, לרבות ימי מנוחה
 * שבועית", citing ד"מ 48713-10-17, in which counting "ימי המחלה הקלנדריים"
 * rather than only the days actually worked was held to be no defect. The same
 * page says those days are deducted from the accrued quota, which is the second
 * half of the rule and the one the balance assertions below are about.
 *
 * **Where each expected figure comes from.** Item 8's tiers turned into agorot
 * at `S / 25`, with the arithmetic shown beside each assertion. None is read
 * back from what the engine returned — there is no workbook month with a broken
 * spell in it, which is exactly the condition `CLAUDE.md` names for deriving on
 * paper first.
 *
 *   S = ₪6,247.65 = 624,765 agorot     the August 2025 wage (Part 4)
 *   a sick day = S / 25 = 24,990.6     item 8
 *
 *   two days deducted   2   × 24,990.6 = 49,981.2  -> 49,981 agorot
 *   one and a half      1.5 × 24,990.6 = 37,485.9  -> 37,486 agorot
 *
 * August 2025 read off the calendar: Fri 1, Sat 2, Sun 3 ... Fri 8, Sat 9,
 * Sun 10, Mon 11, Tue 12, Wed 13, Thu 14 ... and Saturdays on 2, 9, 16, 23, 30.
 */

const SALARY = 624765;
const AUGUST_2025: YearMonth = { year: 2025, month: 8 };

const sick = (from: string, to = from): ClosedSpan => ({
  id: `sick-${from}-${to}`,
  kind: "sick",
  from,
  to,
});

const holiday = (date: string, worked: boolean): ClosedSpan => ({
  id: `hol-${date}`,
  kind: "holiday",
  from: date,
  to: date,
  worked,
});

const vacation = (date: string): ClosedSpan => ({
  id: `vac-${date}`,
  kind: "vacation",
  from: date,
  to: date,
});

/** A standing sick balance well clear of the floor, so the refusal of item 8
 * never fires in a test about the spell — it would hide the figure being
 * checked, and the floor has its own tests in `balances.test.ts`. */
const worker: WorkerTerms = {
  employedSince: "2024-04-01",
  baseMonthlySalaryAgorot: SALARY,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  standingLines: [],
  country: "PH",
  openingPosition: { vacationDays: 10, sickDays: 43.5, advances: [] },
};

function facts(spans: ClosedSpan[]): ClosedMonthFacts {
  return {
    month: AUGUST_2025,
    terms: snapshotTerms(worker),
    confirmedWage: {
      baseAgorot: SALARY,
      minimumAgorot: SALARY,
      effectiveFrom: "2025-04-01",
    },
    spans,
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}

function deduction(spans: ClosedSpan[]) {
  return calculateMonth(facts(spans), worker).lines.find(
    (line) => line.key === lineKeys.sickDeduction,
  )?.amount;
}

function sickDrawn(spans: ClosedSpan[]) {
  return daysUsedIn(spans, AUGUST_2025, "sick", SATURDAY);
}

describe("the weekly rest day sits inside the period, not across its break", () => {
  // Friday the 8th and Sunday the 10th reported, Saturday the 9th left alone —
  // which is how a family records an illness, by marking the days she was
  // absent from work.
  const marked = [sick("2025-08-08"), sick("2025-08-10")];

  it("reads the two marks as one spell running through the Saturday", () => {
    expect(spellsOf(marked, SATURDAY)).toEqual([
      { from: "2025-08-08", to: "2025-08-10" },
    ]);
  });

  it("prices the Sunday as the spell's third day and not as a first", () => {
    // Fri 8 is day 1 and pays nothing, so a full day is taken back.
    // Sat 9 is day 2 and is a rest day: outside the standard count, never paid
    //        for, so nothing is taken back for it — but it still advances the
    //        position, which is what makes the Sunday the third day.
    // Sun 10 is day 3 and pays half, so half a day is taken back.
    // 1 + 0 + 0.5 = 1.5 days -> 1.5 × 24,990.6 = 37,485.9 -> 37,486.
    expect(deduction(marked)).toBe(-37486);
  });

  it("draws the unmarked Saturday from the balance too", () => {
    // "ולכן ימים אלו מנוכים מהמכסה הצבורה" — the days of the period are deducted
    // from the accrued quota, whether or not anybody marked them.
    expect(sickDrawn(marked)).toBe(3);
  });

  it("costs exactly what the same three days swept in one gesture cost", () => {
    // The property the rule exists for: what she drew and what she was paid stop
    // depending on how the days happened to be entered.
    const swept = [sick("2025-08-08", "2025-08-10")];
    expect(spellsOf(marked, SATURDAY)).toEqual(spellsOf(swept, SATURDAY));
    expect(deduction(marked)).toBe(deduction(swept));
    expect(sickDrawn(marked)).toBe(sickDrawn(swept));
  });

  it("still ends the spell on a working day nobody reported", () => {
    // Wednesday the 6th is a day she owed attendance on, so it ends the spell
    // and the tiers restart on the 7th — two firsts, two full days taken back.
    // 1 + 1 = 2 days -> 2 × 24,990.6 = 49,981.2 -> 49,981.
    const broken = [sick("2025-08-05"), sick("2025-08-07")];
    expect(spellsOf(broken, SATURDAY)).toHaveLength(2);
    expect(deduction(broken)).toBe(-49981);
    expect(sickDrawn(broken)).toBe(2);
  });
});

describe("a holiday she did not work sits inside the period", () => {
  // Monday the 11th and Wednesday the 13th reported, Tuesday the 12th a holiday
  // she did not work. None of the three is a Saturday.
  const marked = [sick("2025-08-11"), sick("2025-08-13")];

  it("reads the two marks as one spell through the holiday", () => {
    const spans = [...marked, holiday("2025-08-12", false)];
    expect(spellsOf(spans, SATURDAY)).toEqual([
      { from: "2025-08-11", to: "2025-08-13" },
    ]);
  });

  it("prices the holiday as an ordinary day of the spell", () => {
    // Mon 11 is day 1 -> 1 taken back.
    // Tue 12 is day 2. It is *not* a rest day, so it stands inside the standard
    //        count and the base paid for it; the tier gives half, so half is
    //        taken back. This is where it differs from a Saturday.
    // Wed 13 is day 3 -> 0.5 taken back.
    // 1 + 0.5 + 0.5 = 2 days -> 49,981.
    expect(deduction([...marked, holiday("2025-08-12", false)])).toBe(-49981);
  });

  it("draws it from the sick balance and not from the yearly holiday allowance", () => {
    // A day cannot be both taken as a holiday and spent ill, and drawing it from
    // both quotas would charge her twice for one day (item 10). The entitlement
    // is not lost — the holiday is the one of the two that can be moved.
    const spans = [...marked, holiday("2025-08-12", false)];
    expect(sickDrawn(spans)).toBe(3);
    expect(holidayDaysOf(spans, SATURDAY)).toBe(0);
  });

  it("does not bridge a holiday she worked, because she was at work", () => {
    // Two spells, so the balance draws only the two days marked, and the holiday
    // is drawn from the yearly allowance as usual.
    const spans = [...marked, holiday("2025-08-12", true)];
    expect(spellsOf(spans, SATURDAY)).toHaveLength(2);
    expect(sickDrawn(spans)).toBe(2);
    expect(holidayDaysOf(spans, SATURDAY)).toBe(1);
  });

  it("leaves a holiday outside any spell alone", () => {
    // The exclusion is "inside a spell" and nothing wider: a holiday in a month
    // with sickness elsewhere in it is still a holiday.
    const spans = [sick("2025-08-04"), holiday("2025-08-12", false)];
    expect(holidayDaysOf(spans, SATURDAY)).toBe(1);
  });
});

describe("a vacation day between two reported days breaks the spell", () => {
  it("reads them as two illnesses, because one day cannot be both", () => {
    // Settled, and not a balance of arguments (specs.md item 8): illness during
    // a vacation converts the day into a sick day and draws only the rest from
    // the vacation quota, so a day still recorded as vacation is a day she was
    // not ill on. The rest day and the unworked holiday sit inside a spell
    // because they contradict nothing; a vacation day would contradict itself.
    const spans = [sick("2025-08-11"), vacation("2025-08-12"), sick("2025-08-13")];
    expect(spellsOf(spans, SATURDAY)).toHaveLength(2);
    expect(sickDrawn(spans)).toBe(2);
    expect(daysUsedIn(spans, AUGUST_2025, "vacation", SATURDAY)).toBe(1);
  });
});

describe("the bridge does not swallow an interval of any length", () => {
  it("breaks over the working days between two distant illnesses", () => {
    // The 8th and the 18th, ten days apart, with seven working days between
    // them. Two illnesses, and the second starts again at nothing.
    const distant = [sick("2025-08-08"), sick("2025-08-18")];
    expect(spellsOf(distant, SATURDAY)).toHaveLength(2);
    expect(sickDrawn(distant)).toBe(2);
  });

  it("bridges a rest day at each end of a run it reaches across", () => {
    // Friday the 8th, then Sunday the 10th to Monday the 11th: one spell of
    // four days, 8 through 11, and the Saturday is inside it.
    const spans = [sick("2025-08-08"), sick("2025-08-10", "2025-08-11")];
    expect(spellsOf(spans, SATURDAY)).toEqual([
      { from: "2025-08-08", to: "2025-08-11" },
    ]);
    // Day 1 Fri -> 1, day 2 Sat -> 0, day 3 Sun -> 0.5, day 4 Mon -> 0.
    // 1.5 days -> 37,486, and four days drawn from the balance.
    expect(deduction(spans)).toBe(-37486);
    expect(sickDrawn(spans)).toBe(4);
  });
});
