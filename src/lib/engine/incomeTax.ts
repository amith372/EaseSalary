import { rateInForce } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import { bracketsForYear } from "@/lib/taxBrackets";
import type { TaxBracket, TaxYearBrackets } from "@/lib/taxBrackets";
import type { Gender, IncomeTaxSetting } from "@/lib/engine/types";
import type { YearMonth } from "@/lib/types";

/**
 * The income tax withheld from one month (specs.md Part 1 item 17,
 * build_plan.md stage 3, approved 2026-09-10).
 *
 * **This file exists because the rule reversed.** Until 2026-09-10 both
 * `specs.md` and `CLAUDE.md` said income tax is never calculated and the line
 * is simply typed; both now say the opposite, and the old wording was replaced
 * rather than qualified. It lands in stage 3 and not in stage 2 because the
 * count of credit points turns on the worker's **gender**, and that is a
 * profile field stage 3 builds.
 *
 * **Nothing here is a judgement call.** Kol Zchut's
 * `נקודות זיכוי ממס הכנסה לעובד זר`, read on 2026-09-10: a legally employed
 * foreign worker **in home care** gets 2.25 credit points, one in any other
 * sector gets 1, and a **woman gets half a point more** in either. This
 * application employs only caregivers, so the gender is the whole of what the
 * count turns on and it is never asked for as a number.
 *
 * **The whole calculation is annual and the month is a twelfth of it**, because
 * the statute's brackets are annual and its credit point is annual. The source
 * page says so outright — מדרגות המס מחושבות על בסיס הכנסה שנתית בלבד — and
 * prints its monthly column marked לצורך המחשה בלבד. So a month's gross is
 * annualised, taxed, credited, and divided back; doing it the other way round
 * would need a second set of monthly bounds that nobody publishes and that
 * could disagree with the annual ones.
 *
 * **It reads no clock, no store and no profile.** The gross, the tables and the
 * gender all arrive from the caller, exactly as `today` and `rates` already do
 * (`CLAUDE.md`).
 */

/**
 * The credit points a legally employed **foreign caregiver** holds.
 *
 * Not a rate and not dated, which is why it is a constant here rather than a
 * row in `datedRates.ts`: that table holds the figures the application takes
 * from outside itself and that move — a wage that steps each April, a
 * recuperation day restated each July, the money one credit point is worth.
 * The *number of points* is a statutory entitlement attached to who the worker
 * is, and it has not moved. Should it ever move, it moves here and it moves
 * with a citation, the way every other figure in this repository does.
 */
export const CAREGIVER_CREDIT_POINTS = 2.25;

/** The half point a woman holds on top, in either sector (Kol Zchut, as
 * above). */
export const WOMANS_EXTRA_CREDIT_POINTS = 0.5;

/**
 * How many credit points this worker holds.
 *
 * **The user is never asked this**, and that is the point of deriving it: a
 * family that had to answer "how many credit points" would be answering a
 * question about tax law, and the standing rule is to choose the option that
 * requires the user to know less. She states a gender on the profile, which is
 * a fact about the worker, and the entitlement follows from it.
 */
export function creditPointsFor(gender: Gender): number {
  return (
    CAREGIVER_CREDIT_POINTS +
    (gender === "female" ? WOMANS_EXTRA_CREDIT_POINTS : 0)
  );
}

/**
 * The tax on a whole year's income, before any credit, at full precision.
 *
 * **Each bracket taxes only the slice inside it**, which is the one thing about
 * a progressive table that is easy to get wrong in a way that still looks
 * plausible: taxing the whole income at the rate of the bracket it lands in
 * overcharges by thousands and produces a perfectly ordinary-looking figure.
 *
 * The table is walked in the order it is held, and `taxBrackets.ts` states that
 * the order is part of the value rather than something a caller sorts.
 */
export function annualTaxBeforeCredits(
  annualAgorot: number,
  brackets: TaxBracket[],
): number {
  let tax = 0;
  let taxedUpTo = 0;
  for (const bracket of brackets) {
    if (annualAgorot <= taxedUpTo) break;
    const top = bracket.upToAnnualAgorot ?? annualAgorot;
    const slice = Math.min(annualAgorot, top) - taxedUpTo;
    if (slice > 0) tax += slice * bracket.rate;
    taxedUpTo = top;
  }
  return tax;
}

/** Everything the calculation needs, and nothing it could read for itself. */
export interface IncomeTaxInput {
  /** The month's gross in integer agorot — the ברוטו, which is what the sheet's
   * own tax line is withheld from (specs.md Part 5). */
  grossAgorot: number;
  /** The table for the tax year this month falls in. */
  brackets: TaxBracket[];
  /** What one credit point is worth **a year**, in agorot — the unit
   * `datedRates.ts` states for `creditPointValue`. */
  creditPointValueAnnualAgorot: number;
  gender: Gender;
}

/**
 * The tax withheld from one month, in integer agorot.
 *
 * **Floored at zero, because a credit is not a refund.** Credit points reduce
 * tax to nothing and then stop; they never pay the worker. At the minimum wage
 * this is not an edge case but the ordinary answer — the tax on ₪6,443.85 a
 * month is ₪644.39 and a woman's 2.75 points are worth ₪665.50 a month, so the
 * line is zero and stays zero until the salary passes about ₪6,655 a month.
 *
 * **Rounded once, at the end.** The annual figure, the division by twelve and
 * the credit are all carried at full precision and only the answer becomes an
 * integer agora (`CLAUDE.md`).
 */
export function incomeTaxForMonth(input: IncomeTaxInput): number {
  const annualTax = annualTaxBeforeCredits(
    input.grossAgorot * 12,
    input.brackets,
  );
  const monthlyCredit =
    (creditPointsFor(input.gender) * input.creditPointValueAnnualAgorot) / 12;
  return Math.max(0, Math.round(annualTax / 12 - monthlyCredit));
}

/**
 * The month's tax, or `null` where the application has no honest figure.
 *
 * **`null` is an answer and not a failure**, for `rateInForce`'s own reason: a
 * year with no bracket table, or a month before the credit point has a dated
 * value, has no tax this application can work out, and reaching for the nearest
 * year's table would be exactly the undated guess these tables exist to remove
 * — brackets are restated every January, so the nearest year is precisely the
 * wrong one. The month leaves the line at zero and raises a warning rather than
 * withholding a number nobody can cite.
 *
 * **The tax year is the month's own calendar year**, which is the whole of the
 * rule: Israel's tax year is the calendar year, so a month is taxed by the
 * table for the year it falls in.
 */
export function monthlyIncomeTax(
  grossAgorot: number,
  month: YearMonth,
  gender: Gender,
  rates: DatedRate[],
  tables: TaxYearBrackets[],
): number | null {
  const table = bracketsForYear(tables, month.year);
  if (table === null) return null;
  const creditPoint = rateInForce(rates, "creditPointValue", month);
  if (creditPoint === null) return null;
  return incomeTaxForMonth({
    grossAgorot,
    brackets: table.brackets,
    creditPointValueAnnualAgorot: creditPoint.value,
    gender,
  });
}

/**
 * The tax the month's own **setting** arrives at, or `null` where the
 * application has no honest figure (specs.md item 17, settled with the user on
 * 2026-09-11).
 *
 * **The setting is read off the month and never off the profile** (Part 3).
 * `terms.incomeTax` was snapshotted when the month was confirmed, so a family
 * that stops withholding in June leaves January through May exactly as they
 * were filed.
 *
 * `none` is a settled zero and not an absence: it is a decision the family made
 * once, so it raises no warning and needs no table. `percentage` needs no table
 * either — it is the figure an accountant handed the family, and the
 * application has no standing to disbelieve a number it did not derive, which
 * is the same position `reviewRecuperationRate` takes.
 */
export function taxForSetting(
  setting: IncomeTaxSetting,
  grossAgorot: number,
  month: YearMonth,
  gender: Gender,
  rates: DatedRate[],
  tables: TaxYearBrackets[],
): number | null {
  switch (setting.mode) {
    case "none":
      return 0;
    case "percentage":
      return taxFromPercentage(setting.percentage ?? 0, grossAgorot);
    case "automatic":
      return monthlyIncomeTax(grossAgorot, month, gender, rates, tables);
  }
}

/**
 * What share of the month's ברוטו was actually withheld, as a fraction, or
 * `null` where there is nothing to take a share of.
 *
 * **It is reported and never entered**, which is the whole point of showing it:
 * the automatic mode arrives at a different percentage every month, because the
 * brackets are progressive and the credit is a fixed sum — so the one number a
 * family would otherwise have to work out for itself to compare against an
 * accountant's advice is the one the application can simply state.
 *
 * A month with no gross has no share, rather than a share of zero: dividing by
 * nothing is how a percentage sign ends up beside an infinity.
 */
export function effectiveTaxRate(
  taxAgorot: number,
  grossAgorot: number,
): number | null {
  if (grossAgorot <= 0) return null;
  return taxAgorot / grossAgorot;
}

/**
 * A percentage of the month's ‏ברוטו‎, as an amount in integer agorot.
 *
 * Rounded once, here, where the fraction becomes an amount — and floored at
 * zero so that a rate arriving negative past a form cannot pay her.
 *
 * **Two callers on purpose**: the worker's own `percentage` setting, and a
 * correction the user types against a single month as a percentage rather than
 * as a sum (asked for on 2026-09-11). Both mean the same arithmetic, and one
 * function is what keeps the month she corrected by hand agreeing to the agora
 * with the month the setting produced.
 */
export function taxFromPercentage(
  percentage: number,
  grossAgorot: number,
): number {
  return Math.max(0, Math.round(grossAgorot * percentage));
}

/**
 * A percentage as the user typed it, as a fraction — or `null` where it is not
 * a percentage anyone could have meant.
 *
 * **Zero is refused**, as it is on the profile: `none` is how a family says
 * nothing is withheld, and on a month an empty field is how she says the
 * application's own figure stands. A typed zero on a month *is* meaningful —
 * "this month withholds nothing" — but it is meaningful as an **amount**, which
 * is the other unit, so nothing is lost by refusing it here. Above 100 is
 * refused because it withholds more than the month paid.
 *
 * Decimals are allowed (settled with the user on 2026-09-11): 2.5% is an
 * ordinary rate and a control that only took whole numbers would send the user
 * to work it out as a sum instead.
 */
export function reviewTaxPercentage(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return null;
  // Held as a fraction — 0.025, not 2.5 — which is the unit `dated_rates`
  // already holds `nationalInsurance` in. The division is the only place the
  // two units meet.
  return percent / 100;
}

/**
 * Which unit a correction to one month's tax was typed in.
 *
 * The stored value is an amount either way: an override is an amount over a
 * calculated figure, and a percentage that stayed a percentage would silently
 * re-derive itself the next time anything about the month moved — which is the
 * one thing an override must never do (item 17).
 */
export const taxCorrectionUnits = ["amount", "percentage"] as const;

export type TaxCorrectionUnit = (typeof taxCorrectionUnits)[number];
