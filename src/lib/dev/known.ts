import { SATURDAY } from "@/lib/dates";
import type { MonthRecord, WorkerProfile } from "@/lib/engine/repository";
import { snapshotTerms } from "@/lib/engine/types";
import type { MonthSpan } from "@/lib/engine/types";

/**
 * The known case of `specs.md` Part 4, made enterable.
 *
 * **It is the one household in the application that means something.** The demo
 * seed beside it is nine months of 2026 to click at and proves nothing; this is
 * August 2025 as the family's own sheet records it, and its four totals —
 * ₪6,747.65, ₪2,558.10, ₪9,305.75 and ₪7,305.75 — are the figures criterion 1
 * is agreement with. `august-2025.test.ts` already checks that the engine
 * produces them from facts handed to it directly. What this household adds is
 * the half a unit test cannot reach (`CLAUDE.md` rule 9): the same four figures
 * arrived at through the calendar, the holiday controls and the payments screen,
 * as a user meets them.
 *
 * **Only what does not originate inside the application is seeded.** Part 4 is
 * explicit that the advance and the balances it starts from are entered once as
 * the worker's opening position, since neither comes from a month; and item 10
 * puts the year's holiday *dates* in a picker chosen in advance, which is stage
 * 5's. Everything else is the user's to enter, and is deliberately left out:
 *
 * - **The free rest day of the 16th** is swept on the calendar (item 5).
 * - **Whether she worked each of the two holidays** is the one fact a month
 *   records about a holiday, and it is clicked on the day (item 9). Both arrive
 *   `worked: false`, which is what an unanswered holiday looks like — seeding
 *   them as worked would answer, on the user's behalf, the question the case
 *   exists to put to her.
 * - **The ₪2,000 instalment** is recorded on `/payments` (item 20).
 *
 * So the household opens on a month worth ₪8,879.40 — the plain August of
 * `august-2025.fixture.ts` — and three gestures move it to ₪9,305.75, with the
 * instalment taking the transfer to ₪7,305.75. A seed that arrived at the four
 * figures on its own would be a demonstration and not a check.
 */

/** ₪6,247.65, in force from 1.4.2025 and therefore the rate August 2025 is
 * valued at (`specs.md` Part 3). The figure and its date are the workbook's,
 * carried by `august-2025.test.ts`. */
const SALARY = 624765;
const WAGE_EFFECTIVE_FROM = "2025-04-01";

/** ₪100 a rest-eve. Part 4 gives ₪500 across five Fridays worked and item 14
 * calls the supplement weekly, so the per-rest-eve figure is those two
 * statements divided — the same derivation `august-2025.test.ts` shows. */
const REST_EVE_SUPPLEMENT = 10000;

const AUGUST_2025 = { year: 2025, month: 8 };

/**
 * Hanna, as Part 4 describes her: paid the minimum wage, employed since
 * 1.4.2024, resting on Saturday so that her rest-eve is Friday.
 *
 * Her opening balances are zero and that is confirmed rather than convenient.
 * Part 4 gives no opening balance for August 2025, so a figure here would be
 * one with no source in the case the whole engine is checked against — the
 * balances the screen then shows are the month's own accrual, which is the part
 * that *is* sourced (items 7 and 8).
 */
const hanna: WorkerProfile = {
  id: "hanna",
  name: "האנה",
  firstName: "האנה",
  employedSince: "2024-04-01",
  baseMonthlySalaryAgorot: SALARY,
  restDay: SATURDAY,
  restEveSupplementAgorot: REST_EVE_SUPPLEMENT,
  recuperationMonth: 7,
  standingLines: [],
  country: "PH",
  openingPosition: {
    vacationDays: 0,
    sickDays: 0,
    // Part 4: a ₪10,000 advance from an earlier month, repaid at ₪2,000 a
    // month. The advance is in the opening position because it did not
    // originate inside the application (item 6); the instalment is August's and
    // is the user's to record.
    advances: [{ number: 1, principalAgorot: 1000000, repaidAgorot: 0 }],
  },
  // Part 4 states no document dates, so none is invented: three empty fields
  // are what a worker whose papers the family has not typed in looks like
  // (item 28), and the case is checked on its four totals rather than on these.
  documents: {
    employmentPermitExpiry: null,
    workVisaExpiry: null,
    passportExpiry: null,
  },
};

/**
 * The year's holidays, which arrive already drawn on the month.
 *
 * Part 4: "two paid holidays on the 19th and the 21st". The dates belong to the
 * year and not to the month — the user never marks a day as a holiday (item 9)
 * — so until stage 5's yearly picker exists they arrive from here, unanswered.
 */
const spans: Record<string, MonthSpan[]> = {
  hanna: [
    { id: "hanna-holiday-0819", kind: "holiday", from: "2025-08-19", to: "2025-08-19", worked: false },
    { id: "hanna-holiday-0821", kind: "holiday", from: "2025-08-21", to: "2025-08-21", worked: false },
  ],
};

/**
 * August 2025 with an empty ledger — the month before the user has entered
 * anything into it.
 *
 * One month and no others, because Part 4's case is one month: a chain around
 * it would carry balances the case does not state, and the household would then
 * open on a figure with no source beside the one that has one.
 */
const august: MonthRecord = {
  month: AUGUST_2025,
  confirmedWage: {
    baseAgorot: SALARY,
    minimumAgorot: SALARY,
    effectiveFrom: WAGE_EFFECTIVE_FROM,
  },
  terms: snapshotTerms(hanna),
  advances: [],
  thirdPartyPayments: [],
  userLines: [],
  incomeTaxAgorot: 0,
  overrides: {},
};

/** The known case as `createInMemoryRepository` takes it. */
export const knownCaseSeed = {
  workers: [hanna],
  spans,
  months: { hanna: [august] },
};
