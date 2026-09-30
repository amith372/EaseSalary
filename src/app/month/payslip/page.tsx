import { connection } from "next/server";
import { Suspense } from "react";
import { PayslipScreen } from "@/components/PayslipScreen";
import type { WorkerPayslip } from "@/components/PayslipScreen";
import { getRepository } from "@/lib/store";
import { householdSeries, refusalShown } from "@/lib/householdSeries";
import { advanceLedger } from "@/lib/engine/advances";
import {
  blocksExport,
  exportQuestions,
  monthStillRunning,
} from "@/lib/engine/beforeExport";
import { todayInIsrael } from "@/lib/today";
import { readToday } from "@/lib/requestToday";

/**
 * `דף המשכורת`, at `/month/payslip`.
 *
 * **A sibling of `/month/export`**, because it is the same month seen a third
 * way and no nav tab owns it. The home screen's `לצפייה בדף המשכורת המלא`
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
  const today = await readToday();
  // The sheet is the month laid out row by row, so a month that could not be
  // valued has no rows: the card stands in the screen's place for the worker
  // whose replay refused, and the calendar it would be corrected on is one
  // link away on `/`. It is theirs alone — the other worker's sheet is drawn.
  const replayed = await householdSeries();

  const household: WorkerPayslip[] = await Promise.all(
    replayed.map(async (worker) => {
      const { profile, months: series } = worker;
      // The stored months as they stand, for the ledger below: it sums what was
      // recorded and not what the replay came to.
      const stored = await repository.listMonths(profile.id);
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
        refused: refusalShown(worker),
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
              // Every holiday the month holds less the ones they worked — the
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
            stillRunning: monthStillRunning(month.facts, today),
            // The Israeli calendar day of the confirmation, worked out here so
            // the screen reads no clock and no time zone (`CLAUDE.md`).
            confirmedOn:
              month.facts.confirmedAt === undefined
                ? null
                : todayInIsrael(new Date(month.facts.confirmedAt)),
            note: month.facts.note ?? null,
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
