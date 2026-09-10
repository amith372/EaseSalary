import { connection } from "next/server";
import { Suspense } from "react";
import { PayslipScreen } from "@/components/PayslipScreen";
import type { WorkerPayslip } from "@/components/PayslipScreen";
import { getRepository } from "@/lib/dev/store";
import { advanceLedger } from "@/lib/engine/advances";
import { blocksExport, exportQuestions } from "@/lib/engine/beforeExport";
import { calculateSeries } from "@/lib/engine/series";
import { todayInIsrael } from "@/lib/today";

/**
 * `דף המשכורת` — stage 2's step 4, at `/month/payslip`.
 *
 * **The address is stage 2's to choose and this is the choice**: a sibling of
 * `/month/export`, because it is the same month seen a third way and no nav tab
 * owns it. The home screen has linked `לצפייה בדף המשכורת המלא` at `/sheet`
 * since stage 0, which was an address nobody had chosen and which 404'd; it now
 * points here, and so does `/reports`, month by month.
 *
 * **The counts come off `exportQuestions` and nothing counts a span twice.**
 * That is what the pre-export screen already lists a month's holidays and
 * vacation days with, so the two screens cannot disagree about how many the
 * month had — and it is the reason no new counting was written for this screen.
 *
 * `connection()` keeps it out of the prerender: the store is a live value and
 * `today` is read from a clock.
 */
export default async function PayslipPage() {
  await connection();

  const repository = await getRepository();
  const today = todayInIsrael();
  const workers = await repository.listWorkers();

  const household: WorkerPayslip[] = await Promise.all(
    workers.map(async (profile) => {
      const stored = await repository.listMonths(profile.id);
      const series = calculateSeries(stored, profile, today);
      // What is still owed after every month, which is a figure that carries
      // across the whole employment rather than sitting in one of them. The
      // payments screen walks the same ledger.
      const owed = advanceLedger(profile.openingPosition, stored).reduce(
        (total, standing) =>
          total + standing.principalAgorot - standing.repaidAgorot,
        0,
      );

      return {
        workerId: profile.id,
        workerName: profile.name,
        months: series.map((month) => {
          const questions = exportQuestions(month.facts, today);
          const countOf = (key: string) =>
            questions.find((question) => question.key === key)?.counts ?? {};
          const holidays = countOf("holidaysWorked");
          const worked = holidays.of ?? 0;
          return {
            month: month.facts.month,
            restDay: month.facts.terms.restDay,
            result: month.result,
            days: {
              vacation: countOf("vacationDays").days ?? 0,
              sick: countOf("sickDays").days ?? 0,
              holidaysWorked: worked,
              // Every holiday the month holds less the ones she worked — the
              // unworked half of the same answer, and not a second count of
              // the calendar.
              holidaysUnworked: (holidays.items ?? 0) - worked,
              freeRestDays: countOf("freeRestDays").days ?? 0,
            },
            // Zero is not "nothing owed" drawn as a figure: a row saying ₪0.00
            // is one the family reads as a debt of nothing rather than as no
            // debt, so the row is absent instead.
            advanceOwedAgorot: owed === 0 ? null : owed,
            canExport: blocksExport(month.facts, today).length === 0,
          };
        }),
      };
    }),
  );

  // `useSearchParams` suspends, and the month this screen shows comes off the
  // URL where `/reports` named one.
  return (
    <Suspense>
      <PayslipScreen household={household} />
    </Suspense>
  );
}
