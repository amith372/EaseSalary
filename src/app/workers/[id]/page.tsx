import { notFound } from "next/navigation";
import { connection } from "next/server";
import { WorkerProfileScreen } from "@/components/WorkerProfileScreen";
import type { ProfileMonth } from "@/components/WorkerProfileScreen";
import type { ProfileBalance } from "@/components/WorkerBalances";
import { householdAlerts } from "@/lib/alertsView";
import { getRepository } from "@/lib/store";
import { monthOf, yearsBetween } from "@/lib/dates";
import { seniorityYearOfCalendarYear } from "@/lib/engine/balances";
import { advanceLedger } from "@/lib/engine/advances";
import { exportQuestions } from "@/lib/engine/beforeExport";
import { monthState } from "@/lib/engine/monthState";
import { calculateSeries } from "@/lib/engine/series";
import { he } from "@/lib/i18n/he";
import { SEEDED_HOLIDAY_LISTS, countryNameHe } from "@/lib/holidayLists";
import { formatAgorot, formatDays } from "@/lib/money";
import { readToday } from "@/lib/requestToday";

/**
 * One worker's own page — `EaseSalary - דף העובד` (`build_plan.md` stage 4,
 * step 9, and what stage 7 owed it).
 *
 * **It is a screen on the repository interface**, which is why it lands in
 * stage 4 rather than in stage 3: the slice builds screens on the in-memory
 * store and stage 3 persists what they write, exactly as it will for the
 * month. Nothing here waits on Postgres and nothing here is built twice.
 *
 * **The balances are the replay's and not a second count.** `calculateSeries`
 * walks her months from the opening position (item 13) and the closing figures
 * of the last of them are what "how many days has she left" means — the same
 * function the home screen and `/payments` run, so the three screens cannot
 * disagree. The sentence behind each "?" comes from the same line, so they
 * cannot explain one figure two ways either.
 *
 * **The days on a month row are the pre-export questions' counts**, which is
 * what `דף המשכורת` lists a month's days from: two screens reading one count,
 * rather than a second sweep of the calendar that could disagree with it.
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

  const today = await readToday();
  const months = await repository.listMonths(id);
  const series = calculateSeries(months, profile, today, await repository.listRates());
  const closing = series[series.length - 1]?.result.balances;

  const listed: ProfileMonth[] = series.map(({ facts, result }) => {
    const questions = exportQuestions(facts, today);
    const countOf = (key: string) =>
      questions.find((question) => question.key === key)?.counts ?? {};
    return {
      month: result.month,
      // Criterion 1's fourth total — what is actually transferred — read off the
      // engine's own result rather than summed here: one figure, one calculation
      // path (Part 3).
      netAgorot: result.net,
      grossAgorot: result.gross,
      state: monthState(facts),
      days: {
        worked: result.actualDays,
        vacation: countOf("vacationDays").days ?? 0,
        sick: countOf("sickDays").days ?? 0,
        // Every holiday the month holds, worked or not: the row says what the
        // month contained and not what it paid for.
        holidays: countOf("holidaysWorked").items ?? 0,
      },
    };
  });

  const vacation = closing?.find((line) => line.kind === "vacation");
  const sick = closing?.find((line) => line.kind === "sick");
  const ledger = advanceLedger(profile.openingPosition, months);
  const outstanding = ledger.reduce(
    (total, standing) => total + standing.outstandingAgorot,
    0,
  );

  const balances: ProfileBalance[] = [
    {
      key: "vacation",
      label: he.home.balances.vacation,
      dot: "bg-vacation-dot",
      value: formatDays(vacation?.closing ?? profile.openingPosition.vacationDays),
      // A worker with no month yet has no line to explain her opening
      // position, so the same sentence is built here from the seniority year
      // she is in — the figure the entitlement rests on (item 7).
      explanation: vacation?.explanation ?? {
        text: he.sheet.why.vacationBalance(
          seniorityYearOfCalendarYear(profile.employedSince, monthOf(today).year),
        ),
        link: "annualLeave",
      },
    },
    {
      key: "sick",
      label: he.home.balances.sick,
      dot: "bg-sick-dot",
      value: formatDays(sick?.closing ?? profile.openingPosition.sickDays),
      explanation: sick?.explanation ?? {
        text: he.sheet.why.sickBalance,
        link: "sickPay",
      },
    },
    {
      key: "advance",
      label: he.workers.facts.advance,
      dot: "bg-advance-dot",
      value: formatAgorot(outstanding),
      // Walked from the ledger and not calculated by a month, so it is the one
      // balance with no engine line to explain it (item 20).
      explanation: {
        text: he.workers.profile.advanceWhy,
        link: "wageDeductions",
      },
    },
  ];

  // The hero card: her first blockage, phrased once in `alertsView` and read
  // here from the same request-cached view the bar and the opening screen read
  // (item 27). A warning is not a blockage and stays in the bell.
  const view = await householdAlerts();
  const needsYou =
    view.open.find((card) => card.blockage && card.workerId === id) ?? null;

  return (
    <WorkerProfileScreen
      profile={profile}
      months={listed}
      seniorityYears={yearsBetween(profile.employedSince, today)}
      balances={balances}
      ledger={ledger}
      countryName={countryNameHe(SEEDED_HOLIDAY_LISTS, profile.country)}
      needsYou={needsYou}
    />
  );
}
