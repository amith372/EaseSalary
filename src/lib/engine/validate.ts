import {
  compareIsoDate,
  eachDate,
  isRestDay,
  orderDates,
} from "@/lib/dates";
import { duplicateAdvanceMovements } from "@/lib/engine/advances";
import { daysUsedIn, sickDaysAvailable } from "@/lib/engine/balances";
import { holidayAllowanceFor, holidayDaysOf } from "@/lib/engine/leave";
import {
  duplicateThirdPartyKinds,
  LINK_FOR_THIRD_PARTY,
} from "@/lib/engine/thirdParty";
import { closeMonth } from "@/lib/engine/types";
import type {
  ClosedSpan,
  MonthContext,
  MonthFacts,
  Employment,
} from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import type { LegalLinkKey } from "@/lib/links";
import type { IsoDate, SpanKind, YearMonth } from "@/lib/types";

/**
 * The facts the engine refuses, with the reason each was refused.
 *
 * `src/lib/spans.ts` stops what it can at the calendar: a mark swept over a day
 * that already carries one comes back as a skip rather than a second span. But
 * the calendar is one caller and the repository in Stage 3 is another, so the
 * engine refuses the facts if such a pair reaches it anyway (specs.md Part 4).
 * A month that cannot be calculated correctly is refused with a reason and
 * never calculated wrongly in silence.
 *
 * **`restDayHoliday` is now refused here and nowhere else.** The user cannot
 * mark a holiday at all (item 9), so the only thing that can put one on a free
 * rest day is the year's chosen dates — a caller the calendar's own refusals
 * never see, and the reason this rule had to move rather than be duplicated.
 */

export type RefusalCode =
  /** A paid holiday on a date already recorded as a free rest day. The day
   * would be paid at both the rest-day rate and the holiday rate (Part 4). */
  | "restDayHoliday"
  /** More paid holidays in the year than the entitlement allows (item 10). */
  | "holidayLimit"
  /** A free rest day recorded on a day that is not the worker's rest day
   * (item 5). */
  | "freeRestDayNotRestDay"
  /**
   * One date carrying more than one entry — a day recorded as both sick and
   * worked as a holiday, or recorded twice over (Part 4).
   *
   * There is no `saturdaysExceedMonth` beside it, and its absence is the
   * decision rather than an omission. A count of worked rest days higher than
   * the month holds cannot arise: `countMonth` filters the calendar's own rest
   * days rather than reading a number, so no stored data produces one. The
   * failure mode came from the family's workbook, where that figure is typed —
   * G2 of `שכר_חודשי_להאנה2025.xlsx` -> `חודש  8.25` — and deriving it moved
   * the danger rather than removing it: the holiday count is the one the
   * calendar does not bound, so this is where the refusal sits now.
   */
  | "dayRecordedTwice"
  /**
   * Two payments of one kind in a single month (specs.md item 16). The sheet
   * holds one row per kind, and two lines under one explanation key can be
   * neither overridden nor explained apart (items 17, 24).
   */
  | "thirdPartyPaidTwice"
  /** More sick days recorded in the month than the balance can fund. The sick
   * balance is a floor and never falls below zero (specs.md item 8). */
  | "sickBalanceExhausted"
  /**
   * Two movements of one kind on one advance in a single month (specs.md item
   * 20). The two rows would be addressed by one key, so neither could be
   * overridden or explained apart from the other (items 17, 24) — the same
   * shape, and the same reason, as `thirdPartyPaidTwice`.
   *
   * **The other two advance rules are not here, and their absence is the
   * decision.** What is still owed can only be counted by walking the worker's
   * months, and a month this function refuses stops the replay that produces
   * every later month's balances (item 13) — so an over-repayment that reached
   * storage would close the very screen it would have to be corrected on. Item
   * 20 puts those two refusals where the figure is entered instead. This one is
   * a fact about one month, which is what makes it safe to see here.
   */
  | "advanceRecordedTwice";

export interface Refusal {
  code: RefusalCode;
  /** Hebrew, and it says why rather than only what. */
  message: string;
  /** The dates the refusal concerns. Kept beside the sentence rather than
   * inside it, so the interface can isolate them: a date written into a Hebrew
   * paragraph is a mixed run a browser may reorder (specs.md Part 5). */
  dates: IsoDate[];
  /**
   * The rule the refused action rests on — the same link that action carries
   * when it succeeds (specs.md item 25).
   *
   * A user who has been stopped is exactly the user who wants to know why, and
   * a refusal is the moment the application can least afford to be taken on its
   * word. It is not optional the way `Explanation.link` is: every refusal the
   * engine can produce has a rule behind it, and one that did not would be the
   * application refusing on its own authority.
   */
  link: LegalLinkKey;
}

/**
 * The rule behind each refusal: the link of the action that was refused, not of
 * the check that refused it (specs.md item 25). A tenth holiday points at the
 * holiday rule and not at an article about entitlement ceilings, because what
 * the user was doing was marking a holiday.
 */
const LINK_FOR: Record<
  Exclude<RefusalCode, "dayRecordedTwice" | "thirdPartyPaidTwice">,
  LegalLinkKey
> = {
  restDayHoliday: "holidayWork",
  holidayLimit: "holidayWork",
  freeRestDayNotRestDay: "restDayWork",
  sickBalanceExhausted: "sickPay",
  // An advance rests on no legal rule, so what this refusal points at is the
  // rule it would breach: the payslip has to show every payment as its type,
  // its number of units and its amount (item 2), which two rows sharing one key
  // cannot do. That is item 25's own test — the link of the *action* refused,
  // and the action was recording a row on the sheet.
  advanceRecordedTwice: "wageProtection",
};

/**
 * `dayRecordedTwice` and `thirdPartyPaidTwice` are the two refusals whose rule
 * depends on what was being recorded rather than on the check. The first
 * resolves through the mark's own kind, below; the second through
 * `LINK_FOR_THIRD_PARTY`, which `thirdParty.ts` already holds for the lines
 * themselves, so a payment's rule is named in one place (specs.md item 25).
 */
const LINK_FOR_KIND: Record<SpanKind, LegalLinkKey> = {
  vacation: "annualLeave",
  sick: "sickPay",
  holiday: "holidayWork",
  freeRestDay: "restDayWork",
};

function coversDate(span: ClosedSpan, date: IsoDate): boolean {
  const { from, to } = orderDates(span.from, span.to);
  return compareIsoDate(date, from) >= 0 && compareIsoDate(date, to) <= 0;
}

/**
 * Every date each span covers, whichever month it falls in. A spell of sickness
 * is stored as the dates it ran between and may begin before the month or end
 * after it (specs.md Part 3), so the span is read whole: an overlap that
 * straddles the boundary is still an overlap.
 */
function datesOf(span: ClosedSpan): IsoDate[] {
  const { from, to } = orderDates(span.from, span.to);
  return eachDate(from, to);
}

/**
 * Dates carrying more than one entry, with the kind of the mark that collided.
 *
 * **Why this is refused rather than resolved.** A day recorded as both a sick
 * day and a holiday she worked is a contradiction in the facts, and the engine
 * has no way to know which of the two happened — she cannot have been absent
 * ill and at work on the same day. Resolving it by a rule would mean choosing
 * silently, and the figure that came out would look entirely ordinary. Two
 * entries of the same kind on one date are the same problem in its plainest
 * form: the day is paid twice and drawn twice from its entitlement.
 *
 * The cost of not refusing is not theoretical. A sick spell covering a rest day
 * that is also marked as a holiday she worked leaves `restDayUnitsOf`
 * subtracting a rest day that sickness had already taken out, so the sheet
 * reports three rest days worked where she worked four. The month's total can
 * still come out plausible, which is exactly what makes it dangerous: item 2
 * requires every payment to carry its type, its number of units and its amount,
 * and the units are what is wrong.
 *
 * `src/lib/spans.ts` already refuses a second mark on a marked day, as
 * `alreadyMarked`. This is the same rule enforced where it cannot be skipped:
 * the calendar is one caller, and the repository and the export are others —
 * and since the user cannot mark a holiday at all (item 9), the holiday half of
 * this can now only arrive from the year's chosen dates, which is a caller the
 * calendar's own refusals never see.
 */
function datesRecordedTwice(spans: ClosedSpan[]): Map<IsoDate, SpanKind> {
  const seen = new Map<IsoDate, SpanKind>();
  const twice = new Map<IsoDate, SpanKind>();
  for (const span of spans) {
    for (const date of datesOf(span)) {
      if (seen.has(date)) twice.set(date, span.kind);
      else seen.set(date, span.kind);
    }
  }
  return twice;
}

/**
 * `terms` is here for the sick balance alone: what a month may draw depends on
 * the opening position, which is a standing fact about the worker and not a
 * fact about the month (specs.md items 6, 8).
 */
export function validateMonth(
  facts: MonthFacts,
  employment: Employment,
  context: MonthContext = {},
): Refusal[] {
  const refusals: Refusal[] = [];
  // The same resolution `calculateMonth` makes, and it has to happen here too:
  // an overlap or a double entry that an open spell reaches into is one the
  // month has to refuse, and a span with no end cannot be compared against one
  // that has. `closeMonth` is pure, so making it twice costs a map and cannot
  // disagree with itself (specs.md item 8).
  const { spans } = closeMonth(facts, context.today);

  // A paid holiday landing on a free rest day: the deliberately invalid case of
  // Part 4. Refused rather than paid at both rates.
  const clashes = spans
    .filter((span) => span.kind === "holiday")
    .flatMap((holiday) =>
      spans
        .filter(
          (other) =>
            other.kind === "freeRestDay" && coversDate(other, holiday.from),
        )
        .map(() => holiday.from),
    );
  if (clashes.length > 0) {
    refusals.push({
      code: "restDayHoliday",
      link: LINK_FOR.restDayHoliday,
      message: he.sheet.refusals.restDayHoliday(facts.terms.restDay),
      dates: [...new Set(clashes)],
    });
  }

  // A date carrying more than one entry. Reported after `restDayHoliday` and
  // with its dates removed, so the holiday-on-a-free-rest-day pair gets the
  // reason Part 4 names for it rather than two refusals for one mistake: a
  // specific reason is worth more to the user than a general one.
  const alreadyRefused = new Set(clashes);
  const twice = [...datesRecordedTwice(spans)].filter(
    ([date]) => !alreadyRefused.has(date),
  );
  if (twice.length > 0) {
    refusals.push({
      code: "dayRecordedTwice",
      message: he.sheet.refusals.dayRecordedTwice,
      dates: twice.map(([date]) => date).sort(compareIsoDate),
      // The rule of the mark that collided — what the user was doing when the
      // entry was refused (item 25).
      link: LINK_FOR_KIND[twice[0][1]],
    });
  }

  // A free rest day on a day that is not one. This is how the rest-day counts
  // go wrong in stored data even though the calendar refuses it at mark time.
  //
  // The day is read off the month's own terms and never off the profile
  // (Part 3), so the refusal is this worker's rather than everyone's: a
  // Friday-resting worker's free Friday is recorded and her free Saturday is
  // refused, which is the reverse of Hanna's and the reason the check cannot
  // be a constant.
  const notRestDays = spans
    .filter(
      (span) =>
        span.kind === "freeRestDay" && !isRestDay(span.from, facts.terms.restDay),
    )
    .map((span) => span.from);
  if (notRestDays.length > 0) {
    refusals.push({
      code: "freeRestDayNotRestDay",
      link: LINK_FOR.freeRestDayNotRestDay,
      message: he.sheet.refusals.freeRestDayNotRestDay(facts.terms.restDay),
      dates: notRestDays,
    });
  }

  // A tenth paid holiday within a year. The entitlement is nine for a full year
  // and is reduced in proportion for a year only partly worked (item 10).
  // Nine days for a full year, reduced in proportion for a year only partly
  // worked (item 10). Derived from the worker's own terms rather than defaulted
  // to nine, so a month standing alone in her first calendar year is refused
  // against the entitlement she actually has. The context may still hand one
  // in, which is what lets a figure settled elsewhere win over the derivation.
  const allowance =
    context.holidayAllowance ??
    holidayAllowanceFor(employment.employedSince, facts.month.year);
  const holidayDays =
    holidayDaysOf(spans, facts.terms.restDay) +
    (context.holidayDaysEarlierInYear ?? 0);
  if (holidayDays > allowance) {
    refusals.push({
      code: "holidayLimit",
      link: LINK_FOR.holidayLimit,
      message: he.sheet.refusals.holidayLimit(allowance),
      dates: spans.filter((span) => span.kind === "holiday").map((s) => s.from),
    });
  }

  // Two payments of one kind in a single month. The lines would share an
  // explanation key, so an override could not reach one of them without
  // reaching the other (items 17, 24). Refused rather than silently merged: the
  // two may cover different months, and folding them would lose that.
  for (const kind of duplicateThirdPartyKinds(facts.thirdPartyPayments)) {
    refusals.push({
      code: "thirdPartyPaidTwice",
      // The payment type is Hebrew, so it sits inside the sentence rather than
      // beside it — unlike a date, which is a mixed run (specs.md Part 5).
      message: he.sheet.refusals.thirdPartyPaidTwice(he.sheet.thirdParty[kind]),
      // A payment carries no date of its own; what it concerns is a kind.
      dates: [],
      link: LINK_FOR_THIRD_PARTY[kind],
    });
  }

  // Sick days beyond what the balance can fund. The sick balance is a floor and
  // never falls below zero (item 8): the entry is refused and said out loud,
  // rather than the extra days being paid or deducted for in silence. Days past
  // an exhausted balance are an absence with no entitlement behind them, which
  // item 5 puts out of scope for this version — so the refusal is what keeps
  // this version from depending on a calculation it deliberately does not have.
  // If it ever fires in earnest, that is the signal to build the unpaid absence
  // as a feature, never to route around the refusal with arithmetic.
  const sickUsed = daysUsedIn(
    spans,
    facts.month,
    "sick",
    facts.terms.restDay,
  );
  const sickAvailable = sickDaysAvailable(employment, context.openingBalances);
  if (sickUsed > sickAvailable) {
    refusals.push({
      code: "sickBalanceExhausted",
      link: LINK_FOR.sickBalanceExhausted,
      message: he.sheet.refusals.sickBalanceExhausted(sickAvailable, sickUsed),
      dates: facts.spans
        .filter((span) => span.kind === "sick")
        .map((span) => span.from),
    });
  }

  // Two movements of one kind on one advance. The pair shares a key, so an
  // override could not reach one without reaching the other (items 17, 24) —
  // the same rule item 16 states for two third-party payments of one kind, and
  // answered the same way: the two are entered as one summed figure.
  for (const [advanceNumber, kind] of duplicateAdvanceMovements(facts.advances)) {
    refusals.push({
      code: "advanceRecordedTwice",
      message: he.sheet.refusals.advanceRecordedTwice(advanceNumber, kind),
      // A movement carries no date of its own; what it concerns is an advance.
      dates: [],
      link: LINK_FOR.advanceRecordedTwice,
    });
  }

  return refusals;
}

/**
 * Thrown rather than returned, so a caller that ignores the refusals cannot
 * quietly receive a number instead. `validateMonth` is exported beside it for
 * the interface, which wants to show the reasons before anyone presses export.
 */
export class InvalidMonthError extends Error {
  readonly refusals: Refusal[];
  /**
   * The month that was refused.
   *
   * Carried because a refusal is no longer always raised by a caller that knew
   * which month it asked for: `calculateSeries` replays a worker's whole
   * history, and one refused month stops the replay. Without the month on the
   * error the screen catching it can say what is wrong but not where, which for
   * twenty years of months is the same as saying nothing.
   */
  readonly month: YearMonth;

  constructor(refusals: Refusal[], month: YearMonth) {
    super(refusals.map((refusal) => refusal.message).join(" "));
    this.name = "InvalidMonthError";
    this.refusals = refusals;
    this.month = month;
  }
}
