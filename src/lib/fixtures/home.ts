import { he } from "@/lib/i18n/he";
import type {
  BalanceLine,
  DaySpan,
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

/** The month the canvas draws. Its 1st falls on a Saturday, so it has five
 * Saturdays and 26 working days — the case specs.md Part 5 warns about. */
export const fixtureMonth: YearMonth = { year: 2026, month: 8 };

/** The day the fixtures treat as today, so nothing reads the clock during a
 * render and server and browser agree. */
export const fixtureToday = "2026-08-27";

const workers: Worker[] = [
  { id: "worker-1", name: he.placeholder.workerName, firstName: he.placeholder.name },
  { id: "worker-2", name: "[שם העובד/ת השני/ה]", firstName: he.placeholder.name },
];

/**
 * The marks the canvas shows, with one change. The canvas marks the 15th as a
 * vacation day, and the 15th is a Saturday; a vacation span skips its Saturdays
 * because Saturday is already the weekly rest day and drawing a balance day for
 * it would charge the worker twice (specs.md item 5). The fixture puts that
 * vacation day on the 17th instead rather than shipping a state the rules
 * refuse.
 */
const spans: DaySpan[] = [
  { id: "span-vacation", kind: "vacation", from: "2026-08-17", to: "2026-08-17" },
  { id: "span-holiday", kind: "holiday", from: "2026-08-19", to: "2026-08-19" },
  { id: "span-sick", kind: "sick", from: "2026-08-20", to: "2026-08-20" },
  { id: "span-rest-1", kind: "freeSaturday", from: "2026-08-01", to: "2026-08-01" },
  { id: "span-rest-2", kind: "freeSaturday", from: "2026-08-08", to: "2026-08-08" },
  { id: "span-rest-3", kind: "freeSaturday", from: "2026-08-22", to: "2026-08-22" },
  { id: "span-rest-4", kind: "freeSaturday", from: "2026-08-29", to: "2026-08-29" },
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
  totalToWorker: null,
  balances,
};

const alerts: HomeAlert[] = [
  {
    key: "national-insurance",
    title: "ביטוח לאומי לרבעון",
    note: `התשלום על הרבעון שהסתיים ממתין. סכום מוערך: ${he.placeholder.amount}`,
    action: "לסמן כשולם",
    link: "nationalInsurance",
  },
  {
    key: "medical-insurance",
    title: "הביטוח הרפואי עומד לפוג",
    note: `הפוליסה בתוקף עד ${he.placeholder.date}`,
    action: "לפרטים",
    link: "medicalInsurance",
  },
  {
    key: "holidays",
    title: `חגים לשנת ${he.placeholder.year} טרם נבחרו`,
    note: `נבחרו ${he.placeholder.count} מתוך תשעה ימי חג`,
    action: "לבחור חגים",
    link: "holidayWork",
  },
];

export interface HomeFixture {
  worker: Worker;
  month: YearMonth;
  spans: DaySpan[];
  result: MonthResult;
  alerts: HomeAlert[];
}

/** Two, because the canvas's worker switcher moves between two and an account
 * holds no more than two (specs.md item 11). */
export const homeFixtures: HomeFixture[] = workers.map((worker) => ({
  worker,
  month: fixtureMonth,
  spans,
  result,
  alerts,
}));
