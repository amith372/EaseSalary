import { after, connection } from "next/server";
import { HomeScreen } from "@/components/HomeScreen";
import type { WorkerMonths } from "@/components/HomeScreen";
import { blockagesOf, householdAlerts } from "@/lib/alertsView";
import { refreshMinimumWageIfStale } from "@/lib/minimumWageRefresh";
import { getRepository } from "@/lib/store";
import { calculateSeries } from "@/lib/engine/series";
import { parseYearMonth } from "@/lib/dates";
import { readToday } from "@/lib/requestToday";

/**
 * The opening screen's route, and the only place in the application where the
 * store and the engine meet a request.
 *
 * **The month is worked on where the application opens** (specs.md item 27), so
 * there is no separate month screen drawing the same calendar one link further
 * in.
 *
 * **It reads and does not record** (item 5). Everything that *records* a
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
 * **The minimum wage is read from its source once a day, from here** (item 4).
 * The screen values the month with the stored table and never waits for the
 * page: the read runs after the response, and a figure it finds shows on the
 * next visit. A failed read saves nothing, so it is tried again on the next
 * visit; the pre-export screen still reads the page on every export.
 *
 * `connection()` is what keeps this out of the prerender: the store is a live
 * value and `today` is read from a clock, and a page that had been rendered at
 * build time would show the household as it stood when the build ran.
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  await connection();
  // A month named in the address — the payslip's `להוסיף הערה לחודש` opens its
  // own month here — and otherwise the one the screen would choose.
  const { month: asked } = await searchParams;
  const askedMonth = typeof asked === "string" ? parseYearMonth(asked) : null;

  const repository = await getRepository();
  const today = await readToday();
  const workers = await repository.listWorkers();
  const now = new Date();
  after(async () => {
    try {
      await refreshMinimumWageIfStale(repository, now);
    } catch {
      // A background read that failed changes nothing the user has seen, and
      // the pre-export screen reads the page again before any export.
    }
  });

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
        firstMonth: profile.firstMonth,
        months: calculateSeries(months, profile, today, await repository.listRates()),
        spans: await repository.listSpans(profile.id),
      };
    }),
  );

  // The strip reads the view `/alerts` and the bell read, so it lists the
  // page's first blockages and counts the rest.
  const blockages = blockagesOf(await householdAlerts());

  return (
    <HomeScreen
      household={household}
      blockages={blockages}
      today={today}
      askedMonth={askedMonth}
    />
  );
}
