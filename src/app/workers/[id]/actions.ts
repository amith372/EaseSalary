"use server";

import { revalidatePath } from "next/cache";
import { ACTION_FAULT, type ActionFault } from "@/lib/actionFault";
import { compareMonth } from "@/lib/dates";
import {
  bulkConfirmFigures,
  bulkConfirmVerdict,
  type BulkConfirmVerdict,
} from "@/lib/engine/bulkConfirm";
import { confirmMonthRecord } from "@/lib/monthConfirmation";
import { readNow, readToday } from "@/lib/requestToday";
import { getRepository, requireWorker } from "@/lib/store";
import type { YearMonth } from "@/lib/types";

/**
 * Confirming months from the worker's own list, without an export (specs.md
 * item 18's last paragraph).
 *
 * **No figure arrives from the browser.** What the form sends is which months
 * were ticked; every figure the confirmation writes is read here out of the
 * dated rates table, which is what makes the gesture a tick rather than a form
 * — and what makes a request crafted past the screen harmless, since the only
 * thing it can choose is a month.
 *
 * **The write itself is `monthConfirmation.ts`'s**, shared with the export
 * screen's button, so the two cannot drift (`CLAUDE.md` rule 12).
 */

/** What became of one ticked month. A refusal carries the reason it was refused
 * (specs.md item 25) and the screen has a sentence for each. */
export type MonthConfirmOutcome = {
  month: YearMonth;
  verdict: BulkConfirmVerdict;
};

export type ConfirmMonthsResult =
  | { ok: true; outcomes: MonthConfirmOutcome[] }
  | ActionFault;

/**
 * Confirm every month ticked, and say for each what became of it.
 *
 * **Oldest first, and one at a time.** Confirming a month can move the months
 * after it — the base salary is copied onto the month it confirms, raised to the
 * minimum where the profile sits below it (item 3), and balances carry forward
 * (items 7 and 13) — so each month is valued against what the ones before it
 * left, exactly as it would be by somebody walking the export screen month by
 * month. A batch computed up front would value them all against the state
 * before any of them was confirmed.
 *
 * **A month this worker does not have throws rather than refusing.** No tick
 * can ask for one, so the sentence for it would be wording for a state no
 * gesture reaches (working rule 4); the fault the screen already draws is the
 * honest answer. Months confirmed before it are left confirmed, which is
 * correct — nothing about them was wrong.
 */
export async function confirmMonths(
  workerId: string,
  months: YearMonth[],
): Promise<ConfirmMonthsResult> {
  try {
    const repository = await getRepository();
    const profile = await requireWorker(workerId, repository);
    const today = await readToday();
    const now = await readNow();
    // Read once: nothing in this run writes a rate. The export screen's own
    // confirmation may add a row, because the figure there is typed; here every
    // figure already exists, which is the rule the verdict is built on.
    const rates = await repository.listRates();

    const outcomes: MonthConfirmOutcome[] = [];
    for (const month of [...months].sort(compareMonth)) {
      const facts = await repository.getMonth(workerId, month);
      if (facts === null) {
        throw new Error(`No month ${month.year}-${month.month} for ${workerId}`);
      }

      // Re-checked here and never trusted from the screen: a row without a tick
      // is a courtesy, and item 18's rule is about what is *confirmed*.
      const verdict = bulkConfirmVerdict(facts, profile, rates, today);
      outcomes.push({ month, verdict });
      if (verdict !== "ok") continue;

      // The figures are the table's own, chosen by the same rule the export
      // screen offers them by. The verdict has already established that each
      // exists, so the `null` below is unreachable and not a fallback.
      const figures = bulkConfirmFigures(facts, profile, rates);
      if (figures === null) continue;

      await confirmMonthRecord(repository, profile, facts, figures, { today, now });
    }

    // Every screen reads the same workers and months, so the whole tree is
    // revalidated: a list of routes kept by hand is a list that misses one.
    revalidatePath("/", "layout");
    return { ok: true, outcomes };
  } catch {
    return ACTION_FAULT;
  }
}
