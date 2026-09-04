import { compareMonth } from "@/lib/dates";
import { advanceKinds } from "@/lib/engine/types";
import { parseShekels } from "@/lib/money";
import type {
  Advance,
  AdvanceKind,
  MonthFacts,
  OpeningPosition,
} from "@/lib/engine/types";
import type { YearMonth } from "@/lib/types";

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
 * travels as she typed it and is parsed on the server side of the boundary
 * (Part 3), exactly as a line she adds does.
 *
 * A grant carries no number: the application mints it (item 20), so there is
 * nothing about it for the user to choose beyond the amount and the reason.
 */
export type AdvanceDraft =
  | { kind: "granted"; amount: string; note: string }
  | { kind: "repaid"; number: number; amount: string; note: string };

/**
 * Why a movement is not one. Each is a sentence the user is shown, and **none
 * of these carries a legal link**, which is item 25's own rule rather than an
 * omission: each is a refusal about the *form* of an entry — an amount that is
 * not one, a second row where the sheet holds one, more than the debt — and
 * nothing in law says any of them, so they owe her the reason and not a
 * reference to a page that would not mention what stopped her.
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
  /** A grant removed while a later month still repays it (see
   * `whyRemovalIsRefused`). */
  | "advanceRepaidAlready";

export type ReviewedAdvance =
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
  // the month already records one — not that her figure is wrong. The two rows
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
export interface AdvanceContext {
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

  const note = draft.note.trim();
  return {
    ok: true,
    advance: {
      number: advanceNumber,
      kind: draft.kind,
      agorot,
      ...(note === "" ? {} : { note }),
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
