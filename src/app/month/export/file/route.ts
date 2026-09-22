import type { NextRequest } from "next/server";
import { parseYearMonth, sameMonth } from "@/lib/dates";
import { getRepository } from "@/lib/store";
import { blocksExport } from "@/lib/engine/beforeExport";
import { recordOf } from "@/lib/engine/repository";
import { workerInSeries } from "@/lib/householdSeries";
import { monthFileOf } from "@/lib/export/monthExport";
import { readIdentifyingNumbers } from "@/lib/identifyingNumbers";
import { readNow, readToday } from "@/lib/requestToday";

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
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const workerId = query.get("worker");
  const month = parseYearMonth(query.get("month") ?? "");
  // Item 2's two versions, and the plain one is the default: the workbook itself
  // instructs that the helper column is hidden before printing, so showing it is
  // the asked-for case and never the one that happens by omission.
  const showNotes = query.get("notes") === "1";

  if (workerId === null || month === null) {
    return new Response("A worker and a month are required", { status: 400 });
  }

  const replayed = await workerInSeries(workerId);
  if (replayed === null) return new Response("No such worker", { status: 404 });
  const { profile: worker, months: series } = replayed;
  const repository = await getRepository();
  const months = await repository.listMonths(workerId);

  // The whole history, because a month's opening balances are the previous
  // month's closing ones and no balance is ever stored (item 13). The month is
  // looked up in the replay, which values a month nobody opened as well
  // (item 6, Part 3); one outside it — before her first month or after the
  // current one — does not exist to export.
  const inSeries = series.find((one) => sameMonth(one.facts.month, month));
  if (inSeries === undefined) {
    return new Response("No such month", { status: 404 });
  }
  if (blocksExport(inSeries.facts, await readToday()).length > 0) {
    return new Response("The month has an unanswered question", {
      status: 409,
    });
  }

  const { bytes, filename } = await monthFileOf({
    worker: {
      id: worker.id,
      name: worker.name,
      firstName: worker.firstName,
    },
    employment: { employedSince: worker.employedSince },
    insurer: worker.insurer,
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
