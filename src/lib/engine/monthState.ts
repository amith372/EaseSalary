import type { MonthFacts } from "./types";

/**
 * Part 5's four states of a month, which are the vocabulary four other things
 * share.
 *
 * A month is *draft* while it only holds facts; *confirmed* once the user has
 * confirmed the minimum wage against it; *exported* once a file has been
 * produced from it; and *corrected* when a confirmed or exported month's facts
 * are then edited.
 */
export type MonthState = "draft" | "confirmed" | "exported" | "corrected";

/**
 * Which of the four a month is in, read off the three instants the store keeps
 * and never off a stored word — a state word beside them would be a fifth thing
 * that can disagree with the four.
 *
 * **Corrected outranks exported**, because a correction sends an exported month
 * back through confirmed and moves every later month's balances with it
 * (criterion 13). Code that treated exported as the end of the line would break
 * that, so the order here is the one place it is decided.
 *
 * A month whose calendar month has not ended yet is a draft that *cannot* be
 * confirmed (criterion 21); that is a separate axis and no clock is read here.
 */
export function monthState(
  facts: Pick<MonthFacts, "confirmedAt" | "exportedAt" | "updatedAt">,
): MonthState {
  const { confirmedAt, exportedAt, updatedAt } = facts;
  if (confirmedAt === undefined) return "draft";
  // Parsed rather than compared as text: the two instants are written by
  // different clocks in different shapes — Postgres returns `+00:00` where Node
  // writes `Z`, and one carries fractional seconds the other may not — and
  // comparing those as strings orders them by punctuation.
  //
  // Strictly later, and not merely different: the save that confirms a month
  // stamps the same instant on both, so a month just confirmed carries them
  // equal and only a later edit makes it *corrected*.
  if (
    updatedAt !== undefined &&
    Date.parse(updatedAt) > Date.parse(confirmedAt)
  ) {
    return "corrected";
  }
  return exportedAt === undefined ? "confirmed" : "exported";
}
