import type { NextRequest } from "next/server";
import { parseYearMonth, sameMonth, yearMonthText } from "@/lib/dates";
import { getRepository } from "@/lib/store";
import { blocksExport } from "@/lib/engine/beforeExport";
import { recordOf } from "@/lib/engine/repository";
import { downloadSentTo, workerInSeries } from "@/lib/householdSeries";
import { monthFileOf } from "@/lib/export/monthExport";
import { readIdentifyingNumbers } from "@/lib/identifyingNumbers";
import { readNow, readToday } from "@/lib/requestToday";
import type { YearMonth } from "@/lib/types";

/**
 * The month's file — what the two buttons on `/month/export` point at.
 *
 * **A route handler and not a server action, because this hands back a file.**
 * The browser downloads it the way it downloads anything, so the two versions
 * are two links and the back button still works; an action returning bytes
 * would have to rebuild that in the browser.
 *
 * **The blocks are checked here and not only on the screen.** Item 18's rule is
 * that a month *is not exported* over an unanswered open spell, and a request
 * for this address can be crafted past the screen that asks. The confirmation
 * itself is `confirmMonth`'s and has already happened by the time the button is
 * pressed — this address produces the file and confirms nothing. The one thing
 * it writes is when the file was produced, so pressing it twice moves that
 * instant and nothing else.
 *
 * The worker lookup is the household check: the repository reads under the
 * signed-in person's session, so row-level security returns no worker from
 * another household.
 */
/** The before-export screen, opened on the month that could not be filed.
 * `namedMonth` is the same input the payslip and `/דוחות` use for a month they
 * could not export, so the two arrivals land the same way. */
function exportScreenFor(month: YearMonth): string {
  return `/month/export?month=${yearMonthText(month)}`;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const workerId = query.get("worker");
  const month = parseYearMonth(query.get("month") ?? "");
  // Item 2's two versions, and the plain one is the default: the workbook itself
  // instructs that the helper column is hidden before printing, so showing it is
  // the asked-for case and never the one that happens by omission.
  const showNotes = query.get("notes") === "1";

  // **No failure below answers with a body.** This address hands back a
  // workbook, so anything it wrote instead would be text the browser renders as
  // a bare page — and every one of those sentences was English. Each goes to
  // the screen that can say what is wrong in Hebrew (`downloadSentTo`).
  //
  // A request missing either half was crafted: the screens that link here build
  // the address themselves. It names no worker to scope a screen by.
  if (workerId === null || month === null) return downloadSentTo(request, "/", null);

  const replayed = await workerInSeries(workerId);
  // Unknown, or another household's — `workerInSeries` answers null for both,
  // and so must this, or the difference between the two answers would say
  // whose id is real.
  if (replayed === null) return downloadSentTo(request, "/", null);
  // A month the engine refused has no file, and this address has no way to say
  // so. The opening screen draws the card, on the calendar the mark that caused
  // it is corrected on (`specs.md` item 25).
  if (replayed.refusal !== null) return downloadSentTo(request, "/", workerId);
  const { profile: worker, months: series } = replayed;
  const repository = await getRepository();
  const months = await repository.listMonths(workerId);

  // The whole history, because a month's opening balances are the previous
  // month's closing ones and no balance is ever stored (item 13). The month is
  // looked up in the replay, which values a month nobody opened as well
  // (item 6, Part 3); one outside it — before their first month or after the
  // current one — does not exist to export.
  const inSeries = series.find((one) => sameMonth(one.facts.month, month));
  // Outside their replay altogether — before their first month, or past the current
  // one. There is no month screen to send them to, so it is the opening screen.
  if (inSeries === undefined) return downloadSentTo(request, "/", workerId);
  // An unanswered question is asked on `/month/export`, and it is asked about
  // this month, so the month travels with them (the payslip links the same way).
  if (blocksExport(inSeries.facts, await readToday()).length > 0) {
    return downloadSentTo(request, exportScreenFor(month), workerId);
  }
  // **A month nobody confirmed has no file** (specs.md items 4, 17). The
  // minimum wage and the income tax are confirmed before every export and
  // stored on the month by that confirmation, so a month without one would be
  // filed with figures nobody agreed to and would not reproduce: the same
  // address tomorrow would hand back a different sheet. The rule is the
  // route's because the route is the address — the payslip and `/דוחות` link
  // straight to it, and each withholds its link for the same reason a blocked
  // month gets none.
  if (inSeries.facts.confirmedAt === undefined) {
    return downloadSentTo(request, exportScreenFor(month), workerId);
  }

  const { bytes, filename } = await monthFileOf({
    worker: {
      id: worker.id,
      name: worker.name,
      firstName: worker.firstName,
      gender: worker.gender,
    },
    employment: { employedSince: worker.employedSince },
    insurer: worker.insurer,
    // The sheet's own sentences are worded from it (Part 3), and it is read off
    // the profile rather than the month for the reason the insurer is.
    gender: worker.gender,
    // Opened here, on the server, for the file and nothing else (item 22). The
    // visa and permit numbers are not read: the month sheet does not print them.
    numbers: await (async () => {
      const { passport, bankAccount } = await readIdentifyingNumbers(
        repository,
        workerId,
      );
      return { passport, bankAccount };
    })(),
    month: inSeries,
    showNotes,
  });

  // Part 5's *exported* event, which the action list reads (item 27). Only a
  // stored month is stamped: a month nobody opened is valued by the replay and
  // has no row, and producing a file is no reason to create one.
  const stored = months.find((one) => sameMonth(one.month, month));
  if (stored !== undefined) {
    await repository.saveMonth(workerId, {
      ...recordOf(stored),
      exportedAt: await readNow(),
    });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // The name is Hebrew, so it travels in the encoded form and never in the
      // bare one: a `filename=` with non-ASCII bytes in it is what arrives as
      // mojibake or as the URL's last segment.
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      // A month stays correctable after it was exported (item 13), so a cached
      // file would be a stale one the day it is corrected.
      "Cache-Control": "no-store",
    },
  });
}
