import type { RestDay } from "@/lib/dates";
import { advanceKey } from "@/lib/engine/advances";
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
import { closeMonth, placementOf } from "@/lib/engine/types";
import type { UserLinePlacement } from "@/lib/engine/types";
import type {
  ClosedMonthFacts,
  MonthContext,
  MonthFacts,
  Employment,
} from "@/lib/engine/types";
import { InvalidMonthError, validateMonth } from "@/lib/engine/validate";
import { he } from "@/lib/i18n/he";
import type {
  ClosingBlock,
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
 *
 * **These are stored values as well as identifiers, and the string is the part
 * that is stored.** `MonthFacts.overrides` is keyed by them (item 17), so a key
 * that moves orphans the amount a user typed by hand and the line silently
 * reverts to the calculated figure — the one failure in this file that looks
 * like nothing went wrong. `restEveSupplement` was `fridaySupplement` until the
 * rest-day rename, and the rename is landed here rather than deferred for the
 * same reason `MarkKind`'s is: no override has ever been stored, because stage
 * 3 is what first writes one. After stage 3 the same change would mean reading
 * the old key alongside the new one and rewriting the stored `overrides` map on
 * the way past, keyed month by month. **This is the last commit in which a line
 * key is free to move**, which is what "stable by design" is asking for.
 */
export const lineKeys = {
  base: "base",
  restEveSupplement: "restEveSupplement",
  restDays: "restDays",
  holidaysWorked: "holidaysWorked",
  sickDeduction: "sickDeduction",
  incomeTax: "incomeTax",
} as const;

/**
 * How a line the user added is addressed: `standing.<id>` for one set on the
 * profile and `extra.<id>` for one belonging to this month alone.
 *
 * **The two prefixes are stored values**, because `MonthFacts.overrides` is
 * keyed by them (specs.md item 17), and they are what keeps a standing line and
 * a one-off line from colliding on an override when they share an id. They are
 * written here once and read everywhere — the screen that groups these lines
 * asks `isUserLineKey` rather than testing the strings itself, so a rename is a
 * compile error in one file instead of a row that silently empties.
 */
export const userLinePrefixes = ["standing", "extra"] as const;

export type UserLinePrefix = (typeof userLinePrefixes)[number];

export function isUserLineKey(key: string): boolean {
  return userLinePrefixes.some((prefix) => key.startsWith(`${prefix}.`));
}

/**
 * How a line the user added is addressed, built in one place.
 *
 * The key is a stored value — `MonthFacts.overrides` is keyed by it (item 17) —
 * so the code that *removes* a line has to build the same string the engine
 * built when it drew one, or the override outlives the line it belonged to.
 * Two call sites assembling it from the same two pieces is one call site too
 * many for a value that cannot be allowed to differ.
 */
export function userLineKey(prefix: UserLinePrefix, id: string): string {
  return `${prefix}.${id}`;
}

/**
 * The user's two sets of lines, with the column each takes **when it is placed
 * before the month's total** (specs.md item 20) — the block below the columns
 * has no columns, so `buildClosing` reads the first two and not the third.
 *
 * Written once because both halves of the month walk the same two sets and now
 * differ only in which placement they take: two loops deciding separately which
 * lines are standing and which are one-off is two places for a line to fall
 * through.
 */
function userLineGroups(facts: ClosedMonthFacts | MonthFacts) {
  return [
    [userLinePrefixes[0], facts.terms.standingLines, "E"],
    [userLinePrefixes[1], facts.userLines, "G"],
  ] as const;
}

/**
 * An override on a line the user added is a **magnitude**, and the sign still
 * comes from the direction (specs.md item 20: the user picks the kind and never
 * types a minus).
 *
 * It is forced here because the same line can now sit on either side of the
 * month's total, and the two sides round differently: the block below the
 * columns already signs the income tax and the advances itself, while `toLine`
 * takes an override verbatim. Without this, moving a line across the total
 * would silently invert an amount the user had typed — which item 17 says must
 * never happen, and which would look like an ordinary figure.
 */
function signedUserLine(line: MonthLine, sign: 1 | -1): MonthLine {
  if (!line.manual) return line;
  return { ...line, amount: sign * Math.abs(line.amount ?? 0) || 0 };
}

/** The sentence beside a line the user added: how long it lasts, then where the
 * user put it. Both halves are whole sentences in `he.ts` (item 20). */
function userLineWhy(
  prefix: UserLinePrefix,
  placement: UserLinePlacement,
): string {
  const why = he.sheet.why.userLine;
  return `${prefix === "standing" ? why.standing : why.oneOff} ${why[placement]}`;
}

function buildLines(facts: ClosedMonthFacts, counts: MonthCounts): MonthLine[] {
  const rates = deriveRates(facts.confirmedWage.baseAgorot);
  // Every label and every explanation that names a day names *her* day
  // (specs.md item 5), and it is read off the month like every other term.
  const { restDay } = facts.terms;
  const drafts: LineDraft[] = [];

  // Column E — the monthly salary items. The rest-eve supplement sits here and
  // not in F: Part 4 groups it with the base, and Part 5 gives F as "the pay
  // for rest days and holidays".
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
      text: he.sheet.why.base(counts.standardDays, restDay),
      link: "caregiverWage",
    },
  });

  // Priced from every rest-eve the month holds, because the supplement is not
  // conditional on attendance, on sickness, or on a setting (item 14).
  if (counts.restEves > 0 && facts.terms.restEveSupplementAgorot > 0) {
    drafts.push({
      key: lineKeys.restEveSupplement,
      label: he.sheet.lines.restEveSupplement(restDay),
      units: counts.restEves,
      rate: facts.terms.restEveSupplementAgorot,
      column: "E",
      explanation: {
        text: he.sheet.why.restEveSupplement(counts.restEves, restDay),
        link: "caregiverWage",
      },
    });
  }

  // The sickness deduction. It sits in column E and inside the same subtotal as
  // the base and the rest-eve supplement, and never among the one-off payments: a
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
  const sickDays = sickDeductionDays(
    facts.spans,
    facts.month,
    facts.terms.restDay,
  );
  if (sickDays > 0) {
    drafts.push({
      key: lineKeys.sickDeduction,
      label: he.sheet.lines.sickDeduction,
      units: -sickDays,
      rate: rates.daily,
      column: "E",
      explanation: {
        text: he.sheet.why.sickDeduction(sickDays, restDay),
        link: "sickPay",
      },
    });
  }

  // Column F — the pay for rest days and holidays, both at the rest-day rate,
  // and each day paid once between the two lines. `leave.ts` owns that
  // division: a rest day she worked which is also a holiday she worked is left
  // with the holiday line and taken out of the rest days here, because both
  // lines pay the same rate off the same date and item 9 says the day is paid
  // once. `counts.restDaysWorked` stays the true count of rest days attended.
  const restDayUnits = restDayUnitsOf(
    facts.spans,
    counts.restDaysWorked,
    facts.terms.restDay,
  );
  if (restDayUnits > 0) {
    drafts.push({
      key: lineKeys.restDays,
      label: he.sheet.lines.restDays(restDay),
      units: restDayUnits,
      rate: rates.restDay,
      column: "F",
      explanation: {
        text: he.sheet.why.restDays(restDayUnits, restDay),
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
        text: he.sheet.why.holidaysWorked(holidaysWorked, restDay),
        link: "holidayWork",
      },
    });
  }

  // The lines the user added (specs.md item 20). **What decides whether a line
  // is here is where the user put it and not which way it moves**: a line placed
  // before the month's total is part of what the month came to and enters the
  // national-insurance estimate with it, and one placed after only changes what
  // is transferred — `buildClosing` emits those. The direction decides the sign
  // alone, so a deduction placed before the total is a negative line in a column
  // rather than a row below them.
  //
  // Which column follows from how long the line lasts: a standing line sits in
  // column E, because that is where what she earns every month lives, and a
  // one-off in G, which is what that column is for.
  const userDrafts: { draft: LineDraft; sign: 1 | -1 }[] = [];
  for (const [prefix, lines, column] of userLineGroups(facts)) {
    for (const line of lines) {
      if (placementOf(line) !== "beforeGross") continue;
      const sign = line.direction === "addition" ? 1 : -1;
      userDrafts.push({
        sign,
        draft: {
          key: userLineKey(prefix, line.id),
          label: line.label,
          units: sign,
          // **The units carry the sign and the rate does not**, exactly as the
          // sickness deduction above does it. The rate is column D of the sheet,
          // which is a unit price: a negative price is the reading Part 5 warns
          // about, and one withheld unit at a positive price is what this row
          // actually records.
          rate: Math.abs(line.agorot),
          column,
          explanation: { text: userLineWhy(prefix, "beforeGross") },
        },
      });
    }
  }

  // Column H — money paid to third parties, and excluded from the total:
  // reading H as salary would overpay the worker (item 16, Part 5).
  // `thirdParty.ts` owns those lines and the national-insurance estimate
  // beside them, and this file restates neither.
  return [
    ...drafts.map((draft) => toLine(draft, facts.overrides)),
    ...userDrafts.map(({ draft, sign }) =>
      signedUserLine(toLine(draft, facts.overrides), sign),
    ),
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
    // The one row taken out of the ברוטו rather than out of the transfer, and
    // so the only thing standing between the two figures (specs.md Part 5).
    block: "withholding",
    // The application never calculates the tax, so the link is the whole of what
    // it can give the user before she types a figure (specs.md items 17, 26).
    explanation: { text: he.sheet.why.incomeTax, link: "incomeTax" },
  });

  // The user's own lines placed *after* the month's total, standing first and
  // then this month's, before the advances. **Placement is what puts a line
  // here, not direction** (item 20): an addition placed after the total is a
  // payment that is not part of the month's cost, and it adds to what is
  // transferred without reaching the national-insurance estimate. The sign
  // still comes from `direction` rather than from a figure the user could type
  // negative.
  for (const [prefix, lines] of userLineGroups(facts)) {
    for (const line of lines) {
      if (placementOf(line) !== "afterGross") continue;
      const key = userLineKey(prefix, line.id);
      const override = facts.overrides[key];
      const agorot = override ? override.agorot : Math.abs(line.agorot);
      const signed = line.direction === "addition" ? 1 : -1;
      rows.push({
        key,
        label: line.label,
        amount: signed * Math.round(Math.abs(agorot)) || 0,
        manual: override !== undefined,
        // Item 20 says such a line "changes only what is transferred at the
        // end" and reaches neither the month's cost nor item 19's estimate,
        // which is the same sentence as an advance — so it sits with them,
        // below the נטו and not beside the tax.
        block: "transfer",
        explanation: { text: userLineWhy(prefix, "afterGross") },
      });
    }
  }

  for (const advance of facts.advances) {
    const granted = advance.kind === "granted";
    const key = advanceKey(advance.number, advance.kind);
    const override = facts.overrides[key];
    const agorot = override ? override.agorot : Math.abs(advance.agorot);
    rows.push({
      key,
      label: granted
        ? he.sheet.lines.advanceGranted
        : he.sheet.lines.advanceRepaid,
      amount: granted ? Math.round(agorot) : -Math.round(agorot),
      manual: override !== undefined,
      block: "transfer",
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
function buildSubtotals(
  lines: MonthLine[],
  restDay: RestDay,
): ColumnSubtotal[] {
  const labels = he.sheet.subtotals(restDay);
  const why = he.sheet.why.subtotal(restDay);
  return ALL_COLUMNS.filter((column) =>
    lines.some((line) => line.column === column),
  ).map((column) => ({
    column,
    label: labels[column],
    amount: lines
      .filter((line) => line.column === column)
      .reduce((total, line) => total + (line.amount ?? 0), 0),
    explanation: { text: why[column] },
  }));
}

export function calculateMonth(
  facts: MonthFacts,
  employment: Employment,
  context: MonthContext = {},
): MonthResult {
  const refusals = validateMonth(facts, employment, context);
  if (refusals.length > 0) throw new InvalidMonthError(refusals, facts.month);

  // An open spell is resolved once, here, and every rule below works on a span
  // that has an end (specs.md item 8). Left out, `today` clips at the month's
  // own last day, which is what a finished month wants: the figure is settled
  // when the month ends and never moves because of when it is looked at.
  const month = closeMonth(facts, context.today);

  const counts = countMonth(month);
  const lines = buildLines(month, counts);
  const closing = buildClosing(month);

  const gross = lines
    .filter((line) => COLUMNS_THAT_REACH_THE_WORKER.includes(line.column))
    .reduce((total, line) => total + (line.amount ?? 0), 0);

  // Two sums over one list rather than two lists, so a row cannot be counted
  // in the transfer and forgotten in the נטו or the other way round: every
  // row carries its own half and `net` is still the sum of all of them.
  const sumOfBlock = (block: ClosingBlock) =>
    closing
      .filter((row) => row.block === block)
      .reduce((total, row) => total + (row.amount ?? 0), 0);

  const afterWithholding = gross + sumOfBlock("withholding");
  const net = afterWithholding + sumOfBlock("transfer");

  return {
    month: facts.month,
    standardDays: counts.standardDays,
    actualDays: counts.actualDays,
    lines,
    subtotals: buildSubtotals(lines, facts.terms.restDay),
    closing,
    gross,
    afterWithholding,
    net,
    balances: buildBalances(month, employment, context.openingBalances),
    warnings: buildWarnings(month, context),
    // An estimate to be confirmed, never a fact (item 19), and never the money
    // that actually left the account — that appears once, in the month it was
    // paid, as a column H line of its own. `thirdParty.ts` holds both.
    nationalInsuranceEstimate: nationalInsuranceEstimateOf(gross),
  };
}
