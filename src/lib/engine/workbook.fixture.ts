import { SATURDAY } from "@/lib/dates";
import { snapshotTerms } from "@/lib/engine/types";
import type { MonthFacts, MonthSpan, WorkerTerms } from "@/lib/engine/types";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * Months taken from the family's own workbooks, so the engine is checked
 * against arithmetic somebody else did.
 *
 * `CLAUDE.md` requires a test's expected figure to come from `specs.md`, the
 * workbook or the statute and never from what the engine returned. Part 4 gives
 * one such month — August 2025 — and one month cannot distinguish a rule from a
 * coincidence: every figure in it is a single wage, a single rest day and a
 * single count. What is here is the other thirty-five tabs read the same way,
 * of which fifteen are recorded below.
 *
 * **Provenance.** The three workbooks are `שכר_חודשי_להאנה2024.xlsx`,
 * `…2025.xlsx` and `…2026.xlsx`, each holding twelve month tabs named
 * `חודש  N.YY`. Cells are named per `CLAUDE.md` rule 6 — workbook, tab, cell —
 * and never by a bare row number, because the rows move between years: the
 * total sits at `A26` in the 2025 tabs and at `A27` in `חודש  12.24`, which
 * carries an extra row for a rest day settled from the month before.
 *
 * The figures below come from these cells of each month tab:
 *
 *   `F2`  rest-eves worked            `G2`  rest days worked
 *   `G3`  the free rest day's date    `H3`  the holiday dates
 *   `D6`  the base monthly salary     `E23` column E's subtotal
 *   `F24` column F's subtotal         `E26` the ברוטו
 *   `E29` the figure actually paid    the closing block, for the advances
 *
 * **Every month here was checked to be a month the workbook gets right.** Three
 * kinds of tab are deliberately absent, and their absence is the point:
 *
 *  - **2024 entirely**, from the money tests. Its rest-day rate is `D9` =
 *    ₪401.25 where the salary implies ₪401.26 — the workbook rounded the hourly
 *    part before multiplying, which is the mistake `CLAUDE.md` forbids by
 *    requiring full precision through a calculation. `workbook-rates.test.ts`
 *    asserts the divergence rather than the sheet, so it is recorded once and
 *    cannot quietly become the expected value.
 *  - **`חודש  11.24` and `חודש  12.24`**, which pay a vacation day *and* reduce
 *    the base. `specs.md` item 7 rejects that style outright; they are used in
 *    `workbook-vacation.test.ts` as the shape the engine must not produce.
 *  - **`חודש  3.25` and `חודש  3.26`**, which carry a recuperation payment in
 *    column G. The engine emits that line from `recuperation.ts` since stage
 *    5's step 6, and the **day counts** those two tabs pay — five and six — are
 *    what `recuperation.test.ts` checks itself against. What is still missing
 *    is the **rate** the family valued them at, which was not read out of the
 *    tabs, so their ברוטו remains a figure this suite cannot reach and neither
 *    month is listed below for its money; `3.26` appears for its advances
 *    alone.
 *
 * A fourth thing found in the reading is recorded here rather than tested,
 * because it is a fact about the family's sheet and not about the engine: the
 * 2025 tabs pay **ten** holidays across the year (`H2` of 4–12/25, summing to
 * 10) against the nine-day entitlement of item 10. So no test in this suite
 * replays a whole calendar year of 2025 — the engine would refuse the tenth, and
 * refusing it is correct.
 */

/** One month tab, reduced to what the engine needs and what it should produce. */
export interface WorkbookMonth {
  /** The tab, as `CLAUDE.md` rule 6 asks it to be named. */
  tab: string;
  month: YearMonth;
  /** `D6` — the base monthly salary the month was valued at. */
  salaryAgorot: number;
  /** `G3`. Empty where she worked every rest day. */
  freeRestDays: IsoDate[];
  /** `H3`. Every holiday in these months was worked, which is why each one
   * reaches column F: a holiday she takes off earns nothing extra (item 9). */
  holidaysWorked: IsoDate[];
  /** `E23` — the base plus the rest-eve supplement. */
  subtotalE: number;
  /** `F24` — the rest days and the holidays, both at the rest-day rate. */
  subtotalF: number;
  /** `E26` — the ברוטו, and `E29` — what the family actually transferred. */
  gross: number;
  net: number;
  /** The closing block, in the workbook's own numbering (item 20). */
  advances: { number: number; kind: "granted" | "repaid"; agorot: number }[];
  /** `F2` and `G2`, carried so a test can assert the counts the engine derives
   * from the calendar against the counts the family wrote down by hand. */
  restEvesWorked: number;
  restDaysWorked: number;
}

/**
 * The 2025 minimum wage, in force from 1.4.2025 (`D6` of every tab from
 * `חודש  4.25` to `חודש  3.26`).
 */
export const WAGE_2025 = 624765;

/**
 * The 2026 minimum wage, in force from 1.4.2026 (`D6` of `חודש  4.26` onward).
 * The rise lands in April and not in January, which is why `חודש  3.26` is still
 * valued at the 2025 figure — a month is valued at the rate in force during it
 * (`specs.md` item 4), and a table keyed by calendar year would get that wrong.
 */
export const WAGE_2026 = 644385;

/** ₪100 a rest-eve. `D7` of every tab, unchanged across all three workbooks. */
export const REST_EVE_SUPPLEMENT = 10000;

export const WORKBOOK_MONTHS: WorkbookMonth[] = [
  {
    tab: "חודש  4.25",
    month: { year: 2025, month: 4 },
    salaryAgorot: WAGE_2025,
    freeRestDays: ["2025-04-19"],
    holidaysWorked: ["2025-04-09"],
    subtotalE: 664765,
    subtotalF: 170540,
    gross: 835305,
    net: 635305,
    advances: [{ number: 1, kind: "repaid", agorot: 200000 }],
    restEvesWorked: 4,
    restDaysWorked: 3,
  },
  {
    tab: "חודש  5.25",
    month: { year: 2025, month: 5 },
    salaryAgorot: WAGE_2025,
    // `G3` reads "9/5/25", which is a Friday — the rest day of that weekend is
    // the 10th. Which Saturday was free changes no figure here, since every
    // rest day pays the same rate, but the date is written down as read rather
    // than silently corrected.
    freeRestDays: ["2025-05-10"],
    holidaysWorked: ["2025-05-01"],
    subtotalE: 674765,
    subtotalF: 213175,
    gross: 887940,
    net: 687940,
    advances: [{ number: 1, kind: "repaid", agorot: 200000 }],
    restEvesWorked: 5,
    restDaysWorked: 4,
  },
  {
    tab: "חודש  6.25",
    month: { year: 2025, month: 6 },
    salaryAgorot: WAGE_2025,
    freeRestDays: [], // `G3`: "לא לקחה חופשה"
    holidaysWorked: ["2025-06-12"],
    subtotalE: 664765,
    subtotalF: 213175,
    gross: 877940,
    net: 677940,
    advances: [{ number: 1, kind: "repaid", agorot: 200000 }],
    restEvesWorked: 4,
    restDaysWorked: 4,
  },
  {
    tab: "חודש  7.25",
    month: { year: 2025, month: 7 },
    salaryAgorot: WAGE_2025,
    freeRestDays: ["2025-07-19"],
    holidaysWorked: ["2025-07-27"],
    subtotalE: 664765,
    subtotalF: 170540,
    gross: 835305,
    net: 635305,
    advances: [{ number: 1, kind: "repaid", agorot: 200000 }],
    restEvesWorked: 4,
    restDaysWorked: 3,
  },
  {
    // Part 4's own month, carried here too so the suite that walks every month
    // walks the one the specification states outright as well.
    tab: "חודש  8.25",
    month: { year: 2025, month: 8 },
    salaryAgorot: WAGE_2025,
    freeRestDays: ["2025-08-16"],
    holidaysWorked: ["2025-08-19", "2025-08-21"],
    subtotalE: 674765,
    subtotalF: 255810,
    gross: 930575,
    net: 730575,
    advances: [{ number: 1, kind: "repaid", agorot: 200000 }],
    restEvesWorked: 5,
    restDaysWorked: 4,
  },
  {
    tab: "חודש  9.25",
    month: { year: 2025, month: 9 },
    salaryAgorot: WAGE_2025,
    freeRestDays: ["2025-09-13"],
    holidaysWorked: ["2025-09-09"],
    subtotalE: 664765,
    subtotalF: 170540,
    gross: 835305,
    net: 685305,
    advances: [{ number: 2, kind: "repaid", agorot: 150000 }],
    restEvesWorked: 4,
    restDaysWorked: 3,
  },
  {
    tab: "חודש  10.25",
    month: { year: 2025, month: 10 },
    salaryAgorot: WAGE_2025,
    freeRestDays: ["2025-10-11"],
    holidaysWorked: [],
    subtotalE: 674765,
    subtotalF: 127905,
    gross: 802670,
    net: 652670,
    advances: [{ number: 2, kind: "repaid", agorot: 150000 }],
    restEvesWorked: 5,
    restDaysWorked: 3,
  },
  {
    // An advance granted and none repaid: `E27` = ₪4,000 above a ברוטו of
    // ₪8,779.40, giving `E29` = ₪12,779.40. The transfer is larger than the
    // month, which is the shape a granted advance has and the one a sign error
    // would invert.
    tab: "חודש  11.25",
    month: { year: 2025, month: 11 },
    salaryAgorot: WAGE_2025,
    freeRestDays: ["2025-11-08"],
    holidaysWorked: ["2025-11-30"],
    subtotalE: 664765,
    subtotalF: 213175,
    gross: 877940,
    net: 1277940,
    advances: [{ number: 3, kind: "granted", agorot: 400000 }],
    restEvesWorked: 4,
    restDaysWorked: 4,
  },
  {
    tab: "חודש  12.25",
    month: { year: 2025, month: 12 },
    salaryAgorot: WAGE_2025,
    freeRestDays: [], // `G3`: "לא ניצלה אף שבת"
    holidaysWorked: ["2025-12-24", "2025-12-25"],
    subtotalE: 664765,
    subtotalF: 255810,
    gross: 920575,
    net: 820575,
    advances: [{ number: 3, kind: "repaid", agorot: 100000 }],
    restEvesWorked: 4,
    restDaysWorked: 4,
  },
  {
    tab: "חודש  1.26",
    month: { year: 2026, month: 1 },
    salaryAgorot: WAGE_2025,
    freeRestDays: ["2026-01-10"],
    holidaysWorked: ["2026-01-01"],
    subtotalE: 674765,
    subtotalF: 213175,
    gross: 887940,
    net: 787940,
    advances: [{ number: 3, kind: "repaid", agorot: 100000 }],
    restEvesWorked: 5,
    restDaysWorked: 4,
  },
  {
    // The month that grants one advance and repays another (item 20). `E27`
    // adds ₪5,000 for advance 2 and `E30` takes ₪1,000 off for advance 1, so
    // ₪8,779.40 becomes ₪12,779.40. A single netted movement of ₪4,000 would
    // reach the same transfer and lose which advance owes what.
    tab: "חודש  2.26",
    month: { year: 2026, month: 2 },
    salaryAgorot: WAGE_2025,
    freeRestDays: ["2026-02-07"],
    holidaysWorked: ["2026-02-17", "2026-02-25"],
    subtotalE: 664765,
    subtotalF: 213175,
    gross: 877940,
    net: 1277940,
    advances: [
      { number: 4, kind: "granted", agorot: 500000 },
      { number: 3, kind: "repaid", agorot: 100000 },
    ],
    restEvesWorked: 4,
    restDaysWorked: 3,
  },
  {
    tab: "חודש  4.26",
    month: { year: 2026, month: 4 },
    salaryAgorot: WAGE_2026,
    freeRestDays: [],
    holidaysWorked: ["2026-04-09"],
    subtotalE: 684385,
    subtotalF: 219870,
    gross: 904255,
    net: 704255,
    advances: [{ number: 4, kind: "repaid", agorot: 200000 }],
    restEvesWorked: 4,
    restDaysWorked: 4,
  },
  {
    // Five rest days and five rest-eves in one month, at the 2026 wage: the
    // month that would catch a rest-day count read off a fixed four.
    tab: "חודש  5.26",
    month: { year: 2026, month: 5 },
    salaryAgorot: WAGE_2026,
    freeRestDays: [],
    holidaysWorked: ["2026-05-27"],
    subtotalE: 694385,
    subtotalF: 263844,
    gross: 958229,
    net: 858229,
    advances: [{ number: 4, kind: "repaid", agorot: 100000 }],
    restEvesWorked: 5,
    restDaysWorked: 5,
  },
  {
    tab: "חודש  6.26",
    month: { year: 2026, month: 6 },
    salaryAgorot: WAGE_2026,
    freeRestDays: [],
    holidaysWorked: ["2026-06-24"],
    subtotalE: 684385,
    subtotalF: 219870,
    gross: 904255,
    net: 804255,
    advances: [{ number: 4, kind: "repaid", agorot: 100000 }],
    restEvesWorked: 4,
    restDaysWorked: 4,
  },
  {
    // A ₪10,000 advance granted, and no holiday at all — the month that would
    // catch a holiday line emitted from an empty list.
    tab: "חודש  7.26",
    month: { year: 2026, month: 7 },
    salaryAgorot: WAGE_2026,
    freeRestDays: ["2026-07-11"],
    holidaysWorked: [],
    subtotalE: 694385,
    subtotalF: 131922,
    gross: 826307,
    net: 1826307,
    advances: [{ number: 5, kind: "granted", agorot: 1000000 }],
    restEvesWorked: 5,
    restDaysWorked: 3,
  },
];

/** Hanna, as the three workbooks describe her: `C4` of every tab gives
 * "התחלת עבודה:  1.4.2024", and she rests on Saturday, so her rest-eve is
 * Friday. The recuperation month is March, which is where the payment actually
 * falls — `חודש  3.25` pays five days and `חודש  3.26` six — and not the July
 * the non-workbook fixtures happen to use. */
export function workbookWorker(salaryAgorot: number): WorkerTerms {
  return {
    employedSince: "2024-04-01",
    baseMonthlySalaryAgorot: salaryAgorot,
    restDay: SATURDAY,
    restEveSupplementAgorot: REST_EVE_SUPPLEMENT,
    recuperationMonth: 3,
    standingLines: [],
    country: "PH",
    openingPosition: { vacationDays: 0, sickDays: 0, advances: [] },
  };
}

/**
 * A month tab as the engine's facts.
 *
 * The advances are carried but the opening position is not: what each advance's
 * principal was is a fact about the whole employment, and a suite that checked
 * one month at a time would have to invent one. `workbook-advances.test.ts`
 * supplies the principals it needs, from the notes in `B28`/`B29` that state
 * them.
 */
export function workbookFacts(
  m: WorkbookMonth,
  worker: WorkerTerms = workbookWorker(m.salaryAgorot),
): MonthFacts {
  const spans: MonthSpan[] = [
    ...m.freeRestDays.map((date) => ({
      id: `free-${date}`,
      kind: "freeRestDay" as const,
      from: date,
      to: date,
    })),
    ...m.holidaysWorked.map((date) => ({
      id: `hol-${date}`,
      kind: "holiday" as const,
      from: date,
      to: date,
      worked: true,
    })),
  ];

  return {
    month: m.month,
    terms: snapshotTerms(worker),
    confirmedWage: {
      baseAgorot: m.salaryAgorot,
      minimumAgorot: m.salaryAgorot,
      effectiveFrom: m.salaryAgorot === WAGE_2026 ? "2026-04-01" : "2025-04-01",
    },
    spans,
    advances: m.advances.map((a) => ({
      number: a.number,
      kind: a.kind,
      agorot: a.agorot,
    })),
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
  };
}
