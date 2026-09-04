import { connection } from "next/server";
import { MonthScreen } from "@/components/MonthScreen";
import type { WorkerMonths } from "@/components/MonthScreen";
import { getRepository } from "@/lib/dev/store";
import { calculateSeries } from "@/lib/engine/series";
import { todayInIsrael } from "@/lib/today";

/**
 * The month screen's route, and the only place in the application where the
 * store and the engine meet a request.
 *
 * **It reads and does not record** (specs.md item 5). Everything that enters a
 * payment — the advances, the income tax, the lines the user adds — is the
 * payments screen's, and this route shows what those come to; the two are one
 * calculation seen from its two ends and never two calculations.
 *
 * **The salary is worked out here and never in the browser** (`specs.md`
 * Part 3): the page reads the household's facts, replays each worker's months
 * from her opening position, and hands the calculated months down. The client
 * component below it chooses which of them to show and draws it, and holds no
 * arithmetic of its own — which is also what makes the preview and the export
 * one calculation path rather than two that agree for now.
 *
 * **Both workers are calculated, not only the one on screen.** The switcher
 * lives in the shell and its choice is client state, so a page that calculated
 * only "the current worker" would have to learn who that is before it could
 * render. Two workers is what an account holds (item 11) and a replay is tens
 * of milliseconds, so the whole household is cheaper than the round trip it
 * would take to ask.
 *
 * `connection()` is what keeps this out of the prerender: the store is a live
 * value and `today` is read from a clock, and a page that had been rendered at
 * build time would show the household as it stood when the build ran.
 */
export default async function MonthPage() {
  await connection();

  const repository = getRepository();
  const today = todayInIsrael();
  const workers = await repository.listWorkers();

  const household: WorkerMonths[] = await Promise.all(
    workers.map(async (profile) => {
      // The whole of her history, because a month's opening balances are the
      // previous month's closing ones and balances are never stored (item 13).
      // `today` reaches every month and only the one still running is clipped
      // by it (item 8).
      const months = await repository.listMonths(profile.id);
      return {
        worker: {
          id: profile.id,
          name: profile.name,
          firstName: profile.firstName,
        },
        restDay: profile.restDay,
        months: calculateSeries(months, profile, today),
      };
    }),
  );

  return <MonthScreen household={household} today={today} />;
}
