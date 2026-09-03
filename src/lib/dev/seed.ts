import { FRIDAY, SATURDAY } from "@/lib/dates";
import type { MonthRecord, WorkerProfile } from "@/lib/engine/repository";
import { snapshotTerms } from "@/lib/engine/types";
import type { MonthSpan } from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import type { YearMonth } from "@/lib/types";

/**
 * The household the vertical slice runs on: two workers, their months of 2026,
 * and the days that departed from an ordinary month in each.
 *
 * **It is a household to click, and it proves nothing** (`build_plan.md`, the
 * vertical slice). The one month whose figures are known to be right is August
 * 2025, which comes from the family's own sheet and lives in the test suite;
 * nothing here may be read as a case. What it is for is the things the
 * application could not do until now — move between months and watch the
 * balances carry, see a worker who does not rest on Saturday, see a spell of
 * sickness that crosses a month boundary, and see money that goes to a third
 * party stay outside the worker's own total.
 *
 * **Two figures here are given rather than derived, and item 6 is why.** The
 * opening position — the days already accrued when the application took over an
 * employment already running — does not originate inside the application at
 * all: the family states it once. Round numbers are therefore what one actually
 * looks like, not a figure invented to stand in for a calculation.
 *
 * **The salary is the last minimum wage this repository has a source for** —
 * 6,247.65, in force from 1.4.2025, which is the figure `august-2025.test.ts`
 * carries from the workbook. It is *not* a claim about what the minimum wage is
 * in 2026: no 2026 figure has been fetched, and stage 5 is what fetches one
 * (item 4). Seeding the last sourced figure keeps an invented number out of the
 * store, and the confirmation screen replaces it with a real one.
 *
 * **No spell is left open here on purpose.** An open spell goes on drawing sick
 * days from the balance for as long as nobody closes it (item 8), so a seed
 * carrying one drifts with the real clock and eventually exhausts a balance
 * that was fine on the day it was written — a store that begins failing on a
 * date nobody chose. The open spell is drawn on the home screen's fixtures, and
 * the gesture that opens one is a step of stage 4's own.
 */

/** 6,247.65 in agorot. See the note above on where the figure comes from. */
const SOURCED_MINIMUM_WAGE = 624765;

/** The date that wage took effect, so a month is valued at the rate in force
 * during it (specs.md Part 3). */
const SOURCED_WAGE_EFFECTIVE_FROM = "2025-04-01";

/** The months the store opens with: 2026, whose workbook is the canonical
 * layout reference. Nine of them, so the balance chain has something to walk. */
const SEEDED_MONTHS: YearMonth[] = Array.from({ length: 9 }, (_, index) => ({
  year: 2026,
  month: index + 1,
}));

/**
 * The common case, and the one the workbook describes: she rests on Saturday,
 * so her rest-eve is Friday.
 */
const firstWorker: WorkerProfile = {
  id: "worker-1",
  name: he.placeholder.workerName,
  firstName: he.placeholder.name,
  employedSince: "2024-04-01",
  baseMonthlySalaryAgorot: SOURCED_MINIMUM_WAGE,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  standingLines: [],
  country: "PH",
  openingPosition: { vacationDays: 9, sickDays: 24, advances: [] },
};

/**
 * The second worker, and she is deliberately not a copy of the first: she rests
 * on **Friday**, so her rest-eve is Thursday and every label that names a day
 * names a different one (specs.md item 5). Until a profile screen can set a
 * rest day she is the only place the generalisation is visible at all.
 */
const secondWorker: WorkerProfile = {
  id: "worker-2",
  name: "[שם העובד/ת השני/ה]",
  firstName: he.placeholder.name,
  employedSince: "2025-09-01",
  baseMonthlySalaryAgorot: SOURCED_MINIMUM_WAGE,
  restDay: FRIDAY,
  restEveSupplementAgorot: 8000,
  recuperationMonth: 3,
  standingLines: [],
  country: "IN",
  openingPosition: { vacationDays: 4, sickDays: 6, advances: [] },
};

export const devWorkers: WorkerProfile[] = [firstWorker, secondWorker];

/**
 * The days that departed from an ordinary month, per worker.
 *
 * Spans belong to the worker and not to the month (`specs.md` Part 3), which is
 * what the sick spell below is here to show: 30.3 to 2.4 is **one** span, stored
 * once, and each of the two months places its own days at the tier the spell
 * itself reached — nothing for the first day, half for the second and third,
 * and the full day from the fourth. Splitting it into two spans would restart
 * the tiers in April and pay her less, and the sheet would look ordinary.
 *
 * The holidays are seeded rather than marked: criterion 9 says the user never
 * marks a day as a holiday, and criterion 10's picker that chooses the year's
 * dates is stage 5's. Until it exists the dates arrive from here, and the month
 * records the one fact about each of them — whether she worked it.
 */
const devSpans: Record<string, MonthSpan[]> = {
  "worker-1": [
    { id: "w1-holiday-0101", kind: "holiday", from: "2026-01-01", to: "2026-01-01", worked: false },
    { id: "w1-vacation-feb", kind: "vacation", from: "2026-02-16", to: "2026-02-19" },
    // One spell across the boundary, stored once.
    { id: "w1-sick-mar-apr", kind: "sick", from: "2026-03-30", to: "2026-04-02" },
    { id: "w1-holiday-0403", kind: "holiday", from: "2026-04-03", to: "2026-04-03", worked: true },
    // A Saturday, which is her own rest day and the only day this mark may fall
    // on (specs.md item 5).
    { id: "w1-rest-may", kind: "freeRestDay", from: "2026-05-16", to: "2026-05-16" },
    { id: "w1-holiday-0820", kind: "holiday", from: "2026-08-20", to: "2026-08-20", worked: true },
  ],
  "worker-2": [
    { id: "w2-holiday-0101", kind: "holiday", from: "2026-01-01", to: "2026-01-01", worked: false },
    // A holiday falling on her own rest day and worked: paid once, not twice
    // (specs.md item 9). 1.5.2026 is a Friday, and Friday is her rest day.
    { id: "w2-holiday-0501", kind: "holiday", from: "2026-05-01", to: "2026-05-01", worked: true },
    { id: "w2-rest-may", kind: "freeRestDay", from: "2026-05-15", to: "2026-05-15" },
    { id: "w2-sick-jun", kind: "sick", from: "2026-06-08", to: "2026-06-11" },
    { id: "w2-vacation-jul", kind: "vacation", from: "2026-07-20", to: "2026-07-23" },
  ],
};

/**
 * Everything a month holds that is not a span. Most months hold nothing at all,
 * which is the ordinary case: the user marks what departed and the rest of the
 * month is the standard one.
 */
type MonthExtras = Partial<Omit<MonthRecord, "month" | "confirmedWage" | "terms">>;

function monthsFor(
  profile: WorkerProfile,
  extras: Record<number, MonthExtras> = {},
): MonthRecord[] {
  return SEEDED_MONTHS.map((month) => ({
    month,
    confirmedWage: {
      baseAgorot: profile.baseMonthlySalaryAgorot,
      minimumAgorot: SOURCED_MINIMUM_WAGE,
      effectiveFrom: SOURCED_WAGE_EFFECTIVE_FROM,
    },
    // The terms the month was calculated with, copied off the profile at the
    // moment it was confirmed and read from here afterwards (specs.md Part 3).
    terms: snapshotTerms(profile),
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    // Income tax is never calculated: the line starts at zero and is the user's
    // to edit (specs.md item 17, Part 1).
    incomeTaxAgorot: 0,
    overrides: {},
    ...extras[month.month],
  }));
}

const devMonths: Record<string, MonthRecord[]> = {
  "worker-1": monthsFor(firstWorker, {
    // Medical insurance, which the employer of a caregiver owes and which goes
    // to the insurer rather than to the worker: column H, and outside her own
    // total (specs.md item 16).
    1: { thirdPartyPayments: [{ kind: "medicalInsurance", agorot: 130000 }] },
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
    // sentence in the language the user would have written — the convention is
    // that `he.ts` holds every string the *application* says, and these are
    // stored data of the kind a family would have typed.
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
    // **The only seeded month with income tax in it**, and the only one that can
    // therefore show the block at its full height: a tax is withheld from the
    // ברוטו and reaches the נטו, while the line below it — a deduction, so
    // `placementOf` puts it after the total by default — changes only what is
    // transferred and leaves the נטו alone (specs.md items 17 and 20). Every
    // other month withholds nothing, which is the collapsed shape.
    //
    // The application never calculates income tax and never will (item 17);
    // this figure stands in for one the user typed.
    8: {
      incomeTaxAgorot: 45000,
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
  "worker-2": monthsFor(secondWorker),
};

/** The seed as `createInMemoryRepository` takes it. */
export const devSeed = {
  workers: devWorkers,
  spans: devSpans,
  months: devMonths,
};
