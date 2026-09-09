import { connection } from "next/server";
import { WorkersList } from "@/components/WorkersList";
import type { WorkerSummary } from "@/components/WorkersList";
import { getRepository } from "@/lib/dev/store";
import { advanceLedger } from "@/lib/engine/advances";
import { calculateSeries } from "@/lib/engine/series";
import { todayInIsrael } from "@/lib/today";

/**
 * The list of the household's workers — `EaseSalary - העובדות` (specs.md item
 * 11, `build_plan.md` stage 4 step 9).
 *
 * **It was one of the five nav tabs that 404'd.** The nav is the contract:
 * every tab is a promise the application makes on every page, and a tab that
 * 404s is worse than a tab that is not there. This is the first of the five to
 * be answered, and it is answered here rather than in stage 3 because the
 * screen is one on the repository interface and needs no Postgres to be right.
 *
 * **The four facts under each worker are read from the same calculation
 * everything else is.** The balances are replayed from the opening position
 * (item 13) and what is still owed is walked from the same history (item 20) —
 * nothing on this screen is stored and nothing is totalled a second way, so the
 * days it shows are the days `/month` shows.
 *
 * `connection()` keeps it out of the prerender, for the reason `/month` gives:
 * the store is a live value and `today` is read from a clock.
 */
export default async function WorkersPage() {
  await connection();

  const repository = await getRepository();
  const today = todayInIsrael();
  const workers = await repository.listWorkers();

  const household: WorkerSummary[] = await Promise.all(
    workers.map(async (profile) => {
      const months = await repository.listMonths(profile.id);
      const series = calculateSeries(months, profile, today);
      // The closing balances of her last month, which is what "how many days
      // has she left" means. A worker with no months at all has her opening
      // position and nothing has happened to it yet (item 6).
      const last = series[series.length - 1]?.result.balances;
      const closing = (kind: "vacation" | "sick") =>
        last?.find((line) => line.kind === kind)?.closing ??
        (kind === "vacation"
          ? profile.openingPosition.vacationDays
          : profile.openingPosition.sickDays);

      return {
        worker: {
          id: profile.id,
          name: profile.name,
          firstName: profile.firstName,
        },
        employedSince: profile.employedSince,
        country: profile.country,
        baseMonthlySalaryAgorot: profile.baseMonthlySalaryAgorot,
        vacationDays: closing("vacation"),
        sickDays: closing("sick"),
        outstandingAgorot: advanceLedger(profile.openingPosition, months).reduce(
          (total, standing) => total + standing.outstandingAgorot,
          0,
        ),
      };
    }),
  );

  return <WorkersList household={household} />;
}
