import { notFound } from "next/navigation";
import { connection } from "next/server";
import { WorkerProfileScreen } from "@/components/WorkerProfileScreen";
import type { ProfileMonth } from "@/components/WorkerProfileScreen";
import { getRepository } from "@/lib/dev/store";
import { advanceLedger } from "@/lib/engine/advances";
import { holidayYear } from "@/lib/engine/holidayYear";
import { holidayAllowanceFor } from "@/lib/engine/leave";
import { calculateSeries } from "@/lib/engine/series";
import { fromIsoDate } from "@/lib/dates";
import { todayInIsrael } from "@/lib/today";

/**
 * One worker's own page — `EaseSalary - דף העובד` (`build_plan.md` stage 4,
 * step 9).
 *
 * **It is a screen on the repository interface**, which is why it lands in
 * stage 4 rather than in stage 3: the slice builds screens on the in-memory
 * store and stage 3 persists what they write, exactly as it will for the
 * month. Nothing here waits on Postgres and nothing here is built twice.
 *
 * **The balances are the replay's and not a second count.** `calculateSeries`
 * walks her months from the opening position (item 13) and the closing figures
 * of the last of them are what "how many days has she left" means — the same
 * function `/month` and `/payments` run, so the three screens cannot disagree.
 *
 * A worker the store does not have is a 404 and not an error page: the id is in
 * the address bar and a mistyped one is an ordinary thing, not a bug in the
 * caller (`repository.ts` draws that line for ids that come from the store).
 */
export default async function WorkerPage({
  params,
}: PageProps<"/workers/[id]">) {
  await connection();

  const { id } = await params;
  const repository = await getRepository();
  const profile = await repository.getWorker(id);
  if (profile === null) notFound();

  const today = todayInIsrael();
  const year = fromIsoDate(today).getUTCFullYear();
  const months = await repository.listMonths(id);
  const series = calculateSeries(months, profile, today);
  const closing = series[series.length - 1]?.result.balances;

  // The picker's own two figures, worked out here rather than in the row that
  // shows them: the entitlement and what is drawn against it are one
  // calculation, and the profile row and `/settings/holidays` must not be able
  // to disagree about how much of her year is chosen (specs.md item 10). The
  // candidate list is left empty because this row reports only what is chosen:
  // the candidates are what the picker offers, and fetching a year's list to
  // draw one line of a profile would put a live scrape behind a page that does
  // not show it.
  const holidays = holidayYear(
    [],
    await repository.listSpans(id),
    holidayAllowanceFor(profile.employedSince, year),
    year,
  );

  const listed: ProfileMonth[] = series.map(({ result }) => ({
    month: result.month,
    // Criterion 1's fourth total — what is actually transferred — read off the
    // engine's own result rather than summed here: one figure, one calculation
    // path (Part 3).
    netAgorot: result.net,
  }));

  return (
    <WorkerProfileScreen
      profile={profile}
      months={listed}
      vacationDays={
        closing?.find((line) => line.kind === "vacation")?.closing ??
        profile.openingPosition.vacationDays
      }
      sickDays={
        closing?.find((line) => line.kind === "sick")?.closing ??
        profile.openingPosition.sickDays
      }
      ledger={advanceLedger(profile.openingPosition, months)}
      year={year}
      holidayDaysChosen={holidays.chosenDays}
      holidayAllowance={holidays.allowance}
    />
  );
}
