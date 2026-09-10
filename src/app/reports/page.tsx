import { connection } from "next/server";
import { ReportsScreen } from "@/components/ReportsScreen";
import type { WorkerReports } from "@/components/ReportsScreen";
import { getRepository } from "@/lib/dev/store";
import { blocksExport } from "@/lib/engine/beforeExport";
import { monthLevels } from "@/lib/engine/month";
import { calculateSeries } from "@/lib/engine/series";
import { todayInIsrael } from "@/lib/today";

/**
 * The `דוחות` screen's route — stage 2's step 3.
 *
 * **It is this stage's address and not only its file.** The shell has linked
 * `דוחות` from every page since stage 0 and it 404'd, which is worse than a tab
 * that is not there.
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

  const repository = await getRepository();
  const today = todayInIsrael();
  const workers = await repository.listWorkers();

  const household: WorkerReports[] = await Promise.all(
    workers.map(async (profile) => {
      const stored = await repository.listMonths(profile.id);
      const series = calculateSeries(stored, profile, today);
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
          // file. They did on 2026-09-10, and the hero offered a month that had
          // not ended.
          blocks: blocksExport(month.facts, today),
        };
      });

      return {
        workerId: profile.id,
        months,
        years,
        // The latest month that can actually be exported, which is rarely the
        // latest month recorded: the current one has not ended (item 21).
        latest:
          [...months].reverse().find((month) => month.blocks.length === 0)
            ?.month ?? null,
      };
    }),
  );

  return <ReportsScreen household={household} />;
}
