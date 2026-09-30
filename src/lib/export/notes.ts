import { advanceKey } from "@/lib/engine/advances";
import { lineKeys } from "@/lib/engine/lines";
import { userLineKey, userLinePrefix } from "@/lib/engine/month";
import { thirdPartyLineKey } from "@/lib/engine/thirdParty";
import type { MonthFacts } from "@/lib/engine/types";

/**
 * The notes the user wrote on the month's actions, gathered by the row each
 * action's money lands on (specs.md items 2 and 5).
 *
 * **Column I carries the user's notes and never the application's own
 * explanations.** Item 2 says so outright, and item 24 says why: an explanation
 * stays beside the figure it explains and is never restated elsewhere. The
 * column is also not a source for figures — the family's own workbook has a
 * cell whose note works an entitlement out correctly and then contradicts
 * itself in the same sentence, and the sheet paid what the cell said (Part 5).
 * Nothing reads back out of here.
 *
 * **A row may carry more than one note, because more than one action can reach
 * it**: two spells of sickness in a month are two notes on one deduction row.
 * They are joined rather than one of them winning, since a note the user wrote
 * and the sheet dropped is worse than a crowded cell.
 */

/** The vacation row has no engine line — there is no vacation payment at all
 * (item 7) — so its notes are addressed by a key of their own rather than by a
 * line key that must never exist. */
export const VACATION_NOTES_KEY = "vacationRow";

const JOIN = " · ";

export function notesOf(
  facts: MonthFacts,
): Readonly<Record<string, string>> {
  const gathered = new Map<string, string[]>();
  const add = (key: string, note: string | undefined) => {
    if (note === undefined || note.trim() === "") return;
    const already = gathered.get(key) ?? [];
    already.push(note.trim());
    gathered.set(key, already);
  };

  for (const span of facts.spans) {
    // Each kind of day reaches one row: sickness the deduction it causes, a
    // holiday the row that prices it, a rest day they had off the rest-day row
    // whose count it reduces, and vacation the reporting row that carries its
    // units alone.
    if (span.kind === "sick") add(lineKeys.sickDeduction, span.note);
    else if (span.kind === "holiday") add(lineKeys.holidaysWorked, span.note);
    else if (span.kind === "freeRestDay") add(lineKeys.restDays, span.note);
    else add(VACATION_NOTES_KEY, span.note);
  }

  for (const payment of facts.thirdPartyPayments) {
    add(thirdPartyLineKey(payment.kind), payment.note);
  }

  for (const advance of facts.advances) {
    add(advanceKey(advance.number, advance.kind), advance.note);
  }

  // A standing line's note and a one-off line's are addressed by the same two
  // prefixes the overrides are, so a note and an override on one line always
  // agree about which line that is.
  for (const line of facts.terms.standingLines) {
    add(userLineKey(userLinePrefix.standing, line.id), line.note);
  }
  for (const line of facts.userLines) {
    add(userLineKey(userLinePrefix.oneOff, line.id), line.note);
  }

  // **An override's note is the one the sheet most needs**, and it was the one
  // note the column never carried. Item 17 lets any computed amount be replaced
  // and marks it manual; the reason it was replaced is what the mark cannot
  // say, and a figure that departs from the calculation with nothing beside it
  // is exactly the cell a later reader cannot reconstruct. The override is
  // already addressed by the line's own key, so its note lands on the row whose
  // amount it explains.
  for (const [key, override] of Object.entries(facts.overrides)) {
    add(key, override.note);
  }

  // The hospital overtime is a line of its own (item 20) and its note is the
  // only thing that says what the hours were.
  add(lineKeys.hospitalOvertime, facts.hospitalOvertime?.note);

  return Object.fromEntries(
    [...gathered].map(([key, notes]) => [key, notes.join(JOIN)]),
  );
}
