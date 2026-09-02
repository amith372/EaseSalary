import { buildBalances, buildWarnings } from "@/lib/engine/balances";
import { countMonth, type MonthCounts } from "@/lib/engine/counts";
import {
  holidayDaysWorked,
  restDayUnitsOf,
} from "@/lib/engine/leave";
import { type LineDraft, toLine } from "@/lib/engine/lines";
import { deriveRates } from "@/lib/engine/rates";
import { sickDeductionDays } from "@/lib/engine/sick";
import {
  nationalInsuranceEstimateOf,
  thirdPartyLines,
} from "@/lib/engine/thirdParty";
import type {
  MonthContext,
  MonthFacts,
  Employment,
} from "@/lib/engine/types";
import { InvalidMonthError, validateMonth } from "@/lib/engine/validate";
import { he } from "@/lib/i18n/he";
import type {
  ClosingLine,
  ColumnSubtotal,
  MonthLine,
  MonthResult,
  SheetColumn,
} from "@/lib/types";

/**
 * One month, calculated. Pure: no clock, no I/O, no framework. One calculation
 * path serves both the on-screen preview and the export, so this is the shape
 * the .xlsx filler reads as well (specs.md Part 3).
 *
 * **The precision rule lives in `lines.ts`**, which is where a rate becomes an
 * amount and the only place the calculation rounds (specs.md item 3). The
 * totals below are therefore sums of already-rounded line amounts, which is
 * what makes the sheet add up by eye — a total rounded independently of its
 * lines can differ from them by an agora and look like a mistake.
 *
 * **There is no vacation line, and that is the point.** The base is computed
 * from the standard count and never shrinks, so a vacation line beside it would
 * pay the day a second time. Vacation reaches the sheet only as two figures in
 * the reporting block — days used, balance left — which are `BalanceLine`'s job
 * (specs.md item 7). A `vacationDays` key appearing here later is that double
 * payment coming back.
 */

/**
 * Explanation keys, stable from this commit so another screen can address one
 * figure without re-deriving it (specs.md item 24). An override replaces the
 * amount and sets `manual` without touching the key, so a manual figure is
 * still addressable and still says what it would otherwise have been (item 17).
 *
 * `sickDeduction` is emitted below, and `src/lib/engine/sick.ts` owns the
 * statutory tiers behind it: this file asks that module how many days the month
 * deducts and prices them, and restates none of the rule.
 */
export const lineKeys = {
  base: "base",
  fridaySupplement: "fridaySupplement",
  restDays: "restDays",
  holidaysWorked: "holidaysWorked",
  sickDeduction: "sickDeduction",
  incomeTax: "incomeTax",
} as const;

function buildLines(facts: MonthFacts, counts: MonthCounts): MonthLine[] {
  const rates = deriveRates(facts.confirmedWage.baseAgorot);
  const drafts: LineDraft[] = [];

  // Column E — the monthly salary items. The Friday supplement sits here and
  // not in F: Part 4 groups it with the base, and Part 5 gives F as "the pay
  // for Saturdays and holidays".
  drafts.push({
    key: lineKeys.base,
    label: he.sheet.lines.base,
    // One month at the monthly rate. The standard count is what the salary is
    // *derived* from and is reported separately; using it as the units would
    // break `units * rate = amount` and read as 26 days at a monthly price.
    units: 1,
    rate: facts.confirmedWage.baseAgorot,
    column: "E",
    explanation: {
      text: he.sheet.why.base(counts.standardDays),
      link: "caregiverWage",
    },
  });

  if (counts.fridaysPaidSupplement > 0 && facts.terms.fridaySupplementAgorot > 0) {
    drafts.push({
      key: lineKeys.fridaySupplement,
      label: he.sheet.lines.fridaySupplement,
      units: counts.fridaysPaidSupplement,
      rate: facts.terms.fridaySupplementAgorot,
      column: "E",
      explanation: {
        text: he.sheet.why.fridaySupplement(counts.fridaysPaidSupplement),
        link: "caregiverWage",
      },
    });
  }

  // The sickness deduction. It sits in column E and inside the same subtotal as
  // the base and the Friday supplement, and never among the one-off payments: a
  // deduction is not a payment (specs.md item 8). It is written here rather than
  // as a reduced base, because the base is computed from the standard count and
  // never shrinks — the deduction is what carries the statutory tiers onto a
  // sheet that has already paid the day in full.
  //
  // The days are negative and the rate is not. The rate is what a sick day is
  // worth — the same monthly salary over twenty-five the tiers themselves are
  // measured in (item 8) — and the sign belongs to the quantity, because what
  // this row records is days taken back off the month. A negative unit price in
  // column D is the reading Part 5 warns about in the other direction.
  const sickDays = sickDeductionDays(facts.spans, facts.month);
  if (sickDays > 0) {
    drafts.push({
      key: lineKeys.sickDeduction,
      label: he.sheet.lines.sickDeduction,
      units: -sickDays,
      rate: rates.daily,
      column: "E",
      explanation: {
        text: he.sheet.why.sickDeduction(sickDays),
        link: "sickPay",
      },
    });
  }

  // Column F — the pay for Saturdays and holidays, both at the rest-day rate,
  // and each day paid once between the two lines. `leave.ts` owns that
  // division: a Saturday she worked which is also a holiday she worked is left
  // with the holiday line and taken out of the Saturdays here, because both
  // lines pay the same rate off the same date and item 9 says the day is paid
  // once. `counts.saturdaysWorked` stays the true count of Saturdays attended.
  const restDayUnits = restDayUnitsOf(facts.spans, counts.saturdaysWorked);
  if (restDayUnits > 0) {
    drafts.push({
      key: lineKeys.restDays,
      label: he.sheet.lines.restDays,
      units: restDayUnits,
      rate: rates.restDay,
      column: "F",
      explanation: {
        text: he.sheet.why.restDays(restDayUnits),
        link: "restDayWork",
      },
    });
  }

  // A holiday she works is paid at the rest-day rate; one she does not work
  // earns nothing extra, because the monthly salary is paid on it in full
  // (item 9). Counted in days and not in spans, and a part day is paid in its
  // own proportion (item 10).
  const holidaysWorked = holidayDaysWorked(facts.spans);
  if (holidaysWorked > 0) {
    drafts.push({
      key: lineKeys.holidaysWorked,
      label: he.sheet.lines.holidaysWorked,
      units: holidaysWorked,
      rate: rates.restDay,
      column: "F",
      explanation: {
        text: he.sheet.why.holidaysWorked(holidaysWorked),
        link: "holidayWork",
      },
    });
  }

  // Column G — the one-off payments, each with the reason the user gave it.
  for (const extra of facts.extraPayments) {
    drafts.push({
      key: `extra.${extra.id}`,
      label: extra.label,
      units: 1,
      rate: extra.agorot,
      column: "G",
      explanation: { text: he.sheet.why.extra },
    });
  }

  // Column H — money paid to third parties, and excluded from the total:
  // reading H as salary would overpay the worker (item 16, Part 5).
  // `thirdParty.ts` owns those lines and the national-insurance estimate
  // beside them, and this file restates neither.
  return [
    ...drafts.map((draft) => toLine(draft, facts.overrides)),
    ...thirdPartyLines(facts.thirdPartyPayments, facts.overrides),
  ];
}

/**
 * The block below the columns. It grows with the month's advances rather than
 * being chosen from a fixed set of shapes (Part 5), and it carries the
 * income-tax line, which is never calculated and defaults to zero (item 17).
 *
 * The income-tax row belongs here and not in column E because the gross is what
 * she earned: tax is withheld from it on the way to what is actually
 * transferred, exactly as the advance instalment is.
 */
function buildClosing(facts: MonthFacts): ClosingLine[] {
  const rows: ClosingLine[] = [];

  const taxOverride = facts.overrides[lineKeys.incomeTax];
  const tax = taxOverride ? taxOverride.agorot : facts.incomeTaxAgorot;
  rows.push({
    key: lineKeys.incomeTax,
    label: he.sheet.lines.incomeTax,
    // Withheld, so it subtracts. Held as a positive figure on the facts and
    // signed here, so a caller cannot enter a tax that pays the worker. The
    // `|| 0` is not decoration: negating a rounded zero gives -0, which
    // `Object.is` — and so `toBe` — reports as different from 0.
    amount: -Math.abs(Math.round(tax)) || 0,
    manual: taxOverride !== undefined || facts.incomeTaxAgorot !== 0,
    // The application never calculates the tax, so the link is the whole of what
    // it can give the user before she types a figure (specs.md items 17, 26).
    explanation: { text: he.sheet.why.incomeTax, link: "incomeTax" },
  });

  for (const advance of facts.advances) {
    const granted = advance.kind === "granted";
    const key = `advance.${advance.number}.${advance.kind}`;
    const override = facts.overrides[key];
    const agorot = override ? override.agorot : Math.abs(advance.agorot);
    rows.push({
      key,
      label: granted
        ? he.sheet.lines.advanceGranted
        : he.sheet.lines.advanceRepaid,
      amount: granted ? Math.round(agorot) : -Math.round(agorot),
      manual: override !== undefined,
      explanation: {
        text: granted
          ? he.sheet.why.advanceGranted(advance.number)
          : he.sheet.why.advanceRepaid(advance.number),
      },
    });
  }

  return rows;
}

/** Columns E, F and G alone — H is deliberately excluded (item 16, Part 5). */
const COLUMNS_THAT_REACH_THE_WORKER: SheetColumn[] = ["E", "F", "G"];

const ALL_COLUMNS: SheetColumn[] = ["E", "F", "G", "H"];

/**
 * One subtotal per column the month has lines in, so a column with nothing in
 * it prints nothing rather than a zero. Two of the sheet's four total lines are
 * here; `gross` and `net` are the other two (criterion 1).
 */
function buildSubtotals(lines: MonthLine[]): ColumnSubtotal[] {
  return ALL_COLUMNS.filter((column) =>
    lines.some((line) => line.column === column),
  ).map((column) => ({
    column,
    label: he.sheet.subtotals[column],
    amount: lines
      .filter((line) => line.column === column)
      .reduce((total, line) => total + (line.amount ?? 0), 0),
    explanation: { text: he.sheet.why.subtotal[column] },
  }));
}

export function calculateMonth(
  facts: MonthFacts,
  employment: Employment,
  context: MonthContext = {},
): MonthResult {
  const refusals = validateMonth(facts, employment, context);
  if (refusals.length > 0) throw new InvalidMonthError(refusals);

  const counts = countMonth(facts);
  const lines = buildLines(facts, counts);
  const closing = buildClosing(facts);

  const gross = lines
    .filter((line) => COLUMNS_THAT_REACH_THE_WORKER.includes(line.column))
    .reduce((total, line) => total + (line.amount ?? 0), 0);

  const net = closing.reduce(
    (total, row) => total + (row.amount ?? 0),
    gross,
  );

  return {
    month: facts.month,
    standardDays: counts.standardDays,
    actualDays: counts.actualDays,
    lines,
    subtotals: buildSubtotals(lines),
    closing,
    gross,
    net,
    balances: buildBalances(facts, employment, context.openingBalances),
    warnings: buildWarnings(facts, context),
    // An estimate to be confirmed, never a fact (item 19), and never the money
    // that actually left the account — that appears once, in the month it was
    // paid, as a column H line of its own. `thirdParty.ts` holds both.
    nationalInsuranceEstimate: nationalInsuranceEstimateOf(gross),
  };
}
