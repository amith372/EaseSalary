import { FRIDAY, SATURDAY } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { he } from "@/lib/i18n/he";
import type {
  BalanceLine,
  DaySpan,
  HolidaySpan,
  HomeAlert,
  MonthLine,
  MonthResult,
  Worker,
  YearMonth,
} from "@/lib/types";

/**
 * Placeholder values for the home screen, in the shape the calculation engine
 * will return. Every amount and every count is `null`: the canvas draws them as
 * "[סכום]" and "[מספר]", and a fixture that invents a figure instead would let
 * a screen look finished while reading from nothing. Fixing the contract now is
 * the point — Stage 1 fills it in without the screen changing.
 */

/** The month the canvas draws. Its 1st falls on a Saturday, which is Hanna's
 * rest day, so it has five rest days and 26 working days — the case specs.md
 * Part 5 warns about. */
export const fixtureMonth: YearMonth = { year: 2026, month: 8 };

/** The day the fixtures treat as today, so nothing reads the clock during a
 * render and server and browser agree. */
export const fixtureToday = "2026-08-27";

/** The account's workers, handed to the shell's worker scope. Until Stage 3
 * these are the placeholders; from Stage 3 they are the account's own, and only
 * the source changes. */
export const fixtureWorkers: Worker[] = [
  { id: "worker-1", name: he.placeholder.workerName, firstName: he.placeholder.name },
  { id: "worker-2", name: "[שם העובד/ת השני/ה]", firstName: he.placeholder.name },
];

/**
 * The four marks v3 draws: one free rest day on the 8th, a vacation day on the
 * 19th, a holiday on the 20th and a sick day on the 26th. The rest of the
 * month's rest days carry no mark, because a free rest day is the exception
 * the user recorded and not the default (specs.md item 5).
 *
 * The holiday is one she worked. A holiday she did not work is drawn as an
 * outline rather than a fill, and v3 draws neither that state nor a sixth
 * legend chip for it: the outline, the chip and the toggle arrive with the
 * month screen, together with the yearly picker that supplies the dates
 * (specs.md item 9).
 */
const workedHoliday: HolidaySpan = {
  id: "span-holiday",
  kind: "holiday",
  from: "2026-08-20",
  to: "2026-08-20",
  worked: true,
};

const spans: DaySpan[] = [
  { id: "span-rest", kind: "freeRestDay", from: "2026-08-08", to: "2026-08-08" },
  { id: "span-vacation", kind: "vacation", from: "2026-08-19", to: "2026-08-19" },
  workedHoliday,
  { id: "span-sick", kind: "sick", from: "2026-08-26", to: "2026-08-26" },
];

const lines: MonthLine[] = [
  {
    key: "base",
    label: he.lines.baseSalary,
    amount: null,
    column: "E",
    manual: false,
    explanation: { text: he.explanations.baseSalary, link: "caregiverWage" },
  },
  {
    key: "supplements",
    label: he.lines.supplements,
    amount: null,
    column: "F",
    manual: false,
    explanation: { text: he.explanations.supplements, link: "restDayWork" },
  },
  {
    key: "advance",
    label: he.lines.advanceRepaid,
    amount: null,
    column: "G",
    manual: false,
    explanation: { text: he.explanations.advanceRepaid },
  },
];

const balances: BalanceLine[] = [
  {
    kind: "vacation",
    opening: null,
    accrued: null,
    used: null,
    closing: null,
    explanation: { text: he.explanations.vacationBalance, link: "annualLeave" },
  },
  {
    kind: "sick",
    opening: null,
    accrued: null,
    used: null,
    closing: null,
    explanation: { text: he.explanations.sickBalance, link: "sickPay" },
  },
];

const result: MonthResult = {
  month: fixtureMonth,
  standardDays: null,
  actualDays: null,
  lines,
  subtotals: [],
  closing: [],
  gross: null,
  net: null,
  balances,
  // No warning fires on a fixture month: a warning is a fact about a real year.
  warnings: [],
  nationalInsuranceEstimate: null,
};

const alerts: HomeAlert[] = [
  {
    key: "national-insurance",
    title: "ביטוח לאומי לרבעון",
    note: `התשלום על הרבעון שהסתיים ממתין. סכום מוערך: ${he.placeholder.amount}`,
    action: "לסמן כשולם",
    explanation: { text: he.explanations.nationalInsurance, link: "nationalInsurance" },
  },
  {
    key: "medical-insurance",
    title: "הביטוח הרפואי עומד לפוג",
    note: `הפוליסה בתוקף עד ${he.placeholder.date}`,
    action: "לפרטים",
    explanation: { text: he.explanations.medicalInsurance, link: "medicalInsurance" },
  },
  {
    key: "holidays",
    title: `חגים לשנת ${he.placeholder.year} טרם נבחרו`,
    note: `נבחרו ${he.placeholder.count} מתוך תשעה ימי חג`,
    action: "לבחור חגים",
    explanation: { text: he.explanations.holidaysChosen, link: "holidayWork" },
  },
];

export interface HomeFixture {
  worker: Worker;
  month: YearMonth;
  /** Her weekly rest day, which the calendar needs to decide what a swept range
   * means: a vacation span skips it and a free-rest-day mark may fall on
   * nothing else (specs.md items 5, 8). Saturday here, which is the default and
   * Hanna's own. */
  restDay: RestDay;
  spans: DaySpan[];
  result: MonthResult;
  alerts: HomeAlert[];
}

/**
 * The second worker's month, and she is deliberately not a copy of the first.
 *
 * **The two workers exist so the account's two states can be seen side by
 * side** (specs.md item 11), and until a profile screen can set a rest day this
 * switcher is the only place the two shapes the engine now supports are
 * visible at all — a worker who does not rest on Saturday (item 5), and a spell
 * of sickness that has not ended (item 8). Without her the calendar can draw
 * only the common case, and the rest of the engine is checkable by nobody but
 * the suite.
 *
 * She rests on **Friday**, so her free rest day falls on Friday the 7th and the
 * legend beside her calendar reads "יום שישי חופשי" rather than "שבת חופשית" —
 * the term is derived from her own rest day and is not fixed in the wording.
 * Her sickness is recorded the way item 8 says one normally is: from the day
 * she fell ill, with no return date, so it is drawn from the 26th to
 * `fixtureToday` and no further.
 */
const otherSpans: DaySpan[] = [
  // Friday the 7th of August 2026 — her rest day, and a Saturday for the first
  // worker, which is what makes the pair worth switching between.
  { id: "other-rest", kind: "freeRestDay", from: "2026-08-07", to: "2026-08-07" },
  { id: "other-vacation", kind: "vacation", from: "2026-08-19", to: "2026-08-19" },
  {
    id: "other-holiday",
    kind: "holiday",
    from: "2026-08-20",
    to: "2026-08-20",
    worked: true,
  } as HolidaySpan,
  // Still running: `to` is null, not a date in the future (item 8).
  { id: "other-sick", kind: "sick", from: "2026-08-26", to: null },
];

/** Two, because the canvas's worker switcher moves between two and an account
 * holds no more than two (specs.md item 11). */
export const homeFixtures: HomeFixture[] = [
  {
    worker: fixtureWorkers[0],
    month: fixtureMonth,
    restDay: SATURDAY,
    spans,
    result,
    alerts,
  },
  {
    worker: fixtureWorkers[1],
    month: fixtureMonth,
    restDay: FRIDAY,
    spans: otherSpans,
    result,
    alerts,
  },
];
