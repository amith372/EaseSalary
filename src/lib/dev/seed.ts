import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import { SATURDAY } from "@/lib/dates";
import type { MonthRecord, WorkerProfile } from "@/lib/engine/repository";
import { snapshotTerms} from "@/lib/engine/types";
import type { MonthSpan } from "@/lib/engine/types";
import {
  REST_EVE_SUPPLEMENT,
  WAGE_2025,
  WAGE_2026,
  WORKBOOK_MONTHS,
} from "@/lib/engine/workbook.fixture";
import { he } from "@/lib/i18n/he";
import type { YearMonth } from "@/lib/types";

/**
 * The household the application opens on: two workers, and the days that
 * departed from an ordinary month in each.
 *
 * **The two answer two different questions, and that division is the whole
 * shape of this file**.
 *
 * **The first worker is Hanna, and they are not a demo — they are the family's own
 * workbooks.** Every month of theirs is assembled from a tab of
 * `שכר_חודשי_להאנה2025.xlsx` or `…2026.xlsx`, so a person can open a month on
 * screen and hold it against the tab it came from, figure for figure.
 * `seed-against-workbooks.test.ts` asserts exactly that for all fourteen of
 * them and is what stops this drifting into something else the next time
 * somebody needs a convenient month. Nothing is invented onto them: no advance
 * the family did not move, no line nobody wrote, no tax the workbooks do not
 * withhold.
 *
 * **The second worker is the one the browser suite works on**, and they are
 * therefore deliberately *ordinary* — Saturday, ₪100 a rest-eve, the tax worked
 * out automatically — because a test whose subject is unusual tests the unusual
 * case twice and the ordinary one never. Everything awkward is on their months
 * instead: an advance given and repaid over three, a line placed before the
 * total and another after it, a tax corrected by hand, a payment to a third
 * party, a spell of sickness across a month boundary, and a quarter of national
 * insurance settled in the month it left the account.
 *
 * **What this file may and may not be read as.** Hanna's months are checked
 * against the workbooks and may be quoted; the second worker's are invented and
 * prove nothing on their own — they are shapes to exercise, not figures to
 * cite.
 *
 * **The opening position is given rather than derived, and item 6 is why.** The
 * days already accrued when the application took over an employment already
 * running do not originate inside it at all: the family states them once.
 * Hanna's come from the `חישוב ימי מחלה וחופשה` tab of the 2025 workbook, at
 * the month their seeded history begins.
 *
 * **No spell is left open here on purpose.** An open spell goes on drawing sick
 * days from the balance for as long as nobody closes it (item 8), so a seed
 * carrying one drifts with the real clock and eventually exhausts a balance
 * that was fine on the day it was written — a store that begins failing on a
 * date nobody chose. The gesture that opens one is the calendar's.
 */

/** The months the store opens with: 2026, whose workbook is the canonical
 * layout reference. Nine of them, so the balance chain has something to walk. */
const SEEDED_MONTHS: YearMonth[] = Array.from({ length: 9 }, (_, index) => ({
  year: 2026,
  month: index + 1,
}));

/**
 * **Hanna, exactly as the family's own workbooks describe them** — so the demo
 * can be held against `שכר_חודשי_להאנה2025.xlsx` and `…2026.xlsx` tab by tab.
 *
 * Every field below is read off those files and none is invented: `B3` gives
 * their name, `C4` gives `התחלת עבודה: 1.4.2024`, `D7` gives the ₪100 rest-eve
 * supplement, and `B18` of `חודש 8.25` says the recuperation for their second
 * year is paid in `3/26`. **`E20`, the income-tax row, is empty in every tab of
 * both workbooks**, which is a decision the family made once and not a zero
 * typed twelve times — so they are set to `none` (specs.md item 17).
 *
 * **The opening position is the workbook's own balances at 1 May 2025**, read
 * from the `חישוב ימי מחלה וחופשה` tab: `B25` is 4.676666… vacation days and
 * `B8` is 19.5 sick days. Starting there rather than at zero is item 6's whole
 * point, and it is what lets the balances the application draws be compared
 * against column `F` of that tab.
 *
 * **The two advances the family moved outside the salary sheet are opening
 * advances.** `D28` of `חודש 4.25` records ₪10,000 transferred on 21.4.25 and
 * `B27` of `חודש 9.25` records ₪3,000 transferred on 6.9.25 — both by bank
 * transfer, and neither appears as a row that raises a month's transfer. Only
 * the repayments do. Recording them as grants instead would add ₪3,000 to the
 * September the family filed at ₪6,853.05, which is precisely the disagreement
 * this seed exists to avoid. The advances the workbook *does* put on a sheet —
 * `11.25`, `2.26` and `7.26` — are recorded as grants, because there they
 * genuinely raise the transfer.
 */
const firstWorker: WorkerProfile = {
  id: "worker-1",
  // `I10` of `שכר_חודשי_להאנה2026.xlsx` names it, and this worker exists to
  // replay those tabs: a demo whose medical-insurance row read "[חברת הביטוח]"
  // could not be held against the sheet it is drawn from. It is the insurer and
  // the health fund and no household's own detail — the template is where such
  // a name may never live (Part 3).
  insurer: "קופ\"ח כללית במסגרת חברת הראל",
  // `B3` of every tab. The workbook's own figures are already pseudonymous —
  // the passport reads `P2222222B` and the account `11111111` — so this is the
  // family's test data and not a real worker's identity.
  name: "האנה מונטנה Hanna Montana",
  firstName: "האנה",
  employedSince: "2024-04-01",
  // The seeded months begin in May 2025 (`WORKBOOK_SEED_MONTHS`).
  firstMonth: { year: 2025, month: 5 },
  gender: "female",
  baseMonthlySalaryAgorot: WAGE_2025,
  restDay: SATURDAY,
  restEveSupplementAgorot: REST_EVE_SUPPLEMENT,
  recuperationMonth: 3,
  incomeTax: { mode: "none" },
  standingLines: [],
  country: "PH",
  openingPosition: {
    vacationDays: 4.676666666666667,
    sickDays: 19.5,
    vacationUsedThisYear: 0,
    holidayUsedThisYear: 0,
    recuperationPaidIn: null,
    advances: [
      // ₪10,000 of 21.4.25. April's own ₪2,000 instalment is already off it,
      // because the seeded months begin in May — see `WORKBOOK_SEED_MONTHS`.
      { number: 1, principalAgorot: 1000000, repaidAgorot: 200000 },
      // ₪3,000 of 6.9.25, repaid ₪1,500 in each of September and October.
      { number: 2, principalAgorot: 300000, repaidAgorot: 0 },
    ],
  },
  // **The three expiry dates are the one thing here the workbooks do not
  // give**, so they stay as they were: invented dates that give item 27's bell
  // something to find. The numbers themselves are not held at all — they are
  // encrypted at rest and there is no database yet (item 28).
  documents: {
    employmentPermitExpiry: "2026-11-30",
    workVisaExpiry: "2027-03-31",
    passportExpiry: "2029-06-30",
  },
};

/**
 * **The second worker is the one the suite works on**: the worker from India is
 * for testing, the worker from the Philippines carries the workbooks.
 *
 * They therefore carry the *ordinary* terms — Saturday, ₪100 a rest-eve, the
 * tax worked out automatically — because those are the terms every browser test
 * derives its figures from, and a test whose subject is unusual tests the
 * unusual case twice and the ordinary one never. Everything genuinely awkward
 * about a month is on their *months* rather than their terms: an advance given and
 * repaid, a line the user wrote before the total and another after it, a tax
 * corrected by hand, a payment to a third party, and a spell of sickness across
 * a month boundary.
 *
 * **They rests on Saturday and their tax is calculated.** A Friday rest day and a
 * flat rate are *set* by the tests that care about them —
 * `worker-profile.spec.ts` moves their rest day and watches the calendar follow,
 * and `income-tax.spec.ts` switches them to each of the three modes in turn —
 * which proves the change works and not merely that a seeded value is
 * displayed.
 */
const secondWorker: WorkerProfile = {
  id: "worker-2",
  insurer: he.placeholder.insurer,
  name: "[שם העובד/ת השני/ה]",
  firstName: he.placeholder.name,
  // The same start as Hanna's, and for a reason rather than by copying: the
  // recuperation payment is owed only after a full employment year (item 15),
  // so a worker who began in September 2025 has no entitlement to show in 2026
  // at all — and the tests that check the payment, the day count and the rate
  // would each be checking an absence.
  employedSince: "2024-04-01",
  // Their months begin in January 2026 (`SEEDED_MONTHS`).
  firstMonth: { year: 2026, month: 1 },
  gender: "female",
  baseMonthlySalaryAgorot: WAGE_2025,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  incomeTax: DEFAULT_INCOME_TAX,
  standingLines: [],
  country: "IN",
  // July 2025's recuperation fell before their first month and was paid, so
  // January carries none of it (specs.md item 15).
  openingPosition: { vacationDays: 9, sickDays: 24, vacationUsedThisYear: 0, holidayUsedThisYear: 0, recuperationPaidIn: { year: 2025, month: 7 }, advances: [] },
  // Their permit date is the first worker's, and deliberately: the employment
  // permit belongs to the *employer* and a household holds one of them
  // (item 28). The in-memory store has no household record, so each worker
  // carries a copy of it and the two are seeded equal so the screen shows what
  // the household actually has.
  documents: {
    employmentPermitExpiry: "2026-11-30",
    workVisaExpiry: "2026-10-15",
    passportExpiry: "2027-01-31",
  },
};

const devWorkers: WorkerProfile[] = [firstWorker, secondWorker];

/**
 * The days that departed from an ordinary month, per worker.
 *
 * **The two workers now answer two different questions.** Hanna's days are read
 * out of the family's own workbooks so their months can be held against the tabs
 * they came from, figure by figure. The second worker's are invented on purpose
 * and are where the awkward shapes live — a rest day that is not Saturday, a
 * spell of sickness across a month boundary, a holiday falling on their own rest
 * day — because those are cases the workbooks happen not to contain and a demo
 * that showed only what the workbooks show would exercise none of them.
 *
 * Spans belong to the worker and not to the month (`specs.md` Part 3), which is
 * what the second worker's sick spell is here to show: 30.3 to 2.4 is **one**
 * span, stored once, and each of the two months places its own days at the tier
 * the spell itself reached — nothing for the first day, half for the second and
 * third, and the full day from the fourth. Splitting it into two spans would
 * restart the tiers in April and pay them less, and the sheet would look
 * ordinary.
 *
 * The holidays are seeded rather than marked: criterion 9 says the user never
 * marks a day as a holiday. The dates arrive from here in place of what
 * criterion 10's picker chooses, and the month records the one fact about each
 * of them — whether they worked it.
 */
/**
 * The months of the workbooks the demo replays: `חודש 5.25` through
 * `חודש 7.26`, in the order they are filed.
 *
 * **April 2025 is left out, and the reason is a rule rather than a
 * preference.** The 2025 tabs pay **ten** holidays across the year against the
 * nine-day entitlement of item 10, and the engine refuses the tenth — correctly.
 * Beginning in May makes it nine exactly, so the seeded year is a year the
 * entitlement allows. April's own figures are not lost: its ₪2,000 instalment
 * is carried on the opening advance above, and its ברוטו of ₪8,353.05 is the
 * same one `חודש 7.25` reaches.
 *
 * **`חודש 3.26` is absent too, and for a different reason.** It pays six days
 * of recuperation and the *rate* the family valued them at was never read out
 * of the tab, so the application cannot reproduce its ברוטו — and a month the
 * demo cannot reproduce is worse than a month it does not show. That leaves a
 * gap between February and April 2026, which is visible and honest: the
 * balances carry across it either way, because they are replayed and never
 * stored (item 13).
 */
const WORKBOOK_SEED_MONTHS = WORKBOOK_MONTHS.filter(
  (m) => m.tab !== "חודש  4.25",
);

const devSpans: Record<string, MonthSpan[]> = {
  // **Read off `G3` and `H3` of each tab and nothing else.** `G3` is the date of
  // the Saturday they had off and `H3` the holidays they worked — every holiday in
  // these workbooks was worked, which is why each reaches column F: a holiday
  // taken off earns nothing extra (item 9).
  "worker-1": WORKBOOK_SEED_MONTHS.flatMap((m) => [
    ...m.freeRestDays.map((date) => ({
      id: `w1-free-${date}`,
      kind: "freeRestDay" as const,
      from: date,
      to: date,
    })),
    ...m.holidaysWorked.map((date) => ({
      id: `w1-holiday-${date}`,
      kind: "holiday" as const,
      from: date,
      to: date,
      worked: true,
    })),
  ]),
  "worker-2": [
    { id: "w2-holiday-0101", kind: "holiday", from: "2026-01-01", to: "2026-01-01", worked: false },
    { id: "w2-vacation-feb", kind: "vacation", from: "2026-02-16", to: "2026-02-19" },
    // One spell across the boundary, stored once (see above).
    { id: "w2-sick-mar-apr", kind: "sick", from: "2026-03-30", to: "2026-04-02" },
    { id: "w2-holiday-0403", kind: "holiday", from: "2026-04-03", to: "2026-04-03", worked: true },
    // A Saturday, which is their own rest day and the only day this mark may fall
    // on (specs.md item 5).
    { id: "w2-rest-may", kind: "freeRestDay", from: "2026-05-16", to: "2026-05-16" },
    { id: "w2-holiday-0820", kind: "holiday", from: "2026-08-20", to: "2026-08-20", worked: true }  ],
};

/**
 * Everything a month holds that is not a span. Most months hold nothing at all,
 * which is the ordinary case: the user marks what departed and the rest of the
 * month is the standard one.
 */
type MonthExtras = Partial<Omit<MonthRecord, "month" | "confirmedWage" | "terms">>;

/** The confirmed wage a seeded month stands on: the minimum in force during it,
 * and the profile's own salary where that already sits above it (item 3). */
function wageFor(profile: WorkerProfile, month: YearMonth) {
  // Compared as a date and not as two loose bounds: `year >= 2026 && month >= 4`
  // reads the same and puts January 2027 back on the 2025 rate.
  const afterTheRise =
    month.year > 2026 || (month.year === 2026 && month.month >= 4);
  const minimumAgorot = afterTheRise ? WAGE_2026 : WAGE_2025;
  return {
    baseAgorot: Math.max(profile.baseMonthlySalaryAgorot, minimumAgorot),
    minimumAgorot,
    effectiveFrom: minimumAgorot === WAGE_2026 ? "2026-04-01" : "2025-04-01",
  };
}

function monthsFor(
  profile: WorkerProfile,
  extras: Record<number, MonthExtras> = {},
): MonthRecord[] {
  return SEEDED_MONTHS.map((month) => ({
    month,
    // **The wage in force during the month, and not one figure stamped across
    // the year** (specs.md item 4). Stamping one would leave every month from
    // April 2026 onward valued below the legal minimum, which is what
    // `belowMinimumWageWarning` says out loud.
    confirmedWage: wageFor(profile, month),
    // The terms the month was calculated with, copied off the profile at the
    // moment it was confirmed and read from here afterwards (specs.md Part 3).
    terms: snapshotTerms(profile, month),
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    // **No income tax on the record, which is not the same as a zero on it.**
    // The engine works the figure out from the month's gross, and a field here
    // is the amount *confirmed* before an export, reproduced instead of
    // recalculated (specs.md item 17, Part 3). A seeded zero would therefore be
    // a demo in which every month had already been confirmed to withhold
    // nothing, and the calculation would never run on any screen.
    overrides: {},
    ...extras[month.month],
  }));
}

/**
 * Hanna's months, assembled from the tabs rather than written out again.
 *
 * Each month carries the wage its own tab was valued at (`D6`), the advances
 * its closing block moves, and nothing else: no user line, no third-party
 * payment and no override, because the tabs hold none. What the application
 * then draws — the base, the rest-eve supplement, the rest days, the holidays,
 * the two subtotals, the ברוטו and the transfer — is what a reader can hold
 * against `E23`, `F24`, `E26` and `E29` of the same tab.
 *
 * **The income tax is absent rather than confirmed at zero.** Their profile says
 * `none`, so every month withholds nothing by a decision they made once; a
 * confirmed zero on each month would say instead that they went through the
 * pre-export conversation fourteen times and answered the same thing.
 */
const workbookMonths: MonthRecord[] = WORKBOOK_SEED_MONTHS.map((m) => ({
  month: m.month,
  confirmedWage: {
    baseAgorot: m.salaryAgorot,
    minimumAgorot: m.salaryAgorot,
    effectiveFrom: m.salaryAgorot === WAGE_2026 ? "2026-04-01" : "2025-04-01",
  },
  terms: snapshotTerms(firstWorker, m.month),
  advances: m.advances.map((a) => ({
    number: a.number,
    kind: a.kind,
    agorot: a.agorot,
  })),
  // The payments the tab records, with the day each was paid read out of the
  // sentence in `I` beside it — the only place the workbook records it
  // (specs.md item 16). Usually column `H`, but not always: `חודש  6.25` holds
  // its premium in `C10`, which is why the fixture is built by reading the
  // notes column rather than one money column. Empty on most tabs, which is the
  // ordinary month.
  thirdPartyPayments: m.thirdPartyPayments ?? [],
  userLines: [],
  overrides: {},
}));

const devMonths: Record<string, MonthRecord[]> = {
  "worker-1": workbookMonths,
  /**
   * **The second worker is where everything invented lives.** The first is
   * seeded from the workbooks, and a month of theirs that carried an advance
   * nobody granted, or a line nobody wrote, would no longer match the tab it
   * is meant to be held against.
   */
  "worker-2": monthsFor(secondWorker, {
    // Medical insurance, which the employer of a caregiver owes and which goes
    // to the insurer rather than to the worker: column H, and outside their own
    // total (specs.md item 16).
    1: {
      // Paid on the 8th, and the policy runs the year `coverExpiryOf` gives it
      // by default — the shape the family described (specs.md item 16).
      thirdPartyPayments: [
        { kind: "medicalInsurance", agorot: 130000, paidOn: "2026-01-08" },
      ],
      // **The one month whose tax was confirmed, and confirmed at nothing**
      // (specs.md item 17, item 18). A figure here is the amount settled in the
      // pre-export conversation and stored with the month, reproduced ever
      // after instead of recalculated — so this is a family that went through
      // that conversation and said this month withholds nothing.
      //
      // It is seeded because it is the demo's only month that withholds
      // nothing, and the collapsed shape needs one: a month that withholds and
      // transfers nothing closes on a single figure rather than three identical
      // ones under three headings (Part 5).
      incomeTaxAgorot: 0,
    },
    // An advance given, repaid over the three months that follow — the amount
    // is entered per month rather than fixed by a schedule (specs.md item 20).
    2: { advances: [{ number: 1, kind: "granted", agorot: 300000 }] },
    3: { advances: [{ number: 1, kind: "repaid", agorot: 100000 }] },
    4: {
      advances: [{ number: 1, kind: "repaid", agorot: 100000 }],
      // Paid once a quarter and in arrears, so it appears in the month it left
      // the account together with the months it covers (specs.md item 19).
      thirdPartyPayments: [
        {
          kind: "nationalInsurance",
          agorot: 100000,
          // In arrears: paid in April for the quarter that ended in March.
          paidOn: "2026-04-15",
          coversMonths: [
            { year: 2026, month: 1 },
            { year: 2026, month: 2 },
            { year: 2026, month: 3 },
          ],
        },
      ],
    },
    5: { advances: [{ number: 1, kind: "repaid", agorot: 100000 }] },
    // The two defaults side by side (specs.md item 20): an addition before the
    // month's total and a deduction after it, which is where each sits when the
    // user says nothing. The screen shows one summarised row for each.
    //
    // **The Hebrew here is not a translation and does not belong in `he.ts`.**
    // A user line's label and note are the user's own sentence and never the
    // application's (item 20), so what stands in for one in a seed is a made-up
    // sentence in the language the user would have written.
    6: {
      userLines: [
        {
          id: "shortfall",
          label: "השלמה מחודש קודם",
          direction: "addition",
          agorot: 25000,
          note: "חסר שהתגלה בחודש שעבר",
        },
        {
          id: "damage",
          label: "השתתפות בנזק",
          direction: "deduction",
          agorot: 18000,
          note: "סוכם בעל פה",
        },
      ],
    },
    // The combination the old rule could not express at all: a deduction the
    // user put *before* the total, so it lowers what the month cost and with it
    // the national-insurance estimate rather than only what is transferred.
    7: {
      userLines: [
        {
          id: "phone",
          label: "השתתפות בחשבון הטלפון",
          direction: "deduction",
          placement: "beforeGross",
          agorot: 18000,
          note: "מנוכה מהשכר עצמו לפי ההסכם",
        },
      ],
    },
    // **The only seeded month whose tax was corrected by hand**, and the one
    // that shows the withholding row carrying an amount the user chose rather
    // than the one the application worked out: the tax is withheld from the
    // ברוטו and reaches the נטו, while the line below it — a deduction, so
    // `placementOf` puts it after the total by default — changes only what is
    // transferred and leaves the נטו alone (specs.md items 17 and 20).
    8: {
      overrides: { incomeTax: { agorot: 45000, label: he.sheet.lines.incomeTax } },
      userLines: [
        {
          id: "market",
          label: "קניות שהעברתי לה במזומן",
          direction: "deduction",
          agorot: 20000,
          note: "סוכם שיקוזז מהתשלום בסוף החודש",
        },
      ],
    },
  }),
};

/** The seed as `createInMemoryRepository` takes it. */
export const devSeed = {
  workers: devWorkers,
  spans: devSpans,
  months: devMonths,
};

/**
 * The demo household with the second worker's January to April 2026 confirmed
 * and never exported — the only way a finished month becomes a warning in the
 * bell rather than a blockage (specs.md item 27). Four, so that with the day's
 * other warnings the bell holds more than it lists.
 *
 * **It is a seed because the interface cannot reach it.** The pre-export
 * screen confirms a month and downloads its file in one gesture, so a month is
 * confirmed and not exported only when that download never arrived. The demo
 * itself confirms nothing, because a draft is what a month nobody has taken
 * through that conversation is.
 */
const FILED_ON: Record<number, string> = {
  1: "2026-02-02T08:00:00.000Z",
  2: "2026-03-02T08:00:00.000Z",
  3: "2026-04-02T08:00:00.000Z",
  4: "2026-05-04T08:00:00.000Z",
};

/**
 * The demo as a family that has been filing as it goes: every month of 2026
 * that has ended is confirmed, for both workers.
 *
 * **It exists because a file now requires a confirmation** — `/month/export/file`
 * refuses a month nobody confirmed (specs.md items 4, 17), so a household whose
 * months are all drafts has no file anywhere, and the screens that hand one over
 * had nothing to be checked against. **The month still running is confirmed
 * too**, because item 21 lets a family file before the month is out and the
 * screens that offer that file have to be checkable as well.
 */
export const confirmedSeed = {
  ...devSeed,
  months: Object.fromEntries(
    Object.entries(devMonths).map(([workerId, records]) => [
      workerId,
      records.map((record) =>
        record.month.year === 2026
          ? {
              ...record,
              // Late in the month itself, so the month still running is
              // confirmed too. The instant matters only in that a month is not
              // reported as corrected afterwards, which `monthState` reads from
              // `updatedAt` against this.
              confirmedAt: `2026-${String(record.month.month).padStart(2, "0")}-28T08:00:00.000Z`,
            }
          : record,
      ),
    ]),
  ),
};

/**
 * The demo with one day of August 2026 carrying two marks, which the engine
 * refuses (`specs.md` item 25, Part 4).
 *
 * **It is a seed because no gesture in the interface can produce it**, and that
 * is the point rather than a shortcoming: `src/lib/spans.ts` stops a second
 * mark at the calendar, the picker withholds a kind no selected day can take,
 * and the rest-day panel answers a stranded mark before the change is saved.
 * The engine refuses all the same, because the calendar is one caller and the
 * repository is another — so a household in this state is one whose data
 * arrived another way, which is exactly what the refusal card is for.
 *
 * **August and not the current month**, so a screen opened on September is
 * still the card: one refused month stops the replay of every month after it
 * (item 13), and the card has to say which month is at fault.
 */
export const refusedSeed = {
  ...devSeed,
  spans: {
    ...devSpans,
    "worker-2": [
      ...devSpans["worker-2"],
      // The same day as `w2-holiday-0820`, which already holds a worked
      // holiday: one day cannot be both worked and not worked, and the engine
      // will not choose between them.
      {
        id: "w2-sick-0820",
        kind: "sick" as const,
        from: "2026-08-20",
        to: "2026-08-20",
      },
    ],
  },
};

/**
 * The refused household with the *first* worker's August doubled as well, so
 * both employments are refused at once.
 *
 * **Two workers is the whole household** (item 11), so this is the case where
 * the list has nothing left to state — and it is the one the screens must still
 * render rather than fail whole, which is the defect they had. Their two marks are
 * invented here rather than collided with a workbook day: a mark read off a tab
 * is a figure the first worker's months are held against, and doubling one would
 * put the known case out of agreement with its own sheet.
 */
export const bothRefusedSeed = {
  ...refusedSeed,
  spans: {
    ...refusedSeed.spans,
    "worker-1": [
      ...devSpans["worker-1"],
      // **July and not August**: their seeded months are the workbook tabs and
      // they stop at July 2026 (`WORKBOOK_SEED_MONTHS`), so marks on an August
      // they have no month for would be validated by nothing at all. The two
      // workers are therefore refused in different months, which is the
      // stronger case anyway — one card per employment and not one per
      // household.
      {
        id: "w1-vacation-0708",
        kind: "vacation" as const,
        from: "2026-07-08",
        to: "2026-07-08",
      },
      {
        id: "w1-sick-0708",
        kind: "sick" as const,
        from: "2026-07-08",
        to: "2026-07-08",
      },
    ],
  },
};

/**
 * A household of one worker, refused.
 *
 * **It is the case where the list holds nothing else**, and it is also the one
 * where the household still has room — so the card that offers a second worker
 * is drawn beside a refusal, which is the layout nothing else reaches.
 */
export const refusedAloneSeed = {
  workers: [secondWorker],
  spans: { "worker-2": refusedSeed.spans["worker-2"] },
  months: { "worker-2": devMonths["worker-2"] },
};

/**
 * A refusal that names **no date at all**: two medical-insurance payments in one
 * month, which item 16 refuses because the sheet holds one row per kind.
 *
 * **It is seeded because it is the only shape that proves the month is the
 * locator.** `dayRecordedTwice` always carries a day, so every other refused
 * household would pass a card that silently depended on one; a payment concerns
 * a kind and not a date (`validate.ts`), and here the month's own name is all
 * the card has to say where the trouble is.
 */
export const refusedNoDateSeed = {
  ...devSeed,
  months: {
    ...devMonths,
    "worker-2": devMonths["worker-2"].map((record) =>
      record.month.year === 2026 && record.month.month === 8
        ? {
            ...record,
            thirdPartyPayments: [
              {
                kind: "medicalInsurance" as const,
                agorot: 130000,
                paidOn: "2026-08-08",
              },
              {
                kind: "medicalInsurance" as const,
                agorot: 130000,
                paidOn: "2026-08-09",
              },
            ],
          }
        : record,
    ),
  },
};

/**
 * The demo with the test worker's spell of sickness left **open** — a span whose
 * `to` is null (`specs.md` item 8).
 *
 * **It is a seed for the same reason `refusedSeed` is one**: no gesture in the
 * interface produces it, and that is deliberate rather than missing. Item 8 says
 * so outright — "There is no gesture for opening one, and there is deliberately
 * none" — because continuity is inferred from the days marked and a second
 * gesture meaning "they are still ill" would be a second way to say it.
 * `applyMark` therefore always closes what it writes, which
 * `src/lib/spans.test.ts` pins.
 *
 * **But the shape is live in storage and in the engine.** The column is
 * nullable, `openSickSpellOf` looks for it, a month clips such a spell at its
 * own last day, and the export refuses to run over one (item 18). So a
 * household can arrive in this state the way a refused one can — from a
 * migration, from a direct write, or from a later feature — and the *only* way
 * out is the panel the export draws. Without this seed that panel is
 * unreachable, and an escape hatch nobody can open is worse than none.
 *
 * **Why the spell sits four days before the suite's own today.** The file's
 * header says no spell is left open in `devSeed` because one drifts with the
 * real clock and eventually exhausts a balance that was fine when it was
 * written. That hazard is real and is contained rather than removed: the browser
 * suite pins today to 2026-09-18 (`e2e/household.ts`), this seed is reachable
 * only by its own cookie name, and the spell begins on the 14th — so under the
 * pinned clock it is five days against an opening balance of twenty-four. Opened
 * in a browser on a much later real date it *will* run the balance down, which
 * is the drift the header warns about and the reason this is not in `devSeed`.
 */
const OPEN_SPELL_FROM = "2026-09-14";

export const openSpellSeed = {
  ...devSeed,
  spans: {
    ...devSpans,
    "worker-2": [
      ...devSpans["worker-2"],
      {
        id: "w2-sick-open",
        kind: "sick" as const,
        from: OPEN_SPELL_FROM,
        /** The whole point of the fixture: no end recorded. */
        to: null,
      },
    ],
  },
};

export const filedSeed = {
  ...devSeed,
  months: {
    ...devMonths,
    "worker-2": devMonths["worker-2"].map((record) =>
      record.month.year === 2026 && FILED_ON[record.month.month] !== undefined
        ? { ...record, confirmedAt: FILED_ON[record.month.month] }
        : record,
    ),
  },
};
