import {
  addDays,
  compareIsoDate,
  daysInMonth,
  eachDate,
  isoOf,
  monthHasEnded,
  orderDates,
} from "@/lib/dates";
import { rateInForce } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import { recuperationDaysFor } from "@/lib/engine/recuperation";
import { closeMonth } from "@/lib/engine/types";
import type {
  ClosedSpan,
  Employment,
  MonthFacts,
  MonthSpan,
} from "@/lib/engine/types";
import { overlapsMonth } from "@/lib/spans";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * What is put to the user before a month is exported — the confirmation
 * questions of `specs.md` item 18 and the confirmations of items 4 and 15.
 *
 * **The questions are not empty, and that is the whole of item 18.** Each one
 * arrives with what the month already knows, so the user *confirms or corrects*
 * rather than answering from memory: "was an advance given this month" is asked
 * beside "no advance was recorded", and a family that reads the second and
 * disagrees has found the thing that would otherwise have been left out by
 * silence. So this module answers what the month holds and never what the user
 * should think about it; the wording is `he.ts`'s and the asking is the
 * screen's.
 *
 * **It holds no clock and no store** (`CLAUDE.md`). `today` arrives from the
 * caller, exactly as it does everywhere else in the engine, because whether a
 * month has ended is the one block that depends on when the question is asked.
 *
 * **Nothing here decides that an export may proceed.** It says what the *facts*
 * stand in the way of; whether every question has been answered is a fact about
 * the conversation and lives with the screen having it, and the file itself is
 * stage 2's.
 */

/**
 * The six questions, in the order `לפני הייצוא` draws them.
 *
 * **The list is the source and the union is derived from it**, as
 * `advanceKinds` and `userLineDirections` already are: a key added to a
 * hand-kept union would compile clean against a hand-kept array that had not
 * grown with it, and the screen gates its button on having an answer for every
 * member of this array — so a seventh question added to one and not the other
 * would be a question nobody is ever asked, or a button that never enables.
 *
 * **They are six because item 18 names six things that change a month**: an
 * advance given, an instalment repaid, a free rest day, the holidays worked,
 * the sick days, and the money that went to somebody other than the worker. The
 * two halves of the advance are asked separately because a month may do both
 * and each is its own line (item 20).
 */
export const exportQuestionKeys = [
  "advanceGranted",
  "advanceRepaid",
  "freeRestDays",
  "holidaysWorked",
  "sickDays",
  "thirdParty",
] as const;

export type ExportQuestionKey = (typeof exportQuestionKeys)[number];

/**
 * One question, with what the month already knows behind it.
 *
 * `recorded` is the answer the month itself gives, and it is what the screen
 * shows as chosen. `counts` carries the figures the question's own sentence
 * names — how many days, how many payments, how much money — so the sentence is
 * built in `he.ts` out of numbers rather than the numbers being formatted here
 * (`CLAUDE.md`: every user-facing string in one file).
 */
export interface ExportQuestion {
  key: ExportQuestionKey;
  /** What the month holds. `false` is an answer and not an absence: "no advance
   * was recorded in this month" is exactly what the user is being asked to
   * confirm. */
  recorded: boolean;
  counts: ExportQuestionCounts;
}

export interface ExportQuestionCounts {
  /** Days, where the question is about days on the calendar. Fractional where a
   * day was taken in part (specs.md item 10). */
  days?: number;
  /** How many of a thing there are — payments recorded, holidays falling. */
  items?: number;
  /** How many of `items` the month says yes about — the holidays she worked. */
  of?: number;
  /** Money, in agorot, where the question is about a sum. */
  agorot?: number;
}

function spansOfKind<T extends MonthSpan>(
  spans: T[],
  month: YearMonth,
  kind: MonthSpan["kind"],
): T[] {
  return spans.filter(
    (span) => span.kind === kind && overlapsMonth(span, month),
  );
}

/**
 * How many days of a span fall inside one month.
 *
 * **It is not `balanceDaysOf`, and the difference matters here.** That function
 * answers what a span costs its balance, over the whole of the spell and
 * wherever it ran; this question is about one month's own calendar — a spell
 * from the 30th of March to the 2nd of April is four days to the balance and
 * two of them are April's. Asking the month what it holds and being told the
 * neighbouring month's days as well is the kind of figure a user confirms
 * without noticing (Part 5).
 */
function daysInsideMonth(span: ClosedSpan, month: YearMonth): number {
  const monthStart = isoOf(month, 1);
  const monthEnd = isoOf(month, daysInMonth(month));
  const { from, to } = orderDates(span.from, span.to);
  const start = compareIsoDate(from, monthStart) < 0 ? monthStart : from;
  const end = compareIsoDate(to, monthEnd) > 0 ? monthEnd : to;
  if (compareIsoDate(start, end) > 0) return 0;
  return eachDate(start, end).length * (span.fraction ?? 1);
}

/**
 * The six questions for one month, each carrying what the month already knows
 * (specs.md item 18).
 *
 * **The day counts are this month's own days**, which is why the spans are
 * closed first and then clipped to the month: a spell running from the 30th of
 * one month into the next has to be reported to each month as the days that
 * fell in it, and a raw span length would tell both months the same number. `today` is what an open spell is clipped at, and a
 * month with one open cannot be exported anyway — the question is still asked
 * with the figure as it stands, because a screen that showed nothing there
 * would be silent about the very thing it is blocking on.
 */
export function exportQuestions(
  facts: MonthFacts,
  today?: IsoDate,
): ExportQuestion[] {
  const closed = closeMonth(facts, today);
  const { month } = facts;

  const granted = facts.advances.filter((each) => each.kind === "granted");
  const repaid = facts.advances.filter((each) => each.kind === "repaid");
  const sum = (rows: { agorot: number }[]) =>
    rows.reduce((total, row) => total + row.agorot, 0);

  // Every span below has an end: `closeMonth` resolved the open one above.
  const daysOf = (kind: MonthSpan["kind"]) =>
    spansOfKind(closed.spans, month, kind).reduce(
      (days, span) => days + daysInsideMonth(span, month),
      0,
    );

  const holidays = spansOfKind(closed.spans, month, "holiday");
  const holidaysWorked = holidays.filter(
    (span) => span.kind === "holiday" && span.worked,
  );

  const freeRestDays = daysOf("freeRestDay");
  const sickDays = daysOf("sick");

  return [
    {
      key: "advanceGranted",
      recorded: granted.length > 0,
      counts: { items: granted.length, agorot: sum(granted) },
    },
    {
      key: "advanceRepaid",
      recorded: repaid.length > 0,
      counts: { items: repaid.length, agorot: sum(repaid) },
    },
    {
      key: "freeRestDays",
      recorded: freeRestDays > 0,
      counts: { days: freeRestDays },
    },
    {
      key: "holidaysWorked",
      recorded: holidaysWorked.length > 0,
      counts: { items: holidays.length, of: holidaysWorked.length },
    },
    { key: "sickDays", recorded: sickDays > 0, counts: { days: sickDays } },
    {
      key: "thirdParty",
      recorded: facts.thirdPartyPayments.length > 0,
      counts: {
        items: facts.thirdPartyPayments.length,
        agorot: sum(facts.thirdPartyPayments),
      },
    },
  ];
}

/**
 * The two things about a month's own facts that stop it being exported.
 *
 * **Both are refusals and not warnings, and each says so in `specs.md`
 * itself.** Item 21: a future month may be filled in ahead of time and may only
 * be exported once it has ended. Item 18: a month is not exported over an
 * unanswered open spell, because the one thing an open spell can get wrong is
 * counting days for a worker who was already back.
 *
 * **Everything else on the screen is a warning**, including an answer that
 * disagrees with what the month recorded — settled with the user on 2026-09-09.
 * The user is the one who knows what happened, and a month she has looked at
 * and answered for is a month she is entitled to export; what item 18 buys is
 * that she was asked, not that the application overrules her.
 */
export const exportBlockKeys = ["monthNotEnded", "openSickSpell"] as const;

export type ExportBlockKey = (typeof exportBlockKeys)[number];

/**
 * The spell of sickness this month carries with no end recorded, if there is
 * one (specs.md item 8).
 *
 * Only sickness may be open — the union in `types.ts` is what makes that true
 * by construction — so a span with no `to` is a sick spell and needs no second
 * check. It is returned rather than counted because the screen's question is
 * about *this* spell: it names the day it began and closes that span by its id.
 */
export function openSickSpellOf(
  facts: MonthFacts,
): { spanId: string; from: IsoDate } | null {
  const open = facts.spans.find(
    (span) => span.to === null && overlapsMonth(span, facts.month),
  );
  return open === undefined ? null : { spanId: open.id, from: open.from };
}

export function blocksExport(
  facts: MonthFacts,
  today: IsoDate,
): ExportBlockKey[] {
  const blocks: ExportBlockKey[] = [];
  if (!monthHasEnded(facts.month, today)) blocks.push("monthNotEnded");
  if (openSickSpellOf(facts) !== null) blocks.push("openSickSpell");
  return blocks;
}

/**
 * The last day of a spell, from the day the worker came back.
 *
 * **The user is asked the day she returned and not the last day she was ill**,
 * because the returning is the event the family witnessed — item 18 words the
 * question that way, and the artboard asks it in those words. The spell ends
 * the day before, and doing the subtraction here rather than in the browser is
 * what keeps the one place it happens testable.
 */
export function spellEndFromReturn(returnedOn: IsoDate): IsoDate {
  return addDays(returnedOn, -1);
}

/**
 * Why a return date cannot be accepted, or `null` where it can.
 *
 * A return on or before the day the spell began would leave a spell that ran
 * for no days at all, or one that ran backwards — the inverted range `types.ts`
 * already refuses to hand the counting. She was ill on the day she fell ill, so
 * the earliest return that means anything is the day after it.
 */
export function reviewReturnDate(
  spellFrom: IsoDate,
  returnedOn: IsoDate,
): "beforeTheSpell" | null {
  return compareIsoDate(returnedOn, spellFrom) <= 0 ? "beforeTheSpell" : null;
}

/**
 * What the recuperation confirmation has to put to the user, or `null` in a
 * month that owes no recuperation.
 *
 * **The rate is confirmed the way the minimum wage is** (specs.md item 15): it
 * is not derived from the salary — nothing in that salary implies it — so the
 * user confirms it and it is stored with the month it valued, which is what
 * lets a past month be re-exported at its own rate. This is the confirmation
 * `build_plan.md`'s step 6 left to item 18, and it is asked only where days are
 * actually owed.
 *
 * `offered` may be `null`: the table begins in July 2025 and says nothing about
 * a month before it, which is the honest answer rather than a guessed date. The
 * user then types the figure, exactly as a failed wage fetch leaves her doing.
 */
export function recuperationToConfirm(
  facts: MonthFacts,
  employment: Employment,
  rates: DatedRate[],
): { days: number; offeredAgorot: number | null; storedAgorot?: number } | null {
  const days = recuperationDaysFor(
    employment.employedSince,
    facts.terms.recuperationMonth,
    facts.month,
  );
  if (days === 0) return null;
  return {
    days,
    offeredAgorot:
      rateInForce(rates, "recuperationDayRate", facts.month)?.value ?? null,
    storedAgorot: facts.recuperationDayRateAgorot,
  };
}

/**
 * Why a confirmation cannot be accepted, or `null` where it can.
 *
 * **The server decides and the form never does** (Part 3). The screen offers a
 * figure it read from the table and a field to correct it with; what may
 * actually be stored is answered here, and a request crafted past the form
 * meets the same check. What it refuses is the only thing that cannot be meant:
 * nothing, or a negative wage.
 */
export type WageConfirmationRefusal = "amount";

export function reviewWageConfirmation(
  minimumAgorot: number,
): WageConfirmationRefusal | null {
  return Number.isInteger(minimumAgorot) && minimumAgorot > 0 ? null : "amount";
}

/**
 * The base monthly salary a month is confirmed at.
 *
 * **A salary may sit above the minimum wage and may never sit below it**
 * (specs.md item 3), so a confirmation that meets a profile still holding last
 * year's figure raises the month to the wage in force rather than writing a
 * month that pays under its own confirmed minimum. Settled with the user on
 * 2026-09-09, and the screen says it is happening before she presses.
 *
 * **The profile itself is not rewritten**, which is the other half of item 3:
 * the salary does not follow a rise on its own, and how far *above* the minimum
 * this worker is paid stays the family's decision. What the floor settles is
 * only that the month cannot go below it.
 */
export function baseForMonth(
  baseMonthlySalaryAgorot: number,
  minimumAgorot: number,
): number {
  return Math.max(baseMonthlySalaryAgorot, minimumAgorot);
}

/**
 * Why a recuperation day rate cannot be accepted, or `null` where it can.
 *
 * There is no upper bound and no comparison with a table: the rate is a figure
 * the state publishes and the family confirms, and the application has no
 * standing to disbelieve a number it did not derive. What it refuses is the
 * only thing that cannot be meant — nothing, or a negative day.
 */
export function reviewRecuperationRate(agorot: number): "amount" | null {
  return Number.isInteger(agorot) && agorot > 0 ? null : "amount";
}
