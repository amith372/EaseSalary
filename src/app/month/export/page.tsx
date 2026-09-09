import { connection } from "next/server";
import { BeforeExportScreen } from "@/components/BeforeExportScreen";
import type { WorkerBeforeExport } from "@/components/BeforeExportScreen";
import { rateInForce } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import { getRepository } from "@/lib/dev/store";
import {
  blocksExport,
  exportQuestions,
  openSickSpellOf,
  recuperationToConfirm,
} from "@/lib/engine/beforeExport";
import type { SalaryRepository } from "@/lib/engine/repository";
import { MINIMUM_WAGE_SOURCE_URL, fetchMinimumWage } from "@/lib/scrape/minimumWage";
import type { ScrapeFailureKind } from "@/lib/scrape/failure";
import { todayInIsrael } from "@/lib/today";

/**
 * The questions that open an export — `EaseSalary - לפני הייצוא`
 * (`build_plan.md` stage 5, the pre-export questions).
 *
 * **It answers at `/month/export`, and the address was chosen before this
 * screen existed.** The home screen has linked here since stage 0, with a
 * comment saying the confirmation behind the link is built in stage 5; picking
 * a different address now would have left that link pointing at a 404 while the
 * screen it names sat somewhere else.
 *
 * **The fetch happens here and never in the browser** (specs.md Part 3, item
 * 4). The wage is read from its source, the figure and its effective date are
 * put to the user, and a failure comes back as one of three named kinds beside
 * the last figure the application knows — so a broken source costs the user a
 * correction rather than an export.
 *
 * **Both workers are prepared, not only the one on screen**, exactly as
 * `/month` and `/settings/holidays` do it: the switcher lives in the shell and
 * its choice is client state, so a page that prepared only "the current worker"
 * would have to learn who that is before it could render.
 *
 * `connection()` keeps it out of the prerender: the store is a live value, the
 * fetch is a live request, and `today` is read from a clock.
 */

/**
 * The wage the confirmation opens with, and where it came from.
 *
 * **A fetched figure is written into the table and a failed fetch is not.** The
 * table is seeded and a fetch updates it (Part 3), so the next opening of this
 * screen starts from what the last one learned; a failure leaves the seeded row
 * standing and the user typing, which is item 4's own degradation.
 *
 * The fetch runs once for the household and not once per worker: the minimum
 * wage is the state's figure and has nothing to do with which worker is being
 * paid.
 */
async function wageTable(
  repository: SalaryRepository,
): Promise<{ rates: DatedRate[]; failure: ScrapeFailureKind | null }> {
  const stored = await repository.listRates();
  const fetched = await fetchMinimumWage(stored);
  if (!fetched.rate.ok) {
    return { rates: stored, failure: fetched.rate.failure.kind };
  }
  await repository.saveRate(fetched.rate.value);
  return { rates: await repository.listRates(), failure: null };
}

export default async function BeforeExportPage() {
  await connection();

  const repository = await getRepository();
  const today = todayInIsrael();
  const workers = await repository.listWorkers();
  const { rates, failure } = await wageTable(repository);

  const household: WorkerBeforeExport[] = await Promise.all(
    workers.map(async (profile) => {
      const months = await repository.listMonths(profile.id);
      return {
        worker: {
          id: profile.id,
          name: profile.name,
          firstName: profile.firstName,
        },
        restDay: profile.restDay,
        baseMonthlySalaryAgorot: profile.baseMonthlySalaryAgorot,
        months: months.map((facts) => ({
          month: facts.month,
          confirmedWage: facts.confirmedWage,
          questions: exportQuestions(facts, today),
          blocks: blocksExport(facts, today),
          openSpell: openSickSpellOf(facts),
          recuperation: recuperationToConfirm(facts, profile, rates),
          // The row in force during *this* month, which is not the same as the
          // latest one the table holds: a month is valued at the rate that
          // stood during it and never at today's (item 4). A month earlier than
          // every row gets `null`, and the screen asks for the figure.
          offeredWage: rateInForce(rates, "minimumWage", facts.month),
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
    />
  );
}
