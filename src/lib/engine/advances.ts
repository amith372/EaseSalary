import { addMonths, compareMonth, isIsoDate, monthOf, sameMonth } from "@/lib/dates";
import { advanceKinds } from "@/lib/engine/types";
import { parseShekels } from "@/lib/money";
import type {
  Advance,
  AdvanceKind,
  MonthFacts,
  OpeningPosition,
} from "@/lib/engine/types";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * Advances, and what is still owed on each (specs.md item 20).
 *
 * **What is owed is a fact about the whole employment and not about a month.**
 * An advance granted in February and repaid across March, April and May is one
 * debt seen from four months, so the standing below is built by walking every
 * month the worker has, from the opening position outwards (item 6). That is
 * the same argument `series.ts` makes for the balances, and it has the same
 * consequence: nothing here is stored, so a repayment corrected in a past month
 * moves what every later month may repay for free (item 13).
 *
 * Pure, and it reads no clock and no store: the months arrive as an array.
 */

/**
 * How a row of the closing block addresses one movement on one advance.
 *
 * **It is a stored value**, because `MonthFacts.overrides` is keyed by it
 * (item 17) — so the code that *removes* a movement has to build the same
 * string the engine built when it drew one, or the override outlives the row it
 * belonged to. That is the reason it is a function here rather than a template
 * string at each of the three call sites, and it is the same reason
 * `userLineKey` exists in `month.ts`.
 *
 * The number and the kind are both in it because a month may grant one advance
 * and repay another, and a month that granted and repaid the *same* advance
 * would otherwise address both rows alike. What the key does **not** admit is
 * two movements of one kind on one advance in one month, which is exactly the
 * shape item 20 refuses — the key is where that refusal comes from rather than
 * a rule invented beside it.
 */
export function advanceKey(advanceNumber: number, kind: AdvanceKind): string {
  return `advance.${advanceNumber}.${kind}`;
}

/**
 * One numbered advance as the whole employment leaves it.
 *
 * `grantedIn` is `null` for an advance carried in from the opening position:
 * it was given before the application existed, so there is no month it was
 * granted in and no month it is too early to repay it in (item 6).
 */
export interface AdvanceStanding {
  number: number;
  /** What was given, whatever month it was given in. */
  principalAgorot: number;
  /** What has been repaid against it in every month, the opening position's own
   * figure included. */
  repaidAgorot: number;
  /**
   * Principal less repaid.
   *
   * **Negative is arithmetically reachable and every path that could reach it
   * is refused** (item 20): a repayment beyond the debt is refused as it is
   * entered, and removing the grant out from under a repayment is refused with
   * it — that second one is the way in that is easy to miss, since it makes a
   * debt smaller rather than a repayment bigger. Facts written straight into
   * storage still could, which is why nothing downstream may assume a positive
   * figure without saying so.
   */
  outstandingAgorot: number;
  grantedIn: YearMonth | null;
  /**
   * The day the money was handed over, carried forward from the movement that
   * granted it (specs.md item 20).
   *
   * It travels on the standing for the reason `note` below does: from a later
   * month the grant is a debt with a number, and the date is one of the two
   * things that say which handover it was. An advance carried in from the
   * opening position has none.
   */
  givenOn?: IsoDate;
  /**
   * Why the advance was given, carried forward from whichever record gave it —
   * the opening position's own note first, and otherwise the grant's.
   *
   * It travels on the standing rather than only on the movement because a later
   * month is exactly the reader item 20 says the reason is for: from March, the
   * grant made in February is a debt with a number and no explanation unless
   * this comes with it.
   */
  note?: string;
}

/** The months a ledger is built from, written structurally so the walk can be
 * read and tested without a wage or a set of terms around it. */
type MonthWithAdvances = Pick<MonthFacts, "month" | "advances">;

/**
 * Every advance the worker has, oldest number first, with what is still owed on
 * each.
 *
 * The months are **sorted here** rather than trusted from the caller, for
 * `calculateSeries`' own reason: an unsorted array does not fail, it merely
 * reports the wrong month as the one an advance was granted in, and a
 * repayment recorded before the grant would then be accepted.
 *
 * A `granted` movement adds to the principal and a `repaid` one to the repaid
 * figure, rather than either replacing anything. Two grants on one number
 * cannot arise from this application — a number is minted past the highest the
 * worker carries — and summing is the reading that stays right if one ever
 * does, where overwriting would silently forget money that was handed over.
 */
export function advanceLedger(
  openingPosition: OpeningPosition,
  months: readonly MonthWithAdvances[],
): AdvanceStanding[] {
  const byNumber = new Map<number, AdvanceStanding>();

  const standingFor = (advanceNumber: number): AdvanceStanding => {
    const existing = byNumber.get(advanceNumber);
    if (existing !== undefined) return existing;
    const fresh: AdvanceStanding = {
      number: advanceNumber,
      principalAgorot: 0,
      repaidAgorot: 0,
      outstandingAgorot: 0,
      grantedIn: null,
    };
    byNumber.set(advanceNumber, fresh);
    return fresh;
  };

  for (const opening of openingPosition.advances) {
    const standing = standingFor(opening.number);
    standing.principalAgorot += opening.principalAgorot;
    standing.repaidAgorot += opening.repaidAgorot;
    // No month granted it: it was given before the application existed, so
    // there is no month it is too early to repay it in (item 6).
    if (opening.note !== undefined) standing.note = opening.note;
  }

  for (const month of [...months].sort((a, b) => compareMonth(a.month, b.month))) {
    for (const advance of month.advances) {
      const standing = standingFor(advance.number);
      if (advance.kind === "granted") {
        standing.principalAgorot += advance.agorot;
        // The earliest month that granted it, which is what the sort is for.
        standing.grantedIn ??= month.month;
        if (advance.note !== undefined) standing.note ??= advance.note;
        if (advance.givenOn !== undefined) standing.givenOn ??= advance.givenOn;
      } else {
        standing.repaidAgorot += advance.agorot;
      }
    }
  }

  return [...byNumber.values()]
    .map((standing) => ({
      ...standing,
      outstandingAgorot: standing.principalAgorot - standing.repaidAgorot,
    }))
    .sort((a, b) => a.number - b.number);
}

/**
 * The number the next advance gets: one past the highest the worker already
 * carries, and 1 for a worker who has none (specs.md item 20).
 *
 * **It counts past the highest and never fills a gap.** A number is what the
 * closing block's rows are addressed by and what the family's own workbook
 * calls the advance, so reusing the number of an advance that was removed would
 * point a stored override at a debt that is not the one it was typed against.
 *
 * **Removing a grant cannot free its number while anything still refers to it**,
 * which is worth stating because it looks as though it could. `advanceLedger`
 * raises a standing for any number appearing in any movement, a repayment
 * included, so a number survives in the ledger for as long as one month still
 * records something against it. A number only leaves when nothing anywhere
 * refers to it — and every override on those movements went with them
 * (`withoutAdvance`), so there is nothing left for a reused number to collide
 * with.
 */
export function nextAdvanceNumber(ledger: readonly AdvanceStanding[]): number {
  return ledger.reduce((highest, standing) => Math.max(highest, standing.number), 0) + 1;
}

/**
 * A movement the user is recording, as it leaves the browser. The amount
 * travels as they typed it and is parsed on the server side of the boundary
 * (Part 3), exactly as a line they add does.
 *
 * A grant carries no number: the application mints it (item 20), so there is
 * nothing about it for the user to choose beyond the amount, the reason and the
 * day the money was handed over.
 *
 * **The date travels as typed, like the amount**, and is read on the server side
 * of the boundary: an `<input type="date">` hands over whatever is in it,
 * including nothing at all, so the string is what crosses and `IsoDate` is what
 * comes out of the check.
 */
export type AdvanceDraft =
  | { kind: "granted"; amount: string; note: string; givenOn: string }
  | { kind: "repaid"; number: number; amount: string; note: string };

/**
 * Why a movement is not one. Each is a sentence the user is shown, and **none
 * of these carries a legal link**, which is item 25's own rule rather than an
 * omission: each is a refusal about the *form* of an entry — an amount that is
 * not one, a second row where the sheet holds one, more than the debt — and
 * nothing in law says any of them, so they owe them the reason and not a
 * reference to a page that would not mention what stopped them.
 *
 * **That is not the same claim as the engine's own `advanceRecordedTwice`**,
 * which `validate.ts` does give a link. There the refused action is a *row on
 * the payslip*, and the rule it breaches is item 2's — every payment shown as
 * its type, its units and its amount, which two rows under one key cannot do.
 * Here the refused action is a figure being typed, and the same shape is caught
 * before it ever becomes a row.
 */
export type AdvanceRefusal =
  | "amount"
  | "shape"
  /** A repayment naming an advance the worker does not have — a crafted
   * request, or a page held open over an advance since removed. */
  | "advanceUnknown"
  /** A repayment in a month before the one the advance was granted in. */
  | "advanceNotYetGiven"
  /** A second movement of one kind on one advance in one month. */
  | "advanceRecordedTwice"
  /** More than is still owed. */
  | "advanceOverRepaid"
  /**
   * A grant with no date, with something that is not a date, or with one
   * outside the month the grant is recorded in (specs.md item 20).
   *
   * **The three are one refusal and not three.** A date outside the month is a
   * contradiction rather than a choice — the money cannot have been handed over
   * in April and recorded as March's — and what the user does about any of the
   * three is the same thing: put a day of this month in the field. The field
   * says which month that is, so a sentence naming it again would be the
   * screen telling them what the screen already shows.
   */
  | "advanceDate"
  /**
   * A split whose months are not a span this application can write: fewer than
   * one, or more than `SPLIT_MONTHS_LIMIT`.
   *
   * It is unreachable from the form, which offers a count inside the limit, and
   * it is checked all the same because the split *opens* every month of its own
   * span — an unbounded count is an unbounded number of month rows written from
   * one request (Part 3).
   */
  | "splitMonths"
  /**
   * Instalments summing past the grant itself.
   *
   * Summing to *less* is allowed and leaves the rest owed, which is the whole
   * difference between this and the ordinary over-repayment: what item 20
   * refuses is repaying more than was given, not planning less than all of it.
   */
  | "splitExceedsPrincipal"
  /**
   * A month inside the span has been confirmed, so the whole split is refused
   * and nothing is written (specs.md item 20).
   *
   * **The month is named where the split is made and not in this sentence.**
   * `blockingConfirmedMonth` is one rule with two readers: the form asks it
   * before it will offer the button and names the month it answers with, and
   * the server asks it again and refuses on it. So this reason is reached only
   * by a stale page or a crafted request — the state `advanceUnknown` is
   * reached from too — and the sentence it carries says to look again rather
   * than naming a month the screen is no longer showing.
   */
  | "confirmedMonthInSpan"
  /** A grant removed while a later month still repays it (see
   * `whyRemovalIsRefused`). */
  | "advanceRepaidAlready"
  /**
   * A grant corrected to less than what has already been repaid against it
   * (see `reviewAdvanceEdit`).
   *
   * **It is the same state `advanceRepaidAlready` refuses and it is not the
   * same sentence**, because what the user must do about it differs: there they
   * is removing the advance and is told to take the repayments off first, here
   * they have typed a figure and needs to know which figure it is too small for.
   */
  | "advanceBelowRepaid";

type ReviewedAdvance =
  | { ok: true; advance: Advance }
  | { ok: false; reason: AdvanceRefusal };

/**
 * Why this advance cannot be repaid in this month at all, or `null` if it can —
 * everything that is refused before an amount is even read (specs.md item 20).
 *
 * **It is one sentence with two readers**, which is why it is a function rather
 * than four lines inside `reviewAdvance`. The server refuses on it, and the
 * screen decides on it whether to *offer* the repayment at all: a control that
 * answers a click with a refusal is a control that should not have been there,
 * and a screen that decided that for itself would be a second copy of this rule
 * — one that agrees today and drifts the first time either is corrected.
 *
 * The amount is not its business. Whether a figure is more than what is left
 * needs the figure, so that check stays in `reviewAdvance`; what is settled
 * here is that there is something left at all.
 */
export function whyRepaymentIsRefused(
  standing: AdvanceStanding | undefined,
  month: YearMonth,
  monthAdvances: readonly Advance[],
): AdvanceRefusal | null {
  if (standing === undefined) return "advanceUnknown";

  // Refused before anything else, because the sentence the user needs is that
  // the month already records one — not that their figure is wrong. The two rows
  // would share a key and neither could then be overridden or explained apart
  // from the other (items 17, 24).
  const already = monthAdvances.some(
    (advance) =>
      advance.number === standing.number && advance.kind === "repaid",
  );
  if (already) return "advanceRecordedTwice";

  // The month it was granted in is the first month it can be repaid in. An
  // advance carried in from the opening position has no granting month, and so
  // no month that is too early (item 6).
  if (
    standing.grantedIn !== null &&
    compareMonth(month, standing.grantedIn) < 0
  ) {
    return "advanceNotYetGiven";
  }

  // Nothing left to repay, so any figure at all would be more than the debt.
  if (standing.outstandingAgorot <= 0) return "advanceOverRepaid";

  return null;
}

/**
 * What the month the movement is being recorded in already knows: the advances
 * the worker has, this month's own movements, and which month it is.
 */
interface AdvanceContext {
  ledger: readonly AdvanceStanding[];
  monthAdvances: readonly Advance[];
  month: YearMonth;
}

/**
 * The draft as an `Advance`, or the reason it is not one. Pure, so every one of
 * item 20's three refusals can be tested without a store or a request.
 *
 * **Nothing here signs anything**: the amount is held positive and the closing
 * block decides which way it moves from `kind`, so a sign can never disagree
 * with the label beside it — the same rule the income tax and a line the user
 * adds are already held to.
 */
export function reviewAdvance(
  draft: AdvanceDraft,
  context: AdvanceContext,
): ReviewedAdvance {
  if (!advanceKinds.includes(draft.kind)) return { ok: false, reason: "shape" };

  // **A grant's number is minted here and is never the caller's**, which is also
  // what makes a grant unable to collide with a movement this month already
  // records: the ledger the number is minted from counts this month, so the
  // number is past everything in it. There is therefore no duplicate check on
  // this side, and adding one would be a branch nothing can reach.
  const advanceNumber =
    draft.kind === "granted" ? nextAdvanceNumber(context.ledger) : draft.number;

  const standing = context.ledger.find(
    (candidate) => candidate.number === advanceNumber,
  );

  if (draft.kind === "repaid") {
    // Everything settled before the amount is read, and settled by the same
    // function the screen asks before it offers the button at all.
    const refused = whyRepaymentIsRefused(
      standing,
      context.month,
      context.monthAdvances,
    );
    if (refused !== null) return { ok: false, reason: refused };
  }

  const agorot = parseShekels(draft.amount);
  // Zero is refused with the rest: an advance of nothing is not one, and it
  // would print in the export as a payment of nothing (item 2). `parseShekels`
  // has already refused a minus.
  if (agorot === null || agorot === 0) return { ok: false, reason: "amount" };

  // The standing is the whole employment's and so already counts whatever this
  // month repaid — which is nothing, because a month that had already repaid
  // this advance was refused above. That is why the outstanding figure can be
  // compared against as it stands rather than with this month's own repayment
  // added back in.
  if (
    draft.kind === "repaid" &&
    standing !== undefined &&
    agorot > standing.outstandingAgorot
  ) {
    return { ok: false, reason: "advanceOverRepaid" };
  }

  // **The day the money was handed over, and it has to fall inside the month
  // the grant is recorded in** (item 20): a grant dated outside its own month is
  // a contradiction, and it is refused here rather than corrected to something
  // the user did not type. A repayment carries no date — the month it is entered
  // for is what dates it.
  let givenOn: IsoDate | null = null;
  if (draft.kind === "granted") {
    if (!isIsoDate(draft.givenOn)) return { ok: false, reason: "advanceDate" };
    if (!sameMonth(monthOf(draft.givenOn), context.month)) {
      return { ok: false, reason: "advanceDate" };
    }
    givenOn = draft.givenOn;
  }

  const note = draft.note.trim();
  return {
    ok: true,
    advance: {
      number: advanceNumber,
      kind: draft.kind,
      agorot,
      ...(note === "" ? {} : { note }),
      ...(givenOn === null ? {} : { givenOn }),
    },
  };
}

/**
 * Why a movement cannot be removed, or `null` if it can (specs.md item 20).
 *
 * **A grant is what makes the debt, so it cannot be taken away from under a
 * repayment.** Removing February's ₪3,000 while March and April still repay
 * ₪1,000 each leaves an advance whose principal is nothing and whose repayments
 * are ₪2,000 — a negative balance no screen has a way to name, and the state
 * item 20 refuses from the other direction when it refuses over-repaying. The
 * repayments come off first, and then the grant.
 *
 * A repayment is always removable: taking one off only ever makes the debt
 * larger, which is a position the application can name.
 *
 * The comparison is made against what the standing would *become* rather than
 * against what it is, because the movement being removed is inside the figures
 * the ledger already counted.
 */
export function whyRemovalIsRefused(
  standing: AdvanceStanding | undefined,
  movement: Advance | undefined,
): AdvanceRefusal | null {
  // Nothing to remove. Not an error: a stale page can ask to remove a movement
  // another gesture has already taken off, and the answer to that is nothing.
  if (movement === undefined || standing === undefined) return null;
  if (movement.kind !== "granted") return null;

  return standing.principalAgorot - movement.agorot < standing.repaidAgorot
    ? "advanceRepaidAlready"
    : null;
}

/** The two fields a movement and its override live in, written structurally so
 * the rule below can be read without a month around it. */
type WhereAdvancesLive = Pick<MonthFacts, "advances" | "overrides">;

/**
 * A month with one movement gone, **and any amount the user typed over that row
 * gone with it** (specs.md items 17, 20).
 *
 * The two removals are one operation for the reason `withoutOneOffUserLine`
 * already gives: an override is addressed by the row's own key, so one left
 * behind is an amount waiting to reattach itself to a row that never asked for
 * it — and since a stored override *replaces* the calculated figure, the row it
 * landed on would show an amount nobody entered for it, marked as manual, with
 * nothing on the screen to say where it came from.
 */
export function withoutAdvance<T extends WhereAdvancesLive>(
  month: T,
  advanceNumber: number,
  kind: AdvanceKind,
): T {
  const overrides = { ...month.overrides };
  delete overrides[advanceKey(advanceNumber, kind)];
  return {
    ...month,
    advances: month.advances.filter(
      (advance) => !(advance.number === advanceNumber && advance.kind === kind),
    ),
    overrides,
  };
}

/**
 * The advances a month records two movements of one kind on, as `[number, kind]`
 * pairs — the shape `validateMonth` refuses (item 20).
 *
 * It is here beside the key rather than in `validate.ts`, because what makes
 * the pair impossible is the key itself: two rows built from one string can be
 * neither overridden nor explained apart (items 17, 24).
 */
export function duplicateAdvanceMovements(
  advances: readonly Advance[],
): [number, AdvanceKind][] {
  const seen = new Set<string>();
  const twice = new Map<string, [number, AdvanceKind]>();
  for (const advance of advances) {
    const key = advanceKey(advance.number, advance.kind);
    if (seen.has(key)) twice.set(key, [advance.number, advance.kind]);
    else seen.add(key);
  }
  return [...twice.values()];
}

/**
 * A movement being corrected (specs.md item 20). **Its number and its kind are
 * not in it**: they are what addresses the movement, so changing either would
 * be a different movement rather than a correction of this one — the number is
 * the application's to mint, and a grant turned into a repayment is the grant
 * removed and a repayment recorded.
 */
export interface AdvanceEditDraft {
  amount: string;
  note: string;
}

/**
 * The movement as it is corrected, or the reason it cannot be (specs.md item
 * 20). Pure, like `reviewAdvance`, so both directions of the ledger can be
 * tested without a store.
 *
 * **Each of the two kinds is refused from the side its correction can break
 * the ledger on**, and the comparison is against what the standing would
 * *become* rather than against what it is — the movement being edited is
 * already inside the figures the ledger counted, which is the same care
 * `whyRemovalIsRefused` takes.
 *
 * A grant corrected downwards is a removal that stops part of the way: dropping
 * February's ₪3,000 to ₪1,500 while March has repaid ₪2,000 leaves the negative
 * balance item 20 refuses. A repayment corrected upwards is the over-repayment
 * refused when it is first entered, arriving by the other gesture.
 */
export function reviewAdvanceEdit(
  draft: AdvanceEditDraft,
  movement: Advance,
  standing: AdvanceStanding,
): ReviewedAdvance {
  const agorot = parseShekels(draft.amount);
  // Zero is refused as it is on a new movement: a movement of nothing is not
  // one, and removing it is the gesture that means what zero would mean.
  if (agorot === null || agorot === 0) return { ok: false, reason: "amount" };

  const corrected = agorot - movement.agorot;
  if (
    movement.kind === "granted" &&
    standing.principalAgorot + corrected < standing.repaidAgorot
  ) {
    return { ok: false, reason: "advanceBelowRepaid" };
  }
  if (movement.kind === "repaid" && corrected > standing.outstandingAgorot) {
    return { ok: false, reason: "advanceOverRepaid" };
  }

  const note = draft.note.trim();
  return {
    ok: true,
    advance: {
      number: movement.number,
      kind: movement.kind,
      agorot,
      ...(note === "" ? {} : { note }),
      // **Carried and not asked for again.** A correction changes the amount and
      // the reason; the day the money was handed over is not on this panel, and
      // rebuilding the movement without it would drop the date on the first
      // correction of a figure — silently, since nothing on the screen would
      // then say there had ever been one.
      ...(movement.givenOn === undefined ? {} : { givenOn: movement.givenOn }),
    },
  };
}

/**
 * A month with one movement corrected in place, **and any amount the user typed
 * over that row dropped with it** (specs.md items 17, 20).
 *
 * The row keeps its key, so an override addressed to it would survive the
 * correction and stand in front of the figure they just corrected — the amount
 * on the sheet would be the old one, marked manual, with nothing on the screen
 * to say why. No advance row is overridable (`month.ts`), so this can only
 * reach an amount stored before that division was drawn, which is exactly the
 * amount nobody would think to look for — the same argument
 * `updateThirdPartyPayment` makes for a changed kind.
 */
export function withUpdatedAdvance<T extends WhereAdvancesLive>(
  month: T,
  corrected: Advance,
): T {
  const overrides = { ...month.overrides };
  delete overrides[advanceKey(corrected.number, corrected.kind)];
  return {
    ...month,
    advances: month.advances.map((advance) =>
      advance.number === corrected.number && advance.kind === corrected.kind
        ? corrected
        : advance,
    ),
    overrides,
  };
}

/**
 * One month of a split's span with the movements it is owed (specs.md item 20).
 *
 * **The grant goes in the span's first month and a repayment in every month,
 * that one included.** It is one function rather than two lines inside the
 * action for the reason `advanceKey` is one: the write and the test that holds
 * the preview against the sheet have to produce the same months, or the test
 * proves the agreement of a shape nothing writes.
 *
 * Nothing here is a schedule. What it adds is an ordinary repayment, so the month
 * it lands in is indistinguishable afterwards from a month the user typed it into
 * by hand.
 */
export function withAdvanceSplitMovements<
  T extends WhereAdvancesLive & Pick<MonthFacts, "month">,
>(
  record: T,
  grantMonth: YearMonth,
  advance: Advance,
  repaymentAgorot: number,
): T {
  return {
    ...record,
    advances: [
      ...record.advances,
      ...(sameMonth(record.month, grantMonth) ? [advance] : []),
      { number: advance.number, kind: "repaid" as const, agorot: repaymentAgorot },
    ],
  };
}

/**
 * How far a split may reach, in months (specs.md item 20).
 *
 * **It is a ceiling on what one request may write and not a rule about
 * repayment.** The split writes a real movement into every month of its span,
 * opening each month that nobody had opened yet, so the count decides how many
 * month rows one press creates. Three years is past any repayment a family would
 * agree at the moment they hand money over, and a span longer than that is a
 * crafted request rather than a plan.
 */
export const SPLIT_MONTHS_LIMIT = 36;

/**
 * The months a split covers: `count` months from the one the grant is recorded
 * in (specs.md item 20).
 *
 * **It starts in the grant's own month** and not in the one after it, because
 * that is the first month the advance may be repaid in — item 20's own rule,
 * which `whyRepaymentIsRefused` already applies from the other direction.
 */
export function splitSpan(grantMonth: YearMonth, count: number): YearMonth[] {
  return Array.from({ length: count }, (_, at) => addMonths(grantMonth, at));
}

/**
 * The principal divided into `count` instalments, **the last absorbing the
 * remainder** (specs.md item 20).
 *
 * ₪5,000 over three is 1,666.66 / 1,666.66 / 1,666.68: the even floor for as
 * long as possible, the odd figure once, at the end. The instalments sum to the
 * principal exactly, because money is integer agorot and a split that lost one
 * would leave a debt nothing could close — a worker owing a single agora that no
 * repayment can be entered for, since zero is refused as an amount.
 *
 * Pure arithmetic over agorot, so nothing here rounds and nothing here can
 * accumulate a floating-point remainder (`CLAUDE.md`).
 */
export function splitInstalments(
  principalAgorot: number,
  count: number,
): number[] {
  const even = Math.floor(principalAgorot / count);
  return Array.from({ length: count }, (_, at) =>
    at === count - 1 ? principalAgorot - even * (count - 1) : even,
  );
}

/**
 * The first confirmed month inside the span, or `null` where none is (specs.md
 * item 20).
 *
 * **One rule with two readers**, which is the reason it is a function rather
 * than a condition inside the action: the form asks it before it will offer the
 * button and names the month it answers with, and the server asks it again and
 * refuses the whole split on it. A screen that decided this for itself would be
 * a second copy that agrees today and drifts the first time either is
 * corrected — the same argument `whyRepaymentIsRefused` is written for.
 *
 * **The first and not all of them**, because what the user needs is a month to
 * shorten the span to; a list of three would still be answered by looking at the
 * earliest.
 *
 * A month the worker has no row for cannot have been confirmed, so a span
 * reaching into months nobody has opened is blocked by nothing — which is what
 * makes an advance granted this month splittable over the two that follow it.
 */
export function blockingConfirmedMonth(
  span: readonly YearMonth[],
  confirmedMonths: readonly YearMonth[],
): YearMonth | null {
  return (
    span.find((month) =>
      confirmedMonths.some((confirmed) => sameMonth(confirmed, month)),
    ) ?? null
  );
}

/**
 * A grant being entered with its repayments beside it (specs.md item 20).
 *
 * `instalments` is one amount per month of the span, oldest first and starting
 * in the grant's own month, and it travels as the user typed it for the reason
 * the grant's own amount does: the parsing is the server's (Part 3). Its length
 * is the span's length, so the count is never sent twice and the two cannot
 * disagree.
 */
export interface AdvanceSplitDraft {
  amount: string;
  note: string;
  givenOn: string;
  instalments: string[];
}

/** One instalment as it is to be written: an ordinary repayment, in the month it
 * belongs to. */
export interface SplitRepayment {
  month: YearMonth;
  agorot: number;
}

type ReviewedSplit =
  | { ok: true; advance: Advance; repayments: SplitRepayment[] }
  | { ok: false; reason: AdvanceRefusal };

/**
 * The grant and the N repayments it is split into, or the reason it is none
 * (specs.md item 20).
 *
 * **What it produces is N movements the user could have typed one at a time.**
 * Nothing of the split is stored as a plan: each instalment is thereafter an
 * ordinary repayment, editable, removable and overridable like any other, and
 * editing one rebalances none of the rest. So this function values nothing and
 * decides nothing about later months — it is the grant's own review plus the
 * arithmetic of dividing it.
 *
 * **The instalments are refused as a whole and never one by one.** A split that
 * wrote the months it could and refused the rest would leave a debt half
 * planned, with nothing on screen to say which half, so the first fault takes
 * all of it.
 *
 * Pure, like `reviewAdvance`, so the exact-sum rule and the refusals can be
 * tested without a store or a request.
 */
export function reviewAdvanceSplit(
  draft: AdvanceSplitDraft,
  context: AdvanceContext,
  confirmedMonths: readonly YearMonth[],
): ReviewedSplit {
  const count = draft.instalments.length;
  if (count < 1 || count > SPLIT_MONTHS_LIMIT) {
    return { ok: false, reason: "splitMonths" };
  }

  const span = splitSpan(context.month, count);
  // **Before the amounts are read**, because a confirmed month in the span
  // refuses the whole split whatever the figures are, and the sentence the user
  // needs is about the month and not about what they typed.
  if (blockingConfirmedMonth(span, confirmedMonths) !== null) {
    return { ok: false, reason: "confirmedMonthInSpan" };
  }

  // The grant itself, reviewed by the one function that reviews a grant — the
  // amount, the date and the number it is minted with all come from there, so a
  // split cannot accept a grant the ordinary gesture would refuse.
  const reviewed = reviewAdvance(
    { kind: "granted", amount: draft.amount, note: draft.note, givenOn: draft.givenOn },
    context,
  );
  if (!reviewed.ok) return reviewed;

  const amounts: number[] = [];
  for (const instalment of draft.instalments) {
    const agorot = parseShekels(instalment);
    // Zero is refused as it is on a movement of its own: a repayment of nothing
    // is not one, and a month that repays nothing is a shorter span.
    if (agorot === null || agorot === 0) return { ok: false, reason: "amount" };
    amounts.push(agorot);
  }

  // More than was given is not a repayment at all (item 20). Less is allowed and
  // leaves the rest owed, so only the one direction is refused.
  const planned = amounts.reduce((sum, agorot) => sum + agorot, 0);
  if (planned > reviewed.advance.agorot) {
    return { ok: false, reason: "splitExceedsPrincipal" };
  }

  return {
    ok: true,
    advance: reviewed.advance,
    repayments: span.map((month, at) => ({ month, agorot: amounts[at]! })),
  };
}
