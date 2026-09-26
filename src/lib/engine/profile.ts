import {
  FRIDAY,
  SATURDAY,
  SUNDAY,
  WEEK_LENGTH,
  addDays,
  addMonths,
  compareIsoDate,
  compareMonth,
  daysInMonth,
  eachDate,
  fromIsoDate,
  isIsoDate,
  isMonthNumber,
  isRestDay,
  isoOf,
  monthOf,
  parseYearMonth,
  sameMonth,
  yearMonthText,
} from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { reviewTaxPercentage } from "@/lib/engine/incomeTax";
import { recuperationDaysCarriedIntoFirstMonth } from "@/lib/engine/recuperation";
import { recordOf } from "@/lib/engine/repository";
import { salaryFor } from "@/lib/engine/salary";
import type { MonthRecord, WorkerProfile } from "@/lib/engine/repository";
import {
  closeMonth,
  genders,
  incomeTaxModes,
  profileTerms,
  snapshotTerms,
} from "@/lib/engine/types";
import type {
  Gender,
  IncomeTaxSetting,
  MonthFacts,
  OpeningAdvance,
  OpeningPosition,
  WorkerTerms,
} from "@/lib/engine/types";
import { parseShekels } from "@/lib/money";
import type { IsoDate, WorkerDocuments, YearMonth } from "@/lib/types";

/**
 * What the profile screen may change about a worker, and the rules that say
 * whether a draft is a change at all.
 *
 * **The rules are here and not in the action**, for the reason every other
 * `review*` in this directory gives: a server action is reachable by a crafted
 * request, so what the form offers is never the rule (specs.md Part 3), and a
 * rule written as a pure function over a draft can be checked without a store,
 * a request or a clock. The form runs the same functions while the user types,
 * which is one rule read twice rather than two rules that agree today.
 *
 * **Nothing here seals or stores an identifying number** (items 22, 28). The
 * new worker's passport number passes through the draft untouched; sealing
 * happens above the repository, in `src/lib/identifyingNumbers.ts`, and this
 * file moves dates and terms.
 */

/**
 * The three days the law allows as the weekly rest day (specs.md item 5).
 *
 * **The list is the source and the type is the check**, which is the pair
 * `userLineDirections` and `UserLineDirection` already make: the chips that
 * offer the choice, the server check that refuses a value outside it and the
 * calendar that counts against it read one list, and a fourth day added to a
 * hand-kept array would compile clean against a union that had not grown with
 * it. Written in week order rather than in likelihood order, because the
 * control draws them as a row of a week and a row of a week that starts on
 * Saturday reads as a mistake.
 */
export const restDayChoices = [SUNDAY, FRIDAY, SATURDAY] as const satisfies readonly RestDay[];

/** Whether a value the browser sent is one of a fixed list. It arrives as an
 * unknown because a crafted request may send anything, and a union cannot
 * check a value that reaches the server as data. The list checked is the list
 * offered, so a member added to one cannot be refused by the other. */
function isOneOf<T>(list: readonly T[], value: unknown): value is T {
  return list.some((member) => member === value);
}

/** One of the three rest days (item 5). */
export function isAllowedRestDay(value: unknown): value is RestDay {
  return isOneOf(restDayChoices, value);
}

/** One of the genders (specs.md item 17). */
export function isAllowedGender(value: unknown): value is Gender {
  return isOneOf(genders, value);
}

/**
 * An income-tax setting the browser sent, or why it cannot be stored (specs.md
 * item 17).
 *
 * **The server decides and the form never does** (Part 3), which matters more
 * here than on the other terms: this one carries a free number, and a rate that
 * reached the profile past the control would quietly withhold the wrong amount
 * from every month afterwards without anything on the sheet looking unusual.
 *
 * **Zero is refused rather than accepted as "nothing"**, because `none` is what
 * says that and the whole reason there are three modes is so a family never has
 * to express a decision as an amount. A rate above the whole salary is refused
 * for the reason a negative one is: it cannot be meant, and it would pay her
 * nothing while looking like an ordinary withholding.
 */
export function reviewIncomeTax(
  mode: unknown,
  percentageText: string,
): { ok: true; setting: IncomeTaxSetting } | { ok: false; reason: "incomeTaxMode" | "incomeTaxRate" } {
  if (!isOneOf(incomeTaxModes, mode)) {
    return { ok: false, reason: "incomeTaxMode" };
  }
  if (mode !== "percentage") {
    return { ok: true, setting: { mode } };
  }
  // The same parse the month's own percentage correction uses, so the profile
  // and a single month cannot come to disagree about what "2.5" means.
  const percentage = reviewTaxPercentage(percentageText);
  if (percentage === null) return { ok: false, reason: "incomeTaxRate" };
  return { ok: true, setting: { mode: "percentage", percentage } };
}

/**
 * A date as the profile's fields hand it over, or `null` for a field the user
 * cleared.
 *
 * **An empty field is a document whose date has not been entered and never a
 * document with no expiry** (item 28): every one of the three has one, so
 * clearing the field says the family has not typed it in yet and the warning
 * that would have fired simply has nothing to fire on.
 *
 * 2026-02-30 is refused (`isIsoDate`) rather than rolled into March: a permit
 * that silently expires on the wrong day is exactly the class of mistake
 * `specs.md` Part 5 is about.
 */
export function reviewDate(text: string): IsoDate | null | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return isIsoDate(trimmed) ? trimmed : "invalid";
}

/** The earliest date an employment may have begun (specs.md item 6). */
const EARLIEST_EMPLOYMENT: IsoDate = "2020-01-01";

/**
 * The last date an employment may have begun: one year after today (specs.md
 * item 6). The 29th of February has no anniversary, so it
 * falls back to the last day of February rather than rolling into March.
 */
function latestEmployment(today: IsoDate): IsoDate {
  const [year, month, day] = today.split("-").map(Number);
  const next = { year: year + 1, month };
  return isoOf(next, Math.min(day, daysInMonth(next)));
}

/**
 * The date the employment began, or why it is refused (specs.md item 6):
 * `"invalid"` for no date at all, `"range"` for a date before 2020 or more than
 * a year after `today`, and `"afterFirstMonth"` for a correction that would
 * leave the worker's first month before her employment. The same rule serves
 * the wizard and a later correction, so the two cannot disagree; only a
 * correction passes `firstMonth`, because the wizard derives it from the date.
 */
export function reviewEmployedSince(
  text: string,
  today: IsoDate,
  firstMonth?: YearMonth,
): IsoDate | "invalid" | "range" | "afterFirstMonth" {
  const date = reviewDate(text);
  if (date === null || date === "invalid") return "invalid";
  if (
    compareIsoDate(date, EARLIEST_EMPLOYMENT) < 0 ||
    compareIsoDate(date, latestEmployment(today)) > 0
  ) {
    return "range";
  }
  if (firstMonth && compareMonth(monthOf(date), firstMonth) > 0) {
    return "afterFirstMonth";
  }
  return date;
}

/**
 * The first month of a worker added today (specs.md item 6): the month she is
 * added in, and never earlier than the month her employment begins — a start
 * date still ahead makes that month the first.
 */
export function firstMonthFor(employedSince: IsoDate, today: IsoDate): YearMonth {
  const hired = monthOf(employedSince);
  const added = monthOf(today);
  return compareMonth(hired, added) > 0 ? hired : added;
}

/**
 * The first months a worker added today may be given (specs.md item 6): the
 * month she is added in, and the month before it so a family registering early
 * in a month can still pay the month that just ended — but never a month
 * before the employment began. One choice means none is offered.
 */
export function firstMonthChoices(
  employedSince: IsoDate,
  today: IsoDate,
): YearMonth[] {
  const first = firstMonthFor(employedSince, today);
  const previous = addMonths(first, -1);
  return compareMonth(monthOf(employedSince), previous) <= 0
    ? [first, previous]
    : [first];
}

/**
 * Whether the wizard asks for the opening position: only when the employment
 * began before the first month, since otherwise the application has seen the
 * whole of it (specs.md item 6).
 */
export function asksOpeningPosition(
  employedSince: IsoDate,
  firstMonth: YearMonth,
): boolean {
  return compareMonth(monthOf(employedSince), firstMonth) < 0;
}

/**
 * Whether the wizard asks if the recuperation payment was already made: only
 * when the payment for the employment year running at the first month fell
 * before the first month and is owed at all (specs.md item 15).
 */
export function asksRecuperationPaid(
  employedSince: IsoDate,
  recuperationMonth: number,
  firstMonth: YearMonth,
): boolean {
  return (
    recuperationDaysCarriedIntoFirstMonth(
      employedSince,
      recuperationMonth,
      firstMonth,
    ) > 0
  );
}

/** The three documents as the form hands them over — each as typed, so the
 * rule that reads them is the server's (Part 3). */
export interface DocumentsDraft {
  employmentPermitExpiry: string;
  workVisaExpiry: string;
  passportExpiry: string;
}

type ReviewedDocuments =
  | { ok: true; documents: WorkerDocuments }
  | { ok: false; reason: "date" };

/** The three dates, or the reason one of them is not a date. One refusal for
 * all three: which field it was is visible on the screen, and a refusal per
 * document would be three sentences saying the same thing. */
export function reviewDocuments(draft: DocumentsDraft): ReviewedDocuments {
  const permit = reviewDate(draft.employmentPermitExpiry);
  const visa = reviewDate(draft.workVisaExpiry);
  const passport = reviewDate(draft.passportExpiry);
  if (permit === "invalid" || visa === "invalid" || passport === "invalid") {
    return { ok: false, reason: "date" };
  }
  return {
    ok: true,
    documents: {
      employmentPermitExpiry: permit,
      workVisaExpiry: visa,
      passportExpiry: passport,
    },
  };
}

/**
 * The days part of the opening position, as the form hands it over (item 6).
 *
 * Days and not money, so `parseShekels` is not the reader: a balance is a
 * count that may carry a half — a part-day of vacation leaves the balance in
 * that proportion (item 7) — and it may be zero, which for a worker who starts
 * with nothing accrued is the ordinary answer rather than a refusal.
 */
export interface OpeningDaysDraft {
  vacationDays: string;
  sickDays: string;
}

/**
 * A count of days, or `null`.
 *
 * Negative is refused: a balance already accrued is what she has, and a
 * worker cannot begin owing days. The ceiling is not checked here — ninety is
 * where the sick *accrual* stops (item 8) and a family stating an opening
 * position states what they were told, so refusing it would refuse a fact
 * rather than a mistake.
 */
export function parseDays(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** One advance carried in from before the application, as the form hands it
 * over (item 6). The number is not among them: it is minted from the worker's
 * own ledger and is never the caller's to choose (item 20). */
export interface OpeningAdvanceDraft {
  principal: string;
  repaid: string;
  note: string;
}

export type OpeningRefusal =
  | "days"
  | "principal"
  | "repaid"
  /** Repaid beyond the principal, which would be a debt already overpaid before
   * the application saw it — the same refusal item 20 makes of a repayment
   * entered in a month, made here because the opening position is where the
   * figure first enters (item 6). */
  | "overRepaid";

type ReviewedOpeningAdvance =
  | { ok: true; advance: OpeningAdvance }
  | { ok: false; reason: OpeningRefusal };

/**
 * One opening advance, or the reason it is not one.
 *
 * `number` is passed in for the reason `reviewUserLine`'s `id` is: it is the
 * store's to give, and a function that minted one from the worker's history
 * would be a function whose output cannot be asserted.
 */
export function reviewOpeningAdvance(
  draft: OpeningAdvanceDraft,
  advanceNumber: number,
): ReviewedOpeningAdvance {
  const principalAgorot = parseShekels(draft.principal);
  // Zero is refused with a minus: an advance of nothing is not an advance the
  // family gave, and it would stand on the payments screen for ever as a debt
  // that can never be repaid because nothing is owed.
  if (principalAgorot === null || principalAgorot === 0) {
    return { ok: false, reason: "principal" };
  }

  // Zero *is* an ordinary answer here — an advance given and not yet repaid at
  // all is the case Part 4's own ₪10,000 is — so an empty field reads as none
  // repaid rather than as a refusal.
  const repaidAgorot =
    draft.repaid.trim() === "" ? 0 : parseShekels(draft.repaid);
  if (repaidAgorot === null) return { ok: false, reason: "repaid" };
  if (repaidAgorot > principalAgorot) {
    return { ok: false, reason: "overRepaid" };
  }

  const note = draft.note.trim();
  return {
    ok: true,
    advance: {
      number: advanceNumber,
      principalAgorot,
      repaidAgorot,
      ...(note === "" ? {} : { note }),
    },
  };
}

/**
 * The vacation and sick days the employment opened with, or the reason they
 * are not a position (item 6).
 *
 * The rest of the position is not reviewed here and is carried through: the
 * advances are added and removed one at a time, each through
 * `reviewOpeningAdvance`, so a screen correcting a balance never restates a
 * debt or a count.
 */
export function reviewOpeningDays(
  draft: OpeningDaysDraft,
  current: OpeningPosition,
): { ok: true; position: OpeningPosition } | { ok: false; reason: "days" } {
  const vacationDays = parseDays(draft.vacationDays);
  const sickDays = parseDays(draft.sickDays);
  if (vacationDays === null || sickDays === null) {
    return { ok: false, reason: "days" };
  }
  return { ok: true, position: { ...current, vacationDays, sickDays } };
}

/**
 * Whether a profile change reaches the terms a month copies (`MonthTerms`), and
 * so has to be carried into the months that follow the profile.
 *
 * **Decided by comparing the two snapshots, never by the caller**: gender, the
 * insurer and the employment date are on the profile and not on a month, and a
 * flag picked by hand at each action is how two of them came to re-save every
 * month. Compared as JSON because the engine runs in the browser too; a
 * difference in key order alone reads as a change, which costs one needless
 * re-save and never a missed one.
 *
 * **It compares the profile's terms and not one month's** (`profileTerms`): a
 * standing line's lifetime moved from June to August changes which months carry
 * it without changing the line, and a comparison made through one month's
 * filter would answer "nothing changed" and leave the months unfilled.
 */
export function termsDiffer(before: WorkerTerms, after: WorkerTerms): boolean {
  return (
    JSON.stringify(profileTerms(before)) !== JSON.stringify(profileTerms(after))
  );
}

/**
 * The months a change to the profile's terms reaches (specs.md Part 5).
 *
 * **A month is a draft until the user has confirmed the minimum wage against
 * it, and that is the moment its figures stop moving with the profile.** Part 5
 * says it in those words: confirming copies the base salary off the profile
 * onto the month, and from then on the month is read against its own stored
 * terms so that re-exporting August two years later reproduces August (Part 3).
 * Before that moment there is nothing to reproduce — a draft month is the
 * profile's terms seen through one month's calendar.
 *
 * **A confirmed month is left exactly as it was confirmed** (`followsProfile`),
 * so the months around it follow the profile while it keeps the terms its own
 * sheet was filed with.
 *
 * **The rest day is the one term that stops at the current month** (item 5): a
 * change of it "reaches the current month and the months after it, and never a
 * month before", so an earlier month keeps the day it was calculated with while
 * taking the rest of the new terms. Read off the month's own snapshot rather
 * than off a `before` profile handed in, so a caller cannot get it wrong by
 * passing the wrong pair — and `today` is a parameter because nothing in the
 * engine reads a clock (`CLAUDE.md`).
 *
 * It returns records rather than writing them, so the rule can be checked
 * without a store, and the spans are dropped on the way through because a
 * month's spans belong to the worker (`repository.ts`).
 */
export function monthsFollowingProfile(
  months: MonthFacts[],
  profile: WorkerTerms,
  today: IsoDate,
): MonthRecord[] {
  const current = monthOf(today);
  return months.filter(followsProfile).map((facts) => {
    // Snapshotted per month rather than once, because a standing line's
    // lifetime decides which months carry it (item 20): one snapshot reused
    // would put every line into every month it was extended past.
    const terms = snapshotTerms(profile, facts.month);
    return {
      ...recordOf(facts),
      terms:
        compareMonth(facts.month, current) < 0
          ? { ...terms, restDay: facts.terms.restDay }
          : terms,
    };
  });
}

/**
 * Whether a month's figures still move with the profile (`specs.md` Part 5).
 *
 * **Confirming is the moment they stop.** Part 5 says it in those words:
 * confirming copies the base salary off the profile onto the month, and from
 * then on the month is read against its own stored terms so that re-exporting
 * August two years later reproduces August (Part 3). Before that moment a month
 * is a draft — the profile's terms seen through one month's calendar — and
 * there is nothing to reproduce.
 *
 * **A month corrected after it was confirmed stays out too**, and that is the
 * rule rather than an omission: a correction is a specific one somebody made to
 * that month, and letting the profile write over it would undo it. `confirmedAt`
 * alone is therefore the whole test, and `updatedAt` is not consulted.
 *
 * It is one predicate because the rule has one meaning: the profile's terms, a
 * change of salary and the question a rest-day change asks all read it, and
 * three copies of `confirmedAt === undefined` would be three places for it to
 * drift.
 */
function followsProfile(facts: Pick<MonthFacts, "confirmedAt">): boolean {
  return facts.confirmedAt === undefined;
}

/**
 * Why one of the three answers to a stranded free rest day is not offered
 * (specs.md item 5). Carried beside the choice rather than folded into a
 * sentence, so the screen names the reason in its own words and a test asserts
 * the rule rather than the wording.
 */
export type StrandedRefusal =
  /** The day the move would write on already carries a mark. */
  | "targetMarked"
  /** The move would carry the mark out of its own month. */
  | "otherMonth"
  /** The vacation balance does not cover a day taken on that date. */
  | "vacationBalance";

/** One answer, and the date it would write the mark on. A choice not offered
 * still names its date, because the screen says which day it would have been
 * and why that day cannot take it. Not exported: it is reached through
 * `StrandedFreeRestDay`'s own fields, and nothing names it. */
interface StrandedChoice {
  date: IsoDate;
  offered: boolean;
  reason?: StrandedRefusal;
}

/**
 * A free rest day a change of the weekly rest day would leave on a day that is
 * no longer one, with what each answer would write.
 *
 * **Deleting is not among them because it is never refused**: it needs no date
 * and no balance, so a fourth field saying `offered: true` for ever would be a
 * field nobody may read as anything else.
 */
export interface StrandedFreeRestDay {
  /** The mark's own id, so an answer names the mark rather than its position
   * in a list that a second worker's marks could reorder. */
  id: string;
  month: YearMonth;
  /** The day the mark sits on today — the old rest day. */
  date: IsoDate;
  /** Turn it into an ordinary vacation day on the same date. */
  convert: StrandedChoice;
  /** The nearest new rest day before the mark, and the nearest after it. */
  moveEarlier: StrandedChoice;
  moveLater: StrandedChoice;
}

/** How many days back the nearest `restDay` lies from a date that is not one:
 * one to six, never zero, because a date already on the rest day is not
 * stranded. Built by arithmetic on the weekday rather than by stepping a
 * `Date`, so a daylight-saving boundary cannot move it (`CLAUDE.md`). */
function daysBackToRestDay(date: IsoDate, restDay: RestDay): number {
  return ((fromIsoDate(date).getUTCDay() - restDay + WEEK_LENGTH) % WEEK_LENGTH);
}

/**
 * The free rest days a change to `newRestDay` would strand, each with what the
 * three answers would write (specs.md item 5).
 *
 * **Asked before the change is saved, which is what makes it answerable**: the
 * months still hold the old rest day, so a replay of the worker still runs and
 * the vacation balances handed in are real figures. Once the change is written
 * the stranded mark refuses its own month (`validateMonth`), and by then there
 * is nothing left to ask.
 *
 * Only the current month and the ones after it are looked at, and only those
 * still following the profile, because those are the only months the change
 * reaches (`monthsFollowingProfile`). A mark on an earlier month, or on a month
 * already confirmed, is not stranded at all — that month keeps its old rest
 * day.
 *
 * `vacationClosing` is the closing vacation balance of each month, keyed by
 * `yearMonthText`, as the worker's replay produced it. It is a parameter and
 * never derived here for the reason the minimum wage is: the balance is the
 * result of walking every month from the opening position (item 13), and a
 * function that walked it could not be checked against a balance that was not
 * this worker's. A month absent from the map has no balance to draw on, so a
 * conversion there is not offered.
 *
 * **Where one month holds two stranded marks, each is measured against the same
 * balance**, because the user answers them one at a time and may convert only
 * one. What she actually chose is checked again together when the change is
 * saved, which is the only moment the combination exists.
 */
export function strandedFreeRestDays(
  months: readonly MonthFacts[],
  newRestDay: RestDay,
  today: IsoDate,
  vacationClosing: ReadonlyMap<string, number>,
): StrandedFreeRestDay[] {
  // Every day any mark covers, across all the months handed in and not only the
  // ones the change reaches: a spell of sickness is stored whole in the month it
  // began (Part 3), so a January spell running into February marks February days
  // that February's own spans never mention.
  const marked = new Set<IsoDate>();
  for (const facts of months) {
    for (const span of closeMonth(facts, today).spans) {
      for (const date of eachDate(span.from, span.to)) marked.add(date);
    }
  }

  const current = monthOf(today);
  const stranded: StrandedFreeRestDay[] = [];
  for (const facts of months) {
    if (compareMonth(facts.month, current) < 0) continue;
    // A confirmed month keeps the rest day it was filed with
    // (`followsProfile`), so its marks are not stranded and asking about them
    // would be asking about a month that is not changing.
    if (!followsProfile(facts)) continue;
    for (const span of facts.spans) {
      if (span.kind !== "freeRestDay") continue;
      if (isRestDay(span.from, newRestDay)) continue;

      const back = daysBackToRestDay(span.from, newRestDay);
      const move = (target: IsoDate): StrandedChoice => {
        // The month is checked before the mark, because a target in another
        // month may well be free and saying so would be answering a question
        // the user was not asked.
        if (!sameMonth(monthOf(target), facts.month)) {
          return { date: target, offered: false, reason: "otherMonth" };
        }
        if (marked.has(target)) {
          return { date: target, offered: false, reason: "targetMarked" };
        }
        return { date: target, offered: true };
      };

      const available = vacationClosing.get(yearMonthText(facts.month)) ?? 0;
      stranded.push({
        id: span.id,
        month: facts.month,
        date: span.from,
        convert:
          available >= 1
            ? { date: span.from, offered: true }
            : { date: span.from, offered: false, reason: "vacationBalance" },
        moveEarlier: move(addDays(span.from, -back)),
        moveLater: move(addDays(span.from, WEEK_LENGTH - back)),
      });
    }
  }
  return stranded;
}

/**
 * The stored months a change reaches, with the base they now carry.
 *
 * Only months from the change on, and each at the salary in force during it —
 * which is not always the new one, because a later change already on the list
 * still holds from its own month. The month keeps its confirmed minimum and is
 * floored at it, exactly as confirming it does (`baseForMonth`), so a raise can
 * never write a month that pays under its own minimum.
 *
 * **And never a month already confirmed** (`followsProfile`), which item 2 puts
 * plainly: a payslip is never a restatement of months already paid. A raise
 * agreed today does not reach back into a sheet the family has already filed,
 * however far back the change is dated.
 */
export function monthsReachedBySalaryChange(
  months: readonly MonthFacts[],
  terms: Pick<WorkerTerms, "baseMonthlySalaryAgorot" | "salaryChanges">,
  from: YearMonth,
): MonthRecord[] {
  return months
    .filter(followsProfile)
    .filter((facts) => compareMonth(facts.month, from) >= 0)
    .map((facts) => ({
      ...recordOf(facts),
      confirmedWage: {
        ...facts.confirmedWage,
        baseAgorot: Math.max(
          salaryFor(terms, facts.month),
          facts.confirmedWage.minimumAgorot,
        ),
      },
    }));
}

/**
 * The weekly rest-eve supplement as typed, in agorot, or `null` where it is not
 * an amount (specs.md item 14).
 *
 * **Empty is zero and not a refusal.** Nothing in law requires the supplement,
 * so a family that pays none — or that has stopped paying it — says so by
 * leaving the field empty. One reader for the wizard and for `/settings`, so
 * the two cannot disagree about what an empty field means.
 */
export function parseRestEveSupplement(text: string): number | null {
  return text.trim() === "" ? 0 : parseShekels(text);
}

/**
 * A worker as the `הוספת עובד` wizard hands her over — every field as the user
 * typed or chose it, so the rule that reads them is the server's (Part 3).
 *
 * **The four steps of the artboard are three drafts and a summary**, and this
 * is all three at once rather than one per step: nothing is written until the
 * last step, so there is no half-saved worker to review. What the wizard shows
 * while the user types is this same function run on what has been filled in so
 * far, which is one rule read twice rather than two rules that agree today.
 */
export interface NewWorkerDraft {
  name: string;
  /** Unknown because a radio reaches the server as data and a union cannot
   * check data (`isAllowedGender`). */
  gender: unknown;
  /**
   * Her passport number, which is one of the four sealed at rest (items 22,
   * 28).
   *
   * **Empty is "not entered yet" and is an ordinary answer**, exactly as an
   * empty document date is: a family adding a worker in the middle of an
   * employment may not have the passport to hand, and refusing the whole
   * profile over it would send them away to find a document in order to record
   * a salary. The artboard does not mark it optional; the departure is here
   * because the alternative is a required field with no rule behind it.
   *
   * **It leaves this function as it arrived and is never stored by anything
   * that called it.** Sealing happens above the repository, in
   * `src/lib/identifyingNumbers.ts`, and no store ever sees the plaintext.
   */
  passportNumber: string;
  /** A country *code*, from the holiday lists the household holds — the
   * published pages are addressed by code (item 12). The artboard marks the
   * field optional and it cannot be: it is what her year's holidays are drawn
   * from, and a worker with no country would be offered no list at all. */
  country: string;
  employedSince: string;
  restDay: unknown;
  recuperationMonth: string;
  baseMonthlySalary: string;
  restEveSupplement: string;
  insurer: string;
  incomeTaxMode: unknown;
  incomeTaxPercentage: string;
  /** "2026-09", one of `firstMonthChoices` (item 6). */
  firstMonth: string;
  /**
   * The opening position as typed (item 6). Read only when the employment
   * began before the first month; otherwise the position is zero, whatever
   * the fields hold.
   */
  opening: OpeningDraft;
}

/** The opening position as the wizard hands it over (item 6). */
export interface OpeningDraft {
  vacationDays: string;
  sickDays: string;
  vacationUsedThisYear: string;
  holidayUsedThisYear: string;
  /** Yes, no, or not answered yet (`null`). Unknown because it arrives as data. */
  recuperationPaid: unknown;
  /** "2025-07", the month it was paid in, read when the answer is yes. */
  recuperationPaidIn: string;
  advances: OpeningAdvanceDraft[];
}

/** Why a draft is not yet a worker, in the words the wizard shows. Each names
 * the field it belongs to, because the wizard marks that field rather than
 * printing a sentence at the foot of a four-step form. */
export type NewWorkerRefusal =
  | "name"
  | "gender"
  | "country"
  | "employedSince"
  /** A start date before 2020 or more than a year ahead (item 6). */
  | "employedSinceRange"
  | "restDay"
  | "recuperationMonth"
  | "salary"
  /** A salary below the confirmed minimum wage, which the profile may never be
   * set to (`CLAUDE.md`'s non-negotiables, item 3). Its own refusal and not
   * `salary`, because the two are different mistakes: one is not a number and
   * the other is a number the family may not agree to. */
  | "belowMinimum"
  | "supplement"
  | "incomeTaxMode"
  | "incomeTaxRate"
  /** A first month that is not one of the choices the start date allows. */
  | "firstMonth"
  /** A balance that is not a count of days. */
  | "openingDays"
  /** A count of days used this year that is not a count of days. */
  | "openingUsed"
  | "recuperationPaid"
  /** A payment month that is not before the first month, or is before the
   * employment began. */
  | "recuperationPaidIn"
  /** An opening advance that `reviewOpeningAdvance` refuses. */
  | "openingAdvance";

/**
 * The first name alone, for "לדף של [שם]" (`Worker.firstName`).
 *
 * The wizard asks for one full-name field, as the artboard draws it, so the
 * first name is read off it rather than asked for twice. The first
 * whitespace-separated run, which is how a Hebrew name written "שם פרטי ושם
 * משפחה" reads; a single-word name is its own first name.
 */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

type ReviewedNewWorker =
  | { ok: true; profile: Omit<WorkerProfile, "id"> }
  | { ok: false; reason: NewWorkerRefusal };

/**
 * A new worker, or the first reason she is not one yet.
 *
 * **The id is not minted here**, for the reason `reviewOpeningAdvance`'s number
 * is not: an id is the store's to give and never the caller's, and a function
 * that minted one would be a function whose output cannot be asserted.
 *
 * **The minimum wage is a parameter and never looked up inside**, which is the
 * rule the whole engine keeps: it is the wage in force during the month the
 * employment is being set up in, read by the caller from the dated table, and a
 * function that reached for it here could not be checked against a wage that
 * was not today's.
 *
 * **What the wizard does not ask for opens empty rather than guessed** — no
 * standing lines, no document dates, no holiday exception. Each has a control
 * on the worker's own page already, and a default invented here would be a
 * figure the family never stated (`CLAUDE.md` rule 4). The opening position is
 * asked only when the employment began before the first month, and is zero for
 * a worker whose employment the application watches from its first month.
 */
export function reviewNewWorker(
  draft: NewWorkerDraft,
  minimumWageAgorot: number,
  today: IsoDate,
): ReviewedNewWorker {
  const name = draft.name.trim();
  if (name === "") return { ok: false, reason: "name" };

  if (!isAllowedGender(draft.gender)) return { ok: false, reason: "gender" };

  const country = draft.country.trim();
  if (country === "") return { ok: false, reason: "country" };

  // A start date and not a document date, so an empty field is a refusal here
  // where it is an ordinary answer there: seniority is counted from it, and
  // every accrual tier, the recuperation entitlement and the proration of a
  // holiday year rest on it (items 7, 10, 15).
  const employedSince = reviewEmployedSince(draft.employedSince, today);
  if (employedSince === "invalid") return { ok: false, reason: "employedSince" };
  if (employedSince === "range") {
    return { ok: false, reason: "employedSinceRange" };
  }

  if (!isAllowedRestDay(draft.restDay)) return { ok: false, reason: "restDay" };

  const recuperationMonth = Number(draft.recuperationMonth.trim());
  if (!isMonthNumber(recuperationMonth)) {
    return { ok: false, reason: "recuperationMonth" };
  }

  const baseMonthlySalaryAgorot = parseShekels(draft.baseMonthlySalary);
  if (baseMonthlySalaryAgorot === null || baseMonthlySalaryAgorot === 0) {
    return { ok: false, reason: "salary" };
  }
  if (baseMonthlySalaryAgorot < minimumWageAgorot) {
    return { ok: false, reason: "belowMinimum" };
  }

  const restEveSupplementAgorot = parseRestEveSupplement(draft.restEveSupplement);
  if (restEveSupplementAgorot === null) {
    return { ok: false, reason: "supplement" };
  }

  const tax = reviewIncomeTax(draft.incomeTaxMode, draft.incomeTaxPercentage);
  if (!tax.ok) return { ok: false, reason: tax.reason };

  const firstMonth = parseYearMonth(draft.firstMonth.trim());
  if (
    firstMonth === null ||
    !firstMonthChoices(employedSince, today).some((choice) =>
      sameMonth(choice, firstMonth),
    )
  ) {
    return { ok: false, reason: "firstMonth" };
  }

  const opening = asksOpeningPosition(employedSince, firstMonth)
    ? reviewOpeningPosition(draft.opening, employedSince, recuperationMonth, firstMonth)
    : { ok: true as const, position: EMPTY_OPENING };
  if (!opening.ok) return { ok: false, reason: opening.reason };

  return {
    ok: true,
    profile: {
      name,
      firstName: firstNameOf(name),
      gender: draft.gender,
      employedSince,
      restDay: draft.restDay,
      recuperationMonth,
      baseMonthlySalaryAgorot,
      restEveSupplementAgorot,
      country,
      incomeTax: tax.setting,
      insurer: draft.insurer.trim(),
      standingLines: [],
      documents: {
        employmentPermitExpiry: null,
        workVisaExpiry: null,
        passportExpiry: null,
      },
      firstMonth,
      openingPosition: opening.position,
    },
  };
}

const EMPTY_OPENING: OpeningPosition = {
  vacationDays: 0,
  sickDays: 0,
  vacationUsedThisYear: 0,
  holidayUsedThisYear: 0,
  recuperationPaidIn: null,
  advances: [],
};

/**
 * The opening position a new worker starts from, or the first reason it is not
 * one (specs.md items 6 and 15).
 *
 * **Each question is read only where it is asked.** The days used this year
 * are asked when the first month is not January, since in January nothing of
 * the year came before it; whether recuperation was paid is asked only when
 * `asksRecuperationPaid` says a payment fell before the first month. A field
 * the wizard did not show is not read, so a value left in it from an earlier
 * answer cannot reach the profile.
 *
 * The advances are numbered from one: a new worker has no ledger yet, and the
 * number is the store's to give in every other case (item 20).
 */
function reviewOpeningPosition(
  draft: OpeningDraft,
  employedSince: IsoDate,
  recuperationMonth: number,
  firstMonth: YearMonth,
): { ok: true; position: OpeningPosition } | { ok: false; reason: NewWorkerRefusal } {
  const vacationDays = parseDays(draft.vacationDays);
  const sickDays = parseDays(draft.sickDays);
  if (vacationDays === null || sickDays === null) {
    return { ok: false, reason: "openingDays" };
  }

  let vacationUsedThisYear = 0;
  let holidayUsedThisYear = 0;
  if (firstMonth.month > 1) {
    const vacationUsed = parseDays(draft.vacationUsedThisYear);
    const holidayUsed = parseDays(draft.holidayUsedThisYear);
    if (vacationUsed === null || holidayUsed === null) {
      return { ok: false, reason: "openingUsed" };
    }
    vacationUsedThisYear = vacationUsed;
    holidayUsedThisYear = holidayUsed;
  }

  let recuperationPaidIn: YearMonth | null = null;
  if (asksRecuperationPaid(employedSince, recuperationMonth, firstMonth)) {
    if (draft.recuperationPaid !== true && draft.recuperationPaid !== false) {
      return { ok: false, reason: "recuperationPaid" };
    }
    if (draft.recuperationPaid) {
      const paidIn = parseYearMonth(draft.recuperationPaidIn.trim());
      if (
        paidIn === null ||
        compareMonth(paidIn, firstMonth) >= 0 ||
        compareMonth(paidIn, monthOf(employedSince)) < 0
      ) {
        return { ok: false, reason: "recuperationPaidIn" };
      }
      recuperationPaidIn = paidIn;
    }
  }

  const advances: OpeningAdvance[] = [];
  for (const [index, advance] of draft.advances.entries()) {
    const reviewed = reviewOpeningAdvance(advance, index + 1);
    if (!reviewed.ok) return { ok: false, reason: "openingAdvance" };
    advances.push(reviewed.advance);
  }

  return {
    ok: true,
    position: {
      vacationDays,
      sickDays,
      vacationUsedThisYear,
      holidayUsedThisYear,
      recuperationPaidIn,
      advances,
    },
  };
}
