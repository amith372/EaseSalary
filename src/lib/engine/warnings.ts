import { DECEMBER } from "@/lib/dates";
import { rateInForce } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import { lineKeys } from "@/lib/engine/lines";
import { daysUsedIn, vacationDaysTheLawAsksFor } from "@/lib/engine/balances";
import { recuperationDaysInMonth } from "@/lib/engine/recuperation";
import { AS_SHIPPED } from "@/lib/engine/types";
import type {
  ClosedMonthFacts,
  MonthContext,
  Employment,
} from "@/lib/engine/types";
import { formatAgorot } from "@/lib/money";
import { he } from "@/lib/i18n/he";
import { bracketsForYear } from "@/lib/taxBrackets";
import type { TaxYearBrackets } from "@/lib/taxBrackets";
import type { Warning } from "@/lib/types";

/**
 * What a month says beside its figures without changing any of them (specs.md
 * items 4, 7, 15, 16 and 17): the builders, and `buildWarnings`, which asks
 * each in turn.
 */

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
  employment: Pick<Employment, "employedSince">,
  context: MonthContext = AS_SHIPPED,
): Warning | null {
  if (facts.month.month !== DECEMBER) return null;
  const required = vacationDaysTheLawAsksFor(
    employment.employedSince,
    facts.month.year,
  );
  const daysThisYear =
    (context.vacationDaysEarlierInYear ?? 0) +
    daysUsedIn(facts.spans, facts.month, "vacation", facts.terms.restDay);
  if (daysThisYear >= required) return null;
  return {
    key: "vacationUnderSeven",
    message: he.sheet.warnings.vacationUnderSeven(
      facts.month.year,
      daysThisYear,
      required,
    ),
    link: "annualLeave",
  };
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
function recuperationRateMissingWarning(
  facts: ClosedMonthFacts,
  employment: Employment,
  rates: DatedRate[],
): Warning | null {
  const days = recuperationDaysInMonth(
    employment,
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
    message: he.sheet.warnings.recuperationRateMissing(days, employment.gender),
    link: "recuperation",
  };
}

/**
 * The tax year this month has no bracket table for, or `null` where it has one.
 *
 * **It fires only where the application would otherwise withhold a number it
 * cannot cite.** The tables are seeded for 2025 and 2026 and a fetch adds
 * years; a month outside every table gets no tax, the line stays at zero, and
 * this says so. A month whose gross is genuinely below the credit is a
 * different thing entirely — that is a calculated zero and raises nothing.
 *
 * A month carrying a **confirmed** tax raises nothing either: the figure was
 * settled before the export and stored, which is exactly the case the tables
 * are not needed for (item 17).
 */
function taxBracketsMissingWarning(
  facts: ClosedMonthFacts,
  rates: DatedRate[],
  tables: TaxYearBrackets[],
): Warning | null {
  // Only the automatic mode needs a table. `none` is a settled zero and
  // `percentage` is the figure an accountant handed the family, so neither has
  // anything a missing bracket table could stop.
  if (facts.terms.incomeTax.mode !== "automatic") return null;
  if (facts.incomeTaxAgorot !== undefined) return null;
  if (facts.overrides[lineKeys.incomeTax] !== undefined) return null;
  const haveTable = bracketsForYear(tables, facts.month.year) !== null;
  const havePoint = rateInForce(rates, "creditPointValue", facts.month) !== null;
  if (haveTable && havePoint) return null;
  return {
    key: "taxBracketsMissing",
    message: he.sheet.warnings.taxBracketsMissing(facts.month.year),
    link: "incomeTax",
  };
}

/**
 * The month is paying less than the minimum wage that was in force during it,
 * or `null` where it is not.
 *
 * **This is the one rule in the application that is not a preference.** The
 * floor itself is applied in `baseForMonth`, at the pre-export confirmation —
 * so a month reaches the family's hands correct, and without this warning a
 * month sitting on screen beforehand would be wrong with nothing to say so. A
 * family checks the figure on the screen; the confirmation is a step they meet
 * once, at the end.
 *
 * **A month is measured against the wage in force during *it*** (item 4), never
 * against today's: a month filed before a rise is not underpaid because a rise
 * happened afterwards, and a warning that said so would be the undated
 * comparison the dated-rates table exists to remove.
 *
 * **The table not knowing the month raises nothing.** A month earlier than every
 * row has no minimum this application can cite, and item 4 is explicit that it
 * then says nothing rather than reaching for the earliest row.
 */
export function belowMinimumWageWarning(
  facts: ClosedMonthFacts,
  rates: DatedRate[],
): Warning | null {
  const inForce = rateInForce(rates, "minimumWage", facts.month);
  if (inForce === null) return null;
  if (facts.confirmedWage.baseAgorot >= inForce.value) return null;
  return {
    key: "belowMinimumWage",
    message: he.sheet.warnings.belowMinimumWage(
      formatAgorot(facts.confirmedWage.baseAgorot),
      formatAgorot(inForce.value),
    ),
    link: "minimumWage",
  };
}

/**
 * A premium was paid and the profile names nobody to have paid it to, or
 * `null` where it does (specs.md item 16).
 *
 * **It fires only where the sheet would otherwise print half a sentence.** Row
 * 10 reads "ביטוח רפואי לעובד/ת - שולם באמצעות …", and the end of that sentence
 * is a placeholder filled from the profile, so a month that pays a premium with
 * an empty profile exports a sentence that stops mid-air — which is the state
 * this asks the user to fix before she meets it in the file.
 *
 * A month that paid no premium raises nothing: the row is empty, the sentence
 * is never reached, and chasing every month for a field most of them do not use
 * is exactly the noise item 27's warnings are supposed not to be.
 */
function insurerMissingWarning(
  facts: ClosedMonthFacts,
  employment: Employment,
): Warning | null {
  const paidAPremium = facts.thirdPartyPayments.some(
    (payment) => payment.kind === "medicalInsurance",
  );
  if (!paidAPremium) return null;
  if ((employment.insurer ?? "").trim() !== "") return null;
  return { key: "insurerMissing", message: he.sheet.warnings.insurerMissing };
}

/** Every warning the month raises. A list from the first commit, because a
 * second warning arriving later must not change the shape the screen reads. */
export function buildWarnings(
  facts: ClosedMonthFacts,
  employment: Employment,
  rates: DatedRate[],
  context: MonthContext = AS_SHIPPED,
): Warning[] {
  return [
    belowMinimumWageWarning(facts, rates),
    vacationYearWarning(facts, employment, context),
    recuperationRateMissingWarning(facts, employment, rates),
    insurerMissingWarning(facts, employment),
    taxBracketsMissingWarning(facts, rates, context.taxBrackets),
  ].filter(
    (warning): warning is Warning => warning !== null,
  );
}
