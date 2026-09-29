import { fullDayLabel, monthLabel } from "@/lib/dateLabels";
import type { InvalidMonthError } from "@/lib/engine/validate";
import { legalLink } from "@/lib/links";
import type { LegalLink } from "@/lib/links";
import type { YearMonth } from "@/lib/types";

/** One refusal as the card draws it. */
interface RefusedReason {
  /** The Hebrew sentence the engine refused with, which says why and not only
   * what (`validate.ts`). */
  message: string;
  /** The dates the refusal names, each already written out — they are kept
   * apart from the sentence so the card can isolate them, since a date inside
   * a Hebrew paragraph is a mixed run a browser may reorder (`specs.md`
   * Part 5). Empty where the refusal concerns no date, as an advance does. */
  dates: string[];
  /** The rule the refused action rests on (`specs.md` item 25). Never null:
   * every refusal the engine can produce carries one. */
  law: LegalLink;
}

/** A refused month as the card draws it. */
export interface RefusedMonth {
  month: YearMonth;
  /** "אוגוסט 2026" — the month the refusal concerns, which is not always the
   * month the screen was asked for: one refused month stops the replay of
   * every later one (item 13), so the card has to say where the trouble is. */
  monthLabel: string;
  /** One sentence per refusal, in the order the engine raised them. Two
   * refusals in one month are two reasons and not two cards. */
  reasons: RefusedReason[];
}

/**
 * The card's input, built from the error the engine threw.
 *
 * **It is a separate function from the card so that it can be tested.** The
 * card is interface code and carries no tests (`CLAUDE.md`); what is worth
 * proving is that every refusal the engine can raise arrives with a sentence,
 * its dates and its rule — which is the half that would otherwise fail silently
 * as an empty card.
 *
 * Nothing here reads a clock or a store: it is a pure rewrite of what the error
 * already carries.
 */
export function refusedMonthOf(error: InvalidMonthError): RefusedMonth {
  return {
    month: error.month,
    monthLabel: monthLabel(error.month),
    reasons: error.refusals.map((refusal) => ({
      message: refusal.message,
      dates: refusal.dates.map(fullDayLabel),
      law: legalLink(refusal.link),
    })),
  };
}
