import type { DatedRate } from "@/lib/datedRates";
import type { TaxYearBrackets } from "@/lib/taxBrackets";
import { compareMonth, eachMonth, monthOf, yearMonthText } from "@/lib/dates";
import { balanceOf } from "@/lib/engine/balances";
import { holidayDaysOf } from "@/lib/engine/leave";
import { calculateMonth } from "@/lib/engine/month";
import { openMonthRecord, wageToCarry } from "@/lib/engine/repository";
import { spellsLeadingInto } from "@/lib/engine/sick";
import { AS_SHIPPED, closeMonth, closeSpans, clipEndOf } from "@/lib/engine/types";
import type {
  Employment,
  MonthContext,
  MonthFacts,
  MonthSpan,
  WorkerTerms,
} from "@/lib/engine/types";
import { overlapsMonth } from "@/lib/spans";
import type { BalanceKind, IsoDate, MonthResult, YearMonth } from "@/lib/types";

/**
 * A worker's months, replayed from the opening position.
 *
 * **This is where the engine stops being a function of one month.** Balances are
 * never stored (`specs.md` Part 3): month N+1 opens with month N's closing
 * figures, so the only way to know what a month opened with is to walk the ones
 * before it. That is what makes criterion 13 free — a month corrected years
 * later moves every later month's balances because those balances were never
 * anything but this walk, and there is nothing to find and invalidate.
 *
 * Three things carry between months, and they carry differently:
 *
 * - **The balances** carry from one month to the next, across the new year and
 *   without limit. Vacation and sick balances have no year boundary.
 * - **The vacation days spent** and **the holiday days spent** carry only within
 *   a calendar year and reset at January, because the seven-day question and the
 *   nine-day entitlement are both asked of a calendar year (items 7 and 10).
 *   Neither is visible to a month looking only at itself, which is the whole
 *   reason for the walk.
 *
 * Nothing here reads a clock. `today` arrives from the caller and reaches every
 * month, which is safe because `clipEndOf` takes the earlier of it and the
 * month's own last day: a finished month clips at its own end whatever the date
 * is, and only a month still running clips at `today` (item 8, `CLAUDE.md`).
 */

/** One month of the walk: the facts it was calculated from beside what it came
 * to. The facts are carried because a caller that has the result usually wants
 * the marks behind it, and finding them again means matching on the month. */
export interface MonthInSeries {
  facts: MonthFacts;
  result: MonthResult;
}

/**
 * The same month handed to the walk twice.
 *
 * It cannot arise from the store, which keys a month by its date, but
 * `calculateSeries` takes an array and a caller could assemble one. Refused
 * rather than folded: two records of one month would accrue it twice and draw
 * its vacation twice, and the balance that came out would look entirely
 * ordinary — which is the class of mistake `specs.md` Part 5 is about.
 */
export class DuplicateMonthError extends Error {
  constructor(readonly month: YearMonth) {
    super(`The month ${month.year}-${month.month} appears more than once`);
    this.name = "DuplicateMonthError";
  }
}

/**
 * A month earlier than the worker's first month (specs.md item 6). No such
 * month can be opened, and one handed to the walk anyway has nothing to open
 * from: the opening position is the first month's.
 */
export class MonthBeforeFirstMonthError extends Error {
  constructor(
    readonly month: YearMonth,
    readonly firstMonth: YearMonth,
  ) {
    super(
      `The month ${yearMonthText(month)} is before the first month ${yearMonthText(firstMonth)}`,
    );
    this.name = "MonthBeforeFirstMonthError";
  }
}

/** The worker's own spans, recovered once from the months she has: the store
 * hands a spell to every month it touches, so the same span arrives more than
 * once and is taken by id. Each month below clips from this one set. */
function everySpan(months: MonthFacts[]): MonthSpan[] {
  const byId = new Map<string, MonthSpan>();
  for (const facts of months) {
    for (const span of facts.spans) byId.set(span.id, span);
  }
  return [...byId.values()];
}

/**
 * A month nobody opened, as the walk values it (specs.md Part 3): exactly the
 * record `openMonthRecord` would open it with, at the wage `wageToCarry` finds
 * for it — the same two functions an action opens a month with, so opening it
 * changes nothing about it.
 *
 * **It holds the spans that reach into it**, which is what the store would have
 * handed it had it been opened: a sick spell nobody closed keeps running into
 * the months after the one it was marked in.
 */
function unopenedMonth(
  month: YearMonth,
  worker: WorkerTerms,
  opened: MonthFacts[],
  rates: DatedRate[],
): MonthFacts {
  const confirmedWage = wageToCarry(opened, month, worker, rates);
  if (confirmedWage === null) {
    // Only a worker with no opened month and no minimum wage on record for
    // this month; the seeded table begins in April 2025 and every first month
    // the wizard offers is later than that.
    throw new Error(`No wage is known for ${yearMonthText(month)}`);
  }
  // Its spans are put on by the walk below, which clips every month from the
  // worker's own set — an opened month and an unopened one the same way.
  return { ...openMonthRecord(worker, month, confirmedWage), spans: [] };
}

/** The vacation days the month drew, read off the balance line rather than
 * counted again here. Counting them a second time would be a second path to one
 * figure, and the two would disagree the day either is corrected. */
function vacationDaysUsed(result: MonthResult): number {
  return balanceOf(result, "vacation")?.used ?? 0;
}

function closingBalances(result: MonthResult) {
  const closing = (kind: BalanceKind) => balanceOf(result, kind)?.closing ?? 0;
  return { vacationDays: closing("vacation"), sickDays: closing("sick") };
}

/**
 * Every month calculated in the light of the ones before it, oldest first.
 *
 * The months are **sorted here** rather than trusted from the caller. The store
 * already promises date order, but an unsorted array does not fail — it produces
 * balances that are merely wrong, which is exactly the failure this application
 * is written to make impossible rather than to make unlikely.
 *
 * **It walks every month from the worker's first month** (specs.md item 6,
 * Part 3), to today's month when `today` is given and otherwise to the last
 * month it was handed. A month nobody opened is an ordinary month and accrues
 * like any other — `unopenedMonth` says what it holds — and a month after
 * today's is not valued at all, even where marks were already made in it
 * (item 21). The profile is taken whole for that one purpose: a month nobody
 * opened has no terms of its own, so it is valued at the profile's, while every
 * month that was opened is still read off its own.
 *
 * `rates` is the household's dated-rates table, which a month nobody opened
 * takes its wage from and which every month is then valued against; an action
 * opening a month reads the same table, so the two agree. `taxBrackets` is the
 * same for the income tax. Left out, the seeded tables are read — which is what
 * the application ships knowing before any fetch has run.
 *
 * A refused month stops the walk, and the `InvalidMonthError` says which month
 * it was. That is not a limitation to work around: a month that cannot be
 * calculated has no closing balance, so the months after it have nothing to open
 * from, and continuing past it would mean inventing one.
 */
export function calculateSeries(
  months: MonthFacts[],
  worker: WorkerTerms & Employment,
  today?: IsoDate,
  rates: DatedRate[] = AS_SHIPPED.rates,
  taxBrackets: TaxYearBrackets[] = AS_SHIPPED.taxBrackets,
): MonthInSeries[] {
  const ordered = [...months].sort((a, b) => compareMonth(a.month, b.month));
  for (let i = 1; i < ordered.length; i += 1) {
    if (compareMonth(ordered[i - 1].month, ordered[i].month) === 0) {
      throw new DuplicateMonthError(ordered[i].month);
    }
  }
  const first = worker.firstMonth;
  if (ordered.length > 0 && compareMonth(ordered[0].month, first) < 0) {
    throw new MonthBeforeFirstMonthError(ordered[0].month, first);
  }

  const last = today !== undefined ? monthOf(today) : ordered.at(-1)?.month;
  if (last === undefined || compareMonth(first, last) > 0) return [];

  const opened = new Map(ordered.map((facts) => [yearMonthText(facts.month), facts]));
  const spans = everySpan(ordered);
  // The same spans with their open spells resolved, for deciding the spells
  // alone. The months below are still handed `spans` as they stand, because an
  // open spell is a state the screens and the export block on (item 8) and a
  // spell closed here would hide it.
  const closedSpans = closeSpans(spans, clipEndOf(last, today));

  let openingBalances: MonthContext["openingBalances"];
  let year = first.year;
  let vacationDaysEarlierInYear = worker.openingPosition.vacationUsedThisYear;
  let holidayDaysEarlierInYear = worker.openingPosition.holidayUsedThisYear;

  return eachMonth(first, last).map((month) => {
    // **Clipped here and not read off the stored month.** A spell crossing a
    // boundary is one span belonging to the worker (Part 3), so what "in this
    // month" means is decided once for the whole series rather than once per
    // month by whoever assembled it.
    //
    // The days that touch the month, and in front of them the run each spell
    // led in with — `spellsLeadingInto` says why the tiers need it and why it
    // arrives as one span rather than as the spans it was entered as. The
    // spells are read against the profile's rest day, because they are decided
    // for the worker rather than for one month, and a month's own snapshot is
    // what every rule below this line still reads.
    const facts = {
      ...(opened.get(yearMonthText(month)) ??
        unopenedMonth(month, worker, ordered, rates)),
      spans: [
        ...spellsLeadingInto(closedSpans, month, worker.restDay),
        ...spans.filter((span) => overlapsMonth(span, month)),
      ],
    };
    if (month.year !== year) {
      year = month.year;
      vacationDaysEarlierInYear = 0;
      holidayDaysEarlierInYear = 0;
    }

    const employment: Employment = worker;

    const result = calculateMonth(facts, employment, {
      today,
      // **Both tables reach the month**, which is what makes them the
      // household's rather than the ones the application shipped with: the
      // minimum-wage warning, an unconfirmed month's recuperation rate, the
      // national-insurance estimate and the credit point are all read off them.
      // A walk that left them out valued every month against the seed, and a
      // household that had confirmed or fetched anything else was shown a
      // figure it had already corrected.
      rates,
      taxBrackets,
      openingBalances,
      vacationDaysEarlierInYear,
      holidayDaysEarlierInYear,
    });

    openingBalances = closingBalances(result);
    vacationDaysEarlierInYear += vacationDaysUsed(result);
    // Counted the way the month counts its own, by the module that owns the
    // rule: a part day draws its own proportion (item 10). `closeMonth` is pure
    // and idempotent, so making the resolution twice costs a map and cannot
    // disagree with the one `calculateMonth` made.
    holidayDaysEarlierInYear += holidayDaysOf(
      closeMonth(facts, today).spans,
      facts.terms.restDay,
    );

    return { facts, result };
  });
}
