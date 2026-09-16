import { he } from "@/lib/i18n/he";
import type { HomeAlert } from "@/lib/types";

/**
 * The one thing on the home screen that is still stood in for: the strip of
 * cards saying what blocks a correct salary (specs.md item 27).
 *
 * **Everything else on that screen is the engine's since 2026-09-16.** This file
 * used to hold a whole month — spans, lines, balances, two workers — with every
 * amount and every count `null`, so the canvas's "[סכום]" and "[מספר]" were what
 * the screen drew. The route now replays the household through `calculateSeries`
 * and hands the real months down, and all of that went with it.
 *
 * What is left is three blockers with no clock behind them. Each of the three is
 * a real question — a quarter of national insurance due, a medical policy about
 * to lapse, a year whose holidays are unchosen — and answering any of them means
 * reading the store and the calendar, which is the second half of
 * `build_plan.md`'s stage 6 together with the `/alerts` screen the cards link
 * to. Until then the placeholders are deliberate: a fixture that invented a date
 * or a sum here would let the strip look answered while reading from nothing.
 */
export const homeAlerts: HomeAlert[] = [
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
    action: "לרשום חידוש",
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
