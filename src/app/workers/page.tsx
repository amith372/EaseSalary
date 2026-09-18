import { connection } from "next/server";
import { WorkersList } from "@/components/WorkersList";
import type { WorkerSummary } from "@/components/WorkersList";
import { getRepository } from "@/lib/store";
import { sharedWith } from "@/lib/shares";
import { SEEDED_HOLIDAY_LISTS, countryNameHe } from "@/lib/holidayLists";
import { advanceLedger } from "@/lib/engine/advances";
import { salaryFor } from "@/lib/engine/salary";
import { calculateSeries } from "@/lib/engine/series";
import { monthHasEnded, monthOf } from "@/lib/dates";
import { monthLabel } from "@/lib/dateLabels";
import { monthState } from "@/lib/engine/monthState";
import { readToday } from "@/lib/requestToday";

/**
 * The list of the household's workers — `EaseSalary - העובדות` (specs.md item
 * 11).
 *
 * **The nav is the contract**: every tab is a promise the application makes on
 * every page, and a tab that 404s is worse than a tab that is not there.
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
  const today = await readToday();
  const workers = await repository.listWorkers();
  // One query for the whole list, not one per card: a share is the household's
  // and every worker of a household carries the same addresses.
  const shares = await sharedWith();

  const household: WorkerSummary[] = await Promise.all(
    workers.map(async (profile) => {
      const months = await repository.listMonths(profile.id);
      const series = calculateSeries(months, profile, today, await repository.listRates());
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
        country: countryNameHe(SEEDED_HOLIDAY_LISTS, profile.country),
        // The salary in force this month, not the one the employment opened with.
        baseMonthlySalaryAgorot: salaryFor(profile, monthOf(today)),
        vacationDays: closing("vacation"),
        sickDays: closing("sick"),
        outstandingAgorot: advanceLedger(profile.openingPosition, months).reduce(
          (total, standing) => total + standing.outstandingAgorot,
          0,
        ),
        // The earliest month that has ended and is still a draft — what the
        // chip on her card names. A month that has not ended cannot be
        // confirmed (item 21), so it is never what is waiting; a corrected
        // month is not either, since its figures are current and only the file
        // is stale, which is the bell's business (item 27).
        waitingMonth:
          months
            .filter(
              (facts) =>
                monthHasEnded(facts.month, today) &&
                monthState(facts) === "draft",
            )
            .map((facts) => monthLabel(facts.month))[0] ?? null,
        sharedWith: shares.get(profile.id) ?? [],
      };
    }),
  );

  return (
    <WorkersList
      household={household}
      hasRoom={await repository.hasRoomForWorker()}
    />
  );
}
