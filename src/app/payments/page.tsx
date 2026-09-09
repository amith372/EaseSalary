import { connection } from "next/server";
import { PaymentsScreen } from "@/components/PaymentsScreen";
import type { WorkerPayments } from "@/components/PaymentsScreen";
import { getRepository } from "@/lib/dev/store";
import { advanceLedger } from "@/lib/engine/advances";
import { orphanedOverrides } from "@/lib/engine/overrides";
import { recordOf } from "@/lib/engine/repository";
import { calculateSeries } from "@/lib/engine/series";
import { todayInIsrael } from "@/lib/today";

/**
 * The payments screen's route (specs.md item 5).
 *
 * **It records and the month screen reads**, which is the division the two
 * screens are built on: the month screen answers "what did this month come to"
 * and every group that *records* something lives here — the advances, the
 * income-tax line, the lines the user adds, and the payments that go to third
 * parties rather than to the worker (item 16).
 *
 * **It ran no engine until the manual overrides arrived, and now it runs one.**
 * Every other thing this screen records is an amount somebody typed — the tax,
 * a line the user added, an advance, a payment to a third party — and the one
 * walked figure, what is still owed on an advance, is a sum of typed amounts
 * rather than a rate applied to anything. An override is the exception by
 * definition: it addresses a figure the *application worked out* (specs.md item
 * 17), so the group that holds it has to see one. The engine's own `overridable`
 * is what says which rows may be replaced, and reading it is the only thing this
 * route asks the calculation for.
 *
 * **It is still not a second calculation path.** What the month came to is drawn
 * on `/month` and nothing here totals anything: the lines are handed down so the
 * control can list the rows and their figures, and every amount on this screen
 * that the user did not type came out of the same `calculateSeries` the month
 * screen and the export run (Part 3).
 *
 * `connection()` keeps it out of the prerender: the store is a live value and
 * `today` is read from a clock.
 */
export default async function PaymentsPage() {
  await connection();

  const repository = await getRepository();
  const today = todayInIsrael();
  const workers = await repository.listWorkers();

  const household: WorkerPayments[] = await Promise.all(
    workers.map(async (profile) => {
      // The whole of her history, for the reason `/month` gives: balances are
      // never stored, so a month calculated alone would open from nothing
      // (item 13).
      const months = await repository.listMonths(profile.id);
      const series = calculateSeries(months, profile, today);
      return {
        worker: {
          id: profile.id,
          name: profile.name,
          firstName: profile.firstName,
        },
        months: series.map(({ facts, result }) => ({
          // `recordOf` drops the spans, which belong to the worker and not to a
          // month (`repository.ts`) and which this screen has nothing to say
          // about.
          record: recordOf(facts),
          // The columns and the closing block together, because the override
          // control asks each row its own `overridable` and one of the block's
          // rows answers yes: a standing line placed after the month's total
          // (item 17, `types.ts`).
          lines: [...result.lines, ...result.closing],
          // Held for a row this month is not drawing, and listed all the same:
          // an amount that is stored, will reappear, and cannot be seen is the
          // one failure in item 17 that looks like nothing went wrong.
          orphanedOverrides: orphanedOverrides(result, facts.overrides),
        })),
        // What is still owed on each advance — a fact about the whole
        // employment that no single month can see, so it is walked here from
        // the same history and the same opening position the balances are
        // replayed from (item 20).
        advances: advanceLedger(profile.openingPosition, months),
      };
    }),
  );

  return <PaymentsScreen household={household} today={today} />;
}
