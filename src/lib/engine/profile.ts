import { FRIDAY, SATURDAY, SUNDAY, fromIsoDate, toIsoDate } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { recordOf } from "@/lib/engine/repository";
import type { MonthRecord } from "@/lib/engine/repository";
import { snapshotTerms } from "@/lib/engine/types";
import type {
  MonthFacts,
  OpeningAdvance,
  OpeningPosition,
  WorkerTerms,
} from "@/lib/engine/types";
import { parseShekels } from "@/lib/money";
import type { IsoDate, WorkerDocuments } from "@/lib/types";

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
 * **Nothing here reads the profile's identifying numbers, because it holds
 * none** (item 28, item 22). The five encrypted identifiers arrive in stage 3
 * with the key that protects them; this file moves dates and terms.
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

/** Whether a value the browser sent is one of the three. It arrives as an
 * unknown because a crafted request may send anything; the union cannot check
 * a value that reaches the server as data (item 5). */
export function isAllowedRestDay(value: unknown): value is RestDay {
  return restDayChoices.some((day) => day === value);
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
 * The date is checked by building it and reading it back, which is the only
 * check that refuses 2026-02-30 — a regular expression accepts it and a `Date`
 * rolls it forward to March, and a permit that silently expires on the wrong
 * day is exactly the class of mistake `specs.md` Part 5 is about. `fromIsoDate`
 * builds in UTC, so nothing here can shift by a day across a daylight-saving
 * boundary (`CLAUDE.md`).
 */
export function reviewDate(text: string): IsoDate | null | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "invalid";
  const date = fromIsoDate(trimmed);
  if (Number.isNaN(date.getTime())) return "invalid";
  return toIsoDate(date) === trimmed ? trimmed : "invalid";
}

/** The three documents as the form hands them over — each as typed, so the
 * rule that reads them is the server's (Part 3). */
export interface DocumentsDraft {
  employmentPermitExpiry: string;
  workVisaExpiry: string;
  passportExpiry: string;
}

export type ReviewedDocuments =
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

export type ReviewedOpeningAdvance =
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
 * The advances are not reviewed here and are carried through: they are added
 * and removed one at a time, each through `reviewOpeningAdvance`, so a screen
 * correcting a balance never restates a debt.
 */
export function reviewOpeningDays(
  draft: OpeningDaysDraft,
  advances: OpeningAdvance[],
): { ok: true; position: OpeningPosition } | { ok: false; reason: "days" } {
  const vacationDays = parseDays(draft.vacationDays);
  const sickDays = parseDays(draft.sickDays);
  if (vacationDays === null || sickDays === null) {
    return { ok: false, reason: "days" };
  }
  return { ok: true, position: { vacationDays, sickDays, advances } };
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
 * **Nothing in the application can confirm a month yet**, so today this reaches
 * every month the worker has. That is not a shortcut standing in for the rule:
 * it *is* the rule, applied to a store in which every month is a draft. The
 * confirmation is item 4's and arrives with the export in stage 2, and when it
 * does, the one thing that changes here is the predicate below — a month that
 * has been confirmed keeps the terms it was confirmed with, and the months
 * around it go on following the profile.
 *
 * It returns records rather than writing them, so the rule can be checked
 * without a store, and the spans are dropped on the way through because a
 * month's spans belong to the worker (`repository.ts`).
 */
export function monthsFollowingProfile(
  months: MonthFacts[],
  profile: WorkerTerms,
): MonthRecord[] {
  const terms = snapshotTerms(profile);
  return months.map((facts) => ({ ...recordOf(facts), terms }));
}
