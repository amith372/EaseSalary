import { baseForMonth } from "@/lib/engine/beforeExport";
import { recordOf } from "@/lib/engine/repository";
import type { SalaryRepository, WorkerProfile } from "@/lib/engine/repository";
import { salaryFor } from "@/lib/engine/salary";
import { taxToConfirm } from "@/lib/engine/taxConfirmation";
import type { MonthFacts } from "@/lib/engine/types";
import type { IsoDate } from "@/lib/types";

/**
 * The one place a month is written as *confirmed* (specs.md Part 5).
 *
 * **Two paths reach it and neither has its own copy**: the export screen's
 * button, which confirms the month it is showing and then hands over the file
 * (item 18), and the tick on the worker's list of months, which confirms
 * several and produces nothing (item 18's last paragraph). A second copy of
 * this would agree today and drift the first time either was corrected, and the
 * family would confirm one number and file another — which is exactly the
 * failure `CLAUDE.md` rule 12 exists to stop, here between two writers instead
 * of between a preview and an export.
 *
 * **It does not validate.** What may be stored is each action's own question,
 * because the two are asked different things: the export screen is handed
 * figures somebody typed, and the list is handed figures read out of the rates
 * table. By the time either calls this, the figures are settled.
 */

/** The figures a confirmation writes onto a month — the ones the application
 * cannot derive (items 4 and 15). */
export interface ConfirmedFigures {
  /** The minimum wage the month is valued at, in agorot. */
  minimumAgorot: number;
  /** The date that wage took effect, always a first of month (item 4). */
  effectiveFrom: IsoDate;
  /** The recuperation day rate, in a month that owes recuperation and only
   * there (item 15). Absent leaves whatever the month already carries. */
  recuperationDayRateAgorot?: number;
}

/** The two instants a confirmation needs, read from the clock by the action and
 * never in here — so the suite drives this without one (`CLAUDE.md`). */
export interface ConfirmedWhen {
  /** Today, for the replay that works the month's income tax out. */
  today: IsoDate;
  /** The instant stamped as `confirmedAt`, which Part 5 reads the state off. */
  now: string;
}

/**
 * Write this month as confirmed.
 *
 * **Three things are written, and they are written together** — the minimum
 * wage with the date it took effect, so the month stays valued at the rate in
 * force during it; the base monthly salary copied off the profile, or the
 * minimum where the profile sits below it (item 3), which is the moment the
 * month's figures stop moving with the profile; and, where the month owes
 * recuperation, the day rate it was valued at (item 15). One gesture, because
 * they are one answer: a month half-confirmed is a month that would have to say
 * which half.
 *
 * **The income tax is snapshotted with them** (item 17), and it is
 * `taxConfirmation.ts`'s figure rather than one worked out here: the screen puts
 * that very figure to the user before this runs.
 *
 * **The months are re-read here and not taken from the caller**, which is what
 * makes confirming several in a row correct. `taxToConfirm` replays the whole
 * series, and confirming one month can move the months after it — a profile
 * sitting below the minimum is raised onto the month it confirms, and balances
 * carry forward (items 7 and 13). So a run of confirmations is a sequence and
 * not a batch, and each month is valued against what the ones before it left.
 */
export async function confirmMonthRecord(
  repository: SalaryRepository,
  profile: WorkerProfile,
  facts: MonthFacts,
  figures: ConfirmedFigures,
  when: ConfirmedWhen,
): Promise<void> {
  const [months, rates, taxBrackets] = await Promise.all([
    repository.listMonths(profile.id),
    repository.listRates(),
    repository.listTaxBrackets(),
  ]);
  const confirmedTax = taxToConfirm(
    months,
    profile,
    when.today,
    rates,
    taxBrackets,
    facts.month,
  );

  await repository.saveMonth(profile.id, {
    ...recordOf(facts),
    // A month outside the series cannot be reached from either caller — both
    // read it first — and a tax of nothing is the safe reading of a month the
    // engine will not value.
    incomeTaxAgorot: confirmedTax?.agorot ?? 0,
    confirmedAt: when.now,
    confirmedWage: {
      baseAgorot: baseForMonth(
        salaryFor(profile, facts.month),
        figures.minimumAgorot,
      ),
      minimumAgorot: figures.minimumAgorot,
      effectiveFrom: figures.effectiveFrom,
    },
    ...(figures.recuperationDayRateAgorot === undefined
      ? {}
      : { recuperationDayRateAgorot: figures.recuperationDayRateAgorot }),
  });
}
