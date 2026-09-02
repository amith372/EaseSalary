import {
  addDays,
  compareIsoDate,
  eachDate,
  isRestDay,
  monthOf,
  orderDates,
  sameMonth,
} from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import type { MonthSpan } from "@/lib/engine/types";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * Sick pay: the statutory tiers, and the deduction that carries them onto a
 * sheet whose base salary never shrinks.
 *
 * **Why a deduction and not a payment.** The salary is calculated from the
 * standard count, so sickness never reduces the base (specs.md item 5). A sick
 * day therefore arrives already paid in full, and the tiers pay less than that:
 * nothing for the first day of a spell, half for the second and third, the
 * whole day from the fourth onward (item 8). What reaches the sheet is the
 * difference — a negative amount on the sickness-absence row of column E,
 * inside the same subtotal as the base and the rest-eve supplement — so the
 * worker is left with exactly what the tiers give her. A payment line beside a
 * base that already contains the day would pay it twice, which is the same
 * mistake the sheet deliberately avoids for vacation (item 7).
 *
 * **Why the spell and not the month.** The tiers are counted from the spell's
 * own first day through to its last, across a month boundary, rather than
 * restarting each month (item 8). That is why a spell is stored as the dates it
 * ran between (Part 3) and why this module reads spans that begin before the
 * month being calculated: a spell running 29 August to 3 September is days one
 * to three in August and day four onward in September, and reading it a month
 * at a time would restart the tiers and underpay her twice over.
 */

/** Where the tiers step. Both are the statute's own boundaries (item 8) and
 * neither is a figure derived from anything else. */
const FIRST_DAY = 1;
const HALF_PAID_THROUGH = 3;

/**
 * What the tiers pay for one day of a spell, as a fraction of a day: nothing
 * for the first day, half for the second and third, the whole day from the
 * fourth onward (specs.md item 8). `dayOfSpell` counts from 1.
 */
export function paidFractionOfSpellDay(dayOfSpell: number): number {
  if (dayOfSpell <= FIRST_DAY) return 0;
  if (dayOfSpell <= HALF_PAID_THROUGH) return 0.5;
  return 1;
}

/** The part of a day the tiers do **not** fund, which is the part the base
 * already paid and the deduction takes back. */
export function unpaidFractionOfSpellDay(dayOfSpell: number): number {
  return 1 - paidFractionOfSpellDay(dayOfSpell);
}

/** One continuous spell of sickness, whatever number of spans it was entered
 * as. `from` and `to` are its own first and last day, which is where the tiers
 * are counted from. */
export interface SickSpell {
  from: IsoDate;
  to: IsoDate;
}

/**
 * The spells the month's spans describe.
 *
 * **A spell ends on the first day no sickness was reported** (specs.md item 8),
 * which is what makes "days that touch are one spell" a rule and not a
 * description: a gap makes two spells and there is no other way to end one.
 * Two spans meeting end to end are therefore read as the one illness they are,
 * however many ranges they were entered as, while a span with a day missing
 * from its middle restarts the tiers and changes what the sickness pays. The
 * skipped day and its reason are shown to the user by `spans.ts` rather than
 * absorbed silently, which is what makes that visible where it happens.
 *
 * This is how the law measures a period of illness — an unbroken run from its
 * first day, the rest days inside it counted, regardless of how many medical
 * certificates were written over it. Where two genuinely separate illnesses run
 * into each other the effect is to read them as one, so the fourth day is paid
 * in full rather than starting again at nothing. That leans in the worker's
 * favour, and item 8 settles it with the manual override of item 17 rather than
 * with a mechanism built for it: an entry split in two would be a way for the
 * *tiers* to be restarted by hand, which is the one thing they must not be.
 */
export function spellsOf(spans: MonthSpan[]): SickSpell[] {
  const ordered = spans
    .filter((span) => span.kind === "sick")
    .map((span) => orderDates(span.from, span.to))
    .sort((a, b) => compareIsoDate(a.from, b.from));

  const spells: SickSpell[] = [];
  for (const span of ordered) {
    const last = spells[spells.length - 1];
    // The day after the previous spell's last day is the first day that would
    // still continue it, so "touching or overlapping" is one comparison.
    if (last && compareIsoDate(span.from, addDays(last.to, 1)) <= 0) {
      if (compareIsoDate(span.to, last.to) > 0) last.to = span.to;
      continue;
    }
    spells.push({ from: span.from, to: span.to });
  }
  return spells;
}

/** One day of a spell, with the position that decides what it is worth. */
export interface SickDay {
  date: IsoDate;
  /** Counting from 1 at the spell's own first day, rest days included: a rest
   * day inside a spell advances the position even though no money moves for it
   * (specs.md item 8). */
  dayOfSpell: number;
  /**
   * The part of a day's value the deduction takes back for this day.
   *
   * **Zero on a rest day, and that is one of four separate things a rest day
   * inside a spell does** (specs.md item 8). It is not paid; nothing is
   * deducted from the money for it, which is this field — a rest day stands
   * outside the standard count, so the base never paid for it, there is nothing
   * to take back, and a deduction would charge her for a day she was not paid;
   * it is nonetheless drawn from the sick balance, which is a count of days and
   * not a sum of money, and `balanceDaysOf` in `spans.ts` does that drawing;
   * and it advances `dayOfSpell` all the same, so the day after it stands one
   * tier further along. Collapsing any two of the four is how this goes wrong.
   */
  unpaidDays: number;
}

/** Every day of every spell, with its tier position. The whole spell is walked
 * even where most of it falls outside the month, because the position of a day
 * inside this month depends on how many days of the spell came before it. */
export function sickDaysOf(spans: MonthSpan[], restDay: RestDay): SickDay[] {
  return spellsOf(spans).flatMap((spell) =>
    eachDate(spell.from, spell.to).map((date, index) => ({
      date,
      dayOfSpell: index + 1,
      unpaidDays: isRestDay(date, restDay)
        ? 0
        : unpaidFractionOfSpellDay(index + 1),
    })),
  );
}

/** The days of the spells that fall inside this month, tiers and all. */
export function sickDaysIn(
  spans: MonthSpan[],
  month: YearMonth,
  restDay: RestDay,
): SickDay[] {
  return sickDaysOf(spans, restDay).filter((day) =>
    sameMonth(monthOf(day.date), month),
  );
}

/**
 * How many days' worth this month deducts. Full precision — a half day is a
 * half day, and the rounding happens once, where the days become an amount
 * (specs.md item 3).
 */
export function sickDeductionDays(
  spans: MonthSpan[],
  month: YearMonth,
  restDay: RestDay,
): number {
  return sickDaysIn(spans, month, restDay).reduce(
    (days, day) => days + day.unpaidDays,
    0,
  );
}
