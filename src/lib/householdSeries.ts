import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cache } from "react";
import { sameMonth } from "@/lib/dates";
import type { WorkerProfile } from "@/lib/engine/repository";
import { calculateSeries } from "@/lib/engine/series";
import type { MonthInSeries } from "@/lib/engine/series";
import { InvalidMonthError } from "@/lib/engine/validate";
import { readToday } from "@/lib/requestToday";
import { refusedMonthOf } from "@/lib/refusalView";
import type { RefusedMonth } from "@/lib/refusalView";
import { getRepository } from "@/lib/store";
import { WORKER_COOKIE } from "@/lib/workerCookie";
import type { YearMonth } from "@/lib/types";

/** One worker and their months as the replay came to them. */
interface WorkerInSeries {
  profile: WorkerProfile;
  /** Empty where their replay refused: a month the engine declined to value stops
   * every month after it (item 13), and there is no prefix worth handing over —
   * a balance that stopped in August is not the balance of today. */
  months: MonthInSeries[];
  /** The refusal that stopped their replay, or `null` where it stood
   * (`specs.md` item 25). The error itself and not the card's view of it, so a
   * caller with no place to draw a card can raise it again unchanged. */
  refusal: InvalidMonthError | null;
}

/**
 * The household replayed once for the request, and read by everything that
 * shows a figure.
 *
 * **Every screen was assembling this walk for itself** — the store, the months,
 * the rates and today, then `calculateSeries` — in twelve places, and a page
 * drawn inside the bar replayed the household twice over: once for itself and
 * once for the bell. The assembly is the part that can quietly differ, and a
 * screen reading a different table or a different `today` from the one beside
 * it is a disagreement no test of either screen would catch. So it is made in
 * one place and memoised for the request (`specs.md` Part 3: one engine, one
 * result, shown in as many places as the application likes).
 *
 * **The whole household and not the worker asked for**, because the bar draws
 * the bell on every page from every worker's months, so a page that replayed
 * one worker still paid for both. An account holds two workers at most
 * (item 11), which is what makes that the cheap option rather than the
 * thorough one.
 *
 * **It never throws a refusal.** `calculateMonth` refuses a month it cannot
 * value correctly rather than valuing it wrongly in silence (`specs.md`
 * item 25), and that refusal is carried back on the worker it belongs to
 * instead of out of this function — so a caller decides what to do about one
 * worker rather than losing the household. A caller that has no place to draw
 * one worker's card raises `refusal` again itself, in sight, rather than
 * drawing the other worker's figures as though the household were whole.
 *
 * `cache()` is React's per-request memo and nothing survives the response —
 * there is no cache to invalidate when a mark is made, which is the same reason
 * balances are replayed rather than stored (item 13).
 */
export const householdSeries = cache(async (): Promise<WorkerInSeries[]> => {
  const repository = await getRepository();
  // One rates read for the household and not one per worker: the table is the
  // household's (item 4), so a second read could only return the same rows.
  // The bracket tables are the household's for the same reason (item 17).
  const [workers, rates, taxBrackets, today] = await Promise.all([
    repository.listWorkers(),
    repository.listRates(),
    repository.listTaxBrackets(),
    readToday(),
  ]);
  return Promise.all(
    workers.map(async (profile) => {
      const months = await repository.listMonths(profile.id);
      try {
        return {
          profile,
          months: calculateSeries(months, profile, today, rates, taxBrackets),
          refusal: null,
        };
      } catch (error) {
        // **The refusal is caught per worker and never for the household.**
        // `calculateSeries` runs once per worker, so a refusal is a fact about
        // one employment and says nothing about the other; catching it around
        // the whole walk took the second worker's figures off the screen along
        // with the first's. Anything that is not the engine declining to value
        // a month is a fault and still surfaces.
        if (!(error instanceof InvalidMonthError)) throw error;
        return { profile, months: [], refusal: error };
      }
    }),
  );
});

/** One worker of the household, or `null` where the id names nobody in it — an
 * id in the address bar is an ordinary thing to mistype, and the caller decides
 * whether that is a 404 or a refusal. */
export async function workerInSeries(
  workerId: string,
): Promise<WorkerInSeries | null> {
  return (
    (await householdSeries()).find((worker) => worker.profile.id === workerId) ??
    null
  );
}

/**
 * One month of one worker's replay.
 *
 * A month nobody opened is in the walk like any other (`specs.md` item 6), so
 * `null` here means a month outside it altogether — before their first month, or
 * after the current one — and not a month with nothing recorded in it. It is
 * also what a worker whose replay refused has for every month, since a refusal
 * leaves them with no valued months at all.
 */
export async function monthInSeries(
  workerId: string,
  month: YearMonth,
): Promise<MonthInSeries | null> {
  const worker = await workerInSeries(workerId);
  return (
    worker?.months.find((entry) => sameMonth(entry.facts.month, month)) ?? null
  );
}

/** Their refusal as the card draws it, or `null` where their replay stood — the
 * step between the error the engine threw and `RefusalCard`'s input, made here
 * so the four screens that draw it do not each make it. */
export function refusalShown(worker: WorkerInSeries): RefusedMonth | null {
  return worker.refusal === null ? null : refusedMonthOf(worker.refusal);
}

/**
 * Where a download goes when there is no file to hand back.
 *
 * **A failure is a sentence and a file is not a place to put one.** The two
 * addresses that produce a workbook can draw no screen of their own, so every
 * way they can fail ends here: the browser is sent to the screen that *can* say
 * what happened, and says it in Hebrew, in the wording that screen already
 * uses. What this replaces is a body of English text — `No such worker`, `The
 * month has not been confirmed` — rendered by the browser as a bare page in a
 * language the family does not read, with no way on from it.
 *
 * **Which screen depends on what is missing, and there are only two.** A month
 * nobody confirmed goes to `/month/export`, where the confirmation is; anything
 * else goes to the opening screen, which carries the calendar. Neither is told
 * why it was opened, and that is deliberate for the same reason the 404 is
 * generic: a crafted address naming another household's real worker must not be
 * answered differently from one naming nobody.
 *
 * **It carries the worker where there is one.** Every screen is scoped by the
 * switcher's cookie (`WorkerScope`), so a request made for one worker while the
 * cookie names the other would land on a screen about the wrong one. A request
 * that named no worker, or named one this household does not have, sets
 * nothing — there is nothing true to set it to.
 *
 * **303 and not 307**: it turns the download into an ordinary page request,
 * which is what the browser has to make of it. The address is resolved against
 * the request, because a redirect is absolute and the origin is the
 * deployment's rather than a constant this file could hold.
 */
export function downloadSentTo(
  request: NextRequest,
  to: string,
  workerId: string | null,
): NextResponse {
  const response = NextResponse.redirect(new URL(to, request.nextUrl), 303);
  if (workerId !== null) {
    response.cookies.set(WORKER_COOKIE, workerId, { path: "/", sameSite: "lax" });
  }
  return response;
}
