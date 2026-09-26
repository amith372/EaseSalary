import { connection } from "next/server";
import { ReportsScreen } from "@/components/ReportsScreen";
import type { WorkerReports } from "@/components/ReportsScreen";
import { householdSeries, refusalShown } from "@/lib/householdSeries";
import { blocksExport, monthStillRunning } from "@/lib/engine/beforeExport";
import { monthLevels } from "@/lib/engine/month";
import { readToday } from "@/lib/requestToday";

/**
 * The `דוחות` screen's route, which the shell links from every page.
 *
 * **The whole history is replayed and nothing is stored.** A worker's balances
 * are derived by walking her months from the opening position (item 13), so
 * every figure this screen shows and every file the four cards produce comes
 * off one walk — the same `calculateSeries` the month screen and the month
 * export run (Part 3). Nothing here totals anything of its own.
 *
 * **Both workers are prepared, not only the one on screen**, exactly as
 * `/month`, `/payments` and `/month/export` do it: the switcher lives in the
 * shell and its choice is client state, so a page that prepared only "the
 * current worker" would have to learn who that is before it could render.
 *
 * `connection()` keeps it out of the prerender: the store is a live value and
 * `today` is read from a clock.
 */
export default async function ReportsPage() {
  await connection();

  const today = await readToday();
  // Every figure and every file on this screen comes off the replay, so a
  // refused month leaves the worker it belongs to with nothing to list — and
  // offering a file for a month the engine declined to value is the one thing
  // it may not do. The other worker's reports are listed as they were.
  const replayed = await householdSeries();

  const household: WorkerReports[] = await Promise.all(
    replayed.map(async (worker) => {
      const { profile, months: series } = worker;
      // Newest first, because the two yearly reports open on the latest year
      // the worker has rather than on the current calendar year: a family
      // downloading in January is almost always after the year that just
      // ended, and a worker who stopped last year has no current year at all.
      const years = [
        ...new Set(series.map((month) => month.facts.month.year)),
      ].sort((a, b) => b - a);

      const months = series.map((month) => {
        // Which of the three figures say something different — the same answer
        // the payslip draws its levels by, so a month cannot read one way here
        // and another way there.
        const { withholds, transfers } = monthLevels(month.result);
        return {
          month: month.facts.month,
          grossAgorot: month.result.gross,
          afterWithholdingAgorot: month.result.afterWithholding,
          netAgorot: month.result.net,
          withholds,
          transfers,
          // The same function `/month/export` and `/month/export/file` use, so
          // the screen and the route cannot disagree about which months have a
          // file — a disagreement offers a month that has not ended.
          blocks: blocksExport(month.facts, today),
          stillRunning: monthStillRunning(month.facts, today),
          // The other half of what `/month/export/file` refuses on: the wage
          // and the tax are confirmed before every export and stored by that
          // confirmation, so a month without one has no file yet (items 4, 17).
          confirmed: month.facts.confirmedAt !== undefined,
        };
      });

      return {
        workerId: profile.id,
        refused: refusalShown(worker),
        months,
        years,
        // The latest finished month that can be exported. The current one can be
        // too, with a warning (item 21), but the one a family comes here for is
        // the month that is over.
        latest:
          [...months]
            .reverse()
            .find((month) => month.blocks.length === 0 && !month.stillRunning)
            ?.month ?? null,
      };
    }),
  );

  return <ReportsScreen household={household} />;
}
