import { buildBalances } from "@/lib/engine/balances";
import { countMonth, type MonthCounts } from "@/lib/engine/counts";
import { deriveRates } from "@/lib/engine/rates";
import type { MonthFacts, WorkerTerms } from "@/lib/engine/types";
import {
  InvalidMonthError,
  validateMonth,
  type MonthContext,
} from "@/lib/engine/validate";
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
 * **The precision rule.** A rate carries its fraction and is never rounded; a
 * line amount is integer agorot, rounded exactly once with `Math.round` at the
 * moment it becomes a `MonthLine.amount`. Nothing rounds between the two
 * (item 3). The totals are then sums of already-rounded line amounts, which is
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
 * `sickDeduction` is reserved here and emitted in Step 5, which owns the
 * statutory tiers: it belongs to this list because the key set is fixed now,
 * not because this file writes the line.
 */
export const lineKeys = {
  base: "base",
  fridaySupplement: "fridaySupplement",
  restDays: "restDays",
  holidaysWorked: "holidaysWorked",
  sickDeduction: "sickDeduction",
  incomeTax: "incomeTax",
} as const;

/**
 * A line before it is rounded. `units * rate` is the amount, always: the base
 * salary is one month at the monthly rate, never 26 days at it. Writing a draft
 * this way is what keeps the invariant true by construction rather than by
 * everyone remembering it.
 */
interface Draft {
  key: string;
  label: string;
  units: number;
  /** The unit price — column D. Full precision, never rounded here. */
  rate: number;
  column: SheetColumn;
  explanation: MonthLine["explanation"];
}

function toLine(draft: Draft, facts: MonthFacts): MonthLine {
  const override = facts.overrides[draft.key];
  return {
    key: draft.key,
    label: draft.label,
    units: draft.units,
    rate: draft.rate,
    column: draft.column,
    // The one rounding in the whole calculation: a rate carries its fraction up
    // to here and the amount is integer agorot from here on (item 3).
    amount: override ? override.agorot : Math.round(draft.units * draft.rate),
    manual: override !== undefined,
    explanation: draft.explanation,
  };
}

function buildLines(
  facts: MonthFacts,
  terms: WorkerTerms,
  counts: MonthCounts,
): MonthLine[] {
  const rates = deriveRates(facts.confirmedWage.baseAgorot);
  const drafts: Draft[] = [];

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

  if (counts.fridaysPaidSupplement > 0 && terms.fridaySupplementAgorot > 0) {
    drafts.push({
      key: lineKeys.fridaySupplement,
      label: he.sheet.lines.fridaySupplement,
      units: counts.fridaysPaidSupplement,
      rate: terms.fridaySupplementAgorot,
      column: "E",
      explanation: {
        text: he.sheet.why.fridaySupplement(counts.fridaysPaidSupplement),
        link: "caregiverWage",
      },
    });
  }

  // Column F — the pay for Saturdays and holidays, both at the rest-day rate.
  if (counts.saturdaysWorked > 0) {
    drafts.push({
      key: lineKeys.restDays,
      label: he.sheet.lines.restDays,
      units: counts.saturdaysWorked,
      rate: rates.restDay,
      column: "F",
      explanation: {
        text: he.sheet.why.restDays(counts.saturdaysWorked),
        link: "restDayWork",
      },
    });
  }

  // A holiday she works is paid at the rest-day rate; one she does not work
  // earns nothing extra, because the monthly salary is paid on it in full
  // (item 9). A holiday on a Saturday she works is paid once, not twice — it is
  // one span, and it is counted here and not again above.
  const holidaysWorked = facts.spans.filter(
    (span) => span.kind === "holiday" && span.worked,
  ).length;
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

  // Column H — money paid to third parties. Built here and excluded from the
  // total: reading H as salary would overpay the worker (item 16, Part 5).
  for (const payment of facts.thirdPartyPayments) {
    drafts.push({
      key: `thirdParty.${payment.kind}`,
      label: he.sheet.thirdParty[payment.kind],
      units: 1,
      rate: payment.agorot,
      column: "H",
      explanation: { text: he.sheet.why.thirdParty },
    });
  }

  return drafts.map((draft) => toLine(draft, facts));
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
    explanation: { text: he.sheet.why.incomeTax },
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
 * The national-insurance contribution is 3.6% of the month's full cost — the
 * salary, the Friday supplement, the Saturday and holiday pay, and the one-off
 * payments — taken **before anything to do with advances** (specs.md item 19).
 * That base is the gross, which is why it is applied to it and not to the net.
 *
 * Part 5 warns that the workbook's own line is stale at 2% of the 2024 wage:
 * derive, never copy.
 */
const NATIONAL_INSURANCE_RATE = 0.036;

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
  terms: WorkerTerms,
  context: MonthContext = {},
): MonthResult {
  const refusals = validateMonth(facts, context);
  if (refusals.length > 0) throw new InvalidMonthError(refusals);

  const counts = countMonth(facts, terms);
  const lines = buildLines(facts, terms, counts);
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
    balances: buildBalances(facts, terms, context.openingBalances),
    // An estimate to be confirmed, never a fact (item 19), and never the money
    // that actually left the account — that appears once, in the month it was
    // paid, as a column H line of its own.
    nationalInsuranceEstimate: Math.round(gross * NATIONAL_INSURANCE_RATE),
  };
}
