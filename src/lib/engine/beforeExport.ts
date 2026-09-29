import {
  addDays,
  compareIsoDate,
  compareMonth,
  eachDate,
  monthOf,
} from "@/lib/dates";
import { rateInForce } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import { recuperationDaysInMonth } from "@/lib/engine/recuperation";
import { holidayDatesCounted } from "@/lib/engine/holidayDates";
import { closeMonth, unansweredHolidays } from "@/lib/engine/types";
import type {
  ClosedSpan,
  Employment,
  MonthFacts,
  MonthSpan,
  ThirdPartyKind,
} from "@/lib/engine/types";
import { clipToMonth, overlapsMonth } from "@/lib/spans";
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
 * month has begun or is still running depends on when the question is asked.
 *
 * **Nothing here decides that an export may proceed.** It says what the *facts*
 * stand in the way of; whether every question has been answered is a fact about
 * the conversation and lives with the screen having it, and the file itself is
 * the export's.
 */

/**
 * The seven questions, in the order `לפני הייצוא` draws them.
 *
 * **The list is the source and the union is derived from it**, as
 * `advanceKinds` and `userLineDirections` already are: a key added to a
 * hand-kept union would compile clean against a hand-kept array that had not
 * grown with it, and the screen gates its button on having an answer for every
 * member of this array — so a seventh question added to one and not the other
 * would be a question nobody is ever asked, or a button that never enables.
 *
 * **They are seven because item 18 asks about everything that changes the
 * month**: an advance given, an instalment repaid, a free rest day, the
 * holidays worked, the vacation days, the sick days, and the money that went to
 * somebody other than the worker. The two halves of the advance are asked
 * separately because a month may do both and each is its own line (item 20).
 *
 * **Vacation is asked for the same reason the rest are** (item 18). It draws on
 * a balance that is replayed rather than stored (item 13), so a vacation day
 * marked on the wrong month, or forgotten, moves every later month's balance.
 */
export const exportQuestionKeys = [
  "advanceGranted",
  "advanceRepaid",
  "freeRestDays",
  "holidaysWorked",
  "vacationDays",
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
 *
 * `details` is the same month said item by item: the dates the calendar holds
 * and the amounts the payments screen holds. **A count alone cannot be
 * confirmed**. "Two sick days were
 * marked" is a figure a family agrees with while the days sit on the wrong
 * dates, and a month whose figure is right and whose dates are wrong exports a
 * sheet nobody can reconcile against the calendar. The dates are what she
 * actually remembers, so they are what she is shown.
 */
export interface ExportQuestion {
  key: ExportQuestionKey;
  /** What the month holds. `false` is an answer and not an absence: "no advance
   * was recorded in this month" is exactly what the user is being asked to
   * confirm. */
  recorded: boolean;
  counts: ExportQuestionCounts;
  /**
   * One entry per thing the month recorded, in date order where they have
   * dates, and empty where it recorded nothing.
   *
   * The holidays are the one place a `false` still carries items: `recorded`
   * answers whether any was *worked*, and a holiday she did not work still
   * falls in the month and is still listed — a family that reads the date and
   * remembers working it has found the mark that was never made.
   */
  details: ExportQuestionDetail[];
}

/**
 * One recorded thing, in the shape its own wording needs.
 *
 * **Dates and never labels.** The engine says which days and how much; what to
 * call a day, a half day, a worked holiday or a payment to the agency is
 * `he.ts`'s, which is the same division `counts` already keeps.
 */
export type ExportQuestionDetail =
  /** A stretch of the calendar, already clipped to this month. `from` equals
   * `to` for a single day. */
  | { shape: "days"; from: IsoDate; to: IsoDate; fraction?: number }
  /** A holiday falling in this month, and the one fact the month records about
   * it (specs.md item 9). Both the worked and the unworked are listed: the
   * question is which of them was worked, and a list of only the worked ones
   * cannot be checked against the calendar. */
  /** `worked` carries all three of item 9's states: `null` is a holiday nobody
   * has answered for, and it is the one the screen has to name, because it is
   * the reason the month cannot be exported. */
  | { shape: "holiday"; on: IsoDate; worked: boolean | null }
  /** Money. `kind` is the third-party payment's own kind, and absent on an
   * advance, which has no kinds. */
  | { shape: "money"; agorot: number; kind?: ThirdPartyKind };

interface ExportQuestionCounts {
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
 * The days of a span that fall inside one month.
 *
 * **It is not `balanceDaysOf`, and the difference matters here.** That function
 * answers what a span costs its balance, over the whole of the spell and
 * wherever it ran; this question is about one month's own calendar — a spell
 * from the 30th of March to the 2nd of April is four days to the balance and
 * two of them are April's. Asking the month what it holds and being told the
 * neighbouring month's days as well is the kind of figure a user confirms
 * without noticing (Part 5).
 *
 * **The dates the screen lists are clipped by the same `clipToMonth`**, so the
 * days it counts and the dates it names can never be two different answers: a
 * question reading "2 days" above "30 March – 2 April" is a contradiction the
 * user has to resolve herself.
 */
function daysInsideMonth(span: ClosedSpan, month: YearMonth): number {
  const clipped = clipToMonth(span, month);
  if (clipped === null) return 0;
  return eachDate(clipped.from, clipped.to).length * (span.fraction ?? 1);
}

/**
 * The seven questions for one month, each carrying what the month already knows
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
  const amounts = (rows: { agorot: number }[]): ExportQuestionDetail[] =>
    rows.map((row) => ({ shape: "money", agorot: row.agorot }));

  // Every span below has an end: `closeMonth` resolved the open one above.
  const spansOf = (kind: MonthSpan["kind"]) =>
    spansOfKind(closed.spans, month, kind);
  const daysOf = (kind: MonthSpan["kind"]) =>
    spansOf(kind).reduce(
      (days, span) => days + daysInsideMonth(span, month),
      0,
    );
  /** The month's own stretches of one kind, in date order. Sorted here and not
   * left to the store's order: the calendar is read top to bottom and a list
   * that jumps back to the 3rd after the 19th cannot be checked against it. */
  const stretchesOf = (kind: MonthSpan["kind"]): ExportQuestionDetail[] =>
    spansOf(kind)
      .map((span) => clipToMonth(span, month))
      .filter((clipped) => clipped !== null)
      .sort((a, b) => compareIsoDate(a.from, b.from))
      .map((clipped) => ({
        shape: "days",
        from: clipped.from,
        to: clipped.to,
        ...(clipped.fraction === undefined ? {} : { fraction: clipped.fraction }),
      }));

  const holidays = spansOf("holiday");
  // Answered *and* worked, not `countsAsWorked`: the question asks what the
  // month records, and a holiday nobody has answered for records nothing. The
  // preview pays for it and the sentence must not therefore claim the family
  // said she worked it.
  const holidaysWorked = holidays.filter(
    (span) => span.kind === "holiday" && span.worked === true,
  );

  const freeRestDays = daysOf("freeRestDay");
  const vacationDays = daysOf("vacation");
  const sickDays = daysOf("sick");

  return [
    {
      key: "advanceGranted",
      recorded: granted.length > 0,
      counts: { items: granted.length, agorot: sum(granted) },
      details: amounts(granted),
    },
    {
      key: "advanceRepaid",
      recorded: repaid.length > 0,
      counts: { items: repaid.length, agorot: sum(repaid) },
      details: amounts(repaid),
    },
    {
      key: "freeRestDays",
      recorded: freeRestDays > 0,
      counts: { days: freeRestDays },
      details: stretchesOf("freeRestDay"),
    },
    {
      key: "holidaysWorked",
      recorded: holidaysWorked.length > 0,
      counts: { items: holidays.length, of: holidaysWorked.length },
      // Every holiday of the month and not only the worked ones, because the
      // question is which of them was worked and the unworked ones are half of
      // that answer.
      details: holidays
        .slice()
        .sort((a, b) => compareIsoDate(a.from, b.from))
        .map((span) => ({
          shape: "holiday",
          on: span.from,
          worked: span.kind === "holiday" ? span.worked : false,
        })),
    },
    {
      key: "vacationDays",
      recorded: vacationDays > 0,
      counts: { days: vacationDays },
      details: stretchesOf("vacation"),
    },
    {
      key: "sickDays",
      recorded: sickDays > 0,
      counts: { days: sickDays },
      details: stretchesOf("sick"),
    },
    {
      key: "thirdParty",
      recorded: facts.thirdPartyPayments.length > 0,
      counts: {
        items: facts.thirdPartyPayments.length,
        agorot: sum(facts.thirdPartyPayments),
      },
      // Each payment says what it was for: "one payment to a third party" is a
      // sentence a family cannot check, and the kinds are what she recognises
      // (specs.md item 16).
      details: facts.thirdPartyPayments.map((payment) => ({
        shape: "money",
        agorot: payment.agorot,
        kind: payment.kind,
      })),
    },
  ];
}

/**
 * What about a month's own facts stops it being exported.
 *
 * **Each is a refusal and not a warning, and says so in `specs.md` itself.**
 * Item 21: a month after the current one is not valued until it begins, so
 * there is no sheet to fill. Item 18: a month is not exported over an
 * unanswered open spell, because the one thing an open spell can get wrong is
 * counting days for a worker who was already back.
 *
 * **Everything else on the screen is a warning**, including the current month
 * still running (`monthStillRunning`) and an answer that disagrees with what
 * the month recorded.
 * The user is the one who knows what happened, and a month she has looked at
 * and answered for is a month she is entitled to export; what item 18 buys is
 * that she was asked, not that the application overrules her.
 */
// The list is the source and the union below is derived from it, so nothing
// reads the array at run time today — the `export` that once made it a used
// value had no importer anywhere. The rule is switched off for this one
// declaration rather than the array deleted, because the union is spelled in
// one place either way and a reader of the rates will iterate it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const exportBlockKeys = [
  "monthNotBegun",
  "openSickSpell",
  "unansweredHoliday",
] as const;

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

/**
 * Whether the month is the current one and has not ended — exported with a
 * warning and not refused (specs.md item 21): the days still ahead of it are
 * counted as ordinary working days, as the preview already counts them, and an
 * event in them later is a correction and a second export.
 */
export function monthStillRunning(facts: MonthFacts, today: IsoDate): boolean {
  return compareMonth(facts.month, monthOf(today)) === 0;
}

export function blocksExport(
  facts: MonthFacts,
  today: IsoDate,
): ExportBlockKey[] {
  const blocks: ExportBlockKey[] = [];
  if (compareMonth(facts.month, monthOf(today)) > 0) blocks.push("monthNotBegun");
  if (openSickSpellOf(facts) !== null) blocks.push("openSickSpell");
  // Item 9. The preview reads an
  // unanswered holiday as one she worked and pays for it, and this is what
  // stops that lean reaching a filed sheet: the figure on the screen has to say
  // something, and the export does not.
  //
  // Only a holiday that counts as one. A holiday on her weekly rest day is
  // treated as a holiday for nothing (item 9), so whether she "worked" it is
  // already answered by the rest day itself — unmarked is a rest day worked, a
  // free rest day mark is one she had off — and holding the export for a
  // question whose answer changes nothing would be a question for its own sake.
  const counted = holidayDatesCounted(
    closeMonth(facts, today).spans,
    facts.terms.restDay,
  );
  if (unansweredHolidays(facts.spans).some((span) => counted.has(span.from))) {
    blocks.push("unansweredHoliday");
  }
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
 * lets a past month be re-exported at its own rate. It is item 18's
 * confirmation, and it is asked only where days are actually owed.
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
  const days = recuperationDaysInMonth(
    employment,
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
type WageConfirmationRefusal = "amount";

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
 * month that pays under its own confirmed minimum. The screen says it is
 * happening before she presses.
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
