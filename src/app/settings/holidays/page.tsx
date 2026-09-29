import { connection } from "next/server";
import { listInForce } from "@/lib/engine/holidayAmendments";
import { HolidayPickerScreen } from "@/components/HolidayPickerScreen";
import type { WorkerHolidayYear } from "@/components/HolidayPickerScreen";
import { getRepository } from "@/lib/store";
import type { SalaryRepository, WorkerProfile } from "@/lib/engine/repository";
import { holidayYear } from "@/lib/engine/holidayYear";
import { holidayAllowanceFor } from "@/lib/engine/leave";
import { holidayListFor, type HolidayList } from "@/lib/holidayLists";
import { holidaySourceChoices, holidaySourceOf } from "@/lib/holidaySources";
import type { ScrapeFailureKind } from "@/lib/scrape/failure";
import { fetchHolidayList } from "@/lib/scrape/holidayList";
import { readToday } from "@/lib/requestToday";
import { fromIsoDate } from "@/lib/dates";
import { pickerReturnOf } from "@/lib/pickerReturn";

/**
 * The year's holidays, chosen in advance — `EaseSalary - בחירת חגים`.
 *
 * **It answers at `/settings/holidays`**, the artboard's address, which is what
 * keeps `הגדרות` lit in the nav. The way in is a row of the worker's terms on
 * `/settings` (`HolidaysRow`) and the alert that names an incomplete selection.
 *
 * **The year is in the address and not in the browser.** Moving to a year the
 * household has no list for is what makes the application fetch one (item 12),
 * and a fetch is the server's — so the year has to reach the server, and a
 * `?year=` is how a screen says which year it is showing without holding a
 * calculation of its own.
 *
 * **Both workers are prepared, not only the one on screen**, exactly as
 * `/` does it and for the same reason: the switcher lives in the shell and
 * its choice is client state, so a page that prepared only "the current worker"
 * would have to learn who that is before it could render.
 */

/**
 * The list for one worker's year, fetching one where the household has none
 * (specs.md item 12).
 *
 * **A failed fetch is not an empty list**, which is why the failure comes back
 * beside the holidays rather than as an empty array: the screen says which of
 * the three things went wrong and offers the dates to be typed by hand, and an
 * empty list would instead read as a source that publishes no holidays at all —
 * the mistake Part 5 records against `UA-2026.json`.
 *
 * A list that arrives is written into the store, so the fetch happens once for
 * the household rather than on every render. A failure is not written: the next
 * opening of the screen tries again, which is what the panel promises.
 */
async function listFor(
  repository: SalaryRepository,
  profile: WorkerProfile,
  year: number,
): Promise<{ list: HolidayList | null; failure: ScrapeFailureKind | null }> {
  const stored = await repository.listHolidayLists();
  const source = holidaySourceOf(profile);
  const held = holidayListFor(stored, source, year);
  if (held !== null) return { list: held, failure: null };

  const fetched = await fetchHolidayList(stored, source, year);
  if (!fetched.ok) return { list: null, failure: fetched.failure.kind };

  await repository.saveHolidayList(fetched.value);
  return { list: fetched.value, failure: null };
}

export default async function HolidaysPage({
  searchParams,
}: PageProps<"/settings/holidays">) {
  await connection();

  const { year: asked, from } = await searchParams;
  const thisYear = fromIsoDate(await readToday()).getUTCFullYear();
  const year = readYear(asked, thisYear);

  const repository = await getRepository();
  const workers = await repository.listWorkers();

  const household: WorkerHolidayYear[] = await Promise.all(
    workers.map(async (profile) => {
      const { list, failure } = await listFor(repository, profile, year);
      const spans = await repository.listSpans(profile.id);
      const { countries, religions } = holidaySourceChoices(
        await repository.listHolidayLists(),
        profile.country,
        holidaySourceOf(profile),
      );
      return {
        worker: {
          id: profile.id,
          name: profile.name,
          firstName: profile.firstName,
          gender: profile.gender,
        },
        countries,
        religions,
        failure,
        amending: listInForce(year, await repository.listMonths(profile.id)),
        year: holidayYear(
          list?.holidays ?? [],
          spans,
          holidayAllowanceFor(profile.employedSince, year),
          year,
          profile.restDay,
        ),
      };
    }),
  );

  return <HolidayPickerScreen
      household={household}
      year={year}
      from={pickerReturnOf(from)}
    />;
}

/**
 * The year the screen is showing.
 *
 * Anything that is not a four-digit year is this year rather than an error: the
 * value is in the address bar, where a mistyped one is an ordinary thing. The
 * range is what a holiday list can sensibly be asked for — an employment is
 * years and not centuries, and an unbounded year is an address that would set
 * the scrapers walking a source for 9999.
 */
function readYear(asked: string | string[] | undefined, thisYear: number): number {
  const text = Array.isArray(asked) ? asked[0] : asked;
  const year = Number(text);
  if (!Number.isInteger(year)) return thisYear;
  return year >= thisYear - 10 && year <= thisYear + 10 ? year : thisYear;
}
