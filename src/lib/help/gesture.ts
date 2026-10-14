import { daysBetween, eachDate, isIsoDate, isoOf, monthOf, orderDates } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { normalise, stemsOf } from "@/lib/help/match";
import { endOf, markableDays, touchesRange, type SkippedDay } from "@/lib/spans";
import type { MonthSpan } from "@/lib/engine/types";
import type { IsoDate, MarkKind } from "@/lib/types";

/**
 * Reading an instruction out of what the user typed (specs.md item 24).
 *
 * **It proposes and never performs.** What this module returns is a sentence
 * understood — a kind and a range — and nothing else: which days inside that
 * range may actually take the mark is an entitlement question answered by
 * `spans.ts` against the worker's own rest day, and whether anything is written
 * is answered by the user pressing. A grammar that decided either would be a
 * second rule beside the calendar's, reachable only by typing.
 *
 * **Hand-written, like the matcher beside it** (item 24): the same folding, so
 * `בחופשה` and `חופשה` are one word here as they are there, and no model is
 * reached on this path or any other.
 *
 * **It is deliberately narrow.** A sentence has to carry a marking verb, one of
 * the four kinds, and at least one date, or it is not an instruction and falls
 * through to the matcher as a question. The cost of reading a question as an
 * instruction is a proposal nobody asked for; the cost of the reverse is a
 * screen that answers instead of marking, which is where the panel started.
 */

/**
 * What a day can be told to become.
 *
 * The three `MarkKind`s a range may be swept with, and the one fact a month
 * records about a holiday (item 9) — the holiday's date is the year's and never
 * the user's, so `holidayWorked` changes the answer to a question and does not
 * draw a day.
 */
export type GestureKind = MarkKind | "holidayWorked";

/** A sentence understood: what to mark and over which days. The range is
 * ordered, so `from` is never after `to` however it was typed. */
export interface Gesture {
  kind: GestureKind;
  from: IsoDate;
  to: IsoDate;
}

/**
 * The verbs that make a sentence an instruction.
 *
 * Imperative and infinitive, both genders, with and without the `ת` prefix the
 * spoken language uses for a command — `סמן`, `סמני`, `תסמן`, `לסמן`. A family
 * types what they would say, and all four are said.
 *
 * `normalise` has already folded the final forms, so each is written here as it
 * comes out of it and not as it is spelled.
 */
const VERBS = new Set([
  "סמנ", "סמני", "תסמנ", "תסמני", "לסמנ",
  "רשומ", "רשמי", "תרשומ", "תרשמי", "לרשומ",
  "הוספ", "הוסיפי", "תוסיפ", "תוסיפי", "להוסיפ",
]);

/**
 * The words that make a sentence a question about how to do something, however
 * many verbs and dates it also carries.
 *
 * **Without them an infinitive is unreadable either way.** `איך לסמן חופשה
 * ב-28.9` is someone learning the application and `לסמן חופשה ב-28.9` is
 * someone using it, and the only thing telling them apart is the question word.
 * Dropping the infinitives instead would have cost the second sentence, which
 * is the one the panel exists for.
 */
const ASKS_HOW = new Set(["איכ", "כיצד", "איפה", "היכנ"]);

/**
 * The words that name each kind, as the application's own screens name it.
 *
 * **A kind is recognised by its noun and not by a phrase**, because the order
 * of the words in a typed sentence is not something a family owes the
 * application: `סמן חופשה ל-28.9` and `ב-28.9 סמן חופשה` are the same
 * instruction.
 *
 * `מנוחה` is the rest day the worker had off — the exception the user records
 * (item 5) — and it is listed under its own noun rather than under the day's
 * name, because which day that is varies by worker and `שבת` typed by a
 * Friday-resting household means the day and not the mark.
 */
const KIND_WORDS: Record<GestureKind, readonly string[]> = {
  vacation: ["חופשה", "חופש", "חופשי"],
  sick: ["מחלה", "חולה", "חולי"],
  freeRestDay: ["מנוחה"],
  holidayWorked: ["חג", "חגים"],
};

/**
 * A date as a family writes one: `28.9`, `28/9/26`, `28-9-2026`, and the ISO
 * form a link may carry.
 *
 * **The day comes first**, which is how dates are written here and the opposite
 * of how they are written in the sources a scraper reads. A two-digit year is
 * this century: the application has no month before 2024 and none a century
 * away, so `26` can only be 2026.
 */
const WRITTEN_DATE = /(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?/g;

/** The year a two-digit one means. */
function fullYear(typed: number): number {
  return typed < 100 ? 2000 + typed : typed;
}

/**
 * Every date the sentence carries, in the order it carries them, with the year
 * left unsaid where the sentence left it unsaid.
 *
 * **The year is not filled in here**, because filling it in needs today and
 * this half of the grammar runs in the browser, where nothing may read a clock
 * (`CLAUDE.md`). What it reads is what was written.
 */
function datesIn(text: string): WrittenDate[] {
  const found: WrittenDate[] = [];
  for (const match of text.matchAll(WRITTEN_DATE)) {
    const [, day, month, year] = match;
    if (day === undefined || month === undefined) continue;
    found.push({
      day: Number(day),
      month: Number(month),
      year: year === undefined ? null : fullYear(Number(year)),
    });
  }
  return found;
}

/** A date the sentence carries, before the year it may not have said is
 * decided. */
interface WrittenDate {
  day: number;
  month: number;
  /** `null` where the sentence named no year, which is the ordinary case: a
   * family writes `28.9`. */
  year: number | null;
}

/**
 * A written date as an `IsoDate`, or `null` where the calendar has no such
 * day.
 *
 * **A day the calendar does not have was not a date the user meant.** `isoOf`
 * builds a date out of whatever numbers it is given, so 31.4 arrives as the
 * first of May — and a proposal about a day other than the one typed is worse
 * than no proposal at all.
 */
function dateOf(written: WrittenDate, today: IsoDate): IsoDate | null {
  const iso = isoOf(
    { year: written.year ?? monthOf(today).year, month: written.month },
    written.day,
  );
  if (!isIsoDate(iso) || Number(iso.slice(8)) !== written.day) return null;
  return iso;
}

/** The ISO dates written in full, which the loop above reads as day-first and
 * so would misread. They are taken out before it runs. */
const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;

/**
 * The instruction a sentence carries, before any date is resolved, or `null`
 * where it carries none.
 *
 * **This half reads no clock and so runs in the browser**, which is what lets
 * the panel know it has been given an instruction rather than a question
 * without a round trip, and without a second grammar written to decide it.
 *
 * **One kind or none.** A sentence naming two of the four is not an
 * instruction this can read — "the vacation was sickness" is a question about
 * which it was — and reading one of them would be a guess the user cannot see
 * being made.
 *
 * **Two dates make a range and one makes a day.** A sentence with more than two
 * is likewise refused: there is no shape of instruction here that takes three,
 * so it is a sentence about dates rather than an instruction over them.
 */
export function instructionIn(query: string): Instruction | null {
  const iso = (query.match(ISO_DATE) ?? []).filter(isIsoDate);
  const rest = query.replace(ISO_DATE, " ");
  // Each typed word as itself and as the stem under a prefix, which is the
  // matcher's own folding: `בחופשה` names a kind and `ותסמן` is a verb.
  const words = normalise(rest).split(" ").flatMap(stemsOf);
  if (words.some((word) => ASKS_HOW.has(word))) return null;
  if (!words.some((word) => VERBS.has(word))) return null;

  const kinds = (Object.keys(KIND_WORDS) as GestureKind[]).filter((kind) =>
    KIND_WORDS[kind].some((noun) => words.includes(normalise(noun))),
  );
  const kind = kinds.length === 1 ? kinds[0] : undefined;
  if (kind === undefined) return null;

  const dates: WrittenDate[] = [
    ...iso.map((date) => ({
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8)),
    })),
    ...datesIn(rest),
  ];
  if (dates.length === 0 || dates.length > 2) return null;
  return { kind, dates };
}

/**
 * The longest range a sentence may ask for: the longest month there is.
 *
 * **Because a sweep on the calendar cannot reach further.** The month screen
 * draws one month and a selection lives inside its grid, so `סמן מחלה מ-1.1 עד
 * 31.12` would be a year of sickness entered by a gesture no screen offers —
 * and `specs.md` item 24 says the acceptance does what the calendar's own
 * gesture does and nothing more. A range over it is not an instruction at all:
 * it falls through to the matcher, which sends them to the calendar, rather
 * than being refused in words nobody has written.
 *
 * It is a count of days and not a month boundary, so a spell running from the
 * end of one month into the next — an ordinary thing to record (item 8) — is
 * still a sentence a family can type.
 */
const LONGEST_SWEEP = 31;

/** A sentence read as an instruction, with the dates as they were written. */
export interface Instruction {
  kind: GestureKind;
  dates: WrittenDate[];
}

/**
 * The instruction with its dates settled: what to mark, over which days.
 *
 * **`today` is passed in and never read** (`CLAUDE.md`), and it decides only
 * the year of a date written without one — a family writes `28.9` and means
 * this year. A family marking December from January would be a year out, and
 * would see it: the proposal draws every date in full before anything is
 * written.
 */
export function gestureIn(query: string, today: IsoDate): Gesture | null {
  const instruction = instructionIn(query);
  if (instruction === null) return null;
  const dates = instruction.dates
    .map((written) => dateOf(written, today))
    .filter((date): date is IsoDate => date !== null);
  if (dates.length !== instruction.dates.length) return null;
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return null;
  const range = orderDates(first, last);
  if (daysBetween(range.from, range.to) + 1 > LONGEST_SWEEP) return null;
  return { kind: instruction.kind, ...range };
}

/**
 * What a proposal comes to against this worker's own calendar: the days it
 * would change, and the days inside the range it cannot.
 *
 * **The rule is the calendar's own and is not restated here.** `markableDays`
 * is what the month screen's sweep already passes through, so a vacation day
 * proposed over a rest day is refused for the reason it is refused there
 * (items 5 and 8) and a day already marked is left alone. A grammar that
 * decided for itself which days are markable would be the second rule
 * `spans.ts` exists to prevent.
 *
 * **A holiday is not a day the range marks.** The dates are the year's
 * (item 9), so what a holiday instruction changes is the one answer a month
 * records about them — and it changes it for **whole spans**, because that is
 * what the answer belongs to. A proposal naming one day of a three-day holiday
 * therefore draws all three: understating what a press would do is the one
 * thing a proposal may not do.
 */
export interface Staged {
  gesture: Gesture;
  /** Every day the proposal would change, in order. */
  days: IsoDate[];
  /** The days inside the range that would not take the mark, with why. Always
   * empty for a holiday, which marks no day. */
  skipped: SkippedDay[];
  /** The holiday spans whose answer would change, which is what the press
   * acts on. Empty for every other kind. */
  holidaySpans: string[];
}

export function stage(
  gesture: Gesture,
  restDay: RestDay,
  spans: readonly MonthSpan[],
): Staged {
  if (gesture.kind === "holidayWorked") {
    const found = spans.filter(
      (span) =>
        span.kind === "holiday" &&
        span.worked !== true &&
        touchesRange(span, gesture.from, gesture.to),
    );
    return {
      gesture,
      days: found.flatMap((span) => eachDate(span.from, endOf(span, gesture.to))),
      skipped: [],
      holidaySpans: found.map((span) => span.id),
    };
  }
  const { taken, skipped } = markableDays(
    { kind: gesture.kind, from: gesture.from, to: gesture.to },
    restDay,
    [...spans],
  );
  return { gesture, days: taken, skipped, holidaySpans: [] };
}
