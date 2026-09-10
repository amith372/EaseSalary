import type { NextRequest } from "next/server";
import { parseYearMonth, sameMonth } from "@/lib/dates";
import { getRepository } from "@/lib/dev/store";
import { blocksExport } from "@/lib/engine/beforeExport";
import { calculateSeries } from "@/lib/engine/series";
import { monthFileOf } from "@/lib/export/monthExport";
import { todayInIsrael } from "@/lib/today";

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
 * pressed — this address produces the file and confirms nothing, so pressing it
 * twice cannot write the month twice.
 *
 * Stage 3 adds the household check beside the worker lookup; today the store is
 * per-cookie and there is nothing else to be reached.
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

  const repository = await getRepository();
  const worker = await repository.getWorker(workerId);
  if (worker === null) return new Response("No such worker", { status: 404 });

  const months = await repository.listMonths(workerId);
  const wanted = months.find((facts) => sameMonth(facts.month, month));
  if (wanted === undefined) {
    return new Response("No such month", { status: 404 });
  }
  if (blocksExport(wanted, todayInIsrael()).length > 0) {
    return new Response("The month has an unanswered question", {
      status: 409,
    });
  }

  // The whole history, because a month's opening balances are the previous
  // month's closing ones and no balance is ever stored (item 13).
  const series = calculateSeries(months, worker, todayInIsrael());
  const inSeries = series.find((one) => sameMonth(one.facts.month, month));
  if (inSeries === undefined) {
    return new Response("No such month", { status: 404 });
  }

  const { bytes, filename } = await monthFileOf({
    worker: {
      id: worker.id,
      name: worker.name,
      firstName: worker.firstName,
    },
    employment: { employedSince: worker.employedSince },
    month: inSeries,
    showNotes,
  });

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
