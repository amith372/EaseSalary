import { connection } from "next/server";
import { PaymentsScreen } from "@/components/PaymentsScreen";
import type { WorkerPayments } from "@/components/PaymentsScreen";
import { getRepository } from "@/lib/dev/store";
import { advanceLedger } from "@/lib/engine/advances";
import { recordOf } from "@/lib/engine/repository";
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
 * **It reads facts and calculates nothing**, which is where it differs from
 * `/month`. Nothing on this screen shows a derived figure: the amounts are the
 * ones the user entered and the one walked figure — what is still owed on an
 * advance — is a sum of entered amounts and not a rate applied to anything. So
 * the engine is not run here at all, and what the entries come to is answered on
 * the month screen, by the one calculation path that also fills the export
 * (Part 3).
 *
 * `connection()` keeps it out of the prerender: the store is a live value and
 * `today` is read from a clock.
 */
export default async function PaymentsPage() {
  await connection();

  const repository = getRepository();
  const today = todayInIsrael();
  const workers = await repository.listWorkers();

  const household: WorkerPayments[] = await Promise.all(
    workers.map(async (profile) => {
      const months = await repository.listMonths(profile.id);
      return {
        worker: {
          id: profile.id,
          name: profile.name,
          firstName: profile.firstName,
        },
        // The facts each month holds, without their figures. `recordOf` drops
        // the spans, which belong to the worker and not to a month
        // (`repository.ts`) and which this screen has nothing to say about.
        months: months.map(recordOf),
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
