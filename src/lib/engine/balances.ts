import { daysInMonth, fromIsoDate, isoOf } from "@/lib/dates";
import type { MonthFacts, MonthSpan, WorkerTerms } from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import { balanceDaysOf } from "@/lib/spans";
import type { BalanceLine, DaySpan, IsoDate, YearMonth } from "@/lib/types";

/**
 * The vacation and sick balances of one month: what it opened with, what it
 * accrued, what was used in it, and what is left after them.
 *
 * The payslip made from the sheet has to carry the days used and the balances
 * left (specs.md item 2), which is why these are part of the month's result
 * rather than something a later screen assembles.
 *
 * **Never a decimal.** The workbook's balances tab writes the monthly vacation
 * accrual as `1.17` in January to March and as fourteen twelfths from April
 * onward, in the same column. Using the fraction throughout is what keeps a
 * balance from drifting a hundredth of a day a year until the figures stop
 * tying out for reasons no one can find later (Part 5). Nothing here rounds:
 * days are carried at full precision and rounded only for display.
 */

/** The sick balance accrues 1.5 days a month, stops at ninety, and never resets
 * at a year boundary (specs.md items 7, 8). */
const SICK_DAYS_PER_MONTH = 1.5;
const SICK_DAY_CEILING = 90;

const MONTHS_PER_YEAR = 12;

/**
 * Vacation days a year, by the seniority year: fourteen through year four,
 * sixteen in year five, eighteen in year six, twenty-one in year seven, and one
 * more each year to a ceiling of twenty-eight (specs.md item 7).
 */
export function vacationDaysPerYear(seniorityYear: number): number {
  if (seniorityYear <= 4) return 14;
  if (seniorityYear === 5) return 16;
  if (seniorityYear === 6) return 18;
  return Math.min(21 + (seniorityYear - 7), 28);
}

/**
 * The seniority year in force on a given day, counting the first year as 1.
 *
 * A month accrues at the year in force on its **first day**, so the step
 * happens at a month boundary and never inside one (specs.md item 7).
 */
export function seniorityYearOn(employedSince: IsoDate, on: IsoDate): number {
  const start = fromIsoDate(employedSince);
  const day = fromIsoDate(on);
  let years = day.getUTCFullYear() - start.getUTCFullYear();
  const beforeAnniversary =
    day.getUTCMonth() < start.getUTCMonth() ||
    (day.getUTCMonth() === start.getUTCMonth() &&
      day.getUTCDate() < start.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return years + 1;
}

/** The month's vacation accrual, as a fraction of the year's entitlement and
 * never as a decimal (Part 5). */
export function monthlyVacationAccrual(
  employedSince: IsoDate,
  month: YearMonth,
): number {
  const year = seniorityYearOn(employedSince, isoOf(month, 1));
  return vacationDaysPerYear(year) / MONTHS_PER_YEAR;
}

/** The part of a span that falls inside the month, or `null` if none does. The
 * clipped span is handed back to `balanceDaysOf`, so the entitlement rules — a
 * vacation span counts its non-Saturdays, a sick spell counts every day it ran
 * across — are applied by the module that already owns and tests them. */
function clipToMonth(span: MonthSpan, month: YearMonth): DaySpan | null {
  const monthStart = isoOf(month, 1);
  const monthEnd = isoOf(month, daysInMonth(month));
  const from = span.from < monthStart ? monthStart : span.from;
  const to = span.to > monthEnd ? monthEnd : span.to;
  if (from > to) return null;
  return { ...span, from, to };
}

/**
 * Days drawn from a balance in this month.
 *
 * A spell that began in the previous month draws only the days that fall in
 * this one: the spell is stored whole because its statutory tiers are counted
 * from its own first day (item 8), but the balance it draws belongs to the
 * month each day fell in.
 */
export function daysUsedIn(
  spans: MonthSpan[],
  month: YearMonth,
  kind: "vacation" | "sick",
): number {
  return spans
    .filter((span) => span.kind === kind)
    .map((span) => clipToMonth(span, month))
    .filter((span): span is DaySpan => span !== null)
    .reduce((days, span) => days + balanceDaysOf(span), 0);
}

/** What the month opens with. Absent for the worker's first month, which opens
 * from the opening position given once (specs.md item 6). */
export interface OpeningBalances {
  vacationDays: number;
  sickDays: number;
}

export function buildBalances(
  facts: MonthFacts,
  terms: WorkerTerms,
  opening?: OpeningBalances,
): BalanceLine[] {
  const start = opening ?? {
    vacationDays: terms.openingPosition.vacationDays,
    sickDays: terms.openingPosition.sickDays,
  };

  const vacationAccrued = monthlyVacationAccrual(terms.employedSince, facts.month);
  const vacationUsed = daysUsedIn(facts.spans, facts.month, "vacation");

  const sickUsed = daysUsedIn(facts.spans, facts.month, "sick");
  // The ceiling applies to what the balance may reach, so it is imposed on the
  // accrual rather than after the month's use is taken off: a balance already at
  // ninety accrues nothing, and the days used still come off it.
  const sickAccrued = Math.max(
    0,
    Math.min(start.sickDays + SICK_DAYS_PER_MONTH, SICK_DAY_CEILING) -
      start.sickDays,
  );

  return [
    {
      kind: "vacation",
      opening: start.vacationDays,
      accrued: vacationAccrued,
      used: vacationUsed,
      closing: start.vacationDays + vacationAccrued - vacationUsed,
      explanation: {
        text: he.sheet.why.vacationBalance(
          seniorityYearOn(terms.employedSince, isoOf(facts.month, 1)),
        ),
        link: "annualLeave",
      },
    },
    {
      kind: "sick",
      opening: start.sickDays,
      accrued: sickAccrued,
      used: sickUsed,
      closing: start.sickDays + sickAccrued - sickUsed,
      explanation: { text: he.sheet.why.sickBalance, link: "sickPay" },
    },
  ];
}
