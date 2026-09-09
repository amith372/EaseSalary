import { parseShekels } from "@/lib/money";
import type { LineOverride, MonthFacts } from "@/lib/engine/types";
import type { MonthLine, MonthResult } from "@/lib/types";

/**
 * The rule for an amount the user replaces by hand (specs.md item 17), and the
 * two changes that put one on a month and take it off again. Pure, so all three
 * can be tested without a store, a request or a clock.
 *
 * **What may be overridden is what the application worked out.** An amount the
 * month itself recorded — a line the user added, an advance movement, a payment
 * to a third party — carries no derived figure at all, so an override on one
 * would be a second amount standing in front of the first with nothing on
 * screen to say which is which. Those are corrected by *editing the entry*, and
 * the two gestures are named apart because that is what keeps either usable.
 *
 * **The test is not who typed the figure but where.** A standing line's amount
 * was typed, on the profile, and it reaches every month afterwards unchanged
 * (item 20) — so a month in which the family paid something else has no other
 * way to say so, and editing it would restate every month it appears in. It is
 * therefore on the overridable side, which is why the question is asked of the
 * line the engine drew and never of a list of keys kept beside it.
 */

/** An override as it leaves the browser: which row, the amount as typed, and
 * the reason. The amount is parsed here, on the server side of the boundary,
 * for the reason `reviewUserLine` gives — the form runs the same
 * `parseShekels` while she types, which is one rule read twice. */
export interface OverrideDraft {
  key: string;
  /** As typed — "180", "1,234.50". A minus is refused: an override is a
   * magnitude and the row it replaces gives it its sign (item 17). */
  amount: string;
  note: string;
}

/**
 * Why a draft is not an override.
 *
 * `notOverridable` is the one a crafted request produces, and it covers both
 * halves of one question: a key naming no row this month draws, and a key
 * naming a row that carries an amount the month itself recorded. They are one
 * refusal because they have one answer — this is not a figure the application
 * worked out — and splitting them would tell the user which of the two her
 * stale page had got wrong, which she cannot act on either way.
 */
export type OverrideRefusal = "amount" | "notOverridable";

export type ReviewedOverride =
  | { ok: true; key: string; override: LineOverride }
  | { ok: false; reason: OverrideRefusal };

/**
 * The draft as an override, or the reason it is not one, **asked of the lines
 * the engine actually drew for this month**.
 *
 * The engine's own `overridable` is the authority and there is no whitelist of
 * keys anywhere: which rows may be replaced is known where each draft is made
 * (`lines.ts`), and a second list kept here would compile clean and quietly
 * stop covering the next row the engine grows — the failure this file's
 * neighbours have already been bitten by twice.
 *
 * **Zero is an ordinary override**, and here it differs from a line the user
 * adds, which refuses it (item 20): a derived figure of zero is a real answer —
 * a month in which the family did not pay the rest-eve supplement — and it is
 * the only way to say so without pretending the row is absent.
 *
 * **The row's label is stored with the amount**, and it is a snapshot rather
 * than a lookup. An override outlives the row it addresses (item 17): a month
 * whose rest-day work is all unmarked stops drawing that row, and the amount
 * typed over it is still held. When the control lists such an override there is
 * no row left to read a name off, so the name it carries is the one the row
 * had when she typed the figure — which is also the only name that is true of
 * the moment she chose it.
 */
/**
 * Enough of a row to decide an override, which both a column line and a row of
 * the closing block satisfy.
 *
 * **It is written structurally rather than as a union of the two**, for the
 * reason the docblock above gives: the authority is the row's own
 * `overridable`, and a signature naming the two shapes would be a list of
 * places to remember to grow — which is the whitelist this file refuses in a
 * different spelling.
 */
export type OverridableRow = Pick<MonthLine, "key" | "label" | "overridable">;

export function reviewOverride(
  draft: OverrideDraft,
  lines: OverridableRow[],
): ReviewedOverride {
  const line = lines.find((candidate) => candidate.key === draft.key);
  if (line === undefined || !line.overridable) {
    return { ok: false, reason: "notOverridable" };
  }

  const agorot = parseShekels(draft.amount);
  if (agorot === null) return { ok: false, reason: "amount" };

  const note = draft.note.trim();
  return {
    ok: true,
    key: line.key,
    override: { agorot, label: line.label, ...(note === "" ? {} : { note }) },
  };
}

/** The two fields an override lives in, written structurally so the changes
 * below can be read and tested without a month around them. */
type WhereOverridesLive = Pick<MonthFacts, "overrides">;

/** The month with one amount replaced by hand. */
export function withOverride<T extends WhereOverridesLive>(
  month: T,
  key: string,
  override: LineOverride,
): T {
  return { ...month, overrides: { ...month.overrides, [key]: override } };
}

/**
 * The month with one override gone, and the row left derived again.
 *
 * **Clearing is its own gesture and is never the typing back of the calculated
 * figure** (specs.md item 17). The two produce the same number and mean
 * opposite things: one says the application is right after all and leaves the
 * row derived, the other stores that number by hand and leaves the row manual
 * for ever — so a later correction to the wage would move every figure on the
 * sheet except that one.
 *
 * **It asks nothing about the key.** An override whose row the month no longer
 * draws is exactly the one that most needs clearing, and a clear that refused
 * an unknown key would refuse the only case it exists for.
 */
export function withoutOverride<T extends WhereOverridesLive>(
  month: T,
  key: string,
): T {
  const overrides = { ...month.overrides };
  delete overrides[key];
  return { ...month, overrides };
}

/** An override the month is holding for a row it is not drawing, and the key it
 * is addressed by. */
export interface OrphanedOverride {
  key: string;
  override: LineOverride;
}

/**
 * The overrides this month holds that no row on it can show (specs.md
 * item 17).
 *
 * An override outlives the row it addresses — that is what "survives every
 * later recalculation" means — so it is never stored out of sight: an amount
 * that is stored, will reappear, and cannot be seen is the one failure in the
 * criterion that looks like nothing went wrong. The control lists these beside
 * the rows the month does draw and offers each to be cleared.
 *
 * **The closing block counts as drawn.** Its rows read overrides too, and none
 * of them is overridable (`types.ts`), so an amount over one of them can only
 * have been seeded or stored before that division was drawn — it is visible on
 * the month screen, and calling it invisible here would offer the user a clear
 * button for a figure she can see.
 */
export function orphanedOverrides(
  result: Pick<MonthResult, "lines" | "closing">,
  overrides: Record<string, LineOverride>,
): OrphanedOverride[] {
  const drawn = new Set([
    ...result.lines.map((line) => line.key),
    ...result.closing.map((row) => row.key),
  ]);
  return Object.entries(overrides)
    .filter(([key]) => !drawn.has(key))
    .map(([key, override]) => ({ key, override }));
}
