import { daysInMonth, fromIsoDate, isoOf, monthHasEnded } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { rateInForce } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import { recuperationDaysFor } from "@/lib/engine/recuperation";
import type {
  ClosedMonthFacts,
  ClosedSpan,
  MonthContext,
  Employment,
} from "@/lib/engine/types";
import { sickDaysIn } from "@/lib/engine/sick";
import { he } from "@/lib/i18n/he";
import { balanceDaysOf } from "@/lib/spans";
import type {
  BalanceLine,
  ClosedDaySpan,
  IsoDate,
  Warning,
  YearMonth,
} from "@/lib/types";

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
 *
 * A twelfth has no exact form in binary floating point, so twelve carried-
 * forward months of fourteen twelfths land 2e-15 short of fourteen. That
 * residue is representation and not rounding — it is thirteen orders of
 * magnitude below the hundredth of a day Part 5 is about, and `formatDays`
 * cannot show it — so it is left alone rather than snapped away: snapping a
 * balance each month would bias the carry-forward in one direction and rebuild
 * the very drift this file exists to avoid. `balances.test.ts` asserts the
 * twelve-month figure to a ten-billionth of a day for that reason, and asserts
 * separately that the monthly figure is `14 / 12` and not the workbook's 1.17.
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
 * The seniority year a calendar year is, counting the first as 1.
 *
 * **The year here is the calendar year, not the employment year.** That is how
 * the Annual Leave Act measures one: it turns over on the 1st of January, and a
 * worker who started mid-year completes her first working year on the 31st of
 * December of that same year even though she did not work twelve months of it
 * (specs.md item 7). A worker employed from 1.4.2024 is therefore in her first
 * year through 2024 and her fifth through 2028, and steps to sixteen days on
 * 1.1.2028 — not on an anniversary in April.
 *
 * A partial calendar year still counts as a whole year on the ladder. What it
 * reduces is the entitlement earned *inside* it, and that needs no proration of
 * its own: nine months of employment accrue nine monthly twelfths.
 *
 * Recuperation is the one entitlement that stays on the employment anniversary
 * (item 15), and it says so there. The two disagreeing is correct, not an
 * oversight in either.
 */
export function seniorityYearOfCalendarYear(
  employedSince: IsoDate,
  calendarYear: number,
): number {
  return calendarYear - fromIsoDate(employedSince).getUTCFullYear() + 1;
}

/** The month's vacation accrual, as a fraction of the year's entitlement and
 * never as a decimal (Part 5). Every month of a calendar year accrues at the
 * same rate, because the ladder steps on the 1st of January and nowhere else. */
export function monthlyVacationAccrual(
  employedSince: IsoDate,
  month: YearMonth,
): number {
  const year = seniorityYearOfCalendarYear(employedSince, month.year);
  return vacationDaysPerYear(year) / MONTHS_PER_YEAR;
}

/** The part of a span that falls inside the month, or `null` if none does. The
 * clipped span is handed back to `balanceDaysOf`, so the entitlement rules — a
 * vacation span counts its non-rest-days, a sick spell counts every day it ran
 * across — are applied by the module that already owns and tests them. */
function clipToMonth(span: ClosedSpan, month: YearMonth): ClosedDaySpan | null {
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
 *
 * **The two kinds are counted from different things, and that is the rule
 * rather than an implementation detail.** Vacation is counted from the spans
 * the user marked, because a vacation day is a day she asked for. Sickness is
 * counted from the **spell**, because for a worker on a monthly salary the
 * period of illness runs over calendar days and the days inside it are deducted
 * from the accrued quota whether or not anybody marked them (item 8). So a
 * family that marks Friday and Sunday and leaves the Saturday between them alone
 * draws three days and not two — the same three a single swept range would have
 * drawn, which is the point: what she drew stops depending on how the days were
 * entered.
 */
export function daysUsedIn(
  spans: ClosedSpan[],
  month: YearMonth,
  kind: "vacation" | "sick",
  restDay: RestDay,
): number {
  // Every day of every spell that falls in this month, tiers and all — the one
  // place that knows what a spell is, asked rather than restated.
  if (kind === "sick") return sickDaysIn(spans, month, restDay).length;
  return spans
    .filter((span) => span.kind === kind)
    .map((span) => clipToMonth(span, month))
    .filter((span): span is ClosedDaySpan => span !== null)
    .reduce((days, span) => days + balanceDaysOf(span, restDay), 0);
}

/** What the month opens with. Absent for the worker's first month, which opens
 * from the opening position given once (specs.md item 6). */
export interface OpeningBalances {
  vacationDays: number;
  sickDays: number;
}

/**
 * What this month opens with: the previous month's closing figures, or — for
 * the worker's first month — the opening position given once (specs.md items 6
 * and 7). Resolved in one place so the balance lines and the refusal that
 * guards the sick floor can never disagree about where a month starts.
 */
function openingBalancesOf(
  employment: Employment,
  opening?: OpeningBalances,
): OpeningBalances {
  return (
    opening ?? {
      vacationDays: employment.openingPosition.vacationDays,
      sickDays: employment.openingPosition.sickDays,
    }
  );
}

/**
 * The month's sick accrual.
 *
 * The ceiling applies to what the balance may **reach**, so it is imposed on the
 * accrual rather than after the month's use is taken off: a balance already at
 * ninety accrues nothing, and the days used still come off it (specs.md
 * items 7, 8).
 */
export function monthlySickAccrual(openingSickDays: number): number {
  return Math.max(
    0,
    Math.min(openingSickDays + SICK_DAYS_PER_MONTH, SICK_DAY_CEILING) -
      openingSickDays,
  );
}

/**
 * The most sick days this month can draw: what it opened with plus what it
 * accrued in it. The month's own accrual is earned in the month and is
 * therefore available to it, which is what makes this the same figure the
 * balance line prints as `opening + accrued`.
 *
 * The sick balance is a floor and never falls below zero (specs.md item 8), so
 * this is the figure `validateMonth` refuses against.
 */
export function sickDaysAvailable(
  employment: Employment,
  opening?: OpeningBalances,
): number {
  const start = openingBalancesOf(employment, opening);
  return start.sickDays + monthlySickAccrual(start.sickDays);
}

export function buildBalances(
  facts: ClosedMonthFacts,
  employment: Employment,
  opening?: OpeningBalances,
): BalanceLine[] {
  const start = openingBalancesOf(employment, opening);

  const vacationAccrued = monthlyVacationAccrual(employment.employedSince, facts.month);
  const vacationUsed = daysUsedIn(
    facts.spans,
    facts.month,
    "vacation",
    facts.terms.restDay,
  );

  const sickUsed = daysUsedIn(
    facts.spans,
    facts.month,
    "sick",
    facts.terms.restDay,
  );
  const sickAccrued = monthlySickAccrual(start.sickDays);

  return [
    {
      kind: "vacation",
      opening: start.vacationDays,
      accrued: vacationAccrued,
      used: vacationUsed,
      closing: start.vacationDays + vacationAccrued - vacationUsed,
      explanation: {
        text: he.sheet.why.vacationBalance(
          seniorityYearOfCalendarYear(employment.employedSince, facts.month.year),
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

/** The Annual Leave Act asks for at least seven vacation days in a year
 * (specs.md item 7). */
const VACATION_DAYS_A_YEAR_THE_LAW_ASKS_FOR = 7;

const DECEMBER = 12;

/**
 * The seven-day warning: a calendar year that passed with fewer than seven
 * vacation days taken in it (specs.md item 7).
 *
 * It is said in the December that closes the year, because that is the month in
 * which the year has *passed* — a warning raised in March would be about a year
 * still running, and item 7 is explicit that the point is not pressed further.
 * It changes no figure and blocks no export.
 *
 * One month cannot see the rest of its own year, so what was drawn earlier in
 * the calendar year is handed in through `MonthContext`; a month standing alone
 * is read as the year's only month.
 */
export function vacationYearWarning(
  facts: ClosedMonthFacts,
  context: MonthContext = {},
): Warning | null {
  if (facts.month.month !== DECEMBER) return null;
  const daysThisYear =
    (context.vacationDaysEarlierInYear ?? 0) +
    daysUsedIn(facts.spans, facts.month, "vacation", facts.terms.restDay);
  if (daysThisYear >= VACATION_DAYS_A_YEAR_THE_LAW_ASKS_FOR) return null;
  return {
    key: "vacationUnderSeven",
    message: he.sheet.warnings.vacationUnderSeven(
      facts.month.year,
      daysThisYear,
    ),
    link: "annualLeave",
  };
}

/**
 * The month that has not ended yet: it takes facts and cannot be exported
 * (specs.md item 21).
 *
 * **It is a warning and not a refusal**, which is the whole of item 21: a
 * refusal would stop the calculation, and a month filled in ahead of time is
 * meant to be calculated — the preview is how the family sees what next month
 * will cost. Part 5 puts it the same way: such a month is a draft that cannot
 * be confirmed, and not a fifth state of its own.
 *
 * **The condition is `today` and it is never a clock** (`CLAUDE.md`). A caller
 * that passes none is calculating a month in the abstract — the workbook tests
 * do exactly that — and gets no warning, because nothing has told it when now
 * is. The month screen and the export both pass one.
 */
export function monthNotEndedWarning(
  facts: ClosedMonthFacts,
  context: MonthContext = {},
): Warning | null {
  const today = context.today;
  if (today === undefined) return null;
  if (monthHasEnded(facts.month, today)) return null;
  return { key: "monthNotEnded", message: he.sheet.warnings.monthNotEnded };
}

/**
 * The recuperation month that cannot price what it owes (specs.md item 15).
 *
 * **It is a warning and not a refusal**, for item 21's reason: the month is
 * still calculable and the rest of its figures are still correct, and a refusal
 * would take the whole month away over one line. What it must not do is stay
 * silent — a recuperation month whose line is simply absent looks like an
 * ordinary month, which is the class of mistake `specs.md` Part 5 is about.
 *
 * It fires only where a rate is owed and none exists: the month carries none
 * because it has not been through the pre-export confirmation, and the
 * dated-rates table begins after it. Every month from July 2025 on has a seeded
 * figure, so this is a fence around a gap rather than a case that arises.
 */
export function recuperationRateMissingWarning(
  facts: ClosedMonthFacts,
  employment: Employment,
  rates: DatedRate[],
): Warning | null {
  const days = recuperationDaysFor(
    employment.employedSince,
    facts.terms.recuperationMonth,
    facts.month,
  );
  if (days === 0) return null;
  if (facts.recuperationDayRateAgorot !== undefined) return null;
  if (rateInForce(rates, "recuperationDayRate", facts.month) !== null) {
    return null;
  }
  return {
    key: "recuperationRateMissing",
    message: he.sheet.warnings.recuperationRateMissing(days),
    link: "recuperation",
  };
}

/** Every warning the month raises. A list from the first commit, because a
 * second warning arriving later must not change the shape the screen reads. */
export function buildWarnings(
  facts: ClosedMonthFacts,
  employment: Employment,
  rates: DatedRate[],
  context: MonthContext = {},
): Warning[] {
  return [
    monthNotEndedWarning(facts, context),
    vacationYearWarning(facts, context),
    recuperationRateMissingWarning(facts, employment, rates),
  ].filter(
    (warning): warning is Warning => warning !== null,
  );
}
