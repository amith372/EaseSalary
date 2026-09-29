import { connection } from "next/server";
import { BeforeExportScreen } from "@/components/BeforeExportScreen";
import type { WorkerBeforeExport } from "@/components/BeforeExportScreen";
import { rateInForce } from "@/lib/datedRates";
import { parseYearMonth } from "@/lib/dates";
import { getRepository } from "@/lib/store";
import { salaryFor } from "@/lib/engine/salary";
import { calculateSeries } from "@/lib/engine/series";
import {
  blocksExport,
  exportQuestions,
  monthStillRunning,
  openSickSpellOf,
  recuperationToConfirm,
} from "@/lib/engine/beforeExport";
import { MINIMUM_WAGE_SOURCE_URL } from "@/lib/scrape/minimumWage";
import { taxToConfirm } from "@/lib/engine/taxConfirmation";
import { refreshIncomeTaxIfStale } from "@/lib/incomeTaxRefresh";
import { refreshMinimumWage } from "@/lib/minimumWageRefresh";
import { readToday } from "@/lib/requestToday";

/**
 * The questions that open an export — `EaseSalary - לפני הייצוא`, at
 * `/month/export`, where the home screen links.
 *
 * **The fetch happens here and never in the browser** (specs.md Part 3, item
 * 4). The wage is read from its source, the figure and its effective date are
 * put to the user, and a failure comes back as one of three named kinds beside
 * the last figure the application knows — so a broken source costs the user a
 * correction rather than an export.
 *
 * **Both workers are prepared, not only the one on screen**, exactly as
 * `/` and `/settings/holidays` do it: the switcher lives in the shell and
 * its choice is client state, so a page that prepared only "the current worker"
 * would have to learn who that is before it could render.
 *
 * `connection()` keeps it out of the prerender: the store is a live value, the
 * fetch is a live request, and `today` is read from a clock.
 */

export default async function BeforeExportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await connection();
  const { month } = await searchParams;

  const repository = await getRepository();
  const today = await readToday();
  const workers = await repository.listWorkers();
  // **Before the wage and not beside it.** The tax refresh may write the credit
  // point's row, and `refreshMinimumWage` returns the table as it stands when
  // it reads it — so running this second would hand the screen a table missing
  // the row that had just been learned. The real clock and not `today`:
  // staleness is measured against the instant of the last fetch (`/`).
  const { taxBrackets } = await refreshIncomeTaxIfStale(repository, new Date());
  const { rates, failure } = await refreshMinimumWage(repository);

  const household: WorkerBeforeExport[] = await Promise.all(
    workers.map(async (profile) => {
      // The replay's months and not the stored ones: a month nobody opened is
      // exported like any other (specs.md item 6, Part 3), and confirming it is
      // what opens it.
      //
      // **Walked here and not read from `householdSeries`**, which is where
      // every other screen gets its months. This screen values the household
      // against the table the fetch above just returned, and the bar around it
      // asks for the household's replay too — whichever of the two resolved
      // first would settle the memo for the request, so the screen that exists
      // to confirm the minimum wage could show the figure from before the
      // fetch. The walk is cheap; the race is not visible when it goes wrong.
      const stored = await repository.listMonths(profile.id);
      const series = calculateSeries(stored, profile, today, rates, taxBrackets);
      return {
        worker: {
          id: profile.id,
          name: profile.name,
          firstName: profile.firstName,
          gender: profile.gender,
        },
        restDay: profile.restDay,
        firstMonth: profile.firstMonth,
        months: series.map(({ facts }) => ({
          month: facts.month,
          confirmedWage: facts.confirmedWage,
          baseMonthlySalaryAgorot: salaryFor(profile, facts.month),
          questions: exportQuestions(facts, today),
          blocks: blocksExport(facts, today),
          stillRunning: monthStillRunning(facts, today),
          openSpell: openSickSpellOf(facts),
          recuperation: recuperationToConfirm(facts, profile, rates),
          // The row in force during *this* month, which is not the same as the
          // latest one the table holds: a month is valued at the rate that
          // stood during it and never at today's (item 4). A month earlier than
          // every row gets `null`, and the screen asks for the figure.
          offeredWage: rateInForce(rates, "minimumWage", facts.month),
          // **The figure confirming would store, and not the one the month
          // carries** (specs.md item 17). They are the same for a month nobody
          // has confirmed yet and differ for one being exported again after a
          // correction — and it is the second the user is being asked about, so
          // the screen and `confirmMonth` read one calculation rather than two.
          incomeTax: taxToConfirm(
            stored,
            profile,
            today,
            rates,
            taxBrackets,
            facts.month,
          ),
        })),
      };
    }),
  );

  return (
    <BeforeExportScreen
      household={household}
      today={today}
      failure={failure}
      sourceUrl={MINIMUM_WAGE_SOURCE_URL}
      // The month the payslip or `/דוחות` named, for a month they could not
      // offer a file for. Read here rather than in the screen: a client subtree
      // that resolves after hydration replaces the questions mid-answer.
      namedMonth={parseYearMonth(month ?? "")}
    />
  );
}
