import { compareMonth, parseYearMonth } from "@/lib/dates";
import { userLineKey } from "@/lib/engine/month";
import { userLineDirections, userLinePlacements } from "@/lib/engine/types";
import { parseShekels } from "@/lib/money";
import type {
  MonthFacts,
  UserLine,
  UserLineDirection,
  UserLinePlacement,
} from "@/lib/engine/types";

/**
 * A line the user is adding, as it leaves the browser, and the rule that says
 * whether it is a line at all (specs.md item 20).
 *
 * **The amount travels as the user typed it and is parsed here**, on the server
 * side of the boundary, because the browser collects facts and decides nothing
 * (Part 3). The form runs the same `parseShekels` while she types, so the field
 * can say "that is not an amount" before she presses anything — one rule read
 * twice rather than two rules that must agree.
 *
 * **Nothing here signs anything.** The sign comes from `direction` wherever the
 * line is finally drawn, in `month.ts`, which is what keeps a sign from ever
 * disagreeing with the label beside it (item 20). A draft carrying a minus is
 * refused rather than corrected, and `parseShekels` is where that happens.
 */
export interface UserLineDraft {
  /** The user's own words. Trimmed, and never translated by the application. */
  label: string;
  /** As typed — "180", "1,234.50", "‎450 ₪". */
  amount: string;
  direction: UserLineDirection;
  placement: UserLinePlacement;
  /** The reason, which is the part the application cannot derive and the part a
   * later reader needs (item 20). Empty means she did not give one. */
  note: string;
}

/**
 * Why a draft is not a line. Each is a sentence the user is shown, not a log
 * line: a refusal carries the reason it was refused (specs.md item 25).
 *
 * `shape` is the one no ordinary gesture produces. The direction and the
 * placement are chosen from chips, so the only way to send a value outside
 * either union is a crafted request — and a server action is reachable by one,
 * which is why it is checked here rather than assumed from the form.
 */
export type UserLineRefusal = "label" | "amount" | "shape";

type ReviewedUserLine =
  | { ok: true; line: UserLine }
  | { ok: false; reason: UserLineRefusal };

/**
 * The draft as a `UserLine`, or the reason it is not one. Pure, so the rule can
 * be tested without a store, a request or a clock.
 *
 * The `id` is passed in rather than minted here for the same reason: an id is
 * the store's to give (`repository.ts` — ids come from the store and never from
 * a user), and a function that reached for `crypto.randomUUID` would be a
 * function whose output cannot be asserted.
 */
export function reviewUserLine(
  draft: UserLineDraft,
  id: string,
): ReviewedUserLine {
  const label = draft.label.trim();
  if (label === "") return { ok: false, reason: "label" };

  if (
    !userLineDirections.includes(draft.direction) ||
    !userLinePlacements.includes(draft.placement)
  ) {
    return { ok: false, reason: "shape" };
  }

  const agorot = parseShekels(draft.amount);
  // Zero is refused with the rest: a line that moves no money is not a line the
  // user meant, and it would print in the export as a payment of nothing
  // (item 2). `parseShekels` has already refused a minus.
  if (agorot === null || agorot === 0) return { ok: false, reason: "amount" };

  const note = draft.note.trim();
  return {
    ok: true,
    line: {
      id,
      label,
      direction: draft.direction,
      // Written even where it equals the default, because a stored value is
      // what the user chose and `placementOf`'s default is what she was offered
      // (item 20). A line saved without one would move if the default ever did.
      placement: draft.placement,
      agorot,
      ...(note === "" ? {} : { note }),
    },
  };
}

/**
 * A standing line as it leaves the browser: the line, and the lifetime only a
 * standing line has (specs.md item 20).
 *
 * **The two ends travel as text and are read here**, for the reason every other
 * draft in this file gives: the browser collects the gesture and the server
 * decides what it means (Part 3). Empty is not a missing value but the answer
 * "no end on that side", which is why a blank pair is a line that applies to
 * every month rather than a refusal.
 */
export interface StandingLineDraft extends UserLineDraft {
  /** `YYYY-MM`, or empty for a line that reaches back as far as the employment
   * does. */
  from: string;
  /** `YYYY-MM`, or empty for a line that runs on. */
  until: string;
}

/** A standing line's own refusal, beside the three a line of any lifetime can
 * be refused for: the range read backwards. */
export type StandingLineRefusal = UserLineRefusal | "lifetime";

/**
 * The draft as a standing `UserLine`, or the reason it is not one (item 20).
 *
 * **The line itself is reviewed by `reviewUserLine`**, because a standing line
 * is a one-off line with a different lifetime: the words, the amount, the
 * direction and the placement are the line's and two reviews would be two
 * places for those rules to drift. What this adds is the lifetime and the one
 * rule about it — a last month before the first is a range that reaches no
 * month at all, and a family that typed it meant something else.
 */
export function reviewStandingLine(
  draft: StandingLineDraft,
  id: string,
): { ok: true; line: UserLine } | { ok: false; reason: StandingLineRefusal } {
  const reviewed = reviewUserLine(draft, id);
  if (!reviewed.ok) return reviewed;

  const from = draft.from.trim() === "" ? undefined : parseYearMonth(draft.from.trim());
  const until = draft.until.trim() === "" ? undefined : parseYearMonth(draft.until.trim());
  if (from === null || until === null) return { ok: false, reason: "lifetime" };
  if (from !== undefined && until !== undefined && compareMonth(until, from) < 0) {
    return { ok: false, reason: "lifetime" };
  }

  return {
    ok: true,
    line: {
      ...reviewed.line,
      // Written only where the user named an end, so a line with no lifetime is
      // stored exactly as one written before the lifetime existed — which is
      // what makes "applies to every month" one state rather than two.
      ...(from === undefined ? {} : { from }),
      ...(until === undefined ? {} : { until }),
    },
  };
}

/**
 * The two fields a line the user added lives in. Written structurally rather
 * than as `MonthFacts`, so the rule below can be read and tested without a
 * month, a wage or a set of terms around it.
 */
type WhereUserLinesLive = Pick<MonthFacts, "userLines" | "overrides">;

/**
 * A month with one of its own lines gone, **and any amount the user typed over
 * that line gone with it** (specs.md item 20).
 *
 * The two removals are one operation and are written here rather than in the
 * action that calls it, because they are a rule and not plumbing. An override
 * is addressed by the line's own key (item 17), so one left behind is an amount
 * waiting to reattach itself to a line that never asked for it — and since a
 * stored override *replaces* the calculated figure, the line it landed on would
 * show an amount nobody entered for it, marked as manual, with nothing on the
 * screen to say where it came from.
 *
 * **The name says which set, because the type cannot.** `<T extends
 * WhereUserLinesLive>` is satisfied by any object carrying those two field
 * names, so the guarantee that `userLines` holds only one-off lines comes from
 * `MonthFacts` — standing ones live at `terms.standingLines` — and not from
 * this signature. Hence the `"extra"` prefix below is right by construction on
 * the one type this is called with, and the name is what carries that to a
 * second caller. A standing line is stopped on the profile instead, which
 * leaves the months it already appears in exactly as they were (item 20,
 * Part 3).
 */
export function withoutOneOffUserLine<T extends WhereUserLinesLive>(
  month: T,
  lineId: string,
): T {
  const overrides = { ...month.overrides };
  delete overrides[userLineKey("extra", lineId)];
  return {
    ...month,
    userLines: month.userLines.filter((line) => line.id !== lineId),
    overrides,
  };
}
