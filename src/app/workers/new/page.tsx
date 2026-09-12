import { connection } from "next/server";
import { AddWorkerScreen } from "@/components/AddWorkerScreen";
import type { Country } from "@/components/AddWorkerScreen";
import { monthOf } from "@/lib/dates";
import { rateInForce } from "@/lib/datedRates";
import { getRepository } from "@/lib/store";
import { todayInIsrael } from "@/lib/today";

/**
 * `EaseSalary - הוספת עובד` (`build_plan.md` stage 3).
 *
 * **It is a static segment beside `/workers/[id]`**, and Next resolves a
 * literal before a parameter, so `new` is this screen and never a worker whose
 * id happens to be the word.
 *
 * The two things it reads are the two the wizard cannot know: which countries
 * the household holds a holiday list for, and the minimum wage in force now.
 * Both come off the store rather than being written into the component, which
 * is the rule for every rate in this application — nothing is hardcoded, and a
 * household that has never fetched anything still has the seeded rows.
 *
 * `connection()` keeps it out of the prerender, for the reason `/workers`
 * gives: the store is a live value and the wage is read against a clock.
 */
export default async function AddWorkerPage() {
  await connection();

  const repository = await getRepository();
  const [lists, rates] = await Promise.all([
    repository.listHolidayLists(),
    repository.listRates(),
  ]);

  // One entry per country, and the same country's list for two years is one
  // country: the lists are per source *and* per year (item 12).
  const countries: Country[] = [
    ...new Map(
      lists
        .filter((list) => list.source.kind === "country")
        .map((list) => [
          list.source.kind === "country" ? list.source.code : "",
          { code: list.source.kind === "country" ? list.source.code : "", nameHe: list.nameHe },
        ]),
    ).values(),
  ].sort((a, b) => a.nameHe.localeCompare(b.nameHe, "he"));

  const minimum = rateInForce(rates, "minimumWage", monthOf(todayInIsrael()));
  // The seeded table carries a minimum wage from April 2025 onward and a store
  // only ever adds to it, so this is a corrupted rates table rather than a
  // household that has not fetched one. Raised rather than defaulted: a floor
  // of zero refuses nothing, and a salary accepted against no minimum is the
  // one mistake item 3 exists to prevent.
  if (minimum === null) {
    throw new Error("no minimum wage is in force: the rates table is empty");
  }

  return (
    <AddWorkerScreen countries={countries} minimumWageAgorot={minimum.value} />
  );
}
